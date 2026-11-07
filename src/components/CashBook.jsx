// v1.10.83 - the Cash book screen: a quick entry form at the top, cash in
// hand, and the book for a period with its running balance. Cash recorded on
// invoices, receipts and expenses shows here read-only (see utils/cashBook.js).
import { useState, useEffect, useRef, useMemo } from 'react';
import { Banknote, Landmark, ArrowDownLeft, ArrowUpRight, Edit3, Trash2, Search, X, Save, ExternalLink } from 'lucide-react';
import { getAllCashEntries, saveCashEntry, deleteCashEntry, getAllBills, getAllReceipts, getAllExpenses, getAllPurchases, getAllClients, getProfile } from '../store';
import { formatCurrency, belongsToProfile, localToday, parseLocalDate } from '../utils';
import { CASH_CATEGORIES, validateCashEntry, linkedCashLines, ownCashLines, cashBookView, cashSummary, periodRange } from '../utils/cashBook';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import TableExport from './TableExport';
import BankMatching from './BankMatching';

const PERIODS = [['month', 'This month'], ['lastMonth', 'Last month'], ['fy', 'This financial year'], ['all', 'All dates'], ['custom', 'Choose dates']];
const SOURCE_SCREEN = { receipts: 'Receipts', dashboard: 'the Dashboard', expenses: 'Expenses', purchases: 'Purchases' };
const emptyForm = () => ({ type: 'in', amount: '', name: '', note: '', category: '', date: localToday() });
const showDate = (d) => (d ? parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const inOut = (type, on) => ({
  flex: 1, justifyContent: 'center', fontWeight: 600, whiteSpace: 'nowrap',
  ...(on ? { background: type === 'in' ? 'var(--success)' : 'var(--danger)', color: '#fff', borderColor: 'transparent' } : {}),
});

// v1.10.85 (#175) - two tabs: the cash book, and Bank matching for the bank
// statement (money in and out of the bank, next to the cash).
export default function CashBook({ onOpenView }) {
  const [tab, setTab] = useState('cash');
  const tabs = (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="group" aria-label="Cash or bank">
      {[['cash', 'Cash', <Banknote size={16} />], ['bank', 'Bank matching', <Landmark size={16} />]].map(([id, label, icon]) => (
        <button key={id} type="button" className={`btn ${tab === id ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={tab === id} onClick={() => setTab(id)}>
          {icon} {label}
        </button>
      ))}
    </div>
  );
  return tab === 'bank' ? <BankMatching tabs={tabs} /> : <CashBookMain tabs={tabs} onOpenView={onOpenView} />;
}

function CashBookMain({ tabs, onOpenView }) {
  const [entries, setEntries] = useState([]);
  const [linked, setLinked] = useState([]);
  const [names, setNames] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // the entry being edited
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState(() => periodRange('month'));
  const amountRef = useRef(null);

  const load = async () => {
    try {
      const [own, bills, receipts, expenses, purchases, clients, prof] = await Promise.all([
        getAllCashEntries(), getAllBills(), getAllReceipts(), getAllExpenses(), getAllPurchases().catch(() => []), getAllClients().catch(() => []), getProfile().catch(() => null),
      ]);
      const mine = (rows) => (rows || []).filter((r) => belongsToProfile(r, prof));
      setProfile(prof);
      setEntries(mine(own));
      setLinked(linkedCashLines({ bills: mine(bills), receipts: mine(receipts), expenses: mine(expenses), purchases: mine(purchases) }));
      // Names to pick from: clients (shared by every business) and names used here before.
      setNames([...new Set([...(clients || []).map((c) => c.name), ...mine(own).map((e) => e.name)].filter(Boolean))].sort());
    } catch {
      toast('Could not load the cash book', 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const lines = useMemo(() => [...ownCashLines(entries), ...linked], [entries, linked]);
  const summary = cashSummary(lines);
  const range = period === 'custom' ? custom : periodRange(period);
  const book = cashBookView(lines, { ...range, search });
  const periodLabel = period === 'custom'
    ? [range.from && `from ${showDate(range.from)}`, range.to && `to ${showDate(range.to)}`].filter(Boolean).join(' ') || 'All dates'
    : PERIODS.find(([k]) => k === period)[1];

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const resetForm = () => { setForm(emptyForm()); setEditing(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const entry = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      type: form.type, date: form.date, amount: Number(form.amount),
      name: form.name, note: form.note, category: form.category,
      // A new entry belongs to the business selected now; an edited one keeps its own.
      ownerGstin: editing ? editing.ownerGstin || '' : profile?.gstin || '',
      ownerName: editing ? editing.ownerName || '' : profile?.businessName || '',
    };
    const problem = validateCashEntry(entry);
    if (problem) { toast(problem, 'warning'); amountRef.current?.focus(); return; }
    setSaving(true);
    try {
      const saved = await saveCashEntry(entry);
      setEntries((prev) => [...prev.filter((x) => x.id !== saved.id), saved]);
      if (saved.name && !names.includes(saved.name)) setNames((prev) => [...prev, saved.name].sort());
      toast(editing ? 'Entry updated' : `${form.type === 'in' ? 'Money in' : 'Money out'} of ${formatCurrency(saved.amount)} saved`, 'success');
      // Ready for the next one: same In/Out and date, the rest cleared.
      setForm((prev) => ({ ...emptyForm(), type: prev.type, date: editing ? localToday() : prev.date }));
      setEditing(null);
      amountRef.current?.focus();
    } catch (err) {
      toast(err?.message && err.status === 400 ? err.message : 'Could not save the entry. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditing(entry);
    setForm({ type: entry.type, amount: String(entry.amount), name: entry.name || '', note: entry.note || '', category: entry.category || '', date: entry.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => amountRef.current?.focus(), 50);
  };

  const handleDelete = async (entry) => {
    const ok = await confirmAction({
      title: 'Delete this cash entry?',
      message: `${entry.type === 'in' ? 'Money in' : 'Money out'} of ${formatCurrency(entry.amount)} on ${showDate(entry.date)}${entry.name ? ` (${entry.name})` : ''} is removed from the cash book, and cash in hand changes by that much.`,
      confirmLabel: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCashEntry(entry.id);
      setEntries((prev) => prev.filter((x) => x.id !== entry.id));
      if (editing?.id === entry.id) resetForm();
      toast('Entry deleted', 'success');
    } catch {
      toast('Could not delete the entry. Try again.', 'error');
    }
  };

  // For the accountant: oldest first, with the balance brought in and carried out.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const exportRows = book.rows.length ? [
    ...(range.from ? [[range.from, 'Opening balance', '', '', '', '', '', book.opening]] : []),
    ...book.rows.map((l) => [l.date, l.name, l.note, l.category, l.label || 'Cash book', l.type === 'in' ? r2(l.amount) : '', l.type === 'out' ? r2(l.amount) : '', l.balance]),
    ['', search.trim() ? `Total (matching "${search.trim()}")` : 'Total', '', '', '', book.totals.in, book.totals.out, search.trim() ? '' : book.closing],
  ] : [];

  const muted = { color: 'var(--text-muted)', fontSize: '0.8rem' };
  const field = { margin: 0, flex: '1 1 150px', minWidth: 0 };
  const money = (type) => ({ textAlign: 'right', fontWeight: 600, color: type === 'in' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' });

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Cash book <HelpButton title="Cash book" doc="cash-book" size={16} /></h1>
            <p className="page-subtitle">Cash in and out, with the cash in hand</p>
          </div>
        </div>
        {tabs}
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Banknote size={22} /></div>
          <div><p className="stat-label">Cash in hand<HelpButton title="Cash in hand" doc="cash-book#cash-in-hand" size={14} /></p><h2 className="stat-value" style={{ color: summary.inHand < 0 ? 'var(--danger)' : undefined }}>{formatCurrency(summary.inHand)}</h2></div>
        </div>
        {[['Today', summary.today], ['This month', summary.month]].map(([label, t]) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon stat-icon-green"><ArrowDownLeft size={22} /></div>
            <div>
              <p className="stat-label">{label}</p>
              <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                <span style={{ color: 'var(--success)' }}>In {formatCurrency(t.in)}</span><br />
                <span style={{ color: 'var(--danger)' }}>Out {formatCurrency(t.out)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick entry: Enter saves. */}
      <form className="glass-panel p-4 mb-6" onSubmit={handleSave} aria-label="Cash entry">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>{editing ? 'Edit entry' : 'New entry'}</h3>
          <HelpButton title={editing ? 'Edit entry' : 'Adding a cash entry'} doc={editing ? 'cash-book#edit-entry' : 'cash-book#add-entry'} size={16} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '2 1 250px' }}>
            <span className="form-label">In or out *</span>
            <div style={{ display: 'flex', gap: '0.4rem' }} role="group" aria-label="Money in or money out">
              <button type="button" className="btn btn-secondary" style={inOut('in', form.type === 'in')} aria-pressed={form.type === 'in'} onClick={() => update('type', 'in')}><ArrowDownLeft size={15} /> Money in</button>
              <button type="button" className="btn btn-secondary" style={inOut('out', form.type === 'out')} aria-pressed={form.type === 'out'} onClick={() => update('type', 'out')}><ArrowUpRight size={15} /> Money out</button>
            </div>
          </div>
          <div className="form-group" style={field}>
            <label className="form-label" htmlFor="cash-amount">Amount *</label>
            <input id="cash-amount" ref={amountRef} type="number" inputMode="decimal" min="0" step="0.01" className="form-input" placeholder="0.00"
              value={form.amount} onChange={(e) => update('amount', e.target.value)} />
          </div>
          <div className="form-group" style={field}>
            <label className="form-label" htmlFor="cash-name">Name (who / what)</label>
            <input id="cash-name" type="text" className="form-input" list="cash-names" maxLength={120} placeholder="e.g. Ramesh, milk, auto"
              value={form.name} onChange={(e) => update('name', e.target.value)} />
            <datalist id="cash-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="form-group" style={field}>
            <label className="form-label" htmlFor="cash-category">Category</label>
            <input id="cash-category" type="text" className="form-input" list="cash-categories" maxLength={60} placeholder="Pick or type"
              value={form.category} onChange={(e) => update('category', e.target.value)} />
            <datalist id="cash-categories">{CASH_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="form-group" style={field}>
            <label className="form-label" htmlFor="cash-date">Date *</label>
            <input id="cash-date" type="date" className="form-input" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div className="form-group" style={{ ...field, flex: '3 1 220px' }}>
            <label className="form-label" htmlFor="cash-note">Note</label>
            <input id="cash-note" type="text" className="form-input" maxLength={500} placeholder="Optional"
              value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 140px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}><Save size={16} /> {editing ? 'Update' : 'Save'}</button>
            {editing && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </form>

      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search name, note, category..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="search-input" aria-label="Search the cash book" />
          </div>
          <select className="filter-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Dates">
            {PERIODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {period === 'custom' && (
            <>
              <input type="date" className="form-input" style={{ width: 'auto' }} value={custom.from} aria-label="From"
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <input type="date" className="form-input" style={{ width: 'auto' }} value={custom.to} aria-label="To"
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          )}
          {(search || period !== 'month') && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setPeriod('month'); }} title="Clear filters" aria-label="Clear filters"><X size={15} /></button>
          )}
          <HelpButton title="Choosing dates and searching" doc="cash-book#filters" size={16} />
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>{periodLabel} <span style={muted}>· In {formatCurrency(book.totals.in)} · Out {formatCurrency(book.totals.out)}</span><HelpButton title="The cash book list" doc="cash-book#list" size={16} /></h3>
          <TableExport title="Cash book" filename={`Cash-book-${periodLabel}`}
            subtitle={[profile?.businessName, periodLabel, search.trim() ? `matching "${search.trim()}"` : ''].filter(Boolean).join(', ')}
            headers={['Date', 'Name', 'Note', 'Category', 'From', 'Money in', 'Money out', 'Balance']} rows={exportRows} />
        </div>
        {book.rows.length === 0 ? (
          <div className="empty-state">
            <Banknote size={48} />
            <p>{lines.length === 0 ? 'No cash entries yet. Add your cash in hand today as Money in, category Opening balance, to start.' : 'Nothing in these dates.'}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '720px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name / note</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Money in</th>
                  <th style={{ textAlign: 'right' }}>Money out</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {range.from && (
                  <tr style={muted}>
                    <td>{showDate(range.from)}</td>
                    <td colSpan={4} style={{ fontStyle: 'italic' }}>Opening balance (brought forward)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(book.opening)}</td>
                    <td />
                  </tr>
                )}
                {book.rows.map((l) => (
                  <tr key={l.key}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{showDate(l.date)}</td>
                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 320 }}>
                      <div className="font-medium">{l.name || (l.type === 'in' ? 'Money in' : 'Money out')}</div>
                      {l.note && <div style={muted}>{l.note}</div>}
                    </td>
                    <td>
                      {l.category && <span className="type-badge">{l.category}</span>}
                      {l.source !== 'own' && (
                        <button type="button" className="type-badge" onClick={() => onOpenView?.(l.view)}
                          title={`Made on ${SOURCE_SCREEN[l.view]}: change it there`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: '1px dashed var(--border-color)', marginLeft: l.category ? 4 : 0 }}>
                          {l.label} <ExternalLink size={11} />
                        </button>
                      )}
                    </td>
                    <td style={money('in')}>{l.type === 'in' ? formatCurrency(l.amount) : ''}</td>
                    <td style={money('out')}>{l.type === 'out' ? formatCurrency(l.amount) : ''}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: l.balance < 0 ? 'var(--danger)' : undefined }}>{formatCurrency(l.balance)}</td>
                    <td>
                      {l.source === 'own' && (
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button className="icon-btn icon-btn-blue" onClick={() => startEdit(l.entry)} title="Edit" aria-label={`Edit ${l.name || 'entry'}`}><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(l.entry)} title="Delete" aria-label={`Delete ${l.name || 'entry'}`}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3}>{search.trim() ? 'Total of these lines' : 'Closing balance'}</td>
                  <td style={money('in')}>{formatCurrency(book.totals.in)}</td>
                  <td style={money('out')}>{formatCurrency(book.totals.out)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{search.trim() ? '' : formatCurrency(book.closing)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
