import { useState, useEffect } from 'react';
import { HelpCircle, X, BookOpen } from 'lucide-react';
import { docsLink } from '../utils';

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
 *
 * `doc` ("page" or "page#section") adds a link to that part of the online
 * documentation, which opens in a new tab.
 */
export default function HelpButton({ title, body, children, doc, size = 18 }) {
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
            {doc && (
              <a href={docsLink(doc)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"
                style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <BookOpen size={16} /> Read the full guide
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
