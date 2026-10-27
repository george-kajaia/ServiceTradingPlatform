/* AdminUI blue-redesign QA harness. Dependency-free (uses the bundled Playwright + system Chrome).
 * Usage: node docs/design-blue/qa/harness.cjs dev            (starts/reuses ng serve on 4313)
 *        node docs/design-blue/qa/harness.cjs prod <distDir> (serves a production build statically on 4313)
 * All remote traffic is intercepted; only the local origin is allowed. API calls get synthetic fixtures.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { chromium } = require('C:/Users/georg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const MODE = process.argv[2] || 'dev';
const DIST = process.argv[3];
const PORT = 4313;
const BASE = `http://127.0.0.1:${PORT}`;
const APP = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(__dirname, '..');
const SHOTS = path.join(OUT, 'screenshots', MODE);
const CLI = path.join(APP, 'node_modules/@angular/cli/bin/ng.js');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { w: 360, h: 800, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1440, h: 1000, mobile: false },
];

const results = []; // {id, vp, ok, detail}
const consoleLog = []; // {scenario, type, text, expected}
const blocked = []; // remote requests aborted
const apiCalls = []; // all fulfilled API calls
let owned = null, staticServer = null;

function check(vp, id, ok, detail = '') {
  results.push({ id, vp, ok: !!ok, detail: String(detail).slice(0, 400) });
  if (!ok) console.log(`  FAIL [${vp}] ${id} :: ${String(detail).slice(0, 300)}`);
}

// ---------------- fixtures ----------------
const mkCompanies = () => [
  { id: 1, rowVersion: 11, name: 'Alpha Logistics LLC', status: 1, regDate: '2026-03-01T09:30:00Z', taxCode: '201234567' },
  { id: 2, rowVersion: 12, name: 'Beta Energy Partners With A Very Long Registered Company Name Ltd', status: 0, regDate: '2026-04-15T12:00:00Z', taxCode: '405987654' },
  { id: 3, rowVersion: 13, name: 'Gamma Telecom', status: 0, regDate: '2026-05-20T08:15:00Z', taxCode: '211111111' },
  { id: 4, rowVersion: 14, name: 'Delta Foods', status: 1, regDate: '2026-06-02T17:45:00Z', taxCode: '222222222' },
];
const mkRequests = () => [
  { id: 101, rowVersion: 1, companyId: 1, companyName: 'Alpha Logistics LLC', productId: 9, productName: 'Fuel Voucher 50', serviceTokenCount: 500, regDate: '2026-07-01T10:00:00Z', status: 1, authorizeDate: null, approveDate: null },
  { id: 102, rowVersion: 2, companyId: 2, companyName: 'Beta Energy Partners With A Very Long Registered Company Name Ltd', productId: 10, productName: 'Charging Pass Unlimited Premium Annual Edition', serviceTokenCount: 12000, regDate: '2026-07-02T10:00:00Z', status: 2, authorizeDate: '2026-07-03T10:00:00Z', approveDate: null },
  { id: 103, rowVersion: 3, companyId: 4, companyName: 'Delta Foods', productId: 11, productName: 'Lunch Card', serviceTokenCount: 80, regDate: '2026-07-04T10:00:00Z', status: 3, authorizeDate: '2026-07-05T10:00:00Z', approveDate: '2026-07-06T10:00:00Z' },
  { id: 104, rowVersion: 4, companyId: 3, companyName: null, productId: 12, productName: null, serviceTokenCount: 1, regDate: '2026-07-07T10:00:00Z', status: 0 },
];

function newState() {
  return { companies: mkCompanies(), requests: mkRequests(), login: 'ok', loginDelay: 0, companiesMode: 'ok', companiesDelay: 0,
    requestsMode: 'ok', approveMode: 'ok', calls: [] };
}

function cors(extra = {}) { return { 'access-control-allow-origin': '*', ...extra }; }

async function apiHandler(route, req, st) {
  const u = new URL(req.url());
  const p = u.pathname.replace(/^\/api/, '');
  const m = req.method();
  st.calls.push(`${m} ${p}${u.search}`);
  apiCalls.push(`${m} ${p}${u.search}`);
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: cors(), body: JSON.stringify(b) });
  const text = (b, s) => route.fulfill({ status: s, contentType: 'text/plain', headers: cors(), body: b });
  const empty = (s = 200) => route.fulfill({ status: s, headers: cors(), body: '' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors({ 'access-control-allow-methods': '*', 'access-control-allow-headers': '*' }) });
  if (p === '/User/Login' && m === 'POST') {
    if (st.loginDelay) await sleep(st.loginDelay);
    if (st.login === '500') return route.fulfill({ status: 500, headers: cors(), body: '' });
    return st.login === 'ok' ? json(7) : text('Invalid username or password.', 400);
  }
  if (p === '/User/GetById/7') return json({ id: 7, userName: 'qa-admin', userFullName: 'QA Synthetic Admin', password: '' });
  if (p === '/Company/GetAll') {
    if (st.companiesDelay) await sleep(st.companiesDelay);
    if (st.companiesMode === 'error') return route.fulfill({ status: 500, headers: cors(), body: '' });
    if (st.companiesMode === 'empty') return json([]);
    return json(st.companies);
  }
  if (p === '/Company/Approve' && m === 'PATCH') {
    if (st.approveMode === 'e500') return route.fulfill({ status: 500, headers: cors(), body: '' });
    if (st.approveMode === 'conflict') return text('Company was modified by another user.', 409);
    const c = st.companies.find(x => x.id === Number(u.searchParams.get('companyId')));
    if (c) { c.status = 1; c.rowVersion++; }
    return empty();
  }
  if (p === '/Request/GetAll') {
    if (st.requestsMode === 'error') return route.fulfill({ status: 500, headers: cors(), body: '' });
    if (st.requestsMode === 'empty') return json([]);
    const cid = Number(u.searchParams.get('CompanyId')), status = Number(u.searchParams.get('status'));
    return json(st.requests.filter(r => (cid === -1 || r.companyId === cid) && (status === 0 || r.status === status)));
  }
  if (p === '/Request/Approve' && m === 'POST') {
    if (st.approveMode === 'conflict') return text('Request was modified by another user.', 409);
    const r = st.requests.find(x => x.id === Number(u.searchParams.get('requestId')));
    if (r) { r.status = 3; r.rowVersion++; r.approveDate = '2026-08-01T10:00:00Z'; }
    return json(r || {});
  }
  if (p === '/Request/Delete' && m === 'DELETE') {
    st.requests = st.requests.filter(x => x.id !== Number(u.searchParams.get('requestId')));
    return empty();
  }
  blocked.push(`UNMOCKED API ${m} ${p}`);
  return route.fulfill({ status: 404, headers: cors(), body: 'unmocked in QA harness' });
}

// ---------------- infra ----------------
async function healthy() {
  return new Promise(res => {
    http.get(BASE + '/', r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(r.statusCode === 200 && b.includes('app-root'))); })
      .on('error', () => res(false));
  });
}
async function startServer() {
  if (await healthy()) { console.log('reusing existing server on', PORT); return; }
  if (MODE === 'prod') {
    const root = path.resolve(DIST);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.png': 'image/png' };
    staticServer = http.createServer((q, s) => {
      let f = path.join(root, decodeURIComponent(new URL(q.url, BASE).pathname));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(s);
    }).listen(PORT, '127.0.0.1');
    return;
  }
  owned = spawn(process.execPath, [CLI, 'serve', '--host', '127.0.0.1', '--port', String(PORT)], { cwd: APP, windowsHide: true, stdio: 'ignore' });
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) { if (await healthy()) return; await new Promise(r => setTimeout(r, 1500)); }
  throw new Error('VERIFICATION_BLOCKED: dev server did not become ready');
}
function stopServer() {
  if (staticServer) staticServer.close();
  if (owned) { try { execSync(`taskkill /pid ${owned.pid} /T /F`, { stdio: 'ignore' }); } catch {} }
}

async function newPage(browser, vp, scenario, st, { expectErr = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1,
    isMobile: vp.mobile, hasTouch: vp.mobile, permissions: [], serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC',
  });
  await ctx.route('**/*', async route => {
    const req = route.request(); const u = new URL(req.url());
    if (u.origin === BASE) {
      // Headless Chrome cannot emulate (pointer: coarse); for touch viewports rewrite that media feature in the
      // app's own bundles so the app's coarse-pointer rules are exercised. (Harness-only transform of local JS/CSS.)
      if (vp.mobile && /\.(js|css)$/.test(u.pathname)) {
        const resp = await route.fetch(); let body = await resp.text();
        body = body.replace(/\(pointer:\s*coarse\)/g, '(min-width: 0px)');
        return route.fulfill({ response: resp, body });
      }
      return route.continue();
    }
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* font stub */' });
    if (u.hostname === 'fonts.gstatic.com') return route.fulfill({ status: 204, body: '' });
    if (u.hostname === 'service-tokens.com' || u.hostname.endsWith('.service-tokens.com')) {
      if (u.pathname.startsWith('/api/')) return apiHandler(route, req, st);
    }
    blocked.push(`${req.method()} ${req.url()}`);
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const tag = `${scenario}@${vp.w}`;
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) consoleLog.push({ scenario: tag, type: m.type(), text: m.text().slice(0, 300), expected: expectErr }); });
  page.on('pageerror', e => consoleLog.push({ scenario: tag, type: 'pageerror', text: String(e).slice(0, 300), expected: false }));
  page.on('requestfailed', r => { if (!r.failure().errorText.includes('BLOCKEDBYCLIENT')) consoleLog.push({ scenario: tag, type: 'requestfailed', text: `${r.url()} ${r.failure().errorText}`, expected: false }); });
  page.setDefaultTimeout(8000);
  return { ctx, page };
}

async function shot(page, vp, route, state, full = true) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, `AdminUI_${route}_${vp.w}_${state}.png`), fullPage: full });
}

// ---------------- in-page audit ----------------
const AUDIT = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data;
    // alpha via separate parse of string
    const m = /rgba?\(([^)]+)\)/.exec(c); let a = 1; if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean); if (p.length > 3) a = parseFloat(p[3]); if (/%/.test(p[3] || '')) a /= 100; }
    if (/^color\(|^oklab|^oklch|^lab/.test(c)) a = 1;
    return [d[0], d[1], d[2], a]; };
  const over = (f, b) => [0, 1, 2].map(i => f[i] * f[3] + b[i] * (1 - f[3]));
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const bgOf = el => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); let bg = [255, 255, 255];
    for (let i = chain.length - 1; i >= 0; i--) { const c = parse(getComputedStyle(chain[i]).backgroundColor); if (c[3] > 0) bg = over(c, bg); } return bg; };
  const opacityOf = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const desc = el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const out = { overflow: null, contrast: [], disabledContrast: [], small: [], clipped: [], brand: [], gradients: [], fonts: new Set(), zero: [] };
  const de = document.documentElement;
  out.overflow = { scrollW: de.scrollWidth, clientW: de.clientWidth, bodyScrollW: document.body.scrollWidth };
  const all = [...document.querySelectorAll('body *')].filter(visible);
  for (const el of all) {
    const s = getComputedStyle(el);
    out.fonts.add(s.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (s.backgroundImage !== 'none') out.gradients.push(desc(el) + ' ' + s.backgroundImage.slice(0, 60));
    // brand hue scan
    for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
      if (prop === 'borderTopColor' && parseFloat(s.borderTopWidth) === 0) continue;
      const c = parse(s[prop]); if (c[3] === 0 || (prop === 'backgroundColor' && parse(s.backgroundColor)[3] === 0)) continue;
      const [r, g, b] = c.map((v, i) => i < 3 ? v / 255 : v); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (d < 0.08) continue; let h = 0; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h = (h * 60 + 360) % 360;
      const sat = d / (1 - Math.abs(2 * l - 1));
      if (sat < 0.2) continue;
      let kind = null; if (h >= 255 && h <= 345) kind = 'purple/pink'; else if (h >= 75 && h <= 175) kind = 'green'; else if (h >= 170 && h < 200) kind = 'cyan/teal';
      if (kind) out.brand.push({ kind, el: desc(el), prop, val: s[prop], semantic: !!el.closest('.status--ok,td button,.toast--success,.dialog--success') });
    }
    // text contrast
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const isField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !['checkbox', 'radio'].includes(el.type);
    if (own || isField) {
      const fs = parseFloat(s.fontSize); if (fs < 12) out.small.push(`FONT<12 ${desc(el)} ${fs}px`);
      const bg = bgOf(el); const op = opacityOf(el);
      let fg = parse(s.color); fg = [...over([fg[0], fg[1], fg[2], fg[3] * op], bg), 1];
      const r = ratio(fg, bg); const bold = parseInt(s.fontWeight) >= 700; const large = fs >= 24 || (fs >= 18.66 && bold);
      const need = large ? 3 : 4.5; const rec = { el: desc(el), text: (el.textContent || el.value || '').trim().slice(0, 30), ratio: +r.toFixed(2), need, fs };
      if (el.disabled || el.closest('[disabled]')) out.disabledContrast.push(rec); else if (r < need) out.contrast.push(rec);
    }
    // controls
    if (el.matches('button,a[href],input,select,[role=button],[tabindex]:not([tabindex="-1"])')) {
      const r = el.getBoundingClientRect();
      if (el.matches('input,select,button,a[href]') && (r.height < 43.5 || r.width < 43.5)) out.zero.push({ el: desc(el), text: (el.textContent || el.name || '').trim().slice(0, 24), w: +r.width.toFixed(1), h: +r.height.toFixed(1), inTable: !!el.closest('table') });
    }
    if (el.matches('button,.status,label,h2,h3,.toast__message,.dialog__title') && (el.scrollWidth > el.clientWidth + 1) && s.overflow !== 'visible' ) out.clipped.push(desc(el) + ' ' + (el.textContent || '').trim().slice(0, 24));
  }
  out.fonts = [...out.fonts];
  return out;
};

async function audit(page, vp, label, opts = {}) {
  const a = await page.evaluate(AUDIT);
  const o = a.overflow;
  check(vp.w, `${label}: no horizontal viewport overflow`, o.scrollW <= o.clientW && o.bodyScrollW <= o.clientW, JSON.stringify(o));
  check(vp.w, `${label}: text contrast >= AA`, a.contrast.length === 0, JSON.stringify(a.contrast.slice(0, 5)));
  check(vp.w, `${label}: no purple/pink/cyan or non-semantic green`, a.brand.filter(b => b.kind !== 'green' || !b.semantic).length === 0, JSON.stringify(a.brand.filter(b => b.kind !== 'green' || !b.semantic).slice(0, 5)));
  check(vp.w, `${label}: no gradients/background images`, a.gradients.length === 0, a.gradients.slice(0, 3).join('|'));
  check(vp.w, `${label}: no text <12px`, a.small.length === 0, a.small.slice(0, 3).join('|'));
  check(vp.w, `${label}: no clipped button/label text`, a.clipped.length === 0, a.clipped.join('|'));
  // touch targets: on mobile (pointer: coarse) every control >=44; on desktop only non-table controls
  const bad = a.zero.filter(z => vp.mobile || !z.inTable);
  const badDesktopTable = a.zero.filter(z => !vp.mobile && z.inTable);
  check(vp.w, `${label}: controls >=44px ${vp.mobile ? '(coarse pointer, all)' : '(desktop, non-table)'}`, bad.length === 0, JSON.stringify(bad.slice(0, 6)));
  if (badDesktopTable.length) results.push({ id: `${label}: INFO desktop table buttons <44px (spec allows 36px in dense tables)`, vp: vp.w, ok: true, detail: JSON.stringify(badDesktopTable[0]) });
  if (a.disabledContrast.length) results.push({ id: `${label}: INFO disabled-control contrast`, vp: vp.w, ok: true, detail: JSON.stringify(a.disabledContrast.slice(0, 3)) });
  return a;
}

async function focusRing(page, vp, label, selector) {
  await page.focus(selector).catch(() => {});
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  const r = await page.evaluate(sel => {
    const el = document.querySelector(sel); const s = getComputedStyle(el);
    return { focused: document.activeElement === el, shadow: s.boxShadow, outline: s.outlineStyle + ' ' + s.outlineWidth, border: s.borderTopColor };
  }, selector);
  const blueRing = /rgb\(37, 99, 235\) 0px 0px 0px [2-9]px/.test(r.shadow); const blueBorder = r.border === 'rgb(37, 99, 235)'; const outl = (r.outline.startsWith('solid') || r.outline.startsWith('auto')) && !r.outline.endsWith(' 0px');
  const visible = r.focused && (blueRing || blueBorder || outl);
  check(vp.w, `${label}: visible keyboard focus indicator`, visible, JSON.stringify(r));
  return r;
}

async function login(page, vp) {
  await page.goto(BASE + '/login');
  await page.fill('input[name=userName]', 'qa-admin'); await page.fill('input[name=password]', 'synthetic-pass');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
  await page.waitForSelector('app-admin-dashboard h2');
}

// ---------------- scenarios ----------------
async function run() {
  await startServer();
  const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  // Headless Chrome does not emulate (pointer: coarse) from hasTouch alone; touch browser uses a blink setting (test flag only).
  const touchBrowser = await chromium.launch({ executablePath: exe, headless: true, args: [] });
  const deskBrowser = await chromium.launch({ executablePath: exe, headless: true });
  const browser0 = { close: async () => { await touchBrowser.close(); await deskBrowser.close(); } };
  try {
    for (const vp of VIEWPORTS) {
      const browser = vp.mobile ? touchBrowser : deskBrowser;
      console.log(`== viewport ${vp.w}x${vp.h} (${MODE})`);
      // ---- routes + redirects
      {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'routes', st);
        await page.goto(BASE + '/'); await page.waitForURL('**/login');
        check(vp.w, 'route "/" redirects to /login', page.url().endsWith('/login'), page.url());
        await page.goto(BASE + '/no-such-page'); await page.waitForURL('**/login');
        check(vp.w, 'unknown route redirects to /login', page.url().endsWith('/login'), page.url());
        await page.goto(BASE + '/dashboard'); await page.waitForURL('**/login');
        check(vp.w, 'unauthenticated /dashboard redirects to /login (existing behaviour, no guard)', page.url().endsWith('/login'), page.url());
        check(vp.w, 'no API calls made while unauthenticated', st.calls.length === 0, st.calls.join(','));
        await ctx.close();
      }
      // ---- login screen: empty / audit / focus / link
      {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'login', st);
        await page.goto(BASE + '/login'); await page.waitForSelector('form.auth-form');
        await shot(page, vp, 'login', 'empty');
        await audit(page, vp, 'login/empty');
        const d = await page.evaluate(() => {
          const b = document.querySelector('button[type=submit]'); const s = getComputedStyle(b); const c = document.querySelector('.auth-container'); const cs = getComputedStyle(c);
          const lab = [...document.querySelectorAll('input')].map(i => i.labels?.[0]?.textContent.trim().split('\n')[0]);
          const link = document.querySelector('.back-link'); const ls = getComputedStyle(link);
          const r = c.getBoundingClientRect();
          return { bg: s.backgroundColor, color: s.color, h: b.getBoundingClientRect().height, radius: s.borderTopLeftRadius, lab, cardRadius: cs.borderTopLeftRadius, cardW: r.width, cardLeft: r.left, linkColor: ls.color, pageBg: getComputedStyle(document.querySelector('app-admin-login')).backgroundColor, h2: document.querySelector('h2').textContent.trim(), font: getComputedStyle(document.body).fontFamily };
        });
        check(vp.w, 'login: primary button solid blue #2563EB with white text', d.bg === 'rgb(37, 99, 235)' && d.color === 'rgb(255, 255, 255)', `${d.bg} ${d.color}`);
        check(vp.w, 'login: primary button height >=44 and radius 8px', d.h >= 44 && d.radius === '8px', `${d.h} ${d.radius}`);
        check(vp.w, 'login: inputs have visible labels (Username/Password)', d.lab.join(',') === 'Username,Password', d.lab.join(','));
        check(vp.w, 'login: card radius 16px, page bg #F4F7FB', d.cardRadius === '16px' && d.pageBg === 'rgb(244, 247, 251)', `${d.cardRadius} ${d.pageBg}`);
        check(vp.w, 'login: heading text preserved "Administrator Login"', d.h2 === 'Administrator Login', d.h2);
        check(vp.w, 'login: link blue #2563EB', d.linkColor === 'rgb(37, 99, 235)', d.linkColor);
        check(vp.w, 'login: card fits viewport with side gutter >=16px', d.cardLeft >= 16 && d.cardW <= vp.w - 32, `${d.cardLeft} ${d.cardW}`);
        await focusRing(page, vp, 'login/username input', 'input[name=userName]');
        await focusRing(page, vp, 'login/password input', 'input[name=password]');
        await focusRing(page, vp, 'login/submit button', 'button[type=submit]');
        await focusRing(page, vp, 'login/back link', '.back-link');
        // input focus state shot
        await page.focus('input[name=userName]'); await shot(page, vp, 'login', 'input-focus', false);
        await ctx.close();
      }
      // ---- login: loading + error (expected 400) + retry success
      {
        const st = newState(); st.login = 'bad'; st.loginDelay = 900; const { ctx, page } = await newPage(browser, vp, 'login-error', st, { expectErr: true });
        await page.goto(BASE + '/login'); await page.waitForSelector('form.auth-form');
        await page.fill('input[name=userName]', 'qa-admin'); await page.fill('input[name=password]', 'wrong');
        await page.click('button[type=submit]');
        await page.waitForTimeout(250);
        const dis = await page.$eval('button[type=submit]', b => ({ d: b.disabled, op: getComputedStyle(b).opacity }));
        check(vp.w, 'login/loading: submit disabled while request pending', dis.d === true, JSON.stringify(dis));
        await shot(page, vp, 'login', 'loading');
        await page.waitForSelector('.toast');
        await shot(page, vp, 'login', 'error-toast', false);
        const t = await page.evaluate(() => { const t = document.querySelector('.toast'); const r = t.getBoundingClientRect(); const s = getComputedStyle(t); const x = document.querySelector('.toast__close').getBoundingClientRect(); return { msg: t.querySelector('.toast__message').textContent.trim(), l: r.left, r: r.right, top: r.top, b: r.bottom, bg: s.backgroundColor, leftBar: s.borderLeftColor + ' ' + s.borderLeftWidth, closeH: x.height, closeW: x.width, role: t.getAttribute('role'), vh: innerHeight, vw: innerWidth }; });
        check(vp.w, 'login/error: API error message shown in toast', t.msg === 'Invalid username or password.', t.msg);
        check(vp.w, 'login/error: toast within viewport', t.l >= 0 && t.r <= t.vw && t.top >= 0 && t.b <= t.vh, JSON.stringify(t));
        check(vp.w, 'login/error: toast white surface with danger left bar', t.bg === 'rgb(255, 255, 255)' && t.leftBar.includes('185, 28, 28'), `${t.bg} ${t.leftBar}`);
        check(vp.w, 'login/error: toast dismiss control >=44px', t.closeH >= 44 && t.closeW >= 44, `${t.closeW}x${t.closeH}`);
        check(vp.w, 'login/error: toast placement (bottom on mobile, top-right on desktop)', vp.w < 768 ? t.b > t.vh / 2 : (t.top < 100 && t.r > t.vw - 60), `top=${t.top} bottom=${t.b} right=${t.r}`);
        await audit(page, vp, 'login/error-toast');
        check(vp.w, 'login/error: stays on /login, button re-enabled', page.url().endsWith('/login') && await page.$eval('button[type=submit]', b => !b.disabled), page.url());
        st.login = 'ok'; st.loginDelay = 0; await page.fill('input[name=password]', 'right'); await page.click('button[type=submit]'); await page.waitForURL('**/dashboard');
        check(vp.w, 'login: retry with valid creds reaches /dashboard (Login + GetById calls)', st.calls.some(c => c === 'POST /User/Login') && st.calls.includes('GET /User/GetById/7'), st.calls.join(','));
        await ctx.close();
      }
      // ---- dashboard: companies populated + filters + approve
      {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'companies', st);
        await login(page, vp); await page.waitForSelector('table.grid');
        check(vp.w, 'companies: GetAll called with skip=0&take=500', st.calls.includes('GET /Company/GetAll?skip=0&take=500'), st.calls.join(','));
        check(vp.w, 'companies: heading, tabs and 4 rows preserved', await page.evaluate(() => document.querySelector('h2').textContent.trim() === 'Admin Dashboard' && document.querySelectorAll('.tabs .tab, .tabs button').length === 2 && document.querySelectorAll('tbody tr').length === 4 && !/filteredRequests/.test(document.body.innerText)), '');
        await shot(page, vp, 'dashboard-companies', 'populated');
        await audit(page, vp, 'companies/populated');
        const g = await page.evaluate(() => {
          const q = s => document.querySelector(s); const panel = q('.panel').getBoundingClientRect(); const ps = getComputedStyle(q('.panel')); const wrap = q('.table-scroll'); const th = q('th'); const tabs = [...document.querySelectorAll('.tabs button')];
          const rows = [...document.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('td')].map(t => t.textContent.trim()));
          const act = [...document.querySelectorAll('tbody tr')].map(r => r.querySelector('button').disabled);
          const bst = getComputedStyle(q('td button:not(:disabled)')); const dst = getComputedStyle(q('td button:disabled'));
          const st = [...document.querySelectorAll('.status')].map(s => ({ t: s.textContent.trim(), bg: getComputedStyle(s).backgroundColor, c: getComputedStyle(s).color }));
          return { panelLeft: panel.left, panelW: panel.width, vw: innerWidth, radius: ps.borderTopLeftRadius, pad: ps.paddingLeft, wrapScrolls: wrap.scrollWidth > wrap.clientWidth, wrapOverflowX: getComputedStyle(wrap).overflowX, wrapW: wrap.getBoundingClientRect().width, thPos: getComputedStyle(th).position, active: getComputedStyle(tabs[0]).color + '|' + getComputedStyle(tabs[0]).backgroundColor + '|' + getComputedStyle(tabs[0]).borderBottomColor, pressed: tabs.map(t => t.getAttribute('aria-pressed')).join(','), rows, act, approveBg: bst.backgroundColor, approveColor: bst.color, disBg: dst.backgroundColor, disOp: dst.opacity, st, tabH: tabs[0].getBoundingClientRect().height };
        });
        const expGutter = vp.w < 768 ? 16 : 24;
        check(vp.w, `companies: panel gutter ${expGutter}px (mobile 16 / desktop 24)`, vp.w >= 1168 ? (g.panelW >= 1070 && g.panelW <= 1120 && Math.abs(g.panelLeft - (vp.w - g.panelW) / 2) < 1) : Math.abs(g.panelLeft - expGutter) < 1, `left=${g.panelLeft} w=${g.panelW}`);
        check(vp.w, 'companies: panel radius 16px, padding 20px desktop / 16px mobile', g.radius === '16px' && g.pad === (vp.w < 768 ? '16px' : '20px'), `${g.radius} ${g.pad}`);
        check(vp.w, 'companies: table scrolls only inside .table-scroll wrapper', g.wrapOverflowX !== 'visible' && g.wrapW <= g.vw, JSON.stringify({ o: g.wrapOverflowX, w: g.wrapW, scrolls: g.wrapScrolls }));
        if (vp.w === 360) check(vp.w, 'companies: at 360 the table actually scrolls inside its wrapper (not the page)', g.wrapScrolls, '');
        check(vp.w, 'companies: sticky table header', g.thPos === 'sticky', g.thPos);
        check(vp.w, 'companies: active tab blue-50 bg, blue-700 text, blue-600 underline', g.active === 'rgb(29, 78, 216)|rgb(234, 241, 255)|rgb(37, 99, 235)', g.active);
        check(vp.w, 'companies: aria-pressed on tabs', g.pressed === 'true,false', g.pressed);
        check(vp.w, 'companies: tab height >=44', g.tabH >= 44, g.tabH);
        check(vp.w, 'companies: row data rendered (name/tax/status labels)', g.rows[0][1] === 'Alpha Logistics LLC' && g.rows[0][3] === 'Active' && g.rows[1][3] === 'Not Active' && g.rows[1][2] === '405987654', JSON.stringify(g.rows[0]));
        check(vp.w, 'companies: Approve disabled only for Active rows', JSON.stringify(g.act) === '[true,false,false,true]', JSON.stringify(g.act));
        check(vp.w, 'companies: enabled Approve is solid success green w/ white text', g.approveBg === 'rgb(22, 101, 52)' && g.approveColor === 'rgb(255, 255, 255)', `${g.approveBg} ${g.approveColor}`);
        check(vp.w, 'companies: status badges are text-labelled (Active green-on-tint, Not Active neutral)', g.st[0].c === 'rgb(22, 101, 52)' && g.st[1].bg === 'rgb(244, 247, 251)', JSON.stringify(g.st.slice(0, 2)));
        // focus ring on dashboard controls
        await focusRing(page, vp, 'companies/tab button', '.tabs button:nth-child(2)');
        await focusRing(page, vp, 'companies/Approve button', 'tbody tr:nth-child(2) button');
        await focusRing(page, vp, 'companies/name filter', '.filters input');
        await focusRing(page, vp, 'companies/Clear filter button', '.filters button');
        // filters
        const fl = await page.evaluate(() => { const l = [...document.querySelectorAll('.filters label')].map(x => x.firstChild.textContent.trim()); const f = document.querySelector('.filters'); const items = [...f.querySelectorAll('input,select,button')].map(e => e.getBoundingClientRect()); return { l, stacked: new Set(items.map(r => Math.round(r.top))).size === items.length, widths: items.map(r => Math.round(r.width)), vw: innerWidth, parents: [...f.querySelectorAll('input,select,button')].map(e => { const p = e.parentElement; const ps = getComputedStyle(p); return Math.round(p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)); }) }; });
        check(vp.w, 'companies: filter labels Name/Tax Code/Status', fl.l.join(',') === 'Name,Tax Code,Status', fl.l.join(','));
        if (vp.w < 768) check(vp.w, 'companies: filters stack full-width on mobile', fl.stacked && new Set(fl.widths).size === 1 && fl.widths.every((w, i) => Math.abs(w - fl.parents[i]) <= 1), JSON.stringify(fl));
        await page.fill('.filters input >> nth=0', 'beta'); await page.waitForTimeout(100);
        check(vp.w, 'companies filter: name "beta" -> 1 row', await page.locator('tbody tr').count() === 1, '');
        await page.fill('.filters input >> nth=0', ''); await page.fill('.filters input >> nth=1', '2111');
        check(vp.w, 'companies filter: tax code "2111" -> Gamma only', (await page.locator('tbody tr').allInnerTexts()).join().includes('Gamma') && await page.locator('tbody tr').count() === 1, '');
        await page.fill('.filters input >> nth=1', ''); await page.selectOption('.filters select', '1');
        check(vp.w, 'companies filter: status Active -> 2 rows', await page.locator('tbody tr').count() === 2, '');
        await page.fill('.filters input >> nth=0', 'zzzz');
        await page.waitForSelector('.muted'); const em = await page.textContent('.muted');
        check(vp.w, 'companies filter: empty result copy "No companies found."', em.trim() === 'No companies found.', em);
        await shot(page, vp, 'dashboard-companies', 'filter-no-results'); await audit(page, vp, 'companies/filter-empty');
        await page.click('text=Clear filter'); check(vp.w, 'companies filter: Clear filter restores 4 rows', await page.locator('tbody tr').count() === 4, '');
        // approve
        await page.click('tbody tr:nth-child(2) button'); await page.waitForSelector('.toast--success');
        await shot(page, vp, 'dashboard-companies', 'approve-success-toast', false);
        check(vp.w, 'companies approve: PATCH /Company/Approve?companyId=2&rowVersion=12', st.calls.includes('PATCH /Company/Approve?companyId=2&rowVersion=12'), st.calls.filter(c => /Approve/.test(c)).join());
        await page.waitForFunction(() => document.querySelectorAll('tbody tr')[1].querySelector('.status').textContent.trim() === 'Active');
        check(vp.w, 'companies approve: success toast text + list reloaded (row now Active, button disabled)', (await page.textContent('.toast__message')).trim() === 'Company approved successfully.' && await page.$eval('tbody tr:nth-child(2) button', b => b.disabled), '');
        const tt = await page.evaluate(() => { const t = document.querySelector('.toast'); const r = t.getBoundingClientRect(); const rows = document.querySelector('tbody').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, bar: getComputedStyle(t).borderLeftColor, vw: innerWidth, vh: innerHeight }; });
        check(vp.w, 'companies approve: success toast within viewport, green left bar', tt.l >= 0 && tt.r <= tt.vw && tt.b <= tt.vh && tt.bar.includes('22, 101, 52'), JSON.stringify(tt));
        await ctx.close();
      }
      // ---- companies conflict error toast
      {
        const st = newState(); st.approveMode = 'conflict'; const { ctx, page } = await newPage(browser, vp, 'companies-conflict', st, { expectErr: true });
        await login(page, vp); await page.waitForSelector('table.grid');
        await page.click('tbody tr:nth-child(2) button'); await page.waitForSelector('.toast--error');
        check(vp.w, 'companies approve conflict(409): error toast shows API message', (await page.textContent('.toast__message')).trim() === 'Company was modified by another user.', '');
        await shot(page, vp, 'dashboard-companies', 'approve-error-toast', false);
        check(vp.w, 'companies approve conflict: row stays Not Active', (await page.textContent('tbody tr:nth-child(2) .status')).trim() === 'Not Active', '');
        await ctx.close();
      }
      // ---- empty-body 500 -> readable nonempty toast
      {
        const st = newState(); st.login = '500'; const { ctx, page } = await newPage(browser, vp, 'login-500-empty', st, { expectErr: true });
        await page.goto(BASE + '/login'); await page.waitForSelector('form.auth-form'); await page.fill('input[name=userName]', 'a'); await page.fill('input[name=password]', 'b'); await page.click('button[type=submit]'); await page.waitForSelector('.toast--error');
        const m = (await page.textContent('.toast__message')).trim();
        check(vp.w, 'login 500 empty body: toast is nonempty readable English fallback', m.length > 5 && !/undefined|null|object Object/.test(m), m);
        await shot(page, vp, 'login', 'error-500-empty-toast', false); await ctx.close();
      }
      {
        const st = newState(); st.approveMode = 'e500'; const { ctx, page } = await newPage(browser, vp, 'approve-500-empty', st, { expectErr: true });
        await login(page, vp); await page.waitForSelector('table.grid'); await page.click('tbody tr:nth-child(2) button'); await page.waitForSelector('.toast--error');
        const m = (await page.textContent('.toast__message')).trim();
        check(vp.w, 'company approve 500 empty body: toast nonempty fallback', m.length > 5 && !/undefined|null/.test(m), m); await ctx.close();
      }
      // ---- companies loading / empty / error+retry
      {
        const st = newState(); st.companiesDelay = 1500; const { ctx, page } = await newPage(browser, vp, 'companies-loading', st);
        await page.goto(BASE + '/login'); await page.fill('input[name=userName]', 'a'); await page.fill('input[name=password]', 'b'); await page.click('button[type=submit]'); await page.waitForURL('**/dashboard');
        await page.waitForSelector('.info'); const t = (await page.textContent('.info')).trim();
        check(vp.w, 'companies/loading: "Loading..." status shown (role=status), no table/empty text', t === 'Loading...' && await page.$('table') === null && await page.$('.muted') === null && await page.getAttribute('.info', 'role') === 'status', t);
        await shot(page, vp, 'dashboard-companies', 'loading'); await audit(page, vp, 'companies/loading');
        await ctx.close();
      }
      {
        const st = newState(); st.companiesMode = 'empty'; const { ctx, page } = await newPage(browser, vp, 'companies-empty', st);
        await login(page, vp); await page.waitForSelector('.muted');
        check(vp.w, 'companies/empty: "No companies found." and no table', (await page.textContent('.muted')).trim() === 'No companies found.' && await page.$('table') === null, '');
        await shot(page, vp, 'dashboard-companies', 'empty'); await audit(page, vp, 'companies/empty');
        await ctx.close();
      }
      {
        const st = newState(); st.companiesMode = 'error'; const { ctx, page } = await newPage(browser, vp, 'companies-error', st, { expectErr: true });
        await login(page, vp); await page.waitForSelector('.toast--error');
        const msg = (await page.textContent('.toast__message')).trim();
        check(vp.w, 'companies/error(500): toast "Failed to load companies..." with Retry action', msg.startsWith('Failed to load companies') && await page.$('.toast__action') !== null, msg);
        check(vp.w, 'companies/error: page shows empty state not stale table', (await page.textContent('.muted')).trim() === 'No companies found.', '');
        await shot(page, vp, 'dashboard-companies', 'error-retry-toast');
        const rb = await page.$eval('.toast__action', b => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width }; });
        check(vp.w, 'companies/error: Retry action >=44px tall', rb.h >= 44, JSON.stringify(rb));
        await audit(page, vp, 'companies/error-toast');
        st.companiesMode = 'ok'; await page.click('.toast__action'); await page.waitForSelector('table.grid');
        check(vp.w, 'companies/error: Retry reloads and shows populated table', await page.locator('tbody tr').count() === 4, '');
        await ctx.close();
      }
      // ---- requests tab
      {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'requests', st);
        await login(page, vp); await page.waitForSelector('table.grid');
        await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('table.grid--wide');
        check(vp.w, 'requests: GetAll?CompanyId=-1&status=0 on tab open', st.calls.includes('GET /Request/GetAll?CompanyId=-1&status=0'), st.calls.filter(c => /Request/.test(c)).join());
        await shot(page, vp, 'dashboard-requests', 'populated'); await audit(page, vp, 'requests/populated');
        const g = await page.evaluate(() => {
          const wrap = document.querySelector('.table-scroll'); const rows = [...document.querySelectorAll('tbody tr')].map(r => [...r.querySelectorAll('td')].map(t => t.textContent.trim()));
          const st = [...document.querySelectorAll('tbody .status')].map(s => ({ t: s.textContent.trim(), bg: getComputedStyle(s).backgroundColor, c: getComputedStyle(s).color }));
          return { rows, st, dis: [...document.querySelectorAll('tbody tr')].map(r => r.querySelector('button').disabled), scrolls: wrap.scrollWidth > wrap.clientWidth, wrapW: wrap.getBoundingClientRect().width, tabs: [...document.querySelectorAll('.tabs button')].map(b => b.getAttribute('aria-pressed')).join(), minW: getComputedStyle(document.querySelector('table')).minWidth, filt: [...document.querySelectorAll('.filters label')].map(x => x.firstChild.textContent.trim()).join(), coarse: matchMedia('(pointer: coarse)').matches };
        });
        results.push({ id: 'INFO (pointer: coarse) matches', vp: vp.w, ok: true, detail: String(g.coarse) });
        check(vp.w, 'requests: tab pressed state switches', g.tabs === 'false,true', g.tabs);
        check(vp.w, 'requests: filter labels Company Id/Status', g.filt === 'Company Id,Status', g.filt);
        check(vp.w, 'requests: status labels None/Created/Authorised/Approved shown as text', g.rows.map(r => r[5]).join() === 'Created,Authorised,Approved,None', g.rows.map(r => r[5]).join());
        check(vp.w, 'requests: status badge colors (Created warn, Authorised blue, Approved ok, None neutral)', g.st[0].c === 'rgb(146, 64, 14)' && g.st[1].c === 'rgb(29, 78, 216)' && g.st[2].c === 'rgb(22, 101, 52)' && g.st[3].bg === 'rgb(244, 247, 251)', JSON.stringify(g.st));
        check(vp.w, 'requests: Approve enabled only for Authorised (status 2)', JSON.stringify(g.dis) === '[true,false,true,true]', JSON.stringify(g.dis));
        check(vp.w, 'requests: null company/product render empty not "null"', !/null|undefined/.test(g.rows[3].join()), g.rows[3].join('|'));
        check(vp.w, 'requests: dash placeholder for missing authorize/approve dates', g.rows[0][6] === '-' && g.rows[0][7] === '-', g.rows[0].join('|'));
        check(vp.w, 'requests: wide table scrolls inside wrapper (<=1440 min 960)', g.wrapW <= vp.w && (vp.w >= 1168 || g.scrolls), JSON.stringify({ w: g.wrapW, s: g.scrolls }));
        // filters
        await page.selectOption('.filters select', '2'); await page.waitForTimeout(300);
        check(vp.w, 'requests filter: status Authorised -> refetch status=2, 1 row', st.calls.includes('GET /Request/GetAll?CompanyId=-1&status=2') && await page.locator('tbody tr').count() === 1, st.calls.filter(c => /Request/.test(c)).join());
        await page.fill('.filters input[type=number]', '4'); await page.press('.filters input[type=number]', 'Enter'); await page.waitForTimeout(300);
        check(vp.w, 'requests filter: Company Id + Enter -> CompanyId=4&status=2 sent', st.calls.includes('GET /Request/GetAll?CompanyId=4&status=2'), st.calls.filter(c => /Request/.test(c)).join());
        await page.waitForSelector('.muted'); check(vp.w, 'requests filter: empty copy "No requests found."', (await page.textContent('.muted')).trim() === 'No requests found.', '');
        await shot(page, vp, 'dashboard-requests', 'filter-no-results'); await audit(page, vp, 'requests/filter-empty');
        await page.click('text=Clear filter'); await page.click('.filters >> text=Refresh'); await page.waitForSelector('table.grid--wide');
        check(vp.w, 'requests filter: Clear + Refresh -> all 4 rows', await page.locator('tbody tr').count() === 4, '');
        await focusRing(page, vp, 'requests/Company Id input', '.filters input[type=number]');
        // approve
        await page.click('tbody tr:nth-child(2) button'); await page.waitForSelector('.toast--success');
        await shot(page, vp, 'dashboard-requests', 'approve-success-toast', false);
        check(vp.w, 'requests approve: POST /Request/Approve?requestId=102&rowVersion=2', st.calls.includes('POST /Request/Approve?requestId=102&rowVersion=2'), st.calls.filter(c => /Approve/.test(c)).join());
        await page.waitForFunction(() => document.querySelectorAll('tbody tr')[1].querySelector('.status').textContent.trim() === 'Approved');
        check(vp.w, 'requests approve: toast text + row becomes Approved/disabled', (await page.textContent('.toast__message')).trim() === 'Request approved successfully.' && await page.$eval('tbody tr:nth-child(2) button', b => b.disabled), '');
        await ctx.close();
      }
      {
        const st = newState(); st.requestsMode = 'empty'; const { ctx, page } = await newPage(browser, vp, 'requests-empty', st);
        await login(page, vp); await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('.muted');
        check(vp.w, 'requests/empty: "No requests found."', (await page.textContent('.muted')).trim() === 'No requests found.', '');
        await shot(page, vp, 'dashboard-requests', 'empty'); await audit(page, vp, 'requests/empty'); await ctx.close();
      }
      {
        const st = newState(); st.requestsMode = 'error'; const { ctx, page } = await newPage(browser, vp, 'requests-error', st, { expectErr: true });
        await login(page, vp); await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('.toast--error');
        check(vp.w, 'requests/error(500): toast "Failed to load requests..." with Retry', (await page.textContent('.toast__message')).trim().startsWith('Failed to load requests') && await page.$('.toast__action') !== null, '');
        await shot(page, vp, 'dashboard-requests', 'error-retry-toast'); await audit(page, vp, 'requests/error-toast');
        st.requestsMode = 'ok'; await page.click('.toast__action'); await page.waitForSelector('table.grid--wide'); check(vp.w, 'requests/error: Retry works', await page.locator('tbody tr').count() === 4, ''); await ctx.close();
      }
      {
        const st = newState(); st.approveMode = 'conflict'; const { ctx, page } = await newPage(browser, vp, 'requests-conflict', st, { expectErr: true });
        await login(page, vp); await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('table.grid--wide');
        await page.click('tbody tr:nth-child(2) button'); await page.waitForSelector('.toast--error');
        check(vp.w, 'requests approve conflict(409): error toast shows API message', (await page.textContent('.toast__message')).trim() === 'Request was modified by another user.', '');
        await ctx.close();
      }
      // ---- confirm dialog (not reachable from template: deleteRequest has no button) -> invoked through Angular dev-mode debug API
      if (MODE === 'dev') {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'confirm', st);
        await login(page, vp); await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('table.grid--wide');
        // capture the Angular zone by patching setTab on the instance, then clicking a tab (template calls ctx.setTab)
        await page.evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-admin-dashboard')); const orig = c.setTab; c.setTab = function () { window.__ngZone = Zone.current; c.setTab = orig; }; });
        await page.click('.tabs button:nth-child(2)');
        const open = () => page.evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-admin-dashboard')); window.__ngZone.run(() => { c.deleteRequest(c.requests[0]); }); });
        await page.focus('.tabs button:nth-child(2)');
        await open(); await page.waitForSelector('.dialog');
        await shot(page, vp, 'confirm-dialog', 'delete-request');
        const d = await page.evaluate(() => {
          const dl = document.querySelector('.dialog'); const r = dl.getBoundingClientRect(); const s = getComputedStyle(dl); const bd = getComputedStyle(document.querySelector('.dialog-backdrop'));
          const bs = [...dl.querySelectorAll('button')].map(b => { const x = b.getBoundingClientRect(); return { t: b.textContent.trim(), h: x.height, w: x.width, top: x.top, bg: getComputedStyle(b).backgroundColor, c: getComputedStyle(b).color }; });
          return { role: dl.getAttribute('role'), modal: dl.getAttribute('aria-modal'), lab: document.getElementById(dl.getAttribute('aria-labelledby'))?.textContent, desc: document.getElementById(dl.getAttribute('aria-describedby'))?.textContent, focus: document.activeElement.textContent.trim(), radius: s.borderTopLeftRadius, bd: bd.backgroundColor, blur: bd.backdropFilter, bs, l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight, z: bd.zIndex, msg: dl.querySelector('.dialog__message').textContent };
        });
        check(vp.w, 'confirm: role=alertdialog aria-modal, labelled + described', d.role === 'alertdialog' && d.modal === 'true' && d.lab === 'Delete Request' && /request #101/.test(d.desc), JSON.stringify([d.role, d.modal, d.lab]));
        check(vp.w, 'confirm: initial focus on Cancel (safe default)', d.focus === 'Cancel', d.focus);
        check(vp.w, 'confirm: radius 16, backdrop ink 50% without blur', d.radius === '16px' && d.bd === 'rgba(23, 32, 51, 0.5)' && (d.blur === 'none' || !d.blur), `${d.radius} ${d.bd} ${d.blur}`);
        check(vp.w, 'confirm: fits viewport', d.l >= 0 && d.r <= d.vw && d.t >= 0 && d.b <= d.vh, JSON.stringify([d.l, d.r, d.t, d.b]));
        const del = d.bs.find(b => b.t === 'Delete'), can = d.bs.find(b => b.t === 'Cancel');
        check(vp.w, 'confirm: Delete is solid danger #B91C1C white text; Cancel neutral; both >=44px', del.bg === 'rgb(185, 28, 28)' && del.c === 'rgb(255, 255, 255)' && can.bg === 'rgb(255, 255, 255)' && del.h >= 44 && can.h >= 44, JSON.stringify(d.bs));
        if (vp.w < 480) check(vp.w, 'confirm: buttons stack full-width, primary action first on mobile', del.top < can.top && del.w > vp.w - 100, JSON.stringify(d.bs));
        await audit(page, vp, 'confirm/open');
        check(vp.w, 'confirm: background scroll locked while open (body overflow hidden)', await page.evaluate(() => getComputedStyle(document.body).overflow) === 'hidden', '');
        await page.keyboard.press('Shift+Tab'); const fs1 = await page.evaluate(() => document.activeElement.textContent.trim()); await page.keyboard.press('Shift+Tab'); const fs2 = await page.evaluate(() => document.activeElement.textContent.trim());
        check(vp.w, 'confirm: Shift+Tab trapped inside dialog', ['Cancel','Delete'].includes(fs1) && ['Cancel','Delete'].includes(fs2) && fs1 !== fs2, fs1 + ' ' + fs2);
        await page.focus('.dialog .btn--secondary');
        await page.keyboard.press('Tab'); const f1 = await page.evaluate(() => document.activeElement.textContent.trim()); await page.keyboard.press('Tab'); const f2 = await page.evaluate(() => document.activeElement.textContent.trim());
        check(vp.w, 'confirm: Tab trapped inside dialog (Cancel->Delete->Cancel)', f1 === 'Delete' && f2 === 'Cancel', `${f1} ${f2}`);
        await focusRing(page, vp, 'confirm/Cancel button', '.dialog .btn--secondary');
        await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        check(vp.w, 'confirm: Escape closes, no DELETE sent', await page.$('.dialog') === null && !st.calls.some(c => c.startsWith('DELETE')), '');
        const rf = await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 20));
        check(vp.w, 'confirm: focus returns to opener (Requests tab) after Escape', rf === 'Requests', rf);
        check(vp.w, 'confirm: body scroll restored after close', await page.evaluate(() => getComputedStyle(document.body).overflow) !== 'hidden', '');
        await open(); await page.waitForSelector('.dialog'); await page.mouse.click(3, 3); await page.waitForTimeout(150);
        check(vp.w, 'confirm: backdrop click closes, no DELETE sent', await page.$('.dialog') === null && !st.calls.some(c => c.startsWith('DELETE')), '');
        check(vp.w, 'confirm: focus returns to opener after backdrop close', await page.evaluate(() => document.activeElement.textContent.trim()) === 'Requests', '');
        await open(); await page.waitForSelector('.dialog'); await page.click('.dialog .btn--danger');
        await page.waitForSelector('.toast--success');
        check(vp.w, 'confirm: Delete -> DELETE /Request/Delete?requestId=101&rowVersion=1 + toast "Request deleted."', st.calls.includes('DELETE /Request/Delete?requestId=101&rowVersion=1') && (await page.textContent('.toast__message')).trim() === 'Request deleted.', st.calls.filter(c => /Delete/.test(c)).join());
        await ctx.close();
      }
      // ---- realistic (short) data: does the Actions column fit without horizontal scroll?
      {
        const st = newState(); st.requests.forEach(r => { r.companyName = r.companyName ? 'Acme Ltd' : null; r.productName = r.productName ? 'Fuel 50' : null; }); st.companies.forEach(c => { c.name = 'Acme Ltd ' + c.id; });
        const { ctx, page } = await newPage(browser, vp, 'short-data', st);
        await login(page, vp); await page.click('.tabs button:nth-child(2)'); await page.waitForSelector('table.grid--wide');
        const m = await page.evaluate(() => { const w = document.querySelector('.table-scroll'); const last = document.querySelector('thead th:last-child').getBoundingClientRect(); return { scrollW: w.scrollWidth, clientW: w.clientWidth, actionsVisible: last.right <= w.getBoundingClientRect().right + 1 }; });
        await shot(page, vp, 'dashboard-requests', 'short-data');
        results.push({ id: 'INFO requests short-data: wrapper scrollWidth/clientWidth, Actions column visible without scrolling', vp: vp.w, ok: true, detail: JSON.stringify(m) });
        if (vp.w >= 1440) check(vp.w, 'requests (short data, desktop 1440): Actions column visible without horizontal scroll', m.actionsVisible, JSON.stringify(m));
        await ctx.close();
      }
      // ---- keyboard tab order overall on dashboard
      {
        const st = newState(); const { ctx, page } = await newPage(browser, vp, 'tab-order', st);
        await login(page, vp); await page.waitForSelector('table.grid');
        await page.evaluate(() => document.activeElement.blur()); await page.mouse.click(1, 1);
        const seq = []; for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); const vis = s.boxShadow !== 'none' || (s.outlineStyle !== 'none' && s.outlineWidth !== '0px'); return `${(e.textContent || e.name || e.tagName).trim().split('\n')[0].trim().slice(0, 16)}${vis ? '' : '(NOFOCUS)'}`; })); }
        check(vp.w, 'dashboard tab order logical (tabs -> filters -> Approve buttons) & every stop shows focus', !seq.some(s => s.includes('NOFOCUS')) && seq[0] === 'Companies' && seq[1] === 'Requests', seq.join(' > '));
        await ctx.close();
      }
    }
    // ---- prod: smoke only handled by same run with MODE=prod
  } finally {
    await browser0.close();
    stopServer();
  }
}

run().then(() => finish(), e => { console.error('HARNESS ERROR', e); stopServer(); results.push({ id: 'HARNESS ERROR ' + e.message, vp: 0, ok: false, detail: e.stack.slice(0, 300) }); finish(); });

function finish() {
  const fails = results.filter(r => !r.ok);
  const unexpected = consoleLog.filter(c => !c.expected);
  const out = { mode: MODE, total: results.length, passed: results.length - fails.length, failed: fails.length, results, console: consoleLog, unexpectedConsole: unexpected.length, blocked, apiCalls: [...new Set(apiCalls)], shots: fs.readdirSync(SHOTS).length };
  fs.writeFileSync(path.join(OUT, `results-${MODE}.json`), JSON.stringify(out, null, 1));
  console.log(`\n[${MODE}] assertions: ${out.passed}/${out.total} passed, ${out.failed} failed; console/page errors total=${consoleLog.length} unexpected=${unexpected.length}; blocked remote=${blocked.length}; screenshots=${out.shots}`);
  for (const f of fails) console.log(`FAIL [${f.vp}] ${f.id} :: ${f.detail.slice(0, 200)}`);
  for (const c of unexpected.slice(0, 15)) console.log(`CONSOLE ${c.scenario} ${c.type}: ${c.text.slice(0, 160)}`);
  const uniqBlocked = [...new Set(blocked)]; for (const b of uniqBlocked.slice(0, 10)) console.log('BLOCKED', b);
  process.exit(0);
}
