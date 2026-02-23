import { logger } from '../utils/logger.js';
import { listarAvatares, incrementarUsoAvatar } from '../db/dal.js';

/**
 * Calculate simple text similarity (Jaccard-like on word sets)
 */
function calcularSimilaridade(texto1, texto2) {
    const normalize = (t) => t.toLowerCase()
        .replace(/[^a-záéíóúñ\s]/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 3); // ignore short words

    const words1 = new Set(normalize(texto1));
    const words2 = new Set(normalize(texto2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    for (const w of words1) {
        if (words2.has(w)) intersection++;
    }

    const union = new Set([...words1, ...words2]).size;
    return (intersection / union) * 100;
}

/**
 * Search for an existing reusable avatar that matches the scene description
 * @param {string} descricaoCena - Description of the current scene or character
 * @param {number} [threshold=70] - Minimum similarity percentage to consider a match
 * @returns {Object|null} Existing avatar or null
 */
export async function buscarAvatarCompativel(descricaoCena, threshold = 70) {
    logger.info(`Searching for reusable avatar (threshold: ${threshold}%)`, { phase: 'AVATAR_MATCH' });

    try {
        const avatares = await listarAvatares(true); // reutilizavel = true

        if (!avatares || avatares.length === 0) {
            logger.info(`No reusable avatars found in library.`, { phase: 'AVATAR_MATCH_EMPTY' });
            return null;
        }

        let bestMatch = null;
        let bestScore = 0;

        for (const avatar of avatares) {
            const score = calcularSimilaridade(descricaoCena, avatar.descricao || '');
            if (score > bestScore) {
                bestScore = score;
                bestMatch = avatar;
            }
        }

        if (bestScore >= threshold) {
            logger.info(`Avatar match found! "${bestMatch.nome}" (score: ${bestScore.toFixed(1)}%)`, { phase: 'AVATAR_MATCH_HIT' });
            await incrementarUsoAvatar(bestMatch.id);
            return bestMatch;
        }

        logger.info(`No avatar match above ${threshold}%. Best was ${bestScore.toFixed(1)}%`, { phase: 'AVATAR_MATCH_MISS' });
        return null;

    } catch (err) {
        logger.warn(`Avatar matching failed: ${err.message}`, { phase: 'AVATAR_MATCH_ERR' });
        return null;
    }
}
