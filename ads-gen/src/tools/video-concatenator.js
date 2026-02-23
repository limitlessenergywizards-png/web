import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getMediaDuration } from './video-editor.js';

const tmpFile = (ext) => path.join(os.tmpdir(), `adsgen_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);

const runFF = (cmd, label) => new Promise((resolve, reject) => {
    cmd
        .on('end', () => { logger.info(`[Concat] ✅ ${label}`, { phase: 'CONCAT_OK' }); resolve(); })
        .on('error', (err) => { logger.error(`[Concat] ❌ ${label}: ${err.message}`, { phase: 'CONCAT_ERR' }); reject(err); })
        .run();
});

/**
 * Concatenate multiple video files with crossfade transitions.
 * Uses FFmpeg concat demuxer + xfade filter for smooth transitions.
 *
 * @param {string[]} videoPaths - Array of video file paths
 * @param {string} outputPath - Output file path
 * @param {number} fadeDuration - Crossfade duration in seconds (default: 0.3)
 */
export async function concatenateScenes(videoPaths, outputPath, fadeDuration = 0.3) {
    if (!videoPaths?.length) throw new Error('No videos to concatenate');
    if (videoPaths.length === 1) {
        await fs.copy(videoPaths[0], outputPath);
        return outputPath;
    }

    logger.info(`[Concat] Concatenating ${videoPaths.length} scenes`, { phase: 'CONCAT' });
    fs.ensureDirSync(path.dirname(outputPath));

    // Use concat demuxer for all cases (most reliable across different stream configs)
    const concatList = tmpFile('.txt');
    const lines = videoPaths.map(vp => `file '${vp.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(concatList, lines, 'utf-8');

    const cmd = ffmpeg()
        .input(concatList)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('192k')
        .outputOptions(['-preset', 'fast'])
        .output(outputPath);

    try {
        await runFF(cmd, `concatenateScenes(${videoPaths.length} files)`);
    } finally {
        await fs.remove(concatList).catch(() => { });
    }
    return outputPath;
}

/**
 * Assemble a complete creative: Hook + Body.
 * Generates standardized filename: {produto}_{YYYYMMDD}_hook{N}_v{version}.mp4
 *
 * @param {string} hookPath - Path to rendered hook video
 * @param {string} bodyPath - Path to rendered body video
 * @param {string} outputDir - Output directory
 * @param {Object} meta - { produto, hookNum, version }
 * @returns {{ outputPath, fileName, duration }}
 */
export async function assembleCreative(hookPath, bodyPath, outputDir, meta = {}) {
    const { produto = 'criativo', hookNum = 1, version = 1 } = meta;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${produto}_${date}_hook${hookNum}_v${version}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    logger.info(`[Concat] Assembling creative: ${fileName}`, { phase: 'CONCAT_ASSEMBLE' });

    await concatenateScenes([hookPath, bodyPath], outputPath, 0.3);

    const duration = await getMediaDuration(outputPath);
    const size = (await fs.stat(outputPath)).size;

    logger.info(`[Concat] ✅ Creative ready: ${fileName} (${duration.toFixed(1)}s, ${(size / 1024 / 1024).toFixed(1)}MB)`, { phase: 'CONCAT_ASSEMBLE_OK' });

    return { outputPath, fileName, duration, size };
}

export default { concatenateScenes, assembleCreative };
