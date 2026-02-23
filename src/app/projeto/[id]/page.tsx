import { ArrowLeft, PlayCircle, Copy, Code, Eye, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Dropzone } from "@/app/components/Dropzone";

export default async function ProjectCockpit({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fake data for Mockup
    const p = {
        id,
        title: "PB-ES_Quarto_20260215",
        status: "EDITING",
        avatar_gender: "MASCULINO",
        scenario: "Quarto com iluminação natural",
        tone: "SERIOUS",
        prompts: [
            { id: 1, text: "Ultra realistic portrait of a young man, serious expression, messy bedroom background...", isHook: true },
            { id: 2, text: "Close up shot, man looking directly at camera, natural daylight leaking from window...", isHook: false }
        ],
        audios: [
            { id: 'hook1', label: 'Áudio Hook 1', duration: 4.5 },
            { id: 'hook2', label: 'Áudio Hook 2', duration: 3.2 },
            { id: 'hook3', label: 'Áudio Hook 3', duration: 5.1 },
            { id: 'body', label: 'Áudio Corpo Principal', duration: 32.8 },
        ]
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-white">{p.title}</h1>
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide uppercase">
                                Cockpit do Editor
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm">Monte o criativo alinhando os vídeos gerados com os áudios extraídos.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 transition flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center gap-2">
                        <Send className="w-4 h-4" /> Enviar P/ QA
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Data & Context */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Context Card */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                        <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                            <Code className="w-4 h-4 text-blue-500" /> Parâmetros de Arte
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500 block mb-1">Avatar</span><span className="text-slate-200 font-medium">{p.avatar_gender}</span></div>
                            <div><span className="text-slate-500 block mb-1">Tom de Voz</span><span className="text-slate-200 font-medium bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">{p.tone}</span></div>
                            <div className="col-span-2"><span className="text-slate-500 block mb-1">Cenário Físico</span><span className="text-slate-200">{p.scenario}</span></div>
                        </div>
                    </div>

                    {/* AI Prompts via Helix */}
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg">
                        <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                            <PlayCircle className="w-4 h-4 text-purple-500" /> Prompts p/ Motion (Helix)
                        </h3>
                        <div className="space-y-3">
                            {p.prompts.map((pt) => (
                                <div key={pt.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg group relative">
                                    <p className="text-sm text-slate-300 pr-8">{pt.text}</p>
                                    <button className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors opacity-0 group-hover:opacity-100" title="Copiar Prompt">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Assembly Workspace */}
                <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-2xl relative overflow-hidden">
                    {/* Ambient Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

                    <div className="mb-6 pb-4 border-b border-slate-800">
                        <h2 className="text-lg font-bold text-white mb-1">Montagem do Criativo</h2>
                        <p className="text-sm text-slate-400">Faça o upload dos vídeos renderizados respeitando os limites obrigatórios de duração de cada áudio.</p>
                    </div>

                    {/* Audio Players & Video Dropzones Grid Strip */}
                    <div className="space-y-6">

                        {/* Hooks (3 Columns) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {p.audios.filter(a => a.id.startsWith('hook')).map((audio) => (
                                <div key={audio.id} className="flex flex-col gap-3">
                                    {/* Audio Fake Player Stub */}
                                    <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button className="text-blue-500 hover:text-blue-400 transition" title="Tocar áudio">
                                                <PlayCircle className="w-6 h-6 fill-blue-500/20" />
                                            </button>
                                            <span className="text-xs font-semibold text-slate-300">{audio.label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-500">{audio.duration}s</span>
                                    </div>

                                    {/* Dropzone Matching Required Audio Time */}
                                    <Dropzone id={`dz-${audio.id}`} label={`Vídeo ${audio.id.replace('hook', 'Hook ')}`} requiredTime={audio.duration} />
                                </div>
                            ))}
                        </div>

                        {/* Body (Full Width) */}
                        <div className="pt-4 mt-2 border-t border-slate-800 border-dashed">
                            {p.audios.filter(a => a.id === 'body').map((audio) => (
                                <div key={audio.id} className="flex flex-col md:flex-row gap-4">
                                    <div className="md:w-1/3 bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <button className="text-blue-500 hover:text-blue-400 transition" title="Tocar áudio principal">
                                                <PlayCircle className="w-8 h-8 fill-blue-500/20" />
                                            </button>
                                            <div>
                                                <span className="text-sm font-semibold text-slate-200 block">{audio.label}</span>
                                                <span className="text-xs font-mono text-slate-400 block mt-0.5">{audio.duration}s de duração</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="w-0 bg-blue-500 h-full"></div></div>
                                    </div>

                                    <div className="md:w-2/3">
                                        <Dropzone id={`dz-${audio.id}`} label="Vídeo do Corpo Principal (Restringido)" requiredTime={audio.duration} />
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
