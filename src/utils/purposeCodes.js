// v1.10.83 - RBI purpose codes for money received from abroad (inward
// remittance). The payer's bank, or the Indian bank, asks which one the
// payment is for; it decides the FIRC / e-BRC and the export proof for GST.
// Printed with the bank details on an invoice to a client abroad, so the
// client can quote it on the wire. Only the codes exporters and freelancers
// use most; any other code can be typed. The bank has the final word.
export const PURPOSE_CODES = [
  { code: 'P0802', label: 'Software consultancy and implementation' },
  { code: 'P0807', label: 'Off-site software exports' },
  { code: 'P0803', label: 'Database and data processing charges' },
  { code: 'P0806', label: 'Other information services' },
  { code: 'P1006', label: 'Business and management consultancy' },
  { code: 'P1007', label: 'Advertising, trade fair and market research' },
  { code: 'P1008', label: 'Research and development services' },
  { code: 'P1009', label: 'Architectural services' },
  { code: 'P1014', label: 'Engineering services' },
  { code: 'P1004', label: 'Legal services' },
  { code: 'P1005', label: 'Accounting, auditing and bookkeeping' },
  { code: 'P1015', label: 'Tax consulting services' },
  { code: 'P1017', label: 'Publishing and printing services' },
  { code: 'P1101', label: 'Audio-visual and related services' },
  { code: 'P1107', label: 'Educational services' },
  { code: 'P1099', label: 'Other services not included elsewhere' },
  { code: 'P0102', label: 'Realisation of export bills (goods)' },
  { code: 'P0103', label: 'Advance receipts against exports (goods)' },
];

// 'P0802' -> 'P0802 (Software consultancy and implementation)'; an unknown
// code is printed as typed.
export const purposeCodeText = (code) => {
  const c = String(code || '').trim().toUpperCase();
  const hit = PURPOSE_CODES.find((p) => p.code === c);
  return hit ? `${c} (${hit.label})` : c;
};

// v1.10.86 - for the Purpose code box's suggestion list (components/ComboInput.jsx).
export const PURPOSE_CODE_OPTIONS = PURPOSE_CODES.map((p) => ({ value: p.code, label: p.label }));
