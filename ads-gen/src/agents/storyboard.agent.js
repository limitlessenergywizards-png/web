import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger.js';
import { callAI } from '../utils/ai-provider.js';
import { withRetry } from '../utils/retry.js';
import { buscarBriefing, listarCenas, atualizarCena, logFase, inserirPrompt } from '../db/dal.js';
import { SYSTEM_PROMPT_STORYBOARD } from '../templates/storyboard.prompt.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const StoryboardOutputSchema = z.object({
    acao_principal: z.string(),
    expressao_sentimento: z.string(),
    ambiente_iluminacao: z.string(),
    detalhes_realismo: z.array(z.string()),
    movimento_camera: z.string(),
    prompt_imagem_base: z.string(),
    prompt_animacao_base: z.string()
});

export const storyboardAgent = {
    async generate(briefingId) {
        logger.info(`Starting Storyboard Agent for Briefing ${briefingId}`, { phase: 'STORYBOARD_START' });
        const startTime = Date.now();

        try {
            const briefing = await buscarBriefing(briefingId);
            await logFase({
                projeto_id: briefing.projeto_id,
                briefing_id: briefingId,
                fase: 'storyboard',
                status: 'iniciado'
            });

            const cenas = await listarCenas(briefingId);

            if (!cenas || cenas.length === 0) {
                throw new Error("Não existem cenas para este briefing. Parseie o copy primeiro.");
            }

            const resultados = [];

            for (const cena of cenas) {
                logger.info(`Imagining visual scene [${cena.tipo.toUpperCase()}] ID: ${cena.id}`, { phase: 'STORYBOARD_IMAGINE' });

                const inputContext = `
CENA TIPO: ${cena.tipo.toUpperCase()}
DURAÇÃO: ${cena.duracao_segundos}s
SENTIMENTO EXPECTADO: ${cena.sentimento}
DESCRIÇÃO PRÉVIA: ${cena.descricao_visual}
        `;

                const outputText = await withRetry(
                    () => callAI({
                        systemPrompt: SYSTEM_PROMPT_STORYBOARD,
                        userMessage: `Gere a cinematografia para a seguinte cena, retornando APENAS JSON:\n${inputContext}`,
                        maxTokens: 1200,
                        temperature: 0.7
                    }),
                    3, 2000, 'Storyboard AI Call'
                );

                const jsonMatch = outputText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Could not extract JSON from AI response");

                const parsedData = JSON.parse(jsonMatch[0]);
                const validatedData = StoryboardOutputSchema.parse(parsedData);

                // Update scene with the new complex JSON structure
                await atualizarCena(cena.id, {
                    descricao_visual: JSON.stringify(validatedData)
                });

                // Infer visual category from the AI's acao_principal
                const acaoLower = validatedData.acao_principal.toLowerCase();
                const CATEGORIA_MAP = [
                    { words: ['sorri', 'sorriso', 'smile', 'ri'], cat: 'sorriso' },
                    { words: ['olha', 'olhar', 'look', 'mira', 'eyes'], cat: 'olhar' },
                    { words: ['caminh', 'anda', 'walk', 'passos'], cat: 'caminhada' },
                    { words: ['chora', 'lágrima', 'cry', 'tear'], cat: 'emocao' },
                    { words: ['fala', 'conversa', 'talk', 'speak'], cat: 'fala' },
                    { words: ['toca', 'pega', 'segura', 'hold', 'touch'], cat: 'toque' },
                    { words: ['espelho', 'mirror', 'reflexo'], cat: 'espelho' },
                    { words: ['suspira', 'respira', 'sigh', 'breath'], cat: 'suspiro' },
                ];
                const matched = CATEGORIA_MAP.find(c => c.words.some(w => acaoLower.includes(w)));
                const categoria = matched?.cat || cena.sentimento?.toLowerCase().trim() || 'geral';

                try {
                    await inserirPrompt({
                        tipo: 'animacao',
                        categoria: categoria,
                        nome: `Animação ${cena.tipo} (${categoria})`,
                        prompt_texto: validatedData.prompt_animacao_base
                    });
                } catch (promptErr) {
                    logger.warn(`Could not save prompt to library: ${promptErr.message}`, { phase: 'STORYBOARD_DB_WARN' });
                }

                resultados.push(validatedData);
            }

            await logFase({
                projeto_id: briefing.projeto_id,
                briefing_id: briefingId,
                fase: 'storyboard',
                status: 'concluido',
                duracao_ms: Date.now() - startTime
            });

            logger.info(`Storyboard Agent finished. ${resultados.length} scenes updated.`, { phase: 'STORYBOARD_SUCCESS' });
            return resultados;

        } catch (error) {
            logger.error(`Storyboard Agent failed: ${error.message}`, { phase: 'STORYBOARD_ERROR' });
            await logFase({
                projeto_id: null,
                briefing_id: briefingId,
                fase: 'storyboard',
                status: 'erro',
                erro_mensagem: error.message,
                duracao_ms: Date.now() - startTime
            }).catch(e => logger.error(`Failed to write error log: ${e.message}`, { phase: 'STORYBOARD_FATAL' }));
            throw error;
        }
    }
};
