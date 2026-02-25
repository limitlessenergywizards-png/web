import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { runRendiJob, downloadFromRendi } from '../../infrastructure/cloud-compute/rendi-client.js';
import { getMediaDuration } from './editor.js';

/**
 * Concatenate multiple video files with crossfade transitions.
 * Uses FFmpeg concat demuxer + xfade filter for smooth transitions.
 *
 * @param {string[]} videoPaths - Array of video file paths
 * @param {string} outputPath - Output file path
 * @param {number} fadeDuration - Crossfade duration in seconds (default: 0.3)
 */
export async function concatenateScenes(videoUrls, outputPath, fadeDuration = 0.3) {
    if (!videoUrls?.length) throw new Error('No videos to concatenate');
    if (videoUrls.length === 1) {
        logger.info(`[Concat] Only 1 scene provided, skipping concat.`, { phase: 'CONCAT_SKIP' });
        return videoUrls[0];
    }

    logger.info(`[Concat] Concatenating ${videoUrls.length} scenes (Cloud FFmpeg)`, { phase: 'CONCAT' });

    // Build the inputs map and the complex filter string for concat demuxer dynamically
    const inputsMap = {};
    let commandParams = '';
    let filterStreams = '';

    for (let i = 0; i < videoUrls.length; i++) {
        inputsMap[`in_${i + 1}`] = videoUrls[i];
        commandParams += `-i {{in_${i + 1}}} `;

        // Assume inputs have video and audio stream: [0:v][0:a][1:v][1:a]...
        filterStreams += `[${i}:v][${i}:a]`;
    }

    const n = videoUrls.length;
    // Build filter complex: -filter_complex "[0:v][0:a][1:v][1:a]concat=n=N:v=1:a=1[outv][outa]"
    const filterComplex = `-filter_complex "${filterStreams}concat=n=${n}:v=1:a=1[outv][outa]"`;

    // Assemble full command
    const cmd = `${commandParams.trim()} ${filterComplex} -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac -b:a 192k -preset fast {{out_1}}`;

    const results = await runRendiJob(
        inputsMap,
        { out_1: path.basename(outputPath) },
        cmd
    );

    if (!results.out_1) throw new Error('Rendi failed to yield concatenated video URL');

    return results.out_1; // Return Cloud URL
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
export async function assembleCreative(hookUrl, bodyUrl, outputDir, meta = {}) {
    const { produto = 'criativo', hookNum = 1, version = 1 } = meta;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${produto}_${date}_hook${hookNum}_v${version}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    logger.info(`[Concat] Assembling creative in Cloud: ${fileName}`, { phase: 'CONCAT_ASSEMBLE' });

    const url = await concatenateScenes([hookUrl, bodyUrl], outputPath, 0.3);

    // Get duration via ffprobe over HTTP 
    const duration = await getMediaDuration(url);
    const size = 0; // Handled later upon export

    logger.info(`[Concat] ✅ Creative ready: ${fileName} (${duration.toFixed(1)}s)`, { phase: 'CONCAT_ASSEMBLE_OK' });

    // We return 'outputPath' as the Cloud URL to avoid breaking the expected object shape 
    // down the pipeline in editor.agent.js
    return { outputPath: url, fileName, duration, size };
}

export default { concatenateScenes, assembleCreative };
