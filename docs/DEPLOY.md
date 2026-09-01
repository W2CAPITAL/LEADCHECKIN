# Deploy zero-to-production

### GitHub
Crie um repositório novo e copie a raiz deste projeto. Não publique `.env` com segredos.

### Supabase
Execute `supabase/schema.sql` no SQL Editor. O RLS garante que um usuário autenticado só veja seus próprios leads.

### Vercel
Importe o repositório. Build: `npm run build`. Framework: Vite. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são públicas por design; a segurança real do acesso aos dados é feita pelas políticas RLS.

### Domínio Cloudflare
No Cloudflare DNS, aponte o domínio para o destino fornecido pela Vercel. Depois adicione o domínio em Vercel → Settings → Domains.
