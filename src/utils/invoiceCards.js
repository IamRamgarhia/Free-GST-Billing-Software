// v1.10.86 - New Invoice: the order of its cards and which are closed, kept
// per browser (mirrored to the data folder by utils/prefsMirror.js). Screen
// only: the invoice, its numbers and the PDF never depend on it.
// Shape: { order: [card ids, top to bottom], closed: [card ids] }.
export const CARD_IDS = ['type', 'client', 'items', 'details', 'terms'];
export const CARD_LAYOUT_KEY = 'fgsb_invoiceCards';
export const DEFAULT_CARD_LAYOUT = { order: CARD_IDS, closed: [] };

const known = (list) => (Array.isArray(list) ? list : []).filter((id, i, a) => CARD_IDS.includes(id) && a.indexOf(id) === i);

// Whatever was saved, made whole: unknown ids dropped, a card added in a later
// version put back where it sits by default.
export function normaliseCardLayout(saved) {
  const order = known(saved?.order);
  CARD_IDS.forEach((id, i) => { if (!order.includes(id)) order.splice(Math.min(i, order.length), 0, id); });
  return { order, closed: known(saved?.closed) };
}

// Drop `id` before the card now at `slot` (0..length; length = at the end).
export function placeCard(layout, id, slot) {
  const from = layout.order.indexOf(id);
  if (from < 0 || slot < 0 || slot > layout.order.length) return layout;
  const rest = layout.order.filter((x) => x !== id);
  const at = slot > from ? slot - 1 : slot;
  const order = [...rest.slice(0, at), id, ...rest.slice(at)];
  return order.join() === layout.order.join() ? layout : { ...layout, order };
}

export const moveCardBy = (layout, id, step) => {
  const from = layout.order.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= layout.order.length) return layout;
  return placeCard(layout, id, step > 0 ? to + 1 : to);
};

export const setCardOpen = (layout, id, open) => ({
  ...layout,
  closed: open ? layout.closed.filter((x) => x !== id) : [...layout.closed.filter((x) => x !== id), id],
});

// Where a card dragged to height `y` lands: before the first card whose middle
// is below `y`. `mids` are the cards' middles, top to bottom.
export const slotAt = (mids, y) => {
  const i = mids.findIndex((m) => y < m);
  return i < 0 ? mids.length : i;
};

// A drop that would leave the card where it is shows no line.
export const isSameSlot = (order, id, slot) => {
  const from = order.indexOf(id);
  return slot === from || slot === from + 1;
};

export function readCardLayout() {
  try { return normaliseCardLayout(JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || 'null')); } catch { return normaliseCardLayout(null); }
}

export function saveCardLayout(layout) {
  try { localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout)); } catch { /* storage blocked: kept for this visit only */ }
}
