'use client';

import { useState, useEffect } from 'react';

interface VideoModel {
    id: string;
    name: string;
    provider: string;
    tier: string;
    costPerSecond: number;
    costPer5s: number;
    costPer10s: number;
    costPerHook: number;
    costPerBody: number;
    costPerCreative: number;
    costPer120: number;
    quality: number;
    speed: number;
    hasAudio: boolean;
    resolution: string;
    recommended: boolean;
    ops: string[];
    description: string;
    bestFor: string;
    stars: string;
}

const TIER_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    teste: { label: 'Teste', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: '🧪' },
    validacao: { label: 'Validação', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: '✅' },
    escala: { label: 'Escala', color: '#f472b6', bg: 'rgba(244,114,182,0.12)', icon: '🚀' },
    legacy: { label: 'Legacy', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', icon: '⚠️' },
};

export default function GerarPage() {
    const [models, setModels] = useState<VideoModel[]>([]);
    const [recommendation, setRecommendation] = useState<Record<string, string>>({});
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [activeTier, setActiveTier] = useState('teste');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/models')
            .then(r => r.json())
            .then(data => {
                setModels(data.models);
                setRecommendation(data.recommendation);
                setSelectedModel(data.recommendation.teste);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load models:', err);
                setLoading(false);
            });
    }, []);

    const filteredModels = models.filter(m => m.tier === activeTier);
    const selectedModelData = models.find(m => m.id === selectedModel);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#fff', fontSize: '1.2rem' }}>Carregando modelos...</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e4e4e7', fontFamily: "'Inter', -apple-system, sans-serif", padding: '2rem' }}>
            {/* Header */}
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 4, background: 'linear-gradient(135deg, #a78bfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Seletor de Modelos de Vídeo
                </h1>
                <p style={{ color: '#71717a', marginBottom: '2rem' }}>Escolha o modelo ideal para cada fase do pipeline</p>

                {/* Tier Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: '2rem', flexWrap: 'wrap' }}>
                    {Object.entries(TIER_LABELS).map(([key, tier]) => (
                        <button
                            key={key}
                            onClick={() => setActiveTier(key)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 12,
                                border: activeTier === key ? `2px solid ${tier.color}` : '2px solid rgba(255,255,255,0.08)',
                                background: activeTier === key ? tier.bg : 'rgba(255,255,255,0.03)',
                                color: activeTier === key ? tier.color : '#71717a',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {tier.icon} {tier.label}
                        </button>
                    ))}
                </div>

                {/* Tier Description */}
                <div style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: TIER_LABELS[activeTier]?.bg,
                    border: `1px solid ${TIER_LABELS[activeTier]?.color}33`,
                    marginBottom: '1.5rem',
                    fontSize: '0.85rem',
                    color: TIER_LABELS[activeTier]?.color
                }}>
                    {activeTier === 'teste' && '🧪 Iteração rápida — 120 criativos/semana — prioridade: velocidade e custo baixo'}
                    {activeTier === 'validacao' && '✅ 20 criativos aprovados — prioridade: qualidade cinematográfica'}
                    {activeTier === 'escala' && '🚀 Top performers para mídia paga — prioridade: máxima qualidade e lip-sync'}
                    {activeTier === 'legacy' && '⚠️ Modelos anteriores — preços altos, mantidos para compatibilidade'}
                </div>

                {/* Model Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: '2rem' }}>
                    {filteredModels.map(model => {
                        const isSelected = selectedModel === model.id;
                        const isRecommended = recommendation[activeTier] === model.id;
                        const tierColor = TIER_LABELS[model.tier]?.color || '#fff';

                        return (
                            <div
                                key={model.id}
                                onClick={() => setSelectedModel(model.id)}
                                style={{
                                    position: 'relative',
                                    padding: '20px',
                                    borderRadius: 16,
                                    border: isSelected ? `2px solid ${tierColor}` : '1px solid rgba(255,255,255,0.08)',
                                    background: isSelected ? `${tierColor}0d` : 'rgba(255,255,255,0.02)',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    backdropFilter: 'blur(20px)'
                                }}
                            >
                                {/* Recommended Badge */}
                                {isRecommended && (
                                    <div style={{
                                        position: 'absolute', top: -10, right: 16,
                                        background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                                        color: '#fff', padding: '4px 12px', borderRadius: 20,
                                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.5,
                                        boxShadow: '0 4px 12px rgba(167,139,250,0.3)'
                                    }}>
                                        ✨ RECOMENDADO
                                    </div>
                                )}

                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>{model.name}</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#71717a', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                                            {model.provider}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: tierColor }}>
                                            ${model.costPerSecond.toFixed(3)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#71717a' }}>/segundo</div>
                                    </div>
                                </div>

                                {/* Description */}
                                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 12, lineHeight: 1.4 }}>
                                    {model.description}
                                </p>

                                {/* Stats Row */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>
                                        Qualidade: <span style={{ color: '#fbbf24' }}>{model.stars}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>
                                        {model.resolution}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>
                                        {model.hasAudio ? '🔊 Áudio' : '🔇 Sem áudio'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>
                                        {model.ops.join(' + ')}
                                    </div>
                                </div>

                                {/* Cost Breakdown */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: 8, padding: 12, borderRadius: 10,
                                    background: 'rgba(0,0,0,0.3)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#71717a', marginBottom: 2 }}>Hook (5s)</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>${model.costPerHook}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#71717a', marginBottom: 2 }}>Body (35s)</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>${model.costPerBody}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#71717a', marginBottom: 2 }}>120/sem</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tierColor }}>${model.costPer120}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Selected Model Summary */}
                {selectedModelData && (
                    <div style={{
                        padding: 24, borderRadius: 16,
                        background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(244,114,182,0.08))',
                        border: '1px solid rgba(167,139,250,0.2)',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16, color: '#fff' }}>
                            📊 Modelo Selecionado: {selectedModelData.name}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: 4 }}>Custo por criativo</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#a78bfa' }}>${selectedModelData.costPerCreative}</div>
                                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>3 hooks + 1 body de 35s</div>
                            </div>
                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: 4 }}>Custo semanal (120)</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f472b6' }}>${selectedModelData.costPer120}</div>
                                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>estimado p/ 120 criativos</div>
                            </div>
                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: 4 }}>vs. Kling 2.0 Master</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#4ade80' }}>
                                    {selectedModelData.costPerSecond < 0.28
                                        ? `-${Math.round((1 - selectedModelData.costPerSecond / 0.28) * 100)}%`
                                        : '—'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>economia vs modelo anterior</div>
                            </div>
                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#71717a', marginBottom: 4 }}>Melhor para</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#e4e4e7', lineHeight: 1.4 }}>
                                    {selectedModelData.bestFor}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
