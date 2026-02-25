-- Drop any conflicting tables from mockup phase
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.briefings CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- TABELA 1 — projetos
CREATE TABLE public.projetos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    produto text NOT NULL,
    idioma text DEFAULT 'es',
    status text DEFAULT 'rascunho',
    meta_criativos integer DEFAULT 120,
    criados_em timestamptz DEFAULT now(),
    atualizado_em timestamptz DEFAULT now()
);

-- TABELA 2 — briefings
CREATE TABLE public.briefings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
    copy_original text NOT NULL,
    copy_parseada jsonb,
    avatar_descricao text,
    avatar_referencia_url text,
    publico_alvo jsonb,
    musicas_sugeridas text[],
    duracao_estimada_segundos integer,
    status text DEFAULT 'pendente',
    criado_em timestamptz DEFAULT now()
);

-- TABELA 3 — cenas
CREATE TABLE public.cenas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id uuid REFERENCES public.briefings(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    ordem integer NOT NULL,
    descricao_visual text,
    sentimento text,
    duracao_segundos integer,
    notas_producao text,
    criado_em timestamptz DEFAULT now()
);

-- TABELA 4 — avatares
CREATE TABLE public.avatares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id uuid REFERENCES public.briefings(id),
    nome text,
    descricao text,
    prompt_usado text,
    imagem_url text,
    imagem_path text,
    reutilizavel boolean DEFAULT true,
    vezes_usado integer DEFAULT 0,
    criado_em timestamptz DEFAULT now()
);

-- TABELA 5 — assets_video
CREATE TABLE public.assets_video (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cena_id uuid REFERENCES public.cenas(id) ON DELETE CASCADE,
    avatar_id uuid REFERENCES public.avatares(id),
    tipo text,
    provider text,
    prompt_usado text,
    duracao_segundos numeric,
    resolucao text,
    arquivo_path text,
    arquivo_url text,
    status text DEFAULT 'pendente',
    criado_em timestamptz DEFAULT now()
);

-- TABELA 6 — assets_audio
CREATE TABLE public.assets_audio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cena_id uuid REFERENCES public.cenas(id) ON DELETE CASCADE,
    texto_narrado text,
    voice_id text,
    voice_nome text,
    duracao_segundos numeric,
    arquivo_path text,
    status text DEFAULT 'pendente',
    criado_em timestamptz DEFAULT now()
);

-- TABELA 7 — criativos_finais
CREATE TABLE public.criativos_finais (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid REFERENCES public.projetos(id),
    briefing_id uuid REFERENCES public.briefings(id),
    hook_numero integer,
    nome_arquivo text,
    arquivo_path text,
    drive_url text,
    drive_file_id text,
    duracao_total_segundos numeric,
    status text DEFAULT 'pendente',
    criado_em timestamptz DEFAULT now()
);

-- TABELA 8 — pipeline_logs
CREATE TABLE public.pipeline_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid REFERENCES public.projetos(id),
    briefing_id uuid REFERENCES public.briefings(id),
    fase text,
    status text,
    detalhes jsonb,
    erro_mensagem text,
    duracao_ms integer,
    custo_estimado_usd numeric,
    criado_em timestamptz DEFAULT now()
);

-- TABELA 9 — prompt_library
CREATE TABLE public.prompt_library (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo text,
    nome text,
    categoria text,
    prompt_texto text,
    vezes_usado integer DEFAULT 0,
    score_qualidade numeric DEFAULT 5.0,
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- Enable RLS and setup policies
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_video ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criativos_finais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

-- Service Role policies (Acesso total)
CREATE POLICY "Service Role Full Access Projetos" ON public.projetos USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Briefings" ON public.briefings USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Cenas" ON public.cenas USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Avatares" ON public.avatares USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Assets Video" ON public.assets_video USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Assets Audio" ON public.assets_audio USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Criativos Finais" ON public.criativos_finais USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Pipeline Logs" ON public.pipeline_logs USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Prompt Library" ON public.prompt_library USING (auth.role() = 'service_role');

-- Public Anon SELECT policies
CREATE POLICY "Anon Select Criativos Finais" ON public.criativos_finais FOR SELECT USING (true);
CREATE POLICY "Anon Select Prompt Library" ON public.prompt_library FOR SELECT USING (true);

-- Create Storage bucket 'assets' if not exists (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;

-- Insert 10 initial prompts in prompt_library
INSERT INTO public.prompt_library (tipo, nome, categoria, prompt_texto) VALUES
('avatar', 'Avatar Feminino - Modelo Loira', 'beleza', 'Uma mulher jovem, loira, sorriso perfeito, iluminação natural de estúdio'),
('avatar', 'Avatar Masculino - Especialista', 'autoridade', 'Homem de 40 anos, terno azul marinho, barba bem feita, fundo de escritório moderno'),
('animacao', 'Caminhada Dinâmica', 'caminhada', 'A câmera segue a pessoa caminhando em direção à tela com passos firmes, vento no cabelo'),
('animacao', 'Sorriso e Olhar', 'sorriso', 'Close no rosto, a pessoa sorri e olha diretamente para a câmera, iluminação suave'),
('storyboard', 'Hook Padrão', 'hook', 'Início rápido, corte seco para o rosto da pessoa, texto grande na tela'),
('storyboard', 'Corpo do Vídeo', 'body', 'Cenário contínuo, a pessoa fala com as mãos enquanto explica o produto'),
('animacao', 'Ação no Produto', 'produto', 'As mãos da pessoa seguram o produto e o mostram em detalhes para a câmera'),
('animacao', 'Transição Dinâmica', 'transicao', 'A câmera gira rapidamente 180 graus e revela o próximo cenário'),
('avatar', 'Avatar Jovem - Casual', 'casual', 'Mulher jovem com roupas casuais coloridas, fundo de café moderno, vibe relaxada'),
('animacao', 'Pescoço e Movimento', 'pescoco', 'Movimento sutil de pescoço acompanhando o olhar, natural e fluido');
