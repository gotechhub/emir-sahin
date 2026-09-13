const data=JSON.parse(document.querySelector('#published-data').textContent);
const id=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop());
const album=data.albums?.find(a=>a.id===id);
document.querySelectorAll('[data-photo-index]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();photoGallery.open(album,Number(link.dataset.photoIndex))}));
document.querySelectorAll('video').forEach(video=>video.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause()})));
