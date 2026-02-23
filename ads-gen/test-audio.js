import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing, listarCenas } from './src/db/dal.js';
import { listarVozes, gerarAudiosPorBriefing } from './src/tools/audio-generator.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runTest() {
    logger.info("Initializing ElevenLabs Audio Pipeline Test...", { phase: "TEST_START" });

    try {
        // 1. Check API Key
        if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.length < 10) {
            logger.error("🛑 ELEVENLABS_API_KEY is missing. Add it to config/.env", { phase: "TEST_API_CHECK" });
            process.exit(1);
        }

        // 2. List voices to help user choose and validate API
        logger.info("Fetching available ElevenLabs voices...", { phase: "TEST_VOICES" });
        const voices = await listarVozes();

        console.log("\n🎤 VOZES DISPONÍVEIS NA SUA CONTA ELEVENLABS:");
        console.log("================================================");
        voices.slice(0, 15).forEach(v => {
            console.log(`  ID: ${v.voice_id} | Nome: ${v.name} | Categoria: ${v.category}`);
        });
        console.log(`  ... Total: ${voices.length} vozes\n`);

        // 3. Get the latest briefing
        const briefing = await buscarUltimoBriefing();
        if (!briefing) {
            throw new Error("Nenhum briefing encontrado. Rode test-parser.js primeiro.");
        }

        if (!briefing.copy_parseada) {
            throw new Error("Briefing encontrado, mas copy_parseada está vazio. Rode test-parser.js primeiro com uma key de AI válida.");
        }

        logger.info(`Targeting Briefing ID: ${briefing.id}`, { phase: "TEST_SETUP" });

        // 4. Pick a voice — use the first Spanish-compatible voice or fallback
        let voiceId = process.env.ELEVENLABS_VOICE_ID;
        if (!voiceId) {
            // Auto-select a Spanish friendly female voice by name pattern
            const spanishVoice = voices.find(v =>
                v.name.toLowerCase().includes('charlotte') ||
                v.name.toLowerCase().includes('aria') ||
                v.name.toLowerCase().includes('rachel')
            );
            voiceId = spanishVoice?.voice_id || voices[0]?.voice_id;
            logger.info(`Auto-selected voice: ${voiceId}`, { phase: "TEST_VOICE_SELECT" });
        }

        // 5. Generate audios 
        logger.info("Running Audio Generation Pipeline...", { phase: "TEST_EXECUTION" });
        const results = await gerarAudiosPorBriefing(briefing.id, voiceId);

        // 6. Report
        console.log("\n==============================");
        console.log("✅ AUDIO GENERATION REPORT ✅");
        console.log("==============================");
        results.forEach(r => {
            console.log(`🔊 [${r.tipo.toUpperCase()}] Cena: ${r.cena} → ${r.path}`);
        });
        console.log(`\nTotal áudios gerados: ${results.length}`);

    } catch (error) {
        logger.error(`Audio Test Failed: ${error.message}`, { phase: "TEST_ERROR" });
    } finally {
        process.exit(0);
    }
}

runTest();
