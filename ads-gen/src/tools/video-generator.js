import { fal } from '@fal-ai/client';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { salvarVideo, atualizarStatusVideo, listarCenas, buscarBriefing, logFase, logApiUsage } from '../db/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

fal.config({ credentials: process.env.FAL_API_KEY });

// FAL AI cost estimates (USD per generation based on model + duration)
const COST_TABLE = {
    'fal-ai/kling-video/v2/master/text-to-video': { '5': 0.065, '10': 0.13 },
    'fal-ai/kling-video/v2/master/image-to-video': { '5': 0.065, '10': 0.13 },
    'fal-ai/minimax-video/image-to-video': { '5': 0.08, '10': 0.16 },
    'fal-ai/runway-gen3/turbo/image-to-video': { '5': 0.10, '10': 0.20 },
};

const MODELS = {
    kling_text: 'fal-ai/kling-video/v2/master/text-to-video',
    kling_image: 'fal-ai/kling-video/v2/master/image-to-video',
    minimax: 'fal-ai/minimax-video/image-to-video',
    runway: 'fal-ai/runway-gen3/turbo/image-to-video',
};

function estimateCost(modelId, duration) {
    const modelCosts = COST_TABLE[modelId];
    if (!modelCosts) return 0.07; // fallback estimate
    return modelCosts[String(duration)] || 0.07;
}

export async function gerarVideoTexto({ prompt, duration = 5, aspectRatio = '9:16', context = {} }) {
    const modelId = MODELS.kling_text;
    logger.info(`Generating text-to-video with Kling v2 (${duration}s, ${aspectRatio})`, { phase: 'VIDEO_GEN' });
    const startTime = Date.now();

    try {
        const result = await fal.subscribe(modelId, {
            input: { prompt, duration: String(duration), aspect_ratio: aspectRatio },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS' && update.logs) {
                    update.logs.forEach(log => logger.info(`  FAL: ${log.message}`, { phase: 'VIDEO_QUEUE' }));
                }
            }
        });

        const videoUrl = result.data?.video?.url;
        if (!videoUrl) throw new Error('No video URL returned from FAL AI');

        const elapsed = Date.now() - startTime;
        const cost = estimateCost(modelId, duration);

        // Log cost tracking
        await logApiUsage({
            projeto_id: context.projetoId || null,
            briefing_id: context.briefingId || null,
            cena_id: context.cenaId || null,
            asset_id: context.assetId || null,
            provider: 'fal_ai',
            modelo: modelId,
            tipo_operacao: 'text_to_video',
            custo_usd: cost,
            duracao_geracao_ms: elapsed,
            duracao_asset_segundos: duration,
            prompt_usado: prompt.substring(0, 500),
            resolucao: '720p',
            aspect_ratio: aspectRatio,
            status: 'sucesso',
            resposta_metadata: { requestId: result.requestId, videoUrl }
        }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

        logger.info(`Text-to-video generated in ${(elapsed / 1000).toFixed(1)}s | Cost: $${cost}`, { phase: 'VIDEO_GEN_SUCCESS' });
        return { videoUrl, requestId: result.requestId, cost, elapsed, model: modelId };

    } catch (err) {
        const elapsed = Date.now() - startTime;
        await logApiUsage({
            provider: 'fal_ai', modelo: modelId, tipo_operacao: 'text_to_video',
            custo_usd: 0, duracao_geracao_ms: elapsed, status: 'erro',
            erro_mensagem: err.message, prompt_usado: prompt.substring(0, 500),
            ...(context.projetoId && { projeto_id: context.projetoId }),
            ...(context.briefingId && { briefing_id: context.briefingId }),
        }).catch(() => { });
        logger.error(`Text-to-video failed: ${err.message}`, { phase: 'VIDEO_GEN_ERROR' });
        throw err;
    }
}

export async function gerarVideoImagem({ imageUrl, prompt, duration = 5, context = {} }) {
    const modelId = MODELS.kling_image;
    logger.info(`Generating image-to-video with Kling v2 (${duration}s)`, { phase: 'VIDEO_GEN' });
    const startTime = Date.now();

    try {
        const result = await fal.subscribe(modelId, {
            input: { image_url: imageUrl, prompt, duration: String(duration) },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS' && update.logs) {
                    update.logs.forEach(log => logger.info(`  FAL: ${log.message}`, { phase: 'VIDEO_QUEUE' }));
                }
            }
        });

        const videoUrl = result.data?.video?.url;
        if (!videoUrl) throw new Error('No video URL returned');

        const elapsed = Date.now() - startTime;
        const cost = estimateCost(modelId, duration);

        await logApiUsage({
            projeto_id: context.projetoId || null, briefing_id: context.briefingId || null,
            cena_id: context.cenaId || null, asset_id: context.assetId || null,
            provider: 'fal_ai', modelo: modelId, tipo_operacao: 'image_to_video',
            custo_usd: cost, duracao_geracao_ms: elapsed, duracao_asset_segundos: duration,
            prompt_usado: prompt.substring(0, 500), resolucao: '720p',
            status: 'sucesso', resposta_metadata: { requestId: result.requestId, videoUrl }
        }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

        return { videoUrl, requestId: result.requestId, cost, elapsed, model: modelId };
    } catch (err) {
        logger.error(`Image-to-video failed: ${err.message}`, { phase: 'VIDEO_GEN_ERROR' });
        throw err;
    }
}

async function downloadVideo(url, outputPath) {
    await fs.ensureDir(path.dirname(outputPath));
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.writeFile(outputPath, Buffer.from(response.data));
    logger.info(`Video downloaded to: ${outputPath}`, { phase: 'VIDEO_DOWNLOAD' });
    return outputPath;
}

export async function gerarVideosPorBriefing(briefingId, options = {}) {
    const { model = 'kling_text', duration = 5 } = options;
    logger.info(`Starting Video Generation Pipeline for briefing ${briefingId}`, { phase: 'VIDEO_PIPELINE' });
    const startTime = Date.now();

    try {
        const briefing = await buscarBriefing(briefingId);
        await logFase({
            projeto_id: briefing.projeto_id, briefing_id: briefingId,
            fase: 'animacao', status: 'iniciado'
        });

        const cenas = await listarCenas(briefingId);
        const resultados = [];
        const videoDir = path.join(process.cwd(), 'data', 'video', briefingId);

        for (const cena of cenas) {
            logger.info(`Processing scene [${cena.tipo.toUpperCase()}] ordem ${cena.ordem}`, { phase: 'VIDEO_SCENE' });

            let animationPrompt = '';
            try {
                const storyData = JSON.parse(cena.descricao_visual);
                animationPrompt = storyData.prompt_animacao_base || storyData.prompt_imagem_base || '';
            } catch (e) {
                animationPrompt = cena.descricao_visual || `Person talking naturally to camera, ${cena.sentimento} expression, handheld camera, UGC style`;
            }

            if (!animationPrompt) continue;

            const modelId = MODELS[model] || MODELS.kling_text;
            const videoRecord = await salvarVideo({
                cena_id: cena.id, tipo: 'animacao_v1', provider: 'fal_kling',
                prompt_usado: animationPrompt, duracao_segundos: duration,
                resolucao: '720p', status: 'gerando', modelo_usado: modelId
            });

            try {
                const { videoUrl, cost, elapsed } = await gerarVideoTexto({
                    prompt: animationPrompt, duration, aspectRatio: '9:16',
                    context: { projetoId: briefing.projeto_id, briefingId, cenaId: cena.id, assetId: videoRecord.id }
                });

                const fileName = `${cena.tipo}_${cena.ordem}_v1.mp4`;
                const outputPath = path.join(videoDir, fileName);
                await downloadVideo(videoUrl, outputPath);

                await atualizarStatusVideo(videoRecord.id, 'pronto', outputPath);

                resultados.push({
                    cena: cena.id, tipo: cena.tipo, videoId: videoRecord.id,
                    path: outputPath, url: videoUrl, cost, elapsed,
                    model: modelId, tag: `[${cena.tipo.toUpperCase()} ${cena.ordem}] modelo: ${modelId.split('/').pop()}`
                });

            } catch (genErr) {
                logger.error(`Video gen failed for scene ${cena.id}: ${genErr.message}`, { phase: 'VIDEO_SCENE_ERROR' });
                await atualizarStatusVideo(videoRecord.id, 'erro', null);
            }
        }

        await logFase({
            projeto_id: briefing.projeto_id, briefing_id: briefingId,
            fase: 'animacao', status: 'concluido', duracao_ms: Date.now() - startTime,
            detalhes: { total_videos: resultados.length, custo_total: resultados.reduce((sum, r) => sum + (r.cost || 0), 0) }
        });

        logger.info(`Video pipeline complete. ${resultados.length} videos. Total cost: $${resultados.reduce((s, r) => s + (r.cost || 0), 0).toFixed(3)}`, { phase: 'VIDEO_COMPLETE' });
        return resultados;

    } catch (error) {
        logger.error(`Video pipeline failed: ${error.message}`, { phase: 'VIDEO_PIPELINE_ERROR' });
        throw error;
    }
}
