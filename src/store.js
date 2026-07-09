// File-based storage via local Express API server
// All data persists as JSON files in the ./data/ folder

const API = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    // Preserve server-provided error message (used e.g. for 409 duplicate
    // invoice number). Attach status so callers can branch on it.
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON body */ }
    const err = new Error(body?.error || `API error: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ---- Invoice Number Settings ----
const DEFAULT_INV_SETTINGS = {
  format: 'branded',      // 'branded' | 'sequential' | 'random'
  brandPrefix: '',         // e.g. 'ACME' — empty means use type prefix (INV/EST/CN/BOS)
  separator: '/',          // '/' | '-' | '#'
  showFinYear: true,       // include 2026-27 financial year
  startNumber: 1,          // starting counter value
  padDigits: 4,            // zero-pad to this many digits
};

export const getInvoiceNumberSettings = async () => {
  const { value } = await apiFetch(`${API}/meta/invoiceNumberSettings`);
  return { ...DEFAULT_INV_SETTINGS, ...(value || {}) };
};

export const saveInvoiceNumberSettings = async (settings) => {
  await apiFetch(`${API}/meta/invoiceNumberSettings`, {
    method: 'POST',
    body: JSON.stringify({ value: settings }),
  });
};

// ---- Stock-alert Settings ----
// Master on/off for the low-stock alert + the threshold below which a product
// counts as "low". Stored at app level (not per-business profile) because the
// alerting behaviour is a UX preference, not a business rule.
const DEFAULT_STOCK_ALERT_SETTINGS = {
  enabled: true,
  threshold: 5,    // products with `stock <= threshold` are flagged
};

export const getStockAlertSettings = async () => {
  const { value } = await apiFetch(`${API}/meta/stockAlertSettings`);
  return { ...DEFAULT_STOCK_ALERT_SETTINGS, ...(value || {}) };
};

export const saveStockAlertSettings = async (settings) => {
  await apiFetch(`${API}/meta/stockAlertSettings`, {
    method: 'POST',
    body: JSON.stringify({ value: settings }),
  });
};

// ---- Invoice Display Options (checkboxes like showGST, showLogo etc.) ----
export const getInvoiceDisplayOptions = async () => {
  const { value } = await apiFetch(`${API}/meta/invoiceDisplayOptions`);
  return value || null;
};

export const saveInvoiceDisplayOptions = async (options) => {
  await apiFetch(`${API}/meta/invoiceDisplayOptions`, {
    method: 'POST',
    body: JSON.stringify({ value: options }),
  });
};

// ---- Region preference: 'india' | 'international' | 'both' (default 'both') ----
// Drives which countries appear in pickers and whether GST-only flows show up in the UI.
// Stored in localStorage for instant boot — server copy is async-best-effort.
const REGION_KEY = 'gst_regionMode';
export const getRegionMode = () => {
  try { return localStorage.getItem(REGION_KEY) || 'both'; } catch { return 'both'; }
};
export const setRegionMode = (mode) => {
  if (!['india', 'international', 'both'].includes(mode)) return;
  try { localStorage.setItem(REGION_KEY, mode); } catch { /* ignore */ }
  apiFetch(`${API}/meta/regionMode`, { method: 'POST', body: JSON.stringify({ value: mode }) }).catch(() => {});
};

// ---- Enabled feature modules ----
// Map of moduleId → bool. Missing keys fall back to the module's default.
// Stored locally for instant boot; mirrored to server for backup/import.
const MODULES_KEY = 'gst_enabledModules';
export const getEnabledModules = () => {
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};
export const setEnabledModules = (map) => {
  try { localStorage.setItem(MODULES_KEY, JSON.stringify(map || {})); } catch { /* ignore */ }
  apiFetch(`${API}/meta/enabledModules`, { method: 'POST', body: JSON.stringify({ value: map || {} }) }).catch(() => {});
};

// ---- Invoice counter ----
// Uses the atomic /meta/:key/increment endpoint so two concurrent saves can't both
// read 5 and both write 6 (= duplicate invoice numbers, which is a GST audit failure).
//
// Since v1.6.8: pass { peek: true } to preview the number WITHOUT reserving it.
// Used by InvoiceGenerator to show the next number on form mount — the atomic
// reservation happens only when the user actually saves. Cancelled forms no
// longer burn counter values, so CA-audited businesses keep gapless sequences.
export const getNextInvoiceNumber = async (prefix = 'INV', { peek = false, explicitPrefix = false } = {}) => {
  const settings = await getInvoiceNumberSettings();
  const key = `counter_${prefix}`;
  let next;
  if (peek) {
    const { value: current } = await apiFetch(`${API}/meta/${key}`);
    const currentNum = Number(current) || (settings.startNumber || 1) - 1;
    next = currentNum + 1;
  } else {
    const inc = await apiFetch(`${API}/meta/${key}/increment`, { method: 'POST', body: JSON.stringify({}) });
    next = inc.value;
  }

  // v1.10.10 — When `explicitPrefix` is true, the caller (per-type
  // prefix override from Print Settings) wants THEIR prefix used as-is
  // instead of the global brandPrefix from Invoice Number Settings.
  // Prior code always let brandPrefix win, so setting "Tax Invoice
  // prefix = RPT" was silently ignored because brandPrefix = 'DICECODES'.
  const pfx = explicitPrefix ? prefix : (settings.brandPrefix || prefix);

  if (settings.format === 'random') {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${pfx}${settings.separator}${rand}`;
  }

  const sep = settings.separator || '/';
  const padded = String(next).padStart(settings.padDigits || 4, '0');

  if (settings.showFinYear) {
    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    return `${pfx}${sep}${currentYear}-${nextYear}${sep}${padded}`;
  }

  return `${pfx}${sep}${padded}`;
};

// ---- Bills ----
// Pass overwrite: true when the caller knows they're updating an existing
// bill (edit flow, bulk-status change, auto-fire re-process). Default is
// to refuse silent overwrites — server returns 409 with an actionable
// message that the UI can show as "Invoice number already exists".
export const saveBill = async (bill, { overwrite = false } = {}) => {
  const qs = overwrite ? '?overwrite=1' : '';
  return apiFetch(`${API}/bills${qs}`, { method: 'POST', body: JSON.stringify(bill) });
};

export const getAllBills = async () => {
  return apiFetch(`${API}/bills`);
};

export const deleteBill = async (id) => {
  return apiFetch(`${API}/bills/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// v1.9.5 — Automatic backups + trash bin
export const getBackupsList = async () => apiFetch(`${API}/backups`);
export const restoreBackup = async (date) => apiFetch(`${API}/backups/${encodeURIComponent(date)}/restore`, { method: 'POST', body: JSON.stringify({}) });
export const triggerBackup = async () => apiFetch(`${API}/backups/now`, { method: 'POST', body: JSON.stringify({}) });

export const getTrashedBills = async () => apiFetch(`${API}/trash`);
export const restoreTrashedBill = async (id) => apiFetch(`${API}/trash/${encodeURIComponent(id)}/restore`, { method: 'POST', body: JSON.stringify({}) });
export const purgeTrashedBill = async (id) => apiFetch(`${API}/trash/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Profile ----
export const saveProfile = async (profile) => {
  return apiFetch(`${API}/profile`, { method: 'POST', body: JSON.stringify(profile) });
};

export const getProfile = async () => {
  return apiFetch(`${API}/profile`);
};

// ---- Saved Clients ----
export const saveClient = async (client) => {
  const res = await apiFetch(`${API}/clients`, { method: 'POST', body: JSON.stringify(client) });
  if (res.id) client.id = res.id;
  return client;
};

export const getAllClients = async () => {
  return apiFetch(`${API}/clients`);
};

export const deleteClient = async (id) => {
  return apiFetch(`${API}/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Terms Templates ----
export const getTermsTemplates = async () => {
  return apiFetch(`${API}/templates`);
};

export const saveTermsTemplate = async (template) => {
  const res = await apiFetch(`${API}/templates`, { method: 'POST', body: JSON.stringify(template) });
  if (res.id) template.id = res.id;
  return template;
};

export const deleteTermsTemplate = async (id) => {
  return apiFetch(`${API}/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Products / Inventory ----
export const getAllProducts = async () => {
  return apiFetch(`${API}/products`);
};

export const saveProduct = async (product) => {
  const res = await apiFetch(`${API}/products`, { method: 'POST', body: JSON.stringify(product) });
  if (res.id) product.id = res.id;
  return product;
};

export const deleteProduct = async (id) => {
  return apiFetch(`${API}/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Expenses ----
export const getAllExpenses = async () => {
  return apiFetch(`${API}/expenses`);
};

export const saveExpense = async (expense) => {
  const res = await apiFetch(`${API}/expenses`, { method: 'POST', body: JSON.stringify(expense) });
  if (res.id) expense.id = res.id;
  return expense;
};

export const deleteExpense = async (id) => {
  return apiFetch(`${API}/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Purchases (Purchase Bills for ITC) ----
export const getAllPurchases = async () => {
  return apiFetch(`${API}/purchases`);
};

export const savePurchase = async (purchase) => {
  const res = await apiFetch(`${API}/purchases`, { method: 'POST', body: JSON.stringify(purchase) });
  if (res.id) purchase.id = res.id;
  return purchase;
};

export const deletePurchase = async (id) => {
  return apiFetch(`${API}/purchases/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Recurring Invoices ----
export const getAllRecurring = async () => {
  return apiFetch(`${API}/recurring`);
};

export const saveRecurring = async (item) => {
  const res = await apiFetch(`${API}/recurring`, { method: 'POST', body: JSON.stringify(item) });
  if (res.id) item.id = res.id;
  return item;
};

export const deleteRecurring = async (id) => {
  return apiFetch(`${API}/recurring/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Receipts / Payment Vouchers ----
export const getAllReceipts = async () => {
  return apiFetch(`${API}/receipts`);
};

export const saveReceipt = async (receipt) => {
  const res = await apiFetch(`${API}/receipts`, { method: 'POST', body: JSON.stringify(receipt) });
  if (res.id) receipt.id = res.id;
  return receipt;
};

export const deleteReceipt = async (id) => {
  return apiFetch(`${API}/receipts/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Business Profiles (multi-business) ----
export const getAllProfiles = async () => {
  return apiFetch(`${API}/profiles`);
};

export const saveBusinessProfile = async (profile) => {
  const res = await apiFetch(`${API}/profiles`, { method: 'POST', body: JSON.stringify(profile) });
  if (res.id) profile.id = res.id;
  return profile;
};

export const deleteBusinessProfile = async (id) => {
  return apiFetch(`${API}/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

// ---- Export / Import ----
// localStorage keys that are part of the "user's data" and should ride along in any
// backup. Each key is documented with what it stores and whether losing it matters.
// Exact keys we back up + restore. Wildcard patterns handled separately
// below because localStorage doesn't have a native "keys matching pattern"
// API — we iterate localStorage and match.
const EXPORTABLE_LOCALSTORAGE_KEYS = [
  'gst_customUnits',                 // user-defined units for line items
  'gst_regionMode',                  // 'india' | 'international' | 'both'
  'gst_enabledModules',              // map of disabled feature toggles
  'gst_filing_status',               // GSTR-1/3B "Filed" pill states per period key
  'gst_printSettings',               // v1.8.4 — thermal printer defaults (font, weight, all-caps, etc.)
  'gst_itrCalcInputs',               // v1.7.0 — regime calculator inputs
  'gst_itrPresumptive',              // v1.8.0 — presumptive taxation state
  'gst_itrAdvanceTax',               // v1.8.0 — advance tax state
  'gst_stockAlertSettings',          // v1.6.3 — low-stock threshold + on/off
  'freegstbill_invoiceOptions',      // per-invoice display preference defaults
  'freegstbill_theme',               // light/dark (was written as 'theme' in the old whitelist — typo)
  'freegstbill_onboarded',           // skip welcome wizard on next launch
  'freegstbill_dismissedUpdate',     // version the user dismissed the update banner for
  'freegstbill_pwa_dismissed_at',    // 14-day PWA-install-banner cooldown timestamp
];

// Keys matched by prefix. Currently used for per-profile last-used payment
// account (gst_lastUsedAccountId_<profileId>) so multi-account preferences
// survive backup/restore.
const EXPORTABLE_LOCALSTORAGE_PREFIXES = [
  'gst_lastUsedAccountId_',
];

const collectLocalStorage = () => {
  const out = {};
  EXPORTABLE_LOCALSTORAGE_KEYS.forEach(k => {
    try { const v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch { /* sandboxed */ }
  });
  // Prefix-matched keys — iterate all localStorage keys and include any hit.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (EXPORTABLE_LOCALSTORAGE_PREFIXES.some(p => k.startsWith(p))) {
        out[k] = localStorage.getItem(k);
      }
    }
  } catch { /* sandboxed */ }
  return out;
};

const isRestorable = (k) => EXPORTABLE_LOCALSTORAGE_KEYS.includes(k)
  || EXPORTABLE_LOCALSTORAGE_PREFIXES.some(p => k.startsWith(p));

const restoreLocalStorage = (map) => {
  if (!map || typeof map !== 'object') return;
  Object.entries(map).forEach(([k, v]) => {
    if (!isRestorable(k)) return; // ignore foreign keys — never let a backup smuggle unrelated writes in
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  });
};

// Cached app version — pulled from server once per session via /api/version so the
// frontend doesn't have to ship its own copy of package.json. Falls back to 'unknown'
// only if the server is unreachable, which only happens during the brief startup
// window before the user opens the app.
let cachedAppVersion = null;
const getAppVersion = async () => {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    const { current } = await apiFetch(`${API}/version`);
    if (current) { cachedAppVersion = current; return current; }
  } catch { /* server down — best effort */ }
  return 'unknown';
};

// Full export. Returns the JSON-serialised bundle (server data + localStorage).
// Pass `selection` to limit what's included — undefined ⇒ everything.
//
// `selection` shape: { profile, profiles, bills, clients, products, expenses,
//   purchases, recurring, receipts, termsTemplates, meta, localStorage } — each bool.
export const exportAllData = async (selection) => {
  const [all, version] = await Promise.all([apiFetch(`${API}/export`), getAppVersion()]);
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  const data = { exportedAt: new Date().toISOString(), version, __freegstbill_backup: true };
  if (sel.profile)        data.profile = all.profile;
  if (sel.profiles)       data.profiles = all.profiles;
  if (sel.bills)          data.bills = all.bills;
  if (sel.clients)        data.clients = all.clients;
  if (sel.termsTemplates) data.termsTemplates = all.termsTemplates;
  if (sel.products)       data.products = all.products;
  if (sel.expenses)       data.expenses = all.expenses;
  if (sel.recurring)      data.recurring = all.recurring;
  if (sel.receipts)       data.receipts = all.receipts;
  if (sel.purchases)      data.purchases = all.purchases;
  if (sel.meta)           data.meta = all.meta; // includes regionMode, enabledModules, etc. on server
  if (sel.localStorage)   data.localStorage = collectLocalStorage();

  return JSON.stringify(data, null, 2);
};

// Inspect a backup file without committing — returns counts so the UI can show
// what's in it before the user picks what to restore.
export const inspectBackup = (jsonString) => {
  let data;
  try { data = JSON.parse(jsonString); }
  catch { throw new Error('Not a valid JSON file'); }
  return {
    valid: !!data && (data.__freegstbill_backup || data.bills || data.profile),
    exportedAt: data.exportedAt || null,
    version: data.version || null,
    counts: {
      profile: data.profile && Object.keys(data.profile).length > 0 ? 1 : 0,
      profiles: Array.isArray(data.profiles) ? data.profiles.length : 0,
      bills: Array.isArray(data.bills) ? data.bills.length : 0,
      clients: Array.isArray(data.clients) ? data.clients.length : 0,
      termsTemplates: Array.isArray(data.termsTemplates) ? data.termsTemplates.length : 0,
      products: Array.isArray(data.products) ? data.products.length : 0,
      expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
      purchases: Array.isArray(data.purchases) ? data.purchases.length : 0,
      recurring: Array.isArray(data.recurring) ? data.recurring.length : 0,
      receipts: Array.isArray(data.receipts) ? data.receipts.length : 0,
      meta: data.meta ? Object.keys(data.meta).length : 0,
      localStorage: data.localStorage ? Object.keys(data.localStorage).length : 0,
    },
    raw: data,
  };
};

// Selective import. `selection` is the same shape as for exportAllData.
export const importData = async (jsonString, selection) => {
  const inspected = typeof jsonString === 'string' ? inspectBackup(jsonString) : { raw: jsonString };
  const data = inspected.raw;
  const sel = selection || { profile: true, profiles: true, bills: true, clients: true, products: true, expenses: true, purchases: true, recurring: true, receipts: true, termsTemplates: true, meta: true, localStorage: true };

  // Build a filtered payload — never touch collections the user didn't tick.
  const payload = {};
  if (sel.profile && data.profile)               payload.profile = data.profile;
  if (sel.profiles && data.profiles)             payload.profiles = data.profiles;
  if (sel.bills && data.bills)                   payload.bills = data.bills;
  if (sel.clients && data.clients)               payload.clients = data.clients;
  if (sel.termsTemplates && data.termsTemplates) payload.termsTemplates = data.termsTemplates;
  if (sel.products && data.products)             payload.products = data.products;
  if (sel.expenses && data.expenses)             payload.expenses = data.expenses;
  if (sel.recurring && data.recurring)           payload.recurring = data.recurring;
  if (sel.receipts && data.receipts)             payload.receipts = data.receipts;
  if (sel.purchases && data.purchases)           payload.purchases = data.purchases;
  if (sel.meta && data.meta)                     payload.meta = data.meta;

  const result = await apiFetch(`${API}/import`, { method: 'POST', body: JSON.stringify(payload) });

  if (sel.localStorage && data.localStorage) restoreLocalStorage(data.localStorage);

  return result;
};
