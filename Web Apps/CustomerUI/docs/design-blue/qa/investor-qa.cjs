// CustomerUI blue redesign QA. Run: node docs/design-blue/qa/investor-qa.cjs
// Synthetic fixtures only; every non-localhost request is intercepted (see lib.cjs).
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const { BASE, VIEWPORTS, check, R, shot, audit } = L;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const RUNS = [];

async function run(name, vp, setup, fn, o = {}) {
  if (process.argv[2] && !new RegExp(process.argv[2].replace(/,/g, '|')).test(name)) return;
  const fx = L.baseFx(); if (setup) setup(fx);
  const ctx = await L.newCtx(browser, vp, fx); const page = await ctx.newPage(); await L.attach(page, fx);
  if (o.login !== false) await L.loginViaStorage(page, fx);
  if (o.clock) await page.clock.install();
  try { await fn(page, fx, vp); }
  catch (e) { check(`${name}@${vp.w} scenario completed`, false, e.message.split('\n').slice(0, 6).join(' / ').slice(0, 700)); try { await shot(page, 'ERR-' + name, vp, 'scenario-error'); } catch { } }
  RUNS.push({ name, w: vp.w, expectErrors: !!o.expectErrors, console: fx.console, pageErrors: fx.pageErrors, failed: fx.failed, unknown: fx.unknown, blocked: fx.blocked });
  await ctx.close();
  return fx;
}
const each = async (name, setup, fn, o) => { for (const vp of VIEWPORTS) await run(name, vp, setup, fn, o); };
const go = async (page, p) => { await page.goto(BASE + p, { waitUntil: 'load' }); await sleep(250); };
const vis = (page, sel) => page.locator(sel + ':visible');
const toastText = async page => (await page.locator('.toast__message').allInnerTexts()).join(' | ');

async function tabClick(page, text) {
  const t = page.locator('.desktop-tab:visible, .bottom-nav__tab:visible').filter({ hasText: text }).first();
  await t.click(); await sleep(350);
}
const cardsVisible = page => page.locator('.token-card:visible').count();
// /token/:id has no UI entry point and its router-state hand-off yields a blank page when driven programmatically
// (see report, pre-existing). To still audit the redesigned template we navigate, then inject the component inputs
// via the dev-mode ng debug API and drop the stale marketplace host element.
async function openTokenPage(page, t, tab, pk) {
  await page.evaluate(([t, tb, pk]) => { const c = window.ng.getComponent(document.querySelector('app-investor-marketplace')); c.router.navigate(['/token', t.id], { state: { token: t, tab: tb, investorPublicKey: pk } }); }, [t, tab, pk]);
  await page.waitForSelector('app-token-detail'); await sleep(600);
  await page.evaluate(([t, tb, pk]) => { const el = document.querySelector('app-token-detail'); const c = window.ng.getComponent(el); c.token = t; c.tab = tb; c.investorPublicKey = pk; window.ng.applyChanges(c); const m = document.querySelector('app-investor-marketplace'); if (m) m.remove(); }, [t, tab, pk]);
  await page.waitForSelector('.action-bar'); await sleep(300);
}
async function pageOverflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }

(async () => {
  const srv = await L.startServer();
  browser = await L.chromium.launch({ executablePath: L.CHROME, headless: true });
  try {
    // ============ 1. HOME ============
    await each('home', null, async (page, fx, vp) => {
      await go(page, '/'); await page.waitForSelector('.ft-card');
      await shot(page, 'home', vp, 'populated', true);
      const a = await audit(page, 'home:populated', vp);
      check(`home@${vp.w} no horizontal overflow`, !a.overflow, JSON.stringify(a.overflow));
      check(`home@${vp.w} featured cards rendered (7 fixtures)`, (await page.locator('.ft-card').count()) === 7);
      const q = fx.calls.find(c => /GetPrimaryMarketServiceTokens/i.test(c.p));
      check(`home@${vp.w} featured request params companyId=-1&requestId=-1`, q && q.q.companyId === '-1' && q.q.requestId === '-1', JSON.stringify(q && q.q));
      const f = page.locator('.faq__btn').first(); await f.scrollIntoViewIfNeeded(); await f.click(); await sleep(200);
      check(`home@${vp.w} FAQ toggles aria-expanded`, (await f.getAttribute('aria-expanded')) === 'true');
      await shot(page, 'home', vp, 'faq-open');
      await page.locator('.ft-card').first().scrollIntoViewIfNeeded();
      await page.locator('.ft-card').first().click(); await sleep(400);
      check(`home@${vp.w} featured card click -> /login`, page.url().endsWith('/login'), page.url());
    });
    await each('home-empty', f => { f.primary = []; }, async (page, fx, vp) => {
      await go(page, '/'); await sleep(300);
      await shot(page, 'home', vp, 'empty-featured');
      const a = await audit(page, 'home:empty', vp);
      check(`home-empty@${vp.w} no overflow`, !a.overflow);
    });
    await each('home-featured-error', f => { f.failTokens = true; }, async (page, fx, vp) => {
      await go(page, '/'); await sleep(300);
      await shot(page, 'home', vp, 'featured-error');
      check(`home-error@${vp.w} page still renders hero`, (await page.locator('h1:visible').count()) > 0);
    }, { expectErrors: true });

    // ============ 2. AUTH ============
    await each('login', null, async (page, fx, vp) => {
      await go(page, '/login');
      await shot(page, 'login', vp, 'default');
      const a = await audit(page, 'login:default', vp);
      check(`login@${vp.w} no overflow`, !a.overflow);
      // validation: native required
      await page.locator('button[type=submit]').click(); await sleep(150);
      const inv = await page.locator('input:invalid').count();
      // NOTE: Angular adds novalidate to ngForm forms, so `required` only flags :invalid; the empty submit still reaches the API (pre-existing behavior, not redesign).
      check(`login@${vp.w} empty fields flagged :invalid (2 inputs)`, inv === 2, `invalid=${inv}`);
      await sleep(300); await page.waitForSelector('.auth-error').catch(() => { });
      R.notes.push({ id: `login-empty-submit-hits-api@${vp.w}`, value: fx.calls.some(c => /investor\/login/i.test(c.p)) });
      await shot(page, 'login', vp, 'validation-empty');
      // wrong creds
      await page.fill('input[name=loginUserName]', 'nobody'); await page.fill('input[name=loginPassword]', 'wrong');
      await page.locator('button[type=submit]').click(); await page.waitForSelector('.auth-error');
      check(`login@${vp.w} wrong creds shows error text`, /Incorrect username or password/.test(await page.locator('.auth-error').innerText()));
      await shot(page, 'login', vp, 'error');
      await audit(page, 'login:error', vp);
      // loading state
      fx.delayMs.login = 1500;
      await page.fill('input[name=loginUserName]', fx.creds.userName); await page.fill('input[name=loginPassword]', fx.creds.password);
      await page.locator('button[type=submit]').click(); await sleep(250);
      check(`login@${vp.w} submit disabled while loading`, await page.locator('button[type=submit]').isDisabled());
      await shot(page, 'login', vp, 'loading-disabled');
      await page.waitForURL('**/marketplace'); await sleep(300);
      const body = fx.calls.find(c => /investor\/login/i.test(c.p)); const sent = JSON.parse(fx.calls.filter(c => /investor\/login/i.test(c.p)).pop().body);
      check(`login@${vp.w} POST body userName/password`, sent.userName === fx.creds.userName && sent.password === fx.creds.password);
      check(`login@${vp.w} success -> /marketplace`, page.url().endsWith('/marketplace'));
    }, { login: false });
    await each('register', null, async (page, fx, vp) => {
      await go(page, '/login?mode=register');
      check(`register@${vp.w} ?mode=register opens register form`, (await page.locator('input[name=publicKey]').count()) === 1);
      await shot(page, 'login', vp, 'register');
      const a = await audit(page, 'login:register', vp);
      check(`register@${vp.w} no overflow`, !a.overflow);
      fx.registerFail = true;
      await page.fill('input[name=publicKey]', 'SYNTH-PK'); await page.fill('input[name=regUserName]', 'u'); await page.fill('input[name=regPassword]', 'p');
      await page.locator('button[type=submit]').click(); await page.waitForSelector('.toast--error');
      check(`register@${vp.w} failure shows error toast`, /already registered/.test(await toastText(page)));
      await shot(page, 'login', vp, 'register-error-toast');
      await audit(page, 'login:register-error-toast', vp);
      fx.registerFail = false; await sleep(5200);
      await page.locator('button[type=submit]').click(); await page.waitForSelector('.toast--success');
      check(`register@${vp.w} success toast + back to login form`, /Registration successful/.test(await toastText(page)) && (await page.locator('input[name=loginUserName]').count()) === 1);
      await shot(page, 'login', vp, 'register-success-toast');
      await audit(page, 'login:register-success-toast', vp);
    }, { login: false, expectErrors: true });

    // route guards
    await run('guards', VIEWPORTS[2], null, async (page, fx, vp) => {
      for (const p of ['/marketplace', '/cart', '/checkout']) { await go(page, p); check(`guard ${p} without session -> /login`, page.url().endsWith('/login'), page.url()); }
      await go(page, '/nope/nothing'); check('unknown route -> home', new URL(page.url()).pathname === '/', page.url());
      await go(page, '/token/xyz'); await sleep(300); check('/token/:id without state -> leaves token page', !/\/token\//.test(page.url()), page.url());
    }, { login: false });

    // ============ 3. MARKETPLACE ============
    for (const vp of VIEWPORTS) {
      await run('market-populated', vp, null, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        // My tokens
        check(`market@${vp.w} My Tokens renders 3 cards`, (await cardsVisible(page)) === 3);
        const my = fx.calls.find(c => /getinvestorservicetokens$/i.test(c.p));
        check(`market@${vp.w} GetInvestorServiceTokens investorPublicKey param`, my && my.q.investorPublicKey === fx.investor.publicKey, JSON.stringify(my && my.q));
        await shot(page, 'marketplace-mytokens', vp, 'populated', true);
        let a = await audit(page, 'market:mytokens', vp);
        check(`market@${vp.w} mytokens no viewport overflow`, !a.overflow, JSON.stringify(a.overflow));
        // Primary
        await tabClick(page, /Primary/); await page.waitForSelector('.token-card--primary');
        check(`market@${vp.w} Primary tab renders 7 cards`, (await cardsVisible(page)) === 7);
        await shot(page, 'marketplace-primary', vp, 'populated', true);
        a = await audit(page, 'market:primary', vp);
        check(`market@${vp.w} primary no viewport overflow`, !a.overflow, JSON.stringify(a.overflow));
        // grid columns
        const cols = await page.evaluate(() => { const g = document.querySelector('.card-grid'); return getComputedStyle(g).gridTemplateColumns.split(' ').length; });
        const exp = vp.w < 520 ? 1 : vp.w < 1024 ? 2 : vp.w < 1280 ? 3 : 4;
        check(`market@${vp.w} card grid columns = ${exp}`, cols === exp, `got ${cols}`);
        // card alignment: all cards in same row share height / top
        const geo = await page.evaluate(() => [...document.querySelectorAll('.token-card')].map(c => { const r = c.getBoundingClientRect(); return { t: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; }));
        const rows = {}; geo.forEach(g => (rows[g.t] = rows[g.t] || []).push(g));
        const uneven = Object.values(rows).filter(r => new Set(r.map(x => x.h)).size > 1).length;
        check(`market@${vp.w} cards in a row have equal height`, uneven === 0, `uneven rows=${uneven}`);
        const gaps = await page.evaluate(() => { const g = document.querySelector('.card-grid'); const cs = getComputedStyle(g); return { gap: cs.columnGap, row: cs.rowGap }; });
        check(`market@${vp.w} grid gap 16px mobile / 20px desktop`, vp.w < 768 ? gaps.gap === '16px' : gaps.gap === '20px', JSON.stringify(gaps));
        // price on card (brief: price hierarchy)
        const priceOnCard = await page.locator('.token-card--primary').first().innerText();
        R.notes.push({ id: `price-on-card@${vp.w}`, has: /₾|GEL|\$|\d+\.\d{2}/.test(priceOnCard) });
        // Secondary
        await tabClick(page, /Secondary/); await page.waitForSelector('.token-card');
        check(`market@${vp.w} Secondary tab renders 3 cards`, (await cardsVisible(page)) === 3);
        await shot(page, 'marketplace-secondary', vp, 'populated');
        await audit(page, 'market:secondary', vp);
        const sec = fx.calls.filter(c => /getsecondarymarketservicetokens/i.test(c.p)).pop();
        check(`market@${vp.w} secondary params investorPublicKey/companyId/requestId`, sec && sec.q.investorPublicKey === fx.investor.publicKey && sec.q.companyId === '-1' && sec.q.requestId === '-1', JSON.stringify(sec && sec.q));
      });

      // filters
      await run('market-filters', vp, null, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        await tabClick(page, /Primary/); await page.waitForSelector('.token-card--primary');
        const filterVisible = await page.locator('.filter-bar').isVisible();
        check(`filters@${vp.w} filter bar visible`, filterVisible);
        check(`filters@${vp.w} request filter disabled until product chosen`, await page.locator('.filter-bar select').nth(2).isDisabled());
        await page.locator('.filter-bar select').nth(0).selectOption({ label: 'Blue Harbor Fitness' });
        await sleep(200);
        const prodOpts = await page.locator('.filter-bar select').nth(1).locator('option').allInnerTexts();
        check(`filters@${vp.w} product list narrowed to company`, prodOpts.length === 2 && /Yoga/.test(prodOpts[1]), JSON.stringify(prodOpts));
        await page.locator('.filter-bar select').nth(1).selectOption({ index: 1 }); await sleep(200);
        check(`filters@${vp.w} request filter enabled after product`, await page.locator('.filter-bar select').nth(2).isEnabled());
        await shot(page, 'marketplace-filters', vp, 'company-product-selected');
        await audit(page, 'market:filters', vp);
        await page.locator('.filter-bar__btn--primary').click(); await sleep(400);
        const req = fx.calls.filter(c => /getprimarymarketservicetokens/i.test(c.p)).pop();
        check(`filters@${vp.w} Apply sends companyId=1`, req && req.q.companyId === '1', JSON.stringify(req && req.q));
        check(`filters@${vp.w} Apply narrows cards (company 1 only)`, (await cardsVisible(page)) > 0 && (await cardsVisible(page)) < 7, String(await cardsVisible(page)));
        await page.locator('.filter-bar__btn:not(.filter-bar__btn--primary)').click(); await sleep(400);
        const sel0 = await page.locator('.filter-bar select').nth(0).inputValue();
        check(`filters@${vp.w} Reset restores all companies + all cards`, (await cardsVisible(page)) === 7, `cards=${await cardsVisible(page)} sel=${sel0}`);
      });

      // detail modals (3 tabs)
      await run('market-detail', vp, null, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        for (const [tab, name, text] of [[/My Tokens/, 'mytokens', 'My Tokens'], [/Primary/, 'primary', 'Primary'], [/Secondary/, 'secondary', 'Secondary']]) {
          if (name !== 'mytokens') await tabClick(page, tab);
          await page.locator('.token-card:visible').first().click(); await page.waitForSelector('.modal[role=dialog]');
          await sleep(200);
          await shot(page, 'marketplace-detail-modal', vp, name);
          const a = await audit(page, 'market:detail:' + name, vp);
          check(`detail-${name}@${vp.w} modal fits viewport`, await page.evaluate(([W, H]) => { const r = document.querySelector('.modal').getBoundingClientRect(); return r.top >= 0 && r.bottom <= H + 1 && r.left >= 0 && r.right <= W + 1; }, [vp.w, vp.h]));
          const close = await page.locator('.modal__close').boundingBox();
          check(`detail-${name}@${vp.w} close button >= 44px`, close.width >= 43.5 && close.height >= 43.5, `${close.width}x${close.height}`);
          check(`detail-${name}@${vp.w} no horizontal overflow`, !a.overflow);
          // action buttons size
          const btns = await page.locator('.modal__actions button').evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
          check(`detail-${name}@${vp.w} action buttons >= 44px`, btns.every(h => h >= 44), JSON.stringify(btns));
          if (vp.w === 360) { const dir = await page.evaluate(() => getComputedStyle(document.querySelector('.modal__actions')).flexDirection); check(`detail-${name}@360 actions stacked`, dir === 'column', dir); }
          // Escape closes
          await page.keyboard.press('Escape'); await sleep(250);
          check(`detail-${name}@${vp.w} Escape closes`, (await page.locator('.modal[role=dialog]').count()) === 0);
          // backdrop closes
          await page.locator('.token-card:visible').first().click(); await page.waitForSelector('.modal[role=dialog]');
          await page.mouse.click(3, 3); await sleep(250);
          check(`detail-${name}@${vp.w} backdrop click closes`, (await page.locator('.modal[role=dialog]').count()) === 0);
        }
        // focus management (observe)
        await tabClick(page, /Primary/);
        await page.locator('.token-card:visible').first().click(); await page.waitForSelector('.modal[role=dialog]'); await sleep(200);
        const inside = await page.evaluate(() => !!document.activeElement.closest('.modal'));
        R.notes.push({ id: `detail-focus-moves-into-modal@${vp.w}`, value: inside });
        // body scroll lock (observe)
        R.notes.push({ id: `detail-body-scroll-locked@${vp.w}`, value: await page.evaluate(() => getComputedStyle(document.body).overflow) });
      });

      // add to cart / cart count
      await run('market-addcart', vp, null, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        await tabClick(page, /Primary/); await page.waitForSelector('.token-card--primary');
        const first = page.locator('.token-card--primary:visible').first();
        await first.locator('.tc-btn').click(); await page.waitForSelector('.toast--success'); await sleep(250);
        const call = fx.calls.find(c => /markservicetokenincart/i.test(c.p));
        check(`addcart@${vp.w} POST MarkServiceTokenInCart params`, call && call.q.serviceTokenId === fx.primary[0].id && call.q.rowVersion === String(fx.primary[0].rowVersion) && call.q.investorPublicKey === fx.investor.publicKey, JSON.stringify(call && call.q));
        // App behavior: in-cart tokens are removed from the primary list (7 -> 6).
        check(`addcart@${vp.w} added token leaves the primary list (7 -> 6)`, (await cardsVisible(page)) === 6, String(await cardsVisible(page)));
        const badge = await page.locator('.cart-btn__badge:visible, .cart-badge-mobile:visible').first().innerText();
        check(`addcart@${vp.w} cart badge = 1`, badge.trim() === '1', badge);
        await shot(page, 'marketplace-primary', vp, 'added-to-cart-toast');
        await audit(page, 'market:added-toast', vp);
        // via detail modal
        await page.locator('.token-card--primary:visible').nth(1).click(); await page.waitForSelector('.modal[role=dialog]');
        await page.locator('.modal__actions .tc-btn--outline').click(); await sleep(500);
        check(`addcart@${vp.w} detail modal Add to Cart closes modal & badge=2`, (await page.locator('.modal[role=dialog]').count()) === 0 && (await page.locator('.cart-btn__badge:visible, .cart-badge-mobile:visible').first().innerText()).trim() === '2');
        await sleep(5200);
        // open cart
        await page.locator('.cart-btn:visible, .bottom-nav__tab:visible:has-text("Cart")').first().click(); await page.waitForURL('**/cart'); await page.waitForSelector('.cart-card');
        check(`addcart@${vp.w} cart page lists 2 items`, (await page.locator('.cart-card').count()) === 2);
      });

      // empty + error + loading
      await run('market-empty', vp, f => { f.mine = []; f.primary = []; f.secondary = []; }, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.empty-msg');
        await shot(page, 'marketplace-mytokens', vp, 'empty');
        await audit(page, 'market:empty', vp);
        await tabClick(page, /Primary/); await page.waitForSelector('.empty-msg');
        check(`empty@${vp.w} primary empty message`, /No tokens available/.test(await page.locator('.empty-msg').innerText()));
        await shot(page, 'marketplace-primary', vp, 'empty');
        check(`empty@${vp.w} no overflow`, !(await audit(page, 'market:empty-primary', vp)).overflow);
      });
      await run('market-error', vp, f => { f.failTokens = true; }, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.toast--error');
        const t = await toastText(page);
        check(`error@${vp.w} My Tokens failure toast with Retry`, /Failed to load your tokens/.test(t) && (await page.locator('.toast__action').count()) === 1, t);
        await shot(page, 'marketplace-mytokens', vp, 'error-toast-retry');
        await audit(page, 'market:error-toast', vp);
        const pos = await page.locator('.toast-container').boundingBox();
        R.notes.push({ id: `toast-position@${vp.w}`, value: pos, vp: [vp.w, vp.h] });
        fx.failTokens = false; await page.locator('.toast__action').click(); await sleep(500);
        check(`error@${vp.w} Retry reloads tokens`, (await cardsVisible(page)) === 3);
      }, { expectErrors: true });
      await run('market-loading', vp, f => { f.delayMs.tokens = 2500; }, async (page, fx) => {
        await go(page, '/marketplace'); await sleep(300);
        check(`loading@${vp.w} loading bar visible while fetching`, (await page.locator('.loading-bar').count()) === 1);
        await shot(page, 'marketplace-mytokens', vp, 'loading');
        check(`loading@${vp.w} refresh disabled while loading`, await page.locator('.app-bar__refresh').isDisabled());
        await audit(page, 'market:loading', vp);
        await page.waitForSelector('.token-card', { timeout: 8000 });
      });

      // logout confirm dialog + toasts
      await run('market-logout', vp, null, async (page, fx) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        await page.locator('.logout-btn:visible').first().click(); await page.waitForSelector('.dialog');
        await sleep(200);
        await shot(page, 'confirm-dialog', vp, 'logout');
        const a = await audit(page, 'confirm-dialog', vp);
        check(`dialog@${vp.w} role=alertdialog with title`, /Log Out/.test(await page.locator('.dialog__title').innerText()) && (await page.locator('.dialog').getAttribute('role')) === 'alertdialog');
        const bh = await page.locator('.dialog__actions button').evaluateAll(b => b.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
        check(`dialog@${vp.w} buttons >= 44px tall`, bh.every(b => b[1] >= 44), JSON.stringify(bh));
        if (vp.w === 360) check('dialog@360 buttons stacked full-width', bh[0][0] === bh[1][0] && bh[0][0] > 200, JSON.stringify(bh));
        check(`dialog@${vp.w} no overflow`, !a.overflow);
        await page.keyboard.press('Escape'); await sleep(250);
        check(`dialog@${vp.w} Escape cancels (still on marketplace)`, (await page.locator('.dialog').count()) === 0 && page.url().endsWith('/marketplace'));
        await page.locator('.logout-btn:visible').first().click(); await page.waitForSelector('.dialog');
        await page.locator('.dialog__actions button').last().click(); await page.waitForURL('**/login');
        check(`dialog@${vp.w} confirm logs out -> /login and clears session`, await page.evaluate(() => !sessionStorage.getItem('investor_session')));
      });
    }

    // ============ 3b. QR / GET SERVICE ============
    for (const vp of VIEWPORTS) {
      const openQr = async page => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        await page.locator('.token-card:visible').first().locator('.tc-btn--green').click();
      };
      await run('qr', vp, null, async (page, fx) => {
        await openQr(page); await page.waitForSelector('.qr-modal__qr-img', { timeout: 8000 });
        await sleep(300);
        await shot(page, 'qr-modal', vp, 'waiting');
        const a = await audit(page, 'qr:waiting', vp);
        const m = await page.evaluate(([W, H]) => { const r = document.querySelector('.qr-modal').getBoundingClientRect(); const mm = document.querySelector('.qr-modal'); const q = document.querySelector('.qr-modal__qr-img').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, sh: mm.scrollHeight, ch: mm.clientHeight, qr: q.width, vh: H, vw: W }; }, [vp.w, vp.h]);
        check(`qr@${vp.w} modal within viewport`, m.top >= 0 && m.bottom <= m.vh + 1 && m.left >= 0 && m.right <= m.vw + 1, JSON.stringify(m));
        check(`qr@${vp.w} modal no internal scroll`, m.sh <= m.ch + 1, `sh=${m.sh} ch=${m.ch}`);
        if (vp.w === 360) check('qr@360 QR <= 240px wide', m.qr <= 240.5, String(m.qr));
        check(`qr@${vp.w} no overflow`, !a.overflow);
        // QR pixel colours: white background, dark modules (ink)
        const px = await page.evaluate(async () => { const img = document.querySelector('.qr-modal__qr-img'); await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let min = 765, dark = null; for (let i = 0; i < d.length; i += 4) { const s = d[i] + d[i + 1] + d[i + 2]; if (s < min) { min = s; dark = [d[i], d[i + 1], d[i + 2]]; } } const wrap = getComputedStyle(document.querySelector('.qr-modal__qr-wrap')).backgroundColor; return { corner: [d[0], d[1], d[2]], dark, wrap }; });
        check(`qr@${vp.w} QR light=white, dark modules=#172033`, px.corner.join() === '255,255,255' && px.dark.join() === '23,32,51', JSON.stringify(px));
        const sentToken = await page.evaluate(() => document.querySelector('.qr-modal__qr-img').src.length);
        check(`qr@${vp.w} negotiate hit mocked hub`, fx.calls.some(c => /hubs\/redemption\/negotiate/.test(c.p)));
        const cl = await page.locator('.qr-modal__close').boundingBox();
        check(`qr@${vp.w} close >= 44px`, cl.width >= 43.5 && cl.height >= 43.5, `${cl.width}x${cl.height}`);
        const cancel = await page.locator('.qr-modal__footer .qr-btn').boundingBox();
        check(`qr@${vp.w} cancel >= 44px tall`, cancel.height >= 43.5, String(cancel.height));
        check(`qr@${vp.w} visible waiting text`, /Waiting for company/.test(await page.locator('.qr-modal__hint').innerText()));
        // Escape behaviour (observation: designer said unchanged)
        await page.keyboard.press('Escape'); await sleep(250);
        R.notes.push({ id: `qr-escape-closes@${vp.w}`, value: (await page.locator('.qr-modal').count()) === 0 });
        if (await page.locator('.qr-modal').count()) {
          await page.mouse.click(3, 3); await sleep(250);
          check(`qr@${vp.w} backdrop click closes (cancel)`, (await page.locator('.qr-modal').count()) === 0);
          await openQr(page); await page.waitForSelector('.qr-modal__qr-img', { timeout: 8000 });
        }
        // success result via mocked hub
        fx.ws.send(JSON.stringify({ type: 1, target: 'ServiceResult', arguments: [{ success: true, message: 'Synthetic ok', remainingCount: 3, rowVersion: 9 }] }) + '\x1e');
        await page.waitForSelector('.toast--success', { timeout: 5000 });
        check(`qr@${vp.w} ServiceResult success closes modal + success toast`, (await page.locator('.qr-modal').count()) === 0 && /Service granted/.test(await toastText(page)));
        await shot(page, 'qr-modal', vp, 'result-success-toast');
        await audit(page, 'qr:success-toast', vp);
      });
      await run('qr-failure-result', vp, null, async (page, fx) => {
        await openQr(page); await page.waitForSelector('.qr-modal__qr-img', { timeout: 8000 }); await sleep(300);
        fx.ws.send(JSON.stringify({ type: 1, target: 'ServiceResult', arguments: [{ success: false, message: 'Synthetic: token already used' }] }) + '\x1e');
        await page.waitForSelector('.toast--error', { timeout: 5000 });
        check(`qr-fail@${vp.w} failure result shows error toast with server message`, /already used/.test(await toastText(page)));
        await shot(page, 'qr-modal', vp, 'result-failure-toast');
      });
      await run('qr-connecting', vp, f => { f.delayMs.negotiate = 2500; }, async (page, fx) => {
        await openQr(page); await page.waitForSelector('.qr-modal__state'); await sleep(300);
        check(`qr-conn@${vp.w} connecting text visible`, /Connecting/.test(await page.locator('.qr-modal__state').innerText()));
        await shot(page, 'qr-modal', vp, 'connecting');
        await audit(page, 'qr:connecting', vp);
        await page.waitForSelector('.qr-modal__qr-img', { timeout: 8000 });
      });
      await run('qr-error-retry', vp, f => { f.negotiate = 'fail'; }, async (page, fx) => {
        await openQr(page); await page.waitForSelector('.qr-modal__state--error', { timeout: 10000 }); await sleep(300);
        check(`qr-err@${vp.w} error text + Try Again + Close`, (await page.locator('.qr-modal__state--error p').innerText()).length > 5 && (await page.locator('.qr-modal__state-actions button').count()) === 2);
        await shot(page, 'qr-modal', vp, 'error');
        const a = await audit(page, 'qr:error', vp);
        const h = await page.locator('.qr-modal__state-actions button').evaluateAll(b => b.map(x => Math.round(x.getBoundingClientRect().height)));
        check(`qr-err@${vp.w} retry/close buttons >= 44px`, h.every(x => x >= 44), JSON.stringify(h));
        check(`qr-err@${vp.w} no overflow`, !a.overflow);
        fx.negotiate = 'ok'; await page.locator('.qr-btn--primary').click(); await page.waitForSelector('.qr-modal__qr-img', { timeout: 8000 });
        check(`qr-err@${vp.w} Try Again recovers to QR`, true);
        await page.locator('.qr-modal__footer .qr-btn').click(); await sleep(250);
        check(`qr-err@${vp.w} Cancel closes modal`, (await page.locator('.qr-modal').count()) === 0);
      }, { expectErrors: true });
    }

    // ============ 4. CART ============
    const cartSetup = f => { f.cart = [{ token: { ...f.primary[0], status: 3 } }, { token: { ...f.primary[1], status: 3 } }, { token: { ...f.secondary[0], status: 3 } }]; };
    await each('cart', cartSetup, async (page, fx, vp) => {
      await go(page, '/cart'); await page.waitForSelector('.cart-card');
      check(`cart@${vp.w} 3 cards`, (await page.locator('.cart-card').count()) === 3);
      await shot(page, 'cart', vp, 'populated', true);
      const a = await audit(page, 'cart:populated', vp);
      check(`cart@${vp.w} no overflow`, !a.overflow, JSON.stringify(a.overflow));
      const prices = await page.locator('.cart-card__price').allInnerTexts();
      check(`cart@${vp.w} prices rendered with currency`, prices.length === 3 && prices.every(p => /\d/.test(p)), JSON.stringify(prices));
      const rm = await page.locator('.cart-card__remove').first().boundingBox();
      check(`cart@${vp.w} remove button >= 44px`, rm.width >= 43.5 && rm.height >= 43.5, `${rm.width}x${rm.height}`);
      check(`cart@${vp.w} remove has aria-label`, (await page.locator('.cart-card__remove').first().getAttribute('aria-label')) === 'Remove from cart');
      const co = await page.locator('.cart-header__checkout').boundingBox();
      check(`cart@${vp.w} checkout button >= 44px tall`, co.height >= 43.5, String(co.height));
      // remove
      await page.locator('.cart-card__remove').first().click(); await sleep(500);
      const rc = fx.calls.find(c => /cancelincart/i.test(c.p));
      check(`cart@${vp.w} remove POST CancelInCart serviceTokenId+rowVersion`, rc && rc.q.serviceTokenId === fx.primary[0].id && rc.q.rowVersion === String(fx.primary[0].rowVersion), JSON.stringify(rc && rc.q));
      check(`cart@${vp.w} item removed from list`, (await page.locator('.cart-card').count()) === 2);
      await shot(page, 'cart', vp, 'after-remove');
      // checkout nav
      await page.locator('.cart-header__checkout').click(); await page.waitForURL('**/checkout');
      check(`cart@${vp.w} Checkout -> /checkout`, true);
    });
    await each('cart-empty', null, async (page, fx, vp) => {
      await go(page, '/cart'); await page.waitForSelector('.cart-empty');
      await shot(page, 'cart', vp, 'empty');
      const a = await audit(page, 'cart:empty', vp);
      check(`cart-empty@${vp.w} message + no overflow`, /Your cart is empty/.test(await page.locator('.cart-empty').innerText()) && !a.overflow);
      check(`cart-empty@${vp.w} checkout disabled`, await page.locator('.cart-header__checkout').isDisabled());
    });

    // ============ 5. CHECKOUT ============
    await each('checkout-summary', f => { cartSetup(f); }, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.summary');
      check(`checkout@${vp.w} summary lists 2 primary items (secondary excluded)`, (await page.locator('.summary__row').count()) === 2);
      check(`checkout@${vp.w} secondary note visible`, /secondary-market/.test(await page.locator('.summary__note').innerText()));
      const total = await page.locator('.summary__total-value').innerText();
      check(`checkout@${vp.w} total = sum of primary prices (1,250.50+120.00=1,370.50)`, /1,370\.50/.test(total), total);
      check(`checkout@${vp.w} saved masked card shown`, /4242/.test(await page.locator('.saved-card').innerText()));
      await shot(page, 'checkout', vp, 'summary', true);
      const a = await audit(page, 'checkout:summary', vp);
      check(`checkout@${vp.w} no overflow`, !a.overflow, JSON.stringify(a.overflow));
      const pay = await page.locator('.btn--pay').boundingBox();
      check(`checkout@${vp.w} Pay button >= 44px tall`, pay.height >= 43.5, String(pay.height));
      // saved card removal
      // dispatchEvent: at 360 the Remove button sits outside the visual viewport (overflow bug BUG-001), so a real tap is impossible there
      const rmBox = await page.locator('.saved-card__remove').boundingBox();
      check(`checkout@${vp.w} saved-card Remove button inside viewport width`, rmBox.x + rmBox.width <= vp.w + 1, JSON.stringify(rmBox));
      await page.locator('.saved-card__remove').dispatchEvent('click'); await sleep(400);
      check(`checkout@${vp.w} Remove saved card hides it + DELETE call`, (await page.locator('.saved-card').count()) === 0 && fx.calls.some(c => /deletepaymentmethod/i.test(c.p) && c.q.investorId === '7'));
      await sleep(3200);
      // pay -> paying (non-final)
      await page.locator('.btn--pay').click(); await page.waitForSelector('#flitt-stub', { timeout: 6000 });
      const init = JSON.parse(fx.calls.find(c => /initiateembeddedpaymentbatch/i.test(c.p)).body);
      check(`checkout@${vp.w} initiate body: tokens ids+rowVersion, investorPublicKey, saveCard`, init.tokens.length === 2 && init.tokens[0].serviceTokenId === fx.primary[0].id && init.tokens[0].rowVersion === fx.primary[0].rowVersion && init.investorPublicKey === fx.investor.publicKey && typeof init.saveCard === 'boolean', JSON.stringify(init));
      await sleep(300);
      await shot(page, 'checkout', vp, 'paying-widget');
      const a2 = await audit(page, 'checkout:paying', vp);
      check(`checkout@${vp.w} paying: no overflow`, !a2.overflow, JSON.stringify(a2.overflow));
      const box = await page.locator('#flitt-checkout').boundingBox();
      check(`checkout@${vp.w} widget container inside viewport width`, box.x >= 0 && box.x + box.width <= vp.w + 1, JSON.stringify(box));
      check(`checkout@${vp.w} widget not clipped (scrollHeight<=clientHeight or scrolls)`, await page.evaluate(() => { const e = document.querySelector('#flitt-checkout'); const o = getComputedStyle(e).overflowY; return e.scrollHeight <= e.clientHeight + 1 || ['auto', 'scroll'].includes(o); }));
      check(`checkout@${vp.w} not marked successful client-side while Processing`, (await page.locator('.checkout-state .icon--success').count()) === 0);
      check(`checkout@${vp.w} Back disabled during payment`, await page.locator('.checkout-header__back').isDisabled());
      // now flip to Succeeded
      fx.pay.statuses = [{ status: 'Succeeded', final: true }]; fx.pay.pollIdx = 0;
      await page.waitForSelector('.icon--success', { timeout: 8000 });
      check(`checkout@${vp.w} Succeeded -> Payment complete + Purchased badges`, /Payment complete/.test(await page.locator('.checkout-state h2').innerText()) && (await page.locator('.result-row__badge--success').count()) === 2);
      await shot(page, 'checkout', vp, 'done-success');
      const a3 = await audit(page, 'checkout:done-success', vp); check(`checkout@${vp.w} done: no overflow`, !a3.overflow);
    });
    await each('checkout-mixed', f => { cartSetup(f); f.pay.statuses = [{ status: 'Succeeded', final: true, itemStatuses: ['Succeeded', 'Failed'] }]; }, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.btn--pay');
      await page.locator('.btn--pay').click(); await page.waitForSelector('.result-list', { timeout: 10000 });
      const badges = await page.locator('.result-row__badge').allInnerTexts();
      check(`checkout-mixed@${vp.w} one Purchased, one Failed, heading Checkout finished`, badges.includes('Purchased') && badges.includes('Failed') && /Checkout finished/.test(await page.locator('.checkout-state h2').innerText()), JSON.stringify(badges));
      await shot(page, 'checkout', vp, 'done-mixed');
      const a = await audit(page, 'checkout:done-mixed', vp); check(`checkout-mixed@${vp.w} no overflow`, !a.overflow);
    });
    await each('checkout-cancelled', f => { cartSetup(f); f.pay.statuses = [{ status: 'Cancelled', final: true }]; }, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.btn--pay'); await page.locator('.btn--pay').click(); await page.waitForSelector('.result-list', { timeout: 10000 });
      check(`checkout-cancelled@${vp.w} all Cancelled, never success`, (await page.locator('.result-row__badge--success').count()) === 0 && (await page.locator('.result-row__badge--failed').allInnerTexts()).every(t => /Cancelled/.test(t)));
      await shot(page, 'checkout', vp, 'done-cancelled');
    });
    await each('checkout-initfail', f => { cartSetup(f); f.pay.initiateFail = true; }, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.btn--pay'); await page.locator('.btn--pay').click(); await page.waitForSelector('.toast--error');
      check(`checkout-initfail@${vp.w} error toast + back to summary`, /Could not start the payment/.test(await toastText(page)) && (await page.locator('.summary').count()) === 1, await toastText(page));
      await shot(page, 'checkout', vp, 'initiate-error-toast'); await audit(page, 'checkout:init-error', vp);
    }, { expectErrors: true });
    await each('checkout-empty', null, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.checkout-state h2');
      check(`checkout-empty@${vp.w} Nothing to pay for`, /Nothing to pay for/.test(await page.locator('.checkout-state h2').innerText()));
      await shot(page, 'checkout', vp, 'empty'); check(`checkout-empty@${vp.w} no overflow`, !(await audit(page, 'checkout:empty', vp)).overflow);
    });
    await each('checkout-loading', f => { cartSetup(f); f.delayMs.cart = 2500; }, async (page, fx, vp) => {
      await go(page, '/checkout'); await sleep(300);
      check(`checkout-loading@${vp.w} loading text`, /Loading your cart/.test(await page.locator('.checkout-state').innerText()));
      await shot(page, 'checkout', vp, 'loading'); await audit(page, 'checkout:loading', vp);
      await page.waitForSelector('.summary', { timeout: 8000 });
    });
    await each('checkout-pending', f => { cartSetup(f); }, async (page, fx, vp) => {
      await go(page, '/checkout'); await page.waitForSelector('.btn--pay'); await page.locator('.btn--pay').click(); await page.waitForSelector('#flitt-stub', { timeout: 8000 });
      await page.clock.fastForward(610000); await page.waitForSelector('.icon--pending', { timeout: 8000 });
      check(`checkout-pending@${vp.w} Still processing + Check again`, /Still processing/.test(await page.locator('.checkout-state h2').innerText()) && (await page.locator('.checkout-state .btn--primary').innerText()).includes('Check again'));
      await shot(page, 'checkout', vp, 'pending');
      const a = await audit(page, 'checkout:pending', vp); check(`checkout-pending@${vp.w} no overflow`, !a.overflow);
    }, { clock: true });

    // ============ 6. PAYMENT RETURN ============
    const seedSession = async (page, fx) => {
      await page.addInitScript(([it, pk]) => { sessionStorage.setItem('checkout_session', JSON.stringify({ publicKey: pk, items: it, saveCard: true, currentOrderId: 'SYNTH-ORDER-1', currentToken: 'x', results: [] })); }, [[{ tokenId: fx.primary[0].id, rowVersion: 1, productName: 'Monthly Yoga Pass', companyName: 'Blue Harbor Fitness', price: 49.9 }, { tokenId: fx.primary[1].id, rowVersion: 1, productName: 'Premium Massage', companyName: 'Nordlicht', price: 1250.5 }], fx.investor.publicKey]);
      fx.pay.itemIds = [fx.primary[0].id, fx.primary[1].id];
    };
    await each('return-verifying', null, async (page, fx, vp) => {
      await seedSession(page, fx); fx.pay.statuses = [{ status: 'Processing', final: false }];
      await go(page, '/payment/return'); await page.waitForSelector('.spinner'); await sleep(300);
      check(`return-verifying@${vp.w} Confirming text`, /Confirming your payment/.test(await page.locator('.return-card h1').innerText()));
      await shot(page, 'payment-return', vp, 'verifying'); check(`return-verifying@${vp.w} no overflow`, !(await audit(page, 'return:verifying', vp)).overflow);
      const gs = fx.calls.find(c => /payment\/getstatus/i.test(c.p)); check(`return-verifying@${vp.w} polls GetStatus?orderId`, gs && gs.q.orderId === 'SYNTH-ORDER-1');
    });
    await each('return-success', null, async (page, fx, vp) => {
      await seedSession(page, fx); fx.pay.statuses = [{ status: 'Succeeded', final: true }];
      await go(page, '/payment/return'); await page.waitForSelector('.result-list', { timeout: 8000 });
      check(`return-success@${vp.w} Payment complete from API status`, /Payment complete/.test(await page.locator('.return-card h1').innerText()) && (await page.locator('.result-row__badge--success').count()) === 2);
      await shot(page, 'payment-return', vp, 'success'); const a = await audit(page, 'return:success', vp); check(`return-success@${vp.w} no overflow`, !a.overflow);
      check(`return-success@${vp.w} session cleared`, await page.evaluate(() => !sessionStorage.getItem('checkout_session')));
    });
    await each('return-failed', null, async (page, fx, vp) => {
      await seedSession(page, fx); fx.pay.statuses = [{ status: 'Failed', final: true }];
      await go(page, '/payment/return'); await page.waitForSelector('.result-list', { timeout: 8000 });
      check(`return-failed@${vp.w} Checkout finished + Failed badges, no success`, /Checkout finished/.test(await page.locator('.return-card h1').innerText()) && (await page.locator('.result-row__badge--success').count()) === 0);
      await shot(page, 'payment-return', vp, 'failed'); const a = await audit(page, 'return:failed', vp); check(`return-failed@${vp.w} no overflow`, !a.overflow);
    });
    await each('return-pending', null, async (page, fx, vp) => {
      await seedSession(page, fx); fx.pay.statuses = [{ status: 'Processing', final: false }];
      await go(page, '/payment/return'); await page.waitForSelector('.spinner');
      await page.clock.fastForward(610000); await page.waitForSelector('.icon--pending', { timeout: 8000 });
      check(`return-pending@${vp.w} Still processing + Check again`, /Still processing/.test(await page.locator('.return-card h1').innerText()));
      await shot(page, 'payment-return', vp, 'pending'); const a = await audit(page, 'return:pending', vp); check(`return-pending@${vp.w} no overflow`, !a.overflow);
      check(`return-pending@${vp.w} session preserved for retry`, await page.evaluate(() => !!sessionStorage.getItem('checkout_session')));
    }, { clock: true });
    await run('return-nosession', VIEWPORTS[2], null, async (page) => {
      await go(page, '/payment/return'); await sleep(500);
      check('return without session -> /marketplace', page.url().endsWith('/marketplace'), page.url());
    });

    // ============ 7. TOKEN DETAIL (reachable only via router state) ============
    for (const [tab, st, name] of [['primaryMarket', 1, 'primary'], ['yourTokens', 1, 'mytokens-available'], ['secondaryMarket', 1, 'secondary']]) {
      await each('token-' + name, null, async (page, fx, vp) => {
        await go(page, '/marketplace'); await page.waitForSelector('.token-card');
        const tok = tab === 'secondaryMarket' ? fx.secondary[0] : tab === 'primaryMarket' ? fx.primary[1] : { ...fx.mine[0], status: 1 };
        await openTokenPage(page, tok, tab, fx.investor.publicKey);
        await shot(page, 'token-detail', vp, name, true);
        const a = await audit(page, 'token:' + name, vp);
        check(`token-${name}@${vp.w} no overflow`, !a.overflow, JSON.stringify(a.overflow));
        const ab = await page.locator('.action-bar__btn').evaluateAll(b => b.map(x => Math.round(x.getBoundingClientRect().height)));
        check(`token-${name}@${vp.w} action buttons >= 44px`, ab.every(h => h >= 44), JSON.stringify(ab));
        // action bar must not cover content: last section visible after scroll
        const cover = await page.evaluate(() => { const bar = document.querySelector('.action-bar').getBoundingClientRect(); const pg = document.scrollingElement; pg.scrollTop = pg.scrollHeight; const last = [...document.querySelectorAll('.detail-section')].pop().getBoundingClientRect(); return { barTop: bar.top, lastBottom: last.bottom, pos: getComputedStyle(document.querySelector('.action-bar')).position }; });
        check(`token-${name}@${vp.w} last section not hidden under fixed action bar`, cover.pos !== 'fixed' || cover.lastBottom <= cover.barTop + 1, JSON.stringify(cover));
      });
    }
    await run('token-qr', VIEWPORTS[0], null, async (page, fx, vp) => {
      await go(page, '/marketplace'); await page.waitForSelector('.token-card');
      const tok = { ...fx.mine[0], status: 1 };
      await openTokenPage(page, tok, 'yourTokens', fx.investor.publicKey);
      await page.locator('.action-bar__btn', { hasText: 'Get Service' }).click(); await page.evaluate(() => window.ng.applyChanges(window.ng.getComponent(document.querySelector('app-token-detail')))); await page.waitForSelector('.qr-modal', { timeout: 8000 }); await sleep(300);
      // Harness limit: the injected token page is not zone-driven, so the modal stays in its "Connecting…" state here.
      // Connected/QR/error states of the same component are covered from the marketplace scenarios.
      await shot(page, 'qr-modal', vp, 'from-token-detail-connecting');
      check('token-qr@360 QR modal opens from detail page and fits', await page.evaluate(() => { const m = document.querySelector('.qr-modal'); return m.scrollHeight <= m.clientHeight + 1; }));
    });

    // ============ 8. KEYBOARD FOCUS ============
    for (const [route, setup, label] of [['/login', null, 'login'], ['/marketplace', null, 'marketplace'], ['/cart', cartSetup, 'cart'], ['/', null, 'home']]) {
      await run('focus-' + label, VIEWPORTS[2], setup, async (page, fx, vp) => {
        await go(page, route); await sleep(500);
        const bad = []; let n = 0;
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const r = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); const ow = parseFloat(cs.outlineWidth); const hasOutline = cs.outlineStyle !== 'none' && ow > 0 && cs.outlineColor !== 'rgba(0, 0, 0, 0)'; const hasShadow = cs.boxShadow !== 'none'; let n = e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''); return { n, ok: hasOutline || hasShadow, vis: r.width > 0, outline: cs.outline, shadow: cs.boxShadow.slice(0, 60) }; });
          if (!r) continue; n++; if (r.vis && !r.ok) bad.push(r.n + ' :: ' + r.outline);
        }
        check(`focus ${label}: every tabbed control shows an outline/box-shadow ring (${n} stops)`, bad.length === 0 && n > 3, JSON.stringify([...new Set(bad)]));
        await shot(page, 'focus-' + label, vp, 'tabbed');
      });
    }
    // focus ring colour is blue-ish
    await run('focus-colour', VIEWPORTS[2], null, async (page, fx) => {
      await go(page, '/login'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      const o = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { outline: cs.outlineColor, shadow: cs.boxShadow }; });
      R.notes.push({ id: 'focus-ring-sample-login', value: o });
    }, { login: false });

  } finally {
    await browser.close(); srv.stop();
  }
  R.runs = RUNS;
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(R, null, 1));
  const f = R.checks.filter(c => !c.ok);
  console.log(`\nDONE checks=${R.checks.length} pass=${R.checks.length - f.length} fail=${f.length} shots=${R.shots.length}`);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
