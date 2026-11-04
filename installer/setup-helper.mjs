#!/usr/bin/env node
// Free GST Billing - the Windows Setup's helper (v1.10.84).
//
// installer/free-gst-billing.iss runs this with the node.exe it carries,
// unpacked to Setup's temp folder, before anything is installed:
//
//   node setup-helper.mjs detect <candidates.txt> <newAppDir> <testRoot or ""> <out.txt>
//   node setup-helper.mjs writable <folder> [<folder>...] <out.txt>
//   node setup-helper.mjs backup <oldHome> <toFolder> <out.txt>
//   node setup-helper.mjs copy   <oldHome> <newHome> <out.txt>
//   node setup-helper.mjs run-timed <program> <seconds> [<arg>...] <out.txt>
//        (Microsoft's WebView2 installer, with a time limit; never fails)
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
import net from 'net';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

export const BOOK_FOLDERS = ['data', 'Saved Invoices', 'Trash'];
const APP_PACKAGE_NAME = 'free-gst-billing-software';
const WIN = process.platform === 'win32';

const norm = (p) => (WIN ? path.resolve(p).toLowerCase() : path.resolve(p));
export function isInside(child, parent) {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Windows Security's "Controlled folder access" (ransomware protection) blocks
// unknown programs from writing in Documents, Desktop, Pictures... Node's
// mkdirSync({ recursive: true }) then loops for ever instead of failing (seen
// 4 Nov 2026 on the maintainer's PC: Setup stuck on "Preparing to install").
// So folders are made one level at a time, which fails at once.
export const BLOCKED_HINT = 'If Windows Security\'s "Controlled folder access" (ransomware protection) is on, it blocks this. '
  + 'Choose a folder outside Documents and Desktop (for example C:\\Users\\<your name>\\Free GST Billing), or allow the app in '
  + 'Windows Security > Virus & threat protection > Ransomware protection > Allow an app through Controlled folder access.';

// Makes dir and any missing parents; returns the folders it made, top first.
export function makeDirs(dir) {
  const missing = [];
  let d = path.resolve(dir);
  while (!fs.existsSync(d)) {
    missing.unshift(d);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  const made = [];
  for (const m of missing) {
    try { fs.mkdirSync(m); } catch (e) {
      throw new Error(`Windows did not let Setup make the folder ${m} (${e.code || e.message}). ${BLOCKED_HINT}`);
    }
    made.push(m);
  }
  return made;
}

// Can this app's node.exe write in dir? Makes it if needed, writes and deletes
// a small file, and takes away again only the folders it made itself.
export function checkWritable(dir) {
  const made = makeDirs(dir);
  const probe = path.join(dir, `.fgsb-write-check-${process.pid}.tmp`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (e) {
    throw new Error(`Windows did not let Setup write in ${dir} (${e.code || e.message}). ${BLOCKED_HINT}`);
  } finally {
    for (const m of made.reverse()) { try { fs.rmdirSync(m); } catch { /* has files now: keep */ } }
  }
}

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

// When the books last changed: the newest invoice file, else the data folder.
function lastChange(home) {
  let newest = 0;
  const bills = path.join(home, 'data', 'bills');
  try {
    for (const n of fs.readdirSync(bills)) newest = Math.max(newest, fs.statSync(path.join(bills, n)).mtimeMs);
  } catch { /* no invoices */ }
  if (!newest) { try { newest = fs.statSync(path.join(home, 'data')).mtimeMs; } catch { newest = 0; } }
  return newest;
}
const dayOf = (ms) => (ms ? new Date(ms).toLocaleDateString('sv-SE') : '');

// Earlier installations with books, the one changed last first (review H4:
// the Setup lists them all and the user picks; it never guesses). Never the
// copy being installed now (newAppDir); in the Setup's test mode only inside
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
    if (!found.has(key) || (!found.get(key).sys && r.sys)) {
      const ms = lastChange(r.home);
      found.set(key, { ...r, invoices: countJson(path.join(r.home, 'data', 'bills')), changed: dayOf(ms), ms });
    }
  }
  return [...found.values()].sort((a, b) => b.ms - a.ms).map(({ ms: _ms, ...rest }) => rest);
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

// Copies a folder, writing down every folder and file it creates (`made`),
// so a failure takes out exactly those and nothing else (review M1).
function copyDir(src, dst, made) {
  if (!fs.existsSync(dst)) { fs.mkdirSync(dst); made.dirs.push(dst); }
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, made);
    else if (e.isFile()) {
      fs.copyFileSync(s, d, fs.constants.COPYFILE_EXCL); // never over a file that was there
      made.files.push(d);
      fs.utimesSync(d, fs.statSync(s).atime, fs.statSync(s).mtime);
    }
  }
}

// Refuses a target that cannot take a copy, before anything is stopped or copied.
export function checkCopyTarget(from, to) {
  if (isInside(to, from) || isInside(from, to)) throw new Error(`The new books folder cannot be inside the old one, or the other way round: ${to}`);
  for (const f of BOOK_FOLDERS) {
    if (listFiles(path.join(to, f)).size) throw new Error(`${path.join(to, f)} already has files in it. Choose an empty folder; nothing was copied.`);
  }
}

// "Move my books": COPY data, Saved Invoices and Trash into `to`, then check
// the copy. `from` is only read. If `to` already holds books, or the check
// fails, nothing is switched: the files and folders THIS call made are taken
// out again (folders that were there before stay) and the reason thrown.
export function copyBooks(from, to) {
  checkCopyTarget(from, to);
  const made = { dirs: [], files: [] };
  try {
    made.dirs.push(...makeDirs(to));
    for (const f of BOOK_FOLDERS) {
      if (isDir(path.join(from, f))) copyDir(path.join(from, f), path.join(to, f), made);
    }
    const v = verifyCopy(from, to);
    if (!v.ok) throw new Error(`The copy did not match the original (${v.problems.slice(0, 3).join('; ')}).`);
    return v;
  } catch (e) {
    for (const f of made.files) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
    for (const d of made.dirs.reverse()) { try { fs.rmdirSync(d); } catch { /* not empty: someone else's files */ } }
    throw e;
  }
}

// Review H2: the copy gets a port of its own, never the old copy's (an old
// icon pinned somewhere would start the old server there, and the new app
// would open the OLD books). The first free port from `start`.
export async function chooseCopyPort({ oldPort, start, isFree, avoid = [] }) {
  for (let p = start; p < start + 200; p += 1) {
    if (p !== oldPort && !avoid.includes(p) && await isFree(p)) return p;
  }
  throw new Error('No free port was found for the copied books.');
}
export const portFree = (port) => new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', () => resolve(false));
  srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
});

// Review M5: after an update, the old version's program files that the new
// one does not have go - only now, once every new file is in place. Only in
// dist, node_modules and src; never anything else (home.txt, node, logs).
export function pruneAppFiles(appDir, keep) {
  const removed = [];
  for (const top of ['dist', 'node_modules', 'src']) {
    for (const rel of listFiles(path.join(appDir, top)).keys()) {
      const r = `${top}/${rel}`;
      if (!keep.has(r)) { fs.rmSync(path.join(appDir, top, rel), { force: true }); removed.push(r); }
    }
    const dropEmpty = (d) => {
      let entries = [];
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) if (e.isDirectory()) dropEmpty(path.join(d, e.name));
      if (d !== path.join(appDir, top)) { try { fs.rmdirSync(d); } catch { /* not empty */ } }
    };
    dropEmpty(path.join(appDir, top));
  }
  return removed;
}

// Does this app (any version) still answer on the books' port? Then its
// server was not stopped, and nothing may be copied or switched (review M6).
export async function stillServing(home) {
  let port = 0;
  try { port = parseInt(fs.readFileSync(path.join(home, 'data', 'port.txt'), 'utf8').trim(), 10); } catch { return false; }
  if (!port) return false;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(2000) });
    const j = await r.json();
    // A new-enough server says which books it serves; an older one cannot.
    return !!j?.current && (!j.books || norm(j.books) === norm(home));
  } catch {
    return false;
  }
}

// A ZIP of the old data folder (its own daily backups and the server lock
// left out) in `toFolder` - never in the old folder - then read back: every
// file must be in it and unpack with the right CRC. (Never Compress-Archive:
// ERR-014.) Written by this helper itself (Node's zlib), not tar.exe: Windows' tar.exe
// turns a path with Hindi letters (a Hindi user name) into "?????" and fails.
// Names are stored as UTF-8 (ZIP flag bit 11), so they survive too.
const DOS_EPOCH = new Date(1980, 0, 1);
function dosTime(d) {
  const t = d < DOS_EPOCH ? DOS_EPOCH : d;
  return { time: (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1),
    date: ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate() };
}
function writeZip(root, rels, outFile) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const rel of rels) {
    const file = path.join(root, rel);
    const raw = fs.readFileSync(file);
    const comp = zlib.deflateRawSync(raw);
    const crc = zlib.crc32(raw);
    const name = Buffer.from(rel, 'utf8');
    const { time, date } = dosTime(fs.statSync(file).mtime);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(head, name, comp);
    central.push(cen, name);
    offset += 30 + name.length + comp.length;
  }
  const cenSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(rels.length, 8); end.writeUInt16LE(rels.length, 10);
  end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(outFile, Buffer.concat([...parts, ...central, end]));
}

// Reads a ZIP back: every entry's name, unpacked and checked against its CRC.
export function zipEntries(zipFile) {
  const buf = fs.readFileSync(zipFile);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('The backup ZIP has no directory.');
  const out = [];
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0, n = buf.readUInt16LE(eocd + 10); i < n; i += 1) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const at = buf.readUInt32LE(p + 42);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const raw = zlib.inflateRawSync(buf.subarray(start, start + csize));
    if (zlib.crc32(raw) !== crc) throw new Error(`The backup ZIP is damaged at ${name}.`);
    out.push({ name, size: raw.length });
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}

export function backupZip(home, toFolder, stamp = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-')) {
  const data = path.join(home, 'data');
  const want = [...listFiles(data).keys()].filter((r) => !r.startsWith('backups/') && r !== 'server.lock').map((r) => `data/${r}`);
  if (!want.length) return null;
  makeDirs(toFolder);
  const zip = path.join(toFolder, `books-before-setup-${stamp}.zip`);
  writeZip(home, want, zip);
  const names = new Set(zipEntries(zip).map((e) => e.name));
  const missing = want.filter((r) => !names.has(r));
  if (missing.length) throw new Error(`The backup ZIP is incomplete (${missing.length} files missing, e.g. ${missing[0]}).`);
  return { zip, files: want.length };
}

// ---------------------------------------------------------------- CLI
function writeOut(file, pairs) {
  const lines = pairs.map(([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, ' ')}`);
  fs.writeFileSync(file, `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

async function main([cmd, ...rest]) {
  // The result file is always the last argument.
  const out = rest.length ? rest[rest.length - 1] : '';
  const args = rest.slice(0, -1);
  try {
    if (cmd === 'detect') {
      const [list, newAppDir, testRoot] = args;
      const candidates = fs.readFileSync(list, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const found = findOldInstalls(candidates, { newAppDir, testRoot: testRoot || '' });
      const pairs = [['count', found.length]];
      found.forEach((f, i) => pairs.push([`${i + 1}.sys`, f.sys || ''], [`${i + 1}.home`, f.home], [`${i + 1}.invoices`, f.invoices], [`${i + 1}.changed`, f.changed],
        ['log', `Found books: ${f.home}${f.sys ? ` (app: ${f.sys})` : ''}, ${f.invoices} invoices, last changed ${f.changed || '?'}`]));
      writeOut(out, pairs);
    } else if (cmd === 'check-copy') {
      checkCopyTarget(args[0], args[1]);
      writeOut(out, [['ok', 1]]);
    } else if (cmd === 'stopped') {
      if (await stillServing(args[0])) throw new Error(`The earlier copy is still running (it answers on its port). Close it, then run Setup again. Nothing was changed.`);
      writeOut(out, [['ok', 1], ['log', `Checked: the earlier copy's server no longer answers.`]]);
    } else if (cmd === 'writable') {
      for (const d of args) checkWritable(d);
      writeOut(out, [['ok', 1], ['log', `Checked: the app can write in ${args.join(' and ')}`]]);
    } else if (cmd === 'backup') {
      const r = backupZip(args[0], args[1]);
      writeOut(out, r ? [['zip', r.zip], ['log', `Backup ZIP of ${path.join(args[0], 'data')}: ${r.zip} (${r.files} files, checked)`]]
        : [['zip', ''], ['log', `Nothing to back up in ${path.join(args[0], 'data')}`]]);
    } else if (cmd === 'copy') {
      const [from, to, firstPort] = args;
      const v = copyBooks(from, to);
      let oldPort = 0;
      try { oldPort = parseInt(fs.readFileSync(path.join(from, 'data', 'port.txt'), 'utf8').trim(), 10) || 0; } catch { oldPort = 0; }
      // Setup passes 47371, or its test port in test mode (never a real one).
      const port = await chooseCopyPort({ oldPort, start: Number(firstPort) || 47371, isFree: portFree });
      makeDirs(path.join(to, 'data'));
      fs.writeFileSync(path.join(to, 'data', 'port.txt'), String(port));
      writeOut(out, [['files', v.files], ['bytes', v.bytes], ['port', port],
        ['log', `Copied ${v.files} files (${v.bytes} bytes) from ${from} to ${to}; every file checked: same count, same sizes, same SHA-256. The old folder was only read.`],
        ['log', `The copied books use port ${port} (the old copy used ${oldPort || 'none'}), so an old icon can never open them by mistake.`]]);
    } else if (cmd === 'run-timed') {
      // Runs a program with its arguments (no shell) and a time limit, and
      // reports how it ended; the Setup carries on whatever happened.
      const [program, seconds, ...programArgs] = args;
      const r = spawnSync(program, programArgs, { timeout: Number(seconds) * 1000, windowsHide: true });
      const how = r.error?.code === 'ETIMEDOUT' ? `did not finish within ${seconds} s` : r.error ? `could not run (${r.error.message})` : `finished with code ${r.status}`;
      writeOut(out, [['code', r.status ?? -1], ['log', `${path.basename(program)} ${programArgs.join(' ')}: ${how}`]]);
    } else if (cmd === 'prune') {
      const [appDir, manifest] = args;
      const keep = new Set(fs.readFileSync(manifest, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
      const removed = pruneAppFiles(appDir, keep);
      writeOut(out, [['removed', removed.length], ['log', `Removed ${removed.length} program files the new version no longer has.`]]);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
