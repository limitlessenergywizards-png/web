import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './logger.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// ==========================================
// Provider Initialization
// ==========================================
const providers = [];

if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5) {
    providers.push({
        name: 'anthropic',
        client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    });
}

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 5) {
    providers.push({
        name: 'openai',
        client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    });
}

if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
    providers.push({
        name: 'gemini',
        client: new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    });
}

if (providers.length === 0) {
    logger.error('No AI provider API keys configured!', { phase: 'AI_PROVIDER' });
}

// ==========================================
// Unified Call with Cascading Fallback
// ==========================================
/**
 * Calls an AI provider with cascading fallback.
 * @param {Object} options
 * @param {string} options.systemPrompt - The system instructions
 * @param {string} options.userMessage - The user's message
 * @param {number} [options.maxTokens=2000] - Max tokens to return
 * @param {number} [options.temperature=0.3] - Temperature
 * @returns {Promise<string>} - The raw text output from the AI
 */
export async function callAI({ systemPrompt, userMessage, maxTokens = 2000, temperature = 0.3 }) {
    for (const provider of providers) {
        try {
            logger.info(`Trying AI provider: ${provider.name}`, { phase: 'AI_PROVIDER' });
            const result = await callProvider(provider, { systemPrompt, userMessage, maxTokens, temperature });
            logger.info(`Success with provider: ${provider.name}`, { phase: 'AI_PROVIDER' });
            return result;
        } catch (err) {
            logger.warn(`Provider ${provider.name} failed: ${err.message}. Falling back...`, { phase: 'AI_FALLBACK' });
        }
    }
    throw new Error('All AI providers failed. Check your API keys and quotas.');
}

// ==========================================
// Per-Provider Implementation
// ==========================================
async function callProvider(provider, { systemPrompt, userMessage, maxTokens, temperature }) {
    switch (provider.name) {
        case 'anthropic':
            return callAnthropic(provider.client, { systemPrompt, userMessage, maxTokens, temperature });
        case 'openai':
            return callOpenAI(provider.client, { systemPrompt, userMessage, maxTokens, temperature });
        case 'gemini':
            return callGemini(provider.client, { systemPrompt, userMessage, maxTokens, temperature });
        default:
            throw new Error(`Unknown provider: ${provider.name}`);
    }
}

async function callAnthropic(client, { systemPrompt, userMessage, maxTokens, temperature }) {
    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
    });
    return response.content[0].text;
}

async function callOpenAI(client, { systemPrompt, userMessage, maxTokens, temperature }) {
    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ]
    });
    return response.choices[0].message.content;
}

async function callGemini(client, { systemPrompt, userMessage, maxTokens, temperature }) {
    const model = client.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { maxOutputTokens: maxTokens, temperature }
    });
    const result = await model.generateContent(`${systemPrompt}\n\n---\n\n${userMessage}`);
    return result.response.text();
}

export default callAI;
