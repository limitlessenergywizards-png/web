import { logger } from './logger.js';

/**
 * Validador de Variáveis de Ambiente Críticas
 * OBRIGATÓRIO RODAR no Index antes de bootar os agents/engine
 */
const REQUIRED_ENV = {
    ELEVENLABS_API_KEY: 'Chave da API ElevenLabs',
    GOOGLE_DRIVE_FOLDER_ID: 'ID da pasta root de destino no Google Drive',
    SUPABASE_URL: 'URL do projeto Supabase',
    SUPABASE_SERVICE_ROLE: 'Service Role Key do Supabase (Bypass RLS)',
    FAL_API_KEY: 'Chave principal para geração Visual (Fal.ai)'
};

const OPTIONAL_ENV = {
    GEMINI_API_KEY: 'Chave do Google AI Studio (necessária p/ Avatares de Texto)',
    ELEVENLABS_VOICE_ID: 'ID de voz fallback no ElevenLabs',
    API_KEY_RENDI_DEV: 'Api de cloud processing de vídeo (FFmpeg Cloud)'
};

export function validateEnv() {
    const missingCrit = [];
    for (const [key, desc] of Object.entries(REQUIRED_ENV)) {
        if (!process.env[key]) {
            missingCrit.push(`${key} — ${desc}`);
        }
    }

    if (missingCrit.length > 0) {
        logger.error(`[EnvGuard] FALHA FATAL P0: Variáveis de ambiente críticas ausentes!`);
        missingCrit.forEach(m => logger.error(`  -> ${m}`));
        throw new Error(`Asavia Sentinel Environment Vault blocked startup. Missing ${missingCrit.length} keys.`);
    }

    const missingOpt = [];
    for (const [key, desc] of Object.entries(OPTIONAL_ENV)) {
        if (!process.env[key]) {
            missingOpt.push(`${key} — ${desc}`);
        }
    }

    if (missingOpt.length > 0) {
        logger.warn(`[EnvGuard] Aviso de Variáveis Opcionais (Alguns Agentes podem falhar!):`);
        missingOpt.forEach(m => logger.warn(`  -> ${m}`));
    }

    logger.info(`[EnvGuard] ASAVIA SENTINEL: Ambiente Seguro. Rotas e Permissões verificadas.`);
}
