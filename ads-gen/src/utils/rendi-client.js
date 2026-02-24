import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './logger.js';
import { withRetry } from './retry.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const RENDI_API_URL = 'https://api.rendi.dev/v1';

function getHeaders() {
    const apiKey = process.env.API_KEY_RENDI_DEV;
    if (!apiKey) throw new Error('API_KEY_RENDI_DEV not configured in .env');
    return {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
    };
}

/**
 * Executes a Cloud FFmpeg command using Rendi Dev API
 * @param {Object} inputFiles - Map of inputs (e.g. { in_1: "url1", in_2: "url2" })
 * @param {Object} outputFiles - Map of outputs (e.g. { out_1: "output.mp4" })
 * @param {string} command - FFmpeg command string (e.g. "-i {{in_1}} -c copy {{out_1}}")
 * @returns {Promise<Object>} Object containing the output URLs (e.g. { out_1: "https://storage.rendi.dev/..." })
 */
export async function runRendiJob(inputFiles, outputFiles, command) {
    logger.info(`[Rendi] Preparing Cloud FFmpeg Job: ${command.substring(0, 60)}...`, { phase: 'RENDI_PREPARE' });
    const startTime = Date.now();

    try {
        // 1. Submit Job
        const submitResponse = await withRetry(() => axios.post(
            `${RENDI_API_URL}/run-ffmpeg-command`,
            {
                input_files: inputFiles,
                output_files: outputFiles,
                ffmpeg_command: command
            },
            { headers: getHeaders(), timeout: 30_000 }
        ), 3, 2000, 'Rendi Dev Job Submission');

        const commandId = submitResponse.data.command_id;
        if (!commandId) throw new Error('Failed to get command_id from Rendi');

        logger.info(`[Rendi] Job submitted successfully. ID: ${commandId}`, { phase: 'RENDI_SUBMITTED' });

        // 2. Poll for Status
        let isDone = false;
        let finalData = null;
        let attempts = 0;
        const maxAttempts = 60; // 5 mins max (5s * 60)

        while (!isDone && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000));
            attempts++;

            try {
                const statusResponse = await axios.get(`${RENDI_API_URL}/commands/${commandId}`, {
                    headers: getHeaders(),
                    timeout: 10_000
                });

                const status = statusResponse.data.status;
                logger.info(`[Rendi] Polling ${commandId} (Attempt ${attempts}): ${status}`, { phase: 'RENDI_POLL' });

                if (status === 'SUCCESS') {
                    isDone = true;
                    finalData = statusResponse.data;
                } else if (status === 'FAILED') {
                    throw new Error(`Rendi Job Failed: ${statusResponse.data.error_message || 'Unknown Error'}`);
                }
                // if PROCESSING or QUEUED, wait for next loop
            } catch (pollErr) {
                // If it's a network error during polling, we don't throw immediately, just retry next loop
                if (pollErr.response?.status === 404) {
                    throw new Error(`Rendi Job ${commandId} not found (404)`);
                }
                logger.warn(`[Rendi] Polling network issue: ${pollErr.message}`, { phase: 'RENDI_POLL_WARN' });
            }
        }

        if (!isDone) {
            throw new Error(`Rendi Job ${commandId} timed out after ${maxAttempts * 5} seconds.`);
        }

        const elapsed = Date.now() - startTime;

        // 3. Map Output URLs
        const results = {};
        for (const [key, outObj] of Object.entries(finalData.output_files)) {
            // Rendi returns out_1 object with storage_url
            if (outObj.status === 'STORED' && outObj.storage_url) {
                results[key] = outObj.storage_url;
            } else {
                logger.warn(`[Rendi] Output ${key} was not stored correctly by Rendi.`, { phase: 'RENDI_OUTPUT_WARN' });
            }
        }

        logger.info(`[Rendi] Job ${commandId} finished in ${(elapsed / 1000).toFixed(1)}s`, { phase: 'RENDI_SUCCESS' });

        return results;

    } catch (err) {
        logger.error(`[Rendi] Error running job: ${err.message}`, { phase: 'RENDI_ERROR' });
        throw err;
    }
}

/**
 * Helper to download a file from Rendi Storage to local disk
 */
export async function downloadFromRendi(url, destPath) {
    logger.info(`[Rendi] Downloading output to ${path.basename(destPath)}`, { phase: 'RENDI_DOWNLOAD' });

    await fs.ensureDir(path.dirname(destPath));
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
    await fs.writeFile(destPath, Buffer.from(response.data));

    return destPath;
}

export default { runRendiJob, downloadFromRendi };
