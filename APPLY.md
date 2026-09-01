# LEADCHECKIN — Delta V3.1

Correção específica do build da Vercel informado em 01/09/2026:

`src/App.tsx`: TS18047 — `supabase` possibly `null` em `saveAllDiscovered()`.

## Aplicação

Na raiz do repositório `W2CAPITAL/LEADCHECKIN`, aplique `src/App.tsx.patch`.

A correção transforma o cliente nullable em uma referência local após a guarda:

```ts
const client = supabase;
if (!client || !session || !discover?.results?.length) return;
```

e usa `client.from(...)` no upsert em lote.

Não altera banco, autenticação, Lead Generator, nem adiciona serviços pagos/n8n.

## Observação

Este pacote é um **delta**, não um clone do repositório. Ele contém somente a correção necessária para o erro de compilação reportado.
