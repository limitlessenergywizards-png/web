import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { listarCenas, salvarAudio, logFase, buscarBriefing } from '../db/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

const BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Lists available voices from ElevenLabs
 */
export async function listarVozes() {
    try {
        const response = await axios.get(`${BASE_URL}/voices`, {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        return response.data.voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            category: v.category,
            labels: v.labels
        }));
    } catch (err) {
        logger.error(`Failed to list ElevenLabs voices: ${err.message}`, { phase: 'AUDIO_VOICES' });
        throw err;
    }
}

/**
 * Generates audio from text using ElevenLabs TTS
 * @param {string} text - The text to convert to speech
 * @param {string} voiceId - The ElevenLabs voice ID
 * @param {string} outputPath - Where to save the mp3 file
 * @returns {Object} - { filePath, durationEstimate }
 */
export async function gerarAudio(text, voiceId, outputPath) {
    const targetVoiceId = voiceId || ELEVENLABS_VOICE_ID;

    if (!targetVoiceId) {
        throw new Error('Nenhum voice_id fornecido. Configure ELEVENLABS_VOICE_ID no .env ou passe como parâmetro.');
    }

    logger.info(`Generating audio with ElevenLabs (voice: ${targetVoiceId})`, { phase: 'AUDIO_GEN' });

    try {
        const response = await axios.post(
            `${BASE_URL}/text-to-speech/${targetVoiceId}`,
            {
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.3,
                    use_speaker_boost: true
                }
            },
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                responseType: 'arraybuffer'
            }
        );

        // Ensure directory exists
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, Buffer.from(response.data));

        // Estimate duration from word count (~2.5 words per second for Spanish)
        const wordCount = text.split(/\s+/).length;
        const durationEstimate = Math.round(wordCount / 2.5);

        logger.info(`Audio saved: ${outputPath} (~${durationEstimate}s)`, { phase: 'AUDIO_SAVED' });

        return {
            filePath: outputPath,
            durationEstimate
        };
    } catch (err) {
        const errorMsg = err.response?.data
            ? Buffer.from(err.response.data).toString('utf8')
            : err.message;
        logger.error(`ElevenLabs TTS failed: ${errorMsg}`, { phase: 'AUDIO_ERROR' });
        throw new Error(`ElevenLabs TTS failed: ${errorMsg}`);
    }
}

/**
 * Generates audio for all scenes of a briefing
 * @param {string} briefingId - The briefing ID
 * @param {string} [voiceId] - Optional override for voice
 */
export async function gerarAudiosPorBriefing(briefingId, voiceId = null) {
    logger.info(`Starting Audio Generation pipeline for briefing ${briefingId}`, { phase: 'AUDIO_PIPELINE' });
    const startTime = Date.now();

    try {
        const briefing = await buscarBriefing(briefingId);
        const copyParseada = briefing.copy_parseada;

        if (!copyParseada) {
            throw new Error('Briefing não possui copy_parseada. Execute o parser primeiro.');
        }

        await logFase({
            projeto_id: briefing.projeto_id,
            briefing_id: briefingId,
            fase: 'audio',
            status: 'iniciado'
        });

        const cenas = await listarCenas(briefingId);
        const resultados = [];
        const audioDir = path.join(process.cwd(), 'data', 'audio', briefingId);

        for (const cena of cenas) {
            let textoParaNarrar = '';

            if (cena.tipo === 'hook') {
                const hookData = copyParseada.hooks?.find(h => h.numero === cena.ordem);
                textoParaNarrar = hookData?.texto || '';
            } else if (cena.tipo === 'body') {
                textoParaNarrar = copyParseada.body?.texto || '';
            }

            if (!textoParaNarrar) {
                logger.warn(`Skipping scene ${cena.id} — no text for narration`, { phase: 'AUDIO_SKIP' });
                continue;
            }

            const fileName = `${cena.tipo}_${cena.ordem}.mp3`;
            const outputPath = path.join(audioDir, fileName);

            const result = await gerarAudio(textoParaNarrar, voiceId, outputPath);

            // Save to Supabase
            const audioRecord = await salvarAudio({
                cena_id: cena.id,
                texto_narrado: textoParaNarrar,
                voice_id: voiceId || ELEVENLABS_VOICE_ID,
                voice_nome: 'ElevenLabs Multilingual v2',
                duracao_segundos: result.durationEstimate,
                arquivo_path: result.filePath,
                status: 'pronto'
            });

            resultados.push({ cena: cena.id, tipo: cena.tipo, audioId: audioRecord.id, path: result.filePath });
        }

        await logFase({
            projeto_id: briefing.projeto_id,
            briefing_id: briefingId,
            fase: 'audio',
            status: 'concluido',
            duracao_ms: Date.now() - startTime,
            detalhes: { total_audios: resultados.length }
        });

        logger.info(`Audio pipeline complete. ${resultados.length} audios generated.`, { phase: 'AUDIO_COMPLETE' });
        return resultados;

    } catch (error) {
        logger.error(`Audio pipeline failed: ${error.message}`, { phase: 'AUDIO_PIPELINE_ERROR' });
        throw error;
    }
}
