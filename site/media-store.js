// Browser-persistent media storage for admin imports.
// Files stay byte-for-byte in IndexedDB; project JSON only stores an upload:<id> reference.
(function () {
  const DB_NAME = 'emirPortfolioMedia.v1';
  const STORE_NAME = 'files';
  const DB_VERSION = 1;
  const urlCache = new Map();
  const memoryFallback = new Map();

  function isRef(value) {
    return typeof value === 'string' && value.startsWith('upload:');
  }

  function openDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB açılamadı'));
    });
  }

  async function put(file) {
    if (!(file instanceof Blob)) throw new Error('Geçerli bir dosya seçilmedi');
    const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const entry = {
      id,
      blob: file,
      name: file.name || `import-${id}`,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      createdAt: new Date().toISOString()
    };
    const db = await openDb();
    if (!db) {
      memoryFallback.set(id, entry);
      return id;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Dosya kaydedilemedi'));
      tx.onabort = () => reject(tx.error || new Error('Dosya kaydedilemedi'));
    });
    return id;
  }

  async function get(refOrId) {
    const id = String(refOrId || '').replace(/^upload:/, '');
    if (!id) return null;
    const db = await openDb();
    if (!db) return memoryFallback.get(id) || null;
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Dosya okunamadı'));
    });
  }

  async function resolve(refOrUrl) {
    if (!isRef(refOrUrl)) return { url: refOrUrl, name: String(refOrUrl || '').split('/').pop() || 'video' };
    const id = String(refOrUrl).slice('upload:'.length);
    if (urlCache.has(id)) return urlCache.get(id);
    const entry = await get(id);
    if (!entry) return null;
    const result = { url: URL.createObjectURL(entry.blob), name: entry.name, type: entry.type, size: entry.size };
    urlCache.set(id, result);
    return result;
  }

  async function remove(refOrId) {
    const id = String(refOrId || '').replace(/^upload:/, '');
    if (!id) return;
    const cached = urlCache.get(id);
    if (cached) URL.revokeObjectURL(cached.url);
    urlCache.delete(id);
    memoryFallback.delete(id);
    const db = await openDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Dosya silinemedi'));
      tx.onabort = () => reject(tx.error || new Error('Dosya silinemedi'));
    });
  }

  function label(ref) {
    if (!isRef(ref)) return String(ref || '').split('/').pop() || 'Video';
    return 'İçe aktarılan dosya';
  }

  window.mediaStore = { isRef, put, get, resolve, remove, label };
})();
