# Leadcheck — Delta de correções e melhorias

Este ZIP NÃO é o projeto completo. É somente o delta para aplicar sobre a build `LEADCHECKIN-CRM-FREE-N8N-FIXED` já publicada.

## Arquivos alterados/adicionados

- `src/App.tsx` — Lead Generator passa a ter busca de empresas reais por segmento + cidade, salvamento individual/em lote no Supabase e tratamento melhor do scanner bloqueado.
- `src/styles.css` — interface da busca/prospecção.
- `api/public-scan.ts` — 403/4xx não quebram a experiência; resposta orienta para a busca pública e o scanner extrai contatos comerciais de páginas acessíveis.
- `api/lead-discover.ts` — nova função server-side gratuita para descobrir empresas B2B publicamente encontráveis e, quando possível, seus contatos comerciais publicados.
- `vercel.json` — limite de execução das duas funções aumentado para 15s.

## Deploy

Copie estes arquivos por cima da raiz do repositório existente e faça commit/push. Não substitua o restante do projeto.

O novo Lead Generator aceita, por exemplo:

- `escritórios de advocacia` + `São Paulo`
- `imobiliárias` + `Campinas`
- `despachantes` + `Santos`
- `lojas de veículos` + `Guarulhos`

A busca retorna empresas reais encontradas em páginas públicas. O sistema não inventa leads e não usa contatos privados de consumidores. Quando o site da empresa permite acesso, tenta extrair e-mail/telefone comercial publicado e mantém a URL de origem.
