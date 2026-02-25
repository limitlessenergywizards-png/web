import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { API_CONTRACTS } from '../../../config/api-contracts.js';
import { logger } from '../../../utils/logger.js';

import { logApiUsage } from '../../../infrastructure/database/dal.js';
import { withRetry } from '../../../utils/retry.js';
import { getModelById, getAvailableModels, TIER_DEFAULTS } from '../../../config/video-models.js';
import recommendModel from './model-recommender.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// ==========================================
// PROVIDER ADAPTERS — route model to correct API
// ==========================================

/**
 * FAL AI adapter (Kling, Wan, Veo, etc.)
 */
async function executeOnFal(model, imagePath, prompt, duracao, withAudio, context) {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: process.env.FAL_API_KEY });

    const startTime = Date.now();
    const isI2V = imagePath && model.supportedOps.includes('I2V');
    const endpoint = isI2V ? model.endpoint : (model.endpointT2V || model.endpoint);

    logger.info(`[FAL] ${model.name} — ${isI2V ? 'I2V' : 'T2V'} (${duracao}s)`, { phase: 'FAL_EXEC' });

    const input = {
        prompt: prompt.substring(0, 1700),
        duration: String(Math.min(duracao, model.maxDuration || 10)),
        aspect_ratio: '9:16',
    };

    // Add audio parameter for models that support it
    if (model.hasNativeAudio && withAudio) {
        input.with_audio = true;
    }

    if (isI2V) {
        const imageBuffer = await fs.readFile(imagePath);
        const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const imageUrl = await fal.storage.upload(new Blob([imageBuffer], { type: mimeType }));
        input.image_url = imageUrl;
    }

    const result = await fal.subscribe(endpoint, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS' && update.logs) {
                update.logs.forEach(log => logger.info(`  ${model.name}: ${log.message}`, { phase: 'FAL_QUEUE' }));
            }
        }
    });

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) throw new Error(`No video URL from ${model.name}`);

    // Download
    const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'fal');
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, `${model.id}_${Date.now()}.mp4`);
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    const elapsed = Date.now() - startTime;
    const cost = duracao * model.costPerSecond;

    await logApiUsage({
        provider: 'fal_ai', modelo: model.id, tipo_operacao: isI2V ? 'image_to_video' : 'text_to_video',
        custo_usd: cost, duracao_geracao_ms: elapsed, prompt_usado: prompt.substring(0, 500),
        status: 'sucesso'
    }).catch(() => { });

    logger.info(`[FAL] ${model.name} ready: ${(elapsed / 1000).toFixed(1)}s | $${cost.toFixed(3)}`, { phase: 'FAL_DONE' });
    return { path: outputPath, duracao, provider: `fal_${model.id}`, elapsed, cost, modelUsed: model.id };
}

/**
 * Alibaba DashScope adapter (Wan 2.1 native)
 */
async function executeOnAlibaba(model, imagePath, prompt, duracao, withAudio, context) {
    const apiKey = process.env.ALIBABA_API_KEY;
    if (!apiKey || apiKey.length < 10) throw new Error('ALIBABA_API_KEY not configured');

    const startTime = Date.now();
    logger.info(`[Alibaba] ${model.name} — I2V (${duracao}s)`, { phase: 'ALIBABA_EXEC' });

    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    const submitResp = await axios.post(
        'https://dashscope-us.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        {
            model: model.endpoint,
            input: {
                image_url: `data:image/png;base64,${imageBase64}`,
                prompt: prompt.substring(0, 1700)
            },
            parameters: { resolution: '720P', duration: duracao <= 5 ? 5 : 10 }
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable'
            }
        }
    );

    const taskId = submitResp.data.output?.task_id;
    if (!taskId) throw new Error(`No task_id from Alibaba: ${JSON.stringify(submitResp.data)}`);

    // Poll
    const timeout = Date.now() + 8 * 60 * 1000;
    let videoUrl = null;
    while (Date.now() < timeout) {
        await new Promise(r => setTimeout(r, 15_000));
        let pollResp;
        try {
            const endpoint = API_CONTRACTS.alibaba.taskStatus(taskId);
            pollResp = await axios.get(
                endpoint,
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
        } catch (pollErr) {
            if (pollErr.response?.status === 404) {
                throw new Error(`[ASAVIA ROUTE SENTINEL] P0: Alibaba Task '${taskId}' retornou 404. Parando polling infinito de endpoint inválido.`);
            }
            throw pollErr;
        }

        const status = pollResp.data.output?.task_status;
        logger.info(`[Alibaba] Task ${taskId}: ${status}`, { phase: 'ALIBABA_POLL' });
        if (status === 'SUCCEEDED') {
            videoUrl = pollResp.data.output?.video_url || pollResp.data.output?.results?.[0]?.url;
            break;
        }
        if (status === 'FAILED') throw new Error(`Alibaba task failed: ${pollResp.data.output?.message}`);
    }
    if (!videoUrl) throw new Error('Alibaba timed out');

    const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'alibaba');
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, `wan_${Date.now()}.mp4`);
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    const elapsed = Date.now() - startTime;
    const cost = duracao * model.costPerSecond;

    await logApiUsage({
        provider: 'alibaba', modelo: model.id, tipo_operacao: 'image_to_video',
        custo_usd: cost, duracao_geracao_ms: elapsed, prompt_usado: prompt.substring(0, 500),
        status: 'sucesso'
    }).catch(() => { });

    logger.info(`[Alibaba] ${model.name} ready: ${(elapsed / 1000).toFixed(1)}s | $${cost.toFixed(3)}`, { phase: 'ALIBABA_DONE' });
    return { path: outputPath, duracao, provider: 'alibaba_wan', elapsed, cost, modelUsed: model.id };
}

/**
 * AtlasCloud adapter (unified API)
 */
async function executeOnAtlasCloud(model, imagePath, prompt, duracao, withAudio, context) {
    const apiKey = process.env.ATLASCLOUD_API_KEY;
    if (!apiKey || apiKey.length < 10) throw new Error('ATLASCLOUD_API_KEY not configured');

    const startTime = Date.now();
    logger.info(`[AtlasCloud] ${model.name} — I2V (${duracao}s)`, { phase: 'ATLAS_EXEC' });

    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // AtlasCloud uses OpenAI-compatible API
    const submitResp = await axios.post(
        'https://api.atlascloud.ai/v1/video/generations',
        {
            model: model.endpoint.replace('atlascloud/', ''),
            prompt: prompt.substring(0, 1700),
            image: `data:image/png;base64,${imageBase64}`,
            duration: duracao,
            aspect_ratio: '9:16',
            resolution: model.resolution
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const videoUrl = submitResp.data?.data?.[0]?.url;
    if (!videoUrl) throw new Error(`No video from AtlasCloud: ${JSON.stringify(submitResp.data)}`);

    const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'atlas');
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, `atlas_${Date.now()}.mp4`);
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    const elapsed = Date.now() - startTime;
    const cost = duracao * model.costPerSecond;

    await logApiUsage({
        provider: 'atlascloud', modelo: model.id, tipo_operacao: 'image_to_video',
        custo_usd: cost, duracao_geracao_ms: elapsed, prompt_usado: prompt.substring(0, 500),
        status: 'sucesso'
    }).catch(() => { });

    return { path: outputPath, duracao, provider: 'atlascloud', elapsed, cost, modelUsed: model.id };
}

/**
 * WaveSpeed adapter (Sora 2, Wan, Seedance)
 */
async function executeOnWaveSpeed(model, imagePath, prompt, duracao, withAudio, context) {
    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey || apiKey.length < 10) throw new Error('WAVESPEED_API_KEY not configured');

    const startTime = Date.now();
    logger.info(`[WaveSpeed] ${model.name} — T2V (${duracao}s)`, { phase: 'WAVE_EXEC' });

    const submitResp = await axios.post(
        'https://api.wavespeed.ai/v1/video/generations',
        {
            model: model.endpoint.replace('wavespeed/', ''),
            prompt: prompt.substring(0, 1700),
            duration: duracao,
            aspect_ratio: '9:16'
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const videoUrl = submitResp.data?.data?.[0]?.url || submitResp.data?.video_url;
    if (!videoUrl) throw new Error(`No video from WaveSpeed: ${JSON.stringify(submitResp.data)}`);

    const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'wave');
    await fs.ensureDir(outputDir);
    const outputPath = path.join(outputDir, `wave_${Date.now()}.mp4`);
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    const elapsed = Date.now() - startTime;
    const cost = duracao * model.costPerSecond;

    await logApiUsage({
        provider: 'wavespeed', modelo: model.id, tipo_operacao: 'text_to_video',
        custo_usd: cost, duracao_geracao_ms: elapsed, prompt_usado: prompt.substring(0, 500),
        status: 'sucesso'
    }).catch(() => { });

    return { path: outputPath, duracao, provider: 'wavespeed', elapsed, cost, modelUsed: model.id };
}

// ==========================================
// ROUTER — send model to correct provider adapter
// ==========================================
const PROVIDER_ADAPTERS = {
    fal: executeOnFal,
    kie: executeOnFal, // kie models run on fal
    alibaba: executeOnAlibaba,
    atlascloud: executeOnAtlasCloud,
    wavespeed: executeOnWaveSpeed
};

// ==========================================
// MAIN API — animateImage with model selection
// ==========================================

/**
 * Animate an image using a specific model (or auto-recommend)
 * @param {string} imagePath - Path to avatar/image
 * @param {string} prompt - Animation prompt (max 1700 chars)
 * @param {Object} opts
 * @param {string} [opts.modelId] - Specific model ID, or null for auto-recommend
 * @param {number} [opts.duracao=5] - Duration in seconds
 * @param {boolean} [opts.withAudio=false] - Request native audio
 * @param {string} [opts.fase='teste'] - Pipeline phase for recommendation
 * @param {string} [opts.sceneTipo='hook'] - Scene type for recommendation
 * @param {Object} [opts.context={}] - { briefingId, cenaId, projetoId }
 * @returns {{ path, duracao, provider, elapsed, cost, modelUsed }}
 */
export async function animateImage(imagePath, prompt, opts = {}) {
    const {
        modelId = null,
        duracao = 5,
        withAudio = false,
        fase = 'teste',
        sceneTipo = 'hook',
        context = {}
    } = opts;

    // 1. Determine which model to use
    let model;
    if (modelId) {
        model = getModelById(modelId);
        if (!model) throw new Error(`Unknown model: ${modelId}`);
    } else {
        const rec = recommendModel({ fase, sceneTipo, duracao, prompt });
        model = rec.recommended;
        if (!model) throw new Error('No model available. Check API keys.');
        logger.info(`[Animator] Auto-recommended: ${model.name} — ${rec.reasoning}`, { phase: 'ANIMATOR_REC' });
    }

    // 2. Build fallback chain: selected model → same tier → cheaper tier
    const available = getAvailableModels();
    const fallbackChain = [
        model,
        ...available.filter(m => m.id !== model.id && m.tier === model.tier),
        ...available.filter(m => m.tier === 'teste' && m.id !== model.id),
        ...available.filter(m => m.id !== model.id)
    ];

    // Deduplicate
    const seen = new Set();
    const uniqueChain = fallbackChain.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });

    // 3. Execute with fallback
    for (const m of uniqueChain) {
        const adapter = PROVIDER_ADAPTERS[m.provider];
        if (!adapter) continue;

        try {
            logger.info(`[Animator] Trying ${m.name} (${m.provider})...`, { phase: 'ANIMATOR_TRY' });
            const result = await withRetry(() => adapter(m, imagePath, prompt, duracao, withAudio, context), 3, 2000, `Video AI: ${m.name}`);
            logger.info(`[Animator] ✅ ${m.name} — $${(result.cost || 0).toFixed(3)}`, { phase: 'ANIMATOR_OK' });
            return result;
        } catch (err) {
            logger.warn(`[Animator] ${m.name} failed: ${err.message}. Trying next...`, { phase: 'ANIMATOR_FAIL' });
        }
    }

    throw new Error('All animation providers failed. Check API keys and quotas.');
}

/**
 * Text-to-video — no image input required
 */
export async function animateText(prompt, opts = {}) {
    const { modelId = null, duracao = 5, fase = 'teste', context = {} } = opts;

    let model;
    if (modelId) {
        model = getModelById(modelId);
    } else {
        const rec = recommendModel({ fase, sceneTipo: 'hook', duracao, prompt });
        model = rec.recommended;
    }

    if (!model) throw new Error('No model available for T2V');
    if (!model.supportedOps.includes('T2V')) {
        // Fall back to a T2V-capable model
        model = getAvailableModels().find(m => m.supportedOps.includes('T2V')) || model;
    }

    const adapter = PROVIDER_ADAPTERS[model.provider];
    if (!adapter) throw new Error(`No adapter for ${model.provider}`);

    return await withRetry(() => adapter(model, null, prompt, duracao, false, context), 3, 2000, `Video AI T2V: ${model.name}`);
}
