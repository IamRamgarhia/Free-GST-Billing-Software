// Support page (v1.10.80): the payment note in the UPI QR, and the supporters
// tracker the maintainer keeps in supporters.json at the root of the GitHub
// repo. The app and the docs site read that file when online; editing it on
// GitHub updates every copy, no release needed. It comes from the internet, so
// everything in it is checked before it is shown (parseSupporters).

export const SUPPORTERS_URL = 'https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/supporters.json';

// The note UPI apps fill in when the QR is scanned, so the maintainer can see
// who paid: "Free GST Billing support - DiceCodes". Kept to letters,
// digits, spaces, "." and "-" (some UPI apps refuse anything else) and to 50
// characters, which every app accepts.
const NOTE_BASE = 'Free GST Billing support';
export const upiNote = (businessName = '') => {
  const name = String(businessName || '').replace(/[^A-Za-z0-9 .-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return NOTE_BASE;
  return `${NOTE_BASE} - ${name}`.slice(0, 50).trim();
};

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// The tracker as the page may show it, or null when the file is missing or
// not usable. Anything unexpected is left out rather than shown.
export const parseSupporters = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const total = num(raw.totalReceived, 1e10);
  if (total === null) return null;
  const supporters = num(raw.supporters, 1e7);
  const goalAmount = num(raw.goal?.amount, 1e10);
  const updated = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.updated || '')) ? raw.updated : '';
  return {
    totalReceived: Math.round(total),
    supporters: supporters === null ? null : Math.floor(supporters),
    goal: goalAmount ? { amount: Math.round(goalAmount), label: text(raw.goal.label, 80) } : null,
    thanks: (Array.isArray(raw.thanks) ? raw.thanks : []).map((n) => text(n, 60)).filter(Boolean).slice(-2000), // newest are last
    // v1.10.83 - each supporter with what they gave (scripts/add-supporter.mjs
    // keeps it). Older files have names only; the page then lists those.
    people: (Array.isArray(raw.people) ? raw.people : [])
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ name: text(p.name, 60), amount: num(p.amount, 1e9), date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? p.date : '' }))
      .filter((p) => p.name && p.amount !== null)
      .map((p) => ({ ...p, amount: Math.round(p.amount) }))
      .slice(-2000),
    updated,
  };
};

// The Dashboard's daily support card (SupportNudge): shown once a business has
// made a few invoices, once a day. state = { hiddenOn: 'YYYY-MM-DD' ("Not
// today"), snoozedUntil: ms ("Hide for 7 days"), never } - never was the old
// "Don't show again" (before v1.10.80) and is still honoured.
export const SUPPORT_NUDGE_MIN_INVOICES = 10;
export const SNOOZE_DAYS = 7; // v1.10.86 (maintainer): a reminder after 7 days, not 30
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const shouldShowSupportNudge = (invoiceCount, state = {}, now = new Date()) => {
  if (invoiceCount < SUPPORT_NUDGE_MIN_INVOICES || state.never) return false;
  if (state.hiddenOn === localDay(now)) return false;
  return !(Number(state.snoozedUntil) > now.getTime());
};
