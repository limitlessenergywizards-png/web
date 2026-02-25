# Módulo: Media / Video Generating

## Responsabilidade
Receber inputs estruturados (Cena + Avatar) e retornar uma URL estática referenciando um render de vídeo pronto e auditado. Encapsula inteligência de "Retry", "Prompt Enhancing para a IA" e manuseio de fallback entre APIs de geração (Kling / Wan / Runway).
**NÃO** faz: Decisões sobre qual frame usar, ou upload final no Storage próprio.

## Interfaces Públicas
- `VideoGenerator.generate(cenaEntity, avatarUrl, providerConfig)`

## Dependências
- Depende de: `shared/errors`, `infrastructure/api-contracts`
- Consome: Adapters de APIs externas para Inteligência Gen-Vídeo.
- NÃO deve depender de: Lógica de FFmpeg ou de Supabase (Database).

## Fluxo Principal
[CenaEntity] -> Factory resolve Provider -> ExecCloudJob(Kling/Fal.ai) -> Polling Success -> AssetURL
