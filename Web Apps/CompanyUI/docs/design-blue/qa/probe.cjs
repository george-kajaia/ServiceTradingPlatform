// Ad-hoc style probe (not part of the suite): focus styling of login inputs.
const { chromium } = require('C:/Users/georg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:4312') ? r.continue() : r.abort());
  await p.goto('http://127.0.0.1:4312/login');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  console.log(await p.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { tag: e.tagName, outline: c.outline, shadow: c.boxShadow, border: c.borderColor, bg: c.backgroundColor }; }));
  await b.close();
})();
