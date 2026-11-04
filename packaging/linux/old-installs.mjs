// Free GST Billing - finds copies of the ZIP install under a home folder, so
// the .deb / AppImage can tell the user where their earlier books are.
//
// READ-ONLY: it lists folders and counts files. It never moves, copies,
// renames or changes anything in an earlier copy (users' real invoices).
//
//   node old-installs.mjs <home> <new FGSB_HOME>
// prints a notice (nothing when no earlier copy has books) and keeps the same
// text in <FGSB_HOME>/OLD-BOOKS-FOUND.txt so it can be read again later.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP = new Set(['node_modules', 'snap', 'proc', 'sys', 'dev']);

// Files in a folder, counted up to `limit` (a huge folder must not stall the launcher).
const countFiles = (dir, limit = 100000) => {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (n >= limit) return;
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.isFile()) n += 1;
    }
  };
  walk(dir);
  return n;
};

// An earlier copy: <root>/_system/server.js with at least one file in _system/data.
export function findOldInstalls(home, { maxDepth = 4 } = {}) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue; // symlinks are not followed
      const p = path.join(dir, e.name);
      if (e.name === '_system') {
        const files = fs.existsSync(path.join(p, 'server.js')) ? countFiles(path.join(p, 'data')) : 0;
        if (files > 0) found.push({ root: dir, system: p, dataDir: path.join(p, 'data'), files, pdfDir: path.join(p, 'Saved Invoices') });
        continue;
      }
      // Hidden folders hold caches and settings; the one-line install uses ~/.local/share.
      if (depth >= maxDepth || SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.local')) continue;
      walk(p, depth + 1);
    }
  };
  walk(path.resolve(home), 1);
  return found;
}

const q = (s) => `"${s.replace(/(["\\$`])/g, '\\$1')}"`;

export function noticeText(installs, newHome) {
  if (!installs.length) return '';
  const lines = [
    'Free GST Billing: books from an earlier copy of the app were found.',
    'They were NOT moved or changed. This app keeps its books in:',
    `  ${newHome}`,
    '',
  ];
  for (const i of installs) {
    lines.push(`Earlier copy: ${i.root}`);
    lines.push(`  Books (invoices, clients, settings): ${i.dataDir}  (${i.files} files)`);
    if (fs.existsSync(i.pdfDir)) lines.push(`  Saved invoice PDFs: ${i.pdfDir}`);
    lines.push('');
  }
  const i = installs[0];
  lines.push(
    'To use those books here (before you enter anything new in this app):',
    '  1. In this app open Control Panel and click Stop Server.',
    '  2. Open the Terminal and paste:',
    `     cp -a ${q(`${i.dataDir}/.`)} ${q(path.join(newHome, 'data'))}/`,
  );
  if (fs.existsSync(i.pdfDir)) lines.push(`     mkdir -p ${q(path.join(newHome, 'Saved Invoices'))} && cp -a ${q(`${i.pdfDir}/.`)} ${q(path.join(newHome, 'Saved Invoices'))}/`);
  lines.push(
    '  3. Open Free GST Billing again.',
    'This copies; the earlier copy stays exactly as it is.',
    'Or: in the earlier copy, Settings > Data Management > Export Backup, then import that file in this app.',
    `This note is kept in ${path.join(newHome, 'OLD-BOOKS-FOUND.txt')}`,
  );
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [home, newHome] = process.argv.slice(2);
  if (!home || !newHome) { console.error('usage: node old-installs.mjs <home> <FGSB_HOME>'); process.exit(2); }
  const text = noticeText(findOldInstalls(home), path.resolve(newHome));
  if (text) {
    console.log(text);
    try { fs.mkdirSync(newHome, { recursive: true }); fs.writeFileSync(path.join(newHome, 'OLD-BOOKS-FOUND.txt'), `${text}\n`); } catch { /* the notice was shown */ }
  }
}
