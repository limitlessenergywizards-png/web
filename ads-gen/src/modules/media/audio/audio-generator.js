import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../../../utils/logger.js';
import { listarCenas, salvarAudio, logFase, buscarBriefing, logApiUsage } from '../../../infrastructure/database/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const BASE_URL = 'https://api.elevenlabs.io/v1';

// ElevenLabs cost: ~$0.30 per 1000 chars (multilingual v2)
const COST_PER_CHAR = 0.0003;

export async function listarVozes() {
    try {
        const response = await axios.get(`${BASE_URL}/voices`, {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        return response.data.voices.map(v => ({
            voice_id: v.voice_id, name: v.name, category: v.category, labels: v.labels
        }));
    } catch (err) {
        logger.error(`Failed to list ElevenLabs voices: ${err.message}`, { phase: 'AUDIO_VOICES' });
        throw err;
    }
}

export async function gerarAudio(text, voiceId, outputPath, context = {}) {
    const targetVoiceId = voiceId || ELEVENLABS_VOICE_ID;
    if (!targetVoiceId) throw new Error('Nenhum voice_id fornecido.');

    const modelId = 'eleven_multilingual_v2';
    logger.info(`Generating audio with ElevenLabs (voice: ${targetVoiceId})`, { phase: 'AUDIO_GEN' });
    const startTime = Date.now();

    try {
        const response = await axios.post(
            `${BASE_URL}/text-to-speech/${targetVoiceId}`,
            {
                text, model_id: modelId,
                voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
            },
            {
                headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                responseType: 'arraybuffer'
            }
        );

        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, Buffer.from(response.data));

        const wordCount = text.split(/\s+/).length;
        const durationEstimate = Math.round(wordCount / 2.5);
        const elapsed = Date.now() - startTime;
        const cost = text.length * COST_PER_CHAR;

        // Log cost
        await logApiUsage({
            projeto_id: context.projetoId || null,
            briefing_id: context.briefingId || null,
            cena_id: context.cenaId || null,
            asset_id: context.assetId || null,
            provider: 'elevenlabs',
            modelo: modelId,
            tipo_operacao: 'tts',
            custo_usd: parseFloat(cost.toFixed(4)),
            tokens_total: text.length, // chars used as "tokens" for TTS
            duracao_geracao_ms: elapsed,
            duracao_asset_segundos: durationEstimate,
            prompt_usado: text.substring(0, 500),
            status: 'sucesso',
            resposta_metadata: { voiceId: targetVoiceId, chars: text.length }
        }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

        logger.info(`Audio saved: ${outputPath} (~${durationEstimate}s) | Cost: $${cost.toFixed(4)} | ${elapsed}ms`, { phase: 'AUDIO_SAVED' });
        return { filePath: outputPath, durationEstimate, cost, elapsed, model: modelId };

    } catch (err) {
        const errorMsg = err.response?.data ? Buffer.from(err.response.data).toString('utf8') : err.message;
        await logApiUsage({
            provider: 'elevenlabs', modelo: modelId, tipo_operacao: 'tts',
            custo_usd: 0, duracao_geracao_ms: Date.now() - startTime,
            status: 'erro', erro_mensagem: errorMsg,
            ...(context.projetoId && { projeto_id: context.projetoId }),
        }).catch(() => { });
        logger.error(`ElevenLabs TTS failed: ${errorMsg}`, { phase: 'AUDIO_ERROR' });
        throw new Error(`ElevenLabs TTS failed: ${errorMsg}`);
    }
}

export async function gerarAudiosPorBriefing(briefingId, voiceId = null) {
    logger.info(`Starting Audio Generation pipeline for briefing ${briefingId}`, { phase: 'AUDIO_PIPELINE' });
    const startTime = Date.now();

    try {
        const briefing = await buscarBriefing(briefingId);
        const copyParseada = briefing.copy_parseada;
        if (!copyParseada) throw new Error('Briefing não possui copy_parseada.');

        await logFase({ projeto_id: briefing.projeto_id, briefing_id: briefingId, fase: 'audio', status: 'iniciado' });

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

            if (!textoParaNarrar) continue;

            const fileName = `${cena.tipo}_${cena.ordem}.mp3`;
            const outputPath = path.join(audioDir, fileName);

            const result = await gerarAudio(textoParaNarrar, voiceId, outputPath, {
                projetoId: briefing.projeto_id, briefingId, cenaId: cena.id
            });

            const audioRecord = await salvarAudio({
                cena_id: cena.id, texto_narrado: textoParaNarrar,
                voice_id: voiceId || ELEVENLABS_VOICE_ID,
                voice_nome: 'ElevenLabs Multilingual v2',
                duracao_segundos: result.durationEstimate,
                arquivo_path: result.filePath, status: 'pronto',
                modelo_usado: result.model, custo_usd: result.cost,
                duracao_geracao_ms: result.elapsed
            });

            resultados.push({
                cena: cena.id, tipo: cena.tipo, audioId: audioRecord.id,
                path: result.filePath, cost: result.cost,
                tag: `[${cena.tipo.toUpperCase()} ${cena.ordem}] modelo: ${result.model}`
            });
        }

        const totalCost = resultados.reduce((s, r) => s + (r.cost || 0), 0);
        await logFase({
            projeto_id: briefing.projeto_id, briefing_id: briefingId,
            fase: 'audio', status: 'concluido', duracao_ms: Date.now() - startTime,
            detalhes: { total_audios: resultados.length, custo_total: totalCost }
        });

        logger.info(`Audio pipeline complete. ${resultados.length} audios. Cost: $${totalCost.toFixed(4)}`, { phase: 'AUDIO_COMPLETE' });
        return resultados;

    } catch (error) {
        logger.error(`Audio pipeline failed: ${error.message}`, { phase: 'AUDIO_PIPELINE_ERROR' });
        throw error;
    }
}
