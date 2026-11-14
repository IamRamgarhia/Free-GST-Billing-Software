// v1.10.86 - "make it yours": how the lists are sorted, which Dashboard blocks
// show and in what order, the Dashboard's remembered and saved filters, and
// the screen the app opens on. Kept per browser like the Dashboard's columns
// (localStorage), and copied to the data folder by prefsMirror.js.
import { useState } from 'react';

export const readJson = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch { return fallback; }
};
export const writeJson = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode: kept for this visit only */ }
};

// ---- Sorting by a column ----------------------------------------------------
// null = the list's usual order. A click sorts A-Z (low to high), the next
// Z-A, the third goes back to the usual order.
export const nextSort = (sort, key) => {
  if (!sort || sort.key !== key) return { key, dir: 'asc' };
  return sort.dir === 'asc' ? { key, dir: 'desc' } : null;
};

const isEmpty = (v) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));
// Numbers as numbers; text ignoring case, with "INV-2" before "INV-10".
const compare = (a, b) => (typeof a === 'number' && typeof b === 'number'
  ? a - b
  : String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' }));

// A sorted copy; rows with nothing in the column go last either way, and
// equal rows keep their usual order. An unknown column leaves the list as is.
export function sortRows(rows, sort, getters) {
  const get = sort && getters[sort.key];
  if (!get) return rows;
  const sign = sort.dir === 'desc' ? -1 : 1;
  return rows
    .map((row, i) => ({ row, v: get(row), i }))
    .sort((x, y) => {
      const ex = isEmpty(x.v), ey = isEmpty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : (ex ? 1 : -1);
      return sign * compare(x.v, y.v) || x.i - y.i;
    })
    .map((x) => x.row);
}

// The sort of one list ('dashboard', 'products', 'purchases', 'expenses',
// 'clients'), remembered in this browser.
export function useListSort(list, valid = null) {
  const key = `gst_listSort_${list}`;
  const [sort, setSortState] = useState(() => {
    const s = readJson(key, null);
    return s && typeof s.key === 'string' && (!valid || valid.includes(s.key)) && (s.dir === 'asc' || s.dir === 'desc') ? s : null;
  });
  const setSort = (next) => { setSortState(next); writeJson(key, next); };
  return { sort, setSort, toggle: (col) => setSort(nextSort(sort, col)) };
}

// ---- Dashboard blocks -------------------------------------------------------
export const DASHBOARD_BLOCKS = [
  ['welcome', 'Welcome note and Getting started'],
  ['support', 'Support card'],
  ['overdue', 'Overdue invoices strip'],
  ['totals', 'Totals cards'],
  ['lowStock', 'Low stock strip'],
  ['list', 'Invoice list'],
];
const BLOCK_IDS = DASHBOARD_BLOCKS.map(([id]) => id);
export const BLOCKS_KEY = 'gst_dashboardBlocks';
export const DEFAULT_LAYOUT = { order: BLOCK_IDS, hidden: [] };

// Whatever was saved, made whole: unknown ids dropped, blocks added in a later
// version put back where they sit by default.
export function normaliseLayout(saved) {
  const order = (Array.isArray(saved?.order) ? saved.order : []).filter((id, i, a) => BLOCK_IDS.includes(id) && a.indexOf(id) === i);
  for (const id of BLOCK_IDS) {
    if (!order.includes(id)) order.splice(Math.min(BLOCK_IDS.indexOf(id), order.length), 0, id);
  }
  const hidden = (Array.isArray(saved?.hidden) ? saved.hidden : []).filter((id) => BLOCK_IDS.includes(id));
  return { order, hidden };
}

export const moveBlock = (layout, id, step) => {
  const order = [...layout.order];
  const i = order.indexOf(id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= order.length) return layout;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...layout, order };
};

export const toggleBlock = (layout, id) => ({
  ...layout,
  hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id],
});

// ---- The screen the app opens on --------------------------------------------
export const START_VIEW_KEY = 'gst_startView';
export const START_VIEWS = [['dashboard', 'Dashboard'], ['new', 'New Invoice'], ['list', 'Invoices list']];
const SCROLL_KEY = 'gst_startScrollToList';

// Called once when the app opens in a new tab or window (App.jsx). "Invoices
// list" opens the Dashboard and leaves a note for it to scroll to the list.
export function startView() {
  let v = 'dashboard';
  try { v = localStorage.getItem(START_VIEW_KEY) || 'dashboard'; } catch { /* storage blocked */ }
  if (v === 'new') return 'new';
  if (v === 'list') { try { sessionStorage.setItem(SCROLL_KEY, '1'); } catch { /* storage blocked */ } }
  return 'dashboard';
}

// The Dashboard asks once, on its first showing.
export function takeStartScroll() {
  try {
    const yes = sessionStorage.getItem(SCROLL_KEY) === '1';
    sessionStorage.removeItem(SCROLL_KEY);
    return yes;
  } catch { return false; }
}
