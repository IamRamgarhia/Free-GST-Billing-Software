// v1.10.86 - the suggestion list of a ComboInput (components/ComboInput.jsx),
// the app's own white box that replaced the browser's black <datalist> list.
// Kept here, without React, so scripts/combo-test.mjs can check it.

// Options come as strings or { value, label }. Empty and repeated values go.
export function normaliseOptions(options) {
  const seen = new Set();
  const out = [];
  for (const o of options || []) {
    const value = String((o && typeof o === 'object' ? o.value : o) ?? '').trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    const label = o && typeof o === 'object' && o.label ? String(o.label) : '';
    out.push({ value, label });
  }
  return out;
}

// The options containing the typed words (in the value or its label), those
// that start with them first, then a word starting with them, then the rest.
export function filterOptions(options, query) {
  const list = normaliseOptions(options);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  const rank = (o) => {
    const v = o.value.toLowerCase();
    if (v.startsWith(q)) return 0;
    if (` ${v}`.includes(` ${q}`)) return 1;
    return v.includes(q) ? 2 : o.label.toLowerCase().includes(q) ? 3 : -1;
  };
  return list.map((o, i) => [o, rank(o), i]).filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([o]) => o);
}

// True when the box holds exactly one of the options (any case).
export const isExactOption = (options, value) => {
  const v = String(value || '').trim().toLowerCase();
  return !!v && normaliseOptions(options).some((o) => o.value.toLowerCase() === v);
};
