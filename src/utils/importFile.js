// v1.10.84 (#130, #131) - the import screens take a CSV, an Excel .xlsx (Vyapar
// exports) or, for Clients and Products, a Tally masters .xml. Each becomes
// sheets of rows, which the CSV import reads as it reads a CSV.
// Tested by scripts/xlsx-read-test.mjs and scripts/tally-xml-test.mjs.
import { parseCsv } from './bulkCsv.js';
import { readXlsx } from './xlsxRead.js';
import { tallyMastersToRows } from './tallyXml.js';

const TALLY = {
  clients: ['clients', 'Tally ledgers (parties)', 'This Tally file has no ledgers under Sundry Debtors or Sundry Creditors.'],
  products: ['products', 'Tally stock items', 'This Tally file has no stock items.'],
};

/** file (File / Blob with a name), what: 'clients' | 'products' | 'sales' | 'purchase' -> [{ name, rows }] */
export async function fileToSheets(file, what) {
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1]?.toLowerCase();
  if (ext === 'xls') throw new Error('Old .xls files cannot be read. In Excel, use File > Save As > Excel Workbook (.xlsx) or CSV.');
  if (ext === 'xlsx') return readXlsx(new Uint8Array(await file.arrayBuffer()));
  if (ext === 'xml') {
    const t = TALLY[what];
    if (!t) throw new Error('A Tally file holds clients and products: import it in Clients or Products (Import).');
    const rows = tallyMastersToRows(new Uint8Array(await file.arrayBuffer()))[t[0]];
    if (rows.length < 2) throw new Error(t[2]);
    return [{ name: t[1], rows }];
  }
  return [{ name: file.name, rows: parseCsv(await file.text()) }];
}

const hasRows = (s) => s.rows.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).length >= 2;

// The sheet to open on: the one the screen can import the most from
// (count(rows, index) -> how many are ready); else the first with rows under a header.
export function bestSheet(sheets, count) {
  let at = -1;
  let most = 0;
  sheets.forEach((s, i) => { const n = count(s.rows, i); if (n > most) { most = n; at = i; } });
  return at >= 0 ? at : Math.max(0, sheets.findIndex(hasRows));
}
