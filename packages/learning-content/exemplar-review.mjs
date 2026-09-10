import { gradeActivity, renderActivity } from './learning-content.js';

const script = document.querySelector('script[data-subject]');
const subject = script?.dataset.subject || 'philosophy';
const subjectLabel = subject[0].toUpperCase() + subject.slice(1);
const key = `learning-exemplar-v1-${subject}`;
const read = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
const write = value => localStorage.setItem(key, JSON.stringify(value));
let lesson, answers = read();
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
  target.innerHTML = `<div class="page-heading"><div><div class="eyebrow">MILESTONE 2 EXEMPLAR</div><h1>${escapeHTML(lesson.title)}</h1><p>${escapeHTML(lesson.objective)}</p></div><a class="button" href="#">Return to app</a></div><section class="card exemplar-review"><p class="muted">A review draft for ${subjectLabel}. Responses save on this device while the content is being reviewed.</p>${lesson.activities.map(activity => `<article class="exemplar-activity" data-response-id="${escapeHTML(activity.responseId)}">${renderActivity(activity, answers[activity.responseId] || '')}<button data-check type="button">Check response</button><output aria-live="polite"></output></article>`).join('')}</section>`;
  target.querySelectorAll('[data-response-id]').forEach(node => {
    const activity = lesson.activities.find(item => item.responseId === node.dataset.responseId);
    const save = () => { answers[activity.responseId] = responseFor(activity, node); write(answers); };
    node.querySelectorAll('input,textarea').forEach(input => input.addEventListener('input', save));
    node.querySelector('[data-check]').onclick = () => { save(); node.querySelector('output').textContent = gradeActivity(activity, answers[activity.responseId]) ? 'Good start — response meets the first check.' : 'Keep working. Revisit the prompt and try again.'; };
  });
}
async function start() {
  const response = await fetch(`content/exemplars/${subject}.json`);
  if (!response.ok) return;
  lesson = await response.json();
  const host = document.querySelector('.top-tools,.header-tools,.tools,header');
  if (host && !host.querySelector('[data-exemplar-link]')) { const link = document.createElement('a'); link.href = '#exemplar'; link.dataset.exemplarLink = ''; link.className = 'button'; link.textContent = 'Review exemplar'; host.append(link); }
  addEventListener('hashchange', () => setTimeout(render, 50));
  setTimeout(render, 250);
}
start().catch(() => {});
