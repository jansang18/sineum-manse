/* 저장 명반 저장소: IndexedDB에 작은 기록만 두고 조금씩 읽는다. 최대 10만 개. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SavedStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const MAX_RECORDS = 100000;
  const DB_NAME = 'jansang-saved', STORE = 'charts', ORDER = 'order';
  const MIGRATED = 'saved_store_migrated_v1';
  const FIELDS = ['id','name','memo','fav','savedAt','year','month','day','hour','minute','unknown','gender','entered','buildingRegistry',
    'yStem','yBranch','mStem','mBranch','dStem','dBranch','hStem','hBranch'];
  const EXPORT_SKIP = new Set(['yStem','yBranch','mStem','mBranch','dStem','dBranch','hStem','hBranch','entered']);
  let dbPromise = null, fallback = null;

  /** 즐겨찾기 먼저, 최신 순서로 정렬되는 키. id를 붙여 키가 겹치지 않게 한다. */
  function compact(record) {
    const out = {};
    for (const key of FIELDS) if (record[key] !== undefined) out[key] = record[key];
    out.savedAt = Number.isFinite(out.savedAt) ? out.savedAt : 0;
    out.o = [out.fav ? 0 : 1, -out.savedAt, String(out.id)];
    return out;
  }
  const wrap = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const done = tx => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

  function legacyRecords(storage) {
    const list = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('saju:')) { try { list.push(JSON.parse(storage.getItem(key))); } catch (_) {} }
      }
      const old = JSON.parse(storage.getItem('saju_list') || '[]');
      if (Array.isArray(old)) list.push(...old);
    } catch (_) {}
    return list.filter(item => item && typeof item === 'object' && item.id);
  }

  async function migrate(db) {
    let storage;
    try { storage = root.localStorage; if (!storage || storage.getItem(MIGRATED)) return; } catch (_) { return; }
    const list = legacyRecords(storage);
    if (list.length) {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const item of list) store.put(compact(item));
      await done(tx);
    }
    // 원본은 지우지 않는다. 다시 옮기지 않도록 표시만 남긴다.
    storage.setItem(MIGRATED, String(list.length));
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      if (!root.indexedDB) throw new Error('no indexedDB');
      const request = root.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex(ORDER, 'o', { unique: true });
      };
      const db = await wrap(request);
      await migrate(db);
      try { root.navigator?.storage?.persist?.(); } catch (_) {}
      return db;
    })().catch(() => {
      // IndexedDB를 못 쓰는 환경: 메모리에 두고 작게 보관한다.
      fallback = new Map();
      try { for (const item of legacyRecords(root.localStorage)) fallback.set(item.id, compact(item)); } catch (_) {}
      return null;
    });
    return dbPromise;
  }
  const persistFallback = () => {
    try { root.localStorage.setItem('saju_list', JSON.stringify([...fallback.values()])); root.localStorage.setItem(MIGRATED, 'fallback'); } catch (_) {}
  };
  const compareKeys = (a, b) => a.o[0] - b.o[0] || a.o[1] - b.o[1] || (a.o[2] < b.o[2] ? -1 : a.o[2] > b.o[2] ? 1 : 0);

  async function count() {
    const db = await open();
    if (!db) return fallback.size;
    return wrap(db.transaction(STORE).objectStore(STORE).count());
  }
  async function get(id) {
    const db = await open();
    if (!db) return fallback.get(id) || null;
    return (await wrap(db.transaction(STORE).objectStore(STORE).get(id))) || null;
  }
  async function putMany(records) {
    const db = await open();
    const items = records.map(compact);
    if (!db) { for (const item of items) fallback.set(item.id, item); persistFallback(); return; }
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const item of items) store.put(item);
    await done(tx);
  }
  const put = record => putMany([record]);
  async function remove(id) {
    const db = await open();
    if (!db) { fallback.delete(id); persistFallback(); return; }
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await done(tx);
  }
  async function update(id, patch) {
    const current = await get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await put(next);
    return compact(next);
  }
  /** 정렬 순서대로 limit개를 읽는다. after는 이전 묶음 마지막 기록의 o 값. */
  async function page(after, limit) {
    const db = await open();
    if (!db) {
      const all = [...fallback.values()].sort(compareKeys);
      const start = after ? all.findIndex(item => compareKeys(item, { o: after }) > 0) : 0;
      return start < 0 ? [] : all.slice(start, start + limit);
    }
    const index = db.transaction(STORE).objectStore(STORE).index(ORDER);
    return wrap(index.getAll(after ? IDBKeyRange.lowerBound(after, true) : undefined, limit));
  }
  /** 전체를 묶음으로 훑는다. onBatch가 false를 돌려주면 멈춘다. */
  async function scan(onBatch, batchSize = 5000, start = null) {
    let after = start;
    for (;;) {
      const batch = await page(after, batchSize);
      if (!batch.length) return null;
      after = batch[batch.length - 1].o;
      if ((await onBatch(batch, after)) === false) return after;
      if (batch.length < batchSize) return null;
      await yieldToUi();
    }
  }
  const matcher = text => {
    const q = String(text || '').trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, '');
    return item => String(item.name || '').toLowerCase().includes(q) || String(item.memo || '').toLowerCase().includes(q) ||
      (digits.length >= 4 && (String(item.year) + String(item.month).padStart(2, '0') + String(item.day).padStart(2, '0')).includes(digits));
  };
  /** 검색. limit개를 찾으면 멈추고 next로 이어 간다. */
  async function search(text, { after = null, limit = 50, isStale = () => false, onProgress } = {}) {
    const test = matcher(text), items = [];
    let scanned = 0, next = null, finished = true;
    await scan((batch, last) => {
      if (isStale()) { finished = false; return false; }
      for (let i = 0; i < batch.length; i++) {
        if (test(batch[i])) {
          items.push(batch[i]);
          if (items.length >= limit) { next = batch[i].o; finished = false; return false; }
        }
      }
      scanned += batch.length;
      onProgress?.(scanned);
      return undefined;
    }, 5000, after);
    return { items, next, finished };
  }
  /** 내보내기: 묶음마다 조각을 만들어 메모리를 아낀다. */
  async function exportBlob(onProgress) {
    const total = await count();
    const head = { app: '잔상 만세력', version: 1, exportedAt: new Date().toISOString(), count: total };
    const parts = [JSON.stringify(head).slice(0, -1) + ',"records":['];
    let written = 0;
    await scan(batch => {
      const lines = batch.map(item => {
        const copy = {};
        for (const key of FIELDS) if (!EXPORT_SKIP.has(key) && item[key] !== undefined) copy[key] = item[key];
        return JSON.stringify(copy);
      });
      parts.push(new Blob([(written ? ',\n' : '') + lines.join(',\n')]));
      written += batch.length;
      onProgress?.(written, total);
    }, 20000);
    parts.push(']}');
    return { blob: new Blob(parts, { type: 'application/json' }), count: written };
  }

  /** 큰 JSON 파일을 통째로 읽지 않고, 배열 안의 기록을 하나씩 꺼낸다. */
  function recordScanner(onRecord) {
    let inArray = false, depth = 0, inString = false, escaped = false, carry = '', head = '', started = false, finished = false;
    return {
      head: () => head,
      started: () => started,
      push(text) {
        if (finished) return;
        let start = -1;
        for (let i = 0; i < text.length; i++) {
          const c = text.charCodeAt(i);
          if (inString) {
            if (escaped) escaped = false;
            else if (c === 92) escaped = true;
            else if (c === 34) inString = false;
            continue;
          }
          if (c === 34) { inString = true; continue; }
          if (!inArray) { if (c === 91) { inArray = true; started = true; head += text.slice(0, i); } continue; }
          if (c === 123 || c === 91) { if (depth === 0) start = i; depth++; }
          else if (c === 125 || c === 93) {
            if (depth === 0) { inArray = false; finished = true; onRecord(null); return; }
            depth--;
            if (depth === 0) {
              const piece = carry + text.slice(start < 0 ? 0 : start, i + 1);
              carry = ''; start = -1;
              onRecord(piece);
            }
          }
        }
        if (!started) head += text;
        else if (depth > 0) carry += text.slice(start < 0 ? 0 : start);
      }
    };
  }

  const hash = text => {
    let a = 0xdeadbeef, b = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
  };

  return Object.freeze({ MAX_RECORDS, open, count, get, put, putMany, remove, update, page, scan, search, exportBlob, recordScanner, compact, hash, yieldToUi });
});
