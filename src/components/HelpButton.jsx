import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

/*
 * v1.10.22 — Per-view help button.
 *
 * Reported: "in all tools or sidebar option there should be help button
 * in header whch will have how to use current tool."
 *
 * Consumers pass a `title` and either `children` (JSX) or a `body` string.
 * The button sits inline where dropped (typically next to a page title);
 * clicking opens a small modal explaining how to use the current view.
 * Esc closes.
 */
export default function HelpButton({ title, body, children, size = 18 }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="icon-btn" title="How to use this section"
        onClick={() => setOpen(true)}
        style={{ color: 'var(--primary)' }}>
        <HelpCircle size={size} />
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={18} style={{ color: 'var(--primary)' }} /> {title}
              </h3>
              <button className="icon-btn" onClick={() => setOpen(false)} title="Close (Esc)"><X size={18} /></button>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text)' }}>
              {children ? children : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{body}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
