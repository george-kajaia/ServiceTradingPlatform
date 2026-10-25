// Standalone QA harness library (no repo dependencies). Playwright + system Chrome, synthetic fixtures only.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const http = require('http');
const { spawn } = require('child_process');

const PW = 'C:/Users/georg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = path.resolve(__dirname, '../../..');
const SHOTS = path.resolve(__dirname, '../screenshots');
const CLI = path.join(APP, 'node_modules/@angular/cli/bin/ng.js');
const PORT = 4311;
const BASE = `http://127.0.0.1:${PORT}`;

const VIEWPORTS = [
  { w: 360, h: 800, mobile: true, touch: true },
  { w: 768, h: 1024, mobile: false, touch: true },
  { w: 1440, h: 1000, mobile: false, touch: false },
];

// ---------- server ----------
function ping(url) {
  return new Promise(res => {
    const r = http.get(url, rs => { rs.resume(); res(rs.statusCode === 200); });
    r.on('error', () => res(false)); r.setTimeout(2000, () => { r.destroy(); res(false); });
  });
}
async function startServer() {
  if (await ping(BASE + '/')) return { owned: false, stop() {} };
  const child = spawn(process.execPath, [CLI, 'serve', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: APP, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (await ping(BASE + '/') && /Compiled|compiled|Local:/.test(log)) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!(await ping(BASE + '/'))) { child.kill(); throw new Error('dev server not ready: ' + log.slice(-500)); }
  return {
    owned: true,
    stop() { try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); } catch { } },
  };
}

// ---------- synthetic fixtures ----------
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const PICTO = png(96, 96, [157, 183, 232]);

const gid = n => `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mkToken = (n, o = {}) => ({
  id: gid(n), rowVersion: 100 + n, companyId: 1 + (n % 3), requestId: 10 + (n % 3), productId: 20 + (n % 3),
  startDate: '2026-09-01T00:00:00', endDate: n % 2 ? '2027-09-01T00:00:00' : null,
  status: 1, remainingCount: 8 - (n % 4), serviceCount: 12, scheduleType: { periodType: 3, periodNumber: 1 },
  ownerType: 0, ownerPublicKey: 'SYNTH-OWNER-KEY-' + n,
  companyName: ['Blue Harbor Fitness', 'Nordlicht Wellness Studio International', 'Cedar Dental'][n % 3],
  productName: ['Monthly Yoga Pass', 'Premium Deep-Tissue Massage Therapy Package (90 min)', 'Teeth Cleaning'][n % 3],
  price: [49.9, 1250.5, 120][n % 3], pictogram: n % 2 ? PICTO : null, term: n % 2 ? 12 : null, ...o,
});
function baseFx() {
  const primary = [1, 2, 3, 4, 5, 6, 7].map(n => mkToken(n));
  const secondary = [11, 12, 13].map(n => mkToken(n, { ownerType: 1, status: 1, price: 75 + n }));
  const mine = [
    mkToken(21, { status: 2, ownerType: 1, ownerPublicKey: 'SYNTH-INVESTOR-KEY' }),
    mkToken(22, { status: 1, ownerType: 1, ownerPublicKey: 'SYNTH-INVESTOR-KEY' }),
    mkToken(23, { status: 255, ownerType: 1, remainingCount: 0, ownerPublicKey: 'SYNTH-INVESTOR-KEY' }),
  ];
  return {
    investor: { id: 7, rowVersion: 1, publicKey: 'SYNTH-INVESTOR-KEY', status: 1, userName: 'demo.investor', password: '' },
    creds: { userName: 'demo.investor', password: 'synthetic-pass' },
    companies: [1, 2, 3].map(i => ({ id: i, rowVersion: 1, name: ['Blue Harbor Fitness', 'Nordlicht Wellness Studio International', 'Cedar Dental'][i - 1], status: 1, regDate: '2026-01-01T00:00:00', taxCode: '10000' + i })),
    products: [0, 1, 2].map(i => ({ id: 20 + i, companyId: 1 + i, name: ['Monthly Yoga Pass', 'Premium Deep-Tissue Massage Therapy Package (90 min)', 'Teeth Cleaning'][i], serviceCount: 12, price: 50, term: 12, scheduleType: { periodType: 3, periodNumber: 1 } })),
    requests: [0, 1, 2].map(i => ({ id: 10 + i, rowVersion: 1, companyId: 1 + i, companyName: 'c', productId: 20 + i, productName: ['Monthly Yoga Pass', 'Massage', 'Teeth Cleaning'][i], serviceTokenCount: 10, regDate: '2026-01-01T00:00:00', status: 3 })),
    primary, secondary, mine, cart: [],
    savedCard: true,
    failTokens: false, failLogin: false, registerFail: false,
    delayMs: {}, // key -> ms
    negotiate: 'ok', // ok | fail
    pay: { initiateFail: false, statuses: [{ status: 'Processing', final: false }] , pollIdx: 0 },
    calls: [], unknown: [], blocked: [],
  };
}

// ---------- context / routing ----------
async function newCtx(browser, vp, fx, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile, hasTouch: !!vp.touch,
    serviceWorkers: 'block', permissions: [], acceptDownloads: false, deviceScaleFactor: 1,
    colorScheme: 'light', reducedMotion: 'reduce',
  });
  const hostOk = h => h === 'service-tokens.com' || h.endsWith('.service-tokens.com');
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const delay = k => fx.delayMs[k] ? new Promise(r => setTimeout(r, fx.delayMs[k])) : null;

  await ctx.route('**/*', async route => {
    const req = route.request(); const u = new URL(req.url());
    const baseHost = u.hostname === '127.0.0.1' && u.port === String(opts.port || PORT);
    if (baseHost) return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stubbed */' });
    if (u.hostname === 'pay.flitt.com') {
      if (u.pathname.endsWith('.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.checkout=function(sel,opts){var e=document.querySelector(sel);e.innerHTML='<div id="flitt-stub" style="padding:24px;font:14px sans-serif">STUB Flitt card form (synthetic) token='+opts.params.token+'<br><input aria-label="Card number" placeholder="Card number" style="margin-top:12px;width:100%;height:44px"/></div>';};` });
      return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stubbed */' });
    }
    if (!hostOk(u.hostname)) { fx.blocked.push(req.method() + ' ' + req.url()); return route.abort('blockedbyclient'); }

    const origin = req.headers()['origin'] || BASE;
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type, x-signalr-user-agent, x-requested-with', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const _f = route.fulfill.bind(route); route.fulfill = o => _f({ ...o, headers: { ...cors, ...(o.headers || {}) } });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });
    const p = u.pathname.replace(/\/+$/, ''); const m = req.method(); const q = u.searchParams;
    fx.calls.push({ m, p, q: Object.fromEntries(q), body: req.postData() });
    const pl = p.toLowerCase();
    const tokenById = id => [...fx.primary, ...fx.secondary, ...fx.mine, ...fx.cart.map(c => c.token)].find(t => t.id === id);

    if (pl.endsWith('/hubs/redemption/negotiate')) {
      await delay('negotiate');
      if (fx.negotiate === 'fail') return route.fulfill({ status: 500, body: 'synthetic negotiate failure' });
      return json(route, { negotiateVersion: 1, connectionId: 'SYNTH-CONN-1', connectionToken: 'SYNTH-TOKEN-1', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] });
    }
    if (pl === '/api/investor/login' && m === 'POST') {
      await delay('login');
      const b = JSON.parse(req.postData() || '{}');
      if (!fx.failLogin && b.userName === fx.creds.userName && b.password === fx.creds.password) return json(route, fx.investor);
      return route.fulfill({ status: 401, body: 'Unauthorized' });
    }
    if (pl === '/api/investor/create' && m === 'POST') {
      if (fx.registerFail) return json(route, { message: 'Synthetic: public key already registered.' }, 400);
      return json(route, fx.investor);
    }
    if (pl.startsWith('/api/investor/getpaymentmethod/')) return json(route, fx.savedCard ? { hasSavedCard: true, maskedCard: '**** **** **** 4242', cardType: 'VISA', paymentSystem: 'visa' } : { hasSavedCard: false });
    if (pl === '/api/investor/deletepaymentmethod') { fx.savedCard = false; return route.fulfill({ status: 200, body: '' }); }
    if (pl === '/api/company/getall') return json(route, fx.companies);
    if (pl === '/api/product/getall') return json(route, fx.products);
    if (pl === '/api/request/getall') return json(route, fx.requests);

    if (pl.startsWith('/api/servicetoken/')) {
      const act = pl.split('/').pop();
      if (act === 'getinvestorservicetokens') { await delay('tokens'); return fx.failTokens ? route.fulfill({ status: 500, body: 'synthetic' }) : json(route, fx.mine); }
      if (act === 'getprimarymarketservicetokens') { await delay('tokens'); if (fx.failTokens) return route.fulfill({ status: 500, body: 'synthetic' }); const c = +q.get('companyId'); return json(route, fx.primary.filter(t => c === -1 || t.companyId === c)); }
      if (act === 'getsecondarymarketservicetokens') { await delay('tokens'); return fx.failTokens ? route.fulfill({ status: 500, body: 'synthetic' }) : json(route, fx.secondary); }
      if (act === 'getinvestorservicetokensincart') { await delay('cart'); return json(route, fx.cart.map(c => c.token)); }
      if (act === 'markserviceTokenincart'.toLowerCase()) {
        const t = tokenById(q.get('serviceTokenId')); const nt = { ...t, rowVersion: t.rowVersion + 1, status: 3 };
        fx.cart.push({ token: nt, market: t.ownerType === 0 ? 'primary' : 'secondary' }); return json(route, nt);
      }
      if (act === 'cancelincart') { const id = q.get('serviceTokenId'); const t = fx.cart.find(c => c.token.id === id); fx.cart = fx.cart.filter(c => c.token.id !== id); return json(route, t ? t.token : {}); }
      if (act === 'markservicetokenforresell' || act === 'cancelreselling' || act === 'buyprimaryservicetoken' || act === 'buysecondaryservicetoken') return route.fulfill({ status: 200, body: '' });
    }
    if (pl === '/api/payment/initiateembeddedpaymentbatch' && m === 'POST') {
      if (fx.pay.initiateFail) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic: token no longer available.' }) });
      return json(route, { orderId: 'SYNTH-ORDER-1', token: 'SYNTH-CHECKOUT-TOKEN' });
    }
    if (pl === '/api/payment/getstatus') {
      const seq = fx.pay.statuses; const s = seq[Math.min(fx.pay.pollIdx++, seq.length - 1)];
      const ids = (fx.pay.itemIds && fx.pay.itemIds.length) ? fx.pay.itemIds : fx.cart.map(c => c.token.id);
      return json(route, { orderId: q.get('orderId'), status: s.status, final: s.final, amount: 1300.4, currency: 'GEL', items: ids.map((id, i) => ({ serviceTokenId: id, status: (s.itemStatuses && s.itemStatuses[i]) || s.status })) });
    }
    fx.unknown.push(m + ' ' + req.url());
    return route.fulfill({ status: 404, body: 'synthetic: unmocked' });
  });

  // SignalR websocket: fully mocked, never connects to the server
  fx.ws = null;
  await ctx.routeWebSocket(/.*/, ws => {
    const url = ws.url();
    if (!/service-tokens\.com\/hubs\/redemption/.test(url)) { fx.blocked.push('WS ' + url); ws.close(); return; }
    fx.ws = ws;
    ws.onMessage(msg => { if (String(msg).includes('"protocol"')) ws.send('{}\x1e'); });
  });
  return ctx;
}

async function attach(page, fx) {
  fx.console = []; fx.pageErrors = []; fx.failed = [];
  page.on('console', m => { if (m.type() === 'error') fx.console.push(m.text()); });
  page.on('pageerror', e => fx.pageErrors.push(String(e)));
  page.on('requestfailed', r => { if (!/blockedbyclient/.test(r.failure()?.errorText || '')) fx.failed.push(r.url() + ' ' + r.failure()?.errorText); });
}

// ---------- in-page audit ----------
function auditFn(nominalW) {
  const out = { overflow: null, small: [], colors: [], contrast: [], unlabeled: [], clipped: [], offscreen: [], fonts: [] };
  // NOTE: with mobile emulation Chrome widens the layout viewport when content overflows, so innerWidth is not trustworthy.
  const vw = nominalW, vh = window.innerHeight;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1 || window.innerWidth > vw + 1) out.overflow = { scrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth, innerWidth: window.innerWidth, vw };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 3); if (c.length) s += '.' + c.join('.'); return s; };
  const visible = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0; };
  const hsl = c => { let r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; const l = (mx + mn) / 2; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s, l }; };
  const badHue = c => { if (!c || c.a < 0.05) return null; const x = hsl(c); if (x.s < 0.18 || x.l > 0.97 || x.l < 0.04) return null; if (x.h >= 75 && x.h < 165) return 'green'; if (x.h >= 165 && x.h < 200) return 'cyan/teal'; if (x.h >= 255 && x.h < 345) return 'purple/pink'; return null; };
  const bgOf = e => { let layers = []; let n = e; let unknown = false; while (n && n.nodeType === 1) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') { unknown = true; } const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } n = n.parentElement; } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return { c: base, unknown }; };
  const all = [...document.body.querySelectorAll('*')].filter(e => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'path', 'svg'].includes(e.tagName));
  const seenColor = new Set(), seenContrast = new Set();
  for (const e of all) {
    if (!visible(e)) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    // colors
    const chk = (prop, val) => { const c = parse(val); const h = badHue(c); if (h) { const k = sel(e) + '|' + prop + '|' + val; if (!seenColor.has(k)) { seenColor.add(k); out.colors.push({ el: sel(e), prop, val, hue: h, text: (e.textContent || '').trim().slice(0, 30) }); } } };
    chk('color', cs.color); chk('background-color', cs.backgroundColor);
    if (parseFloat(cs.borderTopWidth) > 0) chk('border-color', cs.borderTopColor);
    if (cs.boxShadow !== 'none') (cs.boxShadow.match(/rgba?\([^)]+\)/g) || []).forEach(v => chk('box-shadow', v));
    if (/gradient/.test(cs.backgroundImage)) { const k = sel(e) + '|grad'; if (!seenColor.has(k)) { seenColor.add(k); out.colors.push({ el: sel(e), prop: 'background-image', val: cs.backgroundImage.slice(0, 80), hue: 'gradient', text: '' }); } }
    // interactive size
    const interactive = e.matches('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary,label.save-card,[tabindex]:not([tabindex="-1"])');
    if (interactive) {
      const inline = e.tagName === 'A' && cs.display === 'inline' && e.closest('p,li,span,div:not([class*=btn])') && !e.className;
      if (r.height < 44 - 0.5 || r.width < 44 - 0.5) out.small.push({ el: sel(e), w: Math.round(r.width), h: Math.round(r.height), text: (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().slice(0, 24), inlineLink: !!inline, disabled: e.disabled === true });
    }
    // labels
    if (e.matches('input:not([type=hidden]):not([type=checkbox]),select,textarea')) {
      const named = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.labels && e.labels.length) || e.title;
      if (!named) out.unlabeled.push({ el: sel(e), placeholder: e.placeholder || '' });
    }
    // font size
    const fs = parseFloat(cs.fontSize); const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      if (fs < 12 && !/^(sup)$/i.test(e.tagName)) out.fonts.push({ el: sel(e), fs, text: e.textContent.trim().slice(0, 24) });
      // contrast
      const fg = parse(cs.color); const { c: bg, unknown } = bgOf(e);
      if (fg) {
        const eff = over(fg, bg); const ratioV = ratio(eff, bg);
        const large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
        const need = large ? 3 : 4.5;
        const dis = e.disabled === true || e.closest('[disabled]');
        const k = sel(e) + '|' + cs.color + '|' + bg.r + bg.g + bg.b;
        if (ratioV < need && !seenContrast.has(k)) { seenContrast.add(k); out.contrast.push({ el: sel(e), ratio: +ratioV.toFixed(2), need, fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, text: e.textContent.trim().slice(0, 30), disabled: !!dis, bgImage: unknown }); }
      }
      // clipped text
      if ((e.scrollWidth > e.clientWidth + 1) && ['hidden', 'clip'].includes(cs.overflowX) && cs.textOverflow !== 'ellipsis') out.clipped.push({ el: sel(e), sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent.trim().slice(0, 30) });
    }
    // offscreen horizontally (excluding scroll containers)
    if (r.right > vw + 1 || r.left < -1) {
      let sc = false, n = e.parentElement; while (n) { const o = getComputedStyle(n).overflowX; if (['auto', 'scroll', 'hidden', 'clip'].includes(o) && n !== document.body && n !== de) { sc = true; break; } n = n.parentElement; }
      if (!sc && getComputedStyle(e).position !== 'fixed') out.offscreen.push({ el: sel(e), left: Math.round(r.left), right: Math.round(r.right), vw });
    }
  }
  return out;
}

// ---------- reporting helpers ----------
const R = { checks: [], audits: [], shots: [], notes: [] };
function check(id, ok, detail) { R.checks.push({ id, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + id + (ok ? '' : ' :: ' + (detail || ''))); }
async function shot(page, route, vp, state, full = false) {
  const name = `investor_${route}_${vp.w}_${state}.png`;
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: full });
  R.shots.push(name); return name;
}
async function audit(page, label, vp) {
  const a = await page.evaluate(auditFn, vp.w);
  R.audits.push({ label, w: vp.w, ...a });
  return a;
}
async function loginViaStorage(page, fx) {
  await page.addInitScript(inv => { if (!sessionStorage.getItem('investor_session')) sessionStorage.setItem('investor_session', JSON.stringify(inv)); }, fx.investor);
}

module.exports = { chromium, CHROME, APP, SHOTS, PORT, BASE, VIEWPORTS, startServer, baseFx, mkToken, newCtx, attach, audit, shot, check, R, loginViaStorage, gid, PICTO, ping };
