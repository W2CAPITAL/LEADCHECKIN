# LEADCHECKIN — Build gratuita do Lead Generator

Delta para aplicar sobre o repositório atual `W2CAPITAL/LEADCHECKIN`.

## Correções e melhorias

- Remove completamente Google Places e `GOOGLE_PLACES_API_KEY` da interface e do fluxo de descoberta.
- Lead Generator usa somente fontes públicas gratuitas: DuckDuckGo HTML, Bing HTML e os próprios sites empresariais acessíveis.
- Várias formulações de busca por segmento/cidade.
- Várias páginas por formulação.
- Deduplicação por URL.
- Visita sites empresariais encontrados.
- Procura e-mail, telefone e CNPJ publicados.
- Procura páginas internas de contato, atendimento, fale conosco, sobre e empresa.
- Mantém empresas mesmo quando o contato não é encontrado, evitando falso zero por falha parcial de extração.
- Corrige o narrowing do cliente Supabase em `saveAllDiscovered` e nas operações dependentes de sessão.
- Remove a mensagem de Google Places do CRM.

## Arquivos

Substituir no repositório:

- `src/App.tsx`
- `api/lead-discover.ts`

Depois:

```bash
npm run build
git add .
git commit -m "feat: free lead discovery and remove Google Places"
git push
```

## Gratuito

Não há chave Google Places, n8n, API paga ou serviço de enriquecimento obrigatório.

A execução tem limites técnicos de segurança do próprio servidor para não transformar uma função serverless em processo infinito. Isso não é um limite de leads na interface/CRM; a busca usa múltiplas consultas e páginas e deduplica o resultado.

## Observação

Fontes públicas podem responder com bloqueio, CAPTCHA, 403/429 ou resultados diferentes. O Leadcheck trata isso como falha parcial e continua com as outras fontes e sites acessíveis.
