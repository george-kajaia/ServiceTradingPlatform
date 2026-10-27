// Prints compact audit/console summary from results-<target>.json
const r = require('./results-' + (process.argv[2] || 'dev') + '.json');
const cats = process.argv[3] ? process.argv[3].split(',') : Object.keys(r.audits);
for (const c of cats) {
  const items = (r.audits[c] || []).filter(i => !(c === 'contrast' && i.kind === 'skipped'));
  console.log(`## ${c}: ${items.length}`);
  const grouped = {};
  for (const i of items) { const k = i.sig; (grouped[k] = grouped[k] || { w: [], kind: i.kind, states: new Set() }); grouped[k].w.push(i.w); i.states.forEach(s => grouped[k].states.add(s)); }
  for (const [k, v] of Object.entries(grouped).slice(0, 40)) console.log(`  [${v.kind}] ${k} @${[...new Set(v.w)].join('/')} in ${[...v.states].slice(0, 3).join(',')}${v.states.size > 3 ? '+' + (v.states.size - 3) : ''}`);
}
const ci = {}; for (const c of r.consoleIssues) { const k = c.kind + ': ' + c.text.slice(0, 110); ci[k] = (ci[k] || 0) + 1; }
console.log('## console/pageerror', JSON.stringify(ci, null, 1));
console.log('## failedReq', JSON.stringify(r.failedReq.slice(0, 10)));
console.log('## blocked', JSON.stringify(r.blocked), 'unmocked', JSON.stringify(r.unmocked));
