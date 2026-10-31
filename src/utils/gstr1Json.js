// v1.10.83 (#133) - the parts of the GSTR-1 JSON the GST portal is strict
// about. Reported: "File could not be uploaded! Download the latest version of
// Offline tool..." for an August 2026 file. From the May 2025 return the HSN
// summary (Table 12) must come in two lists, B2B and B2C; we still sent one.
// Checked against India Compliance (resilient-tech/india-compliance), whose
// GSTR-1 JSON the portal accepts: hsn_b2b / hsn_b2c from 2025-05-01, registered
// and SEZ buyers in B2B, unregistered and overseas in B2C, descriptions cut to
// 30 characters, blanks removed before the file is written.

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
  if (!hsnSplitFrom(fp)) return { data: rows.map(clean) };
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
