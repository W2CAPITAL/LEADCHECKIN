import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (compatible; LeadcheckBusinessFinder/2.0; +https://leadcheck.app)';
const BLOCKED = /(facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|maps\.google|pinterest)/i;

function clean(s: string) { return s.replace(/\s+/g, ' ').trim(); }
function validUrl(raw: string) { try { const u = new URL(raw); return ['http:', 'https:'].includes(u.protocol); } catch { return false; } }
function host(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function decodeDuck(url: string) { try { const u = new URL(url, 'https://duckduckgo.com'); const uddg = u.searchParams.get('uddg'); return uddg ? decodeURIComponent(uddg) : url; } catch { return url; } }
function titleCaseFromHost(h: string) { return h.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function extractContacts(html: string) {
  const emails = [...html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(m => m[0].toLowerCase())
    .filter(e => !/example\.(com|org)|\.png$|\.jpg$|\.webp$/i.test(e));
  const phones = [...html.matchAll(/(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9\d{4}|\d{4})[\s.-]?\d{4}/g)]
    .map(m => m[0].replace(/\D/g, '')).filter(p => p.length >= 10 && p.length <= 13);
  const cnpjs = [...html.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)].map(m => m[0].replace(/\D/g, ''));
  return { email: [...new Set(emails)][0] || null, phone: [...new Set(phones)][0] || null, cnpj: [...new Set(cnpjs)][0] || null };
}

async function fetchText(url: string, ms = 5500) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: c.signal });
    if (!r.ok) return { status: r.status, text: '', finalUrl: url };
    return { status: r.status, text: (await r.text()).slice(0, 1200000), finalUrl: r.url || url };
  } catch { return { status: 0, text: '', finalUrl: url }; }
  finally { clearTimeout(t); }
}

async function searchDuck(query: string, page = 0) {
  const offset = page * 40;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${offset}`;
  const r = await fetchText(url, 8000); if (!r.text) return [];
  const results: string[] = [];
  for (const m of r.text.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = decodeDuck(m[1]); if (validUrl(u) && !BLOCKED.test(host(u))) results.push(u);
  }
  return [...new Set(results)];
}

async function searchGooglePlaces(query: string, city: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  const out: any[] = []; let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const body: any = { textQuery: `${query} em ${city}`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,nextPageToken' }, body: JSON.stringify(body)
    });
    if (!r.ok) break;
    const data = await r.json();
    for (const x of data.places || []) out.push({ company: x.displayName?.text, title: x.displayName?.text, url: x.websiteUri || null, phone: x.nationalPhoneNumber || null, address: x.formattedAddress || null, source: 'google_places', place_id: x.id });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  return out;
}

async function enrichCnpj(cnpj: string | null) {
  if (!cnpj) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { 'user-agent': 'Leadcheck/2.0' } });
    if (!r.ok) return null;
    const x = await r.json();
    return { cnpj, fantasia: x.nome_fantasia || null, razao_social: x.razao_social || null, situacao: x.descricao_situacao_cadastral || null, atividade_principal: x.cnae_fiscal_descricao || null, municipio: x.municipio || null, uf: x.uf || null };
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const query = clean(String(req.body?.query || '')); const city = clean(String(req.body?.city || ''));
  if (query.length < 2 || city.length < 2) return res.status(400).json({ error: 'Informe segmento e cidade.' });

  try {
    // Sem limite artificial no produto: várias formulações e páginas são consultadas e deduplicadas.
    const variants = [
      `${query} ${city} empresa`, `${query} ${city} contato`, `${query} ${city} telefone`,
      `${query} ${city} email`, `${query} ${city} site`, `${query} ${city} endereço`,
      `"${query}" "${city}"`, `${query} bairro ${city}`
    ];
    const urlSet = new Set<string>();
    for (let page = 0; page < 3; page++) {
      const pageResults = await Promise.all(variants.map(v => searchDuck(v, page)));
      for (const urls of pageResults) for (const u of urls) urlSet.add(u);
      // Não existe um total confiável no buscador; seguimos até três páginas por formulação e entregamos tudo que foi encontrado nessas consultas.
      if (urlSet.size >= 250) break;
    }

    const [google] = await Promise.all([searchGooglePlaces(query, city)]);
    const results: any[] = [...google];
    const urls = [...urlSet];
    for (let i = 0; i < urls.length; i += 8) {
      const batch = urls.slice(i, i + 8);
      const pages = await Promise.all(batch.map(u => fetchText(u)));
      for (let j = 0; j < pages.length; j++) {
        const page = pages[j], u = batch[j], h = host(page.finalUrl || u); if (!h || !page.text) continue;
        const c = extractContacts(page.text);
        const title = clean((page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '')) || titleCaseFromHost(h);
        const text = clean(page.text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).slice(0, 500);
        results.push({ company: title.slice(0, 180), title: title.slice(0, 180), url: page.finalUrl || u, email: c.email, phone: c.phone, cnpj: c.cnpj, snippet: text, siteStatus: page.status, source: 'busca_publica' });
      }
    }

    const seen = new Set<string>(); const final: any[] = [];
    for (const item of results) {
      const key = String(item.place_id || item.url || `${item.company}|${item.phone || ''}|${item.email || ''}`).toLowerCase();
      if (seen.has(key)) continue; seen.add(key);
      final.push(item);
    }
    // Enriquece somente CNPJ que a própria página pública expôs; não tenta descobrir CPF/telefone privado.
    for (let i = 0; i < final.length; i += 6) {
      const part = final.slice(i, i + 6); const enriched = await Promise.all(part.map(x => enrichCnpj(x.cnpj || null)));
      enriched.forEach((x, idx) => { if (x) final[i + idx].cnpj_data = x; });
    }

    return res.json({ ok: true, query, city, results: final, total: final.length, sources: { duckduckgo: true, googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY), brasilApiCnpj: true }, generatedAt: new Date().toISOString() });
  } catch (e) { return res.status(502).json({ error: e instanceof Error ? e.message : 'Falha na busca pública' }); }
}
