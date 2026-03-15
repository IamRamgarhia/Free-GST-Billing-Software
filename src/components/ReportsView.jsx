import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import { getAllBills, getAllExpenses } from '../store';
import { formatCurrency } from '../utils';
import { toast } from './Toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let i = 0; i < 5; i++) {
    const y = currentYear - i;
    options.push({ value: `${y}-${y + 1}`, label: `FY ${y}-${String(y + 1).slice(-2)}`, from: `${y}-04-01`, to: `${y + 1}-03-31` });
  }
  return options;
}

export default function ReportsView() {
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filterMode, setFilterMode] = useState('fy');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billData, expData] = await Promise.all([getAllBills(), getAllExpenses()]);
      setBills(billData);
      setExpenses(expData);
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else {
      const d = new Date(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  const allFilteredBills = bills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate));
  const filteredExpenses = expenses.filter(exp => filterByPeriod(exp.date));

  // P&L
  const totalRevenue = allFilteredBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalTaxCollected = allFilteredBills.reduce((s, b) => s + (b.totalTaxAmount || 0), 0);
  const revenueExTax = totalRevenue - totalTaxCollected;
  const totalExpenseAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenseGST = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
  const expenseExGST = totalExpenseAmount - totalExpenseGST;
  const netProfit = revenueExTax - expenseExGST;

  // Monthly breakdown
  const monthlyPL = {};
  allFilteredBills.forEach(b => {
    if (!b.invoiceDate) return;
    const key = b.invoiceDate.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].revenue += b.totalAmount || 0;
    monthlyPL[key].tax += b.totalTaxAmount || 0;
  });
  filteredExpenses.forEach(e => {
    if (!e.date) return;
    const key = e.date.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].expense += e.amount || 0;
    monthlyPL[key].expGst += e.gstAmount || 0;
  });
  const monthlyKeys = Object.keys(monthlyPL).sort();

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit & Loss Report</h1>
          <p className="page-subtitle">Revenue, expenses, and profitability analysis</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Filter By</label>
            <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="fy">Fiscal Year</option>
              <option value="month">Month / Year</option>
            </select>
          </div>
          {filterMode === 'fy' ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fiscal Year</label>
              <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Month</label>
                <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* P&L Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
          <div><p className="stat-label">Revenue (ex. tax)</p><h2 className="stat-value stat-value-green">{formatCurrency(revenueExTax)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><TrendingDown size={22} /></div>
          <div><p className="stat-label">Expenses (ex. GST)</p><h2 className="stat-value stat-value-purple">{formatCurrency(expenseExGST)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            <Wallet size={22} />
          </div>
          <div>
            <p className="stat-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
            <h2 className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(Math.abs(netProfit))}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><BarChart3 size={22} /></div>
          <div><p className="stat-label">Margin</p><h2 className="stat-value">{revenueExTax > 0 ? Math.round((netProfit / revenueExTax) * 100) : 0}%</h2></div>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="table-header"><h3>Profit & Loss Statement</h3></div>
        <div style={{ padding: '1.5rem' }}>
          <table style={{ width: '100%', maxWidth: '500px', margin: '0 auto', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Revenue</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalRevenue)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST Collected</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(totalTaxCollected)}</td>
              </tr>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Revenue</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(revenueExTax)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Expenses</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalExpenseAmount)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST on Expenses (ITC)</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#059669' }}>-{formatCurrency(totalExpenseGST)}</td>
              </tr>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Expenses</td>
                <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(expenseExGST)}</td>
              </tr>
              <tr>
                <td style={{ padding: '1rem 0', fontWeight: 800, fontSize: '1.1rem' }}>
                  Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                </td>
                <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
                  {formatCurrency(Math.abs(netProfit))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {monthlyKeys.length > 0 && (
        <div className="glass-panel">
          <div className="table-header"><h3>Monthly Breakdown</h3></div>
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '600px' }}>
              <thead><tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Profit/Loss</th>
              </tr></thead>
              <tbody>
                {monthlyKeys.map(key => {
                  const m = monthlyPL[key];
                  const rev = m.revenue - m.tax;
                  const exp = m.expense - m.expGst;
                  const pl = rev - exp;
                  const [y, mo] = key.split('-');
                  return (
                    <tr key={key}>
                      <td className="font-medium">{MONTHS[parseInt(mo) - 1]} {y}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(rev)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(exp)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: pl >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(Math.abs(pl))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
