const fs=require('node:fs');
const path=require('node:path');
const render=require('../site/render.js');
const fallback=require('../site/content.json');
const template=fs.readFileSync(path.join(process.cwd(),'site/index.html'),'utf8');
async function published(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
  if(url&&key){
    try{
      const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/site_content?select=payload,updated_at&id=eq.main',{headers:{apikey:key},signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw new Error('Content HTTP '+response.status);
      const rows=await response.json();const row=rows?.[0];
      if(row?.payload&&Array.isArray(row.payload.projects))return {state:{...row.payload,site:{...fallback.site,...row.payload.site},albums:row.payload.albums||[]},revision:row.updated_at};
      if(rows.length)throw new Error('Invalid published data');
    }catch(error){console.warn('Published content unavailable:',error.message);return {state:fallback,degraded:true}}
  }
  return {state:fallback};
}
module.exports=async function handler(req,res){
  const {state,revision,degraded}=await published();
  const requestUrl=new URL(req.url,render.ORIGIN);
  const kind=req.query?.kind||requestUrl.searchParams.get('kind')||'home';
  const id=req.query?.id||requestUrl.searchParams.get('id');
  // Admin saves are published immediately; never serve a previous revision from CDN cache.
  res.setHeader('Cache-Control','no-store');
  if(kind==='sitemap'){
    const urls=['/',...state.projects.map(render.projectUrl),...(state.albums||[]).map(render.albumUrl)];
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+render.esc(render.ORIGIN+url)+'</loc>'+(revision?'<lastmod>'+render.esc(revision)+'</lastmod>':'')+'</url>').join('')+'</urlset>');
  }
  if(kind==='llms'){
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    return res.end('# Emir Selahattin Şahin\n\n> İstanbul merkezli yönetmen ve film yapımcısının resmî portföyü.\n\n'+state.site.aboutLead+'\n\n'+state.site.aboutP1+'\n\n'+state.site.aboutP2+'\n\n## Projeler ve görevler\n'+state.projects.map(p=>'- ['+p.brand+' — '+p.title+']('+render.ORIGIN+render.projectUrl(p)+'): '+p.role).join('\n')+'\n\n## İletişim\n'+state.site.email+'\n\nHer projedeki görev ayrı belirtilmiştir; portföyde yer almak her filmde yönetmen olduğu anlamına gelmez.');
  }
  const project=kind==='project'?state.projects.find(p=>p.id===id):null;
  const album=kind==='album'?(state.albums||[]).find(a=>a.id===id):null;
  if((kind==='project'&&!project)||(kind==='album'&&!album)){
    res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Robots-Tag','noindex');
    return res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><title>Sayfa bulunamadı</title><h1>Sayfa bulunamadı</h1><a href="/">Portföye dön</a></html>');
  }
  let html=render.page(template,state,{project,album,revision});
  // A browser may finish loading fresh content even during a transient API outage.
  if(degraded)res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
};
