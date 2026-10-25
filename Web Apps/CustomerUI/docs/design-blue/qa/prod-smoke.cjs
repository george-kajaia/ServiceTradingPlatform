// Production-build smoke: serves the prod build (built to a temp dir) on 127.0.0.1:4315 with SPA fallback.
const http = require('http'), fs = require('fs'), path = require('path');
const L = require('./lib.cjs');
const ROOT = 'C:/Users/georg/AppData/Local/Temp/inv-qa/prod';
const PORT = 4315;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, s) => {
  let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(path.normalize(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html');
  s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s);
});
(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const b = await L.chromium.launch({ executablePath: L.CHROME, headless: true });
  const out = [];
  for (const vp of L.VIEWPORTS) {
    const fx = L.baseFx(); fx.cart = [{ token: { ...fx.primary[0], status: 3 } }];
    const ctx = await L.newCtx(b, vp, fx, { port: PORT }); const page = await ctx.newPage(); await L.attach(page, fx); await L.loginViaStorage(page, fx);
    for (const r of ['/', '/login', '/marketplace', '/cart', '/checkout']) {
      await page.goto(`http://127.0.0.1:${PORT}${r}`); await page.waitForTimeout(700);
      const a = await page.evaluate(L_audit => 0, 0);
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, text: document.body.innerText.length }));
      const ok = w.text > 20 && w.sw <= vp.w + 1;
      out.push({ r, w: vp.w, ok, ...w, console: fx.console.length, pageErrors: fx.pageErrors.length });
      console.log((ok ? 'PASS' : 'FAIL'), 'prod', r, vp.w, JSON.stringify(w), 'console', fx.console.length, 'pageErr', fx.pageErrors.length);
      if (r === '/marketplace' || r === '/') await page.screenshot({ path: path.join(L.SHOTS, `investor_prod${r === '/' ? 'home' : r.replace('/', '-')}_${vp.w}_smoke.png`) });
    }
    console.log('unknown', fx.unknown.length, 'blocked', JSON.stringify(fx.blocked), 'failed', JSON.stringify(fx.failed), 'console', JSON.stringify(fx.console.slice(0, 3)));
    await ctx.close();
  }
  await b.close(); server.close();
  fs.writeFileSync(path.join(__dirname, 'prod-smoke-results.json'), JSON.stringify(out, null, 1));
})();
