// v1.10.84 - integration test of the one-server-per-books lock with real
// servers: a copy of server.js in a throw-away folder, its books in another
// (FGSB_HOME), on test port 47463.
//   1. server A starts and takes data/server.lock;
//   2. server B on the same books refuses to start, and A keeps answering;
//   3. A is killed (no clean exit: the lock stays behind, stale);
//   4. server C takes the stale lock over and starts.
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
function start() {
  const child = spawn(process.execPath, [path.join(APP, 'server.js')], { cwd: APP, env: { ...process.env, FGSB_HOME: BOOKS }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  ok(JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid === c.pid, 'The lock is now C\'s');
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
