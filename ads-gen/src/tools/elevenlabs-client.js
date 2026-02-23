import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { logApiUsage } from '../db/dal.js';
import { withRetry } from '../utils/retry.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const API_BASE = 'https://api.elevenlabs.io/v1';

function getHeaders() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey || apiKey.length < 10) throw new Error('ELEVENLABS_API_KEY not configured');
    return { 'xi-api-key': apiKey };
}

/**
 * Generate speech from text using ElevenLabs TTS
 * @param {string} texto - Text to synthesize
 * @param {string} voiceId - Voice ID (from .env or cloneVoice)
 * @param {Object} config - Voice settings
 * @returns {Buffer} MP3 audio buffer
 */
export async function generateSpeech(texto, voiceId = null, config = {}) {
    const voice = voiceId || process.env.ELEVENLABS_VOICE_ID;
    if (!voice) throw new Error('No voice_id provided. Set ELEVENLABS_VOICE_ID in .env or pass voiceId.');

    const {
        stability = 0.5,
        similarity_boost = 0.8,
        style = 0.3,
        use_speaker_boost = true,
        model_id = 'eleven_multilingual_v2'
    } = config;

    logger.info(`[ElevenLabs] Generating speech (${texto.length} chars) voice=${voice}`, { phase: 'TTS_GEN' });
    const startTime = Date.now();

    try {
        const response = await withRetry(() => axios.post(
            `${API_BASE}/text-to-speech/${voice}`,
            {
                text: texto,
                model_id,
                voice_settings: { stability, similarity_boost, style, use_speaker_boost }
            },
            {
                headers: { ...getHeaders(), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                responseType: 'arraybuffer',
                timeout: 60_000
            }
        ), 3, 2000, 'ElevenLabs TTS Generation');

        const buffer = Buffer.from(response.data);
        const elapsed = Date.now() - startTime;

        // ElevenLabs pricing: ~$0.30 per 1000 chars (Creator tier)
        const costEstimate = (texto.length / 1000) * 0.30;

        await logApiUsage({
            provider: 'elevenlabs', modelo: model_id, tipo_operacao: 'text_to_speech',
            custo_usd: costEstimate, duracao_geracao_ms: elapsed,
            prompt_usado: texto.substring(0, 500), status: 'sucesso'
        }).catch(() => { });

        logger.info(`[ElevenLabs] Speech ready: ${buffer.length} bytes (${(elapsed / 1000).toFixed(1)}s) | $${costEstimate.toFixed(3)}`, { phase: 'TTS_DONE' });
        return { buffer, cost: costEstimate, elapsed, chars: texto.length };

    } catch (err) {
        const errMsg = err.response?.data
            ? Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data)
            : err.message;
        logger.error(`[ElevenLabs] TTS failed: ${errMsg}`, { phase: 'TTS_ERROR' });
        throw new Error(`ElevenLabs TTS failed: ${errMsg}`);
    }
}

/**
 * Clone a voice from an audio sample
 * @param {string} audioPath - Path to clean audio file (MP3/WAV/M4A)
 * @param {string} nome - Name for the cloned voice
 * @returns {{ voiceId, name }}
 */
export async function cloneVoice(audioPath, nome) {
    logger.info(`[ElevenLabs] Cloning voice "${nome}" from ${audioPath}`, { phase: 'VOICE_CLONE' });

    const form = new FormData();
    form.append('name', nome);
    form.append('files', fs.createReadStream(audioPath));
    form.append('description', `Cloned voice for ADS-GEN pipeline: ${nome}`);

    try {
        const response = await axios.post(
            `${API_BASE}/voices/add`,
            form,
            {
                headers: { ...getHeaders(), ...form.getHeaders() },
                timeout: 120_000
            }
        );

        const voiceId = response.data.voice_id;
        logger.info(`[ElevenLabs] Voice cloned! ID: ${voiceId}`, { phase: 'VOICE_CLONE_OK' });
        logger.info(`[ElevenLabs] ⚠️  Add to .env: ELEVENLABS_VOICE_ID="${voiceId}"`, { phase: 'VOICE_CLONE_ENV' });

        return { voiceId, name: nome };

    } catch (err) {
        const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        logger.error(`[ElevenLabs] Clone failed: ${errMsg}`, { phase: 'VOICE_CLONE_ERR' });
        throw new Error(`Voice clone failed: ${errMsg}`);
    }
}

/**
 * List all available voices in the account
 * @returns {Array<{ voice_id, name, category, labels }>}
 */
export async function listVoices() {
    logger.info(`[ElevenLabs] Listing voices...`, { phase: 'VOICE_LIST' });

    const response = await axios.get(`${API_BASE}/voices`, { headers: getHeaders() });
    const voices = response.data.voices || [];

    const summary = voices.map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
        preview_url: v.preview_url
    }));

    logger.info(`[ElevenLabs] Found ${summary.length} voices`, { phase: 'VOICE_LIST_OK' });
    return summary;
}

/**
 * Get subscription info (remaining characters, etc.)
 */
export async function getSubscription() {
    const response = await axios.get(`${API_BASE}/user/subscription`, { headers: getHeaders() });
    return response.data;
}

export default { generateSpeech, cloneVoice, listVoices, getSubscription };
