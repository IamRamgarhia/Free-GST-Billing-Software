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
import { lockIsLive, acquireLock, readLock, releaseLock } from '../src/utils/serverLock.js';
import { findOldInstalls, copyBooks, verifyCopy, backupZip, listFiles } from '../installer/setup-helper.mjs';

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
  eq(all.map((f) => f.invoices), [3, 1, 0], 'Several: most invoices first, each books folder once');
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

  // ---- backup ZIP (Windows' tar.exe) -----------------------------------
  if (process.platform === 'win32') {
    const b = backupZip(zipSys, at('NewHome2/Setup backups'), 'test');
    eq([path.basename(b.zip), b.files], ['books-before-setup-test.zip', 4], 'Backup ZIP of data/ (its own backups left out), read back: all 4 files in it');
    eq(fingerprint(at(zipRoot)), before, 'The old installation is unchanged after the backup (the ZIP is in the new folder)');
  }

  // ---- the one-server lock: the decision -------------------------------
  const now = 1_000_000;
  const alive = () => true;
  const dead = () => false;
  const answers = async () => true;
  const silent = async () => false;
  eq(await lockIsLive(null, { selfPid: 1, answers }), false, 'No lock: start');
  eq(await lockIsLive({ pid: 7, port: 47461, at: now }, { selfPid: 1, isAlive: dead, answers, now }), false, 'Its process is gone: a stale lock, taken over');
  eq(await lockIsLive({ pid: 7, port: 47461, at: 0 }, { selfPid: 1, isAlive: alive, answers, now }), true, 'Running and answering: refuse to start');
  eq(await lockIsLive({ pid: 7, port: 0, at: now - 5000 }, { selfPid: 1, isAlive: alive, answers: silent, now }), true, 'Running, took the lock 5 s ago, not answering yet: still starting, refuse');
  eq(await lockIsLive({ pid: 7, port: 47461, at: now - 120000 }, { selfPid: 1, isAlive: alive, answers: silent, now }), false, 'A live process that never answers (reused id, hung): stale');
  eq(await lockIsLive({ pid: 1, port: 47461, at: now }, { selfPid: 1, isAlive: alive, answers, now }), false, 'Our own lock is not "another server"');
  const lf = at('locktest/server.lock');
  fs.mkdirSync(path.dirname(lf));
  eq((await acquireLock(lf, { pid: 11, answers: silent })).ok, true, 'First server takes the lock');
  eq((await acquireLock(lf, { pid: 12, answers: silent, isAlive: alive })).ok, false, 'A second server, while the first is starting: refused');
  eq((await acquireLock(lf, { pid: 12, answers: silent, isAlive: dead })).ok, true, 'The first one died: the second takes over');
  eq(readLock(lf)?.pid, 12, '...and the lock is now its');
  releaseLock(lf, 11);
  eq(readLock(lf)?.pid, 12, 'A server never removes another server\'s lock');
  releaseLock(lf, 12);
  eq(fs.existsSync(lf), false, 'Its own lock is removed when it stops');
  fs.writeFileSync(lf, 'not json');
  eq((await acquireLock(lf, { pid: 13, answers: silent, isAlive: alive })).ok, true, 'A damaged lock file is taken over');
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
