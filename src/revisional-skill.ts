export type RevisionalTriage={active:boolean;completeness:number;found:string[];missing:string[];note:string};
const normalize=(v:string)=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,' ').replace(/\s+/g,' ').trim();
export function isRevisionalLeadContext(input:string){
  const q=normalize(input);
  return /(revis|emprest|credito pessoal|consign|financ|juros|cet|contrato banc|parcela)/.test(q);
}
export function buildRevisionalTriage(interest:string,notes:string):RevisionalTriage{
  const text=[interest,notes].filter(Boolean).join(' ');
  if(!isRevisionalLeadContext(text))return{active:false,completeness:0,found:[],missing:[],note:''};
  const checks=[
    ['data do contrato',/(\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b20\d{2}-\d{2}-\d{2}\b|data do contrato)/i],
    ['modalidade',/(consign|credito pessoal|empr[eé]stimo pessoal|financiamento|ve[ií]culo|imobili)/i],
    ['valor liberado/financiado',/(r\$\s*[\d.,]+|valor (liberado|financiado|emprestado))/i],
    ['taxa de juros nominal',/(\d+[,.]?\d*\s*%\s*(a\.m\.|ao m[eê]s|a\.a\.|ao ano)|taxa nominal|juros remunerat)/i],
    ['parcelas',/(\b\d+\s*(x|parcelas?)\b|valor da parcela)/i],
    ['CET/custos',/(\bCET\b|custo efetivo total|IOF|tarifa|seguro)/i],
    ['garantia',/(garantia real|sem garantia|alienação|alienacao|garantia)/i],
    ['contrato/extrato disponível',/(contrato (anex|dispon|receb)|extrato|comprovante|documento)/i]
  ] as const;
  const found=checks.filter(([,r])=>r.test(text)).map(([label])=>label);
  const missing=checks.filter(([,r])=>!r.test(text)).map(([label])=>label);
  return{active:true,completeness:Math.round(found.length/checks.length*100),found,missing,note:'Triagem documental. Não conclui abusividade nem substitui análise do contrato e fontes oficiais.'};
}
