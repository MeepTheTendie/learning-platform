import test from 'node:test';
import assert from 'node:assert/strict';
import { exemplarRecord, recordExemplarAttempt, sanitizeExemplarProgress, setExemplarResponse } from '../packages/learning-content/progress.mjs';
import { appendTutorMessage, sanitizeTutor, tutorRequestMessages, tutorThread } from '../packages/learning-content/tutor.mjs';
import { mergeChanges } from '../packages/progress/sync-merge.js';

test('exemplar progress records responses, attempts and passes', () => {
  const progress = {};
  setExemplarResponse(progress, 'english-sentence-exemplar', 'identify-subject', '1');
  setExemplarResponse(progress, 'english-sentence-exemplar', 'repair-fragment', 'A repaired sentence.');
  const record = recordExemplarAttempt(progress, 'english-sentence-exemplar', 'identify-subject', true);
  assert.equal(record.responses['identify-subject'], '1');
  assert.equal(record.responses['repair-fragment'], 'A repaired sentence.');
  assert.equal(record.attempts['identify-subject'], 1);
  assert.equal(record.passed['identify-subject'], true);
  assert.ok(record.updatedAt > 0);
});

test('exemplar sanitization strips unsafe keys and bounds values', () => {
  const raw = JSON.parse('{"__proto__":{"bad":true},"lesson":{"responses":{"__proto__":"x","ok":"y","long":"' + 'a'.repeat(20001) + '"},"attempts":{"ok":-4},"passed":{"ok":"yes","good":true}}}');
  const clean = sanitizeExemplarProgress(raw);
  assert.equal(Object.hasOwn(clean, '__proto__'), false);
  assert.equal({}.bad, undefined);
  assert.equal(Object.hasOwn(clean.lesson.responses, '__proto__'), false);
  assert.equal(clean.lesson.responses.ok, 'y');
  assert.equal(clean.lesson.responses.long.length, 20000);
  assert.equal(clean.lesson.attempts.ok, 0);
  assert.equal(clean.lesson.passed.ok, undefined);
  assert.equal(clean.lesson.passed.good, true);
});

test('two-device exemplar edits merge and independent answers survive', () => {
  const base = sanitizeExemplarProgress({ lesson: { responses: { a: 'base' }, attempts: { a: 1 }, passed: { a: false } } });
  const local = sanitizeExemplarProgress({ lesson: { responses: { a: 'base', b: 'device one' }, attempts: { a: 1, b: 1 }, passed: { a: false, b: true } } });
  const remote = sanitizeExemplarProgress({ lesson: { responses: { a: 'base', c: 'device two' }, attempts: { a: 1, c: 2 }, passed: { a: false, c: true } } });
  const conflicts = [];
  const merged = mergeChanges(base, local, remote, conflicts);
  assert.equal(merged.lesson.responses.b, 'device one');
  assert.equal(merged.lesson.responses.c, 'device two');
  assert.equal(merged.lesson.attempts.c, 2);
  assert.deepEqual(conflicts, []);
});

test('a genuine same-answer conflict is reported without losing the local edit', () => {
  const base = sanitizeExemplarProgress({ lesson: { responses: { a: 'base' }, attempts: {}, passed: {} } });
  const local = sanitizeExemplarProgress({ lesson: { responses: { a: 'offline' }, attempts: {}, passed: {} } });
  const remote = sanitizeExemplarProgress({ lesson: { responses: { a: 'other device' }, attempts: {}, passed: {} } });
  const conflicts = [];
  const merged = mergeChanges(base, local, remote, conflicts);
  assert.equal(merged.lesson.responses.a, 'offline');
  assert.deepEqual(conflicts, ['/lesson/responses/a']);
});

test('exemplar sanitization preserves awarded points and drops unsafe award keys', () => {
  const raw = JSON.parse('{"lesson":{"points":45,"awarded":{"reflect:a":true,"__proto__":true,"bad":false},"responses":{}}}');
  const clean = sanitizeExemplarProgress(raw);
  assert.equal(clean.lesson.points, 45);
  assert.equal(clean.lesson.awarded['reflect:a'], true);
  assert.equal(Object.hasOwn(clean.lesson.awarded, '__proto__'), false);
  assert.equal(clean.lesson.awarded.bad, undefined);
});

test('exemplarRecord is idempotent for an existing lesson', () => {
  const progress = {};
  const first = exemplarRecord(progress, 'lesson');
  first.responses.a = 'x';
  assert.equal(exemplarRecord(progress, 'lesson').responses.a, 'x');
});

test('tutor threads append, bound and sanitize conversations', () => {
  const tutor = {};
  appendTutorMessage(tutor, 'lesson', 'user', 'Why?');
  appendTutorMessage(tutor, 'lesson', 'assistant', 'Because.');
  assert.deepEqual(tutorThread(tutor, 'lesson').map(message => message.role), ['user', 'assistant']);
  assert.deepEqual(tutorRequestMessages(tutor, 'lesson'), [{ role: 'user', content: 'Why?' }, { role: 'assistant', content: 'Because.' }]);
  for (let i = 0; i < 60; i++) appendTutorMessage(tutor, 'lesson', 'user', 'x' + i);
  assert.equal(tutorThread(tutor, 'lesson').length, 40);
  const dirty = JSON.parse('{"__proto__":{"bad":true},"lesson":{"messages":[{"role":"tool","content":"x"},{"role":"user","content":"hi"},{"role":"assistant","content":""}]}}');
  const clean = sanitizeTutor(dirty);
  assert.equal(Object.hasOwn(clean, '__proto__'), false);
  assert.equal({}.bad, undefined);
  assert.deepEqual(clean.lesson.messages.map(message => message.role), ['user']);
});
