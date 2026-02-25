import fs from 'fs-extra';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { runRendiJob, downloadFromRendi } from '../../infrastructure/cloud-compute/rendi-client.js';

/**
 * Remove background noise from audio using FFmpeg afftdn filter
 * @param {string} inputPath - Path to input audio
 * @param {string} outputPath - Path for cleaned output
 * @returns {string} outputPath
 */
export async function removeBackgroundNoise(inputUrl, outputPath) {
    logger.info(`[AudioProc] Removing noise (Cloud): ${path.basename(outputPath)}`, { phase: 'AUDIO_DENOISE' });

    // Ensure audio filters are sent wrapped inside double quotes (or properly escaped) 
    const cmd = `-i {{in_1}} -af "afftdn=nf=-25, equalizer=f=200:t=h:width=100:g=-3, equalizer=f=8000:t=h:width=2000:g=-2, acompressor=threshold=-20dB:ratio=3:attack=5:release=50" {{out_1}}`;

    const results = await runRendiJob(
        { in_1: inputUrl },
        { out_1: path.basename(outputPath) },
        cmd
    );

    if (!results.out_1) throw new Error('Rendi failed to yield denoised audio URL');

    return downloadFromRendi(results.out_1, outputPath);
}

/**
 * Normalize audio volume to target LUFS using FFmpeg loudnorm filter
 * @param {string} inputPath - Path to input audio
 * @param {string} outputPath - Path for normalized output
 * @param {number} targetDb - Target integrated loudness in LUFS (default: -16)
 * @returns {string} outputPath
 */
export async function normalizeVolume(inputUrl, outputPath, targetDb = -16) {
    logger.info(`[AudioProc] Normalizing to ${targetDb} LUFS (Cloud): ${path.basename(outputPath)}`, { phase: 'AUDIO_NORM' });

    const cmd = `-i {{in_1}} -af "loudnorm=I=${targetDb}:TP=-1.5:LRA=11" -c:a libmp3lame -b:a 192k {{out_1}}`;

    const results = await runRendiJob(
        { in_1: inputUrl },
        { out_1: path.basename(outputPath) },
        cmd
    );

    if (!results.out_1) throw new Error('Rendi failed to yield normalized audio URL');

    return downloadFromRendi(results.out_1, outputPath);
}

/**
 * Get audio duration in seconds using ffprobe
 * @param {string} filePath - Path to audio file
 * @returns {number} Duration in seconds
 */
export async function getAudioDuration(inputUrl) {
    try {
        // As a fast alternative to running ffprobe locally or over Rendi just for metadata,
        // ElevenLabs and TTS systems already yield accurate characters, or if strictly needed,
        // we can dynamically parse Rendi's stats. For now, since it was using Local FFprobe,
        // we replace it with `music-metadata` or a light HTTP Header read if it's a known URL.
        // For simplicity during the Cloud Migration, if this is called, we will execute a dummy Rendi Job
        // that copies 1s just to parse, OR better, we use local ffprobe only if file is local.

        // *IMPORTANT*: Since the project specifically asks to remove fluent-ffmpeg, we should use
        // standard Node `fs` / `axios` to read the duration, or assume duration is calculable from ElevenLabs. 
        // For audio downloaded:
        const { parseBuffer } = await import('music-metadata');
        const { default: axios } = await import('axios');

        // Fetch first 256kb to get metadata (sufficient for mp3 headers)
        const response = await axios.get(inputUrl, {
            responseType: 'arraybuffer',
            headers: { 'Range': 'bytes=0-256000' }
        });
        const meta = await parseBuffer(Buffer.from(response.data), 'audio/mpeg');
        return meta.format.duration || 0;
    } catch (err) {
        logger.warn(`[AudioProc] Audio duration inference failed: ${err.message}`, { phase: 'AUDIO_PROBE_WARN' });
        return 0; // Fallback
    }
}

/**
 * Adjust audio speed without changing pitch (time-stretch)
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} factor - Speed factor (e.g., 1.1 = 10% faster, 0.9 = 10% slower)
 */
export async function adjustSpeed(inputUrl, outputPath, factor) {
    logger.info(`[AudioProc] Adjusting speed ×${factor} (Cloud): ${path.basename(outputPath)}`, { phase: 'AUDIO_SPEED' });

    const clampedFactor = Math.max(0.5, Math.min(2.0, factor));
    const cmd = `-i {{in_1}} -af "atempo=${clampedFactor}" -c:a libmp3lame -b:a 192k {{out_1}}`;

    const results = await runRendiJob(
        { in_1: inputUrl },
        { out_1: path.basename(outputPath) },
        cmd
    );

    if (!results.out_1) throw new Error('Rendi failed to yield speed adjusted audio URL');

    return downloadFromRendi(results.out_1, outputPath);
}

export default { removeBackgroundNoise, normalizeVolume, getAudioDuration, adjustSpeed };
