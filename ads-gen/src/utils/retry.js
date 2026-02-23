import { logger } from './logger.js';

/**
 * Execute a function with exponential backoff and 429 Retry-After handling.
 */
export async function withRetry(fn, maxTentativas = 3, delayInicial = 1000, contextName = 'Operação') {
    let tentativa = 1;

    while (tentativa <= maxTentativas) {
        try {
            return await fn();
        } catch (error) {
            const isRateLimit = error?.status === 429 || error?.response?.status === 429;
            let delay = delayInicial * Math.pow(2, tentativa - 1); // 1s, 2s, 4s...

            if (isRateLimit) {
                // Tenta extrair o header Retry-After
                const retryAfterHeader = error?.response?.headers?.['retry-after'] || error?.headers?.['retry-after'];
                if (retryAfterHeader) {
                    const parsed = parseInt(retryAfterHeader, 10);
                    if (!isNaN(parsed)) {
                        delay = parsed * 1000;
                    }
                }
                logger.warn(`[Retry] 🟡 Rate limit 429 encontrado em ${contextName}. Aguardando ${delay}ms...`);
            }

            if (tentativa === maxTentativas) {
                logger.error(`[Retry] ❌ ${contextName} falhou permanentemente após ${maxTentativas} tentativas. Erro: ${error.message}`);
                throw error;
            }

            logger.warn(`[Retry] 🔄 Falha em ${contextName} (Tentativa ${tentativa}/${maxTentativas}). Tentando em ${delay}ms... Erro: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            tentativa++;
        }
    }
}

/**
 * Executes a promise with a maximum timeout.
 */
export function withTimeout(promise, ms = 600000) { // Default 10 minutes
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout de fase crítico: Operação não concluída dentro de ${ms}ms.`));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        clearTimeout(timeoutId);
    });
}
