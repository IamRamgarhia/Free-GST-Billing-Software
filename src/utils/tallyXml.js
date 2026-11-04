// v1.10.84 (#131) - Tally masters (Gateway of Tally > Export > Masters, XML
// format) -> rows for the Clients and Products imports, so a Tally file goes
// through the same checks, preview and duplicate rules as a CSV.
// Ledgers under Sundry Debtors / Sundry Creditors (or a group under them)
// become clients; stock items become products. Vouchers are not read.
//
// Read with patterns, not DOMParser: Tally writes "&#4;" before its built-in
// values ("&#4; Primary"), which is not allowed in XML, so a browser's strict
// parser refuses the whole file. The same code runs in node for the test.
// Tested by scripts/tally-xml-test.mjs.
import { getStateCode, stateNameForCode } from '../utils.js';

// Tally saves as UTF-16 LE with a byte-order mark; UTF-8 when asked.
export function decodeXmlBytes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
  if (b[0] === 0x3C && b[1] === 0x00) return new TextDecoder('utf-16le').decode(b);
  return new TextDecoder('utf-8').decode(b); // drops a UTF-8 byte-order mark itself
}

// Entities decoded; a value Tally marks with &#4; ("Not Applicable", "Any",
// "Primary") means "none".
// An out-of-range character code (&#99999999;) is dropped, not a crash.
const codePoint = (n) => (Number.isInteger(n) && n >= 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : '');
const clean = (s) => {
  const v = String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
  return v.startsWith('\u0004') ? '' : v.replace(/\p{Cc}/gu, '').trim();
};
const esc = (t) => t.replace(/\./g, '\\.');
// Every <TAG ...>body</TAG> as { attrs, body }. Tally never nests a tag in
// one of the same name, so the first closing tag is the right one. A quoted
// attribute may hold "/" or ">" (NAME="M/S A/") without ending the tag.
const blocks = (xml, tag) => [...xml.matchAll(new RegExp(`<${esc(tag)}(?=[\\s/>])((?:[^>"]|"[^"]*")*?)(?:/>|>([\\s\\S]*?)</${esc(tag)}>)`, 'g'))]
  .map((m) => ({ attrs: m[1] || '', body: m[2] || '' }));
// The body without its nested .LIST blocks, so a value found is the master's own.
const own = (body) => body.replace(/<([\w]+(?:\.[\w]+)*\.LIST)(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g, '');
const val = (body, tag) => clean((blocks(body, tag)[0] || {}).body);
const all = (body, tag) => blocks(body, tag).map((b) => clean(b.body)).filter(Boolean);
const nameOf = ({ attrs, body }) => clean((/\sNAME="([^"]*)"/.exec(attrs) || [])[1]) || all(body, 'NAME')[0] || '';
const num = (s) => {
  const m = /-?[\d,]*\.?\d+/.exec(String(s || ''));
  return m ? String(Math.abs(Number(m[0].replace(/,/g, '')))) : '';
};

// ---------------------------------------------------------------- ledgers --

const PARTY_GROUPS = new Set(['sundry debtors', 'sundry creditors']);
// name (lower case) -> parent name, for GROUP or STOCKGROUP masters.
const parents = (xml, tag) => new Map(blocks(xml, tag).map((g) => [nameOf(g).toLowerCase(), val(own(g.body), 'PARENT')]));
const isParty = (parent, groups) => {
  for (let g = parent.toLowerCase(), i = 0; g && i < 20; g = (groups.get(g) || '').toLowerCase(), i++) {
    if (PARTY_GROUPS.has(g)) return true;
  }
  return false;
};
const stateOf = (state, gstin) => stateNameForCode(getStateCode(state)) || state || stateNameForCode(String(gstin).slice(0, 2)) || '';

function ledgerRow(ledger) {
  const top = own(ledger.body);
  const gstList = blocks(ledger.body, 'LEDGSTREGDETAILS.LIST').map((b) => b.body).pop() || '';
  const mail = blocks(ledger.body, 'LEDMAILINGDETAILS.LIST').map((b) => b.body).pop() || '';
  const gstin = (val(top, 'PARTYGSTIN') || val(gstList, 'GSTIN')).toUpperCase().replace(/\s/g, '');
  const lines = all((blocks(mail || ledger.body, 'ADDRESS.LIST')[0] || {}).body || '', 'ADDRESS');
  const pin = val(top, 'PINCODE') || val(mail, 'PINCODE');
  const address = [...lines, ...(pin && !lines.join(' ').includes(pin) ? [pin] : [])].join(', ');
  const state = val(top, 'LEDSTATENAME') || val(top, 'STATENAME') || val(mail, 'STATE') || val(gstList, 'STATE');
  return [nameOf(ledger), gstin, val(top, 'LEDGERMOBILE') || val(top, 'LEDGERPHONE'), val(top, 'EMAIL'), address, stateOf(state, gstin)];
}

// ------------------------------------------------------------ stock items --

// The latest GST details of a master: { hsn, rate } ('' when not given).
function gstOf(body) {
  const latest = blocks(body, 'GSTDETAILS.LIST').map((b) => b.body)
    .sort((a, b) => val(b, 'APPLICABLEFROM').localeCompare(val(a, 'APPLICABLEFROM')))[0];
  const hsn = val(latest || '', 'HSNCODE') || all(body, 'HSNCODE').pop() || '';
  if (!latest) return { hsn, rate: '' };
  if (/exempt|nil/i.test(val(latest, 'TAXABILITY'))) return { hsn, rate: '0' };
  const heads = Object.fromEntries(blocks(latest, 'RATEDETAILS.LIST').map((r) => [val(r.body, 'GSTRATEDUTYHEAD').toLowerCase(), Number(num(val(r.body, 'GSTRATE'))) || 0]));
  const igst = heads['integrated tax'] ?? heads.igst;
  const split = (heads['central tax'] ?? heads.cgst ?? 0) + (heads['state tax'] ?? heads['sgst/utgst'] ?? heads.sgst ?? 0);
  const rate = igst || split;
  return { hsn, rate: rate || Object.keys(heads).length ? String(rate) : '' };
}

function stockRow(item, groupGst) {
  const top = own(item.body);
  let { hsn, rate } = gstOf(item.body);
  // "As per stock group": the nearest group that has GST details.
  for (let g = val(top, 'PARENT').toLowerCase(), i = 0; g && (!hsn || rate === '') && i < 20; g = groupGst.get(g)?.parent || '', i++) {
    const gg = groupGst.get(g);
    if (!gg) break;
    hsn = hsn || gg.hsn;
    rate = rate === '' ? gg.rate : rate;
  }
  const lastRate = (tag) => num(blocks(item.body, tag).map((b) => val(b.body, 'RATE')).pop());
  return [nameOf(item), hsn, val(top, 'BASEUNITS'), lastRate('STANDARDCOSTLIST.LIST') || num(val(top, 'OPENINGRATE')), lastRate('STANDARDPRICELIST.LIST'), rate];
}

/** Tally XML (text or bytes) -> { clients: rows, products: rows }, each with a header row. */
export function tallyMastersToRows(input) {
  const xml = typeof input === 'string' ? input : decodeXmlBytes(input);
  if (!/<ENVELOPE\b/i.test(xml) || !/<(LEDGER|STOCKITEM)\b/.test(xml)) {
    throw new Error('This is not a Tally masters file. In Tally: Gateway of Tally > Export > Masters, format XML, then choose that file.');
  }
  const groups = parents(xml, 'GROUP');
  const groupGst = new Map(blocks(xml, 'STOCKGROUP').map((g) => [nameOf(g).toLowerCase(), { parent: val(own(g.body), 'PARENT').toLowerCase(), ...gstOf(g.body) }]));
  const ledgers = blocks(xml, 'LEDGER').filter((l) => isParty(val(own(l.body), 'PARENT'), groups));
  return {
    clients: [['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'State'], ...ledgers.map(ledgerRow)],
    products: [['Name', 'HSN/SAC', 'Unit', 'Purchase Price', 'Selling Price', 'GST %'], ...blocks(xml, 'STOCKITEM').map((s) => stockRow(s, groupGst))],
  };
}
