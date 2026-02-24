/**
 * Central de Contratos de API
 * OBRIGATÓRIO: Nenhuma URL de API externa deve ser hardcoded fora deste arquivo.
 */
export const API_CONTRACTS = {
    elevenlabs: {
        tts: (voiceId) => {
            if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID ausente — endpoint inválido para TTS');
            return `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        },
        voices: () => 'https://api.elevenlabs.io/v1/voices',
        cloneVoice: () => 'https://api.elevenlabs.io/v1/voices/add',
        subscription: () => 'https://api.elevenlabs.io/v1/user/subscription'
    },
    fal: {
        submit: (modelId) => {
            if (!modelId) throw new Error('Model ID ausente para a queue do fal.ai');
            return `https://queue.fal.run/${modelId}`;
        },
        status: (modelId, requestId) => {
            if (!modelId || !requestId) throw new Error('Missing modelId or requestId for fal.ai polling');
            return `https://queue.fal.run/${modelId}/requests/${requestId}/status`;
        }
    },
    gemini: {
        generate: (modelId = 'gemini-1.5-pro') =>
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    },
    alibaba: {
        videoSynthesis: () => 'https://dashscope-us.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        taskStatus: (taskId) => {
            if (!taskId) throw new Error('Task ID ausente para pooling do DashScope/Alibaba');
            return `https://dashscope-us.aliyuncs.com/api/v1/tasks/${taskId}`;
        }
    },
    atlascloud: {
        videoGenerations: () => 'https://api.atlascloud.ai/v1/video/generations'
    },
    wavespeed: {
        videoGenerations: () => 'https://api.wavespeed.ai/v1/video/generations'
    },
    runway: {
        base: () => 'https://api.dev.runwayml.com/v1'
    },
    rendi: {
        commands: () => 'https://api.rendi.dev/v1/run-ffmpeg-command',
        status: (commandId) => {
            if (!commandId) throw new Error('Rendi Dev CommandID ausente para polling');
            return `https://api.rendi.dev/v1/commands/${commandId}`;
        }
    },
    supabase: {
        rest: (table) => {
            if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL não configurado');
            if (!table) throw new Error('Tabela não especificada para PostgREST');
            return `${process.env.SUPABASE_URL}/rest/v1/${table}`;
        },
        storage: (bucket, path) => {
            throw new Error('Use supabase.storage.from(bucket).getPublicUrl(path) — não construa a URL do Storage manualmente');
        }
    },
    drive: {
        api: () => 'https://www.googleapis.com/drive/v3'
    }
};
