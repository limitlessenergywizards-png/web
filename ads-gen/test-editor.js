/**
 * Test Video Editing Pipeline
 * Uses existing local videos + real Supabase audio to run the full pipeline:
 *   removeAudio → addNarration → addSubtitles → applyEffect → concat → export → upload
 *
 * All temp files in /tmp, final output uploaded to Supabase Storage.
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { createClient } from '@supabase/supabase-js';
import { logger } from './src/utils/logger.js';
import {
    removeAudio, addNarration, addSubtitles,
    applyEffect, exportFinal, getMediaDuration
} from './src/tools/video-editor.js';
import { concatenateScenes, assembleCreative } from './src/tools/video-concatenator.js';
import { uploadBuffer } from './src/infrastructure/storage/storage-uploader.js';
import { salvarCriativo, buscarUltimoBriefing, listarCenas } from './src/infrastructure/database/dal.js';
import { calcularSincronizacaoBatch } from './src/tools/sync-calculator.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCopy(copy) {
    const sections = {};
    const regex = /\[(HOOK\s*\d+|BODY)\]\s*\n([\s\S]*?)(?=\n\[(?:HOOK|BODY)|$)/gi;
    let match;
    while ((match = regex.exec(copy)) !== null) {
        sections[match[1].trim().toUpperCase()] = match[2].trim();
    }
    return sections;
}

async function runTest() {
    const workDir = path.join(os.tmpdir(), `adsgen_test_editor_${Date.now()}`);
    await fs.ensureDir(workDir);

    try {
        logger.info("=== VIDEO EDITING TEST ===", { phase: "TEST_START" });

        // 1. Get briefing + scenes + copy
        const briefing = await buscarUltimoBriefing();
        const cenas = await listarCenas(briefing.id);
        const copySections = parseCopy(briefing.copy_original || '');
        console.log(`📄 Briefing: ${briefing.id} | ${cenas.length} scenes`);

        // 2. Get audio URLs from DB (latest per scene)
        const audioMap = {};
        for (const cena of cenas) {
            const { data } = await supabase
                .from('assets_audio').select('arquivo_path, duracao_segundos')
                .eq('cena_id', cena.id).eq('status', 'pronto')
                .order('criado_em', { ascending: false }).limit(1).single();
            if (data?.arquivo_path?.startsWith('http')) {
                audioMap[cena.id] = data;
            }
        }
        console.log(`🎙️  Audio: ${Object.keys(audioMap).length}/${cenas.length} scenes have narration`);

        // 3. Find existing local videos
        const videoDir = path.join(process.cwd(), 'data', 'video', briefing.id);
        const hookVid = path.join(videoDir, 'hook_1_v1.mp4');
        const bodyVid = path.join(videoDir, 'body_99_v1.mp4');

        if (!(await fs.pathExists(hookVid))) throw new Error(`Hook video not found: ${hookVid}`);
        if (!(await fs.pathExists(bodyVid))) throw new Error(`Body video not found: ${bodyVid}`);

        const hookOrigDur = await getMediaDuration(hookVid);
        const bodyOrigDur = await getMediaDuration(bodyVid);
        console.log(`🎬 Hook 1: ${hookOrigDur.toFixed(1)}s | Body: ${bodyOrigDur.toFixed(1)}s`);

        const hookCena = cenas.find(c => c.tipo === 'hook' && c.ordem === 1);
        const bodyCena = cenas.find(c => c.tipo === 'body');
        const hookText = copySections['HOOK 1'];
        const bodyText = copySections['BODY'];

        // ─── Step 4: Process HOOK 1 ───
        console.log("\n🔧 Processing HOOK 1...");

        const hookMuted = path.join(workDir, 'hook1_muted.mp4');
        await removeAudio(hookVid, hookMuted);
        let hookCurrent = hookMuted;

        const hookAudio = audioMap[hookCena?.id];
        if (hookAudio) {
            console.log(`  🎙️ Adding narration (${hookAudio.duracao_segundos?.toFixed(1)}s)...`);
            const hookAudioTmp = path.join(workDir, 'hook1_audio.mp3');
            const resp = await fetch(hookAudio.arquivo_path);
            await fs.writeFile(hookAudioTmp, Buffer.from(await resp.arrayBuffer()));

            const hookNarrated = path.join(workDir, 'hook1_narrated.mp4');
            await addNarration(hookCurrent, hookAudioTmp, hookNarrated);
            hookCurrent = hookNarrated;
        }

        if (hookText) {
            console.log(`  📝 Adding subtitles (${hookText.length} chars)...`);
            const hookSubbed = path.join(workDir, 'hook1_subtitled.mp4');
            await addSubtitles(hookCurrent, hookText, hookSubbed);
            hookCurrent = hookSubbed;
        }

        const hookEffected = path.join(workDir, 'hook1_final.mp4');
        await applyEffect(hookCurrent, 'fade-in', hookEffected);
        hookCurrent = hookEffected;
        console.log(`  ✅ Hook done: ${(await getMediaDuration(hookCurrent)).toFixed(1)}s`);

        // ─── Step 5: Process BODY ───
        console.log("\n🔧 Processing BODY...");

        const bodyMuted = path.join(workDir, 'body_muted.mp4');
        await removeAudio(bodyVid, bodyMuted);
        let bodyCurrent = bodyMuted;

        const bodyAudio = audioMap[bodyCena?.id];
        if (bodyAudio) {
            console.log(`  🎙️ Adding narration (${bodyAudio.duracao_segundos?.toFixed(1)}s)...`);
            const bodyAudioTmp = path.join(workDir, 'body_audio.mp3');
            const resp = await fetch(bodyAudio.arquivo_path);
            await fs.writeFile(bodyAudioTmp, Buffer.from(await resp.arrayBuffer()));

            const bodyNarrated = path.join(workDir, 'body_narrated.mp4');
            await addNarration(bodyCurrent, bodyAudioTmp, bodyNarrated);
            bodyCurrent = bodyNarrated;
        }

        if (bodyText) {
            console.log(`  📝 Adding subtitles (${bodyText.length} chars)...`);
            const bodySubbed = path.join(workDir, 'body_subtitled.mp4');
            await addSubtitles(bodyCurrent, bodyText, bodySubbed);
            bodyCurrent = bodySubbed;
        }

        const bodyEffected = path.join(workDir, 'body_final.mp4');
        await applyEffect(bodyCurrent, 'zoom-in', bodyEffected);
        bodyCurrent = bodyEffected;
        console.log(`  ✅ Body done: ${(await getMediaDuration(bodyCurrent)).toFixed(1)}s`);

        // ─── Step 6: Assemble creative ───
        console.log("\n🎬 Assembling hook + body...");
        const creativeDir = path.join(workDir, 'finais');
        await fs.ensureDir(creativeDir);

        const creative = await assembleCreative(hookCurrent, bodyCurrent, creativeDir, {
            produto: 'test',
            hookNum: 1,
            version: 1
        });

        // ─── Step 7: Export final ───
        console.log("\n📦 Exporting final (720×1280 H.264)...");
        const exportedPath = path.join(workDir, `export_${creative.fileName}`);
        await exportFinal(creative.outputPath, exportedPath);

        const finalDuration = await getMediaDuration(exportedPath);
        const finalSize = (await fs.stat(exportedPath)).size;
        const finalSizeMB = (finalSize / 1024 / 1024).toFixed(1);

        // ─── Step 8: Upload to Supabase ───
        console.log("\n☁️  Uploading...");
        const buffer = await fs.readFile(exportedPath);
        const uploaded = await uploadBuffer(buffer, `criativos/${briefing.id}/${creative.fileName}`, 'video/mp4');

        // Save to DB
        let dbId = null;
        try {
            const record = await salvarCriativo({
                projeto_id: briefing.projeto_id,
                briefing_id: briefing.id,
                hook_numero: 1,
                nome_arquivo: creative.fileName,
                arquivo_path: uploaded.url,
                duracao_total_segundos: finalDuration,
                status: 'pronto'
            });
            dbId = record.id;
        } catch (e) {
            console.log(`  ⚠️  DB: ${e.message}`);
        }

        // ─── Report ───
        console.log("\n\n══════════════════════════════════════");
        console.log("🎬 VIDEO EDITING REPORT");
        console.log("══════════════════════════════════════");
        console.log(`📁 ${creative.fileName}`);
        console.log(`⏱️  Duration: ${finalDuration.toFixed(1)}s`);
        console.log(`📐 720×1280 (9:16) | H.264 | 30fps`);
        console.log(`📦 Size: ${finalSizeMB}MB`);
        console.log(`☁️  ${uploaded.url}`);
        console.log(`💾 DB: ${dbId || 'not saved'}`);
        console.log(`📝 Subtitles: hook=${!!hookText} | body=${!!bodyText}`);
        console.log(`🎙️  Narration: hook=${!!hookAudio} | body=${!!bodyAudio}`);

    } catch (error) {
        logger.error(`Test failed: ${error.message}`, { phase: "TEST_ERROR" });
        console.error(error.stack);
    } finally {
        await fs.remove(workDir).catch(() => { });
        process.exit(0);
    }
}

runTest();
