// Supabase Auth and content persistence. No service-role key belongs in this file.
(function (scope) {
  const SESSION_KEY = 'emirSupabaseSession.v2';
  class CloudError extends Error {
    constructor(message, code = 'network') { super(message); this.code = code; }
  }
  function createClient(config, options = {}) {
    const url = String(config.url || '').trim().replace(/\/$/, '');
    const key = String(config.publishableKey || config.anonKey || config.key || '').trim();
    const fetcher = options.fetch || scope.fetch.bind(scope);
    const storage = options.storage || scope.sessionStorage;
    let session = null;
    let refreshing = null;
    try {
      const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
      if (saved?.url === url) session = saved;
    } catch (_) { /* A fresh login can recover unavailable browser storage. */ }
    function saveSession(data) {
      session = { url, access_token: data.access_token, refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600) };
      try { storage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {}
    }
    function clearSession() {
      session = null;
      try { storage.removeItem(SESSION_KEY); storage.removeItem('emirSupabaseSession.v1'); storage.removeItem('emirAdminAuth.v1'); } catch (_) {}
    }
    async function request(path, init = {}, auth = false, retry = true) {
      if (!url || !key) throw new CloudError('Yönetim bağlantısı yapılandırılmamış.', 'config');
      const token = auth ? await accessToken() : null;
      let response;
      try {
        response = await fetcher(url + path, {
          cache: 'no-store', ...init,
          signal: init.signal || AbortSignal.timeout(path.startsWith('/storage/') ? 15 * 60 * 1000 : 30000),
          headers: { apikey: key, ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...init.headers }
        });
      } catch (_) { throw new CloudError('Bağlantı kurulamadı. Değişikliklerin bu tarayıcıda korunuyor.'); }
      let raw;
      try { raw = await response.text(); }
      catch (_) { throw new CloudError('Sunucu yanıtı tamamlanamadı. Değişikliklerin korunuyor; yeniden denenecek.'); }
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
      if (!response.ok && /invalid api key/i.test(data?.message || '')) throw new CloudError('Supabase bağlantı anahtarı geçersiz. Vercel bağlantı ayarı güncellenmeli.', 'config');
      if (response.status === 401 && auth && retry && session?.refresh_token) {
        await refresh();
        return request(path, init, auth, false);
      }
      if (!response.ok) {
        if (/invalid api key/i.test(data?.message || '')) throw new CloudError('Supabase bağlantı anahtarı geçersiz. Vercel bağlantı ayarı güncellenmeli.', 'config');
        if (response.status === 401) {
          clearSession();
          throw new CloudError('Oturumun sona erdi. Tekrar giriş yap; taslağın korunuyor.', 'auth');
        }
        if (response.status === 403 || data?.code === '42501') throw new CloudError('Kaydetme izni yok. Supabase tablo ve medya izinlerini kontrol et.', 'permission');
        if (response.status === 409) throw new CloudError('İçerik başka bir oturumda değişti. Yayındaki sürümü yükleyerek devam et.', 'conflict');
        if (response.status === 413) throw new CloudError('Dosya, depolama hizmetinin yükleme sınırını aşıyor. Supabase bucket ve plan limitini kontrol et.', 'storage');
        throw new CloudError(data?.error_description || data?.msg || data?.message || `Sunucu yanıtı: ${response.status}`, response.status >= 500 || response.status === 429 ? 'network' : 'request');
      }
      return data;
    }
    async function refresh() {
      if (refreshing) return refreshing;
      if (!session?.refresh_token) throw new CloudError('Tekrar giriş yapman gerekiyor.', 'auth');
      refreshing = (async () => {
        try {
          const data = await request('/auth/v1/token?grant_type=refresh_token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
          if (!data?.access_token) throw new CloudError('Tekrar giriş yapman gerekiyor.', 'auth');
          saveSession(data);
          return session.access_token;
        } catch (error) {
          if (error.code !== 'network' && error.code !== 'config') { clearSession(); throw new CloudError('Oturumun sona erdi. Tekrar giriş yap; taslağın korunuyor.', 'auth'); }
          throw error;
        } finally { refreshing = null; }
      })();
      return refreshing;
    }
    async function accessToken() {
      if (!session?.access_token) throw new CloudError('Devam etmek için giriş yap.', 'auth');
      if (session.expires_at * 1000 <= Date.now() + 60000) return refresh();
      return session.access_token;
    }
    async function signIn(email, password) {
      const data = await request('/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      if (!data?.access_token) throw new CloudError('Giriş yapılamadı.', 'auth');
      saveSession(data);
    }
    async function signOut() {
      const token = session?.access_token;
      clearSession();
      if (token) {
        try { await request('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
      }
    }
    async function read() {
      const rows = await request('/rest/v1/site_content?id=eq.main&select=payload,updated_at', {}, true);
      if (!Array.isArray(rows)) throw new CloudError('Yayındaki içerik okunamadı.', 'data');
      const row = rows[0];
      if (row && (!Array.isArray(row.payload?.projects) || !row.payload?.site)) throw new CloudError('Yayındaki içerik biçimi geçersiz. Veri değiştirilmedi.', 'data');
      return row || null;
    }
    async function save(payload, revision) {
      const updated_at = new Date().toISOString();
      const body = JSON.stringify({ id: 'main', payload, updated_at });
      const path = revision === null ? '/rest/v1/site_content' : `/rest/v1/site_content?id=eq.main&updated_at=eq.${encodeURIComponent(revision)}`;
      let rows;
      try {
        rows = await request(path, { method: revision === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body }, true);
      } catch (error) {
        // A connection can drop after the server committed a write.
        if (error.code !== 'conflict' && error.code !== 'network') throw error;
        try { const current = await read(); if (current && equal(current.payload, payload)) return current; } catch (_) {}
        throw error;
      }
      if (!Array.isArray(rows) || !rows.length) {
        const current = await read();
        if (current && equal(current.payload, payload)) return current;
        throw new CloudError('İçerik başka bir oturumda değişti. Taslağın korundu; yayındaki sürümü yükle.', 'conflict');
      }
      return rows[0];
    }
    // Small files: a single request. It is capped by the browser/proxy and is
    // unreliable for large media, so only used under the resumable threshold.
    async function uploadStandard(entry, encoded) {
      await request('/storage/v1/object/portfolio-media/' + encoded, {
        method: 'POST', headers: { 'Content-Type': entry.type || 'application/octet-stream', 'x-upsert': 'true' }, body: entry.blob
      }, true);
    }
    // Large files: TUS resumable upload in 6 MB chunks. Survives brief drops,
    // reports progress, and lets Supabase accept files well beyond a single POST.
    async function uploadResumable(entry, path, size, onProgress) {
      const b64 = value => btoa(unescape(encodeURIComponent(String(value))));
      const metadata = [
        'bucketName ' + b64('portfolio-media'),
        'objectName ' + b64(path),
        'contentType ' + b64(entry.type || 'application/octet-stream'),
        'cacheControl ' + b64('3600')
      ].join(',');
      const auth = async () => ({ apikey: key, authorization: 'Bearer ' + (await accessToken()), 'Tus-Resumable': '1.0.0' });
      const mapStatus = (status, fallback) => {
        if (status === 401) { clearSession(); return new CloudError('Oturumun sona erdi. Tekrar giriş yap; taslağın korunuyor.', 'auth'); }
        if (status === 403) return new CloudError('Kaydetme izni yok. Supabase medya izinlerini kontrol et.', 'permission');
        if (status === 413) return new CloudError('Dosya, depolama hizmetinin yükleme sınırını aşıyor. Supabase bucket ve plan limitini kontrol et.', 'storage');
        return new CloudError(fallback + ' (sunucu ' + status + ')', status >= 500 || status === 429 ? 'network' : 'request');
      };
      let response;
      try {
        response = await fetcher(url + '/storage/v1/upload/resumable', {
          method: 'POST', signal: AbortSignal.timeout(30000),
          headers: { ...(await auth()), 'Upload-Length': String(size), 'Upload-Metadata': metadata, 'x-upsert': 'true' }
        });
      } catch (_) { throw new CloudError('Bağlantı kurulamadı. Değişikliklerin bu tarayıcıda korunuyor.'); }
      if (!response.ok && response.status !== 201) throw mapStatus(response.status, 'Yükleme başlatılamadı.');
      let location = response.headers.get('Location') || response.headers.get('location');
      if (!location) throw new CloudError('Dosya yükleme başlatılamadı. Supabase medya deposunu kontrol et.', 'storage');
      if (!/^https?:\/\//i.test(location)) location = url + (location.startsWith('/') ? '' : '/') + location;
      const chunkSize = 6 * 1024 * 1024;
      let offset = 0;
      if (onProgress) onProgress(0, size);
      while (offset < size) {
        const end = Math.min(offset + chunkSize, size);
        let patch;
        try {
          patch = await fetcher(location, {
            method: 'PATCH', body: entry.blob.slice(offset, end), signal: AbortSignal.timeout(15 * 60 * 1000),
            headers: { ...(await auth()), 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }
          });
        } catch (_) { throw new CloudError('Yükleme kesildi. Değişikliklerin korunuyor; bağlantı gelince yeniden denenecek.'); }
        if (patch.status === 409 || patch.status === 460) {
          // Offset mismatch: ask the server where it stopped, then continue.
          const head = await fetcher(location, { method: 'HEAD', headers: await auth() });
          const server = Number(head.headers.get('Upload-Offset'));
          if (!Number.isFinite(server)) throw new CloudError('Yükleme sürdürülemedi. Yeniden dene.', 'storage');
          offset = server; if (onProgress) onProgress(offset, size); continue;
        }
        if (!patch.ok && patch.status !== 204) throw mapStatus(patch.status, 'Dosya yüklenemedi.');
        offset = Number(patch.headers.get('Upload-Offset')) || end;
        if (onProgress) onProgress(offset, size);
      }
    }
    async function upload(entry, onProgress) {
      const name = String(entry.name || 'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
      const path = `uploads/${entry.id}-${name}`;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const size = Number(entry.size) || (entry.blob && entry.blob.size) || 0;
      if (size > 6 * 1024 * 1024) await uploadResumable(entry, path, size, onProgress);
      else await uploadStandard(entry, encoded);
      return url + '/storage/v1/object/public/portfolio-media/' + encoded;
    }
    return { signIn, signOut, read, save, upload, hasSession: () => Boolean(session?.access_token), accessToken };
  }
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
  }
  scope.PortfolioCloud = { createClient, CloudError, equal };
})(typeof window === 'undefined' ? globalThis : window);
