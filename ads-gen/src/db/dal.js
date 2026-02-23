import { supabaseAdmin } from './supabase.js';
import { logger } from '../utils/logger.js';

// Função auxiliar genérica para tratar erros do Supabase
const handleDbResponse = (data, error, operation) => {
    if (error) {
        logger.error(`Database error during ${operation}: ${error.message}`, { phase: 'DAL' });
        throw error;
    }
    return data;
};

// ==========================================
// 1. PROJETOS
// ==========================================
export const criarProjeto = async (dados) => {
    const { data, error } = await supabaseAdmin.from('projetos').insert([dados]).select().single();
    return handleDbResponse(data, error, 'criarProjeto');
};

export const buscarProjeto = async (id) => {
    const { data, error } = await supabaseAdmin.from('projetos').select('*').eq('id', id).single();
    return handleDbResponse(data, error, 'buscarProjeto');
};

export const listarProjetos = async () => {
    const { data, error } = await supabaseAdmin.from('projetos').select('*').order('criados_em', { ascending: false });
    return handleDbResponse(data, error, 'listarProjetos');
};

export const atualizarStatus = async (id, status) => {
    const { data, error } = await supabaseAdmin.from('projetos').update({ status, atualizado_em: new Date() }).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarStatus');
};

// ==========================================
// 2. BRIEFINGS
// ==========================================
export const criarBriefing = async (dados) => {
    const { data, error } = await supabaseAdmin.from('briefings').insert([dados]).select().single();
    return handleDbResponse(data, error, 'criarBriefing');
};

export const atualizarBriefing = async (id, dados) => {
    const { data, error } = await supabaseAdmin.from('briefings').update(dados).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarBriefing');
};

export const buscarBriefing = async (id) => {
    const { data, error } = await supabaseAdmin.from('briefings').select('*').eq('id', id).single();
    return handleDbResponse(data, error, 'buscarBriefing');
};

export const listarBriefingsPorProjeto = async (projetoId) => {
    const { data, error } = await supabaseAdmin.from('briefings').select('*').eq('projeto_id', projetoId);
    return handleDbResponse(data, error, 'listarBriefingsPorProjeto');
};

export const buscarUltimoBriefing = async () => {
    const { data, error } = await supabaseAdmin.from('briefings').select('*').order('criado_em', { ascending: false }).limit(1).single();
    return handleDbResponse(data, error, 'buscarUltimoBriefing');
};

// ==========================================
// 3. CENAS
// ==========================================
export const criarCenas = async (briefingId, arrayDeCenas) => {
    const cenasPayload = arrayDeCenas.map(cena => ({ ...cena, briefing_id: briefingId }));
    const { data, error } = await supabaseAdmin.from('cenas').insert(cenasPayload).select();
    return handleDbResponse(data, error, 'criarCenas');
};

export const listarCenas = async (briefingId) => {
    const { data, error } = await supabaseAdmin.from('cenas').select('*').eq('briefing_id', briefingId).order('ordem', { ascending: true });
    return handleDbResponse(data, error, 'listarCenas');
};

export const atualizarCena = async (id, dados) => {
    const { data, error } = await supabaseAdmin.from('cenas').update(dados).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarCena');
};

// ==========================================
// 4. AVATARES
// ==========================================
export const salvarAvatar = async (dados) => {
    const { data, error } = await supabaseAdmin.from('avatares').insert([dados]).select().single();
    return handleDbResponse(data, error, 'salvarAvatar');
};

export const buscarAvatarSimilar = async (descricao) => {
    // Simplificado com ILIKE. Se precisar vetorial, usaremos pgvector depois.
    const { data, error } = await supabaseAdmin.from('avatares')
        .select('*')
        .ilike('descricao', `%${descricao}%`)
        .limit(1)
        .single();
    return handleDbResponse(data, error, 'buscarAvatarSimilar');
};

export const incrementarUsoAvatar = async (id) => {
    // Fazemos uma chamada RPC idealmente, ou update simples (cuidado com condicões de corrida)
    const avatar = await supabaseAdmin.from('avatares').select('vezes_usado').eq('id', id).single();
    const novoUso = (avatar.data?.vezes_usado || 0) + 1;
    const { data, error } = await supabaseAdmin.from('avatares').update({ vezes_usado: novoUso }).eq('id', id).select().single();
    return handleDbResponse(data, error, 'incrementarUsoAvatar');
};

export const listarAvatares = async (reutilizavelOnly = true) => {
    let query = supabaseAdmin.from('avatares').select('*');
    if (reutilizavelOnly) {
        query = query.eq('reutilizavel', true);
    }
    const { data, error } = await query;
    return handleDbResponse(data, error, 'listarAvatares');
};

// ==========================================
// 5. ASSETS_VIDEO
// ==========================================
export const salvarVideo = async (dados) => {
    const { data, error } = await supabaseAdmin.from('assets_video').insert([dados]).select().single();
    return handleDbResponse(data, error, 'salvarVideo');
};

export const atualizarStatusVideo = async (id, status, path = null) => {
    const updates = { status };
    if (path) updates.arquivo_path = path;
    const { data, error } = await supabaseAdmin.from('assets_video').update(updates).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarStatusVideo');
};

export const listarVideosPorCena = async (cenaId) => {
    const { data, error } = await supabaseAdmin.from('assets_video').select('*').eq('cena_id', cenaId);
    return handleDbResponse(data, error, 'listarVideosPorCena');
};

// ==========================================
// 6. ASSETS_AUDIO
// ==========================================
export const salvarAudio = async (dados) => {
    const { data, error } = await supabaseAdmin.from('assets_audio').insert([dados]).select().single();
    return handleDbResponse(data, error, 'salvarAudio');
};

export const listarAudiosPorCena = async (cenaId) => {
    const { data, error } = await supabaseAdmin.from('assets_audio').select('*').eq('cena_id', cenaId);
    return handleDbResponse(data, error, 'listarAudiosPorCena');
};

export const buscarAudioIdentico = async (texto, voiceId) => {
    const { data, error } = await supabaseAdmin
        .from('assets_audio')
        .select('*')
        .eq('texto_narrado', texto)
        .eq('voice_id', voiceId)
        .eq('status', 'pronto')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        logger.warn(`Erro ao buscar áudio em cache: ${error.message}`);
        return null;
    }
    return data;
};

// ==========================================
// 7. CRIATIVOS_FINAIS
// ==========================================
export const salvarCriativo = async (dados) => {
    const { data, error } = await supabaseAdmin.from('criativos_finais').insert([dados]).select().single();
    return handleDbResponse(data, error, 'salvarCriativo');
};

export const atualizarDriveUrl = async (id, driveUrl, driveFileId) => {
    const { data, error } = await supabaseAdmin.from('criativos_finais').update({ drive_url: driveUrl, drive_file_id: driveFileId, status: 'enviado' }).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarDriveUrl');
};

export const listarCriativos = async (projetoId) => {
    const { data, error } = await supabaseAdmin.from('criativos_finais').select('*').eq('projeto_id', projetoId);
    return handleDbResponse(data, error, 'listarCriativos');
};

// ==========================================
// 8. PIPELINE_LOGS
// ==========================================
export const logFase = async (dados) => {
    const { data, error } = await supabaseAdmin.from('pipeline_logs').insert([dados]).select().single();
    return handleDbResponse(data, error, 'logFase');
};

export const listarLogs = async (projetoId) => {
    const { data, error } = await supabaseAdmin.from('pipeline_logs').select('*').eq('projeto_id', projetoId).order('criado_em', { ascending: false });
    return handleDbResponse(data, error, 'listarLogs');
};

export const ultimoErro = async (projetoId) => {
    const { data, error } = await supabaseAdmin.from('pipeline_logs').select('*').eq('projeto_id', projetoId).eq('status', 'erro').order('criado_em', { ascending: false }).limit(1).single();
    return handleDbResponse(data, error, 'ultimoErro');
};

// ==========================================
// 9. PROMPT_LIBRARY
// ==========================================
export const buscarMelhorPrompt = async (tipo, categoria) => {
    const { data, error } = await supabaseAdmin.from('prompt_library')
        .select('*')
        .eq('tipo', tipo)
        .eq('categoria', categoria)
        .eq('ativo', true)
        .order('score_qualidade', { ascending: false })
        .limit(1)
        .single();
    return handleDbResponse(data, error, 'buscarMelhorPrompt');
};

export const incrementarUsoPrompt = async (id) => {
    const prompt = await supabaseAdmin.from('prompt_library').select('vezes_usado').eq('id', id).single();
    const novoUso = (prompt.data?.vezes_usado || 0) + 1;
    const { data, error } = await supabaseAdmin.from('prompt_library').update({ vezes_usado: novoUso }).eq('id', id).select().single();
    return handleDbResponse(data, error, 'incrementarUsoPrompt');
};

export const atualizarScore = async (id, score) => {
    const { data, error } = await supabaseAdmin.from('prompt_library').update({ score_qualidade: score }).eq('id', id).select().single();
    return handleDbResponse(data, error, 'atualizarScore');
};

export const inserirPrompt = async (dados) => {
    const { data, error } = await supabaseAdmin.from('prompt_library').insert([dados]).select().single();
    return handleDbResponse(data, error, 'inserirPrompt');
};

// ==========================================
// 10. API_USAGE_LOGS (Cost Tracking)
// ==========================================
export const logApiUsage = async (dados) => {
    const { data, error } = await supabaseAdmin.from('api_usage_logs').insert([dados]).select().single();
    return handleDbResponse(data, error, 'logApiUsage');
};

export const listarUsagePorProjeto = async (projetoId) => {
    const { data, error } = await supabaseAdmin.from('api_usage_logs').select('*').eq('projeto_id', projetoId).order('criado_em', { ascending: false });
    return handleDbResponse(data, error, 'listarUsagePorProjeto');
};

export const resumoGastosPorProvider = async () => {
    const { data, error } = await supabaseAdmin.from('api_usage_logs').select('provider, modelo, custo_usd, tipo_operacao, criado_em');
    return handleDbResponse(data, error, 'resumoGastosPorProvider');
};

export const custoTotalMes = async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { data, error } = await supabaseAdmin.from('api_usage_logs').select('custo_usd, provider, modelo, tipo_operacao, criado_em').gte('criado_em', inicioMes.toISOString());
    return handleDbResponse(data, error, 'custoTotalMes');
};
