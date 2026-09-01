# Leadcheck V11 — Deep Contact Discovery

O Lead Generator agora pesquisa em camadas e só promove um resultado quando confirma **nome público + telefone/celular/WhatsApp público**. E-mail pode ser armazenado como contato complementar, mas não substitui o telefone para elegibilidade.

A execução combina busca pública, páginas e perfis públicos, hubs públicos de contato (quando vinculados publicamente), além de uma segunda busca pelo nome/handle para tentar confirmar o telefone. Ela para no primeiro lead contatável confirmado ou ao esgotar a janela de execução da função; não usa loop infinito no servidor.

Não acessa áreas privadas, não burla login e não tenta revelar CPF, dados bancários, score de crédito ou contatos ocultos.

## Vercel
`api/lead-discover.ts` usa streaming NDJSON e `maxDuration` de 60 segundos. O processamento é deliberadamente progressivo para exibir logs e o primeiro lead assim que houver confirmação.
