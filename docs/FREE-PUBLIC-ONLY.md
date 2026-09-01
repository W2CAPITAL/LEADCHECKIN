# Leadcheck — política FREE/PUBLIC ONLY

Esta build não depende de APIs pagas, créditos, cartão ou assinaturas para o Lead Generator.

## Fontes utilizadas
- Mecanismos de busca públicos/índices públicos acessíveis sem credencial de API paga.
- Google News RSS público.
- Páginas e perfis publicamente acessíveis.
- Canais de contato que a própria página/perfil publica de forma explícita.
- Importação de CSV pelo operador.

## Não integra
- BigDataCorp
- Infosimples
- APIBrasil paga
- Credify paga
- Speedio
- LeadJet
- qualquer data broker pago
- bases vazadas ou privadas
- APIs de CPF/telefone para descobrir contato pessoal de terceiros

## Regra de lead
Para o Lead Generator, um registro só é elegível quando há:
1. pessoa física publicamente identificada;
2. telefone/celular/WhatsApp publicado de forma acessível no próprio contexto ou em canal de contato explicitamente vinculado.

E-mail sozinho não transforma o resultado em lead contatável.

O sistema não faz enriquecimento entre plataformas para descobrir telefone privado ou oculto.

## Arquitetura
A busca é contínua no navegador, em lotes curtos para respeitar os limites da infraestrutura. Cada resultado elegível é enviado em streaming para a interface imediatamente; a execução segue até o operador clicar em **Parar captação**.
