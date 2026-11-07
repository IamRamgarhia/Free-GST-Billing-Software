// v1.10.85 - Close the books and the edit history, against a real server: a
// copy of server.js in a throw-away folder, its books in another
// (FGSB_HOME), on test port 47471.
//   1. with the books closed up to a date, an invoice dated then cannot be
//      added, changed (amount, cancel) or deleted, but a payment can be added;
//   2. an invoice after the date is free; opening the books frees all again;
//   3. a deleted invoice dated then cannot come back from the Trash;
//   4. every save and delete that went through is in the edit history.
//
// Run: `node scripts/period-lock-server-test.mjs`
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PORT = 47471;
const BASE = `http://127.0.0.1:${PORT}/api`;
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

const child = spawn(process.execPath, [path.join(APP, 'server.js')], {
  cwd: APP, env: { ...process.env, FGSB_HOME: BOOKS, FGSB_PHONE_ACCESS: '', FGSB_PIN: '' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });
const exited = new Promise((r) => child.on('exit', r));

const call = async (method, url, body) => {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* none */ }
  return { status: res.status, json };
};
const bill = (id, date, total = 1180, over = {}) => ({
  id, invoiceNumber: id, invoiceType: 'tax-invoice', invoiceDate: date, clientName: 'DiceCodes Labs', status: 'unpaid',
  totalAmount: total, totalTaxAmount: total - total / 1.18, payments: [],
  data: { items: [{ name: 'Design', quantity: 1, rate: total / 1.18, taxPercent: 18 }], totals: { total }, profile: { businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW' } },
  ...over,
});

try {
  let up = false;
  for (const end = Date.now() + 20000; Date.now() < end && !up; await sleep(250)) {
    try { up = (await fetch(`${BASE}/version`)).ok; } catch { /* starting */ }
  }
  if (!up) throw new Error(`server did not start:\n${out}`);

  ok((await call('POST', '/bills', bill('DC-0901', '2026-09-01'))).status === 200, 'before closing: an invoice dated 1 Sep saves');
  ok((await call('POST', '/period-lock', { upTo: '30/09/2026' })).status === 400, 'a lock date must be YYYY-MM-DD');
  ok((await call('POST', '/period-lock', { upTo: '2026-09-30' })).json?.upTo === '2026-09-30', 'close the books up to 30 Sep');
  ok((await call('GET', '/period-lock')).json?.upTo === '2026-09-30', 'the lock date is kept');

  const added = await call('POST', '/bills', bill('DC-0915', '2026-09-15'));
  ok(added.status === 409 && added.json?.code === 'period-locked' && /2026-09-30/.test(added.json?.error || ''), 'a new invoice dated 15 Sep: refused, with the reason', JSON.stringify(added.json));
  ok((await call('POST', '/bills?overwrite=1', bill('DC-0901', '2026-09-01', 2360))).status === 409, 'changing the amount of the 1 Sep invoice: refused');
  ok((await call('POST', '/bills?overwrite=1', bill('DC-0901', '2026-09-01', 1180, { status: 'cancelled' }))).status === 409, 'cancelling it: refused');
  const paid = bill('DC-0901', '2026-09-01', 1180, { status: 'paid', paidAmount: 1180, payments: [{ date: '2026-11-07', amount: 1180, mode: 'upi' }] });
  ok((await call('POST', '/bills?overwrite=1', paid)).status === 200, 'recording a payment on it: allowed');
  ok((await call('DELETE', '/bills/DC-0901')).status === 409, 'deleting it: refused');
  ok((await call('POST', '/bills', bill('DC-1005', '2026-10-05'))).status === 200, 'an invoice dated 5 Oct (after the lock): saves');
  ok((await call('POST', '/expenses', { id: 'exp_aug', date: '2026-08-10', amount: 500, description: 'Tea' })).status === 409, 'an expense dated in the closed period: refused');
  // v1.10.85 - stock adjustments are dated records too.
  const adj = (id, date) => ({ id, date, productId: 'p1', productName: 'DiceCodes Pen', quantity: -2, reason: 'damaged', stockApplied: { p1: -2 } });
  ok((await call('POST', '/stock-adjustments', adj('adj_sep', '2026-09-20'))).status === 409, 'a stock adjustment dated in the closed period: refused');
  ok((await call('POST', '/stock-adjustments', adj('adj_oct', '2026-10-20'))).status === 200, 'one dated after it: saves');
  ok((await call('POST', '/stock-adjustments', { ...adj('adj_bad', '2026-10-21'), quantity: 'x' })).status === 400, 'one without a number quantity: refused');
  ok((await call('GET', '/stock-adjustments')).json?.map((a) => a.id).join() === 'adj_oct', 'the list has the saved one only');
  ok((await call('DELETE', '/stock-adjustments/adj_oct')).status === 200 && !(await call('GET', '/stock-adjustments')).json?.length, 'an open-period adjustment deletes');

  ok((await call('POST', '/period-lock', { upTo: '' })).json?.upTo === '', 'open the books again');
  ok((await call('DELETE', '/bills/DC-0901')).status === 200, 'now it can be deleted (to the Trash)');
  ok((await call('POST', '/period-lock', { upTo: '2026-09-30' })).status === 200, 'close again');
  ok((await call('POST', '/trash/DC-0901/restore')).status === 409, 'a closed-period invoice cannot come back from the Trash');
  ok((await call('DELETE', '/bills/DC-1005')).status === 200, 'an open-period invoice still deletes');
  await call('POST', '/period-lock', { upTo: '' });

  const history = (await call('GET', '/edit-history?limit=50')).json || [];
  const seen = history.map((h) => `${h.action}:${h.kind}:${h.number || h.date}`);
  ok(seen.includes('added:bills:DC-0901') && seen.includes('changed:bills:DC-0901') && seen.includes('deleted:bills:DC-0901') && seen.includes('added:bills:DC-1005'),
    'the edit history has the add, the payment, the deletes', JSON.stringify(seen));
  ok(seen.includes('closed:books:2026-09-30') && seen.includes('opened:books:'), 'closing and opening the books are in the history too');
  ok(!seen.some((s) => s.includes('DC-0915')) && !seen.some((s) => s.includes('exp_aug')), 'refused changes are not in the history');
  const change = history.find((h) => h.action === 'changed' && h.number === 'DC-0901');
  ok(change?.totalBefore === 1180 && change?.total === 1180 && change?.date === '2026-09-01' && change?.from === 'pc', 'an entry has the total before and after, its date and where it came from', JSON.stringify(change));
  ok(new Date(history[0].at) >= new Date(history[history.length - 1].at), 'newest first');
} catch (e) {
  failed++;
  console.log(`  FAIL the test could not finish: ${e.message}`);
} finally {
  child.kill();
  await Promise.race([exited, sleep(3000)]);
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* Windows may hold a file a moment */ }
}

console.log(`\nperiod-lock-server-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
