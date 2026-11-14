// Fails when a screen uses a spacing, grid or button class that no stylesheet
// defines: the class then does nothing (v1.10.86 - "gap-3" was never defined,
// so the boxes in More invoice details touched side by side).
// Other class names are often hooks for tests or print code, so only these
// kinds are checked.
import fs from 'node:fs';
import path from 'node:path';

const CHECKED = /^(gap|p[tblrxy]?|m[tblrxy]?|grid-cols|space-[xy]|btn|stat-icon)-/;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src');
const css = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const defined = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));

const missing = [];
for (const f of files.filter((x) => /\.jsx?$/.test(x))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/className="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && CHECKED.test(c) && !defined.has(c)) missing.push(`${c} (${path.basename(f)})`);
    }
  }
}

if (missing.length) {
  console.error(`Classes used but not defined in any stylesheet:\n  ${[...new Set(missing)].join('\n  ')}`);
  process.exit(1);
}
console.log('css-classes-test: every spacing / grid / button class is defined');
