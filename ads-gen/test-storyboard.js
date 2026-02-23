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
            throw new Error("Nenhum briefing encontrado na DB. Rode test-parser.js primeiro.");
        }

        logger.info(`Targeting Latest Briefing ID: ${briefing.id}`, { phase: "TEST_SETUP" });

        // Check at least one AI provider is available
        const hasAI = (process.env.ANTHROPIC_API_KEY?.length > 5) ||
            (process.env.OPENAI_API_KEY?.length > 5) ||
            (process.env.GEMINI_API_KEY?.length > 5);
        if (!hasAI) {
            logger.error("🛑 No AI provider key found. Add ANTHROPIC, OPENAI or GEMINI key to config/.env.", { phase: "TEST_API_CHECK" });
            process.exit(1);
        }

        logger.info("Executing the Storyboard Agent (visual scene generation)...", { phase: "TEST_EXECUTION" });
        const resultados = await storyboardAgent.generate(briefing.id);

        logger.info("✅ Storyboard completed! Validating Supabase persistence...", { phase: "TEST_VALIDATION" });

        const cenasConfirmadas = await listarCenas(briefing.id);

        for (const cena of cenasConfirmadas) {
            console.log(`\n===========================================`);
            console.log(`🎬 CENA [${cena.tipo.toUpperCase()}] Ordem ${cena.ordem} - DB ID: ${cena.id}`);
            console.log(`===========================================`);
            try {
                const parsed = JSON.parse(cena.descricao_visual);
                console.log(`  Ação: ${parsed.acao_principal}`);
                console.log(`  Expressão: ${parsed.expressao_sentimento}`);
                console.log(`  Ambiente: ${parsed.ambiente_iluminacao}`);
                console.log(`  Câmera: ${parsed.movimento_camera}`);
                console.log(`  Detalhes Realismo: ${parsed.detalhes_realismo.join(' | ')}`);
                console.log(`  Prompt Imagem (Gemini): ${parsed.prompt_imagem_base.substring(0, 100)}...`);
                console.log(`  Prompt Animação (Helix): ${parsed.prompt_animacao_base.substring(0, 100)}...`);
                console.log(`  Chars Anim Prompt: ${parsed.prompt_animacao_base.length}/1700`);
            } catch (e) {
                console.log(`  Raw: ${cena.descricao_visual?.substring(0, 200)}`);
            }
        }

        console.log(`\n✅ Total cenas processadas: ${cenasConfirmadas.length}`);

    } catch (error) {
        logger.error(`Test Failed: ${error.message}`, { phase: "TEST_ERROR" });
    } finally {
        process.exit(0);
    }
}

runTest();
