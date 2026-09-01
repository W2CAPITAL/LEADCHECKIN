# Leadcheck V14 — Continuous Stable

Correções desta versão:
- corrige `delay is not defined`;
- define `candidateKey` para deduplicação estável;
- aumenta a diversidade de consultas e fontes indexadas;
- evita selecionar sempre as primeiras consultas da lista;
- mantém processamento progressivo, um resultado por vez;
- a captação continua em ciclos até o usuário clicar em Parar;
- reduz a agressividade das requisições para não disparar centenas por minuto;
- preserva o CRM/Supabase da versão anterior.

Importante: a descoberta automática de contatos pessoais permanece limitada a informações de contato publicamente fornecidas no próprio contexto/página pública; o sistema não tenta revelar telefone privado, acessar áreas restritas ou cruzar identidades para descobrir contato oculto.

## FREE/PUBLIC ONLY
Esta versão segue somente fontes públicas e alternativas gratuitas. Não exige BigDataCorp, Infosimples, APIBrasil paga, Credify, Speedio, LeadJet ou outra fonte de dados paga. O Lead Generator não usa bases privadas nem tenta descobrir telefone pessoal oculto por cruzamento entre plataformas.
