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
import { readFileSync } from 'fs';
import { request as httpRequest } from 'http';
import { PDFDocument } from 'pdf-lib';
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
      await del('profiles');
      await del('expenses');
      await del('receipts');
      await del('recurring');
      await del('templates');
      // v1.10.84 - "marked read" is kept in the books folder now
      // (fgsb_dismissedNotifs); one that names this suite's invoices would
      // silence #53 in the next run.
      const prefs = (await (await fetch('/api/local-prefs')).json())?.value || {};
      if (/SMOKE-|smoketest-/.test(prefs.fgsb_dismissedNotifs || '')) {
        await fetch('/api/local-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set: {}, remove: ['fgsb_dismissedNotifs'] }) });
      }
      // v1.10.77 - a PIN this suite set must never stay on the user's app.
      await fetch('/api/lock/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: null, currentPin: '13572468' }) });
      // The expense added through the form gets a generated id.
      const expenses = await (await fetch('/api/expenses')).json();
      await Promise.all((expenses || [])
        .filter((e) => String(e.description || '').startsWith('SMOKE-EXP-'))
        .map((e) => fetch(`/api/expenses/${encodeURIComponent(e.id)}`, { method: 'DELETE' })));
      // The PDF step saves a real invoice; remove it by client name so the
      // suite is repeatable and leaves no test data in the user's books.
      const bills = await (await fetch('/api/bills')).json();
      await Promise.all((bills || [])
        .filter((b) => (b.clientName || '') === 'Smoke Test Client'
                     || String(b.id || '').startsWith('smoketest-'))
        .map((b) => fetch(`/api/bills/${encodeURIComponent(b.id)}`, { method: 'DELETE' })));
    });
  } catch { /* best effort */ }
}


/**
 * Clear anything a FRESH install shows before the app is usable.
 *
 * The wizard's button is "Skip Setup" with a capital S; the suite used to
 * match /^Skip setup$/ and silently never matched. In the development tree
 * onboarding is already complete so no wizard appears, and the mismatch was
 * invisible — against a real packaged install it blocked every later click.
 *
 * Called after EVERY navigation that reloads the page, because anything
 * gating first use can reappear, and a test that hangs for 30s tells you
 * far less than one that simply clears the way and carries on.
 */
async function dismissFirstRun(page) {
  // A fresh install shows TWO screens in sequence, and their buttons are
  // capitalised differently: a region step ("Skip Setup") and then a
  // business-type step ("Skip setup"). Clearing one reveals the other.
  //
  // The visibility test matters as much as the clicking. An earlier version
  // used `offsetParent !== null`, which is ALWAYS null for a
  // `position: fixed` element — and `.modal-overlay` is fixed. So it
  // reported "nothing in the way" while a full-screen wizard sat on top,
  // and every later click timed out against an intercepted element.
  const blockingOverlay = () => page.evaluate(() =>
    [...document.querySelectorAll('.modal-overlay')].some((o) => {
      const cs = getComputedStyle(o);
      const r = o.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    }));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const hasNav = await page.evaluate(() => !!document.querySelector('.nav-btn'));
    if (hasNav && !(await blockingOverlay())) return;
    let clicked = false;
    for (const pattern of [/^skip setup$/i, /none of these/i, /get started/i, /continue|finish|close/i]) {
      const btn = page.getByRole('button', { name: pattern });
      if (await btn.count()) {
        await btn.first().click({ timeout: 5000 }).catch(() => {});
        await sleep(1200);
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
  }
}

const APP = await startServer();
console.log(`\nRunning smoke tests against ${APP} (Firefox)\n`);

// The suite changes the ACTIVE business profile several times, and the server
// replaces that file wholesale on every save. Snapshot it before anything runs
// and put it back in `finally`, so a step that times out half way can never
// leave a real profile reduced to a bare "Smoke Alpha".
const profileAtStart = await fetch(`${APP}/api/profile`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);

const browser = await firefox.launch({ headless: true });
// 1366x768 is the resolution the preview-clipping bug needed (ERR-005).
// It is also the most common laptop size among this app's users.
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
// Playwright gives a page 30 s to load. On a busy machine - another dev
// server pinning three cores was enough - a reload under the release gate ran
// past that and aborted the whole suite, twice in a row, with code that had
// just passed 76/76. A timeout bounds how long we wait, not whether the page
// is right, so it gets room; every assertion stays exactly as strict.
ctx.setDefaultNavigationTimeout(120000);
ctx.setDefaultTimeout(60000);
const page = await ctx.newPage();

const cspViolations = [];
page.on('console', (m) => { if (/Content-Security-Policy/i.test(m.text())) cspViolations.push(m.text()); });
// v1.10.84 - the Invoices screen's folder tabs (Invoices | Cancelled | Trash).
const openFolder = async (name) => { const b = page.locator('.invoice-folders button', { hasText: name }); if (await b.count()) { await b.first().click(); await sleep(500); } };

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await sleep(2000);
  await dismissFirstRun(page);
  check('first-run setup can be dismissed',
    await page.evaluate(() => !!document.querySelector('.nav-btn')));

  // ---- App loads without breaking its own security policy ----------------
  // ERR-004 / ERR-007: the CSP blocked the print iframe and, separately,
  // the app's own stylesheet inside html2canvas's clone — so PDFs rendered
  // with no CSS. Both were Firefox-only and silent.
  check('app loads with no CSP violations', cspViolations.length === 0,
    cspViolations[0]?.slice(0, 400) || '');

  // Security review (v1.10.84): DNS rebinding - a page that re-points its own
  // domain to 127.0.0.1 sends Host: its-domain; the app must refuse it.
  const foreignHost = await new Promise((resolve) => {
    const u = new URL(APP);
    const rq = httpRequest({ host: u.hostname, port: u.port, path: '/api/bills', headers: { Host: 'evil.example' } },
      (r) => { r.resume(); resolve(r.statusCode); });
    rq.on('error', () => resolve(0));
    rq.end();
  });
  check('DNS rebinding: a request with a foreign Host is refused', foreignHost === 403, String(foreignHost));

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
  await dismissFirstRun(page);

  // ---- Purchase bill: suggestions ---------------------------------------
  await page.getByText('Purchases', { exact: false }).first().click();
  await sleep(1400);
  await page.getByRole('button', { name: /add purchase/i }).first().click();
  await sleep(1200);
  // The suggestions come from products and past purchases loaded in the
  // background: on a slow machine (Docker) a fixed wait read them too early.
  for (let i = 0; i < 16 && !(await page.locator('#fgsb-item-history option').count()); i++) await sleep(500);

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

  // Fill a REAL invoice. Since #47, saving or printing a blank one is
  // refused on purpose, so the PDF check below needs a client and a priced
  // line item — the same minimum a user has to provide.
  await page.locator('input[placeholder="Type client name to search or add new"]')
    .fill('Smoke Test Client');
  await sleep(500);
  await page.keyboard.press('Escape');           // dismiss the client suggestion list
  // The line-item name box (a growing textarea since v1.10.83), found through
  // its row, then the row's numeric fields.
  const row = page.locator('.line-item-row').first();
  await row.locator('textarea.line-item-name').first().fill('Test item');
  await sleep(400);
  await page.keyboard.press('Escape');           // dismiss product suggestions
  const rowNums = row.locator('input[type="number"]');
  await rowNums.nth(0).fill('2');                // qty
  await rowNums.nth(1).fill('500');              // rate
  await sleep(800);

  // #167: Enter moves along the row like a billing program: Item -> HSN -> Qty.
  await row.locator('textarea.line-item-name').first().press('Enter');
  await sleep(200);
  const afterItem = await page.evaluate(() => document.activeElement?.className || '');
  await page.keyboard.press('Enter');
  await sleep(200);
  const inQty = await page.evaluate(() => document.activeElement === document.querySelector('.line-item-row input[type="number"]'));
  check('#167 Enter moves Item -> HSN -> Qty', /line-item-hsn/.test(afterItem) && inQty, `after Item: "${afterItem}", in Qty: ${inQty}`);

  // #167 (reported again 6 Nov from 1.10.83): ...and on in the SAME row,
  // Qty -> Unit -> Rate; Enter in Rate finishes the row. ERR-078 (#151): on
  // the last row that adds a row with the cursor in its Item box (it went to
  // the next row's HSN once the box became a textarea). The new row is
  // removed again so the rest of the run sees one line.
  const walk = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Enter');
    await sleep(300);
    const at = await page.evaluate(() => {
      const a = document.activeElement;
      const r = [...document.querySelectorAll('.line-item-row')].findIndex((x) => x.contains(a)) + 1;
      const kind = a?.classList.contains('line-item-name') ? 'Item' : a?.classList.contains('line-item-rate') ? 'Rate'
        : a?.classList.contains('line-item-hsn') ? 'HSN' : a?.tagName === 'SELECT' ? 'Unit' : a?.type === 'number' ? 'Qty' : a?.tagName || '?';
      return `${r}:${kind}`;
    });
    walk.push(at);
    if (at.startsWith('2:')) break;
  }
  check('#167 Enter goes on Qty -> Unit -> Rate in the same row, then the next row\'s Item', walk.join(' ') === '1:Unit 1:Rate 2:Item', walk.join(' '));
  const enterFocus = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.line-item-row .line-item-name')];
    return { rows: names.length, inNewItem: document.activeElement === names[names.length - 1] };
  });
  check('ERR-078 Enter adds a row, cursor in its Item box', enterFocus.rows === 2 && enterFocus.inNewItem, JSON.stringify(enterFocus));
  if (enterFocus.rows === 2) await page.locator('.line-item-row').nth(1).locator('button[title="Remove"]').click();
  await sleep(300);

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

  // #58 item 2: the action toolbar must stay reachable from the bottom of a
  // long invoice. Reported as "you have to scroll all page" to reach the
  // preview toggle — but Save, Print and E-Way Bill were equally stranded.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(700);
  const toolbar = await page.evaluate(() => {
    const tb = document.querySelector('.generator-toolbar');
    if (!tb) return null;
    const r = tb.getBoundingClientRect();
    const previewBtn = [...tb.querySelectorAll('button')].find((b) => /Preview/i.test(b.innerText));
    return {
      onScreen: r.top >= -2 && r.top < window.innerHeight,
      hasPreviewButton: !!previewBtn,
    };
  });
  check('#58 the action toolbar stays on screen when scrolled to the bottom',
    !!toolbar?.onScreen);
  check('#58 the preview toggle lives in that toolbar',
    !!toolbar?.hasPreviewButton);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);

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

  // #161: with the preview hidden, Save & Download leaves it hidden (it used
  // to open and close again), and the PDF is still a full, styled page.
  await page.getByRole('button', { name: /Hide Preview/i }).first().click();
  await sleep(500);
  await page.evaluate(() => {
    window.__paneShown = false;
    const sv = document.querySelector('.split-view');
    new MutationObserver(() => { if (!sv.classList.contains('split-view-focus')) window.__paneShown = true; })
      .observe(sv, { attributes: true, attributeFilter: ['class'] });
  });
  let hiddenPdfBytes = 0;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /save & download/i }).first().click(),
    ]);
    const { statSync } = await import('fs');
    hiddenPdfBytes = statSync(await dl.path()).size;
  } catch { /* leaves 0 → fails below */ }
  const paneShown = await page.evaluate(() => window.__paneShown);
  check('#161 hidden preview stays hidden on Save & Download, PDF still styled',
    !paneShown && hiddenPdfBytes > 300_000, `${hiddenPdfBytes} bytes, preview shown: ${paneShown}`);
  await page.getByRole('button', { name: /Show Preview/i }).first().click();
  await sleep(400);

  check('no CSP violations during PDF generation', cspViolations.length === 0,
    cspViolations[0]?.slice(0, 400) || '');

  // Generating the PDF saves the invoice, so the editor now holds a real,
  // dirty bill and navigating away raises the leave-guard. Dismiss it, then
  // delete the bill so the suite leaves nothing behind.
  // ---- Settings: unsaved changes are visible -----------------------------
  await page.getByText('Settings', { exact: false }).first().click();
  await sleep(900);
  const discard = page.getByRole('button', { name: /Discard.*leave/i });
  if (await discard.count()) {
    await discard.click();
    await sleep(1200);
    await page.getByText('Settings', { exact: false }).first().click();
  }
  await sleep(2000);
  const barShown = () => page.evaluate(() =>
    !![...document.querySelectorAll('div')]
      .find((d) => /unsaved changes/i.test(d.textContent || '') && d.offsetParent !== null));

  check('#43 no unsaved-changes bar on a clean form', !(await barShown()));

  // Use a value that cannot already be on disk. A fixed string silently
  // breaks this test the second time it runs: the field already holds it,
  // so "editing" changes nothing and no bar should appear — the test would
  // fail while the app behaved correctly. Original is restored below so the
  // suite leaves the user's business name untouched.
  // v1.10.83 - Settings opens on the Business type tab; the name is on Company.
  await page.locator('.settings-jumpnav a[href="#tab-company"]').click();
  const nameField = page.locator('#section-company input[name="businessName"]');
  // The form unlocks once the saved profile has loaded (v1.10.75).
  await page.waitForFunction(() => document.querySelector('#section-company fieldset')?.disabled === false, null, { timeout: 30000 });
  const originalName = await nameField.inputValue();
  await nameField.fill(`Smoke Test ${Date.now()}`);
  // Poll rather than a fixed pause: on a loaded machine the re-render can take
  // longer than 700 ms, and that failed the gate with the app working fine.
  const barWithin = async (ms) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) { if (await barShown()) return true; } return barShown(); };
  const dirtyShown = await barWithin(5000);
  const dirtyWhy = dirtyShown ? '' : JSON.stringify(await page.evaluate(() => ({
    title: document.querySelector('.page-title')?.innerText,
    bar: document.querySelector('.settings-savebar')?.innerText.replace(/\s+/g, ' '),
    name: document.querySelector('#section-company input[name="businessName"]')?.value,
    modal: document.querySelector('.modal-overlay')?.innerText.slice(0, 80),
  })));
  if (!dirtyShown && process.env.SMOKE_FAIL_SHOT) await page.screenshot({ path: process.env.SMOKE_FAIL_SHOT.replace(/\.png$/, '-43.png') }).catch(() => {});
  check('#43 editing the profile surfaces an unsaved-changes bar', dirtyShown, dirtyWhy);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(600);
  check('#43 that bar stays reachable after scrolling', await barWithin(3000));

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

  // Put the real business name back and persist it.
  await page.locator('#section-company input[name="businessName"]').fill(originalName);
  await sleep(500);
  const restore = page.getByRole('button', { name: /Save Profile/i }).first();
  if (await restore.count()) { await restore.click(); await sleep(2000); }

  // #47: a blank invoice must not save. Saving reserves an invoice number,
  // so an empty save leaves a permanent gap in a sequence GST expects to be
  // gapless — the record being useless is the lesser problem.
  const billCount = () => page.evaluate(async () => (await (await fetch('/api/bills')).json()).length);
  const before = await billCount();
  await page.getByText('New Invoice', { exact: false }).first().click();
  await page.waitForSelector('.invoice-preview-container', { timeout: 20000 });
  await sleep(1500);
  await page.getByRole('button', { name: /^Save$/ }).first().click();
  await sleep(2500);
  check('#47 blank invoice is refused', (await billCount()) === before,
    `bills ${before} -> ${await billCount()}`);

  // #53: notifications must clear when read, and come back when the facts
  // change. The second half is the part that matters — a "mark read" that
  // silences a genuinely new overdue invoice would be worse than not
  // clearing at all.
  const seedOverdue = (n) => page.evaluate(async (n) => {
    await fetch('/api/bills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `smoketest-ovd-${n}`, invoiceNumber: `SMOKE-OVD/${n}`, clientName: 'Smoke Test Client',
        status: 'unpaid', totalAmount: 5000, payments: [], items: [],
        data: { details: { dueDate: '2026-01-10', invoiceNumber: `SMOKE-OVD/${n}` },
                client: { name: 'Smoke Test Client' }, totals: { total: 5000 } },
      }),
    });
  }, n);
  const badgeCount = () => page.evaluate(() => {
    const bell = [...document.querySelectorAll('button')].find((b) => /notification/i.test(b.title || ''));
    return bell ? Number((bell.innerText.match(/\d+/) || [0])[0]) : -1;
  });
  const openBell = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /notification/i.test(x.title || ''));
      if (b) b.click();
    });
    await sleep(900);
  };

  await seedOverdue(1);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(4500);
  await dismissFirstRun(page);
  const withAlert = await badgeCount();
  check('#53 an overdue invoice raises a notification', withAlert > 0, `badge=${withAlert}`);

  await openBell();
  const markRead = page.getByRole('button', { name: /Mark all as read/i });
  if (await markRead.count()) { await markRead.click(); await sleep(800); }
  const cleared = await badgeCount();
  check('#53 marking read clears the badge', cleared === 0, `badge=${cleared}`);
  await page.keyboard.press('Escape');
  await sleep(400);

  await seedOverdue(2);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(4500);
  await dismissFirstRun(page);
  const returned = await badgeCount();
  check('#53 a NEW overdue invoice re-alerts after being marked read',
    returned > 0, `badge=${returned}`);

  // #55: two businesses must not share one set of books — and, far more
  // importantly, nothing may DISAPPEAR. Older invoices carry no business id,
  // so a naive filter would hide a user's entire history. They are matched by
  // the seller GSTIN stored on every invoice, and anything unattributable is
  // always shown.
  // Give the active business a known GSTIN for the duration. Depending on
  // whatever GSTIN happens to be configured makes this test meaningless on a
  // fresh install, where the profile has none at all — with nothing to
  // compare, every invoice matches and both assertions pass vacuously.
  // The original profile is restored below.
  const originalProfile = await page.evaluate(async () => (await (await fetch('/api/profile')).json()));
  const TEST_GSTIN = '03AAAAA1111A1Z1';
  await page.evaluate(async ({ prof, gstin }) => {
    await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prof, gstin, businessName: prof?.businessName || 'Active Co' }),
    });
  }, { prof: originalProfile, gstin: TEST_GSTIN });
  const activeProfile = { gstin: TEST_GSTIN };
  await page.evaluate(async (gstin) => {
    const post = (b) => fetch('/api/bills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
    });
    // Belongs to the active business.
    await post({ id: 'smoketest-mine', invoiceNumber: 'SMOKE-MINE/1', clientName: 'Smoke Test Client',
      status: 'unpaid', totalAmount: 1000, payments: [], items: [], invoiceDate: new Date().toISOString().slice(0,10),
      data: { profile: { gstin, businessName: 'Active Co' }, details: {}, totals: { total: 1000 } } });
    // Belongs to a DIFFERENT business.
    await post({ id: 'smoketest-other', invoiceNumber: 'SMOKE-OTHER/1', clientName: 'Smoke Test Client',
      status: 'unpaid', totalAmount: 2000, payments: [], items: [], invoiceDate: new Date().toISOString().slice(0,10),
      data: { profile: { gstin: '29ZZZZZ9999Z9Z9', businessName: 'Other Co' }, details: {}, totals: { total: 2000 } } });
    // Legacy: no seller recorded at all.
    // Dated in the current FY so the dashboard's year filter cannot be what
    // hides it — this test is about company scoping, nothing else.
    const today = new Date().toISOString().slice(0, 10);
    await post({ id: 'smoketest-legacy', invoiceNumber: 'SMOKE-LEGACY/1', clientName: 'Smoke Test Client',
      status: 'unpaid', totalAmount: 3000, payments: [], items: [], invoiceDate: today,
      data: { details: { invoiceNumber: 'SMOKE-LEGACY/1' }, totals: { total: 3000 } } });
  }, activeProfile?.gstin || '');

  await page.reload({ waitUntil: 'networkidle' });
  await sleep(3000);
  await dismissFirstRun(page);
  // Go to the Dashboard explicitly. The app restores the last view from
  // sessionStorage, which by now is Settings — and a "not visible" assertion
  // passes trivially when NOTHING is on screen. Assert against the invoice
  // list itself, not the whole page.
  await page.getByText('Dashboard', { exact: false }).first().click();
  await sleep(2500);
  const visible = await page.evaluate(() => {
    const table = document.querySelector('table');
    return table ? table.innerText : document.body.innerText;
  });
  // Guard the guard: if our own invoice is not listed, the check below proves
  // nothing about scoping.
  check('#55 the active business invoice IS listed (sanity)',
    visible.includes('SMOKE-MINE/1'));

  check('#55 an invoice from the other business is hidden',
    !visible.includes('SMOKE-OTHER/1'));
  check('#55 a legacy invoice with no business recorded is still shown',
    visible.includes('SMOKE-LEGACY/1'));

  // #58 item 1: switching business must refresh the dashboard on the spot.
  // It used to read the business once on mount, so a switch left the previous
  // company's invoices on screen until a manual reload.
  const OTHER_GSTIN = '29BBBBB2222B2Z2';
  await page.evaluate(async ({ a, b }) => {
    const post = (u, body) => fetch(u, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    await post('/api/profiles', { id: 'smoketest-pa', businessName: 'Smoke Alpha', gstin: a });
    await post('/api/profiles', { id: 'smoketest-pb', businessName: 'Smoke Beta', gstin: b });
    await post('/api/bills', {
      id: 'smoketest-beta-bill', invoiceNumber: 'SMOKE-BETA/1', clientName: 'Smoke Test Client',
      status: 'unpaid', totalAmount: 4000, invoiceDate: new Date().toISOString().slice(0, 10),
      payments: [], items: [],
      data: { profile: { gstin: b, businessName: 'Smoke Beta' }, details: {}, totals: { total: 4000 } },
    });
    await post('/api/profile', { businessName: 'Smoke Alpha', gstin: a });
  }, { a: TEST_GSTIN, b: OTHER_GSTIN });

  await page.reload({ waitUntil: 'networkidle' });
  await sleep(3000);
  await dismissFirstRun(page);
  await page.getByText('Dashboard', { exact: false }).first().click();
  await sleep(2000);
  const tableText = () => page.evaluate(() => {
    const t = document.querySelector('table');
    return t ? t.innerText : '';
  });
  check('#58 before switching, only the active business is listed',
    (await tableText()).includes('SMOKE-MINE/1') && !(await tableText()).includes('SMOKE-BETA/1'));

  // Switch business from the header, WITHOUT reloading the page.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Smoke Alpha/.test(x.innerText));
    if (b) b.click();
  });
  await sleep(800);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Smoke Beta/.test(x.innerText));
    if (b) b.click();
  });
  await sleep(2500);
  const afterSwitch = await tableText();
  check('#58 the dashboard re-filters on a company switch, with no reload',
    afterSwitch.includes('SMOKE-BETA/1') && !afterSwitch.includes('SMOKE-MINE/1'));

  // ======================================================================
  // v1.10.66 — #64 (@sangwanmail-eng), #61, #62, #59
  // ======================================================================
  // Every "ignores another company" check below is paired with a sanity check
  // that the same number DOES move for this company. Without the pair, a card
  // that never updates at all would pass the first check.
  const today = new Date().toISOString().slice(0, 10);
  const THIRD_GSTIN = '27CCCCC3333C3Z3';
  const api = (url, body) => page.evaluate(async ({ url, body }) => (await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).ok, { url, body });
  const openView = async (label) => {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim() === label);
      if (b) b.click();
    }, label);
    await sleep(2000);
  };
  // Screens load their data when they mount, so leave and come back.
  const reopenView = async (label) => { await openView('Clients'); await openView(label); };
  const money = (text) => Number(String(text).replace(/[^0-9.-]/g, ''));
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
  // textContent, not innerText: .stat-label is uppercased by CSS, and innerText
  // returns the transformed "TOTAL INVOICED", so an exact match never hits.
  const cardValues = (label) => page.evaluate((label) => {
    const l = [...document.querySelectorAll('.stat-label')].find((x) => x.textContent.trim() === label);
    return l ? [...l.parentElement.querySelectorAll('.stat-value')].map((v) => v.textContent.trim()) : null;
  }, label);
  const rupees = (vals) => {
    if (!vals) return NaN;
    const inr = vals.find((v) => v.includes('₹'));
    return inr ? money(inr) : (vals[0] === '—' ? 0 : NaN);
  };
  const screenText = () => page.evaluate(() => document.querySelector('.main-content')?.innerText || '');
  const switchBusiness = async (from, to) => {
    await page.evaluate((from) => {
      const b = [...document.querySelectorAll('.profile-switcher-btn')].find((x) => x.innerText.includes(from));
      if (b) b.click();
    }, from);
    await sleep(700);
    await page.evaluate((to) => {
      const b = [...document.querySelectorAll('.profile-switcher-item')].find((x) => x.innerText.trim() === to);
      if (b) b.click();
    }, to);
    await sleep(2500);
  };

  // ---- #64 item 3: dashboard cards counted every company ------------------
  const dashboard = async () => {
    await reopenView('Dashboard');
    return { total: rupees(await cardValues('Total Invoiced')), count: money((await cardValues('Invoices'))?.[0]) };
  };
  const dash0 = await dashboard();
  await api('/api/bills', { id: 'smoketest-third', invoiceNumber: 'SMOKE-THIRD/1', clientName: 'Smoke Test Client',
    status: 'unpaid', totalAmount: 777777, invoiceDate: today, payments: [], items: [],
    data: { profile: { gstin: THIRD_GSTIN, businessName: 'Smoke Third' }, details: {}, totals: { total: 777777 } } });
  const dash1 = await dashboard();
  await api('/api/bills', { id: 'smoketest-beta-bill2', invoiceNumber: 'SMOKE-BETA/2', clientName: 'Smoke Test Client',
    status: 'unpaid', totalAmount: 1111, invoiceDate: today, payments: [], items: [],
    data: { profile: { gstin: OTHER_GSTIN, businessName: 'Smoke Beta' }, details: {}, totals: { total: 1111 } } });
  const dash2 = await dashboard();
  check('#64 dashboard totals ignore another company\'s invoice',
    close(dash1.total, dash0.total) && dash1.count === dash0.count,
    `total ${dash0.total} -> ${dash1.total}, count ${dash0.count} -> ${dash1.count}`);
  check('#64 dashboard totals include this company\'s new invoice (sanity)',
    close(dash2.total, dash0.total + 1111) && dash2.count === dash0.count + 1,
    `total ${dash0.total} -> ${dash2.total}, count ${dash0.count} -> ${dash2.count}`);

  // ---- #64 item 2: Reports counted every company's expenses ----------------
  const expenseCard = async () => { await reopenView('Reports'); return rupees(await cardValues('Expenses (ex. GST)')); };
  const expense = (id, description, amount, gstin, name) => ({ id, date: today, description, category: 'Other',
    amount, gstAmount: 0, gstPercent: 0, paymentMode: 'Cash', ownerGstin: gstin, ownerName: name });
  const rep0 = await expenseCard();
  await api('/api/expenses', expense('smoketest-exp-a', 'SMOKE-EXP-ALPHA', 55555, TEST_GSTIN, 'Smoke Alpha'));
  const rep1 = await expenseCard();
  await api('/api/expenses', expense('smoketest-exp-b', 'SMOKE-EXP-BETA', 2222, OTHER_GSTIN, 'Smoke Beta'));
  const rep2 = await expenseCard();
  check('#64 reports ignore another company\'s expenses', close(rep1, rep0), `${rep0} -> ${rep1}`);
  check('#64 reports include this company\'s expenses (sanity)', close(rep2, rep0 + 2222), `${rep0} -> ${rep2}`);

  // ---- v1.10.75: Party Outstanding - unpaid part, invoice month, this company only
  const partyBill = (id, gstin, name, total, paid) => ({ id, invoiceNumber: id.toUpperCase(), clientName: 'Smoke Party Client',
    status: paid ? 'partial' : 'unpaid', totalAmount: total, paidAmount: paid, invoiceDate: today, payments: [], items: [],
    data: { profile: { gstin, businessName: name }, details: {}, totals: { total } } });
  await api('/api/bills', partyBill('smoketest-party-a', OTHER_GSTIN, 'Smoke Beta', 2345.5, 345.5));
  await api('/api/bills', partyBill('smoketest-party-b', THIRD_GSTIN, 'Smoke Third', 999999, 0));
  await reopenView('Reports');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Party Outstanding')?.click());
  await sleep(1000);
  const partyRow = await page.evaluate(() => [...document.querySelectorAll('tr')]
    .find((r) => r.innerText.trim().startsWith('Smoke Party Client'))?.innerText.replace(/\s+/g, ' ') || '');
  check('v75 Party Outstanding shows the unpaid part in its month, and not another company\'s bill',
    (partyRow.match(/2,000\.00/g) || []).length === 2 && !partyRow.includes('9,99,999'), partyRow.slice(0, 200));

  // ---- #64: GSTR-3B input tax credit counted every company's purchases -----
  const netItc = async () => {
    await reopenView('GST Returns');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'GSTR-3B');
      if (b) b.click();
    });
    await sleep(1200);
    return page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.trim().startsWith('Net ITC Available'));
      return row ? [...row.querySelectorAll('td')].slice(1)
        .reduce((s, td) => s + (Number(td.innerText.replace(/[^0-9.-]/g, '')) || 0), 0) : NaN;
    });
  };
  const purchase = (id, rate, gstin, name) => ({ id, date: today, supplierName: 'Smoke ITC Supplier',
    supplierGstin: '07AAAAA0000A1Z1', invoiceNumber: id.toUpperCase(), paymentStatus: 'Unpaid', interstate: false,
    ownerGstin: gstin, ownerName: name,
    items: [{ name: 'Smoke ITC item', hsn: '9999', quantity: 1, rate, taxPercent: 18, cessPercent: 0 }] });
  const itc0 = await netItc();
  await api('/api/purchases', purchase('smoketest-itc-a', 10000, TEST_GSTIN, 'Smoke Alpha'));
  const itc1 = await netItc();
  await api('/api/purchases', purchase('smoketest-itc-b', 1000, OTHER_GSTIN, 'Smoke Beta'));
  const itc2 = await netItc();
  check('#64 GSTR-3B ITC ignores another company\'s purchases', close(itc1, itc0), `${itc0} -> ${itc1}`);
  check('#64 GSTR-3B ITC includes this company\'s purchases (sanity)', close(itc2, itc0 + 180), `${itc0} -> ${itc2}`);

  // ---- #61: an export is zero-rated (3.1(b)), not a home-state B2C sale ----
  const zeroRated = async () => {
    await reopenView('GST Returns');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'GSTR-3B');
      if (b) b.click();
    });
    await sleep(1200);
    return page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.trim().startsWith('(b) Zero-rated supplies'));
      return {
        cells: row ? [...row.querySelectorAll('td')].slice(1, 3).map((td) => Number(td.innerText.replace(/[^0-9.-]/g, '')) || 0) : null,
        notice: (document.querySelector('.main-content')?.innerText || '').includes('SMOKE-EXPORT/1'),
      };
    });
  };
  const zr0 = await zeroRated();
  await api('/api/bills', { id: 'smoketest-export', invoiceNumber: 'SMOKE-EXPORT/1', invoiceType: 'tax-invoice',
    clientName: 'Smoke Test Client', status: 'unpaid', totalAmount: 5900, invoiceDate: today, payments: [], items: [],
    data: { profile: { gstin: OTHER_GSTIN, businessName: 'Smoke Beta', country: 'India', state: 'Karnataka' },
      client: { name: 'Smoke Test Client', country: 'United States', state: 'California' }, details: {},
      items: [{ name: 'Export item', hsn: '9983', quantity: 1, rate: 5000, taxPercent: 18 }],
      totals: { subtotal: 5000, taxableAmount: 5000, igst: 900, cgst: 0, sgst: 0, cess: 0, total: 5900, isInterstate: true } } });
  const zr1 = await zeroRated();
  check('#61 an export is reported in GSTR-3B 3.1(b) zero-rated supplies',
    !!zr0.cells && !!zr1.cells && close(zr1.cells[0], zr0.cells[0] + 5000) && close(zr1.cells[1], zr0.cells[1] + 900),
    `3.1(b) ${JSON.stringify(zr0.cells)} -> ${JSON.stringify(zr1.cells)}`);
  check('#61 GST Returns flags the export for GSTR-1 Table 6A', zr1.notice);

  // ---- v1.10.83 (#133): the GSTR-1 JSON is in the portal's current format ---
  // Its own two invoices, in a month nothing else uses (June 2025, after the
  // May 2025 HSN split): one to a registered buyer, one to an unregistered one.
  const beta = { gstin: OTHER_GSTIN, businessName: 'Smoke Beta', country: 'India', state: 'Karnataka' };
  const g1Bill = (id, inv, client) => ({ id, invoiceNumber: inv, invoiceType: 'tax-invoice', clientName: client.name, status: 'unpaid',
    totalAmount: 1180, invoiceDate: '2025-06-15', payments: [], items: [],
    data: { profile: beta, client, details: { invoiceNumber: inv, invoiceDate: '2025-06-15', placeOfSupply: 'Karnataka' },
      items: [{ name: 'Smoke HSN item with a description well over thirty characters', hsn: '4820', unit: 'Nos', quantity: 2, rate: 500, taxPercent: 18 }],
      totals: { subtotal: 1000, taxableAmount: 1000, cgst: 90, sgst: 90, igst: 0, cess: 0, total: 1180, isInterstate: false } } });
  await api('/api/bills', g1Bill('smoketest-g1-b2b', 'SMK133-B2B', { name: 'Smoke Registered', gstin: '29AAKFM4321Q1ZP', state: 'Karnataka', country: 'India' }));
  await api('/api/bills', g1Bill('smoketest-g1-b2c', 'SMK133-B2C', { name: 'Smoke Walk-in', state: 'Karnataka', country: 'India' }));
  await reopenView('GST Returns');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'GSTR-1')?.click());
  await sleep(800);
  const periodSelects = page.locator('select.form-input');
  await periodSelects.nth(0).selectOption('month');
  await periodSelects.nth(1).selectOption('5');
  await periodSelects.nth(2).selectOption('2025');
  await sleep(1000);
  const [g1] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
    page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'JSON Export')?.click()),
  ]);
  const g1json = g1 ? JSON.parse(readFileSync(await g1.path(), 'utf8')) : null;
  const hsnKeys = g1json?.hsn ? Object.keys(g1json.hsn) : [];
  check('v83 #133 GSTR-1 JSON splits the HSN summary into hsn_b2b / hsn_b2c, with no blank values',
    !!g1json && g1json.fp === '062025' && hsnKeys.join() === 'hsn_b2b,hsn_b2c'
      && g1json.hsn.hsn_b2b[0].desc.length <= 30 && (g1json.b2cs || []).length > 0 && g1json.b2cs.every((r) => r.typ === 'OE')
      && !JSON.stringify(g1json).includes('""') && !('gt' in g1json) && (g1json.b2b || [])[0]?.inv?.[0]?.inum === 'SMK133-B2B',
    g1 ? `${g1.suggestedFilename()} hsn: ${hsnKeys.join(',')}` : `no download: ${await page.evaluate(() => document.body.innerText.match(/(GSTR-1 export blocked|No invoices)[^\n]*/)?.[0] || '')}`);
  await page.evaluate(() => Promise.all(['smoketest-g1-b2b', 'smoketest-g1-b2c'].map((id) => fetch(`/api/bills/${id}`, { method: 'DELETE' }))));
  await periodSelects.nth(1).selectOption(String(new Date().getMonth()));
  await periodSelects.nth(2).selectOption(String(new Date().getFullYear()));

  // ---- #64 item 1: an open screen must follow a company switch -------------
  await reopenView('Expenses');
  const exp0 = await screenText();
  check('#64 Expenses shows only the selected company (sanity)',
    exp0.includes('SMOKE-EXP-BETA') && !exp0.includes('SMOKE-EXP-ALPHA'));
  const switchStarted = Date.now();
  await switchBusiness('Smoke Beta', 'Smoke Alpha');
  // Poll rather than read once after a fixed pause: the release gate runs on a
  // fresh install where the switch can take longer than on a warm dev tree, and
  // a single read turned that into a coin toss. The condition is unchanged; the
  // detail reports how long the screen actually took to follow the switch.
  let exp1 = await screenText();
  while (!(exp1.includes('SMOKE-EXP-ALPHA') && !exp1.includes('SMOKE-EXP-BETA')) && Date.now() - switchStarted < 10_000) {
    await sleep(250);
    exp1 = await screenText();
  }
  check('#64 switching company refreshes an Expenses screen that is already open',
    exp1.includes('SMOKE-EXP-ALPHA') && !exp1.includes('SMOKE-EXP-BETA'),
    `screen followed the switch after ${Date.now() - switchStarted} ms`);
  await page.getByRole('button', { name: /Add Expense/ }).first().click();
  await sleep(800);
  await page.locator('input[placeholder="e.g. AWS Hosting - March"]').fill('SMOKE-EXP-UI');
  await page.locator('input[placeholder="0.00"]').first().fill('10');
  await page.getByRole('button', { name: /^Save$/ }).first().click();
  await sleep(1800);
  const uiOwner = await page.evaluate(async () =>
    (await (await fetch('/api/expenses')).json()).find((e) => e.description === 'SMOKE-EXP-UI')?.ownerGstin ?? null);
  check('#64 an expense added right after switching is saved under the new company',
    uiOwner === TEST_GSTIN, `ownerGstin=${uiOwner}`);

  // ---- #64 item 2: receipts are per company --------------------------------
  const receipt = (id, receiptNo, owner) => ({ id, receiptNo, date: today, clientName: 'Smoke Test Client',
    amount: 10, paymentMode: 'Cash', ...owner });
  await api('/api/receipts', receipt('smoketest-rcp-a', 'SMOKE-RCP-A', { ownerGstin: TEST_GSTIN, ownerName: 'Smoke Alpha' }));
  await api('/api/receipts', receipt('smoketest-rcp-b', 'SMOKE-RCP-B', { ownerGstin: OTHER_GSTIN, ownerName: 'Smoke Beta' }));
  await api('/api/receipts', receipt('smoketest-rcp-legacy', 'SMOKE-RCP-LEGACY', {}));
  await reopenView('Receipts');
  const rcp = await screenText();
  check('#64 Receipts lists this company\'s receipts (sanity)', rcp.includes('SMOKE-RCP-A'));
  check('#64 Receipts hides another company\'s receipts', !rcp.includes('SMOKE-RCP-B'));
  check('#64 a receipt saved before companies were separated is still listed', rcp.includes('SMOKE-RCP-LEGACY'));

  // ---- #61 / #62 / #64 item 5: what the invoice itself prints --------------
  await api('/api/profile', { businessName: 'Smoke Alpha', gstin: TEST_GSTIN, state: 'Punjab', country: 'India' });
  const openDraft = async (draft) => {
    await page.evaluate((draft) => {
      sessionStorage.setItem('gst_invoiceDraft', JSON.stringify(draft));
      sessionStorage.setItem('gst_currentView', 'new');
      sessionStorage.removeItem('gst_editingBill');
    }, draft);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2500);
    await dismissFirstRun(page);
    await page.waitForSelector('#invoice-preview', { timeout: 20000 });
    await sleep(1500);
  };
  const preview = () => page.evaluate(() => {
    const p = document.querySelector('#invoice-preview');
    return {
      rows: [...(p?.querySelectorAll('.inv-total-row') || [])].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      text: (p?.innerText || '').replace(/\s+/g, ' '),
      pos: p?.querySelector('.inv-party-right .inv-party-name')?.innerText.trim() || '',
    };
  });
  const draftItems = [{ id: 'smk-line-1', name: 'Smoke item', hsn: '9983', quantity: 1, rate: 1000, taxPercent: 18, discount: 0, unit: 'Nos' }];
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Delhi', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/1', invoiceDate: today, placeOfSupply: 'Punjab' },
    items: draftItems,
    taxInclusive: false,
  });
  const pv = await preview();
  check('#61 test invoice: Delhi client, place of supply Punjab (sanity)', pv.pos === 'Punjab', `place of supply "${pv.pos}"`);
  check('#61 the invoice prints the CGST + SGST it charged, not "IGST ₹0.00"',
    pv.rows.some((r) => r.startsWith('CGST')) && !pv.rows.some((r) => r.startsWith('IGST')), pv.rows.join(' | '));
  check('#62 a tax invoice states "Reverse Charge: No"', /Reverse Charge:? No\b/i.test(pv.text));

  // The switch lives in the Customize panel.
  const clickReverseCharge = () => page.evaluate(() => {
    const label = [...document.querySelectorAll('label.option-toggle')].find((l) => /Reverse Charge applies/.test(l.innerText));
    const input = label?.querySelector('input');
    if (input) input.click();
    return !!input;
  });
  if (!(await page.evaluate(() => !!document.querySelector('label.option-toggle')))) {
    await page.getByRole('button', { name: /Customize/ }).first().click();
    await sleep(800);
  }
  const toggled = await clickReverseCharge();
  await sleep(1000);
  check('#62 turning Reverse Charge on prints "Reverse Charge: Yes"',
    toggled && /Reverse Charge:? Yes\b/i.test((await preview()).text));
  // Put the option back: it is remembered as a default for future invoices.
  if (toggled) { await clickReverseCharge(); await sleep(1500); }

  // #152 / #138: "Tax % columns" hides only the per-line tax columns; GST is
  // still charged. The switch that turns GST off says so.
  const clickOption = (src) => page.evaluate((s) => {
    const label = [...document.querySelectorAll('label.option-toggle')].find((l) => new RegExp(s).test(l.innerText));
    const input = label?.querySelector('input');
    if (input) input.click();
    return !!input;
  }, src);
  const taxView = () => page.evaluate(() => ({
    head: [...document.querySelectorAll('#invoice-preview .inv-table thead th')].map((t) => t.innerText.trim()),
    totals: document.querySelector('#invoice-preview .inv-totals')?.innerText || '',
  }));
  const tvBefore = await taxView();
  const tcToggled = await clickOption('^Tax % columns');
  await sleep(1000);
  const tvAfter = await taxView();
  check('#152 "Tax % columns" hides the tax columns, GST is still charged',
    tcToggled && tvBefore.head.includes('%') && !tvAfter.head.includes('%')
      && tvAfter.totals === tvBefore.totals && /CGST/.test(tvAfter.totals),
    `${tvBefore.head.join(',')} -> ${tvAfter.head.join(',')}`);
  if (tcToggled) { await clickOption('^Tax % columns'); await sleep(1500); }
  check('#152 the switch that turns GST off is called "Charge GST on this invoice"',
    await page.evaluate(() => [...document.querySelectorAll('label.option-toggle')].some((l) => /Charge GST on this invoice/.test(l.innerText))));

  // #156: the invoice form's WhatsApp button sends the same full message as
  // the Invoices list (client, total, status...), not the old short one.
  await page.evaluate(() => { window.__realOpen = window.open; window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.getByRole('button', { name: /WhatsApp/ }).first().click();
  await sleep(500);
  const waText = await page.evaluate(() => {
    window.open = window.__realOpen;
    return decodeURIComponent(((window.__opened[0] || '').split('text=')[1]) || '');
  });
  check('#156 the invoice form sends the full WhatsApp message',
    /Client: Smoke Test Client/.test(waText) && /Total: /.test(waText) && /Status: /.test(waText), waText.replace(/\n/g, ' | ').slice(0, 240));

  // #143: unit NA - no quantity box, "-" printed for the quantity, amount = rate.
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Delhi', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/NA', invoiceDate: today, placeOfSupply: 'Delhi' },
    items: [{ ...draftItems[0], unit: 'NA', quantity: 1 }],
    taxInclusive: false,
  });
  const na = await page.evaluate(() => ({
    locked: !!document.querySelector('.line-item-row input[disabled][value="-"]'),
    cells: [...document.querySelectorAll('#invoice-preview .inv-table tbody td')].map((t) => t.innerText.trim()),
  }));
  check('#143 unit NA: no quantity box, "-" printed, amount = rate',
    na.locked && na.cells.includes('-') && na.cells.some((t) => /1,000\.00/.test(t)), na.cells.join(' , '));

  // #140: size billing (glass): 25 x 30 in, 2 pcs, 6 inch rounding, Rs 50 / sq.ft
  // = 12.50 sq.ft, Rs 625; changing the length in the form re-works it out.
  const modulesBefore = await page.evaluate(() => localStorage.getItem('gst_enabledModules'));
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('gst_enabledModules') || '{}');
    localStorage.setItem('gst_enabledModules', JSON.stringify({ ...m, sizeBilling: true }));
  });
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Delhi', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/SQFT', invoiceDate: today, placeOfSupply: 'Delhi' },
    items: [{ id: 'smk-glass', name: '6mm Mirror', hsn: '7009', quantity: 12.5, unit: 'Sq.ft', rate: 50, taxPercent: 18, discount: 0, size: { l: 25, w: 30, pcs: 2, step: 6 } }],
    taxInclusive: false,
  });
  const glassRow = () => page.evaluate(() => {
    const head = [...document.querySelectorAll('#invoice-preview .inv-table thead th')].map((t) => t.innerText.trim().toUpperCase());
    const cells = [...document.querySelectorAll('#invoice-preview .inv-table tbody tr:first-child td')].map((t) => t.innerText.trim());
    const at = (name) => cells[head.filter((h) => !/^(%|AMT)$/.test(h)).indexOf(name)];
    return { size: at('SIZE'), qty: at('QTY'), sqft: at('SQFT'), amount: cells[cells.length - 1] };
  });
  const glass1 = await glassRow();
  check('#140 size line prints Size 25 x 30, Qty 2, SQFT 12.50, amount 625',
    glass1.size === '25 x 30' && glass1.qty === '2' && glass1.sqft === '12.50' && /625\.00/.test(glass1.amount), JSON.stringify(glass1));
  const lengthBox = page.locator('.line-item-row').first().locator('label:text("Length (in)") + input');
  await lengthBox.fill('31');
  await sleep(800);
  const glass2 = await glassRow();
  // 31 rounds up to 36: 36 x 30 / 144 x 2 = 15 sq.ft = Rs 750.
  check('#140 changing the length re-works the sq.ft and amount (31 in -> 36 in)',
    glass2.sqft === '15.00' && /750\.00/.test(glass2.amount), JSON.stringify(glass2));
  await page.evaluate((m) => { if (m === null) localStorage.removeItem('gst_enabledModules'); else localStorage.setItem('gst_enabledModules', m); }, modulesBefore);

  // #164: "Print rates before GST" with prices that include tax: 13.25 at 18%
  // prints 11.23, the total stays 2500 x 13.25 = 33,125.00.
  const rbtDraft = (on) => openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Delhi', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/RBT', invoiceDate: today, placeOfSupply: 'Delhi' },
    items: [{ id: 'smk-rbt', name: 'Packing box', hsn: '4819', quantity: 2500, rate: 13.25, taxPercent: 18, discount: 0, unit: 'Pcs' }],
    taxInclusive: true,
    invoiceOptions: { rateBeforeTax: on },
  });
  const rbtView = () => page.evaluate(() => ({
    cells: [...document.querySelectorAll('#invoice-preview .inv-table tbody tr:first-child td')].map((t) => t.innerText.trim()),
    total: (document.querySelector('#invoice-preview')?.innerText.match(/33,125\.00/) || [''])[0],
  }));
  await rbtDraft(false);
  const rbtOff = await rbtView();
  await rbtDraft(true);
  const rbtOn = await rbtView();
  check('#164 "Print rates before GST": rate 13.25 prints 11.23, the total is unchanged',
    rbtOff.cells.some((c) => /13\.25/.test(c)) && rbtOn.cells.some((c) => /11\.23/.test(c)) && !rbtOn.cells.some((c) => /13\.25/.test(c))
      && rbtOff.total && rbtOn.total, `${rbtOff.cells.join(' | ')}  ->  ${rbtOn.cells.join(' | ')}`);

  // #126: fields the user names print with the order details; an empty one does not.
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Delhi', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/OWN', invoiceDate: today, placeOfSupply: 'Delhi',
      customFields: [{ label: 'R SPH', value: '-1.25' }, { label: 'L SPH', value: '' }] },
    items: draftItems,
    taxInclusive: false,
  });
  const own = await page.evaluate(() => ({
    text: document.querySelector('#invoice-preview')?.innerText || '',
    inForm: [...document.querySelectorAll('input[placeholder="Field name, e.g. R SPH"]')].map((i) => i.value),
  }));
  check('#126 your own fields: filled one printed, empty one not, both in the form',
    /R SPH:?\s*-1\.25/.test(own.text) && !/L SPH/.test(own.text) && own.inForm.join() === 'R SPH,L SPH',
    own.inForm.join());

  await openDraft({
    invoiceType: 'proforma',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Punjab', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-DRAFT/2', invoiceDate: today },
    items: draftItems,
    taxInclusive: false,
  });
  const faint = await page.evaluate(() => {
    const rgb = (c) => (c.match(/[0-9.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const background = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;   // gradient: cannot judge, skip
        const c = rgb(cs.backgroundColor);
        if (c.length === 3 || c[3] > 0.5) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const root = document.querySelector('#invoice-preview');
    const offenders = [];
    for (const el of root ? root.querySelectorAll('*') : []) {
      const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!ownText || el.getBoundingClientRect().width === 0) continue;
      const bg = background(el);
      if (!bg) continue;
      const ratio = contrast(rgb(getComputedStyle(el).color).slice(0, 3), bg);
      if (ratio < 4.5) offenders.push(`"${ownText.slice(0, 32)}" ${getComputedStyle(el).color} ${ratio.toFixed(2)}:1`);
    }
    return { offenders, hasDisclaimer: !!root && /This is not a tax invoice/.test(root.innerText) };
  });
  check('#64 proforma disclaimer is on the page (sanity)', faint.hasDisclaimer);
  check('#64 no invoice text is too faint for black-and-white print (4.5:1)',
    faint.offenders.length === 0, faint.offenders.slice(0, 3).join(' | '));

  // ---- #59: a hide/show menu on phones, nothing new on desktop -------------
  const desk = await page.evaluate(() => {
    const bar = document.querySelector('.mobile-topbar');
    const side = document.querySelector('.sidebar').getBoundingClientRect();
    return { bar: bar ? getComputedStyle(bar).display : 'missing', left: Math.round(side.left), width: Math.round(side.width) };
  });
  check('#59 desktop keeps the fixed sidebar and shows no phone menu bar',
    desk.bar === 'none' && desk.left === 0 && desk.width > 200, JSON.stringify(desk));

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mob = await phone.newPage();
  try {
    await mob.goto(APP, { waitUntil: 'networkidle' });
    await sleep(2000);
    await dismissFirstRun(mob);
    const menuBox = () => mob.evaluate(() => {
      const r = document.querySelector('.sidebar').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    const barShownOnPhone = await mob.evaluate(() => {
      const bar = document.querySelector('.mobile-topbar');
      return !!bar && getComputedStyle(bar).display !== 'none';
    });
    const startBox = await menuBox();
    check('#59 on a phone the menu starts hidden behind a menu button',
      barShownOnPhone && startBox.right <= 1, `bar=${barShownOnPhone} menu=${JSON.stringify(startBox)}`);
    if (barShownOnPhone) {
      await mob.getByRole('button', { name: 'Open menu' }).click();
      await sleep(700);
      const openBox = await menuBox();
      check('#59 the menu button slides the menu in', openBox.left >= 0 && openBox.right > 200, JSON.stringify(openBox));
      await mob.evaluate(() => {
        const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim() === 'Expenses');
        if (b) b.click();
      });
      await sleep(1800);
      const pickedBox = await menuBox();
      const title = await mob.evaluate(() => document.querySelector('.page-title')?.innerText || '');
      check('#59 picking a page opens it and closes the menu',
        pickedBox.right <= 1 && /Expenses/.test(title), `menu=${JSON.stringify(pickedBox)} page="${title}"`);
      const width = await mob.evaluate(() => Math.round(document.querySelector('.main-content').getBoundingClientRect().width));
      check('#59 pages get the full phone width', width >= 380, `${width}px`);
    }
  } finally {
    await phone.close();
  }

  // ======================================================================
  // v1.10.67 — #66 (@sangwanmail-eng)
  // ======================================================================
  const salesCards = async () => {
    await reopenView('Dashboard');
    // The cards show "—" until the invoices have loaded; reading them then
    // gave 0 on a busy PC (v1.10.79 gate). Wait for real values, up to 8 s.
    for (let i = 0; i < 16; i++) {
      const v = await cardValues('Invoices');
      if (v && v[0] && v[0] !== '—') break;
      await sleep(500);
    }
    return { total: rupees(await cardValues('Total Invoiced')), count: money((await cardValues('Invoices'))?.[0]) };
  };
  const seedBill = (id, number, type, amount, extra = {}) => api('/api/bills', {
    id, invoiceNumber: number, invoiceType: type, clientName: 'Smoke Test Client',
    status: 'unpaid', totalAmount: amount, totalTaxAmount: 0, invoiceDate: today, payments: [], items: [],
    data: {
      profile: { gstin: TEST_GSTIN, businessName: 'Smoke Alpha', country: 'India', state: 'Punjab' },
      client: { name: 'Smoke Test Client', state: 'Punjab', country: '' },
      details: { invoiceNumber: number, invoiceDate: today },
      items: [{ id: 'l1', name: 'Smoke line', hsn: '9983', quantity: 1, rate: amount, taxPercent: 0, discount: 0, unit: 'Pcs' }],
      totals: { subtotal: amount, taxableAmount: amount, cgst: 0, sgst: 0, igst: 0, total: amount, isInterstate: false },
      invoiceOptions: { showGST: false },
    },
    ...extra,
  });

  // ---- #66 item 7: only real sales count on the dashboard ----------------
  const sales0 = await salesCards();
  await seedBill('smoketest-quote', 'SMOKE-EST/9', 'proforma', 9999);
  await seedBill('smoketest-challan', 'SMOKE-DC/9', 'delivery-challan', 8888);
  const sales1 = await salesCards();
  check('#66 a proforma and a delivery challan are not counted as sales',
    close(sales1.total, sales0.total) && sales1.count === sales0.count,
    `total ${sales0.total} -> ${sales1.total}, count ${sales0.count} -> ${sales1.count}`);
  await seedBill('smoketest-sale', 'SMOKE-SALE/9', 'tax-invoice', 1000);
  await seedBill('smoketest-cn', 'SMOKE-CN/9', 'credit-note', 400);
  const sales2 = await salesCards();
  check('#66 a sale adds and a credit note subtracts (sanity)',
    close(sales2.total, sales0.total + 600) && sales2.count === sales0.count + 2,
    `total ${sales0.total} -> ${sales2.total}, count ${sales0.count} -> ${sales2.count}`);

  // ---- #66 item 10: the short columns are centred -------------------------
  const aligned = await page.evaluate(() => {
    const head = [...document.querySelectorAll('th')];
    const pick = (label) => head.find((h) => h.textContent.trim() === label);
    const align = (el) => (el ? getComputedStyle(el).textAlign : null);
    return { type: align(pick('Type')), paid: align(pick('Paid')), status: align(pick('Status')), client: align(pick('Client')) };
  });
  check('#66 Type, Paid and Status are centred; Client stays left',
    aligned.type === 'center' && aligned.paid === 'center' && aligned.status === 'center' && aligned.client !== 'center',
    JSON.stringify(aligned));

  // ---- #66 item 11: the type is locked once the invoice is saved ---------
  await seedBill('smoketest-cancel', 'SMOKE-CANCEL/9', 'tax-invoice', 5000);
  await reopenView('Dashboard');
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('SMOKE-CANCEL/9'));
    const btn = row && [...row.querySelectorAll('button')].find((b) => (b.title || '') === 'Edit');
    if (btn) btn.click();
  });
  await page.waitForSelector('#invoice-preview', { timeout: 20000 });
  await sleep(1500);
  const chips = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.type-selector .type-chip')];
    return {
      total: all.length,
      disabled: all.filter((c) => c.disabled).length,
      active: all.filter((c) => c.className.includes('type-chip-active')).length,
    };
  });
  check('#66 the invoice type cannot be changed on a saved invoice',
    chips.total > 1 && chips.disabled === chips.total - 1 && chips.active === 1, JSON.stringify(chips));
  check('#66 the "Billing From" card is gone from the invoice screen',
    !(await screenText()).includes('Billing From'));

  await openView('Dashboard');
  const leave = page.getByRole('button', { name: /Discard.*leave/i });
  if (await leave.count()) { await leave.click(); await sleep(1500); }

  // ---- #66 item 12: cancelling keeps the invoice, out of the totals ------
  const beforeCancel = await salesCards();
  // v1.10.80 (#100) - Cancel is in the row's ⋯ menu.
  await page.locator('tr', { hasText: 'SMOKE-CANCEL/9' }).locator('button[aria-label^="More actions"]').click();
  await page.locator('[role=menu] [role=menuitem]', { hasText: 'Cancel invoice' }).click();
  await sleep(900);
  const confirmCancel = page.getByRole('button', { name: /^Cancel invoice$/ });
  if (await confirmCancel.count()) await confirmCancel.first().click();
  await sleep(2500);
  const afterCancel = await salesCards();
  await openFolder('Cancelled'); // v1.10.84: cancelled invoices have their own tab
  const cancelledRow = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('SMOKE-CANCEL/9'));
    if (!row) return null;
    // v1.10.77 (#86) - a cancelled row is read-only: a Cancelled badge with
    // Undo instead of the status menu.
    const status = row.querySelector('select.status-select');
    return { listed: true, status: status ? status.value : (/Cancelled/i.test(row.innerText) ? 'cancelled' : null), menu: !!status };
  });
  check('#66 a cancelled invoice drops out of the sales totals',
    close(afterCancel.total, beforeCancel.total - 5000) && afterCancel.count === beforeCancel.count - 1,
    `total ${beforeCancel.total} -> ${afterCancel.total}`);
  check('#66 the cancelled invoice is still listed, marked Cancelled, its status menu locked (#86)',
    cancelledRow?.listed === true && cancelledRow.status === 'cancelled' && !cancelledRow.menu, JSON.stringify(cancelledRow));
  const cancelledStatus = await page.evaluate(async () =>
    (await (await fetch('/api/bills')).json()).find((b) => b.id === 'smoketest-cancel')?.status ?? null);
  check('#66 the invoice itself is kept, not deleted', cancelledStatus === 'cancelled', `status=${cancelledStatus}`);

  // v1.10.84 (maintainer): Delete in the same menu, also on a cancelled
  // invoice, moves it to the Trash (30 days) - off the list, in /api/trash.
  await page.locator('tr', { hasText: 'SMOKE-CANCEL/9' }).locator('button[aria-label^="More actions"]').click();
  await page.locator('[role=menu] [role=menuitem]', { hasText: /^\s*Delete\s*$/ }).click();
  await sleep(700);
  await page.getByRole('button', { name: /^Delete$/ }).last().click();
  await sleep(2500);
  const trashed = await page.evaluate(async () => ({
    listed: [...document.querySelectorAll('tr')].some((r) => r.innerText.includes('SMOKE-CANCEL/9')),
    bill: (await (await fetch('/api/bills')).json()).some((b) => b.id === 'smoketest-cancel'),
    trash: (await (await fetch('/api/trash')).json()).some((b) => b.id === 'smoketest-cancel'),
  }));
  check('Delete on the Invoices list moves the invoice to the Trash (also a cancelled one)', !trashed.listed && !trashed.bill && trashed.trash, JSON.stringify(trashed));
  // The Trash copy is the suite's own: removed for good.
  await page.evaluate(async () => fetch('/api/trash/smoketest-cancel?permanent=1', { method: 'DELETE' }).catch(() => {}));

  // v1.10.84 (maintainer, 7 Nov: "cancel button not working"): with only
  // cancelled invoices ticked, Cancel invoices says so; Delete invoices in the
  // same bar moves the ticked ones to the Trash.
  {
    await page.evaluate(async () => {
      const prof = await (await fetch('/api/profile')).json();
      for (const n of [1, 2]) {
        await fetch('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          id: `smoketest-bd-${n}`, invoiceNumber: `SMOKE-BD/${n}`, clientName: 'Smoke Test Client', invoiceDate: '2026-11-07',
          status: 'cancelled', totalAmount: 100, payments: [], items: [], profileId: prof.id,
          data: { details: { invoiceNumber: `SMOKE-BD/${n}`, invoiceDate: '2026-11-07' }, client: { name: 'Smoke Test Client' }, profile: prof, totals: { total: 100 } } }) });
      }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2000);
    await dismissFirstRun(page);
    await openView('Dashboard');
    await openFolder('Cancelled');
    await page.fill('input[placeholder^="Search client, invoice"]', 'SMOKE-BD/');
    await sleep(800);
    for (const n of [1, 2]) await page.locator('tr', { hasText: `SMOKE-BD/${n}` }).first().locator('input[type="checkbox"]').check();
    await page.locator('button', { hasText: 'Cancel invoices' }).first().click();
    const said = await page.getByText(/already cancelled/i).first().isVisible({ timeout: 4000 }).catch(() => false);
    check('Cancel invoices with only cancelled invoices ticked says so (it did nothing, silently)', said);
    await page.locator('button', { hasText: 'Delete invoices' }).first().click();
    await sleep(600);
    await page.getByRole('button', { name: /^Delete 2$/ }).click();
    await sleep(2500);
    const bd = await page.evaluate(async () => {
      const ids = ['smoketest-bd-1', 'smoketest-bd-2'];
      const bills = (await (await fetch('/api/bills')).json()).filter((b) => ids.includes(b.id)).length;
      const trash = (await (await fetch('/api/trash')).json()).filter((b) => ids.includes(b.id)).length;
      return { bills, trash };
    });
    // v1.10.84 - the Trash tab lists them with days left; Restore puts one back.
    await openFolder('Trash');
    const inTab = await page.locator('tr', { hasText: 'SMOKE-BD/1' }).count();
    const left = await page.locator('tr', { hasText: 'SMOKE-BD/1' }).first().locator('td').nth(5).innerText().catch(() => '');
    await page.locator('tr', { hasText: 'SMOKE-BD/1' }).first().getByRole('button', { name: /Restore/ }).click();
    await sleep(2000);
    const back = await page.evaluate(async () => (await (await fetch('/api/bills')).json()).some((b) => b.id === 'smoketest-bd-1'));
    check('The Trash tab lists deleted invoices with 30 days left, and Restore puts one back', inTab === 1 && left.trim() === '30' && back, JSON.stringify({ inTab, left, back }));
    await page.evaluate(async () => {
      await fetch('/api/bills/smoketest-bd-1?permanent=1', { method: 'DELETE' }).catch(() => {});
      for (const id of ['smoketest-bd-1', 'smoketest-bd-2']) await fetch(`/api/trash/${id}`, { method: 'DELETE' }).catch(() => {});
    });
    await openFolder('Invoices');
    check('Delete invoices in the bar moves the ticked invoices to the Trash', bd.bills === 0 && bd.trash === 2, JSON.stringify(bd));
    await page.fill('input[placeholder^="Search client, invoice"]', '');
  }

  // ---- #66 item 2: a new product starts in Pcs ---------------------------
  await reopenView('Products');
  await page.getByRole('button', { name: /Add Product/i }).first().click();
  await sleep(900);
  const unitValue = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'Pcs'));
    return sel ? sel.value : null;
  });
  check('#66 a new product defaults to Pcs', unitValue === 'Pcs', `unit=${unitValue}`);
  await page.getByRole('button', { name: /^Cancel$/ }).first().click();
  await sleep(800);

  // ---- #66 item 8: the sidebar follows the theme -------------------------
  const sidebarTone = async () => page.evaluate(() => {
    const rgb = (getComputedStyle(document.querySelector('.sidebar')).backgroundColor.match(/[0-9.]+/g) || []).map(Number);
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  });
  const toggleTheme = async (label) => {
    // v1.10.83 - the moon / sun button is at the top right, not in the sidebar.
    await page.evaluate((label) => {
      const b = document.querySelector(`.app-topbar button[aria-label="${label.replace(' Mode', ' mode')}"]`);
      if (b) b.click();
    }, label);
    await sleep(900);
  };
  const themeNow = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (themeNow === 'dark') await toggleTheme('Light Mode');
  const lightTone = await sidebarTone();
  await toggleTheme('Dark Mode');
  const darkTone = await sidebarTone();
  check('#66 the sidebar is light in Light Mode and dark in Dark Mode',
    lightTone > 0.7 && darkTone < 0.3, `light=${lightTone.toFixed(2)} dark=${darkTone.toFixed(2)}`);
  await toggleTheme('Light Mode');

  // ---- #66 item 13: the stamp prints beside the signature ----------------
  const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.evaluate(async ({ png }) => {
    const prof = await (await fetch('/api/profile')).json();
    await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prof, stamp: png, stampHeight: 70, signature: png, signatureHeight: 55 }),
    });
  }, { png: onePixelPng });
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Punjab', gstin: '', country: '', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-STAMP/1', invoiceDate: today, placeOfSupply: 'Punjab' },
    items: draftItems,
    taxInclusive: false,
  });
  const stampShown = await page.evaluate(() => {
    const box = document.querySelector('#invoice-preview .inv-signature');
    if (!box) return null;
    const stamp = box.querySelector('img[alt="Stamp"]');
    const sig = box.querySelector('img[alt="Signature"]');
    return { stamp: !!stamp, sig: !!sig, stampHeight: stamp ? Math.round(stamp.getBoundingClientRect().height) : 0 };
  });
  check('#66 the stamp prints next to the signature', !!stampShown?.stamp && !!stampShown?.sig, JSON.stringify(stampShown));

  // ---- #66 item 9 / v1.10.75: one Save for all of Settings, pinned at the bottom
  await openView('Settings');
  await sleep(2000);
  const saveBar = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Save all changes/i.test(b.innerText));
    if (!btn) return null;
    const bar = btn.closest('.settings-savebar');
    return { docked: !!bar && getComputedStyle(bar).position === 'fixed', bottomGap: bar ? Math.round(innerHeight - bar.getBoundingClientRect().bottom) : null };
  });
  check('#66 Settings keeps one Save button docked along the bottom edge',
    !!saveBar?.docked && saveBar.bottomGap === 0, JSON.stringify(saveBar));
  const jumpScrolls = await page.evaluate(() => {
    const n = document.querySelector('.settings-jumpnav');
    return n ? n.scrollWidth > n.clientWidth + 1 : null;
  });
  check('v75 the Settings section buttons never scroll sideways', jumpScrolls === false, String(jumpScrolls));
  // v1.10.84 (maintainer): 6 tabs instead of 14; a tab shows all its cards.
  const tabs84 = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.settings-jumpnav a')].map((a) => a.innerText.trim()),
  }));
  await page.locator('.settings-jumpnav a[href="#tab-data"]').click();
  await sleep(500);
  const dataCards = await page.evaluate(() => ['section-backups', 'section-cloud', 'section-data', 'section-company']
    .map((id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; }));
  check('v84 Settings has 6 tabs, and Data & Backups shows Backups, Google Drive and Import/Export (not Company)',
    tabs84.names.join('|') === 'Company|Print & PDF|Features|Privacy & Security|Data & Backups|Updates' && dataCards.join() === 'true,true,true,false',
    JSON.stringify({ ...tabs84, dataCards }));

  // One click saves two different sections.
  const getMeta = (key) => page.evaluate(async (k) => ((await (await fetch('/api/meta/' + k)).json()).value || {}), key);
  await page.locator('.settings-jumpnav a[href="#tab-company"]').click();
  const nameBefore = await page.locator('#section-company input[name="businessName"]').inputValue();
  const numBefore = await getMeta('invoiceNumberSettings');
  await page.locator('#section-company input[name="businessName"]').fill(`Smoke SaveAll ${Date.now() % 100000}`);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  // v1.10.79 - a prefix that keeps credit notes within GST's 16 characters
  // (SM-CN/26-27/0001): longer ones are now refused, rightly.
  await page.locator('input[placeholder^="e.g. ACME"]').fill('SM');
  await page.getByRole('button', { name: /^Short \(/ }).first().click();
  await sleep(500);
  await page.getByRole('button', { name: /Save all changes/i }).click();
  // v1.10.80 (#99) - shared numbering used by several businesses asks first.
  await page.getByRole('button', { name: /^Change for all$/ }).click({ timeout: 3000 }).catch(() => {});
  await sleep(2500);
  const savedName = await page.evaluate(async () => (await (await fetch('/api/profile')).json()).businessName);
  const savedPrefix = (await getMeta('invoiceNumberSettings')).brandPrefix;
  check('v75 "Save all changes" saves Company Details and Invoice Number Format together',
    /^Smoke SaveAll/.test(savedName || '') && savedPrefix === 'SM', `name=${savedName} prefix=${savedPrefix}`);
  // Put both back.
  await page.locator('#section-company input[name="businessName"]').fill(nameBefore);
  await page.locator('input[placeholder^="e.g. ACME"]').fill(numBefore.brandPrefix || '');
  await sleep(500);
  await page.getByRole('button', { name: /Save all changes/i }).click();
  // v1.10.80 (#99) - shared numbering used by several businesses asks first.
  await page.getByRole('button', { name: /^Change for all$/ }).click({ timeout: 3000 }).catch(() => {});
  await sleep(2500);
  check('v75 after saving, the bar says everything is saved',
    await page.evaluate(() => /All changes saved/.test(document.querySelector('.settings-savebar')?.innerText || '')));

  // ---- v1.10.75: the app-wide round-off switch saves the invoice default --
  // v1.10.83 - Settings is tabbed; the switch lives on the Print & PDF tab.
  await page.locator('.settings-jumpnav a[href="#tab-print"]').click();
  const roundOffBox = page.locator('label', { hasText: 'Round off invoice totals' }).locator('input[type="checkbox"]');
  const roundOffBefore = await roundOffBox.isChecked();
  await roundOffBox.click();
  await sleep(1500);
  const roundOffSaved = await page.evaluate(async () =>
    ((await (await fetch('/api/meta/invoiceDisplayOptions')).json()).value || {}).showRoundOff);
  await roundOffBox.click(); // put it back
  await sleep(1500);
  check('v75 Settings round-off switch saves the invoice default',
    roundOffSaved === !roundOffBefore, `was ${roundOffBefore}, saved ${roundOffSaved}`);

  // ---- #68: a GSTIN fills in the state, offline -------------------------
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke GSTIN Client', address: '', city: '', pin: '', state: '', gstin: '', country: 'India', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-GSTIN/1', invoiceDate: today },
    items: draftItems,
    taxInclusive: false,
  });
  const billedTo = page.locator('.glass-panel').filter({ has: page.locator('h3.section-title', { hasText: 'Billed To' }) });
  const fieldGroup = (label) => billedTo.locator('.form-group').filter({ has: page.locator(`label.form-label:text-is("${label}")`) });
  const gstinInput = fieldGroup('GSTIN').locator('input');
  await gstinInput.fill('27AAPFU0939F1ZV');
  await page.keyboard.press('Tab');
  await sleep(600);
  const filledState = await fieldGroup('State').locator('select, input').inputValue();
  check('#68 a valid GSTIN fills the client state from its first two digits',
    filledState === 'Maharashtra', `state=${filledState}`);

  await gstinInput.fill('27AAPFU0939F1ZW');
  await page.keyboard.press('Tab');
  await sleep(600);
  const typoWarning = (await fieldGroup('GSTIN').locator('small').allInnerTexts()).join(' ');
  check('#68 a mistyped GSTIN is caught by its own checksum',
    /checksum/i.test(typoWarning), typoWarning || 'no warning shown');

  // ---- v1.10.69: the getting-started checklist -------------------------
  // It has to read the real saved data, not "have you seen this screen",
  // and it has to retire itself once there is nothing left to do.
  await page.evaluate(() => { try { localStorage.removeItem('freegstbill_startedDismissed'); } catch { /* private mode */ } });
  const setBank = async (withBank) => {
    await page.evaluate(async ({ withBank, prof }) => {
      const body = { ...prof };
      if (withBank) { body.paymentAccounts = [{ id: 'smk', label: 'Test', bankName: 'Test Bank', accountNumber: '1', ifsc: 'X', isDefault: true, isActive: true }]; body.upiId = 'x@y'; }
      else { body.paymentAccounts = []; body.upiId = ''; body.accountNumber = ''; }
      await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }, { withBank, prof: originalProfile });
    // The app holds the business profile in React state and only fetches it
    // on load, so a POST made behind its back is invisible until a reload.
    // (In real use, saving in Settings updates that state directly.)
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2500);
    await openView('Dashboard');
  };
  const checklist = () => page.evaluate(() => {
    const head = [...document.querySelectorAll('.section-title')].find((h) => h.innerText.trim() === 'Getting started');
    if (!head) return null;
    const card = head.closest('.glass-panel');
    return { shown: true, text: card.innerText.replace(/\s+/g, ' ') };
  });

  await setBank(false);
  const noBank = await checklist();
  check('v1.10.69 the getting-started card is shown while something is still to do',
    !!noBank && /Add bank details or UPI/.test(noBank.text),
    noBank ? noBank.text.slice(0, 140) : 'card not shown');

  await setBank(true);
  const withBank = await checklist();
  const doneOf = (c) => (c ? Number((c.text.match(/(\d) of 4 done/) || [0, -1])[1]) : 4);
  check('v1.10.69 it ticks itself off from the saved data, not from having been seen',
    doneOf(withBank) === doneOf(noBank) + 1,
    `without bank ${doneOf(noBank)}/4, with bank ${doneOf(withBank)}/4`);

  // ---- #71 (@sangwanmail-eng) -------------------------------------------
  // 1. Customize belongs in the sticky toolbar, right before Show Preview.
  await openDraft({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke 71 Client', address: '', city: '', pin: '', state: 'Punjab', gstin: '', country: 'India', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: 'SMOKE-71/1', invoiceDate: today },
    items: draftItems,
    taxInclusive: false,
  });
  const bar71 = await page.evaluate(() => {
    const el = document.querySelector('.generator-toolbar');
    return el ? [...el.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean) : null;
  });
  const cIdx = bar71 ? bar71.findIndex((t) => /Customize|Hide Options/.test(t)) : -1;
  const pIdx = bar71 ? bar71.findIndex((t) => /Show Preview|Hide Preview/.test(t)) : -1;
  check('#71.1 Customize sits in the toolbar, immediately before the preview button',
    cIdx !== -1 && pIdx === cIdx + 1, JSON.stringify(bar71));
  const cCount = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /^(Customize|Hide Options)$/.test(b.innerText.trim())).length);
  check('#71.1 and there is only one of it', cCount === 1, `found ${cCount}`);

  // 2. Qty / Rate / Cess replace their contents when you click and type.
  await openView('Purchases');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Add Purchase/i.test(x.innerText));
    if (b) b.click();
  });
  await sleep(2500);
  for (const label of ['Qty', 'Rate', 'Cess %']) {
    const field = page.locator(`.form-group:has(.form-label:text-is("${label}")) input[type=number]`).first();
    const was = await field.inputValue();
    await field.click();
    await page.keyboard.type('7');
    const now = await field.inputValue();
    // selectionStart is null on <input type=number>, so ask what a user sees.
    check(`#71.2 typing in ${label} replaces what was there`, now === '7', `was "${was}", got "${now}"`);
  }

  // 3. The Status column is a dropdown that saves, like the Dashboard.
  await openView('Purchases');
  const st71 = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('th')].map((th) => th.textContent.trim().toLowerCase());
    const idx = heads.indexOf('status');
    const row = document.querySelector('tbody tr');
    if (idx === -1 || !row) return { idx, rows: 0 };
    const sel = row.children[idx]?.querySelector('select');
    // Which purchase is this row? The list is filtered and sorted, so the
    // first row is not necessarily the one this suite created.
    const invIdx = heads.indexOf('invoice no');
    const invoiceNumber = invIdx === -1 ? null : row.children[invIdx].innerText.trim();
    return { idx, invoiceNumber, isSelect: !!sel, value: sel?.value, options: sel ? [...sel.options].map((o) => o.value) : null };
  });
  check('#71.3 the Status column is a dropdown offering Unpaid / Paid / Partial',
    st71.isSelect === true && JSON.stringify(st71.options) === JSON.stringify(['Unpaid', 'Paid', 'Partial']),
    JSON.stringify(st71));
  if (st71.isSelect) {
    await page.evaluate((idx) => {
      const sel = document.querySelector('tbody tr').children[idx].querySelector('select');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, 'Paid');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, st71.idx);
    await sleep(2500);
    const saved71 = await page.evaluate(async (invoiceNumber) => {
      const rows = await (await fetch('/api/purchases')).json();
      const r = rows.find((x) => String(x.invoiceNumber).trim() === invoiceNumber);
      return r ? r.paymentStatus : null;
    }, st71.invoiceNumber);
    check('#71.3 changing it saves against the purchase', saved71 === 'Paid',
      `invoice ${st71.invoiceNumber} saved as "${saved71}"`);
  }

  // ---- ERR-024: a page break must never cut through the signature --------
  // Reported with a photo: the stamp printed half at the foot of page 1 and
  // half at the top of page 2. The footer is two columns - bank details and
  // terms on the left, signature and stamp on the right - and the paginator
  // broke at the gap between bank details and terms, which runs straight
  // through the stamp. This builds that exact invoice: it adds item rows until
  // the page-1 seam falls between the bottom of the bank-details block and the
  // bottom of the signature block (the only window in which the old code cut
  // the stamp), makes a real PDF, and checks where the page actually ended.
  const tallStamp = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 100; c.height = 300;
    const g = c.getContext('2d');
    g.strokeStyle = '#1d4ed8'; g.lineWidth = 8;
    g.strokeRect(8, 8, 84, 284);
    return c.toDataURL('image/png');
  });
  await page.evaluate(async ({ png, prof }) => {
    await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prof, stamp: png, stampHeight: 160, signature: png, signatureHeight: 90,
        bankName: prof.bankName || 'Smoke Bank', accountNumber: prof.accountNumber || '000111222333',
        ifsc: prof.ifsc || 'SMOK0000001' }) });
  }, { png: tallStamp, prof: originalProfile });
  const seamDraft = (n) => ({
    invoiceType: 'tax-invoice',
    client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Punjab', gstin: '', country: 'India', email: '', phone: '', isSEZ: false },
    details: { invoiceNumber: `SMOKE-SEAM/${n}`, invoiceDate: today, placeOfSupply: 'Punjab' },
    items: Array.from({ length: n }, (_, i) => ({ ...draftItems[0], id: `smk-seam-${i}`, name: `Seam item ${i + 1}` })),
    taxInclusive: false,
    customTerms: '<p>1. Goods once sold will not be taken back.</p><p>2. Subject to local jurisdiction.</p><p>3. Payment is due within 15 days.</p>',
  });
  const pdfLayout = async (n) => {
    await openDraft(seamDraft(n));
    await page.evaluate(() => { window.__lastPdfLayout = null; });
    try {
      await Promise.all([
        page.waitForEvent('download', { timeout: 90_000 }),
        page.getByRole('button', { name: /save & download/i }).first().click(),
      ]);
    } catch { /* judged below */ }
    await sleep(800);
    return page.evaluate(() => window.__lastPdfLayout);
  };
  // The danger window: a real multi-page PDF (the invoice is taller than one
  // page), with the page-1 seam below the bank-details block but above the
  // bottom of the signature block beside it.
  // v1.10.77 (#88): an invoice up to 6% over one page is scaled onto ONE page
  // (onePage), so in some layouts every invoice of this shape fits one page and
  // the break can no longer happen. A real multi-page case is preferred; the
  // one-page outcome is accepted (nothing can be cut) and said so. Multi-page
  // breaks are also checked by the 45-item Tally test below.
  const atSeam = (L) => !!(L && L.signature && L.blocks?.length
    && L.blocks[0][1] < L.pageHeight && L.pageHeight < L.signature[1]);
  const inWindow = (L) => atSeam(L) && !L.onePage && L.total > L.fullHeight + 2;

  const probe = await pdfLayout(1);
  let seam = null;
  if (probe?.signature && probe.blocks?.length && probe.rowHeight > 0) {
    // Aim the seam just under the bank-details block: that leaves the most of
    // the invoice below it, which is what makes the PDF spill onto page 2.
    const k0 = Math.max(0, Math.floor((probe.pageHeight - 12 - probe.blocks[0][1]) / probe.rowHeight));
    // Wider than before: up to 6% over one page is now scaled onto one page,
    // so the multi-page case needs a few more rows.
    let squeezed = null;
    for (const k of [k0, k0 + 1, k0 + 2, k0 + 3, k0 - 1, k0 - 2]) {
      if (k < 0) continue;
      const L = await pdfLayout(1 + k);
      if (inWindow(L)) { seam = { ...L, items: 1 + k }; break; }
      if (!squeezed && atSeam(L) && L.onePage) squeezed = { ...L, items: 1 + k };
    }
    if (!seam && squeezed) seam = squeezed;
  }
  check('ERR-024 test setup: the page seam lands inside the signature block (the case that broke)',
    !!seam, seam ? `${seam.items} items, seam at ${Math.round(seam.pageHeight)}px, signature ${seam.signature.map(Math.round).join('-')}px${seam.onePage ? ' (fits one page since v1.10.77)' : ''}`
      : `could not place it - probe ${JSON.stringify(probe && { H: probe.pageHeight, full: probe.fullHeight, total: probe.total, row: probe.rowHeight, sig: probe.signature, first: probe.blocks?.[0] })}`);
  if (seam) {
    const cutInto = seam.ends.filter((e) => seam.atoms.some(([a, b]) => e > a + 1 && e < b - 1));
    check('ERR-024 no PDF page ends inside the signature, stamp or any image',
      (seam.onePage ? seam.ends.length === 0 : seam.ends.length > 0) && cutInto.length === 0,
      seam.onePage ? 'one page, no page break at all'
        : `page ends at ${seam.ends.map(Math.round).join(', ')}px${cutInto.length ? ` - CUTS THROUGH at ${cutInto.map(Math.round).join(', ')}` : ''}`);
  }

  // ---- v1.10.73: Boxed grid and Tally style designs ----------------------
  // Chosen through Customize, the way a person does it. The choice is saved
  // as the default for new invoices, so it is put back to Classic at the end.
  const pickStyle = async (label) => {
    const custom = page.getByRole('button', { name: /^customize$/i }).first();
    if (await custom.count()) { await custom.click(); await sleep(700); }
    await page.locator('button.type-chip', { hasText: label }).first().click();
    await sleep(1500); // display options save after 800 ms
    const hide = page.getByRole('button', { name: /hide options/i }).first();
    if (await hide.count()) { await hide.click(); await sleep(400); }
  };
  await openDraft(seamDraft(1));
  await pickStyle('Tally style');
  const TL = await pdfLayout(45);
  const tallyText = await page.locator('#invoice-preview').innerText().catch(() => '');
  check('v73 Tally style prints the HSN/SAC tax summary, the declaration and the seal box',
    /Total Tax Amount/i.test(tallyText) && /Declaration/i.test(tallyText) && /Customer.s Seal and Signature/i.test(tallyText)
      && /Amount Chargeable \(in words\)/i.test(tallyText),
    tallyText ? '' : 'preview had no text');
  {
    const ok = !!(TL && TL.total > TL.fullHeight + 2 && TL.ends.length > 0);
    const cutInto = ok ? TL.ends.filter((e) => TL.atoms.some(([a, b]) => e > a + 1 && e < b - 1)) : [];
    check('v73 Tally style: a 45-item invoice runs onto more pages and no page ends inside a row, block or the signature',
      ok && cutInto.length === 0,
      ok ? `page ends at ${TL.ends.map(Math.round).join(', ')}px${cutInto.length ? ` - CUTS THROUGH at ${cutInto.map(Math.round).join(', ')}` : ''}`
        : `no multi-page PDF: ${JSON.stringify(TL && { total: TL.total, full: TL.fullHeight })}`);
  }
  await pickStyle('Boxed grid');
  await openDraft(seamDraft(1));
  const boxedRows = await page.locator('#invoice-preview table.grid-items tbody tr').count();
  const boxedText = await page.locator('#invoice-preview').innerText().catch(() => '');
  check('v73 Boxed grid fills the item table to a fixed height and prints Grand Total',
    boxedRows >= 8 && /Grand Total/.test(boxedText), `${boxedRows} rows`);
  await pickStyle('Classic');

  // ---- #72: "system-generated, no signature required" note ----------------
  // Driven through Customize, the way a person turns it on. (Options passed in
  // a draft are replaced by the server-saved display options on load.)
  await openDraft({ ...seamDraft(1), details: { invoiceNumber: 'SMOKE-72/1', invoiceDate: today, placeOfSupply: 'Punjab' } });
  const notePos = () => page.evaluate(() => {
    const t = document.querySelector('#invoice-preview')?.innerText || '';
    return { note: t.search(/system-generated invoice/i), terms: t.search(/terms/i) };
  });
  const off72 = await notePos();
  check('#72 the system-generated note is off unless chosen', off72.note === -1, JSON.stringify(off72));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.generator-toolbar button')].find((x) => /^Customize$/.test(x.innerText.trim()));
    if (b) b.click();
  });
  await sleep(1000);
  const box72 = page.locator('label.option-toggle', { hasText: /system-generated invoice/i }).locator('input[type=checkbox]');
  const shownTicked = (await box72.count()) ? await box72.isChecked() : null;
  check('#72 its Customize box shows unticked while the note is off', shownTicked === false, `ticked=${shownTicked}`);
  if (await box72.count()) { await box72.click(); await sleep(1000); }
  const on72 = await notePos();
  check('#72 ticking it prints the note below the Terms & Conditions',
    on72.note !== -1 && on72.terms !== -1 && on72.note > on72.terms, JSON.stringify(on72));
  // Untick it again: display options are saved, and this must not leak.
  if (await box72.count() && await box72.isChecked()) { await box72.click(); await sleep(2500); }

  // ---- v1.10.72 (#73): the Control Panel finds its scripts ---------------------
  // The release ZIP puts them next to server.js in _system/; the server looked
  // only in _system-scripts folders, so every ZIP install reported "Launcher
  // scripts not detected" and Update / Backup failed. Status only: the suite
  // must never actually run an update or a backup.
  const cp = await page.evaluate(async () => (await fetch('/api/control-panel/status')).json());
  check('#73 the Control Panel finds its update and backup scripts',
    cp.controlScriptsAvailable === true && cp.actions?.update === true && cp.actions?.backup === true,
    JSON.stringify({ available: cp.controlScriptsAvailable, actions: cp.actions }));
  if (cp.platform === 'win32') {
    check('#73 on Windows every Control Panel action has its script',
      ['update', 'backup', 'restore', 'move', 'stop'].every((k) => cp.actions?.[k] === true), JSON.stringify(cp.actions));
  }

  // ---- v1.10.71: Generate Now uses the server's full invoice maths ---------
  // It used to do its own simplified maths in the browser (no CGST/SGST/IGST
  // split, interval and end conditions ignored). A delivery challan is used so
  // the suite never takes a tax-invoice number from the real series.
  const gen = await page.evaluate(async () => {
    const prof = await (await fetch('/api/profile')).json();
    await fetch('/api/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: 'smoketest-rec', clientName: 'Smoke Test Client', clientState: prof.state || 'Karnataka',
      frequency: 'monthly', interval: 2, nextDate: '2099-01-01', invoiceType: 'delivery-challan', active: false,
      items: [{ name: 'Smoke recurring item', quantity: 2, rate: 100, taxPercent: 18 }],
      invoiceOptions: { showGST: true },
    }) });
    const r = await fetch('/api/recurring/smoketest-rec/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const out = await r.json();
    const bill = out.invoiceNumber ? (await (await fetch('/api/bills')).json()).find((b) => b.id === out.invoiceNumber) : null;
    const tpl = (await (await fetch('/api/recurring')).json()).find((t) => t.id === 'smoketest-rec');
    return { ok: r.ok, invoiceNumber: out.invoiceNumber, totals: bill?.data?.totals || null, nextDate: tpl?.nextDate, count: tpl?.occurrencesCreated };
  });
  check('v71 Generate Now makes the invoice even for a paused template', gen.ok && !!gen.invoiceNumber, JSON.stringify(gen));
  check('v71 Generate Now works the tax out properly (split into CGST+SGST or IGST)',
    !!gen.totals && Math.abs((gen.totals.cgst || 0) + (gen.totals.sgst || 0) + (gen.totals.igst || 0) - 36) < 0.01, JSON.stringify(gen.totals));
  check('v71 Generate Now honours "every 2 months" and counts the invoice',
    gen.nextDate === '2099-03-01' && gen.count === 1, `${gen.nextDate} / ${gen.count}`);

  // ---- v1.10.71: Bulk PDF on the Dashboard ----------------------------------
  // The button passed its click event where the ticked invoices belonged, so
  // it always said "Could not generate any PDFs".
  if (gen.invoiceNumber) {
    await openView('Dashboard');
    await page.fill('input[placeholder^="Search client, invoice"]', gen.invoiceNumber);
    await sleep(800);
    const row = page.locator('tr', { hasText: gen.invoiceNumber }).first();
    await row.locator('input[type="checkbox"]').check();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
      page.locator('button', { hasText: 'One merged PDF' }).first().click(),
    ]);
    check('v71 One merged PDF downloads a PDF of the ticked invoices', !!dl && /\.pdf$/i.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
    // v1.10.83: one PDF per invoice, in a ZIP.
    const [zipDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
      page.locator('button', { hasText: 'Separate PDFs (ZIP)' }).first().click(),
    ]);
    const zipBytes = zipDl ? readFileSync(await zipDl.path()) : null;
    const pdfName = `${String(gen.invoiceNumber).replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
    check('v83 Separate PDFs downloads a ZIP with the invoice\'s own PDF',
      !!zipBytes && /\.zip$/i.test(zipDl.suggestedFilename()) && zipBytes.includes(Buffer.from(pdfName)), zipDl ? `${zipDl.suggestedFilename()} (looked for ${pdfName})` : 'no download');
    await page.fill('input[placeholder^="Search client, invoice"]', '');
  }

  // ---- v1.10.76: stock follows edits (#80), quotations (#83), refresh while editing
  {
    const get76 = (url) => page.evaluate(async (url) => (await fetch(url)).json(), url);
    const post76 = (url, body) => page.evaluate(async ({ url, body }) => (await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).ok, { url, body });
    const stock76 = async () => (await get76('/api/products')).find((x) => x.id === 'smoketest-pen')?.stock;
    const prof76 = await get76('/api/profile');
    const bill76 = (id, type, q, applied) => ({
      id, invoiceNumber: id, clientName: 'Smoke Test Client', invoiceDate: today, invoiceType: type, status: 'unpaid',
      totalAmount: q * 11.8, paidAmount: 0, payments: [],
      data: { profile: prof76, client: { name: 'Smoke Test Client', state: prof76.state, country: 'India' },
        details: { invoiceNumber: id, invoiceDate: today }, invoiceType: type, invoiceOptions: {}, totals: { total: q * 11.8 },
        items: [{ id: 'l1', productId: 'smoketest-pen', name: 'Smoke Pen', hsn: '9608', quantity: q, rate: 10, taxPercent: 18, discount: 0, unit: 'Pcs' }],
        ...(applied ? { stockApplied: applied } : {}) },
    });
    // Opening it through the saved session is a page refresh while editing,
    // which blanked the whole app before v1.10.76.
    const openForEdit76 = async (bill) => {
      await page.evaluate((bill) => { sessionStorage.setItem('gst_editingBill', JSON.stringify(bill)); sessionStorage.setItem('gst_currentView', 'new'); sessionStorage.removeItem('gst_invoiceDraft'); }, bill);
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(2500);
      await dismissFirstRun(page);
      return page.waitForSelector('#invoice-preview', { timeout: 30000 }).then(() => true).catch(() => false);
    };
    const save76 = async () => { await page.getByRole('button', { name: /^Save$/ }).first().click(); await sleep(3500); };
    const toDashboard76 = async () => {
      await page.evaluate(() => { sessionStorage.removeItem('gst_editingBill'); sessionStorage.setItem('gst_currentView', 'dashboard'); });
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(3000);
      await dismissFirstRun(page);
    };

    await post76('/api/products', { id: 'smoketest-pen', name: 'Smoke Pen', hsn: '9608', rate: 10, taxPercent: 18, unit: 'Pcs', stock: 40 });
    const inv76 = bill76('smoketest-inv76', 'tax-invoice', 10, { 'smoketest-pen': -10 });
    await post76('/api/bills', inv76);
    check('v76 refreshing the page while editing an invoice keeps the app on screen', await openForEdit76(inv76));
    await page.locator('.line-item-field', { has: page.locator('label', { hasText: /^Qty$/ }) }).locator('input').first().fill('15');
    await sleep(500);
    await save76();
    check('v76 #80 editing a quantity 10 -> 15 takes exactly 5 more from stock', (await stock76()) === 35, `stock=${await stock76()}`);
    await save76();
    check('v76 #80 saving again unchanged moves no stock', (await stock76()) === 35, `stock=${await stock76()}`);

    await post76('/api/bills', bill76('smoketest-quo76', 'quotation', 5, {}));
    await toDashboard76();
    const quoRow = () => page.locator('tr', { hasText: 'smoketest-quo76' }).first();
    check('v76 #83 a quotation has no Paid/Unpaid menu', (await quoRow().locator('select.status-select').count()) === 0);
    check('v76 #80 a quotation takes no stock', (await stock76()) === 35, `stock=${await stock76()}`);
    await quoRow().locator('button[title="Convert to Tax Invoice"]').click();
    await sleep(3000);
    await page.waitForSelector('#invoice-preview', { timeout: 30000 });
    await save76();
    const quo76 = (await get76('/api/bills')).find((x) => x.id === 'smoketest-quo76');
    check('v76 #83 a converted quotation is marked and the invoice takes the stock once',
      !!quo76?.convertedTo && (await stock76()) === 30, `convertedTo=${quo76?.convertedTo} stock=${await stock76()}`);
    await toDashboard76();
    check('v76 #83 its Convert button is gone', (await quoRow().locator('button[title="Convert to Tax Invoice"]').count()) === 0);
  }

  // ---- v1.10.77: issues #84-#89 --------------------------------------------
  {
    const get77 = (url) => page.evaluate(async (url) => { const r = await fetch(url); return { status: r.status, json: await r.json().catch(() => null) }; }, url);
    const post77 = (url, body) => page.evaluate(async ({ url, body }) => { const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; }, { url, body });
    const toView77 = async (view) => {
      await page.evaluate((v) => { sessionStorage.removeItem('gst_editingBill'); sessionStorage.removeItem('gst_invoiceDraft'); sessionStorage.setItem('gst_currentView', v); }, view);
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(2500);
      await dismissFirstRun(page);
    };

    // #84 optional PIN lock
    await post77('/api/lock/set', { pin: '13572468' });
    await page.evaluate(() => sessionStorage.removeItem('gst_unlocked'));
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2000);
    const locked = await page.getByText('Enter your PIN').isVisible().catch(() => false);
    const metaRefused = (await get77('/api/meta/appLock')).status === 403;
    await page.getByLabel('8 digit PIN').fill('13572468').catch(() => {});
    await sleep(2500);
    const unlocked = !(await page.getByText('Enter your PIN').count()) && (await page.locator('.sidebar').count()) > 0;
    const off = (await post77('/api/lock/set', { pin: null, currentPin: '13572468' })).status === 200;
    check('v77 #84 PIN lock: asked on open, opens with the right PIN, hash not readable, turns off', locked && unlocked && metaRefused && off,
      JSON.stringify({ locked, unlocked, metaRefused, off }));
    await dismissFirstRun(page);

    // #84 settings are kept in the data folder too, so a browser that loses
    // its storage gets them back (no welcome wizard, same Region and Print).
    const prefs = (await get77('/api/local-prefs')).json?.value || {};
    check('v77 #84 settings are mirrored to the data folder', typeof prefs === 'object' && 'gst_printSettings' in prefs, Object.keys(prefs).join(','));

    // Critical: opening a saved invoice must keep its own terms, even when a
    // terms template exists (it used to be replaced by the first template).
    await post77('/api/templates', { id: 'smoketest-tpl77', name: 'Smoke template', content: '<p>SMOKE-TEMPLATE-TERMS</p>' });
    const prof77 = (await get77('/api/profile')).json;
    const today77 = new Date().toISOString().slice(0, 10);
    const bill77 = {
      id: 'smoketest-terms77', invoiceNumber: 'smoketest-terms77', clientName: 'Smoke Test Client', invoiceDate: today77, invoiceType: 'tax-invoice',
      status: 'unpaid', totalAmount: 1180, paidAmount: 0, payments: [],
      data: { profile: prof77, client: { name: 'Smoke Test Client', state: prof77.state, country: 'India' }, details: { invoiceNumber: 'smoketest-terms77', invoiceDate: today77 },
        invoiceType: 'tax-invoice', invoiceOptions: {}, totals: { total: 1180 }, customTerms: '<p>SMOKE-SAVED-TERMS</p>', stockApplied: {},
        items: [{ id: 'l1', name: 'Smoke item', hsn: '9983', quantity: 1, rate: 1000, taxPercent: 18, discount: 0, unit: 'Nos' }] },
    };
    await post77('/api/bills', bill77);
    await page.evaluate((b) => { sessionStorage.setItem('gst_editingBill', JSON.stringify(b)); sessionStorage.setItem('gst_currentView', 'new'); sessionStorage.removeItem('gst_invoiceDraft'); }, bill77);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(3500);
    await dismissFirstRun(page);
    const termsText = await page.locator('#invoice-preview').innerText().catch(() => '');
    check('v77 opening a saved invoice keeps its own terms (not the first template)',
      termsText.includes('SMOKE-SAVED-TERMS') && !termsText.includes('SMOKE-TEMPLATE-TERMS'));

    // #87 delivery charges
    await toView77('new');
    await page.getByRole('button', { name: /Delivery charges/ }).first().click();
    await sleep(800);
    check('v77 #87 Delivery charges adds a line with SAC 996812',
      (await page.locator('textarea.line-item-name').evaluateAll((els) => els.some((e) => e.value === 'Delivery charges'))) && (await page.locator('input[value="996812"]').count()) > 0);

    // #88 a short invoice is one page in every design
    await openDraft(seamDraft(1));
    await pickStyle('Tally style');
    const T77 = await pdfLayout(1);
    await pickStyle('Boxed grid');
    const B77 = await pdfLayout(1);
    await pickStyle('Classic');
    check('v77 #88 a one-item invoice is one PDF page in Tally style and Boxed grid',
      !!T77?.onePage && !!B77?.onePage, JSON.stringify({ tally: T77?.onePage, boxed: B77?.onePage }));

    // #85 stock report with Excel export
    await toView77('reports');
    await page.getByRole('button', { name: 'Stock', exact: true }).click();
    await sleep(2000);
    let xlsxOk = false;
    try {
      const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: 'Excel' }).first().click()]);
      xlsxOk = /\.xlsx$/.test(d.suggestedFilename());
    } catch { /* judged below */ }
    check('v77 #85 Reports > Stock shows the closing stock value and downloads Excel',
      (await page.getByText('Total stock value').count()) > 0 && xlsxOk);

    // #85 bulk product edit
    await post77('/api/products', { id: 'smoketest-bulk77', name: 'Smoke Bulk Item', hsn: '9608', sellingPrice: 10, rate: 10, taxPercent: 18, unit: 'Nos', stock: 7 });
    await toView77('inventory');
    await page.getByRole('button', { name: 'Bulk edit' }).click();
    await sleep(800);
    await page.getByLabel('Selling price of Smoke Bulk Item').fill('12.5');
    await page.getByRole('button', { name: /Save changes \(1\)/ }).click();
    await sleep(2500);
    const bulk77 = (await get77('/api/products')).json.find((x) => x.id === 'smoketest-bulk77');
    check('v77 #85 Bulk edit saves the changed price (and rate) and leaves stock alone',
      bulk77?.sellingPrice === 12.5 && bulk77?.rate === 12.5 && bulk77?.stock === 7, JSON.stringify(bulk77 && { s: bulk77.sellingPrice, r: bulk77.rate, st: bulk77.stock }));
  }

  // ---- v1.10.78: issues #92, #93 -------------------------------------------
  {
    const get78 = (url) => page.evaluate(async (url) => (await fetch(url)).json(), url);
    const post78 = (url, body) => page.evaluate(async ({ url, body }) => (await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json().catch(() => null), { url, body });
    const toView78 = async (view) => {
      await page.evaluate((v) => { sessionStorage.removeItem('gst_editingBill'); sessionStorage.removeItem('gst_invoiceDraft'); sessionStorage.setItem('gst_currentView', v); }, view);
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(2500);
      await dismissFirstRun(page);
    };

    // #93 "Start numbering from": a tax invoice saved through the editor gets
    // it (it used to show it and save 0001); a quotation keeps its own count.
    const numSettings = (await get78('/api/meta/invoiceNumberSettings')).value;
    const counterBefore = (await get78('/api/meta/counter_INV')).value;
    await post78('/api/meta/invoiceNumberSettings', { value: { ...(numSettings || {}), format: 'branded', startNumber: 900001 } });
    const draft78 = (type) => ({
      invoiceType: type,
      client: { name: 'Smoke Test Client', address: '', city: '', pin: '', state: 'Punjab', gstin: '', country: 'India', email: '', phone: '', isSEZ: false },
      details: { invoiceDate: new Date().toISOString().slice(0, 10), placeOfSupply: 'Punjab' },
      items: draftItems, taxInclusive: false,
    });
    await openDraft(draft78('quotation'));
    const quoShown = await page.locator('#invoice-preview').innerText().catch(() => '');
    await toView78('new'); // a blank new tax invoice shows the next number
    await page.waitForSelector('#invoice-preview', { timeout: 20000 });
    await sleep(1500);
    const invShown = await page.locator('#invoice-preview').innerText().catch(() => '');
    await openDraft(draft78('tax-invoice'));
    await page.getByRole('button', { name: /^Save$/ }).first().click();
    await sleep(3500);
    const saved78 = (await get78('/api/bills')).filter((x) => x.clientName === 'Smoke Test Client' && /\/900001$/.test(x.id));
    check('v78 #93 Start numbering from: a tax invoice is shown and saved as 900001; a quotation is not',
      /\/900001\b/.test(invShown) && saved78.length === 1 && !/900001/.test(quoShown),
      JSON.stringify({ shown: /\/900001\b/.test(invShown), saved: saved78.map((x) => x.id), quotationUsesIt: /900001/.test(quoShown) }));
    await post78('/api/meta/counter_INV', { value: counterBefore });
    await post78('/api/meta/invoiceNumberSettings', { value: numSettings });

    // #92 Undo is a button in the Actions column and asks first
    const prof78 = await get78('/api/profile');
    const today78 = new Date().toISOString().slice(0, 10);
    await post78('/api/bills', {
      id: 'smoketest-undo78', invoiceNumber: 'smoketest-undo78', clientName: 'Smoke Test Client', invoiceDate: today78, invoiceType: 'tax-invoice',
      status: 'cancelled', cancelledAt: new Date().toISOString(), totalAmount: 1180, paidAmount: 0, payments: [],
      data: { profile: prof78, client: { name: 'Smoke Test Client', state: prof78.state, country: 'India' }, details: { invoiceNumber: 'smoketest-undo78', invoiceDate: today78 },
        invoiceType: 'tax-invoice', invoiceOptions: {}, totals: { total: 1180 }, stockApplied: {},
        items: [{ id: 'l1', name: 'Smoke item', hsn: '9983', quantity: 1, rate: 1000, taxPercent: 18, discount: 0, unit: 'Nos' }] },
    });
    await toView78('dashboard');
    await openFolder('Cancelled');
    const undoRow = page.locator('tr', { hasText: 'smoketest-undo78' }).first();
    await undoRow.locator('button[title="Undo cancel"]').click();
    await sleep(700);
    const asked = await page.getByRole('button', { name: 'Yes, undo' }).count();
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await sleep(1000);
    const afterNo = (await get78('/api/bills')).find((x) => x.id === 'smoketest-undo78')?.status;
    await undoRow.locator('button[title="Undo cancel"]').click();
    await sleep(700);
    await page.getByRole('button', { name: 'Yes, undo' }).click();
    await sleep(2500);
    const afterYes = (await get78('/api/bills')).find((x) => x.id === 'smoketest-undo78')?.status;
    check('v78 #92 Undo cancel is in the Actions column, asks Yes/No, and only Yes brings it back',
      asked === 1 && afterNo === 'cancelled' && afterYes === 'unpaid', JSON.stringify({ asked, afterNo, afterYes }));
  }

  // ---- v1.10.79: issues #94, #95, #96 --------------------------------------
  {
    const get79 = (url) => page.evaluate(async (url) => (await fetch(url)).json(), url);
    const post79 = (url, body) => page.evaluate(async ({ url, body }) => (await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json().catch(() => null), { url, body });
    const toNew79 = async () => {
      await page.evaluate(() => { sessionStorage.removeItem('gst_editingBill'); sessionStorage.removeItem('gst_invoiceDraft'); sessionStorage.setItem('gst_currentView', 'new'); });
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(1500);
      await dismissFirstRun(page);
      // 7 Nov: up to 10 s for the number (a fixed 3 s read it too early on a
      // fresh install once); the number shown is reported if the check fails.
      let text = '';
      for (let i = 0; i < 20; i++) {
        text = await page.locator('#invoice-preview').innerText().catch(() => '');
        if (/[A-Z][A-Z-]*\/[\d-]+\/\d+/.test(text)) break;
        await sleep(500);
      }
      return text;
    };
    const profile79 = await get79('/api/profile');
    const shared79 = (await get79('/api/meta/invoiceNumberSettings')).value;
    const series79 = (await get79('/api/meta/invoiceNumberSeries')).value;

    // #95 a second business with its own numbering: the screen shows its own
    // next number (it used to show the shared series'), saving takes it.
    const other79 = { businessName: 'Smoke Second Firm', state: 'Maharashtra', country: 'India', gstin: '27AAPFS9999Q1Z1' };
    await post79('/api/meta/invoiceNumberSeries', { value: { ...(series79 || {}), '27AAPFS9999Q1Z1': { brandPrefix: 'SMKB', startNumber: 502 } } });
    await post79('/api/profile', other79);
    const own79 = await toNew79();
    await post79('/api/profile', profile79);
    const shared79Shown = await toNew79();
    check('v79 #95 a business with its own numbering shows and numbers in its own series',
      /SMKB\/[\d-]*\/?0502\b|SMKB\/0502\b/.test(own79) && !/SMKB/.test(shared79Shown),
      JSON.stringify({ own: (own79.match(/SMKB[^\s]*/) || own79.match(/[A-Z][A-Z-]*\/[\d-]+\/\d+/) || ['-'])[0], shared: (shared79Shown.match(/[A-Z-]+\/[\d-]+\/\d+/) || ['-'])[0] }));
    await post79('/api/meta/invoiceNumberSeries', { value: series79 || {} });
    await post79('/api/meta/' + encodeURIComponent('counter_INV@27AAPFS9999Q1Z1'), { value: null });

    // Brand prefix: other types are brand-TYPE, so they never collide with invoices
    await post79('/api/meta/invoiceNumberSettings', { value: { ...(shared79 || {}), brandPrefix: 'SMKA' } });
    await page.evaluate(() => {
      sessionStorage.setItem('gst_invoiceDraft', JSON.stringify({ invoiceType: 'quotation', client: { name: 'Smoke Test Client', state: 'Punjab', country: 'India' },
        details: { invoiceDate: new Date().toISOString().slice(0, 10), placeOfSupply: 'Punjab' },
        items: [{ id: 'l1', name: 'Smoke item', hsn: '9983', quantity: 1, rate: 1000, taxPercent: 18, discount: 0, unit: 'Nos' }] }));
      sessionStorage.setItem('gst_currentView', 'new'); sessionStorage.removeItem('gst_editingBill');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(3000);
    await dismissFirstRun(page);
    await page.getByRole('button', { name: /^Save$/ }).first().click();
    await sleep(3500);
    const quo79 = (await get79('/api/bills')).filter((x) => x.clientName === 'Smoke Test Client' && x.invoiceType === 'quotation').map((x) => x.id);
    check('v79 brand prefix: a quotation is numbered SMKA-QUO/..., apart from SMKA/... invoices', quo79.some((id) => /^SMKA-QUO\//.test(id)), quo79.join(','));
    await post79('/api/meta/invoiceNumberSettings', { value: shared79 });

    // #94 the saved PDF of a cancelled invoice is stamped, and Undo restores it
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const bytes = await pdf.save();
    const name79 = 'INV_smoketest-pdf79.pdf';
    const savedPdf = await page.evaluate(async ({ b, name }) => (await fetch(`/api/save-pdf?name=${encodeURIComponent(name)}&client=Smoke%20Test%20Client&month=Smoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: new Uint8Array(b) })).json(), { b: [...bytes], name: name79 });
    const stamp79 = await post79('/api/saved-pdf/cancel-mark', { fileName: name79, clientName: 'Smoke Test Client', cancelled: true });
    const again79 = await post79('/api/saved-pdf/cancel-mark', { fileName: name79, clientName: 'Smoke Test Client', cancelled: true });
    const undo79 = await post79('/api/saved-pdf/cancel-mark', { fileName: name79, clientName: 'Smoke Test Client', cancelled: false });
    const undoAgain79 = await post79('/api/saved-pdf/cancel-mark', { fileName: name79, clientName: 'Smoke Test Client', cancelled: false });
    check('v79 #94 a saved PDF is stamped CANCELLED (once, however often) and Undo restores it',
      savedPdf?.saved && stamp79?.updated === 1 && again79?.updated === 1 && undo79?.updated === 1 && undoAgain79?.updated === 0,
      JSON.stringify({ stamp: stamp79, undo: undo79, undoAgain: undoAgain79 }));
    await post79('/api/trash-pdf', { fileName: name79, clientName: 'Smoke Test Client' });

    // A renamed business keeps its own numbering
    await post79('/api/meta/invoiceNumberSeries', { value: { ...(series79 || {}), 'NAME:smoke old name': { brandPrefix: 'SMKR' } } });
    await post79('/api/meta/' + encodeURIComponent('counter_INV@NAME:smoke old name'), { value: 41 });
    const moved79 = await post79('/api/number-series/rename', { from: 'NAME:smoke old name', to: '27AAPFR9999Q1Z1' });
    const map79 = (await get79('/api/meta/invoiceNumberSeries')).value || {};
    const ctr79 = (await get79('/api/meta/' + encodeURIComponent('counter_INV@27AAPFR9999Q1Z1'))).value;
    check('v79 #95 a business saved under a new GSTIN keeps its own numbering and count',
      moved79?.moved && map79['27AAPFR9999Q1Z1']?.brandPrefix === 'SMKR' && !map79['NAME:smoke old name'] && ctr79 === 41,
      JSON.stringify({ moved79, ctr79 }));
    await post79('/api/meta/invoiceNumberSeries', { value: series79 || {} });
    await post79('/api/meta/' + encodeURIComponent('counter_INV@27AAPFR9999Q1Z1'), { value: null });

    // Converting two quotations in a row makes two invoices (the second used
    // to overwrite the first: a conversion saved under a number it only peeked).
    const quoteOf79 = (id) => ({
      id, invoiceNumber: id, clientName: 'Smoke Test Client', invoiceDate: new Date().toISOString().slice(0, 10), invoiceType: 'quotation',
      status: 'unpaid', totalAmount: 1180, paidAmount: 0, payments: [],
      data: { profile: profile79, client: { name: 'Smoke Test Client', state: profile79.state, country: 'India' }, details: { invoiceNumber: id, invoiceDate: new Date().toISOString().slice(0, 10) },
        invoiceType: 'quotation', invoiceOptions: {}, totals: { total: 1180 }, stockApplied: {},
        items: [{ id: 'l1', name: 'Smoke item', hsn: '9983', quantity: 1, rate: 1000, taxPercent: 18, discount: 0, unit: 'Nos' }] },
    });
    const before79 = (await get79('/api/bills')).filter((x) => x.clientName === 'Smoke Test Client' && x.invoiceType === 'tax-invoice').map((x) => x.id);
    for (const qid of ['smoketest-conv79a', 'smoketest-conv79b']) {
      const q = quoteOf79(qid);
      await post79('/api/bills', q);
      await page.evaluate((bill) => {
        sessionStorage.setItem('gst_editingBill', JSON.stringify({ ...bill, _isDuplicate: true, _convertToType: 'tax-invoice' }));
        sessionStorage.setItem('gst_currentView', 'new'); sessionStorage.removeItem('gst_invoiceDraft');
      }, q);
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(1500);
      await dismissFirstRun(page);
      // Wait for the result, not a fixed time: under the release gate a busy
      // machine sometimes needed longer than 3.5 s, and the check failed
      // although both invoices were made (31 Oct 2026).
      const save79 = page.getByRole('button', { name: /^Save$/ }).first();
      await save79.waitFor({ state: 'visible', timeout: 30000 });
      const count79 = async () => (await get79('/api/bills')).filter((x) => x.clientName === 'Smoke Test Client' && x.invoiceType === 'tax-invoice').length;
      const had79 = await count79();
      await save79.click();
      for (let i = 0; i < 60 && (await count79()) === had79; i++) await sleep(250);
    }
    const after79 = (await get79('/api/bills')).filter((x) => x.clientName === 'Smoke Test Client' && x.invoiceType === 'tax-invoice').map((x) => x.id);
    const made79 = after79.filter((id) => !before79.includes(id));
    check('v79 converting two quotations in a row makes two invoices, neither overwritten', made79.length === 2, made79.join(', '));
    for (const id of made79) await page.evaluate(async (id) => fetch('/api/bills/' + encodeURIComponent(id), { method: 'DELETE' }), id);
  }

  // ---- v1.10.80: Support page payment note names the business ------------
  {
    const prof80 = await page.evaluate(async () => (await fetch('/api/profile')).json());
    await page.evaluate(() => { sessionStorage.removeItem('gst_editingBill'); sessionStorage.removeItem('gst_invoiceDraft'); sessionStorage.setItem('gst_currentView', 'support'); });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2500);
    await dismissFirstRun(page);
    const noteText = await page.getByText(/^Payment note:/).first().innerText().catch(() => '');
    const expected = ('Free GST Billing support - ' + String(prof80.businessName || '').replace(/[^A-Za-z0-9 .-]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 50).trim();
    check('v80 the UPI payment note names the business', !!prof80.businessName && noteText.includes(expected), noteText);
  }

  // ---- v1.10.84 (#177): tick products and delete them in one go -----------
  {
    // Two products the search shows, one it hides: only the shown ones go.
    await page.evaluate(async () => {
      const add = (id, name) => fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name, rate: 10, taxPercent: 18, unit: 'Nos' }) });
      await add('smoketest-tick-1', 'Smoke Tick 1');
      await add('smoketest-tick-2', 'Smoke Tick 2');
      await add('smoketest-tick-keep', 'Smoke Keep Me');
      sessionStorage.setItem('gst_currentView', 'inventory');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2500);
    await dismissFirstRun(page);
    await page.locator('input[placeholder="Search by name or HSN..."]').fill('Smoke Tick');
    await page.locator('input[aria-label="Select Smoke Tick 2"]').waitFor({ timeout: 10000 });
    // The search has filtered the list: the product it hides is gone from it.
    await page.locator('input[aria-label="Select Smoke Keep Me"]').waitFor({ state: 'detached', timeout: 10000 });
    await page.getByLabel('Select all products shown').check();
    const barText = await page.getByText(/^\d+ selected$/).first().innerText({ timeout: 5000 }).catch(() => '');
    await page.getByRole('button', { name: /Delete selected/ }).click();
    await sleep(500);
    await page.getByRole('button', { name: /^Delete$/ }).last().click();
    await sleep(1500);
    const ids = await page.evaluate(async () => (await (await fetch('/api/products')).json()).map((p) => String(p.id)).filter((id) => id.startsWith('smoketest-tick-')));
    check('#177 select all + Delete selected removes the products the list shows, and only those', barText === '2 selected' && ids.join() === 'smoketest-tick-keep', `bar="${barText}" left=${ids.join() || 'none'}`);
  }

  // ---- v1.10.84 (maintainer: "this window should never come"): with the
  // server not answering, the Windows Setup's own window (WebView2:
  // window.chrome.webview) shows "Starting again..." - never the Quick Start
  // instructions, which a browser still gets.
  {
    const seen = {};
    for (const [label, asWindow] of [['window', true], ['browser', false]]) {
      const c = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      if (asWindow) await c.addInitScript(() => { window.chrome = window.chrome || {}; window.chrome.webview = {}; });
      const p = await c.newPage();
      await p.route('**/api/profile', (r) => r.abort());
      try {
        await p.goto(APP, { waitUntil: 'load' });
        await p.waitForTimeout(3000);
        const text = await p.locator('body').innerText().catch(() => '');
        seen[label] = { starting: /Starting again/.test(text), quickStart: /Needs a Quick Start/.test(text) };
      } finally { await c.close(); }
    }
    check('v84 the app window never shows "Needs a Quick Start" (it shows Starting again); a browser still gets the help',
      seen.window?.starting && !seen.window?.quickStart && seen.browser?.quickStart && !seen.browser?.starting, JSON.stringify(seen));
  }

  // Put the real business details back.
  await page.evaluate(async (prof) => {
    await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prof),
    });
  }, originalProfile);

  await cleanup(page);
} catch (err) {
  // Report enough to act on. A bare "Timeout 30000ms exceeded" says nothing
  // about WHICH element was being waited for, turning a two-minute fix into
  // a guessing game.
  const detail = err.message.split('\n').filter((l) => l.trim()).slice(0, 4).join(' | ');
  check('suite ran to completion', false, detail);
  // A screenshot of the moment it stopped, when asked for: a timeout says
  // what was awaited, not what was on screen instead (a dialog in the way?).
  if (process.env.SMOKE_FAIL_SHOT) {
    try { await page.screenshot({ path: process.env.SMOKE_FAIL_SHOT, fullPage: true }); } catch { /* best effort */ }
  }
  try { await cleanup(page); } catch { /* ignore */ }
} finally {
  if (profileAtStart) {
    await fetch(`${APP}/api/profile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileAtStart),
    }).catch(() => {});
  }
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
