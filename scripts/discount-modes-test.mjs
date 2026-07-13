// v1.10.25 — Sanity check for the 4-mode discount matrix.
// Run: node scripts/discount-modes-test.mjs
import { computeInvoiceTotals, resolveLineDiscount } from '../src/utils.js';

const runTotals = (item, invoiceOptions = {}) =>
  computeInvoiceTotals({
    items: [{ id: '1', ...item }],
    profile: { country: 'India', state: 'Karnataka', gstin: '29ABCDE1234F1Z5' },
    client: { state: 'Karnataka' },
    details: {}, showGST: true, taxInclusive: false, invoiceOptions,
  });

const scenarios = [
  // ── Net Amount base ────────────────────────────────────────────────
  { name: 'Fixed ₹10 off Net (₹200 @ 18%)',
    item: { quantity: 2, rate: 100, discount: 10, discountType: 'fixed', discountBase: 'net', taxPercent: 18 },
    exp: { lineDisc: 10, total: 224.2 } },
  { name: 'Percent 10% off (base-agnostic, ₹200 @ 18%)',
    item: { quantity: 2, rate: 100, discount: 10, discountType: 'percent', taxPercent: 18 },
    exp: { lineDisc: 20, total: 212.4 } },

  // ── Unit Price base ────────────────────────────────────────────────
  { name: 'Fixed ₹5 off Unit × 4 qty (₹400 @ 18%)',
    item: { quantity: 4, rate: 100, discount: 5, discountType: 'fixed', discountBase: 'unit', taxPercent: 18 },
    // discount = 4 × 5 = 20 ; taxable = 380 ; tax = 68.4 ; total = 448.4
    exp: { lineDisc: 20, total: 448.4 } },

  // ── Price With Tax base ────────────────────────────────────────────
  { name: 'Fixed ₹11.80 off Price-With-Tax (₹100 @ 18% → gross ₹118)',
    item: { quantity: 1, rate: 100, discount: 11.8, discountType: 'fixed', discountBase: 'with-tax', taxPercent: 18 },
    // 11.80 gross → back out tax → 10 off net → taxable 90 → tax 16.2 → total 106.2
    exp: { lineDisc: 10, total: 106.2 } },

  // ── Clamps ─────────────────────────────────────────────────────────
  { name: 'Percent > 100% caps at line value',
    item: { quantity: 1, rate: 100, discount: 200, discountType: 'percent', taxPercent: 18 },
    exp: { lineDisc: 100, total: 0 } },
  { name: 'Fixed > line value caps',
    item: { quantity: 1, rate: 100, discount: 500, discountType: 'fixed', discountBase: 'net', taxPercent: 18 },
    exp: { lineDisc: 100, total: 0 } },
  { name: 'Unit × qty > line caps',
    item: { quantity: 2, rate: 100, discount: 200, discountType: 'fixed', discountBase: 'unit', taxPercent: 18 },
    exp: { lineDisc: 200, total: 0 } },

  // ── Backward-compat ────────────────────────────────────────────────
  { name: 'Legacy item (no discountBase / no discountType) — treats as fixed net',
    item: { quantity: 1, rate: 100, discount: 10, taxPercent: 18 },
    exp: { lineDisc: 10, total: 106.2 } },
];

let pass = 0, fail = 0;
for (const s of scenarios) {
  const t = runTotals(s.item);
  const errs = [];
  if (Math.abs(t.totalDiscount - s.exp.lineDisc) > 0.01) errs.push(`totalDiscount=${t.totalDiscount} (exp ${s.exp.lineDisc})`);
  if (Math.abs(t.total - s.exp.total) > 0.01) errs.push(`total=${t.total} (exp ${s.exp.total})`);
  if (errs.length) { console.log('✗', s.name, '→', errs.join(', ')); fail++; }
  else { console.log('✓', s.name); pass++; }
}

// Also verify resolveLineDiscount directly for the Price-With-Tax edge case
// (zero-tax lines: divisor is 1, so raw passes through unchanged).
const zt = resolveLineDiscount({ quantity: 1, rate: 100, discount: 11.8, discountType: 'fixed', discountBase: 'with-tax', taxPercent: 0 });
if (Math.abs(zt - 11.8) > 0.01) { console.log(`✗ Zero-tax with-tax base → ${zt} (exp 11.8)`); fail++; }
else { console.log('✓ Zero-tax with-tax base returns raw amount (no division by zero)'); pass++; }

console.log(`\nPassed: ${pass}   Failed: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
