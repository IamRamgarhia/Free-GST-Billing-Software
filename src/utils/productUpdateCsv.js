const key = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase();
const heading = (v) => key(v).replace(/[\s_%()/#.-]/g, '');
const fields = {
  id: ['id', 'productid', 'itemid'],
  name: ['name', 'product', 'productname', 'item', 'itemname'],
  purchasePrice: ['purchaseprice', 'cost', 'costprice'],
  sellingPrice: ['sellingprice', 'saleprice', 'rate', 'price'],
  hsn: ['hsn', 'hsncode', 'hsnsac', 'sac', 'saccode'],
  stock: ['stock', 'quantity', 'stockquantity', 'currentstock'],
};
export const priceOf = (p, field) =>
  Number(field === 'sellingPrice' ? (p.sellingPrice ?? p.rate ?? 0) : (p.purchasePrice ?? 0));
export function parsePriceCsv(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false,
    closed = false;
  const s = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (closed && ![',', '\r', '\n'].includes(c)) {
      if (!/\s/.test(c)) throw Error('Unexpected text after a quoted CSV field.');
    } else if (c === '"') {
      if (cell.trim()) throw Error('Invalid quote in CSV.');
      quoted = true;
    } else if (c === ',') {
      row.push(cell.trim());
      cell = '';
      closed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      closed = false;
    } else cell += c;
  }
  if (quoted) throw Error('The CSV has an unclosed quoted field.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw Error('Choose a CSV with headings and at least one product row.');
  if (rows.length > 10001) throw Error('Use at most 10,000 product rows per file.');
  const headers = rows.shift(),
    columns = {};
  for (const [field, names] of Object.entries(fields)) {
    const matches = headers.map((h, i) => (names.includes(heading(h)) ? i : -1)).filter((i) => i >= 0);
    if (matches.length > 1) throw Error('More than one column matches ' + field + '. Keep only one.');
    if (matches.length) columns[field] = matches[0];
  }
  if (columns.id === undefined && columns.name === undefined) throw Error('Include Product ID or Name.');
  if (['sellingPrice', 'purchasePrice', 'hsn', 'stock'].every((f) => columns[f] === undefined))
    throw Error('Include Selling Price, Purchase Price, HSN/SAC or Stock.');
  const ignored = headers.filter((_, i) => !Object.values(columns).includes(i));
  return {
    records: rows.map((r, i) => {
      if (r.length !== headers.length) throw Error('Row ' + (i + 2) + ' has the wrong number of columns.');
      return { ...Object.fromEntries(Object.entries(columns).map(([k, j]) => [k, r[j]])), line: i + 2 };
    }),
    ignored,
  };
}
export function buildPricePlan(text, products, { allowStock = false } = {}) {
  const { records, ignored } = parsePriceCsv(text),
    byId = new Map(),
    byName = new Map();
  for (const p of products) {
    byId.set(String(p.id), p);
    const k = key(p.name);
    byName.set(k, [...(byName.get(k) || []), p]);
  }
  const changes = [],
    errors = [],
    seen = new Set();
  let unchanged = 0,
    blank = 0;
  if (!allowStock && records.some((r) => r.stock !== undefined))
    ignored.push('Stock (stock updates not enabled)');
  for (const r of records) {
    const label = 'Row ' + r.line;
    let p;
    if (r.id) {
      p = byId.get(r.id);
      if (!p) {
        errors.push(label + ': Product ID not found.');
        continue;
      }
    } else {
      const matches = byName.get(key(r.name)) || [];
      if (matches.length !== 1) {
        errors.push(
          label +
            ': ' +
            (matches.length
              ? 'Name is ambiguous; use Product ID.'
              : 'Product name not found: ' + (r.name || '(blank)')),
        );
        continue;
      }
      p = matches[0];
    }
    if (r.name && key(r.name) !== key(p.name)) {
      errors.push(label + ': Name does not match Product ID.');
      continue;
    }
    if (seen.has(p.id)) {
      errors.push(label + ': Product occurs more than once.');
      continue;
    }
    seen.add(p.id);
    const prices = {},
      expected = {};
    let bad = false,
      provided = 0;
    for (const f of ['purchasePrice', 'sellingPrice']) {
      if (r[f] === undefined || r[f] === '') continue;
      provided++;
      const clean = r[f].replace(/^(?:₹|Rs\.?)[\s]*/i, '').replace(/,/g, '');
      const n = /^\d+(?:\.\d{1,4})?$/.test(clean) ? Number(clean) : NaN;
      if (!Number.isFinite(n) || n > 1e12) {
        errors.push(label + ': Invalid ' + f + '; use a non-negative number with up to 4 decimal places.');
        bad = true;
        continue;
      }
      const old = priceOf(p, f);
      if (!Number.isFinite(old)) {
        errors.push(label + ': Existing price needs review.');
        bad = true;
        continue;
      }
      if (n !== old) {
        prices[f] = n;
        expected[f] = old;
      }
    }
    if (r.hsn !== undefined && r.hsn !== '') {
      provided++;
      if (!/^\d{1,8}$/.test(r.hsn)) {
        errors.push(label + ': HSN/SAC must contain up to 8 digits.');
        bad = true;
      } else if (r.hsn !== String(p.hsn ?? '')) {
        prices.hsn = r.hsn;
        expected.hsn = String(p.hsn ?? '');
      }
    }
    if (allowStock && r.stock !== undefined && r.stock !== '') {
      provided++;
      const clean = r.stock.replace(/,/g, ''),
        stock = /^\d+(?:\.\d{1,4})?$/.test(clean) ? Number(clean) : NaN;
      if (p.kind === 'service') {
        errors.push(label + ': Services cannot have stock.');
        bad = true;
      } else if (!Number.isFinite(stock) || stock > 1e9) {
        errors.push(label + ': Stock must be a non-negative quantity with up to 4 decimal places.');
        bad = true;
      } else {
        const old = p.stock === undefined || p.stock === null ? null : Number(p.stock);
        if (old !== null && !Number.isFinite(old)) {
          errors.push(label + ': Existing stock needs review.');
          bad = true;
        } else if (stock !== old) {
          prices.stock = stock;
          expected.stock = old;
        }
      }
    }
    if (bad) continue;
    if (!provided) {
      blank++;
      continue;
    }
    if (!Object.keys(prices).length) {
      unchanged++;
      continue;
    }
    changes.push({ id: String(p.id), name: p.name, prices, expected });
  }
  return { changes, errors, ignored, unchanged, blank, rows: records.length };
}
export function exportPrices(products) {
  const quote = (v) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    [
      ['Product ID', 'Name', 'Purchase Price', 'Selling Price', 'HSN/SAC', 'Stock', 'Unit'],
      ...products.map((p) => [
        p.id,
        p.name,
        priceOf(p, 'purchasePrice'),
        priceOf(p, 'sellingPrice'),
        String(p.hsn ?? ''),
        p.kind === 'service' ? '' : (p.stock ?? ''),
        p.unit || 'Pcs',
      ]),
    ]
      .map((r) => r.map(quote).join(','))
      .join('\r\n')
  );
}
