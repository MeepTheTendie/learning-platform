const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const APPS = [
  ['english', 19002, 'The sentence', 'grammar-room-v1', 'english-sentence.json'],
  ['history', 19001, 'Rivers, cities', 'civilization-atlas-v1', 'history-cities.json'],
  ['philosophy', 19003, 'What makes a reason', 'philosophy-scholar-v1', 'philosophy-reasons.json'],
];
const seed = activity => activity.type === 'choice' ? String(activity.answer) : 'A considered response that uses concrete evidence and explains the reasoning clearly.';

(async () => {
  const server = spawn(process.execPath, ['tests/serve.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(Error('Test server startup timed out')), 10000);
    server.once('exit', code => reject(Error('Test server exited ' + code)));
    server.stdout.on('data', data => { output += data; if (output.includes('philosophy 19003')) { clearTimeout(timeout); resolve(); } });
  });
  await ready;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  try {
    for (const [app, port, title, key, file] of APPS) {
      const lesson = JSON.parse(fs.readFileSync(`content/exemplars/${file}`, 'utf8'));
      const first = lesson.activities[0];
      const firstId = `${lesson.id}:${first.id}`;
      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
      await contexts[0].addInitScript(({ legacyKey, firstId, value }) => {
        localStorage.setItem('learning-cloud-key-v1', 'a'.repeat(64));
        localStorage.setItem(legacyKey, JSON.stringify({ [firstId]: value }));
      }, { legacyKey: `learning-exemplar-v1-${app}`, firstId, value: seed(first) });
      await contexts[1].addInitScript(() => localStorage.setItem('learning-cloud-key-v1', 'a'.repeat(64)));
      const [a, b] = await Promise.all(contexts.map(context => context.newPage()));
      const errors = [];
      for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
      const url = `http://127.0.0.1:${port}/`;
      const readState = page => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
      const saved = page => page.waitForFunction(() => document.querySelector('[data-learning-sync] summary')?.textContent === 'Saved', null, { timeout: 15000 });

      await a.goto(url + '#exemplar');
      await a.waitForSelector('[data-response-id]');
      assert.ok((await a.locator('h1').first().textContent()).toLowerCase().includes(title.toLowerCase()), `${app} exemplar heading`);
      assert.equal(await a.locator('[data-response-id]').count(), lesson.activities.length, `${app} activity count`);

      // An older local draft is migrated into canonical state, then removed.
      await a.waitForFunction(({ storageKey, lessonId, activityId, value }) => {
        const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return state.exemplars?.[lessonId]?.responses?.[activityId] === value;
      }, { storageKey: key, lessonId: lesson.id, activityId: first.id, value: seed(first) }, { timeout: 10000 });
      assert.equal(await a.evaluate(k => localStorage.getItem(k), `learning-exemplar-v1-${app}`), null, `${app} legacy draft key cleared`);

      // Check the first activity and store attempt metadata.
      const firstNode = a.locator('[data-response-id]').first();
      await firstNode.locator('[data-check]').click();
      assert.ok((await firstNode.locator('output').textContent()).includes('Passed'), `${app} first activity passes`);
      await saved(a);
      const checked = await readState(a);
      assert.equal(checked.exemplars[lesson.id].passed[first.id], true, `${app} pass stored`);
      assert.ok(checked.exemplars[lesson.id].attempts[first.id] >= 1, `${app} attempts stored`);

      // A second device receives the answer through normal progress sync.
      await b.goto(url + '#exemplar');
      await b.waitForSelector('[data-response-id]');
      await b.waitForFunction(({ storageKey, lessonId, activityId }) => {
        const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return state.exemplars?.[lessonId]?.passed?.[activityId] === true;
      }, { storageKey: key, lessonId: lesson.id, activityId: first.id }, { timeout: 15000 });
      const syncedNode = b.locator('[data-response-id]').first();
      if (first.type === 'choice') assert.equal(await syncedNode.locator('input:checked').count(), 1, `${app} synced choice visible`);
      else assert.ok((await syncedNode.locator('textarea').inputValue()).length > 0, `${app} synced answer visible`);

      // Independent lesson edits made offline and online merge on reconnect.
      if (app === 'english') {
        const [, second, third] = lesson.activities;
        const offline = 'Offline answer written on the second device with concrete evidence.';
        const online = 'Answer written on the first device while the second was offline.';
        await contexts[1].setOffline(true);
        await b.locator(`[data-response-id="${lesson.id}:${second.id}"] textarea`).fill(offline);
        await a.locator(`[data-response-id="${lesson.id}:${third.id}"] textarea`).fill(online);
        await saved(a);
        await contexts[1].setOffline(false);
        await b.evaluate(() => LearningSync.syncNow());
        await b.waitForFunction(({ storageKey, lessonId, second, third, offline, online }) => {
          const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
          const responses = state.exemplars?.[lessonId]?.responses || {};
          return responses[second] === offline && responses[third] === online;
        }, { storageKey: key, lessonId: lesson.id, second: second.id, third: third.id, offline, online }, { timeout: 15000 });
        console.log('PASS exemplar offline merge', app);
      }

      // Sequence answers round-trip 1-based input to a 0-based stored answer.
      const sequence = lesson.activities.find(activity => activity.type === 'sequence');
      if (sequence) {
        const sequenceNode = b.locator(`[data-response-id="${lesson.id}:${sequence.id}"]`);
        await sequenceNode.locator('[data-sequence]').fill(sequence.answer.map(value => value + 1).join(', '));
        await sequenceNode.locator('[data-check]').click();
        assert.ok((await sequenceNode.locator('output').textContent()).includes('Passed'), `${app} sequence passes`);
        await saved(b);
        const state = await readState(b);
        assert.deepEqual(state.exemplars[lesson.id].responses[sequence.id], sequence.answer, `${app} sequence stored 0-based`);
      }

      await b.setViewportSize({ width: 390, height: 844 });
      assert.equal(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${app} mobile overflow`);
      assert.deepEqual(errors, [], `${app} browser errors`);
      console.log('PASS exemplar', app);
      await Promise.all(contexts.map(context => context.close()));
    }
  } finally { await browser.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
