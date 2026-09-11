import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { UnitSchema } from '../src/schema.ts';
import { lintFraming } from '../src/framing-lint.ts';

const contentDir = path.resolve(new URL('../content', import.meta.url).pathname);

function units() {
  const subjectDir = path.join(contentDir, 'history');
  return fs.readdirSync(subjectDir).filter(name => fs.statSync(path.join(subjectDir, name)).isDirectory()).sort()
    .map(name => ({ dir: path.join(subjectDir, name), unit: UnitSchema.parse(JSON.parse(fs.readFileSync(path.join(subjectDir, name, 'unit.json'), 'utf8'))) }));
}

test('every history unit satisfies the schema', () => {
  const all = units();
  assert.ok(all.length >= 1);
  for (const { unit } of all) assert.ok(unit.sources.length >= 1);
});

test('every source file exists and is non-trivial', () => {
  for (const { dir, unit } of units()) {
    for (const source of unit.sources) {
      const file = path.join(dir, source.file);
      assert.ok(fs.existsSync(file), `${unit.id}: missing ${source.file}`);
      assert.ok(fs.readFileSync(file, 'utf8').trim().length > 50, `${unit.id}: ${source.file} too short`);
      assert.ok(source.citation.length > 10 && source.license.length > 2, `${unit.id}/${source.id}: needs citation and license`);
    }
  }
});

test('authored text contains no present-day framing terms', () => {
  for (const { dir, unit } of units()) {
    assert.deepEqual(lintFraming(unit.title), [], unit.id);
    assert.deepEqual(lintFraming(fs.readFileSync(path.join(dir, unit.spine), 'utf8')), [], `${unit.id} spine`);
    for (const source of unit.sources) {
      assert.deepEqual(lintFraming(source.context), [], `${unit.id}/${source.id} context`);
      for (const question of source.questions) assert.deepEqual(lintFraming(question), [], `${unit.id}/${source.id} question`);
    }
  }
});

test('every image file exists and carries attribution', () => {
  for (const { dir, unit } of units()) {
    for (const image of unit.images) {
      const file = path.join(dir, image.file);
      assert.ok(fs.existsSync(file), `${unit.id}: missing ${image.file}`);
      assert.ok(fs.statSync(file).size > 5000, `${unit.id}: ${image.file} too small`);
      assert.ok(image.credit.length > 3 && image.license.length > 1, `${unit.id}/${image.id}: needs credit and license`);
    }
  }
});

test('activities are well-formed and free of framing', () => {
  for (const { unit } of units()) {
    assert.ok(unit.activities.length >= 1, `${unit.id}: needs activities`);
    for (const activity of unit.activities) {
      if (activity.type === 'choice') {
        assert.ok(activity.answer >= 0 && activity.answer < activity.choices.length, `${unit.id}/${activity.id}: answer out of range`);
        for (const field of [activity.prompt, ...activity.choices, activity.feedback]) assert.deepEqual(lintFraming(field), [], `${unit.id}/${activity.id}`);
      } else {
        for (const field of [activity.prompt, activity.context, ...activity.rubric]) assert.deepEqual(lintFraming(field), [], `${unit.id}/${activity.id}`);
      }
    }
  }
});

test('every unit names an interpretation, attributed', () => {
  for (const { unit } of units()) {
    assert.ok(unit.interpretations.length >= 1, `${unit.id}: needs a named interpretation`);
    for (const interpretation of unit.interpretations) {
      assert.ok(interpretation.historian.length > 2 && interpretation.work.length > 2 && interpretation.year.length > 2, `${unit.id}/${interpretation.id}: needs attribution`);
      for (const field of [interpretation.claim, interpretation.note]) assert.deepEqual(lintFraming(field), [], `${unit.id}/${interpretation.id}`);
    }
  }
});

test('the framing lint actually catches framing', () => {
  assert.deepEqual(lintFraming('This course builds global citizenship and critical thinking skills.'), ['global citizenship', 'critical thinking skills', 'this course']);
  assert.deepEqual(lintFraming('In 1750 BCE Hammurabi ruled Babylon.'), []);
});
