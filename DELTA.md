# LEADCHECKIN — DELTA 2 — Lead Generator amplo

Este pacote é **somente delta**. Extraia por cima do repositório Leadcheck atual.

## O que mudou

- Removido o seletor de quantidade de leads da interface.
- A busca agora usa várias formulações de pesquisa e várias páginas por formulação, deduplica resultados e devolve tudo que conseguiu encontrar nessa rodada.
- Não há mais `limit: 30` no endpoint.
- Google Places (opcional) foi integrado como segunda fonte oficial. Se `GOOGLE_PLACES_API_KEY` existir, o backend consulta até as páginas retornadas pelo próprio Places para cada busca.
- Sites encontrados são visitados para extrair somente e-mail/telefone comercial que a própria página publicou.
- O scanner direto também segue links de Contato/Fale Conosco/Atendimento/Sobre dentro do mesmo domínio, em vez de ler somente a home.
- Quando um site publica um CNPJ, o backend pode consultar a BrasilAPI para enriquecer os dados cadastrais da empresa.
- Não foi adicionado n8n.
- Não há coleta de CPF, compradores de veículos ou WhatsApp privado.

## Variáveis opcionais

`GOOGLE_PLACES_API_KEY` — opcional. Sem ela, o motor continua funcionando com busca pública + sites + BrasilAPI CNPJ.

O Google Places exige faturamento habilitado, mas atualmente possui cotas mensais gratuitas por SKU; Text Search Essentials tem cota gratuita de 10.000 eventos/mês. Não é tratado como dependência obrigatória do Leadcheck.

## Deploy

1. Extraia o conteúdo na raiz do repositório atual.
2. Commit/push.
3. Vercel redeploy.
4. Se quiser a segunda fonte, adicione `GOOGLE_PLACES_API_KEY` nas variáveis da Vercel.

## Importante sobre “sem limite”

O Leadcheck não impõe mais um número máximo artificial de leads ao usuário. Nenhuma API pública, porém, promete resultados infinitos: cada fonte tem suas próprias regras, paginação, disponibilidade e cobertura. O motor usa múltiplas consultas/fontes para ampliar a cobertura em vez de cortar arbitrariamente em 10/20/30 resultados.
