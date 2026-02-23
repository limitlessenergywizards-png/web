import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';
import {
    buscarBriefing, listarCenas, logFase, salvarCriativo
} from '../db/dal.js';
import {
    removeAudio, addNarration, addSubtitles, addBackgroundMusic,
    applyEffect, exportFinal, getMediaDuration
} from '../tools/video-editor.js';
import { concatenateScenes, assembleCreative } from '../tools/video-concatenator.js';
import { selectMusic, categoryForSentiment } from '../tools/music-selector.js';
import { uploadBuffer, withTempFile } from '../tools/storage-uploader.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tmpDir = () => {
    const dir = path.join(os.tmpdir(), `adsgen_edit_${Date.now()}`);
    fs.ensureDirSync(dir);
    return dir;
};

/**
 * Parse copy_original to get narration text per scene section.
 */
function parseCopyToScenes(copyOriginal) {
    const sections = {};
    const regex = /\[(HOOK\s*\d+|BODY)\]\s*\n([\s\S]*?)(?=\n\[(?:HOOK|BODY)|$)/gi;
    let match;
    while ((match = regex.exec(copyOriginal)) !== null) {
        sections[match[1].trim().toUpperCase()] = match[2].trim();
    }
    return sections;
}

function getTextForScene(cena, copySections) {
    if (cena.texto_naracao) return cena.texto_naracao;
    const tipo = cena.tipo.toUpperCase();
    if (tipo === 'HOOK') return copySections[`HOOK ${cena.ordem}`] || null;
    if (tipo === 'BODY') return copySections['BODY'] || null;
    return null;
}

export const editorAgent = {
    /**
     * Full editing pipeline for a briefing.
     *
     * For each scene:
     *   1. Download video from Supabase Storage / find local
     *   2. removeAudio → addNarration → addSubtitles → applyEffect
     *
     * Then:
     *   3. Concatenate body scenes → body_final
     *   4. For each of 3 hooks: hook{N}_final
     *   5. assembleCreative: 3× (hook + body) = 3 final creatives
     *   6. Upload to Supabase Storage + save to criativos_finais
     */
    async edit(briefingId, opts = {}) {
        const { includeMusic = true, effectHook = 'fade-in', effectBody = 'zoom-in' } = opts;
        const startTime = Date.now();
        const workDir = tmpDir();
        const results = [];

        try {
            logger.info(`[Editor] Starting edit pipeline for ${briefingId}`, { phase: 'EDITOR_START' });

            const briefing = await buscarBriefing(briefingId);
            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'edicao', status: 'iniciado'
            });

            const cenas = await listarCenas(briefingId);
            if (!cenas?.length) throw new Error('No scenes found.');

            const copySections = briefing.copy_original ? parseCopyToScenes(briefing.copy_original) : {};

            // Separate hooks and body scenes
            const hooks = cenas.filter(c => c.tipo === 'hook').sort((a, b) => a.ordem - b.ordem);
            const bodyCenas = cenas.filter(c => c.tipo === 'body').sort((a, b) => a.ordem - b.ordem);

            logger.info(`[Editor] ${hooks.length} hooks, ${bodyCenas.length} body scenes`, { phase: 'EDITOR_SCENES' });

            // ─── Step 1: Process each scene (removeAudio → addNarration → addSubtitles → applyEffect) ───
            const processedScenes = {};

            for (const cena of cenas) {
                logger.info(`[Editor] Processing ${cena.tipo.toUpperCase()} ${cena.ordem}`, { phase: 'EDITOR_SCENE' });

                // a) Get the animated video for this scene
                const videoUrl = await getVideoUrl(cena.id);
                if (!videoUrl) {
                    logger.warn(`[Editor] No video found for ${cena.tipo} ${cena.ordem}, skipping`, { phase: 'EDITOR_SKIP' });
                    continue;
                }

                // Download video to temp
                const videoTmp = path.join(workDir, `${cena.id}_video.mp4`);
                await downloadFromStorage(videoUrl, videoTmp);

                // b) Get narration audio for this scene
                const audioUrl = await getAudioUrl(cena.id);
                const texto = getTextForScene(cena, copySections);

                // c) Pipeline: removeAudio → addNarration → addSubtitles → applyEffect
                let currentPath = videoTmp;

                // Remove original audio
                const mutedPath = path.join(workDir, `${cena.id}_muted.mp4`);
                await removeAudio(currentPath, mutedPath);
                currentPath = mutedPath;

                // Add narration if available
                if (audioUrl) {
                    const audioTmp = path.join(workDir, `${cena.id}_narration.mp3`);
                    await downloadFromStorage(audioUrl, audioTmp);

                    const narratedPath = path.join(workDir, `${cena.id}_narrated.mp4`);
                    await addNarration(currentPath, audioTmp, narratedPath);
                    currentPath = narratedPath;
                }

                // Add subtitles if text available
                if (texto && texto.length > 5) {
                    const subtitledPath = path.join(workDir, `${cena.id}_subtitled.mp4`);
                    await addSubtitles(currentPath, texto, subtitledPath);
                    currentPath = subtitledPath;
                }

                // Apply visual effect
                const effect = cena.tipo === 'hook' ? effectHook : effectBody;
                const effectedPath = path.join(workDir, `${cena.id}_effected.mp4`);
                await applyEffect(currentPath, effect, effectedPath);
                currentPath = effectedPath;

                processedScenes[cena.id] = {
                    path: currentPath,
                    tipo: cena.tipo,
                    ordem: cena.ordem,
                    duration: await getMediaDuration(currentPath)
                };

                logger.info(`[Editor] ✅ ${cena.tipo.toUpperCase()} ${cena.ordem} processed (${processedScenes[cena.id].duration.toFixed(1)}s)`, { phase: 'EDITOR_SCENE_OK' });
            }

            // ─── Step 2: Concatenate body scenes ───
            const bodyPaths = bodyCenas
                .map(c => processedScenes[c.id]?.path)
                .filter(Boolean);

            let bodyFinalPath = null;
            if (bodyPaths.length > 0) {
                bodyFinalPath = path.join(workDir, 'body_final.mp4');
                await concatenateScenes(bodyPaths, bodyFinalPath);
                logger.info(`[Editor] Body assembled: ${(await getMediaDuration(bodyFinalPath)).toFixed(1)}s`, { phase: 'EDITOR_BODY' });
            }

            // ─── Step 3: For each hook, assemble hook + body ───
            for (let i = 0; i < hooks.length; i++) {
                const hook = hooks[i];
                const hookScene = processedScenes[hook.id];
                if (!hookScene || !bodyFinalPath) {
                    logger.warn(`[Editor] Skipping hook ${hook.ordem} — missing scene or body`, { phase: 'EDITOR_SKIP' });
                    continue;
                }

                // Add background music if available
                let finalBody = bodyFinalPath;
                if (includeMusic) {
                    const music = await selectMusic(categoryForSentiment(hook.sentimento));
                    if (music) {
                        const musicBody = path.join(workDir, `body_music_h${hook.ordem}.mp4`);
                        try {
                            await addBackgroundMusic(bodyFinalPath, music.path, musicBody);
                            finalBody = musicBody;
                        } catch (e) {
                            logger.warn(`[Editor] Music failed: ${e.message}`, { phase: 'EDITOR_MUSIC_WARN' });
                        }
                    }
                }

                // Assemble creative: hook + body
                const creativeDir = path.join(workDir, 'finais');
                fs.ensureDirSync(creativeDir);

                const creative = await assembleCreative(hookScene.path, finalBody, creativeDir, {
                    produto: briefing.produto || 'criativo',
                    hookNum: hook.ordem,
                    version: 1
                });

                // Export final (resize to 720×1280 9:16, H.264)
                const exportedPath = path.join(workDir, `export_${creative.fileName}`);
                await exportFinal(creative.outputPath, exportedPath);

                const exportDuration = await getMediaDuration(exportedPath);
                const exportSize = (await fs.stat(exportedPath)).size;

                // Upload to Supabase Storage
                const buffer = await fs.readFile(exportedPath);
                const storagePath = `criativos/${briefingId}/${creative.fileName}`;
                const uploaded = await uploadBuffer(buffer, storagePath, 'video/mp4');

                // Save to criativos_finais
                const dbRecord = await salvarCriativo({
                    projeto_id: briefing.projeto_id,
                    briefing_id: briefingId,
                    hook_numero: hook.ordem,
                    nome_arquivo: creative.fileName,
                    arquivo_path: uploaded.url,
                    duracao_total_segundos: exportDuration,
                    status: 'pronto'
                });

                results.push({
                    hookNum: hook.ordem,
                    fileName: creative.fileName,
                    duration: exportDuration,
                    sizeMB: (exportSize / 1024 / 1024).toFixed(1),
                    url: uploaded.url,
                    dbId: dbRecord.id
                });

                logger.info(`[Editor] 🎬 Creative #${hook.ordem}: ${creative.fileName} (${exportDuration.toFixed(1)}s, ${(exportSize / 1024 / 1024).toFixed(1)}MB)`, { phase: 'EDITOR_CREATIVE_OK' });
            }

            // ─── Cleanup & log ───
            const elapsed = Date.now() - startTime;
            await fs.remove(workDir).catch(() => { });

            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'edicao', status: 'concluido', duracao_ms: elapsed,
                detalhes: {
                    criativos: results.length,
                    duracao_total: results.reduce((s, r) => s + r.duration, 0),
                    tamanho_total_mb: results.reduce((s, r) => s + parseFloat(r.sizeMB), 0).toFixed(1)
                }
            });

            logger.info(`[Editor] ✅ Complete! ${results.length} creatives | ${(elapsed / 1000).toFixed(0)}s`, { phase: 'EDITOR_DONE' });

            return { results, elapsed };

        } catch (error) {
            logger.error(`[Editor] Failed: ${error.message}`, { phase: 'EDITOR_ERR' });
            await fs.remove(workDir).catch(() => { });
            await logFase({
                projeto_id: null, briefing_id: briefingId,
                fase: 'edicao', status: 'erro',
                erro_mensagem: error.message, duracao_ms: Date.now() - startTime
            }).catch(() => { });
            throw error;
        }
    }
};

// ─── Helpers ───

async function getVideoUrl(cenaId) {
    const { data } = await supabase
        .from('assets_video')
        .select('arquivo_url')
        .eq('cena_id', cenaId)
        .eq('status', 'pronto')
        .order('criado_em', { ascending: false })
        .limit(1)
        .single();
    return data?.arquivo_url || null;
}

async function getAudioUrl(cenaId) {
    const { data } = await supabase
        .from('assets_audio')
        .select('arquivo_path')
        .eq('cena_id', cenaId)
        .eq('status', 'pronto')
        .order('criado_em', { ascending: false })
        .limit(1)
        .single();
    return data?.arquivo_path || null;
}

async function downloadFromStorage(url, destPath) {
    fs.ensureDirSync(path.dirname(destPath));

    // If it's a Supabase Storage URL, download via fetch
    if (url.startsWith('http')) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(destPath, buffer);
    } else {
        // Local path
        await fs.copy(url, destPath);
    }
}

export default editorAgent;
