// One-time converter: turns the Grammar Room quiz set into shared lesson-contract
// files under content/lessons/english/.
//
//   node scripts/build-english-lessons.mjs
//
// The full book keeps its existing section-by-section exercises; these lessons
// give each quizzed topic a recognition-first lesson with a tutor.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { validateLesson } from '../packages/learning-content/index.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'apps/english/public/index.html'), 'utf8');
const marker = html.indexOf('const quizzes=');
const start = html.indexOf('[', marker);
let depth = 0, end = -1;
for (let i = start; i < html.length; i++) { if (html[i] === '[') depth++; else if (html[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } } }
const quizzes = vm.runInNewContext('(' + html.slice(start, end) + ')');

const outDir = path.join(root, 'content/lessons/english');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sentenceTopics = new Set(['The Sentence', 'Kinds Of Sentences']);

const index = quizzes.map(quiz => {
  const lessonId = 'english-' + slug(quiz.match);
  const raw = {
    version: 1,
    id: lessonId,
    subject: 'english',
    title: quiz.match,
    objective: `Recognise and use ${quiz.match.toLowerCase()} correctly.`,
    lesson: { opening: quiz.why, sections: [{ heading: quiz.match, body: quiz.why }] },
    sources: ['apps/english/public/index.html'],
    activities: [
      { id: lessonId + '-q', type: 'choice', prompt: quiz.q, choices: quiz.a, answer: quiz.correct },
      { id: lessonId + '-reflect', type: 'short-answer', prompt: `In your own words, explain the rule behind “${quiz.match}”, with one example.`, instructions: 'A few sentences are enough.', context: quiz.why, rubric: ['states the rule', 'gives an example'] },
    ],
  };
  const normalized = validateLesson(raw);
  fs.writeFileSync(path.join(outDir, `${lessonId}.json`), JSON.stringify(normalized, null, 2) + '\n');
  return { id: lessonId, title: quiz.match, world: sentenceTopics.has(quiz.match) ? 0 : 1, worldTitle: sentenceTopics.has(quiz.match) ? 'Sentences' : 'Parts of speech', objective: normalized.objective, boss: false };
});
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ version: 1, subject: 'english', lessons: index }, null, 2) + '\n');
console.log(`Wrote ${index.length} English lessons to ${path.relative(root, outDir)}`);
