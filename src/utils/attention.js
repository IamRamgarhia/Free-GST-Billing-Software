// v1.10.86 - what needs the user, worked out ONCE for the 🔔 bell and the
// red dots in the sidebar (asked for on 15 Nov: "for any notification, like a
// recurring bill coming, or anything new the user should know, show a red
// dot ... in all places"). App.jsx loads the data; this file only decides,
// so the bell and the dots can never disagree. Pure: no React, no storage
// (tested in scripts/attention-test.mjs), except the two small "seen" helpers
// at the end.
import { countsAsSales, belongsToProfile, findLowStock, getUpcomingFilings, toLocalIsoDate } from '../utils.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// A GSTR-1 / GSTR-3B reminder that was marked Filed on GST Returns (month
// view; same saved marks as that screen: { '9_2026': { gstr1: true } }).
const isFiled = (f, filed) => !!(f.type && f.period && filed?.[f.period]?.[f.type]);

// The bell's sections. `profile` = the open business: invoices and recurring
// templates of another business are left out, as on their screens.
export function findAttention({ bills = [], products = [], stockCfg = null, templates = [], filed = {}, profile = null, now = new Date() } = {}) {
  const today = toLocalIsoDate(now);
  const soon = new Date(now); soon.setDate(soon.getDate() + 3);
  const soonStr = toLocalIsoDate(soon);
  // v1.10.67 (#66 item 12) - never chase payment for a cancelled invoice, a
  // quotation, proforma, challan or credit note (countsAsSales).
  const open = (bills || []).filter(b => b?.status !== 'paid' && countsAsSales(b) && belongsToProfile(b, profile));
  const due = (b) => b.data?.details?.dueDate;
  const lowStock = stockCfg?.enabled === false ? [] : findLowStock(products, Number(stockCfg?.threshold ?? 5));
  return {
    overdue: open.filter(b => due(b) && due(b) < today),
    dueSoon: open.filter(b => due(b) && due(b) >= today && due(b) <= soonStr),
    lowStock, // services and uncounted left out (#121)
    filings: getUpcomingFilings(now).filter(f => f.daysAway <= 10 && !isFiled(f, filed)),
    // The server makes due ones by itself (on start and every hour); one
    // still here did not get made (the app was off, or it failed).
    recurringDue: (templates || []).filter(t => t && t.active !== false && t.nextDate && t.nextDate <= today && belongsToProfile(t, profile)),
  };
}

// Screens whose features are new in this version: a dot until the screen is
// opened once. Update this list with each release (an old list only shows
// dots to someone who has not opened those screens yet).
export const NEW_IN = {
  version: '1.10.86',
  items: {
    inventory: 'MRP on products',
    purchases: 'supplier statement and reverse charge',
    filing: 'GSTR-2B: Add as purchase bill',
  },
};

// The dots: { [menu item id]: { count, text } }. count 0 = a plain dot.
// `live(section)` is the bell's own test (shown and not "Mark all as read"),
// so a section cleared in the bell clears its dot too, and a new overdue
// invoice brings both back.
export function menuDots(att, { live = () => true, autoFire = null, update = null, unseenNew = [] } = {}) {
  const dots = {};
  const add = (id, text, count = 0) => {
    const d = dots[id];
    dots[id] = d ? { count: d.count + count, text: `${d.text}; ${text}` } : { count, text };
  };
  const a = att || {};
  if (live('overdue') && a.overdue?.length) add('dashboard', `${plural(a.overdue.length, 'overdue invoice')}`, a.overdue.length);
  if (live('recurringDue') && a.recurringDue?.length) add('recurring', `${plural(a.recurringDue.length, 'recurring invoice')} due to be made`, a.recurringDue.length);
  if (live('autoFire') && autoFire?.count > 0) add('recurring', `${plural(autoFire.count, 'recurring invoice')} made today`, autoFire.count);
  if (live('lowStock') && a.lowStock?.length) add('inventory', `${plural(a.lowStock.length, 'product')} low on stock`, a.lowStock.length);
  if (live('filings') && a.filings?.length) {
    const f = a.filings[0];
    const more = a.filings.length > 1 ? ` (+${a.filings.length - 1} more)` : '';
    add('filing', `${f.label} due ${f.daysAway === 0 ? 'today' : `in ${plural(f.daysAway, 'day')}`}${more}`);
  }
  if (update) add('settings', `Update to v${update} is available`);
  for (const id of unseenNew) if (NEW_IN.items[id]) add(id, `New in this update: ${NEW_IN.items[id]}`);
  return dots;
}

// One dot for several items (a closed group, an item taken out of the menu,
// the phone's ☰ button): null when none of them has one.
export function rollupDot(ids, dots) {
  const texts = (ids || []).filter(id => dots?.[id]).map(id => dots[id].text);
  return texts.length ? { count: 0, text: texts.join('; ') } : null;
}

// The "Filed" marks of GST Returns for this business (the same saved key and
// fallback as readFilingStatus in components/GSTReturns.jsx).
export function readFiledMarks(profile) {
  const key = profile?.gstin ? `gst_filing_status_${String(profile.gstin).trim().toUpperCase()}` : 'gst_filing_status';
  try { return JSON.parse(localStorage.getItem(key) || localStorage.getItem('gst_filing_status') || '{}') || {}; } catch { return {}; }
}

// ---- "New" dots: which screens were opened since this version ----
const NEW_SEEN_KEY = 'gst_newScreensSeen';
const saveSeen = (ids) => {
  try { localStorage.setItem(NEW_SEEN_KEY, JSON.stringify({ v: NEW_IN.version, ids })); } catch { /* storage blocked */ }
  return ids;
};
// A new install has nothing "new": everything counts as seen.
export function readNewSeen(freshInstall) {
  try {
    const s = JSON.parse(localStorage.getItem(NEW_SEEN_KEY) || 'null');
    if (s?.v === NEW_IN.version && Array.isArray(s.ids)) return s.ids;
  } catch { /* storage blocked: shown until opened, this session */ }
  return freshInstall ? saveSeen(Object.keys(NEW_IN.items)) : [];
}
export const markNewSeen = (seen, id) => (NEW_IN.items[id] && !seen.includes(id) ? saveSeen([...seen, id]) : seen);
