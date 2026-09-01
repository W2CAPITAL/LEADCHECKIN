# Leadcheck

CRM funcional + Lead Generator gratuito, preparado para Vercel + Supabase.

## O que funciona

- Cadastro e login por Supabase Auth.
- CRM persistente em PostgreSQL/Supabase.
- CRUD real de leads: criar, editar, alterar status e excluir.
- Busca e filtros no CRM.
- Score automático.
- Histórico de interações por lead: nota, ligação, WhatsApp, e-mail e reunião.
- Importação CSV com upsert por proprietário + chave de deduplicação.
- Dashboard com métricas reais do banco.
- Scanner de páginas públicas para contatos comerciais publicados pela empresa.
- Origem e URL preservadas no lead.
- RLS para isolamento entre usuários.

## Gratuito e sem n8n

A base não depende de n8n, WhatsApp API paga, CNPJ pago ou serviço de enriquecimento obrigatório. A captação pode começar com formulário/site, scanner de páginas públicas e CSV.

## Supabase

1. Crie um projeto Supabase.
2. Abra SQL Editor.
3. Execute o arquivo `supabase/schema.sql` inteiro.
4. Em Authentication, use Email/Password.
5. No Vercel configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

O `schema.sql` cria perfis, leads, atividades, índices, triggers e políticas RLS. Também cria automaticamente o perfil quando um usuário é cadastrado.

## Vercel

Build: `npm run build`

O domínio pode continuar sendo administrado pelo Cloudflare via DNS apontando para a Vercel. Não é necessário colocar segredo do Supabase no frontend: use somente a URL e a chave pública/anon nas variáveis `VITE_`.

Nunca exponha `service_role`, `secret` ou `jwt_secret` como `VITE_*`.
