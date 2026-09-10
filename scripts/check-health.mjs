// Check that the deployed apps respond as expected without signing in.
//
//   node scripts/check-health.mjs [preview|production]
//
// English, History and Philosophy previews use Cloudflare Access, so
// unauthenticated requests redirect (302) to the Access login. Everything else
// uses the legacy pairing key: the app shell loads (200) and the progress API
// refuses the anonymous request (401). Geography uses the pairing key on both
// preview and production because Access does not cover its hostnames.

const target = process.argv[2] || 'preview';
const apps = ['english', 'history', 'philosophy', 'geography'];
const accessApps = new Set(['english', 'history', 'philosophy']);
const productionHosts = {
  english: 'grammar-reader.history-atlas.workers.dev',
  history: 'history-atlas.history-atlas.workers.dev',
  philosophy: 'philosophy-scholar.history-atlas.workers.dev',
  geography: 'geography-atlas.history-atlas.workers.dev',
};
const hosts = target === 'production'
  ? productionHosts
  : Object.fromEntries(apps.map(app => [app, `learning-${app}-preview.history-atlas.workers.dev`]));

let failures = 0;
for (const app of apps) {
  const origin = `https://${hosts[app]}`;
  const usesAccess = target !== 'production' && accessApps.has(app);
  for (const route of ['/', '/api/progress']) {
    let status = 0, location = '';
    try {
      const response = await fetch(origin + route, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      status = response.status;
      location = response.headers.get('location') || '';
    } catch (error) {
      status = 0;
      location = error.message;
    }
    const expected = usesAccess ? 302 : (route === '/' ? 200 : 401);
    const ok = status === expected && (expected !== 302 || location.includes('cloudflareaccess.com'));
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${app} ${route} -> ${status}${location ? ' ' + location.slice(0, 60) : ''}`);
  }
}
if (failures) { console.error(`${failures} health check(s) failed.`); process.exitCode = 1; }
else console.log(`All ${target} health checks passed.`);
