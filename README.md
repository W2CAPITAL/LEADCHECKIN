# LEADCHECKIN — Build V8: prospecção por intenção financeira

Delta para o repositório atual `W2CAPITAL/LEADCHECKIN`.

## Objetivo comercial
O Lead Generator não trata empresas como o produto final. O foco é descobrir oportunidades públicas de pessoas que demonstraram interesse em empréstimo, consignado, financiamento de veículo/imóvel, revisão, juros, parcelas ou renegociação.

## O que mudou
- processamento progressivo via NDJSON: cada oportunidade chega ao navegador assim que é encontrada;
- logs de captação em tempo real;
- consultas específicas para intenção financeira;
- consultas `site:` para Reddit, Reclame Aqui, YouTube e Facebook através de resultados públicos indexados;
- Bing RSS e Google News RSS como fontes gratuitas adicionais;
- deduplicação por fonte/título/trecho;
- score de intenção;
- preservação de URL e snippet para verificação;
- nenhuma Google Places API;
- nenhuma API paga obrigatória;
- nenhuma chave de API necessária para o motor básico;
- não coleta CPF, dados bancários, score de crédito ou listas privadas.

## APIs de crédito/consignado
Não existe uma API pública gratuita e legítima que forneça, em massa, CPF + contrato de crédito/consignado + telefone de pessoas. Bureaus e integrações de crédito exigem contratação, credenciais e regras de uso. Por isso o Leadcheck usa intenção pública como fonte gratuita, em vez de fingir que uma API dessas é aberta.

## Deploy
Substituir no projeto atual:
- `src/App.tsx`
- `api/lead-discover.ts`

Adicionar:
- `docs/LEAD-GENERATOR-INTENCAO-V8.md`

O projeto principal continua usando o Supabase já configurado.
