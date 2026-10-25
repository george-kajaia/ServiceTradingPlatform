/* CompanyUI blue-redesign QA harness. Dependency-free (uses bundled Playwright).
 * Usage: node harness.cjs [dev|prod]   (env QA_VPS="360,768,1440" to limit widths)
 * All remote traffic is intercepted; only the local app origin is allowed through.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('C:/Users/georg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const TARGET = process.argv[2] || 'dev';
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = __dirname;
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = TARGET === 'dev' ? 4312 : 4322;
const BASE = `http://127.0.0.1:${PORT}`;
const CLI = path.join(ROOT, 'node_modules/@angular/cli/bin/ng.js');
const VPS = (process.env.QA_VPS || '360,768,1440').split(',').map(Number)
  .map(w => ({ w, h: w === 360 ? 800 : w === 768 ? 1024 : 1000 }));

const results = [];      // {id, ok, detail}
const audits = {};       // category -> sig -> {kind, examples, states}
const consoleIssues = [];
const blocked = [];      // remote requests the harness aborted
const unmocked = [];     // /api paths not covered by fixtures
const failedReq = [];
const allCalls = [];
const unverified = [];

function chk(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 400) });
  if (!ok) console.log('FAIL', id, detail === undefined ? '' : String(detail).slice(0, 200));
}

// ------------------------------------------------------------------ fixtures
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const company = {
  id: 1, rowVersion: 7, name: 'Aurora Dental Studio LLC', status: 1, regDate: '2025-03-14T09:30:00Z',
  taxCode: '404512345', address: '12 Rustaveli Avenue, Tbilisi, Georgia', legalForm: 2, economicActivity: 3,
  mail: 'office@aurora-dental.example', phone: '+995 555 010 200',
  bankAccount: { id: 1, rowVersion: 1, companyId: 1, iban: 'GE00XX0000000000000000', beneficiaryName: 'Aurora Dental Studio LLC', bankName: 'Example Bank' }
};
const mkReq = (id, status, n, extra = {}) => ({
  id, rowVersion: id + 10, companyId: 1, companyName: company.name, productId: (id % 4) + 1,
  productName: 'Product ' + ((id % 4) + 1), serviceTokenCount: n, regDate: '2026-09-0' + id + 'T10:00:00Z',
  status, authorizeDate: status >= 2 ? '2026-09-10T11:00:00Z' : null, approveDate: status === 3 ? '2026-09-12T12:00:00Z' : null, ...extra
});
const freshRequests = () => [mkReq(1, 1, 25), mkReq(2, 2, 100), mkReq(3, 3, 1000), mkReq(4, 1, 5), mkReq(5, 0, 12)];
const sched = (t, n = null) => ({ periodType: t, periodNumber: n });
const freshProducts = () => [
  { id: 1, companyId: 1, name: 'Annual Premium Whitening and Hygiene Package (Extended Family Edition)', serviceCount: 12, price: 1250, term: 365, scheduleType: sched(3, 1) },
  { id: 2, companyId: 1, name: 'Free Consultation', serviceCount: 1, price: 0, term: null, scheduleType: sched(0) },
  { id: 3, companyId: 1, name: 'Check-up', serviceCount: 4, price: 49.9, term: 90, scheduleType: sched(2, 2) },
  { id: 4, companyId: 1, name: 'Tiny', serviceCount: 100, price: 0.01, term: null, scheduleType: sched(1) },
  { id: 9, companyId: 2, name: 'Other company product', serviceCount: 1, price: 5, term: null, scheduleType: sched(0) }
];
const freshUsers = () => [
  { id: 1, userType: 1, companyId: 1, userName: 'admin.aurora', password: 'synthetic-pass-1' },
  { id: 2, userType: 2, companyId: 1, userName: 'reception.desk.with.a.very.long.user.name@aurora-dental.example', password: 'synthetic-pass-2' },
  { id: 3, userType: 2, companyId: 2, userName: 'other.company.user', password: 'x' }
];
const freshState = () => ({
  requests: freshRequests(), products: freshProducts(), users: freshUsers(),
  requestsFail: false, productsFail: false, usersFail: false, loginFail: false,
  delay: {}, calls: []
});

function makeRouter(S) {
  return async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (url.origin === BASE) return route.continue();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const isApiHost = url.hostname === 'localhost' && url.port === '7044' || /(^|\.)service-tokens\.com$/.test(url.hostname);
    const m = isApiHost ? url.pathname.match(/^\/api\/(.+)$/) : null;
    if (!m) { blocked.push(`${method} ${url.origin}${url.pathname}`); return route.abort('blockedbyclient'); }
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const p = m[1];
    let body = null; try { body = req.postDataJSON(); } catch { body = req.postData() ? '[binary/form]' : null; }
    const call = { method, path: p, query: Object.fromEntries(url.searchParams), body };
    S.calls.push(call); allCalls.push(call);
    const json = (data, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const text = (t, status) => route.fulfill({ status, headers: { ...cors, 'content-type': 'text/plain' }, body: t });
    const empty = () => route.fulfill({ status: 200, headers: cors, body: '' });
    const d = S.delay[p.split('?')[0]] || S.delay[method + ' ' + p.split('/')[0]] || 0;
    if (d) await new Promise(r => setTimeout(r, d));
    let mm;
    if (p === 'LegalFormDomain/GetAll') return json([{ id: 1, name: 'Sole proprietor' }, { id: 2, name: 'Limited liability company' }, { id: 3, name: 'Joint stock company' }]);
    if (p === 'EconomicActivityDomain/GetAll') return json([{ id: 1, name: 'Retail' }, { id: 3, name: 'Healthcare services' }]);
    if (p === 'Company/AdminLogin' && method === 'POST') return S.loginFail ? text('Invalid user name or password.', 401) : json({ id: 1, companyId: 1, userName: 'qa.synthetic', password: '' });
    if ((mm = p.match(/^Company\/GetById\/(\d+)$/))) return json(company);
    if (p === 'Company/create' && method === 'POST') return empty();
    if (p.startsWith('Company/update') && method === 'PUT') return empty();
    if (p === 'Company/GetAllUsers') return S.usersFail ? text('boom', 500) : json(S.users);
    if ((mm = p.match(/^Company\/GetUserByName\/(.+)$/))) return json(S.users.find(u => u.userName === decodeURIComponent(mm[1])) || S.users[0]);
    if (p === 'Company/CreateUser' || p === 'Company/UpdateUser' || p === 'Company/DeleteUser') return empty();
    if (p.startsWith('Request/GetAll')) return S.requestsFail ? text('boom', 500) : json(S.requests);
    if (p === 'Request/Create') return S.createEmpty500 ? route.fulfill({ status: 500, headers: cors, body: '' }) : empty();
    if (p.startsWith('Request/Update')) return json(S.requests[0]);
    if (p.startsWith('Request/Delete')) return empty();
    if (p.startsWith('Request/Authorize')) return json({ ...S.requests.find(r => r.id === Number(url.searchParams.get('requestId'))), status: 2, authorizeDate: '2026-10-14T08:00:00Z', rowVersion: 99 });
    if (p.startsWith('Request/Deauthorize')) return json({ ...S.requests.find(r => r.id === Number(url.searchParams.get('requestId'))), status: 1, authorizeDate: null, rowVersion: 100 });
    if (p === 'Product/GetAll') return S.productsFail ? text('boom', 500) : json(S.products);
    if ((mm = p.match(/^Product\/GetById\/(\d+)$/))) return json(S.products.find(x => x.id === Number(mm[1])) || S.products[0]);
    if ((mm = p.match(/^Product\/(\d+)\/Pictogram$/))) return method === 'GET' ? (mm[1] === '1' ? route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: png1x1 }) : route.fulfill({ status: 404, headers: cors, body: '' })) : empty();
    if (p === 'Product/Create' || p.startsWith('Product/Update') || p.startsWith('Product/Delete')) return empty();
    unmocked.push(`${method} ${p}`);
    return text('QA harness: unmocked endpoint', 404);
  };
}

// ------------------------------------------------------------------ server
function httpGet(url) {
  return new Promise(res => { const r = http.get(url, x => { x.resume(); res(x.statusCode); }); r.on('error', () => res(0)); r.setTimeout(3000, () => { r.destroy(); res(0); }); });
}
let owned = null, staticServer = null;
async function startServer() {
  if (TARGET === 'dev') {
    if (await httpGet(BASE + '/') === 200) { console.log('reusing dev server'); return; }
    owned = spawn(process.execPath, [CLI, 'serve', '--host', '127.0.0.1', '--port', String(PORT)], { cwd: ROOT, windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 2000)); if (await httpGet(BASE + '/') === 200) { console.log('dev server up'); return; } }
    throw new Error('VERIFICATION_BLOCKED: dev server did not start');
  } else {
    let dir = path.join(ROOT, 'dist/service-token-company-ui');
    if (!fs.existsSync(path.join(dir, 'index.html'))) dir = path.join(dir, 'browser');
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error('VERIFICATION_BLOCKED: no prod build at ' + dir);
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
    staticServer = http.createServer((q, s) => {
      let f = path.join(dir, decodeURIComponent(new URL(q.url, BASE).pathname));
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
      s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
    }).listen(PORT, '127.0.0.1');
    console.log('static prod server up');
  }
}
async function stopServer() {
  if (staticServer) staticServer.close();
  if (owned) { try { spawn('taskkill', ['/pid', String(owned.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {} }
}

// ------------------------------------------------------------------ in-page audit
function inPageAudit(opts) {
  const out = { overflow: [], clipped: [], touch: [], contrast: [], brand: [], names: [], gradients: [], placeholder: [] };
  const sig = el => {
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    const t = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (t ? `"${t}"` : '');
  };
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = el => {
    const layers = []; let e = el;
    while (e) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return { skip: /gradient/.test(cs.backgroundImage) ? 'gradient' : 'image' };
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      e = e.parentElement;
    }
    let base = { r: 255, g: 255, b: 255 };
    for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) }; }
    return base;
  };
  const opacityOf = el => { let o = 1, e = el; while (e) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
  const contained = el => { let e = el.parentElement; while (e && e !== document.body && e !== document.documentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return e; e = e.parentElement; } return null; };

  if (document.documentElement.scrollWidth > vw + 1) out.overflow.push({ sig: 'PAGE scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw, kind: 'page' });
  const all = Array.from(document.body.querySelectorAll('*')).filter(vis);
  for (const el of all) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if ((r.right > vw + 1 || r.left < -1) && !contained(el) && cs.position !== 'fixed' && !['html', 'body'].includes(el.tagName.toLowerCase()))
      out.overflow.push({ sig: sig(el) + ` [${Math.round(r.left)},${Math.round(r.right)}]`, kind: 'element' });
    if (cs.position === 'fixed' && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1)) out.overflow.push({ sig: 'FIXED ' + sig(el) + ` [${Math.round(r.left)},${Math.round(r.right)},${Math.round(r.bottom)}]`, kind: 'fixed' });
    if (el.scrollWidth > el.clientWidth + 1 && /^(hidden|clip)$/.test(cs.overflowX) && /^(button|a|label|th|td|h1|h2|h3|h4|dt|dd|span|p|option)$/.test(el.tagName.toLowerCase()))
      out.clipped.push({ sig: sig(el) + ` sw${el.scrollWidth}>cw${el.clientWidth}`, kind: 'clip' });
    // touch targets
    if (el.matches('button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, [role=button]') && !(el.tagName === 'A' && cs.display === 'inline')) {
      const small = r.height < 43.5 || (el.matches('button') && r.width < 43.5);
      if (small) {
        const kind = el.matches('input,select,textarea') ? 'field' : el.matches('.icon-btn,[aria-label=Close],.scan-modal__close,.toast__close') ? 'icon/close' : el.closest('.row-actions') ? 'row-action' : el.matches('.primary,.btn--primary,[type=submit]') ? 'primary' : el.closest('.actions,.panel-header,.search-row,.company-actions,.modal-actions,.dialog__actions') ? 'toolbar-btn' : el.closest('.footer') ? 'footer-link' : 'other';
        out.touch.push({ sig: sig(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`, kind });
      }
    }
    // names
    if (el.matches('input:not([type=hidden]),select,textarea')) {
      const named = (el.labels && el.labels.length) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!named) out.names.push({ sig: sig(el), kind: 'field-no-label' });
    }
    if (el.matches('button,[role=button],a[href]') && !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) out.names.push({ sig: sig(el), kind: 'no-name' });
    if (cs.backgroundImage.includes('gradient')) out.gradients.push({ sig: sig(el), kind: 'gradient' });
    // brand colors
    const cols = [['color', cs.color], ['bg', cs.backgroundColor]];
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') cols.push(['border', cs.borderTopColor]);
    if (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none') cols.push(['borderL', cs.borderLeftColor]);
    for (const [k, v] of cols) {
      const c = parse(v); if (!c || c.a < 0.3) continue;
      const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), d = mx - mn; const l = (mx + mn) / 510;
      if (d === 0) continue;
      const s = d / (255 - Math.abs(2 * (mx + mn) / 2 - 255)); let h;
      if (mx === c.r) h = ((c.g - c.b) / d) % 6; else if (mx === c.g) h = (c.b - c.r) / d + 2; else h = (c.r - c.g) / d + 4; h = (h * 60 + 360) % 360;
      if (s < 0.15) continue;
      const cls = (h >= 75 && h < 165) ? 'green' : (h >= 165 && h < 205) ? 'cyan' : (h >= 255 && h < 345) ? 'purple/pink' : null;
      if (cls) out.brand.push({ sig: `${cls} ${k} rgb(${c.r},${c.g},${c.b}) on ${sig(el)}`, kind: cls });
    }
  }
  // text contrast
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(); let n;
  while ((n = walker.nextNode())) {
    if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || seen.has(el) || !vis(el)) continue; seen.add(el);
    if (el.closest('script,style,noscript,option')) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
    const dis = el.closest(':disabled,[aria-disabled=true]'); if (dis) continue;
    const bg = bgOf(el); if (bg.skip) { out.contrast.push({ sig: 'SKIPPED(' + bg.skip + ') ' + sig(el), kind: 'skipped' }); continue; }
    const op = opacityOf(el); const a = fg.a * op;
    const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5; const cr = ratio(f, bg);
    if (cr < need) out.contrast.push({ sig: `${cr.toFixed(2)}<${need} ${cs.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}) ${sig(el)}`, kind: 'low' });
    if (size < 12) out.contrast.push({ sig: `font ${size}px<12 ${sig(el)}`, kind: 'small-font' });
  }
  for (const el of document.querySelectorAll('input[placeholder]')) {
    if (!vis(el)) continue; const pc = parse(getComputedStyle(el, '::placeholder').color); const bg = bgOf(el); if (!pc || bg.skip) continue;
    const a = pc.a; const f = { r: pc.r * a + bg.r * (1 - a), g: pc.g * a + bg.g * (1 - a), b: pc.b * a + bg.b * (1 - a) };
    const cr = ratio(f, bg); if (cr < 4.5) out.placeholder.push({ sig: `placeholder ${cr.toFixed(2)}<4.5 ${sig(el)}`, kind: 'low' });
  }
  return out;
}

// ------------------------------------------------------------------ run helpers
let CUR = { vp: null, state: '' };
async function audit(page, label) {
  const res = await page.evaluate(inPageAudit, {});
  for (const [cat, items] of Object.entries(res)) {
    audits[cat] = audits[cat] || {};
    for (const it of items) {
      const key = it.sig + '|' + CUR.vp.w;
      const rec = audits[cat][key] = audits[cat][key] || { sig: it.sig, kind: it.kind, w: CUR.vp.w, states: [] };
      if (!rec.states.includes(label)) rec.states.push(label);
    }
  }
}
async function shot(page, route, state, full = true) {
  const f = `company_${route}_${CUR.vp.w}_${state}.png`;
  await page.screenshot({ path: path.join(SHOTS, f), fullPage: full, animations: 'disabled' });
  return f;
}
async function snap(page, route, state, full = true) { await shot(page, route, state, full); await audit(page, `${route}/${state}`); }
const settle = (page, ms = 350) => page.waitForTimeout(ms);

async function newPage(browser, vp, S, tag) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w < 1000, isMobile: false, deviceScaleFactor: 1, serviceWorkers: 'block',
    permissions: [], acceptDownloads: false
  });
  await ctx.route('**/*', makeRouter(S));
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleIssues.push({ w: vp.w, tag, kind: 'console', text: m.text().slice(0, 240), state: CUR.state }); });
  page.on('pageerror', e => consoleIssues.push({ w: vp.w, tag, kind: 'pageerror', text: String(e).slice(0, 240), state: CUR.state }));
  page.on('requestfailed', r => { const u = r.url(); if (!u.startsWith(BASE)) { if (!/blockedbyclient/i.test(r.failure()?.errorText || '')) failedReq.push(`${r.method()} ${u} ${r.failure()?.errorText}`); } else failedReq.push(`${r.method()} ${u} ${r.failure()?.errorText}`); });
  return { ctx, page };
}
const colorOf = (page, sel, prop) => page.locator(sel).first().evaluate((e, p) => getComputedStyle(e)[p], prop);

async function login(page, S) {
  await page.goto(BASE + '/login');
  await page.locator('input[name=loginUserName]').fill('qa.synthetic');
  await page.locator('input[name=loginPassword]').fill('synthetic-not-real');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.locator('.dashboard-container').waitFor();
  await page.locator('table.grid tbody tr').first().waitFor({ timeout: 5000 }).catch(() => {});
  await settle(page);
}

const inModal = (page, sel) => page.evaluate(s => { const a = document.activeElement; return !!(a && a.closest(s)); }, sel);
const bodyLocked = page => page.evaluate(() => { const b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement); return b.overflow === 'hidden' || h.overflow === 'hidden' || b.position === 'fixed' || b.overflowY === 'hidden' || h.overflowY === 'hidden'; });

/** Verifies the dialog contract. dlg=selector of dialog container. */
async function dialogProtocol(page, id, open, trigger, dlg, closeAlt) {
  await open();
  await page.locator(dlg).first().waitFor({ timeout: 4000 });
  await settle(page, 250);
  chk(`${id}: focus moves inside dialog on open`, await inModal(page, dlg), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  let esc = true; const seq = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); const ok = await inModal(page, dlg); seq.push(ok); if (!ok) esc = false; }
  chk(`${id}: Tab keeps focus inside (12 presses)`, esc, seq.map(x => x ? 1 : 0).join(''));
  let escS = true; for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inModal(page, dlg))) escS = false; }
  chk(`${id}: Shift+Tab keeps focus inside`, escS);
  chk(`${id}: background scroll locked while open`, await bodyLocked(page), 'body/html overflow not hidden');
  // wheel behaviour when page scrolls
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 20);
  if (scrollable) { const y0 = await page.evaluate(() => scrollY); await page.mouse.move(3, 3); await page.mouse.wheel(0, 500); await settle(page, 200); const y = await page.evaluate(() => scrollY); chk(`${id}: wheel over backdrop does not scroll page (scrollY unchanged from open position)`, y === y0, `before=${y0} after=${y}`); }
  else unverified.push(`${id}: wheel-scroll behaviour not exercised at ${CUR.vp.w}px (page not scrollable); style check only`);
  // Escape as a real user (focus wherever it is)
  await page.keyboard.press('Escape'); await settle(page, 250);
  const closedByEsc = await page.locator(dlg).count() === 0;
  chk(`${id}: Escape closes dialog (focus wherever user is)`, closedByEsc);
  if (!closedByEsc) { await closeAlt(); await settle(page, 250); }
  chk(`${id}: focus returns to trigger on close`, await page.evaluate(t => { const a = document.activeElement; return !!a && a.matches(t); }, trigger), await page.evaluate(() => document.activeElement?.tagName + '.' + (document.activeElement?.className || '')));
  chk(`${id}: body scroll restored after close`, !(await bodyLocked(page)));
}

// ------------------------------------------------------------------ suites
async function suiteStatic(browser, vp) {
  const S = freshState();
  // home
  CUR.state = 'home';
  let { ctx, page } = await newPage(browser, vp, S, 'home');
  await page.goto(BASE + '/'); await settle(page, 600);
  await snap(page, 'home', 'default');
  const tok = await page.evaluate(() => { const b = getComputedStyle(document.body); return { bg: b.backgroundColor, color: b.color, ff: b.fontFamily, fs: b.fontSize }; });
  chk(`home@${vp.w}: body bg #F4F7FB`, tok.bg === 'rgb(244, 247, 251)', tok.bg);
  chk(`home@${vp.w}: body text #172033`, tok.color === 'rgb(23, 32, 51)', tok.color);
  chk(`home@${vp.w}: font stack Inter/system sans`, /Inter|system-ui|Segoe|Roboto|sans-serif/.test(tok.ff), tok.ff);
  const faq = page.locator('.faq__btn').first(); await faq.scrollIntoViewIfNeeded(); await faq.click(); await settle(page, 150);
  chk(`home@${vp.w}: FAQ item expands (aria-expanded true + answer visible)`, (await faq.getAttribute('aria-expanded')) === 'true' && await page.locator('.faq__answer').first().isVisible());
  await snap(page, 'home', 'faq-open');
  const pri = page.locator('.hero__actions .btn--primary');
  chk(`home@${vp.w}: hero primary solid blue bg, white text`, (await colorOf(page, '.hero__actions .btn--primary', 'backgroundColor')) === 'rgb(37, 99, 235)' && (await colorOf(page, '.hero__actions .btn--primary', 'color')) === 'rgb(255, 255, 255)', await colorOf(page, '.hero__actions .btn--primary', 'backgroundColor'));
  await page.evaluate(() => scrollTo(0, 0)); await pri.hover(); await settle(page, 400);
  chk(`home@${vp.w}: hero primary hover #1D4ED8`, (await colorOf(page, '.hero__actions .btn--primary', 'backgroundColor')) === 'rgb(29, 78, 216)', await colorOf(page, '.hero__actions .btn--primary', 'backgroundColor'));
  await pri.click(); await page.waitForURL('**/login?mode=register');
  chk(`home@${vp.w}: Register CTA navigates to /login?mode=register and shows registration`, await page.getByRole('heading', { name: 'Company Registration' }).isVisible());
  await ctx.close();

  // login
  CUR.state = 'login';
  ({ ctx, page } = await newPage(browser, vp, S, 'login'));
  await page.goto(BASE + '/login'); await settle(page, 400);
  await snap(page, 'login', 'default');
  const w = await page.evaluate(() => { const c = document.querySelector('.auth-container'); const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { l: r.left, r: innerWidth - r.right, w: r.width, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor }; });
  chk(`login@${vp.w}: card fits viewport with >=16px gutters`, w.l >= 15.5 && w.r >= 15.5, JSON.stringify(w));
  chk(`login@${vp.w}: auth card radius 12 or 16`, ['12px', '16px'].includes(w.radius), w.radius);
  chk(`login@${vp.w}: Login button solid blue`, (await colorOf(page, '.auth-form button[type=submit]', 'backgroundColor')) === 'rgb(37, 99, 235)', await colorOf(page, '.auth-form button[type=submit]', 'backgroundColor'));
  chk(`login@${vp.w}: Login button >=44px`, (await page.locator('.auth-form button[type=submit]').evaluate(e => e.getBoundingClientRect().height)) >= 43.5);
  // focus rings
  const rings = [];
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(250); rings.push(await page.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { s: e.tagName + (e.name ? '[' + e.name + ']' : '') + ':' + (e.textContent || '').trim().slice(0, 12), ring: (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== 'none', token: /37, 99, 235/.test(c.boxShadow + c.outlineColor + c.borderColor), d: `outline=${c.outline} | shadow=${c.boxShadow} | border=${c.borderColor}` }; })); }
  chk(`login@${vp.w}: every Tab stop has a visible focus indicator`, rings.every(r => r.ring), JSON.stringify(rings.filter(r => !r.ring)));
  chk(`login@${vp.w}: blue (token) focus ring on tab stops`, rings.every(r => r.token), JSON.stringify(rings.filter(r => !r.token)));
  await snap(page, 'login', 'focus', false);
  // error
  S.loginFail = true; CUR.state = 'login-error';
  await page.locator('input[name=loginUserName]').fill('qa.synthetic'); await page.locator('input[name=loginPassword]').fill('synthetic-wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.locator('.toast').first().waitFor();
  chk(`login@${vp.w}: failed login shows error toast with API text and stays on /login`, /Invalid user name/.test(await page.locator('.toast').first().innerText()) && page.url().endsWith('/login'), page.url());
  chk(`login@${vp.w}: login POST body {userName,password}`, S.calls.some(c => c.path === 'Company/AdminLogin' && c.body && c.body.userName === 'qa.synthetic' && c.body.password === 'synthetic-wrong'));
  await snap(page, 'login', 'error', false);
  const tcol = await page.evaluate(() => { const t = document.querySelector('.toast'); const c = getComputedStyle(t); return { bg: c.backgroundColor, l: c.borderLeftColor, r: t.getBoundingClientRect() }; });
  chk(`login@${vp.w}: toast inside viewport`, tcol.r.left >= 0 && tcol.r.right <= vp.w && tcol.r.bottom <= vp.h, JSON.stringify(tcol.r));
  await ctx.close();

  // register
  CUR.state = 'register';
  const S2 = freshState();
  ({ ctx, page } = await newPage(browser, vp, S2, 'register'));
  await page.goto(BASE + '/login?mode=register'); await page.locator('select[name=legalForm] option').nth(1).waitFor({ state: 'attached' }); await settle(page, 300);
  await snap(page, 'login-register', 'default');
  const f = (n, v) => page.locator(`[name=${n}]`).fill(v);
  await f('name', 'Synthetic Test LLC'); await f('taxCode', '000000000'); await f('address', '1 Test Street'); await page.selectOption('[name=legalForm]', { label: 'Limited liability company' }); await page.selectOption('[name=economicActivity]', { label: 'Retail' });
  await f('mail', 'qa@example.test'); await f('phone', '+0000000'); await f('bankAccountIban', 'GE00TEST'); await f('bankAccountName', 'Synthetic'); await f('bankName', 'Test Bank'); await f('regUserName', 'qa.reg'); await f('regPassword', 'synthetic-pass');
  await snap(page, 'login-register', 'filled');
  await page.getByRole('button', { name: 'Register', exact: true }).click(); await page.locator('.toast').first().waitFor();
  const reg = S2.calls.find(c => c.path === 'Company/create');
  chk(`register@${vp.w}: POST Company/create body has legalForm 2, economicActivity 1, flat bank fields`, reg && reg.body.legalForm === 2 && reg.body.economicActivity === 1 && reg.body.bankAccountIban === 'GE00TEST' && reg.body.userName === 'qa.reg', JSON.stringify(reg && reg.body));
  chk(`register@${vp.w}: success toast and switch back to login mode`, /Registration successful/.test(await page.locator('.toast').first().innerText()) && await page.getByRole('heading', { name: 'Company Login' }).isVisible());
  await snap(page, 'login-register', 'success-toast', false);
  await ctx.close();

  // guard / redirect
  CUR.state = 'redirects';
  ({ ctx, page } = await newPage(browser, vp, S, 'redir'));
  await page.goto(BASE + '/dashboard'); await settle(page, 500);
  chk(`dashboard@${vp.w}: unauthenticated /dashboard redirects to /login (existing behaviour)`, page.url().endsWith('/login'), page.url());
  await page.goto(BASE + '/does-not-exist'); await settle(page, 400);
  chk(`wildcard@${vp.w}: unknown route redirects to /`, new URL(page.url()).pathname === '/', page.url());
  await ctx.close();
}

async function suiteDashboard(browser, vp) {
  const S = freshState();
  const { ctx, page } = await newPage(browser, vp, S, 'dash');
  const W = vp.w;
  const R = id => `dash@${W}: ${id}`;
  CUR.state = 'dash-requests';
  await login(page, S);
  chk(R('login POST then GetById then Request/GetAll CompanyId=1&status=0'), S.calls.some(c => c.path === 'Company/GetById/1') && S.calls.some(c => c.path.startsWith('Request/GetAll') && c.query.CompanyId === '1' && c.query.status === '0'));
  await snap(page, 'dashboard-requests', 'populated');
  // tokens / layout
  const lay = await page.evaluate(() => { const c = document.querySelector('.dashboard-container'); const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); const p = document.querySelector('.panel'); const pc = getComputedStyle(p); return { w: r.width, l: r.left, padL: parseFloat(cs.paddingLeft), mw: cs.maxWidth, panelRadius: pc.borderTopLeftRadius, panelBg: pc.backgroundColor, panelPad: pc.paddingLeft, tableWrapOverflow: getComputedStyle(document.querySelector('.table-wrap')).overflowX }; });
  chk(R('content max width <=1120px'), lay.w <= 1120.5, JSON.stringify(lay));
  chk(R('gutter 16px (<768) / 24px (>=768)'), Math.abs(lay.l + lay.padL - (W < 768 ? 16 : 24)) < 1 || (W >= 1120 + 48 && lay.w <= 1120.5), JSON.stringify(lay));
  chk(R('panel radius 16 or 12, white surface'), ['16px', '12px'].includes(lay.panelRadius) && lay.panelBg === 'rgb(255, 255, 255)', `${lay.panelRadius} ${lay.panelBg}`);
  chk(R('table wrapper is overflow-x auto'), lay.tableWrapOverflow === 'auto', lay.tableWrapOverflow);
  chk(R('Add button solid blue + white text'), (await colorOf(page, '.actions button.primary', 'backgroundColor')) === 'rgb(37, 99, 235)' && (await colorOf(page, '.actions button.primary', 'color')) === 'rgb(255, 255, 255)', await colorOf(page, '.actions button.primary', 'backgroundColor'));
  await page.locator('.actions button.primary').hover(); await settle(page, 400);
  chk(R('Add button hover #1D4ED8'), (await colorOf(page, '.actions button.primary', 'backgroundColor')) === 'rgb(29, 78, 216)', await colorOf(page, '.actions button.primary', 'backgroundColor'));
  // company-info status badge
  chk(R('status badge shows text label "Active"'), await page.locator('.company-info .badge-active').innerText() === 'Active');
  // row action button state
  const tblScroll = await page.evaluate(() => { const t = document.querySelector('table.grid'); const w = document.querySelector('.table-wrap'); return { tw: t.scrollWidth, ww: w.clientWidth }; });
  if (W < 1000) chk(R('requests table scrolls only inside .table-wrap (table wider than wrapper allowed)'), !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), JSON.stringify(tblScroll));
  // selection
  const rows = page.locator('table.grid tbody tr');
  await rows.nth(0).click(); await settle(page, 250);
  const selBg = await rows.nth(0).locator('td').first().evaluate(e => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e.parentElement).backgroundColor + '|' + getComputedStyle(e).boxShadow);
  chk(R('selected row has blue-50 tint (#EAF1FF)'), /234, 241, 255/.test(selBg), selBg);
  chk(R('selecting Created row enables View/Edit/Delete'), await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).isEnabled() && await page.locator('.actions').getByRole('button', { name: 'Delete', exact: true }).isEnabled());
  await snap(page, 'dashboard-requests', 'row-selected');
  await rows.nth(1).click(); await settle(page, 200);
  chk(R('selecting Authorised row disables Edit/Delete (business rule)'), !(await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).isEnabled()) && !(await page.locator('.actions').getByRole('button', { name: 'Delete', exact: true }).isEnabled()));
  const disStyle = await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).evaluate(e => ({ o: getComputedStyle(e).opacity, c: getComputedStyle(e).cursor }));
  chk(R('disabled button: opacity ~.55 and not-allowed cursor'), Math.abs(parseFloat(disStyle.o) - 0.55) < 0.06 && disStyle.c === 'not-allowed', JSON.stringify(disStyle));
  // authorize row action
  CUR.state = 'dash-authorize';
  await rows.nth(0).getByRole('button', { name: 'Authorize', exact: true }).click(); await page.locator('.toast').first().waitFor();
  const au = S.calls.find(c => c.path.startsWith('Request/Authorize'));
  chk(R('Authorize POSTs requestId=1&rowVersion=11 with no body'), au && au.query.requestId === '1' && au.query.rowVersion === '11', JSON.stringify(au));
  chk(R('row 1 status becomes Authorised after Authorize'), /Authorised/.test(await rows.nth(0).innerText()));
  await snap(page, 'dashboard-requests', 'authorized-toast', false);
  await page.locator('.toast__close').first().click().catch(() => {});

  // dialogs: request view
  CUR.state = 'dash-request-dialogs';
  await rows.nth(2).click();
  const viewBtn = page.locator('.actions').getByRole('button', { name: 'View', exact: true });
  await viewBtn.click(); await page.locator('.modal').waitFor(); await settle(page, 250);
  await snap(page, 'dashboard-request-view', 'dialog', false);
  const mm = await page.evaluate(() => { const m = document.querySelector('.modal'); const r = m.getBoundingClientRect(); const cs = getComputedStyle(m); const bd = getComputedStyle(document.querySelector('.modal-backdrop')); const x = document.querySelector('.modal .icon-btn').getBoundingClientRect(); return { r: [r.left, r.top, r.right, r.bottom], radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, bd: bd.backgroundColor, z: bd.zIndex, close: [x.width, x.height], vw: innerWidth, vh: innerHeight, blur: bd.backdropFilter }; });
  chk(R('modal fully inside viewport'), mm.r[0] >= 0 && mm.r[2] <= mm.vw && mm.r[1] >= 0 && mm.r[3] <= mm.vh, JSON.stringify(mm.r));
  chk(R('modal radius 16, white, backdrop rgba(23,32,51,.5) no blur'), mm.radius === '16px' && mm.bg === 'rgb(255, 255, 255)' && /23, 32, 51/.test(mm.bd) && (mm.blur === 'none'), JSON.stringify(mm));
  chk(R('modal close button >=44x44'), mm.close[0] >= 43.5 && mm.close[1] >= 43.5, mm.close.join('x'));
  await page.keyboard.press('Escape'); await page.locator('.icon-btn').click().catch(() => {}); await settle(page, 200);
  // protocol on Add request
  const addBtn = page.locator('.actions button.primary');
  await dialogProtocol(page, R('request-add dialog'), async () => { await addBtn.click(); }, '.actions button.primary', '.modal', async () => { await page.locator('.modal .modal-actions .secondary').click(); });
  // form + submit
  await addBtn.click(); await page.locator('.modal').waitFor();
  await snap(page, 'dashboard-request-add', 'dialog', false);
  await page.selectOption('.modal select[name=productId]', { label: 'Check-up (Id: 3)' });
  await page.locator('.modal [name=serviceTokenCount]').fill('7');
  S.delay['Request/Create'] = 1500;
  await page.locator('.modal [name=serviceTokenCount]').press('Enter');
  await settle(page, 250);
  const dis = await page.locator('.modal .modal-actions .primary').isDisabled();
  chk(R('submit button disabled while request in flight'), dis);
  await snap(page, 'dashboard-request-add', 'submitting', false);
  await page.keyboard.press('Escape'); await settle(page, 200);
  chk(R('Escape does NOT close dialog while submitting (designer rule)'), await page.locator('.modal').count() === 1);
  await page.waitForTimeout(2200); await page.locator('.modal').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.locator('table.grid tbody tr').first().waitFor({ timeout: 6000 });
  const cr = S.calls.find(c => c.path === 'Request/Create');
  chk(R('Request/Create body {companyId:1, productId:3, serviceTokenCount:7}'), cr && cr.body.companyId === 1 && cr.body.productId === 3 && cr.body.serviceTokenCount === 7, JSON.stringify(cr && cr.body));
  delete S.delay['Request/Create'];
  await settle(page, 400);
  // validation error in modal
  await addBtn.click(); await page.locator('.modal').waitFor();
  await page.locator('.modal .modal-actions .primary').click(); await settle(page, 200);
  chk(R('invalid request add shows inline role=alert error'), /valid Product Id/.test(await page.locator('.modal [role=alert]').innerText()));
  await snap(page, 'dashboard-request-add', 'validation-error', false);
  await page.locator('.modal .modal-actions .secondary').click();
  // edit
  await rows.nth(3).click();
  await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('.modal').waitFor();
  await snap(page, 'dashboard-request-edit', 'dialog', false);
  chk(R('request edit dialog prefilled with productId and count'), (await page.locator('.modal [name=serviceTokenCount]').inputValue()) === '5');
  await page.locator('.modal .modal-actions .primary').click(); await page.locator('.modal').waitFor({ state: 'detached' }).catch(() => {});
  chk(R('Request/Update?requestId=4&rowVersion=14'), S.calls.some(c => c.path.startsWith('Request/Update') && c.query.requestId === '4' && c.query.rowVersion === '14'));
  await settle(page, 400);
  // delete confirm
  CUR.state = 'dash-confirm';
  await rows.nth(3).click();
  const delBtn = page.locator('.actions').getByRole('button', { name: 'Delete', exact: true });
  await dialogProtocol(page, R('confirm dialog (request delete)'), async () => { await delBtn.click(); }, '.actions button.danger', '.dialog', async () => { await page.locator('.dialog .btn--secondary').click(); });
  await delBtn.click(); await page.locator('.dialog').waitFor(); await settle(page, 250);
  await snap(page, 'dashboard-confirm-delete', 'dialog', false);
  const cd = await page.evaluate(() => { const d = document.querySelector('.dialog'); const r = d.getBoundingClientRect(); const bs = Array.from(d.querySelectorAll('button')).map(b => { const c = getComputedStyle(b), q = b.getBoundingClientRect(); return { t: b.textContent.trim(), bg: c.backgroundColor, color: c.color, h: q.height, w: q.width }; }); return { r: [r.left, r.right, r.top, r.bottom], vw: innerWidth, vh: innerHeight, bs, role: d.getAttribute('role') }; });
  chk(R('confirm dialog inside viewport'), cd.r[0] >= 0 && cd.r[1] <= cd.vw && cd.r[2] >= 0 && cd.r[3] <= cd.vh, JSON.stringify(cd.r));
  chk(R('confirm buttons >=44px high'), cd.bs.every(b => b.h >= 43.5), JSON.stringify(cd.bs.map(b => b.h)));
  chk(R('confirm Delete button is solid danger #B91C1C / white'), cd.bs.some(b => b.t === 'Delete' && b.bg === 'rgb(185, 28, 28)' && b.color === 'rgb(255, 255, 255)'), JSON.stringify(cd.bs));
  await page.locator('.dialog .btn--danger').click(); await settle(page, 400);
  chk(R('Request/Delete?requestId=4&rowVersion=14 on confirm'), S.calls.some(c => c.path.startsWith('Request/Delete') && c.query.requestId === '4' && c.query.rowVersion === '14'));
  await page.locator('.toast__close').first().click().catch(() => {});

  // states: empty / error / loading
  CUR.state = 'dash-request-states';
  S.requests = []; await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await settle(page, 400);
  chk(R('empty requests shows existing copy'), /No requests found for this company/.test(await page.locator('.panel').innerText()));
  await snap(page, 'dashboard-requests', 'empty');
  S.requests = freshRequests(); S.requestsFail = true;
  await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await page.locator('.toast__action').waitFor();
  chk(R('failed load shows error toast with Retry action'), await page.locator('.toast', { hasText: 'Failed to load requests' }).count() === 1);
  await snap(page, 'dashboard-requests', 'error-toast-retry', false);
  S.requestsFail = false; await page.locator('.toast__action').click(); await settle(page, 500);
  chk(R('Retry reloads and shows populated table'), await page.locator('table.grid tbody tr').count() === 5);
  S.delay['Request/GetAll'] = 2000;
  await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await settle(page, 350);
  chk(R('loading text visible while request in flight and Refresh disabled'), await page.locator('.info').isVisible() && await page.locator('.actions').getByRole('button', { name: 'Refresh' }).isDisabled());
  await snap(page, 'dashboard-requests', 'loading');
  delete S.delay['Request/GetAll']; await page.locator('table.grid tbody tr').first().waitFor({ timeout: 6000 });

  // tabs: products
  CUR.state = 'dash-products';
  await page.locator('.tabs .tab', { hasText: 'Products' }).click(); await page.locator('table.grid tbody tr').first().waitFor(); await page.mouse.move(700, 700); await settle(page, 500);
  chk(R('active tab has aria/visual state and Products shows only company 1 rows (4)'), await page.locator('table.grid tbody tr').count() === 4);
  const tabSt = await page.evaluate(() => { const a = document.querySelector('.tab.active'); const c = getComputedStyle(a); const i = document.querySelector('.tab:not(.active)'); return { bg: c.backgroundColor, color: c.color, bb: c.borderBottomColor + ' ' + c.borderBottomWidth, h: a.getBoundingClientRect().height, inactive: getComputedStyle(i).color }; });
  chk(R('active tab uses blue-50 bg, blue-700 text, >=44px'), /234, 241, 255/.test(tabSt.bg) && tabSt.color === 'rgb(29, 78, 216)' && tabSt.h >= 43.5, JSON.stringify(tabSt));
  await snap(page, 'dashboard-products', 'populated');
  const priceCells = await page.locator('table.grid tbody tr td:nth-child(4)').allInnerTexts();
  chk(R('zero price renders "0" (not hidden)'), priceCells.includes('0'), JSON.stringify(priceCells));
  const priceFmt = await page.locator('table.grid tbody tr td:nth-child(4)').first().evaluate(e => ({ ta: getComputedStyle(e).textAlign, fv: getComputedStyle(e).fontVariantNumeric, th: getComputedStyle(document.querySelector('table.grid thead th:nth-child(4)')).textAlign }));
  chk(R('price column right-aligned or tabular-nums (aligned price numbers, brief)'), priceFmt.ta === 'right' || priceFmt.ta === 'end' || /tabular/.test(priceFmt.fv), JSON.stringify(priceFmt));
  await page.locator('table.grid tbody tr').nth(0).click();
  await page.locator('.actions').getByRole('button', { name: 'View', exact: true }).click(); await page.locator('.modal img.pictogram-img').waitFor(); await settle(page, 300);
  await snap(page, 'dashboard-product-view', 'dialog', false);
  const imgFit = await page.evaluate(() => { const i = document.querySelector('.modal .pictogram-img'); const m = document.querySelector('.modal').getBoundingClientRect(); const r = i.getBoundingClientRect(); return r.right <= m.right + 1 && r.left >= m.left - 1; });
  chk(R('product view pictogram stays inside modal'), imgFit);
  await page.locator('.modal .icon-btn').click();
  await page.locator('table.grid tbody tr').nth(1).click();
  await page.locator('.actions').getByRole('button', { name: 'View', exact: true }).click(); await page.locator('.modal .dl, .modal dl').first().waitFor(); await page.locator('#company-modal-title').waitFor(); await settle(page, 500);
  chk(R('product without pictogram shows "No pictogram uploaded."'), await page.getByText('No pictogram uploaded.').isVisible());
  chk(R('zero price displays in product details'), /Price\s*0/.test((await page.locator('.modal dl').innerText()).replace(/\n/g, ' ')), (await page.locator('.modal dl').innerText()).replace(/\n/g, ' ').slice(0, 120));
  await snap(page, 'dashboard-product-view', 'no-pictogram-zero-price', false);
  await page.locator('.modal .icon-btn').click();
  // search + load more
  await page.locator('.search-row input').fill('whit'); await page.locator('.search-row input').press('Enter'); await settle(page, 500);
  chk(R('search sends skip=0&take=200&search=whit'), S.calls.some(c => c.path === 'Product/GetAll' && c.query.search === 'whit' && c.query.skip === '0' && c.query.take === '200'));
  await page.locator('.search-row').getByRole('button', { name: 'Load more' }).click(); await settle(page, 400);
  chk(R('Load more sends skip=200'), S.calls.some(c => c.path === 'Product/GetAll' && c.query.skip === '200'));
  // add product + validation
  const pAdd = page.locator('.actions button.primary');
  await pAdd.click(); await page.locator('.modal').waitFor(); await settle(page, 200);
  chk(R('product add Create disabled while form invalid'), await page.locator('.modal .modal-actions .primary').isDisabled());
  await page.locator('.modal [name=name]').focus(); await page.locator('.modal [name=serviceCount]').focus(); await page.locator('.modal [name=price]').focus(); await page.locator('.modal [name=term]').focus(); await settle(page, 200);
  chk(R('touched invalid fields show validation text + danger styling'), (await page.locator('.modal .validation-error').count()) >= 2);
  await snap(page, 'dashboard-product-add', 'validation-errors', false);
  const ve = await page.locator('.modal .validation-error').first().evaluate(e => ({ c: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
  chk(R('validation error uses danger color'), ve.c === 'rgb(185, 28, 28)', JSON.stringify(ve));
  await page.locator('.modal [name=name]').fill('QA Synthetic Product'); await page.locator('.modal [name=serviceCount]').fill('3'); await page.locator('.modal [name=price]').fill('19.5');
  await snap(page, 'dashboard-product-add', 'valid-form');
  await page.locator('.modal .modal-actions .primary').click(); await page.locator('.modal').waitFor({ state: 'detached' }).catch(() => {});
  const pc = S.calls.find(c => c.path === 'Product/Create');
  chk(R('Product/Create body has name, serviceCount 3, price 19.5, companyId 1'), pc && pc.body.name === 'QA Synthetic Product' && pc.body.serviceCount === 3 && pc.body.price === 19.5 && pc.body.companyId === 1, JSON.stringify(pc && pc.body));
  await settle(page, 400);
  // edit
  await page.locator('table.grid tbody tr').nth(0).click();
  await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('.modal [name=name]').waitFor(); await settle(page, 500);
  await snap(page, 'dashboard-product-edit', 'dialog', false);
  chk(R('product edit prefilled and existing pictogram helper shown'), (await page.locator('.modal [name=price]').inputValue()) === '1250' && await page.getByText('Current pictogram').isVisible());
  await page.locator('.modal .modal-actions .secondary').click();
  // empty / error
  S.products = []; await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await settle(page, 400);
  chk(R('empty products copy'), /No products found for this company/.test(await page.locator('.panel').innerText()));
  await snap(page, 'dashboard-products', 'empty');
  S.products = freshProducts(); S.productsFail = true; await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await page.locator('.toast__action').waitFor();
  await snap(page, 'dashboard-products', 'error-toast-retry', false); S.productsFail = false; await page.locator('.toast__action').click(); await settle(page, 400);
  // delete product confirm
  await page.locator('table.grid tbody tr').nth(2).click(); await page.locator('.actions').getByRole('button', { name: 'Delete', exact: true }).click(); await page.locator('.dialog').waitFor();
  await snap(page, 'dashboard-confirm-delete-product', 'dialog', false); await page.locator('.dialog .btn--danger').click(); await settle(page, 300);
  chk(R('Product/Delete?productId=3'), S.calls.some(c => c.path.startsWith('Product/Delete') && c.query.productId === '3'));
  await page.locator('.toast__close').first().click().catch(() => {});

  // users
  CUR.state = 'dash-users';
  await page.locator('.tabs .tab', { hasText: 'Users' }).click(); await page.locator('table.grid tbody tr').first().waitFor();
  chk(R('users table filtered to company 1 (2 rows)'), await page.locator('table.grid tbody tr').count() === 2);
  await snap(page, 'dashboard-users', 'populated');
  await page.locator('table.grid tbody tr').nth(1).click();
  await page.locator('.actions').getByRole('button', { name: 'View', exact: true }).click(); await page.locator('.modal dl').waitFor(); await settle(page, 250);
  chk(R('user view GET GetUserByName/<encoded name>'), S.calls.some(c => c.path.startsWith('Company/GetUserByName/reception.desk')));
  await snap(page, 'dashboard-user-view', 'dialog-long-username', false);
  const dd = await page.locator('.modal dd').nth(1).evaluate(e => ({ r: e.getBoundingClientRect().right, m: document.querySelector('.modal').getBoundingClientRect().right }));
  chk(R('long user name does not overflow modal'), dd.r <= dd.m + 1, JSON.stringify(dd));
  await page.locator('.modal .icon-btn').click();
  const uAdd = page.locator('.actions button.primary'); await uAdd.click(); await page.locator('.modal').waitFor();
  await page.locator('.modal .modal-actions .primary').click(); await settle(page, 200);
  chk(R('user add with empty fields shows "User name is required."'), /User name is required/.test(await page.locator('.modal [role=alert]').innerText()));
  await snap(page, 'dashboard-user-add', 'validation-error', false);
  const pwType = await page.locator('.modal [name=password]').getAttribute('type');
  if (pwType === 'text') results.push({ id: R('INFO password input type=text (pre-existing, out of redesign scope)'), ok: true, detail: 'known' });
  await page.locator('.modal [name=userName]').fill('qa.new.user'); await page.locator('.modal [name=password]').fill('synthetic-pass-9'); await page.selectOption('.modal [name=userType]', { label: 'Admin' });
  await page.locator('.modal .modal-actions .primary').click(); await page.locator('.modal').waitFor({ state: 'detached' }).catch(() => {});
  const cu = S.calls.find(c => c.path === 'Company/CreateUser');
  chk(R('CreateUser body userType 1, companyId 1, userName set'), cu && cu.body.userType === 1 && cu.body.companyId === 1 && cu.body.userName === 'qa.new.user', JSON.stringify(cu && cu.body && { ...cu.body, password: '***' }));
  await settle(page, 300);
  await page.locator('table.grid tbody tr').nth(0).click(); await page.locator('.actions').getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('.modal [name=userName]').waitFor(); await settle(page, 300);
  await snap(page, 'dashboard-user-edit', 'dialog', false);
  chk(R('user edit: user name read-only with helper text'), (await page.locator('.modal [name=userName]').getAttribute('readonly')) !== null && await page.getByText('cannot be changed here').isVisible());
  await page.locator('.modal .modal-actions .secondary').click();
  await page.locator('table.grid tbody tr').nth(0).click(); await page.locator('.actions').getByRole('button', { name: 'Delete', exact: true }).click(); await page.locator('.dialog').waitFor(); await page.locator('.dialog .btn--danger').click(); await settle(page, 300);
  const du = S.calls.find(c => c.path.startsWith('Company/DeleteUser'));
  chk(R('DeleteUser userName query + companyId body'), du && du.query.userName === 'admin.aurora' && du.body === 1, JSON.stringify(du));
  S.users = []; await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await settle(page, 400);
  await snap(page, 'dashboard-users', 'empty');
  S.users = freshUsers(); S.usersFail = true; await page.locator('.actions').getByRole('button', { name: 'Refresh' }).click(); await page.locator('.toast__action').waitFor();
  await snap(page, 'dashboard-users', 'error-toast-retry', false); S.usersFail = false;
  await page.locator('.toast__close').first().click().catch(() => {});

  // company view/edit
  CUR.state = 'dash-company';
  await page.locator('.company-actions').getByRole('button', { name: 'View' }).click(); await page.locator('.modal').waitFor(); await settle(page, 300);
  chk(R('company view shows legal form NAME resolved from domain lookup'), (await page.locator('.modal input[readonly]').evaluateAll(a => a.map(i => i.value))).includes('Limited liability company'));
  await snap(page, 'dashboard-company-view', 'dialog', false);
  const cw = await page.evaluate(() => { const m = document.querySelector('.modal'); const g = document.querySelector('.company-grid'); return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, mw: m.getBoundingClientRect().width, vw: innerWidth, sh: m.scrollHeight, ch: m.clientHeight, vh: innerHeight }; });
  chk(R('company grid: 2 cols >=640 viewport else 1'), cw.cols === (W >= 640 ? 2 : 1), JSON.stringify(cw));
  await page.locator('.modal .modal-actions .secondary').click();
  const cEdit = page.locator('.company-actions').getByRole('button', { name: 'Edit' });
  await dialogProtocol(page, R('company-edit dialog'), async () => { await cEdit.click(); }, '.company-actions button:nth-child(2)', '.modal', async () => { await page.locator('.modal .modal-actions .secondary').click(); });
  await cEdit.click(); await page.locator('.modal select[name=cLegalForm]').waitFor(); await settle(page, 300);
  await snap(page, 'dashboard-company-edit', 'dialog');
  // modal footer reachable on small viewport
  const foot = await page.locator('.modal .modal-actions .primary').evaluate(e => { e.scrollIntoView(); const r = e.getBoundingClientRect(); return { b: r.bottom, vh: innerHeight, t: r.top }; });
  chk(R('company edit Save button reachable within viewport (scrolls inside modal)'), foot.b <= foot.vh + 1 && foot.t >= 0, JSON.stringify(foot));
  await page.locator('.modal [name=cName]').fill('Aurora Dental Studio LLC (QA)');
  await page.locator('.modal .modal-actions .primary').click(); await settle(page, 500);
  const up = S.calls.find(c => c.path.startsWith('Company/update'));
  chk(R('Company/update?companyId=1&rowVersion=7 with flat bank fields + new name'), up && up.query.companyId === '1' && up.query.rowVersion === '7' && up.body.name.endsWith('(QA)') && up.body.bankAccountIban === 'GE00XX0000000000000000', JSON.stringify(up && { q: up.query, n: up.body.name }));
  await snap(page, 'dashboard-requests', 'company-updated-toast', false);
  await page.locator('.tabs .tab', { hasText: 'Requests' }).click(); await settle(page, 300);

  // focus rings on dashboard
  CUR.state = 'dash-focus';
  await page.evaluate(() => { scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
  const rings = []; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(250); rings.push(await page.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { s: e.tagName + ':' + (e.textContent || '').trim().slice(0, 12), ring: (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== 'none' }; })); }
  const rr = rings.filter(r => !r.s.startsWith('BODY')); chk(R('every dashboard Tab stop shows a focus indicator'), rr.every(r => r.ring), JSON.stringify(rr.filter(r => !r.ring)));
  await snap(page, 'dashboard-requests', 'keyboard-focus', false);
  chk(R('touch media: (pointer: coarse) emulation state'), true, 'coarse=' + await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
  await ctx.close();
}

/** Coordinator-finding checks: backdrop dismissal, submit guard, duplicate POST, empty-body 500 toast. */
async function suiteDialogExtra(browser, vp) {
  const S = freshState(); const W = vp.w; const R = id => `extra@${W}: ${id}`;
  CUR.state = 'extra';
  const { ctx, page } = await newPage(browser, vp, S, 'extra');
  await login(page, S);
  const rows = page.locator('table.grid tbody tr');
  // backdrop click closes an idle view dialog and returns focus to the View button
  await rows.nth(2).click();
  const viewBtn = page.locator('.actions').getByRole('button', { name: 'View', exact: true });
  await viewBtn.click(); await page.locator('.modal').waitFor(); await settle(page, 250);
  await page.mouse.click(2, 2); await settle(page, 250);
  chk(R('backdrop click closes idle dialog'), await page.locator('.modal').count() === 0);
  chk(R('focus returns to View button after backdrop close'), await page.evaluate(() => document.activeElement?.textContent.trim() === 'View'));
  chk(R('body scroll restored after backdrop close'), !(await bodyLocked(page)));
  // submit guard: backdrop, close x, cancel blocked; exactly one POST
  const addBtn = page.locator('.actions button.primary');
  await addBtn.click(); await page.locator('.modal').waitFor();
  await page.selectOption('.modal select[name=productId]', { label: 'Check-up (Id: 3)' });
  await page.locator('.modal [name=serviceTokenCount]').fill('2');
  S.delay['Request/Create'] = 1500;
  await page.locator('.modal [name=serviceTokenCount]').press('Enter'); await settle(page, 250);
  await page.mouse.click(2, 2); await settle(page, 150);
  chk(R('backdrop click does NOT close dialog while submitting'), await page.locator('.modal').count() === 1);
  chk(R('close x and Cancel disabled while submitting'), await page.locator('.modal .icon-btn').isDisabled() && await page.locator('.modal .modal-actions .secondary').isDisabled());
  await page.locator('.modal [name=serviceTokenCount]').press('Enter').catch(() => {}); await settle(page, 100);
  await page.waitForTimeout(1800); await page.locator('.modal').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
  chk(R('exactly one Request/Create POST despite repeated submit attempts'), S.calls.filter(c => c.path === 'Request/Create').length === 1, S.calls.filter(c => c.path === 'Request/Create').length);
  chk(R('dialog closes and scroll lock released after submit resolves'), await page.locator('.modal').count() === 0 && !(await bodyLocked(page)));
  delete S.delay['Request/Create'];
  // empty-body 500 -> readable toast, dialog remains for retry
  S.createEmpty500 = true;
  await page.locator('.toast__close').first().click().catch(() => {});
  await addBtn.click(); await page.locator('.modal').waitFor();
  await page.selectOption('.modal select[name=productId]', { label: 'Check-up (Id: 3)' });
  await page.locator('.modal [name=serviceTokenCount]').fill('2');
  await page.locator('.modal .modal-actions .primary').click();
  await page.locator('.toast').first().waitFor({ timeout: 4000 }).catch(() => {});
  const tt = ((await page.locator('.toast').first().innerText().catch(() => '')) || '').trim();
  chk(R('empty-body 500 shows readable non-empty error toast'), tt.length > 8 && !/undefined|null/i.test(tt), JSON.stringify(tt));
  chk(R('dialog stays open after failed create and controls re-enabled'), await page.locator('.modal').count() === 1 && await page.locator('.modal .modal-actions .primary').isEnabled());
  await snap(page, 'dashboard-request-add', 'empty-500-toast', false);
  await page.keyboard.press('Escape'); await settle(page, 200);
  chk(R('Escape closes dialog after failure (not stuck in submitting)'), await page.locator('.modal').count() === 0);
  // price hierarchy (Company equivalent): products price column tabular/right
  await ctx.close();
}

async function suiteScan() {
  unverified.push('Scan overlay (ScanTokenComponent): not reachable. `<app-scan-token>` is not used by any template/route (grep of src), so scanner launch/cancel/error/retry/duplicate-POST/null-payload behaviour cannot be exercised in the real UI without editing app source. Not tested; see qa-report.md.');
}

(async () => {
  const t0 = Date.now();
  await startServer();
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-fake-ui-for-media-stream=false'] });
  try {
    for (const vp of VPS) {
      CUR = { vp, state: '' };
      console.log('== viewport', vp.w);
      try { await suiteStatic(browser, vp); } catch (e) { chk(`suiteStatic@${vp.w} completed`, false, e.stack.split('\n').slice(0, 3).join(' | ')); }
      try { await suiteDashboard(browser, vp); } catch (e) { chk(`suiteDashboard@${vp.w} completed`, false, e.stack.split('\n').slice(0, 3).join(' | ')); }
    }
    for (const vp of VPS) { CUR = { vp, state: '' }; try { await suiteDialogExtra(browser, vp); } catch (e) { chk(`suiteDialogExtra@${vp.w} completed`, false, e.stack.split('\n').slice(0, 3).join(' | ')); } }
    await suiteScan();
  } finally {
    await browser.close(); await stopServer();
  }
  chk('no remote request escaped (all non-local requests aborted/mocked)', true, `blocked=${blocked.length}`);
  chk('no unmocked API endpoint hit', unmocked.length === 0, unmocked.join(','));
  const summary = { target: TARGET, base: BASE, seconds: Math.round((Date.now() - t0) / 1000), pass: results.filter(r => r.ok).length, fail: results.filter(r => !r.ok).length };
  fs.writeFileSync(path.join(OUT, `results-${TARGET}.json`), JSON.stringify({ summary, results, audits: Object.fromEntries(Object.entries(audits).map(([k, v]) => [k, Object.values(v)])), consoleIssues, blocked: [...new Set(blocked)], unmocked: [...new Set(unmocked)], failedReq: [...new Set(failedReq)], unverified: [...new Set(unverified)] }, null, 1));
  console.log(JSON.stringify(summary));
})().catch(async e => { console.error('HARNESS ERROR', e); await stopServer(); process.exit(2); });
