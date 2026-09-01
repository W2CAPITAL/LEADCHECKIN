# Leadcheck V8 — correção de TypeScript

Correção do erro Vercel `TS7006` em `src/App.tsx`.

Foram tipados explicitamente os parâmetros dos callbacks de setters (`setDiscoverLogs`, `setDiscover` e `setActivities`) para compatibilidade com `noImplicitAny`/TypeScript estrito.

## Aplicação

Substitua no repositório atual:
- `src/App.tsx`

O restante do delta V7 permanece igual.

## Validação

A fonte foi revisada para remover callbacks de setter com parâmetros implicitamente `any` nos pontos reportados pelo compilador.

Observação: este pacote é um delta; o build completo depende das demais dependências/arquivos do repositório principal.
