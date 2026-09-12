// Keep the PPT media byte-for-byte. Large hosted originals are reassembled as a Blob.
window.originalPlayer = (() => {
  let controller;
  let blobUrl;
  let generation = 0;
  const video = document.getElementById('player');
  const status = document.getElementById('media-status');
  const download = document.getElementById('download-original');
  const error = document.getElementById('video-error');
  const direct = document.getElementById('video-direct');

  function release() {
    generation += 1;
    controller?.abort();
    controller = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    status.hidden = true;
    download.hidden = true;
    error.hidden = true;
  }

  async function play(file) {
    release();
    if (!file) { status.textContent = 'Bu projeye henüz film eklenmedi.'; status.hidden = false; return; }
    const current = generation;
    controller = new AbortController();
    const signal = controller.signal;
    const name = file.replace(/^videos\//, '');
    const record = window.originalMedia?.[name];
    const url = /^https?:\/\//i.test(file) ? file : 'videos/' + name;
    error.hidden = true;
    status.hidden = false;
    status.textContent = 'Video yükleniyor…';
    try {
      let source = url;
      let downloadName = name;
      if (window.mediaStore?.isRef?.(file)) {
        const uploaded = await window.mediaStore.resolve(file);
        if (!uploaded) throw new Error('Uploaded video unavailable');
        source = uploaded.url;
        downloadName = uploaded.name || downloadName;
      } else if (record) {
        let loaded = 0;
        const parts = [];
        for (const chunk of record.chunks) {
          const response = await fetch(chunk, { signal });
          if (!response.ok) throw new Error('Video unavailable');
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            loaded += value.byteLength;
            if (current !== generation) return;
            status.textContent = `Video yükleniyor · %${Math.round(loaded / record.bytes * 100)}`;
          }
        }
        if (loaded !== record.bytes) throw new Error('Incomplete video');
        if (current !== generation) return;
        const type = record.type || (/\.mov$/i.test(name) ? 'video/quicktime' : 'video/mp4');
        blobUrl = URL.createObjectURL(new Blob(parts, { type }));
        source = blobUrl;
      }
      if (current !== generation) return;
      video.src = source;
      direct.href = source;
      download.href = source;
      download.download = downloadName;
      download.hidden = false;
      video.load();
      video.play().catch(() => { if (current === generation) status.hidden = true; });
    } catch (failure) {
      if (failure.name === 'AbortError' || current !== generation) return;
      status.textContent = 'Video yüklenemedi. Film düğmesine basarak tekrar deneyebilirsin.';
    }
  }
  video.addEventListener('loadeddata', () => { status.hidden = true; });
  video.addEventListener('error', () => { status.hidden = true; });
  return { play, release };
})();
