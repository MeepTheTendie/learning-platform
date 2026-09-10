// One-time converter: turns the History course units into shared lesson-contract
// files under content/lessons/history/.
//
//   node scripts/build-history-lessons.mjs

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { validateLesson } from '../packages/learning-content/index.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sandbox = {}; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'apps/history/public/course.js'), 'utf8'), sandbox);
const COURSE = sandbox.COURSE;
const outDir = path.join(root, 'content/lessons/history');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const clip = (value, max) => String(value || '').slice(0, max);
const eraTitles = ['The ancient world', 'The classical world', 'Medieval and early modern', 'The modern world'];
const era = index => eraTitles[Math.min(3, Math.floor(index / 4))];

function activitiesFor(unit, lessonId) {
  const events = unit.events.map(event => ({ title: event[1], year: event[0] }));
  const activities = [];

  if (events.length >= 2) {
    const chronological = [...events].sort((a, b) => a.year - b.year);
    const earliest = chronological[0], latest = chronological[chronological.length - 1];
    activities.push({ id: lessonId + '-order', type: 'choice', prompt: `Which happened first: “${earliest.title}” or “${latest.title}”?`, choices: [latest.title, earliest.title], answer: 1, hint: 'Compare the dates on the unit timeline.' });
  }
  if (Array.isArray(unit.claim) && unit.claim.length >= 2) {
    activities.push({ id: lessonId + '-claim', type: 'choice', prompt: `“${unit.claim[0]}” — is that an event claim or an interpretation?`, choices: ['An event claim', 'An inference or interpretation'], answer: unit.claim[1] === 'event' ? 0 : 1, hint: unit.claim[2] });
  }
  if (events.length >= 2) {
    // Display the events newest-first so the learner has to reconstruct the order.
    const displayed = [...events].reverse();
    const items = displayed.map(event => clip(event.title, 500));
    const answer = [...items.keys()].sort((a, b) => displayed[a].year - displayed[b].year);
    activities.push({ id: lessonId + '-sequence', type: 'sequence', prompt: 'Put these events back in chronological order.', items, answer, instructions: 'Oldest first. Treat the dates as approximate markers.' });
  }
  activities.push({
    id: lessonId + '-reflect',
    type: 'short-answer',
    prompt: unit.prompts[0],
    instructions: 'A few sentences are enough. Cite a passage when it helps.',
    context: clip(unit.model, 4000),
    rubric: ['names evidence', 'explains a consequence', 'marks an inference'],
  });
  activities.sort((a, b) => (a.type === 'short-answer' ? 1 : 0) - (b.type === 'short-answer' ? 1 : 0));
  return activities;
}

const index = [];
COURSE.forEach((unit, position) => {
  const lessonId = 'history-' + unit.id;
  const raw = {
    version: 1,
    id: lessonId,
    subject: 'history',
    title: unit.title,
    objective: clip(unit.subtitle || unit.question, 1000),
    lesson: {
      opening: clip(unit.question, 2000),
      sections: [
        { heading: 'The institutional thread', body: clip(unit.ideas.join('\n\n'), 4000) },
        { heading: 'A model to test', body: clip(unit.model, 4000) },
        { heading: 'Keep the question', body: clip(unit.question, 4000) },
      ],
    },
    sources: [`apps/history/public/course.js#${unit.id}`],
    activities: activitiesFor(unit, lessonId),
  };
  const normalized = validateLesson(raw);
  fs.writeFileSync(path.join(outDir, `${lessonId}.json`), JSON.stringify(normalized, null, 2) + '\n');
  index.push({ id: lessonId, title: unit.title, world: Math.min(3, Math.floor(position / 4)), worldTitle: era(position), objective: normalized.objective, boss: false });
});
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ version: 1, subject: 'history', lessons: index }, null, 2) + '\n');
console.log(`Wrote ${index.length} History lessons to ${path.relative(root, outDir)}`);
