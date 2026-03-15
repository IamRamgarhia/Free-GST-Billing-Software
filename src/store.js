// File-based storage via local Express API server
// All data persists as JSON files in the ./data/ folder

const API = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

// ---- Invoice counter ----
export const getNextInvoiceNumber = async (prefix = 'INV') => {
  const settings = await getInvoiceNumberSettings();
  const key = `counter_${prefix}`;
  const { value } = await apiFetch(`${API}/meta/${key}`);
  const next = (value || 0) + 1;
  await apiFetch(`${API}/meta/${key}`, { method: 'POST', body: JSON.stringify({ value: next }) });

  if (settings.format === 'random') {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const pfx = settings.brandPrefix || prefix;
    return `${pfx}${settings.separator}${rand}`;
  }

  const sep = settings.separator || '/';
  const pfx = settings.brandPrefix || prefix;
  const padded = String(next).padStart(settings.padDigits || 4, '0');

  if (settings.showFinYear) {
    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    return `${pfx}${sep}${currentYear}-${nextYear}${sep}${padded}`;
  }

  return `${pfx}${sep}${padded}`;
};

// ---- Bills ----
export const saveBill = async (bill) => {
  return apiFetch(`${API}/bills`, { method: 'POST', body: JSON.stringify(bill) });
};

export const getBill = async (id) => {
  const bills = await getAllBills();
  return bills.find(b => b.id === id) || null;
};

export const getAllBills = async () => {
  return apiFetch(`${API}/bills`);
};

export const deleteBill = async (id) => {
  return apiFetch(`${API}/bills/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

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
export const exportAllData = async () => {
  const data = await apiFetch(`${API}/export`);
  return JSON.stringify(data, null, 2);
};

export const importData = async (jsonString) => {
  const data = JSON.parse(jsonString);
  return apiFetch(`${API}/import`, { method: 'POST', body: JSON.stringify(data) });
};
