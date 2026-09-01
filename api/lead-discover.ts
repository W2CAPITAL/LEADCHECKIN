import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (compatible; LeadcheckBusinessFinder/1.0; +https://leadcheck.app)';
function clean(s:string){return s.replace(/\s+/g,' ').trim()}
function validUrl(raw:string){try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)}catch{return false}}
function host(url:string){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function decodeDuck(url:string){try{const u=new URL(url,'https://duckduckgo.com');const uddg=u.searchParams.get('uddg');return uddg?decodeURIComponent(uddg):url}catch{return url}}
function titleCaseFromHost(h:string){return h.split('.')[0].replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function extractContacts(html:string){
  const emails=[...html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(m=>m[0].toLowerCase()).filter(e=>!e.includes('example.com'));
  const phones=[...html.matchAll(/(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9\d{4}|\d{4})[\s.-]?\d{4}/g)].map(m=>m[0].replace(/\D/g,'')).filter(p=>p.length>=10);
  return {email:[...new Set(emails)][0]||null,phone:[...new Set(phones)][0]||null}
}
async function fetchText(url:string,ms=4500){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{headers:{'user-agent':UA,'accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:c.signal}); if(!r.ok)return {status:r.status,text:'',finalUrl:url}; return {status:r.status,text:(await r.text()).slice(0,900000),finalUrl:r.url||url};}catch{return {status:0,text:'',finalUrl:url}}finally{clearTimeout(t)}
}
async function searchDuck(query:string){
  const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r=await fetchText(url,6000); if(!r.text)return [];
  const results:string[]=[];
  for(const m of r.text.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
    const u=decodeDuck(m[1]); if(validUrl(u))results.push(u); if(results.length>=40)break;
  }
  return [...new Set(results)];
}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const query=clean(String(req.body?.query||'')); const city=clean(String(req.body?.city||'')); const limit=Math.min(30,Math.max(1,Number(req.body?.limit||20)));
  if(query.length<2||city.length<2)return res.status(400).json({error:'Informe segmento e cidade.'});
  try{
    const q=`${query} ${city} contato telefone email site empresa`;
    let urls=await searchDuck(q);
    urls=urls.filter(u=>!/(facebook|instagram|linkedin|youtube|tiktok|twitter|x\.com|maps\.google)/i.test(host(u))).slice(0,limit*2);
    const results:any[]=[];
    for(let i=0;i<urls.length && results.length<limit;i+=4){
      const batch=urls.slice(i,i+4); const pages=await Promise.all(batch.map(u=>fetchText(u)));
      for(let j=0;j<pages.length && results.length<limit;j++){
        const page=pages[j]; const u=batch[j]; const h=host(page.finalUrl||u); if(!h)continue;
        const html=page.text; const contacts=extractContacts(html);
        const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,''))||titleCaseFromHost(h)).slice(0,180);
        const snippet=clean(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).slice(0,360);
        results.push({company:title,title,url:u,email:contacts.email,phone:contacts.phone,snippet,siteStatus:page.status});
      }
    }
    return res.json({ok:true,query,city,results,source:'busca_publica',generatedAt:new Date().toISOString()});
  }catch(e){return res.status(502).json({error:e instanceof Error?e.message:'Falha na busca pública'})}
}
