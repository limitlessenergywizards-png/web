import dotenv from 'dotenv';
import path from 'path';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing, listarCenas, listarAvatares, salvarVideo, atualizarStatusVideo, logFase } from './src/infrastructure/database/dal.js';
import { animateImage, animateText } from './src/tools/video-animator.js';
import { selectVideo } from './src/tools/video-selector.js';
import { uploadVideo } from './src/infrastructure/storage/storage-uploader.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runTest() {
    logger.info("Initializing Animation Test (1 scene, 2 variations)...", { phase: "TEST_START" });

    try {
        const briefing = await buscarUltimoBriefing();
        if (!briefing) throw new Error("No briefing found. Run test-parser.js first.");

        logger.info(`Briefing: ${briefing.id}`, { phase: "TEST_SETUP" });

        // Get first scene + avatar
        const cenas = await listarCenas(briefing.id);
        const cena = cenas[0]; // first hook
        const avatares = await listarAvatares(true);
        const avatar = avatares.find(a => a.briefing_id === briefing.id) || avatares[0];

        // Extract prompt
        let prompt = '';
        try {
            const storyData = JSON.parse(cena.descricao_visual);
            prompt = storyData.prompt_animacao_base || `Person talking to camera with ${cena.sentimento} expression`;
        } catch {
            prompt = `Person talking naturally to camera, ${cena.sentimento} expression, UGC style, handheld, candid`;
        }

        logger.info(`Scene: [${cena.tipo.toUpperCase()} ${cena.ordem}] | Avatar: ${avatar?.nome || 'none'}`, { phase: "TEST_SCENE" });
        logger.info(`Prompt: ${prompt.substring(0, 100)}...`, { phase: "TEST_PROMPT" });

        // Generate 2 variations
        const variations = [];
        for (let v = 1; v <= 2; v++) {
            logger.info(`\n--- Generating v${v} ---`, { phase: "TEST_GEN" });

            const videoRecord = await salvarVideo({
                cena_id: cena.id, avatar_id: avatar?.id || null,
                tipo: `animacao_v${v}`, provider: 'pending',
                prompt_usado: prompt, duracao_segundos: 5,
                resolucao: '720p', status: 'gerando', modelo_usado: 'pending'
            });

            try {
                let result;
                const context = { briefingId: briefing.id, cenaId: cena.id, projetoId: briefing.projeto_id };

                if (avatar?.imagem_url?.startsWith('http')) {
                    // Download avatar locally first
                    const { default: axios } = await import('axios');
                    const { default: fs } = await import('fs-extra');
                    const avatarDir = path.join(process.cwd(), 'data', 'avatars');
                    await fs.ensureDir(avatarDir);
                    const avatarPath = path.join(avatarDir, `${avatar.id}.png`);
                    if (!(await fs.pathExists(avatarPath))) {
                        const resp = await axios.get(avatar.imagem_url, { responseType: 'arraybuffer' });
                        await fs.writeFile(avatarPath, Buffer.from(resp.data));
                    }
                    result = await animateImage(avatarPath, prompt, 5, context);
                } else {
                    result = await animateText(prompt, 5, context);
                }

                await atualizarStatusVideo(videoRecord.id, 'pronto', result.path);

                variations.push({
                    videoId: videoRecord.id, path: result.path,
                    provider: result.provider, variation: `v${v}`,
                    tipo: cena.tipo, ordem: cena.ordem, cost: result.cost
                });
            } catch (genErr) {
                logger.error(`v${v} failed: ${genErr.message}`, { phase: "TEST_GEN_ERR" });
                await atualizarStatusVideo(videoRecord.id, 'erro', null);
            }
        }

        // Selection
        if (variations.length > 0) {
            logger.info(`\n--- Selection Phase ---`, { phase: "TEST_SELECT" });
            const selected = await selectVideo(variations, 'auto');

            // Upload selected to Storage
            if (selected) {
                const fileName = `${cena.tipo}_${cena.ordem}_${selected.variation}_selected.mp4`;
                try {
                    const uploaded = await uploadVideo(selected.path, `${briefing.id}/${fileName}`);
                    selected.storageUrl = uploaded.url;
                } catch (e) {
                    logger.warn(`Upload failed: ${e.message}`, { phase: "TEST_UPLOAD" });
                }
            }

            console.log("\n======================================");
            console.log("🎬 ANIMATION TEST REPORT 🎬");
            console.log("======================================");
            console.log(`Scene: [${cena.tipo.toUpperCase()} ${cena.ordem}]`);
            console.log(`Avatar: ${avatar?.nome || 'N/A'}`);
            console.log(`Variations generated: ${variations.length}`);
            variations.forEach(v => {
                const isSelected = v.variation === selected?.variation ? ' ← SELECTED' : '';
                console.log(`  ${v.variation}: ${v.path} (${v.provider}) $${(v.cost || 0).toFixed(3)}${isSelected}`);
            });
            if (selected?.storageUrl) {
                console.log(`\n📤 Storage URL: ${selected.storageUrl}`);
            }
            console.log(`Total cost: $${variations.reduce((s, v) => s + (v.cost || 0), 0).toFixed(3)}`);
        }

    } catch (error) {
        logger.error(`Animation Test Failed: ${error.message}`, { phase: "TEST_ERROR" });
        if (error.stack) console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runTest();
