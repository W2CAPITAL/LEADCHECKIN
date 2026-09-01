# LEADCHECKIN — Build V6 — Prospecção por intenção financeira

Delta para aplicar sobre o repositório atual `W2CAPITAL/LEADCHECKIN`.

## Objetivo comercial

O Lead Generator deixa de ser um buscador de empresas genéricas. O objetivo é encontrar **oportunidades públicas de pessoas que demonstraram intenção ou problema relacionado a produtos financeiros** que podem ter aderência a uma assessoria financeira/revisional.

Produtos:

- Financiamento de veículo
- Financiamento imobiliário
- Empréstimo
- Dívida / renegociação
- Revisão contratual

## Como funciona

1. O usuário escolhe produto + cidade.
2. O backend cria várias buscas de intenção, por exemplo: juros abusivos, revisão, parcela alta, renegociação, dificuldade de pagamento e pedido de ajuda.
3. Consulta fontes públicas gratuitas sem API key.
4. Deduplica resultados.
5. Classifica a intenção de 0 a 100 e ordena maior intenção primeiro.
6. Tenta acessar a página pública e páginas internas relevantes.
7. Mantém e-mail/telefone somente quando publicados na página pública acessível.
8. Salva no CRM Supabase com a intenção, produto, score e URL de origem.

## Gratuito

Não usa Google Places, Google Maps API, n8n, API paga, lista privada de consumidores ou base de CPF.

Fontes sem chave:

- DuckDuckGo HTML — busca pública.
- Google News RSS — índice público complementar.
- Páginas públicas acessíveis encontradas nos resultados.

As fontes são infraestrutura pública e podem responder com 403/429/CAPTCHA ou cobertura incompleta. O sistema não tenta contornar bloqueios.

## Aplicação

Substitua:

- `src/App.tsx`
- `api/lead-discover.ts`

Adicione:

- `docs/LEAD-GENERATOR-INTENCAO.md`

Depois execute no repositório completo:

```bash
npm run build
```
