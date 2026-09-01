# Leadcheck — V13 Quality / Anti-Repetition

Esta versão parte da V12 e corrige o principal problema observado em produção: volume excessivo de consultas com pouca novidade e repetição de resultados.

## Mudanças
- buscas sequenciais em vez de 3 motores em paralelo;
- atraso controlado entre consultas para reduzir rajadas;
- histórico de até 4.000 consultas por sessão;
- histórico de até 5.000 candidatos/URLs para evitar reprocessamento;
- deduplicação por URL normalizada + domínio/título/trecho;
- nova família de consultas a cada rodada, com foco maior em relatos em primeira pessoa;
- filtro antecipado de conteúdo empresarial/institucional e de sinais fracos de relato pessoal;
- cada consulta é marcada como usada mesmo quando retorna zero candidatos, impedindo loops;
- execução continua automaticamente em novos lotes até o usuário clicar em Parar;
- leads continuam chegando via streaming, um por um, assim que são confirmados.

## Limite de segurança
O motor investiga somente conteúdo publicamente acessível e canais de contato explicitamente publicados. Ele não acessa áreas privadas, não tenta burlar proteções de plataformas e não procura dados pessoais ocultos.
