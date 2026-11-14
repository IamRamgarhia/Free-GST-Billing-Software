import { useState, useEffect } from 'react';
import { Wallet, Plus, Edit3, Trash2, Search, X, Save, Calendar, CheckCircle } from 'lucide-react';
import { getAllExpenses, saveExpense, deleteExpense, getProfile } from '../store';
import { formatCurrency, getFYOptions, belongsToProfile, isUnassignedToBusiness } from '../utils';
import UnassignedBanner from './UnassignedBanner';
import { toast } from './Toast';
import { EXPENSE_PAYMENT, expenseStatus, expensePaid, expenseDue } from '../utils/expensePayment';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import PageHeader from './PageHeader';
import TableExport from './TableExport';
import ActionsMenu from './ActionsMenu';
import { useCostCentres } from './useCostCentres';
import { CostCentreSelect, CostCentreFilter } from './CostCentrePicker';
import { matchesCentre, centreFields, centreLabel, UNTAGGED } from '../utils/costCentres';
// v1.10.86 - sort by a column header, remembered in this browser.
import { useListSort, sortRows } from '../utils/listPrefs';
import SortTh from './SortTh';

const SORT_GETTERS = {
  date: (e) => e.date,
  description: (e) => e.description,
  category: (e) => e.category,
  vendor: (e) => e.vendorName,
  amount: (e) => Number(e.amount) || 0,
  gst: (e) => Number(e.gstAmount) || 0,
  payment: (e) => expenseDue(e),
};

// Each category is tagged with its ITR (Income Tax Return) head so the
// v1.7.0+ ITR Filing Summary can auto-aggregate expenses under the correct
// P&L line. Users don't have to think about heads — they pick the category
// they already understand.
//   - 'business'      → deductible business expense under section 37
//   - 'depreciation'  → section 32 (asset purchases, capitalised then
//                       depreciated per Rule 5)
//   - 'salary'        → separately tracked; declared under section 40A(2)(b)
//                       for related parties
//   - 'notDeductible' → personal / drawings / capital / non-business
const EXPENSE_CATEGORIES = [
  { name: 'Office Rent',            itrHead: 'business' },
  { name: 'Utilities',              itrHead: 'business' },
  { name: 'Internet & Phone',       itrHead: 'business' },
  { name: 'Software & Tools',       itrHead: 'business' },
  { name: 'Travel',                 itrHead: 'business' },
  { name: 'Meals & Entertainment',  itrHead: 'business' },
  { name: 'Office Supplies',        itrHead: 'business' },
  { name: 'Salary & Wages',         itrHead: 'salary' },
  { name: 'Professional Fees',      itrHead: 'business' },
  { name: 'Insurance',              itrHead: 'business' },
  { name: 'Marketing & Ads',        itrHead: 'business' },
  { name: 'Raw Materials',          itrHead: 'business' },
  { name: 'Shipping & Courier',     itrHead: 'business' },
  { name: 'Repairs & Maintenance',  itrHead: 'business' },
  { name: 'Bank Charges',           itrHead: 'business' },
  { name: 'GST Paid',               itrHead: 'business' },
  { name: 'Asset Purchase',         itrHead: 'depreciation' },
  { name: 'Personal / Drawings',    itrHead: 'notDeductible' },
  { name: 'Other',                  itrHead: 'business' },
];
const CATEGORY_NAMES = EXPENSE_CATEGORIES.map(c => c.name);

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

// v1.10.74 - today's LOCAL date (toISOString is UTC, so before 05:30 IST it
// gave yesterday). Called when the form opens, not once at load.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = {
  date: '', // v1.10.74 - set to localToday() when the form opens
  description: '',
  category: 'Other',
  amount: '',
  gstAmount: '',
  gstPercent: '',
  // P1 #15: interstate flag. When on, ITC on GST paid routes to IGST in
  // GSTR-3B Table 4(A) instead of splitting 50/50 into CGST + SGST. Real
  // scenario: AWS / Google / Adobe / SaaS bills from out-of-state offices.
  // Off = intrastate = supplier and buyer in the same state.
  interstate: false,
  vendorName: '',
  vendorGstin: '',
  invoiceNo: '',
  paymentMode: 'Bank Transfer',
  // v1.10.85 (#165) - Paid / Unpaid / Partly paid (utils/expensePayment.js)
  paymentStatus: 'paid',
  paidAmount: '',
  note: '',
  // v1.10.83 (#112) - optional; see utils/costCentres.js
  costCentre: '',
  costCentreName: '',
};

// v1.10.6 — audit L4: local copy removed, imported from utils above.

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  // v1.10.65 (#58 item 3) — the business these records belong to.
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [centreFilter, setCentreFilter] = useState('');
  const [payFilter, setPayFilter] = useState('all'); // v1.10.85 (#165): 'all' | 'due'
  const { on: ccOn, centres } = useCostCentres(ownerProfile);

  const fyOptions = getFYOptions();
  const defaultFy = fyOptions[0]?.value || '';


  // v1.10.65 (#58 item 3) — assign records saved before businesses were kept
  // separate. Never automatic: only the user knows which business an old
  // record belonged to, so guessing would file it into the wrong books.
  const unassignedExpenses = expenses.filter(isUnassignedToBusiness);
  const assignUnassignedExpenses = async () => {
    await Promise.all(unassignedExpenses.map(r => saveExpense({
      ...r,
      ownerGstin: ownerProfile?.gstin || '',
      ownerName: ownerProfile?.businessName || '',
    })));
    loadExpenses();
  };

  const loadExpenses = async () => {
    try {
      const [rows, prof] = await Promise.all([getAllExpenses(), getProfile().catch(() => null)]);
      setOwnerProfile(prof);
      // v1.10.65 (#58 item 3) — show only this business's records. Anything
      // saved before businesses were separated has no owner recorded and is
      // always shown, so nothing disappears from an existing ledger.
      setExpenses((rows || []).filter(r => belongsToProfile(r, prof)));
    } catch {
      toast('Failed to load expenses', 'error');
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadExpenses();
  }, []);

  const filtered = expenses.filter(exp => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(exp.description || '').toLowerCase().includes(q) &&
          !(exp.vendorName || '').toLowerCase().includes(q) &&
          !(exp.invoiceNo || '').toLowerCase().includes(q)) return false;
    }
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
    if (!matchesCentre(exp, centreFilter)) return false;
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && exp.date) {
        if (exp.date < fy.from || exp.date > fy.to) return false;
      }
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalGST = filtered.reduce((s, e) => s + (e.gstAmount || 0), 0);
  // v1.10.85 (#165) - still to pay on the expenses shown.
  const totalDue = filtered.reduce((s, e) => s + expenseDue(e), 0);
  const { sort, toggle: toggleSort } = useListSort('expenses', Object.keys(SORT_GETTERS));
  const shown = sortRows(payFilter === 'due' ? filtered.filter((e) => expenseDue(e) > 0) : filtered, sort, SORT_GETTERS);

  // Mark an Unpaid / Partly paid expense as fully paid.
  const markPaid = async (exp) => {
    try {
      await saveExpense({ ...exp, paymentStatus: 'paid', paidAmount: Number(exp.amount) || 0 });
      toast('Marked as paid', 'success');
      loadExpenses();
    } catch { toast('Failed to save expense', 'error'); }
  };

  const openAdd = () => {
    setForm({ ...emptyForm, date: localToday() });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setForm({
      date: exp.date || '',
      description: exp.description || '',
      category: exp.category || 'Other',
      amount: exp.amount || '',
      gstAmount: exp.gstAmount || '',
      gstPercent: exp.gstPercent || '',
      vendorName: exp.vendorName || '',
      vendorGstin: exp.vendorGstin || '',
      invoiceNo: exp.invoiceNo || '',
      paymentMode: exp.paymentMode || 'Bank Transfer',
      paymentStatus: expenseStatus(exp),
      paidAmount: expenseStatus(exp) === 'partial' ? String(exp.paidAmount ?? '') : '',
      interstate: !!exp.interstate,
      note: exp.note || '',
      costCentre: exp.costCentre || '',
      costCentreName: exp.costCentreName || '',
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast('Description is required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter a valid amount', 'warning'); return; }
    // v1.10.74 - GST % must be 0 to 100 (40% is a real rate, so no 28 cap).
    const gstPct = form.gstPercent === '' ? 0 : parseFloat(form.gstPercent);
    if (!(gstPct >= 0 && gstPct <= 100)) { toast('GST % must be between 0 and 100', 'warning'); return; }
    const amountNum = parseFloat(form.amount);
    const paidNum = form.paymentStatus === 'partial' ? parseFloat(form.paidAmount) : NaN;
    if (form.paymentStatus === 'partial' && !(paidNum > 0 && paidNum < amountNum)) {
      toast('For Partly paid, enter the amount paid so far (more than 0 and less than the amount)', 'warning'); return;
    }
    try {
      const expense = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        description: form.description.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        gstAmount: form.gstAmount ? parseFloat(form.gstAmount) : 0,
        gstPercent: form.gstPercent ? parseFloat(form.gstPercent) : 0,
        vendorName: form.vendorName.trim(),
        vendorGstin: form.vendorGstin.trim(),
        invoiceNo: form.invoiceNo.trim(),
        paymentMode: form.paymentMode,
        paymentStatus: form.paymentStatus,
        paidAmount: form.paymentStatus === 'partial' ? paidNum : form.paymentStatus === 'unpaid' ? 0 : amountNum,
        interstate: !!form.interstate,
        note: form.note.trim(),
        // Stamp the business this expense belongs to. `vendorGstin` above is
        // the SUPPLIER — filing an expense under your own supplier would be
        // exactly backwards, so the owner is kept in its own field.
        ownerGstin: ownerProfile?.gstin || '',
        ownerName: ownerProfile?.businessName || '',
        ...centreFields(form.costCentre, form.costCentreName),
      };
      await saveExpense(expense);
      toast(editingId ? 'Expense updated' : 'Expense added', 'success');
      closeForm();
      loadExpenses();
    } catch {
      toast('Failed to save expense', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this expense?',
      message: 'The row is removed from your expense ledger. Any GST ITC claimed against this bill in past returns stays as filed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteExpense(id);
        toast('Expense deleted', 'success');
        loadExpenses();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // v1.10.74 - recompute GST from the NEW amount and GST % on every change
  // of either (it used the old amount), and zero it when either is empty/0.
  const updateAmountOrGST = (field, value) => setForm(prev => {
    const next = { ...prev, [field]: value };
    const base = parseFloat(next.amount) || 0;
    const pct = parseFloat(next.gstPercent) || 0;
    const gst = base > 0 && pct > 0 ? (base * pct) / (100 + pct) : 0;
    return { ...next, gstAmount: Math.round(gst * 100) / 100 };
  });

  // v1.10.77 (#85) - the expense statement: the list as filtered, oldest
  // first, with a total row; as CSV, Excel or Print / PDF. Same columns as the
  // old CSV, so a CA's sheet keeps working.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const statementRows = filtered.length ? [
    ...[...filtered].sort((x, y) => String(x.date || '').localeCompare(String(y.date || ''))).map(x => [
      x.date || '', x.description || '', x.category || '', r2(x.amount), r2(x.gstAmount), Number(x.gstPercent) || 0,
      x.vendorName || '', x.vendorGstin || '', x.invoiceNo || '', x.paymentMode || '', x.interstate ? 'Y' : 'N', x.note || '']),
    ['Total', '', '', r2(totalAmount), r2(totalGST), '', '', '', '', '', '', ''],
  ] : [];
  const statementPeriod = [
    fyOptions.find(f => f.value === fyFilter)?.label || 'all years',
    categoryFilter !== 'all' ? categoryFilter : '',
    centreFilter ? (centreFilter === UNTAGGED ? 'no cost centre' : centreLabel(centres.find(c => c.id === centreFilter))) : '',
    search.trim() ? `matching "${search.trim()}"` : '',
  ].filter(Boolean).join(', ');

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Expenses"
        help={{ title: 'Expenses — how to use', doc: 'expenses' }}
        subtitle="Track business expenses for P&L and ITC claims"
        primary={<button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>}
      />

      <UnassignedBanner
        count={unassignedExpenses.length}
        businessName={ownerProfile?.businessName}
        noun="expense"
        onAssign={assignUnassignedExpenses}
      />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* v1.10.85 (#165) - what is still to pay on the expenses shown; click to list them */}
        <button type="button" className="stat-card" onClick={() => setPayFilter(payFilter === 'due' ? 'all' : 'due')}
          title={payFilter === 'due' ? 'Show all expenses' : 'Show only Unpaid and Partly paid expenses'}
          style={{ textAlign: 'left', cursor: 'pointer', border: payFilter === 'due' ? '1px solid #d97706' : undefined }}>
          <div className="stat-icon stat-icon-amber"><Wallet size={22} /></div>
          <div><p className="stat-label">Outstanding</p><h2 className="stat-value stat-value-amber">{formatCurrency(totalDue)}</h2></div>
        </button>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Wallet size={22} /></div>
          <div><p className="stat-label">Total Expenses</p><h2 className="stat-value stat-value-purple">{formatCurrency(totalAmount)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Calendar size={22} /></div>
          <div><p className="stat-label">GST Paid (ITC)</p><h2 className="stat-value stat-value-green">{formatCurrency(totalGST)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Wallet size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search expenses..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {/* v1.10.74 - '' already means no FY filter. */}
            <option value="">All years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          {/* v1.10.74 - Clear filters also puts the FY back to the current one. */}
          <select className="filter-select" value={payFilter} onChange={e => setPayFilter(e.target.value)} aria-label="Payment">
            <option value="all">Paid and unpaid</option>
            <option value="due">Unpaid / Partly paid</option>
          </select>
          {ccOn && <CostCentreFilter centres={centres} value={centreFilter} onChange={setCentreFilter} />}
          {(search || categoryFilter !== 'all' || fyFilter !== defaultFy || centreFilter || payFilter !== 'all') && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setCategoryFilter('all'); setFyFilter(defaultFy); setCentreFilter(''); setPayFilter('all'); }} title="Clear filters" aria-label="Clear filters"><X size={15} /></button>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <h3 className="section-title">{editingId ? 'Edit Expense' : 'Add Expense'} <HelpButton title="Adding an expense" doc="expenses#add-expense" size={16} /></h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => updateField('category', e.target.value)}>
                  {CATEGORY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description *</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="e.g. AWS Hosting - March" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (incl. GST) *</label>
                <input type="number" className="form-input" value={form.amount}
                  onChange={e => updateAmountOrGST('amount', e.target.value)}
                  placeholder="0.00" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">GST % (for ITC)</label>
                <input type="number" className="form-input" value={form.gstPercent}
                  onChange={e => updateAmountOrGST('gstPercent', e.target.value)} placeholder="18" min="0" max="100" />
                {form.gstAmount > 0 && <p className="field-hint">GST: {formatCurrency(form.gstAmount)}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name</label>
                <input type="text" className="form-input" value={form.vendorName}
                  onChange={e => updateField('vendorName', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor GSTIN</label>
                <input type="text" className="form-input" value={form.vendorGstin}
                  onChange={e => updateField('vendorGstin', e.target.value)} placeholder="For ITC claim" maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice / Bill No</label>
                <input type="text" className="form-input" value={form.invoiceNo}
                  onChange={e => updateField('invoiceNo', e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="expense-payment">Payment</label>
                <select id="expense-payment" className="form-input" value={form.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}>
                  {EXPENSE_PAYMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.paymentStatus === 'partial' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="expense-paid">Paid so far</label>
                  <input id="expense-paid" type="number" className="form-input" value={form.paidAmount} min="0"
                    onChange={e => updateField('paidAmount', e.target.value)} placeholder="0.00" />
                  {Number(form.amount) > 0 && Number(form.paidAmount) > 0 && (
                    <p className="field-hint">Still to pay: {formatCurrency(Math.max(0, Number(form.amount) - Number(form.paidAmount)))}</p>
                  )}
                </div>
              )}
              {ccOn && (
                <div className="form-group">
                  <label className="form-label" htmlFor="cost-centre">Cost centre</label>
                  <CostCentreSelect centres={centres} value={form.costCentre} name={form.costCentreName}
                    onChange={(id, name) => setForm(prev => ({ ...prev, costCentre: id, costCentreName: name }))} />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state expense</strong> — vendor charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B. Common: AWS / Google / Adobe / SaaS billed from an out-of-state office. Tip: check the vendor's GSTIN — first 2 digits are their state code.
                    </span>
                  </span>
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any additional note..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Table */}
      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Expense Records <HelpButton title="Expense Records" doc="expenses#expense-list" size={16} /></h3>
          <TableExport title="Expense statement" filename={`Expenses-${statementPeriod}`} landscape
            subtitle={[ownerProfile?.businessName, statementPeriod].filter(Boolean).join(', ')}
            headers={['Date', 'Description', 'Category', 'Amount', 'GST Amount', 'GST %', 'Vendor', 'Vendor GSTIN', 'Invoice No', 'Payment Mode', 'Inter-state', 'Note']}
            rows={statementRows} />
        </div>
        {shown.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <p>{expenses.length === 0 ? 'No expenses recorded yet.' : payFilter === 'due' ? 'Nothing outstanding: every expense shown is paid.' : 'No expenses match your filters.'}</p>
            {expenses.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Expense</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <SortTh col="date" label="Date" sort={sort} onSort={toggleSort} />
                  <SortTh col="description" label="Description" sort={sort} onSort={toggleSort} />
                  <SortTh col="category" label="Category" sort={sort} onSort={toggleSort} />
                  <SortTh col="vendor" label="Vendor" sort={sort} onSort={toggleSort} />
                  <SortTh col="amount" label="Amount" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <SortTh col="gst" label="GST" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <th>Mode</th>
                  <SortTh col="payment" label="Payment" sort={sort} onSort={toggleSort} />
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(exp => (
                  <tr key={exp.id}>
                    <td className="text-muted">{exp.date ? new Date(exp.date).toLocaleDateString('en-IN') : ''}</td>
                    <td className="font-medium">{exp.description}</td>
                    <td><span className="type-badge">{exp.category}</span></td>
                    <td className="text-muted">{exp.vendorName || '-'}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }} className="text-muted">{exp.gstAmount ? formatCurrency(exp.gstAmount) : '-'}</td>
                    <td className="text-muted">{exp.paymentMode}</td>
                    <td>
                      {expenseStatus(exp) === 'paid' ? <span className="text-muted">Paid</span> : (
                        <span style={{ color: '#d97706', fontWeight: 600 }} title={`Paid ${formatCurrency(expensePaid(exp))} of ${formatCurrency(exp.amount)}`}>
                          {expenseStatus(exp) === 'unpaid' ? 'Unpaid' : 'Partly paid'} · {formatCurrency(expenseDue(exp))} due
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {/* v1.10.86 - the same order as every list: (View) · Edit · Payment · More. */}
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(exp)} title="Edit" aria-label={`Edit expense: ${exp.description || exp.category || ''}`}><Edit3 size={15} /></button>
                        {expenseDue(exp) > 0 && (
                          <button className="icon-btn icon-btn-green" onClick={() => markPaid(exp)} title="Mark as paid" aria-label="Mark as paid"><CheckCircle size={15} /></button>
                        )}
                        <ActionsMenu label="More actions for this expense" items={[
                          { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => handleDelete(exp.id) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalGST)}</td>
                  <td></td>
                  <td>{totalDue > 0 ? `${formatCurrency(totalDue)} due` : ''}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
