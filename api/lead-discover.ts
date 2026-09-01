import type { VercelRequest, VercelResponse } from '@vercel/node';

type LeadResult = {
  title: string;
  company: string;
  url: string;
  snippet: string;
  source: string;
  intent: string;
  score: number;
  personName?: string;
  contactStatus?: string;
  email?: string;
  phone?: string;
};

type LogEvent = { type: 'log' | 'lead' | 'done' | 'error'; source?: string; message?: string; result?: LeadResult; total?: number };

const UA = 'Leadcheck/2.0 (+public-intent-discovery)';
const FETCH_TIMEOUT = 7000;
const MAX_RESULTS = 120;
const MAX_QUERY_RESULTS = 12;

function clean(s: string) { return s.replace(/\s+/g, ' ').trim(); }
function decodeHtml(s: string) { return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function absoluteUrl(value: string, base?: string) { try { return new URL(value, base).toString(); } catch { return ''; } }
function normalizeUrl(value: string) { try { const u = new URL(value); u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/\/$/, '') || '/'; return u.toString(); } catch { return value; } }
function hostOf(value: string) { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function htmlText(html: string) { return clean(decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))); }

async function fetchText(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7', ...(init.headers || {}) }, redirect: 'follow', signal: controller.signal });
    return { status: r.status, text: r.ok ? await r.text() : '' };
  } catch { return { status: 0, text: '' }; } finally { clearTimeout(timer); }
}

function intentProfile(segment: string) {
  const s = clean(segment).toLowerCase();
  if (/consignad/.test(s)) return { label: 'Consignado', terms: ['consignado', 'empréstimo consignado', 'margem consignável', 'desconto em folha', 'parcela consignado'] };
  if (/financiamento.*ve[ií]culo|ve[ií]culo.*financiamento|carro financiado|moto financiada/.test(s)) return { label: 'Financiamento de veículo', terms: ['financiamento de veículo', 'carro financiado', 'moto financiada', 'juros financiamento carro', 'revisão financiamento veículo', 'parcela carro'] };
  if (/im[oó]vel|habitacional/.test(s)) return { label: 'Financiamento imobiliário', terms: ['financiamento imobiliário', 'financiamento de imóvel', 'juros financiamento imóvel', 'revisão financiamento imobiliário', 'parcela imóvel'] };
  if (/despachante/.test(s)) return { label: 'Despachante', terms: ['despachante', 'documentação veículo', 'transferência veículo'] };
  if (/empr[eé]stimo|cr[eé]dito/.test(s)) return { label: 'Empréstimo / crédito', terms: ['empréstimo', 'crédito', 'empréstimo consignado', 'juros empréstimo', 'revisão empréstimo', 'parcela empréstimo'] };
  return { label: s, terms: [s] };
}

const intentSignals = [
  /juros\s+(abusivos?|altos?)/i, /parcela\s+(alta|pesada|aumentou)/i, /revis[aã]o\s+(do|de|da)\s+(contrato|financiamento|empr[eé]stimo)/i,
  /revisar\s+(meu|minha)\s+(contrato|financiamento|empr[eé]stimo)/i, /financiamento\s+.*(juros|parcela|problema)/i,
  /empr[eé]stimo\s+.*(juros|parcela|problema)/i, /renegociar|renegocia[cç][aã]o/i, /n[aã]o\s+consigo\s+pagar/i,
  /quero\s+(reduzir|diminuir|baixar)\s+(a\s+)?parcela/i, /cobran[cç]a\s+indevida/i, /contrato\s+abusivo/i,
  /taxa\s+(de\s+)?juros/i, /meu\s+financiamento/i, /meu\s+empr[eé]stimo/i
];

function scoreIntent(text: string, profile: ReturnType<typeof intentProfile>) {
  let score = 15;
  for (const re of intentSignals) if (re.test(text)) score += 10;
  if (profile.terms.some(t => text.toLowerCase().includes(t.toLowerCase()))) score += 20;
  if (/revis[aã]o|juros abusivos?|contrato abusivo|n[aã]o consigo pagar|renegociar/i.test(text)) score += 20;
  return Math.min(100, score);
}

function extractPersonName(title: string, snippet: string) {
  const text = clean(`${title} ${snippet}`);
  const m = text.match(/(?:por|postado por|usu[aá]rio|u\/|autor)\s*[:\-]?\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ]{2,}(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ]{2,}){0,3})/);
  return m?.[1];
}

function isSocialOrCommunity(url: string) {
  const h = hostOf(url);
  return /reddit\.com|youtube\.com|youtu\.be|facebook\.com|reclameaqui\.com\.br|tiktok\.com|x\.com|twitter\.com/i.test(h);
}

async function duck(query: string): Promise<LeadResult[]> {
  const { text } = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!text) return [];
  const out: LeadResult[] = [];
  const blocks = text.split(/result__body/i).slice(1);
  for (const block of blocks) {
    const a = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    let href = decodeHtml(a[1]); const uddg = href.match(/[?&]uddg=([^&]+)/i); if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch {} }
    href = absoluteUrl(href); if (!href) continue;
    const snippet = htmlText(block.match(/result__snippet[^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || '');
    out.push({ title: htmlText(a[2]), company: '', url: normalizeUrl(href), snippet, source: isSocialOrCommunity(href) ? 'busca-publica-comunidade' : 'busca-publica', intent: '', score: 0, personName: extractPersonName(htmlText(a[2]), snippet), contactStatus: 'Não coletado automaticamente de redes/comunidades' });
    if (out.length >= MAX_QUERY_RESULTS) break;
  }
  return out;
}

async function bingRss(query: string): Promise<LeadResult[]> {
  const { text } = await fetchText(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
  if (!text) return [];
  const out: LeadResult[] = [];
  for (const item of text.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = item[1];
    const title = clean(decodeHtml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''));
    const link = decodeHtml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
    const description = htmlText(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
    if (!link) continue;
    out.push({ title, company: '', url: normalizeUrl(link), snippet: description, source: isSocialOrCommunity(link) ? 'bing-comunidade' : 'bing-public-search', intent: '', score: 0, personName: extractPersonName(title, description), contactStatus: 'Não coletado automaticamente de redes/comunidades' });
  }
  return out.slice(0, MAX_QUERY_RESULTS);
}

async function googleNews(query: string): Promise<LeadResult[]> {
  const { text } = await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`, { headers: { accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8' } });
  if (!text) return [];
  const out: LeadResult[] = [];
  for (const item of text.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = item[1];
    const title = clean(decodeHtml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''));
    const link = decodeHtml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
    const description = htmlText(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
    if (!link) continue;
    out.push({ title, company: '', url: normalizeUrl(link), snippet: description, source: 'google-news-rss', intent: '', score: 0, personName: extractPersonName(title, description), contactStatus: 'Fonte pública; contato não coletado automaticamente' });
  }
  return out.slice(0, MAX_QUERY_RESULTS);
}

function queriesFor(profile: ReturnType<typeof intentProfile>, city: string) {
  const base = profile.terms.slice(0, 4);
  const q: string[] = [];
  for (const term of base) {
    q.push(`"${term}" "${city}" "juros abusivos"`);
    q.push(`"${term}" "${city}" "revisão"`);
    q.push(`"${term}" "${city}" "parcela"`);
  }
  for (const site of ['reddit.com', 'reclameaqui.com.br', 'youtube.com', 'facebook.com']) {
    q.push(`site:${site} "${base[0]}" "${city}" ("juros" OR "parcela" OR "revisão")`);
  }
  return [...new Set(q)].slice(0, 18);
}

async function emit(res: VercelResponse, event: LogEvent) {
  res.write(`${JSON.stringify(event)}\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const query = clean(String(req.body?.query || '')), city = clean(String(req.body?.city || ''));
  if (!query || !city) return res.status(400).json({ error: 'Informe o produto/interesse e a cidade.' });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  try {
    const profile = intentProfile(query);
    const found = new Map<string, LeadResult>();
    const queries = queriesFor(profile, city);
    await emit(res, { type: 'log', source: 'Motor de intenção', message: `Iniciando prospecção pública para ${profile.label} em ${city}.` });
    await emit(res, { type: 'log', source: 'Política de dados', message: 'O motor procura sinais públicos de intenção. Não coleta CPF, dados bancários, score ou listas privadas de pessoas.' });

    for (const q of queries) {
      await emit(res, { type: 'log', source: 'Busca pública', message: `Consultando: ${q}` });
      const [duckRows, bingRows] = await Promise.all([duck(q), bingRss(q)]);
      const rows = [...duckRows, ...bingRows];
      await emit(res, { type: 'log', source: 'Busca pública', message: `${rows.length} resultados brutos nesta consulta.` });
      for (const row of rows) {
        const text = `${row.title} ${row.snippet}`;
        const score = scoreIntent(text, profile);
        if (score < 45) continue;
        const key = `${hostOf(row.url)}|${clean(row.title).toLowerCase()}|${clean(row.snippet).slice(0, 120).toLowerCase()}`;
        if (found.has(key)) continue;
        const result: LeadResult = { ...row, intent: profile.label, score };
        found.set(key, result);
        await emit(res, { type: 'lead', result, total: found.size });
        if (found.size >= MAX_RESULTS) break;
      }
      if (found.size >= MAX_RESULTS) break;
    }

    await emit(res, { type: 'log', source: 'Comunidades públicas', message: 'Consultando resultados indexados de Reddit, Reclame Aqui, YouTube e Facebook. O Leadcheck registra a oportunidade e a fonte, mas não raspa CPF, telefone ou e-mail pessoal dessas plataformas.' });
    const communityQueries = queriesFor(profile, city).filter(q => /site:(reddit|reclameaqui|youtube|facebook)/.test(q)).slice(0, 6);
    for (const q of communityQueries) {
      const rows = await googleNews(q);
      for (const row of rows) {
        const text = `${row.title} ${row.snippet}`;
        const score = scoreIntent(text, profile);
        if (score < 45) continue;
        const key = `${hostOf(row.url)}|${clean(row.title).toLowerCase()}|${clean(row.snippet).slice(0, 120).toLowerCase()}`;
        if (found.has(key)) continue;
        const result = { ...row, intent: profile.label, score, source: 'google-news-public-index' };
        found.set(key, result);
        await emit(res, { type: 'lead', result, total: found.size });
      }
    }
    await emit(res, { type: 'done', total: found.size, message: `${found.size} oportunidades públicas encontradas.` });
    res.end();
  } catch (e) {
    await emit(res, { type: 'error', source: 'Motor de intenção', message: e instanceof Error ? e.message : 'Falha na prospecção pública.' });
    res.end();
  }
}
