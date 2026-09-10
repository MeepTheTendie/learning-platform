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
  if (!row) return { app: id, label, completed: 0, unit: 'lessons completed', points: 0, updatedAt: null };
  let state = {};
  try { state = JSON.parse(row.state_json); } catch {}
  const exemplars = state.exemplars && typeof state.exemplars === 'object' ? state.exemplars : {};
  let exemplarLessons = 0, exemplarPoints = 0;
  for (const record of Object.values(exemplars)) {
    if (record && record.completed === true) exemplarLessons++;
    if (record && Number.isFinite(record.points)) exemplarPoints += record.points;
  }
  let completed = exemplarLessons, unit = 'lessons completed', points = exemplarPoints;
  if (id === 'grammar-reader') {
    const done = Array.isArray(state.done) ? state.done.length : 0;
    const wins = Array.isArray(state.wins) ? state.wins.length : 0;
    const awards = state.awards && typeof state.awards === 'object' ? Object.values(state.awards).reduce((sum, value) => sum + (Number(value) || 0), 0) : 0;
    completed = done; unit = 'sections read'; points = done * 10 + wins * 25 + awards + exemplarPoints;
  } else if (id === 'history-atlas') {
    completed = Array.isArray(state.done) ? state.done.length : 0; unit = 'passages read';
  } else if (id === 'philosophy-scholar') {
    const lessons = state.lessons && typeof state.lessons === 'object' ? Object.values(state.lessons).filter(lesson => lesson && lesson.complete).length : 0;
    completed = lessons; unit = 'lessons completed'; points = (Number(state.xp) || 0) + exemplarPoints;
  }
  return { app: id, label, completed, unit, points, exemplarLessons, updatedAt: Number(row.updated_at) || null };
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
