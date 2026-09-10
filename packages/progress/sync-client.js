(() => {
  const script = document.currentScript;
  const app = script.dataset.app, key = script.dataset.storage;
  const mode = script.dataset.auth || 'legacy';
  // 'shared' reuses the account-wide pairing cookie; 'app' keeps an independent
  // key in this origin's localStorage so a new app cannot clobber the others.
  const keyScope = script.dataset.key || 'shared';
  const metaKey = 'learning-sync-v2-' + app;
  const read = name => { try { return JSON.parse(localStorage.getItem(name)); } catch { return null; } };
  const write = (name, value) => localStorage.setItem(name, JSON.stringify(value));
  const copy = value => JSON.parse(JSON.stringify(value));
  let meta = read(metaKey) || { revision: 0, base: null, syncId: null };
  let adapter, busy = false, applying = false, timer, retry = 1000, pendingUI = false;
  let canonical = read(key);
  let shown = read(key), label, merge, equal, lastStatus = 'Connecting…';
  const initial = read(key);
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  // A fresh browser's app defaults must not overwrite the cloud on first load.
  let initialBase;
  const legacyKey = () => keyScope === 'app'
    ? (localStorage.getItem('learning-cloud-key-v1-' + app) || '')
    : (document.cookie.split('; ').find(v => v.startsWith('learning_sync_key='))?.slice(18) || localStorage.getItem('learning-cloud-key-v1') || '');
  // Legacy pairing: a private link carries the shared key to a new device.
  const paired = location.hash.match(/^#sync=([a-f0-9]{64})$/i)?.[1];
  if (paired) {
    if (keyScope === 'app') localStorage.setItem('learning-cloud-key-v1-' + app, paired);
    else {
      document.cookie = 'learning_sync_key=' + paired + '; Domain=history-atlas.workers.dev; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
      localStorage.setItem('learning-cloud-key-v1', paired);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  function status(text) { lastStatus = text; if (label) label.textContent = text; }
  function queue(delay = 400) { clearTimeout(timer); timer = setTimeout(sync, delay); }
  function editing() { return document.activeElement?.matches('textarea,input,[contenteditable="true"],select'); }
  function backup(local, remote) {
    const name = metaKey + '-recovery';
    write(name, [...(read(name) || []), { at: new Date().toISOString(), local, remote }].slice(-3));
  }
  function mergeRetainingConflicts(base, local, remote) {
    const paths = [];
    const result = merge(base, local, remote, paths);
    if (paths.length) {
      // Never rotate unresolved conflicts out with routine download backups.
      // If storage fills, abort this merge before acknowledging any cloud write.
      const name = metaKey + '-conflicts';
      const entries = read(name) || [];
      const entry = { paths, local, remote };
      if (!entries.some(saved => equal(saved.paths, paths) && equal(saved.local, local) && equal(saved.remote, remote))) {
        write(name, [...entries, { ...entry, at: new Date().toISOString() }]);
      }
    }
    return result;
  }
  function apply() {
    if (!adapter || !pendingUI || editing()) return;
    const next = read(key);
    applying = true;
    try {
      adapter.apply(copy(next));
      shown = copy(adapter.read());
      pendingUI = false;
    } finally { applying = false; }
    window.dispatchEvent(new CustomEvent('learning-sync:applied'));
  }
  window.LearningSync = {
    register(value) {
      adapter = value;
      shown = copy(adapter.read());
      canonical = read(key) ?? shown;
      initialBase = initial === null ? copy(shown) : undefined;
      resolveReady();
      queue(0);
    },
    // Live app state, so shared modules can read and mutate the canonical
    // synced object instead of keeping a parallel localStorage copy.
    read() { return adapter ? adapter.read() : read(key); },
    whenReady() { return ready; },
    changed() {
      if (applying || !adapter) return;
      try {
        const incoming = copy(adapter.read());
        const combined = merge ? mergeRetainingConflicts(shown ?? undefined, incoming, canonical ?? undefined) : incoming;
        write(key, combined);
        canonical = combined;
        shown = incoming;
        pendingUI = !!equal && !equal(combined, shown);
        status('Saving…'); queue();
      } catch { status('Device storage full — export a backup'); }
    },
    syncNow() { queue(0); },
    // Re-render the app from its own in-memory state, e.g. after a shared
    // route (the exemplar review) hands the page back.
    refresh() { if (adapter) adapter.apply(copy(adapter.read())); },
    // Let shared lesson modules grant the app's native progress (one-time).
    award(key, xp) { return adapter?.award?.(key, xp); },
  };
  async function request(method, body, syncId) {
    const response = await fetch('/api/progress', {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      headers: { ...(mode === 'legacy' ? { Authorization: 'Bearer ' + legacyKey() } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(syncId ? { 'X-Sync-Id': syncId } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) throw Error('signin');
    if (response.status === 413) throw Error('too_large');
    if (!response.ok && response.status !== 409) throw Error('unavailable');
    const data = await response.json();
    if (response.status === 409 && data.error !== 'conflict') throw Error('unavailable');
    return { ...data, syncId: response.headers.get('x-sync-id') || data.syncId || syncId || null, conflict: response.status === 409 };
  }
  async function sync() {
    if (busy || !adapter) return;
    busy = true;
    let nextDelay = 5000;
    try {
      ({ mergeChanges: merge, equal } = await import('/sync-merge.js'));
      let remote = await request('GET');
      for (let attempt = 0; attempt < 5; attempt++) {
        const local = read(key) ?? copy(adapter.read());
        const base = meta.base ?? initialBase;
        const sent = remote.state === null ? local : mergeRetainingConflicts(base, local, remote.state);
        if (!equal(local, sent)) backup(local, remote.state);
        const syncId = crypto.randomUUID();
        const result = equal(sent, remote.state) ? remote : await request('PUT', { revision: remote.revision, state: sent, syncId }, syncId);
        if (result.conflict) { remote = result; continue; }
        const now = read(key) ?? local;
        const next = equal(now, local) ? sent : mergeRetainingConflicts(local, now, sent);
        // Write state before its acknowledgement so a crash never loses pending work.
        write(key, next);
        canonical = next;
        meta = { revision: result.revision, base: result.state, updatedAt: result.updatedAt, syncId: result.syncId || null };
        write(metaKey, meta);
        initialBase = undefined;
        pendingUI = !equal(next, shown);
        apply();
        retry = 1000;
        const pending = !equal(next, result.state);
        status(pending ? 'Saving…' : pendingUI ? 'Saved · updates after editing' : (read(metaKey + '-conflicts') || []).length ? 'Saved · conflict copy kept' : 'Saved');
        nextDelay = pending ? 400 : 5000;
        return;
      }
      throw Error('conflict');
    } catch (error) {
      status(error.message === 'signin' ? 'Sign in to sync' : error.message === 'too_large' ? 'Save too large — export a backup' : error.name === 'QuotaExceededError' ? 'Device storage full — export a backup' : 'Offline · saved on this device');
      nextDelay = error.message === 'signin' ? 30000 : retry;
      retry = Math.min(retry * 2, 60000);
    } finally { busy = false; queue(nextDelay); }
  }
  function init() {
    const host = document.querySelector('#save-status, #status');
    const box = document.createElement('details');
    box.dataset.learningSync = '';
    box.style.cssText = 'display:inline-block;font:12px system-ui;position:relative;margin:0 6px;max-width:100%';
    label = document.createElement('summary'); label.textContent = lastStatus; label.setAttribute('aria-label', 'Cloud save status');
    label.style.cursor = 'pointer'; box.append(label);
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;right:0;top:100%;z-index:1000;width:220px;max-width:80vw;padding:12px;border:1px solid #888;border-radius:8px;background:Canvas;color:CanvasText;box-shadow:0 3px 12px #0003';
    const login = document.createElement('a'); login.href = location.pathname + location.search; login.textContent = 'Sign in / reconnect'; panel.append(login);
    const backupButton = document.createElement('button'); backupButton.textContent = 'Download recovery backup'; backupButton.type = 'button';
    backupButton.onclick = () => {
      const blob = new Blob([JSON.stringify({ app, current: read(key), synced: meta.base, recovery: read(metaKey + '-recovery') || [], conflicts: read(metaKey + '-conflicts') || [] }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = app + '-sync-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    panel.append(backupButton); box.append(panel);
    if (mode === 'legacy' && legacyKey()) {
      const pair = document.createElement('button'); pair.type = 'button'; pair.textContent = 'Copy pairing link';
      pair.onclick = () => {
        const link = location.origin + location.pathname + '#sync=' + legacyKey();
        const done = () => status('Pairing link copied — keep it private');
        const failed = () => prompt('Copy this private pairing link', link);
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, failed); else failed();
      };
      panel.append(pair);
    }
    // Keep the widget outside <main> so views that replace the main content
    // (the exemplar review) cannot destroy it.
    const main = document.querySelector('main, #main');
    if (host && main && main.contains(host)) { host.hidden = true; document.body.append(box); }
    else if (host) { host.hidden = true; host.after(box); }
    else (document.querySelector('header') || document.body).append(box);
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, { once: true }); else init();
  addEventListener('online', () => queue(0));
  addEventListener('focus', () => queue(0));
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') queue(0); });
  addEventListener('focusout', () => setTimeout(() => { apply(); queue(0); }, 0));
  addEventListener('storage', event => {
    if (event.key === key) { canonical = read(key); pendingUI = true; apply(); queue(0); }
  });
})();
