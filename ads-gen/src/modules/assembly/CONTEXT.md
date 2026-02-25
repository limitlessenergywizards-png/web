# Módulo: Assembly (Edição)

## Responsabilidade
Transformar os N assets isolados (vídeos mudos, aúdios normalizados, arrays de texto de legenda, background music) em M criativos finais (mp4s completos rendarizados). Aplica regras de tempo, framerate, proporção, filtros e efeitos de transição.
**NÃO** faz: Não julga _quais_ assets usar, ele constrói um canvas recebendo os assets exatos requeridos.

## Interfaces Públicas
- `EditorEngine.buildCreative(creativeManifest)`
- `MediaAnalyzer.getDuration(assetUrl)`

## Dependências
- Depende de: `infrastructure/cloud-compute` (Para Rendi / FFmpeg distribuído)
- Consome: Serviços de encode de mídia.
- NÃO deve depender de: Domínio de `briefing` (O que a copy diz é irrelevante para o Assembly).

## Pontos de Extensão
As instruções do "CreativeManifest" são puras (JSON/Object). Para rodar num FFmpeg local ou EC2 propria, crie um novo `Adapter` na `infrastructure` que entende um render de manifest.
