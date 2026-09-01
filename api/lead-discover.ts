import type { VercelRequest, VercelResponse } from '@vercel/node';

type Result = {
  title: string;
  name: string;
  url: string;
  snippet: string;
  email?: string;
  phone?: string;
  source: string;
  intent: string;
  intentScore: number;
  product: string;
  location: string;
};

const UA = 'Leadcheck/2.0 (+public-intent-prospecting)';
const FETCH_TIMEOUT = 7000;
const MAX_RESULTS = 160;
const MAX_SCAN = 45;

function clean(s:string){return s.replace(/\s+/g,' ').trim();}
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function abs(v:string,b?:string){try{return new URL(v,b).toString()}catch{return ''}}
function norm(v:string){try{const u=new URL(v);u.hash='';u.search='';u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.toString()}catch{return v}}
function host(v:string){try{return new URL(v).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
function commercialSite(v:string){const h=host(v);return !!h&&!/(facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|google\.|bing\.|duckduckgo\.|reddit\.com)/i.test(h)}
function text(html:string){return clean(decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')))}
async function get(url:string){const c=new AbortController();const t=setTimeout(()=>c.abort(),FETCH_TIMEOUT);try{const r=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},redirect:'follow',signal:c.signal});return {status:r.status,text:r.ok?await r.text():''}}catch{return {status:0,text:''}}finally{clearTimeout(t)}}

function contacts(html:string){
 const emails=new Set<string>(),phones=new Set<string>();
 for(const m of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)){const e=m[0].toLowerCase();if(!/example\.|sentry\.|wixpress\.|schema\.org|cloudflare/i.test(e))emails.add(e)}
 for(const m of html.matchAll(/(?:\+55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}/g)){const d=m[0].replace(/\D/g,'');if(d.length>=10&&d.length<=13)phones.add(clean(m[0]))}
 return {email:[...emails][0],phone:[...phones][0]};
}

const PRODUCTS:Record<string,string[]>={
 'financiamento de veículo':['financiamento de veículo','financiamento carro','financiamento automóvel','parcela carro','juros financiamento veículo','revisão financiamento veículo','juros abusivos veículo'],
 'financiamento imobiliário':['financiamento imobiliário','financiamento de imóvel','financiamento casa','parcela imóvel','juros financiamento imóvel','revisão financiamento imobiliário'],
 'empréstimo':['empréstimo','empréstimo pessoal','crédito','juros empréstimo','parcela empréstimo','juros abusivos empréstimo','revisão de empréstimo'],
 'dívida / renegociação':['renegociação de dívida','dívida bancária','renegociar dívida','parcela dívida','acordo banco','negociar empréstimo'],
 'revisão contratual':['revisão de contrato','revisão de financiamento','juros abusivos','contrato bancário','revisar contrato','parcela abusiva']
};
function productKey(q:string){const s=clean(q).toLowerCase();for(const k of Object.keys(PRODUCTS))if(s.includes(k.split(' ')[0])||PRODUCTS[k].some(x=>s.includes(x)))return k;return 'financiamento de veículo';}
function queries(product:string,city:string){const terms=PRODUCTS[product]||PRODUCTS['financiamento de veículo'];const q:string[]=[];for(const t of terms.slice(0,5)){q.push(`"${t}" "${city}"`);q.push(`"${t}" "${city}" telefone`);q.push(`"${t}" "${city}" "fale comigo"`);q.push(`"${t}" "${city}" "preciso de ajuda"`);}return [...new Set(q)].slice(0,18);}
function score(snippet:string,title:string,product:string){const s=(title+' '+snippet).toLowerCase();let n=0;const terms=PRODUCTS[product]||[];for(const t of terms)if(s.includes(t))n+=12;if(/juros (abusivos|altos)|abusiv|revis|reduzir parcela|parcela alta|não consigo pagar|não consigo|renegociar|negociar|problema com|preciso de ajuda|procuro ajuda/i.test(s))n+=35;if(/financiamento|empréstimo|crédito|dívida|parcela/i.test(s))n+=15;return Math.min(100,n)}
function intentLabel(n:number){return n>=75?'Alta':n>=45?'Média':'Baixa'}

async function ddg(q:string):Promise<Result[]>{const r=await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);if(!r.text)return[];const out:Result[]=[];const blocks=r.text.split(/result__body/i).slice(1);for(const b of blocks){const a=b.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)||b.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;let u=decode(a[1]);const z=u.match(/[?&]uddg=([^&]+)/i);if(z)try{u=decodeURIComponent(z[1])}catch{};u=abs(u);if(!commercialSite(u))continue;const sn=b.match(/result__snippet[^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1]||'';const title=text(a[2]),snippet=text(sn);out.push({title,name:title,url:norm(u),snippet,source:'DuckDuckGo — busca pública',intent:'',intentScore:0,product:'',location:''});if(out.length>=20)break}return out}

async function googleNews(q:string):Promise<Result[]>{const r=await get(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`);if(!r.text)return[];const out:Result[]=[];for(const m of r.text.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>[\s\S]*?<\/item>/gi)){const title=text(m[1]),u=abs(decode(m[2]));if(!u)continue;const sn=text(m[3]);out.push({title,name:title,url:norm(u),snippet:sn,source:'Google News RSS — índice público',intent:'',intentScore:0,product:'',location:''});if(out.length>=15)break}return out}

async function scan(result:Result){if(!result.url||!commercialSite(result.url))return result;const first=await get(result.url);if(!first.text)return result;let {email,phone}=contacts(first.text);const links:string[]=[];for(const m of first.text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){if(/contato|contact|fale|atendimento|sobre|empresa|ouvidoria|sac|cliente/i.test(text(m[2]))){const u=abs(decode(m[1]),result.url);if(u&&host(u)===host(result.url))links.push(u)}}for(const p of ['/contato','/contact','/fale-conosco','/atendimento','/sobre','/quem-somos','/empresa','/ouvidoria','/sac'])links.push(abs(p,result.url));for(const u of [...new Set(links)].slice(0,7)){if(email&&phone)break;const r=await get(u);if(!r.text)continue;const c=contacts(r.text);email ||= c.email;phone ||= c.phone}return {...result,email,phone};}

export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 const product=productKey(String(req.body?.product||req.body?.query||'')),city=clean(String(req.body?.city||''));
 if(!city)return res.status(400).json({error:'Informe a cidade.'});
 try{
  const found=new Map<string,Result>();
  for(const q of queries(product,city)){const rows=await ddg(q);for(const x of rows){const k=host(x.url)+'|'+x.title.toLowerCase();if(!found.has(k))found.set(k,{...x,product,location:city})}if(found.size>=MAX_RESULTS)break;}
  // Índice público complementar, sem API key.
  for(const q of queries(product,city).slice(0,6)){const rows=await googleNews(q);for(const x of rows){const k=host(x.url)+'|'+x.title.toLowerCase();if(!found.has(k))found.set(k,{...x,product,location:city})}}
  const ranked=[...found.values()].map(x=>({...x,intentScore:score(x.snippet,x.title,product),intent:intentLabel(score(x.snippet,x.title,product))})).sort((a,b)=>b.intentScore-a.intentScore);
  const scanned:Result[]=[];for(let i=0;i<Math.min(ranked.length,MAX_SCAN);i+=4)scanned.push(...await Promise.all(ranked.slice(i,i+4).map(scan)));
  const final=[...scanned,...ranked.slice(MAX_SCAN)].sort((a,b)=>b.intentScore-a.intentScore);
  return res.status(200).json({total:final.length,results:final,product,city,free:true,paidApiRequired:false,googlePlaces:false,sources:['DuckDuckGo HTML — busca pública sem chave','Google News RSS — índice público sem chave','sites públicos acessíveis'],notes:'O motor procura sinais públicos de intenção sobre produtos financeiros. Não consulta bases privadas nem gera dados pessoais. Contatos são mantidos apenas quando publicados na página encontrada ou em página empresarial acessível.'});
 }catch(e){return res.status(500).json({error:e instanceof Error?e.message:'Falha na busca pública de intenção.'})}
}
