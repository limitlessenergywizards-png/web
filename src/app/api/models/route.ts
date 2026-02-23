import { NextResponse } from 'next/server';

// Inline model catalog (mirrors ads-gen/src/config/video-models.js for Next.js)
const VIDEO_MODELS = [
    {
        id: 'wan-26', name: 'Wan 2.6', provider: 'FAL AI', tier: 'teste',
        costPerSecond: 0.05, costPer5s: 0.25, costPer10s: 0.50,
        quality: 4, speed: 4, hasAudio: false, resolution: '720p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: 'Melhor custo-benefício absoluto. Preservação de detalhes finos.',
        bestFor: 'Validação em escala'
    },
    {
        id: 'kling-25-turbo', name: 'Kling 2.5 Turbo Pro', provider: 'FAL AI', tier: 'teste',
        costPerSecond: 0.07, costPer5s: 0.35, costPer10s: 0.70,
        quality: 4, speed: 5, hasAudio: false, resolution: '1080p',
        recommended: true, ops: ['I2V', 'T2V'],
        description: 'Mais rápido de renderizar, menor fila.',
        bestFor: 'Iteração rápida de prompts'
    },
    {
        id: 'kling-21-standard-kie', name: 'Kling 2.1 Standard', provider: 'KIE', tier: 'teste',
        costPerSecond: 0.025, costPer5s: 0.125, costPer10s: 0.25,
        quality: 3, speed: 4, hasAudio: false, resolution: '720p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: 'Mais barato de todos. Qualidade aceitável.',
        bestFor: 'Teste em massa'
    },
    {
        id: 'kling-26-pro', name: 'Kling 2.6 Pro', provider: 'FAL AI', tier: 'validacao',
        costPerSecond: 0.07, costPer5s: 0.35, costPer10s: 0.70,
        quality: 5, speed: 3, hasAudio: false, resolution: '1080p',
        recommended: true, ops: ['I2V', 'T2V'],
        description: 'Melhor identidade facial. Handheld parece gimbal.',
        bestFor: 'Criativos aprovados'
    },
    {
        id: 'kling-26-pro-audio', name: 'Kling 2.6 Pro + Áudio', provider: 'FAL AI', tier: 'validacao',
        costPerSecond: 0.14, costPer5s: 0.70, costPer10s: 1.40,
        quality: 5, speed: 3, hasAudio: true, resolution: '1080p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: 'Qualidade Pro + áudio nativo.',
        bestFor: 'Testes de lip-sync nativo'
    },
    {
        id: 'wan-21-plus-alibaba', name: 'Wan 2.1 Plus', provider: 'Alibaba', tier: 'validacao',
        costPerSecond: 0.04, costPer5s: 0.20, costPer10s: 0.40,
        quality: 4, speed: 3, hasAudio: false, resolution: '720p',
        recommended: false, ops: ['I2V'],
        description: 'Wan nativo na Alibaba. Muito econômico.',
        bestFor: 'Volume com custo reduzido'
    },
    {
        id: 'veo-31-fast', name: 'Veo 3.1 Fast', provider: 'FAL AI', tier: 'escala',
        costPerSecond: 0.10, costPer5s: 0.50, costPer10s: 1.00,
        quality: 5, speed: 4, hasAudio: false, resolution: '1080p',
        recommended: true, ops: ['I2V', 'T2V'],
        description: 'Melhor lip-sync do mercado.',
        bestFor: 'Criativos vencedores para escalar'
    },
    {
        id: 'veo-31-fast-audio', name: 'Veo 3.1 Fast + Áudio', provider: 'FAL AI', tier: 'escala',
        costPerSecond: 0.15, costPer5s: 0.75, costPer10s: 1.50,
        quality: 5, speed: 4, hasAudio: true, resolution: '1080p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: 'Máxima qualidade com áudio ambiente natural.',
        bestFor: 'Criativos premium'
    },
    {
        id: 'kling-30-standard', name: 'Kling 3.0 Standard', provider: 'FAL AI', tier: 'escala',
        costPerSecond: 0.10, costPer5s: 0.50, costPer10s: 1.00,
        quality: 5, speed: 3, hasAudio: false, resolution: '1080p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: 'Última geração. Melhor consistência facial.',
        bestFor: 'Máxima fidelidade no avatar'
    },
    {
        id: 'sora-2-wavespeed', name: 'Sora 2', provider: 'WaveSpeed', tier: 'escala',
        costPerSecond: 0.10, costPer5s: 0.50, costPer10s: 1.00,
        quality: 5, speed: 4, hasAudio: true, resolution: '1080p',
        recommended: false, ops: ['T2V'],
        description: 'Sora 2 sem cold starts.',
        bestFor: 'Text-to-video premium'
    },
    {
        id: 'kling-20-master', name: 'Kling 2.0 Master ⚠️', provider: 'FAL AI', tier: 'legacy',
        costPerSecond: 0.28, costPer5s: 1.40, costPer10s: 2.80,
        quality: 5, speed: 2, hasAudio: false, resolution: '1080p',
        recommended: false, ops: ['I2V', 'T2V'],
        description: '⚠️ Modelo anterior. 4x mais caro.',
        bestFor: 'NÃO USAR'
    }
];

export async function GET() {
    const bodySecs = 35;
    const hookSecs = 5;
    const hookCount = 3;

    const models = VIDEO_MODELS.map(m => ({
        ...m,
        costPerHook: +(hookSecs * m.costPerSecond).toFixed(3),
        costPerBody: +(bodySecs * m.costPerSecond).toFixed(2),
        costPerCreative: +((bodySecs + hookSecs * hookCount) * m.costPerSecond).toFixed(2),
        costPer120: Math.round((bodySecs + hookSecs * hookCount) * m.costPerSecond * 120),
        stars: '⭐'.repeat(m.quality),
    }));

    // System recommendation per tier
    const recommendation = {
        teste: 'kling-25-turbo',
        validacao: 'kling-26-pro',
        escala: 'veo-31-fast'
    };

    return NextResponse.json({ models, recommendation, tiers: ['teste', 'validacao', 'escala', 'legacy'] });
}
