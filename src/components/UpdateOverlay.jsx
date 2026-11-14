import { useEffect, useState } from 'react';
import { onUpdateProgress } from '../utils/updateNotice';

// v1.10.86 - over the whole app while an update runs (runUpdateNow in
// store.js): the step it is on and a bar, then the error with Close if it
// failed. On success the page reloads, so there is no "done" state here.
export default function UpdateOverlay() {
  const [state, setState] = useState(null);
  useEffect(() => onUpdateProgress(setState), []);
  if (!state) return null;
  const failed = !!state.error;
  const pct = typeof state.pct === 'number' ? Math.min(100, Math.max(0, state.pct)) : null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-overlay-title" style={{ zIndex: 10002 }}>
      <div className="modal-content" style={{ maxWidth: 460, padding: '1.75rem', textAlign: 'center' }}>
        <h3 id="update-overlay-title" style={{ margin: 0, fontSize: '1.15rem' }}>
          {failed ? 'The update did not finish' : 'Updating Free GST Billing…'}
        </h3>
        {!failed && (
          <div className={`update-bar${pct === null ? ' update-bar-moving' : ''}`} role="progressbar"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="Update progress">
            <div style={pct === null ? undefined : { width: `${pct}%` }} />
          </div>
        )}
        <p aria-live="polite" style={{ margin: failed ? '0.9rem 0 0' : 0, fontSize: '0.92rem', lineHeight: 1.5, color: failed ? '#ef4444' : undefined, overflowWrap: 'anywhere' }}>
          {failed ? state.error : state.step}
        </p>
        {failed ? (
          <button type="button" className="btn btn-primary" style={{ marginTop: '1.1rem' }} onClick={() => setState(null)}>Close</button>
        ) : (
          <p style={{ margin: '0.9rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Please do not close this window. Your books are kept as they are.
          </p>
        )}
      </div>
    </div>
  );
}
