#!/usr/bin/env node
// Free GST Billing - the Windows Setup's helper (v1.10.84).
//
// installer/free-gst-billing.iss runs this with the node.exe it carries,
// unpacked to Setup's temp folder, before anything is installed:
//
//   node setup-helper.mjs detect <candidates.txt> <newAppDir> <testRoot or ""> <out.txt>
//   node setup-helper.mjs backup <oldHome> <toFolder> <out.txt>
//   node setup-helper.mjs copy   <oldHome> <newHome> <out.txt>
//
// The top rule (the maintainer's): nothing here ever writes, moves, renames
// or deletes anything inside an earlier installation. "detect" only reads,
// "backup" only reads it (the ZIP goes to the NEW folder), and "copy" only
// reads it and writes the new folder - and checks every copied file
// byte-for-byte (SHA-256) before the Setup switches over.
//
// Results go to <out.txt> as key=value lines, UTF-8 with a BOM (Inno Setup
// reads that); "log=" lines are added to the install log as they are.
// Exit code 0 = done, 1 = failed (the reason is in "error=").
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export const BOOK_FOLDERS = ['data', 'Saved Invoices', 'Trash'];
const APP_PACKAGE_NAME = 'free-gst-billing-software';
const WIN = process.platform === 'win32';

const norm = (p) => (WIN ? path.resolve(p).toLowerCase() : path.resolve(p));
export function isInside(child, parent) {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Every file below dir: Map(relative path -> size).
export function listFiles(dir) {
  const out = new Map();
  const walk = (d, rel) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (e.isFile()) out.set(r, fs.statSync(path.join(d, e.name)).size);
    }
  };
  walk(dir, '');
  return out;
}
const countJson = (dir) => { try { return fs.readdirSync(dir).filter((n) => n.endsWith('.json')).length; } catch { return 0; } };

// The folder holding a copy of this app's server (its package.json says so:
// a stray server.js of some other project never counts).
function isAppFolder(dir) {
  try {
    return fs.existsSync(path.join(dir, 'server.js'))
      && JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name === APP_PACKAGE_NAME;
  } catch { return false; }
}
// Its books folder: home.txt if it names one (a copy installed by this Setup
// before), else the folder itself. Same rule as src/utils/appHome.js.
function homeOf(sys) {
  try {
    const h = fs.readFileSync(path.join(sys, 'home.txt'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[0].trim();
    if (h) return path.isAbsolute(h) && isDir(h) ? path.resolve(h) : null;
  } catch { /* no home.txt */ }
  return sys;
}
// Books worth offering: invoices, clients or a business profile.
function hasBooks(home) {
  const data = path.join(home, 'data');
  return countJson(path.join(data, 'bills')) + countJson(path.join(data, 'clients')) + countJson(path.join(data, 'profiles')) > 0
    || fs.existsSync(path.join(data, 'profile.json'));
}

// One candidate path (a shortcut's script, its working folder, a usual
// folder) -> { sys, home } or null. From a file or folder, up to 4 levels up:
// a folder with the app's server.js, or one with _system\server.js (the ZIP).
// A books folder on its own (kept after an uninstall) only counts as given.
export function resolveCandidate(candidate) {
  let dir = candidate;
  try { if (!fs.statSync(candidate).isDirectory()) dir = path.dirname(candidate); } catch { return null; }
  for (let level = 0; level <= 4; level += 1) {
    for (const sys of [dir, path.join(dir, '_system')]) {
      if (isAppFolder(sys)) {
        const home = homeOf(sys);
        return home && hasBooks(home) ? { sys: path.resolve(sys), home } : null;
      }
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const own = !fs.existsSync(path.join(candidate, 'server.js')) && hasBooks(candidate);
  return own ? { sys: null, home: path.resolve(candidate) } : null;
}

// Earlier installations with books, most invoices first. Never the copy
// being installed now (newAppDir); in the Setup's test mode only inside
// testRoot, so a test can never find the real books on the PC.
export function findOldInstalls(candidates, { newAppDir, testRoot } = {}) {
  const found = new Map();
  for (const c of candidates) {
    if (!c || !path.isAbsolute(c)) continue;
    if (testRoot && !isInside(c, testRoot)) continue;
    const r = resolveCandidate(c);
    if (!r) continue;
    if (newAppDir && r.sys && norm(r.sys) === norm(newAppDir)) continue;
    if (testRoot && (!isInside(r.home, testRoot) || (r.sys && !isInside(r.sys, testRoot)))) continue;
    const key = norm(r.home);
    if (!found.has(key) || (!found.get(key).sys && r.sys)) found.set(key, { ...r, invoices: countJson(path.join(r.home, 'data', 'bills')) });
  }
  return [...found.values()].sort((a, b) => b.invoices - a.invoices);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Every file of the books in `from` is in `to` with the same size and the
// same SHA-256. Extra files in `to` do not matter.
export function verifyCopy(from, to) {
  const problems = [];
  let files = 0;
  let bytes = 0;
  for (const f of BOOK_FOLDERS) {
    const src = listFiles(path.join(from, f));
    const dst = listFiles(path.join(to, f));
    for (const [rel, size] of src) {
      files += 1;
      bytes += size;
      if (!dst.has(rel)) problems.push(`missing: ${f}/${rel}`);
      else if (dst.get(rel) !== size) problems.push(`different size: ${f}/${rel}`);
      else if (sha256(path.join(from, f, rel)) !== sha256(path.join(to, f, rel))) problems.push(`different content: ${f}/${rel}`);
    }
  }
  return { ok: problems.length === 0, files, bytes, problems };
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) { fs.copyFileSync(s, d, fs.constants.COPYFILE_EXCL); fs.utimesSync(d, fs.statSync(s).atime, fs.statSync(s).mtime); }
  }
}

// "Move my books": COPY data, Saved Invoices and Trash into `to`, then check
// the copy. `from` is only read. If `to` already holds books, or the check
// fails, nothing is switched: what this call copied is taken out of `to`
// again and the reason thrown.
export function copyBooks(from, to) {
  if (isInside(to, from) || isInside(from, to)) throw new Error(`The new books folder cannot be inside the old one, or the other way round: ${to}`);
  for (const f of BOOK_FOLDERS) {
    if (listFiles(path.join(to, f)).size) throw new Error(`${path.join(to, f)} already has files in it. Choose an empty folder; nothing was copied.`);
  }
  fs.mkdirSync(to, { recursive: true });
  const made = [];
  try {
    for (const f of BOOK_FOLDERS) {
      if (!isDir(path.join(from, f))) continue;
      made.push(f);
      copyDir(path.join(from, f), path.join(to, f));
    }
    const v = verifyCopy(from, to);
    if (!v.ok) throw new Error(`The copy did not match the original (${v.problems.slice(0, 3).join('; ')}).`);
    return v;
  } catch (e) {
    for (const f of made) fs.rmSync(path.join(to, f), { recursive: true, force: true });
    throw e;
  }
}

// A ZIP of the old data folder (its own daily backups and the server lock
// left out) in `toFolder` - never in the old folder. Made with Windows'
// tar.exe (ERR-014: never Compress-Archive), then read back: it must list
// every file.
export function backupZip(home, toFolder, stamp = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-')) {
  const data = path.join(home, 'data');
  const want = [...listFiles(data).keys()].filter((r) => !r.startsWith('backups/') && r !== 'server.lock');
  if (!want.length) return null;
  fs.mkdirSync(toFolder, { recursive: true });
  const zip = path.join(toFolder, `books-before-setup-${stamp}.zip`);
  const tar = WIN ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
  execFileSync(tar, ['-a', '-c', '-f', zip, '--exclude', 'data/backups', '--exclude', 'data/server.lock', '-C', home, 'data'], { stdio: 'pipe' });
  const listed = new Set(execFileSync(tar, ['-t', '-f', zip], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split(/\r?\n/).filter((l) => l && !l.endsWith('/')).map((l) => l.replace(/^data\//, '')));
  const missing = want.filter((r) => !listed.has(r));
  if (missing.length) throw new Error(`The backup ZIP is incomplete (${missing.length} files missing, e.g. ${missing[0]}).`);
  return { zip, files: want.length };
}

// ---------------------------------------------------------------- CLI
function writeOut(file, pairs) {
  const lines = pairs.map(([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, ' ')}`);
  fs.writeFileSync(file, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function main([cmd, ...rest]) {
  // The result file is always the last argument.
  const out = rest.length ? rest[rest.length - 1] : '';
  const args = rest.slice(0, -1);
  try {
    if (cmd === 'detect') {
      const [list, newAppDir, testRoot] = args;
      const candidates = fs.readFileSync(list, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const found = findOldInstalls(candidates, { newAppDir, testRoot: testRoot || '' });
      const best = found[0];
      const pairs = [['count', found.length]];
      if (best) pairs.push(['sys', best.sys || ''], ['home', best.home], ['invoices', best.invoices]);
      for (const f of found) pairs.push(['log', `Found books: ${f.home}${f.sys ? ` (app: ${f.sys})` : ''}, ${f.invoices} invoices`]);
      writeOut(out, pairs);
    } else if (cmd === 'backup') {
      const r = backupZip(args[0], args[1]);
      writeOut(out, r ? [['zip', r.zip], ['log', `Backup ZIP of ${path.join(args[0], 'data')}: ${r.zip} (${r.files} files, checked)`]]
        : [['zip', ''], ['log', `Nothing to back up in ${path.join(args[0], 'data')}`]]);
    } else if (cmd === 'copy') {
      const v = copyBooks(args[0], args[1]);
      writeOut(out, [['files', v.files], ['bytes', v.bytes],
        ['log', `Copied ${v.files} files (${v.bytes} bytes) from ${args[0]} to ${args[1]}; every file checked: same count, same sizes, same SHA-256. The old folder was only read.`]]);
    } else {
      throw new Error(`Unknown command "${cmd}"`);
    }
    return 0;
  } catch (e) {
    if (out) writeOut(out, [['error', e.message], ['log', `FAILED: ${e.message}`]]);
    console.error(e.message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
