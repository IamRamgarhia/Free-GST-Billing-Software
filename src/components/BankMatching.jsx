// v1.10.85 (#175) - Bank matching, a tab of the Cash book: import a bank
// statement (CSV or Excel) and match each line to what is in the books. The
// matching rules are in utils/bankMatch.js; the payments Confirm records go
// on the invoice or bill, as Record Payment does, so balances, status,
// receipts and the cash book follow.
import { useState, useEffect, useMemo, useRef } from 'react';
import { Landmark, Upload, Check, Search, EyeOff, Receipt, Undo2, Trash2, ArrowDownLeft, ArrowUpRight, ListChecks } from 'lucide-react';
import {
  getAllBankStatements, saveBankStatement, deleteBankStatement, getAllBills, getAllPurchases, getAllExpenses, getAllDebitNotes, getProfile,
  saveBill, saveReceipt, deleteReceipt, savePurchase, saveExpense, deleteExpense,
} from '../store';
import { formatCurrency, belongsToProfile, parseLocalDate } from '../utils';
import { parseBankRows, BANK_NAMES } from '../utils/itr';
import { fileToSheets } from '../utils/importFile';
import { withReturns } from '../utils/debitNotes';
import { newPurchasePaymentId } from '../utils/purchasePayments';
import {
  toBankLines, freshLines, bookEntries, usedKeys, suggestFor, pickList, entryLabel, matchedLine, ignoredLine, expenseLine, openLine,
  bankPayment, newInvoicePaymentId, invoiceWithPayment, receiptForPayment, expenseFromLine, bankSummary,
  purchaseWithPayments, payStateOf, withoutBankPayment,
} from '../utils/bankMatch';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import PageHeader from './PageHeader';
import ComboInput from './ComboInput';

const FILTERS = [['open', 'To match'], ['all', 'All lines'], ['done', 'Matched'], ['ignored', 'Ignored']];
const SHOW_MAX = 300; // ponytail: a plain list; search or pick a statement to see older lines.
const EXPENSE_PAY_KEYS = ['paymentStatus', 'paidAmount', 'paymentMode'];
const PART_LINES = 1000; // the server takes up to 2,000 lines in one statement
// A payment's receipt is deleted before the payment, so a receipt left behind
// can never bring the payment back. Gone already (404) is fine.
const removeReceipt = async (id) => {
  try { await deleteReceipt(id); } catch (err) { if (err?.status !== 404) throw err; }
};
const showDate = (d) => (d ? parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const amountOf = (l) => (l.credit > 0 ? l.credit : l.debit);
const keep = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));
const drop = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const PILL = { matched: ['Matched', 'var(--success)'], expense: ['Added as expense', 'var(--success)'], ignored: ['Ignored', 'var(--text-muted)'] };

export default function BankMatching({ tabs }) {
  const [statements, setStatements] = useState([]);
  const [books, setBooks] = useState({ bills: [], purchases: [], expenses: [] });
  const [profile, setProfile] = useState(null);
  const [bank, setBank] = useState('');
  const [filter, setFilter] = useState('open');
  const [statementId, setStatementId] = useState('');
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(null); // line id with the hand-pick panel open
  const [pickSearch, setPickSearch] = useState('');
  const [category, setCategory] = useState('Bank Charges');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [st, bills, purchases, expenses, notes, prof] = await Promise.all([
        getAllBankStatements(), getAllBills(), getAllPurchases().catch(() => []), getAllExpenses().catch(() => []),
        getAllDebitNotes().catch(() => []), getProfile().catch(() => null),
      ]);
      const mine = (rows) => (rows || []).filter((r) => belongsToProfile(r, prof));
      setProfile(prof);
      setStatements(mine(st));
      setBooks({ bills: mine(bills), purchases: mine(purchases), expenses: mine(expenses), returned: withReturns(mine(purchases), mine(notes)) });
    } catch {
      toast('Could not load bank matching', 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const lines = useMemo(() => statements.flatMap((st) => (st.lines || []).map((l) => ({ ...l, statementId: st.id })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [statements]);
  const entries = useMemo(() => bookEntries({ bills: books.bills, purchases: books.returned || books.purchases, expenses: books.expenses }), [books]);
  const used = useMemo(() => usedKeys(lines), [lines]);
  const suggestions = useMemo(() => new Map(lines.filter((l) => l.status === 'open').map((l) => [l.id, suggestFor(l, entries, used)])), [lines, entries, used]);
  const categories = useMemo(() => [...new Set(['Bank Charges', ...books.expenses.map((e) => e.category), 'Other'].filter(Boolean))], [books]);

  const inStatement = statementId ? lines.filter((l) => l.statementId === statementId) : lines;
  const summary = bankSummary(inStatement);
  const q = search.trim().toLowerCase();
  const shown = inStatement.filter((l) => (filter === 'all' || (filter === 'open' ? l.status === 'open' : filter === 'ignored' ? l.status === 'ignored' : ['matched', 'expense'].includes(l.status))))
    .filter((l) => !q || `${l.description} ${l.reference} ${amountOf(l).toFixed(2)} ${l.match?.label || ''}`.toLowerCase().includes(q));

  const handleFile = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const sheets = await fileToSheets(file, 'bank');
      const sheet = sheets.find((s) => s.rows.length >= 2) || sheets[0];
      const parsed = parseBankRows(sheet?.rows || [], bank);
      const id = `bst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const incoming = toBankLines(parsed.transactions, id);
      if (!incoming.length) { toast('No transactions found. Use the CSV or Excel statement your bank lets you download.', 'warning'); return; }
      const fresh = freshLines(lines, incoming);
      if (!fresh.length) { toast(`All ${incoming.length} lines of this statement are already here. Nothing was added.`, 'info', 5000); return; }
      // A long statement is kept in parts of PART_LINES lines, so saving one
      // matched line never sends a huge file.
      const parts = Math.ceil(fresh.length / PART_LINES);
      const added = [];
      for (let i = 0; i < parts; i++) {
        const name = String(file.name || '').slice(0, 100);
        const statement = {
          id: i ? `${id}p${i + 1}` : id, bankName: parsed.bankName, fileName: parts > 1 ? `${name} (part ${i + 1} of ${parts})` : name,
          importedAt: new Date().toISOString(), ownerGstin: profile?.gstin || '', ownerName: profile?.businessName || '',
          lines: fresh.slice(i * PART_LINES, (i + 1) * PART_LINES),
        };
        await saveBankStatement(statement);
        added.push(statement);
      }
      setStatements((prev) => [...added, ...prev]);
      setFilter('open');
      const skipped = incoming.length - fresh.length;
      toast(`${fresh.length} lines read (${parsed.bankName})${skipped ? `; ${skipped} already here, skipped` : ''}`, 'success', 5000);
    } catch (err) {
      toast(err?.status === 400 && err.message ? err.message : `Could not read this statement. ${err?.message && !err.status ? err.message : 'Supported banks: ' + BANK_NAMES.join(', ') + '.'}`, 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  // Saves one line of its statement.
  const saveLine = async (next) => {
    const st = statements.find((s) => s.id === next.statementId);
    const clean = drop(next, ['statementId']);
    const updated = { ...st, lines: st.lines.map((l) => (l.id === clean.id ? clean : l)) };
    await saveBankStatement(updated);
    setStatements((prev) => prev.map((s) => (s.id === st.id ? updated : s)));
  };
  // The bill with its returns (_returned), so its status counts them; never saved with them.
  const purchaseOf = (id) => (books.returned || books.purchases).find((x) => x.id === id) || null;

  // Run one action; reload the books after, so balances and suggestions follow.
  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setPicking(null);
      await load();
    } catch (err) {
      toast(err?.status >= 400 && err.status < 500 && err.message ? err.message : 'Could not save. Try again.', 'error', 6000);
    } finally {
      setBusy(false);
    }
  };

  // Saves the line once its invoice, bill or expense has changed. If the
  // line cannot be saved, the change is taken back, so the books never
  // carry a payment no line accounts for.
  const saveLineOrRollBack = async (next, rollBack, label) => {
    try {
      await saveLine(next);
      return true;
    } catch {
      try {
        await rollBack();
        toast(`Could not save the match, so ${label} was taken back. Try again.`, 'error', 7000);
      } catch {
        toast(`Could not save the match, and ${label} could not be taken back. Check it before trying again.`, 'error', 9000);
      }
      return false;
    }
  };

  const confirmMatch = (line, entry) => act(async () => {
    const extra = {};
    let rollBack = async () => {};
    if (entry.record && entry.kind === 'invoice') {
      const bill = books.bills.find((b) => b.id === entry.id);
      if (!bill) throw new Error('missing');
      // As on the Dashboard: more than the balance becomes client credit.
      if (amountOf(line) > entry.amount + 0.01) {
        const ok = await confirmAction({
          title: 'Record as overpayment?',
          message: `This payment (${formatCurrency(amountOf(line))}) is more than the balance of ${entry.number} (${formatCurrency(entry.amount)}).\n\nThe extra will be saved as client credit and can be applied to future invoices.`,
          confirmLabel: 'Yes, record overpayment', tone: 'warning',
        });
        if (!ok) return;
      }
      const payment = bankPayment(line, newInvoicePaymentId());
      const updated = invoiceWithPayment(bill, payment);
      extra.before = payStateOf(bill);
      await saveBill(updated, { overwrite: true });
      try { await saveReceipt(receiptForPayment(updated, payment)); } catch { /* as on the Dashboard: the payment is on the invoice */ }
      extra.paymentId = payment.id;
      rollBack = async () => { await removeReceipt(payment.id); await saveBill(bill, { overwrite: true }); };
    } else if (entry.record && entry.kind === 'purchase') {
      const p = purchaseOf(entry.id);
      if (!p) throw new Error('missing');
      const payment = bankPayment(line, newPurchasePaymentId());
      extra.before = payStateOf(p);
      await savePurchase(purchaseWithPayments(p, [...(p.payments || []), payment]));
      extra.paymentId = payment.id;
      rollBack = () => savePurchase(drop(p, ['_returned']));
    } else if (entry.record && entry.kind === 'expense') {
      const e = books.expenses.find((x) => x.id === entry.id);
      if (!e) throw new Error('missing');
      extra.before = keep(e, EXPENSE_PAY_KEYS);
      await saveExpense({ ...e, paymentStatus: 'paid', paidAmount: Number(e.amount) || 0, paymentMode: 'Bank Transfer' });
      rollBack = () => saveExpense(e);
    }
    if (!await saveLineOrRollBack(matchedLine(line, entry, extra), rollBack, entry.kind === 'expense' ? 'the expense' : 'the payment')) return;
    toast(entry.record ? `Matched; the payment is recorded on ${entryLabel(entry)}` : `Matched to ${entryLabel(entry)}`, 'success');
  });

  const ignore = (line) => act(async () => { await saveLine(ignoredLine(line)); toast('Line ignored', 'success'); });

  const addExpense = (line) => act(async () => {
    const saved = await saveExpense(expenseFromLine(line, profile, category));
    if (!await saveLineOrRollBack(expenseLine(line, saved), () => deleteExpense(saved.id), 'the new expense')) return;
    toast(`Added as an expense (${saved.category}) of ${formatCurrency(saved.amount)}`, 'success');
  });

  const undo = async (line) => {
    const m = line.match || {};
    const changesBooks = (line.status === 'matched' && m.recorded) || (line.status === 'expense' && m.created);
    if (changesBooks) {
      const ok = await confirmAction({
        title: 'Undo this line?',
        message: line.status === 'expense'
          ? `The expense of ${formatCurrency(amountOf(line))} added from this line is deleted.`
          : `The payment of ${formatCurrency(amountOf(line))} recorded on ${m.label} is taken back, and its balance goes up again.`,
        confirmLabel: 'Undo', tone: 'warning',
      });
      if (!ok) return;
    }
    act(async () => {
      if (line.status === 'matched' && m.recorded && m.kind === 'invoice') {
        const bill = books.bills.find((b) => b.id === m.id);
        if (bill) {
          // The receipt first: if it cannot be deleted, the payment stays too.
          await removeReceipt(m.paymentId);
          await saveBill(withoutBankPayment('invoice', bill, m.paymentId, m.before), { overwrite: true });
        }
      } else if (line.status === 'matched' && m.recorded && m.kind === 'purchase') {
        const p = purchaseOf(m.id);
        if (p) await savePurchase(withoutBankPayment('purchase', p, m.paymentId, m.before));
      } else if (line.status === 'matched' && m.recorded && m.kind === 'expense') {
        const e = books.expenses.find((x) => x.id === m.id);
        if (e && m.before) await saveExpense({ ...drop(e, EXPENSE_PAY_KEYS), ...m.before });
      } else if (line.status === 'expense' && m.created) {
        await deleteExpense(m.id);
      }
      await saveLine(openLine(line));
      toast('Undone', 'success');
    });
  };

  const removeStatement = async () => {
    const st = statements.find((s) => s.id === statementId);
    if (!st) return;
    if (st.lines.some((l) => (l.status === 'matched' && l.match?.recorded) || l.status === 'expense')) {
      toast('Undo the lines of this statement that recorded a payment or added an expense first.', 'warning', 5000); return;
    }
    const ok = await confirmAction({
      title: 'Remove this statement?',
      message: `${st.bankName} statement ${st.fileName} (${st.lines.length} lines) is removed from Bank matching. Invoices, bills and expenses are not changed.`,
      confirmLabel: 'Remove', tone: 'danger',
    });
    if (!ok) return;
    act(async () => { await deleteBankStatement(st.id); setStatementId(''); toast('Statement removed', 'success'); });
  };

  const muted = { color: 'var(--text-muted)', fontSize: '0.78rem' };
  const money = (type) => ({ textAlign: 'right', fontWeight: 600, color: type === 'in' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' });
  const entryLine = (e) => `${showDate(e.date)} · ${formatCurrency(e.amount)}${e.record ? (e.kind === 'expense' ? ' · unpaid: Confirm marks it paid' : ' due · Confirm records the payment') : ' · already in the books'}`;

  const pickPanel = (line) => {
    const best = suggestions.get(line.id) || [];
    const keys = new Set(best.map((e) => e.key));
    const others = pickList(line, entries, used, pickSearch).filter((e) => !keys.has(e.key));
    const row = (e, why) => (
      <li key={e.key} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div className="font-medium">{entryLabel(e)}</div>
          <div style={muted}>{entryLine(e)}{why ? ` · ${why.join(', ')}` : ''}</div>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => confirmMatch(line, e)} aria-label={`Match to ${entryLabel(e)}`}><Check size={15} /> Use</button>
      </li>
    );
    return (
      <tr key={`${line.id}-pick`}>
        <td colSpan={6} style={{ background: 'var(--bg-secondary, rgba(100,116,139,0.06))', textAlign: 'left', whiteSpace: 'normal' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong>Match {formatCurrency(amountOf(line))} by hand</strong>
            <div className="search-box" style={{ maxWidth: 280 }}>
              <Search size={16} className="search-icon" />
              <input type="text" className="search-input" placeholder="Invoice no., name or amount" value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} aria-label="Find an invoice, bill or expense" autoFocus />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setPicking(null)}>Close</button>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {best.map((e) => row(e, e.why))}
            {others.map((e) => row(e))}
            {!best.length && !others.length && <li style={muted}>Nothing in the books fits. {line.debit > 0 ? 'Add it as an expense below, or ignore it.' : 'Ignore it if it is not a sale (a loan, your own transfer).'}</li>}
          </ul>
          {line.debit > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.75rem' }}>
              <label className="form-label" htmlFor="bank-exp-cat" style={{ margin: 0 }}>Or add as an expense, category</label>
              <ComboInput id="bank-exp-cat" className="form-input" style={{ width: 200 }} options={categories} listLabel="Expense categories" maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => addExpense(line)}><Receipt size={15} /> Add as expense</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const matchCell = (line) => {
    if (line.status !== 'open') {
      const [label, color] = PILL[line.status];
      return (
        <>
          <span className="status-pill" style={{ '--pill-color': color }}>{label}</span>
          {line.match?.label && <div className="font-medium" style={{ marginTop: 2 }}>{line.match.label}</div>}
          {line.match?.recorded && <div style={muted}>Payment recorded from this line</div>}
        </>
      );
    }
    const best = (suggestions.get(line.id) || [])[0];
    if (!best) return <span style={muted}>No match found</span>;
    return (
      <>
        <div className="font-medium">{entryLabel(best)}</div>
        <div style={muted}>{entryLine(best)}</div>
        <div style={{ ...muted, fontStyle: 'italic' }}>{best.why.join(', ')}</div>
      </>
    );
  };

  const statCard = (icon, color, label, value, sub) => (
    <div className="stat-card">
      <div className={`stat-icon stat-icon-${color}`}>{icon}</div>
      <div><p className="stat-label">{label}</p><h2 className="stat-value">{value}</h2>{sub && <div style={muted}>{sub}</div>}</div>
    </div>
  );

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Bank matching"
        help={{ title: 'Bank matching', doc: 'cash-book#bank-matching' }}
        subtitle="Your bank statement, matched to invoices, bills and expenses"
        extras={tabs}
      />

      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="bank-name">Bank</label>
            <select id="bank-name" className="filter-select" value={bank} onChange={(e) => setBank(e.target.value)}>
              <option value="">Find out from the file</option>
              {BANK_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import statement (CSV or Excel)
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" style={{ display: 'none' }} aria-label="Bank statement file"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          <HelpButton title="Importing a statement" doc="cash-book#bank-import" size={16} />
        </div>
        <p style={{ ...muted, margin: '0.5rem 0 0' }}>Download the statement from net-banking as CSV or Excel (.xlsx). Lines already imported are skipped, so an overlapping statement is safe.</p>
      </div>

      {lines.length > 0 && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {statCard(<ListChecks size={22} />, 'blue', 'Lines', summary.lines, `${statements.length} statement${statements.length === 1 ? '' : 's'}`)}
          {statCard(<Check size={22} />, 'green', 'Matched', summary.matched, summary.ignored ? `${summary.ignored} ignored` : '')}
          {statCard(<Landmark size={22} />, 'amber', 'To match', summary.unmatched, `In ${formatCurrency(summary.unmatchedIn)} · Out ${formatCurrency(summary.unmatchedOut)}`)}
          {statCard(<ArrowDownLeft size={22} />, 'purple', 'Money in / out', formatCurrency(summary.moneyIn), `Out ${formatCurrency(summary.moneyOut)}`)}
        </div>
      )}

      {lines.length > 0 && (
        <div className="glass-panel p-4 mb-6">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-box" style={{ maxWidth: '300px' }}>
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search description, reference, amount..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="search-input" aria-label="Search the bank lines" />
            </div>
            <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Which lines">
              {FILTERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select className="filter-select" value={statementId} onChange={(e) => setStatementId(e.target.value)} aria-label="Statement">
              <option value="">All statements</option>
              {statements.map((s) => <option key={s.id} value={s.id}>{`${s.bankName} · ${s.fileName || ''} · ${(s.lines || []).length} lines`}</option>)}
            </select>
            {statementId && (
              <button className="icon-btn icon-btn-red" onClick={removeStatement} title="Remove this statement" aria-label="Remove this statement"><Trash2 size={15} /></button>
            )}
          </div>
        </div>
      )}

      <div className="glass-panel">
        {lines.length === 0 ? (
          <div className="empty-state">
            <Landmark size={48} />
            <p>No bank statement yet. Import one above to match it to your invoices, bills and expenses.</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state"><Check size={48} /><p>{filter === 'open' ? 'Every line is matched or ignored.' : 'No lines here.'}</p></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Money in</th>
                  <th style={{ textAlign: 'right' }}>Money out</th>
                  <th>Match <HelpButton title="How lines are matched" doc="cash-book#bank-suggestions" size={14} /></th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, SHOW_MAX).flatMap((l) => {
                  const best = (suggestions.get(l.id) || [])[0];
                  const row = (
                    <tr key={l.id} data-bank-line={l.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{showDate(l.date)}</td>
                      <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 300 }}>
                        <div>{l.description || (l.credit > 0 ? 'Money in' : 'Money out')}</div>
                        {l.reference && <div style={muted}>Ref {l.reference}</div>}
                      </td>
                      <td style={money('in')}>{l.credit > 0 ? formatCurrency(l.credit) : ''}</td>
                      <td style={money('out')}>{l.debit > 0 ? formatCurrency(l.debit) : ''}</td>
                      <td style={{ whiteSpace: 'normal', maxWidth: 320 }}>{matchCell(l)}</td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          {l.status === 'open' ? (
                            <>
                              {best && <button className="icon-btn icon-btn-green" disabled={busy} onClick={() => confirmMatch(l, best)} title={best.record ? 'Confirm: match and record the payment' : 'Confirm the match'} aria-label={`Confirm match for ${l.description}`}><Check size={15} /></button>}
                              <button className="icon-btn icon-btn-blue" onClick={() => { setPicking(picking === l.id ? null : l.id); setPickSearch(''); }} title={l.debit > 0 ? 'Pick a match, or add as an expense' : 'Pick a match'} aria-label={`Pick a match for ${l.description}`}>{l.debit > 0 ? <Receipt size={15} /> : <Search size={15} />}</button>
                              <button className="icon-btn icon-btn-red" disabled={busy} onClick={() => ignore(l)} title="Ignore (bank charges you do not track, own transfers)" aria-label={`Ignore ${l.description}`}><EyeOff size={15} /></button>
                            </>
                          ) : (
                            <button className="icon-btn icon-btn-blue" disabled={busy} onClick={() => undo(l)} title="Undo" aria-label={`Undo ${l.description}`}><Undo2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  return picking === l.id ? [row, pickPanel(l)] : [row];
                })}
              </tbody>
            </table>
            {shown.length > SHOW_MAX && <p style={{ ...muted, padding: '0.75rem 1rem' }}>Showing the newest {SHOW_MAX} of {shown.length} lines. Search, or choose a statement, to see the others.</p>}
          </div>
        )}
      </div>
      <p style={{ ...muted, marginTop: '0.75rem' }}><ArrowUpRight size={12} /> Payments recorded here use mode Bank transfer, so they are not in the cash book (it counts cash only).</p>
    </div>
  );
}
