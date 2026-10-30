// v1.10.84 (#130) - read an .xlsx file into rows of text, for the import
// screens (Vyapar exports to Excel). An .xlsx is a zip of XML files and fflate
// is already here (xlsx.js writes them the same way), so no spreadsheet library:
// the usual one on npm is no longer maintained and has open security reports.
// Old binary .xls files are not read; the screens ask for .xlsx or CSV.
// Tested by scripts/xlsx-read-test.mjs.
import { unzipSync, strFromU8 } from 'fflate';

const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

// All the <t> texts inside one piece of XML, joined (rich text has several).
const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => decode(m[1] || '')).join('');
const attr = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
// "AA12" -> 26 (0-based column).
const colIndex = (ref) => [...String(ref).replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Excel's day count (1900 system, with its made-up 29 Feb 1900) -> YYYY-MM-DD.
export const excelSerialToIso = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
  return d.toISOString().slice(0, 10);
};

/** bytes (Uint8Array / ArrayBuffer) -> [{ name, rows: string[][] }], in workbook order. */
export function readXlsx(bytes) {
  let files;
  try { files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } catch {
    throw new Error('This is not an .xlsx file. In Excel, use File > Save As > Excel Workbook (.xlsx) or CSV, and choose that file.');
  }
  const text = (p) => (files[p] ? strFromU8(files[p]) : '');
  const book = text('xl/workbook.xml');
  if (!book) throw new Error('The file has no sheets. Choose the .xlsx file Excel or Vyapar saved.');
  const rels = Object.fromEntries([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(([tag]) => [attr(tag, 'Id'), attr(tag, 'Target')]));
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  return [...book.matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => {
    const target = rels[attr(tag, 'r:id')] || '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const rows = [];
    for (const rm of text(path).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const at = Number(attr(rm[1], 'r')) - 1;
      const row = [];
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = attr(cm[1], 't');
        const body = cm[2] || '';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = texts(body);
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (v !== undefined) value = decode(v);
        const ref = attr(cm[1], 'r');
        const c = ref ? colIndex(ref) : row.length;
        while (row.length < c) row.push('');
        row[c] = value;
      }
      const r = Number.isFinite(at) && at >= rows.length ? at : rows.length;
      while (rows.length < r) rows.push([]);
      rows[r] = row;
    }
    return { name: decode(attr(tag, 'name') || ''), rows };
  });
}
