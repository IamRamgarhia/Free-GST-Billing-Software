// v1.10.85 - "Make purchase order" for low stock (Dashboard, Products): the PO
// lines (utils/stock.js reorderLines) are handed to the Purchases screen,
// which opens them in the purchase order form for the user to check and save.
// Kept in this tab only (sessionStorage), and used once.
const KEY = 'fgsb_reorderDraft';

export const putReorderDraft = (lines) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(lines || [])); } catch { /* private mode: nothing to hand over */ }
};

export const takeReorderDraft = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const lines = raw ? JSON.parse(raw) : null;
    return Array.isArray(lines) && lines.length ? lines : null;
  } catch {
    return null;
  }
};
