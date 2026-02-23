import fs from 'fs';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { criarProjeto, criarBriefing, listarCenas, buscarBriefing } from './src/db/dal.js';
import { parseCopy } from './src/tools/copy-parser.js';

async function runTest() {
    logger.info("Initializing Copy Parser Test Pipeline...", { phase: "TEST_START" });

    try {
        // 1. Setup Mock Data (Project + Empty Briefing)
        logger.info("1. Creating Mock Project & Briefing in Supabase", { phase: "TEST_SETUP" });
        const projeto = await criarProjeto({
            nome: "Teste Funcional - Nutrição 40+",
            produto: "Queimador de Gordura Feminino",
            idioma: "es"
        });

        const copyTextPath = path.join(process.cwd(), 'data', 'inputs', 'exemplo-copy.txt');
        const copyText = fs.readFileSync(copyTextPath, 'utf8');

        const briefing = await criarBriefing({
            projeto_id: projeto.id,
            copy_original: copyText
        });

        logger.info(`Mock Briefing Created. ID: ${briefing.id}`, { phase: "TEST_SETUP" });

        // 2. Run the Parser Tool (Anthropic)
        logger.info("2. Triggering Claude-3.5-Sonnet Copy Parser", { phase: "TEST_EXECUTION" });

        // Check if API key is present
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === '') {
            logger.warn("⚠️ ANTHROPIC_API_KEY is not defined in config/.env. The AI call will fail.", { phase: "TEST_API_CHECK" });
            logger.warn("Please add your actual Anthropic API Key to config/.env and run again.", { phase: "TEST_API_CHECK" });
        }

        const parsedData = await parseCopy(briefing.id, copyText);

        logger.info("3. Claude successfully parsed the data. Raw Output:", { phase: "TEST_VALIDATION" });
        console.log(JSON.stringify(parsedData, null, 2));

        // 3. Verify Database Insertions
        logger.info("4. Verifying DB Record updates", { phase: "TEST_VERIFICATION" });

        const dbBriefing = await buscarBriefing(briefing.id);
        const dbCenas = await listarCenas(briefing.id);

        console.log("\n==============================");
        console.log("✅ SUPABASE VALIDATION REPORT ✅");
        console.log("==============================");
        console.log(`Briefing Status: ${dbBriefing.status}`);
        console.log(`Hooks Extracted to DB Scenes: ${dbCenas.filter(c => c.tipo === 'hook').length}`);
        console.log(`Body Extracted to DB Scenes: ${dbCenas.filter(c => c.tipo === 'body').length}`);
        console.log(`Total Cenas Criadas: ${dbCenas.length}`);

        console.log("\nCENAS NO SUPABASE:");
        dbCenas.forEach(c => {
            console.log(`- [${c.tipo.toUpperCase()}] Ordem: ${c.ordem} | Duração: ${c.duracao_segundos}s | Emoção: ${c.sentimento}`);
            console.log(`  Descrição: ${c.descricao_visual}\n`);
        });

    } catch (error) {
        logger.error(`Test Execution Failed: ${error.message}`, { phase: "TEST_ERROR" });
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runTest();
