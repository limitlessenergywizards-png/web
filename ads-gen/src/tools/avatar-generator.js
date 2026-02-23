import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger.js';
import { callAI } from '../utils/ai-provider.js';
import { logApiUsage } from '../db/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. Describe Reference Image (Gemini Vision)
// ==========================================
export async function describeImage(imageUrl) {
    logger.info(`Describing reference image with Gemini Vision...`, { phase: 'AVATAR_DESCRIBE' });
    const startTime = Date.now();

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: await fetchImageAsBase64(imageUrl)
                }
            },
            `Descreva esta pessoa com precisão fotográfica para recriação por IA. 
Inclua OBRIGATORIAMENTE:
- Idade estimada (ex: "mulher de 42 anos")
- Etnia/tom de pele (ex: "latina, pele morena clara")
- Tipo físico (ex: "magra, ombros estreitos")
- Cabelo (cor, comprimento, estilo, textura)
- Expressão facial (ex: "sorriso leve, olhos cansados")
- Roupa (cor, estilo, estado)
- Iluminação visível (ex: "luz natural de janela, sombras suaves")
- Ambiente de fundo (ex: "sala de estar, sofá bege")

Retorne APENAS a descrição em texto corrido, sem tópicos, sem markdown.`
        ]);

        const description = result.response.text();
        const elapsed = Date.now() - startTime;

        await logApiUsage({
            provider: 'gemini', modelo: 'gemini-2.0-flash', tipo_operacao: 'vision_describe',
            custo_usd: 0.001, duracao_geracao_ms: elapsed, status: 'sucesso',
            prompt_usado: 'Describe person for avatar recreation'
        }).catch(() => { });

        logger.info(`Image described in ${elapsed}ms`, { phase: 'AVATAR_DESCRIBE_OK' });
        return description;

    } catch (err) {
        logger.error(`Image description failed: ${err.message}`, { phase: 'AVATAR_DESCRIBE_ERR' });
        throw err;
    }
}

// ==========================================
// 2. Build Optimized Avatar Prompt (via LLM)
// ==========================================
const AVATAR_TYPES = {
    principal: 'The main character/protagonist of the ad, speaking directly to camera',
    marido: 'The supportive husband/partner, warm and caring expression',
    medico: 'A doctor or health professional, white coat, confident but approachable',
    amiga: 'A close friend, relatable, casual clothes, empathetic expression'
};

const AVATAR_PROMPT_SYSTEM = `Você é um especialista em prompts de geração de imagem fotorrealista.
Sua missão: transformar uma descrição de pessoa em um prompt otimizado para Gemini Imagen / Flux.

REGRAS OBRIGATÓRIAS no prompt gerado:
- Incluir: "natural", "photorealistic", "candid", "slight skin imperfections", "natural lighting", "textured skin"
- Incluir: poros visíveis, pequenas rugas naturais, cabelo com fios soltos
- PROIBIDO no prompt: "perfect", "studio", "flawless", "smooth skin", "airbrushed", "3D render"
- Ambientes mundanos: sala de casa, cozinha, carro, escritório
- Câmera: "shot on iPhone", "shallow depth of field", "slight motion blur"

O prompt deve ser em INGLÊS, ter entre 100 e 200 palavras, e ser uma descrição única fluida.
Retorne APENAS o prompt, sem explicações, sem títulos, sem markdown.`;

export async function buildAvatarPrompt(descricao, tipoAvatar = 'principal') {
    logger.info(`Building avatar prompt for type: ${tipoAvatar}`, { phase: 'AVATAR_PROMPT' });

    const roleContext = AVATAR_TYPES[tipoAvatar] || AVATAR_TYPES.principal;

    const result = await callAI({
        systemPrompt: AVATAR_PROMPT_SYSTEM,
        userMessage: `Descrição da pessoa:\n${descricao}\n\nPapel no criativo: ${roleContext}\n\nCrie o prompt de geração de imagem fotorrealista.`,
        maxTokens: 500,
        temperature: 0.6
    });

    logger.info(`Avatar prompt built (${result.length} chars)`, { phase: 'AVATAR_PROMPT_OK' });
    return result.trim();
}

// ==========================================
// 3. Generate Avatar Image (FAL AI - Flux Pro)
// ==========================================
export async function generateAvatar(prompt) {
    logger.info(`Generating avatar image via FAL AI Flux...`, { phase: 'AVATAR_GENERATE' });
    const startTime = Date.now();

    try {
        const { fal } = await import('@fal-ai/client');
        fal.config({ credentials: process.env.FAL_API_KEY });

        const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
            input: {
                prompt: prompt,
                image_size: { width: 768, height: 1024 },
                num_images: 1,
                enable_safety_checker: false
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS' && update.logs) {
                    update.logs.forEach(log => logger.info(`  FAL: ${log.message}`, { phase: 'AVATAR_QUEUE' }));
                }
            }
        });

        const imageUrl = result.data?.images?.[0]?.url;
        if (!imageUrl) throw new Error('No image URL returned from FAL AI');

        // Download the image as buffer
        const { default: axios } = await import('axios');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const elapsed = Date.now() - startTime;

        await logApiUsage({
            provider: 'fal_ai', modelo: 'flux-pro/v1.1', tipo_operacao: 'image_generation',
            custo_usd: 0.05, duracao_geracao_ms: elapsed, status: 'sucesso',
            prompt_usado: prompt.substring(0, 500)
        }).catch(() => { });

        logger.info(`Avatar image generated in ${(elapsed / 1000).toFixed(1)}s (${buffer.length} bytes)`, { phase: 'AVATAR_GEN_OK' });
        return buffer;

    } catch (err) {
        logger.error(`FAL AI avatar gen failed: ${err.message}`, { phase: 'AVATAR_GEN_ERROR' });
        throw err;
    }
}

// ==========================================
// Helper: Fetch image URL as base64
// ==========================================
async function fetchImageAsBase64(url) {
    const { default: axios } = await import('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data).toString('base64');
}
