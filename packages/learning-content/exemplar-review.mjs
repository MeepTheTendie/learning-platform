import { gradeActivity, renderActivity } from './learning-content.js';
import { exemplarRecord, recordExemplarAttempt, sanitizeExemplarProgress, setExemplarResponse } from './progress.js';

const script = document.querySelector('script[data-subject]');
const subject = script?.dataset.subject || 'philosophy';
const subjectLabel = subject[0].toUpperCase() + subject.slice(1);
const legacyAnswersKey = `learning-exemplar-v1-${subject}`;
const legacyReviewKey = legacyAnswersKey + '-review';
const readLocal = name => { try { return JSON.parse(localStorage.getItem(name)) || {}; } catch { return {}; } };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const main = () => document.querySelector('main, #main');
let lesson, progress = {}, rendered = false;

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
// recovery paths carry exemplar work between devices. The legacy keys remain a
// fallback for a build opened without the sync client.
function persist() {
  const sync = window.LearningSync;
  const state = liveState();
  if (sync?.read && state) { state.exemplars = progress; sync.changed(); return; }
  const answers = {}, review = {};
  for (const [lessonId, record] of Object.entries(progress)) {
    for (const [activityId, value] of Object.entries(record.responses)) answers[`${lessonId}:${activityId}`] = value;
    for (const [activityId, value] of Object.entries(record.attempts)) (review[`${lessonId}:${activityId}`] ??= {}).attempts = value;
    for (const [activityId, value] of Object.entries(record.passed)) (review[`${lessonId}:${activityId}`] ??= {}).passed = value;
  }
  localStorage.setItem(legacyAnswersKey, JSON.stringify(answers));
  localStorage.setItem(legacyReviewKey, JSON.stringify(review));
}
function lessonCopy() {
  if (!lesson.lesson) return '';
  return `<section class="card lesson-copy"><p>${escapeHTML(lesson.lesson.opening)}</p>${lesson.lesson.sections.map(section => `<div><h2>${escapeHTML(section.heading)}</h2><p>${escapeHTML(section.body)}</p></div>`).join('')}</section>`;
}
function responseFor(activity, node) {
  if (activity.type === 'choice') return node.querySelector('input:checked')?.value ?? '';
  if (activity.type === 'sequence') return (node.querySelector('[data-sequence]')?.value || '').split(',').map(value => Number(value.trim()) - 1).filter(Number.isInteger);
  return node.querySelector('textarea')?.value || '';
}
function render() {
  if (!lesson || location.hash !== '#exemplar') return;
  const target = main(); if (!target) return;
  const record = exemplarRecord(progress, lesson.id);
  const passed = lesson.activities.filter(activity => record.passed[activity.id]).length;
  target.innerHTML = `<div class="page-heading"><div><div class="eyebrow">MILESTONE 2 LESSON</div><h1>${escapeHTML(lesson.title)}</h1><p>${escapeHTML(lesson.objective)}</p></div><a class="button" href="#">Return to app</a></div>${lessonCopy()}<section class="card exemplar-review"><p class="muted">${subjectLabel} practice · ${passed}/${lesson.activities.length} responses checked. Drafts and revision attempts save with your progress and sync between devices.</p>${lesson.activities.map(activity => { const status = record.passed[activity.id]; const attempts = record.attempts[activity.id] || 0; return `<article class="exemplar-activity" data-response-id="${escapeHTML(activity.responseId)}">${renderActivity(activity, record.responses[activity.id] ?? '')}${activity.hint ? `<details><summary>Hint</summary><p>${escapeHTML(activity.hint)}</p></details>` : ''}${activity.rubric?.length ? `<details><summary>Review criteria</summary><ul>${activity.rubric.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></details>` : ''}<button data-check type="button">${status ? 'Review again' : 'Check response'}</button><output aria-live="polite">${status ? `Passed after ${attempts} attempt${attempts === 1 ? '' : 's'}.` : ''}</output></article>`; }).join('')}</section>`;
  target.querySelectorAll('[data-response-id]').forEach(node => {
    const activity = lesson.activities.find(item => item.responseId === node.dataset.responseId);
    const save = () => { setExemplarResponse(progress, lesson.id, activity.id, responseFor(activity, node)); persist(); };
    node.querySelectorAll('input,textarea').forEach(input => input.addEventListener('input', save));
    node.querySelector('[data-check]').onclick = () => { save(); const current = recordExemplarAttempt(progress, lesson.id, activity.id, gradeActivity(activity, record.responses[activity.id])); persist(); const attempts = current.attempts[activity.id]; node.querySelector('output').textContent = current.passed[activity.id] ? `Passed after ${attempts} attempt${attempts === 1 ? '' : 's'}.` : 'Keep working. Revise your response and try again.'; node.querySelector('[data-check]').textContent = current.passed[activity.id] ? 'Review again' : 'Check response'; };
  });
  rendered = true;
}
async function start() {
  await window.LearningSync?.whenReady?.();
  const response = await fetch(`content/exemplars/${subject}.json`);
  if (!response.ok) return;
  const raw = await response.json();
  lesson = { ...raw, activities: raw.activities.map(activity => ({ ...activity, responseId: `${raw.id}:${activity.id}` })) };
  const state = liveState();
  progress = sanitizeExemplarProgress(state ? state.exemplars : fromLegacy());
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
  if (host && !host.querySelector('[data-exemplar-link]')) { const link = document.createElement('a'); link.href = '#exemplar'; link.dataset.exemplarLink = ''; link.className = 'button'; link.textContent = lesson.lesson ? 'Start lesson' : 'Review exemplar'; host.append(link); }
  addEventListener('hashchange', () => {
    if (location.hash === '#exemplar') setTimeout(render, 50);
    else if (rendered) { rendered = false; window.LearningSync?.refresh?.(); }
  });
  addEventListener('learning-sync:applied', () => { const live = liveState(); if (live) progress = sanitizeExemplarProgress(live.exemplars || {}); if (location.hash === '#exemplar') setTimeout(render, 0); });
  setTimeout(render, 250);
}
start().catch(() => {});
