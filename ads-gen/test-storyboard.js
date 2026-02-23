import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing, listarCenas } from './src/db/dal.js';
import { storyboardAgent } from './src/agents/storyboard.agent.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runTest() {
    logger.info("Initializing Storyboard Agent Test...", { phase: "TEST_START" });

    try {
        const briefing = await buscarUltimoBriefing();
        if (!briefing) {
            throw new Error("Nenhum briefing encontrado na DB. Rode test-parser.js primeiro com uma CHAVE VÁLIDA da Anthropic.");
        }

        logger.info(`Targeting Latest Briefing ID: ${briefing.id}`, { phase: "TEST_SETUP" });

        // Verify key presence
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '' || process.env.ANTHROPIC_API_KEY === 'sua_chave_anthropic_aqui') {
            logger.error("🛑 ANTHROPIC_API_KEY is missing or invalid in config/.env.", { phase: "TEST_API_CHECK" });
            logger.error("🛑 Please add it before running tests that hit Claude.", { phase: "TEST_API_CHECK" });
            process.exit(1);
        }

        logger.info("Executing the Claude Storyboard Generator...", { phase: "TEST_EXECUTION" });
        const resultados = await storyboardAgent.generate(briefing.id);

        logger.info("✅ Storyboard completed successfully! Validating Supabase persistence...", { phase: "TEST_VALIDATION" });

        const cenasConfirmadas = await listarCenas(briefing.id);

        for (const cena of cenasConfirmadas) {
            console.log(`\n===========================================`);
            console.log(`🎬 CENA [${cena.tipo.toUpperCase()}] Ordem ${cena.ordem} - DB ID: ${cena.id}`);
            console.log(`===========================================`);
            try {
                // It was saved as JSON string
                const parsed = JSON.parse(cena.descricao_visual);
                console.log(`Ação: ${parsed.acao_principal}`);
                console.log(`Câmera: ${parsed.movimento_camera}`);
                console.log(`Prompt Animação: ${parsed.prompt_animacao_base}`);
            } catch (e) {
                console.log(`Raw Desc: ${cena.descricao_visual}`);
            }
        }

    } catch (error) {
        logger.error(`Test Execution Failed: ${error.message}`, { phase: "TEST_ERROR" });
    } finally {
        process.exit(0);
    }
}

runTest();
