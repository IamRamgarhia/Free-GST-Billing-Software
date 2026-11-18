// v1.10.86 - books made by the last release open and work in this one.
//
//   1. v1.10.85 (git tag) is exported to <dir>/old/_system and started on
//      port 47410 with empty books (its data/ is <dir>/old/_system/data).
//   2. Old-shaped records are made through its API and its own code: business,
//      clients, products, sales documents with payments recorded the way
//      v1.10.85 did (Dashboard, Received now, Receipts page), a credit note,
//      purchase bills, a debit note, an expense, receipts, a recurring template.
//   3. The old server stops; its books are copied to <dir>/new/_system/data
//      and this checkout (server.js, package.json, src, a fresh dist) is
//      started on port 47411 against the copy.
//   4. Every list answers with the same records; no file is rewritten (also
//      after the app's screens opened); totals, payments, ledgers, purchase
//      stock, GSTR-1 tables and receipt edits give what v1.10.85 gave.
//   5. Dashboard, Clients, Purchases, Receipts and GST returns open in Firefox
//      with no error.
//
// Run: `npm run test:upgrade` (UPGRADE_DIR=<folder> to choose where; --no-ui
// skips the browser). Never touches the repo's data/: everything lives in
// UPGRADE_DIR. Exits 1 on any failure.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, execSync, execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const OLD_TAG = 'v1.10.85';
const OLD_PORT = 47410;
const NEW_PORT = 47411;
const DIR = path.resolve(process.env.UPGRADE_DIR || path.join(os.tmpdir(), 'fgsb-upgrade-check'));
const OLD_APP = path.join(DIR, 'old', '_system');
const NEW_APP = path.join(DIR, 'new', '_system');
const OLD_DATA = path.join(OLD_APP, 'data');
const NEW_DATA = path.join(NEW_APP, 'data');
const WITH_UI = !process.argv.includes('--no-ui');
const RECORD_DIRS = ['bills', 'clients', 'products', 'purchases', 'expenses', 'receipts', 'recurring', 'debit-notes', 'templates', 'profiles', 'cash-book', 'stock-adjustments', 'purchase-orders', 'productions', 'bank-statements'];

const results = [];
const check = (pass, name, detail = '') => {
  results.push({ pass: !!pass, name, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${name}${!pass && detail ? `\n       ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (v) => JSON.stringify(v);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---- folders -------------------------------------------------------------
// node_modules in each copy is a junction to the repo's: removed with rmdir
// (the link only, never what it points at) before the folder goes.
function removeAppDir(app) {
  const nm = path.join(app, 'node_modules');
  if (fs.existsSync(nm) || isLink(nm)) execFileSync('cmd', ['/c', 'rmdir', nm], { stdio: 'ignore' });
  if (isLink(nm)) throw new Error(`could not remove the node_modules link in ${app}`);
  fs.rmSync(path.dirname(app), { recursive: true, force: true });
}
function isLink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }
const linkNodeModules = (app) => fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(app, 'node_modules'), 'junction');

// ---- servers ---------------------------------------------------------------
const children = [];
async function answers(port) {
  try { return await (await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(1500) })).json(); } catch { return null; }
}
async function startServer(app, port, label) {
  if (await answers(port)) throw new Error(`port ${port} is already in use; stop that first (not touched)`);
  fs.mkdirSync(path.join(app, 'data'), { recursive: true });
  fs.writeFileSync(path.join(app, 'data', 'port.txt'), String(port));
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^FGSB_/i.test(k)) delete env[k]; // books = this folder, phone access off, no PIN
  const child = spawn(process.execPath, ['server.js'], { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.exited = new Promise((r) => child.on('exit', r));
  children.push(child);
  for (const end = Date.now() + 30000; Date.now() < end; await sleep(300)) {
    const v = await answers(port);
    if (v) {
      if (v.pid !== child.pid || path.resolve(v.books) !== path.resolve(app)) throw new Error(`${label}: port ${port} answered for another server (${json(v)})`);
      return { child, base: `http://127.0.0.1:${port}`, out: () => out };
    }
    if (child.exitCode !== null) break;
  }
  throw new Error(`${label} server did not start on ${port}:\n${out}`);
}
async function stopServer(s) {
  if (!s || s.child.exitCode !== null) return;
  s.child.kill();
  await Promise.race([s.child.exited, sleep(5000)]);
}

function api(base) {
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { /* none */ }
    if (!res.ok && method !== 'GET') throw new Error(`${method} ${url}: HTTP ${res.status} ${json(data)}`);
    return { status: res.status, data };
  };
  return {
    get: (u) => call('GET', u),
    post: async (u, b) => (await call('POST', u, b)).data,
  };
}

// The app's own ways of numbering: one more on the counter, written out as
// the old code writes it.
const ENDPOINTS = ['bills', 'clients', 'products', 'purchases', 'expenses', 'receipts', 'recurring', 'debit-notes', 'templates', 'profiles', 'trash', 'cash-book', 'stock-adjustments', 'purchase-orders', 'productions', 'bank-statements'];

// ---- 2. old-shaped books ------------------------------------------------
const PROFILE = {
  id: 'upg-profile', businessName: 'DiceCodes', address: '12 MG Road, Indiranagar', city: 'Bengaluru', pin: '560038',
  state: 'Karnataka', country: 'India', gstin: '29ABCDE1234F1ZW', pan: 'ABCDE1234F', email: 'hello@dicecodes.example',
  phone: '+91 98450 00000', bankName: 'Demo Bank', accountNumber: '000111222333', ifsc: 'DEMO0000123', upiId: 'dicecodes@upi',
};
const CLIENTS = [
  { id: 'upg-c1', name: 'ABC Traders', address: '45 Brigade Road', city: 'Bengaluru', pin: '560025', state: 'Karnataka', country: 'India', gstin: '29AAACA1234A1Z1', email: 'accounts@abc.example', phone: '+91 98450 11111' },
  { id: 'upg-c2', name: 'Mehta Traders', address: '9 Linking Road, Bandra', city: 'Mumbai', pin: '400050', state: 'Maharashtra', country: 'India', gstin: '27AAACM5678B1Z2', email: 'mehta@traders.example', phone: '+91 98200 22222' },
  { id: 'upg-c3', name: 'Green Leaf Cafe', address: '3 Church Street', city: 'Bengaluru', pin: '560001', state: 'Karnataka', country: 'India', gstin: '', email: '', phone: '+91 98450 33333' },
];
const PRODUCTS = [
  { id: 'upg-p1', kind: 'goods', name: 'Laptop stand', hsn: '8473', sellingPrice: 1800, purchasePrice: 1100, taxPercent: 18, unit: 'Pcs', stock: 30 },
  { id: 'upg-p2', kind: 'goods', name: 'USB-C cable', hsn: '8544', sellingPrice: 450, purchasePrice: 220, taxPercent: 18, unit: 'Pcs', stock: 27 },
  { id: 'upg-p3', kind: 'goods', name: 'Wireless mouse', hsn: '8471', sellingPrice: 950, purchasePrice: 600, taxPercent: 18, unit: 'Pcs', stock: 10 },
  { id: 'upg-p4', kind: 'service', name: 'Website design', hsn: '998314', sellingPrice: 25000, purchasePrice: 0, taxPercent: 18, unit: 'Nos', stock: '' },
  { id: 'upg-p5', kind: 'goods', name: 'Printed notebook', hsn: '4820', sellingPrice: 120, purchasePrice: 70, taxPercent: 0, unit: 'Nos', stock: 50 },
];
const owner = { ownerGstin: PROFILE.gstin, ownerName: PROFILE.businessName };

async function makeOldBooks(oldApi, O) {
  const { utils, bank, po, pp, dn } = O;
  await oldApi.post('/api/profile', PROFILE);
  await oldApi.post('/api/profiles', PROFILE);
  for (const c of CLIENTS) await oldApi.post('/api/clients', c);
  for (const p of PRODUCTS) await oldApi.post('/api/products', p);
  // A fresh install's first-run screens done, as on any copy in use.
  await oldApi.post('/api/local-prefs', { set: {
    gst_printSettings: json({ onboardingComplete: true, onboardingSkipped: false }), gst_regionMode: 'india',
    freegstbill_onboarded: 'true', freegstbill_welcomeCard: 'closed', freegstbill_startedDismissed: '1',
    freegstbill_starBanner: json({ done: true }), freegstbill_supportNudge: json({ done: true }), freegstbill_notifyAsked: '1',
    freegstbill_lastSeenVersion: '1.10.85',
  }, remove: [] });

  const fy = '2026-27';
  const number = async (type) => {
    const prefix = utils.INVOICE_TYPES[type].prefix;
    const key = utils.counterKeyFor(prefix, {}, '');
    const { value } = await oldApi.post(`/api/meta/${key}/increment`, { start: 1 });
    return utils.formatDocNumber({ settings: {}, typePrefix: prefix, next: value, fyLabel: fy });
  };
  const [abc, mehta, cafe] = CLIENTS;
  const [stand, cable, , web, book] = PRODUCTS;
  const line = (p, quantity, rate = p.sellingPrice) => ({ id: `${p.id}-l${quantity}`, productId: p.id, name: p.name, hsn: p.hsn, quantity, unit: p.unit, rate, taxPercent: p.taxPercent, discount: 0 });
  // As InvoiceGenerator (v1.10.85) saves a bill.
  const makeBill = async ({ type = 'tax-invoice', client, name = client.name, date, due, items, extraDetails = {}, status = 'unpaid', payments = [] }) => {
    const id = await number(type);
    const showGST = utils.INVOICE_TYPES[type].showGST;
    const details = { invoiceNumber: id, invoiceDate: date, dueDate: due || date, placeOfSupply: client.state, ...extraDetails };
    const totals = utils.computeInvoiceTotals({ items, profile: PROFILE, client, details, showGST });
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const bill = {
      id, clientName: name, invoiceNumber: id, invoiceDate: date, invoiceType: type, currency: 'INR',
      totalAmount: totals.total, totalTaxAmount: totals.totalTaxAmount ?? (totals.cgst + totals.sgst + (totals.utgst || 0) + totals.igst + (totals.cess || 0)),
      status: status === 'cancelled' ? 'cancelled' : (payments.length ? utils.paymentStatusFor({ totalAmount: totals.total, data: { totals } }, paid) : status),
      paidAmount: paid, payments, printedCount: 0, lastPrintedAt: null,
      ...(status === 'cancelled' ? { cancelledAt: `${date}T12:00:00.000Z` } : {}),
      data: { profile: PROFILE, client: { ...client, name }, details, items, totals, invoiceType: type, customTerms: '', customNotes: '', internalNote: '', extraSections: [], invoiceOptions: {}, taxInclusive: false,
        stockApplied: utils.stockEffect(items, type, status) },
    };
    await oldApi.post('/api/bills', bill);
    return bill;
  };
  // Dashboard -> Record payment (v1.10.85): pay_ id, no receipt number, and a
  // receipt RCPT-<id>.
  const dashboardPayment = async (bill, amount, date, mode) => {
    const payment = { id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), amount, date, mode, note: '', recordedAt: new Date().toISOString() };
    const payments = [...(bill.payments || []), payment];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const updated = { ...bill, payments, paidAmount: totalPaid, status: utils.paymentStatusFor(bill, totalPaid) };
    await oldApi.post('/api/bills?overwrite=1', updated);
    await oldApi.post('/api/receipts', {
      id: payment.id, date: payment.date, receiptNo: `RCPT-${payment.id.replace('pay_', '').toUpperCase().slice(0, 10)}`,
      clientName: bill.data?.client?.name || bill.clientName || '', clientAddress: bill.data?.client?.address || '',
      amount: payment.amount, paymentMode: payment.mode, referenceNo: payment.note || '', againstInvoice: bill.invoiceNumber,
      note: '', currency: 'INR', source: 'auto-from-payment', billId: bill.id, ownerGstin: bill.data.profile.gstin, ownerName: bill.data.profile.businessName,
    });
    await sleep(5); // a new pay_ id each time
    return updated;
  };
  // Receipts page -> New receipt against an invoice (v1.10.85): an RCP
  // number; the invoice's payment has that number and no id (the receipt's id
  // was given by the server after).
  const receiptsPagePayment = async (bill, amount, date, paymentMode, clientName) => {
    const key = utils.counterKeyFor('RCP', {}, '');
    const { value } = await oldApi.post(`/api/meta/${key}/increment`, { start: 1 });
    const receiptNo = utils.formatDocNumber({ settings: {}, typePrefix: 'RCP', next: value, fyLabel: fy });
    await oldApi.post('/api/receipts', { date, receiptNo, clientName, clientAddress: '', amount, paymentMode, referenceNo: 'UTR 7781', againstInvoice: bill.invoiceNumber, note: '', ...owner });
    const nextEntry = { id: undefined, amount, date, mode: 'bank-transfer', note: `Receipt ${receiptNo} · ref UTR 7781`, recordedAt: new Date().toISOString(), receiptNo };
    const payments = [...(bill.payments || []), nextEntry];
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const updated = { ...bill, paidAmount: total, status: utils.paymentStatusFor(bill, total), payments };
    await oldApi.post('/api/bills?overwrite=1', updated);
    return JSON.parse(json(updated)); // as saved: no undefined id
  };

  let inv1 = await makeBill({ client: abc, date: '2026-10-02', due: '2026-10-17', items: [line(stand, 10)] });
  inv1 = await dashboardPayment(inv1, 10000, '2026-10-10', 'upi'); // partly paid
  let inv2 = await makeBill({ client: abc, name: 'abc traders ', date: '2026-10-05', due: '2026-10-20', items: [line(web, 1)] });
  inv2 = await receiptsPagePayment(inv2, inv2.totalAmount, '2026-10-12', 'Bank Transfer', 'abc traders ');
  const inv3 = await makeBill({ client: mehta, date: '2026-10-08', due: '2026-10-23', items: [line(cable, 20)] });
  // A name typed with two spaces: v1.10.85 kept it a ledger of its own.
  const inv4 = await makeBill({ client: abc, name: 'ABC  Traders', date: '2026-10-09', due: '2026-10-24', items: [line(stand, 2), line(cable, 3)] });
  await makeBill({ client: mehta, date: '2026-10-11', items: [line(stand, 1)], status: 'cancelled' });
  // Bill of supply paid at the counter with "Received now" (v1.10.85 #185).
  const bosItems = [line(book, 10)];
  const bosId = await number('bill-of-supply');
  const bosTotals = utils.computeInvoiceTotals({ items: bosItems, profile: PROFILE, client: cafe, details: { invoiceNumber: bosId, invoiceDate: '2026-10-14', placeOfSupply: 'Karnataka' }, showGST: false });
  const nowPay = utils.receivedNowPayment({ amount: bosTotals.total, mode: 'cash', date: '2026-10-14' });
  const bos = {
    id: bosId, clientName: cafe.name, invoiceNumber: bosId, invoiceDate: '2026-10-14', invoiceType: 'bill-of-supply', currency: 'INR',
    totalAmount: bosTotals.total, totalTaxAmount: bosTotals.totalTaxAmount ?? 0, status: 'paid', paidAmount: nowPay.amount, payments: [nowPay], printedCount: 0, lastPrintedAt: null,
    data: { profile: PROFILE, client: cafe, details: { invoiceNumber: bosId, invoiceDate: '2026-10-14', dueDate: '2026-10-14', placeOfSupply: 'Karnataka' }, items: bosItems, totals: bosTotals, invoiceType: 'bill-of-supply', invoiceOptions: {}, taxInclusive: false, stockApplied: utils.stockEffect(bosItems, 'bill-of-supply', 'paid') },
  };
  await oldApi.post('/api/bills', bos);
  await oldApi.post('/api/receipts', O.bank.receiptForPayment(bos, nowPay));
  await makeBill({ type: 'proforma', client: cafe, date: '2026-10-15', items: [line(web, 1, 15000)] });
  await makeBill({ type: 'credit-note', client: mehta, date: '2026-10-20', items: [line(cable, 2)], extraDetails: { originalInvoiceRef: inv3.invoiceNumber, originalInvoiceDate: inv3.invoiceDate } });

  // Purchase bills as PurchaseBills.jsx (v1.10.85) saved them: no productId
  // on the lines (matched to products by name), the server gives the id.
  const purchase = (f) => {
    const t = po.purchaseTotals(f.items, false);
    return { ...f, ...owner, totalAmount: t.finalTotal, totalTax: t.tax, taxableAmount: t.taxable, applyRoundOff: false, roundOff: t.roundOff, note: '' };
  };
  const p1 = pp.markPurchasePaid(purchase({ date: '2026-10-01', supplierName: 'Nandi Components', supplierAddress: 'Peenya, Bengaluru', supplierGstin: '29AAKCK1111C1Z3', invoiceNumber: 'NC/882', paymentStatus: 'Paid', interstate: false,
    items: [{ name: 'Laptop stand', hsn: '8473', quantity: 40, rate: 1100, taxPercent: 18, cessPercent: 0 }] }), '2026-10-01', new Date(), 'bank-transfer');
  const p1Saved = await oldApi.post('/api/purchases', p1);
  const p2 = purchase({ date: '2026-10-03', supplierName: 'Delhi Cable Co', supplierAddress: 'Okhla, New Delhi', supplierGstin: '07AADCD2222D1Z4', invoiceNumber: 'DCC-1043', paymentStatus: 'Unpaid', interstate: true,
    items: [{ name: 'USB-C cable', hsn: '8544', quantity: 50, rate: 220, taxPercent: 18, cessPercent: 0 }, { name: 'Wireless Mouse', hsn: '8471', quantity: 10, rate: 600, taxPercent: 18, cessPercent: 0, discount: 5, discountType: 'percent' }] });
  const p2Saved = await oldApi.post('/api/purchases', p2);
  // Debit note: 5 cables back to Delhi Cable Co.
  const bill2 = { ...p2, id: p2Saved.id };
  const note = dn.debitNoteFromBill(bill2, [], { 0: 5 }, { date: '2026-10-18', reason: 'Damaged in transit' });
  const { value: dnNext } = await oldApi.post(`/api/meta/${dn.dnCounterKey('')}/increment`, { start: 1 });
  await oldApi.post('/api/debit-notes', { ...note, dnNumber: dn.formatDnNumber(dnNext, note.date), stockApplied: dn.debitNoteStock(note, PRODUCTS) });

  await oldApi.post('/api/expenses', { id: 'upg-e1', date: '2026-10-01', description: 'Office rent - October', category: 'Office Rent', amount: 30000, gstAmount: 5400, gstPercent: 18, vendorName: 'Indiranagar Spaces', vendorGstin: '29AAFCI3333E1Z5', invoiceNo: 'R-1026', paymentMode: 'Bank Transfer', interstate: false, paymentStatus: 'paid', paidAmount: '', ...owner });
  // An advance on no invoice, typed with other case.
  const { value: rcp2 } = await oldApi.post(`/api/meta/${utils.counterKeyFor('RCP', {}, '')}/increment`, { start: 1 });
  await oldApi.post('/api/receipts', { date: '2026-10-25', receiptNo: utils.formatDocNumber({ settings: {}, typePrefix: 'RCP', next: rcp2, fyLabel: fy }), clientName: 'Abc Traders', clientAddress: '', amount: 2000, paymentMode: 'Cash', referenceNo: '', againstInvoice: '', note: 'Advance for November order', ...owner });
  await oldApi.post('/api/recurring', { id: 'upg-t1', clientName: 'ABC Traders', frequency: 'monthly', interval: 1, endMode: 'never', endDate: '', maxOccurrences: '',
    items: [{ name: 'Website design', hsn: '998314', quantity: 1, rate: 5000, taxPercent: 18, discount: 0 }], notes: 'Monthly maintenance', nextDate: '2027-01-01', active: true, ...owner });
  return { inv1, inv2, inv3, inv4, bos, p1Id: p1Saved.id, p2Id: p2Saved.id };
}

// ---- comparing --------------------------------------------------------------
// Key-level changes from a to b: [path, 'added' | 'removed' | 'changed'].
function diffKeys(a, b, at = '') {
  if (json(a) === json(b)) return [];
  const isObj = (v) => v && typeof v === 'object';
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) return [[at || '(root)', 'changed']];
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = at ? `${at}.${k}` : k;
    if (!(k in b)) out.push([p, 'removed']);
    else if (!(k in a)) out.push([p, 'added']);
    else out.push(...diffKeys(a[k], b[k], p));
  }
  return out;
}
function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory()
    ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));
}
// The record files of the old books against the copy the new server runs on.
function diskChanges() {
  const inRecords = (f) => RECORD_DIRS.includes(f.split('/')[0]) || ['profile.json', 'meta.json'].includes(f);
  const before = listFiles(OLD_DATA).filter(inRecords);
  const after = new Set(listFiles(NEW_DATA).filter(inRecords));
  const removed = before.filter((f) => !after.has(f));
  const changed = [];
  for (const f of before) {
    if (!after.has(f)) continue;
    const a = fs.readFileSync(path.join(OLD_DATA, f), 'utf8');
    const b = fs.readFileSync(path.join(NEW_DATA, f), 'utf8');
    if (a !== b) {
      let keys = [];
      try {
        const [x, y] = [JSON.parse(a), JSON.parse(b)];
        keys = diffKeys(x, y);
        // The Dashboard marks an invoice past its due date Overdue, as
        // v1.10.85's did (Dashboard.jsx): not an upgrade change.
        const overdue = f.startsWith('bills/') && y.status === 'overdue' && ['unpaid', 'partial'].includes(x.status)
          && String(x.data?.details?.dueDate || '') < new Date().toISOString().slice(0, 10);
        if (overdue && keys.length === 1 && keys[0][0] === 'status') keys = [];
      } catch { keys = [['(not JSON)', 'changed']]; }
      if (keys.length) changed.push({ f, keys });
    }
  }
  const added = [...after].filter((f) => !before.includes(f));
  return { removed, changed, added };
}

// ---- main ------------------------------------------------------------------
let oldSrv = null, newSrv = null;
try {
  console.log(`\nUpgrade check: books made by ${OLD_TAG} in this checkout\n  folder: ${DIR}\n`);
  for (const app of [OLD_APP, NEW_APP]) if (fs.existsSync(path.dirname(app))) removeAppDir(app);
  fs.mkdirSync(OLD_APP, { recursive: true });
  fs.mkdirSync(NEW_APP, { recursive: true });

  // 1. The old release, from its tag.
  execSync(`git -C "${ROOT}" archive --format=tar ${OLD_TAG} server.js package.json src | tar -xf -`, { cwd: OLD_APP, stdio: ['ignore', 'ignore', 'inherit'] });
  linkNodeModules(OLD_APP);
  const oldVersion = JSON.parse(fs.readFileSync(path.join(OLD_APP, 'package.json'), 'utf8')).version;
  check(oldVersion === OLD_TAG.slice(1), `old copy is ${OLD_TAG}`, oldVersion);
  const imp = (app, f) => import(pathToFileURL(path.join(app, f)).href);
  const O = {
    utils: await imp(OLD_APP, 'src/utils.js'), bank: await imp(OLD_APP, 'src/utils/bankMatch.js'), po: await imp(OLD_APP, 'src/utils/purchaseOrders.js'),
    pp: await imp(OLD_APP, 'src/utils/purchasePayments.js'), dn: await imp(OLD_APP, 'src/utils/debitNotes.js'),
    ledger: await imp(OLD_APP, 'src/utils/clientLedger.js'), gstr1: await imp(OLD_APP, 'src/utils/gstr1Json.js'),
  };
  const N = {
    utils: await imp(ROOT, 'src/utils.js'), bank: await imp(ROOT, 'src/utils/bankMatch.js'), po: await imp(ROOT, 'src/utils/purchaseOrders.js'),
    pp: await imp(ROOT, 'src/utils/purchasePayments.js'), dn: await imp(ROOT, 'src/utils/debitNotes.js'),
    ledger: await imp(ROOT, 'src/utils/clientLedger.js'), gstr1: await imp(ROOT, 'src/utils/gstr1Json.js'),
    stock: await imp(ROOT, 'src/utils/purchaseStock.js'),
  };

  // 2. Old books, made by the old server.
  oldSrv = await startServer(OLD_APP, OLD_PORT, 'old');
  const oldApi = api(oldSrv.base);
  const made = await makeOldBooks(oldApi, O);
  const oldLists = {};
  for (const e of ENDPOINTS) oldLists[e] = await oldApi.get(`/api/${e}`);
  const oldProfile = (await oldApi.get('/api/profile')).data;
  check(oldLists.bills.data?.length === 8 && oldLists.receipts.data?.length === 4 && oldLists.purchases.data?.length === 2,
    'old books made through v1.10.85 (8 sales documents, 4 receipts, 2 purchase bills)', `bills ${oldLists.bills.data?.length}, receipts ${oldLists.receipts.data?.length}`);
  await stopServer(oldSrv);

  // 3. The new app on a copy of those books.
  fs.cpSync(OLD_DATA, NEW_DATA, { recursive: true, filter: (src) => path.basename(src) !== 'server.lock' });
  for (const f of ['server.js', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(NEW_APP, f));
  fs.cpSync(path.join(ROOT, 'src'), path.join(NEW_APP, 'src'), { recursive: true });
  linkNodeModules(NEW_APP);
  if (WITH_UI) {
    console.log('  building the app (vite)...');
    execSync(`npx vite build --outDir "${path.join(NEW_APP, 'dist')}" --emptyOutDir --logLevel error`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const errorsLogBefore = (() => { try { return fs.readFileSync(path.join(NEW_DATA, 'errors.log'), 'utf8'); } catch { return ''; } })();
  newSrv = await startServer(NEW_APP, NEW_PORT, 'new');
  const newApi = api(newSrv.base);

  // 4a. Every list: answers, same records.
  const lists = {};
  for (const e of ENDPOINTS) {
    const now = await newApi.get(`/api/${e}`);
    lists[e] = now.data;
    const before = oldLists[e].data || [];
    const byId = new Map((now.data || []).map((r) => [r.id, r]));
    const changes = before.flatMap((r) => (byId.has(r.id) ? diffKeys(r, byId.get(r.id)).map(([k, how]) => `${r.id}.${k} ${how}`) : [`${r.id} missing`]));
    check(now.status === 200 && Array.isArray(now.data) && now.data.length === before.length && !changes.length,
      `GET /api/${e}: 200, ${before.length} record(s), none changed`, `status ${now.status}, ${now.data?.length} records; ${changes.slice(0, 6).join('; ')}`);
  }
  const profile = (await newApi.get('/api/profile')).data;
  check(json(profile) === json(oldProfile), 'GET /api/profile: the same business');

  // 4b. No file of the books rewritten by starting the new server.
  const disk1 = diskChanges();
  check(!disk1.removed.length && !disk1.changed.length, 'no record file removed or rewritten when the new server starts',
    json({ removed: disk1.removed, changed: disk1.changed }));
  if (disk1.added.length) console.log(`       (files added: ${disk1.added.join(', ')})`);

  // 5. The screens.
  if (WITH_UI) await uiCheck(newSrv.base);
  const disk2 = diskChanges();
  check(!disk2.removed.length && !disk2.changed.length, 'no record file removed or rewritten after the screens opened',
    json({ removed: disk2.removed, changed: disk2.changed.map((c) => ({ f: c.f, keys: c.keys.slice(0, 8) })) }));
  const errorsLog = (() => { try { return fs.readFileSync(path.join(NEW_DATA, 'errors.log'), 'utf8'); } catch { return ''; } })();
  const newErrors = errorsLog.slice(errorsLogBefore.length).trim();
  check(!newErrors, 'errors.log: nothing new', newErrors.slice(0, 600));

  // 4c. Money: totals, paid, status, what is due.
  const bills = lists.bills;
  const moneyDiffs = bills.filter((b) => O.utils.amountDue(b) !== N.utils.amountDue(b)
    || O.utils.paymentStatusFor(b, b.paidAmount) !== N.utils.paymentStatusFor(b, b.paidAmount)).map((b) => b.id);
  check(!moneyDiffs.length, 'amountDue and paymentStatusFor: the same for every invoice', moneyDiffs.join(', '));
  const statusDiffs = bills.filter((b) => b.status !== 'cancelled' && ['tax-invoice', 'bill-of-supply'].includes(b.invoiceType) && b.status !== N.utils.paymentStatusFor(b, b.paidAmount));
  check(!statusDiffs.length, 'saved status still agrees with the payments', statusDiffs.map((b) => `${b.id} ${b.status}`).join(', '));
  const inv1 = bills.find((b) => b.id === made.inv1.id);
  check(inv1 && inv1.status === 'partial' && inv1.paidAmount === 10000 && r2(N.utils.amountDue(inv1) - inv1.paidAmount) === r2(made.inv1.totalAmount - 10000),
    'the partly paid invoice: still partly paid, same balance', json({ status: inv1?.status, paid: inv1?.paidAmount }));

  // 4d. Client ledger: one key for "ABC Traders", "abc traders " and "ABC  Traders".
  const N_L = N.ledger, O_L = O.ledger;
  const abcBills = bills.filter((b) => N.utils.clientKey(b.clientName) === 'abc traders');
  check(abcBills.length === 3, 'clientKey: "ABC Traders", "abc traders " and "ABC  Traders" are one client', abcBills.map((b) => json(b.clientName)).join(', '));
  const oldOwed = O_L.clientAccount('ABC Traders', bills, profile).owed + O_L.clientAccount('ABC  Traders', bills, profile).owed;
  const opening = N_L.openingDue(lists.clients.find((c) => c.id === 'upg-c1'), bills, lists.receipts, profile);
  check(opening.due === 0 && opening.opening === 0, 'a client saved before opening balances has none', json(opening));
  const newAcc = N_L.clientAccount('ABC Traders', bills, profile, null, opening.due);
  check(r2(newAcc.owed) === r2(oldOwed) && r2(newAcc.owed) === r2(N_L.clientOutstanding('ABC Traders', bills, profile)),
    'outstanding with no opening balance = what v1.10.85 showed (its two ledgers added up)', `new ${newAcc.owed}, old ${oldOwed}`);
  for (const c of ['Mehta Traders', 'Green Leaf Cafe']) {
    const a = O_L.clientAccount(c, bills, profile), b = N_L.clientAccount(c, bills, profile);
    check(json(a) === json(b), `${c}: account (owed, credit) unchanged`, `${json(a)} vs ${json(b)}`);
  }
  const histOld = ['ABC Traders', 'ABC  Traders'].flatMap((n) => O_L.clientPaymentHistory(n, bills, lists.receipts));
  const histNew = N_L.clientPaymentHistory('ABC Traders', bills, lists.receipts);
  const sumAmt = (rows) => r2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  check(histNew.length === 3 && sumAmt(histNew) === sumAmt(histOld), 'ABC Traders payment history: 2 invoice payments + the advance, nothing twice',
    `${histNew.length} rows ${sumAmt(histNew)} vs old ${sumAmt(histOld)}`);
  const onAcc = N_L.onAccountReceipts('ABC Traders', bills, lists.receipts);
  check(onAcc.length === 1 && onAcc[0].amount === 2000, 'on-account receipts: only the advance (linked receipts are not counted again)', json(onAcc.map((r) => r.receiptNo)));

  // 4e. Purchases: same totals and balances; stock matched by name.
  const products = lists.products;
  const purDiffs = lists.purchases.filter((p) => json(O.po.purchaseTotals(p.items, !!p.applyRoundOff).finalTotal) !== json(N.po.purchaseTotals(p.items, !!p.applyRoundOff).finalTotal)
    || O.pp.purchaseBalance(p) !== N.pp.purchaseBalance(p) || O.pp.purchaseStatus(p) !== N.pp.purchaseStatus(p));
  check(!purDiffs.length, 'purchase bills: total, balance and status unchanged', purDiffs.map((p) => p.invoiceNumber).join(', '));
  const withRet = (M) => M.dn.withReturns(lists.purchases, lists['debit-notes']).map((p) => [p.id, M.pp.purchaseBalance(p), M.dn.returnedOnBill(p, lists['debit-notes'])]);
  check(json(withRet(O)) === json(withRet(N)), 'purchase balances less debit-note returns unchanged', `${json(withRet(O))} vs ${json(withRet(N))}`);
  for (const p of lists.purchases) {
    const unmatched = p.items.filter((it) => !it.productId && !N.stock.findLineProduct(products, it));
    check(p.items.every((it) => !it.productId) && !unmatched.length, `${p.invoiceNumber}: old lines (no productId) still find their product by name`, unmatched.map((it) => it.name).join(', '));
    let made = 0;
    const plan = N.stock.purchaseStockPlan(products, p.items, p.items, () => `new-${++made}`);
    const moved = plan.writes.filter((w) => Number(w.stock) !== Number(products.find((x) => x.id === w.id)?.stock));
    check(!made && !moved.length && plan.items.every((it) => it.productId), `${p.invoiceNumber}: editing it unchanged moves no stock and makes no product`,
      json({ made, moved: moved.map((w) => [w.name, w.stock]) }));
  }
  const dnStock = (M) => lists['debit-notes'].map((d) => M.dn.debitNoteStock(d, products));
  check(json(dnStock(O)) === json(dnStock(N)), 'debit note: same stock effect', `${json(dnStock(O))} vs ${json(dnStock(N))}`);

  // 4f. GSTR-1: the tables v1.10.85 built, and no Table 14 (supeco).
  const octBills = bills.filter((b) => String(b.invoiceDate).startsWith('2026-10'));
  const gstrParts = (G) => json({
    hsn: G.hsnSummary(octBills), docs: G.docIssueDetails(G.docIssueSummary(octBills)),
    lines: octBills.map((b) => ({ id: b.id, inter: G.billIsInterstate(b), b2b: G.hsnIsB2B(b), exp: G.isExportBill(b),
      split: (b.data.items || []).map((it) => [G.lineTreatment({ invoiceType: b.invoiceType, isExport: G.isExportBill(b), taxPercent: it.taxPercent, gstTreatment: it.gstTreatment }),
        G.billSplit(b, it, G.billIsInterstate(b), !!b.data.taxInclusive, !!b.data.totals?.isIntraUT)]) })),
  });
  check(gstrParts(O.gstr1) === gstrParts(N.gstr1), 'GSTR-1 HSN, documents and line tax: byte-identical to v1.10.85');
  const eco = N.gstr1.ecoSummary(octBills);
  const file = N.gstr1.stripEmpty({ gstin: profile.gstin, fp: '102026', hsn: N.gstr1.hsnTable(N.gstr1.hsnSummary(octBills).rows, '102026'), supeco: { clttx: eco } });
  check(!eco.length && !('supeco' in file), 'GSTR-1 file: no supeco key for old invoices (no e-commerce operator)', json(eco));

  // 4g. Receipts: old payments edited through the v1.10.86 helpers.
  const receipts = lists.receipts;
  const dashPay = inv1.payments[0];
  const dashRcp = receipts.find((r) => r.id === dashPay.id);
  check(dashRcp && !dashPay.receiptNo && N.bank.paymentReceiptNo(dashPay) === dashRcp.receiptNo && N.bank.receiptForPayment(inv1, dashPay).receiptNo === dashRcp.receiptNo,
    'Dashboard payment of v1.10.85: its receipt keeps its RCPT- number', json({ payment: dashPay.id, receipt: dashRcp?.receiptNo }));
  const inv2 = bills.find((b) => b.id === made.inv2.id);
  const pagePay = inv2.payments[0];
  const pageRcp = receipts.find((r) => r.receiptNo === pagePay.receiptNo);
  for (const [label, bill, rcp] of [['Dashboard', inv1, dashRcp], ['Receipts page', inv2, pageRcp]]) {
    const matched = bill.payments.filter(N.bank.isReceiptsPayment({ id: rcp.id, receiptNo: rcp.receiptNo }));
    const entry = { id: rcp.id, amount: rcp.amount - 100, date: rcp.date, mode: 'upi', note: `Receipt ${rcp.receiptNo}`, recordedAt: new Date().toISOString(), receiptNo: rcp.receiptNo };
    const next = N.bank.withReceiptPayment(bill.payments, { id: rcp.id, receiptNo: rcp.receiptNo }, entry);
    check(matched.length === 1 && next.length === bill.payments.length && r2(next.reduce((s, p) => s + p.amount, 0)) === r2(bill.paidAmount - 100),
      `${label} receipt edited in Receipts: its payment replaced, not added again`, json({ matched: matched.length, before: bill.payments.length, after: next.length }));
    // ... and saved through the new server.
    const total = next.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    await newApi.post('/api/bills?overwrite=1', { ...bill, payments: next, paidAmount: total, status: N.utils.paymentStatusFor(bill, total) });
    await newApi.post('/api/receipts', { ...rcp, amount: entry.amount });
  }
  const after = (await newApi.get('/api/bills')).data;
  const a1 = after.find((b) => b.id === inv1.id), a2 = after.find((b) => b.id === inv2.id);
  check(a1.payments.length === 1 && a1.paidAmount === 9900 && a2.payments.length === 1 && a2.status === 'partial',
    'after saving the edits: one payment each, paid amounts follow', json({ inv1: [a1.payments.length, a1.paidAmount, a1.status], inv2: [a2.payments.length, a2.paidAmount, a2.status] }));
  const rcpAfter = (await newApi.get('/api/receipts')).data;
  check(rcpAfter.length === receipts.length, 'receipts: still one per payment after the edits', `${rcpAfter.length} vs ${receipts.length}`);

  // One RCP series: a new payment's number follows the Receipts page's.
  const { value: nextRcp } = await newApi.post(`/api/meta/${N.utils.counterKeyFor('RCP', {}, '')}/increment`, { start: 1 });
  const nextNo = N.utils.formatDocNumber({ settings: {}, typePrefix: 'RCP', next: nextRcp, fyLabel: '2026-27' });
  check(nextRcp === 3 && !receipts.some((r) => r.receiptNo === nextNo), 'the next receipt number carries on the old RCP series (no number used twice)', nextNo);

  // Old records saved again through the new server are accepted.
  const reClient = await fetch(`${newSrv.base}/api/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json(lists.clients[0]) });
  check(reClient.ok, 'an old client (no opening balance fields) saves again', `HTTP ${reClient.status}`);
  const reBuy = await fetch(`${newSrv.base}/api/purchases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json(lists.purchases[0]) });
  check(reBuy.ok, 'an old purchase bill saves again', `HTTP ${reBuy.status}`);
} catch (err) {
  check(false, 'the check ran to the end', err.stack || String(err));
} finally {
  await stopServer(newSrv);
  await stopServer(oldSrv);
  for (const c of children) if (c.exitCode === null) c.kill();
}

async function uiCheck(base) {
  const { firefox } = await import('playwright');
  const browser = await firefox.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    const toasts = async () => page.evaluate(() => [...document.querySelectorAll('.toast-message')].map((t) => t.textContent.trim()));
    await page.goto(base, { waitUntil: 'networkidle' });
    await sleep(2000);
    // "What's new" for v1.10.86, or anything else that shows first.
    for (let i = 0; i < 6; i++) {
      const blocked = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay')].some((o) => o.getBoundingClientRect().width > 0));
      if (!blocked) break;
      const btn = page.getByRole('button', { name: /^skip setup$|none of these|get started|continue|finish|close|got it|done/i });
      if (!(await btn.count())) { await page.keyboard.press('Escape'); await sleep(800); continue; }
      await btn.first().click({ timeout: 5000 }).catch(() => {});
      await sleep(1000);
    }
    check(await page.evaluate(() => !!document.querySelector('.sidebar .nav-btn')), 'app opens on the old books (menu shown)');
    for (const label of ['Dashboard', 'Clients', 'Purchases', 'Receipts', 'GST Returns']) {
      const before = problems.length;
      const found = await page.evaluate((label) => {
        const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim().toLowerCase() === label.toLowerCase());
        if (b) b.click();
        return !!b;
      }, label);
      await sleep(2500);
      const errToasts = (await toasts()).filter((t) => /error|fail|could not|couldn't|went wrong|not saved/i.test(t));
      const fresh = problems.slice(before);
      check(found && !errToasts.length && !fresh.length, `screen ${label}: opens with no error`,
        [!found && 'menu button not found', ...errToasts.map((t) => `toast: ${t}`), ...fresh].filter(Boolean).join(' | ').slice(0, 600));
    }
  } finally {
    await browser.close();
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(`  - ${f.name}`)); }
console.log(`(books kept in ${DIR})\n`);
process.exit(failed.length ? 1 : 0);
