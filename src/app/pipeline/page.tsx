"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
    Rocket,
    Video,
    CheckCircle2,
    AlertCircle,
    PlusCircle,
    RefreshCcw,
    Ghost
} from "lucide-react";
import Link from "next/link";
import { KanbanCard } from "@/components/KanbanCard";

export default function PipelineDashboard() {
    const [criativos, setCriativos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchCriativos = useCallback(async () => {
        const supabase = createClient();
        console.log("Fetching criativos...");
        const { data, error } = await supabase
            .from('criativos_finais')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) {
            console.error("Error fetching criativos:", error);
            return;
        }

        setCriativos(data || []);
        setLastUpdated(new Date());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCriativos();

        // Optional: Polling every 10 seconds for real-time feel if needed,
        // or just rely on the manual refresh button.
        const interval = setInterval(fetchCriativos, 10000);
        return () => clearInterval(interval);
    }, [fetchCriativos]);

    // Derived State for Kanban Columns
    const draft = criativos.filter(c => c.status === 'pendente' || c.status === 'roteirizando');
    const audio = criativos.filter(c => c.status === 'animando' || c.status === 'gerando_audio');
    const editing = criativos.filter(c => c.status === 'editando');
    const rendering = []; // Em nosso pipeline atual Editando já pula pra Pronto, mas mantemos o layout
    const completed = criativos.filter(c => c.status === 'pronto');
    const failures = criativos.filter(c => c.status === 'falha');

    return (
        <div className="space-y-6 max-h-screen flex flex-col pt-8 bg-[#0a0a0f] text-[#e4e4e7] min-h-screen font-sans">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                        Pipeline <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">ASAVIA</span>
                    </h1>
                    <p className="text-slate-400 text-sm">Acompanhamento em tempo real da esteira de criativos.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={fetchCriativos}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Carregando...' : 'Atualizar'}
                    </button>
                    {/* Botão Novo direciona para página de gerar via CLI, aqui deixamos estático pra ilustrar */}
                    <Link href="/gerar" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all flex items-center gap-2">
                        <PlusCircle className="w-5 h-5" /> Novo Criativo
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 shrink-0">
                <StatCard title="Em Produção" count={criativos.length - completed.length - failures.length} icon={<Rocket className="w-5 h-5 text-blue-500" />} color="blue" />
                <StatCard title="Falhas" count={failures.length} icon={<AlertCircle className="w-5 h-5 text-red-500" />} color="red" />
                <StatCard title="Concluídos (Total)" count={completed.length} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="emerald" />
                <StatCard title="Aguardando Ação" count={draft.length} icon={<AlertCircle className="w-5 h-5 text-rose-500" />} color="rose" />
            </div>

            {/* Kanban Board Container */}
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-6 snap-x flex-1 custom-scrollbar">

                <KanbanColumn title="Rascunho / AI" count={draft.length} color="slate">
                    {draft.map(c => <KanbanCard key={c.id} criativo={c} color="slate" />)}
                    {draft.length === 0 && <EmptyState />}
                </KanbanColumn>

                <KanbanColumn title="Áudios & Avatares" count={audio.length} color="yellow" dotAnimation="animate-pulse">
                    {audio.map(c => <KanbanCard key={c.id} criativo={c} color="yellow" />)}
                    {audio.length === 0 && <EmptyState />}
                </KanbanColumn>

                <KanbanColumn title="Final Cut / Edição" count={editing.length} color="rose" isCockpit dotAnimation="animate-pulse">
                    {editing.map(c => <KanbanCard key={c.id} criativo={c} color="rose" isCockpit />)}
                    {editing.length === 0 && <EmptyState icon="check" text="Tudo limpo!" />}
                </KanbanColumn>

                <KanbanColumn title="Pronto (Drive)" count={completed.length} color="emerald">
                    {completed.map(c => <KanbanCard key={c.id} criativo={c} color="emerald" />)}
                    {completed.length === 0 && <EmptyState />}
                </KanbanColumn>

                {failures.length > 0 && (
                    <KanbanColumn title="Erros API" count={failures.length} color="red">
                        {failures.map(c => <KanbanCard key={c.id} criativo={c} color="red" />)}
                    </KanbanColumn>
                )}

            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(167, 139, 250, 0.2);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(167, 139, 250, 0.4);
                }
            `}</style>
        </div>
    );
}

// Inline Components for layout cleanliness
function StatCard({ title, count, icon, color }: { title: string, count: number, icon: React.ReactNode, color: string }) {
    return (
        <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl shadow-lg">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-${color}-500/10 rounded-lg`}>{icon}</div>
                <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
            </div>
            <p className="text-2xl font-bold text-white">{count}</p>
        </div>
    )
}

function KanbanColumn({ title, count, color, dotAnimation, isCockpit, children }: any) {
    return (
        <div className="flex-none w-80 flex flex-col snap-center h-full max-h-[75vh]">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${color}-500 ${dotAnimation || ''} ${isCockpit ? 'shadow-[0_0_8px_rgba(244,63,94,0.6)]' : ''}`}></div>
                    <h2 className={`font-semibold ${isCockpit ? 'text-white' : 'text-slate-300'}`}>{title}</h2>
                </div>
                <span className={`text-xs font-medium py-1 px-2 rounded-md ${isCockpit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'}`}>
                    {count}
                </span>
            </div>
            <div className={`flex-1 space-y-3 rounded-xl p-3 overflow-y-auto custom-scrollbar ${isCockpit ? 'bg-slate-800/30 border border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' : 'bg-slate-900/40 border border-slate-800/50'}`}>
                {children}
            </div>
        </div>
    )
}

function EmptyState({ icon = "ghost", text = "Vazio" }: { icon?: string, text?: string }) {
    return (
        <div className="border-2 border-dashed border-slate-700/50 rounded-lg p-6 text-center text-slate-500 text-sm h-32 flex flex-col items-center justify-center">
            {icon === "ghost" ? <Ghost className="w-8 h-8 mb-2 opacity-20" /> : <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />}
            {text}
        </div>
    )
}
