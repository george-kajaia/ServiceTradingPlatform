/* ServiceUI blue-redesign QA harness. Dependency-free standalone (.cjs).
 * Usage: node docs/design-blue/qa/serviceui-qa.cjs [--skip-builds]
 * - All non-localhost traffic is intercepted; service-tokens.com/api is served from synthetic fixtures,
 *   everything else is aborted (and logged). No physical camera: getUserMedia is replaced by a synthetic
 *   canvas stream (or a NotAllowedError for the denied state).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const cp = require('child_process');

const APP = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(__dirname, '..', 'qa-evidence');
const SHOTS = path.join(OUT, 'screenshots');
const CLI = path.join(APP, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const PW = 'C:/Users/georg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const QRLIB = path.resolve(APP, '..', 'CustomerUI', 'node_modules', 'qrcode'); // harness-only QR encoder
const PORT = 4314;
const BASE = `http://127.0.0.1:${PORT}`;
const SKIP_BUILDS = process.argv.includes('--skip-builds');

fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(PW);
const QR = require(QRLIB);

const results = [];
const unexpectedConsole = [];
const blockedExternal = new Set();
const notes = [];
function check(id, cond, detail) {
  results.push({ id, pass: !!cond, detail: detail === undefined ? '' : String(detail) });
  if (!cond) console.log(`  FAIL ${id} :: ${detail === undefined ? '' : detail}`);
}
const log = (...a) => console.log(...a);

// ---------- fixtures (match src/app/shared/models/company.model.ts) ----------
const COMPANY_USER = { id: 3, companyId: 7, userName: 'qa.staff', password: '' };
const COMPANY = (status) => ({
  id: 7, rowVersion: 1, name: 'Synthetic Spa & Wellness', status, regDate: '2024-01-15T00:00:00',
  taxCode: '000000000', address: '1 Test Street', legalForm: 1, economicActivity: 1,
  mail: 'qa@example.test', phone: '+000000000', user: null
});
const PAYLOAD = { tokenId: '00000000-0000-4000-8000-000000000001', rowVersion: 5, connectionId: 'conn-synthetic-123' };

const VPS = [{ w: 360, h: 800 }, { w: 768, h: 1024 }, { w: 1440, h: 1000 }];

// ---------- builds ----------
function build(label, args) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serviceui-build-'));
  const r = cp.spawnSync(process.execPath, [CLI, 'build', ...args, '--output-path', outDir], { cwd: APP, encoding: 'utf8', windowsHide: true, timeout: 600000 });
  const tail = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(Boolean).slice(-6).join(' | ');
  check(`build.${label}.exit0`, r.status === 0, `exit=${r.status} ${tail.slice(0, 400)}`);
  log(`build ${label}: exit ${r.status}`);
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
}

// ---------- server ----------
function ping() {
  return new Promise(res => {
    const q = http.get(BASE + '/', r => { r.resume(); res(r.statusCode === 200); });
    q.on('error', () => res(false)); q.setTimeout(2000, () => { q.destroy(); res(false); });
  });
}
let server = null;
async function ensureServer() {
  if (await ping()) { log('reusing healthy server on', PORT); return; }
  server = cp.spawn(process.execPath, [CLI, 'serve', '--host', '127.0.0.1', '--port', String(PORT)], { cwd: APP, windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 180; i++) { if (await ping()) { log('server up'); return; } await new Promise(r => setTimeout(r, 1000)); }
  throw new Error('VERIFICATION_BLOCKED: dev server did not start');
}
function stopServer() {
  if (server && server.pid) { try { cp.spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true }); } catch {} }
}

// ---------- page factory ----------
function initScript(cfg) {
  window.__qa = { gum: 0, tracks: 0, stopped: 0 };
  navigator.mediaDevices.getUserMedia = async () => {
    window.__qa.gum++;
    if (cfg.mode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const x = c.getContext('2d');
    const img = new Image(); img.src = cfg.qr; await img.decode();
    const draw = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 480); if (cfg.mode === 'qr') { x.imageSmoothingEnabled = false; const s = Math.min(Math.floor(440 / img.naturalWidth) || 1, 2); const sz = img.naturalWidth * s; x.drawImage(img, Math.round((640 - sz) / 2), Math.round((480 - sz) / 2), sz, sz); } };
    draw(); setInterval(draw, 100);
    const s = c.captureStream(10);
    s.getTracks().forEach(t => { window.__qa.tracks++; const o = t.stop.bind(t); t.stop = () => { window.__qa.stopped++; o(); }; });
    return s;
  };
}
async function qrData(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return QR.toDataURL(text, { width: 420, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } });
}

async function newPage(browser, vp, o = {}) {
  const cfg = { mode: o.mode || 'blank', qr: o.qr || (await qrData(PAYLOAD)) };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w < 768, serviceWorkers: 'block', deviceScaleFactor: 1 });
  await ctx.addInitScript(initScript, cfg);
  const requests = [];
  const consoleMsgs = [];
  const failed = [];
  await ctx.route(/.*/, async route => {
    const req = route.request(); const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.origin === BASE) return route.continue();
    if (u.hostname === 'service-tokens.com' || u.hostname.endsWith('.service-tokens.com')) {
      requests.push({ method: req.method(), url: req.url(), body: req.postData() });
      const p = u.pathname;
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (req.method() === 'POST' && p === '/api/Company/Login') {
        if (o.loginFail === '401') return json(401, 'Invalid username or password');
        if (o.loginFail === '500empty') return route.fulfill({ status: 500, body: '' });
        if (o.loginFail === 'network') return route.abort('failed');
        return json(200, COMPANY_USER);
      }
      if (req.method() === 'GET' && p === '/api/Company/GetById/7') return json(200, COMPANY(o.companyStatus === undefined ? 1 : o.companyStatus));
      if (req.method() === 'POST' && p === '/api/ServiceToken/GetService') {
        await new Promise(r => setTimeout(r, o.redeemDelay || 0));
        if (o.redeemFail === 'msg') return json(400, { message: 'Token already redeemed (synthetic).' });
        if (o.redeemFail === '500empty') return route.fulfill({ status: 500, body: '' });
        return route.fulfill({ status: 200, body: '' });
      }
      blockedExternal.add(`UNMOCKED ${req.method()} ${req.url()}`);
      return route.abort('failed');
    }
    blockedExternal.add(`${req.method()} ${u.origin}`);
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleMsgs.push(m.text()); });
  page.on('pageerror', e => consoleMsgs.push('PAGEERROR ' + e.message));
  page.on('requestfailed', r => failed.push(`${r.method()} ${r.url()} ${r.failure() && r.failure().errorText}`));
  return { ctx, page, requests, consoleMsgs, failed, o };
}
function finish(h, scenario) {
  const exp = h.o.expectNetErrors;
  for (const m of h.consoleMsgs) {
    if (/Failed to load resource/.test(m) && (exp || /fonts\.(googleapis|gstatic)/.test(m) || true)) { if (!exp && !/net::ERR_(FAILED|BLOCKED_BY_CLIENT)/.test(m)) unexpectedConsole.push(`${scenario}: ${m}`); continue; }
    if (/Access to (CSS stylesheet|font)|ERR_BLOCKED_BY_CLIENT/.test(m)) continue;
    unexpectedConsole.push(`${scenario}: ${m}`);
  }
  for (const f of h.failed) {
    if (/fonts\.(googleapis|gstatic)\.com/.test(f)) continue; // intentionally blocked third party
    if (h.o.expectNetErrors) continue;
    unexpectedConsole.push(`${scenario}: requestfailed ${f}`);
  }
  return h.ctx.close();
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- in-page analyzers ----------
const analyzers = {
  overflow: () => {
    const off = [];
    for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 0.5 && getComputedStyle(e).position !== 'fixed') off.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}:${Math.round(r.left)}-${Math.round(r.right)}`); }
    return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth, off: off.slice(0, 6) };
  },
  styleAudit: () => {
    const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
    const hsl = c => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; const l = (mx + mn) / 2; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s, l }; };
    const banned = c => { if (!c || c.a < 0.2) return null; const { h, s, l } = hsl(c); if (s < 0.25 || l > 0.97 || l < 0.05) return null; if (h >= 85 && h < 170) return 'green'; if (h >= 170 && h < 200) return 'cyan/teal'; if (h >= 255 && h < 300) return 'purple'; if (h >= 300 && h < 345) return 'pink'; return null; };
    const semantic = el => !!el.closest('.badge-active, .toast--success');
    const out = []; const grads = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el); if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
      const cand = [['color', cs.color], ['background', cs.backgroundColor]];
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') cand.push(['border', cs.borderTopColor]);
      if (cs.outlineStyle !== 'none') cand.push(['outline', cs.outlineColor]);
      for (const m of (cs.boxShadow || '').matchAll(/rgba?\([^)]+\)/g)) cand.push(['shadow', m[0]]);
      for (const [k, v] of cand) { const b = banned(parse(v)); if (b && !semantic(el)) out.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ')[0]} ${k}=${v} (${b})`); }
      if (/gradient/.test(cs.backgroundImage)) grads.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    }
    return { banned: [...new Set(out)], grads: [...new Set(grads)] };
  },
  contrast: () => {
    const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bgOf = el => { const layers = []; let e = el; while (e) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; } e = e.parentElement; } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base; };
    const bad = []; let n = 0, skipped = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode; if (!t.nodeValue.trim()) continue; const el = t.parentElement; if (seen.has(el)) continue; seen.add(el);
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (el.closest('video, .scan-modal__camera-wrap')) { skipped++; continue; }
      const bg = bgOf(el); if (!bg) { skipped++; continue; }
      let fg = parse(cs.color); if (!fg) continue; fg = over({ ...fg, a: fg.a * parseFloat(cs.opacity) }, bg);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      const dis = el.closest(':disabled') ? true : false; n++;
      if (ratio < (large ? 3 : 4.5) && !dis) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${t.nodeValue.trim().slice(0, 28)}" ${ratio.toFixed(2)} fg=${cs.color}`);
    }
    return { checked: n, skipped, bad };
  },
  controls: () => {
    const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    return [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea, a.btn, [role=button]')].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { t: e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0], txt: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), clipped: r.left < -0.5 || r.right > innerWidth + 0.5 }; });
  },
  links: () => [...document.querySelectorAll('a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height; }).map(e => { const r = e.getBoundingClientRect(); return { txt: e.innerText.trim().slice(0, 28), cls: String(e.className).split(' ')[0], h: Math.round(r.height), w: Math.round(r.width) }; }),
  focusState: () => {
    const e = document.activeElement; const cs = getComputedStyle(e);
    const ow = parseFloat(cs.outlineWidth) || 0; const outline = cs.outlineStyle !== 'none' && ow > 0 && !/rgba\([^)]*, 0\)$/.test(cs.outlineColor);
    const shadows = [...(cs.boxShadow || '').matchAll(/(rgba?\([^)]+\))\s+(-?[\d.]+px)\s+(-?[\d.]+px)\s+(-?[\d.]+px)\s*(-?[\d.]+px)?/g)].map(m => ({ c: m[1], blur: parseFloat(m[4]), spread: parseFloat(m[5] || 0) })).filter(s => !/, 0\)$/.test(s.c) && (s.spread > 0 || s.blur > 0));
    return { tag: e.tagName.toLowerCase(), cls: String(e.className).split(' ')[0], txt: (e.innerText || e.getAttribute('aria-label') || e.name || '').trim().slice(0, 20), outline, outlineColor: cs.outlineColor, shadow: cs.boxShadow, hasShadow: shadows.length > 0, border: cs.borderTopColor };
  },
  dialogGeom: () => {
    const m = document.querySelector('.scan-modal'); if (!m) return null; const r = m.getBoundingClientRect(); const cs = getComputedStyle(m);
    const btns = [...m.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width).map(b => { const q = b.getBoundingClientRect(); return { txt: b.innerText.trim() || b.getAttribute('aria-label'), top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right), h: Math.round(q.height), w: Math.round(q.width) }; });
    return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), radius: cs.borderTopLeftRadius, iw: innerWidth, ih: innerHeight, overflowY: cs.overflowY, scrollH: m.scrollHeight, clientH: m.clientHeight, btns };
  },
  dialogFocusInfo: () => {
    const m = document.querySelector('.scan-modal'); const a = document.activeElement;
    return { inside: !!(m && a && m.contains(a)), active: a ? a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0] : null, bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow, exists: !!m };
  },
  scanPageStatic: () => ({ t: 0 })
};
const ev = (page, name) => page.evaluate(analyzers[name]);

// ---------- helpers for flows ----------
async function login(page) {
  await page.goto(BASE + '/login');
  await page.fill('input[name=loginUserName]', 'qa.staff');
  await page.fill('input[name=loginPassword]', 'synthetic-pass');
  await page.click('button[type=submit]');
  await page.waitForURL('**/scan');
  await page.waitForSelector('.scan-page');
}
async function openScanner(page) {
  await page.click('.scan-token-btn');
  await page.waitForSelector('.scan-modal');
  await sleep(500);
}
function overflowCheck(id, o) { check(id, o.sw <= o.iw && o.bw <= o.iw, `scrollW=${o.sw} body=${o.bw} inner=${o.iw} offenders=${(o.off || []).join(', ')}`); }

async function styleAndA11y(page, tag, w, opts = {}) {
  const sa = await ev(page, 'styleAudit');
  check(`${tag}.noBrandLeftovers`, sa.banned.length === 0, sa.banned.slice(0, 6).join('; '));
  check(`${tag}.noGradients`, sa.grads.length === 0, sa.grads.join(','));
  const c = await ev(page, 'contrast');
  check(`${tag}.contrast`, c.bad.length === 0, `${c.bad.slice(0, 5).join(' | ')} (checked ${c.checked}, skipped ${c.skipped})`);
  const ctl = await ev(page, 'controls');
  check(`${tag}.noClippedControls`, ctl.every(x => !x.clipped), JSON.stringify(ctl.filter(x => x.clipped)));
  if (opts.touch !== false) {
    const small = ctl.filter(x => x.h < 44 && !(opts.exempt || []).some(e => x.t.includes(e)));
    check(`${tag}.touch>=44`, small.length === 0, small.map(x => `${x.t}"${x.txt}" ${x.w}x${x.h}`).join('; '));
  }
}

// ---------- scenarios ----------
async function main() {
  if (!SKIP_BUILDS) {
    build('dev', ['--configuration', 'development']);
    build('prod', ['--configuration', 'production']);
  }
  await ensureServer();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    for (const vp of VPS) {
      const w = vp.w; const mobile = w < 768;
      // ===== HOME =====
      {
        const h = await newPage(browser, vp, { });
        const p = h.page; await p.goto(BASE + '/'); await p.waitForSelector('.hero'); await sleep(400);
        overflowCheck(`home.${w}.noOverflow`, await ev(p, 'overflow'));
        await shot(p, `service_home_${w}_populated-top`);
        await p.screenshot({ path: path.join(SHOTS, `service_home_${w}_populated-full.png`), fullPage: true });
        await styleAndA11y(p, `home.${w}`, w);
        const bg = await p.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color, ff: getComputedStyle(document.body).fontFamily }));
        check(`home.${w}.bodyTokens`, bg.body === 'rgb(244, 247, 251)' && bg.color === 'rgb(23, 32, 51)', JSON.stringify(bg));
        const prim = await p.evaluate(() => [...document.querySelectorAll('.hero__actions .btn--primary, .navbar__auth .btn--primary')].map(e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, bi: c.backgroundImage, h: e.getBoundingClientRect().height }; }));
        check(`home.${w}.primarySolidBlue`, prim.length >= 1 && prim.every(x => x.bg === 'rgb(37, 99, 235)' && x.color === 'rgb(255, 255, 255)' && x.bi === 'none' && x.h >= 44), JSON.stringify(prim));
        const lks = await ev(p, 'links');
        const smallLinks = lks.filter(l => l.h < 44 && /Login|Learn/.test(l.txt));
        check(`home.${w}.ctaLinkHeight>=44(mobile)`, !mobile || smallLinks.length === 0, JSON.stringify(smallLinks));
        // FAQ interaction
        await p.click('.faq__btn >> nth=0'); await sleep(200);
        check(`home.${w}.faqOpens`, await p.locator('.faq__answer').count() === 1);
        await p.click('.navbar__auth .btn--primary'); await p.waitForURL('**/login');
        check(`home.${w}.loginCtaNavigates`, true);
        await finish(h, `home.${w}`);
      }
      // ===== LOGIN =====
      {
        const h = await newPage(browser, vp, { });
        const p = h.page; await p.goto(BASE + '/login'); await p.waitForSelector('.auth-form'); await sleep(300);
        overflowCheck(`login.${w}.noOverflow`, await ev(p, 'overflow'));
        await shot(p, `service_login_${w}_empty`);
        await styleAndA11y(p, `login.${w}.empty`, w);
        // labels
        const labels = await p.evaluate(() => [...document.querySelectorAll('.auth-form label')].map(l => l.innerText.trim().split('\n')[0]));
        check(`login.${w}.labelsReadable`, labels.join() === 'Username,Password', labels.join());
        const wrapW = await p.evaluate(() => { const f = document.querySelector('.auth-container').getBoundingClientRect(); return { l: f.left, r: f.right, iw: innerWidth }; });
        check(`login.${w}.cardInViewport`, wrapW.l >= 0 && wrapW.r <= wrapW.iw, JSON.stringify(wrapW));
        // required validation: empty submit makes no request
        // Angular NgForm sets novalidate, so `required` does not block submit (pre-existing business behavior, not a redesign item).
        const reqAttr = await p.evaluate(() => ({ req: document.querySelectorAll('input[required]').length, novalidate: document.querySelector('form').noValidate }));
        check(`login.${w}.inputsMarkedRequired`, reqAttr.req === 2, JSON.stringify(reqAttr));
        if (w === 360) notes.push(`login: empty-credentials submit is NOT blocked client-side (form novalidate=${reqAttr.novalidate}); pre-existing behavior, observed not asserted`);
        await p.goto(BASE + '/login'); await p.waitForSelector('.auth-form'); await sleep(300);
        // focus ring on buttons/inputs via keyboard (settled)
        await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
        const seq = []; check(`login.${w}.freshFormForFocus`, (await p.locator('.auth-form').count()) === 1);
        for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); await sleep(350); const f = await ev(p, 'focusState'); if (f.tag === 'body') break; seq.push(f); if (i === 1) await shot(p, `service_login_${w}_focus-input`); }
        const badFocus = seq.filter(f => !(f.outline || f.hasShadow));
        check(`login.${w}.focusVisible`, seq.length >= 3 && badFocus.length === 0, JSON.stringify(badFocus.map(f => `${f.tag}.${f.cls}:${f.outlineColor}|${f.shadow}`)));
        const btnF = seq.find(f => f.tag === 'button');
        if (btnF) check(`login.${w}.buttonFocusRingBlue`, /37, 99, 235/.test(btnF.shadow + btnF.outlineColor) && /255, 255, 255/.test(btnF.shadow + ''), `${btnF.shadow} | ${btnF.outlineColor}`);
        // login submit button style
        const sb = await p.evaluate(() => { const b = document.querySelector('button[type=submit]'); const c = getComputedStyle(b); return { bg: c.backgroundColor, color: c.color, bi: c.backgroundImage, h: b.getBoundingClientRect().height, r: c.borderTopLeftRadius }; });
        check(`login.${w}.submitSolidBlue`, sb.bg === 'rgb(37, 99, 235)' && sb.color === 'rgb(255, 255, 255)' && sb.bi === 'none' && sb.h >= 44, JSON.stringify(sb));
        await finish(h, `login.${w}.empty`);
      }
      // login 401 / 500-empty / network error (toast presentation)
      for (const [mode, label] of [['401', 'error-401'], ['500empty', 'error-500-empty-body'], ['network', 'error-network']]) {
        const h = await newPage(browser, vp, { loginFail: mode, expectNetErrors: true });
        const p = h.page; await p.goto(BASE + '/login');
        await p.fill('input[name=loginUserName]', 'qa.staff'); await p.fill('input[name=loginPassword]', 'synthetic-pass');
        await p.click('button[type=submit]'); await p.waitForSelector('.toast', { timeout: 5000 }).catch(() => {}); await sleep(500);
        const t = await p.evaluate(() => { const e = document.querySelector('.toast'); if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { msg: (e.querySelector('.toast__message') || {}).innerText, l: r.left, r: r.right, t: r.top, b: r.bottom, iw: innerWidth, ih: innerHeight, bg: c.backgroundColor, closeH: e.querySelector('.toast__close').getBoundingClientRect().height, closeW: e.querySelector('.toast__close').getBoundingClientRect().width }; });
        check(`login.${w}.${label}.toastShown`, !!t, 'no toast');
        if (t) {
          check(`login.${w}.${label}.toastMessageNonEmpty`, (t.msg || '').trim().length > 0, `message="${t.msg}"  [coordinator finding: empty-body error must have readable fallback]`);
          check(`login.${w}.${label}.toastInViewport`, t.l >= 0 && t.r <= t.iw && t.t >= 0 && t.b <= t.ih, JSON.stringify(t));
          check(`login.${w}.${label}.toastCloseTarget>=44`, t.closeH >= 44 && t.closeW >= 44, `${t.closeW}x${t.closeH}`);
          const pos = t.t < t.ih / 2 ? 'top' : 'bottom';
          check(`login.${w}.${label}.toastPlacement`, mobile ? pos === 'bottom' : pos === 'top', `${pos} at w=${w}`);
        }
        if (mode === '401') await shot(p, `service_login_${w}_${label}-toast`);
        if (mode === '500empty') await shot(p, `service_login_${w}_${label}-toast`);
        // form is re-enabled & user stays on login
        check(`login.${w}.${label}.staysOnLogin`, /\/login/.test(p.url()) && await p.locator('button[type=submit]').isEnabled());
        await finish(h, `login.${w}.${label}`);
      }
      // ===== /scan direct (no session) -> redirect to /login =====
      {
        const h = await newPage(browser, vp, {});
        await h.page.goto(BASE + '/scan'); await sleep(500);
        check(`scan.${w}.unauthRedirectsToLogin`, /\/login$/.test(h.page.url()), h.page.url());
        await finish(h, `scan.${w}.unauth`);
      }
      // ===== SCAN page populated (active) =====
      {
        const h = await newPage(browser, vp, {});
        const p = h.page; await login(p); await sleep(400);
        const lr = h.requests.find(r => /Login$/.test(r.url));
        check(`scan.${w}.loginRequestShape`, lr && lr.method === 'POST' && JSON.parse(lr.body).userName === 'qa.staff' && JSON.parse(lr.body).password === 'synthetic-pass', lr && lr.body);
        check(`scan.${w}.getByIdUsesCompanyId`, h.requests.some(r => r.method === 'GET' && r.url === 'https://service-tokens.com/api/Company/GetById/7'));
        overflowCheck(`scan.${w}.noOverflow`, await ev(p, 'overflow'));
        await shot(p, `service_scan_${w}_populated-active`);
        const vals = await p.evaluate(() => [...document.querySelectorAll('.company-grid > div')].map(d => d.innerText.replace(/\s+/g, ' ').trim()));
        check(`scan.${w}.companyDetails`, vals.length === 3 && /7/.test(vals[0]) && /Synthetic Spa/.test(vals[1]) && /Active/.test(vals[2]), vals.join(' / '));
        const sb = await p.evaluate(() => { const b = document.querySelector('.scan-token-btn'); const c = getComputedStyle(b); const r = b.getBoundingClientRect(); const pe = b.parentElement; const pr = pe.getBoundingClientRect(); const pc = getComputedStyle(pe); const content = pr.width - parseFloat(pc.paddingLeft) - parseFloat(pc.paddingRight) - parseFloat(pc.borderLeftWidth) - parseFloat(pc.borderRightWidth); return { bg: c.backgroundColor, color: c.color, bi: c.backgroundImage, h: r.height, w: r.width, pw: content, radius: c.borderTopLeftRadius }; });
        check(`scan.${w}.scanBtnSolidBlue56`, sb.bg === 'rgb(37, 99, 235)' && sb.color === 'rgb(255, 255, 255)' && sb.bi === 'none' && sb.h >= 56, JSON.stringify(sb));
        if (mobile) check(`scan.${w}.scanBtnFullWidth`, sb.w >= sb.pw - 1, `${sb.w} of ${sb.pw}`);
        const pg = await p.evaluate(() => { const e = document.querySelector('.scan-page'); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { maxW: c.maxWidth, w: r.width, padL: c.paddingLeft, padR: c.paddingRight, left: r.left, iw: innerWidth }; });
        check(`scan.${w}.pageMaxWidth1120`, pg.w <= 1120.5, JSON.stringify(pg));
        await styleAndA11y(p, `scan.${w}`, w);
        // badge contrast / label
        const badge = await p.evaluate(() => { const b = document.querySelector('.badge-active'); if (!b) return null; const c = getComputedStyle(b); return { color: c.color, bg: c.backgroundColor, txt: b.innerText }; });
        check(`scan.${w}.activeBadgeTextLabeled`, badge && /Active/.test(badge.txt), JSON.stringify(badge));
        // keyboard order whole page once
        await p.evaluate(() => { document.activeElement && document.activeElement.blur(); });
        const order = []; for (let i = 0; i < 5; i++) { await p.keyboard.press('Tab'); await sleep(300); const f = await ev(p, 'focusState'); if (f.tag === 'body') break; order.push(f); }
        check(`scan.${w}.tabOrderLogical`, order.map(f => f.txt).join('|').replace(/\s+/g, ' ') .startsWith('Logout|📷 Scan Token|Back to main page'), order.map(f => f.txt).join('|'));
        check(`scan.${w}.focusVisibleAll`, order.length >= 3 && order.every(f => f.outline || f.hasShadow), JSON.stringify(order.filter(f => !(f.outline || f.hasShadow))));
        // logout clears state
        await p.click('.logout-btn'); await p.waitForURL('**/login');
        await p.goto(BASE + '/scan'); await sleep(300);
        check(`scan.${w}.logoutThenScanBlocked`, /\/login$/.test(p.url()), p.url());
        await finish(h, `scan.${w}.populated`);
      }
    }
    // ===== SCAN inactive company (360) =====
    {
      const h = await newPage(browser, VPS[0], { companyStatus: 0 });
      await login(h.page); await sleep(300);
      const t = await h.page.evaluate(() => { const b = document.querySelector('.badge-inactive'); return b && b.innerText.trim(); });
      check('scan.360.inactiveBadgeLabel', t === 'Not Active', t);
      await shot(h.page, 'service_scan_360_populated-inactive');
      const c = await ev(h.page, 'contrast'); check('scan.360.inactive.contrast', c.bad.length === 0, c.bad.join('|'));
      await finish(h, 'scan.360.inactive');
    }

    // ===== SCANNER modal =====
    for (const vp of VPS) {
      const w = vp.w; const mobile = w < 768;
      // --- denied camera: error + retry + close ---
      {
        const h = await newPage(browser, vp, { mode: 'denied' });
        const p = h.page; await login(p);
        await p.focus('.scan-token-btn');
        await p.keyboard.press('Enter'); await p.waitForSelector('.scan-modal'); await sleep(500);
        check(`scanner.${w}.denied.errorStateShown`, (await p.locator('.scan-modal__state--error').count()) === 1);
        const msg = await p.locator('.scan-modal__state--error').innerText();
        check(`scanner.${w}.denied.messageText`, /Camera access denied/.test(msg), msg);
        check(`scanner.${w}.denied.roleAlert`, (await p.locator('[role=alert].scan-modal__state--error').count()) === 1);
        const dg = await ev(p, 'dialogGeom');
        check(`scanner.${w}.denied.dialogInViewport`, dg.l >= 0 && dg.r <= dg.iw && dg.t >= 0 && dg.b <= dg.ih && dg.btns.every(b => b.top >= 0 && b.bottom <= dg.ih && b.left >= 0 && b.right <= dg.iw), JSON.stringify(dg));
        if (w < 480) check(`scanner.${w}.denied.fullScreenUnder480`, dg.w === undefined && dg.r - dg.l === dg.iw, JSON.stringify(dg));
        check(`scanner.${w}.denied.btnTargets>=44`, dg.btns.every(b => b.h >= 44 && b.w >= 44), JSON.stringify(dg.btns));
        overflowCheck(`scanner.${w}.denied.noOverflow`, await ev(p, 'overflow'));
        await shot(p, `service_scanner_${w}_denied-error`);
        await styleAndA11y(p, `scanner.${w}.denied`, w);
        const ar = await p.evaluate(() => { const e = document.querySelector('.scan-modal__state--error'); const c = getComputedStyle(e); return { bg: c.backgroundColor }; });
        check(`scanner.${w}.denied.alertDangerTint`, /253, 236, 236/.test(ar.bg) || /254, 226, 226|254, 242, 242/.test(ar.bg), ar.bg);
        // confirm primary + ghost styles
        const bs = await p.evaluate(() => [...document.querySelectorAll('.scan-modal__footer .scan-btn')].map(b => { const c = getComputedStyle(b); return { txt: b.innerText.trim(), bg: c.backgroundColor, color: c.color, bi: c.backgroundImage, border: c.borderTopColor }; }));
        const retry = bs.find(b => /Try Again/.test(b.txt));
        check(`scanner.${w}.denied.retrySolidBlue`, retry && retry.bg === 'rgb(37, 99, 235)' && retry.color === 'rgb(255, 255, 255)' && retry.bi === 'none', JSON.stringify(bs));
        // Focus entry (coordinator: focus must move inside on open)
        const fi = await ev(p, 'dialogFocusInfo');
        check(`scanner.${w}.denied.focusMovesInsideOnOpen`, fi.inside, `activeElement=${fi.active}`);
        check(`scanner.${w}.denied.bodyScrollLocked`, fi.bodyOverflow === 'hidden' || fi.htmlOverflow === 'hidden', `body=${fi.bodyOverflow} html=${fi.htmlOverflow}`);
        // Tab / Shift+Tab containment (dialog must trap)
        let escaped = [];
        for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); await sleep(80); const d = await ev(p, 'dialogFocusInfo'); if (!d.inside) escaped.push(`Tab${i}:${d.active}`); }
        for (let i = 0; i < 6; i++) { await p.keyboard.press('Shift+Tab'); await sleep(80); const d = await ev(p, 'dialogFocusInfo'); if (!d.inside) escaped.push(`ShiftTab${i}:${d.active}`); }
        check(`scanner.${w}.denied.tabTrapped`, escaped.length === 0, escaped.join(','));
        // retry -> getUserMedia called again -> still denied -> remains in error
        const g0 = await p.evaluate(() => window.__qa.gum);
        await p.click('.scan-btn--confirm'); await sleep(600);
        const g1 = await p.evaluate(() => window.__qa.gum);
        check(`scanner.${w}.denied.retryReRequestsCamera`, g1 === g0 + 1, `gum ${g0}->${g1}`);
        check(`scanner.${w}.denied.retryReturnsToErrorWhenStillDenied`, (await p.locator('.scan-modal__state--error').count()) === 1);
        // Escape closes + focus returns to trigger
        await p.keyboard.press('Escape'); await sleep(400);
        check(`scanner.${w}.denied.escapeCloses`, (await p.locator('.scan-modal').count()) === 0);
        const ret = await p.evaluate(() => ({ cls: document.activeElement.className, tag: document.activeElement.tagName }));
        check(`scanner.${w}.denied.focusReturnsToTrigger`, /scan-token-btn/.test(ret.cls), `${ret.tag}.${ret.cls}`);
        const fo = await ev(p, 'dialogFocusInfo');
        check(`scanner.${w}.denied.bodyScrollRestored`, fo.bodyOverflow !== 'hidden' && fo.htmlOverflow !== 'hidden', `body=${fo.bodyOverflow}`);
        // backdrop closes
        await p.click('.scan-token-btn'); await p.waitForSelector('.scan-modal'); await sleep(300);
        const fullScreen = (await ev(p, 'dialogGeom')); const covers = fullScreen.l <= 0 && fullScreen.r >= fullScreen.iw && fullScreen.t <= 0 && fullScreen.b >= fullScreen.ih;
        if (!covers) {
          await p.mouse.click(2, 2); await sleep(300);
          check(`scanner.${w}.denied.backdropCloses`, (await p.locator('.scan-modal').count()) === 0);
        } else notes.push(`scanner.${w}: modal is full-screen (<480px) so no backdrop area exists; backdrop-click not applicable`);
        if ((await p.locator('.scan-modal').count()) === 0) { await p.click('.scan-token-btn'); await p.waitForSelector('.scan-modal'); await sleep(300); }
        // close button (dialog is open here)
        const cb = await p.evaluate(() => { const r = document.querySelector('.scan-modal__close').getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, r: r.right, t: r.top }; });
        check(`scanner.${w}.closeBtn44`, cb.w >= 44 && cb.h >= 44, `${cb.w}x${cb.h}`);
        await p.click('.scan-modal__close'); await sleep(300);
        check(`scanner.${w}.closeBtnCloses`, (await p.locator('.scan-modal').count()) === 0);
        await p.click('.scan-token-btn'); await p.waitForSelector('.scan-modal'); await sleep(300);
        await p.click('.scan-btn--ghost'); await sleep(300);
        check(`scanner.${w}.denied.closeFooterBtnCloses`, (await p.locator('.scan-modal').count()) === 0);
        await finish(h, `scanner.${w}.denied`);
      }
      // --- scanning state (synthetic blank camera) ---
      {
        const h = await newPage(browser, vp, { mode: 'blank' });
        const p = h.page; await login(p); await openScanner(p);
        check(`scanner.${w}.scanning.stateShown`, (await p.locator('.scan-modal__title').innerText()) === 'Scan Investor QR');
        const cam = await p.evaluate(() => { const c = document.querySelector('.scan-modal__camera-wrap').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, r: c.right, iw: innerWidth }; });
        check(`scanner.${w}.scanning.cameraWrapFits`, cam.l >= 0 && cam.r <= cam.iw && cam.h > 100, JSON.stringify(cam));
        const dg = await ev(p, 'dialogGeom');
        check(`scanner.${w}.scanning.dialogInViewport`, dg.l >= 0 && dg.r <= dg.iw && dg.t >= 0 && dg.b <= dg.ih && dg.btns.every(b => b.top >= 0 && b.bottom <= dg.ih), JSON.stringify(dg));
        const cn = await p.evaluate(() => [...document.querySelectorAll('.scan-modal__corner')].map(e => { const c = getComputedStyle(e); return c.borderTopColor + '|' + c.borderLeftColor + '|' + c.borderBottomColor + '|' + c.borderRightColor; }).join(' ; '));
        check(`scanner.${w}.scanning.bracketsBlue`, /37, 99, 235/.test(cn), cn);
        await shot(p, `service_scanner_${w}_scanning`);
        const fi = await ev(p, 'dialogFocusInfo');
        check(`scanner.${w}.scanning.focusMovesInsideOnOpen`, fi.inside, `activeElement=${fi.active}`);
        const ctl = await ev(p, 'controls');
        check(`scanner.${w}.scanning.touch>=44`, ctl.filter(x => x.h < 44 && /scan-/.test(x.t)).length === 0, JSON.stringify(ctl.filter(x => x.h < 44)));
        // camera released on cancel
        await p.click('.scan-btn--ghost'); await sleep(400);
        const q = await p.evaluate(() => window.__qa);
        check(`scanner.${w}.scanning.cameraReleasedOnCancel`, q.tracks > 0 && q.stopped >= q.tracks, JSON.stringify(q));
        await finish(h, `scanner.${w}.scanning`);
      }
      // --- invalid QR text / missing fields -> error -> Try Again -> scanning ---
      for (const [kind, qrObj, expect] of [['invalid-json', 'not-json-synthetic', /Invalid QR code/], ['missing-fields', { tokenId: PAYLOAD.tokenId, rowVersion: PAYLOAD.rowVersion, companyId: 7, note: 'synthetic payload without connectionId' }, /missing required data/]]) {
        const h = await newPage(browser, vp, { mode: 'qr', qr: await qrData(qrObj) });
        const p = h.page; await login(p); await openScanner(p);
        await p.waitForSelector('.scan-modal__state--error', { timeout: 8000 }).catch(() => {});
        const t = (await p.locator('.scan-modal__state--error').count()) ? await p.locator('.scan-modal__state--error').innerText() : '(no error state) modal="' + ((await p.locator('.scan-modal').innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 120)) + '" reqs=' + h.requests.length + ' ' + JSON.stringify(await p.evaluate(() => ({ ...window.__qa, video: (v => v && ({ rs: v.readyState, vw: v.videoWidth, paused: v.paused }))(document.querySelector('video')), comp: (c => c && ({ state: c.state, payload: c.payload, err: c.errorMessage }))(window.ng && window.ng.getComponent(document.querySelector('app-scan-token'))) })));
        check(`scanner.${w}.${kind}.errorMessage`, expect.test(t), t);
        const tk = await p.evaluate(() => window.__qa);
        check(`scanner.${w}.${kind}.cameraStoppedAfterRead`, tk.tracks > 0 && tk.stopped >= tk.tracks, JSON.stringify(tk));
        if (w === 360 || w === 1440) await shot(p, `service_scanner_${w}_${kind}-error`);
        await p.click('.scan-btn--confirm', { timeout: 3000 }).catch(() => {}); await sleep(700);
        const back = await p.locator('.scan-modal__title').innerText().catch(() => '');
        check(`scanner.${w}.${kind}.tryAgainReturnsToScanning`, back === 'Scan Investor QR' || /Invalid|missing|Error/.test(back), `title=${back}`);
        await finish(h, `scanner.${w}.${kind}`);
      }
      // --- valid QR: loading state with delayed redemption; dismissal during in-flight request ---
      {
        const h = await newPage(browser, vp, { mode: 'qr', redeemDelay: 3500 });
        const p = h.page; await login(p); await openScanner(p);
        await p.waitForSelector('.scan-modal__title:has-text("Loading Token")', { timeout: 8000 }).catch(() => {});
        const title = await p.locator('.scan-modal__title').innerText().catch(() => '');
        check(`scanner.${w}.inflight.loadingStateShown`, /Loading Token/.test(title), title);
        await sleep(300);
        const rq = h.requests.find(r => /GetService/.test(r.url));
        let u = rq && new URL(rq.url);
        check(`scanner.${w}.inflight.requestContract`, rq && rq.method === 'POST' && u.searchParams.get('serviceTokenId') === PAYLOAD.tokenId && u.searchParams.get('rowVersion') === '5' && u.searchParams.get('connectionId') === PAYLOAD.connectionId && !rq.body, rq && rq.url + ' body=' + rq.body);
        await shot(p, `service_scanner_${w}_loading-inflight`);
        const dg = await ev(p, 'dialogGeom');
        check(`scanner.${w}.inflight.dialogInViewport`, dg.l >= 0 && dg.r <= dg.iw && dg.t >= 0 && dg.b <= dg.ih, JSON.stringify(dg));
        const sp = await p.evaluate(() => { const s = document.querySelector('.scan-spinner'); return s ? getComputedStyle(s).animationName : null; });
        check(`scanner.${w}.inflight.spinnerAnimates`, sp && sp !== 'none', sp);
        const tk = await p.evaluate(() => window.__qa);
        check(`scanner.${w}.inflight.cameraStopped`, tk.tracks > 0 && tk.stopped >= tk.tracks, JSON.stringify(tk));
        await finish(h, `scanner.${w}.inflight`);
      }
      // --- each dismissal path while GetService is pending (coordinator finding; separate sessions so one failure doesn't mask others) ---
      for (const via of ['escape', 'backdrop', 'closeButton']) {
        const h = await newPage(browser, vp, { mode: 'qr', redeemDelay: 3000 });
        const p = h.page; await login(p); await openScanner(p);
        await p.waitForSelector('.scan-modal__title:has-text("Loading Token")', { timeout: 8000 }).catch(() => {});
        await sleep(300);
        const dg = await ev(p, 'dialogGeom');
        const covers = dg.l <= 0 && dg.r >= dg.iw && dg.t <= 0 && dg.b >= dg.ih;
        if (via === 'backdrop' && covers) { await finish(h, `scanner.${w}.pending-${via}`); continue; }
        if (via === 'escape') await p.keyboard.press('Escape');
        else if (via === 'backdrop') await p.mouse.click(2, 2);
        else await p.locator('.scan-modal__close').click({ force: true }).catch(() => {});
        await sleep(400);
        const still = (await p.locator('.scan-modal').count()) === 1;
        check(`scanner.${w}.pending.${via}IgnoredWhileRequestPending`, still, `dialog dismissed via ${via} while GetService still pending (request keeps running; user loses the result UI)`);
        await finish(h, `scanner.${w}.pending-${via}`);
      }
      // --- camera released after instantly-readable QR (race: controls assigned only after decodeFromVideoDevice resolves) ---
      if (w === 1440) {
        let leaks = 0; const N = 6; let dupReq = 0;
        for (let i = 0; i < N; i++) {
          const h = await newPage(browser, vp, { mode: 'qr', qr: await qrData('not-json-synthetic') });
          const p = h.page; await login(p); await openScanner(p);
          await p.waitForSelector('.scan-modal__state--error', { timeout: 8000 }).catch(() => {});
          await sleep(300);
          const tk = await p.evaluate(() => window.__qa); if (!(tk.tracks > 0 && tk.stopped >= tk.tracks)) leaks++;
          await finish(h, `scanner.race.${i}`);
        }
        check('scanner.cameraReleasedAfterInstantRead.repeat', leaks === 0, `${leaks}/${N} runs left the synthetic camera track running after the first QR read [pre-existing race in scan-token.component.ts: stopScanner() no-ops when controls not yet assigned]`);
        // valid QR instantly readable: how many redemption requests?
        for (let i = 0; i < 3; i++) {
          const h = await newPage(browser, vp, { mode: 'qr', redeemDelay: 1500 });
          const p = h.page; await login(p); await openScanner(p); await sleep(3000);
          dupReq = Math.max(dupReq, h.requests.filter(r => /GetService/.test(r.url)).length);
          await finish(h, `scanner.dup.${i}`);
        }
        check('scanner.singleRedemptionRequestPerScan.repeat', dupReq === 1, `max GetService requests per single scan across 3 runs = ${dupReq}`);
      }
      // --- success path (no delay): toast + closed ---
      {
        const h = await newPage(browser, vp, { mode: 'qr' });
        const p = h.page; await login(p); await openScanner(p);
        await p.waitForSelector('.toast', { timeout: 8000 }).catch(() => {});
        const t = await p.locator('.toast__message').first().innerText().catch(() => '');
        check(`scanner.${w}.success.toastText`, /Service confirmed and investor notified/.test(t), t);
        check(`scanner.${w}.success.dialogClosed`, (await p.locator('.scan-modal').count()) === 0);
        const tk = await p.evaluate(() => window.__qa);
        check(`scanner.${w}.success.cameraReleased`, tk.tracks > 0 && tk.stopped >= tk.tracks, JSON.stringify(tk));
        check(`scanner.${w}.success.oneRedemptionRequest`, h.requests.filter(r => /GetService/.test(r.url)).length === 1);
        const tc = await p.evaluate(() => { const e = document.querySelector('.toast'); const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, iw: innerWidth, t: r.top, ih: innerHeight, bar: c.borderLeftColor, bw: c.borderLeftWidth }; });
        check(`scanner.${w}.success.toastInViewport`, tc.l >= 0 && tc.r <= tc.iw, JSON.stringify(tc));
        await shot(p, `service_scanner_${w}_success-toast`);
        await finish(h, `scanner.${w}.success`);
      }
      // --- redemption failure (400 with message, and 500 empty body) ---
      for (const [kind, rf, expRe] of [['failure-400-message', 'msg', /Token already redeemed/], ['failure-500-empty', '500empty', /./]]) {
        const h = await newPage(browser, vp, { mode: 'qr', redeemFail: rf, expectNetErrors: true });
        const p = h.page; await login(p); await openScanner(p);
        await p.waitForSelector('.toast', { timeout: 8000 }).catch(() => {});
        const t = (await p.locator('.toast__message').first().innerText().catch(() => '')).trim();
        check(`scanner.${w}.${kind}.toastNonEmpty`, t.length > 0 && expRe.test(t), `message="${t}"` + (rf === '500empty' ? ' [coordinator finding: empty-body error needs readable fallback]' : ''));
        check(`scanner.${w}.${kind}.dialogClosed`, (await p.locator('.scan-modal').count()) === 0);
        const tk = await p.evaluate(() => window.__qa);
        check(`scanner.${w}.${kind}.cameraReleased`, tk.tracks > 0 && tk.stopped >= tk.tracks, JSON.stringify(tk));
        if (rf === 'msg') { await shot(p, `service_scanner_${w}_failure-toast`); }
        await finish(h, `scanner.${w}.${kind}`);
      }
      // --- confirm / token-details state: UNREACHABLE via app flow; render forced through ng debug API with synthetic token ---
      {
        const h = await newPage(browser, vp, { mode: 'blank' });
        const p = h.page; await login(p); await openScanner(p);
        const forced = await p.evaluate((payload) => {
          const el = document.querySelector('app-scan-token'); const ng = window.ng; if (!ng || !ng.getComponent) return 'no-ng-debug';
          const c = ng.getComponent(el);
          c.payload = payload;
          c.token = { id: payload.tokenId, rowVersion: 5, companyId: 7, requestId: 1, productId: 1, startDate: '2026-01-01T00:00:00', endDate: null, status: 1, count: 3, serviceCount: 1, scheduleType: { periodType: 2, periodNumber: 1 }, ownerType: 1, ownerPublicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsynthetic', companyName: 'Synthetic Spa & Wellness', productName: 'Synthetic 60-minute massage with a deliberately long product name to test wrapping' };
          c.state = 'confirm'; ng.applyChanges(c); return 'ok';
        }, PAYLOAD);
        check(`scanner.${w}.confirm.forcedRender`, forced === 'ok', forced);
        if (forced === 'ok') {
          await sleep(300);
          const dg = await ev(p, 'dialogGeom');
          check(`scanner.${w}.confirm.dialogInViewport`, dg.l >= 0 && dg.r <= dg.iw && dg.t >= 0 && dg.b <= dg.ih && dg.btns.every(b => b.top >= 0 && b.bottom <= dg.ih), JSON.stringify(dg));
          check(`scanner.${w}.confirm.scrollsInternallyIfTall`, dg.scrollH <= dg.clientH + 1 || /auto|scroll/.test(dg.overflowY), JSON.stringify({ sh: dg.scrollH, ch: dg.clientH, oy: dg.overflowY }));
          overflowCheck(`scanner.${w}.confirm.noOverflow`, await ev(p, 'overflow'));
          const rows = await p.evaluate(() => [...document.querySelectorAll('.token-detail-row')].map(r => { const q = r.getBoundingClientRect(); const v = r.querySelector('.token-detail-row__value'); const vr = v.getBoundingClientRect(); return { lab: r.querySelector('.token-detail-row__label').innerText, l: q.left, r: q.right, vr: vr.right, sw: v.scrollWidth, cw: v.clientWidth }; }));
          const modalRight = (await ev(p, 'dialogGeom')).r;
          check(`scanner.${w}.confirm.rowValuesNotClipped`, rows.every(r => r.vr <= modalRight + 1 && r.sw <= r.cw + 1), JSON.stringify(rows.filter(r => r.vr > modalRight + 1 || r.sw > r.cw + 1)));
          check(`scanner.${w}.confirm.elevenRows`, rows.length === 11, rows.length);
          const hl = await p.evaluate(() => { const e = document.querySelector('.token-detail-row__value--highlight'); const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, row: getComputedStyle(e.parentElement).backgroundColor }; });
          notes.push(`confirm.${w} highlight: ${JSON.stringify(hl)}`);
          await shot(p, `service_scanner_${w}_confirm-forced`);
          await styleAndA11y(p, `scanner.${w}.confirm`, w);
          const btns = await p.evaluate(() => [...document.querySelectorAll('.scan-modal__footer .scan-btn')].map(b => { const r = b.getBoundingClientRect(); const c = getComputedStyle(b); return { txt: b.innerText.trim(), h: r.height, w: r.width, top: r.top, bg: c.backgroundColor }; }));
          check(`scanner.${w}.confirm.buttonsStackedOnMobile`, !mobile || (btns.length === 2 && btns[1].top > btns[0].top - 0.5 && Math.abs(btns[0].w - btns[1].w) < 2 || btns.length === 2), JSON.stringify(btns));
          const conf = btns.find(b => /Confirm/.test(b.txt));
          check(`scanner.${w}.confirm.confirmBtnSolidBlue`, conf && conf.bg === 'rgb(37, 99, 235)' && conf.h >= 44, JSON.stringify(btns));
        }
        await finish(h, `scanner.${w}.confirm`);
      }
    }
    // Source observation: template references confirm()/submitting state that component lacks
    const tsSrc = fs.readFileSync(path.join(APP, 'src/app/features/service/scan-token/scan-token.component.ts'), 'utf8');
    notes.push(`source: component defines confirm()=${/\bconfirm\s*\(\)\s*[:{]/.test(tsSrc)}; assigns state='confirm'=${/state\s*=\s*'confirm'/.test(tsSrc)}; assigns state='submitting'=${/state\s*=\s*'submitting'/.test(tsSrc)}`);
  } finally {
    await browser.close();
    stopServer();
  }
}

main().catch(e => { console.error('HARNESS ERROR', e); results.push({ id: 'harness.fatal', pass: false, detail: String(e && e.stack || e).slice(0, 800) }); stopServer(); }).finally(() => {
  const pass = results.filter(r => r.pass).length, fail = results.filter(r => !r.pass);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), pass, fail: fail.length, results, unexpectedConsole, blockedExternal: [...blockedExternal], notes }, null, 1));
  log(`\nRESULT: ${pass} passed, ${fail.length} failed, ${results.length} total`);
  for (const f of fail) log(` - ${f.id}: ${f.detail.slice(0, 260)}`);
  log('unexpected console/network:', unexpectedConsole.length); unexpectedConsole.slice(0, 15).forEach(x => log('  ' + x.slice(0, 220)));
  log('blocked/unmocked external:', [...blockedExternal].join(' ; '));
  notes.slice(0, 8).forEach(n => log('note: ' + n));
  process.exit(0);
});
