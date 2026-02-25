import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing, listarCenas } from './src/infrastructure/database/dal.js';
import { gerarVideoTexto, gerarVideosPorBriefing } from './src/tools/video-generator.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runTest() {
    logger.info("Initializing FAL AI Video Generation Test...", { phase: "TEST_START" });

    try {
        // 1. Check API Key
        if (!process.env.FAL_API_KEY || process.env.FAL_API_KEY.length < 10) {
            logger.error("🛑 FAL_API_KEY is missing. Add it to config/.env", { phase: "TEST_API_CHECK" });
            process.exit(1);
        }

        // 2. Quick single-video test to validate API connectivity
        logger.info("Running quick API validation with a single text-to-video...", { phase: "TEST_VALIDATE" });
        const quickTest = await gerarVideoTexto({
            prompt: "A latina woman in her 40s looking at camera with a warm smile, holding a product in her hand, natural light, handheld camera, UGC style, shot on iPhone, documentary look",
            duration: 5,
            aspectRatio: '9:16'
        });

        console.log("\n✅ FAL AI API Working! Quick test video URL:");
        console.log(`   ${quickTest.videoUrl}\n`);

        // 3. Get the latest briefing with parsed data
        const briefing = await buscarUltimoBriefing();
        if (!briefing) {
            throw new Error("Nenhum briefing encontrado. Rode test-parser.js primeiro.");
        }

        if (!briefing.copy_parseada) {
            logger.warn("Briefing sem copy_parseada. Gerando apenas com o teste rápido.", { phase: "TEST_WARN" });
            process.exit(0);
        }

        // 4. Check if scenes have storyboard data
        const cenas = await listarCenas(briefing.id);
        const hasStoryData = cenas.some(c => {
            try { JSON.parse(c.descricao_visual); return true; } catch { return false; }
        });

        if (!hasStoryData) {
            logger.warn("Scenes don't have storyboard data yet. Running video gen with default prompts.", { phase: "TEST_WARN" });
        }

        // 5. Generate videos for all scenes
        logger.info(`Generating videos for briefing ${briefing.id} (${cenas.length} scenes)...`, { phase: "TEST_EXECUTION" });
        const results = await gerarVideosPorBriefing(briefing.id, { duration: 5 });

        // 6. Report
        console.log("\n==============================");
        console.log("🎬 VIDEO GENERATION REPORT 🎬");
        console.log("==============================");
        results.forEach(r => {
            console.log(`🎥 [${r.tipo.toUpperCase()}] Cena: ${r.cena}`);
            console.log(`   Local: ${r.path}`);
            console.log(`   URL:   ${r.url}\n`);
        });
        console.log(`Total vídeos gerados: ${results.length}`);

    } catch (error) {
        logger.error(`Video Test Failed: ${error.message}`, { phase: "TEST_ERROR" });
        if (error.body) console.error("FAL Error Body:", error.body);
    } finally {
        process.exit(0);
    }
}

runTest();
