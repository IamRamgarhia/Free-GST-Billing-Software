// v1.10.85 (#165) - an expense can be Paid, Unpaid or Partly paid, so a bill
// you owe (rent due, a repair not yet paid) shows as outstanding.
//
// Expenses saved before this have no status: they count as Paid, exactly as
// before (the Cash book and every total are unchanged for them).
// The Cash book counts only what was actually paid in cash.

export const EXPENSE_PAYMENT = [
  ['paid', 'Paid'],
  ['unpaid', 'Unpaid'],
  ['partial', 'Partly paid'],
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const expenseStatus = (e) => (e?.paymentStatus === 'unpaid' || e?.paymentStatus === 'partial' ? e.paymentStatus : 'paid');

// What was paid so far.
export function expensePaid(e) {
  const amount = Number(e?.amount) || 0;
  const status = expenseStatus(e);
  if (status === 'unpaid') return 0;
  if (status === 'partial') return r2(Math.min(amount, Math.max(0, Number(e?.paidAmount) || 0)));
  return r2(amount);
}

// What is still owed.
export const expenseDue = (e) => r2((Number(e?.amount) || 0) - expensePaid(e));
