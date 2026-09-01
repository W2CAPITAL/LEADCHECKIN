# Leadcheck — fontes públicas gratuitas

Esta versão não exige Google Places, cartão de crédito, n8n ou API paga.

## 1. OpenStreetMap / Overpass — principal fonte de descoberta

Endpoint principal:
https://overpass-api.de/api/interpreter

Fallback:
https://overpass.private.coffee/api/interpreter

O Leadcheck consulta empresas/estabelecimentos mapeados no OpenStreetMap dentro da cidade informada, usando nome, marca, operador e descrição para encontrar o segmento. Quando o OSM possui `website`, `contact:email`, `contact:phone` ou CNPJ publicado, esses dados são aproveitados.

A infraestrutura pública é gratuita, mas não é ilimitada. O projeto deve respeitar as políticas dos operadores, manter requisições moderadas e tratar 429/5xx com fallback.

## 2. DuckDuckGo HTML — fallback público

Endpoint usado pelo servidor:
https://html.duckduckgo.com/html/

É usado somente como segunda camada para descobrir sites que não estejam mapeados no OpenStreetMap. O Leadcheck não depende exclusivamente dele.

## 3. BrasilAPI — enriquecimento pontual de CNPJ

Documentação:
https://brasilapi.com.br/docs

Endpoint:
https://brasilapi.com.br/api/cnpj/v1/{CNPJ}

O Leadcheck NÃO varre CNPJs. Só consulta um CNPJ quando ele já foi encontrado/publicado pela própria fonte empresarial.

## Fluxo

Segmento + cidade
→ OpenStreetMap/Overpass
→ fallback de busca pública
→ sites empresariais
→ páginas de contato/SAC/atendimento/sobre
→ e-mail/telefone/CNPJ publicados
→ BrasilAPI somente para CNPJ já encontrado
→ deduplicação
→ CRM Supabase

## O que não é usado

- Google Places
- Google Maps API
- n8n
- APIs de enriquecimento pagas
- listas privadas de consumidores
- CPF → celular/WhatsApp
- varredura massiva de CNPJ
