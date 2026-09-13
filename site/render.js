(function (scope) {
  const ORIGIN='https://emrsahin.com';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  function asset(value,folder='assets'){
    const ref=String(value||'');if(/^https?:\/\//i.test(ref))return ref;
    if(ref.startsWith('upload:')||ref.startsWith('blob:'))return '';
    return '/'+(ref.startsWith(folder+'/')?ref:folder+'/'+ref.replace(/^\//,''));
  }
  const image=value=>asset(value||'emir-sahin.jpg');
  const projectUrl=p=>'/projeler/'+encodeURIComponent(p.id);
  const albumUrl=a=>'/albumler/'+encodeURIComponent(a.id);
  function projects(state){return state.projects.filter(p=>!p.featured).map(p=>`<article class="project"><a class="project-open" href="${projectUrl(p)}" data-project="${esc(p.id)}" aria-label="${esc(p.brand+' — '+p.title)}"><div class="project-cover"><img src="${esc(image(p.cover))}" alt="${esc(p.brand+' — '+p.title+' film karesi')}" loading="lazy" width="640" height="800"><span class="count">${(p.files||[]).length} FİLM</span><span class="small-play" aria-hidden="true">▶</span></div><div class="project-meta"><h3>${esc(p.brand)}</h3><span aria-hidden="true">↗</span></div><p class="project-title">${esc(p.title)}</p><p class="project-role">${esc(p.role)}</p></a></article>`).join('')}
  function featured(state){
    const p=state.projects.find(p=>p.featured);if(!p)return '';
    const covers=p.id==='desa-kendini-yasa'&&p.cover==='poster-5.jpg'?['poster-5.jpg','poster-6.jpg','poster-7.jpg']:[p.cover];
    return `<a class="featured-film" href="${projectUrl(p)}" data-project="${esc(p.id)}" aria-label="${esc(p.brand+' — '+p.title)}"><div class="triptych ${covers.length===1?'single':''}">${covers.map((cover,i)=>`<img src="${esc(image(cover))}" alt="${esc(p.brand+' — '+p.title)}" ${i===0?'fetchpriority="high"':''} width="640" height="800">`).join('')}</div><span class="feature-top">ÖNE ÇIKAN PROJE</span><span class="play-disc" aria-hidden="true">▶</span><span class="feature-bottom"><span><strong>${esc(p.brand)}</strong><span>${esc(p.title)}</span></span><span class="watch">FİLMLERİ İZLE ↗</span></span></a><div class="feature-credit"><span>${esc(p.role)}</span><span>${(p.files||[]).length} film</span></div>`;
  }
  function albums(state){return (state.albums||[]).map(a=>`<article class="project"><a class="album-open project-open" href="${albumUrl(a)}" data-album="${esc(a.id)}"><div class="album-cover"><img src="${esc(image(a.cover||a.photos[0]?.src))}" alt="${esc(a.title+' albüm kapağı')}" loading="lazy" width="800" height="600"><span>${a.photos.length} FOTOĞRAF</span></div><div class="project-meta"><h3>${esc(a.title)}</h3><span aria-hidden="true">↗</span></div><p class="project-title">${esc(a.description)}</p></a></article>`).join('')}
  // Source files and provenance are kept in /site/brands.
  const logos={DESA:'desa.svg',adL:'adl.png',Communite:'communite.jpg',Mavi:'mavi.svg',MediaMarkt:'mediamarkt.svg','Calvin Klein':'calvin-klein.svg',Twist:'twist.svg','İpekyol':'ipekyol.svg','Suzi X':'suzix.png','Aurelia Genève Beauty':'aurelia.svg','Harper’s Bazaar Türkiye':'harpers-bazaar.svg'};
  const artistNames=new Set(['Ozbi','Mert Demir','Feel Real Fest']);
  function brands(state){
    const names=[...new Set(state.projects.map(p=>p.brand).filter(Boolean))];
    if(!names.length)return '';
    const clients=names.filter(name=>!artistNames.has(name));
    const artists=names.filter(name=>artistNames.has(name));
    const group=hidden=>`<div class="brand-group" ${hidden?'aria-hidden="true"':''}>${clients.map(name=>`<span class="brand-logo${name==='adL'?' brand-logo--adl':name==='Communite'?' brand-logo--communite':''}">${logos[name]?`<img src="/brands/${logos[name]}" alt="${esc(name)}" width="170" height="65" loading="lazy">`:`<span class="brand-wordmark">${esc(name)}</span>`}</span>`).join('')}</div>`;
    const strip=clients.length?`<div class="brands-heading"><p>PROJELERİNDE YER ALDIĞIM MARKALAR</p><button id="toggle-brands" type="button" aria-pressed="false" aria-label="Logo hareketini duraklat">Duraklat Ⅱ</button></div><div class="brand-window"><div class="brand-track">${group(false)+group(true)}</div></div>`:'';
    return strip+(artists.length?`<div class="artist-credits"><p>SANATÇILAR & ETKİNLİKLER</p><ul>${artists.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></div>`:'');
  }
  function meta(state,{project,album,revision}={}){
    const site=state.site;const title=project?project.brand+' — '+project.title+' | Emir Selahattin Şahin':album?album.title+' | Emir Selahattin Şahin':site.seoTitle||'Emir Selahattin Şahin | İstanbul Yönetmen & Film Yapımcısı';
    const description=project?project.brand+' — '+project.title+'. Emir Selahattin Şahin: '+project.role+'. Proje filmlerini izle.':album?album.description||album.title+' fotoğraf albümü — Emir Selahattin Şahin.':site.seoDescription||'İstanbul merkezli yönetmen ve film yapımcısı Emir Selahattin Şahin. Türkiye’de moda, reklam ve müzik projelerinden yönetmenlik, kamera ve kurgu portföyü.';
    const canonical=ORIGIN+(project?projectUrl(project):album?albumUrl(album):'/');
    const person={'@type':'Person','@id':ORIGIN+'/#emir',name:'Emir Selahattin Şahin',alternateName:['Emir Şahin','Emir S. Şahin'],url:ORIGIN+'/',image:ORIGIN+'/assets/emir-sahin.jpg',jobTitle:'Yönetmen ve film yapımcısı',description:site.aboutLead,knowsAbout:['Yönetmenlik','Reklam filmi','Moda filmi','Kamera operatörlüğü','Kurgu','Renk düzenleme'],workLocation:{'@type':'Place',name:site.location||'İstanbul, Türkiye'},email:site.email,telephone:site.phone,sameAs:/^https:\/\//.test(site.instagram||'')?[site.instagram]:[]};
    const work=p=>({'@type':'CreativeWork','@id':ORIGIN+projectUrl(p),url:ORIGIN+projectUrl(p),name:p.brand+' — '+p.title,description:'Emir Selahattin Şahin: '+p.role,inLanguage:'tr',image:abs(image(p.cover)),contributor:{'@type':'Role',roleName:p.role,contributor:{'@id':ORIGIN+'/#emir'}}});
    const gallery=a=>({'@type':'ImageGallery',url:ORIGIN+albumUrl(a),name:a.title,description:a.description,associatedMedia:a.photos.map(p=>({'@type':'ImageObject',contentUrl:abs(image(p.src)),caption:p.alt}))});
    const graph=[person,{'@type':'WebSite','@id':ORIGIN+'/#website',url:ORIGIN+'/',name:'Emir Selahattin Şahin',inLanguage:'tr-TR',publisher:{'@id':ORIGIN+'/#emir'}},project?work(project):album?gallery(album):{'@type':'ProfilePage',url:canonical,name:title,description,inLanguage:'tr-TR',mainEntity:{'@id':ORIGIN+'/#emir'},...(revision?{dateModified:revision}:{}),hasPart:state.projects.map(work)}];
    const preview=abs(image(project?.cover||album?.cover||'emir-sahin.jpg'));
    return `<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1"><meta property="og:type" content="website"><meta property="og:locale" content="tr_TR"><meta property="og:site_name" content="Emir Selahattin Şahin"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${esc(preview)}"><meta property="og:image:alt" content="${esc(project?.title||album?.title||'Emir Selahattin Şahin')}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(preview)}"><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script>`;
  }
  function abs(value){return value.startsWith('/')?ORIGIN+value:value}
  function page(template,state,options={}){
    const block=(html,name,value)=>html.replace(new RegExp('<!--'+name+'_START-->[\\s\\S]*?<!--'+name+'_END-->'),'<!--'+name+'_START-->'+value+'<!--'+name+'_END-->');
    let html=block(template,'META',meta(state,options));
    html=block(html,'FEATURED',featured(state));html=block(html,'PROJECTS',projects(state));html=block(html,'BRANDS',brands(state));html=block(html,'ALBUMS',albums(state));
    const ids={'hero-kicker':'heroKicker','hero-location':'location','hero-tagline':'tagline','about-label':'aboutLabel','about-name':'aboutName','about-lead':'aboutLead','about-p1':'aboutP1','about-p2':'aboutP2','about-caption':'caption','contact-kicker':'contactKicker'};
    for(const [id,key] of Object.entries(ids))html=html.replace(new RegExp('(<([a-z0-9]+)[^>]*id="'+id+'"[^>]*>)[\\s\\S]*?(</\\2>)'),(_,start,tag,end)=>start+esc(state.site[key]).replace(/\n/g,'<br>')+end);
    html=html.replace(/(<a[^>]*id="contact-head"[^>]*href=")[^"]*(">)[\s\S]*?<\/a>/,'$1mailto:'+esc(state.site.email)+'$2'+esc(state.site.contactTitle)+'<span aria-hidden="true">↗</span></a>');
    html=html.replace(/<a id="contact-email"[^>]*>.*?<\/a>/,`<a id="contact-email" href="mailto:${esc(state.site.email)}">${esc(state.site.email)}</a>`);
    html=html.replace(/<a id="contact-phone"[^>]*>.*?<\/a>/,`<a id="contact-phone" href="tel:${esc(String(state.site.phone).replace(/[^+\d]/g,''))}">${esc(state.site.phone)}</a>`);
    html=html.replace(/(<a id="contact-instagram" href=")[^"]*/,(_,start)=>start+esc(/^https:\/\//.test(state.site.instagram)?state.site.instagram:'#'));
    html=html.replace(/(<div class="practice" id="about-practice">).*?(<\/div>)/,(_,start,end)=>start+(state.site.practice||[]).map(x=>'<span>'+esc(x)+'</span>').join('')+end);
    if(state.albums?.length){html=html.replace('id="fotograflar" hidden','id="fotograflar"').replace('id="photos-nav" hidden','id="photos-nav"')}
    const clean={site:{...state.site},projects:state.projects,albums:state.albums||[]};delete clean.site.supabaseUrl;delete clean.site.supabaseAnonKey;
    html=html.replace('<!--PUBLISHED_DATA-->','<script id="published-data" type="application/json">'+json(clean)+'</script>');
    if(options.project||options.album){
      const p=options.project,a=options.album;
      const body=p?`<div class="detail-intro"><a href="/#isler">← Tüm projeler</a><p class="eyebrow">${esc(p.brand)}</p><h1>${esc(p.title)}</h1><p>${esc(p.role)}</p><p>Emir Selahattin Şahin — proje portföyü</p></div><div class="detail-media">${p.files.map((f,i)=>`<figure><video controls playsinline preload="none" poster="${esc(image(p.cover))}" src="${esc(asset(f,'videos'))}" aria-label="${esc(p.title)} — Film ${i+1}"></video><figcaption>Film ${i+1}</figcaption></figure>`).join('')}</div>`:`<div class="detail-intro"><a href="/#fotograflar">← Tüm albümler</a><h1>${esc(a.title)}</h1><p>${esc(a.description)}</p></div><div class="album-detail-grid">${a.photos.map((p,i)=>`<a href="${esc(image(p.src))}" data-photo-index="${i}"><img src="${esc(image(p.src))}" alt="${esc(p.alt)}" ${i?'loading="lazy"':''} width="1200" height="900"></a>`).join('')}</div>`;
      html=html.replace(/<main>[\s\S]*?<\/main>/,'<main class="detail-page">'+body+'</main>');
      html=html.replace('src="/app.js"','src="/detail.js"');
      html=html.replace('href="#isler"','href="/#isler"').replace('href="#hakkinda"','href="/#hakkinda"').replace('href="#iletisim"','href="/#iletisim"').replace('href="#fotograflar"','href="/#fotograflar"');
    }
    return html;
  }
  const api={ORIGIN,esc,json,asset,image,projects,featured,albums,brands,meta,page,projectUrl,albumUrl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.PortfolioRender=api;
})(typeof window==='undefined'?globalThis:window);
