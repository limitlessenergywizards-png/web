import { logger } from '../utils/logger.js';

/**
 * Compare video duration vs audio duration and calculate speed adjustment needed.
 * 
 * Safe range: 0.85 – 1.15 (±15%)
 * If delta > 15%, flags the scene for re-animation or re-recording.
 * 
 * @param {number} videoDuracao - Video duration in seconds
 * @param {number} audioDuracao - Audio duration in seconds
 * @param {string} cenaId - Scene ID for logging
 * @returns {{ cenaId, videoDuracao, audioDuracao, delta, fatorVelocidade, ajusteNecessario, acao }}
 */
export function calcularSincronizacao(videoDuracao, audioDuracao, cenaId = '') {
    if (!videoDuracao || !audioDuracao) {
        return {
            cenaId, videoDuracao, audioDuracao,
            delta: 0, fatorVelocidade: 1.0,
            ajusteNecessario: false, acao: 'sem_dados'
        };
    }

    // fator = audio / video
    // Se áudio é mais longo que vídeo → fator > 1 → precisa acelerar áudio
    // Se áudio é mais curto que vídeo → fator < 1 → precisa desacelerar áudio
    const fatorVelocidade = audioDuracao / videoDuracao;
    const delta = Math.abs(1 - fatorVelocidade);
    const deltaPercent = (delta * 100).toFixed(1);

    const SAFE_MIN = 0.85;
    const SAFE_MAX = 1.15;

    let ajusteNecessario = false;
    let acao = 'ok';

    if (fatorVelocidade < SAFE_MIN || fatorVelocidade > SAFE_MAX) {
        ajusteNecessario = true;
        if (audioDuracao > videoDuracao) {
            acao = 'reanimar_video'; // vídeo muito curto para o áudio
            logger.warn(
                `[Sync] ⚠️ Cena ${cenaId}: áudio (${audioDuracao.toFixed(1)}s) > vídeo (${videoDuracao.toFixed(1)}s) — delta ${deltaPercent}% — REANIMAR VÍDEO com duração maior`,
                { phase: 'SYNC_WARN' }
            );
        } else {
            acao = 'regravar_audio'; // áudio muito curto para o vídeo
            logger.warn(
                `[Sync] ⚠️ Cena ${cenaId}: vídeo (${videoDuracao.toFixed(1)}s) > áudio (${audioDuracao.toFixed(1)}s) — delta ${deltaPercent}% — REGRAVAR ÁUDIO ou reduzir texto`,
                { phase: 'SYNC_WARN' }
            );
        }
    } else if (delta > 0.05) {
        acao = 'ajustar_velocidade'; // dentro do range seguro, mas não perfeito
        logger.info(
            `[Sync] Cena ${cenaId}: ajuste de velocidade ×${fatorVelocidade.toFixed(3)} (delta ${deltaPercent}%)`,
            { phase: 'SYNC_ADJUST' }
        );
    } else {
        logger.info(
            `[Sync] ✅ Cena ${cenaId}: sincronizado (delta ${deltaPercent}%)`,
            { phase: 'SYNC_OK' }
        );
    }

    return {
        cenaId,
        videoDuracao: +videoDuracao.toFixed(2),
        audioDuracao: +audioDuracao.toFixed(2),
        delta: +delta.toFixed(4),
        deltaPercent: `${deltaPercent}%`,
        fatorVelocidade: +fatorVelocidade.toFixed(4),
        ajusteNecessario,
        acao
    };
}

/**
 * Batch sync calculation for all scenes
 * @param {Array<{ cenaId, videoDuracao, audioDuracao }>} scenes
 * @returns {{ results, summary }}
 */
export function calcularSincronizacaoBatch(scenes) {
    const results = scenes.map(s => calcularSincronizacao(s.videoDuracao, s.audioDuracao, s.cenaId));

    const ok = results.filter(r => r.acao === 'ok').length;
    const ajustar = results.filter(r => r.acao === 'ajustar_velocidade').length;
    const reanimar = results.filter(r => r.acao === 'reanimar_video').length;
    const regravar = results.filter(r => r.acao === 'regravar_audio').length;

    const summary = {
        total: results.length,
        sincronizados: ok,
        ajuste_velocidade: ajustar,
        reanimar_video: reanimar,
        regravar_audio: regravar
    };

    logger.info(`[Sync] Batch: ${ok} OK | ${ajustar} ajustar | ${reanimar} reanimar | ${regravar} regravar`, { phase: 'SYNC_BATCH' });

    return { results, summary };
}

export default { calcularSincronizacao, calcularSincronizacaoBatch };
