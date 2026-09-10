const { chromium } = require('playwright');
const { spawn } = require('node:child_process');

(async () => {
  const server = spawn(process.execPath, ['tests/serve.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(Error('Test server startup timed out')), 10000);
    server.once('exit', code => reject(Error('Test server exited ' + code)));
    server.stdout.on('data', data => { output += data; if (output.includes('philosophy 19003')) { clearTimeout(timeout); resolve(); } });
  });
  await ready;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || (require('fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  try {
    for (const [app, port, title, activityCount] of [['english', 19002, 'The sentence', 3], ['history', 19001, 'Rivers, cities', 4], ['philosophy', 19003, 'What makes a reason', 4]]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/#exemplar`);
      await page.waitForSelector('[data-response-id]', { timeout: 5000 });
      const heading = (await page.locator('h1').first().textContent()).toLowerCase();
      if (!heading.includes(title.toLowerCase()) || await page.locator('[data-response-id]').count() !== activityCount || errors.length) throw Error(`${app} exemplar failed: ${heading}; ${errors.join('; ')}`);
      const first = page.locator('[data-response-id]').first();
      if (await first.locator('input[type=radio]').count()) await first.locator('input[type=radio]').first().check();
      else await first.locator('textarea').fill('This response uses concrete evidence and explains the comparison clearly.');
      await first.locator('[data-check]').click();
      if (!(await first.locator('output').textContent()).includes('Passed')) throw Error(`${app} first activity did not produce a passing result`);
      console.log('PASS exemplar', app);
      await page.close();
    }
  } finally { await browser.close(); server.kill('SIGTERM'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
