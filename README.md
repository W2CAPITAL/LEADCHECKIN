# Leadcheck

CRM real com Supabase + Lead Generator público.

## Vercel / Supabase

O frontend aceita as variáveis `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Para preservar deployments existentes, também aceita `SUPABASE_URL` + `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SUPABASE_URL`.

Mesmo que as variáveis não sejam expostas ao build do Vite, o app tenta carregá-las em tempo de execução por `/api/supabase-config`, usando as mesmas variáveis normais da Vercel. A chave retornada é a anon/publishable, nunca a `service_role`.

## Deploy

1. Suba o conteúdo deste diretório na raiz do repositório.
2. Configure no Vercel pelo menos `SUPABASE_URL` e `SUPABASE_ANON_KEY` (ou `SUPABASE_PUBLISHABLE_KEY`).
3. Execute `supabase/schema.sql` no SQL Editor do projeto Supabase novo.
4. Faça redeploy.

Não coloque `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` ou `SUPABASE_JWT_SECRET` como `VITE_*`.
