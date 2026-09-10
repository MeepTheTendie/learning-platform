import shared, { authorized } from '../../../packages/progress/worker.mjs';

// Subjects whose progress lives in the shared D1 table.
const SUBJECTS = [
  { id: 'grammar-reader', label: 'English' },
  { id: 'history-atlas', label: 'History' },
  { id: 'philosophy-scholar', label: 'Philosophy' },
  { id: 'geography-atlas', label: 'Geography' },
];
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

async function summarize(env, { id, label }) {
  const row = await env.PROGRESS_DB.prepare('SELECT revision,state_json,updated_at FROM progress WHERE app_id = ?').bind(id).first();
  if (!row) return { app: id, label, lessonsCompleted: 0, points: 0, activitiesPassed: 0, updatedAt: null };
  let state = {};
  try { state = JSON.parse(row.state_json); } catch {}
  const exemplars = state.exemplars && typeof state.exemplars === 'object' ? state.exemplars : {};
  let lessonsCompleted = 0, points = 0, activitiesPassed = 0;
  for (const record of Object.values(exemplars)) {
    if (record && record.completed === true) lessonsCompleted++;
    if (record && Number.isFinite(record.points)) points += record.points;
    if (record && record.passed && typeof record.passed === 'object') activitiesPassed += Object.values(record.passed).filter(Boolean).length;
  }
  return { app: id, label, lessonsCompleted, points, activitiesPassed, updatedAt: Number(row.updated_at) || null };
}

async function hub(request, env) {
  if (request.method !== 'GET') return json({ error: 'method' }, 405);
  if (!await authorized(request, env)) return json({ error: 'unauthorized' }, 401);
  try {
    const apps = [];
    for (const subject of SUBJECTS) apps.push(await summarize(env, subject));
    return json({ apps, generatedAt: Date.now() });
  } catch {
    console.error(JSON.stringify({ event: 'hub_failure' }));
    return json({ error: 'hub_unavailable' }, 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/hub') return hub(request, env);
    return shared.fetch(request, env, ctx);
  },
};
export { authorized };
