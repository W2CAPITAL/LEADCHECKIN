# LEADCHECKIN — V7 CAPTURA PROGRESSIVA + LOGS

Delta para aplicar sobre o `W2CAPITAL/LEADCHECKIN` atual.

## O que foi corrigido

### 1. Resultados progressivos
O endpoint `/api/lead-discover` agora responde em NDJSON/streaming. O frontend lê a resposta em fluxo e adiciona cada lead à lista imediatamente.

Fluxo:

`fonte -> encontrou 1 -> tela mostra 1 -> encontrou outro -> tela mostra outro`

Não espera a pesquisa inteira terminar para montar a lista.

### 2. Logs em tempo real
A interface ganhou uma área **Logs da captação**, com horário, fonte e mensagem. Ela registra Overpass, DuckDuckGo, Bing, scanner, deduplicação, falhas parciais e conclusão.

### 3. Despachantes
A busca OSM foi ampliada para considerar também a tag `office` e termos específicos para `despachante`, `despachantes`, `despachante documentalista`, `documentalista` e `documentação de veículos`.

### 4. Busca pública mais robusta
O fallback agora usa:
- DuckDuckGo HTML;
- Bing RSS público.

O Bing usa RSS porque links de resultado HTML podem ser redirecionados pelo próprio Bing e não devem ser tratados como se fossem URLs empresariais.

### 5. Falha parcial não vira falso zero
Se uma fonte falhar, o log informa a falha e a execução continua. Se Overpass não retornar, as buscas públicas continuam. Se um site bloquear o scanner, o resultado continua na lista.

### 6. Google Places continua fora
Nenhuma chave é necessária. Não há Google Places, n8n ou API paga obrigatória.

## Arquivos

Substituir:
- `src/App.tsx`
- `api/lead-discover.ts`

## Deploy

```bash
npm run build
git add src/App.tsx api/lead-discover.ts
git commit -m "feat: progressive lead discovery and capture logs"
git push
```

## Observação técnica

O streaming usa `application/x-ndjson`. Em ambientes que bufferizem a resposta, o navegador pode receber grupos de eventos em vez de cada evento isoladamente; o protocolo do aplicativo continua progressivo e não depende de esperar o JSON final.
