// One-time converter: turns the authored Philosophy curriculum into shared
// lesson-contract files under content/lessons/philosophy/.
//
//   node scripts/build-philosophy-lessons.mjs
//
// Re-run only when the source curriculum changes; the generated files are
// committed so they can be reviewed and edited directly.

import fs from 'node:fs';
import path from 'node:path';
import { validateLesson } from '../packages/learning-content/index.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const curriculum = JSON.parse(fs.readFileSync(path.join(root, 'apps/philosophy/public/content/curriculum.json'), 'utf8'));
const reference = JSON.parse(fs.readFileSync(path.join(root, 'apps/philosophy/public/content/reference.json'), 'utf8'));
const outDir = path.join(root, 'content/lessons/philosophy');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const worldTitle = id => reference.worlds?.find(world => world.id === id)?.title || `World ${id}`;
const clip = (value, max) => String(value || '').slice(0, max);

function activitiesFor(lesson, lessonId) {
  const activities = [];
  for (const question of lesson.questions) {
    const id = question.id;
    if (question.type === 'choice' && Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 8 && Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length) {
      activities.push({ id, type: 'choice', prompt: question.prompt, choices: question.options, answer: question.answer, hint: question.label });
    } else if (question.type === 'order' && Array.isArray(question.items) && question.items.length >= 2 && question.items.length <= 12 && Array.isArray(question.answer) && question.answer.length === question.items.length && new Set(question.answer).size === question.items.length && question.answer.every(index => Number.isInteger(index) && index >= 0 && index < question.items.length)) {
      activities.push({ id, type: 'sequence', prompt: question.prompt, items: question.items, answer: question.answer, instructions: question.label });
    } else if (question.type === 'write') {
      activities.push({ id, type: 'short-answer', prompt: question.prompt, instructions: question.label, ...(lesson.primaryText?.text ? { context: clip(lesson.primaryText.text, 4000) } : {}), ...(Array.isArray(question.rubric) ? { rubric: question.rubric.slice(0, 8) } : {}) });
    }
    // 'match' and 'map' stay in the existing Socratic lesson flow.
  }
  if (!activities.some(activity => activity.type === 'short-answer')) {
    activities.push({ id: lessonId + '-reflect', type: 'short-answer', prompt: `In your own words, explain ${lesson.concept}.`, instructions: 'Write a few sentences and give an example.', rubric: ['explains the idea', 'gives an example'] });
  }
  // Recognition first; the written reflection goes last and stays optional.
  activities.sort((a, b) => (a.type === 'short-answer' ? 1 : 0) - (b.type === 'short-answer' ? 1 : 0));
  return activities;
}

const index = [];
for (const lesson of curriculum.lessons) {
  const lessonId = 'philosophy-' + lesson.id;
  const raw = {
    version: 1,
    id: lessonId,
    subject: 'philosophy',
    title: lesson.title,
    objective: clip(lesson.description || lesson.keyQuestion, 1000),
    lesson: {
      opening: clip(lesson.historicalContext || lesson.description, 2000),
      sections: [
        { heading: clip(lesson.concept, 300), body: clip(lesson.explanation.join('\n\n'), 4000) },
        ...(lesson.breakdown ? [{ heading: 'Reconstructing the argument', body: clip(lesson.breakdown, 4000) }] : []),
        ...(lesson.objection ? [{ heading: 'A serious objection', body: clip(lesson.objection, 4000) }] : []),
      ],
    },
    sources: [`apps/philosophy/public/content/curriculum.json#${lesson.id}`],
    activities: activitiesFor(lesson, lessonId),
  };
  const normalized = validateLesson(raw);
  fs.writeFileSync(path.join(outDir, `${lessonId}.json`), JSON.stringify(normalized, null, 2) + '\n');
  index.push({ id: lessonId, title: lesson.title, world: lesson.world, worldTitle: worldTitle(lesson.world), objective: normalized.objective, boss: !!lesson.boss });
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ version: 1, subject: 'philosophy', lessons: index }, null, 2) + '\n');
console.log(`Wrote ${index.length} Philosophy lessons to ${path.relative(root, outDir)}`);
