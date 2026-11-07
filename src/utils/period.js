// v1.10.85 - the Dashboard cards for a chosen period: all time, this month,
// last month, a month picked by hand ('YYYY-MM'), or a financial year
// ('2026-2027', as in getFYOptions). Dates are 'YYYY-MM-DD' strings, so a
// plain string compare is enough.

const pad = (n) => String(n).padStart(2, '0');
const monthRange = (y, m) => ({ from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` });

// null = all time (no limit).
export const periodRange = (period, month = '', today = new Date()) => {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (period === 'this-month') return monthRange(y, m);
  if (period === 'last-month') return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1);
  if (period === 'month') {
    const [py, pm] = String(month).split('-').map(Number);
    return py && pm >= 1 && pm <= 12 ? monthRange(py, pm) : null;
  }
  const fy = /^(\d{4})-(\d{4})$/.exec(String(period));
  return fy ? { from: `${fy[1]}-04-01`, to: `${fy[2]}-03-31` } : null;
};

// The day only: a date saved with a time still counts on its last day.
export const inPeriod = (date, range) => {
  if (!range) return true;
  const day = String(date || '').slice(0, 10);
  return day >= range.from && day <= range.to;
};
