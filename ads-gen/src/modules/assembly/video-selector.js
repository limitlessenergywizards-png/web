import { logger } from '../../utils/logger.js';
import { atualizarStatusVideo } from '../../infrastructure/database/dal.js';

/**
 * Video Selector — picks the best variation for a scene
 * 
 * Modes:
 *   - 'auto': always picks v2 (insight: "the second is usually better")
 *   - 'manual': logs paths for user review (integrates with UI later)
 */
export async function selectVideo(variations, mode = 'auto') {
    if (!variations || variations.length === 0) {
        logger.warn('No variations to select from', { phase: 'SELECTOR_EMPTY' });
        return null;
    }

    if (variations.length === 1) {
        logger.info(`Only 1 variation. Auto-selecting.`, { phase: 'SELECTOR_SINGLE' });
        const selected = variations[0];
        if (selected.videoId) {
            await atualizarStatusVideo(selected.videoId, 'selecionado', selected.path).catch(() => { });
        }
        return selected;
    }

    if (mode === 'auto') {
        // Auto mode: pick v2 (index 1)
        const selected = variations[1]; // v2
        const rejected = variations[0]; // v1

        logger.info(`[Selector AUTO] Selected v2: ${selected.path}`, { phase: 'SELECTOR_AUTO' });

        // Mark v2 as selected, v1 as descartado
        if (selected.videoId) {
            await atualizarStatusVideo(selected.videoId, 'selecionado', selected.path).catch(() => { });
        }
        if (rejected.videoId) {
            await atualizarStatusVideo(rejected.videoId, 'descartado', rejected.path).catch(() => { });
        }

        return selected;
    }

    if (mode === 'manual') {
        // Manual mode: log options for review
        logger.info(`[Selector MANUAL] Awaiting user selection:`, { phase: 'SELECTOR_MANUAL' });
        variations.forEach((v, i) => {
            console.log(`  [v${i + 1}] ${v.path} (provider: ${v.provider})`);
        });
        console.log(`  → Default (v2) will be selected unless user overrides.`);

        // Default to v2 for now (UI integration will replace this)
        const selected = variations[1] || variations[0];
        if (selected.videoId) {
            await atualizarStatusVideo(selected.videoId, 'selecionado', selected.path).catch(() => { });
        }
        return selected;
    }

    return variations[0];
}

/**
 * Batch select: applies auto selection to all scenes
 */
export async function batchSelectVideos(allVariations) {
    const results = [];
    for (const [cenaId, vars] of Object.entries(allVariations)) {
        const selected = await selectVideo(vars, 'auto');
        if (selected) {
            results.push({ cenaId, ...selected });
        }
    }
    logger.info(`[Selector] Batch selected ${results.length} videos`, { phase: 'SELECTOR_BATCH' });
    return results;
}
