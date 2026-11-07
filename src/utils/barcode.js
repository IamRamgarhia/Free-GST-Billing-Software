// v1.10.85 (#137, #158) - barcodes: a Code 128 (set B) encoder drawn as SVG,
// the rules for a product's barcode, scanning onto an invoice, and the label
// sheets. Pure (no React, no fetch, no storage), so scripts/barcode-test.mjs
// checks every part. Code 128 set B covers letters, digits and the usual
// signs, which is every code a USB scanner types; no library needed.

// Bar and space widths (in modules) of the 107 Code 128 symbols: values 0-105,
// then Stop (106). Each starts with a bar. From the Code 128 standard table.
const PATTERNS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 '
  + '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 '
  + '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 '
  + '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 '
  + '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 '
  + '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 '
  + '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 '
  + '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 '
  + '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 '
  + '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 '
  + '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');
export const CODE128_PATTERNS = PATTERNS;
const START_B = 104;
const STOP = 106;
const QUIET = 10; // blank modules each side, so a scanner finds the start

// A barcode can use these: space to ~ (what Code 128 set B can print).
const PRINTABLE = /^[\x20-\x7e]+$/;
export const BARCODE_MAX = 40;

// Symbol values of a code: Start B, one per character, the checksum, Stop.
// The checksum is Start + each value x its position, mod 103.
export function code128Values(text) {
  const s = String(text ?? '');
  if (!s || !PRINTABLE.test(s)) throw new Error('Code 128 set B takes letters, digits and the usual signs only');
  const data = [...s].map((c) => c.charCodeAt(0) - 32);
  const check = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...data, check, STOP];
}

// The widths of every bar and space in order, bar first (quiet zones not included).
export const code128Widths = (text) => code128Values(text).flatMap((v) => [...PATTERNS[v]].map(Number));

// The same as 1 (bar) and 0 (space) per module, e.g. Start B = 11010010000.
export const code128Modules = (text) => code128Widths(text)
  .map((w, i) => (i % 2 === 0 ? '1' : '0').repeat(w)).join('');

// An SVG of the bars only (the digits are printed under it as text). It is
// stretched to the box it sits in (preserveAspectRatio none), so a label of
// any size gets bars as wide as it allows.
export function code128Svg(text) {
  const widths = code128Widths(text);
  let x = QUIET;
  let d = '';
  widths.forEach((w, i) => {
    if (i % 2 === 0) d += `M${x} 0h${w}v10h-${w}z`;
    x += w;
  });
  const total = x + QUIET;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 10" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="#000"/></svg>`;
}

// ---- A product's barcode ----
export const normaliseBarcode = (v) => String(v ?? '').trim();
const sameCode = (a, b) => normaliseBarcode(a).toLowerCase() === normaliseBarcode(b).toLowerCase();

// The product with this barcode (case and spaces around it ignored), or null.
export const findByBarcode = (products, code) => {
  const c = normaliseBarcode(code);
  if (!c) return null;
  return (products || []).find((p) => p.barcode && sameCode(p.barcode, c)) || null;
};

// Why this barcode cannot be saved on product `ownId`, or '' when it can.
// Blank is fine: a barcode is optional.
export function barcodeProblem(code, products, ownId) {
  const c = normaliseBarcode(code);
  if (!c) return '';
  if (c.length > BARCODE_MAX) return `A barcode can be up to ${BARCODE_MAX} characters`;
  if (!PRINTABLE.test(c)) return 'A barcode can have English letters, digits and the usual signs only (no ₹ or other symbols)';
  const other = (products || []).find((p) => p.id !== ownId && p.barcode && sameCode(p.barcode, c));
  return other ? `The barcode ${c} is already on ${other.name || 'another product'}. Each product needs its own.` : '';
}

// "Make one": the next internal code, 2 followed by 7 digits (20000001,
// 20000002, ...), one more than the highest such code in the books. Shops use
// codes starting with 2 for their own goods, and 8 digits never clash with
// the 13-digit codes printed on branded goods.
export function nextInternalCode(products) {
  const taken = new Set((products || []).map((p) => normaliseBarcode(p.barcode).toLowerCase()).filter(Boolean));
  let n = 20000000;
  for (const code of taken) if (/^2\d{7}$/.test(code)) n = Math.max(n, Number(code));
  do { n += 1; } while (taken.has(String(n)));
  return String(n);
}

// ---- Scanning onto an invoice ----
// A scanned product goes on the invoice: the same product already on a line
// adds 1 to that line; else it fills the first empty line, or a new line is
// added (before the delivery charges line, which stays last). `fill(line)`
// makes the product line (InvoiceGenerator's productLine, the same as picking
// it from the suggestions); `blank(items)` makes an empty line.
export function addScannedLine(items, product, fill, blank) {
  const same = items.find((i) => i.productId === product.id && !i.size && !i.isCharge);
  if (same) return items.map((i) => (i === same ? { ...i, quantity: (Number(i.quantity) || 0) + 1 } : i));
  const empty = items.find((i) => !i.productId && !i.isCharge && !String(i.name || '').trim());
  if (empty) return items.map((i) => (i === empty ? fill(i) : i));
  const line = fill(blank(items));
  const chargeAt = items.findIndex((i) => i.isCharge);
  return chargeAt < 0 ? [...items, line] : [...items.slice(0, chargeAt), line, ...items.slice(chargeAt)];
}

// ---- Labels ----
// Sizes in mm. A4 sheets as sold (Avery-style), and a thermal roll that
// prints one label per page. `top` / `left` are the sheet's margins.
export const LABEL_LAYOUTS = [
  { id: 'a4-65', label: 'A4 sheet, 65 labels (38 x 21 mm)', cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.7, gapX: 2.5, gapY: 0 },
  { id: 'a4-40', label: 'A4 sheet, 40 labels (48 x 25 mm)', cols: 4, rows: 10, w: 48.5, h: 25.4, top: 21.5, left: 8, gapX: 0, gapY: 0 },
  { id: 'a4-24', label: 'A4 sheet, 24 labels (64 x 34 mm)', cols: 3, rows: 8, w: 64, h: 33.9, top: 12.9, left: 7, gapX: 2, gapY: 0 },
  { id: 'roll-50x25', label: 'Thermal roll, 50 x 25 mm (one label each)', roll: true, cols: 1, rows: 1, w: 50, h: 25, top: 0, left: 0, gapX: 0, gapY: 0 },
];
export const layoutById = (id) => LABEL_LAYOUTS.find((l) => l.id === id) || LABEL_LAYOUTS[0];

// MRP: the selling price with GST (product prices are saved before tax).
export const mrpOf = (product) => {
  const price = Number(product?.sellingPrice ?? product?.rate) || 0;
  return Math.round(price * (1 + (Number(product?.taxPercent) || 0) / 100) * 100) / 100;
};

// Labels for a purchase bill: one per piece bought, matched to products by
// productId, else by name (any case). Part quantities round up (2.5 kg = 3
// labels). Lines with no product in the list are named in `unmatched`.
export function labelQtysFromBill(items, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const byName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p]));
  const qty = new Map();
  const unmatched = [];
  for (const it of items || []) {
    const name = String(it.name || '').trim();
    const n = Math.ceil(Number(it.quantity) || 0);
    if (!name || n <= 0) continue;
    const p = (it.productId && byId.get(it.productId)) || byName.get(name.toLowerCase());
    if (!p) { if (!unmatched.includes(name)) unmatched.push(name); continue; }
    qty.set(p.id, (qty.get(p.id) || 0) + n);
  }
  return { rows: [...qty].map(([id, n]) => ({ product: byId.get(id), qty: n })), unmatched };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One label: business name and price are optional (left out when blank).
const labelHtml = ({ name, code, price, business }) => `<div class="label">${business ? `<div class="biz">${esc(business)}</div>` : ''}<div class="name">${esc(name)}</div>${price ? `<div class="price">${esc(price)}</div>` : ''}<div class="bars">${code128Svg(code)}</div><div class="digits">${esc(code)}</div></div>`;

// The whole print page: labels = [{ name, code, price?, business? }], one
// entry per label to print. Every sheet is a page; on screen the sheets show
// on grey with the label edges dashed, which the printout leaves out.
export function labelSheetHtml(labels, layoutId) {
  const L = layoutById(layoutId);
  const perPage = L.cols * L.rows;
  const pages = [];
  for (let i = 0; i < labels.length; i += perPage) pages.push(labels.slice(i, i + perPage));
  const pageW = L.roll ? L.w : 210;
  const pageH = L.roll ? L.h : 297;
  const f = Math.min(L.h / 25, L.w / 48); // text size follows the label size
  const mm = (n) => `${Math.round(n * 100) / 100}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Barcode labels</title><style>
@page { size: ${L.roll ? `${mm(pageW)} ${mm(pageH)}` : 'A4 portrait'}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
.sheet { width: ${mm(pageW)}; height: ${mm(pageH)}; padding: ${mm(L.top)} 0 0 ${mm(L.left)}; display: grid; grid-template-columns: repeat(${L.cols}, ${mm(L.w)}); grid-auto-rows: ${mm(L.h)}; column-gap: ${mm(L.gapX)}; row-gap: ${mm(L.gapY)}; align-content: start; overflow: hidden; break-after: page; page-break-after: always; background: #fff; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.label { width: ${mm(L.w)}; height: ${mm(L.h)}; overflow: hidden; padding: ${mm(1.2 * f)} ${mm(2 * f)}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1.1; }
.biz { font-size: ${mm(2.2 * f)}; font-weight: 700; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name { font-size: ${mm(2.6 * f)}; max-width: 100%; max-height: 2.25em; overflow: hidden; word-break: break-word; }
.price { font-size: ${mm(2.8 * f)}; font-weight: 700; }
.bars { width: 100%; flex: 1 1 auto; min-height: ${mm(4 * f)}; max-height: ${mm(12 * f)}; margin-top: ${mm(0.6 * f)}; }
.bars svg { display: block; width: 100%; height: 100%; }
.digits { font-family: 'Courier New', monospace; font-size: ${mm(2.4 * f)}; letter-spacing: 0.04em; }
@media screen {
  body { background: #e5e7eb; padding: 10px; }
  .sheet { margin: 0 auto 10px; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  .label { outline: 1px dashed #cbd5e1; outline-offset: -1px; }
}
</style></head><body>${pages.map((pg) => `<div class="sheet">${pg.map(labelHtml).join('')}</div>`).join('')}</body></html>`;
}
