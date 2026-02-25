import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../../../utils/logger.js';
import { logApiUsage } from '../../../infrastructure/database/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const HELIX_API_KEY = process.env.HELIX_API_KEY;
const HELIX_BASE_URL = 'https://api.helix.ml/v1';
const POLL_INTERVAL_MS = 15_000; // 15s
const TIMEOUT_MS = 8 * 60 * 1000; // 8 min

export class HelixClient {
    constructor() {
        this.available = !!(HELIX_API_KEY && HELIX_API_KEY.length > 10);
        this.provider = 'helix';
    }

    /**
     * Animate an image with a text prompt using Helix
     */
    async animate(imagePath, promptTexto, resolucao = '1080p', duracao = 10, context = {}) {
        if (!this.available) throw new Error('HELIX_API_KEY not configured');

        logger.info(`[Helix] Starting animation job (${duracao}s, ${resolucao})`, { phase: 'HELIX_ANIMATE' });
        const startTime = Date.now();

        // Truncate prompt to 1700 chars max
        const prompt = promptTexto.length > 1700 ? promptTexto.substring(0, 1700) : promptTexto;

        // Read image as base64
        const imageBuffer = await fs.readFile(imagePath);
        const imageBase64 = imageBuffer.toString('base64');
        const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        try {
            // Submit animation job
            const submitResponse = await axios.post(
                `${HELIX_BASE_URL}/animations`,
                {
                    image: `data:${mimeType};base64,${imageBase64}`,
                    prompt,
                    resolution: resolucao,
                    duration: duracao,
                    model: 'helix-animation-v1'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${HELIX_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const jobId = submitResponse.data.id || submitResponse.data.job_id;
            if (!jobId) throw new Error('No job ID returned from Helix');

            logger.info(`[Helix] Job submitted: ${jobId}`, { phase: 'HELIX_JOB' });

            // Poll for completion
            const videoUrl = await this._pollUntilDone(jobId, startTime);

            // Download video
            const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'helix');
            await fs.ensureDir(outputDir);
            const outputPath = path.join(outputDir, `helix_${Date.now()}.mp4`);
            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

            const elapsed = Date.now() - startTime;

            await logApiUsage({
                provider: 'helix', modelo: 'helix-animation-v1', tipo_operacao: 'image_to_video',
                custo_usd: 0.10, duracao_geracao_ms: elapsed, duracao_asset_segundos: duracao,
                prompt_usado: prompt.substring(0, 500), resolucao, status: 'sucesso',
                ...context
            }).catch(() => { });

            logger.info(`[Helix] Video ready: ${outputPath} (${(elapsed / 1000).toFixed(1)}s)`, { phase: 'HELIX_DONE' });
            return { path: outputPath, duracao, provider: 'helix', elapsed };

        } catch (err) {
            const elapsed = Date.now() - startTime;
            await logApiUsage({
                provider: 'helix', modelo: 'helix-animation-v1', tipo_operacao: 'image_to_video',
                custo_usd: 0, duracao_geracao_ms: elapsed, status: 'erro', erro_mensagem: err.message,
                ...context
            }).catch(() => { });
            logger.error(`[Helix] Animation failed: ${err.message}`, { phase: 'HELIX_ERROR' });
            throw err;
        }
    }

    async checkStatus(jobId) {
        if (!this.available) return 'error';
        try {
            const response = await axios.get(`${HELIX_BASE_URL}/animations/${jobId}`, {
                headers: { 'Authorization': `Bearer ${HELIX_API_KEY}` }
            });
            const status = response.data.status?.toLowerCase();
            if (status === 'completed' || status === 'done') return 'done';
            if (status === 'failed' || status === 'error') return 'error';
            if (status === 'processing' || status === 'running') return 'processing';
            return 'pending';
        } catch {
            return 'error';
        }
    }

    async _pollUntilDone(jobId, startTime) {
        while (true) {
            if (Date.now() - startTime > TIMEOUT_MS) {
                throw new Error(`Helix job ${jobId} timed out after 8 minutes`);
            }

            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

            const response = await axios.get(`${HELIX_BASE_URL}/animations/${jobId}`, {
                headers: { 'Authorization': `Bearer ${HELIX_API_KEY}` }
            });

            const status = response.data.status?.toLowerCase();
            logger.info(`[Helix] Job ${jobId} status: ${status}`, { phase: 'HELIX_POLL' });

            if (status === 'completed' || status === 'done') {
                return response.data.video_url || response.data.output?.url;
            }
            if (status === 'failed' || status === 'error') {
                throw new Error(`Helix job failed: ${response.data.error || 'Unknown error'}`);
            }
        }
    }
}

export default new HelixClient();
