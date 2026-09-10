// Check that the deployed apps respond as expected without signing in.
//
//   node scripts/check-health.mjs [preview|production]
//
// Preview uses Cloudflare Access, so unauthenticated requests redirect (302) to
// the Access login. Production still uses the legacy pairing key: the app shell
// loads (200) and the progress API refuses the anonymous request (401).

const target = process.argv[2] || 'preview';
const apps = ['english', 'history', 'philosophy'];
const hosts = target === 'production'
  ? { english: 'grammar-reader.history-atlas.workers.dev', history: 'history-atlas.history-atlas.workers.dev', philosophy: 'philosophy-scholar.history-atlas.workers.dev' }
  : Object.fromEntries(apps.map(app => [app, `learning-${app}-preview.history-atlas.workers.dev`]));

let failures = 0;
for (const app of apps) {
  const origin = `https://${hosts[app]}`;
  for (const route of ['/', '/api/progress']) {
    let status = 0, location = '';
    try {
      const response = await fetch(origin + route, { redirect: 'manual' });
      status = response.status;
      location = response.headers.get('location') || '';
    } catch (error) {
      status = 0;
      location = error.message;
    }
    const expected = target === 'production' ? (route === '/' ? 200 : 401) : 302;
    const ok = status === expected && (expected !== 302 || location.includes('cloudflareaccess.com'));
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${app} ${route} -> ${status}${location ? ' ' + location.slice(0, 60) : ''}`);
  }
}
if (failures) { console.error(`${failures} health check(s) failed.`); process.exitCode = 1; }
else console.log(`All ${target} health checks passed.`);
