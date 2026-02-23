# 🚀 Limitless Energy Wizards - Ads-Gen Pipeline

Bem-vindo ao repositório master do **Ads-Gen**, o ecossistema automatizado e state-of-the-art para criação autônoma de criativos virais em vídeo.

O sistema é dividido em dois grandes pilares:
1. **Frontend (Next.js):** Um painel Kanban em tempo real para controle do fluxo de criativos.
2. **Backend CLI (Node.js):** Um motor autônomo baseado em múltiplos agentes de IA (LLMs, TTS, Geradores de Imagem e Vídeo) que orquestram a concepção, narração, animação e edição dos vídeos.

---

## 🏗️ Arquitetura do Sistema

```ascii
+------------------------+        +--------------------------+
|  FRONTEND (Next.js)    |        |   BACKEND CLI (Node.js)  |
|  - Kanban interativo   |        |   - Agents independentes |
|  - Real-time updates   |<======>|   - FFmpeg processador   |
|                        |        |   - Retry / Cache System |
+------------------------+        +--------------------------+
            |                                  |
            v                                  v
+------------------------------------------------------------+
|                    SUPABASE (PostgreSQL)                   |
|  - criativos_finais, projetos, cenas, pipeline_logs        |
|  - Storage: Avatares, Áudios, Vídeos MP4                   |
+------------------------------------------------------------+
                                |
          +---------------------+---------------------+
          |                     |                     |
          v                     v                     v
+-------------------+ +-------------------+ +-------------------+
| Text & Reasoning  | |   Image & Video   | |    Audio TTS      |
| - Anthropic       | | - Fal.ai (Flux)   | | - ElevenLabs      |
| - OpenAI/Gemini   | | - Runway/Alibaba  | |                   |
+-------------------+ +-------------------+ +-------------------+
```

---

## ⚙️ Pré-requisitos & Quickstart

### 1. Requisitos do Sistema
* **Node.js** v20+
* **FFmpeg** instalado e adicionado ao PATH do sistema operacional.
* **Supabase** (Projeto com tabelas mapeadas).

### 2. Configurando as Variáveis de Ambiente
Crie um arquivo `.env` dentro da pasta `ads-gen/config/` (para a CLI) e na raiz (para o Frontend), com as seguintes chaves:

```env
# ==== SUPABASE (Obrigatório) ====
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="ey..."

# ==== LLMs & Agents (Obrigatório) ====
OPENAI_API_KEY="sk-..."
FAL_API_KEY="key:secret"
ELEVENLABS_API_KEY="sk_..."
ELEVENLABS_VOICE_ID="ExemploVoiceId123"

# ==== Integrações Google (Obrigatório) ====
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REFRESH_TOKEN="..."
GOOGLE_DRIVE_FOLDER_ID="..."

# ==== Opcionais / Fallbacks ====
ANTHROPIC_API_KEY="..."
GEMINI_API_KEY="..."
ALIBABA_API_KEY="..."
```

### 3. Rodando o Pipeline (Backend)
Vá até o diretório da CLI e faça a checagem do sistema:
```bash
cd ads-gen
npm install
node index.js check
```

**Principais Comandos:**

* `node index.js auto --briefing 101` — Roda o fluxo autônomo total (do copy à edição).
* `node index.js parse data/exemplo.txt` — Injeta um arquivo de texto local como um novo briefing no banco de dados.
* `node index.js dashboard` — Exibe estatísticas de produção, de custos (API usage) e de tempo.
* `node index.js auth` — Fluxo local para autorizar a conta Google Drive.

### 4. Rodando o Kanban (Frontend)
Na pasta raiz do projeto:
```bash
npm install
npm run dev
```
Acesse `http://localhost:3030/pipeline`. O quadro atualizará em tempo real puxando os dados do campo `criados_em` no banco Supabase.

---

## 💸 Custo Estimado e Resumo de Resiliência

**Cache Inteligente:** O sistema busca áudios idênticos já gerados no Supabase Storage e reaproveita Avatares previamente processados (`reutilizavel=true`) para impedir recriações inúteis, barateando custos drásticamente.
**Backoff Exponencial:** Todas as APIs (ElevenLabs, Claude, OpenAI, Fal.ai) estão embrulhadas no script nativo de Retry, capaz de interceptar os limites de `429 Too Many Requests`.

| Provedor   | Operação         | Custo Médio por Call / Job |
| ---------- | ---------------- | -------------------------- |
| ElevenLabs | Narrações (TTS)  | ~$0.15 a $0.35 por hook    |
| Fal.ai     | Avatar (Flux v1) | $0.05 por imagem           |
| Anthropic  | Parsing / Agents | ~$0.02 a $0.05             |
| Alibaba    | Video Gen (I2V)  | ~$0.20 por 5s              |

*(Média final: **~$0.90 a $1.20** por criativo de 30 a 60 segundos)*

---

## ⚠️ Troubleshooting

**1. Comando `--check` falha na ElevenLabs**
Certifique-se que o usuário gerador da chave tem permissões para ler o endpoint `/voices`. 

**2. FFmpeg não encontrado (FALHA no Health Check)**
O CLI depende de FFmpeg. Instale no Mac com `brew install ffmpeg` ou em Windows ajustando as variáveis de ambiente PATH. Alternativamente, você pode usar a env `FFMPEG_PATH="C:/caminho/ffmpeg.exe"`.

**3. Cards não aparecem no Kanban do Next.js**
O frontend filtra os criativos pelas colunas Roteirizando, Animando, Editando, Pronto, Falhas. Se os projetos estiverem com "concluido", garanta a compatibilidade dos arrays de mapeamento em `src/components/KanbanCard.tsx`.

---
*Powered by Deepmind AI Agent 🤖 (Antigravity Role).*
