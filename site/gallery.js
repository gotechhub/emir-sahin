(function(){
  const dialog=document.createElement('dialog');dialog.className='gallery-dialog';dialog.id='gallery-dialog';dialog.setAttribute('aria-labelledby','gallery-title');
  dialog.innerHTML='<div class="gallery-bar"><h2 id="gallery-title"></h2><button id="close-gallery" aria-label="Fotoğraf görüntüleyiciyi kapat">Kapat ×</button></div><div class="gallery-stage"><img id="gallery-image" alt=""></div><p id="gallery-caption" class="gallery-caption"></p><div class="gallery-controls"><button id="photo-prev" aria-label="Önceki fotoğraf">← Önceki</button><span id="gallery-count" class="gallery-count" role="status" aria-live="polite"></span><button id="photo-fullscreen" aria-label="Fotoğrafı tam ekranda aç">Tam ekran</button><button id="photo-next" aria-label="Sonraki fotoğraf">Sonraki →</button></div>';
  document.body.append(dialog);let album,index=0,touchX=null;
  function show(next){
    if(!album?.photos.length)return;index=(next+album.photos.length)%album.photos.length;
    const photo=album.photos[index],img=document.querySelector('#gallery-image');img.src=PortfolioRender.image(photo.src);img.alt=photo.alt||album.title;
    document.querySelector('#gallery-caption').textContent=photo.alt||album.description||'';document.querySelector('#gallery-count').textContent=(index+1)+' / '+album.photos.length;
    document.querySelector('#photo-prev').disabled=document.querySelector('#photo-next').disabled=album.photos.length<2;
  }
  function open(value,start=0){if(!value?.photos?.length)return;album=value;document.querySelector('#gallery-title').textContent=value.title;show(start);dialog.showModal();document.body.classList.add('modal-open')}
  const close=()=>dialog.close();document.querySelector('#close-gallery').onclick=close;
  document.querySelector('#photo-prev').onclick=()=>show(index-1);document.querySelector('#photo-next').onclick=()=>show(index+1);
  const stage=dialog.querySelector('.gallery-stage');
  // Chrome/Safari refuse requestFullscreen() on a <dialog> itself ("Dialog
  // elements are invalid"), so the target has to be a plain child element —
  // the stage that wraps the image — not the dialog.
  const full=document.querySelector('#photo-fullscreen');if(!stage.requestFullscreen)full.hidden=true;full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen()}catch(_){full.hidden=true}};
  dialog.addEventListener('close',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});document.body.classList.remove('modal-open');document.querySelector('#gallery-image').removeAttribute('src')});
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(index-1)}if(event.key==='ArrowRight'){event.preventDefault();show(index+1)}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()});
  dialog.querySelector('.gallery-stage').addEventListener('touchstart',event=>touchX=event.touches.length===1?event.touches[0].clientX:null,{passive:true});
  dialog.querySelector('.gallery-stage').addEventListener('touchend',event=>{if(touchX!==null&&event.changedTouches.length){const delta=event.changedTouches[0].clientX-touchX;if(Math.abs(delta)>60)show(index+(delta<0?1:-1))}touchX=null},{passive:true});
  window.photoGallery={open};
})();
