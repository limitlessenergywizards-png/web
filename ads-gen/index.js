#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import creativePipeline from './src/pipelines/creative-pipeline.js';
import batchProcessor from './src/pipelines/batch-processor.js';
import { criarProjeto, criarBriefing, buscarProjeto, buscarBriefing, listarUsagePorProjeto } from './src/db/dal.js';
import { runAuthServer } from './src/tools/drive-uploader.js';

// ... (other imports remain, just updating the destructuring at the top and the commands at the bottom)

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const program = new Command();

program
    .name('ads-gen')
    .description('AI Video Creative Generation Pipeline')
    .version('1.0.0');

// Helper to print final success message
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

// ─── Command: Process single copy file ───
program
    .command('process')
    .description('Processa um arquivo de copy único')
    .requiredOption('--copy <path>', 'Caminho do arquivo .txt com a copy')
    .requiredOption('--projeto <name>', 'Nome do projeto')
    .option('--modo <mode>', 'Modo de execução (auto/semi-auto)', 'auto')
    .action(async (options) => {
        try {
            if (!fs.existsSync(options.copy)) {
                logger.error(`❌ Arquivo de copy não encontrado: ${options.copy}`);
                process.exit(1);
            }

            const copyTexto = await fs.readFile(options.copy, 'utf-8');

            const projetoId = await criarProjeto({
                nome: options.projeto,
                cliente: 'CLI User',
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
    });

// ─── Command: Batch Process ───
program
    .command('batch')
    .description('Processa um diretório com múltiplos arquivos de copy')
    .requiredOption('--dir <path>', 'Caminho do diretório (ex: ./data/inputs/batch/)')
    .option('--modo <mode>', 'Modo de execução (auto/semi-auto)', 'auto')
    .action(async (options) => {
        try {
            await batchProcessor.processBatch(options.dir, options.modo);
        } catch (err) {
            logger.error(`❌ Erro Batch: ${err.message}`);
        }
    });

// ─── Command: Resume Briefing ───
program
    .command('resume')
    .description('Retoma um briefing a partir de onde parou (recovery)')
    .requiredOption('--briefing <id>', 'ID do Briefing')
    .option('--modo <mode>', 'Modo de execução (auto/semi-auto)', 'auto')
    .action(async (options) => {
        try {
            const { success, delivery, error } = await creativePipeline.run(options.briefing, { modo: options.modo });

            if (success) {
                await printFinalReport(options.briefing, delivery);
            } else {
                logger.error(`❌ Falha no pipeline: ${error}`);
            }
        } catch (err) {
            logger.error(`❌ Erro Resume: ${err.message}`);
        }
    });

// ─── Command: Status ───
program
    .command('status')
    .description('Exibe o status atual de um projeto e seus custos')
    .requiredOption('--projeto <id>', 'ID do Projeto')
    .action(async (options) => {
        try {
            const projeto = await buscarProjeto(options.projeto);
            if (!projeto) {
                logger.error(`Projeto não encontrado.`);
                return;
            }

            const usage = await listarUsagePorProjeto(projeto.id);
            const totalCost = usage.reduce((sum, u) => sum + (Number(u.custo_usd) || 0), 0);

            logger.info(`\n📊 Status do Projeto: ${projeto.nome}`);
            logger.info(`Status Geral: ${projeto.status}`);
            logger.info(`Custo Total: $${totalCost.toFixed(4)}`);
        } catch (err) {
            logger.error(`❌ Erro Status: ${err.message}`);
        }
    });

// ─── Command: Check APIs ───
program
    .command('check')
    .description('Health check - Verifica se as chaves de API estão configuras')
    .action(() => {
        logger.info(`\n🔍 Resumo de APIs (.env):`);
        logger.info(`Supabase API: ${process.env.SUPABASE_URL ? '✅ Ok' : '❌ Falta SUPABASE_URL'}`);
        logger.info(`OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Ok' : '❌ Falta OPENAI_API_KEY'}`);
        logger.info(`Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Ok' : '⚠️ Falta (Opcional)'}`);
        logger.info(`Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Ok' : '⚠️ Falta (Opcional)'}`);
        logger.info(`Fal.ai API: ${process.env.FAL_API_KEY ? '✅ Ok' : '❌ Falta FAL_API_KEY'}`);
        logger.info(`ElevenLabs API: ${process.env.ELEVENLABS_API_KEY ? '✅ Ok' : '❌ Falta ELEVENLABS_API_KEY'}`);
        logger.info(`Google Drive (Client ID): ${process.env.GOOGLE_CLIENT_ID ? '✅ Ok' : '❌ Falta GOOGLE_CLIENT_ID'}`);
        logger.info(`Google Folder ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅ Ok' : '❌ Falta GOOGLE_DRIVE_FOLDER_ID'}`);
    });

// ─── Command: Google Drive Login Setup ───
program
    .command('gdrive-auth')
    .description('Inicia o servidor local para obter o token do Google Drive')
    .action(async () => {
        try {
            const token = await runAuthServer();
            logger.info(`\n✅ Autenticação concluída! Copie a linha abaixo para o seu config/.env:`);
            logger.info(`GOOGLE_REFRESH_TOKEN="${token}"\n`);
            process.exit(0);
        } catch (err) {
            logger.error(`❌ Erro de Autenticação: ${err.message}`);
            process.exit(1);
        }
    });

program.parse();
