'use strict';
const KEY = 'learning-hub-v1';
const KEY_NAME = 'learning-cloud-key-v1-learning-hub';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function fresh() { return { app: 'learning-hub', version: 1, light: false, logs: [] }; }
function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw Error('Choose a Learning Hub version 1 JSON backup.');
  const state = fresh();
  if (raw.light === true) state.light = true;
  if (Array.isArray(raw.logs)) state.logs = raw.logs.filter(log => log && typeof log === 'object')
    .map(log => ({ id: String(log.id || crypto.randomUUID()).slice(0, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(log.date) ? log.date : today(), source: String(log.source || '').slice(0, 120), subject: String(log.subject || '').slice(0, 120), minutes: Math.max(0, Math.min(1440, Number(log.minutes) || 0)), note: String(log.note || '').slice(0, 2000) }))
    .slice(-5000);
  return state;
}

let state = fresh(), error = null;
try { const saved = localStorage.getItem(KEY); if (saved) state = validate(JSON.parse(saved)); } catch (cause) { error = cause.message; }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); window.LearningSync?.changed(); const status = $('#save-status'); if (status) status.textContent = 'Saved on this device'; return true; }
  catch { const status = $('#save-status'); if (status) status.textContent = 'Storage unavailable'; return false; }
}
function appearance() { document.body.classList.toggle('light', state.light === true); const button = $('#theme'); if (button) button.textContent = state.light ? 'Dark' : 'Light'; }

function streak() {
  const days = new Set(state.logs.map(log => log.date));
  let count = 0; const cursor = new Date();
  for (;;) { const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`; if (!days.has(key)) break; count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}
function logFormHTML() {
  return `<form id="log-form"><div class="grid"><div class="form-row"><label for="log-date">Date</label><input id="log-date" name="date" type="date" value="${today()}" required></div><div class="form-row"><label for="log-source">Source</label><input id="log-source" name="source" placeholder="Khan Academy, Biblingo, a book…" required></div><div class="form-row"><label for="log-subject">Subject</label><input id="log-subject" name="subject" placeholder="Math, Greek, …" required></div><div class="form-row"><label for="log-minutes">Minutes</label><input id="log-minutes" name="minutes" type="number" min="1" max="1440" required></div></div><div class="form-row"><label for="log-note">What did you do?</label><textarea id="log-note" name="note" rows="2" placeholder="Optional note"></textarea></div><button class="primary" type="submit">Log session</button></form>`;
}
function logSummaryHTML() {
  const total = state.logs.reduce((sum, log) => sum + log.minutes, 0);
  const recent = [...state.logs].reverse().slice(0, 12);
  return `<div class="totals"><div><div class="n">${state.logs.length}</div><div class="muted">sessions logged</div></div><div><div class="n">${Math.round(total / 60 * 10) / 10}</div><div class="muted">hours</div></div><div><div class="n">${streak()}</div><div class="muted">day streak</div></div></div>${recent.length ? `<div style="margin-top:16px">${recent.map(log => `<div class="log-entry"><div><strong>${escapeHTML(log.subject || 'Learning')}</strong> <span class="meta">· ${escapeHTML(log.source)}</span>${log.note ? `<div class="meta">${escapeHTML(log.note)}</div>` : ''}</div><div class="meta">${escapeHTML(log.date)} · ${log.minutes} min</div></div>`).join('')}</div>` : '<p class="muted" style="margin-top:14px">Nothing logged yet. Add a session above.</p>'}`;
}
async function loadSubjects() {
  const target = $('#subjects'); if (!target) return;
  target.innerHTML = '<section class="card"><p class="muted">Loading subject progress…</p></section>';
  const key = localStorage.getItem(KEY_NAME) || '';
  let data = null;
  try {
    const response = await fetch('/api/hub', { headers: key ? { Authorization: 'Bearer ' + key } : {}, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (response.ok) data = await response.json();
  } catch {}
  if (!data) { target.innerHTML = '<section class="card"><div class="eyebrow">YOUR SUBJECTS</div><p class="muted">Subject progress is unavailable right now. Pair this device and try again.</p></section>'; return; }
  target.innerHTML = `<section class="card"><div class="eyebrow">YOUR SUBJECTS</div><div class="cards">${data.apps.map(app => `<div class="subject"><h3>${escapeHTML(app.label)}</h3><div class="stat">${app.lessonsCompleted}</div><div class="sub">lessons completed · ${app.points} pts</div><div class="sub">${app.updatedAt ? 'last active ' + new Date(app.updatedAt).toLocaleDateString() : 'no activity yet'}</div></div>`).join('')}</div></section>`;
}
function bindForm() {
  const form = $('#log-form'); if (!form) return;
  form.onsubmit = event => {
    event.preventDefault();
    const data = new FormData(form);
    state.logs.push({ id: crypto.randomUUID(), date: String(data.get('date') || today()), source: String(data.get('source') || '').slice(0, 120), subject: String(data.get('subject') || '').slice(0, 120), minutes: Math.max(0, Math.min(1440, Number(data.get('minutes')) || 0)), note: String(data.get('note') || '').slice(0, 2000) });
    save();
    render();
  };
}
function render() {
  appearance();
  const main = $('#main'); if (!main) return;
  main.innerHTML = `<section><div class="eyebrow">ALL YOUR LEARNING</div><h1>Your learning, in one place.</h1><p class="muted">Progress from the apps on this platform updates automatically. Log anything else — a course, a book, an app — by hand.</p></section><section class="card"><div class="eyebrow">LOG A SESSION</div>${logFormHTML()}</section><section id="subjects"></section><section class="card"><div class="eyebrow">YOUR LOG</div>${logSummaryHTML()}</section>`;
  bindForm();
  loadSubjects();
}

$('#theme').onclick = () => { state.light = !state.light; appearance(); save(); };
window.LearningSync?.register({
  read: () => state,
  apply: next => { state = validate(next); render(); },
});
render();
if (error) { const main = $('#main'); if (main) main.insertAdjacentHTML('afterbegin', `<p class="muted">Saved data could not be loaded (${escapeHTML(error)}).</p>`); }
