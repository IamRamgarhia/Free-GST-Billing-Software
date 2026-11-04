// v1.10.83 (#133) - the parts of the GSTR-1 JSON the GST portal is strict
// about. Reported: "File could not be uploaded! Download the latest version of
// Offline tool..." for an August 2026 file. From the May 2025 return the HSN
// summary (Table 12) must come in two lists, B2B and B2C; we still sent one.
// Checked against India Compliance (resilient-tech/india-compliance), whose
// GSTR-1 JSON the portal accepts: hsn_b2b / hsn_b2c from 2025-05-01, registered
// and SEZ buyers in B2B, unregistered and overseas in B2C, descriptions cut to
// 30 characters, blanks removed before the file is written.

import { getStateCode, splitLineTax, hsnUqc, roundQty } from '../utils.js';

export const HSN_DESC_MAX = 30;

// fp is the return period, MMYYYY.
export const hsnSplitFrom = (fp) => {
  const m = Number(String(fp).slice(0, 2));
  const y = Number(String(fp).slice(2));
  return y * 100 + m >= 202505;
};

// rows: [{ b2b: true|false, hsn_sc, desc, uqc, qty, rt, txval, iamt, camt, samt, csamt }]
// Each list is numbered from 1.
export function hsnTable(rows, fp) {
  const clean = (r, i) => {
    const { b2b, ...row } = r; // eslint-disable-line no-unused-vars
    return { num: i + 1, ...row, desc: String(row.desc || '').trim().slice(0, HSN_DESC_MAX).trim() };
  };
  if (!hsnSplitFrom(fp)) return { data: mergeHsnRows(rows).map(clean) };
  return {
    hsn_b2b: rows.filter((r) => r.b2b).map(clean),
    hsn_b2c: rows.filter((r) => !r.b2b).map(clean),
  };
}

// #141 - a GSTIN pasted with a space or an invisible character looked right
// on screen but failed the format check (and the portal). Keep only 0-9 A-Z
// when that leaves the 15 characters of a GSTIN; anything else stays as typed,
// so the check still points at it.
export const cleanGstin = (value) => {
  const raw = String(value ?? '');
  const tight = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return tight.length === 15 ? tight : raw.trim();
};

// State code, PAN (5 letters, 4 digits, 1 letter), registration number (1-9,
// then A-Z after the ninth in a state), Z/D/C, check character.
export const gstinFormatOk = (gstin) => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d][A-Z][A-Z\d]$/.test(String(gstin ?? ''));

// The portal rejects blank values: drop '', null, undefined, empty lists and
// empty objects, at every level. 0 stays.
export function stripEmpty(value) {
  if (Array.isArray(value)) {
    const list = value.map(stripEmpty).filter((v) => v !== undefined);
    return list.length ? list : undefined;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const s = stripEmpty(v);
      if (s !== undefined) out[k] = s;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value === '' || value === null || value === undefined ? undefined : value;
}

// ---------------------------------------------------------------------------
// v1.10.84 - the tables the file was still missing (they had to be typed into
// the portal by hand): exports (Table 6A, exp), nil-rated / exempt / non-GST
// supplies (Table 8, nil) and deemed exports (inv_typ DE in b2b and cdnr).
// Shapes as India Compliance writes them (sections/exports.py, nil_rated.py,
// b2b.py to_gov), whose files the portal accepts. Tested by
// scripts/gstr1-json-test.mjs.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const GST_TREATMENTS = ['taxable', 'nil', 'exempt', 'nongst'];

// What a line is for the return. A line on an export is zero-rated (Table 6A),
// never nil. A bill of supply's lines are exempt unless the product says
// nil-rated or non-GST (the maintainer's choice, 30 Oct 2026). On a tax
// invoice only a 0% line can leave the taxable tables: nil-rated, or what its
// product says; a line that charged tax is always taxable.
export function lineTreatment({ invoiceType, isExport, taxPercent, gstTreatment }) {
  if (isExport) return 'taxable';
  const own = ['nil', 'exempt', 'nongst'].includes(gstTreatment) ? gstTreatment : '';
  if (invoiceType === 'bill-of-supply') return own || 'exempt';
  if ((Number(taxPercent) || 0) !== 0) return 'taxable';
  return own === 'exempt' || own === 'nongst' ? own : 'nil';
}

// Table 8. rows: [{ interstate, b2b, treatment, txval }], credit notes with a
// negative txval. One row per supply type; a row of zeros is left out.
const NIL_FIELD = { nil: 'nil_amt', exempt: 'expt_amt', nongst: 'ngsup_amt' };
const NIL_ORDER = ['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C'];
export function nilTable(rows) {
  const by = {};
  for (const r of rows || []) {
    const field = NIL_FIELD[r.treatment];
    if (!field) continue;
    const ty = `${r.interstate ? 'INTR' : 'INTRA'}${r.b2b ? 'B2B' : 'B2C'}`;
    by[ty] = by[ty] || { sply_ty: ty, nil_amt: 0, expt_amt: 0, ngsup_amt: 0 };
    by[ty][field] += Number(r.txval) || 0;
  }
  const inv = NIL_ORDER.filter((ty) => by[ty])
    .map((ty) => ({ ...by[ty], nil_amt: r2(by[ty].nil_amt), expt_amt: r2(by[ty].expt_amt), ngsup_amt: r2(by[ty].ngsup_amt) }))
    .filter((r) => r.nil_amt || r.expt_amt || r.ngsup_amt);
  return inv.length ? { inv } : undefined;
}

// Lines of one export invoice or note -> its items. With payment: one item per
// rate. Without payment (under a LUT): one item at rate 0 and no tax, as India
// Compliance files it.
const exportItems = (lines, wopay) => {
  const by = {};
  for (const l of lines || []) {
    const rt = wopay ? 0 : Number(l.rt) || 0;
    by[rt] = by[rt] || { txval: 0, rt, iamt: 0, csamt: 0 };
    by[rt].txval += Number(l.txval) || 0;
    if (!wopay) by[rt].iamt += Number(l.iamt) || 0;
    by[rt].csamt += Number(l.csamt) || 0;
  }
  return Object.values(by).map((d) => ({ txval: r2(d.txval), rt: d.rt, iamt: r2(d.iamt), csamt: r2(d.csamt) }));
};

// Table 6A. invoices: [{ inum, idt, val, wopay, lines: [{ rt, txval, iamt, csamt }] }]
// Items are flat (no num / itm_det) and there is no place of supply.
export function expTable(invoices) {
  const out = [];
  for (const exp_typ of ['WPAY', 'WOPAY']) {
    const inv = (invoices || []).filter((i) => (exp_typ === 'WOPAY') === !!i.wopay)
      .map((i) => ({ inum: i.inum, idt: i.idt, val: r2(i.val), itms: exportItems(i.lines, i.wopay) }));
    if (inv.length) out.push({ exp_typ, inv });
  }
  return out;
}

// A credit note on an export goes in cdnur as EXPWP / EXPWOP, with no place of
// supply and its items wrapped like the other note tables.
export function exportNote({ nt_num, nt_dt, val, wopay, lines }) {
  return {
    typ: wopay ? 'EXPWOP' : 'EXPWP', ntty: 'C', nt_num, nt_dt, val: r2(val),
    itms: exportItems(lines, wopay).map(({ rt, txval, iamt, csamt }, i) => ({ num: i + 1, itm_det: { rt, txval, iamt, csamt } })),
  };
}

// inv_typ of a b2b invoice or cdnr note. Deemed exports are DE whatever else
// applies (checked first, as India Compliance does); reverse charge is R; SEZ
// is SEWOP under a LUT with no tax charged, else SEWP.
export function b2bInvType({ deemedExport, rcm, sez, lut }) {
  if (deemedExport) return 'DE';
  if (rcm) return 'R';
  if (sez) return lut ? 'SEWOP' : 'SEWP';
  return 'R';
}

// ---------------------------------------------------------------------------
// Table 13, documents issued (moved here from GSTReturns.jsx in v1.10.84 so it
// is tested; ERR-056). One row per number series under the portal's nature
// codes (1 invoices, 5 credit notes, 12 delivery challans); quotations and
// proformas are not reported; from / to by the number's value, not as text.
export const DOC_ISSUE_NATURE = { 'tax-invoice': 1, 'bill-of-supply': 1, composition: 1, 'credit-note': 5, 'delivery-challan': 12 };
export const DOC_NATURE_LABEL = { 1: 'Invoices for outward supply', 5: 'Credit notes', 12: 'Delivery challans' };
const trailingNo = (n) => Number((String(n).match(/(\d+)\s*$/) || [])[1] || 0);

export function docIssueSummary(bills) {
  const out = {};
  for (const bill of bills || []) {
    const nature = DOC_ISSUE_NATURE[bill.invoiceType || 'tax-invoice'];
    if (!nature || !bill.invoiceNumber) continue;
    const series = String(bill.invoiceNumber).replace(/\d+\s*$/, '');
    const key = `${nature}|${series}`;
    if (!out[key]) out[key] = { nature, type: DOC_NATURE_LABEL[nature], series, from: bill.invoiceNumber, to: bill.invoiceNumber, total: 0, cancelled: 0 };
    const d = out[key];
    d.total++;
    if ((bill.status || '') === 'cancelled') d.cancelled++;
    if (trailingNo(bill.invoiceNumber) < trailingNo(d.from)) d.from = bill.invoiceNumber;
    if (trailingNo(bill.invoiceNumber) > trailingNo(d.to)) d.to = bill.invoiceNumber;
  }
  return out;
}

// The doc_issue block of the JSON.
export function docIssueDetails(summary) {
  const byNature = {};
  Object.values(summary || {}).forEach((d) => { (byNature[d.nature] = byNature[d.nature] || []).push(d); });
  return Object.entries(byNature).map(([nature, list]) => ({
    doc_num: Number(nature),
    docs: list.map((d, i) => ({ num: i + 1, from: d.from, to: d.to, totnum: d.total, cancel: d.cancelled, net_issue: d.total - d.cancelled })),
  }));
}
// ---- Shared by the GST Returns screen, the CSV files and the JSON ----------

// Inter-state status of a bill - follows place of supply when set explicitly,
// SEZ supplies always interstate, else compares seller and client state.
//
// v1.10.66 (#61) - the invoice's own saved decision comes first. Every bill
// keeps the totals the tax engine produced, `isInterstate` included, and a
// return has to report the tax the way the invoice actually charged it.
// Re-deriving it here from state NAMES disagreed with the engine where the
// engine works from codes - a client known only by GSTIN, or a client abroad -
// and filed IGST for an invoice that charged CGST + SGST. The name comparison
// below remains only for bills saved before the flag existed.
export function billIsInterstate(bill) {
  const saved = bill.data?.totals?.isInterstate;
  if (typeof saved === 'boolean') return saved;
  const prof = bill.data?.profile;
  const client = bill.data?.client;
  const details = bill.data?.details;
  if (client?.isSEZ) return true;
  const sellerState = (prof?.state || '').trim().toLowerCase();
  const placeOfSupply = (details?.placeOfSupply || client?.state || '').trim().toLowerCase();
  if (!sellerState || !placeOfSupply) return false;
  return sellerState !== placeOfSupply;
}

// The per-line split lives in utils.js (splitLineTax) so it can be tested;
// see v1.10.77 (#89) there.
// v1.10.83 - an export / SEZ invoice under a LUT charged no IGST
// (totals.lutZeroRated): its lines report their value and rate with zero tax,
// as the invoice printed them. Tax-inclusive prices had no tax in them.
export const billSplit = (bill, item, isInter, taxInclusive, isIntraUT) => {
  if (!bill?.data?.totals?.lutZeroRated) return splitLineTax(item, isInter, taxInclusive, isIntraUT);
  return { ...splitLineTax(item, isInter, false, isIntraUT), cgst: 0, sgst: 0, utgst: 0, igst: 0, cess: 0 };
};

// v1.10.66 (#61) - exports. The tax engine now charges a client outside India
// IGST, so such an invoice can no longer sit in B2C with your own state as
// place of supply: the portal rejects an inter-state row for the home state.
// Exports belong in GSTR-1 Table 6A - which needs shipping-bill and port
// details this app does not record - and in GSTR-3B 3.1(b). They are kept
// out of B2B / B2C and 3.1(a), counted in 3.1(b), and flagged so they are
// entered in Table 6A on the portal. The HSN and document summaries still
// include them. An older invoice whose saved totals charged CGST + SGST stays
// exactly where it was, so tax it collected can never drop out of 3.1(a).
export const isExportBill = (bill) => {
  const country = String(bill.data?.client?.country || '').trim();
  return (bill.data?.profile?.country || 'India') === 'India'
    && !!country && country !== 'India'
    && !getStateCode(String(bill.data?.details?.placeOfSupply || '').trim())
    && bill.data?.totals?.isInterstate !== false;
};

// v1.10.83 (#133) - Table 12 has a B2B list (buyers with a GSTIN, SEZ too) and
// a B2C list (no GSTIN, and exports).
export const hsnIsB2B = (bill) => !!bill.data?.client?.gstin && !isExportBill(bill);

// v1.10.74 - Table 12 is net of credit notes: a credit note's quantity, value
// and tax reduce its HSN row instead of adding to it.
export const hsnSign = (bill) => ((bill.invoiceType || 'tax-invoice') === 'credit-note' ? -1 : 1);

// v1.10.84 (#166) - the Table 12 rows, worked out in ONE place. The screen, the
// HSN CSV and the JSON were three separate loops and drifted apart (the screen
// showed one combined table, its own units and an "N/A" row). One row per list
// (B2B / B2C), HSN, rate and unit. A line with no HSN is left out - the portal
// rejects it - and counted so the screen can say so. UTGST goes in samt: the
// portal has no separate field for it.
// Returns { rows: [{ b2b, hsn_sc, desc, uqc, qty, rt, txval, iamt, camt, samt,
// csamt }], missingHsn, customUnit }.
export function hsnSummary(bills) {
  const map = {};
  let missingHsn = 0, customUnit = 0;
  for (const bill of bills || []) {
    const isInter = billIsInterstate(bill);
    const b2b = hsnIsB2B(bill);
    const sign = hsnSign(bill);
    for (const item of bill.data?.items || []) {
      const hsn = String(item.hsn || '').trim();
      if (!hsn || hsn === 'N/A') { missingHsn += 1; continue; }
      const uqc = hsnUqc(item);
      if (uqc === 'OTH' && item.unit) customUnit += 1;
      const rt = Number(item.taxPercent) || 0;
      const key = `${b2b ? 'B2B' : 'B2C'}_${hsn}_${rt}_${uqc}`;
      if (!map[key]) map[key] = { b2b, hsn_sc: hsn, desc: item.name || '', uqc, qty: 0, rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      const r = map[key];
      const s = billSplit(bill, item, isInter, !!bill.data?.taxInclusive, !!bill.data?.totals?.isIntraUT);
      if (uqc !== 'NA') r.qty += sign * (Number(item.quantity) || 0);
      r.txval += sign * s.taxable; r.iamt += sign * s.igst; r.camt += sign * s.cgst;
      r.samt += sign * (s.sgst + s.utgst); r.csamt += sign * s.cess;
    }
  }
  const rows = Object.values(map)
    .map((r) => ({ ...r, qty: roundQty(r.qty, 2), txval: r2(r.txval), iamt: r2(r.iamt), camt: r2(r.camt), samt: r2(r.samt), csamt: r2(r.csamt) }))
    .sort((a, b) => a.hsn_sc.localeCompare(b.hsn_sc) || a.rt - b.rt);
  return { rows, missingHsn, customUnit };
}

// Before the May 2025 return Table 12 is one list: the B2B and B2C rows of the
// same HSN, rate and unit are added together (they would repeat otherwise).
export function mergeHsnRows(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = `${r.hsn_sc}|${r.rt}|${r.uqc}`;
    const m = map.get(k);
    if (!m) { map.set(k, { ...r, b2b: false }); continue; }
    m.qty += r.qty; m.txval += r.txval; m.iamt += r.iamt; m.camt += r.camt; m.samt += r.samt; m.csamt += r.csamt;
  }
  return [...map.values()].map((r) => ({ ...r, qty: roundQty(r.qty, 2), txval: r2(r.txval), iamt: r2(r.iamt), camt: r2(r.camt), samt: r2(r.samt), csamt: r2(r.csamt) }));
}

// Total value of a row: taxable value plus every tax.
export const hsnRowValue = (r) => r2(r.txval + r.iamt + r.camt + r.samt + r.csamt);

// v1.10.31 - the HSN CSV in the GSTR-1 offline utility's Table 12 column order
// (v3.1.6+). "Total Value" last or "Rate %" made the importer refuse the file.
export const HSN_CSV_HEADERS = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'];
export const hsnCsvRow = (r) => [r.hsn_sc, r.desc, r.uqc, r.qty, hsnRowValue(r).toFixed(2), r.rt, r.txval.toFixed(2), r.iamt.toFixed(2), r.camt.toFixed(2), r.samt.toFixed(2), r.csamt.toFixed(2)];
