import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../../../utils/logger.js';
import { callAI } from '../../../utils/ai-provider.js';
import { atualizarBriefing, criarCenas } from '../../../infrastructure/database/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// Zod schema exactly matching User requirements
const ParsedCopySchema = z.object({
    hooks: z.array(z.object({
        numero: z.number(),
        texto: z.string(),
        duracao_estimada: z.number()
    })).length(3),
    body: z.object({
        texto: z.string(),
        duracao_estimada: z.number()
    }),
    sentimentos_por_frase: z.array(z.object({
        frase: z.string(),
        sentimento: z.string(),
        intensidade: z.number().min(0).max(10)
    })),
    cenas_criticas: z.array(z.string()),
    publico_inferido: z.object({
        idade_media: z.number(),
        genero: z.string(),
        dores: z.array(z.string()),
        desejos: z.array(z.string())
    })
});

const SYSTEM_PROMPT = `Você é um diretor de criativos especializado em vídeo marketing de resposta direta (UGC e Ads).
Sua tarefa é analisar o copy (roteiro) que será fornecido pelo usuário e quebrar ele estruturalmente para um sistema automatizado.

O copy contém:
- 3 Variações do Início (Hooks) - pegue os 3 primeiros trechos impactantes.
- 1 Corpo Principal (Body) - pegue o resto do texto de argumentação.

Você deve OBRIGATORIAMENTE retornar um JSON válido seguindo a estrutura exata abaixo, sem explicações:
{
  "hooks": [{"numero": 1, "texto": "...", "duracao_estimada": 5}, {"numero": 2, "texto": "...", "duracao_estimada": 5}, {"numero": 3, "texto": "...", "duracao_estimada": 5}],
  "body": {"texto": "...", "duracao_estimada": 45},
  "sentimentos_por_frase": [{"frase": "...", "sentimento": "desejo|dor|solucao|prova", "intensidade": 0}],
  "cenas_criticas": ["descrição da cena obrigatória 1", "..."],
  "publico_inferido": {"idade_media": 40, "genero": "feminino", "dores": ["..."], "desejos": ["..."]}
}

Estimativa de duração: A cada palavra, calcule aprox. 0.3 a 0.5 segundos de narração em ritmo dinâmico de anúncios.`;

export async function parseCopy(briefingId, copyText) {
    logger.info(`Starting Copy Parsing for briefing: ${briefingId}`, { phase: 'PARSER' });

    try {
        const outputText = await callAI({
            systemPrompt: SYSTEM_PROMPT,
            userMessage: `Analise este Copy de Vídeo e retorne o JSON estruturado:\n\n${copyText}`,
            maxTokens: 2000,
            temperature: 0.2
        });

        // Attempt to extract JSON
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not extract JSON from AI response");

        const parsedData = JSON.parse(jsonMatch[0]);

        // Validate with Zod
        const validatedData = ParsedCopySchema.parse(parsedData);
        logger.info(`Copy structured successfully via AI fallback`, { phase: 'PARSER_SUCCESS' });

        // DB Operations: Update Briefing
        await atualizarBriefing(briefingId, {
            copy_parseada: validatedData,
            status: 'processando'
        });
        logger.info(`Briefing ${briefingId} updated with JSON representation.`, { phase: 'DB_UPDATE' });

        // DB Operations: Create Scenes
        const cenasHook = validatedData.hooks.map((h, i) => ({
            tipo: 'hook',
            ordem: i + 1,
            descricao_visual: validatedData.cenas_criticas[i] || "Visual relacionado ao hook",
            sentimento: validatedData.sentimentos_por_frase.find(s => s.frase.includes(h.texto.substring(0, 15)))?.sentimento || "dor",
            duracao_segundos: h.duracao_estimada
        }));

        const cenaBody = {
            tipo: 'body',
            ordem: 99,
            descricao_visual: validatedData.cenas_criticas.slice(3).join(', ') || "Cenário de desenvolvimento padrão",
            sentimento: 'solucao',
            duracao_segundos: validatedData.body.duracao_estimada
        };

        const todasAsCenas = [...cenasHook, cenaBody];
        await criarCenas(briefingId, todasAsCenas);
        logger.info(`${todasAsCenas.length} scenes successfully recorded for briefing ${briefingId}`, { phase: 'DB_INSERT' });

        return validatedData;

    } catch (err) {
        logger.error(`Parser failed: ${err.message}`, { phase: 'PARSER_ERROR' });
        throw err;
    }
}
