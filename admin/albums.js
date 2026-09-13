let albumDraft=null;
let albumBusy=false;
const albumDialog=document.createElement('dialog');
albumDialog.id='album-dialog';
albumDialog.setAttribute('aria-labelledby','album-dialog-title');
albumDialog.innerHTML=`<form id="album-form"><div class="dialog-head"><div><span class="eyebrow">FOTOĞRAF ALBÜMÜ</span><h2 id="album-dialog-title">Yeni albüm</h2></div><button type="button" class="close-button" id="close-album" aria-label="Kapat">×</button></div><div class="form-grid"><label class="full">Albüm adı<input name="title" required maxlength="150" placeholder="Örn. Set arkası"></label><label class="full">Açıklama<textarea name="description" rows="3" maxlength="2000" placeholder="Çekim veya albüm hakkında kısa bir açıklama"></textarea></label><div class="full media-editor"><span class="album-photos-label">Fotoğraflar</span><label class="upload-button">＋ Fotoğrafları içe aktar<input id="album-files" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple></label><p class="album-editor-help">Birden fazla fotoğraf seçebilirsin. Kapak seç, ↑ / ↓ ile sırala ve her fotoğrafa açıklama ekle. Orijinal dosyalar korunur.</p><div id="album-photos"></div></div></div><div class="dialog-footer"><button id="cancel-album" class="outline-button" type="button">İptal</button><button type="submit" class="lime-button">Albümü kaydet</button></div></form>`;
document.body.append(albumDialog);
function renderAlbums(){
  const list=document.querySelector('#album-list');list.replaceChildren();
  if(!state.albums?.length){list.innerHTML='<div class="empty-row">Henüz albüm yok. İlk albümünü oluşturup fotoğraflarını ekleyebilirsin.</div>';return}
  state.albums.forEach((album,index)=>{
    const row=document.createElement('article');row.className='project-admin-row';
    row.innerHTML='<img alt=""><div><strong>'+esc(album.title)+'</strong><small>'+album.photos.length+' fotoğraf</small></div><div class="role-cell">'+esc(album.description||'')+'</div><div class="media-order"><button aria-label="Albümü yukarı taşı" data-order="-1" '+(index===0?'disabled':'')+'>↑</button><button aria-label="Albümü aşağı taşı" data-order="1" '+(index===state.albums.length-1?'disabled':'')+'>↓</button></div><div class="project-actions"><button data-edit-album>Düzenle</button><button class="delete" data-delete-album>Sil</button></div>';
    setImageSource(row.querySelector('img'),album.cover||album.photos[0]?.src);
    row.querySelector('[data-edit-album]').onclick=()=>openAlbum(album.id);
    row.querySelector('[data-delete-album]').onclick=async()=>{
      if(!confirm('“'+album.title+'” albümü yayından kaldırılsın mı?'))return;
      state.albums=state.albums.filter(item=>item.id!==album.id);persist();renderAlbums();await cleanupMedia(collectMedia(album));
    };
    row.querySelectorAll('[data-order]').forEach(button=>button.onclick=()=>{
      const next=index+Number(button.dataset.order);if(next<0||next>=state.albums.length)return;
      [state.albums[index],state.albums[next]]=[state.albums[next],state.albums[index]];renderAlbums();persist();
    });list.append(row);
  });
}
function openAlbum(id){
  const current=state.albums?.find(item=>item.id===id);
  albumDraft=current?JSON.parse(JSON.stringify(current)):{id:'album-'+crypto.randomUUID(),title:'',description:'',cover:'',photos:[]};
  document.querySelector('#album-dialog-title').textContent=current?'Albümü düzenle':'Yeni albüm';
  const form=document.querySelector('#album-form');form.reset();form.elements.title.value=albumDraft.title;form.elements.description.value=albumDraft.description||'';
  renderAlbumPhotos();albumDialog.showModal();
}
function renderAlbumPhotos(){
  const list=document.querySelector('#album-photos');list.replaceChildren();
  albumDraft.photos.forEach((photo,index)=>{
    const row=document.createElement('div');row.className='photo-edit-row'+(photo.src===albumDraft.cover?' is-cover':'');
    row.innerHTML='<img alt=""><label>Fotoğraf açıklaması<input value="'+esc(photo.alt||'')+'" placeholder="Fotoğrafta ne görünüyor?"></label><div class="photo-edit-actions"><button type="button" data-cover>'+(photo.src===albumDraft.cover?'✓ Kapak':'Kapak yap')+'</button><button type="button" data-up aria-label="Fotoğrafı yukarı taşı" '+(index===0?'disabled':'')+'>↑</button><button type="button" data-down aria-label="Fotoğrafı aşağı taşı" '+(index===albumDraft.photos.length-1?'disabled':'')+'>↓</button><button type="button" data-remove aria-label="Fotoğrafı çıkar">×</button></div>';
    const image=row.querySelector('img');if(photo.file)image.src=photo.src;else setImageSource(image,photo.src);
    row.querySelector('input').oninput=event=>photo.alt=event.target.value;
    row.querySelector('[data-cover]').onclick=()=>{albumDraft.cover=photo.src;renderAlbumPhotos()};
    const move=delta=>{const next=index+delta;if(next<0||next>=albumDraft.photos.length)return;[albumDraft.photos[index],albumDraft.photos[next]]=[albumDraft.photos[next],albumDraft.photos[index]];renderAlbumPhotos()};
    row.querySelector('[data-up]').onclick=()=>move(-1);row.querySelector('[data-down]').onclick=()=>move(1);
    row.querySelector('[data-remove]').onclick=()=>{albumDraft.photos.splice(index,1);if(photo.file)URL.revokeObjectURL(photo.src);if(albumDraft.cover===photo.src)albumDraft.cover=albumDraft.photos[0]?.src||'';renderAlbumPhotos()};
    list.append(row);
  });
}
document.querySelector('#new-album').onclick=()=>openAlbum();
document.querySelector('#album-files').onchange=event=>{
  for(const file of event.target.files||[]){
    if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)){toast('JPG, PNG, WebP veya AVIF fotoğraf seç.');continue}
    const src=URL.createObjectURL(file);albumDraft.photos.push({src,alt:'',file});if(!albumDraft.cover)albumDraft.cover=src;
  }event.target.value='';renderAlbumPhotos();
};
document.querySelector('#album-form').onsubmit=async event=>{
  event.preventDefault();if(albumBusy)return;
  if(!albumDraft.photos.length){toast('Albüme en az bir fotoğraf ekle.');return}
  const form=event.currentTarget;const created=[];const old=state.albums.find(item=>item.id===albumDraft.id);
  albumBusy=true;form.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=true);
  try{
    const album={id:albumDraft.id,title:form.elements.title.value.trim(),description:form.elements.description.value.trim(),cover:albumDraft.cover,photos:[]};
    for(const [index,photo] of albumDraft.photos.entries()){
      let src=photo.src;if(photo.file){src='upload:'+await mediaStore.put(photo.file);created.push(src)}
      if(photo.src===album.cover)album.cover=src;
      album.photos.push({src,alt:photo.alt.trim()||album.title+' — fotoğraf '+(index+1)});
    }
    const index=state.albums.findIndex(item=>item.id===album.id);if(index===-1)state.albums.push(album);else state.albums[index]=album;
    await persist();albumDialog.close();renderAlbums();await cleanupMedia(collectMedia(old));
  }catch(error){for(const ref of created)await mediaStore.remove(ref).catch(()=>{});toast('Fotoğraflar saklanamadı. Tarayıcının depolama alanını kontrol et.')}
  finally{albumBusy=false;form.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=false)}
};
document.querySelector('#close-album').onclick=document.querySelector('#cancel-album').onclick=()=>{if(!albumBusy)albumDialog.close()};
albumDialog.addEventListener('cancel',event=>{if(albumBusy)event.preventDefault()});
albumDialog.addEventListener('close',()=>{for(const photo of albumDraft?.photos||[])if(photo.file)URL.revokeObjectURL(photo.src);albumDraft=null});
renderAlbums();
