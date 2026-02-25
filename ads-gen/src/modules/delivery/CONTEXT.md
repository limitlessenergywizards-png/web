# Módulo: Delivery (Notificação e Distribuição)

## Responsabilidade
Receber artefatos criados localmente/cloud e enviá-los ao recipiente final do Cliente (Google Drive / S3 de cliente). É responsável por gerar webhooks avisando que "O Sistema X entregou N criativos".
**NÃO** faz: Render do vídeo ou decisões sobre validade do vídeo.

## Interfaces Públicas
- `DeliveryManager.deliver(creativeMetadata, destinationConfig)`

## Dependências
- Depende de: `infrastructure/api-contracts` (Gdrive API, Webhook senders)
- NÃO deve depender de: Agentes de mídia (`audio`, `video`, `avatar`). O pipeline já entrega URLs/files consumíveis prontinhos.
