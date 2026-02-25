import fs from 'fs-extra';
import { logger } from '../../utils/logger.js';
import creativePipeline from '../../modules/production/pipeline.js';
import { criarProjeto, criarBriefing, buscarProjeto, buscarBriefing, listarUsagePorProjeto } from '../../infrastructure/database/dal.js';

async function printFinalReport(briefingId, deliveryResult) {
    const briefing = await buscarBriefing(briefingId);
    const projeto = await buscarProjeto(briefing.projeto_id);
    const usage = await listarUsagePorProjeto(projeto.id);

    const totalCost = usage.reduce((sum, u) => sum + (Number(u.custo_usd) || 0), 0);
    const hookCount = deliveryResult ? deliveryResult.length : 0;

    logger.info(`\n══════════════════════════════════════`);
    logger.info(`✅ ENTREGA CONCLUÍDA`);
    logger.info(`══════════════════════════════════════`);
    logger.info(`Projeto: ${projeto.nome} | ${hookCount} criativos`);
    logger.info(``);

    if (deliveryResult && hookCount > 0) {
        deliveryResult.forEach(cr => {
            logger.info(`Hook ${cr.hookNum}: ${cr.driveUrl}`);
        });
    } else {
        logger.info(`Nenhum vídeo entregue (verifique os logs).`);
    }

    logger.info(``);
    logger.info(`Custo estimado: $${totalCost.toFixed(4)}`);
    logger.info(`══════════════════════════════════════\n`);
}

export async function processCommand(options) {
    try {
        if (!fs.existsSync(options.copy)) {
            logger.error(`❌ Arquivo de copy não encontrado: ${options.copy}`);
            process.exit(1);
        }

        const copyTexto = await fs.readFile(options.copy, 'utf-8');

        const projetoId = await criarProjeto({
            nome: options.projeto,
            produto: 'Video Pipeline Exemplo',
            status: 'ativo'
        });

        const briefingId = await criarBriefing({
            projeto_id: projetoId,
            copy_original: copyTexto,
            status: 'novo'
        });

        const { success, delivery, error } = await creativePipeline.run(briefingId, { modo: options.modo });

        if (success) {
            await printFinalReport(briefingId, delivery);
        } else {
            logger.error(`❌ Falha no pipeline: ${error}`);
        }
    } catch (err) {
        logger.error(`❌ Erro Fatal: ${err.message}`);
    }
}
