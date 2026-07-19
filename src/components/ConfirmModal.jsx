import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

// v1.10.34 — In-app replacement for `window.confirm()` and `window.prompt()`.
// The native dialogs look like OS chrome (title bar with the URL, generic
// OK/Cancel buttons, no branding, no icon), which broke the product's
// visual identity every time the user hit Delete on an invoice. Now every
// destructive / decision-requiring action opens a proper themed modal that
// matches the rest of the app.
//
// API mirrors the native calls so replacement is mechanical:
//   BEFORE:  if (!confirm('Delete this invoice?')) return;
//   AFTER:   if (!await confirmAction({ title: 'Delete invoice?', ... })) return;
//
//   BEFORE:  const v = window.prompt('Custom rate (%)', '12');
//   AFTER:   const v = await promptAction({ title: 'Custom rate (%)', defaultValue: '12' });
//
// The container mounts once at App root. All active calls are queued; only
// one modal shows at a time so the visual flow stays clean.

let dispatchFn = null;

/**
 * Open an in-app confirmation modal.
 *
 * @param {Object} options
 * @param {string} options.title - Bold headline of the modal
 * @param {string} [options.message] - Optional detail below the title
 * @param {string} [options.confirmLabel='Confirm'] - Text on the primary action button
 * @param {string} [options.cancelLabel='Cancel'] - Text on the secondary/dismiss button
 * @param {'danger'|'warning'|'default'} [options.tone='default'] - Colour scheme
 * @returns {Promise<boolean>} - true if user confirmed, false if cancelled or dismissed
 */
export function confirmAction(options) {
  return new Promise((resolve) => {
    if (typeof dispatchFn !== 'function') {
      // Container not mounted yet — fall back to native so calls made
      // pre-mount don't silently return undefined.
      resolve(window.confirm(options?.message || options?.title || 'Are you sure?'));
      return;
    }
    dispatchFn({ ...options, kind: 'confirm', resolve });
  });
}

/**
 * Open an in-app text-prompt modal.
 *
 * @param {Object} options
 * @param {string} options.title - Bold headline of the modal (what to enter)
 * @param {string} [options.message] - Optional hint below the title
 * @param {string} [options.defaultValue] - Prefilled input value
 * @param {string} [options.placeholder] - Input placeholder text
 * @param {string} [options.confirmLabel='OK'] - Text on the primary button
 * @param {string} [options.cancelLabel='Cancel'] - Text on the dismiss button
 * @param {'text'|'number'} [options.inputType='text'] - HTML input type
 * @returns {Promise<string|null>} - the entered string, or null on cancel
 */
export function promptAction(options) {
  return new Promise((resolve) => {
    if (typeof dispatchFn !== 'function') {
      resolve(window.prompt(options?.message || options?.title || '', options?.defaultValue || ''));
      return;
    }
    dispatchFn({ ...options, kind: 'prompt', resolve });
  });
}

export default function ConfirmModalContainer() {
  const [modal, setModal] = useState(null);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const previousActiveElement = useRef(null);

  const dispatch = useCallback((next) => {
    setModal(next);
    setValue(next?.defaultValue || '');
  }, []);

  useEffect(() => {
    dispatchFn = dispatch;
    return () => { dispatchFn = null; };
  }, [dispatch]);

  // Autofocus the input on prompt, or the confirm button on confirm.
  useEffect(() => {
    if (!modal) {
      // Return focus to whatever was focused before the modal opened.
      previousActiveElement.current?.focus?.();
      previousActiveElement.current = null;
      return;
    }
    previousActiveElement.current = document.activeElement;
    // Wait a tick so the modal is in the DOM before focusing.
    const t = setTimeout(() => {
      if (modal.kind === 'prompt' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else {
        // Confirm modal — focus the primary button.
        const btn = document.querySelector('.confirm-modal-primary');
        btn?.focus?.();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [modal]);

  // Keyboard: Enter → confirm, Esc → cancel.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter' && modal.kind === 'confirm') {
        // Prompt handles Enter via its own form submit.
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  const cancel = useCallback(() => {
    if (!modal) return;
    modal.resolve(modal.kind === 'prompt' ? null : false);
    setModal(null);
  }, [modal]);

  const confirm = useCallback(() => {
    if (!modal) return;
    modal.resolve(modal.kind === 'prompt' ? value : true);
    setModal(null);
  }, [modal, value]);

  if (!modal) return null;

  const tone = modal.tone || 'default';
  const isDanger = tone === 'danger';
  const isWarning = tone === 'warning';
  const Icon = isDanger ? Trash2 : isWarning ? AlertTriangle : HelpCircle;
  const iconColor = isDanger ? 'var(--danger)' : isWarning ? '#f59e0b' : 'var(--primary)';
  const iconBg = isDanger ? 'var(--danger-light)' : isWarning ? 'var(--warn-bg)' : 'var(--primary-light)';

  const primaryLabel = modal.confirmLabel || (modal.kind === 'prompt' ? 'OK' : (isDanger ? 'Delete' : 'Confirm'));
  const secondaryLabel = modal.cancelLabel || 'Cancel';

  return (
    <div className="modal-overlay confirm-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{ zIndex: 10000 }}>
      <div className="modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999, flexShrink: 0,
            background: iconBg, color: iconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.35 }}>
              {modal.title}
            </h3>
            {modal.message && (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {modal.message}
              </p>
            )}
            {modal.kind === 'prompt' && (
              <form onSubmit={(e) => { e.preventDefault(); confirm(); }}>
                <input
                  ref={inputRef}
                  type={modal.inputType || 'text'}
                  className="form-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={modal.placeholder || ''}
                  style={{ marginTop: '0.9rem', width: '100%' }}
                />
              </form>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={cancel}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            {secondaryLabel}
          </button>
          <button type="button"
            className={`btn confirm-modal-primary ${isDanger ? '' : 'btn-primary'}`}
            onClick={confirm}
            style={{
              fontSize: '0.85rem', padding: '0.5rem 1.1rem',
              ...(isDanger ? {
                background: 'var(--danger)', color: '#fff', border: 'none',
              } : {}),
            }}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
