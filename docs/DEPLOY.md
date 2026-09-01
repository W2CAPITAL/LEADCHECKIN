# Deploy do Leadcheck

1. Supabase: crie um projeto, abra SQL Editor e execute `supabase/schema.sql` inteiro.
2. Supabase Auth: habilite Email/Password. Durante testes, deixe confirmação de e-mail conforme sua necessidade.
3. Vercel: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores públicos do projeto.
4. Não exponha `SERVICE_ROLE`, `SECRET` ou `JWT_SECRET` em `VITE_*`.
5. GitHub: coloque o conteúdo desta pasta na raiz do novo repositório e importe o repositório na Vercel.
6. Build command: `npm run build`.

## Regra de lead
O CRM não aceita novo/atualizado lead sem nome e sem telefone/celular/WhatsApp ou e-mail. O banco reforça a regra por trigger, então ela não depende apenas da interface.

## Captação
O Lead Generator trabalha com sinais e contatos publicamente acessíveis. Não acessa áreas privadas nem tenta obter CPF, score, conta bancária ou listas privadas. Um resultado de comunidade só vira lead quando houver identidade pública e canal de contato acessível na fonte.
