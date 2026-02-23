import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Remove background noise from audio using FFmpeg afftdn filter
 * @param {string} inputPath - Path to input audio
 * @param {string} outputPath - Path for cleaned output
 * @returns {string} outputPath
 */
export function removeBackgroundNoise(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        logger.info(`[AudioProc] Removing noise: ${path.basename(inputPath)}`, { phase: 'AUDIO_DENOISE' });

        fs.ensureDirSync(path.dirname(outputPath));

        ffmpeg(inputPath)
            .audioFilters([
                'afftdn=nf=-25',                           // Adaptive noise reduction
                'equalizer=f=200:t=h:width=100:g=-3',      // Cut low rumble
                'equalizer=f=8000:t=h:width=2000:g=-2',    // Reduce high hiss
                'acompressor=threshold=-20dB:ratio=3:attack=5:release=50'  // Light compression
            ])
            .output(outputPath)
            .on('end', () => {
                logger.info(`[AudioProc] Noise removed: ${path.basename(outputPath)}`, { phase: 'AUDIO_DENOISE_OK' });
                resolve(outputPath);
            })
            .on('error', (err) => {
                logger.error(`[AudioProc] Denoise failed: ${err.message}`, { phase: 'AUDIO_DENOISE_ERR' });
                reject(err);
            })
            .run();
    });
}

/**
 * Normalize audio volume to target LUFS using FFmpeg loudnorm filter
 * @param {string} inputPath - Path to input audio
 * @param {string} outputPath - Path for normalized output
 * @param {number} targetDb - Target integrated loudness in LUFS (default: -16)
 * @returns {string} outputPath
 */
export function normalizeVolume(inputPath, outputPath, targetDb = -16) {
    return new Promise((resolve, reject) => {
        logger.info(`[AudioProc] Normalizing to ${targetDb} LUFS: ${path.basename(inputPath)}`, { phase: 'AUDIO_NORM' });

        fs.ensureDirSync(path.dirname(outputPath));

        ffmpeg(inputPath)
            .audioFilters([
                `loudnorm=I=${targetDb}:TP=-1.5:LRA=11:print_format=summary`
            ])
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .output(outputPath)
            .on('end', () => {
                logger.info(`[AudioProc] Normalized: ${path.basename(outputPath)}`, { phase: 'AUDIO_NORM_OK' });
                resolve(outputPath);
            })
            .on('error', (err) => {
                logger.error(`[AudioProc] Normalize failed: ${err.message}`, { phase: 'AUDIO_NORM_ERR' });
                reject(err);
            })
            .run();
    });
}

/**
 * Get audio duration in seconds using ffprobe
 * @param {string} filePath - Path to audio file
 * @returns {number} Duration in seconds
 */
export function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                logger.error(`[AudioProc] ffprobe failed: ${err.message}`, { phase: 'AUDIO_PROBE_ERR' });
                return reject(err);
            }
            const duration = metadata.format?.duration || 0;
            resolve(parseFloat(duration));
        });
    });
}

/**
 * Adjust audio speed without changing pitch (time-stretch)
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} factor - Speed factor (e.g., 1.1 = 10% faster, 0.9 = 10% slower)
 */
export function adjustSpeed(inputPath, outputPath, factor) {
    return new Promise((resolve, reject) => {
        logger.info(`[AudioProc] Adjusting speed ×${factor}: ${path.basename(inputPath)}`, { phase: 'AUDIO_SPEED' });

        fs.ensureDirSync(path.dirname(outputPath));

        // atempo filter accepts 0.5–2.0 range
        const clampedFactor = Math.max(0.5, Math.min(2.0, factor));

        ffmpeg(inputPath)
            .audioFilters([`atempo=${clampedFactor}`])
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .output(outputPath)
            .on('end', () => {
                logger.info(`[AudioProc] Speed adjusted: ${path.basename(outputPath)}`, { phase: 'AUDIO_SPEED_OK' });
                resolve(outputPath);
            })
            .on('error', (err) => {
                logger.error(`[AudioProc] Speed adjust failed: ${err.message}`, { phase: 'AUDIO_SPEED_ERR' });
                reject(err);
            })
            .run();
    });
}

export default { removeBackgroundNoise, normalizeVolume, getAudioDuration, adjustSpeed };
