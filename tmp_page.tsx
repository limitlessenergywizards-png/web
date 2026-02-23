import { createClient } from "@/utils/supabase/server";
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
import { KanbanCard } from "./components/KanbanCard";

// Supabase fetching from the actual projects table
async function getProjects() {
  const supabase = await createClient();

  // Fetch real projects from the database
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  // Map the DB rows to the expected UI format
  return data.map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    priority: p.priority,
    updated_at: p.updated_at,
    // Provide a default owner mockup since we don't have a user joining yet
    owner: { username: 'asavia' }
  }));
}

export default async function Dashboard() {
  const projects = await getProjects();

  const draft = projects.filter(p => p.status === 'DRAFT');
  const audio = projects.filter(p => p.status === 'AUDIO_PROCESSING');
  const editing = projects.filter(p => p.status === 'EDITING' || p.status === 'AUDIO_READY');
  const rendering = projects.filter(p => p.status === 'RENDERING');
  const completed = projects.filter(p => p.status === 'COMPLETED');

  return (
    <div className="space-y-6 max-h-screen flex flex-col pt-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            Workspace <span className="text-blue-500">ASAVIA</span>
          </h1>
          <p className="text-slate-400 text-sm">Acompanhamento da esteira de produção de criativos.</p>
        </div>

        <div className="flex gap-3">
          <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-700 transition-colors flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" /> Atualizar
          </button>
          <Link href="/novo" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> Novo Criativo
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 shrink-0">
        <StatCard title="Em Produção" count={projects.length} icon={<Rocket className="w-5 h-5 text-blue-500" />} color="blue" />
        <StatCard title="Renderizando" count={rendering.length} icon={<Video className="w-5 h-5 text-purple-500" />} color="purple" />
        <StatCard title="Concluídos (Semana)" count={completed.length} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} color="emerald" />
        <StatCard title="Aguardando Ação" count={draft.length} icon={<AlertCircle className="w-5 h-5 text-rose-500" />} color="rose" />
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-6 snap-x flex-1">

        <KanbanColumn title="Rascunho" count={draft.length} color="slate">
          {draft.map(p => <KanbanCard key={p.id} project={p} color="slate" />)}
          {draft.length === 0 && <EmptyState />}
        </KanbanColumn>

        <KanbanColumn title="Áudios & IA" count={audio.length} color="yellow" dotAnimation="animate-pulse">
          {audio.map(p => <KanbanCard key={p.id} project={p} color="yellow" />)}
          {audio.length === 0 && <EmptyState />}
        </KanbanColumn>

        <KanbanColumn title="Cockpit do Editor" count={editing.length} color="rose" isCockpit>
          {editing.map(p => <KanbanCard key={p.id} project={p} color="rose" isCockpit />)}
          {editing.length === 0 && <EmptyState icon="check" text="Tudo limpo!" />}
        </KanbanColumn>

        <KanbanColumn title="Renderizando" count={rendering.length} color="purple">
          {rendering.map(p => <KanbanCard key={p.id} project={p} color="purple" />)}
          {rendering.length === 0 && <EmptyState />}
        </KanbanColumn>

        <KanbanColumn title="Concluído (Drive)" count={completed.length} color="emerald">
          {completed.map(p => <KanbanCard key={p.id} project={p} color="emerald" />)}
          {completed.length === 0 && <EmptyState />}
        </KanbanColumn>

      </div>
    </div>
  );
}

// Inline Components for layout cleanliness
function StatCard({ title, count, icon, color }: { title: string, count: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-xl">
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
    <div className="flex-none w-80 flex flex-col snap-center h-full max-h-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-${color}-500 ${dotAnimation || ''} ${isCockpit ? 'shadow-[0_0_8px_rgba(244,63,94,0.6)]' : ''}`}></div>
          <h2 className={`font-semibold ${isCockpit ? 'text-white' : 'text-slate-300'}`}>{title}</h2>
        </div>
        <span className={`text-xs font-medium py-1 px-2 rounded-md ${isCockpit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'}`}>
          {count}
        </span>
      </div>
      <div className={`flex-1 space-y-3 rounded-xl p-2 overflow-y-auto custom-scrollbar ${isCockpit ? 'bg-slate-800/30 border border-rose-500/20' : 'bg-slate-900/50 border border-slate-800/50'}`}>
        {children}
      </div>
    </div>
  )
}

function EmptyState({ icon = "ghost", text = "Vazio" }: { icon?: string, text?: string }) {
  return (
    <div className="border-2 border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-sm h-32 flex flex-col items-center justify-center">
      {icon === "ghost" ? <Ghost className="w-8 h-8 mb-2 opacity-30" /> : <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />}
      {text}
    </div>
  )
}
