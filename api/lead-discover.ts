import type { VercelRequest, VercelResponse } from '@vercel/node';

type LeadResult = {
  title:string; company?:string; url:string; snippet:string; source:string; intent:string; score:number;
  personName?:string; email?:string; phone?:string; contactType?:'phone'|'email'|'both'|'none'; contactStatus?:string;
  isPerson?:boolean; profileUrl?:string; contactUrl?:string; discoveredVia?:string;
};
type Event = {type:'log'|'lead'|'rejected'|'done'|'error'|'stats'; source?:string; message?:string; result?:LeadResult; total?:number; eligible?:number; rejected?:number; nextCursor?:number};

const UA='Leadcheck/4.0 (+public-intent-contact-discovery)';
const FETCH_TIMEOUT=2400;
const RUN_BUDGET_MS=8200;
const MAX_SEED_RESULTS=30;
const MAX_FOLLOWUP_RESULTS=30;
const MAX_PAGE_LINKS=8;
const CONTACT_HUB_HOSTS=['linktr.ee','beacons.ai','bio.site','taplink.cc','carrd.co','solo.to','msha.ke','lnk.bio','wa.me','api.whatsapp.com'];

function clean(s:string){return s.replace(/\s+/g,' ').trim();}
function decode(s:string){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function host(v:string){try{return new URL(v).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}
function normUrl(v:string){try{const u=new URL(v);u.hash='';return u.toString();}catch{return v;}}
function absUrl(v:string,base:string){try{return new URL(v,base).toString();}catch{return '';}}
function htmlText(h:string){return clean(decode(h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ')));}
function withinBudget(start:number){return Date.now()-start<RUN_BUDGET_MS;}
async function fetchText(url:string,headers:Record<string,string>={}){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),FETCH_TIMEOUT);
  try{const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':UA,accept:'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',...headers}});return{status:r.status,url:r.url||url,text:r.ok?await r.text():''};}
  catch{return{status:0,url,text:''};}finally{clearTimeout(t);}
}
function validPhone(v:string){const d=v.replace(/\D/g,'');return d.length>=10&&d.length<=13;}
function normalizePhone(v:string){const d=v.replace(/\D/g,'');if(d.startsWith('55')&&d.length>=12)return `+${d}`;if(d.length===10||d.length===11)return `+55${d}`;return v.trim();}
function extractPhones(text:string){
  const raw=[...text.matchAll(/(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/g)].map(m=>m[0].trim());
  return [...new Set(raw.map(normalizePhone).filter(validPhone))].slice(0,12);
}
function extractEmails(text:string){return [...new Set([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(m=>m[0].toLowerCase()).filter(v=>!/(example|wix|wordpress|sentry|noreply|no-reply)\./.test(v)))].slice(0,12);}
function extractTelAndWa(h:string){
  const out:string[]=[]; for(const m of h.matchAll(/(?:href|content)=["']([^"']+)["']/gi)){const v=decode(m[1]); if(/^tel:/i.test(v)||/wa\.me|api\.whatsapp\.com/i.test(v))out.push(v);}
  return out;
}
function nameFromMeta(html:string){
  const patterns=[
    /<meta[^>]+(?:name|property)=["'](?:author|article:author|profile:first_name)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+(?:name|property)=["'](?:author|article:author|profile:first_name)["'][^>]*>/i
  ];
  for(const p of patterns){const m=html.match(p);if(m?.[1])return clean(decode(m[1]));}
  const first=html.match(/<meta[^>]+property=["']profile:first_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const last=html.match(/<meta[^>]+property=["']profile:last_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if(first&&last)return clean(`${decode(first)} ${decode(last)}`);
  return undefined;
}
function extractName(title:string,snippet:string,html=''){
  const meta=nameFromMeta(html); if(meta&&meta.split(/\s+/).length>=2)return meta;
  const text=clean(`${title} ${snippet}`);
  const patterns=[
    /(?:por|postado por|autor|autor(a)?|u\/|usu[aá]rio|de)\s*[:\-]?\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'’-]{2,}(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'’-]{2,}){1,3})/i,
    /^([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'’-]{2,}(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'’-]{2,}){1,3})\s*[–-]/,
  ];
  for(const p of patterns){const m=text.match(p);if(m?.[1])return clean(m[1]);}
  return undefined;
}
function looksPerson(text:string){const t=text.toLowerCase();return /\b(meu|minha|fiz|peguei|contratei|tenho|estou|preciso|quero|não consigo|nao consigo|alguém|alguem|eu|minha dívida|minha divida|minha parcela|meu contrato|me cobraram|descontaram|holerite|folha|salário|salario)\b/.test(t);}
function intentScore(text:string,product:string){let s=25;const t=text.toLowerCase();for(const w of product.toLowerCase().split(/\s+/).filter(x=>x.length>3))if(t.includes(w))s+=5;for(const x of ['juros abusivos','juros altos','reduzir parcela','redução de parcela','revisão','revisar contrato','contrato','cobrança indevida','desconto em folha','parcela alta','dívida','divida','portabilidade','não consigo pagar','nao consigo pagar','meu empréstimo','meu emprestimo','minha parcela'])if(t.includes(x))s+=8;return Math.min(100,s);}
function relevant(text:string){return /juros|parcela|revis|contrat|emprést|emprest|financ|consign|dívida|divida|cobrança|cobranca|desconto|folha|portabilidade/i.test(text);}
function publicSocialHost(value:string){const h=host(value);return ['reddit.com','reclameaqui.com.br','youtube.com','facebook.com','instagram.com','tiktok.com','quora.com','x.com','threads.net','linkedin.com','medium.com','consumidor.gov.br'].some(x=>h===x||h.endsWith(`.${x}`));}
function likelyOrganization(text:string,url:string){const t=text.toLowerCase();const h=host(url);if(/\b(s\.a\.?|ltda|me\.?|eireli|banco|financeira|fintech|instituição|instituicao|empresa|portal|plataforma|site oficial|oficial|s\.a)\b/.test(t))return true;const known=['bb.com.br','finanzero.com.br','jurosbaixos.com.br','simplic.com.br','supersim.com.br','ciclic.com.br','financera.com.br'];if(known.some(x=>h===x||h.endsWith(`.${x}`)))return true;return false;}
function personSeedOk(row:LeadResult,name?:string){if(!name||likelyOrganization(`${row.title} ${row.snippet}`,row.url))return false;const text=`${row.title} ${row.snippet}`;return publicSocialHost(row.url)&&looksPerson(text);}
function searchQueries(product:string,city:string){
  const base=product.trim(); const cityQ=city.trim();
  const pain=['"juros abusivos"','"juros altos"','"reduzir parcela"','"parcela alta"','"cobrança indevida"','"desconto em folha"','"revisão de contrato"','"quero revisar"','"meu empréstimo"','"minha parcela"','"não consigo pagar"','"não aguento mais pagar"','"quanto estou pagando de juros"','"CET" "empréstimo"'];
  const sources=['reddit.com','reclameaqui.com.br','youtube.com','facebook.com','instagram.com','tiktok.com','quora.com','jusbrasil.com.br','x.com','threads.net','linkedin.com','medium.com'];
  const qs:string[]=[];
  for(const p of pain){qs.push(`"${base}" "${cityQ}" ${p}`);qs.push(`"${cityQ}" ${p} "${base}"`);qs.push(`"${base}" "${cityQ}" ${p} contato`);qs.push(`"${base}" "${cityQ}" ${p} whatsapp`);}
  for(const site of sources){for(const p of pain.slice(0,9)){qs.push(`site:${site} "${base}" ${p} "${cityQ}"`);qs.push(`site:${site} "${base}" ${p} (whatsapp OR telefone OR contato OR email)`);}}
  // Public profile/contact discovery. These don't target private areas; they ask search indexes for public contact pages.
  qs.push(`site:instagram.com "${base}" "${cityQ}" (whatsapp OR contato OR telefone OR email)`);
  qs.push(`site:facebook.com "${base}" "${cityQ}" (whatsapp OR contato OR telefone OR email)`);
  qs.push(`site:youtube.com "${base}" "${cityQ}" (contato OR whatsapp OR telefone OR email)`);
  qs.push(`site:linkedin.com "${base}" "${cityQ}" (whatsapp OR telefone OR email)`);
  qs.push(`site:x.com "${base}" "${cityQ}" (whatsapp OR telefone OR email)`);
  qs.push(`site:threads.net "${base}" "${cityQ}" (whatsapp OR telefone OR email)`);
  qs.push(`"${cityQ}" "${base}" "whatsapp" "instagram"`);
  qs.push(`"${cityQ}" "${base}" "telefone" "instagram"`);
  return [...new Set(qs)];
}
async function searchDuck(q:string){
  const r=await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`); if(!r.text)return[]; const out:LeadResult[]=[];
  for(const block of r.text.split(/result__body/i).slice(1)){const a=block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)||block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;let href=decode(a[1]);const m=href.match(/[?&]uddg=([^&]+)/i);if(m)try{href=decodeURIComponent(m[1]);}catch{}href=absUrl(href,'https://duckduckgo.com');if(!href)continue;const title=htmlText(a[2]);const snippet=htmlText(block.match(/result__snippet[^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1]||'');out.push({title,url:normUrl(href),snippet,source:/reddit|reclameaqui|youtube|facebook|instagram|tiktok|quora|jusbrasil/i.test(host(href))?'busca-comunidade':'busca-publica',intent:'',score:0});if(out.length>=10)break;} return out;
}
async function searchBing(q:string){
  const r=await fetchText(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`,{'accept':'application/rss+xml,application/xml,text/xml;q=0.9'});if(!r.text)return[];const out:LeadResult[]=[];
  for(const item of r.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const b=item[1];const title=clean(decode(b.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||''));const link=decode(b.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'');const snippet=htmlText(b.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'');if(link)out.push({title,url:normUrl(link),snippet,source:/reddit|reclameaqui|youtube|facebook|instagram|tiktok|quora|jusbrasil/i.test(host(link))?'bing-comunidade':'bing-publica',intent:'',score:0});if(out.length>=10)break;} return out;
}
async function searchGoogleNews(q:string){
  const rss=`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`; const r=await fetchText(rss,{'accept':'application/rss+xml,application/xml,text/xml;q=0.9'});if(!r.text)return[];const out:LeadResult[]=[];
  for(const item of r.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const b=item[1];const title=htmlText(b.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'');const link=decode(b.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'');const desc=htmlText(b.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'');if(link)out.push({title,url:normUrl(link),snippet:desc,source:'google-news-public-index',intent:'',score:0});if(out.length>=10)break;}return out;
}
function contactLinks(html:string,base:string){const out:string[]=[];for(const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const href=absUrl(decode(m[1]),base);if(!href)continue;const h=host(href);const label=htmlText(m[2]);if(/contato|contact|fale|atendimento|whatsapp|telefone|email|e-?mail|instagram|facebook|linktr|beacons|bio\.site|telefone|celular/i.test(`${label} ${href}`)||CONTACT_HUB_HOSTS.some(x=>h===x||h.endsWith(`.${x}`)))out.push(normUrl(href));}return[...new Set(out)].slice(0,MAX_PAGE_LINKS);}
function parseJsonLd(html:string){const names:string[]=[];for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const raw=JSON.parse(m[1]);const arr=Array.isArray(raw)?raw:[raw];for(const x of arr){if(typeof x==='object'&&x){const n=typeof x.author==='object'?x.author?.name:x.author;const pn=typeof x.name==='string'?x.name:undefined;if(typeof n==='string')names.push(clean(n));if(pn)names.push(clean(pn));}}}catch{}}return names.find(n=>n.split(/\s+/).length>=2);}
async function enrich(row:LeadResult, start:number):Promise<LeadResult>{
  let personName=extractName(row.title,row.snippet); let emails=extractEmails(`${row.title} ${row.snippet}`);let phones=extractPhones(`${row.title} ${row.snippet}`);let contactUrl='';let page=row.url;
  const primary=await fetchText(row.url);
  if(primary.text){
    page=primary.url||row.url; const visible=htmlText(primary.text).slice(0,180000);
    const hrefContacts=extractTelAndWa(primary.text);
    phones=[...new Set([...phones,...extractPhones(visible),...hrefContacts.flatMap(extractPhones)])].slice(0,12);
    emails=[...new Set([...emails,...extractEmails(primary.text),...extractEmails(visible)])].slice(0,12);
    personName=personName||parseJsonLd(primary.text)||extractName('',visible.slice(0,20000),primary.text);
    const links=contactLinks(primary.text,page);
    for(const link of links){
      if(!withinBudget(start))break;
      const h=host(link);
      // Only follow contact channels that are explicitly linked from the public page/profile.
      if(/^(tel:|mailto:)/i.test(link)||/wa\.me|api\.whatsapp\.com/i.test(link)){contactUrl=link;phones=[...new Set([...phones,...extractPhones(link)])];emails=[...new Set([...emails,...extractEmails(link)])];continue;}
      if(CONTACT_HUB_HOSTS.some(x=>h===x||h.endsWith(`.${x}`))){const r=await fetchText(link);if(r.text){contactUrl=r.url||link;const v=htmlText(r.text).slice(0,100000);phones=[...new Set([...phones,...extractPhones(v),...extractTelAndWa(r.text).flatMap(extractPhones)])].slice(0,12);emails=[...new Set([...emails,...extractEmails(r.text),...extractEmails(v)])].slice(0,12);personName=personName||parseJsonLd(r.text)||nameFromMeta(r.text);}}
      // Social links are only inspected for contact information visible on the linked public profile itself.
      if(publicSocialHost(link)){const r=await fetchText(link);if(r.text){const socialText=htmlText(r.text).slice(0,100000);const socialName=parseJsonLd(r.text)||nameFromMeta(r.text)||extractName('',socialText,r.text);if(socialName)personName=personName||socialName;phones=[...new Set([...phones,...extractPhones(socialText),...extractTelAndWa(r.text).flatMap(extractPhones)])].slice(0,12);emails=[...new Set([...emails,...extractEmails(r.text)])].slice(0,12);}}
    }
  }
  const isPerson=Boolean(personName&&personSeedOk(row,personName));
  const contactType=phones.length&&emails.length?'both':phones.length?'phone':emails.length?'email':'none';
  return {...row,url:page,personName,email:emails[0],phone:phones[0],contactType,contactStatus:contactType==='none'?'Sem contato público utilizável':`Contato público encontrado (${contactType})`,isPerson,profileUrl:row.url,contactUrl:contactUrl||undefined,discoveredVia:contactUrl?'perfil público → contato explicitamente vinculado':'resultado público'};
}
function emit(res:VercelResponse,event:Event){res.write(JSON.stringify(event)+'\n');}
function shuffle<T>(arr:T[]){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const product=String(req.body?.query||'').trim(), city=String(req.body?.city||'').trim(); if(!product||!city)return res.status(400).json({error:'Produto/interesse e cidade são obrigatórios.'});
  const start=Date.now(); const cursor=Number(req.body?.cursor)||0; const exclude=new Set<string>(Array.isArray(req.body?.excludeUrls)?req.body.excludeUrls.map((x:string)=>normUrl(String(x))):[]);
  let analyzed=Number(req.body?.analyzed)||0, eligible=Number(req.body?.eligible)||0, rejected=Number(req.body?.rejected)||0;
  res.statusCode=200;res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('X-Accel-Buffering','no');
  try{
    emit(res,{type:'log',source:'Motor contínuo',message:`Nova rodada contínua para ${product} em ${city}. Pessoas físicas somente; resultados de empresas são descartados.`});
    emit(res,{type:'log',source:'Elegibilidade',message:'Lead = pessoa física confirmada + nome + telefone/celular/WhatsApp público. E-mail sozinho não basta.'});
    const qs=searchQueries(product,city); const batchSize=6; const selected=[]; for(let i=0;i<batchSize;i++){selected.push(qs[(cursor+i)%qs.length]);}
    let nextCursor=(cursor+batchSize)%qs.length;
    const seenBatch=new Set<string>();
    for(const q of shuffle(selected)){
      if(!withinBudget(start)||analyzed>=Number(req.body?.analyzed||0)+MAX_SEED_RESULTS)break;
      emit(res,{type:'log',source:'Busca pública',message:`Consulta contínua: ${q}`});
      const [a,b,c]=await Promise.all([searchDuck(q),searchBing(q),searchGoogleNews(q)]); const rows=[...a,...b,...c]; emit(res,{type:'log',source:'Fontes públicas',message:`${rows.length} resultados brutos; filtrando pessoas físicas.`});
      for(const raw of rows){
        if(!withinBudget(start))break;
        const k=normUrl(raw.url); if(!k||exclude.has(k)||seenBatch.has(k))continue; seenBatch.add(k); if(!relevant(`${raw.title} ${raw.snippet}`))continue;
        analyzed+=1;
        if(likelyOrganization(`${raw.title} ${raw.snippet}`,raw.url)){rejected+=1;emit(res,{type:'rejected',source:'Filtro pessoa física',message:`Descartado: ${raw.title.slice(0,110)} — resultado empresarial, institucional ou genérico.`});continue;}
        const base={...raw,intent:product,score:intentScore(`${raw.title} ${raw.snippet}`,product)};
        emit(res,{type:'log',source:'Investigação profunda',message:`Analisando ${host(raw.url)||'fonte pública'}${publicSocialHost(raw.url)?' · fonte social/comunidade pública':''}.`});
        const enriched=await enrich(base,start);
        if(enriched.isPerson&&enriched.personName&&enriched.phone&&validPhone(enriched.phone)){
          eligible+=1;exclude.add(k);emit(res,{type:'lead',source:'Lead contatável',result:enriched,total:analyzed,eligible,rejected});
        } else {
          rejected+=1;emit(res,{type:'rejected',source:'Filtro pessoa física',message:`Descartado: ${raw.title.slice(0,110)} — não confirmou pessoa física com nome + telefone público.`});
        }
        emit(res,{type:'stats',total:analyzed,eligible,rejected,nextCursor});
        if(!withinBudget(start))break;
      }
      if(!withinBudget(start))break;
    }
    emit(res,{type:'done',total:analyzed,eligible,rejected,message:`Lote concluído. ${eligible} lead(s) contatável(is) acumulado(s). O cliente pode iniciar imediatamente o próximo lote sem parar.`,nextCursor});
    res.end();
  }catch(e){emit(res,{type:'error',source:'Motor contínuo',message:e instanceof Error?e.message:'Falha na prospecção.'});res.end();}
}
