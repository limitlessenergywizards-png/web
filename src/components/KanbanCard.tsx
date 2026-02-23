"use client";

import Link from "next/link";
import { Flag, FileVideo, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/utils/cn"; // assuming standard utility exists, else we can inline it

export function KanbanCard({ criativo, color, isCockpit = false }: { criativo: any, color: string, isCockpit?: boolean }) {

    // Removed priority as criativos_finais doesn't have it explicitly right now, or we default it
    const priority = "MEDIUM";
    const priorityColors: Record<string, string> = {
        HIGH: "text-rose-500",
        MEDIUM: "text-yellow-500",
        LOW: "text-slate-400"
    };

    const statusProgress: Record<string, string> = {
        pendente: "w-1/5",
        roteirizando: "w-2/5",
        animando: "w-3/5",
        gerando_audio: "w-3/5",
        editando: "w-4/5 animate-pulse",
        pronto: "w-full",
        falha: "w-full bg-red-500",
    };

    return (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/60 shadow-md hover:border-slate-600 hover:shadow-lg transition-all cursor-pointer group flex flex-col gap-3 relative overflow-hidden">

            {/* Top Bar: Hook Number & Date */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                    <Flag className={cn("w-3 h-3 block", priorityColors[priority])} />
                    <span className="font-medium text-slate-300">Hook #{criativo.hook_numero || '?'}</span>
                </div>
                <span className="text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(criativo.atualizado_em || criativo.criado_em))}
                </span>
            </div>

            {/* Title */}
            <div>
                {criativo.drive_url ? (
                    <a href={criativo.drive_url} target="_blank" rel="noopener noreferrer">
                        <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                            {criativo.nome_arquivo || "Processando Criativo..."}
                        </h3>
                    </a>
                ) : (
                    <h3 className="text-sm font-semibold text-white line-clamp-2">
                        {criativo.nome_arquivo || "Processando Criativo..."}
                    </h3>
                )}
            </div>

            {/* Meta Info Example */}
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <div className="flex items-center gap-1" title="Provider de Vídeo">
                    <FileVideo className="w-3.5 h-3.5" />
                    <span>{criativo.logs?.video_provider || "Auto"}</span>
                </div>
                <div className="flex items-center gap-1" title="Etapa Pipeline">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Fase: {criativo.logs?.fase_atual || "1/7"}</span>
                </div>
            </div>

            {/* Action Bar */}
            <div className="mt-2 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                <div className="flex -space-x-2 overflow-hidden">
                    <div className="h-6 w-6 rounded-full ring-2 ring-slate-800 bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        AI
                    </div>
                </div>

                {isCockpit && criativo.drive_url ? (
                    <a href={criativo.drive_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1 rounded-md transition-colors font-medium border border-emerald-500/20 group-hover:border-emerald-500/40 z-10 relative">
                        <PlayCircle className="w-4 h-4" /> Ver Drive
                    </a>
                ) : (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-${color}-500/10 text-${color}-400 font-medium`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500`}></div>
                        {criativo.status.replace("_", " ")}
                    </div>
                )}
            </div>

            {/* Progress Indicator Strip */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50">
                <div className={cn(`h-full bg-${color}-500`, statusProgress[criativo.status] || "w-1/5")}></div>
            </div>
        </div>
    );
}
