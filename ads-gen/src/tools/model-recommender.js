import { logger } from '../utils/logger.js';
import { getModelById, getAvailableModels, estimateCreativeCost, TIER_DEFAULTS } from '../config/video-models.js';

/**
 * Smart Model Recommender — suggests the best video model based on context.
 * 
 * Factors:
 * 1. Pipeline phase (teste / validacao / escala)
 * 2. Scene type (hook = short+fast, body = long+quality)
 * 3. Budget available
 * 4. Prompt characteristics (lip-sync, motion, etc.)
 */

/**
 * Recommend the best model for a given context
 * @param {Object} opts
 * @param {string} opts.fase - 'teste' | 'validacao' | 'escala'
 * @param {string} opts.sceneTipo - 'hook' | 'body'
 * @param {number} opts.duracao - desired duration in seconds
 * @param {string} opts.prompt - the animation prompt
 * @param {number} [opts.budgetUsd] - remaining budget in USD
 * @returns {{ recommended, alternatives, costEstimate, reasoning }}
 */
export function recommendModel(opts = {}) {
    const { fase = 'teste', sceneTipo = 'hook', duracao = 5, prompt = '', budgetUsd = null } = opts;

    const available = getAvailableModels();
    if (available.length === 0) {
        logger.warn('No video providers configured', { phase: 'RECOMMENDER' });
        return { recommended: null, alternatives: [], costEstimate: null, reasoning: 'No API keys configured' };
    }

    // 1. Start with tier default
    let recommendedId = TIER_DEFAULTS[fase] || TIER_DEFAULTS.teste;

    // 2. Check prompt for special needs
    const promptLower = prompt.toLowerCase();
    const needsLipSync = promptLower.includes('lip-sync') || promptLower.includes('lipsync') || promptLower.includes('talking') || promptLower.includes('speaking');
    const needsHighMotion = promptLower.includes('running') || promptLower.includes('walking') || promptLower.includes('dancing') || promptLower.includes('caminhando');
    const needsCinematic = promptLower.includes('cinematic') || promptLower.includes('dramatic') || promptLower.includes('filmado');

    let reasoning = `Fase: ${fase}`;

    // 3. Adjust based on scene type
    if (sceneTipo === 'hook' && fase !== 'escala') {
        // Hooks are short — use fast, cheap model
        recommendedId = 'kling-25-turbo';
        reasoning += ' | Hook curto → Kling 2.5 Turbo (rápido)';
    }

    if (sceneTipo === 'body' && fase === 'validacao') {
        recommendedId = 'kling-26-pro';
        reasoning += ' | Body de produção → Kling 2.6 Pro';
    }

    // 4. Adjust for special prompt needs
    if (needsLipSync && fase === 'escala') {
        recommendedId = 'veo-31-fast';
        reasoning += ' | Lip-sync detectado → Veo 3.1 Fast';
    }

    if (needsCinematic) {
        if (fase === 'escala') {
            recommendedId = 'kling-30-standard';
            reasoning += ' | Cinematic → Kling 3.0';
        } else {
            recommendedId = 'kling-26-pro';
            reasoning += ' | Cinematic → Kling 2.6 Pro';
        }
    }

    // 5. Budget check — downgrade if too expensive
    if (budgetUsd !== null && budgetUsd > 0) {
        const model = getModelById(recommendedId);
        const estimatedCost = model ? duracao * model.costPerSecond : 0;
        if (estimatedCost > budgetUsd * 0.5) {
            // Use cheapest available model
            recommendedId = 'wan-26';
            reasoning += ` | Budget baixo ($${budgetUsd}) → Wan 2.6 (mais barato)`;
        }
    }

    // 6. Ensure recommended model is available, fallback if not
    const recommended = getModelById(recommendedId);
    if (recommended && !available.find(m => m.id === recommendedId)) {
        // Fallback to first available in same tier or any available
        const sameTier = available.filter(m => m.tier === recommended.tier);
        const fallback = sameTier[0] || available[0];
        recommendedId = fallback.id;
        reasoning += ` | ${recommended.name} indisponível → ${fallback.name}`;
    }

    // 7. Build alternatives (same tier + one from each other tier)
    const alternatives = available
        .filter(m => m.id !== recommendedId)
        .sort((a, b) => a.costPerSecond - b.costPerSecond)
        .slice(0, 4);

    // 8. Cost estimate
    const costEstimate = estimateCreativeCost(recommendedId);

    const result = {
        recommended: getModelById(recommendedId),
        alternatives: alternatives.map(m => ({
            ...m,
            costEstimate: estimateCreativeCost(m.id)
        })),
        costEstimate,
        reasoning
    };

    logger.info(`[Recommender] ${result.recommended?.name} — ${reasoning}`, { phase: 'RECOMMENDER_OK' });
    return result;
}

/**
 * Get full comparison table for all available models
 */
export function getModelComparison(bodySecs = 35, hookSecs = 5) {
    return getAvailableModels().map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        tier: m.tier,
        quality: '⭐'.repeat(m.quality),
        costPerSecond: `$${m.costPerSecond.toFixed(3)}`,
        costPerHook: `$${(hookSecs * m.costPerSecond).toFixed(3)}`,
        costPerBody: `$${(bodySecs * m.costPerSecond).toFixed(2)}`,
        costPerCreative: `$${((bodySecs + hookSecs * 3) * m.costPerSecond).toFixed(2)}`,
        costPer120: `$${(((bodySecs + hookSecs * 3) * m.costPerSecond) * 120).toFixed(0)}`,
        recommended: m.recommended ? '✅' : '',
        hasAudio: m.hasNativeAudio ? '🔊' : '🔇'
    }));
}

export default recommendModel;
