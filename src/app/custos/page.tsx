import { createClient } from "@/utils/supabase/server";
import {
    DollarSign,
    TrendingUp,
    Zap,
    Film,
    Music,
    Brain,
    Clock,
    BarChart3,
    ArrowLeft,
    AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// Fetch all cost data from Supabase
async function getCostData() {
    const supabase = await createClient();

    const { data: allLogs, error } = await supabase
        .from("api_usage_logs")
        .select("*")
        .order("criado_em", { ascending: false });

    if (error) {
        console.error("Error fetching cost data:", error);
        return { logs: [], stats: getEmptyStats() };
    }

    const logs = allLogs || [];

    // Calculate stats
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const logsThisMonth = logs.filter(
        (l: any) => new Date(l.criado_em) >= inicioMes
    );

    const totalGastoMes = logsThisMonth.reduce(
        (s: number, l: any) => s + (l.custo_usd || 0),
        0
    );
    const totalGastoGeral = logs.reduce(
        (s: number, l: any) => s + (l.custo_usd || 0),
        0
    );
    const totalTokens = logs.reduce(
        (s: number, l: any) => s + (l.tokens_total || 0),
        0
    );
    const totalGeracoes = logs.length;
    const erros = logs.filter((l: any) => l.status === "erro").length;

    // Group by provider
    const byProvider: Record<string, { count: number; cost: number; tokens: number }> = {};
    logs.forEach((l: any) => {
        if (!byProvider[l.provider])
            byProvider[l.provider] = { count: 0, cost: 0, tokens: 0 };
        byProvider[l.provider].count++;
        byProvider[l.provider].cost += l.custo_usd || 0;
        byProvider[l.provider].tokens += l.tokens_total || 0;
    });

    // Group by model
    const byModel: Record<string, { count: number; cost: number; avgTime: number }> = {};
    logs.forEach((l: any) => {
        if (!byModel[l.modelo]) byModel[l.modelo] = { count: 0, cost: 0, avgTime: 0 };
        byModel[l.modelo].count++;
        byModel[l.modelo].cost += l.custo_usd || 0;
        byModel[l.modelo].avgTime += l.duracao_geracao_ms || 0;
    });
    Object.keys(byModel).forEach((m) => {
        byModel[m].avgTime = Math.round(byModel[m].avgTime / byModel[m].count);
    });

    // Daily average for estimate
    const daysInMonth = now.getDate();
    const dailyAvg = daysInMonth > 0 ? totalGastoMes / daysInMonth : 0;
    const estimativaMensal = dailyAvg * 30;

    // FAL balance (hardcoded from user's screenshot, will be updated via API later)
    const falBalance = 4.55;

    return {
        logs,
        stats: {
            totalGastoMes,
            totalGastoGeral,
            totalTokens,
            totalGeracoes,
            erros,
            byProvider,
            byModel,
            dailyAvg,
            estimativaMensal,
            falBalance,
        },
    };
}

function getEmptyStats() {
    return {
        totalGastoMes: 0, totalGastoGeral: 0, totalTokens: 0,
        totalGeracoes: 0, erros: 0, byProvider: {}, byModel: {},
        dailyAvg: 0, estimativaMensal: 0, falBalance: 0,
    };
}

const providerIcons: Record<string, any> = {
    fal_ai: <Film className="w-5 h-5 text-purple-400" />,
    elevenlabs: <Music className="w-5 h-5 text-emerald-400" />,
    openai: <Brain className="w-5 h-5 text-green-400" />,
    anthropic: <Brain className="w-5 h-5 text-orange-400" />,
    gemini: <Zap className="w-5 h-5 text-blue-400" />,
};

const providerColors: Record<string, string> = {
    fal_ai: "purple",
    elevenlabs: "emerald",
    openai: "green",
    anthropic: "orange",
    gemini: "blue",
};

export default async function CustosPage() {
    const { logs, stats } = await getCostData();

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">
                            API Cost <span className="text-purple-400">Tracker</span>
                        </h1>
                        <p className="text-sm text-slate-400">
                            Rastreamento de gastos por execução, modelo e provider
                        </p>
                    </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                    Atualizado: {new Date().toLocaleString("pt-BR")}
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard
                    title="Saldo FAL AI"
                    value={`$${stats.falBalance.toFixed(2)}`}
                    sub="Créditos restantes"
                    icon={<DollarSign className="w-5 h-5 text-yellow-400" />}
                    color="yellow"
                    highlight
                />
                <StatCard
                    title="Gasto Este Mês"
                    value={`$${stats.totalGastoMes.toFixed(4)}`}
                    sub={`Média diária: $${stats.dailyAvg.toFixed(4)}`}
                    icon={<TrendingUp className="w-5 h-5 text-rose-400" />}
                    color="rose"
                />
                <StatCard
                    title="Estimativa Mensal"
                    value={`$${stats.estimativaMensal.toFixed(2)}`}
                    sub="Projeção 30 dias"
                    icon={<BarChart3 className="w-5 h-5 text-blue-400" />}
                    color="blue"
                />
                <StatCard
                    title="Total Gerações"
                    value={stats.totalGeracoes}
                    sub={`${stats.erros} erros`}
                    icon={<Zap className="w-5 h-5 text-emerald-400" />}
                    color="emerald"
                />
                <StatCard
                    title="Total Tokens"
                    value={stats.totalTokens.toLocaleString()}
                    sub="Input + Output"
                    icon={<Brain className="w-5 h-5 text-purple-400" />}
                    color="purple"
                />
            </div>

            {/* Provider Breakdown + Model Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* By Provider */}
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-400" /> Gastos por Provider
                    </h2>
                    <div className="space-y-3">
                        {Object.entries(stats.byProvider).map(([provider, data]: [string, any]) => (
                            <div
                                key={provider}
                                className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3"
                            >
                                <div className="flex items-center gap-3">
                                    {providerIcons[provider] || (
                                        <Zap className="w-5 h-5 text-slate-400" />
                                    )}
                                    <div>
                                        <p className="font-medium capitalize">{provider.replace("_", " ")}</p>
                                        <p className="text-xs text-slate-400">{data.count} chamadas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-400">${data.cost.toFixed(4)}</p>
                                    {data.tokens > 0 && (
                                        <p className="text-xs text-slate-500">
                                            {data.tokens.toLocaleString()} tokens
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {Object.keys(stats.byProvider).length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">
                                Nenhum gasto registrado ainda.
                            </p>
                        )}
                    </div>
                </div>

                {/* By Model */}
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-400" /> Gastos por Modelo
                    </h2>
                    <div className="space-y-3">
                        {Object.entries(stats.byModel).map(([model, data]: [string, any]) => (
                            <div
                                key={model}
                                className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3"
                            >
                                <div>
                                    <p className="font-medium text-sm">{model}</p>
                                    <p className="text-xs text-slate-400">
                                        {data.count}x | Média: {(data.avgTime / 1000).toFixed(1)}s
                                    </p>
                                </div>
                                <p className="font-bold text-emerald-400">${data.cost.toFixed(4)}</p>
                            </div>
                        ))}

                        {Object.keys(stats.byModel).length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">
                                Nenhum modelo utilizado ainda.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Logs Table */}
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" /> Histórico de Gerações
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700 text-slate-400">
                                <th className="text-left py-2 px-3">Data</th>
                                <th className="text-left py-2 px-3">Provider</th>
                                <th className="text-left py-2 px-3">Modelo</th>
                                <th className="text-left py-2 px-3">Tipo</th>
                                <th className="text-right py-2 px-3">Tokens</th>
                                <th className="text-right py-2 px-3">Tempo</th>
                                <th className="text-right py-2 px-3">Custo</th>
                                <th className="text-center py-2 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.slice(0, 50).map((log: any) => (
                                <tr
                                    key={log.id}
                                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                                >
                                    <td className="py-2 px-3 text-slate-400 text-xs">
                                        {new Date(log.criado_em).toLocaleString("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>
                                    <td className="py-2 px-3">
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${providerColors[log.provider] || "slate"}-500/20 text-${providerColors[log.provider] || "slate"}-400`}
                                        >
                                            {log.provider}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-xs font-mono text-slate-300 max-w-[200px] truncate">
                                        {log.modelo}
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                            {log.tipo_operacao}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-xs text-slate-400">
                                        {log.tokens_total?.toLocaleString() || "—"}
                                    </td>
                                    <td className="py-2 px-3 text-right text-xs text-slate-400">
                                        {log.duracao_geracao_ms
                                            ? `${(log.duracao_geracao_ms / 1000).toFixed(1)}s`
                                            : "—"}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-emerald-400">
                                        ${(log.custo_usd || 0).toFixed(4)}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        {log.status === "sucesso" ? (
                                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-rose-400 inline" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {logs.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-8">
                            Nenhuma geração registrada. Execute o pipeline para ver dados aqui.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, sub, icon, color, highlight }: any) {
    return (
        <div
            className={`bg-slate-900/80 backdrop-blur border rounded-xl p-4 ${highlight
                    ? "border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                    : "border-slate-800"
                }`}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 bg-${color}-500/10 rounded-lg`}>{icon}</div>
                <h3 className="text-slate-400 text-xs font-medium">{title}</h3>
            </div>
            <p
                className={`text-xl font-bold ${highlight ? "text-yellow-400" : "text-white"
                    }`}
            >
                {value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
    );
}
