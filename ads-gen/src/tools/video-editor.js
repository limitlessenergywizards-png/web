import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';

// Helper: create a temp file path
const tmpFile = (ext) => path.join(os.tmpdir(), `adsgen_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);

// Helper: promisified ffmpeg run
const runFF = (cmd, label) => new Promise((resolve, reject) => {
    cmd
        .on('end', () => { logger.info(`[VideoEditor] ✅ ${label}`, { phase: 'VIDEO_EDIT_OK' }); resolve(); })
        .on('error', (err) => { logger.error(`[VideoEditor] ❌ ${label}: ${err.message}`, { phase: 'VIDEO_EDIT_ERR' }); reject(err); })
        .run();
});

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
 * Remove audio track from video
 */
export function removeAudio(inputPath, outputPath) {
    logger.info(`[VideoEditor] Removing audio: ${path.basename(inputPath)}`, { phase: 'VIDEO_EDIT' });
    fs.ensureDirSync(path.dirname(outputPath));
    return runFF(
        ffmpeg(inputPath).noAudio().videoCodec('copy').output(outputPath),
        'removeAudio'
    );
}

/**
 * Combine video (muted) + narration audio.
 * Applies speed factor to video if needed (keeping audio pitch unchanged).
 * @param {string} videoPath - Path to video (will be muted)
 * @param {string} audioPath - Path to narration audio
 * @param {string} outputPath - Output path
 * @param {number} velocidadeFator - Speed factor for video (1.0 = normal)
 */
export function addNarration(videoPath, audioPath, outputPath, velocidadeFator = 1.0) {
    logger.info(`[VideoEditor] Adding narration (speed ×${velocidadeFator}): ${path.basename(videoPath)}`, { phase: 'VIDEO_EDIT' });
    fs.ensureDirSync(path.dirname(outputPath));

    const cmd = ffmpeg();

    if (velocidadeFator !== 1.0) {
        // Speed up/slow down video without changing audio pitch
        const pts = (1 / velocidadeFator).toFixed(4);
        cmd.input(videoPath)
            .input(audioPath)
            .complexFilter([
                `[0:v]setpts=${pts}*PTS[v]`
            ], ['v'])
            .outputOptions([
                '-map', '[v]',
                '-map', '1:a',
                '-shortest'
            ]);
    } else {
        cmd.input(videoPath)
            .input(audioPath)
            .outputOptions([
                '-map', '0:v',
                '-map', '1:a',
                '-shortest'
            ]);
    }

    cmd.videoCodec('libx264').audioCodec('aac').audioBitrate('192k')
        .outputOptions(['-preset', 'fast'])
        .output(outputPath);

    return runFF(cmd, 'addNarration');
}

/**
 * Add subtitles to video using drawtext filter (no external SRT file needed).
 * Splits text into timed chunks displayed sequentially.
 * @param {string} videoPath
 * @param {string} texto - Full text for subtitles
 * @param {string} outputPath
 * @param {Object} opts - { fontSize, wordsPerChunk }
 */
export async function addSubtitles(videoPath, texto, outputPath, opts = {}) {
    const { fontSize = 22, wordsPerChunk = 8 } = opts;
    logger.info(`[VideoEditor] Adding subtitles (${texto.length} chars)`, { phase: 'VIDEO_EDIT' });
    fs.ensureDirSync(path.dirname(outputPath));

    try {
        const duration = await getMediaDuration(videoPath);
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
                .replace(/\n/g, ' ');

            return `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:font=Arial:x=(w-tw)/2:y=h-th-60:enable='between(t\\,${start}\\,${end})'`;
        });

        const cmd = ffmpeg(videoPath)
            .videoFilters(filters)
            .videoCodec('libx264')
            .audioCodec('copy')
            .outputOptions(['-preset', 'fast'])
            .output(outputPath);

        await runFF(cmd, 'addSubtitles');
    } catch (err) {
        // drawtext/subtitles filter not available — skip subtitles gracefully
        logger.warn(`[VideoEditor] ⚠️ Subtitles not available (${err.message}). Install FFmpeg with --enable-libfreetype. Copying video without subtitles.`, { phase: 'VIDEO_EDIT_WARN' });
        await fs.copy(videoPath, outputPath);
    }
}

/**
 * Mix narration + background music.
 * Music at -30dB relative to narration.
 */
export function addBackgroundMusic(videoPath, musicPath, outputPath) {
    logger.info(`[VideoEditor] Adding background music`, { phase: 'VIDEO_EDIT' });
    fs.ensureDirSync(path.dirname(outputPath));

    const cmd = ffmpeg()
        .input(videoPath)
        .input(musicPath)
        .complexFilter([
            '[0:a]volume=1.0[voice]',
            '[1:a]volume=0.15[music]',
            '[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]'
        ], ['aout'])
        .outputOptions([
            '-map', '0:v',
            '-map', '[aout]'
        ])
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate('192k')
        .output(outputPath);

    return runFF(cmd, 'addBackgroundMusic');
}

/**
 * Apply visual effect to video.
 * @param {string} videoPath
 * @param {'slide-left'|'zoom-in'|'fade-in'|'fade-out'} efeito
 * @param {string} outputPath
 */
export async function applyEffect(videoPath, efeito, outputPath) {
    logger.info(`[VideoEditor] Applying effect: ${efeito}`, { phase: 'VIDEO_EDIT' });
    fs.ensureDirSync(path.dirname(outputPath));

    try {
        const duration = await getMediaDuration(videoPath);

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
                // No effect — just re-encode
                filter = 'null';
        }

        const cmd = ffmpeg(videoPath)
            .videoFilters([filter])
            .videoCodec('libx264')
            .audioCodec('copy')
            .outputOptions(['-preset', 'fast'])
            .output(outputPath);

        await runFF(cmd, `applyEffect(${efeito})`);
    } catch (err) {
        logger.warn(`[VideoEditor] ⚠️ Effect '${efeito}' failed (${err.message}). Copying without effect.`, { phase: 'VIDEO_EDIT_WARN' });
        await fs.copy(videoPath, outputPath);
    }
}

/**
 * Export final video with broadcast-ready settings.
 * Codec: H.264/AAC, 720×1280 (9:16), 30fps, 4000k video, 192k audio.
 */
export function exportFinal(inputPath, outputPath) {
    logger.info(`[VideoEditor] Exporting final: ${path.basename(inputPath)}`, { phase: 'VIDEO_EXPORT' });
    fs.ensureDirSync(path.dirname(outputPath));

    const cmd = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('720x1280')
        .fps(30)
        .videoBitrate('4000k')
        .audioBitrate('192k')
        .outputOptions([
            '-preset', 'fast',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-aspect', '9:16'
        ])
        .output(outputPath);

    return runFF(cmd, 'exportFinal');
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
