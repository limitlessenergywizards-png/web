import fs from 'fs-extra';
import path from 'path';
import PQueue from 'p-queue';
import { logger } from '../utils/logger.js';
import creativePipeline from './creative-pipeline.js';
import { criarProjeto, criarBriefing, listarUsagePorProjeto } from '../db/dal.js';

export class BatchProcessor {
    constructor() {
        // Máximo de 2 pipelines simultâneos para não estourar rate limits
        this.queue = new PQueue({ concurrency: 2 });
    }

    /**
     * Process a directory of copy texts (.txt) into full creatives.
     * @param {string} inputDir - Directory containing .txt copy files
     * @param {string} modo - 'auto' or 'semi-auto'
     */
    async processBatch(inputDir, modo = 'auto') {
        if (!fs.existsSync(inputDir)) {
            throw new Error(`Directory not found: ${inputDir}`);
        }

        const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.txt'));
        if (files.length === 0) {
            logger.info(`[Batch] Zero .txt files found in ${inputDir}`);
            return;
        }

        logger.info(`\n📦 [Batch] Found ${files.length} copy files to process. Concurrency: 2`);

        const startTime = Date.now();
        let completed = 0;
        const stats = [];

        // Queue up the jobs
        const jobs = files.map(fileName => {
            return this.queue.add(async () => {
                const filePath = path.join(inputDir, fileName);
                const copyTexto = await fs.readFile(filePath, 'utf-8');
                const projName = `Batch - ${fileName.replace('.txt', '')} ${new Date().toISOString().slice(0, 10)}`;

                logger.info(`\n➡️  [Batch] Started Job for: ${fileName}`);

                try {
                    // Setup DB entries
                    const projetoId = await criarProjeto({
                        nome: projName,
                        cliente: 'BatchProcess',
                        status: 'ativo'
                    });

                    const briefingId = await criarBriefing({
                        projeto_id: projetoId,
                        copy_original: copyTexto,
                        status: 'novo'
                    });

                    // Run the pipeline
                    const result = await creativePipeline.run(briefingId, { modo });

                    // Gather stats
                    const usage = await listarUsagePorProjeto(projetoId);
                    const totalCost = usage.reduce((sum, u) => sum + (Number(u.custo_usd) || 0), 0);

                    stats.push({
                        fileName,
                        projetoId,
                        briefingId,
                        success: result.success,
                        delivery: result.delivery,
                        cost: totalCost
                    });

                    completed++;
                    logger.info(`\n✅ [Batch] Finished: ${fileName} (${completed}/${files.length} done). Cost: $${totalCost.toFixed(4)}`);

                } catch (error) {
                    logger.error(`\n❌ [Batch] Failed: ${fileName} - ${error.message}`);
                    stats.push({ fileName, success: false, error: error.message });
                }
            });
        });

        await Promise.all(jobs);

        const totalTimeMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const totalBatchCost = stats.reduce((sum, s) => sum + (s.cost || 0), 0);
        const successCount = stats.filter(s => s.success).length;

        // Final Report
        logger.info(`\n══════════════════════════════════════`);
        logger.info(`📦 BATCH PROCESSING COMPLETE`);
        logger.info(`══════════════════════════════════════`);
        logger.info(`🏁 Processed: ${successCount}/${files.length} successful`);
        logger.info(`⏱️  Total Time: ${totalTimeMin} minutes`);
        logger.info(`💰 Total Cost: $${totalBatchCost.toFixed(2)}`);
        console.log(JSON.stringify(stats, null, 2));
    }
}

export default new BatchProcessor();
