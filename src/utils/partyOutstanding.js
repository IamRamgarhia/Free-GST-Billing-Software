/*
 * v1.10.75 - Party outstanding, the Tally way: parties down the side, months
 * across, a total for each party and each month.
 *
 * Requested: "party outstanding report in Tally format - party names on the
 * left, months Jan to Dec across, and a total column." Indian books run April
 * to March, so that is the default; January to December is a switch.
 *
 * "Outstanding" means what the Outstanding & Aging tab means: the unpaid part
 * of each real sale (countsAsSales - no quotes, challans or cancelled bills),
 * as of today, placed in the month of the invoice. A bill from before the
 * period that is still unpaid is money still owed, so it goes in an "Earlier"
 * column instead of disappearing.
 */
import { countsAsSales, amountDue, clientKey } from '../utils.js';
import { purchaseBalance } from './purchasePayments.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The 12 months of a financial year ('fy', April of startYear to March of the
// next) or a calendar year ('calendar', January to December of startYear).
export function periodMonths(mode, startYear) {
  const first = mode === 'fy' ? 3 : 0;
  return Array.from({ length: 12 }, (_, i) => {
    const m = (first + i) % 12;
    const y = startYear + Math.floor((first + i) / 12);
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTH_SHORT[m]} ${String(y).slice(-2)}` };
  });
}

export const billCurrency = (b) => b.currency || b.data?.invoiceOptions?.currency || 'INR';

// One row per party (same name, ignoring case and spaces), sorted by name:
// { name, earlier, months: { 'YYYY-MM': amount }, total }. `entries` are
// { name, date, due }: what is still owed and the date of its bill.
function byParty(entries, months) {
  const first = months[0].key;
  const last = months[months.length - 1].key;
  const rows = new Map();
  for (const { name: rawName, date, due } of entries) {
    const ym = String(date || '').slice(0, 7);
    if (!(due > 0) || !ym || ym > last) continue;
    const name = String(rawName || '').trim() || 'Unknown';
    const id = clientKey(name); // v1.10.86 (#202) - extra spaces do not split a party
    const row = rows.get(id) || { name, earlier: 0, months: {}, total: 0 };
    if (ym < first) row.earlier += due;
    else row.months[ym] = (row.months[ym] || 0) + due;
    row.total += due;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// What clients owe you.
export function partyOutstanding(bills, months, currency = 'INR') {
  return byParty(bills
    .filter((b) => countsAsSales(b) && b.status !== 'paid' && billCurrency(b) === currency)
    // Less TDS the client deducts (they pay Net Receivable), as everywhere else.
    .map((b) => ({ name: b.clientName, date: b.invoiceDate, due: Math.round((amountDue(b) - (Number(b.paidAmount) || 0)) * 100) / 100 })), months);
}

// v1.10.83 (#123) - what you owe suppliers: the balance of each purchase bill
// (total less TDS less payments), in the month of the bill. Rupees only.
export const supplierOutstanding = (purchases, months) =>
  byParty(purchases.map((p) => ({ name: p.supplierName, date: p.date, due: purchaseBalance(p) })), months);
