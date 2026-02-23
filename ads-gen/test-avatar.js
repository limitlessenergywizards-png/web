import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing } from './src/db/dal.js';
import { avatarAgent } from './src/agents/avatar.agent.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runTest() {
    logger.info("Initializing Avatar Agent Test...", { phase: "TEST_START" });

    try {
        // 1. Check Gemini key
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.length < 10) {
            logger.error("🛑 GEMINI_API_KEY is missing. Add it to config/.env", { phase: "TEST_API_CHECK" });
            process.exit(1);
        }

        // 2. Get latest briefing
        const briefing = await buscarUltimoBriefing();
        if (!briefing) {
            throw new Error("Nenhum briefing encontrado. Rode test-parser.js primeiro.");
        }

        logger.info(`Targeting Briefing ID: ${briefing.id}`, { phase: "TEST_SETUP" });

        // 3. Run Avatar Agent
        logger.info("Running Avatar Agent...", { phase: "TEST_EXECUTION" });
        const results = await avatarAgent.generate(briefing.id);

        // 4. Report
        console.log("\n==============================");
        console.log("🎭 AVATAR GENERATION REPORT 🎭");
        console.log("==============================");
        results.forEach(r => {
            const status = r.reused ? '♻️  REUSED' : '✨ NEW';
            console.log(`\n${status} | ${r.nome}`);
            console.log(`   ID:  ${r.id}`);
            console.log(`   URL: ${r.imagem_url}`);
        });
        console.log(`\nTotal avatares: ${results.length}`);
        console.log(`Novos: ${results.filter(r => !r.reused).length}`);
        console.log(`Reutilizados: ${results.filter(r => r.reused).length}`);

    } catch (error) {
        logger.error(`Avatar Test Failed: ${error.message}`, { phase: "TEST_ERROR" });
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runTest();
