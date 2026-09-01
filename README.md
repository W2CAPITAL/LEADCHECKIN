# Leadcheck — CRM + Lead Generator

Projeto standalone para um deploy limpo no GitHub + Vercel, usando Supabase como banco e autenticação.

## 1. Supabase
1. Crie um projeto gratuito no Supabase.
2. Abra **SQL Editor**.
3. Cole todo o conteúdo de `supabase/schema.sql` e execute.
4. Em **Project Settings → API**, copie Project URL e anon/public key.

## 2. Vercel
No projeto Vercel, configure:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois faça deploy.

## 3. Local
```bash
npm install
npm run dev
```

## O que já existe
- login/cadastro via Supabase Auth
- CRM multiusuário com isolamento por `owner_id` + RLS
- dashboard
- pipeline de status
- busca e filtro
- score automático
- Lead Generator
- scanner de página pública em `/api/public-scan`
- origem/proveniência do lead
- banco PostgreSQL completo
- auditoria básica por atividades preparada
- Vercel pronto

## Scanner
O scanner trabalha com páginas públicas fornecidas pelo operador. Não coleta credenciais, não acessa áreas privadas e não tenta burlar mecanismos de login.

## WhatsApp
É opcional. O projeto não depende de WhatsApp API nem de fornecedor pago.

## Google Sheets
A integração pode ser adicionada depois como conector, sem transformar Sheets no banco principal.
