import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { runRendiJob, downloadFromRendi } from '../../infrastructure/cloud-compute/rendi-client.js';

// Helper: get media duration
export function getMediaDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, meta) => {
            if (err) return reject(err);
            resolve(parseFloat(meta.format?.duration || 0));
        });
    });
}

/**
 * Remove audio track from video (Cloud)
 */
export async function removeAudio(inputUrl, outputPath) {
    logger.info(`[VideoEditor] Removing audio (Cloud): ${path.basename(outputPath)}`, { phase: 'VIDEO_EDIT' });
    const cmd = `-i {{in_1}} -an -c:v copy {{out_1}}`;

    const results = await runRendiJob({ in_1: inputUrl }, { out_1: path.basename(outputPath) }, cmd);
    return results.out_1; // Return Cloud URL
}

/**
 * Combine video (muted) + narration audio (Cloud)
 */
export async function addNarration(videoUrl, audioUrl, outputPath, velocidadeFator = 1.0) {
    logger.info(`[VideoEditor] Adding narration (speed ×${velocidadeFator} Cloud): ${path.basename(outputPath)}`, { phase: 'VIDEO_EDIT' });

    let cmd;
    if (velocidadeFator !== 1.0) {
        const pts = (1 / velocidadeFator).toFixed(4);
        cmd = `-i {{in_1}} -i {{in_2}} -filter_complex "[0:v]setpts=${pts}*PTS[v]" -map "[v]" -map 1:a -shortest -c:v libx264 -c:a aac -b:a 192k -preset fast {{out_1}}`;
    } else {
        cmd = `-i {{in_1}} -i {{in_2}} -map 0:v -map 1:a -shortest -c:v libx264 -c:a aac -b:a 192k -preset fast {{out_1}}`;
    }

    const results = await runRendiJob({ in_1: videoUrl, in_2: audioUrl }, { out_1: path.basename(outputPath) }, cmd);
    return results.out_1; // Return Cloud URL
}

/**
 * Add subtitles to video using drawtext filter (Cloud)
 */
export async function addSubtitles(videoUrl, texto, outputPath, opts = {}) {
    const { fontSize = 22, wordsPerChunk = 8 } = opts;
    logger.info(`[VideoEditor] Adding subtitles (${texto.length} chars Cloud)`, { phase: 'VIDEO_EDIT' });

    try {
        const duration = await getMediaDuration(videoUrl); // ffprobe reads https:// implicitly
        const words = texto.split(/\s+/);
        const chunks = [];
        for (let i = 0; i < words.length; i += wordsPerChunk) {
            chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
        }

        const chunkDuration = duration / chunks.length;

        const filters = chunks.map((chunk, i) => {
            const start = (i * chunkDuration).toFixed(3);
            const end = ((i + 1) * chunkDuration).toFixed(3);
            const escaped = chunk
                .replace(/\\/g, '\\\\\\\\')
                .replace(/'/g, "\u2019")
                .replace(/:/g, '\\:')
                .replace(/%/g, '%%')
                .replace(/\n/g, ' ')
                // ensure quotes are escaped properly for Rendi CLI
                .replace(/"/g, '\\"');

            // Using Arial (standard default on cloud servers typically)
            return `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:font=Arial:x=(w-tw)/2:y=h-th-60:enable='between(t\\,${start}\\,${end})'`;
        });

        const filterComplex = `-vf "${filters.join(', ')}"`;
        const cmd = `-i {{in_1}} ${filterComplex} -c:v libx264 -c:a copy -preset fast {{out_1}}`;

        const results = await runRendiJob({ in_1: videoUrl }, { out_1: path.basename(outputPath) }, cmd);
        return results.out_1; // Return Cloud URL
    } catch (err) {
        logger.warn(`[VideoEditor] ⚠️ Cloud Subtitles failed (${err.message}). Skipping.`, { phase: 'VIDEO_EDIT_WARN' });
        // Return original URL
        return videoUrl;
    }
}

/**
 * Mix narration + background music (Cloud)
 */
export async function addBackgroundMusic(videoUrl, musicUrl, outputPath) {
    logger.info(`[VideoEditor] Adding background music (Cloud): ${path.basename(outputPath)}`, { phase: 'VIDEO_EDIT' });

    const filterComplex = `-filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"`;
    const cmd = `-i {{in_1}} -i {{in_2}} ${filterComplex} -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k {{out_1}}`;

    const results = await runRendiJob({ in_1: videoUrl, in_2: musicUrl }, { out_1: path.basename(outputPath) }, cmd);
    return results.out_1; // Return Cloud URL
}

/**
 * Apply visual effect to video (Cloud)
 */
export async function applyEffect(videoUrl, efeito, outputPath) {
    logger.info(`[VideoEditor] Applying effect '${efeito}' (Cloud): ${path.basename(outputPath)}`, { phase: 'VIDEO_EDIT' });

    try {
        const duration = await getMediaDuration(videoUrl);

        let filter;
        switch (efeito) {
            case 'fade-in':
                filter = 'fade=t=in:st=0:d=0.5';
                break;
            case 'fade-out':
                filter = `fade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5`;
                break;
            case 'slide-left':
                filter = `crop=iw*0.8:ih:iw*0.2*t/${duration}:0`;
                break;
            case 'zoom-in':
                filter = `zoompan=z='min(zoom+0.002,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=720x1280:fps=30`;
                break;
            default:
                filter = 'null';
        }

        const cmd = `-i {{in_1}} -vf "${filter}" -c:v libx264 -c:a copy -preset fast {{out_1}}`;

        const results = await runRendiJob({ in_1: videoUrl }, { out_1: path.basename(outputPath) }, cmd);
        return results.out_1; // Return Cloud URL
    } catch (err) {
        logger.warn(`[VideoEditor] ⚠️ Effect '${efeito}' failed (${err.message}). Skipping effect.`, { phase: 'VIDEO_EDIT_WARN' });
        return videoUrl;
    }
}

/**
 * Export final video with broadcast-ready settings (Cloud)
 */
export async function exportFinal(inputUrl, outputPath) {
    logger.info(`[VideoEditor] Exporting final (Cloud): ${path.basename(outputPath)}`, { phase: 'VIDEO_EXPORT' });

    const cmd = `-i {{in_1}} -c:v libx264 -c:a aac -s 720x1280 -r 30 -b:v 4000k -b:a 192k -preset fast -movflags +faststart -pix_fmt yuv420p -aspect 9:16 {{out_1}}`;

    const results = await runRendiJob({ in_1: inputUrl }, { out_1: path.basename(outputPath) }, cmd);
    return downloadFromRendi(results.out_1, outputPath);
}

// Format seconds to SRT timestamp: HH:MM:SS,mmm
function formatSRT(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export default {
    removeAudio, addNarration, addSubtitles, addBackgroundMusic,
    applyEffect, exportFinal, getMediaDuration
};
