// Summarise results.json audits (deduped). Usage: node summarize.cjs [category]
const r = require('./results.json');
const cat = process.argv[2];
const agg = {};
for (const a of r.audits) {
  for (const k of ['small', 'colors', 'contrast', 'unlabeled', 'clipped', 'fonts', 'offscreen']) {
    if (cat && cat !== k) continue;
    for (const it of a[k]) {
      let key;
      if (k === 'small') key = `${it.el} "${it.text}" ${it.inlineLink ? '[inline-link]' : ''}${it.disabled ? '[disabled]' : ''}`;
      else if (k === 'colors') key = `${it.el} ${it.prop} ${it.val} (${it.hue}) "${it.text}"`;
      else if (k === 'contrast') key = `${it.el} ${it.fg} on ${it.bg} need ${it.need} ${it.disabled ? '[disabled]' : ''}${it.bgImage ? '[bgimg]' : ''} "${it.text}"`;
      else if (k === 'unlabeled') key = `${it.el} ph="${it.placeholder}"`;
      else if (k === 'clipped') key = `${it.el} sw=${it.sw} cw=${it.cw} "${it.text}"`;
      else if (k === 'fonts') key = `${it.el} ${it.fs}px "${it.text}"`;
      else key = `${it.el}`;
      const kk = k + '|' + key;
      const o = agg[kk] || (agg[kk] = { k, key, labels: new Set(), widths: new Set(), sizes: new Set(), ratios: new Set() });
      o.labels.add(a.label); o.widths.add(a.w); if (k === 'small') o.sizes.add(`${it.w}x${it.h}@${a.w}`); if (k === 'contrast') o.ratios.add(it.ratio);
    }
  }
}
for (const o of Object.values(agg).sort((a, b) => a.k.localeCompare(b.k))) {
  console.log(`[${o.k}] ${o.key} | w=${[...o.widths].join('/')} | ${[...o.sizes].slice(0, 3).join(',')}${[...o.ratios].join(',')} | ${[...o.labels].slice(0, 3).join(';')}${o.labels.size > 3 ? '…+' + (o.labels.size - 3) : ''}`);
}
