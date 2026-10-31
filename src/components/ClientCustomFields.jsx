import { Plus, Trash2 } from 'lucide-react';

// Label / value pairs kept on a customer (vendor code, contact person, PO
// reference...). Used on the New Invoice page and in the client form.
// Fields with both a label and a value print in the Bill-to block.
const SUGGESTIONS = ['Contact person', 'Vendor code', 'Alternate phone', 'PAN', 'Department'];

export default function ClientCustomFields({ fields, onChange, compact = false }) {
  const list = Array.isArray(fields) ? fields : [];
  const update = (idx, patch) => onChange(list.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));
  const add = (label = '') => onChange([...list, { label, value: '' }]);
  const unused = SUGGESTIONS.filter((s) => !list.some((f) => (f.label || '').trim().toLowerCase() === s.toLowerCase()));

  return (
    <div>
      {list.map((f, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <input type="text" className="form-input" style={{ flex: '0 0 38%' }} value={f.label || ''}
            placeholder="Field name" aria-label="Custom field name"
            onChange={(e) => update(idx, { label: e.target.value })} />
          <input type="text" className="form-input" style={{ flex: 1 }} value={f.value || ''}
            placeholder="Value" aria-label={`${f.label || 'Custom field'} value`}
            onChange={(e) => update(idx, { value: e.target.value })} />
          <button type="button" className="btn btn-secondary" onClick={() => remove(idx)}
            title="Remove this field" style={{ padding: '0.3rem 0.5rem' }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={() => add()}
          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>
          <Plus size={14} /> Add field
        </button>
        {!compact && unused.slice(0, 4).map((s) => (
          <button type="button" key={s} className="btn btn-secondary" onClick={() => add(s)}
            style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
