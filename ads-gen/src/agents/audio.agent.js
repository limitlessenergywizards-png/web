import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';
import { buscarBriefing, listarCenas, salvarAudio, logFase } from '../db/dal.js';
import { generateSpeech } from '../tools/elevenlabs-client.js';
import { normalizeVolume, getAudioDuration } from '../tools/audio-processor.js';
import { uploadAudio, withTempFile } from '../tools/storage-uploader.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

/**
 * Parse copy_original from briefing into sections: [HOOK 1], [HOOK 2], [BODY], etc.
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
    const tipo = cena.tipo.toUpperCase();
    if (tipo === 'HOOK') return copySections[`HOOK ${cena.ordem}`] || null;
    if (tipo === 'BODY') return copySections['BODY'] || null;
    return cena.texto_naracao || null;
}

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

                // All processing uses temp files in /tmp — nothing in the project folder
                const storageUrl = await withTempFile('.mp3', async (rawTmp) => {
                    return await withTempFile('.mp3', async (normTmp) => {
                        // 1. Generate TTS → write to temp
                        const ttsResult = await generateSpeech(texto, voice);
                        await fs.writeFile(rawTmp, ttsResult.buffer);
                        totalChars += ttsResult.chars;
                        totalCost += ttsResult.cost;

                        // 2. Normalize volume → another temp file
                        await normalizeVolume(rawTmp, normTmp, targetDb);

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
