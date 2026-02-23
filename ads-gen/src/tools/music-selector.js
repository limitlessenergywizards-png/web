import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

const MUSIC_DIR = path.join(process.cwd(), 'data', 'music');

/**
 * List all MP3 files in the music directory, optionally filtered by category.
 * @param {string} [category] - Subfolder name (e.g., 'energetica', 'calma', 'urgente', 'neutra')
 * @returns {Array<{ name, path, category }>}
 */
export async function listMusic(category = null) {
    const baseDir = category ? path.join(MUSIC_DIR, category) : MUSIC_DIR;

    if (!(await fs.pathExists(baseDir))) {
        logger.warn(`[Music] Directory not found: ${baseDir}`, { phase: 'MUSIC_WARN' });
        return [];
    }

    const results = [];

    const scanDir = async (dir, cat) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && !category) {
                await scanDir(fullPath, item.name);
            } else if (item.isFile() && item.name.endsWith('.mp3')) {
                results.push({
                    name: item.name,
                    path: fullPath,
                    category: cat || 'root'
                });
            }
        }
    };

    await scanDir(baseDir, category);
    return results;
}

/**
 * Select a music track. Random selection with optional category filter.
 * @param {string} [category] - e.g., 'energetica', 'calma', 'urgente', 'neutra'
 * @returns {{ name, path, category } | null}
 */
export async function selectMusic(category = null) {
    const tracks = await listMusic(category);

    if (!tracks.length) {
        logger.warn(`[Music] No tracks found${category ? ` in category '${category}'` : ''}`, { phase: 'MUSIC_WARN' });
        return null;
    }

    const selected = tracks[Math.floor(Math.random() * tracks.length)];
    logger.info(`[Music] Selected: ${selected.name} [${selected.category}]`, { phase: 'MUSIC_SELECT' });
    return selected;
}

/**
 * Get the best music category for a given scene sentiment.
 */
export function categoryForSentiment(sentimento) {
    const map = {
        urgencia: 'urgente',
        urgente: 'urgente',
        curiosidade: 'energetica',
        motivacao: 'energetica',
        energia: 'energetica',
        confianca: 'neutra',
        calma: 'calma',
        reflexao: 'calma',
        emocional: 'calma',
        default: 'neutra'
    };
    return map[sentimento?.toLowerCase()] || map.default;
}

export default { listMusic, selectMusic, categoryForSentiment };
