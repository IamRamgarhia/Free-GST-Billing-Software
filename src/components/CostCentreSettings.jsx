// v1.10.83 (#112) - Settings > Cost centres: add, rename and archive the
// branches, sites or projects of the business shown. There is no delete: old
// documents and reports still point at a centre, so it is archived instead
// (it stops showing in the pickers, and stays in lists and reports).
import { useState, useEffect } from 'react';
import { Plus, Edit3, Archive, RotateCcw } from 'lucide-react';
import { getCostCentres, saveCostCentres } from '../store';
import { businessKeyOf } from '../utils';
import { centresForBusiness, centreLabel } from '../utils/costCentres';
import { toast } from './Toast';
import HelpButton from './HelpButton';
import EditDialog from './EditDialog';

const MAX_NAME = 60;
const newId = () => `cc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function CostCentreSettings({ profile }) {
  const [all, setAll] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState(null); // v1.10.86 - { id, name, code } in the Edit window
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCostCentres().then(setAll).catch(() => toast('Could not load cost centres', 'error')); }, []);
  const mine = centresForBusiness(all, profile);

  // Re-read before writing, so a second open tab's changes are not lost.
  const update = async (change, done) => {
    setBusy(true);
    try {
      const next = change(await getCostCentres());
      await saveCostCentres(next);
      setAll(next);
      toast(done, 'success');
      return true;
    } catch {
      toast('Could not save cost centres', 'error');
      return false;
    } finally { setBusy(false); }
  };

  // The tidied name, or null (and a message) when it cannot be used.
  const checkName = (raw, id) => {
    const n = raw.trim().replace(/\s+/g, ' ');
    if (!n) { toast('Enter a name for the cost centre', 'warning'); return null; }
    if (n.length > MAX_NAME) { toast(`Keep the name under ${MAX_NAME} letters`, 'warning'); return null; }
    if (mine.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) { toast('A cost centre with this name already exists', 'warning'); return null; }
    return n;
  };

  const submit = async (e) => {
    e.preventDefault();
    const n = checkName(name, null);
    if (!n) return;
    const ok = await update((list) => [...list, { id: newId(), name: n, code: code.trim(), archived: false, business: businessKeyOf(profile) }], 'Cost centre added');
    if (ok) { setName(''); setCode(''); }
  };

  const saveEdit = async () => {
    const n = checkName(editing.name, editing.id);
    if (!n) return;
    const c = editing.code.trim();
    if (await update((list) => list.map((x) => (x.id === editing.id ? { ...x, name: n, code: c } : x)), 'Cost centre saved')) setEditing(null);
  };

  const setArchived = (id, archived) => update(
    (list) => list.map((x) => (x.id === id ? { ...x, archived } : x)),
    archived ? 'Archived. Old documents keep it.' : 'Cost centre is active again');

  return (
    <div className="glass-panel p-6 mb-6">
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>Cost centres <HelpButton title="Cost centres" doc="reports#cost-centres" size={16} style={{ marginLeft: 6 }} /></h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
        Your branches, sites or projects{profile?.businessName ? ` for ${profile.businessName}` : ''}. Pick one on an invoice, purchase bill or expense,
        then see each one's profit in Reports, <strong>By cost centre</strong>.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div className="form-group" style={{ margin: 0, flex: '2 1 220px' }}>
          <label className="form-label" htmlFor="cc-name">Name</label>
          <input id="cc-name" className="form-input" value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site A - Ludhiana" />
        </div>
        <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}>
          <label className="form-label" htmlFor="cc-code">Code (optional)</label>
          <input id="cc-code" className="form-input" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} placeholder="e.g. LDH" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}><Plus size={16} /> Add cost centre</button>
      </form>
      {editing && (
        <EditDialog title="Edit cost centre" help="reports#cost-centres" saving={busy} onSave={saveEdit} onClose={() => setEditing(null)}>
          <div className="ed-grid">
            <div className="form-group ed-wide">
              <label className="form-label" htmlFor="cc-edit-name">Name</label>
              <input id="cc-edit-name" className="form-input" value={editing.name} maxLength={MAX_NAME}
                onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Site A - Ludhiana" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cc-edit-code">Code (optional)</label>
              <input id="cc-edit-code" className="form-input" value={editing.code} maxLength={20}
                onChange={(e) => setEditing((x) => ({ ...x, code: e.target.value }))} placeholder="e.g. LDH" />
            </div>
          </div>
        </EditDialog>
      )}
      {mine.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No cost centres yet.</p>
      ) : (
        <div className="table-scroll">
          {/* data-table's 1100px minimum is for the invoice list; three short columns fit a phone */}
          <table className="data-table" style={{ minWidth: 0 }}>
            <thead><tr><th>Name (code)</th><th>Status</th><th className="col-center">Actions</th></tr></thead>
            <tbody>
              {mine.map((c) => (
                <tr key={c.id} style={c.archived ? { opacity: 0.6 } : undefined}>
                  <td className="font-medium" style={{ whiteSpace: 'normal' }}>{centreLabel(c)}</td>
                  <td>{c.archived ? 'Archived' : 'Active'}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="icon-btn icon-btn-blue" disabled={busy} title="Edit" aria-label={`Edit ${c.name}`}
                        onClick={() => setEditing({ id: c.id, name: c.name, code: c.code || '' })}><Edit3 size={15} /></button>
                      {c.archived ? (
                        <button type="button" className="icon-btn" disabled={busy} title="Restore" aria-label={`Restore ${c.name}`} onClick={() => setArchived(c.id, false)}><RotateCcw size={15} /></button>
                      ) : (
                        <button type="button" className="icon-btn icon-btn-red" disabled={busy} title="Archive" aria-label={`Archive ${c.name}`} onClick={() => setArchived(c.id, true)}><Archive size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
