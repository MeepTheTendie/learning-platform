import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gradeActivity, validateLesson } from '../packages/learning-content/index.mjs';

const files = ['english-sentence.json', 'history-cities.json', 'philosophy-reasons.json'];
test('all Milestone 2 exemplars satisfy the shared lesson contract', () => {
  for (const file of files) {
    const lesson = validateLesson(JSON.parse(fs.readFileSync(`content/exemplars/${file}`, 'utf8')));
    assert.equal(lesson.version, 1);
    assert.equal(new Set(lesson.activities.map(activity => activity.responseId)).size, lesson.activities.length);
    assert.ok(lesson.activities.every(activity => gradeActivity(activity, activity.type === 'choice' ? activity.answer : activity.type === 'sequence' ? activity.answer : 'A considered response with concrete evidence and a clear explanation.')));
  }
});

test('shared lesson validation rejects duplicate response IDs', () => {
  const lesson = JSON.parse(fs.readFileSync('content/exemplars/english-sentence.json', 'utf8'));
  lesson.activities[1].id = lesson.activities[0].id;
  assert.throws(() => validateLesson(lesson), /repeats activity id/);
});
