-- ==========================================
-- TABELA: api_usage_logs — Rastreamento de custos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Referências
    projeto_id uuid REFERENCES public.projetos(id),
    briefing_id uuid REFERENCES public.briefings(id),
    cena_id uuid REFERENCES public.cenas(id),
    asset_id uuid,  -- referência genérica (video ou audio asset)
    -- Provider e Modelo
    provider text NOT NULL,       -- 'fal_ai' | 'elevenlabs' | 'openai' | 'anthropic' | 'gemini'
    modelo text NOT NULL,         -- 'kling-video/v2/master' | 'eleven_multilingual_v2' | 'gpt-4o-mini'
    tipo_operacao text NOT NULL,  -- 'text_to_video' | 'image_to_video' | 'tts' | 'llm_chat'
    -- Métricas de Custo
    custo_usd numeric DEFAULT 0,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    tokens_total integer DEFAULT 0,
    -- Métricas de Performance
    duracao_geracao_ms integer,    -- quanto tempo a API levou
    duracao_asset_segundos numeric, -- duração do áudio/vídeo gerado
    -- Metadata
    prompt_usado text,
    resolucao text,                -- '720p', '1080p'
    aspect_ratio text,             -- '9:16', '16:9'
    status text DEFAULT 'sucesso', -- 'sucesso' | 'erro' | 'timeout'
    erro_mensagem text,
    resposta_metadata jsonb,       -- metadata raw da API
    criado_em timestamptz DEFAULT now()
);

-- Adicionar coluna modelo_usado nas tabelas de assets
ALTER TABLE public.assets_video ADD COLUMN IF NOT EXISTS modelo_usado text;
ALTER TABLE public.assets_video ADD COLUMN IF NOT EXISTS custo_usd numeric DEFAULT 0;
ALTER TABLE public.assets_video ADD COLUMN IF NOT EXISTS duracao_geracao_ms integer;

ALTER TABLE public.assets_audio ADD COLUMN IF NOT EXISTS modelo_usado text;
ALTER TABLE public.assets_audio ADD COLUMN IF NOT EXISTS custo_usd numeric DEFAULT 0;
ALTER TABLE public.assets_audio ADD COLUMN IF NOT EXISTS duracao_geracao_ms integer;

-- RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Full Access Api Usage Logs" ON public.api_usage_logs USING (auth.role() = 'service_role');
-- Anon SELECT para o dashboard Next.js poder ler (sem auth por enquanto)
CREATE POLICY "Anon Select Api Usage Logs" ON public.api_usage_logs FOR SELECT USING (true);

-- Índices para queries rápidas do dashboard
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON public.api_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_modelo ON public.api_usage_logs(modelo);
CREATE INDEX IF NOT EXISTS idx_api_usage_criado ON public.api_usage_logs(criado_em);
CREATE INDEX IF NOT EXISTS idx_api_usage_projeto ON public.api_usage_logs(projeto_id);
