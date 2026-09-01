# Leadcheck — prospecção por intenção pública

## Objetivo
Encontrar oportunidades de pessoas que demonstraram publicamente interesse em empréstimo, consignado, financiamento, revisão, juros ou parcelas.

## Fontes gratuitas usadas
- DuckDuckGo HTML público
- Bing RSS público
- Google News RSS público
- Resultados indexados de Reddit, Reclame Aqui, YouTube e Facebook por consultas `site:`

## Por que não existe uma API gratuita de CPF + contrato de crédito + telefone
Dados de crédito de pessoas físicas não ficam disponíveis de forma legítima em uma API pública gratuita. APIs de bureaus de crédito e dados de consignado/contratos normalmente exigem credenciais, contrato comercial, finalidade e/ou consentimento. O Leadcheck não inventa uma fonte desse tipo.

## O que o motor faz
1. Cria várias consultas de intenção para o produto/cidade.
2. Consulta fontes públicas gratuitas.
3. Filtra sinais de intenção: juros, parcela, revisão, renegociação, financiamento etc.
4. Deduplica.
5. Mostra cada oportunidade assim que chega.
6. Registra logs em tempo real.
7. Preserva a URL e o trecho público para conferência manual.

## Privacidade
O modo de prospecção por intenção não raspa CPF, dados bancários, score de crédito ou listas privadas. Em redes/comunidades, a interface pede verificação manual do contato na fonte antes de qualquer abordagem.
