/**
 * v1.10.86 checks for this week's fixes, run from tests/smoke.mjs (just before
 * the real business details are put back) or on their own:
 *
 *   APP_URL=http://localhost:47398 node tests/smoke-v86b.mjs
 *
 * #214 a client's opening balance is what they owe, less receipts on no invoice;
 * #202 a Dashboard payment gets an RCP-series receipt, and editing that receipt
 *      on the Receipts page leaves the bill with one payment;
 * #199 a purchase line keeps the product it was picked as, even renamed;
 * #209 an invoice naming an e-commerce operator is in GSTR-1 Table 14 and in
 *      the JSON (supeco.clttx).
 * Each failed on the build before the fix. Everything made here has an id
 * starting smoketest- or a name starting "Smoke ", and is removed at the end.
 */
import { pathToFileURL } from 'url';
import { readFileSync } from 'fs';

const ECO_GSTIN = '29ABCDE5678F1CJ'; // valid checksum, 'C' (TCS collector) in place 14

/** Remove what these checks made (also called from smoke.mjs cleanup()). */
export async function cleanupV86b(page) {
  await page.evaluate(async () => {
    const list = async (kind) => (await (await fetch(`/api/${kind}`)).json().catch(() => [])) || [];
    const del = (kind, id) => fetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    for (const c of await list('clients')) if (String(c.id).startsWith('smoketest-')) await del('clients', c.id);
    // A Dashboard payment's receipt has the payment's id: found by its client
    // (editing it on Receipts drops its billId).
    for (const r of await list('receipts')) {
      if (String(r.id).startsWith('smoketest-') || r.clientName === 'Smoke Receipt Client') await del('receipts', r.id);
    }
    for (const p of await list('purchases')) if (p.supplierName === 'Smoke PP Supplier') await del('purchases', p.id);
    // A line renamed into a new product (the #199 bug) makes one with a generated id.
    for (const p of await list('products')) {
      if (String(p.id).startsWith('smoketest-') || /^smoke pen blue$/i.test(String(p.name || '').replace(/\s+/g, ' ').trim())) await del('products', p.id);
    }
    for (const b of await list('bills')) if (['smoketest-rcp-bill', 'smoketest-eco'].includes(b.id)) await del('bills', b.id);
  });
}

export async function runV86bChecks({ page, check, sleep }) {
  const get = (url) => page.evaluate(async (url) => (await fetch(url)).json(), url);
  const post = (url, body) => page.evaluate(async ({ url, body }) => (await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).status, { url, body });
  const openView = async (label) => {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim() === label);
      if (b) b.click();
    }, label);
    await sleep(2000);
  };
  // Screens load their data when they mount, so leave and come back.
  const reopenView = async (label) => { await openView(label === 'Clients' ? 'Dashboard' : 'Clients'); await openView(label); };
  const money = (t) => Number(String(t).replace(/[^0-9.-]/g, ''));
  // A check that throws is a failed check, not a stopped suite.
  const guarded = async (name, fn) => {
    try { await fn(); } catch (err) { check(name, false, err.message.split('\n')[0]); }
  };

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fyStart = `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`;
  const prof = (await get('/api/profile')) || {};
  const owner = { ownerGstin: prof.gstin || '', ownerName: prof.businessName || '' };
  const state = prof.state || 'Karnataka';
  const seller = { gstin: prof.gstin || '', businessName: prof.businessName || '', state, country: 'India' };
  const bill = (id, inv, clientName, details = {}) => ({
    id, invoiceNumber: inv, invoiceType: 'tax-invoice', clientName, status: 'unpaid', totalAmount: 1180, invoiceDate: today, payments: [], items: [],
    data: { profile: seller, client: { name: clientName, state, country: 'India' }, details: { invoiceNumber: inv, invoiceDate: today, placeOfSupply: state, ...details },
      items: [{ name: 'Smoke Register', hsn: '4820', unit: 'Nos', quantity: 2, rate: 500, taxPercent: 18 }],
      totals: { subtotal: 1000, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, total: 1180, isInterstate: false } },
  });

  // ---- #214 opening balance ------------------------------------------------
  await guarded('v86 #214 a client\'s opening balance shows as outstanding on Clients, less a receipt on no invoice', async () => {
    const bad = await post('/api/clients', { id: 'smoketest-ob-bad', name: 'Smoke OB Bad', openingBalance: -5, openingBalanceDate: fyStart, openingBalanceType: 'receivable' });
    check('v86 #214 a negative opening balance is refused (HTTP 400)', bad === 400, `HTTP ${bad}`);
    await post('/api/clients', { id: 'smoketest-ob', name: 'Smoke OB Client', state, openingBalance: 5000, openingBalanceDate: fyStart, openingBalanceType: 'receivable' });
    const outstanding = async () => {
      await reopenView('Clients');
      const card = page.locator('.client-card-header').filter({ has: page.locator('.client-card-name', { hasText: /^Smoke OB Client/ }) }).first();
      const stat = card.locator('.client-stat').filter({ has: page.locator('.client-stat-label', { hasText: 'Outstanding' }) });
      return (await stat.count()) ? money(await stat.locator('.client-stat-value').innerText()) : NaN;
    };
    const before = await outstanding();
    await post('/api/receipts', { id: 'smoketest-rcp-ob', receiptNo: 'SMOKE-RCP-OB', clientName: 'Smoke OB Client', amount: 2000, date: today,
      paymentMode: 'Cash', againstInvoice: '', note: '', ...owner });
    const after = await outstanding();
    check('v86 #214 a client\'s opening balance shows as outstanding on Clients, less a receipt on no invoice',
      before === 5000 && after === 3000, `outstanding ${before} -> ${after} (want 5000 -> 3000)`);
  });

  // ---- #202 one receipt series ---------------------------------------------
  await guarded('v86 #202 a payment recorded on the Dashboard gets an RCP-series receipt number', async () => {
    await post('/api/bills', bill('smoketest-rcp-bill', 'SMK-RCP-202', 'Smoke Receipt Client'));
    await reopenView('Dashboard');
    await page.getByRole('button', { name: 'Payment for SMK-RCP-202' }).first().click();
    await sleep(800);
    const modal = page.locator('.modal-content').filter({ hasText: 'Record Payment' });
    await modal.locator('.form-group').filter({ hasText: 'Amount Received' }).locator('input').fill('1180');
    await modal.locator('.form-group').filter({ hasText: 'Payment Mode' }).locator('select').selectOption('cash');
    await modal.getByRole('button', { name: /^Record Payment$/ }).click();
    await sleep(2500);
    const pays = (await get('/api/bills')).find((b) => b.id === 'smoketest-rcp-bill')?.payments || [];
    const no = pays[0]?.receiptNo || '';
    const rcp = (await get('/api/receipts')).find((r) => no && r.receiptNo === no);
    check('v86 #202 a payment recorded on the Dashboard gets an RCP-series receipt number',
      pays.length === 1 && /RCP/.test(no) && !no.startsWith('RCPT-') && !!rcp, `payments=${pays.length} receiptNo=${no || '(none)'} receipt=${rcp?.id || 'not found'}`);
    if (!rcp) return;

    await reopenView('Receipts');
    await page.locator('tr', { hasText: no }).first().getByTitle('Edit').click();
    await sleep(800);
    const form = page.locator('.modal-content').filter({ hasText: 'Edit Payment Receipt' });
    await form.locator('.form-group').filter({ hasText: 'Payment Mode' }).locator('select').selectOption('UPI');
    await form.getByRole('button', { name: 'Save Receipt' }).click();
    await sleep(2500);
    const after = (await get('/api/bills')).find((b) => b.id === 'smoketest-rcp-bill')?.payments || [];
    check('v86 #202 editing that receipt on Receipts (Cash -> UPI) leaves the invoice with one payment',
      after.length === 1 && after[0].mode === 'upi' && after[0].receiptNo === no, JSON.stringify(after.map((p) => [p.receiptNo, p.mode, p.amount])));
  });

  // ---- #199 a purchase line keeps its product --------------------------------
  await guarded('v86 #199 a purchase line picked from the list is saved as that product and adds its stock', async () => {
    await post('/api/products', { id: 'smoketest-pp', name: 'Smoke Pen', hsn: '9608', purchasePrice: 10, sellingPrice: 15, rate: 15, taxPercent: 18, unit: 'Nos', stock: 0 });
    const stockOf = async () => (await get('/api/products')).find((p) => p.id === 'smoketest-pp')?.stock;
    const ppBill = async () => (await get('/api/purchases')).find((p) => p.invoiceNumber === 'SMK-PP-199');
    await reopenView('Purchases');
    await page.getByRole('button', { name: /Add Purchase Bill/ }).first().click();
    await sleep(1000);
    const form = page.locator('.modal-content').filter({ hasText: 'Add Purchase Bill' });
    await form.locator('.form-group').filter({ hasText: 'Supplier Name *' }).locator('input').fill('Smoke PP Supplier');
    await form.locator('.form-group').filter({ hasText: 'Invoice Number *' }).locator('input').fill('SMK-PP-199');
    const name = form.locator('input[data-list="fgsb-item-history"]').first();
    await name.click();
    await name.fill('Smoke Pe');
    await sleep(600);
    await page.locator('[role=option][data-value="Smoke Pen"]').first().click();
    await sleep(400);
    const row = name.locator('xpath=ancestor::div[contains(@class,"form-group")][1]/..');
    await row.locator('.form-group').filter({ hasText: 'Qty' }).locator('input').fill('5');
    await row.locator('.form-group').filter({ hasText: 'Rate' }).locator('input').fill('10');
    await form.getByRole('button', { name: /^Save$/ }).click();
    await sleep(2500);
    const saved = await ppBill();
    const stock1 = await stockOf();
    check('v86 #199 a purchase line picked from the list is saved as that product and adds its stock',
      saved?.items?.[0]?.productId === 'smoketest-pp' && Number(stock1) === 5, `productId=${saved?.items?.[0]?.productId} stock=${stock1}`);
    if (!saved) return;

    await reopenView('Purchases');
    await page.getByRole('button', { name: 'Edit SMK-PP-199' }).first().click();
    await sleep(1000);
    const edit = page.locator('.modal-content').filter({ hasText: 'Edit Purchase Bill' });
    await edit.locator('input[data-list="fgsb-item-history"]').first().fill('Smoke  Pen Blue');
    await sleep(400);
    await edit.getByRole('button', { name: /^Update$/ }).click();
    await sleep(2500);
    const renamed = await ppBill();
    const made = (await get('/api/products')).filter((p) => /^smoke pen blue$/i.test(String(p.name || '').replace(/\s+/g, ' ').trim()));
    const stock2 = await stockOf();
    check('v86 #199 renaming that line ("Smoke  Pen Blue") keeps its product: no new product, stock stays 5',
      /Blue/.test(renamed?.items?.[0]?.name || '') && renamed.items[0].productId === 'smoketest-pp' && made.length === 0 && Number(stock2) === 5,
      `line=${renamed?.items?.[0]?.name}/${renamed?.items?.[0]?.productId} new=${made.map((p) => p.name).join(',') || 'none'} stock=${stock2}`);
  });
  await cleanupV86b(page); // the Table 14 month should hold only its own invoice

  // ---- #209 GSTR-1 Table 14 -----------------------------------------------
  await guarded('v86 #209 GSTR-1 shows Table 14 for an invoice through an e-commerce operator', async () => {
    await post('/api/bills', bill('smoketest-eco', 'SMK-ECO-209', 'Smoke Eco Buyer', { ecoGstin: ECO_GSTIN }));
    await reopenView('GST Returns');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'GSTR-1')?.click());
    await sleep(800);
    const sel = page.locator('select.form-input');
    await sel.nth(0).selectOption('month');
    await sel.nth(1).selectOption(String(d.getMonth()));
    await sel.nth(2).selectOption(String(d.getFullYear()));
    await sleep(1000);
    const card = page.locator('.glass-panel').filter({ hasText: 'Table 14: supplies through e-commerce operators' });
    const row = (await card.count()) ? (await card.locator('tr', { hasText: ECO_GSTIN }).first().innerText().catch(() => '')).replace(/\s+/g, ' ') : '';
    check('v86 #209 GSTR-1 shows Table 14 for an invoice through an e-commerce operator (its GSTIN and taxable value)',
      row.includes(ECO_GSTIN) && row.includes('1,000.00'), row || 'no Table 14 card');
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
      page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'JSON Export')?.click()),
    ]);
    const json = dl ? JSON.parse(readFileSync(await dl.path(), 'utf8')) : null;
    const eco = (json?.supeco?.clttx || []).find((r) => r.etin === ECO_GSTIN);
    check('v86 #209 the GSTR-1 JSON carries it in supeco.clttx (etin, suppval)',
      !!eco && eco.suppval === 1000 && eco.cgst === 90 && eco.sgst === 90,
      dl ? JSON.stringify(json?.supeco || null) : `no download: ${await page.evaluate(() => document.body.innerText.match(/(GSTR-1 export blocked|No invoices)[^\n]*/)?.[0] || '')}`);
  });
  await cleanupV86b(page);
}

// ---- Run on its own --------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { firefox } = await import('playwright');
  const { setTimeout: sleep } = await import('timers/promises');
  const APP = process.env.APP_URL;
  if (!APP) { console.error('Set APP_URL to a running TEST copy, e.g. APP_URL=http://localhost:47398'); process.exit(2); }
  const results = [];
  const check = (name, pass, detail = '') => {
    results.push({ name, pass });
    console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  };
  console.log(`\nRunning v86b checks against ${APP} (Firefox)\n`);
  const profileAtStart = await fetch(`${APP}/api/profile`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const setProfile = (p) => fetch(`${APP}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
  // Fresh books have no business: Table 14 needs one with a GSTIN.
  if (!profileAtStart?.gstin) await setProfile({ ...(profileAtStart || {}), businessName: 'DiceCodes', gstin: '29ABCDE1234F1ZW', state: 'Karnataka', country: 'India' });
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  ctx.setDefaultNavigationTimeout(120000);
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage();
  try {
    await page.goto(APP, { waitUntil: 'networkidle' });
    await sleep(2000);
    // A fresh install's welcome window (as smoke.mjs dismissFirstRun).
    for (let i = 0; i < 6 && !(await page.locator('.nav-btn').count() && !(await page.locator('.modal-overlay:visible').count())); i += 1) {
      const btn = page.getByRole('button', { name: /^skip setup$|none of these|get started|continue|finish|close/i });
      if (!(await btn.count())) break;
      await btn.first().click({ timeout: 5000 }).catch(() => {});
      await sleep(1200);
    }
    await runV86bChecks({ page, APP, check, sleep });
  } catch (err) {
    check('v86b checks ran to completion', false, err.message.split('\n')[0]);
  } finally {
    await cleanupV86b(page).catch(() => {});
    if (!profileAtStart?.gstin) await setProfile(profileAtStart || {}).catch(() => {});
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}
