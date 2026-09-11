// Sourcebook worker: serves the rendered site and a D1-backed progress API.
// Auth is a single private pairing key (64 hex chars) supplied as a bearer token.
// The account-wide key hash is stored as the SYNC_KEY_HASH secret.
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

const bytesToHex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const sha256hex = text => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(bytesToHex);

async function authorized(request, env) {
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!/^[a-f0-9]{64}$/.test(key)) return false;
  if (!/^[a-f0-9]{64}$/.test(env.SYNC_KEY_HASH || '')) return false;
  const digest = await sha256hex(key);
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ env.SYNC_KEY_HASH.charCodeAt(i);
  return diff === 0;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 2_000_000) throw { status: 413, error: 'too_large' };
  try { return JSON.parse(text); } catch { throw { status: 400, error: 'invalid_json' }; }
}

const snapshot = row => row
  ? { revision: Number(row.revision), state: JSON.parse(row.state_json), updatedAt: Number(row.updated_at) }
  : { revision: 0, state: null, updatedAt: null };
const current = env => env.PROGRESS_DB.prepare('SELECT revision,state_json,updated_at FROM progress WHERE app_id = ?').bind(env.APP_ID).first().then(snapshot);

async function progress(request, env, url) {
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  if (request.method === 'PUT' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'origin' }, 403);
  try {
    if (request.method === 'GET') return json(await current(env));
    if (request.method !== 'PUT') return json({ error: 'method' }, 405);
    const body = await readBody(request);
    if (!Number.isSafeInteger(body?.revision) || body.revision < 0) return json({ error: 'refresh_required' }, 409);
    if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) return json({ error: 'invalid_state' }, 400);
    const updatedAt = Date.now();
    // Comparison and write in one statement so a stale writer cannot clobber a newer snapshot.
    const row = body.revision === 0
      ? await env.PROGRESS_DB.prepare('INSERT INTO progress (app_id,revision,state_json,updated_at) VALUES (?,1,?,?) ON CONFLICT(app_id) DO NOTHING RETURNING revision,state_json,updated_at').bind(env.APP_ID, JSON.stringify(body.state), updatedAt).first()
      : await env.PROGRESS_DB.prepare('UPDATE progress SET revision=revision+1,state_json=?,updated_at=? WHERE app_id=? AND revision=? RETURNING revision,state_json,updated_at').bind(JSON.stringify(body.state), updatedAt, env.APP_ID, body.revision).first();
    if (!row) return json({ error: 'conflict', ...(await current(env)) }, 409);
    return json(snapshot(row));
  } catch (error) {
    if (error?.status) return json({ error: error.error }, error.status);
    console.error(JSON.stringify({ event: 'progress_failure' }));
    return json({ error: 'storage_unavailable' }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/progress') return progress(request, env, url);
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    if (url.pathname === '/' || url.pathname === '') {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }
    return env.ASSETS.fetch(request);
  },
};
