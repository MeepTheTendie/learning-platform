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

const LIMIT = 2_000_000;

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > LIMIT) throw { status: 413, error: 'too_large' };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, error: 'invalid_json' };
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMIT) { await reader.cancel(); throw { status: 413, error: 'too_large' }; }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(data)); } catch { throw { status: 400, error: 'invalid_json' }; }
}

const snapshot = row => row
  ? { revision: Number(row.revision), state: JSON.parse(row.state_json), updatedAt: Number(row.updated_at) }
  : { revision: 0, state: null, updatedAt: null };
const current = env => env.PROGRESS_DB.prepare('SELECT revision,state_json,updated_at FROM progress WHERE app_id = ?').bind(env.APP_ID).first().then(snapshot);

const TUTOR_MAX_MESSAGES = 20, TUTOR_MAX_CHARS = 4000, TUTOR_MAX_TOTAL = 20000;
function tutorMessages(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > TUTOR_MAX_MESSAGES) throw { status: 400, error: 'invalid_messages' };
  let total = 0;
  return raw.map(message => {
    const role = message?.role, content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (role !== 'user' && role !== 'assistant') throw { status: 400, error: 'invalid_messages' };
    if (!content || content.length > TUTOR_MAX_CHARS) throw { status: 400, error: 'invalid_messages' };
    total += content.length; if (total > TUTOR_MAX_TOTAL) throw { status: 400, error: 'invalid_messages' };
    return { role, content };
  });
}
async function bumpTutorUsage(env) {
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.PROGRESS_DB.prepare('INSERT INTO tutor_usage (app_id,day,messages) VALUES (?,?,1) ON CONFLICT(app_id,day) DO UPDATE SET messages=messages+1 RETURNING messages').bind(env.APP_ID, day).first();
  return Number(row?.messages) || 0;
}
const tutorSystem = lesson => `You are a patient Socratic tutor inside a study app, helping with the unit "${lesson.title}". Use only the unit material below and keep the learner thinking.\n\nUnit material:\n${lesson.material}\n\nRules: stay on this unit; never invent facts outside it; keep replies under 120 words; ask one short question back when it helps; encourage the learner's own reasoning; do not claim to grade work or give an official answer key. If asked about something outside the unit, say you can only help with this unit.`;

async function tutor(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!(await authorized(request, env))) return json({ error: 'unauthorized' }, 401);
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'origin' }, 403);
  if (env.TUTOR_ENABLED === 'false') return json({ error: 'tutor_disabled' }, 503);
  if (!env.AI) return json({ error: 'ai_unavailable' }, 503);
  try {
    const body = await readBody(request);
    const subject = String(body?.subject || ''), unitId = String(body?.unitId || '');
    if (!/^[a-z0-9-]+$/.test(subject) || !/^[0-9]{2}-[a-z0-9-]+$/.test(unitId)) return json({ error: 'invalid_lesson' }, 400);
    const messages = tutorMessages(body?.messages);
    const materialResponse = await env.ASSETS.fetch(new Request(new URL('/tutor/' + subject + '/' + unitId + '.json', request.url)));
    if (!materialResponse.ok) return json({ error: 'lesson_unavailable' }, 503);
    const lesson = await materialResponse.json();
    const limit = Number(env.TUTOR_DAILY_LIMIT) || 40;
    const used = await bumpTutorUsage(env);
    if (used > limit) return json({ error: 'daily_limit', limit }, 429);
    const result = await env.AI.run(env.TUTOR_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8', { messages: [{ role: 'system', content: tutorSystem(lesson) }, ...messages], max_tokens: 400, temperature: 0.4 });
    const reply = typeof result?.response === 'string' ? result.response.trim() : '';
    if (!reply) return json({ error: 'empty_response' }, 502);
    return json({ reply, remaining: Math.max(0, limit - used) });
  } catch (error) {
    if (error?.status) return json({ error: error.error }, error.status);
    console.error(JSON.stringify({ event: 'tutor_failure' }));
    return json({ error: 'tutor_unavailable' }, 503);
  }
}

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
    if (url.pathname === '/api/tutor') return tutor(request, env, url);
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
