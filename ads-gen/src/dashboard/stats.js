import { supabaseAdmin } from '../db/supabase.js';

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}m ${rs}s`;
}

function colorText(text, color) {
    const colors = {
        reset: '\x1b[0m',
        green: '\x1b[32m',
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        magenta: '\x1b[35m',
        white: '\x1b[37m',
        gray: '\x1b[90m',
        bold: '\x1b[1m'
    };
    return `${colors[color] || ''}${text}${colors.reset}`;
}

export async function renderDashboard() {
    console.log(colorText('\n======================================================', 'cyan'));
    console.log(colorText('               ADS-GEN MONITORING DASHBOARD               ', 'bold'));
    console.log(colorText('======================================================', 'cyan'));

    try {
        // --- 1. PRODUÇÃO SEMANAL ---
        const metaSemanal = 120;
        const hoje = new Date();
        const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

        const { data: criativosSemana, error: errCriativos } = await supabaseAdmin
            .from('criativos_finais')
            .select('id, status, criado_em')
            .gte('criado_em', semanaPassada.toISOString());

        if (errCriativos) throw errCriativos;

        const concluidosSemana = criativosSemana.filter(c => c.status === 'pronto').length;
        const progresso = Math.round((concluidosSemana / metaSemanal) * 100);

        console.log(colorText('\n📈 PRODUÇÃO SEMANAL:', 'bold'));
        console.log(`  Total Entregues: ${colorText(concluidosSemana, 'green')} | Meta: ${metaSemanal}/semana | Progresso: ${colorText(progresso + '%', 'yellow')}`);

        // --- 2. TEMPO MÉDIO POR FASE ---
        const { data: logs, error: errLogs } = await supabaseAdmin
            .from('pipeline_logs')
            .select('projeto_id, fase, status, criado_em');

        if (errLogs) throw errLogs;

        const fasesDict = {};
        logs.forEach(log => {
            if (!fasesDict[log.fase]) fasesDict[log.fase] = {};
            if (!fasesDict[log.fase][log.projeto_id]) fasesDict[log.fase][log.projeto_id] = { inicio: null, fim: null };

            if (log.status === 'iniciado') fasesDict[log.fase][log.projeto_id].inicio = new Date(log.criado_em).getTime();
            if (log.status === 'sucesso') fasesDict[log.fase][log.projeto_id].fim = new Date(log.criado_em).getTime();
        });

        const medias = {};
        const ordemFases = ['parse', 'storyboard', 'avatar', 'animacao', 'audio', 'edicao', 'entrega'];

        ordemFases.forEach(fase => {
            if (!fasesDict[fase]) {
                medias[fase] = 'N/A';
                return;
            }
            let totalTime = 0;
            let count = 0;
            Object.values(fasesDict[fase]).forEach(tempos => {
                if (tempos.inicio && tempos.fim) {
                    totalTime += (tempos.fim - tempos.inicio);
                    count++;
                }
            });
            medias[fase] = count > 0 ? formatDuration(Math.round(totalTime / count)) : 'N/A';
        });

        console.log(colorText('\n⏱️  POR FASE (tempo médio):', 'bold'));
        console.log(`  Parse:      ${colorText(medias.parse, 'cyan')}  | Storyboard: ${colorText(medias.storyboard, 'cyan')}  | Avatar: ${colorText(medias.avatar, 'cyan')}`);
        console.log(`  Animação:   ${colorText(medias.animacao, 'cyan')}  | Áudio:      ${colorText(medias.audio, 'cyan')}  | Edição: ${colorText(medias.edicao, 'cyan')}`);

        // --- 3. CUSTOS DEDUZIDOS DA API_USAGE ---
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const { data: apiUsage, error: errUsage } = await supabaseAdmin
            .from('api_usage_logs')
            .select('provider, custo_usd')
            .gte('criado_em', inicioMes.toISOString());

        if (errUsage) throw errUsage;

        const custos = {
            'Anthropic': 0,
            'ElevenLabs': 0,
            'Gemini': 0,
            'Runway': 0,
            'Helix': 0
        };

        let totalCusto = 0;
        apiUsage.forEach(usage => {
            const val = Number(usage.custo_usd) || 0;
            totalCusto += val;
            if (custos[usage.provider] !== undefined) {
                custos[usage.provider] += val;
            } else {
                custos[usage.provider] = val; // fallback for exactly named providers
            }
        });

        // Contar total de criativos gerados no mês para média
        const { data: criativosMes, error: errCriativosMes } = await supabaseAdmin
            .from('criativos_finais')
            .select('id')
            .eq('status', 'pronto')
            .gte('criado_em', inicioMes.toISOString());

        const qtdCriativosMes = criativosMes ? criativosMes.length : 0;
        const mediaPorCriativo = qtdCriativosMes > 0 ? (totalCusto / qtdCriativosMes) : 0;

        console.log(colorText('\n💸 CUSTOS (Mês Atual):', 'bold'));
        console.log(`  Claude API:    $${custos['Anthropic'].toFixed(4)}`);
        console.log(`  ElevenLabs:    $${custos['ElevenLabs'].toFixed(4)}`);
        console.log(`  Gemini:        $${custos['Gemini'].toFixed(4)}`);
        console.log(`  Runway:        $${custos['Runway'].toFixed(4)}`);
        console.log(`  Helix:         $${custos['Helix'].toFixed(4)}`);
        console.log(`  ${colorText('TOTAL:', 'magenta')}         $${colorText(totalCusto.toFixed(4), 'green')} (Média: $${mediaPorCriativo.toFixed(2)} por criativo)`);

        // --- 4. STATUS ATUAL ---
        // Fetch all criativos ever for status count
        const { data: todosCriativos, error: errTodos } = await supabaseAdmin
            .from('criativos_finais')
            .select('status, criado_em');

        if (errTodos) throw errTodos;

        let emAndamento = 0;
        let erros = 0;
        let concluidosHoje = 0;

        const inicioHoje = new Date();
        inicioHoje.setHours(0, 0, 0, 0);

        todosCriativos.forEach(c => {
            if (c.status !== 'pronto' && c.status !== 'falha') emAndamento++;
            if (c.status === 'falha') erros++;
            if (c.status === 'pronto' && new Date(c.criado_em) >= inicioHoje) {
                concluidosHoje++;
            }
        });

        console.log(colorText('\n🚦 STATUS ATUAL:', 'bold'));
        console.log(`  Em produção: ${colorText(emAndamento, 'yellow')} arquivos | Concluídos hoje: ${colorText(concluidosHoje, 'green')} | Erros: ${colorText(erros, 'red')}`);

        const timestamp = new Date().toLocaleTimeString('pt-BR');
        console.log(colorText(`\n[Última atualização: ${timestamp}]`, 'gray'));

    } catch (err) {
        console.error(colorText(`\n❌ Erro ao buscar dados do dashboard: ${err.message}`, 'red'));
    }
}
