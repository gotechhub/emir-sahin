const SUPABASE_ADMIN_EMAIL='respongo@gmail.com';
const loginScreen=document.querySelector('#admin-login');
const adminApp=document.querySelector('.admin-app');
const loginError=document.querySelector('#login-error');
function setAuthenticated(value){loginScreen.hidden=value;adminApp.hidden=!value;document.body.classList.toggle('admin-authenticated',value);if(!value)document.querySelector('#login-form [name="password"]').value=''}
function runtimeConfig(){return window.__SUPABASE_CONFIG__||{}}
const cloud=PortfolioCloud.createClient(runtimeConfig());
const DRAFT_KEY='emirPortfolioDraft.v2';
let revision=null, dirty=false, generation=0, initialized=false, saving=null, retryTimer=null, retryCount=0;
let conflict=false;
const uploaded=new Map();
const STORAGE_KEY='emirPortfolioData.v1';
const DEFAULT_SITE={heroKicker:'YÖNETMEN & FİLM YAPIMCISI',location:'İSTANBUL, TR',tagline:'Moda, reklam\nve hareketli görüntü.',aboutLabel:'KAMERA ARKASINDA',aboutName:'Emir Selahattin\nŞahin.',aboutLead:'Moda, reklam ve dijital içerik alanlarında çalışan bağımsız yönetmen ve film yapımcısı.',aboutP1:'Kadir Has Üniversitesi Sinema ve Televizyon Bölümü’nde eğitim aldı. Kariyerine Tolan Film’de başladı; kamera, prodüksiyon ve backstage çalışmalarının ardından kısa film projelerinde görüntü yönetmenliği yaptı.',aboutP2:'No. Studio ile Mavi, DESA ve Communite gibi markaların projelerinde kamera operatörlüğü, yardımcı yönetmenlik ve kurgu görevleri üstlendi. İlk moda filmi yönetmenliğini DESA’nın #KendiniYaşa kampanyasında gerçekleştirdi.',practice:['Yönetmenlik','Kamera','Kurgu & renk'],caption:'Beşiktaş, İstanbul',contactKicker:'YENİ PROJELER İÇİN',contactTitle:'Birlikte çalışalım.',email:'sahinemir@outlook.com',phone:'+90 542 417 18 14',instagram:'https://www.instagram.com/emir.mov/',supabaseUrl:'',supabaseAnonKey:''};
const original=Array.isArray(window.projects)?window.projects:[];
const memoryFallback={};
const mediaStore=window.mediaStore;
const htmlEntities={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(value){return String(value??'').replace(/[&<>"']/g,character=>htmlEntities[character])}
function storageGet(key){try{if(window.localStorage)return window.localStorage.getItem(key)}catch(e){}return memoryFallback[key]||null}
function storageSet(key,value){try{if(window.localStorage){window.localStorage.setItem(key,value);return}}catch(e){}memoryFallback[key]=value}
function load(){try{const x=JSON.parse(storageGet(STORAGE_KEY)||'null');const site={...DEFAULT_SITE,...(x?.site||{})};Object.keys(DEFAULT_SITE).forEach(key=>{if(site[key]===''&&DEFAULT_SITE[key])site[key]=DEFAULT_SITE[key]});return {site,projects:Array.isArray(x?.projects)?x.projects:original.map(item=>({...item}))}}catch(e){return {site:{...DEFAULT_SITE},projects:original.map(item=>({...item}))}}}
let state={...load(),albums:[]};
let pendingDelete=null;
let editorFileRefs=[];
let pendingVideoFiles=[];
let pendingCoverFile=null;
let removedMediaRefs=new Set();
let coverPreviewUrl=null;

function isMediaRef(value){return mediaStore?.isRef?.(value)===true}
function mediaPath(value){if(!value)return 'assets/poster-5.jpg';return value.startsWith('assets/')||value.startsWith('videos/')||/^https?:\/\//i.test(value)?value:'assets/'+value}
function collectMedia(project){return [project?.cover,...(project?.files||[]),...(project?.photos||[]).map(photo=>photo.src)].filter(isMediaRef)}
async function cleanupMedia(refs){const used=new Set([...state.projects,...(state.albums||[])].flatMap(project=>collectMedia(project)));for(const ref of refs){if(!used.has(ref)){try{await mediaStore?.remove?.(ref)}catch(e){console.warn('Medya temizlenemedi',e)}}}}
function setImageSource(img,ref){img.src=mediaPath(ref);if(isMediaRef(ref)){mediaStore.resolve(ref).then(result=>{if(result)img.src=result.url}).catch(()=>{})}}
function formatBytes(bytes){if(!Number.isFinite(bytes))return '';if(bytes<1024*1024)return Math.max(1,Math.round(bytes/1024))+' KB';return (bytes/(1024*1024)).toFixed(1)+' MB'}
function setSaveStatus(message,status='ready'){
  const node=document.querySelector('#save-state');node.textContent=message;node.dataset.status=status;
  document.querySelector('#connection-label').textContent=status==='ready'?'Canlı siteye bağlı':message;
}
function saveDraft(){
  try{window.localStorage.setItem(DRAFT_KEY,JSON.stringify({state,revision,dirty}));return true}
  catch(_){setSaveStatus('Tarayıcı taslağı saklayamadı; sayfayı açık tut','error');return false}
}
function persist(){
  dirty=true;generation++;saveDraft();setSaveStatus('Yayınlanıyor…','saving');
  return syncSupabase();
}
function toast(message){const n=document.querySelector('#toast');n.textContent=message;n.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>n.classList.remove('show'),2600)}
function renderOverview(){const projects=state.projects;document.querySelector('#stat-projects').textContent=projects.length;document.querySelector('#stat-films').textContent=projects.reduce((n,p)=>n+(p.files?.length||0),0);document.querySelector('#stat-featured').textContent=projects.filter(p=>p.featured).length;document.querySelector('#nav-count').textContent=projects.length;const recent=document.querySelector('#recent-projects');recent.replaceChildren();projects.slice(0,5).forEach(p=>{const row=document.createElement('div');row.className='recent-row';row.innerHTML='<img class="recent-thumb" alt=""><div><strong>'+esc(p.brand)+'</strong><small>'+esc(p.title)+'</small></div><span>'+(p.files?.length||0)+' film</span>';recent.append(row);setImageSource(row.querySelector('img'),p.cover)})}
function renderProjects(){const list=document.querySelector('#project-list');const query=(document.querySelector('#project-search').value||'').toLowerCase().trim();const filtered=state.projects.filter(p=>`${p.brand} ${p.title} ${p.role}`.toLowerCase().includes(query));document.querySelector('#project-result-count').textContent=`${filtered.length} proje`;list.replaceChildren();if(!filtered.length){list.innerHTML='<div class="empty-row">Aramanla eşleşen bir proje yok.</div>';return}filtered.forEach(p=>{const row=document.createElement('article');row.className='project-admin-row';row.innerHTML='<img alt=""><div><strong>'+esc(p.brand)+'</strong><small>'+esc(p.title)+'</small></div><div class="role-cell">'+esc(p.role||'Görev eklenmemiş')+'</div><div><small>'+(p.files?.length||0)+' film'+(p.featured?' · Öne çıkan':'')+'</small></div><div class="project-actions"><button data-edit="'+esc(p.id)+'">Düzenle</button><button class="delete" data-delete="'+esc(p.id)+'">Sil</button></div>';list.append(row);setImageSource(row.querySelector('img'),p.cover)});list.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>openEditor(button.dataset.edit));list.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>askDelete(button.dataset.delete))}
function fillForm(form,data){Object.entries(data).forEach(([key,value])=>{const field=form.querySelector(`[name="${key}"]`);if(!field)return;if(field.type==='checkbox')field.checked=Boolean(value);else field.value=Array.isArray(value)?value.join(', '):(value??'')})}
function siteFrom(form){const out={...state.site};Array.from(form.elements).forEach(field=>{if(!field.name)return;out[field.name]=field.name==='practice'?field.value.split(',').map(x=>x.trim()).filter(Boolean):field.type==='checkbox'?field.checked:field.value.trim()});return out}

function clearCoverPreview(){if(coverPreviewUrl){URL.revokeObjectURL(coverPreviewUrl);coverPreviewUrl=null}}
function renderCoverPreview(ref){const preview=document.querySelector('#cover-preview');const image=preview.querySelector('img');clearCoverPreview();const value=ref||'assets/poster-5.jpg';image.src=mediaPath(value);preview.hidden=false;if(isMediaRef(value)){mediaStore.resolve(value).then(result=>{if(result)image.src=result.url}).catch(()=>{})}}
function renderCoverFile(file){const preview=document.querySelector('#cover-preview');const image=preview.querySelector('img');clearCoverPreview();if(!file){renderCoverPreview('');return}coverPreviewUrl=URL.createObjectURL(file);image.src=coverPreviewUrl;preview.hidden=false}
function moveEditorFile(index,delta){const next=index+delta;if(next<0||next>=editorFileRefs.length)return;[editorFileRefs[index],editorFileRefs[next]]=[editorFileRefs[next],editorFileRefs[index]];document.querySelector('#project-form [name="files"]').value=editorFileRefs.join('\n');renderVideoList()}
function movePendingFile(index,delta){const next=index+delta;if(next<0||next>=pendingVideoFiles.length)return;[pendingVideoFiles[index],pendingVideoFiles[next]]=[pendingVideoFiles[next],pendingVideoFiles[index]];renderVideoList()}
function renderVideoList(){const list=document.querySelector('#video-list');list.replaceChildren();if(!editorFileRefs.length&&!pendingVideoFiles.length){list.innerHTML='<p class="media-empty">Henüz video eklenmedi. Birden fazla dosyayı aynı anda seçebilirsin.</p>';return}editorFileRefs.forEach((ref,index)=>{const row=document.createElement('div');row.className='media-row';row.innerHTML='<span class="media-index">'+String(index+1).padStart(2,'0')+'</span><div class="media-info"><strong>'+esc(isMediaRef(ref)?(mediaStore.label(ref)||'İçe aktarılan dosya'):(String(ref).split('/').pop()||ref))+'</strong><small>'+esc(isMediaRef(ref)?'Tarayıcıya kaydedildi':'Bağlantı / site dosyası')+'</small></div><div class="media-order" aria-label="Video sırası"><button type="button" data-move="-1" aria-label="Videoyu yukarı taşı"'+(index===0?' disabled':'')+'>↑</button><button type="button" data-move="1" aria-label="Videoyu aşağı taşı"'+(index===editorFileRefs.length-1?' disabled':'')+'>↓</button></div><button type="button" class="media-remove" aria-label="Videoyu çıkar">×</button>';row.querySelector('[data-move="-1"]').onclick=()=>moveEditorFile(index,-1);row.querySelector('[data-move="1"]').onclick=()=>moveEditorFile(index,1);row.querySelector('.media-remove').onclick=()=>{if(isMediaRef(ref))removedMediaRefs.add(ref);editorFileRefs.splice(index,1);document.querySelector('#project-form [name="files"]').value=editorFileRefs.join('\n');renderVideoList()};list.append(row);if(isMediaRef(ref))mediaStore.get(ref).then(entry=>{const strong=row.querySelector('strong');if(entry&&strong)strong.textContent=entry.name}).catch(()=>{})});pendingVideoFiles.forEach((file,index)=>{const row=document.createElement('div');row.className='media-row pending';row.innerHTML='<span class="media-index">＋</span><div class="media-info"><strong>'+esc(file.name)+'</strong><small>Yeni dosya · '+formatBytes(file.size)+'</small></div><div class="media-order" aria-label="Yeni video sırası"><button type="button" data-pending-move="-1" aria-label="Videoyu yukarı taşı"'+(index===0?' disabled':'')+'>↑</button><button type="button" data-pending-move="1" aria-label="Videoyu aşağı taşı"'+(index===pendingVideoFiles.length-1?' disabled':'')+'>↓</button></div><button type="button" class="media-remove" aria-label="Yeni videoyu çıkar">×</button>';row.querySelector('[data-pending-move="-1"]').onclick=()=>movePendingFile(index,-1);row.querySelector('[data-pending-move="1"]').onclick=()=>movePendingFile(index,1);row.querySelector('.media-remove').onclick=()=>{pendingVideoFiles.splice(index,1);renderVideoList()};list.append(row)})}
function syncFilesField(){const field=document.querySelector('#project-form [name="files"]');editorFileRefs=field.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);renderVideoList()}
function resetEditorMedia(){pendingVideoFiles=[];pendingCoverFile=null;removedMediaRefs=new Set();clearCoverPreview();const coverFile=document.querySelector('#cover-file');const videoFiles=document.querySelector('#video-files');if(coverFile)coverFile.value='';if(videoFiles)videoFiles.value=''}
function openEditor(id){const form=document.querySelector('#project-form');const project=id?state.projects.find(item=>item.id===id):{id:'',brand:'',title:'',role:'',cover:'assets/poster-5.jpg',files:[],featured:false};if(!project)return;resetEditorMedia();document.querySelector('#dialog-title').textContent=id?'Portföyü düzenle':'Yeni portföy';form.reset();fillForm(form,{...project,files:(project.files||[]).join('\n')});editorFileRefs=[...(project.files||[])];renderVideoList();renderCoverPreview(project.cover||'assets/poster-5.jpg');document.querySelector('#project-dialog').showModal()}
async function saveProject(form){const saveButton=form.querySelector('button[type="submit"]');const oldProject=state.projects.find(item=>item.id===form.elements.id.value);const created=[];saveButton.disabled=true;saveButton.textContent='Dosyalar kaydediliyor…';try{let cover=form.elements.cover.value.trim()||'assets/poster-5.jpg';if(pendingCoverFile){const id=await mediaStore.put(pendingCoverFile);cover='upload:'+id;created.push(cover)}const imported=[];for(const file of pendingVideoFiles){const id=await mediaStore.put(file);const ref='upload:'+id;created.push(ref);imported.push(ref)}const data={id:form.elements.id.value||`project-${Date.now()}`,brand:form.elements.brand.value.trim(),title:form.elements.title.value.trim(),role:form.elements.role.value.trim(),cover,files:[...editorFileRefs,...imported],featured:form.elements.featured.checked};const oldIndex=state.projects.findIndex(item=>item.id===data.id);if(oldIndex>-1)state.projects[oldIndex]=data;else state.projects.unshift(data);if(data.featured)state.projects.forEach(item=>{if(item.id!==data.id)item.featured=false});await persist(oldIndex>-1?'Portföy güncellendi':'Portföy oluşturuldu');document.querySelector('#project-dialog').close();renderAll();await cleanupMedia([...collectMedia(oldProject),...removedMediaRefs])}catch(error){for(const ref of created)await mediaStore.remove(ref).catch(()=>{});console.error(error);toast('Dosyalar kaydedilemedi. Tarayıcı depolama alanını kontrol et.')}finally{saveButton.disabled=false;saveButton.textContent='Portföyü kaydet'}}
function askDelete(id){pendingDelete=id;document.querySelector('#confirm-dialog').hidden=false}
async function deleteProject(){if(!pendingDelete)return;const target=state.projects.find(item=>item.id===pendingDelete);state.projects=state.projects.filter(item=>item.id!==pendingDelete);pendingDelete=null;document.querySelector('#confirm-dialog').hidden=true;await persist('Portföy silindi');renderAll();await cleanupMedia(collectMedia(target))}
function renderAll(){renderOverview();renderProjects();if(typeof renderAlbums==='function')renderAlbums()}
function switchView(name){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active-view',view.id==='view-'+name));
  document.querySelectorAll('.nav-item').forEach(view=>view.classList.toggle('active',view.dataset.view===name));
  const titles={overview:['ÇALIŞMA ALANI','Genel bakış'],projects:['İÇERİK YÖNETİMİ','Portföyler'],albums:['FOTOĞRAF','Albümler'],content:['SAYFA İÇERİĞİ','Hakkında'],settings:['GENEL YAPILANDIRMA','Site ayarları']};
  document.querySelector('#view-kicker').textContent=titles[name][0];document.querySelector('#view-title').textContent=titles[name][1];
  document.querySelector('.sidebar').classList.remove('open');
  if(name==='content')fillForm(document.querySelector('#about-form'),state.site);
  if(name==='settings')fillForm(document.querySelector('#settings-form'),state.site);
}
function normalizeState(payload){return {site:{...DEFAULT_SITE,...payload.site},projects:payload.projects||[],albums:payload.albums||[]}}
function exportDraft(){
  const data=JSON.parse(JSON.stringify(state));delete data.site.supabaseUrl;delete data.site.supabaseAnonKey;
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='emir-taslak-'+Date.now()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadPublished(){
  const row=await cloud.read();revision=row?.updated_at||null;
  const published=row?normalizeState(row.payload):{site:{...DEFAULT_SITE},projects:original.map(p=>({...p})),albums:[]};
  let draft;try{draft=JSON.parse(storageGet(DRAFT_KEY)||'null')}catch(_){}
  state=published;dirty=false;conflict=false;
  if(draft?.dirty&&draft?.state){
    state=normalizeState(draft.state);dirty=true;
    conflict=draft.revision!==revision;
    if(conflict){revision=draft.revision;showSaveError(new PortfolioCloud.CloudError('Yayındaki içerik bu taslaktan sonra değişti. Taslağını indirip güncel içeriği yükleyebilirsin.','conflict'))}
  }
  initialized=true;renderAll();setAuthenticated(true);
  fillForm(document.querySelector('#about-form'),state.site);fillForm(document.querySelector('#settings-form'),state.site);
  if(!dirty){saveDraft();setSaveStatus('Yayındaki içerik güncel');document.querySelector('#save-error').hidden=true}
  else if(!conflict)syncSupabase();
}
function showSaveError(error){
  setSaveStatus('Değişiklikler henüz yayınlanmadı','error');
  const banner=document.querySelector('#save-error');banner.hidden=false;
  document.querySelector('#save-error-text').textContent=error.message;
  document.querySelector('#reload-published').hidden=error.code!=='conflict';
  document.querySelector('#retry-save').hidden=error.code==='conflict'||error.code==='auth';
  if(error.code==='conflict')conflict=true;
  if(error.code==='auth'){document.querySelectorAll('dialog[open]').forEach(d=>d.close());setAuthenticated(false);loginError.textContent=error.message;loginError.hidden=false}
}
async function resolveUpload(ref){
  if(!isMediaRef(ref))return ref;
  if(uploaded.has(ref))return uploaded.get(ref);
  const entry=await mediaStore.get(ref);
  if(!entry?.blob)throw new PortfolioCloud.CloudError('Bir medya dosyası bu tarayıcıda bulunamadı. Dosyayı yeniden seç.','storage');
  const url=await cloud.upload(entry);uploaded.set(ref,url);return url;
}
async function remotePayload(snapshot){
  const payload=JSON.parse(JSON.stringify(snapshot));delete payload.site.supabaseUrl;delete payload.site.supabaseAnonKey;
  for(const project of payload.projects){project.cover=await resolveUpload(project.cover);for(let i=0;i<project.files.length;i++)project.files[i]=await resolveUpload(project.files[i])}
  for(const album of payload.albums||[]){album.cover=await resolveUpload(album.cover);for(const photo of album.photos)photo.src=await resolveUpload(photo.src)}
  return payload;
}
function applyUploadedUrls(){
  for(const project of state.projects){project.cover=uploaded.get(project.cover)||project.cover;project.files=project.files.map(ref=>uploaded.get(ref)||ref)}
  for(const album of state.albums||[]){album.cover=uploaded.get(album.cover)||album.cover;for(const photo of album.photos)photo.src=uploaded.get(photo.src)||photo.src}
}
function syncSupabase(){
  if(saving)return saving;
  if(!initialized||!dirty||conflict)return Promise.resolve(false);
  clearTimeout(retryTimer);
  saving=(async()=>{
    try{
      while(dirty){
        const savingGeneration=generation;
        setSaveStatus('Dosyalar ve içerik yayınlanıyor…','saving');
        const payload=await remotePayload(state);
        const row=await cloud.save(payload,revision);revision=row.updated_at;
        applyUploadedUrls();dirty=generation!==savingGeneration;saveDraft();
      }
      retryCount=0;document.querySelector('#save-error').hidden=true;setSaveStatus('Kaydedildi · Yayında');toast('Kaydedildi. Değişiklikler yayında.');renderAll();return true;
    }catch(error){
      saveDraft();showSaveError(error);
      if(error.code==='network'&&navigator.onLine){retryTimer=setTimeout(syncSupabase,Math.min(60000,5000*2**retryCount++))}
      return false;
    }finally{saving=null}
  })();return saving;
}
async function handleLogin(event){
  event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');
  const username=form.elements.username.value.trim();const password=form.elements.password.value;
  loginError.hidden=true;button.disabled=true;button.textContent='Giriş yapılıyor…';
  try{
    if(!username||!password)throw new Error('Kullanıcı adı ve parolanı gir.');
    if(username!=='admin')throw new Error('Kullanıcı adı veya parola hatalı.');
    await cloud.signIn(SUPABASE_ADMIN_EMAIL,password);await loadPublished();
  }catch(error){loginError.textContent=error.code==='request'?'Kullanıcı adı veya parola hatalı.':error.message;loginError.hidden=false}
  finally{button.disabled=false;button.textContent='Giriş yap ↗'}
}
async function logout(){
  if(saving)await saving;
  clearTimeout(retryTimer);initialized=false;setAuthenticated(false);cloud.signOut();
}
async function boot(){
  // Every supported domain serves the same panel and published Supabase content.
  // Do not redirect assets or create a loop with Vercel's domain redirect.
  const config=runtimeConfig();
  if(!config.url||!(config.publishableKey||config.anonKey)){
    loginError.textContent='Yönetim bağlantısı eksik. Vercel Supabase ayarlarını kontrol et.';loginError.hidden=false;
    document.querySelector('#login-form button').disabled=true;return;
  }
  document.querySelector('#login-form button').disabled=false;
  if(cloud.hasSession()){
    try{await loadPublished()}catch(error){loginError.textContent=error.message;loginError.hidden=false;setAuthenticated(false)}
  }
}
document.querySelector('#login-form').addEventListener('submit',handleLogin);
document.querySelector('#logout-button').addEventListener('click',logout);
document.querySelector('#retry-save').onclick=()=>syncSupabase();
document.querySelector('#download-draft').onclick=exportDraft;
document.querySelector('#reload-published').onclick=async()=>{
  if(!confirm('Taslağın yedek olarak indirilecek; ardından yayındaki güncel içerik açılacak. Devam edilsin mi?'))return;
  exportDraft();try{const row=await cloud.read();state=normalizeState(row?.payload||{site:DEFAULT_SITE,projects:original,albums:[]});revision=row?.updated_at||null;dirty=false;conflict=false;saveDraft();renderAll();switchView('overview');document.querySelector('#save-error').hidden=true;setSaveStatus('Yayındaki içerik güncel')}catch(error){showSaveError(error)}
};
window.addEventListener('online',()=>{if(dirty&&!conflict)syncSupabase()});
window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue=''}});

document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelectorAll('[data-action="new"]').forEach(button=>button.addEventListener('click',()=>openEditor()));
document.querySelector('#project-search').addEventListener('input',renderProjects);
document.querySelector('#project-form').addEventListener('submit',event=>{event.preventDefault();saveProject(event.currentTarget)});
document.querySelector('#project-form [name="files"]').addEventListener('input',syncFilesField);
document.querySelector('#cover-file').addEventListener('change',event=>{pendingCoverFile=event.target.files?.[0]||null;if(pendingCoverFile){document.querySelector('#project-form [name="cover"]').value='';renderCoverFile(pendingCoverFile);}});
document.querySelector('#project-form [name="cover"]').addEventListener('input',event=>{if(pendingCoverFile&&event.target.value.trim()){pendingCoverFile=null;document.querySelector('#cover-file').value=''}renderCoverPreview(event.target.value.trim())});
document.querySelector('#remove-cover').addEventListener('click',()=>{const current=document.querySelector('#project-form [name="cover"]').value.trim();if(isMediaRef(current))removedMediaRefs.add(current);pendingCoverFile=null;document.querySelector('#cover-file').value='';document.querySelector('#project-form [name="cover"]').value='assets/poster-5.jpg';renderCoverPreview('assets/poster-5.jpg')});
document.querySelector('#video-files').addEventListener('change',event=>{const incoming=Array.from(event.target.files||[]);const known=new Set(pendingVideoFiles.map(file=>`${file.name}:${file.size}:${file.lastModified}`));pendingVideoFiles=[...pendingVideoFiles,...incoming.filter(file=>{const key=`${file.name}:${file.size}:${file.lastModified}`;if(known.has(key))return false;known.add(key);return true})];event.target.value='';renderVideoList()});
document.querySelector('#close-dialog').onclick=()=>document.querySelector('#project-dialog').close();
document.querySelector('#cancel-dialog').onclick=()=>document.querySelector('#project-dialog').close();
document.querySelector('#project-dialog').addEventListener('close',()=>{clearCoverPreview();pendingVideoFiles=[];pendingCoverFile=null;removedMediaRefs=new Set()});
document.querySelector('#confirm-delete').onclick=deleteProject;
document.querySelector('#cancel-delete').onclick=()=>{pendingDelete=null;document.querySelector('#confirm-dialog').hidden=true};
document.querySelector('#about-form').addEventListener('submit',event=>{event.preventDefault();state.site=siteFrom(event.currentTarget);persist('Hakkında kaydedildi')});
document.querySelector('#settings-form').addEventListener('submit',event=>{event.preventDefault();state.site=siteFrom(event.currentTarget);persist()});

document.querySelector('#menu-toggle').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
renderAll();
boot();
