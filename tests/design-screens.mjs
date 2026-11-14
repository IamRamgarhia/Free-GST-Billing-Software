// The screens the design check opens (tests/design-check.mjs), in order, and
// its allowlist. Each `go` gets there from wherever the last one left off.
import { setTimeout as sleep } from 'timers/promises';

// Kept small on purpose: every entry is a place the rules do not look, so
// each says why it is intended. Empty today: every case found was fixed in
// the app. Built in (tests/design-rules.js): the printed invoice sheet, table
// cells, and things that float on purpose (badges, menus, sticky bars).
export const ALLOW = {
  // Never checked.
  skip: [],
  // Boxes inside one of these may touch each other: they are drawn as one joined control.
  joined: [],
  // Covered in every screenshot: changes by day or machine, not by design.
  mask: [],
};

const closeDialogs = async (page) => {
  for (let i = 0; i < 3 && await page.locator('.modal-overlay').count(); i += 1) {
    await page.keyboard.press('Escape');
    await sleep(300);
  }
};

const openView = async (page, label) => {
  await closeDialogs(page);
  const found = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('.sidebar .nav-btn')].find((x) => x.innerText.trim().replace(/\s+/g, ' ') === label);
    if (b) b.click();
    return !!b;
  }, label);
  if (!found) throw new Error(`no "${label}" in the menu`);
  await sleep(600);
};

const clickText = async (page, selector, text) => {
  await page.locator(selector, { hasText: text }).first().click();
  await sleep(500);
};

const view = (name, label, extra = {}) => ({ name, go: (page) => openView(page, label), ...extra });

export const SCREENS = [
  view('dashboard', 'Dashboard'),
  { name: 'dashboard-cancelled', focus: '.invoice-folders', go: (page) => clickText(page, '.invoice-folders button', 'Cancelled') },
  { name: 'dashboard-trash', focus: '.invoice-folders', go: (page) => clickText(page, '.invoice-folders button', 'Trash') },
  {
    name: 'new-invoice',
    go: async (page) => {
      await openView(page, 'New Invoice');
      await page.waitForSelector('.line-item-row');
      await page.locator('input[placeholder="Type client name to search or add new"]').fill('Sharma Electronics');
      await sleep(400);
      await page.keyboard.press('Escape');
      const row = page.locator('.line-item-row').first();
      await row.locator('textarea.line-item-name').first().fill('Laptop stand');
      await sleep(300);
      await page.keyboard.press('Escape');
      const nums = row.locator('input[type="number"]');
      await nums.nth(0).fill('2');
      await nums.nth(1).fill('1800');
      await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
      await sleep(400);
    },
  },
  {
    name: 'new-invoice-customize',
    go: async (page) => {
      // v1.10.86 - Customize is in the Document type card (it was in the toolbar).
      await page.locator('[data-inv-card="type"] button', { hasText: /Customize/ }).first().click();
      await sleep(500);
    },
  },
  view('clients', 'Clients'),
  {
    name: 'client-account',
    go: async (page) => {
      await page.locator('.client-card-header', { hasText: 'Sharma Electronics' }).first().click();
      await page.getByRole('button', { name: /Statement PDF/ }).waitFor({ timeout: 8000 });
    },
  },
  view('products', 'Products'),
  { name: 'product-form', go: (page) => clickText(page, 'button', /^\s*Add Product\s*$/) },
  view('purchases', 'Purchases'),
  { name: 'purchase-form', go: (page) => clickText(page, 'button', /^\s*Add Purchase( Bill)?\s*$/) },
  view('expenses', 'Expenses'),
  view('receipts', 'Receipts'),
  view('cashbook', 'Cash book'),
  view('reports', 'Reports'),
  view('gst-gstr1', 'GST Returns'),
  { name: 'gst-gstr3b', go: (page) => clickText(page, 'button.btn', /^\s*GSTR-3B\s*$/) },
  { name: 'gst-gstr2b', go: (page) => clickText(page, 'button.btn', /GSTR-2B Reconciliation/) },
  { name: 'gst-tds', go: (page) => clickText(page, 'button.btn', /TDS \/ TCS Report/) },
  { name: 'gst-guide', go: (page) => clickText(page, 'button.btn', /Filing Guide/) },
  view('income-tax', 'Income Tax'),
  view('recurring', 'Recurring'),
  view('settings-company', 'Settings'),
  ...['print', 'features', 'privacy', 'data', 'updates'].map((t) => ({
    name: `settings-${t}`,
    go: async (page) => { await page.locator(`a[href="#tab-${t}"]`).first().click(); await sleep(500); },
  })),
  // v1.10.86 - the Control Panel moved into Settings: settings-updates (App & updates) and settings-data show it.
  view('support', 'Support & About'),
  {
    name: 'phone-pairing',
    widths: [1366], // phones have no pair-a-phone button (index.css, max-width 480px)
    go: async (page) => {
      await openView(page, 'Dashboard');
      await page.locator('.topbar-phone:visible').first().click();
      await sleep(800);
    },
  },
];
