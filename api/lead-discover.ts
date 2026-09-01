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
};

const UA = 'Leadcheck/1.0 (+public-business-discovery)';
const MAX_RESULTS = 200;
const MAX_SITES_TO_SCAN = 120;
const FETCH_TIMEOUT = 7000;

function clean(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}
function decodeHtml(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");
}
function absoluteUrl(value: string, base?: string) {
  try { return new URL(value, base).toString(); } catch { return ''; }
}
function normalizeUrl(value: string) {
  try { const u = new URL(value); u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/\/$/, '') || '/'; return u.toString(); } catch { return value; }
}
function hostOf(value: string) { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } }
function looksLikeBusinessSite(url: string) {
  const h = hostOf(url);
  return !!h && !/(facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|google\.|bing\.|duckduckgo\.|yelp\.|tripadvisor\.)/i.test(h);
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: controller.signal });
    if (!r.ok) return { status: r.status, text: '' };
    return { status: r.status, text: await r.text() };
  } catch { return { status: 0, text: '' }; }
  finally { clearTimeout(timer); }
}

function stripHtml(html: string) {
  return clean(decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')));
}

function extractContacts(html: string) {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const cnpjs = new Set<string>();
  for (const m of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const e = m[0].toLowerCase();
    if (!/example\.|sentry\.|wixpress\.|schema\.org/.test(e)) emails.add(e);
  }
  for (const m of html.matchAll(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-.\s]?\d{4}/g)) {
    const p = clean(m[0]);
    const digits = p.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) phones.add(p);
  }
  for (const m of html.matchAll(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g)) cnpjs.add(m[0]);
  return { email: [...emails][0], phone: [...phones][0], cnpj: [...cnpjs][0] };
}

function searchQueries(segment: string, city: string) {
  const q = clean(segment), c = clean(city);
  return [
    `"${q}" "${c}" empresa contato`,
    `"${q}" "${c}" telefone`,
    `"${q}" "${c}" email`,
    `"${q}" "${c}" site`,
    `${q} ${c} empresas`,
    `${q} ${c} contato comercial`,
    `${q} ${c} "fale conosco"`,
    `${q} ${c} "sobre nós"`,
  ];
}

async function duck(query: string, page: number): Promise<Result[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${page * 30}`;
  const { text } = await fetchText(url);
  if (!text) return [];
  const out: Result[] = [];
  const blocks = text.split(/result__body/i).slice(1);
  for (const block of blocks) {
    const a = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    let href = decodeHtml(a[1]);
    const uddg = href.match(/[?&]uddg=([^&]+)/i);
    if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch {} }
    href = absoluteUrl(href);
    if (!looksLikeBusinessSite(href)) continue;
    const title = stripHtml(a[2]);
    const sn = block.match(/result__snippet[^>]*>([\s\S]*?)<\/a?>/i)?.[1] || block.match(/result__snippet[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    out.push({ title, company: title, url: normalizeUrl(href), snippet: stripHtml(sn), source: 'duckduckgo' });
    if (out.length >= 30) break;
  }
  return out;
}

async function bing(query: string, page: number): Promise<Result[]> {
  const first = page * 10 + 1;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10`;
  const { text } = await fetchText(url);
  if (!text) return [];
  const out: Result[] = [];
  const blocks = text.split(/<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>/i).slice(1);
  for (const block of blocks) {
    const a = block.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const href = absoluteUrl(decodeHtml(a[1]));
    if (!looksLikeBusinessSite(href)) continue;
    const sn = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
    out.push({ title: stripHtml(a[2]), company: stripHtml(a[2]), url: normalizeUrl(href), snippet: stripHtml(sn), source: 'bing' });
  }
  return out;
}

async function scanSite(result: Result) {
  const root = result.url;
  const first = await fetchText(root);
  if (!first.text) return result;
  const contacts = extractContacts(first.text);
  let email = contacts.email, phone = contacts.phone, cnpj = contacts.cnpj;
  const links: string[] = [];
  for (const m of first.text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripHtml(m[2]);
    if (/(contato|contact|fale|atendimento|sobre|empresa|quem somos|ouvidoria)/i.test(label)) {
      const u = absoluteUrl(decodeHtml(m[1]), root);
      if (u && hostOf(u) === hostOf(root)) links.push(u);
    }
  }
  for (const u of [...new Set(links)].slice(0, 5)) {
    if (email && phone && cnpj) break;
    const p = await fetchText(u);
    if (!p.text) continue;
    const c = extractContacts(p.text);
    email ||= c.email; phone ||= c.phone; cnpj ||= c.cnpj;
  }
  return { ...result, email, phone, cnpj };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const query = String(req.body?.query || '').trim();
  const city = String(req.body?.city || '').trim();
  if (!query || !city) return res.status(400).json({ error: 'Informe segmento e cidade.' });

  try {
    const queries = searchQueries(query, city);
    const found = new Map<string, Result>();
    // Várias consultas e páginas; não existe limite de leads na UI. O teto técnico protege a função serverless.
    for (const q of queries) {
      for (let page = 0; page < 5; page++) {
        const [a, b] = await Promise.all([duck(q, page), bing(q, page)]);
        for (const item of [...a, ...b]) {
          if (!item.url) continue;
          found.set(normalizeUrl(item.url), item);
          if (found.size >= MAX_RESULTS) break;
        }
        if (found.size >= MAX_RESULTS) break;
        if (!a.length && !b.length) break;
      }
      if (found.size >= MAX_RESULTS) break;
    }
    const candidates = [...found.values()].filter(x => looksLikeBusinessSite(x.url)).slice(0, MAX_SITES_TO_SCAN);
    const scanned: Result[] = [];
    for (let i = 0; i < candidates.length; i += 8) {
      const batch = candidates.slice(i, i + 8);
      const rows = await Promise.all(batch.map(scanSite));
      scanned.push(...rows);
    }
    // Retorna inclusive empresas sem contato: isso permite que o CRM preserve a origem e que o scanner não descarte falsos negativos de site.
    const results = scanned.filter(r => r.title || r.company).map(r => ({ ...r, company: clean(r.company || r.title), title: clean(r.title || r.company) }));
    return res.status(200).json({ total: results.length, results, sources: ['DuckDuckGo', 'Bing', 'sites empresariais públicos'], free: true, googlePlaces: false });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Falha na busca pública.' });
  }
}
