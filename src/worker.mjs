const CLIENT = String.raw`(() => {
  const script = document.currentScript;
  const APP_ID = script?.dataset.app || '';
  const STORAGE_KEY = script?.dataset.storage || '';
  const COOKIE = 'learning_sync_key';
  const LOCAL_KEY = 'learning-cloud-key-v1';
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  let timer = 0;
  let syncing = false;
  let pending = false;

  function readCookie() {
    return document.cookie.split('; ').find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
  }
  function saveKey(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) return false;
    document.cookie = COOKIE + '=' + key + '; Domain=history-atlas.workers.dev; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
    originalSet.call(localStorage, LOCAL_KEY, key);
    return true;
  }
  function getKey() {
    return readCookie() || originalGet.call(localStorage, LOCAL_KEY) || '';
  }
  function receivePairingKey() {
    if (!location.hash.startsWith('#sync=')) return;
    const key = new URLSearchParams(location.hash.slice(1)).get('sync') || '';
    if (saveKey(key)) history.replaceState(null, '', location.pathname + location.search);
  }
  function parse(value) {
    try { return value ? JSON.parse(value) : null; } catch { return null; }
  }
  function identity(value) {
    if (!value || typeof value !== 'object') return JSON.stringify(value);
    for (const key of ['id', 'key', 'date', 'day', 'readingId', 'lessonId', 'sectionId', 'created', 'createdAt']) {
      if (value[key] != null) return key + ':' + String(value[key]);
    }
    return JSON.stringify(value);
  }
  function merge(left, right) {
    if (left == null) return right;
    if (right == null) return left;
    if (Array.isArray(left) && Array.isArray(right)) {
      const out = left.slice();
      const indexes = new Map(out.map((v, i) => [identity(v), i]));
      for (const item of right) {
        const id = identity(item);
        if (indexes.has(id) && item && typeof item === 'object') {
          const i = indexes.get(id);
          out[i] = merge(out[i], item);
        } else if (!indexes.has(id)) {
          indexes.set(id, out.length);
          out.push(item);
        }
      }
      return out;
    }
    if (typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      const out = {};
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) out[key] = merge(left[key], right[key]);
      return out;
    }
    if (typeof left === 'number' && typeof right === 'number') return Math.max(left, right);
    if (typeof left === 'boolean' && typeof right === 'boolean') return left || right;
    if (typeof left === 'string' && typeof right === 'string') return right.length >= left.length ? right : left;
    return right;
  }
  function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function statusWidget() {
    const box = document.createElement('div');
    box.id = 'learning-cloud-sync';
    box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 10px;border-radius:9px;background:#10202b;color:#fff;font:12px/1.25 system-ui,sans-serif;box-shadow:0 3px 16px #0005;display:flex;gap:8px;align-items:center';
    const label = document.createElement('span');
    label.textContent = 'Cloud sync: connecting';
    const pair = document.createElement('button');
    pair.type = 'button';
    pair.textContent = 'Pair another device';
    pair.style.cssText = 'border:0;border-radius:6px;padding:4px 7px;cursor:pointer;background:#f2b84b;color:#15202b;font:600 11px system-ui,sans-serif';
    pair.hidden = true;
    pair.onclick = async () => {
      const key = getKey();
      const link = 'https://history-atlas.history-atlas.workers.dev/#sync=' + encodeURIComponent(key);
      try { await navigator.clipboard.writeText(link); label.textContent = 'Pairing link copied'; }
      catch { window.prompt('Copy this pairing link:', link); }
    };
    box.append(label, pair);
    (document.body || document.documentElement).append(box);
    return { set(text, canPair = true) { label.textContent = text; pair.hidden = !canPair; } };
  }

  let widget;
  function setStatus(text, canPair = true) {
    if (!widget && document.body) widget = statusWidget();
    if (widget) widget.set(text, canPair);
  }
  async function request(method, state) {
    const key = getKey();
    if (!key) throw new Error('setup');
    const response = await fetch('/api/progress', {
      method,
      headers: { 'Authorization': 'Bearer ' + key, ...(state === undefined ? {} : {'Content-Type':'application/json'}) },
      body: state === undefined ? undefined : JSON.stringify({state}),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'setup' : 'network');
    return response.json();
  }
  async function upload() {
    if (syncing) { pending = true; return; }
    syncing = true;
    clearTimeout(timer);
    try {
      const state = parse(originalGet.call(localStorage, STORAGE_KEY));
      if (state) await request('PUT', state);
      setStatus('Cloud sync: saved');
    } catch (error) {
      setStatus(error.message === 'setup' ? 'Cloud sync: setup needed' : 'Cloud sync: offline', error.message !== 'setup');
    } finally {
      syncing = false;
      if (pending) { pending = false; timer = setTimeout(upload, 200); }
    }
  }
  function queueUpload() { clearTimeout(timer); timer = setTimeout(upload, 500); }

  receivePairingKey();
  Storage.prototype.setItem = function(key, value) {
    originalSet.call(this, key, value);
    if (this === localStorage && key === STORAGE_KEY) queueUpload();
  };
  addEventListener('DOMContentLoaded', () => setStatus(getKey() ? 'Cloud sync: connecting' : 'Cloud sync: setup needed', Boolean(getKey())));
  addEventListener('online', queueUpload);
  addEventListener('pagehide', () => { if (getKey()) navigator.sendBeacon?.('/api/progress-beacon', JSON.stringify({key:getKey(),state:parse(originalGet.call(localStorage, STORAGE_KEY))})); });

  (async () => {
    if (!getKey()) { setStatus('Cloud sync: setup needed', false); return; }
    try {
      let local = parse(originalGet.call(localStorage, STORAGE_KEY));
      const cloud = await request('GET');
      if (APP_ID === 'grammar-reader' && Array.isArray(local?.done) && local.done.join(',') === '5,6,7,8,9,10,11,12,13' && Array.isArray(cloud.state?.done) && cloud.state.done.includes(14)) local = cloud.state;
      const combined = merge(cloud.state, local);
      if (combined && !equal(combined, local)) {
        originalSet.call(localStorage, STORAGE_KEY, JSON.stringify(combined));
        await request('PUT', combined);
        if (!sessionStorage.getItem('learning-cloud-reloaded-' + APP_ID)) {
          sessionStorage.setItem('learning-cloud-reloaded-' + APP_ID, '1');
          location.reload();
          return;
        }
      } else if (local) {
        await request('PUT', local);
      }
      sessionStorage.removeItem('learning-cloud-reloaded-' + APP_ID);
      setStatus('Cloud sync: saved');
    } catch (error) {
      setStatus(error.message === 'setup' ? 'Cloud sync: setup needed' : 'Cloud sync: offline', error.message !== 'setup');
    }
  })();
})();`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
}
async function authorized(request, env, supplied) {
  const key = supplied || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return /^[a-f0-9]{64}$/.test(key) && await sha256(key) === env.SYNC_KEY_HASH;
}
function identity(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  for (const key of ['id', 'key', 'date', 'day', 'readingId', 'lessonId', 'sectionId', 'created', 'createdAt']) if (value[key] != null) return key + ':' + String(value[key]);
  return JSON.stringify(value);
}
function merge(left, right) {
  if (left == null) return right;
  if (right == null) return left;
  if (Array.isArray(left) && Array.isArray(right)) {
    const out = left.slice();
    const indexes = new Map(out.map((v, i) => [identity(v), i]));
    for (const item of right) {
      const id = identity(item);
      if (indexes.has(id) && item && typeof item === 'object') { const i = indexes.get(id); out[i] = merge(out[i], item); }
      else if (!indexes.has(id)) { indexes.set(id, out.length); out.push(item); }
    }
    return out;
  }
  if (typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
    const out = {};
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) out[key] = merge(left[key], right[key]);
    return out;
  }
  if (typeof left === 'number' && typeof right === 'number') return Math.max(left, right);
  if (typeof left === 'boolean' && typeof right === 'boolean') return left || right;
  if (typeof left === 'string' && typeof right === 'string') return right.length >= left.length ? right : left;
  return right;
}
async function current(env) {
  const row = await env.PROGRESS_DB.prepare('SELECT revision, state_json, updated_at FROM progress WHERE app_id = ?').bind(env.APP_ID).first();
  if (!row) return { revision: 0, state: null, updatedAt: null };
  return { revision: Number(row.revision), state: JSON.parse(row.state_json), updatedAt: Number(row.updated_at) };
}
async function save(env, incoming) {
  const before = await current(env);
  const state = merge(before.state, incoming);
  const revision = before.revision + 1;
  const updatedAt = Date.now();
  await env.PROGRESS_DB.prepare('INSERT INTO progress (app_id, revision, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(app_id) DO UPDATE SET revision = excluded.revision, state_json = excluded.state_json, updated_at = excluded.updated_at').bind(env.APP_ID, revision, JSON.stringify(state), updatedAt).run();
  return { revision, state, updatedAt };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/__cloud-sync.js') return new Response(CLIENT, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    if (url.pathname === '/api/progress') {
      if (!await authorized(request, env)) return json({error:'unauthorized'}, 401);
      if (request.method === 'GET') return json(await current(env));
      if (request.method !== 'PUT') return json({error:'method'}, 405);
      const text = await request.text();
      if (text.length > 2000000) return json({error:'too_large'}, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({error:'invalid_json'}, 400); }
      if (!body?.state || typeof body.state !== 'object' || Array.isArray(body.state)) return json({error:'invalid_state'}, 400);
      return json(await save(env, body.state));
    }
    if (url.pathname === '/api/progress-beacon' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({error:'invalid_json'}, 400); }
      if (!await authorized(request, env, body?.key)) return json({error:'unauthorized'}, 401);
      if (!body?.state || typeof body.state !== 'object' || Array.isArray(body.state)) return json({error:'invalid_state'}, 400);
      return json(await save(env, body.state));
    }
    const response = await env.ASSETS.fetch(request);
    if ((response.headers.get('content-type') || '').includes('text/html')) {
      const tag = '<script src="/__cloud-sync.js" data-app="' + env.APP_ID + '" data-storage="' + env.STORAGE_KEY + '"></script>';
      return new HTMLRewriter().on('head', { element(element) { element.append(tag, {html:true}); } }).transform(response);
    }
    return response;
  }
};
