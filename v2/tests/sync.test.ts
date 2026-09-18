import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { blankState, newer, mergeState, syncClient } from '../src/sync-client.ts';

const flush = async (times = 1) => { for (let i = 0; i < times; i++) await new Promise(resolve => setImmediate(resolve)); };

function browserSandbox() {
  const store = new Map<string, string>();
  const sandbox: any = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key) : null),
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
    },
    location: { hash: '', pathname: '/', search: '' },
    history: { replaceState() {} },
    document: { getElementById: () => null },
    CustomEvent: class { type: string; detail: unknown; constructor(type: string, init?: { detail?: unknown }) { this.type = type; this.detail = init?.detail; } },
    window: { dispatchEvent() {} },
    addEventListener() {},
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    console,
    store,
  };
  return sandbox;
}

test('newer prefers the later timestamp', () => {
  assert.deepEqual(newer({ at: 1 }, { at: 2 }), { at: 2 });
  assert.deepEqual(newer({ at: 3 }, { at: 2 }), { at: 3 });
  assert.deepEqual(newer(undefined, { at: 2 }), { at: 2 });
  assert.deepEqual(newer({ at: 2 }, undefined), { at: 2 });
});

test('equal timestamps resolve identically regardless of argument order', () => {
  const a = { at: 5, deleted: true };
  const b = { at: 5, text: 'kept' };
  assert.deepEqual(newer(a, b), newer(b, a));
  const c = { at: 7, text: 'x' };
  const d = { at: 7, text: 'y' };
  assert.deepEqual(newer(c, d), newer(d, c));
});

test('the embedded browser client stays self-contained and free of type syntax', () => {
  assert.doesNotThrow(() => new Function(syncClient));
  assert.ok(!/\bexport\b/.test(syncClient), 'no export statements leaked into the bundle');
  assert.ok(!/:\s*(string|number|boolean|unknown)\b/.test(syncClient), 'no type annotations leaked into the bundle');
});

test('mergeState unions independent additions', () => {
  const merged = mergeState({ complete: { a: { at: 1 } } }, { complete: { b: { at: 2 } } });
  assert.ok(merged.complete.a);
  assert.ok(merged.complete.b);
  assert.deepEqual(merged.notes, {});
});

test('a tombstone beats an older remote mark in both directions', () => {
  const localDelete = mergeState({ complete: { a: { at: 5, deleted: true } } }, { complete: { a: { at: 1 } } });
  assert.equal(localDelete.complete.a.deleted, true);
  const remoteDelete = mergeState({ complete: { a: { at: 1 } } }, { complete: { a: { at: 5, deleted: true } } });
  assert.equal(remoteDelete.complete.a.deleted, true);
});

test('a legacy boolean mark behaves as timestamp zero', () => {
  const merged = mergeState({ complete: { a: true } }, { complete: { a: { at: 5, deleted: true } } });
  assert.equal(merged.complete.a.deleted, true);
});

test('notes merge by timestamp', () => {
  const merged = mergeState({ notes: { u: { text: 'old', at: 1 } } }, { notes: { u: { text: 'new', at: 2 } } });
  assert.equal(merged.notes.u.text, 'new');
});

test('an edit during an in-flight PUT is uploaded by a follow-up sync', async () => {
  const sandbox = browserSandbox();
  sandbox.store.set('sourcebook-state', JSON.stringify({ ...blankState(), complete: { u1: { at: 1 } } }));
  sandbox.store.set('sourcebook-key', 'a'.repeat(64));
  const putBodies: any[] = [];
  let release: (() => void) | undefined;
  let putCount = 0;
  sandbox.fetch = (url: string, opts: any = {}) => {
    if ((opts.method || 'GET') === 'GET') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 0, state: {} }) });
    putCount += 1;
    putBodies.push(JSON.parse(opts.body));
    if (putCount === 1) return new Promise(resolve => { release = () => resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 1, state: {} }) }); });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: putCount, state: {} }) });
  };
  vm.runInNewContext(syncClient, sandbox);
  await flush(3);
  assert.equal(putCount, 1);
  sandbox.window.SourcebookSync.toggleBookmark('u2');
  release!();
  await flush(8);
  assert.equal(putCount, 2);
  assert.ok(putBodies[1].state.bookmarks.u2);
});

test('a local unmark stays unmarked after merging a remote mark', async () => {
  const sandbox = browserSandbox();
  sandbox.store.set('sourcebook-state', JSON.stringify({ ...blankState(), complete: { u1: { at: 5, deleted: true } } }));
  sandbox.store.set('sourcebook-key', 'b'.repeat(64));
  const puts: any[] = [];
  sandbox.fetch = (url: string, opts: any = {}) => {
    if ((opts.method || 'GET') === 'GET') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 1, state: { ...blankState(), complete: { u1: { at: 1 } } } }) });
    puts.push(JSON.parse(opts.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 2, state: {} }) });
  };
  vm.runInNewContext(syncClient, sandbox);
  await flush(4);
  assert.equal(sandbox.window.SourcebookSync.isComplete('u1'), false);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].state.complete.u1.deleted, true);
});

test('a failed local write is reported instead of silently ignored', async () => {
  const sandbox = browserSandbox();
  const statusEl = { textContent: '' };
  sandbox.document = { getElementById: (id: string) => (id === 'sync-status' ? statusEl : null) };
  sandbox.localStorage.setItem = () => { throw new Error('quota exceeded'); };
  sandbox.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 0, state: {} }) });
  vm.runInNewContext(syncClient, sandbox);
  await flush(4);
  sandbox.window.SourcebookSync.toggleBookmark('u1');
  await flush(4);
  assert.match(statusEl.textContent, /storage full/i);
});

test('a network failure schedules a retry instead of giving up', async () => {
  const sandbox = browserSandbox();
  const timers: Array<() => void> = [];
  sandbox.setTimeout = (fn: () => void) => { timers.push(fn); return timers.length; };
  let calls = 0;
  sandbox.fetch = () => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 0, state: {} }) });
  };
  sandbox.store.set('sourcebook-key', 'c'.repeat(64));
  vm.runInNewContext(syncClient, sandbox);
  await flush(4);
  assert.equal(calls, 1);
  assert.ok(timers.length >= 1, 'a retry was scheduled');
  while (timers.length) {
    const next = timers.shift()!;
    next();
    await flush(4);
  }
  assert.ok(calls >= 2, 'the retry re-attempted the request');
});
