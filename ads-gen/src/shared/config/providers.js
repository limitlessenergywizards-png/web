/**
 * src/shared/config/providers.js
 * A única verdade sobre qual engine/AI usar por fase.
 * Remove os if/else hardcoded dentro dos agentes.
 */

export const PROVIDERS = {
    video: {
        default: process.env.VIDEO_PROVIDER_DEFAULT || 'kling-2.6-pro',
        fallback: 'wan-2.5',
        test: 'kling-v2-standard'
    },
    image: {
        default: 'gemini-1.5-pro',
        fallback: 'gemini-1.5-flash'
    },
    audio: {
        default: process.env.AUDIO_PROVIDER_DEFAULT || 'elevenlabs',
    }
};

/**
 * Resolve provider ID based on asset type and mode
 * @param {'video'|'audio'|'image'} tipoAsset 
 * @param {string} mode - 'default', 'fallback', 'test'
 * @returns {string} Provider ID
 */
export const RESOLVE_PROVIDER = (tipoAsset, mode = 'default') => {
    return PROVIDERS[tipoAsset][mode] || PROVIDERS[tipoAsset].default;
};
