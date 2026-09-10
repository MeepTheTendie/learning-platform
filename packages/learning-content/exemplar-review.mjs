import { gradeActivity, renderActivity } from './learning-content.js';
import { exemplarRecord, recordExemplarAttempt, sanitizeExemplarProgress, setExemplarResponse } from './progress.js';
import { appendTutorMessage, sanitizeTutor, tutorRequestMessages, tutorThread } from './tutor.js';

const script = document.querySelector('script[data-subject]');
const subject = script?.dataset.subject || 'philosophy';
const subjectLabel = subject[0].toUpperCase() + subject.slice(1);
const legacyAnswersKey = `learning-exemplar-v1-${subject}`;
const legacyReviewKey = legacyAnswersKey + '-review';
const legacyTutorKey = `learning-tutor-v1-${subject}`;
const readLocal = name => { try { return JSON.parse(localStorage.getItem(name)) || {}; } catch { return {}; } };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const main = () => document.querySelector('main, #main');
const legacyKey = () => document.cookie.split('; ').find(value => value.startsWith('learning_sync_key='))?.slice(18) || localStorage.getItem('learning-cloud-key-v1') || '';
const isRecognition = activity => activity.type === 'choice' || activity.type === 'sequence';
let lesson, exemplar, catalog, progress = {}, tutor = {}, rendered = false, sending = false, tutorDraft = '';

const normalize = raw => ({ ...raw, activities: raw.activities.map(activity => ({ ...activity, responseId: `${raw.id}:${activity.id}` })) });

// Response IDs are `${lessonId}:${activityId}`; the legacy draft keys used that
// flat form, while canonical state nests activities under their lesson.
function splitResponseId(responseId) {
  const index = String(responseId).indexOf(':');
  return index > 0 ? [responseId.slice(0, index), responseId.slice(index + 1)] : [null, null];
}
function fromLegacy() {
  const out = {};
  for (const [responseId, value] of Object.entries(readLocal(legacyAnswersKey))) {
    const [lessonId, activityId] = splitResponseId(responseId);
    if (lessonId && activityId) exemplarRecord(out, lessonId).responses[activityId] = value;
  }
  for (const [responseId, meta] of Object.entries(readLocal(legacyReviewKey))) {
    const [lessonId, activityId] = splitResponseId(responseId);
    if (!lessonId || !activityId || !meta || typeof meta !== 'object') continue;
    const record = exemplarRecord(out, lessonId);
    if (Number.isFinite(meta.attempts)) record.attempts[activityId] = meta.attempts;
    if (typeof meta.passed === 'boolean') record.passed[activityId] = meta.passed;
  }
  return out;
}
function liveState() {
  const sync = window.LearningSync;
  return sync?.read ? sync.read() : null;
}
// Persist through the app's canonical state so the existing sync, conflict and
// recovery paths carry lesson work and tutor conversations between devices. The
// legacy keys remain a fallback for a build opened without the sync client.
function persist() {
  const sync = window.LearningSync;
  const state = liveState();
  if (sync?.read && state) { state.exemplars = progress; state.tutor = tutor; sync.changed(); return; }
  const answers = {}, review = {};
  for (const [lessonId, record] of Object.entries(progress)) {
    for (const [activityId, value] of Object.entries(record.responses)) answers[`${lessonId}:${activityId}`] = value;
    for (const [activityId, value] of Object.entries(record.attempts)) (review[`${lessonId}:${activityId}`] ??= {}).attempts = value;
    for (const [activityId, value] of Object.entries(record.passed)) (review[`${lessonId}:${activityId}`] ??= {}).passed = value;
  }
  localStorage.setItem(legacyAnswersKey, JSON.stringify(answers));
  localStorage.setItem(legacyReviewKey, JSON.stringify(review));
  localStorage.setItem(legacyTutorKey, JSON.stringify(tutor));
}
function awardPoints(record, key, xp) {
  record.awarded ??= {};
  if (record.awarded[key]) return 0;
  record.awarded[key] = true;
  record.points = (record.points || 0) + xp;
  return xp;
}
function lessonCopy() {
  if (!lesson.lesson) return '';
  return `<section class="card lesson-copy"><p>${escapeHTML(lesson.lesson.opening)}</p>${lesson.lesson.sections.map(section => `<div><h2>${escapeHTML(section.heading)}</h2><p>${escapeHTML(section.body)}</p></div>`).join('')}</section>`;
}
function tutorHTML() {
  const messages = tutorThread(tutor, lesson.id);
  return `<section class="card tutor" data-tutor><div class="eyebrow">DISCUSS THIS LESSON</div><p class="muted">Ask about this lesson and think it through with the tutor. It answers from the lesson material only.</p><div class="tutor-log" data-tutor-log style="max-height:320px;overflow:auto;display:grid;gap:10px;margin:10px 0">${messages.length ? messages.map(message => `<div class="tutor-message"><strong>${message.role === 'user' ? 'You' : 'Tutor'}</strong><p style="white-space:pre-wrap;margin:6px 0 0">${escapeHTML(message.content)}</p></div>`).join('') : '<p class="muted">Ask the first question below.</p>'}</div><form data-tutor-form><label class="sr-only" for="tutor-input">Your question</label><textarea id="tutor-input" data-tutor-input rows="2" style="width:100%;box-sizing:border-box" placeholder="Ask a question about this lesson…"></textarea><div class="actions"><button type="submit" data-tutor-send>Send</button></div></form><output data-tutor-status aria-live="polite"></output></section>`;
}
function responseFor(activity, node) {
  if (activity.type === 'choice') return node.querySelector('input:checked')?.value ?? '';
  if (activity.type === 'sequence') return (node.querySelector('[data-sequence]')?.value || '').split(',').map(value => Number(value.trim()) - 1).filter(Number.isInteger);
  return node.querySelector('textarea')?.value || '';
}
function activityHTML(activity, record) {
  const status = record.passed[activity.id];
  const attempts = record.attempts[activity.id] || 0;
  return `<article class="exemplar-activity" data-response-id="${escapeHTML(activity.responseId)}">${renderActivity(activity, record.responses[activity.id] ?? '')}${activity.hint ? `<details><summary>Hint</summary><p>${escapeHTML(activity.hint)}</p></details>` : ''}${activity.rubric?.length ? `<details><summary>Review criteria</summary><ul>${activity.rubric.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></details>` : ''}<button data-check type="button">${status ? 'Review again' : 'Check response'}</button><output aria-live="polite">${status ? `Passed after ${attempts} attempt${attempts === 1 ? '' : 's'}.` : ''}</output></article>`;
}
function bindActivity(node, activity, record, target) {
  const save = () => { setExemplarResponse(progress, lesson.id, activity.id, responseFor(activity, node)); persist(); };
  node.querySelectorAll('input,textarea').forEach(input => input.addEventListener('input', save));
  node.querySelector('[data-check]').onclick = () => {
    save();
    const prior = record.passed[activity.id], priorAttempts = record.attempts[activity.id] || 0;
    const current = recordExemplarAttempt(progress, lesson.id, activity.id, gradeActivity(activity, record.responses[activity.id]));
    const grants = [];
    if (current.passed[activity.id]) {
      if (activity.type === 'short-answer') { const xp = awardPoints(record, 'reflect:' + activity.id, 20); if (xp) grants.push(['reflect:' + activity.id, xp]); }
      if (!prior && priorAttempts > 0) { const xp = awardPoints(record, 'review:' + activity.id, 5); if (xp) grants.push(['review:' + activity.id, xp]); }
      const recognition = lesson.activities.filter(isRecognition);
      if (recognition.length && recognition.every(item => record.passed[item.id])) { const xp = awardPoints(record, 'complete', 30); if (xp) grants.push(['complete', xp]); }
    }
    persist();
    for (const [key, xp] of grants) window.LearningSync?.award?.(key, xp);
    const points = target.querySelector('[data-practice-points]');
    if (points) points.textContent = `${record.points || 0} practice points`;
    const attempts = current.attempts[activity.id];
    node.querySelector('output').textContent = current.passed[activity.id] ? `Passed after ${attempts} attempt${attempts === 1 ? '' : 's'}.${grants.length ? ' +' + grants.reduce((sum, [, xp]) => sum + xp, 0) + ' practice points.' : ''}` : 'Keep working. Revise your response and try again.';
    node.querySelector('[data-check]').textContent = current.passed[activity.id] ? 'Review again' : 'Check response';
  };
}
function renderLibrary() {
  const target = main(); if (!target) return;
  const groups = [];
  for (const item of catalog.lessons) (groups[item.world] ??= []).push(item);
  target.innerHTML = `<div class="page-heading"><div><div class="eyebrow">PHILOSOPHY · GUIDED LESSONS</div><h1>Guided lessons</h1><p>Practise the reasoning from each lesson with quick checks and a tutor. Your other study tools stay exactly where they are.</p></div><a class="button" href="#">Return to app</a></div>${groups.map(items => `<section class="card"><div class="eyebrow">${escapeHTML(items[0].worldTitle || '')}</div>${items.map(item => { const record = exemplarRecord(progress, item.id); const checked = Object.values(record.passed || {}).filter(Boolean).length; return `<a class="lesson-row" href="#lessons/${encodeURIComponent(item.id)}" style="display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(128,128,128,.35)"><span>${escapeHTML(item.title)}${item.boss ? ' · challenge' : ''}</span><small class="muted">${record.points || 0} pts · ${checked} checked</small></a>`; }).join('')}</section>`).join('')}`;
  rendered = true;
}
function render() {
  if (!lesson) return;
  const hash = location.hash || '';
  if (hash !== '#exemplar' && !hash.startsWith('#lessons/')) return;
  const target = main(); if (!target) return;
  const record = exemplarRecord(progress, lesson.id);
  const recognition = lesson.activities.filter(isRecognition);
  const reflections = lesson.activities.filter(activity => !isRecognition(activity));
  const passed = recognition.filter(activity => record.passed[activity.id]).length;
  const back = catalog ? '<a class="button" href="#lessons">← All lessons</a>' : '<a class="button" href="#">Return to app</a>';
  const recognitionHTML = recognition.length ? `<section class="card exemplar-review"><div class="eyebrow">QUICK CHECKS</div><p class="muted">Recognition first · ${passed}/${recognition.length} passed · <strong data-practice-points>${record.points || 0} practice points</strong>. The lesson stays above; check as often as you like.</p>${recognition.map(activity => activityHTML(activity, record)).join('')}</section>` : '';
  const reflectionHTML = reflections.length ? `<section class="card exemplar-review"><div class="eyebrow">OPTIONAL · IN YOUR OWN WORDS</div><p class="muted">Not required and not timed. If you draw a blank, open <em>Show the passage</em> or re-read the lesson above — that is the point, not a penalty.</p>${reflections.map(activity => activityHTML(activity, record)).join('')}</section>` : '';
  target.innerHTML = `<div class="page-heading"><div><div class="eyebrow">${catalog ? 'GUIDED LESSON' : 'MILESTONE 2 LESSON'}</div><h1>${escapeHTML(lesson.title)}</h1><p>${escapeHTML(lesson.objective)}</p></div>${back}</div>${lessonCopy()}${recognitionHTML}${reflectionHTML}${tutorHTML()}`;
  target.querySelectorAll('[data-response-id]').forEach(node => {
    const activity = lesson.activities.find(item => item.responseId === node.dataset.responseId);
    bindActivity(node, activity, record, target);
  });
  const form = target.querySelector('[data-tutor-form]');
  if (form) form.onsubmit = event => { event.preventDefault(); sendTutor(); };
  const tutorInput = target.querySelector('[data-tutor-input]');
  if (tutorInput) { tutorInput.value = tutorDraft; tutorInput.addEventListener('input', () => { tutorDraft = tutorInput.value; }); }
  const log = target.querySelector('[data-tutor-log]');
  if (log) log.scrollTop = log.scrollHeight;
  rendered = true;
}
async function sendTutor() {
  if (sending) return;
  const input = document.querySelector('[data-tutor-input]');
  const text = (input?.value ?? tutorDraft).trim();
  if (!text) return;
  tutorDraft = '';
  sending = true;
  try {
    appendTutorMessage(tutor, lesson.id, 'user', text);
    persist();
    render();
    document.querySelector('[data-tutor-status]').textContent = 'Thinking…';
    const response = await fetch('/api/tutor', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(legacyKey() ? { Authorization: 'Bearer ' + legacyKey() } : {}) },
      body: JSON.stringify({ lessonId: lesson.id, messages: tutorRequestMessages(tutor, lesson.id) }),
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 429) { document.querySelector('[data-tutor-status]').textContent = 'Daily tutor limit reached. Try again tomorrow.'; return; }
    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) { document.querySelector('[data-tutor-status]').textContent = 'Sign in to use the tutor.'; return; }
    if (!response.ok) throw Error('unavailable');
    const data = await response.json();
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw Error('empty');
    appendTutorMessage(tutor, lesson.id, 'assistant', data.reply.trim());
    const record = exemplarRecord(progress, lesson.id);
    const replyCount = tutorThread(tutor, lesson.id).filter(message => message.role === 'assistant').length;
    const tutorGrant = replyCount <= 6 ? awardPoints(record, 'tutor:' + replyCount, replyCount === 1 ? 10 : 2) : 0;
    persist();
    if (tutorGrant) window.LearningSync?.award?.('tutor:' + replyCount, tutorGrant);
    render();
    document.querySelector('[data-tutor-status]').textContent = Number.isFinite(data.remaining) ? `${data.remaining} tutor ${data.remaining === 1 ? 'reply' : 'replies'} left today.` : '';
  } catch {
    document.querySelector('[data-tutor-status]').textContent = 'Tutor unavailable right now. Your question is saved — try again shortly.';
  } finally { sending = false; }
}
async function loadLesson(id) {
  const response = await fetch(`content/lessons/${subject}/${encodeURIComponent(id)}.json`);
  if (!response.ok) return null;
  return normalize(await response.json());
}
function handleHash() {
  const hash = location.hash || '';
  if (catalog && hash.startsWith('#lessons')) {
    if (hash === '#lessons') { lesson = undefined; renderLibrary(); return; }
    const id = decodeURIComponent(hash.slice('#lessons/'.length));
    loadLesson(id).then(next => { if (next) { lesson = next; render(); } });
    return;
  }
  if (hash === '#exemplar') { lesson = exemplar; render(); return; }
  if (rendered) { rendered = false; window.LearningSync?.refresh?.(); }
}
async function start() {
  await window.LearningSync?.whenReady?.();
  const [catalogResponse, exemplarResponse] = await Promise.all([
    fetch(`content/lessons/${subject}/index.json`).catch(() => null),
    fetch(`content/exemplars/${subject}.json`),
  ]);
  catalog = catalogResponse?.ok ? await catalogResponse.json() : null;
  exemplar = exemplarResponse.ok ? normalize(await exemplarResponse.json()) : null;
  const state = liveState();
  progress = sanitizeExemplarProgress(state ? state.exemplars : fromLegacy());
  tutor = sanitizeTutor(state ? state.tutor : readLocal(legacyTutorKey));
  const legacy = fromLegacy();
  if (state && Object.keys(legacy).length) {
    // Move older local drafts into canonical state without overwriting anything
    // already synced from another device.
    for (const [lessonId, entry] of Object.entries(legacy)) {
      const record = exemplarRecord(progress, lessonId);
      for (const field of ['responses', 'attempts', 'passed']) {
        for (const [activityId, value] of Object.entries(entry[field])) if (record[field][activityId] === undefined) record[field][activityId] = value;
      }
    }
    persist();
    localStorage.removeItem(legacyAnswersKey);
    localStorage.removeItem(legacyReviewKey);
  }
  const host = document.querySelector('.top-tools,.header-tools,.tools,header');
  if (host && !host.querySelector('[data-exemplar-link]')) {
    const link = document.createElement('a'); link.href = catalog ? '#lessons' : '#exemplar'; link.dataset.exemplarLink = ''; link.className = 'button';
    link.textContent = catalog ? 'Guided lessons' : (exemplar?.lesson ? 'Start lesson' : 'Review exemplar');
    host.append(link);
  }
  addEventListener('hashchange', handleHash);
  addEventListener('learning-sync:applied', () => {
    const hash = location.hash || '';
    if (hash !== '#exemplar' && !hash.startsWith('#lessons')) return;
    const live = liveState();
    if (live) {
      progress = sanitizeExemplarProgress(live.exemplars || {});
      // Keep an in-flight tutor exchange from being replaced mid-request.
      if (!sending) tutor = sanitizeTutor(live.tutor || {});
    }
    handleHash();
  });
  setTimeout(handleHash, 250);
}
start().catch(() => {});
