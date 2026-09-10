'use strict';
const KEY = 'geography-atlas-v1';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function fresh() { return { app: 'geography-atlas', version: 1, light: false, exemplars: {}, tutor: {}, awards: {} }; }
function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw Error('Choose a Geography Atlas version 1 JSON backup.');
  const state = fresh();
  if (raw.light === true) state.light = true;
  for (const field of ['exemplars', 'tutor', 'awards']) if (raw[field] && typeof raw[field] === 'object' && !Array.isArray(raw[field])) state[field] = raw[field];
  return state;
}

let state = fresh(), error = null;
try { const saved = localStorage.getItem(KEY); if (saved) state = validate(JSON.parse(saved)); } catch (cause) { error = cause.message; }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); window.LearningSync?.changed(); const status = $('#save-status'); if (status) status.textContent = 'Saved on this device'; return true; }
  catch { const status = $('#save-status'); if (status) status.textContent = 'Storage unavailable — export a backup'; return false; }
}
function appearance() { document.body.classList.toggle('light', state.light === true); const button = $('#theme'); if (button) button.textContent = state.light ? 'Dark' : 'Light'; }

function home() {
  return `<section class="hero"><div class="eyebrow">WORLD GEOGRAPHY · GUIDED LESSONS</div><h1>Read the world.</h1><p>Map skills, physical and human geography, and the regions of the world — as quick checks you can retry, with a tutor for the parts worth discussing.</p><div class="actions"><a class="button primary" href="#lessons">Open guided lessons</a><a class="button" href="#about">How this works</a></div></section>
  <section class="card"><div class="eyebrow">WHAT IS HERE</div><h2>Recognition first. Writing optional.</h2><p>Each lesson leads with multiple-choice checks you can retry freely. The written reflection is optional and comes with the passage beside it, so a blank page is never the wall.</p><p class="muted">Your progress and tutor conversations sync between your devices.</p></section>`;
}
function about() {
  return `<section class="card"><div class="eyebrow">HOW THIS WORKS</div><h1>How this works</h1><p>Lessons are recognition-first: answer, check, and retry as often as you like. The tutor answers only from the lesson material. Nothing is graded, and forgetting is expected — revisit any lesson whenever you want.</p><a class="button primary" href="#lessons">Open guided lessons</a></section>`;
}
function render() {
  appearance();
  const main = $('#main'); if (!main) return;
  const page = (location.hash || '#home').slice(1);
  main.innerHTML = page === 'about' ? about() : home();
}

$('#theme').onclick = () => { state.light = !state.light; appearance(); save(); };
window.LearningSync?.register({
  read: () => state,
  apply: next => { state = validate(next); if (location.hash.startsWith('#lessons') || location.hash === '#exemplar') return; render(); },
  award: (key, xp) => { state.awards ||= {}; if (state.awards[key] === undefined) { state.awards[key] = xp; save(); } },
});
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#lessons') && location.hash !== '#exemplar') render(); });
render();
if (error) { const main = $('#main'); if (main) main.insertAdjacentHTML('afterbegin', `<p class="muted">Saved data could not be loaded (${escapeHTML(error)}).</p>`); }
