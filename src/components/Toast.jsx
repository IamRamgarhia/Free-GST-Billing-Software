import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const COLORS = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '#10b981' },
  error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#ef4444' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#f59e0b' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '#3b82f6' }
};

let toastId = 0;
let addToastFn = null;

export function toast(message, type = 'info', duration = 3500) {
  if (addToastFn) {
    addToastFn({ id: ++toastId, message, type, duration });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    // v1.9.15 — collapse duplicate consecutive toasts. Clicking the same
    // preset three times used to stack three identical "Applied X" cards.
    // Now: if an identical-message toast is already visible, refresh its
    // timer instead of pushing a duplicate. Cap total on-screen at 4.
    setToasts(prev => {
      const dupe = prev.find(x => x.message === t.message && x.type === t.type);
      if (dupe) return prev.map(x => x === dupe ? { ...x, id: t.id } : x);
      const next = [...prev, t];
      return next.length > 4 ? next.slice(-4) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, t.duration);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const dismiss = (id) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map(t => {
        const Icon = ICONS[t.type] || ICONS.info;
        const color = COLORS[t.type] || COLORS.info;
        return (
          <div key={t.id} className="toast-item" style={{
            background: color.bg,
            borderLeft: `4px solid ${color.icon}`,
            color: color.text
          }}>
            <Icon size={18} style={{ color: color.icon, flexShrink: 0 }} />
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
