# Deploy limpo

## GitHub

Coloque o conteúdo desta pasta na raiz do repositório novo `LEADCHECKIN`.

## Supabase

Execute `supabase/schema.sql` integralmente no SQL Editor. Depois confira Authentication > Providers > Email.

## Vercel

Variáveis obrigatórias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Build: `npm run build`

## Cloudflare

Use o Cloudflare para DNS/domínio. O aplicativo continua hospedado na Vercel; não misture o Worker de ingestão antigo com esta versão.

## Primeiro acesso

Abra o domínio, clique em `Criar uma conta`, confirme o e-mail se o projeto exigir confirmação e entre. O primeiro lead criado já será persistido no Supabase.
