import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { logger } from '../../../utils/logger.js';
import { buscarBriefing, listarCenas, salvarAudio, logFase, buscarAudioIdentico } from '../../../infrastructure/database/dal.js';
import { generateSpeechFactory } from './audio-factory.js';
import { normalizeVolume, getAudioDuration } from '../../assembly/audio-processor.js';
import { uploadAudio, withTempFile } from '../../../infrastructure/storage/storage-uploader.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

import { parseCopyToScenes, getTextForScene } from '../../briefing/domain/scene-parser.js';

export const audioAgent = {
    /**
     * Generate audio for all scenes in a briefing.
     * All files go to Supabase Storage — NO local files in the project.
     * Uses os.tmpdir() for FFmpeg processing, cleaned up automatically.
     */
    async generate(briefingId, opts = {}) {
        const { voiceId = null, targetDb = -16 } = opts;
        logger.info(`[AudioAgent] Starting for briefing ${briefingId}`, { phase: 'AUDIO_AGENT_START' });
        const startTime = Date.now();
        let totalChars = 0;
        let totalCost = 0;
        const results = [];

        try {
            const briefing = await buscarBriefing(briefingId);
            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'audio_geracao', status: 'iniciado'
            });

            const cenas = await listarCenas(briefingId);
            if (!cenas?.length) throw new Error('No scenes found.');

            // Parse copy to extract text per scene
            const copySections = briefing.copy_original ? parseCopyToScenes(briefing.copy_original) : {};

            logger.info(`[AudioAgent] ${cenas.length} scenes | ${Object.keys(copySections).length} copy sections`, { phase: 'AUDIO_SCENES' });

            const voice = voiceId || process.env.ELEVENLABS_VOICE_ID;

            for (const cena of cenas) {
                const texto = getTextForScene(cena, copySections);
                if (!texto || texto.trim().length < 5) {
                    logger.warn(`[AudioAgent] Scene ${cena.tipo} ${cena.ordem}: no text, skipping`, { phase: 'AUDIO_SKIP' });
                    continue;
                }

                logger.info(`[AudioAgent] [${cena.tipo.toUpperCase()} ${cena.ordem}] "${texto.substring(0, 60)}..." (${texto.length} chars)`, { phase: 'AUDIO_SCENE' });

                // Check cache first
                const existing = await buscarAudioIdentico(texto, voice);
                if (existing) {
                    logger.info(`[AudioAgent] ♻️ Reusing existing audio (ID: ${existing.id}) for exact match!`, { phase: 'AUDIO_REUSE' });

                    const audioRecord = await salvarAudio({
                        cena_id: cena.id,
                        texto_narrado: texto,
                        voice_id: voice,
                        voice_nome: existing.voice_nome,
                        modelo_usado: existing.modelo_usado,
                        custo_usd: 0, // Cached -> no cost
                        duracao_geracao_ms: 0,
                        duracao_segundos: existing.duracao_segundos,
                        arquivo_path: existing.arquivo_path,
                        status: 'pronto'
                    });

                    results.push({
                        cenaId: cena.id, tipo: cena.tipo, ordem: cena.ordem,
                        chars: 0, duracao: existing.duracao_segundos, cost: 0,
                        storageUrl: existing.arquivo_path, audioId: audioRecord.id
                    });
                    continue;
                }

                // All processing uses temp files in /tmp — nothing in the project folder
                const storageUrl = await withTempFile('.mp3', async (rawTmp) => {
                    return await withTempFile('.mp3', async (normTmp) => {
                        // 1. Generate TTS → write to temp via Factory
                        const ttsResult = await generateSpeechFactory(texto, voice);
                        await fs.writeFile(rawTmp, ttsResult.buffer);
                        totalChars += ttsResult.chars;
                        totalCost += ttsResult.cost;

                        // 1.5 Upload raw audio to Supabase so Rendi can access it via URL
                        const rawFileName = `${briefingId}/raw_${cena.tipo}_${cena.ordem}.mp3`;
                        const rawUploaded = await uploadAudio(rawTmp, rawFileName);

                        // 2. Normalize volume (Cloud via Rendi) → writes back to normTmp
                        await normalizeVolume(rawUploaded.url, normTmp, targetDb);

                        // 3. Get duration
                        const duracao = await getAudioDuration(normTmp);

                        // 4. Upload normalized audio to Supabase Storage
                        const fileName = `${briefingId}/${cena.tipo}_${cena.ordem}.mp3`;
                        const uploaded = await uploadAudio(normTmp, fileName);

                        // 5. Save to DB
                        const audioRecord = await salvarAudio({
                            cena_id: cena.id,
                            texto_narrado: texto,
                            voice_id: voice,
                            voice_nome: 'ElevenLabs',
                            modelo_usado: 'eleven_multilingual_v2',
                            custo_usd: ttsResult.cost,
                            duracao_geracao_ms: ttsResult.elapsed,
                            duracao_segundos: duracao,
                            arquivo_path: uploaded.url,
                            status: 'pronto'
                        });

                        results.push({
                            cenaId: cena.id, tipo: cena.tipo, ordem: cena.ordem,
                            chars: texto.length, duracao, cost: ttsResult.cost,
                            storageUrl: uploaded.url, audioId: audioRecord.id
                        });

                        logger.info(`[AudioAgent] ✅ [${cena.tipo.toUpperCase()} ${cena.ordem}] ${duracao.toFixed(1)}s | ☁️ Supabase Storage`, { phase: 'AUDIO_SCENE_OK' });

                        return uploaded.url;
                    });
                });
            }

            const elapsed = Date.now() - startTime;

            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'audio_geracao', status: 'concluido', duracao_ms: elapsed,
                detalhes: {
                    total_cenas: results.length,
                    total_caracteres: totalChars,
                    custo_estimado_usd: totalCost,
                    duracao_total_audio: results.reduce((s, r) => s + r.duracao, 0)
                }
            });

            logger.info(
                `[AudioAgent] Complete! ${results.length} audios | ${totalChars} chars | $${totalCost.toFixed(3)} | all in Supabase Storage`,
                { phase: 'AUDIO_AGENT_OK' }
            );

            return { results, totalChars, totalCost, elapsed };

        } catch (error) {
            logger.error(`[AudioAgent] Failed: ${error.message}`, { phase: 'AUDIO_AGENT_ERR' });
            await logFase({
                projeto_id: null, briefing_id: briefingId,
                fase: 'audio_geracao', status: 'erro',
                erro_mensagem: error.message, duracao_ms: Date.now() - startTime
            }).catch(() => { });
            throw error;
        }
    }
};

export default audioAgent;
