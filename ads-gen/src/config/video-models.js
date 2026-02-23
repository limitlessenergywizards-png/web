/**
 * Video Models Catalog — All available models with pricing, quality, and routing info.
 * 
 * Each model has: id, name, provider, fal/atlas/wave endpoint,
 * cost per second, quality rating, tier, and capabilities.
 */

// ==========================================
// MODEL DEFINITIONS
// ==========================================
export const VIDEO_MODELS = {

    // ────────── TIER: TESTE (iteração rápida, $0.05–0.07/s) ──────────

    'wan-26': {
        id: 'wan-26',
        name: 'Wan 2.6',
        provider: 'fal',
        endpoint: 'fal-ai/wan/v2.6/image-to-video',
        endpointT2V: 'fal-ai/wan/v2.6/text-to-video',
        costPer5s: 0.25,
        costPer10s: 0.50,
        costPerSecond: 0.05,
        quality: 4,
        speed: 4,
        tier: 'teste',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '720p',
        recommended: false,
        description: 'Melhor custo-benefício absoluto. Excelente para preservação de detalhes finos.',
        bestFor: 'Validação de criativos em escala, testes de prompt'
    },

    'kling-25-turbo': {
        id: 'kling-25-turbo',
        name: 'Kling 2.5 Turbo Pro',
        provider: 'fal',
        endpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
        endpointT2V: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
        costPer5s: 0.35,
        costPer10s: 0.70,
        costPerSecond: 0.07,
        quality: 4,
        speed: 5,
        tier: 'teste',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: true,
        description: 'Mais rápido de renderizar, menor fila. Trade-off: motion levemente inferior.',
        bestFor: 'Iteração rápida de prompts e storyboard'
    },

    'kling-21-standard-kie': {
        id: 'kling-21-standard-kie',
        name: 'Kling 2.1 Standard',
        provider: 'kie',
        endpoint: 'kie/kling-video/v2.1/standard/image-to-video',
        costPer5s: 0.125,
        costPer10s: 0.25,
        costPerSecond: 0.025,
        quality: 3,
        speed: 4,
        tier: 'teste',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '720p',
        recommended: false,
        description: 'Mais barato de todos. Qualidade aceitável para primeiros testes.',
        bestFor: 'Teste em massa, validação de concept'
    },

    // ────────── TIER: VALIDAÇÃO (produção, $0.07/s) ──────────

    'kling-26-pro': {
        id: 'kling-26-pro',
        name: 'Kling 2.6 Pro (sem áudio)',
        provider: 'fal',
        endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
        endpointT2V: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        costPer5s: 0.35,
        costPer10s: 0.70,
        costPerSecond: 0.07,
        quality: 5,
        speed: 3,
        tier: 'validacao',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: true,
        description: 'Melhor identidade facial em planos médios. Handheld parece filmado com gimbal.',
        bestFor: 'Criativos aprovados, qualidade de produção'
    },

    'kling-26-pro-audio': {
        id: 'kling-26-pro-audio',
        name: 'Kling 2.6 Pro (com áudio)',
        provider: 'fal',
        endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
        endpointT2V: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        costPer5s: 0.70,
        costPer10s: 1.40,
        costPerSecond: 0.14,
        quality: 5,
        speed: 3,
        tier: 'validacao',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: true,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Mesma qualidade do Pro + áudio nativo. Usar quando quiser testar lip-sync.',
        bestFor: 'Testes de lip-sync nativo (geralmente ElevenLabs é melhor)'
    },

    'kling-21-pro-kie': {
        id: 'kling-21-pro-kie',
        name: 'Kling 2.1 Pro',
        provider: 'kie',
        endpoint: 'kie/kling-video/v2.1/pro/image-to-video',
        costPer5s: 0.25,
        costPer10s: 0.50,
        costPerSecond: 0.05,
        quality: 4,
        speed: 3,
        tier: 'validacao',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Boa qualidade no kie.ai por metade do preço do fal.ai.',
        bestFor: 'Alternativa econômica para validação'
    },

    'wan-21-plus-alibaba': {
        id: 'wan-21-plus-alibaba',
        name: 'Wan 2.1 I2V Plus',
        provider: 'alibaba',
        endpoint: 'wan2.1-i2v-plus',
        costPer5s: 0.20,
        costPer10s: 0.40,
        costPerSecond: 0.04,
        quality: 4,
        speed: 3,
        tier: 'validacao',
        supportedOps: ['I2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '720p',
        recommended: false,
        description: 'Wan nativo na Alibaba. Muito econômico para volume.',
        bestFor: 'Geração em volume com custo reduzido'
    },

    // ────────── TIER: ESCALA (criativos winners, $0.10–0.20/s) ──────────

    'veo-31-fast': {
        id: 'veo-31-fast',
        name: 'Veo 3.1 Fast (sem áudio)',
        provider: 'fal',
        endpoint: 'fal-ai/veo3.1/fast/image-to-video',
        endpointT2V: 'fal-ai/veo3.1/fast/text-to-video',
        costPer5s: 0.50,
        costPer10s: 1.00,
        costPerSecond: 0.10,
        quality: 5,
        speed: 4,
        tier: 'escala',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: true,
        description: 'Melhor lip-sync do mercado. Sound design completo quando com áudio.',
        bestFor: 'Criativos vencedores para escalar em mídia paga'
    },

    'veo-31-fast-audio': {
        id: 'veo-31-fast-audio',
        name: 'Veo 3.1 Fast (com áudio)',
        provider: 'fal',
        endpoint: 'fal-ai/veo3.1/fast/image-to-video',
        endpointT2V: 'fal-ai/veo3.1/fast/text-to-video',
        costPer5s: 0.75,
        costPer10s: 1.50,
        costPerSecond: 0.15,
        quality: 5,
        speed: 4,
        tier: 'escala',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: true,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Máxima qualidade com áudio ambiente natural e lip-sync avançado.',
        bestFor: 'Criativos premium com lip-sync nativo'
    },

    'kling-30-standard': {
        id: 'kling-30-standard',
        name: 'Kling 3.0 Standard',
        provider: 'fal',
        endpoint: 'fal-ai/kling-video/v3.0/standard/image-to-video',
        endpointT2V: 'fal-ai/kling-video/v3.0/standard/text-to-video',
        costPer5s: 0.50,
        costPer10s: 1.00,
        costPerSecond: 0.10,
        quality: 5,
        speed: 3,
        tier: 'escala',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Última geração do Kling. Melhor consistência de identidade facial.',
        bestFor: 'Máxima fidelidade no avatar'
    },

    'sora-2-wavespeed': {
        id: 'sora-2-wavespeed',
        name: 'Sora 2',
        provider: 'wavespeed',
        endpoint: 'wavespeed/sora-2/text-to-video',
        costPer5s: 0.50,
        costPer10s: 1.00,
        costPerSecond: 0.10,
        quality: 5,
        speed: 4,
        tier: 'escala',
        supportedOps: ['T2V'],
        hasNativeAudio: true,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Sora 2 da OpenAI via WaveSpeed. Sem cold starts, áudio sincronizado.',
        bestFor: 'Text-to-video de alta qualidade'
    },

    'veo-31-atlas': {
        id: 'veo-31-atlas',
        name: 'Veo 3.1 Fast I2V',
        provider: 'atlascloud',
        endpoint: 'atlascloud/veo-3.1-fast/image-to-video',
        costPer5s: 0.75,
        costPer10s: 1.50,
        costPerSecond: 0.15,
        quality: 5,
        speed: 4,
        tier: 'escala',
        supportedOps: ['I2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: 'Veo 3.1 via AtlasCloud. API unificada para múltiplos modelos.',
        bestFor: 'Quando fal.ai estiver indisponível'
    },

    // ────────── LEGACY (preços altos mas confiável) ──────────

    'kling-20-master': {
        id: 'kling-20-master',
        name: 'Kling 2.0 Master (Legacy)',
        provider: 'fal',
        endpoint: 'fal-ai/kling-video/v2/master/image-to-video',
        endpointT2V: 'fal-ai/kling-video/v2/master/text-to-video',
        costPer5s: 1.40,
        costPer10s: 2.80,
        costPerSecond: 0.28,
        quality: 5,
        speed: 2,
        tier: 'legacy',
        supportedOps: ['I2V', 'T2V'],
        hasNativeAudio: false,
        maxDuration: 10,
        resolution: '1080p',
        recommended: false,
        description: '⚠️ Modelo anterior. 4x mais caro que o 2.6 Pro com qualidade equivalente.',
        bestFor: 'NÃO USAR — mantido apenas para compatibilidade'
    },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/** Get all models as array */
export function getAllModels() {
    return Object.values(VIDEO_MODELS);
}

/** Get models by tier */
export function getModelsByTier(tier) {
    return getAllModels().filter(m => m.tier === tier);
}

/** Get models by provider */
export function getModelsByProvider(provider) {
    return getAllModels().filter(m => m.provider === provider);
}

/** Get recommended models */
export function getRecommendedModels() {
    return getAllModels().filter(m => m.recommended);
}

/** Get model by ID */
export function getModelById(id) {
    return VIDEO_MODELS[id] || null;
}

/** Get available models (provider has API key configured) */
export function getAvailableModels() {
    return getAllModels().filter(m => isProviderAvailable(m.provider));
}

/** Check if a provider has API key */
export function isProviderAvailable(provider) {
    switch (provider) {
        case 'fal': return !!(process.env.FAL_API_KEY?.length > 10);
        case 'alibaba': return !!(process.env.ALIBABA_API_KEY?.length > 10);
        case 'atlascloud': return !!(process.env.ATLASCLOUD_API_KEY?.length > 10);
        case 'wavespeed': return !!(process.env.WAVESPEED_API_KEY?.length > 10);
        case 'kie': return !!(process.env.FAL_API_KEY?.length > 10); // kie uses fal
        default: return false;
    }
}

/** Estimate cost for a full creative (body ~35s) */
export function estimateCreativeCost(modelId, bodySecs = 35, hookSecs = 5, hookCount = 3) {
    const model = getModelById(modelId);
    if (!model) return null;
    const bodyCost = bodySecs * model.costPerSecond;
    const hookCost = hookSecs * model.costPerSecond * hookCount;
    return {
        modelId, modelName: model.name,
        bodyCost: +bodyCost.toFixed(3),
        hookCost: +hookCost.toFixed(3),
        totalCost: +(bodyCost + hookCost).toFixed(3),
        perWeek120: +((bodyCost + hookCost) * 120).toFixed(2)
    };
}

/** Get tier-based defaults */
export const TIER_DEFAULTS = {
    teste: 'kling-25-turbo',
    validacao: 'kling-26-pro',
    escala: 'veo-31-fast'
};

export default VIDEO_MODELS;
