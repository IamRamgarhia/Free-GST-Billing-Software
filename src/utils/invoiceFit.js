// v1.10.86 (#188) - keeping an A4 / A5 invoice inside its paper.
//
// The item table is laid out by the browser (table-layout: auto), and amount
// columns never wrap. With every column on (HSN, qty, rate, discount, CGST %
// and amount, SGST % and amount) and large amounts, the columns need more
// room than the sheet has: the table ran into the right margin, or past the
// sheet, and the PDF of a too-wide sheet was shrunk as a whole, leaving the
// invoice small with a blank strip down the right. Now the table steps down
// to tighter padding and a smaller figure size, only as far as it has to.

export const TABLE_FIT_LEVELS = 2;
// The item name column is never squeezed narrower than this (CSS px) while
// a tighter level is still available.
export const MIN_NAME_WIDTH = 160;

// measure(level) -> { table, room, name } in CSS px, after applying `level`
// (0 = as designed). Returns the first level at which the table fits.
export function pickTableFitLevel(measure) {
  for (let level = 0; level <= TABLE_FIT_LEVELS; level++) {
    const { table = 0, room = Infinity, name = Infinity } = measure(level) || {};
    if (table <= room + 1 && name >= MIN_NAME_WIDTH) return level;
  }
  return TABLE_FIT_LEVELS;
}

// The room an item table has inside its parent (unscaled layout px, so the
// preview's zoom transform does not matter).
function tableRoom(table) {
  const parent = table.parentElement;
  if (!parent) return Infinity;
  const p = getComputedStyle(parent);
  const t = getComputedStyle(table);
  const px = (v) => parseFloat(v) || 0;
  return parent.clientWidth - px(p.paddingLeft) - px(p.paddingRight) - px(t.marginLeft) - px(t.marginRight);
}

// Sets data-table-fit on the invoice root (removed when the table fits as
// designed). Safe to call on every render: it only reads and writes one
// attribute.
export function fitItemTable(root) {
  if (!root || typeof getComputedStyle === 'undefined') return 0;
  // The item table, and the HSN tax summary of the grid designs.
  const tables = [...root.querySelectorAll('table.inv-table, table.inv-hsn-summary')];
  if (!tables.length) { root.removeAttribute('data-table-fit'); return 0; }
  const level = pickTableFitLevel((lvl) => {
    if (lvl) root.setAttribute('data-table-fit', String(lvl)); else root.removeAttribute('data-table-fit');
    const name = tables[0].querySelector('tbody .inv-td-name');
    // The table that overflows the most decides.
    const over = tables.map((t) => ({ table: t.offsetWidth, room: tableRoom(t) })).sort((a, b) => (b.table - b.room) - (a.table - a.room))[0];
    return { ...over, name: name ? name.offsetWidth : Infinity };
  });
  if (level) root.setAttribute('data-table-fit', String(level)); else root.removeAttribute('data-table-fit');
  return level;
}

// PDF font scale above 100% used to enlarge the page picture past the paper
// (140% cut 20% off each side). Above 100% the invoice is now laid out on a
// narrower sheet (paper width / scale) and that picture fills the paper
// width, so the text is larger and nothing leaves the page. At or below 100%
// it is placed smaller and centred, as before.
export function pdfScalePlan(paperWidthMm, scale) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return s > 1
    ? { layoutWidthMm: paperWidthMm / s, placeScale: 1 }
    : { layoutWidthMm: paperWidthMm, placeScale: s };
}
