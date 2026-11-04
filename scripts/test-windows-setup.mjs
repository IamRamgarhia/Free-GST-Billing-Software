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
//   C  the same earlier copy: "move" (copy + check, its own port, taskbar pin
//      and Start-menu subfolder icons moved); update; the new icon never opens
//      the OLD copy's server on the old port; uninstall.
//   D  the one-line installer's copy in ...\Programs\Free GST Billing: the
//      Setup goes to "...\Free GST Billing App"; keep, update, uninstall;
//      D2 copy from there.
//   E  two earlier copies: a silent Setup without a choice stops; /OLDDIR picks.
//   F  "choose" refuses a folder without books; delete-my-books refuses the
//      Documents folder itself.
//   G  a test folder named with spaces, ' ‘ ’ and Hindi letters.
//   H  the app's own window (Free GST Billing.exe, WebView2), from an earlier
//      copy's books (copy): the Desktop icon opens it (title follows the page,
//      its profile in the test folder's LocalAppData); one window only;
//      "Update now" with the window open (driven in the real window over the
//      DevTools protocol: no reboot, same window, the page reloads as
//      1.10.99); the next start tidies up; no WebView2 -> the Edge fallback;
//      a server that cannot start -> the launcher's text in the window;
//      the tray: X hides it (app + server keep running, a one-time tip), a
//      second start shows it, Quit stops window and server, Task Manager's
//      End task really closes it, the Startup icon's /tray starts hidden;
//      uninstall with the window hidden near the clock closes it (its close
//      event) and removes its profile; WebView2 "missing" (test hook): the
//      installer is run with /silent /install and its failure is tolerated;
//      hidden, the page keeps running and its notifications show near the
//      clock; the tray menu's items; the server killed -> started again and
//      reloaded by the window; the jump list's /view=<screen>, also sent to
//      a running window.
//   Also: a second Setup while one runs does not run (A); old program files
//   go after the new ones are in (B).
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
const CDP_PORT = 47463; // H: the window's DevTools port (test only)
const FORBIDDEN = [47371, 47372, 47373, 47398];
const TEST_APP_ID = 'FreeGSTBilling-TEST_is1';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-setup-e2e-'));

let passed = 0, failed = 0;
const proofs = [];
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (cmd) => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { encoding: 'utf8' }).trim();
if ([NEW_PORT, OLD_PORT, CDP_PORT].some((p) => FORBIDDEN.includes(p))) throw new Error('test ports');
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
// A real install's entry (the maintainer's PC has one): every value, read only.
const realEntry = () => { try { return execFileSync('reg', ['query', `${UNINSTALL_KEY}\\FreeGSTBilling_is1`], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const uninstallKeys = () => { try { return execFileSync('reg', ['query', UNINSTALL_KEY], { encoding: 'utf8' }).split(/\r?\n/).filter((l) => l.startsWith('HKEY')).map((l) => l.split('\\').pop()).sort(); } catch { return []; } };
// A listener's process ids (remote port 0). Get-NetTCPConnection, not netstat: on
// Windows 10.0.28020 "netstat -p TCP" sometimes leaves a 127.0.0.1 listener out.
const listenerPid = (port) => ps(`@(Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Where-Object { $_.RemotePort -eq 0 } | ForEach-Object { $_.OwningProcess } | Select-Object -Unique) -join ','; exit 0`);
// The real icons: names and times only (read, never opened or changed).
const realIcons = () => ps("foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Startup'))) { Get-ChildItem -LiteralPath $d -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName + ' ' + $_.LastWriteTimeUtc.Ticks } }");
// Shortcuts are read and written through Shell.Application (Unicode), as Setup
// reads them: WScript.Shell turns paths into the ANSI code page.
const psq = (s) => s.replace(/['\u2018\u2019\u201A\u201B]/g, (c) => c + c);
const lnk = (file) => ps(`$l = (New-Object -ComObject Shell.Application).NameSpace('${psq(path.dirname(file))}').ParseName('${psq(path.basename(file))}').GetLink; $l.Path + ' ' + $l.Arguments`);
const nodePathOf = (pid) => ps(`(Get-Process -Id ${Number(pid)}).Path`);
// The app window (Free GST Billing.exe) processes of one program folder.
const hostPids = (app) => ps(`@(Get-Process -Name 'Free GST Billing' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.ToLower().StartsWith('${psq(app.toLowerCase())}\\') } | ForEach-Object { $_.Id }) -join ','`);
const aumidOf = (file) => ps(`(New-Object -ComObject Shell.Application).NameSpace('${psq(path.dirname(file))}').ParseName('${psq(path.basename(file))}').ExtendedProperty('System.AppUserModel.ID')`);
// Opens a shortcut as Explorer does (ShellExecute); the window gets this env.
const openIcon = (file, env = {}) => spawnSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${psq(file)}'`],
  { env: { ...process.env, FREEGSTBILL_TEST: '1', ...env } });
const readSmoke = (file) => {
  try { return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])); } catch { return null; }
};

function runSetup(exe, root, extra = []) {
  const log = path.join(root, 'logs', `setup-${Date.now()}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const r = spawnSync(exe, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/TESTROOT=${root}`, `/PORT=${NEW_PORT}`, `/LOG=${log}`, ...extra], { encoding: 'utf8' });
  return { code: r.status, log };
}
const appOf = (root, name = 'Free GST Billing') => path.join(root, 'Programs', name);
async function runUninstall(root, extra = [], app = appOf(root)) {
  spawnSync(path.join(app, 'unins000.exe'), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', ...extra]);
  // The uninstaller hands itself to a copy in TEMP and returns at once.
  return until(() => !fs.existsSync(path.join(app, 'unins000.exe')) && !uninstallKeys().includes(TEST_APP_ID), 90000);
}
function startInstalled(root, app = appOf(root)) {
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(app, 'start-windows.ps1'), '-NoWindow'],
    { env: { ...process.env, FREEGSTBILL_TEST: '1' }, encoding: 'utf8', timeout: 120000 });
}
const readPort = (home) => Number(fs.readFileSync(path.join(home, 'data', 'port.txt'), 'utf8').trim());
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
  ps(`Get-Process -Name 'Free GST Billing' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.ToLower().StartsWith('${psq(BASE.toLowerCase())}') } | Stop-Process -Force; exit 0`);
  ps(`Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 | Where-Object { $_.ExecutablePath -and $_.CommandLine -and $_.CommandLine.ToLower().Contains('${BASE.toLowerCase().replace(/['\u2018\u2019\u201A\u201B]/g, (c) => c + c)}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);
}

// An earlier ZIP copy: the release layout + DiceCodes demo books (3 invoices,
// one saved PDF, one file in Trash), its server running from its own folder,
// a Desktop icon on its launcher and a Startup icon - all inside root.
let zipStage = null;
const icon = (dir, name, target, args) => ps(`$t = Join-Path $env:TEMP ('fgsb-lnk-' + [guid]::NewGuid() + '.lnk'); $w = (New-Object -ComObject WScript.Shell).CreateShortcut($t); $w.TargetPath = 'C:\\Windows\\System32\\notepad.exe'; $w.Save(); [IO.Directory]::CreateDirectory('${psq(dir)}') | Out-Null; Move-Item -LiteralPath $t -Destination '${psq(path.join(dir, name))}' -Force; $l = (New-Object -ComObject Shell.Application).NameSpace('${psq(dir)}').ParseName('${psq(name)}').GetLink; $l.Path = '${target}'; $l.Arguments = '${psq(args)}'; $l.Save()`);
// opts: dir (default <root>\Downloads\Free-GST-Billing), running (its server
// started and the books made through it; else written as files), invoices,
// changed (the invoices' file time), icons (Desktop + Startup).
async function makeOldZipCopy(root, opts = {}) {
  const { dir, running = true, invoices = 3, changed, icons = true } = opts;
  if (!zipStage) {
    zipStage = path.join(BASE, 'zip-stage');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-release-zip.mjs'), `--outDir=${zipStage}`, '--no-zip'], { stdio: 'ignore' });
  }
  const old = dir || path.join(root, 'Downloads', 'Free-GST-Billing');
  fs.cpSync(path.join(zipStage, 'Free-GST-Billing'), old, { recursive: true });
  const sys = path.join(old, '_system');
  fs.writeFileSync(path.join(sys, 'data', 'port.txt'), String(OLD_PORT));
  fs.mkdirSync(path.join(sys, 'Trash'), { recursive: true });
  fs.writeFileSync(path.join(sys, 'Trash', 'deleted-note.txt'), 'demo');
  if (!running) {
    fs.mkdirSync(path.join(sys, 'data', 'bills'), { recursive: true });
    fs.writeFileSync(path.join(sys, 'data', 'profile.json'), JSON.stringify({ businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW' }));
    for (let n = 1; n <= invoices; n += 1) {
      const f = path.join(sys, 'data', 'bills', `INV-00${n}.json`);
      fs.writeFileSync(f, JSON.stringify({ id: `INV-00${n}`, invoiceNumber: `INV-00${n}`, invoiceDate: `2026-10-0${n}`, clientName: 'Demo Client', totalAmount: n * 1180 }));
      if (changed) fs.utimesSync(f, changed, changed);
    }
    return { old, sys, srv: null };
  }
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
  if (icons) {
    icon(path.join(root, 'Desktop'), 'Free GST Billing.lnk', 'C:\\Windows\\System32\\mshta.exe', `"${path.join(old, 'Free GST Billing - WINDOWS.hta')}"`);
    icon(path.join(root, 'Startup'), 'Free GST Billing.lnk', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', `-NoProfile -File "${path.join(sys, 'start-windows.ps1')}" -AppWindow -Hidden`);
  }
  return { old, sys, srv };
}

function checkInstallFiles(root, home, logDir, label, app = appOf(root)) {
  ok(fs.readFileSync(path.join(app, 'home.txt'), 'utf8').replace(/^\uFEFF/, '').trim() === home, `${label}: home.txt -> ${home}`);
  ok(fs.existsSync(path.join(app, 'node', 'node.exe')) && fs.existsSync(path.join(app, 'node_modules', 'express', 'package.json')), `${label}: node.exe and the server packages are installed`);
  ok(!fs.existsSync(path.join(app, 'update-windows.ps1')) && !fs.existsSync(path.join(app, 'data')), `${label}: no ZIP updater and no books in the program folder`);
  ok(/testroot=/.test(fs.readFileSync(path.join(app, 'installed.txt'), 'utf8')), `${label}: installed.txt marks a Setup copy (test mode)`);
  ok(uninstallKeys().includes(TEST_APP_ID) && JSON.stringify(uninstallKeys().filter((k) => k !== TEST_APP_ID)) === JSON.stringify(realBefore.keys) && realEntry() === realBefore.entry,
    `${label}: the TEST uninstall entry (${TEST_APP_ID}) exists; the real ones are as before`);
  ok(fs.existsSync(path.join(logDir, 'Free GST Billing - install log.txt')), `${label}: install log in ${logDir}`);
}

// ---------------------------------------------------------------- run
const realBefore = { keys: uninstallKeys(), entry: realEntry(), icons: realIcons(), p47373: listenerPid(47373) };
console.log(`\nTest folders under ${BASE}\nSetup: ${SETUP}\nUpdate: ${UPGRADE}\n`);
try {
  // ======== A: no earlier copy =========================================
  console.log('A. New books, update from inside the app, uninstall');
  const A = path.join(BASE, 'A');
  const docsA = path.join(A, 'Free GST Billing');
  // Review M1: a second Setup while one runs does not run. (Inno needs the
  // folder of a /LOG file to exist.)
  fs.mkdirSync(A, { recursive: true });
  fs.mkdirSync(path.join(BASE, 'A-second'), { recursive: true });
  const first = spawn(SETUP, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/TESTROOT=${A}`, `/PORT=${NEW_PORT}`, '/DATAMODE=new', `/LOG=${path.join(A, 'first.log')}`]);
  const firstDone = new Promise((res) => first.on('exit', res));
  // Its log appears once the first Setup is really running (holding the mutex).
  await until(() => fs.existsSync(path.join(A, 'first.log')), 60000);
  await sleep(500);
  const secondSetup = spawnSync(SETUP, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/TESTROOT=${path.join(BASE, 'A-second')}`, '/DATAMODE=new', '/NOSTART=1', `/LOG=${path.join(BASE, 'A-second', 'second.log')}`], { timeout: 120000 });
  const firstCode = await firstDone;
  ok(secondSetup.status !== 0 && !fs.existsSync(appOf(path.join(BASE, 'A-second'))), `A: a second Setup started while the first runs does not run (exit ${secondSetup.status}; Setup's mutex)`);
  let r = { code: firstCode, log: path.join(A, 'first.log') };
  ok(r.code === 0, 'A: silent install exit 0', r.log);
  checkInstallFiles(A, docsA, docsA, 'A');
  ok(/Test mode: the WebView2 Runtime is not checked or installed/.test(fs.readFileSync(path.join(docsA, 'Free GST Billing - install log.txt'), 'utf8')), 'A: test mode never installs the real WebView2 Runtime');
  ok(await until(() => answers(NEW_PORT), 90000), `A: the app answers on test port ${NEW_PORT}`);
  const lockA = JSON.parse(fs.readFileSync(path.join(docsA, 'data', 'server.lock'), 'utf8'));
  ok(nodePathOf(lockA.pid).toLowerCase() === path.join(A, 'Programs', 'Free GST Billing', 'node', 'node.exe').toLowerCase(), 'A: served by the installed node.exe');
  ok(/<div id="root"/.test(await (await answers(NEW_PORT, '/')).text()), 'A: serves the app page');
  ok(fs.existsSync(path.join(A, 'Desktop', 'Free GST Billing.lnk')) && fs.existsSync(path.join(A, 'Programs', 'Free GST Billing.lnk')) && !fs.existsSync(path.join(A, 'Startup', 'Free GST Billing.lnk')),
    'A: Desktop and Start-menu icons (in the test folder), no Startup icon');
  ok(lnk(path.join(A, 'Desktop', 'Free GST Billing.lnk')).trim() === path.join(appOf(A), 'Free GST Billing.exe'), 'A: the icon opens the app in its own window (Free GST Billing.exe)');
  ok(aumidOf(path.join(A, 'Programs', 'Free GST Billing.lnk')) === 'DiceCodes.FreeGSTBilling.Test', 'A: the Start-menu icon carries the window\'s taskbar id (test: DiceCodes.FreeGSTBilling.Test)');
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
  const docsB = path.join(B, 'Free GST Billing');
  const h0 = fingerprint(oldB.old);
  r = runSetup(SETUP, B, ['/DATAMODE=keep', '/NOSTART=1']);
  ok(r.code === 0, 'B: silent install (keep) exit 0', r.log);
  ok(await oldB.srv.done.then(() => true), 'B: the earlier copy\'s server was stopped (by its process id)');
  proof('B install (keep)', h0, fingerprint(oldB.old));
  checkInstallFiles(B, oldB.sys, docsB, 'B');
  const backB = listFiles(path.join(docsB, 'Old shortcuts (backup)'));
  ok(backB.includes('Desktop - Free GST Billing.lnk') && backB.includes('Startup - Free GST Billing.lnk'), `B: both old icons MOVED to the backup folder (${backB.join(', ')})`);
  ok(lnk(path.join(B, 'Desktop', 'Free GST Billing.lnk')).trim() === path.join(appOf(B), 'Free GST Billing.exe'), 'B: the new Desktop icon opens the new app');
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
  const stale = path.join(appOf(B), 'dist', 'assets', 'stale-from-old-version.js');
  fs.writeFileSync(stale, '// a file the new version no longer has');
  r = runSetup(UPGRADE, B, ['/NOSTART=1']);
  ok(r.code === 0 && !await answers(OLD_PORT), 'B: update (1.10.99) installed; it stopped the app');
  ok(!fs.existsSync(stale) && fs.existsSync(path.join(appOf(B), 'dist', 'index.html')), 'B: the old version\'s leftover file was removed after the new files were in (review M5)');
  ok(fs.existsSync(path.join(appOf(B), 'Free GST Billing.exe')) && !fs.readdirSync(appOf(B)).some((f) => f.endsWith('.old')), 'B: no window was open: the set-aside window files were deleted right after the update');
  proof('B update', h1, fingerprint(oldB.old));
  startInstalled(B);
  ok(await version(OLD_PORT) === '1.10.99' && await bills(OLD_PORT) === 3, 'B: updated app 1.10.99 still has the 3 invoices');
  await sleep(7000);
  const h2 = fingerprint(oldB.old);
  ok(await runUninstall(B), 'B: uninstall finished');
  proof('B uninstall', h2, fingerprint(oldB.old));
  ok(listFiles(path.join(oldB.sys, 'data', 'bills')).length === 3, 'B: the 3 invoices are still in the old folder');

  // ======== C: move ====================================================
  console.log('\nC. An earlier ZIP copy: copy the books to the user folder');
  const C = path.join(BASE, 'C');
  const oldC = await makeOldZipCopy(C);
  // Also pinned to the taskbar and in a Start-menu subfolder (review H2).
  icon(path.join(C, 'TaskBar'), 'Free GST Billing (pinned).lnk', 'C:\\Windows\\System32\\mshta.exe', `"${path.join(oldC.old, 'Free GST Billing - WINDOWS.hta')}"`);
  icon(path.join(C, 'Programs', 'Billing Apps'), 'GST app.lnk', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', `-File "${path.join(oldC.sys, 'start-windows.ps1')}"`);
  const docsC = path.join(C, 'Free GST Billing');
  const c0 = fingerprint(oldC.old);
  r = runSetup(SETUP, C, ['/DATAMODE=move']);
  ok(r.code === 0, 'C: silent install (move) exit 0', r.log);
  proof('C install (move)', c0, fingerprint(oldC.old));
  checkInstallFiles(C, docsC, docsC, 'C');
  const portC = readPort(docsC);
  ok(portC !== OLD_PORT && portC === NEW_PORT, `C: the copied books got a port of their own (${portC}, the old copy keeps ${OLD_PORT})`);
  const backC = listFiles(path.join(docsC, 'Old shortcuts (backup)'));
  ok(['Desktop - Free GST Billing.lnk', 'Startup - Free GST Billing.lnk', 'Taskbar - Free GST Billing (pinned).lnk', 'Start menu - Billing Apps - GST app.lnk'].every((n) => backC.includes(n))
    && !fs.existsSync(path.join(C, 'TaskBar', 'Free GST Billing (pinned).lnk')) && !fs.existsSync(path.join(C, 'Programs', 'Billing Apps', 'GST app.lnk')),
  `C: old Desktop, Startup, taskbar-pin and Start-menu-subfolder shortcuts all moved to the backup folder (${backC.join(', ')})`);
  const same = ['data', 'Saved Invoices', 'Trash'].every((f) => {
    const a = fingerprint(path.join(oldC.sys, f)); const b = fingerprint(path.join(docsC, f));
    // data/port.txt is the one file Setup changes in the copy, after the check (H2);
    // data/server.lock is the running server's own (the new app's server takes it over).
    return a.files > 0 && a.lines.filter((l) => !l.startsWith('port.txt ') && !l.startsWith('server.lock ')).every((l) => b.lines.includes(l));
  });
  ok(same, 'C: data, Saved Invoices and Trash copied - every file with the same SHA-256');
  const logC = fs.readFileSync(path.join(docsC, 'Free GST Billing - install log.txt'), 'utf8');
  ok(/every file checked: same count, same sizes, same SHA-256/.test(logC) && /Moved the old shortcut/.test(logC), 'C: the install log says what was copied, checked and moved');
  ok(await until(async () => (await bills(portC)) === 3, 90000), 'C: the installed app shows the 3 invoices, from the copy');
  proof('C after the app started on the copy', c0, fingerprint(oldC.old));
  r = runSetup(UPGRADE, C);
  ok(r.code === 0, 'C: update (1.10.99) exit 0');
  ok(await until(async () => (await version(portC)) === '1.10.99', 90000) && await bills(portC) === 3, 'C: updated app 1.10.99 with the 3 invoices');
  proof('C update', c0, fingerprint(oldC.old));
  // H2: the old copy's server on the port the new app expects - the new icon
  // must not open it. (The old server writes in its own folder: a new baseline.)
  stopTestServers();
  await sleep(1500);
  fs.writeFileSync(path.join(docsC, 'data', 'port.txt'), String(OLD_PORT)); // as a copy made before this fix would have
  const oldAgain = startNode(path.join(oldC.sys, 'server.js'));
  await until(() => answers(OLD_PORT), 30000);
  startInstalled(C);
  const newPortNow = readPort(docsC);
  const whoNew = await (await answers(newPortNow))?.json();
  const whoOld = await (await answers(OLD_PORT))?.json();
  ok(newPortNow !== OLD_PORT && whoNew?.books === docsC && whoOld?.books === oldC.sys,
    `C: with the OLD copy's server on its port, the new icon starts its own server for its own books (port ${newPortNow}) instead of opening the old books`);
  oldAgain.kill('SIGKILL');
  await oldAgain.done;
  const c1 = fingerprint(oldC.old);
  ok(await runUninstall(C), 'C: uninstall finished');
  proof('C uninstall', c1, fingerprint(oldC.old));
  ok(listFiles(path.join(docsC, 'data', 'bills')).length === 3, 'C: the copied books are kept after uninstall');

  // ======== D: the one-line installer's copy in the Setup's own folder (H1)
  console.log('\nD. An earlier copy in ...\\Programs\\Free GST Billing (the one-line installer\'s folder)');
  const D = path.join(BASE, 'D');
  const oldD = await makeOldZipCopy(D, { dir: appOf(D) });
  const appD = appOf(D, 'Free GST Billing App');
  const d0 = fingerprint(oldD.old);
  r = runSetup(SETUP, D, ['/DATAMODE=keep', '/NOSTART=1']);
  ok(r.code === 0, 'D: silent install (keep) exit 0', r.log);
  ok(fs.existsSync(path.join(appD, 'installed.txt')) && !fs.existsSync(path.join(oldD.old, 'installed.txt')), `D: installed to ${path.basename(appD)}, NOT into the old copy's folder`);
  proof('D install (keep, same folder as the old copy)', d0, fingerprint(oldD.old));
  checkInstallFiles(D, oldD.sys, path.join(D, 'Free GST Billing'), 'D', appD);
  startInstalled(D, appD);
  ok(await bills(OLD_PORT) === 3, 'D: the installed app shows the old copy\'s 3 invoices');
  stopTestServers();
  await sleep(1500);
  const d1 = fingerprint(oldD.old);
  r = runSetup(UPGRADE, D, ['/NOSTART=1']);
  ok(r.code === 0 && fs.readFileSync(path.join(appD, 'package.json'), 'utf8').includes('1.10.99'), 'D: update installed into the same "App" folder');
  proof('D update', d1, fingerprint(oldD.old));
  ok(await runUninstall(D, [], appD), 'D: uninstall finished');
  proof('D uninstall', d1, fingerprint(oldD.old));
  ok(fs.existsSync(path.join(oldD.sys, 'server.js')) && listFiles(path.join(oldD.sys, 'data', 'bills')).length === 3, 'D: the old copy (program and books) is all still there');
  // ...and Copy from that place.
  const D2 = path.join(BASE, 'D2');
  const oldD2 = await makeOldZipCopy(D2, { dir: appOf(D2) });
  const e0 = fingerprint(oldD2.old);
  r = runSetup(SETUP, D2, ['/DATAMODE=move']);
  ok(r.code === 0, 'D2: silent install (copy) from the one-line installer\'s folder, exit 0', r.log);
  proof('D2 install (copy, same folder as the old copy)', e0, fingerprint(oldD2.old));
  const docsD2 = path.join(D2, 'Free GST Billing');
  ok(await until(async () => (await bills(readPort(docsD2))) === 3, 90000), 'D2: the app shows the 3 copied invoices');
  ok(await runUninstall(D2, [], appOf(D2, 'Free GST Billing App')), 'D2: uninstall finished');
  proof('D2 uninstall', e0, fingerprint(oldD2.old));

  // ======== E: two earlier copies (H4) ===================================
  console.log('\nE. Two earlier copies: listed, never guessed');
  const E = path.join(BASE, 'E');
  const older = await makeOldZipCopy(E, { running: false, invoices: 4, changed: new Date('2026-01-15T10:00:00Z'), icons: false });
  const newer = await makeOldZipCopy(E, { dir: path.join(E, 'Desktop', 'Free GST Billing 2'), running: false, invoices: 2, icons: false });
  const f0 = [fingerprint(older.old), fingerprint(newer.old)];
  r = runSetup(SETUP, E, ['/NOSTART=1']);
  ok(r.code !== 0 && !fs.existsSync(appOf(E)) && !uninstallKeys().includes(TEST_APP_ID), `E: silent, two copies, no choice given: Setup stops (exit ${r.code}), installs nothing`);
  ok(/found more than once/.test(fs.readFileSync(r.log, 'utf8')), 'E: ...and says it found more than one copy');
  proof('E stopped (older copy)', f0[0], fingerprint(older.old));
  proof('E stopped (newer copy)', f0[1], fingerprint(newer.old));
  r = runSetup(SETUP, E, ['/DATAMODE=move', `/OLDDIR=${older.old}`]);
  const docsE = path.join(E, 'Free GST Billing');
  ok(r.code === 0 && listFiles(path.join(docsE, 'data', 'bills')).length === 4, 'E: /DATAMODE=move /OLDDIR=<the older one> copies exactly that one (4 invoices, not the newer 2)');
  const logE = fs.readFileSync(path.join(docsE, 'Free GST Billing - install log.txt'), 'utf8');
  ok(/Free GST Billing 2.*2 invoices, last changed/.test(logE) && /4 invoices, last changed 2026-01-15/.test(logE), 'E: the log lists both, with invoices and last-change dates');
  ok(await runUninstall(E), 'E: uninstall finished');
  proof('E after install + uninstall (older copy)', f0[0], fingerprint(older.old));
  proof('E after install + uninstall (newer copy)', f0[1], fingerprint(newer.old));

  // ======== F: "choose" and delete-my-books guards (H3) =================
  console.log('\nF. Choose a folder; delete-my-books refuses a folder that is not a books folder');
  const F = path.join(BASE, 'F');
  fs.mkdirSync(path.join(F, 'NoBooks', 'data', 'bills'), { recursive: true });
  r = runSetup(SETUP, F, ['/DATAMODE=choose', `/DATADIR=${path.join(F, 'NoBooks')}`, '/NOSTART=1']);
  ok(r.code !== 0 && !fs.existsSync(appOf(F)), `F: a folder with a "data" folder but no books is refused (exit ${r.code}); nothing installed`);
  const docsRoot = path.join(F, 'Documents');
  fs.mkdirSync(path.join(docsRoot, 'data', 'bills'), { recursive: true });
  fs.writeFileSync(path.join(docsRoot, 'data', 'bills', 'F-1.json'), '{"id":"F-1"}');
  fs.writeFileSync(path.join(docsRoot, 'my-own-letter.txt'), 'not the app\'s');
  r = runSetup(SETUP, F, ['/DATAMODE=choose', `/DATADIR=${docsRoot}`, '/NOSTART=1']);
  ok(r.code === 0, 'F: books chosen in the Documents folder itself');
  ok(await runUninstall(F, ['/DELETEBOOKS=yes']), 'F: uninstall with /DELETEBOOKS=yes');
  await sleep(3000);
  ok(fs.existsSync(path.join(docsRoot, 'data', 'bills', 'F-1.json')) && fs.existsSync(path.join(docsRoot, 'my-own-letter.txt')), 'F: ...nothing in Documents was deleted (it is not a folder of its own)');

  // ======== G: odd folder names (M6) =====================================
  console.log('\nG. A test folder named with spaces, \' ‘ ’ and Hindi letters');
  const G = path.join(BASE, 'G', 'Rām\'s ‘Shop’ दुकान');
  const oldG = await makeOldZipCopy(G);
  const g0 = fingerprint(oldG.old);
  r = runSetup(SETUP, G, ['/DATAMODE=move']);
  ok(r.code === 0, 'G: silent install (copy) in that folder, exit 0', r.log);
  ok(await oldG.srv.done.then(() => true), 'G: the old server there was stopped');
  const docsG = path.join(G, 'Free GST Billing');
  ok(await until(async () => (await bills(readPort(docsG))) === 3, 90000), 'G: the app answers with the 3 copied invoices');
  proof('G install (odd folder names)', g0, fingerprint(oldG.old));
  const backG = listFiles(path.join(docsG, 'Old shortcuts (backup)'));
  ok(backG.includes('Desktop - Free GST Billing.lnk') && backG.includes('Startup - Free GST Billing.lnk'), `G: the old icons there were recognised and moved (${backG.join(', ')})`);
  ok(await runUninstall(G), 'G: uninstall finished');
  proof('G uninstall', g0, fingerprint(oldG.old));

  // ======== H: the app's own window ======================================
  console.log('\nH. The app\'s own window (Free GST Billing.exe, WebView2)');
  const H = path.join(BASE, 'H');
  const oldH = await makeOldZipCopy(H);
  const appH = appOf(H);
  const docsH = path.join(H, 'Free GST Billing');
  const hostData = path.join(H, 'LocalAppData', 'Free GST Billing');
  const iconH = path.join(H, 'Desktop', 'Free GST Billing.lnk');
  const traceH = path.join(H, 'trace.txt');
  const trace = (f = traceH) => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); } catch { return []; } };
  // The X button: WM_SYSCOMMAND SC_CLOSE. (A bare WM_CLOSE, as Task Manager sends, closes it for real.)
  const xClose = (pid) => ps(`Add-Type -Name W -Namespace FgsbTest -MemberDefinition '[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);'; [FgsbTest.W]::PostMessage((Get-Process -Id ${Number(pid)}).MainWindowHandle, 0x112, [IntPtr]0xF060, [IntPtr]::Zero)`);
  const hostVisible = (pid) => ps(`(Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue).MainWindowHandle -ne 0`) === 'True';
  const hostEvent = (what) => ps(`$e = [System.Threading.EventWaitHandle]::OpenExisting('Local\\FreeGSTBillingHost-${crypto.createHash('sha1').update(appH.toLowerCase(), 'utf8').digest('hex').slice(0, 16)}-${what}'); [void]$e.Set(); 'ok'`);
  // A PC without the WebView2 Runtime (test hook): a stand-in for Microsoft's
  // installer that writes down how it was called and fails (offline).
  const fakeWv = path.join(H, 'fake-webview2', 'fake-webview2.exe');
  fs.mkdirSync(path.dirname(fakeWv), { recursive: true });
  fs.writeFileSync(`${fakeWv}.cs`, 'class F { static int Main(string[] a) { System.IO.File.WriteAllText(System.Reflection.Assembly.GetEntryAssembly().Location + ".args.txt", string.Join(" ", a)); return 3; } }');
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', `/out:${fakeWv}`, `${fakeWv}.cs`]);
  const hh0 = fingerprint(oldH.old);
  r = runSetup(SETUP, H, ['/DATAMODE=move', '/NOSTART=1', `/FAKEWEBVIEW2=${fakeWv}`]);
  ok(r.code === 0, 'H: silent install (copy), exit 0', r.log);
  proof('H install (copy)', hh0, fingerprint(oldH.old));
  const logH = () => fs.readFileSync(path.join(docsH, 'Free GST Billing - install log.txt'), 'utf8');
  ok(fs.existsSync(`${fakeWv}.args.txt`) && fs.readFileSync(`${fakeWv}.args.txt`, 'utf8') === '/silent /install' && /fake-webview2\.exe \/silent \/install: finished with code 3/.test(logH()) && /could not be installed/.test(logH()),
    'H: WebView2 "missing" (test hook): Microsoft\'s installer is run with /silent /install; its failure is logged and the install carries on');
  ok(['Free GST Billing.exe', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll'].every((f) => fs.existsSync(path.join(appH, f))), 'H: the window and its WebView2 files are installed');
  // 1. The icon opens the window; it starts the server for these books.
  const smoke1 = path.join(H, 'smoke1.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke1 });
  const s1 = await until(() => readSmoke(smoke1), 180000) || {};
  ok(s1.mode === 'webview2' && s1.url === `http://localhost:${NEW_PORT}/`, `H: the Desktop icon opens the app in its window (WebView2 ${s1.runtime}, ${s1.url})`, JSON.stringify(s1));
  ok(/^Dashboard - /.test(s1.title1 || '') && /^Settings - /.test(s1.title2 || ''), `H: the window title follows the page ("${s1.title1}" -> "${s1.title2}")`);
  ok(s1.aumid === 'DiceCodes.FreeGSTBilling.Test' && aumidOf(iconH) === s1.aumid, 'H: the window and its icon have the same taskbar id');
  ok(s1.userdata === path.join(hostData, 'WebView2') && fs.existsSync(s1.userdata) && !fs.existsSync(path.join(appH, 'WebView2')) && !fs.existsSync(path.join(H, 'Documents')),
    'H: its WebView2 profile is in (test) LocalAppData\\Free GST Billing - not in the program folder or Documents');
  ok(await until(() => !hostPids(appH) && fs.existsSync(path.join(hostData, 'window.txt')), 30000), 'H: the window closed and kept its size and place (window.txt)');
  ok(await bills(NEW_PORT) === 3, 'H: the server the window started serves the 3 copied invoices');
  // 2. The window open (with the DevTools protocol, to drive it); a second start.
  const { chromium } = await import('playwright');
  // The closed window's web engine must be gone first: a new window would join
  // that browser process, which has no DevTools port.
  await until(() => ps(`@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" -OperationTimeoutSec 10 | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains('${psq(hostData.toLowerCase())}') }).Count`) === '0', 60000);
  openIcon(iconH, { WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`, FGSB_HOST_TRACE: traceH });
  const browser = await until(async () => { try { return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { return null; } }, 90000);
  const page = browser && await until(() => browser.contexts()[0]?.pages().find((p) => p.url().startsWith(`http://localhost:${NEW_PORT}/`)), 90000);
  ok(page, 'H: the window shows the app');
  const pid1 = hostPids(appH);
  const smoke2 = path.join(H, 'smoke2.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke2 });
  const s2 = await until(() => readSmoke(smoke2), 30000) || {};
  ok(pid1 && !pid1.includes(',') && s2.instance === 'second' && s2.forwarded === '1' && hostPids(appH) === pid1, `H: a second start brings the open window forward; still one window (${pid1})`, JSON.stringify(s2));
  // 3. "Update now" with the window open - what runUpdateNow (src/store.js) does.
  fs.copyFileSync(UPGRADE, path.join(H, 'Free-GST-Billing-Windows-Setup.exe'));
  await sleep(7000);
  const hh1 = fingerprint(oldH.old);
  await page.evaluate(() => { window.fgsbBeforeUpdate = 1; }); // gone once the page is loaded again
  const upd = await page.evaluate(async () => {
    const res = await (await fetch('/api/control-panel/launch-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"update"}' })).json();
    (async () => {
      for (let i = 0; i < 120; i++) {
        await new Promise((ok_) => setTimeout(ok_, 3000));
        try { const v = await (await fetch('/api/version', { cache: 'no-store' })).json(); if (v.current && v.current !== res.version) { window.location.reload(); return; } } catch { /* installing */ }
      }
    })();
    return res;
  });
  ok(upd.ok && upd.installer, 'H: "Update now" in the open window starts the new Setup', JSON.stringify(upd));
  const shown = await until(async () => {
    // Loaded again (by the page's own update wait, or the window's self-repair once the Setup is done).
    try { return await page.evaluate(async () => !window.fgsbBeforeUpdate && (await (await fetch('/api/version')).json()).current); } catch { return null; }
  }, 300000);
  ok(shown === '1.10.99', `H: the update installed with the window open, and the page loaded again by itself as ${shown}`);
  ok(hostPids(appH) === pid1, 'H: ...in the same window (it stayed open)');
  const setupLogH = fs.existsSync(upd.log || '') ? fs.readFileSync(upd.log, 'utf8') : '';
  ok(/Need to restart Windows\? No/.test(setupLogH) && /Set aside the app window's files/.test(fs.readFileSync(path.join(docsH, 'Free GST Billing - install log.txt'), 'utf8')),
    'H: the window\'s files in use were set aside (*.old) - no reboot asked');
  ok(fs.existsSync(path.join(appH, 'Free GST Billing.exe')) && fs.existsSync(path.join(appH, 'Free GST Billing.exe.old')) && fs.readFileSync(path.join(appH, 'package.json'), 'utf8').includes('1.10.99'),
    'H: the new program files are in; the open window\'s old exe waits beside them as *.old');
  await sleep(7000);
  proof('H update with the window open', hh1, fingerprint(oldH.old));
  // 4. X hides it near the clock; a second start shows it; Quit stops it and the server.
  xClose(pid1);
  ok(await until(() => trace().includes('hidden'), 15000) && hostPids(appH) === pid1 && !hostVisible(pid1) && await answers(NEW_PORT)
    && trace().includes('tray=1') && trace().includes('tip') && fs.existsSync(path.join(hostData, 'tray-tip-shown.txt')),
  'H: X hides the window (no taskbar button), the app and its server keep running, the tray icon is there, the one-time tip was shown');
  // While hidden: the page keeps running, and its notifications show near the clock.
  const ticks = await page.evaluate(() => new Promise((res) => { let n = 0; const t = setInterval(() => { n += 1; }, 500); setTimeout(() => { clearInterval(t); res(n); }, 5000); }));
  ok(ticks >= 6, `H: while hidden near the clock the page keeps running (${ticks} timer ticks of 500 ms in 5 s)`);
  await page.evaluate(async () => { await Notification.requestPermission(); new Notification('Free GST Billing 9.9.9 is available', { body: 'A test notice from the hidden window' }); });
  ok(await until(() => trace().includes('notify Free GST Billing 9.9.9 is available'), 15000), 'H: the app\'s notification (Notification API) shows near the clock while the window is hidden');
  ok(trace().some((l) => /^menu=Free GST Billing \d+\.\d+\.\d+\|Open Free GST Billing\|Check for updates\|Open books folder\|Make a backup now\|Quit \(stop the app\)$/.test(l)),
    'H: the tray menu: the version, Open, Check for updates, Open books folder, Make a backup now, Quit', trace().find((l) => l.startsWith('menu=')));
  await browser.close();
  const smoke6 = path.join(H, 'smoke6.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke6 });
  ok((await until(() => readSmoke(smoke6), 30000))?.forwarded === '1' && await until(() => hostVisible(pid1), 15000) && trace().includes('shown') && hostPids(appH) === pid1,
    'H: starting it again while it is near the clock shows the same window');
  xClose(pid1);
  ok(await until(() => trace().filter((l) => l === 'hidden').length === 2, 15000) && trace().filter((l) => l === 'tip').length === 1, 'H: X again hides it; the tip is not shown a second time');
  ok(hostEvent('quit') === 'ok' && await until(() => !hostPids(appH), 45000) && await until(async () => !await answers(NEW_PORT), 20000) && trace().includes('server stopped'),
    'H: Quit (the tray menu\'s) closes the window and the tray icon AND stops this install\'s server');
  // Opened again: the set-aside files are gone.
  const smoke3 = path.join(H, 'smoke3.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke3 });
  const s3 = await until(() => readSmoke(smoke3), 120000) || {};
  ok(s3.mode === 'webview2' && !fs.readdirSync(appH).some((f) => f.endsWith('.old')), 'H: the next start of the updated window removed the *.old files');
  await until(() => !hostPids(appH), 30000);
  // Task Manager's "End task" (a bare WM_CLOSE) really closes it; the server stays, as with X before.
  openIcon(iconH);
  const pidTm = await until(() => { const p = hostPids(appH); return p && hostVisible(p) ? p : null; }, 90000);
  ps(`[void](Get-Process -Id ${Number(pidTm)}).CloseMainWindow()`);
  ok(pidTm && await until(() => !hostPids(appH), 20000) && await answers(NEW_PORT), 'H: Task Manager\'s End task (WM_CLOSE) really closes the window, not to the tray');
  // Self-repair: the server is killed (by its own id); the window starts it again and reloads.
  const traceRep = path.join(H, 'trace-repair.txt');
  openIcon(iconH, { FGSB_HOST_TRACE: traceRep });
  const pidRep = await until(() => { const p = hostPids(appH); return p && hostVisible(p) && trace(traceRep).some((l) => /^title=Dashboard - /.test(l)) ? p : null; }, 90000);
  const lockPid = JSON.parse(fs.readFileSync(path.join(docsH, 'data', 'server.lock'), 'utf8')).pid;
  ps(`Stop-Process -Id ${Number(lockPid)} -Force`);
  const back = await until(async () => { const v = await (await answers(NEW_PORT))?.json(); return v?.pid && v.pid !== lockPid && trace(traceRep).some((l) => l.startsWith('repaired url=')) ? v : null; }, 150000);
  await sleep(4000);
  const servers = Number(ps(`@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -OperationTimeoutSec 10 | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains('${psq(appH.toLowerCase())}') }).Count`));
  const afterRepair = trace(traceRep).slice(trace(traceRep).findIndex((l) => l.startsWith('repaired url=')));
  ok(pidRep && back && trace(traceRep).some((l) => l.startsWith('repair: ')) && afterRepair.some((l) => /^title=Dashboard - /.test(l)) && hostPids(appH) === pidRep && servers === 1,
    `H: the server was killed; the window started it again by itself (pid ${lockPid} -> ${back?.pid}, one server) and reloaded the app (${trace(traceRep).find((l) => l.startsWith('repair: '))})`);
  // The jump list: "/view=<screen>"; a running window is sent to that screen.
  const exeH = path.join(appH, 'Free GST Billing.exe');
  spawnSync(exeH, ['/view=clients'], { env: { ...process.env, FREEGSTBILL_TEST: '1' }, timeout: 30000 });
  ok(await until(() => trace(traceRep).includes('view=clients') && trace(traceRep).slice(-3).some((l) => /^title=Clients - /.test(l)), 20000), 'H: jump list "Clients" with the window open: the same window goes to Clients');
  const jumpDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Recent', 'CustomDestinations');
  // A byte search for the UTF-16 text (decoding these files with toString('utf16le') gave wrong results, even a crash, on Node 24.20).
  const hasText = (buf, s) => buf.indexOf(Buffer.from(s, 'utf16le')) >= 0;
  const jumpFiles = () => { try { return fs.readdirSync(jumpDir).map((f) => path.join(jumpDir, f)).filter((f) => { const b = fs.readFileSync(f); return hasText(b, appH) && hasText(b, '/view=new'); }); } catch { return []; } };
  ok(trace(traceRep).includes('jumplist=4') && jumpFiles().length >= 1, 'H: the jump list (New Invoice, Dashboard, Clients, Reports) is registered under the window\'s taskbar id',
    `files=${jumpFiles().length} ${trace(traceRep).filter((l) => l.startsWith('jumplist')).join(' ')}`);
  ps(`[void](Get-Process -Id ${Number(pidRep)}).CloseMainWindow()`);
  await until(() => !hostPids(appH), 20000);
  const traceView = path.join(H, 'trace-view.txt');
  spawnSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process -FilePath '${psq(exeH)}' -ArgumentList '/view=reports'`], { env: { ...process.env, FREEGSTBILL_TEST: '1', FGSB_HOST_TRACE: traceView } });
  ok(await until(() => trace(traceView).some((l) => /^title=Reports - /.test(l)), 90000), 'H: jump list "Reports" with no window open: it opens straight on Reports');
  ps(`Get-Process -Name 'Free GST Billing' -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${psq(appH)}\\*' } | ForEach-Object { [void]$_.CloseMainWindow() }; exit 0`);
  await until(() => !hostPids(appH), 20000);
  for (const f of jumpFiles()) fs.rmSync(f, { force: true }); // the test id's jump list only
  // 5. No WebView2 Runtime (simulated: the loader is pointed at an empty folder).
  const smoke4 = path.join(H, 'smoke4.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke4, WEBVIEW2_BROWSER_EXECUTABLE_FOLDER: path.join(H, 'no-webview2-here') });
  const s4 = await until(() => readSmoke(smoke4), 60000) || {};
  ok(s4.mode === 'fallback' && await until(() => !hostPids(appH), 20000), `H: without WebView2 the window hands over to the launcher's Edge app window (${s4.why})`, JSON.stringify(s4));
  // 6. The server cannot start (its books folder is gone): the launcher's words, not a blank page.
  stopTestServers();
  await sleep(1500);
  fs.renameSync(docsH, `${docsH}-away`);
  const smoke5 = path.join(H, 'smoke5.txt');
  openIcon(iconH, { FGSB_HOST_SMOKE: smoke5 });
  const s5 = await until(() => readSmoke(smoke5), 120000) || {};
  fs.renameSync(`${docsH}-away`, docsH);
  ok(s5.mode === 'error' && /folder with your books is not there/.test(s5.text || ''), `H: when the server cannot start, the window shows the launcher's text ("${(s5.text || '').slice(0, 70)}...")`, JSON.stringify(s5));
  await until(() => !hostPids(appH), 20000);
  // 7. The Startup icon: "/tray" - the server starts, no window, the icon near the clock.
  const startupH = path.join(H, 'Startup', 'Free GST Billing.lnk');
  ok(/Free GST Billing\.exe \/tray$/.test(lnk(startupH).trim()) && !/\/tray/.test(lnk(iconH)), 'H: the Startup icon (the old copy had one) starts it with /tray; the Desktop icon does not');
  const traceTray = path.join(H, 'trace-tray.txt');
  openIcon(startupH, { FGSB_HOST_TRACE: traceTray });
  const pidTray = await until(async () => { const p = hostPids(appH); return p && await answers(NEW_PORT) ? p : null; }, 120000);
  await sleep(2000);
  ok(pidTray && !hostVisible(pidTray) && trace(traceTray).includes('tray=1') && trace(traceTray).includes(`server url=http://localhost:${NEW_PORT}/`),
    'H: /tray starts the server and waits near the clock, no window');
  // 8. Uninstall with the window hidden near the clock.
  const hh2 = fingerprint(oldH.old);
  const t0 = Date.now();
  ok(await runUninstall(H), 'H: uninstall finished with the window hidden near the clock');
  ok(!hostPids(appH) && trace(traceTray).includes('close'), `H: ...it closed that window through its close event, not by force (uninstall took ${Math.round((Date.now() - t0) / 1000)} s)`);
  ok(!await answers(NEW_PORT), 'H: ...and stopped the server');
  ok(!fs.existsSync(path.join(hostData, 'WebView2')) && !fs.existsSync(path.join(hostData, 'window.txt')) && !fs.existsSync(path.join(hostData, 'tray-tip-shown.txt')), 'H: ...and removed the window\'s WebView2 profile, place and tip mark');
  ok(listFiles(path.join(docsH, 'data', 'bills')).length === 3, 'H: the books are kept');
  proof('H uninstall with the window near the clock', hh2, fingerprint(oldH.old));
} catch (e) {
  failed++;
  console.log(`  FAIL ${e.stack || e.message}`);
} finally {
  stopTestServers();
  await sleep(1000);
  // The test windows' jump lists (taskbar id DiceCodes.FreeGSTBilling.Test) name this run's folder.
  const jd = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Recent', 'CustomDestinations');
  try { for (const f of fs.readdirSync(jd)) { if (fs.readFileSync(path.join(jd, f)).indexOf(Buffer.from(BASE, 'utf16le')) >= 0) fs.rmSync(path.join(jd, f), { force: true }); } } catch { /* none */ }
  for (const root of ['A', 'A-second', 'B', 'C', 'D', 'D2', 'E', 'F', path.join('G', 'Rām\'s ‘Shop’ दुकान'), 'H']) {
    for (const name of ['Free GST Billing', 'Free GST Billing App']) {
      const app = appOf(path.join(BASE, root), name);
      if (fs.existsSync(path.join(app, 'unins000.exe'))) await runUninstall(path.join(BASE, root), [], app);
    }
  }
}

console.log('\nThis PC (nothing real may change):');
ok(JSON.stringify(uninstallKeys()) === JSON.stringify(realBefore.keys) && realEntry() === realBefore.entry,
  `Windows' uninstall list is as before (${realBefore.keys.length} entries; the real FreeGSTBilling_is1 ${realBefore.entry ? 'unchanged, every value' : 'absent'})`, uninstallKeys().filter((k) => /freegst/i.test(k)).join(','));
ok(realIcons() === realBefore.icons, 'The real Desktop, Start-menu and Startup icons are as before (names and times)');
ok(listenerPid(47373) === realBefore.p47373, `Port 47373 (the real app) has the same process as before (${realBefore.p47373 || 'none'})`);

console.log('\nHash proof (SHA-256 over every file of the earlier copy):');
for (const p of proofs) console.log(`  ${p}`);
if (!process.argv.includes('--keep')) {
  fs.rmSync(BASE, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  // The in-app updates' Setup copies in TEMP (fgsb-update-*) of THIS run only.
  for (const d of fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('fgsb-update-'))) {
    try { if (fs.readFileSync(path.join(os.tmpdir(), d, 'setup.log'), 'utf8').includes(BASE)) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch { /* not ours */ }
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
