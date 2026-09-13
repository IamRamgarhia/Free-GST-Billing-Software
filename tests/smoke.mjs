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
