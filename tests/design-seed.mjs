// The fixed demo books the design check photographs (tests/design-check.mjs).
// Every date is fixed and the browser clock is frozen at FROZEN_AT, so the
// screens look the same on every run. DiceCodes only, fake GSTINs.
import { computeInvoiceTotals } from '../src/utils.js';

export const FROZEN_AT = '2026-10-20T10:30:00+05:30';
export const ID = 'dc-design-';

const PROFILE = {
  id: `${ID}profile`,
  businessName: 'DiceCodes',
  address: '12 MG Road, Indiranagar',
  city: 'Bengaluru',
  pin: '560038',
  state: 'Karnataka',
  country: 'India',
  gstin: '29ABCDE1234F1ZW',
  pan: 'ABCDE1234F',
  email: 'hello@dicecodes.example',
  phone: '+91 98450 00000',
  bankName: 'Demo Bank',
  accountNumber: '000111222333',
  ifsc: 'DEMO0000123',
  upiId: 'dicecodes@upi',
  logo: '',
  signature: '',
};

const CLIENTS = [
  { id: `${ID}c1`, name: 'Sharma Electronics', address: '45 Brigade Road', city: 'Bengaluru', pin: '560025', state: 'Karnataka', country: 'India', gstin: '29AAACS1234A1Z1', email: 'accounts@sharma.example', phone: '+91 98450 11111' },
  { id: `${ID}c2`, name: 'Mehta Traders', address: '9 Linking Road, Bandra', city: 'Mumbai', pin: '400050', state: 'Maharashtra', country: 'India', gstin: '27AAACM5678B1Z2', email: 'mehta@traders.example', phone: '+91 98200 22222' },
  { id: `${ID}c3`, name: 'Green Leaf Cafe', address: '3 Church Street', city: 'Bengaluru', pin: '560001', state: 'Karnataka', country: 'India', gstin: '', email: '', phone: '+91 98450 33333' },
  { id: `${ID}c4`, name: 'Nordic Design AB', address: 'Storgatan 10', city: 'Stockholm', pin: '11451', state: '', country: 'Sweden', gstin: '', email: 'billing@nordic.example', phone: '+46 8 123 456', preferredCurrency: 'USD' },
];

const PRODUCTS = [
  { id: `${ID}p1`, kind: 'service', name: 'Website design', hsn: '998314', sellingPrice: 25000, purchasePrice: 0, taxPercent: 18, unit: 'Nos', stock: '' },
  { id: `${ID}p2`, kind: 'goods', name: 'Laptop stand', hsn: '8473', sellingPrice: 1800, purchasePrice: 1100, taxPercent: 18, unit: 'Pcs', stock: 24 },
  { id: `${ID}p3`, kind: 'goods', name: 'USB-C cable', hsn: '8544', sellingPrice: 450, purchasePrice: 220, taxPercent: 18, unit: 'Pcs', stock: 2 },
  { id: `${ID}p4`, kind: 'goods', name: 'Wireless mouse', hsn: '8471', sellingPrice: 950, purchasePrice: 600, taxPercent: 18, unit: 'Pcs', stock: 0 },
  { id: `${ID}p5`, kind: 'service', name: 'Annual support', hsn: '998713', sellingPrice: 12000, purchasePrice: 0, taxPercent: 18, unit: 'Nos', stock: '' },
];

const line = (p, quantity, rate = p.sellingPrice) => ({ id: `${p.id}-${quantity}`, name: p.name, hsn: p.hsn, quantity, unit: p.unit, rate, taxPercent: p.taxPercent, discount: 0 });
const [web, stand, cable, mouse, support] = PRODUCTS;
const [sharma, mehta, cafe, nordic] = CLIENTS;

// [number, client, date, due, status, lines, paidPart]
const INVOICES = [
  [1, sharma, '2026-09-02', '2026-09-17', 'paid', [line(web, 1)], 1],
  [2, mehta, '2026-09-05', '2026-09-20', 'paid', [line(stand, 10), line(cable, 10)], 1],
  [3, cafe, '2026-09-10', '2026-09-10', 'paid', [line(stand, 2)], 1],
  [4, nordic, '2026-09-14', '2026-10-14', 'overdue', [line(web, 1, 30000)], 0],
  [5, sharma, '2026-09-21', '2026-10-06', 'overdue', [line(support, 1)], 0],
  [6, mehta, '2026-09-28', '2026-10-13', 'partial', [line(stand, 20)], 0.5],
  [7, cafe, '2026-10-01', '2026-10-01', 'paid', [line(cable, 4), line(mouse, 2)], 1],
  [8, sharma, '2026-10-05', '2026-10-20', 'unpaid', [line(stand, 5), line(mouse, 5)], 0],
  [9, mehta, '2026-10-08', '2026-10-23', 'cancelled', [line(cable, 30)], 0],
  [10, nordic, '2026-10-12', '2026-11-11', 'unpaid', [line(support, 2)], 0],
  [11, sharma, '2026-10-15', '2026-10-30', 'unpaid', [line(web, 1, 18000)], 0],
  [12, cafe, '2026-10-18', '2026-10-18', 'paid', [line(stand, 1), line(cable, 2)], 1],
  [13, mehta, '2026-10-19', '2026-11-03', 'unpaid', [line(mouse, 3)], 0], // goes to the Trash
];

const pos = (c) => (c.country === 'India' ? c.state : 'Other Territory');

function bill([n, client, date, due, status, items, paidPart]) {
  const number = `DC/26-27/${String(n).padStart(3, '0')}`;
  const details = { invoiceNumber: number, invoiceDate: date, dueDate: due, placeOfSupply: pos(client) };
  const totals = computeInvoiceTotals({ items, profile: PROFILE, client, details, showGST: true });
  const paid = Math.round(totals.total * paidPart * 100) / 100;
  const payments = paid > 0 ? [{ id: `${ID}pay${n}`, amount: paid, date, mode: 'bank-transfer', note: '' }] : [];
  return {
    id: number, invoiceNumber: number, clientName: client.name, invoiceDate: date, invoiceType: 'tax-invoice',
    currency: 'INR', totalAmount: totals.total, totalTaxAmount: totals.totalTaxAmount ?? (totals.cgst + totals.sgst + totals.igst),
    status, paidAmount: paid, payments, printedCount: 0, lastPrintedAt: null,
    ...(status === 'cancelled' ? { cancelledAt: `${date}T12:00:00.000Z` } : {}),
    data: { profile: PROFILE, client, details, items, totals, invoiceType: 'tax-invoice', invoiceOptions: {}, taxInclusive: false },
  };
}

const owner = { ownerGstin: PROFILE.gstin, ownerName: PROFILE.businessName };

const PURCHASES = [
  { id: `${ID}b1`, date: '2026-09-04', supplierName: 'Kaveri Components', supplierGstin: '29AAKCK1111C1Z3', supplierAddress: 'Peenya, Bengaluru', invoiceNumber: 'KC/882', interstate: false, paymentStatus: 'Paid',
    items: [{ name: 'Laptop stand', hsn: '8473', quantity: 40, rate: 1100, taxPercent: 18, cessPercent: 0, discount: 0 }] },
  { id: `${ID}b2`, date: '2026-09-22', supplierName: 'Delhi Cable Co', supplierGstin: '07AADCD2222D1Z4', supplierAddress: 'Okhla, New Delhi', invoiceNumber: 'DCC-1043', interstate: true, paymentStatus: 'Unpaid',
    items: [{ name: 'USB-C cable', hsn: '8544', quantity: 50, rate: 220, taxPercent: 18, cessPercent: 0, discount: 0 }, { name: 'Wireless mouse', hsn: '8471', quantity: 10, rate: 600, taxPercent: 18, cessPercent: 0, discount: 0 }] },
  { id: `${ID}b3`, date: '2026-10-09', supplierName: 'Kaveri Components', supplierGstin: '29AAKCK1111C1Z3', supplierAddress: 'Peenya, Bengaluru', invoiceNumber: 'KC/915', interstate: false, paymentStatus: 'Unpaid',
    items: [{ name: 'Laptop stand', hsn: '8473', quantity: 10, rate: 1100, taxPercent: 18, cessPercent: 0, discount: 0 }] },
].map((p) => ({ ...p, ...owner, reverseCharge: false, applyRoundOff: false, note: '', kind: 'bill' }));

const EXPENSES = [
  { id: `${ID}e1`, date: '2026-09-01', description: 'Office rent - September', category: 'Office Rent', amount: 30000, gstAmount: 5400, gstPercent: 18, vendorName: 'Indiranagar Spaces', vendorGstin: '29AAFCI3333E1Z5', invoiceNo: 'R-0926', paymentMode: 'Bank Transfer' },
  { id: `${ID}e2`, date: '2026-09-12', description: 'Broadband', category: 'Internet & Phone', amount: 1500, gstAmount: 270, gstPercent: 18, vendorName: 'FastNet', vendorGstin: '', invoiceNo: 'FN-7781', paymentMode: 'UPI' },
  { id: `${ID}e3`, date: '2026-10-01', description: 'Office rent - October', category: 'Office Rent', amount: 30000, gstAmount: 5400, gstPercent: 18, vendorName: 'Indiranagar Spaces', vendorGstin: '29AAFCI3333E1Z5', invoiceNo: 'R-1026', paymentMode: 'Bank Transfer' },
  { id: `${ID}e4`, date: '2026-10-07', description: 'Electricity', category: 'Utilities', amount: 2350, gstAmount: 0, gstPercent: 0, vendorName: 'BESCOM', vendorGstin: '', invoiceNo: '', paymentMode: 'UPI' },
].map((e) => ({ ...e, ...owner, interstate: false, paymentStatus: 'paid', paidAmount: '' }));

const RECEIPTS = [
  { id: `${ID}r1`, date: '2026-09-30', receiptNo: 'RCPT-001', clientName: 'Mehta Traders', clientAddress: 'Mumbai', amount: 5000, paymentMode: 'Bank Transfer', referenceNo: 'UTR 4455', againstInvoice: '', note: 'Advance for October order' },
  { id: `${ID}r2`, date: '2026-10-16', receiptNo: 'RCPT-002', clientName: 'Green Leaf Cafe', clientAddress: 'Bengaluru', amount: 1200, paymentMode: 'Cash', referenceNo: '', againstInvoice: '', note: '' },
].map((r) => ({ ...r, ...owner }));

const RECURRING = [{
  id: `${ID}t1`, clientName: 'Sharma Electronics', frequency: 'monthly', interval: 1, endMode: 'never', endDate: '', maxOccurrences: '',
  items: [{ name: 'Annual support', hsn: '998713', quantity: 1, rate: 1000, taxPercent: 18, discount: 0 }],
  notes: 'Monthly support retainer', nextDate: '2026-11-01', active: false, ...owner,
}];

// Every record the seed writes (the guard and the reset look only at these ids).
const KINDS = { clients: CLIENTS, products: PRODUCTS, purchases: PURCHASES, expenses: EXPENSES, receipts: RECEIPTS, recurring: RECURRING };

/**
 * Writes the demo books through the app's API (from Node, so no open page can
 * write its own settings back afterwards). Refuses books that are not its own.
 */
export async function seedBooks(app) {
  const bills = INVOICES.map(bill);
  const trashed = bills[bills.length - 1].id;
  const call = async (u, init) => {
    const res = await fetch(`${app}${u}`, init);
    if (!res.ok && init?.method !== 'DELETE') throw new Error(`${init?.method || 'GET'} ${u}: HTTP ${res.status}`);
    return res;
  };
  const json = async (u) => (await call(u)).json();
  const post = (u, b) => call(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const del = (u) => call(u, { method: 'DELETE' });

  // Safety: real books have records of their own. Stop rather than mix in.
  const profile = await json('/api/profile');
  const foreign = [];
  if (profile.businessName && profile.businessName !== PROFILE.businessName) foreign.push(`profile "${profile.businessName}"`);
  for (const kind of ['bills', 'clients', 'products', 'purchases', 'expenses', 'receipts']) {
    const own = kind === 'bills' ? (r) => /^DC\/26-27\//.test(r.id) : (r) => String(r.id || '').startsWith(ID);
    const other = (await json(`/api/${kind}`)).filter((r) => !own(r));
    if (other.length) foreign.push(`${other.length} ${kind}`);
  }
  if (foreign.length) {
    throw new Error(`These books are not the design check's own (found ${foreign.join(', ')}). Run it on fresh books: npm run test:design starts its own.`);
  }

  await post('/api/profile', PROFILE);
  await post('/api/profiles', PROFILE);
  for (const [kind, list] of Object.entries(KINDS)) for (const r of list) await post(`/api/${kind}`, r);
  // A fixed state for the screens: onboarding done, nudges closed and
  // nothing else left from a run.
  const prefs = (await json('/api/local-prefs')).value || {};
  const set = {
    gst_printSettings: JSON.stringify({ onboardingComplete: true, onboardingSkipped: false }),
    gst_regionMode: 'india',
    freegstbill_onboarded: 'true',
    freegstbill_welcomeCard: 'closed',
    freegstbill_startedDismissed: '1',
    freegstbill_starBanner: JSON.stringify({ done: true }),
    freegstbill_supportNudge: JSON.stringify({ done: true }),
    freegstbill_notifyAsked: '1',
    // No "What's new" slides: this version counts as seen.
    freegstbill_lastSeenVersion: (await json('/api/version')).current,
  };
  // Removing a key the same call sets would drop it again (the server removes after it sets).
  await post('/api/local-prefs', { set, remove: Object.keys(prefs).filter((k) => !(k in set)) });
  // The trashed invoice comes out of the Trash first, so a second run sees the same.
  await del(`/api/trash/${encodeURIComponent(trashed)}`);
  for (const b of bills) await post('/api/bills?overwrite=1', b);
  await del(`/api/bills/${encodeURIComponent(trashed)}`);
}
