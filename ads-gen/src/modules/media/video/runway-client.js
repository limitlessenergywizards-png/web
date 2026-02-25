import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../../../utils/logger.js';
import { logApiUsage } from '../../../infrastructure/database/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
const RUNWAY_BASE_URL = 'https://api.dev.runwayml.com/v1';
const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export class RunwayClient {
    constructor() {
        this.available = !!(RUNWAY_API_KEY && RUNWAY_API_KEY.length > 10);
        this.provider = 'runway';
    }

    async animate(imagePath, promptTexto, resolucao = '1080p', duracao = 10, context = {}) {
        if (!this.available) throw new Error('RUNWAY_API_KEY not configured');

        logger.info(`[Runway] Starting Gen-3 animation (${duracao}s)`, { phase: 'RUNWAY_ANIMATE' });
        const startTime = Date.now();

        const prompt = promptTexto.length > 1700 ? promptTexto.substring(0, 1700) : promptTexto;
        const imageBuffer = await fs.readFile(imagePath);
        const imageBase64 = imageBuffer.toString('base64');

        try {
            const submitResponse = await axios.post(
                `${RUNWAY_BASE_URL}/image_to_video`,
                {
                    model: 'gen3a_turbo',
                    promptImage: `data:image/png;base64,${imageBase64}`,
                    promptText: prompt,
                    duration: duracao,
                    ratio: '9:16'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
                        'X-Runway-Version': '2024-11-06',
                        'Content-Type': 'application/json'
                    }
                }
            );

            const taskId = submitResponse.data.id;
            if (!taskId) throw new Error('No task ID returned from Runway');

            logger.info(`[Runway] Task submitted: ${taskId}`, { phase: 'RUNWAY_JOB' });

            // Poll until done
            const videoUrl = await this._pollUntilDone(taskId, startTime);

            // Download
            const outputDir = path.join(process.cwd(), 'data', 'video', context.briefingId || 'runway');
            await fs.ensureDir(outputDir);
            const outputPath = path.join(outputDir, `runway_${Date.now()}.mp4`);
            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

            const elapsed = Date.now() - startTime;

            await logApiUsage({
                provider: 'runway', modelo: 'gen3a_turbo', tipo_operacao: 'image_to_video',
                custo_usd: 0.20, duracao_geracao_ms: elapsed, duracao_asset_segundos: duracao,
                prompt_usado: prompt.substring(0, 500), resolucao, status: 'sucesso',
                ...context
            }).catch(() => { });

            logger.info(`[Runway] Video ready: ${outputPath} (${(elapsed / 1000).toFixed(1)}s)`, { phase: 'RUNWAY_DONE' });
            return { path: outputPath, duracao, provider: 'runway', elapsed };

        } catch (err) {
            await logApiUsage({
                provider: 'runway', modelo: 'gen3a_turbo', tipo_operacao: 'image_to_video',
                custo_usd: 0, duracao_geracao_ms: Date.now() - startTime, status: 'erro',
                erro_mensagem: err.message, ...context
            }).catch(() => { });
            logger.error(`[Runway] Animation failed: ${err.message}`, { phase: 'RUNWAY_ERROR' });
            throw err;
        }
    }

    async checkStatus(taskId) {
        if (!this.available) return 'error';
        try {
            const response = await axios.get(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' }
            });
            const s = response.data.status;
            if (s === 'SUCCEEDED') return 'done';
            if (s === 'FAILED') return 'error';
            return 'processing';
        } catch { return 'error'; }
    }

    async _pollUntilDone(taskId, startTime) {
        while (true) {
            if (Date.now() - startTime > TIMEOUT_MS) throw new Error(`Runway task ${taskId} timed out`);
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

            const response = await axios.get(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' }
            });

            const s = response.data.status;
            logger.info(`[Runway] Task ${taskId} status: ${s}`, { phase: 'RUNWAY_POLL' });

            if (s === 'SUCCEEDED') return response.data.output?.[0];
            if (s === 'FAILED') throw new Error(`Runway task failed: ${response.data.failure || 'Unknown'}`);
        }
    }
}

export default new RunwayClient();
