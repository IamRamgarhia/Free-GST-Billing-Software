// v1.10.86 - "Customise Dashboard": show or hide each block, move it up or
// down, and choose the screen the app opens on. Per browser (listPrefs.js).
import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import HelpButton from './HelpButton';
import { DASHBOARD_BLOCKS, DEFAULT_LAYOUT, moveBlock, toggleBlock, START_VIEW_KEY, START_VIEWS } from '../utils/listPrefs';

const LABELS = Object.fromEntries(DASHBOARD_BLOCKS);
const readStart = () => { try { return localStorage.getItem(START_VIEW_KEY) || 'dashboard'; } catch { return 'dashboard'; } };

export default function DashboardCustomise({ layout, onChange, onClose }) {
  const [start, setStart] = useState(readStart);
  const changeStart = (v) => {
    setStart(v);
    try { if (v === 'dashboard') localStorage.removeItem(START_VIEW_KEY); else localStorage.setItem(START_VIEW_KEY, v); } catch { /* private mode */ }
  };
  const reset = () => { onChange(DEFAULT_LAYOUT); changeStart('dashboard'); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dash-customise" role="dialog" aria-modal="true" aria-labelledby="dash-customise-title"
        onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <h3 id="dash-customise-title" className="section-title" style={{ margin: 0, flex: 1 }}>
            Customise Dashboard <HelpButton title="Customise Dashboard" doc="dashboard#customise" size={16} />
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
          Tick what to show and move it up or down. Kept in this browser.
        </p>
        <ul className="dash-customise-list">
          {layout.order.map((id, i) => {
            const shown = !layout.hidden.includes(id);
            return (
              <li key={id} className={shown ? '' : 'is-hidden'}>
                <label>
                  <input type="checkbox" checked={shown} onChange={() => onChange(toggleBlock(layout, id))} />
                  {LABELS[id]}
                </label>
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => onChange(moveBlock(layout, id, -1))}
                  aria-label={`Move ${LABELS[id]} up`} title="Move up"><ArrowUp size={15} /></button>
                <button type="button" className="icon-btn" disabled={i === layout.order.length - 1} onClick={() => onChange(moveBlock(layout, id, 1))}
                  aria-label={`Move ${LABELS[id]} down`} title="Move down"><ArrowDown size={15} /></button>
              </li>
            );
          })}
        </ul>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="start-view" className="form-label">Open the app on</label>
          <select id="start-view" className="form-input" value={start} onChange={(e) => changeStart(e.target.value)}>
            {START_VIEWS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>
            When you open the app. Going back to a screen while you work is not changed.
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className="btn btn-secondary" onClick={reset}>Reset</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
