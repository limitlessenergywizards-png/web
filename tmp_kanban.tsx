"use client";

import Link from "next/link";
import { Flag, User, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function KanbanCard({ project, color, isCockpit = false }: { project: any, color: string, isCockpit?: boolean }) {

    const priorityColors: Record<string, string> = {
        HIGH: "text-rose-500",
        MEDIUM: "text-yellow-500",
        LOW: "text-slate-400"
    };

    const statusProgress: Record<string, string> = {
        DRAFT: "w-1/5",
        AUDIO_PROCESSING: "w-2/5",
        AUDIO_READY: "w-3/5",
        EDITING: "w-3/5",
        RENDERING: "w-4/5 animate-pulse",
        COMPLETED: "w-full",
    };

    return (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/60 shadow-md hover:border-slate-600 hover:shadow-lg transition-all cursor-pointer group flex flex-col gap-3 relative overflow-hidden">

            {/* Top Bar: Priority & Date */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                    <Flag className={cn("w-3 h-3 block", priorityColors[project.priority])} />
                    <span className="font-medium text-slate-300">{project.priority}</span>
                </div>
                <span className="text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(project.updated_at))}
                </span>
            </div>

            {/* Title */}
            <div>
                <Link href={`/projeto/${project.id}`}>
                    <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                        {project.title}
                    </h3>
                </Link>
            </div>

            {/* Meta Info Example */}
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <div className="flex items-center gap-1" title="Avatar ID">
                    <User className="w-3.5 h-3.5" />
                    <span>{project.avatar_char || "Auto"}</span>
                </div>
                <div className="flex items-center gap-1" title="Duração Total Estimada">
                    <Clock className="w-3.5 h-3.5" />
                    <span>~{project.duration || "45"}s</span>
                </div>
            </div>

            {/* Action Bar */}
            <div className="mt-2 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                <div className="flex -space-x-2 overflow-hidden">
                    <div className="h-6 w-6 rounded-full ring-2 ring-slate-800 bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        {project.owner.username.slice(0, 2)}
                    </div>
                </div>

                {isCockpit ? (
                    <Link href={`/projeto/${project.id}`} className="flex items-center gap-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-2.5 py-1 rounded-md transition-colors font-medium border border-rose-500/20 group-hover:border-rose-500/40 z-10 relative">
                        <PlayCircle className="w-4 h-4" /> Abrir
                    </Link>
                ) : (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-${color}-500/10 text-${color}-400 font-medium`}>
                        <div className={`w-1.5 h-1.5 rounded-full bg-${color}-500`}></div>
                        {project.status.replace("_", " ")}
                    </div>
                )}
            </div>

            {/* Progress Indicator Strip */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-700/50">
                <div className={cn(`h-full bg-${color}-500`, statusProgress[project.status])}></div>
            </div>
        </div>
    );
}
