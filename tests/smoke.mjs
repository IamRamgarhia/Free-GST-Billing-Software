/**
 * Smoke tests — run with `npm test`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every bug in this file is one that shipped to a real user and was
 * reported from the field. None of them threw an error, produced a stack
 * trace or failed a build — they all looked fine to the developer and
 * wrong to the person using the app. That is precisely the class of defect
 * a human notices in five seconds and a linter never will.
 *
 * Two of them (ERR-004, ERR-007) reproduce ONLY in Firefox, so this runs
 * Firefox deliberately. Testing in Chrome alone is what let them ship.
 *
 * The rule when adding to this file: a test earns its place by having
 * FAILED against the build that shipped the bug. A test that never went
 * red is decoration.
 *
 * Usage:
 *   npm test              # starts a server on a free port, runs, cleans up
 *   APP_URL=... npm test  # run against an already-running instance
 */
import { firefox } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const results = [];
let serverProc = null;

const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/** Boot the app unless the caller pointed us at a running one. */
async function startServer() {
  if (process.env.APP_URL) return process.env.APP_URL;
  serverProc = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not report a port within 30s')), 30_000);
    serverProc.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolve(m[0]); }
    });
    serverProc.on('error', reject);
  });
  return url;
}

/** Remove only the records this suite created. */
async function cleanup(page) {
  try {
    await page.evaluate(async () => {
      const del = async (kind) => {
        const list = await (await fetch(`/api/${kind}`)).json();
        await Promise.all((list || [])
          .filter((r) => String(r.id || '').startsWith('smoketest-'))
          .map((r) => fetch(`/api/${kind}/${encodeURIComponent(r.id)}`, { method: 'DELETE' })));
      };
      await del('purchases');
      await del('products');
    });
  } catch { /* best effort */ }
}

const APP = await startServer();
console.log(`\nRunning smoke tests against ${APP} (Firefox)\n`);

const browser = await firefox.launch({ headless: true });
// 1366x768 is the resolution the preview-clipping bug needed (ERR-005).
// It is also the most common laptop size among this app's users.
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const page = await ctx.newPage();

const cspViolations = [];
page.on('console', (m) => { if (/Content-Security-Policy/i.test(m.text())) cspViolations.push(m.text()); });

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await sleep(2000);
  const skip = page.getByRole('button', { name: /^Skip setup$/ });
  if (await skip.count()) { await skip.click(); await sleep(1200); }

  // ---- App loads without breaking its own security policy ----------------
  // ERR-004 / ERR-007: the CSP blocked the print iframe and, separately,
  // the app's own stylesheet inside html2canvas's clone — so PDFs rendered
  // with no CSS. Both were Firefox-only and silent.
  check('app loads with no CSP violations', cspViolations.length === 0,
    cspViolations[0]?.slice(0, 90) || '');

  const styled = await page.evaluate(() => document.styleSheets.length > 0
    && getComputedStyle(document.body).fontFamily.includes('Inter'));
  check('stylesheet actually applied', styled);

  // ---- Seed fixtures -----------------------------------------------------
  await page.evaluate(async () => {
    const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    await post('/api/products', { id: 'smoketest-m', name: 'Mouse', hsn: 'sdf', purchasePrice: 250, taxPercent: 18, stock: 0 });
    await post('/api/products', { id: 'smoketest-p', name: 'Pen drive', hsn: 's', purchasePrice: 399, taxPercent: 12, stock: 0 });
    await post('/api/purchases', {
      id: 'smoketest-b1', date: '2026-08-01', supplierName: 'Alpha Traders',
      supplierGstin: '07AAAAA0000A1Z1', supplierAddress: 'Delhi', interstate: false,
      invoiceNumber: 'SMOKE/A', paymentStatus: 'Unpaid',
      items: [{ name: 'Mouse', hsn: 'sdf', quantity: 1, rate: 250, taxPercent: 18, cessPercent: 0 }],
    });
    await post('/api/purchases', {
      id: 'smoketest-b2', date: '2026-08-02', supplierName: 'Beta Supplies',
      supplierGstin: '29BBBBB1111B2Z2', supplierAddress: 'Bengaluru', interstate: true,
      invoiceNumber: 'SMOKE/B', paymentStatus: 'Unpaid',
      items: [{ name: 'Pen drive', hsn: 's', quantity: 1, rate: 399, taxPercent: 12, cessPercent: 0 }],
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1600);

  // ---- Purchase bill: suggestions ---------------------------------------
  await page.getByText('Purchases', { exact: false }).first().click();
  await sleep(1400);
  await page.getByRole('button', { name: /add purchase/i }).first().click();
  await sleep(1200);

  const opts = await page.evaluate(() =>
    [...document.querySelectorAll('#fgsb-item-history option')].map((o) => ({
      value: o.value,
      // ERR-008: Firefox renders label/text INSTEAD of value. Assert on what
      // the user would actually SEE, not on the data behind the option — the
      // original test checked .value and passed against the broken build.
      displayed: o.getAttribute('label') || (o.textContent || '').trim() || o.value,
    })));

  check('#42 product catalogue appears in item suggestions',
    opts.some((o) => o.value === 'Mouse') && opts.some((o) => o.value === 'Pen drive'),
    opts.map((o) => o.value).join(', '));

  check('#40 suggestions display names, not GSTIN/HSN',
    opts.every((o) => o.displayed === o.value),
    opts.find((o) => o.displayed !== o.value)?.displayed || '');

  // ---- Purchase bill: re-selection refreshes details ---------------------
  const item = page.locator('input[list="fgsb-item-history"]').first();
  const rowVals = () => page.evaluate(() => {
    const el = document.querySelector('input[list="fgsb-item-history"]');
    const wrap = el.closest('div[style*="flex"]')?.parentElement;
    return [...(wrap?.querySelectorAll('input.form-input') || [])].map((i) => i.value);
  });

  await item.fill('Pen drive'); await sleep(600);
  await item.fill('Mouse'); await sleep(600);
  const swapped = await rowVals();
  check('#43 changing the item refreshes HSN and rate',
    swapped[1] === 'sdf' && swapped[3] === '250',
    `hsn=${swapped[1]} rate=${swapped[3]}`);

  // The counterpart property: a hand-typed value must NOT be overwritten.
  // These two pull in opposite directions, which is what made #43 subtle.
  await page.locator('input[placeholder="HSN"]').first().fill('MYOWN');
  await sleep(400);
  await item.fill('Pen drive'); await sleep(600);
  const edited = await rowVals();
  check('#43 a hand-typed value survives re-selection',
    edited[1] === 'MYOWN', `hsn=${edited[1]}`);

  // ---- Purchase bill: supplier re-selection ------------------------------
  const sup = page.locator('input[list="fgsb-supplier-history"]');
  const gstinBox = page.locator('input[placeholder="15-digit GSTIN"]');
  await sup.fill('Alpha Traders'); await sleep(600);
  await sup.fill('Beta Supplies'); await sleep(600);
  check('#43 changing supplier refreshes the GSTIN',
    (await gstinBox.inputValue()) === '29BBBBB1111B2Z2',
    await gstinBox.inputValue());

  await page.keyboard.press('Escape');
  await sleep(600);

  // ---- Invoice preview + PDF --------------------------------------------
  await page.getByText('New Invoice', { exact: false }).first().click();
  await page.waitForSelector('.invoice-preview-container', { timeout: 20000 });
  await sleep(1500);

  // ERR-005: transform: scale() does not shrink the layout box, and a
  // centred overflow puts the left edge in unreachable negative scroll.
  const clipped = await page.evaluate(() => {
    const pane = document.querySelector('.preview-pane');
    const inv = document.querySelector('.invoice-preview-container');
    pane.scrollLeft = 0;
    return Math.round(Math.max(0, pane.getBoundingClientRect().left - inv.getBoundingClientRect().left));
  });
  check('ERR-005 no unreachable clipping at 1366px', clipped === 0, `${clipped}px hidden`);

  await page.getByRole('button', { name: /^Fit$/ }).click();
  await sleep(1000);
  const fits = await page.evaluate(() => {
    const pane = document.querySelector('.preview-pane');
    return pane.scrollWidth <= pane.clientWidth + 1;
  });
  check('Fit actually fits the preview', fits);

  // ERR-004/007 again, end to end: a real PDF must download, and its size
  // is a proxy for whether the stylesheet made it into the render.
  let pdfBytes = 0;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /save & download/i }).first().click(),
    ]);
    const { statSync } = await import('fs');
    pdfBytes = statSync(await dl.path()).size;
  } catch { /* leaves pdfBytes 0 → fails below */ }
  check('PDF downloads and is styled', pdfBytes > 300_000, `${pdfBytes} bytes`);

  check('no CSP violations during PDF generation', cspViolations.length === 0,
    cspViolations[0]?.slice(0, 90) || '');

  // ---- Settings: unsaved changes are visible -----------------------------
  await page.getByText('Settings', { exact: false }).first().click();
  await sleep(2000);
  const barShown = () => page.evaluate(() =>
    !![...document.querySelectorAll('div')]
      .find((d) => /unsaved changes/i.test(d.textContent || '') && d.offsetParent !== null));

  check('#43 no unsaved-changes bar on a clean form', !(await barShown()));
  await page.locator('#section-company input').first().fill('Smoke Test Co');
  await sleep(700);
  check('#43 editing the profile surfaces an unsaved-changes bar', await barShown());

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(600);
  check('#43 that bar stays reachable after scrolling', await barShown());

  // #44: the bar must clear once the profile is actually on disk, and must
  // NOT come back when the page is revisited. v1.10.55 recorded the saved
  // baseline in only one of three persistence paths, so the bar could insist
  // on unsaved changes for data that was already stored — and the
  // beforeunload guard then popped a browser dialog on every close.
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  await page.getByRole('button', { name: /Save Profile/i }).first().click();
  await sleep(2500);
  check('#44 bar clears after saving', !(await barShown()));

  await page.getByText('Dashboard', { exact: false }).first().click();
  await sleep(1200);
  await page.getByText('Settings', { exact: false }).first().click();
  await sleep(2500);
  check('#44 bar stays hidden on returning to Settings', !(await barShown()));

  await cleanup(page);
} catch (err) {
  check('suite ran to completion', false, err.message.split('\n')[0]);
  try { await cleanup(page); } catch { /* ignore */ }
} finally {
  await browser.close();
  if (serverProc) serverProc.kill();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
if (failed.length) {
  console.log('FAILED:');
  failed.forEach((f) => console.log(`  ✗ ${f.name}${f.detail ? `  — ${f.detail}` : ''}`));
  console.log('');
  process.exit(1);
}
