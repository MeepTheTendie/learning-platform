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
    server.stdout.on('data', data => { output += data; if (output.includes('geography 19004')) { clearTimeout(timeout); resolve(); } });
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
      const saved = page => page.waitForFunction(() => (document.querySelector('[data-learning-sync] summary')?.textContent || '').startsWith('Saved'), null, { timeout: 15000 });

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
        const fill = activity => activity.type === 'choice' ? '0' : activity.type === 'sequence' ? activity.answer.map(value => value + 1).join(', ') : `Independent answer for ${activity.id} with enough words to pass.`;
        const expected = activity => activity.type === 'sequence' ? activity.answer : fill(activity);
        const setActivity = async (page, activity, value) => {
          const node = page.locator(`[data-response-id="${lesson.id}:${activity.id}"]`);
          if (activity.type === 'choice') await node.locator(`input[value="${value}"]`).check();
          else if (activity.type === 'sequence') await node.locator('[data-sequence]').fill(value);
          else await node.locator('textarea').fill(value);
        };
        const secondValue = fill(second), thirdValue = fill(third);
        await contexts[1].setOffline(true);
        await setActivity(b, second, secondValue);
        await setActivity(a, third, thirdValue);
        await saved(a);
        await contexts[1].setOffline(false);
        await b.evaluate(() => LearningSync.syncNow());
        await b.waitForFunction(({ storageKey, lessonId, second, secondValue, third, thirdValue }) => {
          const responses = JSON.parse(localStorage.getItem(storageKey) || '{}').exemplars?.[lessonId]?.responses || {};
          return JSON.stringify(responses[second]) === secondValue && JSON.stringify(responses[third]) === thirdValue;
        }, { storageKey: key, lessonId: lesson.id, second: second.id, secondValue: JSON.stringify(expected(second)), third: third.id, thirdValue: JSON.stringify(expected(third)) }, { timeout: 15000 });
        console.log('PASS exemplar offline merge', app);
      }

      // The grounded tutor saves the exchange in canonical state and syncs it.
      await b.locator('[data-tutor-input]').fill('Why does the subject matter here?');
      await b.locator('[data-tutor-form] button[type=submit]').click();
      await b.waitForFunction(({ storageKey, lessonId }) => {
        const messages = JSON.parse(localStorage.getItem(storageKey) || '{}').tutor?.[lessonId]?.messages || [];
        return messages.some(message => message.role === 'assistant' && /what makes you say that/i.test(message.content));
      }, { storageKey: key, lessonId: lesson.id }, { timeout: 15000 });
      await saved(b);
      const tutorThread = (await readState(b)).tutor[lesson.id].messages;
      assert.ok(tutorThread.some(message => message.role === 'user' && /subject matter/.test(message.content)), `${app} tutor saved the question`);
      await a.evaluate(() => LearningSync.syncNow());
      await a.waitForFunction(({ storageKey, lessonId }) => {
        const messages = JSON.parse(localStorage.getItem(storageKey) || '{}').tutor?.[lessonId]?.messages || [];
        return messages.some(message => message.role === 'assistant');
      }, { storageKey: key, lessonId: lesson.id }, { timeout: 15000 });
      console.log('PASS exemplar tutor', app);

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

      // Passing the reflection awards practice points, and native XP where the app has it.
      await saved(b);
      const reflection = lesson.activities.find(activity => activity.type === 'short-answer');
      const reflectionNode = b.locator(`[data-response-id="${lesson.id}:${reflection.id}"]`);
      await reflectionNode.locator('textarea').fill('This reflection explains the idea in my own words with a concrete example and clear reasoning.');
      await reflectionNode.locator('[data-check]').click();
      await b.waitForFunction(({ storageKey, lessonId }) => (JSON.parse(localStorage.getItem(storageKey) || '{}').exemplars?.[lessonId]?.points || 0) >= 20, { storageKey: key, lessonId: lesson.id }, { timeout: 15000 });
      if (app !== 'history') {
        await b.waitForFunction(storageKey => Object.keys(JSON.parse(localStorage.getItem(storageKey) || '{}').awards || {}).some(name => name.startsWith('reflect:')), key, { timeout: 10000 });
      }
      console.log('PASS exemplar points', app);

      await b.setViewportSize({ width: 390, height: 844 });
      // innerWidth updates before the layout reflows, and slower runners lag a
      // frame, so let the resize settle before measuring.
      await b.waitForTimeout(150);
      const layout = await b.evaluate(() => {
        const vw = innerWidth;
        const offenders = [...document.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return (r.width || r.height) && r.right > vw + 1; }).slice(0, 12).map(el => `${el.tagName}.${(el.className || '').toString().slice(0, 24)}#${el.id}:${Math.round(el.getBoundingClientRect().right)}`);
        return { over: document.documentElement.scrollWidth > vw, scrollWidth: document.documentElement.scrollWidth, vw, offenders };
      });
      assert.equal(layout.over, false, `${app} mobile overflow ${JSON.stringify(layout)}`);
      assert.deepEqual(errors, [], `${app} browser errors`);
      console.log('PASS exemplar', app);
      await Promise.all(contexts.map(context => context.close()));
    }

    // A legacy pairing link stores the shared key and enables sync.
    const pairing = await browser.newContext();
    const paired = await pairing.newPage();
    const pairingErrors = [];
    paired.on('pageerror', error => pairingErrors.push(error.message));
    await paired.goto('http://127.0.0.1:19002/#sync=' + 'a'.repeat(64));
    await paired.waitForFunction(() => localStorage.getItem('learning-cloud-key-v1') === 'a'.repeat(64), null, { timeout: 10000 });
    await paired.waitForSelector('[data-learning-sync] summary');
    await paired.waitForFunction(() => (document.querySelector('[data-learning-sync] summary')?.textContent || '').startsWith('Saved'), null, { timeout: 15000 });
    assert.deepEqual(pairingErrors, []);
    console.log('PASS legacy pairing');
    await pairing.close();

    // Guided lesson libraries for every subject: recognition-first and synced.
    for (const [app, port, key, count, sample, localKey] of [
      ['english', 19002, 'grammar-room-v1', 10, 'english-nouns', 'learning-cloud-key-v1'],
      ['history', 19001, 'civilization-atlas-v1', 16, 'history-cities', 'learning-cloud-key-v1'],
      ['philosophy', 19003, 'philosophy-scholar-v1', 13, 'philosophy-f3', 'learning-cloud-key-v1'],
      ['geography', 19004, 'geography-atlas-v1', 16, 'geography-locate', 'learning-cloud-key-v1-geography-atlas'],
    ]) {
      const lesson = JSON.parse(fs.readFileSync(`content/lessons/${app}/${sample}.json`, 'utf8'));
      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
      for (const context of contexts) await context.addInitScript(name => localStorage.setItem(name, 'a'.repeat(64)), localKey);
      const [libA, libB] = await Promise.all(contexts.map(context => context.newPage()));
      const errors = [];
      for (const page of [libA, libB]) page.on('pageerror', error => errors.push(error.message));
      const url = `http://127.0.0.1:${port}/`;
      const saved = page => page.waitForFunction(() => (document.querySelector('[data-learning-sync] summary')?.textContent || '').startsWith('Saved'), null, { timeout: 15000 });
      const passed = page => page.waitForFunction(({ storageKey, lessonId }) => Object.values(JSON.parse(localStorage.getItem(storageKey) || '{}').exemplars?.[lessonId]?.passed || {}).some(Boolean), { storageKey: key, lessonId: lesson.id }, { timeout: 15000 });

      await libA.goto(url + '#lessons');
      await libA.waitForSelector('a[href^="#lessons/"]');
      assert.equal(await libA.locator('a[href^="#lessons/"]').count(), count, `${app} library count`);
      await libA.locator(`a[href="#lessons/${sample}"]`).click();
      await libA.waitForSelector('[data-response-id]');
      const recognition = lesson.activities.find(activity => activity.type === 'choice' || activity.type === 'sequence');
      const node = libA.locator(`[data-response-id="${lesson.id}:${recognition.id}"]`);
      if (recognition.type === 'choice') await node.locator(`input[value="${recognition.answer}"]`).check();
      else await node.locator('[data-sequence]').fill(recognition.answer.map(value => value + 1).join(', '));
      await node.locator('[data-check]').click();
      await passed(libA);
      await saved(libA);
      // The lesson can be marked complete, and that state syncs.
      await libA.locator('[data-complete-card] [data-complete-toggle]').click();
      await libA.waitForFunction(({ storageKey, lessonId }) => JSON.parse(localStorage.getItem(storageKey) || '{}').exemplars?.[lessonId]?.completed === true, { storageKey: key, lessonId: lesson.id }, { timeout: 10000 });
      assert.ok((await libA.locator('[data-complete-card]').textContent()).includes('Lesson complete'), `${app} shows lesson completion`);
      await saved(libA);
      const reflection = lesson.activities.find(activity => activity.type === 'short-answer');
      assert.equal(await libA.locator(`[data-response-id="${lesson.id}:${reflection.id}"] .activity-context`).count(), 1, `${app} reflection shows a passage`);
      await libB.goto(url + `#lessons/${sample}`);
      await libB.waitForSelector('[data-response-id]');
      await passed(libB);
      await libB.waitForFunction(({ storageKey, lessonId }) => JSON.parse(localStorage.getItem(storageKey) || '{}').exemplars?.[lessonId]?.completed === true, { storageKey: key, lessonId: lesson.id }, { timeout: 15000 });
      assert.deepEqual(errors, []);
      console.log('PASS lesson library', app);
      await Promise.all(contexts.map(context => context.close()));
    }
  } finally { await browser.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
