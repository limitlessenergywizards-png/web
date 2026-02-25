import dotenv from 'dotenv';
import path from 'path';
import PQueue from 'p-queue';
import { logger } from '../../../utils/logger.js';
import { buscarBriefing, listarCenas, listarAvatares, salvarVideo, atualizarStatusVideo, logFase } from '../../../infrastructure/database/dal.js';
import { animateImage, animateText } from './video-animator.js';
import { selectVideo } from '../../assembly/video-selector.js';
import { uploadVideo } from '../../../infrastructure/storage/storage-uploader.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

export const animationAgent = {
    /**
     * Animate all scenes for a briefing
     * @param {string} briefingId
     * @param {Object} opts - { concurrency, duracao, selectionMode }
     */
    async animate(briefingId, opts = {}) {
        const { concurrency = 2, duracao = 5, selectionMode = 'auto' } = opts;
        logger.info(`Starting Animation Agent for Briefing ${briefingId}`, { phase: 'ANIM_AGENT_START' });
        const startTime = Date.now();
        let totalCost = 0;

        try {
            const briefing = await buscarBriefing(briefingId);
            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'animacao_v2', status: 'iniciado'
            });

            const cenas = await listarCenas(briefingId);
            if (!cenas?.length) throw new Error('No scenes found. Run parser first.');

            // Get available avatars
            const avatares = await listarAvatares(true);
            const mainAvatar = avatares.find(a => a.briefing_id === briefingId) || avatares[0];

            logger.info(`Scenes: ${cenas.length} | Avatar: ${mainAvatar?.nome || 'none'} | Concurrency: ${concurrency}`, { phase: 'ANIM_SETUP' });

            // Build animation jobs
            const jobs = [];
            for (const cena of cenas) {
                // Extract animation prompt from storyboard data
                let prompt = '';
                try {
                    const storyData = JSON.parse(cena.descricao_visual);
                    prompt = storyData.prompt_animacao_base || storyData.prompt_imagem_base || '';
                } catch {
                    prompt = cena.descricao_visual || `Person with ${cena.sentimento} expression talking to camera`;
                }

                if (!prompt) continue;

                // 2 variations per scene (v1 + v2)
                for (let v = 1; v <= 2; v++) {
                    jobs.push({ cena, prompt, variation: v });
                }
            }

            logger.info(`Total jobs: ${jobs.length} (${cenas.length} scenes × 2 variations)`, { phase: 'ANIM_JOBS' });

            // Execute with p-queue
            const queue = new PQueue({ concurrency });
            const allResults = {};

            const processJob = async ({ cena, prompt, variation }) => {
                const varLabel = `v${variation}`;
                logger.info(`[${cena.tipo.toUpperCase()} ${cena.ordem}] ${varLabel} — Starting`, { phase: 'ANIM_JOB' });

                // Create pending record
                const videoRecord = await salvarVideo({
                    cena_id: cena.id,
                    avatar_id: mainAvatar?.id || null,
                    tipo: `animacao_${varLabel}`,
                    provider: 'pending',
                    prompt_usado: prompt.substring(0, 500),
                    duracao_segundos: duracao,
                    resolucao: '1080p',
                    status: 'gerando',
                    modelo_usado: 'pending'
                });

                try {
                    let result;
                    const context = {
                        briefingId, cenaId: cena.id, projetoId: briefing.projeto_id, assetId: videoRecord.id
                    };

                    // If we have an avatar image, use image-to-video
                    if (mainAvatar?.imagem_path || mainAvatar?.imagem_url) {
                        // Download avatar if needed for local path
                        const avatarPath = await getAvatarLocalPath(mainAvatar);
                        result = await animateImage(avatarPath, prompt, duracao, context);
                    } else {
                        // Text-to-video fallback
                        result = await animateText(prompt, duracao, context);
                    }

                    // Update DB
                    await atualizarStatusVideo(videoRecord.id, 'pronto', result.path);

                    // Track cost
                    totalCost += result.cost || 0;

                    const entry = {
                        videoId: videoRecord.id, path: result.path,
                        provider: result.provider, variation: varLabel,
                        cena: cena.id, tipo: cena.tipo, ordem: cena.ordem,
                        cost: result.cost, elapsed: result.elapsed
                    };

                    if (!allResults[cena.id]) allResults[cena.id] = [];
                    allResults[cena.id].push(entry);

                } catch (err) {
                    logger.error(`[${cena.tipo.toUpperCase()} ${cena.ordem}] ${varLabel} — Failed: ${err.message}`, { phase: 'ANIM_JOB_ERROR' });
                    await atualizarStatusVideo(videoRecord.id, 'erro', null).catch(() => { });
                    throw err; // STRICT: Reject the promise so p-queue propagates the failure upwards to the batch processor
                }
            };

            // Add all jobs to queue
            const promises = jobs.map(job => queue.add(() => processJob(job)));
            await Promise.all(promises);

            // Selection phase — pick best variation per scene
            logger.info(`Selection phase: picking best variation per scene`, { phase: 'ANIM_SELECT' });
            const selectedVideos = [];

            for (const [cenaId, variations] of Object.entries(allResults)) {
                const selected = await selectVideo(variations, selectionMode);
                if (selected) {
                    // Upload selected to Supabase Storage
                    try {
                        const fileName = `${selected.tipo}_${selected.ordem}_${selected.variation}.mp4`;
                        const uploaded = await uploadVideo(selected.path, `${briefingId}/${fileName}`);
                        selected.storageUrl = uploaded.url;
                    } catch (uploadErr) {
                        logger.warn(`Storage upload failed for ${selected.path}: ${uploadErr.message}`, { phase: 'ANIM_UPLOAD_WARN' });
                    }
                    selectedVideos.push(selected);
                }
            }

            const elapsed = Date.now() - startTime;
            await logFase({
                projeto_id: briefing.projeto_id, briefing_id: briefingId,
                fase: 'animacao_v2', status: 'concluido', duracao_ms: elapsed,
                detalhes: {
                    total_jobs: jobs.length, total_selected: selectedVideos.length,
                    custo_total: totalCost, providers_used: [...new Set(selectedVideos.map(s => s.provider))]
                }
            });

            logger.info(`Animation Agent complete. ${selectedVideos.length} selected. Cost: $${totalCost.toFixed(3)}. Time: ${(elapsed / 1000).toFixed(0)}s`, { phase: 'ANIM_AGENT_OK' });
            return selectedVideos;

        } catch (error) {
            logger.error(`Animation Agent failed: ${error.message}`, { phase: 'ANIM_AGENT_ERR' });
            await logFase({
                proyecto_id: null, briefing_id: briefingId,
                fase: 'animacao_v2', status: 'erro',
                erro_mensagem: error.message, duracao_ms: Date.now() - startTime
            }).catch(() => { });
            throw error;
        }
    }
};

/**
 * Get avatar as local file path (download from Storage if needed)
 */
async function getAvatarLocalPath(avatar) {
    const { default: fs } = await import('fs-extra');

    // Check if imagem_path is a local file
    if (avatar.imagem_path && !avatar.imagem_path.startsWith('avatares/')) {
        if (await fs.pathExists(avatar.imagem_path)) return avatar.imagem_path;
    }

    // Download from URL
    if (avatar.imagem_url && avatar.imagem_url.startsWith('http')) {
        const { default: axios } = await import('axios');
        const localDir = path.join(process.cwd(), 'data', 'avatars');
        await fs.ensureDir(localDir);
        const localPath = path.join(localDir, `${avatar.id}.png`);

        if (await fs.pathExists(localPath)) return localPath;

        const response = await axios.get(avatar.imagem_url, { responseType: 'arraybuffer' });
        await fs.writeFile(localPath, Buffer.from(response.data));
        logger.info(`Avatar downloaded: ${localPath}`, { phase: 'ANIM_AVATAR_DL' });
        return localPath;
    }

    throw new Error(`Cannot resolve avatar image for ${avatar.id}`);
}
