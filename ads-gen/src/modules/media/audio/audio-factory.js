import { RESOLVE_PROVIDER } from '../../../shared/config/providers.js';
import { generateSpeech as elevenLabsGenerate } from './elevenlabs-client.js';

const ADAPTERS = {
    'elevenlabs': elevenLabsGenerate,
    'elevenlabs-multilingual-v2': elevenLabsGenerate,
};

/**
 * Generates speech using the configured audio provider.
 * @param {string} text 
 * @param {string} voiceId 
 * @param {string} mode - 'default'
 * @returns {Promise<{buffer: Buffer, chars: number, cost: number, elapsed: number}>}
 */
export async function generateSpeechFactory(text, voiceId, mode = 'default') {
    const providerId = RESOLVE_PROVIDER('audio', mode);
    const adapter = ADAPTERS[providerId];

    if (!adapter) {
        throw new Error(`Audio Provider Adapter not found for: ${providerId}`);
    }

    return await adapter(text, voiceId);
}

export default { generateSpeech: generateSpeechFactory };
