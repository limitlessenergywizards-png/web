# Módulo: Production (Orquestrador)

## Responsabilidade
Orquestrar as fases lógicas da máquina do AdsGen. Controla a esteira, garantindo que o Output de uma fase sirva de Input da próxima. Garante idempotência e coordena recuperação em caso de falha.
**NÃO** faz: Não gera assets de AI diretamente. Não altera regras de cena baseadas na copy.

## Interfaces Públicas
- `ProductionOrchestrator.runPipeline(briefingId, options)`: Roda ou retoma uma pipeline inteira.
- `StateManager`: Recupera estado congelado da última fase salva com sucesso.

## Dependências
- Depende de: `briefing`, `media`, `assembly`, `delivery` (Contratos de Interface)
- Consome: Não consome serviços externos. Apenas delega aos adapters em infra.
- NÃO deve depender de: Bibliotecas de AI (`@google/generative-ai`, `ffmpeg`).

## Fluxo Principal
[BriefingID] -> (State Manager: Check last fase) 
-> [Fase 1..7]
-> (Catch) -> Update DB via Infra to Erro -> Suspend
-> (Success) -> Delivery

## Decisões de Design
Pipeline orientada a eventos síncronos com state recovery via DB (Supabase logger). Evitou-se usar filas assíncronas (ex: RabbitMQ multi worker) inicialmente porque o volume e o coupling exigiriam infra cara, optamos pelo `p-queue` isolado no runtime com forte checkpointing lógico.
