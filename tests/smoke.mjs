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
      await del('profiles');
      await del('expenses');
      await del('receipts');
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
const page = await ctx.newPage();

const cspViolations = [];
page.on('console', (m) => { if (/Content-Security-Policy/i.test(m.text())) cspViolations.push(m.text()); });

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
  await dismissFirstRun(page);

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

  // Fill a REAL invoice. Since #47, saving or printing a blank one is
  // refused on purpose, so the PDF check below needs a client and a priced
  // line item — the same minimum a user has to provide.
  await page.locator('input[placeholder="Type client name to search or add new"]')
    .fill('Smoke Test Client');
  await sleep(500);
  await page.keyboard.press('Escape');           // dismiss the client suggestion list
  // The line-item name box carries no placeholder, so target it through its
  // row: `.line-item-row` -> first text input, then the row's numeric fields.
  const row = page.locator('.line-item-row').first();
  await row.locator('input[type="text"]').first().fill('Test item');
  await sleep(400);
  await page.keyboard.press('Escape');           // dismiss product suggestions
  const rowNums = row.locator('input[type="number"]');
  await rowNums.nth(0).fill('2');                // qty
  await rowNums.nth(1).fill('500');              // rate
  await sleep(800);

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

  check('no CSP violations during PDF generation', cspViolations.length === 0,
    cspViolations[0]?.slice(0, 90) || '');

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
  const nameField = page.locator('#section-company input[name="businessName"]');
  const originalName = await nameField.inputValue();
  await nameField.fill(`Smoke Test ${Date.now()}`);
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
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('SMOKE-CANCEL/9'));
    const btn = row && [...row.querySelectorAll('button')].find((b) => /Cancel invoice/i.test(b.title || ''));
    if (btn) btn.click();
  });
  await sleep(900);
  const confirmCancel = page.getByRole('button', { name: /^Cancel invoice$/ });
  if (await confirmCancel.count()) await confirmCancel.first().click();
  await sleep(2500);
  const afterCancel = await salesCards();
  const cancelledRow = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('SMOKE-CANCEL/9'));
    if (!row) return null;
    const status = row.querySelector('select.status-select');
    return { listed: true, status: status ? status.value : null };
  });
  check('#66 a cancelled invoice drops out of the sales totals',
    close(afterCancel.total, beforeCancel.total - 5000) && afterCancel.count === beforeCancel.count - 1,
    `total ${beforeCancel.total} -> ${afterCancel.total}`);
  check('#66 the cancelled invoice is still listed, marked Cancelled',
    cancelledRow?.listed === true && cancelledRow.status === 'cancelled', JSON.stringify(cancelledRow));
  const cancelledStatus = await page.evaluate(async () =>
    (await (await fetch('/api/bills')).json()).find((b) => b.id === 'smoketest-cancel')?.status ?? null);
  check('#66 the invoice itself is kept, not deleted', cancelledStatus === 'cancelled', `status=${cancelledStatus}`);

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
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim() === label);
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

  // ---- #66 item 9: Settings always shows one Save at the top -------------
  await openView('Settings');
  await sleep(2000);
  const saveBar = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Save Profile/i.test(b.innerText));
    if (!btn) return null;
    const bar = btn.closest('div[style*="sticky"]');
    return { hasButton: true, sticky: !!bar, top: bar ? Math.round(bar.getBoundingClientRect().top) : null };
  });
  check('#66 Settings keeps one Save button pinned at the top',
    !!saveBar?.hasButton && !!saveBar?.sticky && saveBar.top < 200, JSON.stringify(saveBar));

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
