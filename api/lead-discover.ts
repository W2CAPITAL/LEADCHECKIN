import type { VercelRequest, VercelResponse } from '@vercel/node';

type Result = {
  title: string;
  company: string;
  url: string;
  snippet: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  source: string;
  address?: string;
  lat?: number;
  lon?: number;
};

const UA = 'Leadcheck/1.1 (+public-free-business-discovery)';
const FETCH_TIMEOUT = 6500;
const MAX_RESULTS = 180;
const MAX_SITES_TO_SCAN = 70;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function clean(s: string) { return s.replace(/\s+/g, ' ').trim(); }
function decodeHtml(s: string) { return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'"); }
function absoluteUrl(value: string, base?: string) { try { return new URL(value, base).toString(); } catch { return ''; } }
function normalizeUrl(value: string) { try { const u = new URL(value); u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/\/$/, '') || '/'; return u.toString(); } catch { return value; } }
function hostOf(value: string) { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function looksLikeBusinessSite(url: string) { const h = hostOf(url); return !!h && !/(facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|google\.|bing\.|duckduckgo\.|yelp\.|tripadvisor\.)/i.test(h); }
function escapeRegex(value: string) { return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&').replace(/\s+/g, '[\\s_-]*'); }
function htmlText(html: string) { return clean(decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))); }

async function fetchText(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8', ...(init.headers || {}) }, redirect: 'follow', signal: controller.signal });
    return { status: r.status, text: r.ok ? await r.text() : '' };
  } catch { return { status: 0, text: '' }; } finally { clearTimeout(timer); }
}

function extractContacts(html: string) {
  const emails = new Set<string>(), phones = new Set<string>(), cnpjs = new Set<string>();
  for (const m of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const e = m[0].toLowerCase();
    if (!/example\.|sentry\.|wixpress\.|schema\.org|cloudflare/i.test(e)) emails.add(e);
  }
  for (const m of html.matchAll(/(?:\+55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}/g)) {
    const p = clean(m[0]), digits = p.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) phones.add(p);
  }
  for (const m of html.matchAll(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g)) cnpjs.add(m[0]);
  return { email: [...emails][0], phone: [...phones][0], cnpj: [...cnpjs][0] };
}

function contactFromTags(tags: Record<string,string> = {}) {
  return {
    email: tags['contact:email'] || tags.email || undefined,
    phone: tags['contact:phone'] || tags.phone || tags['contact:mobile'] || undefined,
    cnpj: tags['ref:br:cnpj'] || undefined,
  };
}

function siteFromTags(tags: Record<string,string> = {}) {
  const raw = tags.website || tags['contact:website'] || tags.url || '';
  return raw ? normalizeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : '';
}

function segmentTerms(segment: string) {
  const s = clean(segment).toLowerCase();
  const groups: Record<string,string[]> = {
    emprestimo: ['emprestimo','empréstimo','credito','crédito','consignado','financeira','financiamento'],
    crédito: ['credito','crédito','emprestimo','empréstimo','financiamento','consignado'],
    credito: ['credito','crédito','emprestimo','empréstimo','financiamento','consignado'],
    advocacia: ['advocacia','advogado','advogados','escritorio de advocacia','escritório de advocacia'],
    imobiliaria: ['imobiliaria','imobiliária','imoveis','imóveis','corretora de imoveis','corretora de imóveis'],
    contabilidade: ['contabilidade','contador','contadores','escritorio contabil','escritório contábil'],
    seguros: ['seguros','corretora de seguros','seguro'],
  };
  const key = Object.keys(groups).find(k => s.includes(k));
  return [...new Set([s, ...(key ? groups[key] : [])])];
}

async function overpass(segment: string, city: string): Promise<Result[]> {
  const terms = segmentTerms(segment).map(escapeRegex);
  const regex = terms.join('|');
  const cityEsc = city.replace(/"/g, '\\"');
  const q = `[out:json][timeout:35];area["name"="${cityEsc}"]["boundary"="administrative"]->.a;(nwr(area.a)["name"~"${regex}",i];nwr(area.a)["brand"~"${regex}",i];nwr(area.a)["operator"~"${regex}",i];nwr(area.a)["description"~"${regex}",i];);out center tags;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: `data=${encodeURIComponent(q)}`, signal: controller.signal });
      if (!r.ok) continue;
      const json = await r.json() as { elements?: any[] };
      const out: Result[] = [];
      for (const el of json.elements || []) {
        const tags = el.tags || {}, name = clean(tags.name || tags.brand || tags.operator || '');
        if (!name) continue;
        const url = siteFromTags(tags);
        const c = contactFromTags(tags);
        const address = clean([tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb'], tags['addr:city'] || city].filter(Boolean).join(', '));
        out.push({ title: name, company: name, url, snippet: address || `Empresa encontrada no OpenStreetMap em ${city}.`, source: 'openstreetmap-overpass', ...c, address, lat: Number(el.lat ?? el.center?.lat) || undefined, lon: Number(el.lon ?? el.center?.lon) || undefined });
        if (out.length >= MAX_RESULTS) break;
      }
      if (out.length) return out;
    } catch { /* tenta o próximo endpoint */ } finally { clearTimeout(timer); }
  }
  return [];
}

async function duck(query: string): Promise<Result[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text } = await fetchText(url); if (!text) return [];
  const out: Result[] = [];
  const blocks = text.split(/result__body/i).slice(1);
  for (const block of blocks) {
    const a = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    let href = decodeHtml(a[1]); const uddg = href.match(/[?&]uddg=([^&]+)/i); if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch {} }
    href = absoluteUrl(href); if (!looksLikeBusinessSite(href)) continue;
    const snippet = block.match(/result__snippet[^>]*>([\s\S]*?)<\/a?>/i)?.[1] || block.match(/result__snippet[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    out.push({ title: htmlText(a[2]), company: htmlText(a[2]), url: normalizeUrl(href), snippet: htmlText(snippet), source: 'duckduckgo-public-search' });
    if (out.length >= 40) break;
  }
  return out;
}

async function scanSite(result: Result) {
  if (!result.url || !looksLikeBusinessSite(result.url)) return result;
  const first = await fetchText(result.url); if (!first.text) return result;
  const c0 = extractContacts(first.text); let email = result.email || c0.email, phone = result.phone || c0.phone, cnpj = result.cnpj || c0.cnpj;
  const links: string[] = [];
  for (const m of first.text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlText(m[2]);
    if (/(contato|contact|fale|atendimento|sobre|empresa|quem somos|ouvidoria|sac)/i.test(label)) {
      const u = absoluteUrl(decodeHtml(m[1]), result.url); if (u && hostOf(u) === hostOf(result.url)) links.push(u);
    }
  }
  const fallbackPaths = ['/contato','/contact','/fale-conosco','/atendimento','/sobre','/quem-somos','/empresa','/ouvidoria','/sac'];
  for (const p of fallbackPaths) links.push(absoluteUrl(p, result.url));
  for (const u of [...new Set(links)].slice(0, 8)) {
    if (email && phone && cnpj) break;
    const page = await fetchText(u); if (!page.text) continue;
    const c = extractContacts(page.text); email ||= c.email; phone ||= c.phone; cnpj ||= c.cnpj;
  }
  return { ...result, email, phone, cnpj };
}

async function brasilApi(cnpj: string) {
  const digits = cnpj.replace(/\D/g, ''); if (digits.length !== 14) return null;
  const r = await fetchText(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, { headers: { accept: 'application/json' } });
  if (!r.text) return null; try { return JSON.parse(r.text); } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const query = clean(String(req.body?.query || '')), city = clean(String(req.body?.city || ''));
  if (!query || !city) return res.status(400).json({ error: 'Informe segmento e cidade.' });
  try {
    const found = new Map<string, Result>();
    const osm = await overpass(query, city);
    for (const item of osm) {
      const key = item.url ? hostOf(item.url) : normalizeUrl(`${item.company}|${item.address || city}`);
      if (key) found.set(key, item);
    }
    // Busca pública somente como segunda camada, para encontrar empresas que não estão mapeadas no OSM.
    const searchQueries = [
      `"${query}" "${city}" empresa contato`,
      `"${query}" "${city}" telefone`,
      `"${query}" "${city}" "fale conosco"`,
      `"${query}" "${city}" site`,
    ];
    for (const q of searchQueries) {
      const rows = await duck(q);
      for (const item of rows) {
        const key = hostOf(item.url); if (key && !found.has(key)) found.set(key, item);
      }
    }
    const candidates = [...found.values()].slice(0, MAX_SITES_TO_SCAN);
    const scanned: Result[] = [];
    for (let i = 0; i < candidates.length; i += 4) {
      const rows = await Promise.all(candidates.slice(i, i + 4).map(scanSite));
      scanned.push(...rows);
    }
    // BrasilAPI é usada somente para um CNPJ que já foi encontrado publicamente; não fazemos varredura de CNPJ.
    const enriched = await Promise.all(scanned.map(async item => {
      if (!item.cnpj) return item;
      const data = await brasilApi(item.cnpj);
      if (!data) return item;
      const detail = [item.snippet, data.razao_social || data.nome_fantasia].filter(Boolean).join(' · ');
      return { ...item, company: item.company || data.nome_fantasia || data.razao_social || item.title, snippet: detail };
    }));
    return res.status(200).json({
      total: enriched.length,
      results: enriched,
      free: true,
      sources: ['OpenStreetMap Overpass (gratuito)', 'DuckDuckGo HTML (fallback público)', 'sites empresariais públicos', 'BrasilAPI CNPJ sob demanda'],
      googlePlaces: false,
      paidApiRequired: false,
      notes: 'Resultados dependem da cobertura pública das fontes e da disponibilidade dos sites. Nenhuma lista privada de consumidores é consultada.'
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Falha na busca pública.' });
  }
}
