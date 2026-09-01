# LEADCHECK V12 — Captacao continua de leads contataveis

Esta build preserva o CRM/Supabase e corrige o motor de prospeccao para operar em lotes curtos e continuos.

## Comportamento

- O usuario clica em **Buscar leads contataveis**.
- A API executa um lote curto para evitar timeout da Vercel e faz streaming dos eventos.
- Cada pessoa fisica elegivel aparece imediatamente na interface.
- Ao terminar o lote, o navegador inicia automaticamente o proximo lote.
- A pesquisa so para quando o usuario clica em **Parar captacao** (ou quando ocorre um erro de rede que precisa ser corrigido).
- A cada lote o cursor muda as consultas e o navegador envia URLs ja vistas para reduzir repeticao.

## Regra de elegibilidade

Um lead de prospeccao precisa ser uma **pessoa fisica identificada publicamente** e ter **telefone/celular/WhatsApp publicamente acessivel**. E-mail sozinho nao basta.

Resultados de bancos, financeiras, fintechs, portais, plataformas, paginas institucionais e sites empresariais sao descartados.

O motor pode inspecionar uma pagina/perfil publico e seguir um canal de contato que esteja explicitamente vinculado a essa pagina, mas nao tenta entrar em areas privadas nem cruzar identidades entre sites para descobrir telefone oculto.

## Vantagem da arquitetura

A Vercel nao precisa manter uma unica funcao viva indefinidamente. A API trabalha em pequenos lotes e o cliente mantem a captação ativa. Isso permite continuar por muito mais tempo sem um timeout unico de servidor.
