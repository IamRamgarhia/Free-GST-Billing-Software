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
