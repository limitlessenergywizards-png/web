import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger.js';
import { logApiUsage } from '../infrastructure/database/dal.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// Cost per 1M tokens (input / output)
const LLM_COSTS = {
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
};

const providers = [];

if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5) {
    providers.push({ name: 'anthropic', client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) });
}
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 5) {
    providers.push({ name: 'openai', client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) });
}
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
    providers.push({ name: 'gemini', client: new GoogleGenerativeAI(process.env.GEMINI_API_KEY) });
}

if (providers.length === 0) {
    logger.error('No AI provider API keys configured!', { phase: 'AI_PROVIDER' });
}

function estimateLLMCost(model, tokensIn, tokensOut) {
    const costs = LLM_COSTS[model];
    if (!costs) return 0;
    return (tokensIn / 1_000_000 * costs.input) + (tokensOut / 1_000_000 * costs.output);
}

export async function callAI({ systemPrompt, userMessage, maxTokens = 2000, temperature = 0.3, context = {} }) {
    for (const provider of providers) {
        try {
            logger.info(`Trying AI provider: ${provider.name}`, { phase: 'AI_PROVIDER' });
            const result = await callProvider(provider, { systemPrompt, userMessage, maxTokens, temperature, context });
            logger.info(`Success with provider: ${provider.name}`, { phase: 'AI_PROVIDER' });
            return result;
        } catch (err) {
            logger.warn(`Provider ${provider.name} failed: ${err.message}. Falling back...`, { phase: 'AI_FALLBACK' });
        }
    }
    throw new Error('All AI providers failed. Check your API keys and quotas.');
}

async function callProvider(provider, opts) {
    switch (provider.name) {
        case 'anthropic': return callAnthropic(provider.client, opts);
        case 'openai': return callOpenAI(provider.client, opts);
        case 'gemini': return callGemini(provider.client, opts);
        default: throw new Error(`Unknown provider: ${provider.name}`);
    }
}

async function callAnthropic(client, { systemPrompt, userMessage, maxTokens, temperature, context }) {
    const model = 'claude-sonnet-4-20250514';
    const startTime = Date.now();
    const response = await client.messages.create({
        model, max_tokens: maxTokens, temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
    });
    const elapsed = Date.now() - startTime;
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;
    const cost = estimateLLMCost(model, tokensIn, tokensOut);

    await logApiUsage({
        provider: 'anthropic', modelo: model, tipo_operacao: 'llm_chat',
        custo_usd: parseFloat(cost.toFixed(6)),
        tokens_input: tokensIn, tokens_output: tokensOut, tokens_total: tokensIn + tokensOut,
        duracao_geracao_ms: elapsed, prompt_usado: userMessage.substring(0, 500),
        status: 'sucesso', ...context
    }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

    return response.content[0].text;
}

async function callOpenAI(client, { systemPrompt, userMessage, maxTokens, temperature, context }) {
    const model = 'gpt-4o-mini';
    const startTime = Date.now();
    const response = await client.chat.completions.create({
        model, max_tokens: maxTokens, temperature,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }]
    });
    const elapsed = Date.now() - startTime;
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;
    const cost = estimateLLMCost(model, tokensIn, tokensOut);

    await logApiUsage({
        provider: 'openai', modelo: model, tipo_operacao: 'llm_chat',
        custo_usd: parseFloat(cost.toFixed(6)),
        tokens_input: tokensIn, tokens_output: tokensOut, tokens_total: tokensIn + tokensOut,
        duracao_geracao_ms: elapsed, prompt_usado: userMessage.substring(0, 500),
        status: 'sucesso', ...context
    }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

    return response.choices[0].message.content;
}

async function callGemini(client, { systemPrompt, userMessage, maxTokens, temperature, context }) {
    const modelName = 'gemini-2.0-flash';
    const startTime = Date.now();
    const model = client.getGenerativeModel({
        model: modelName, generationConfig: { maxOutputTokens: maxTokens, temperature }
    });
    const result = await model.generateContent(`${systemPrompt}\n\n---\n\n${userMessage}`);
    const elapsed = Date.now() - startTime;
    const usage = result.response.usageMetadata || {};
    const tokensIn = usage.promptTokenCount || 0;
    const tokensOut = usage.candidatesTokenCount || 0;
    const cost = estimateLLMCost(modelName, tokensIn, tokensOut);

    await logApiUsage({
        provider: 'gemini', modelo: modelName, tipo_operacao: 'llm_chat',
        custo_usd: parseFloat(cost.toFixed(6)),
        tokens_input: tokensIn, tokens_output: tokensOut, tokens_total: tokensIn + tokensOut,
        duracao_geracao_ms: elapsed, prompt_usado: userMessage.substring(0, 500),
        status: 'sucesso', ...context
    }).catch(e => logger.warn(`Cost log failed: ${e.message}`, { phase: 'COST_LOG' }));

    return result.response.text();
}

export default callAI;
