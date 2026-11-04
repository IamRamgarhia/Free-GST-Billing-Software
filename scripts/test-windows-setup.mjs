#!/usr/bin/env node
// End-to-end test of the real, compiled Windows Setup (v1.10.84) - every run
// in the Setup's TEST MODE (/TESTROOT=<a new folder in TEMP>), so nothing
// real on this PC is used: no real books, icons, start-up items, uninstall
// entries or ports (the test uses 47461-47462).
//
//   node scripts/build-installer.mjs                      (the Setup to test)
//   node scripts/build-installer.mjs --skip-build --version=1.10.99 --outDir=release-build/upgrade-test
//   node scripts/test-windows-setup.mjs [--setup=<exe>] [--upgrade=<exe>] [--keep]
//
// Scenarios (each in its own test folder):
//   A  no earlier copy: new books; the app starts from the installed node.exe;
//      the in-app "Update now" installs the newer Setup; uninstall keeps the
//      books; installing again finds them; uninstall /DELETEBOOKS=yes.
//   B  an earlier ZIP copy (DiceCodes demo, 3 invoices, running, with Desktop
//      and Startup icons): "keep"; a second server on the same books is
//      refused; update; uninstall.
//   C  the same earlier copy: "move" (copy + check); update; uninstall.
// The earlier copy is hashed (SHA-256 of every file) before and after each
// install, update and uninstall: the Setup must never change one byte of it.
//
// --keep leaves the test folders for a look (they are in TEMP).

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') || d;
const SETUP = path.resolve(arg('setup', path.join(ROOT, 'release-build', 'Free-GST-Billing-Windows-Setup.exe')));
const UPGRADE = path.resolve(arg('upgrade', path.join(ROOT, 'release-build', 'upgrade-test', 'Free-GST-Billing-Windows-Setup.exe')));
const NEW_PORT = 47461;
const OLD_PORT = 47462;
const FORBIDDEN = [47371, 47372, 47373, 47398];
const TEST_APP_ID = 'FreeGSTBilling-TEST_is1';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-setup-e2e-'));

let passed = 0, failed = 0;
const proofs = [];
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (cmd) => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { encoding: 'utf8' }).trim();
if (FORBIDDEN.includes(NEW_PORT) || FORBIDDEN.includes(OLD_PORT)) throw new Error('test ports');
if (!BASE.toLowerCase().startsWith(os.tmpdir().toLowerCase())) throw new Error('The test folder must be in TEMP');
for (const f of [SETUP, UPGRADE]) if (!fs.existsSync(f)) { console.error(`Missing ${f} - see the build commands at the top of this file.`); process.exit(1); }

// ---------------------------------------------------------------- helpers
function listFiles(dir, rel = '', out = []) {
  let entries = [];
  try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) listFiles(dir, r, out); else out.push(r);
  }
  return out;
}
// Every file of a folder with its SHA-256; and one SHA-256 over all of that.
function fingerprint(dir) {
  const lines = listFiles(dir).sort().map((r) => `${r} ${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex')}`);
  return { lines, files: lines.length, hash: crypto.createHash('sha256').update(lines.join('\n')).digest('hex') };
}
function diff(a, b) {
  const sa = new Set(a.lines); const sb = new Set(b.lines);
  return [...a.lines.filter((l) => !sb.has(l)).map((l) => `- ${l.split(' ')[0]}`), ...b.lines.filter((l) => !sa.has(l)).map((l) => `+ ${l.split(' ')[0]}`)];
}
function proof(label, before, after) {
  proofs.push(`${label}: ${before.files} files ${before.hash.slice(0, 16)}... -> ${after.files} files ${after.hash.slice(0, 16)}... ${before.hash === after.hash ? 'IDENTICAL' : 'CHANGED'}`);
  ok(before.hash === after.hash, `${label}: the earlier copy is byte-for-byte unchanged (${after.files} files, SHA-256 ${after.hash.slice(0, 16)}...)`, diff(before, after).slice(0, 10).join(' '));
}
async function answers(port, path_ = '/api/version') {
  try { const r = await fetch(`http://127.0.0.1:${port}${path_}`, { signal: AbortSignal.timeout(2000) }); return r.ok ? r : null; } catch { return null; }
}
async function until(fn, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(500)) { const v = await fn(); if (v) return v; }
  return null;
}
const version = async (port) => (await (await answers(port))?.json())?.current;
const bills = async (port) => (await (await answers(port, '/api/bills'))?.json() || []).length;
const uninstallKeys = () => { try { return execFileSync('reg', ['query', UNINSTALL_KEY], { encoding: 'utf8' }).split(/\r?\n/).filter((l) => l.startsWith('HKEY')).map((l) => l.split('\\').pop()).sort(); } catch { return []; } };
// A listener: remote end 0.0.0.0:0, whatever the state word (some Windows builds print CLOSED).
const listenerPid = (port) => (execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).split(/\r?\n/).find((l) => new RegExp(`:${port}\\s+0\\.0\\.0\\.0:0\\s`).test(l)) || '').trim().split(/\s+/).pop() || '';
// The real icons: names and times only (read, never opened or changed).
const realIcons = () => ps("foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Startup'))) { Get-ChildItem -LiteralPath $d -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName + ' ' + $_.LastWriteTimeUtc.Ticks } }");
const lnk = (file) => ps(`$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${file.replace(/'/g, "''")}'); $s.TargetPath + ' ' + $s.Arguments`);
const nodePathOf = (pid) => ps(`(Get-Process -Id ${Number(pid)}).Path`);

function runSetup(exe, root, extra = []) {
  const log = path.join(root, 'logs', `setup-${Date.now()}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const r = spawnSync(exe, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/TESTROOT=${root}`, `/PORT=${NEW_PORT}`, `/LOG=${log}`, ...extra], { encoding: 'utf8' });
  return { code: r.status, log };
}
async function runUninstall(root, extra = []) {
  const app = path.join(root, 'Programs', 'Free GST Billing');
  spawnSync(path.join(app, 'unins000.exe'), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', ...extra]);
  // The uninstaller hands itself to a copy in TEMP and returns at once.
  return until(() => !fs.existsSync(path.join(app, 'unins000.exe')) && !uninstallKeys().includes(TEST_APP_ID), 90000);
}
function startInstalled(root) {
  const app = path.join(root, 'Programs', 'Free GST Billing');
  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(app, 'start-windows.ps1'), '-NoWindow'],
    { env: { ...process.env, FREEGSTBILL_TEST: '1' }, encoding: 'utf8', timeout: 120000 });
}
const started = [];
function startNode(serverJs, env = {}) {
  const c = spawn(process.execPath, [serverJs], { cwd: path.dirname(serverJs), env: { ...process.env, FGSB_HOME: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  c.out = ''; c.stdout.on('data', (d) => { c.out += d; }); c.stderr.on('data', (d) => { c.out += d; });
  c.done = new Promise((r) => c.on('exit', (code) => r(code)));
  started.push(c);
  return c;
}
// Every node.exe a test started inside the test folder: stopped at the end.
function stopTestServers() {
  for (const c of started) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  ps(`Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 | Where-Object { $_.ExecutablePath -and $_.CommandLine -and $_.CommandLine.ToLower().Contains('${BASE.toLowerCase().replace(/'/g, "''")}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);
}

// An earlier ZIP copy: the release layout + DiceCodes demo books (3 invoices,
// one saved PDF, one file in Trash), its server running from its own folder,
// a Desktop icon on its launcher and a Startup icon - all inside root.
let zipStage = null;
async function makeOldZipCopy(root) {
  if (!zipStage) {
    zipStage = path.join(BASE, 'zip-stage');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-release-zip.mjs'), `--outDir=${zipStage}`, '--no-zip'], { stdio: 'ignore' });
  }
  const old = path.join(root, 'Downloads', 'Free-GST-Billing');
  fs.cpSync(path.join(zipStage, 'Free-GST-Billing'), old, { recursive: true });
  const sys = path.join(old, '_system');
  fs.writeFileSync(path.join(sys, 'data', 'port.txt'), String(OLD_PORT));
  fs.mkdirSync(path.join(sys, 'Trash'), { recursive: true });
  fs.writeFileSync(path.join(sys, 'Trash', 'deleted-note.txt'), 'demo');
  const srv = startNode(path.join(sys, 'server.js'));
  if (!await until(() => answers(OLD_PORT), 30000)) throw new Error(`The earlier copy did not start: ${srv.out}`);
  const post = (p, body, q = '') => fetch(`http://127.0.0.1:${OLD_PORT}${p}${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await post('/api/profile', { businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW', state: 'Karnataka', address: 'Bengaluru' });
  await post('/api/clients', { id: 'c1', name: 'Demo Client', gstin: '29AAAAA0000A1Z5' });
  for (const n of [1, 2, 3]) {
    await post('/api/bills', { id: `INV-00${n}`, invoiceNumber: `INV-00${n}`, invoiceDate: `2026-11-0${n}`, clientName: 'Demo Client', status: 'unpaid', totalAmount: n * 1180, payments: [], items: [],
      data: { profile: { businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW' }, details: { invoiceNumber: `INV-00${n}` }, client: { name: 'Demo Client' }, totals: { total: n * 1180 } } });
  }
  await fetch(`http://127.0.0.1:${OLD_PORT}/api/save-pdf?name=INV-001.pdf&client=Demo%20Client&month=November%202026`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: '%PDF-1.4 DiceCodes demo' });
  await sleep(7000); // the daily backup (5 s after start) is the server's last write
  const icons = (dir, name, target, args) => ps(`New-Item -ItemType Directory -Force -Path '${dir}' | Out-Null; $s = (New-Object -ComObject WScript.Shell).CreateShortcut('${path.join(dir, name)}'); $s.TargetPath = '${target}'; $s.Arguments = '${args.replace(/'/g, "''")}'; $s.Save()`);
  icons(path.join(root, 'Desktop'), 'Free GST Billing.lnk', 'C:\\Windows\\System32\\mshta.exe', `"${path.join(old, 'Free GST Billing - WINDOWS.hta')}"`);
  icons(path.join(root, 'Startup'), 'Free GST Billing.lnk', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', `-NoProfile -File "${path.join(sys, 'start-windows.ps1')}" -AppWindow -Hidden`);
  return { old, sys, srv };
}

function checkInstallFiles(root, home, logDir, label) {
  const app = path.join(root, 'Programs', 'Free GST Billing');
  ok(fs.readFileSync(path.join(app, 'home.txt'), 'utf8').replace(/^\uFEFF/, '').trim() === home, `${label}: home.txt -> ${home}`);
  ok(fs.existsSync(path.join(app, 'node', 'node.exe')) && fs.existsSync(path.join(app, 'node_modules', 'express', 'package.json')), `${label}: node.exe and the server packages are installed`);
  ok(!fs.existsSync(path.join(app, 'update-windows.ps1')) && !fs.existsSync(path.join(app, 'data')), `${label}: no ZIP updater and no books in the program folder`);
  ok(/testroot=/.test(fs.readFileSync(path.join(app, 'installed.txt'), 'utf8')), `${label}: installed.txt marks a Setup copy (test mode)`);
  ok(uninstallKeys().includes(TEST_APP_ID) && !uninstallKeys().includes('FreeGSTBilling_is1'), `${label}: only the TEST uninstall entry (${TEST_APP_ID}) exists`);
  ok(fs.existsSync(path.join(logDir, 'Free GST Billing - install log.txt')), `${label}: install log in ${logDir}`);
}

// ---------------------------------------------------------------- run
const realBefore = { keys: uninstallKeys(), icons: realIcons(), p47373: listenerPid(47373) };
console.log(`\nTest folders under ${BASE}\nSetup: ${SETUP}\nUpdate: ${UPGRADE}\n`);
try {
  // ======== A: no earlier copy =========================================
  console.log('A. New books, update from inside the app, uninstall');
  const A = path.join(BASE, 'A');
  const docsA = path.join(A, 'Documents', 'Free GST Billing');
  let r = runSetup(SETUP, A, ['/DATAMODE=new']);
  ok(r.code === 0, 'A: silent install exit 0', r.log);
  checkInstallFiles(A, docsA, docsA, 'A');
  ok(await until(() => answers(NEW_PORT), 90000), `A: the app answers on test port ${NEW_PORT}`);
  const lockA = JSON.parse(fs.readFileSync(path.join(docsA, 'data', 'server.lock'), 'utf8'));
  ok(nodePathOf(lockA.pid).toLowerCase() === path.join(A, 'Programs', 'Free GST Billing', 'node', 'node.exe').toLowerCase(), 'A: served by the installed node.exe');
  ok(/<div id="root"/.test(await (await answers(NEW_PORT, '/')).text()), 'A: serves the app page');
  ok(fs.existsSync(path.join(A, 'Desktop', 'Free GST Billing.lnk')) && fs.existsSync(path.join(A, 'Programs', 'Free GST Billing.lnk')) && !fs.existsSync(path.join(A, 'Startup', 'Free GST Billing.lnk')),
    'A: Desktop and Start-menu icons (in the test folder), no Startup icon');
  ok(/start-windows\.ps1" -AppWindow -Hidden/.test(lnk(path.join(A, 'Desktop', 'Free GST Billing.lnk'))), 'A: the icon opens the app in its own window');
  const status = await (await answers(NEW_PORT, '/api/control-panel/status')).json();
  ok(status.installed === true && status.actions.update === true && status.actions.move === false, 'A: the app knows it is a Setup copy (update by Setup, no Move)');
  fs.copyFileSync(UPGRADE, path.join(A, 'Free-GST-Billing-Windows-Setup.exe'));
  const vBefore = await version(NEW_PORT);
  const up = await (await fetch(`http://127.0.0.1:${NEW_PORT}/api/control-panel/launch-script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"update"}' })).json();
  ok(up.ok && up.installer, 'A: "Update now" starts the new Setup', JSON.stringify(up));
  const vAfter = await until(async () => { const v = await version(NEW_PORT); return v && v !== vBefore ? v : null; }, 240000);
  ok(vAfter === '1.10.99', `A: after "Update now" the app answers as ${vAfter} (was ${vBefore})`);
  ok(fs.readFileSync(path.join(A, 'Programs', 'Free GST Billing', 'home.txt'), 'utf8').includes(docsA), 'A: the update kept home.txt');
  fs.writeFileSync(path.join(docsA, 'data', 'bills', 'A-1.json'), JSON.stringify({ id: 'A-1' }));
  ok(await runUninstall(A), 'A: silent uninstall finished, uninstall entry gone');
  ok(!fs.existsSync(path.join(A, 'Desktop', 'Free GST Billing.lnk')) && !fs.existsSync(path.join(A, 'Programs', 'Free GST Billing.lnk')), 'A: icons removed');
  ok(fs.existsSync(path.join(docsA, 'data', 'bills', 'A-1.json')), 'A: the books are kept by default');
  ok(!await answers(NEW_PORT), 'A: the app was stopped');
  r = runSetup(SETUP, A, ['/NOSTART=1']);
  ok(r.code === 0 && fs.readFileSync(path.join(A, 'Programs', 'Free GST Billing', 'home.txt'), 'utf8').includes(docsA), 'A: installing again finds the kept books and uses them (silent default: keep)');
  ok(await runUninstall(A, ['/DELETEBOOKS=yes']), 'A: uninstall with /DELETEBOOKS=yes');
  // The books are deleted in the uninstaller's very last step.
  ok(await until(() => !fs.existsSync(path.join(docsA, 'data')), 30000) && fs.existsSync(path.join(docsA + ' Setup', 'Free GST Billing - install log.txt')), 'A: ...deletes data/ (only after that explicit yes); the install log stays');

  // ======== B: keep ====================================================
  console.log('\nB. An earlier ZIP copy: keep the books where they are');
  const B = path.join(BASE, 'B');
  const oldB = await makeOldZipCopy(B);
  const docsB = path.join(B, 'Documents', 'Free GST Billing');
  const h0 = fingerprint(oldB.old);
  r = runSetup(SETUP, B, ['/DATAMODE=keep', '/NOSTART=1']);
  ok(r.code === 0, 'B: silent install (keep) exit 0', r.log);
  ok(await oldB.srv.done.then(() => true), 'B: the earlier copy\'s server was stopped (by its process id)');
  proof('B install (keep)', h0, fingerprint(oldB.old));
  checkInstallFiles(B, oldB.sys, docsB, 'B');
  const backB = listFiles(path.join(docsB, 'Old shortcuts (backup)'));
  ok(backB.includes('Desktop - Free GST Billing.lnk') && backB.includes('Startup - Free GST Billing.lnk'), `B: both old icons MOVED to the backup folder (${backB.join(', ')})`);
  ok(/start-windows\.ps1/.test(lnk(path.join(B, 'Desktop', 'Free GST Billing.lnk'))) && lnk(path.join(B, 'Desktop', 'Free GST Billing.lnk')).includes(path.join(B, 'Programs')), 'B: the new Desktop icon opens the new app');
  ok(fs.existsSync(path.join(B, 'Startup', 'Free GST Billing.lnk')), 'B: the old copy opened at start-up, so the new one does too');
  ok(listFiles(path.join(docsB, 'Setup backups')).some((f) => /^books-before-setup-.*\.zip$/.test(f)), 'B: a backup ZIP of the old data is in the NEW folder');
  startInstalled(B);
  ok(await bills(OLD_PORT) === 3, 'B: the installed app shows the 3 invoices, from the old folder');
  const second = startNode(path.join(oldB.sys, 'server.js'));
  const secondCode = await Promise.race([second.done, sleep(20000).then(() => 'still running')]);
  ok(secondCode === 0 && /already running/.test(second.out), 'B: the OLD server started on the same books refuses (one server per books)', `${secondCode} ${second.out}`);
  await sleep(7000);
  const h1 = fingerprint(oldB.old);
  console.log(`     (the running app itself wrote in the books it uses: ${diff(h0, h1).join(', ') || 'nothing'})`);
  r = runSetup(UPGRADE, B, ['/NOSTART=1']);
  ok(r.code === 0 && !await answers(OLD_PORT), 'B: update (1.10.99) installed; it stopped the app');
  proof('B update', h1, fingerprint(oldB.old));
  startInstalled(B);
  ok(await version(OLD_PORT) === '1.10.99' && await bills(OLD_PORT) === 3, 'B: updated app 1.10.99 still has the 3 invoices');
  await sleep(7000);
  const h2 = fingerprint(oldB.old);
  ok(await runUninstall(B), 'B: uninstall finished');
  proof('B uninstall', h2, fingerprint(oldB.old));
  ok(listFiles(path.join(oldB.sys, 'data', 'bills')).length === 3, 'B: the 3 invoices are still in the old folder');

  // ======== C: move ====================================================
  console.log('\nC. An earlier ZIP copy: copy the books to Documents');
  const C = path.join(BASE, 'C');
  const oldC = await makeOldZipCopy(C);
  const docsC = path.join(C, 'Documents', 'Free GST Billing');
  const c0 = fingerprint(oldC.old);
  r = runSetup(SETUP, C, ['/DATAMODE=move']);
  ok(r.code === 0, 'C: silent install (move) exit 0', r.log);
  proof('C install (move)', c0, fingerprint(oldC.old));
  checkInstallFiles(C, docsC, docsC, 'C');
  const same = ['data', 'Saved Invoices', 'Trash'].every((f) => {
    const a = fingerprint(path.join(oldC.sys, f)); const b = fingerprint(path.join(docsC, f));
    return a.files > 0 && a.lines.every((l) => b.lines.includes(l));
  });
  ok(same, 'C: data, Saved Invoices and Trash copied - every file with the same SHA-256');
  const logC = fs.readFileSync(path.join(docsC, 'Free GST Billing - install log.txt'), 'utf8');
  ok(/every file checked: same count, same sizes, same SHA-256/.test(logC) && /Moved the old shortcut/.test(logC), 'C: the install log says what was copied, checked and moved');
  ok(await until(async () => (await bills(OLD_PORT)) === 3, 90000), 'C: the installed app shows the 3 invoices, from the copy');
  proof('C after the app started on the copy', c0, fingerprint(oldC.old));
  r = runSetup(UPGRADE, C);
  ok(r.code === 0, 'C: update (1.10.99) exit 0');
  ok(await until(async () => (await version(OLD_PORT)) === '1.10.99', 90000) && await bills(OLD_PORT) === 3, 'C: updated app 1.10.99 with the 3 invoices');
  proof('C update', c0, fingerprint(oldC.old));
  ok(await runUninstall(C), 'C: uninstall finished');
  proof('C uninstall', c0, fingerprint(oldC.old));
  ok(listFiles(path.join(docsC, 'data', 'bills')).length === 3, 'C: the copied books are kept after uninstall');
} catch (e) {
  failed++;
  console.log(`  FAIL ${e.stack || e.message}`);
} finally {
  stopTestServers();
  await sleep(1000);
  for (const root of ['A', 'B', 'C']) {
    const app = path.join(BASE, root, 'Programs', 'Free GST Billing');
    if (fs.existsSync(path.join(app, 'unins000.exe'))) await runUninstall(path.join(BASE, root));
  }
}

console.log('\nThis PC (nothing real may change):');
ok(JSON.stringify(uninstallKeys()) === JSON.stringify(realBefore.keys), `Windows' uninstall list is as before (${realBefore.keys.length} entries, no FreeGSTBilling*)`, uninstallKeys().filter((k) => /freegst/i.test(k)).join(','));
ok(realIcons() === realBefore.icons, 'The real Desktop, Start-menu and Startup icons are as before (names and times)');
ok(listenerPid(47373) === realBefore.p47373, `Port 47373 (the real app) has the same process as before (${realBefore.p47373 || 'none'})`);

console.log('\nHash proof (SHA-256 over every file of the earlier copy):');
for (const p of proofs) console.log(`  ${p}`);
if (!process.argv.includes('--keep')) fs.rmSync(BASE, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
