// v1.10.85 (#125) - a company hidden behind its own PIN, against a real
// server: a copy of server.js in a throw-away folder, its books in another
// (FGSB_HOME), on test port 47470.
//   1. the list marks a hidden company and never sends the PIN's hash;
//   2. saving the profile from the screen keeps its hide PIN;
//   3. the PIN alone opens it (ids answered), a wrong one is refused and
//      counted, five wrong ones make the next try wait;
//   4. changing or removing the hide PIN needs the current one;
//   5. the hash never reaches a recurring invoice's copy of the profile.
//
// Run: `node scripts/hidden-company-test.mjs`
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PORT = 47470;
const BASE = `http://127.0.0.1:${PORT}/api`;
let passed = 0, failed = 0;
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-hidden-test-'));
const APP = path.join(T, 'app');
const BOOKS = path.join(T, 'books');
for (const f of ['server.js', 'package.json', 'src/utils.js', ...fs.readdirSync(path.join(ROOT, 'src', 'utils')).filter((n) => n.endsWith('.js')).map((n) => `src/utils/${n}`)]) {
  fs.mkdirSync(path.dirname(path.join(APP, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
}
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'junction');
fs.mkdirSync(path.join(BOOKS, 'data'), { recursive: true });
fs.writeFileSync(path.join(BOOKS, 'data', 'port.txt'), String(PORT));

const child = spawn(process.execPath, [path.join(APP, 'server.js')], {
  cwd: APP, env: { ...process.env, FGSB_HOME: BOOKS, FGSB_PHONE_ACCESS: '', FGSB_PIN: '' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });
const exited = new Promise((r) => child.on('exit', r));

const call = async (method, url, body, headers = {}) => {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
};

try {
  let up = false;
  for (const end = Date.now() + 20000; Date.now() < end && !up; await sleep(250)) {
    try { up = (await fetch(`${BASE}/version`)).ok; } catch { /* starting */ }
  }
  if (!up) throw new Error(`server did not start:\n${out}`);

  // Two demo companies.
  await call('POST', '/profiles', { id: 'biz_dice', businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW' });
  await call('POST', '/profiles', { id: 'biz_second', businessName: 'DiceCodes Labs', gstin: '29ABCDE1234F2ZV' });

  ok((await call('POST', '/profiles/biz_second/hide-pin', { pin: '12345' })).status === 400, 'a PIN must be 6 or 8 digits');
  ok((await call('POST', '/profiles/nobody/hide-pin', { pin: '246813' })).status === 404, 'an unknown company: not found');
  const hid = await call('POST', '/profiles/biz_second/hide-pin', { pin: '246813' });
  ok(hid.status === 200 && hid.json?.hidden === true, 'hide a company with a PIN');

  const list = (await call('GET', '/profiles')).json;
  const second = list.find((p) => p.id === 'biz_second');
  ok(second?.hidden === true && !('hideLock' in second) && !('businessName' in second) && !('gstin' in second),
    'the list gives a hidden company as a bare entry: no name, details or hash', JSON.stringify(second));
  ok(list.find((p) => p.id === 'biz_dice')?.hidden === undefined, 'the other company is not hidden');
  ok(!!hid.json?.key && hid.json?.profile?.businessName === 'DiceCodes Labs', 'hiding answers a key and the details, for the window that hid it');

  // Saving or deleting a hidden company needs its key.
  const noKey = await call('POST', '/profiles', { id: 'biz_second', businessName: 'Taken over' });
  ok(noKey.status === 403 && noKey.json?.code === 'hidden-locked', 'saving a hidden company without its key: refused', JSON.stringify(noKey));
  ok((await call('DELETE', '/profiles/biz_second')).status === 403, 'deleting a hidden company without its key: refused');
  ok((await call('POST', '/profiles', { id: 'biz_second', businessName: 'Taken over' }, { 'X-Hidden-Key': 'not-a-key' })).status === 403, 'a made-up key: refused');

  const wrong = await call('POST', '/profiles/unlock', { pin: '111111' });
  ok(wrong.status === 401 && wrong.json?.code === 'wrong-pin', 'a wrong PIN opens nothing', JSON.stringify(wrong.json));
  // The lock screen's counter is apart: a wrong hide PIN never makes it wait,
  // and a right one never clears it.
  ok((await call('POST', '/lock/verify', { pin: '111111' })).status === 200, 'the lock screen is not touched by hide PINs (no app lock set)');
  const right = await call('POST', '/profiles/unlock', { pin: '246813' });
  const opened = right.json?.profiles?.[0];
  ok(right.status === 200 && JSON.stringify(right.json?.ids) === '["biz_second"]' && opened?.businessName === 'DiceCodes Labs' && !!opened?.key && !('hideLock' in opened),
    'the PIN alone opens its company: details and a key, never the hash', JSON.stringify(right.json));

  // The screen saves it with its key (with `hidden`, without the lock).
  const { key, ...shown } = opened;
  const saved = await call('POST', '/profiles', { ...shown, address: 'Bengaluru' }, { 'X-Hidden-Key': key });
  const onDisk = JSON.parse(fs.readFileSync(path.join(BOOKS, 'data', 'profiles', 'biz_second.json'), 'utf8'));
  ok(saved.status === 200 && !!onDisk.hideLock?.hash && onDisk.address === 'Bengaluru' && !('hidden' in onDisk) && !('key' in onDisk),
    'with its key it saves, keeps the hide PIN, never stores `hidden` or the key');
  const active = (await call('POST', '/profile', { ...shown, address: 'Bengaluru' })).status;
  ok(active === 200 && (await call('GET', '/profiles')).json.find((p) => p.id === 'biz_second')?.isActive === true,
    'the list says when the hidden company is the one open on screen (so a restart moves away from it)');

  ok((await call('POST', '/profiles/biz_second/hide-pin', { pin: '13572468' })).status === 401, 'changing the PIN needs the current one');
  ok((await call('POST', '/profiles/biz_second/hide-pin', { pin: '13572468', currentPin: '246813' })).status === 200, 'with the current PIN it changes');
  ok((await call('POST', '/profiles/unlock', { pin: '13572468' })).json?.ids?.[0] === 'biz_second', 'the new PIN opens it');

  // A recurring invoice copies its business: never the hash.
  const tpl = { id: 'rec_hidden', clientName: 'Smoke Client', ownerGstin: '29ABCDE1234F2ZV', invoiceType: 'tax-invoice', frequency: 'monthly', nextDate: '2026-11-01', items: [{ name: 'Retainer', quantity: 1, rate: 1000, taxPercent: 18 }], active: true };
  await call('POST', '/recurring', tpl);
  const gen = await call('POST', '/recurring/rec_hidden/generate', {});
  const bills = (await call('GET', '/bills')).json || [];
  const madeText = JSON.stringify(bills);
  const made = bills.find((b) => b.data?.profile?.businessName === 'DiceCodes Labs');
  ok(!!made && !madeText.includes('hideLock') && !madeText.includes(onDisk.hideLock.hash), 'a generated invoice (of the hidden company) never carries the hide PIN', `generate=${gen.status} bills=${bills.length}`);

  // Five wrong tries in a row: the next one waits.
  for (let i = 0; i < 5; i++) await call('POST', '/profiles/unlock', { pin: '000000' });
  const waited = await call('POST', '/profiles/unlock', { pin: '13572468' });
  ok(waited.status === 429 && waited.json?.code === 'wait', 'five wrong PINs: the next try waits', JSON.stringify(waited.json));

  ok((await call('POST', '/profiles/biz_dice/hide-pin', { pin: null })).status === 200, 'showing a company that is not hidden is harmless');
} catch (e) {
  failed++;
  console.log(`  FAIL the test could not finish: ${e.message}`);
} finally {
  child.kill();
  await Promise.race([exited, sleep(3000)]);
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* Windows may hold a file a moment */ }
}

console.log(`\nhidden-company-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
