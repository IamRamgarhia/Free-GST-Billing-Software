// v1.10.84 - integration test of the one-server-per-books lock with real
// servers: a copy of server.js in a throw-away folder, its books in another
// (FGSB_HOME), on test port 47463.
//   1. server A starts and takes data/server.lock;
//   2. server B on the same books refuses to start, and A keeps answering;
//   3. A is killed (no clean exit: the lock stays behind, stale);
//   4. server C takes the stale lock over and starts;
//   5. a lock written by another PC is never taken over;
//   6. a lock whose port answers as a DIFFERENT server is stale (port 47464).
//
// Run: `node scripts/server-lock-test.mjs`

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PORT = 47463;
let passed = 0, failed = 0;
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Review H1 (7 Nov): a BUSY server (its process alive, no answer, its port
// still taking connections, the lock older than the start grace) is running,
// never taken over; nothing on its port = stale; answering as another = stale.
{
  const { lockIsLive } = await import('../src/utils/serverLock.js');
  const lock = { pid: 4242, port: 50000, at: Date.now() - 120000, host: os.hostname(), id: 'x' };
  const base = { selfPid: 1, selfHost: os.hostname(), isAlive: () => true };
  ok(await lockIsLive(lock, { ...base, identify: async () => null, isListening: async () => true }) === 'running', 'H1: a busy server (alive, no answer, port open) is running - never taken over');
  ok(await lockIsLive(lock, { ...base, identify: async () => null, isListening: async () => false }) === false, 'H1: alive process id but nothing on its port (a reused id) is stale');
  ok(await lockIsLive(lock, { ...base, identify: async () => ({ pid: 99, lockId: 'y' }), isListening: async () => true }) === false, 'H1: a port answering as ANOTHER server is stale');
}

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-lock-test-'));
const APP = path.join(T, 'app');
const BOOKS = path.join(T, 'books');
for (const f of ['server.js', 'package.json', 'src/utils.js', ...fs.readdirSync(path.join(ROOT, 'src', 'utils')).filter((n) => n.endsWith('.js')).map((n) => `src/utils/${n}`)]) {
  fs.mkdirSync(path.dirname(path.join(APP, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
}
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'junction');
fs.mkdirSync(path.join(BOOKS, 'data'), { recursive: true });
fs.writeFileSync(path.join(BOOKS, 'data', 'port.txt'), String(PORT));
const lockFile = path.join(BOOKS, 'data', 'server.lock');

const children = [];
function start(books = BOOKS) {
  const child = spawn(process.execPath, [path.join(APP, 'server.js')], { cwd: APP, env: { ...process.env, FGSB_HOME: books }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.out = '';
  child.stdout.on('data', (d) => { child.out += d; });
  child.stderr.on('data', (d) => { child.out += d; });
  child.exited = new Promise((r) => child.on('exit', (code) => { child.code = code; r(code); }));
  children.push(child);
  return child;
}
async function answers(port = PORT) {
  try { return (await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
async function until(fn, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await fn()) return true;
  return false;
}

try {
  if (await answers()) throw new Error(`Port ${PORT} is already in use; free it and run again.`);
  const a = start();
  ok(await until(answers, 20000), 'Server A starts on the test books', a.out);
  ok(JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid === a.pid, 'A holds data/server.lock with its process id and port');

  const b = start();
  const bCode = await Promise.race([b.exited, sleep(20000).then(() => 'timeout')]);
  ok(bCode === 0 && /already running/.test(b.out), 'Server B on the same books refuses to start', `(exit ${bCode}) ${b.out}`);
  ok(await answers() && JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid === a.pid, 'A keeps answering and keeps its lock');

  a.kill('SIGKILL');
  await a.exited;
  ok(fs.existsSync(lockFile), 'A was killed: its lock is left behind (stale)');

  const c = start();
  ok(await until(answers, 20000), 'Server C takes the stale lock over and starts', c.out);
  const lockC = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  ok(lockC.pid === c.pid && lockC.host === os.hostname() && /^[0-9a-f-]{36}$/.test(lockC.id), 'The lock is now C\'s, with this PC\'s name and a random id');
  const v = await (await fetch(`http://127.0.0.1:${PORT}/api/version`)).json();
  ok(v.pid === c.pid && v.lockId === lockC.id && v.books === BOOKS, '/api/version says which server it is and which books it serves');

  // ERR-084: an invoice last changed 60 days ago, deleted now, gets its 30
  // days in the Trash (the move kept its old date: emptied at the next start).
  {
    const billFile = path.join(BOOKS, 'data', 'bills', 'old-bill.json');
    fs.writeFileSync(billFile, JSON.stringify({ id: 'old-bill', invoiceNumber: 'OLD/1', clientName: 'Test', totalAmount: 100 }));
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(billFile, old, old);
    const del = await fetch(`http://127.0.0.1:${PORT}/api/bills/old-bill`, { method: 'DELETE' });
    const trashed = path.join(BOOKS, 'data', 'trash', 'old-bill.json');
    const ageMs = fs.existsSync(trashed) ? Date.now() - fs.statSync(trashed).mtimeMs : null;
    ok(del.ok && ageMs !== null && ageMs < 60000, 'ERR-084: a deleted old invoice is dated now in the Trash (kept 30 days from today)', `age=${ageMs}`);
  }
  c.kill('SIGKILL');
  await c.exited;

  // A lock from ANOTHER PC (books on a shared drive): never taken over.
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 4, port: PORT, at: 0, host: 'OFFICE-PC-ELSEWHERE', id: 'x' }));
  const d = start();
  const dCode = await Promise.race([d.exited, sleep(20000).then(() => 'timeout')]);
  ok(dCode === 1 && /another computer \(OFFICE-PC-ELSEWHERE\)/.test(d.out) && JSON.parse(fs.readFileSync(lockFile, 'utf8')).host === 'OFFICE-PC-ELSEWHERE',
    'A lock from another PC: refused with a clear message, the lock left as it is', `(exit ${dCode}) ${d.out}`);

  // A lock whose process is alive (this test) but whose port is answered by a
  // different server: that is not "running", so after the start-up grace it is stale.
  const other = path.join(T, 'other-books');
  fs.mkdirSync(path.join(other, 'data'), { recursive: true });
  fs.writeFileSync(path.join(other, 'data', 'port.txt'), String(PORT + 1));
  const e = start(other);
  ok(await until(() => answers(PORT + 1), 20000), 'Another server on other books runs on the next port');
  fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, port: PORT + 1, at: Date.now() - 120000, host: os.hostname(), id: 'not-that-server' }));
  const f = start();
  ok(await until(answers, 20000), 'A lock whose port answers as a DIFFERENT server is stale: taken over', f.out);
  ok(await answers(PORT + 1), '...and the other server was not disturbed');

  // 7. Its port is taken (the other server sits on it): it moves to the next
  //    free port and says so in port.txt and the lock (Express 5 calls the
  //    listen callback with the error first - that must not stop the retry).
  f.kill('SIGKILL');
  await f.exited;
  fs.writeFileSync(path.join(BOOKS, 'data', 'port.txt'), String(PORT + 1));
  const g = start();
  const moved = await until(async () => fs.readFileSync(path.join(BOOKS, 'data', 'port.txt'), 'utf8').trim() !== String(PORT + 1), 20000);
  const newPort = Number(fs.readFileSync(path.join(BOOKS, 'data', 'port.txt'), 'utf8').trim());
  const who = moved ? await (await fetch(`http://127.0.0.1:${newPort}/api/version`)).json().catch(() => null) : null;
  ok(moved && who?.books === BOOKS && JSON.parse(fs.readFileSync(lockFile, 'utf8')).port === newPort,
    `Its port taken by another server: it starts on the next free one (${newPort}) and writes that to port.txt and the lock`, g.out);
  e.kill('SIGKILL');
} catch (e) {
  failed++;
  console.log(`  FAIL ${e.message}`);
} finally {
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
  await sleep(500);
  fs.rmSync(T, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
