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

test('all generated subject lessons satisfy the shared lesson contract', () => {
  const expected = { english: 10, history: 16, philosophy: 13 };
  for (const [subject, count] of Object.entries(expected)) {
    const index = JSON.parse(fs.readFileSync(`content/lessons/${subject}/index.json`, 'utf8'));
    assert.equal(index.subject, subject);
    assert.equal(index.lessons.length, count, `${subject} lesson count`);
    for (const meta of index.lessons) {
      const lesson = validateLesson(JSON.parse(fs.readFileSync(`content/lessons/${subject}/${meta.id}.json`, 'utf8')));
      assert.equal(lesson.subject, subject);
      assert.equal(lesson.id, meta.id);
      assert.ok(lesson.activities.some(activity => activity.type === 'short-answer'), `${meta.id} has a reflection`);
      assert.ok(lesson.activities.filter(activity => activity.type === 'choice' || activity.type === 'sequence').length >= 1, `${meta.id} leads with recognition`);
      const reflection = lesson.activities.find(activity => activity.type === 'short-answer');
      assert.ok(reflection.context, `${meta.id} reflection has source context`);
    }
  }
});
