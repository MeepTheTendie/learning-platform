import { gradeActivity, renderActivity } from './learning-content.js';

const script = document.querySelector('script[data-subject]');
const subject = script?.dataset.subject || 'philosophy';
const subjectLabel = subject[0].toUpperCase() + subject.slice(1);
const key = `learning-exemplar-v1-${subject}`;
const read = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
const write = value => localStorage.setItem(key, JSON.stringify(value));
const metaKey = key + '-review';
const readMeta = () => { try { return JSON.parse(localStorage.getItem(metaKey)) || {}; } catch { return {}; } };
const writeMeta = value => localStorage.setItem(metaKey, JSON.stringify(value));
let lesson, answers = read(), review = readMeta();
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const main = () => document.querySelector('main, #main');
function responseFor(activity, node) {
  if (activity.type === 'choice') return node.querySelector('input:checked')?.value ?? '';
  if (activity.type === 'sequence') return (node.querySelector('[data-sequence]')?.value || '').split(',').map(value => Number(value.trim()) - 1).filter(Number.isInteger);
  return node.querySelector('textarea')?.value || '';
}
function render() {
  if (!lesson || location.hash !== '#exemplar') return;
  const target = main(); if (!target) return;
  const passed = lesson.activities.filter(activity => review[activity.responseId]?.passed).length;
  target.innerHTML = `<div class="page-heading"><div><div class="eyebrow">MILESTONE 2 EXEMPLAR</div><h1>${escapeHTML(lesson.title)}</h1><p>${escapeHTML(lesson.objective)}</p></div><a class="button" href="#">Return to app</a></div><section class="card exemplar-review"><p class="muted">${subjectLabel} review · ${passed}/${lesson.activities.length} responses checked. Drafts and revision attempts save on this device.</p>${lesson.activities.map(activity => { const status = review[activity.responseId]; return `<article class="exemplar-activity" data-response-id="${escapeHTML(activity.responseId)}">${renderActivity(activity, answers[activity.responseId] || '')}${activity.hint ? `<details><summary>Hint</summary><p>${escapeHTML(activity.hint)}</p></details>` : ''}${activity.rubric?.length ? `<details><summary>Review criteria</summary><ul>${activity.rubric.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul></details>` : ''}<button data-check type="button">${status?.passed ? 'Review again' : 'Check response'}</button><output aria-live="polite">${status?.passed ? `Passed after ${status.attempts} attempt${status.attempts === 1 ? '' : 's'}.` : ''}</output></article>`; }).join('')}</section>`;
  target.querySelectorAll('[data-response-id]').forEach(node => {
    const activity = lesson.activities.find(item => item.responseId === node.dataset.responseId);
    const save = () => { answers[activity.responseId] = responseFor(activity, node); write(answers); };
    node.querySelectorAll('input,textarea').forEach(input => input.addEventListener('input', save));
    node.querySelector('[data-check]').onclick = () => { save(); const current = review[activity.responseId] || { attempts: 0, passed: false }; current.attempts++; current.passed = gradeActivity(activity, answers[activity.responseId]); review[activity.responseId] = current; writeMeta(review); node.querySelector('output').textContent = current.passed ? `Passed after ${current.attempts} attempt${current.attempts === 1 ? '' : 's'}.` : 'Keep working. Revise your response and try again.'; node.querySelector('[data-check]').textContent = current.passed ? 'Review again' : 'Check response'; };
  });
}
async function start() {
  const response = await fetch(`content/exemplars/${subject}.json`);
  if (!response.ok) return;
  const raw = await response.json();
  lesson = { ...raw, activities: raw.activities.map(activity => ({ ...activity, responseId: `${raw.id}:${activity.id}` })) };
  const host = document.querySelector('.top-tools,.header-tools,.tools,header');
  if (host && !host.querySelector('[data-exemplar-link]')) { const link = document.createElement('a'); link.href = '#exemplar'; link.dataset.exemplarLink = ''; link.className = 'button'; link.textContent = 'Review exemplar'; host.append(link); }
  addEventListener('hashchange', () => setTimeout(render, 50));
  setTimeout(render, 250);
}
start().catch(() => {});
