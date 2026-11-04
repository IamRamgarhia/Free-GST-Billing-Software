// v1.10.84 - the Windows Setup's pure pieces, on a throw-away folder tree:
// where the books are (home), finding an earlier copy, the "move" copy and
// its byte-for-byte check, the backup ZIP, and the one-server lock decision.
// The rule they all serve: an earlier installation is only ever READ.
//
// Run: `node scripts/installer-test.mjs`

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { resolveAppHome } from '../src/utils/appHome.js';
import { spawnSync } from 'child_process';
import { lockIsLive, acquireLock, readLock, releaseLock, writeLock } from '../src/utils/serverLock.js';
import { allowedDownloadUrl, checkSetupBytes, setupAssetFrom } from '../src/utils/setupDownload.js';
import { findOldInstalls, copyBooks, verifyCopy, backupZip, zipEntries, listFiles, chooseCopyPort, pruneAppFiles, makeDirs, checkWritable } from '../installer/setup-helper.mjs';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
function throws(fn, re, label) {
  try { fn(); failed++; console.log(`  FAIL ${label} (no error)`); }
  catch (e) { if (re.test(e.message)) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label}: ${e.message}`); } }
}

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-installer-test-'));
const put = (p, text = '{}') => { fs.mkdirSync(path.dirname(path.join(T, p)), { recursive: true }); fs.writeFileSync(path.join(T, p), text); };
const at = (p) => path.join(T, p);
// Every file and its SHA-256: the "was it touched?" proof.
const fingerprint = (dir) => [...listFiles(dir).keys()].sort().map((r) => `${r}:${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex')}`).join('\n');
const APP_PKG = JSON.stringify({ name: 'free-gst-billing-software', version: '1.10.80' });

try {
  // ---- home ----------------------------------------------------------
  put('app1/server.js', '');
  eq(resolveAppHome(at('app1'), {}), at('app1'), 'No FGSB_HOME, no home.txt: the books are next to server.js (the ZIP)');
  fs.mkdirSync(at('books1'));
  put('app1/home.txt', `\uFEFF  ${at('books1')}  \r\nsecond line ignored\r\n`);
  eq(resolveAppHome(at('app1'), {}), at('books1'), 'home.txt (BOM, spaces, CRLF): its first line');
  eq(resolveAppHome(at('app1'), { FGSB_HOME: at('app1') }), at('app1'), 'FGSB_HOME wins over home.txt');
  put('app1/home.txt', '   \r\n');
  eq(resolveAppHome(at('app1'), {}), at('app1'), 'An empty home.txt: next to server.js');
  put('app1/home.txt', 'books1');
  throws(() => resolveAppHome(at('app1'), {}), /full folder path/, 'A relative home is refused');
  put('app1/home.txt', at('no-such-folder'));
  throws(() => resolveAppHome(at('app1'), {}), /not there/, 'A missing books folder is refused (not silently started empty)');

  // ---- finding an earlier copy ----------------------------------------
  // A ZIP copy: Downloads/Free-GST-Billing/_system with 3 invoices.
  const zipRoot = 'Downloads/Free-GST-Billing';
  put(`${zipRoot}/Free GST Billing - WINDOWS.hta`, '');
  put(`${zipRoot}/_system/server.js`, '');
  put(`${zipRoot}/_system/package.json`, APP_PKG);
  put(`${zipRoot}/_system/start-windows.ps1`, '');
  for (const n of [1, 2, 3]) put(`${zipRoot}/_system/data/bills/INV-${n}.json`, JSON.stringify({ id: `INV-${n}`, total: n * 1000 }));
  put(`${zipRoot}/_system/data/profile.json`, JSON.stringify({ businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW' }));
  put(`${zipRoot}/_system/Saved Invoices/General/INV-1.pdf`, '%PDF-1.4 demo');
  put(`${zipRoot}/_system/data/backups/2026-11-01/bills/INV-1.json`, '{}');
  const zipSys = at(`${zipRoot}/_system`);
  const fromHta = findOldInstalls([at(`${zipRoot}/Free GST Billing - WINDOWS.hta`)]);
  eq(fromHta.map((f) => [f.sys, f.home, f.invoices]), [[zipSys, zipSys, 3]], 'A launcher shortcut (.hta) leads to the ZIP copy and its 3 invoices');
  eq(findOldInstalls([path.join(zipSys, 'start-windows.ps1')]).length, 1, 'So does an app icon (_system\\start-windows.ps1)');
  // A source checkout run from a shortcut deep inside it (the maintainer's own).
  put('repo/server.js', '');
  put('repo/package.json', APP_PKG);
  put('repo/data/clients/c1.json');
  eq(findOldInstalls([at('repo/release-templates/_system-scripts/start-windows.ps1').replace('start-windows.ps1', '')]).length, 0, 'A path that does not exist is ignored');
  fs.mkdirSync(at('repo/release-templates/_system-scripts'), { recursive: true });
  eq(findOldInstalls([at('repo/release-templates/_system-scripts')]).map((f) => f.home), [at('repo')], 'A folder up to 4 levels inside a copy finds it');
  // Another project with a server.js is not this app.
  put('other/server.js', '');
  put('other/package.json', JSON.stringify({ name: 'something-else' }));
  put('other/data/bills/x.json');
  eq(findOldInstalls([at('other')]).length, 0, 'Another program\'s server.js is not an earlier copy');
  // A copy with no books is not offered.
  put('empty/_system/server.js', '');
  put('empty/_system/package.json', APP_PKG);
  fs.mkdirSync(at('empty/_system/data/bills'), { recursive: true });
  eq(findOldInstalls([at('empty')]).length, 0, 'A copy without any books is not offered');
  // Books kept after an uninstall (no server.js) count only when named.
  put('Documents/Free GST Billing/data/bills/a.json');
  eq(findOldInstalls([at('Documents/Free GST Billing')]).map((f) => [f.sys, f.invoices]), [[null, 1]], 'A books folder on its own, named directly');
  eq(findOldInstalls([at('Documents/Free GST Billing/data/bills/a.json')]).length, 0, '...but not found by walking up from a file in it');
  // A copy installed by the Setup: its home.txt says where its books are.
  put('Programs/Free GST Billing/server.js', '');
  put('Programs/Free GST Billing/package.json', APP_PKG);
  put('Programs/Free GST Billing/home.txt', at('Documents/Free GST Billing'));
  eq(findOldInstalls([at('Programs/Free GST Billing')]).map((f) => f.home), [at('Documents/Free GST Billing')], 'A Setup copy: its books are where its home.txt says');
  eq(findOldInstalls([at('Programs/Free GST Billing')], { newAppDir: at('Programs/Free GST Billing') }).length, 0, 'The copy being installed now is never "an earlier copy"');
  const all = findOldInstalls([at('repo'), zipSys, at(zipRoot), at('Documents/Free GST Billing')]);
  eq(all.map((f) => f.invoices).sort(), [0, 1, 3], 'Several: each books folder once');
  eq(findOldInstalls([zipSys, at('repo')], { testRoot: at('Downloads') }).map((f) => f.home), [zipSys], 'Test mode: nothing outside the test folder is even looked at');

  // ---- move = copy + check every file ----------------------------------
  const before = fingerprint(at(zipRoot));
  const v = copyBooks(zipSys, at('NewHome'));
  eq([v.ok, v.files], [true, 6], 'Copy: 6 files copied and checked (count, sizes, SHA-256)');
  eq([fingerprint(at('NewHome/data')), fingerprint(at('NewHome/Saved Invoices'))],
    [fingerprint(path.join(zipSys, 'data')), fingerprint(path.join(zipSys, 'Saved Invoices'))], 'The copy is identical file for file');
  eq(fingerprint(at(zipRoot)), before, 'The old installation is byte-for-byte unchanged after the copy');
  throws(() => copyBooks(zipSys, at('NewHome')), /already has files/, 'Copying onto books that are already there is refused');
  eq(fingerprint(at(zipRoot)), before, '...and the old installation is still unchanged');
  throws(() => copyBooks(zipSys, path.join(zipSys, 'data', 'x')), /inside/, 'A target inside the old folder is refused');
  // A copy that does not match is caught.
  fs.writeFileSync(at('NewHome/data/bills/INV-2.json'), '{"id":"INV-2","total":9999}');
  const bad = verifyCopy(zipSys, at('NewHome'));
  eq([bad.ok, bad.problems[0]], [false, 'different content: data/bills/INV-2.json'], 'A changed file is caught by its SHA-256 (same size, other bytes)');
  fs.rmSync(at('NewHome/data/bills/INV-3.json'));
  eq(verifyCopy(zipSys, at('NewHome')).problems.includes('missing: data/bills/INV-3.json'), true, 'A missing file is caught');

  // ---- backup ZIP --------------------------------------------------------
  const bz = backupZip(zipSys, at('NewHome2/Setup backups'), 'test');
  eq([path.basename(bz.zip), bz.files], ['books-before-setup-test.zip', 4], 'Backup ZIP of data/ (its own backups left out), read back: all 4 files in it');
  eq(zipEntries(bz.zip).map((e) => e.name).sort(), ['data/bills/INV-1.json', 'data/bills/INV-2.json', 'data/bills/INV-3.json', 'data/profile.json'], '...each under data/, with its content checked (CRC)');
  if (process.platform === 'win32') {
    const listed = spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-t', '-f', bz.zip], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
    eq(listed.length, 4, '...and Windows\' own tar.exe reads the same 4 files');
  }
  eq(fingerprint(at(zipRoot)), before, 'The old installation is unchanged after the backup (the ZIP is in the new folder)');

  // ---- the one-server lock: the decision (review M4) -------------------
  const now = 1_000_000;
  const alive = () => true;
  const dead = () => false;
  const silent = async () => null;                       // nothing answers on the port
  const says = (who) => async () => who;                 // /api/version answers with this identity
  const L = (o) => ({ pid: 7, port: 47461, at: 0, host: 'SHOP-PC', id: 'lock-a', ...o });
  const ctx = (o) => ({ selfPid: 1, selfHost: 'SHOP-PC', isAlive: alive, identify: silent, now, ...o });
  eq(await lockIsLive(null, ctx()), false, 'No lock: start');
  eq(await lockIsLive(L(), ctx({ isAlive: dead })), false, 'Its process is gone: a stale lock, taken over');
  eq(await lockIsLive(L(), ctx({ identify: says({ pid: 7, lockId: 'lock-a' }) })), 'running', 'The server on the lock\'s port says it is that process: refuse');
  eq(await lockIsLive(L(), ctx({ identify: says({ pid: 99, lockId: 'other' }) })), false, 'Something else answers on that port (another program, another copy): stale, not "running"');
  eq(await lockIsLive(L({ at: now - 5000, port: 0 }), ctx()), 'starting', 'Took the lock 5 s ago, not listening yet: still starting, refuse');
  eq(await lockIsLive(L({ at: now - 120000 }), ctx()), false, 'A live process that never answers as the lock\'s server (reused id, hung): stale');
  eq(await lockIsLive(L({ pid: 1 }), ctx()), false, 'Our own lock is not "another server"');
  eq(await lockIsLive(L({ host: 'OFFICE-PC' }), ctx({ isAlive: dead })), 'other-host', 'A lock from another PC (books on a shared drive) is never taken over, even if that process id is not running here');
  eq(await lockIsLive(L({ host: 'shop-pc' }), ctx({ isAlive: dead })), false, 'The same PC name in other letters is this PC');
  eq(await lockIsLive(L({ host: undefined }), ctx({ isAlive: dead })), false, 'A lock from 1.10.84 test builds (no host) counts as this PC');
  const lf = at('locktest/server.lock');
  fs.mkdirSync(path.dirname(lf));
  const a = await acquireLock(lf, { pid: 11, host: 'SHOP-PC', id: 'id-11', identify: silent });
  eq([a.ok, readLock(lf)?.id, readLock(lf)?.host], [true, 'id-11', 'SHOP-PC'], 'First server takes the lock: process id, PC name and a random id');
  const b = await acquireLock(lf, { pid: 12, host: 'SHOP-PC', id: 'id-12', identify: silent, isAlive: alive });
  eq([b.ok, b.reason], [false, 'starting'], 'A second server, while the first is starting: refused');
  eq(writeLock(lf, { pid: 12, port: 47461, at: Date.now(), host: 'SHOP-PC', id: 'id-12' }), false, 'A server never writes over a lock that is not its own');
  eq(writeLock(lf, { pid: 11, port: 47461, at: Date.now(), host: 'SHOP-PC', id: 'id-11' }), true, '...its own, yes (the port, once it listens)');
  eq((await acquireLock(lf, { pid: 12, host: 'SHOP-PC', id: 'id-12', identify: silent, isAlive: dead })).ok, true, 'The first one died: the second takes over');
  eq(readLock(lf)?.id, 'id-12', '...and the lock is now its');
  releaseLock(lf, 'id-11');
  eq(readLock(lf)?.id, 'id-12', 'A server never removes another server\'s lock');
  releaseLock(lf, 'id-12');
  eq(fs.existsSync(lf), false, 'Its own lock is removed when it stops');
  fs.writeFileSync(lf, JSON.stringify({ pid: 5, port: 47461, at: 0, host: 'OFFICE-PC', id: 'x' }));
  const c = await acquireLock(lf, { pid: 13, host: 'SHOP-PC', id: 'id-13', identify: silent, isAlive: dead });
  eq([c.ok, c.reason, readLock(lf)?.host], [false, 'other-host', 'OFFICE-PC'], 'Another PC\'s lock stays where it is: refused with that reason');
  fs.writeFileSync(lf, 'not json');
  eq((await acquireLock(lf, { pid: 13, host: 'SHOP-PC', id: 'id-13', identify: silent, isAlive: alive })).ok, true, 'A damaged lock file is taken over');

  // ---- review M3: a Setup copy without home.txt never falls back --------
  put('app2/server.js', '');
  put('app2/installed.txt', 'Installed by Free GST Billing Setup');
  throws(() => resolveAppHome(at('app2'), {}), /home\.txt/, 'Installed by the Setup but home.txt is missing: an error, not books in the program folder');
  put('app2/home.txt', '  ');
  throws(() => resolveAppHome(at('app2'), {}), /home\.txt/, '...or empty');
  eq(resolveAppHome(at('app2'), { FGSB_HOME: at('books1') }), at('books1'), '...FGSB_HOME still works');

  // ---- review H4: several earlier copies, newest change first ----------
  put('Two/old/_system/server.js', '');
  put('Two/old/_system/package.json', APP_PKG);
  for (const n of [1, 2, 3, 4]) put(`Two/old/_system/data/bills/O-${n}.json`);
  put('Two/new/_system/server.js', '');
  put('Two/new/_system/package.json', APP_PKG);
  put('Two/new/_system/data/bills/N-1.json');
  const t0 = new Date('2026-01-01T10:00:00Z');
  for (const n of [1, 2, 3, 4]) fs.utimesSync(at(`Two/old/_system/data/bills/O-${n}.json`), t0, t0);
  const two = findOldInstalls([at('Two/old'), at('Two/new')]);
  eq(two.map((f) => [path.basename(path.dirname(f.sys)), f.invoices]), [['new', 1], ['old', 4]], 'Two copies: the one changed last comes first (not the one with most invoices)');
  eq(two[1].changed, '2026-01-01', '...each with the date of its last change');

  // ---- review M1: a failed copy removes only what THIS run made ---------
  put('Pre/data/bills/.keep-dir/readme.txt', 'someone else\'s file');
  fs.rmSync(at('Pre/data/bills/.keep-dir/readme.txt'));
  fs.mkdirSync(at('Pre/Trash'), { recursive: true });
  const unreadable = at('Unreadable/_system');
  put('Unreadable/_system/data/bills/U-1.json', '{"a":1}');
  // A source file that disappears mid-way: the copy fails after starting.
  const realCopy = fs.copyFileSync;
  let n = 0;
  fs.copyFileSync = (s, d, f) => { n += 1; if (n === 1) realCopy(s, d, f); else throw new Error('disk removed'); };
  put('Unreadable/_system/data/bills/U-2.json', '{"a":2}');
  try {
    throws(() => copyBooks(unreadable, at('Pre')), /disk removed/, 'A copy that fails half way says why');
  } finally { fs.copyFileSync = realCopy; }
  eq([fs.existsSync(at('Pre/data/bills/.keep-dir')), fs.existsSync(at('Pre/Trash')), listFiles(at('Pre')).size], [true, true, 0],
    '...and takes out only the files and folders it made itself: folders that were there before stay');

  // ---- review H2: the copy gets its own port ----------------------------
  eq(await chooseCopyPort({ oldPort: 47371, start: 47371, isFree: () => true }), 47372, 'The copy never gets the old copy\'s port');
  eq(await chooseCopyPort({ oldPort: 47371, start: 47371, isFree: (p) => p > 47374 }), 47375, '...nor one that is in use');
  eq(await chooseCopyPort({ oldPort: 47461, start: 47461, isFree: () => true, avoid: [47371, 47372, 47373, 47398] }), 47462, 'Test mode: from the test port up');

  // ---- review M5: old program files go only after the new ones are in ---
  put('App/dist/index.html', 'new');
  put('App/dist/assets/old-1234.js', 'stale');
  put('App/node_modules/express/index.js', 'new');
  put('App/node_modules/gone-package/index.js', 'stale');
  put('App/server.js', 'new');
  put('App/home.txt', 'C:\\books');
  const removed = pruneAppFiles(at('App'), new Set(['dist/index.html', 'node_modules/express/index.js', 'server.js']));
  eq([removed.sort(), fs.existsSync(at('App/home.txt')), fs.existsSync(at('App/node_modules/gone-package'))],
    [['dist/assets/old-1234.js', 'node_modules/gone-package/index.js'], true, false], 'After an update: only stale files in dist, node_modules and src go; home.txt and the rest stay');

  // ---- review M5: what the updater accepts ------------------------------
  eq(['https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/download/v1/x.exe', 'https://objects.githubusercontent.com/a', 'https://release-assets.githubusercontent.com/b',
    'http://github.com/x', 'https://evil.example/x', 'https://github.com.evil.example/x'].map(allowedDownloadUrl), [true, true, true, false, false, false], 'Downloads only over https, only from GitHub\'s release hosts');
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
  const sum = crypto.createHash('sha256').update(exe).digest('hex');
  eq(checkSetupBytes(exe, { size: 102, sha256: sum }), { ok: true, checked: 'size and SHA-256' }, 'The right size and SHA-256: accepted');
  eq(checkSetupBytes(exe, { size: 103, sha256: sum }).ok, false, 'Another size than GitHub says: refused');
  eq(checkSetupBytes(exe, { size: 102, sha256: 'f'.repeat(64) }).ok, false, 'Another SHA-256: refused');
  eq(checkSetupBytes(Buffer.from('<html>'), {}).ok, false, 'Not a Windows program (an error page): refused');
  eq(checkSetupBytes(exe, { size: 102 }), { ok: true, checked: 'size only (no SHA-256 published)' }, 'No SHA-256 published: the gap is said');
  eq(setupAssetFrom({ assets: [{ name: 'Free-GST-Billing.zip' }, { name: 'Free-GST-Billing-Windows-Setup.exe', size: 9, digest: `sha256:${sum}`,
    browser_download_url: 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/download/v1.10.85/Free-GST-Billing-Windows-Setup.exe' }] }),
  { url: 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/download/v1.10.85/Free-GST-Billing-Windows-Setup.exe', size: 9, sha256: sum }, 'The Setup is found in the release, with its size and SHA-256');
  eq(setupAssetFrom({ assets: [{ name: 'Free-GST-Billing-Windows-Setup.exe', browser_download_url: 'https://github.com/someone-else/x/releases/download/v1/Free-GST-Billing-Windows-Setup.exe' }] }), null, 'A Setup from another repository is never used');

  // ---- review M6: folder names with spaces, apostrophes and Hindi -------
  const odd = 'Rām\'s ‘Shop’ दुकान';
  put(`${odd}/old/_system/server.js`, '');
  put(`${odd}/old/_system/package.json`, APP_PKG);
  put(`${odd}/old/_system/data/bills/हिसाब-1.json`, '{"id":"1"}');
  put(`${odd}/old/_system/Saved Invoices/ग्राहक/INV 1.pdf`, '%PDF');
  const oddOld = at(`${odd}/old/_system`);
  const oddBefore = fingerprint(at(`${odd}/old`));
  eq(findOldInstalls([at(`${odd}/old`)]).map((f) => f.invoices), [1], 'Found in a folder named with spaces, \' ‘ ’ and Hindi letters');
  eq(copyBooks(oddOld, at(`${odd}/नई किताबें`)).ok, true, '...copied and checked there');
  const oddZip = backupZip(oddOld, at(`${odd}/नई किताबें/Setup backups`), 'odd');
  eq([oddZip.files, zipEntries(oddZip.zip).map((e) => e.name)], [1, ['data/bills/हिसाब-1.json']], '...and backed up to a ZIP there, Hindi file name and all, read back');
  eq(fingerprint(at(`${odd}/old`)), oddBefore, '...and that old copy is unchanged');
  // ---- folders Windows will not let us make (Controlled folder access) ----
  // Node's mkdirSync({ recursive: true }) hung for ever there (4 Nov 2026);
  // makeDirs goes one level at a time and fails at once with a hint.
  eq(makeDirs(at('mk/a/b')).map((d) => path.relative(T, d)), [path.join('mk'), path.join('mk', 'a'), path.join('mk', 'a', 'b')], 'makeDirs makes each missing folder and says which');
  eq(makeDirs(at('mk/a/b')), [], '...and nothing when it is there');
  put('mk/file.txt', 'x');
  const mkStart = Date.now();
  throws(() => makeDirs(at('mk/file.txt/sub')), /Controlled folder access/, 'A folder that cannot be made: a clear error naming Controlled folder access');
  eq(Date.now() - mkStart < 2000, true, '...at once, no hang');
  checkWritable(at('wr/new/place'));
  eq(fs.existsSync(at('wr')), false, 'checkWritable takes away the folders it made to test');
  throws(() => checkWritable(at('mk/file.txt/sub')), /did not let Setup/, 'checkWritable refuses where nothing can be written');

  if (process.platform === 'win32') {
    // Setup quotes paths the way Windows programs read them: "E:\" would end
    // in \" (an escaped quote), so a trailing backslash is doubled (iss Q()).
    const q = (s) => `"${s.endsWith('\\') ? `${s}\\` : s}"`;
    const args = ['E:\\', 'C:\\Users\\x\\Documents\\Free GST Billing', odd, ''];
    const got = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...args.map(q)],
      { encoding: 'utf8', windowsVerbatimArguments: true, argv0: `"${process.execPath}"` });
    eq(JSON.parse(got.stdout || 'null'), args, 'Quoted like Setup does, a program gets "E:\\", spaces, Hindi and an empty argument back exactly');
  }
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
