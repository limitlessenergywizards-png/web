import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger.js';
import { buscarBriefing, listarCenas, salvarAvatar, logFase } from '../../../infrastructure/database/dal.js';
import { buildAvatarPrompt, generateAvatar } from './avatar-generator.js';
import { buscarAvatarCompativel } from './avatar-matcher.js';
import { uploadAvatar } from '../../../infrastructure/storage/storage-uploader.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// Map sentimento / scene type to avatar roles
const ROLE_FROM_SCENE = {
    hook: 'principal',
    body: 'principal'
};

export const avatarAgent = {
    async generate(briefingId) {
        logger.info(`Starting Avatar Agent for Briefing ${briefingId}`, { phase: 'AVATAR_AGENT_START' });
        const startTime = Date.now();

        try {
            const briefing = await buscarBriefing(briefingId);
            await logFase({
                projeto_id: briefing.projeto_id,
                briefing_id: briefingId,
                fase: 'avatares',
                status: 'iniciado'
            });

            const cenas = await listarCenas(briefingId);
            if (!cenas || cenas.length === 0) {
                throw new Error('Nenhuma cena encontrada. Execute o parser primeiro.');
            }

            // Determine avatar needs from scenes
            const avatarNeeds = this._inferAvatarNeeds(cenas, briefing);
            logger.info(`Avatar needs: ${avatarNeeds.length} characters identified`, { phase: 'AVATAR_ANALYSIS' });

            const resultados = [];

            for (const need of avatarNeeds) {
                logger.info(`Processing avatar: "${need.nome}" (${need.tipo})`, { phase: 'AVATAR_PROCESS' });

                // 1. Check if a compatible avatar already exists
                const existing = await buscarAvatarCompativel(need.descricao, 70);
                if (existing) {
                    logger.info(`Reusing existing avatar: ${existing.nome} (${existing.id})`, { phase: 'AVATAR_REUSE' });
                    resultados.push({
                        id: existing.id, nome: existing.nome,
                        imagem_url: existing.imagem_url, reused: true
                    });
                    continue;
                }

                // 2. Build optimized prompt via LLM
                const prompt = await buildAvatarPrompt(need.descricao, need.tipo);

                // 3. Generate avatar image via FAL AI Flux
                const imageBuffer = await generateAvatar(prompt);

                // 4. Upload to Supabase Storage
                const fileName = `avatar_${need.tipo}_${uuidv4().substring(0, 8)}.png`;
                const upload = await uploadAvatar(imageBuffer, fileName);
                const imagemUrl = upload.url;
                const imagemPath = upload.path;

                // 5. Save to DB
                const avatarRecord = await salvarAvatar({
                    briefing_id: briefingId,
                    nome: need.nome,
                    descricao: need.descricao,
                    prompt_usado: prompt,
                    imagem_url: imagemUrl,
                    imagem_path: imagemPath,
                    reutilizavel: true
                });

                resultados.push({
                    id: avatarRecord.id, nome: need.nome,
                    imagem_url: imagemUrl, reused: false
                });
            }

            await logFase({
                projeto_id: briefing.projeto_id,
                briefing_id: briefingId,
                fase: 'avatares',
                status: 'concluido',
                duracao_ms: Date.now() - startTime,
                detalhes: {
                    total: resultados.length,
                    novos: resultados.filter(r => !r.reused).length,
                    reutilizados: resultados.filter(r => r.reused).length
                }
            });

            logger.info(`Avatar Agent complete. ${resultados.length} avatars processed.`, { phase: 'AVATAR_AGENT_OK' });
            return resultados;

        } catch (error) {
            logger.error(`Avatar Agent failed: ${error.message}`, { phase: 'AVATAR_AGENT_ERR' });
            await logFase({
                projeto_id: null, briefing_id: briefingId,
                fase: 'avatares', status: 'erro',
                erro_mensagem: error.message, duracao_ms: Date.now() - startTime
            }).catch(() => { });
            throw error;
        }
    },

    /**
     * Infer what avatars are needed based on scenes and briefing
     */
    _inferAvatarNeeds(cenas, briefing) {
        const needs = [];
        const publicoInferido = briefing.copy_parseada?.publico_inferido;

        // Primary avatar: always needed
        const mainDesc = publicoInferido
            ? `Mulher ${publicoInferido.genero === 'feminino' ? 'latina' : 'latino'} de ${publicoInferido.idade_media} anos, expressão natural e acessível, roupas casuais do dia a dia, ambiente de casa, iluminação natural de janela`
            : `Mulher latina de 40 anos, expressão natural, roupas casuais, ambiente de casa, iluminação natural`;

        needs.push({
            nome: 'Protagonista',
            tipo: 'principal',
            descricao: mainDesc
        });

        // Check if scenes suggest secondary characters
        const allDescriptions = cenas.map(c => (c.descricao_visual || '').toLowerCase()).join(' ');

        if (allDescriptions.includes('médic') || allDescriptions.includes('doctor') || allDescriptions.includes('especialista')) {
            needs.push({
                nome: 'Médica/Especialista',
                tipo: 'medico',
                descricao: 'Mulher médica de 45 anos, jaleco branco com estetoscópio, expressão confiante mas acessível, escritório médico simples, iluminação fluorescente natural'
            });
        }

        if (allDescriptions.includes('marid') || allDescriptions.includes('husband') || allDescriptions.includes('partner')) {
            needs.push({
                nome: 'Marido/Parceiro',
                tipo: 'marido',
                descricao: 'Homem latino de 42 anos, expressão carinhosa e preocupada, roupa casual de casa, sala de estar simples, iluminação quente de abajur'
            });
        }

        if (allDescriptions.includes('amig') || allDescriptions.includes('friend') || allDescriptions.includes('compañera')) {
            needs.push({
                nome: 'Amiga',
                tipo: 'amiga',
                descricao: 'Mulher latina de 38 anos, expressão empática e solidária, roupa casual colorida, sentada em café ou cozinha, luz natural do dia'
            });
        }

        return needs;
    }
};
