// v1.10.80 (#100) - a "⋯" drop-down for the less-used row actions, so an
// Actions column shows a few buttons instead of a long row of icons.
// Requested: "Convert Actions into a drop-down menu with icon to provide a
// cleaner and more compact interface."
//
// items: [{ label, icon: LucideIcon, onClick, title?, tone?: 'danger' | 'green', hidden? }]
// The menu is position: fixed, so a table that scrolls sideways can't clip it.
// v1.10.84 - and drawn at the top of the page (a portal into <body>): inside a
// cell that is pinned (position: sticky) the next rows' cells painted over it
// and took its clicks.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

// Below the button, or above it when there is no room below.
function placeFor(r, count) {
  const below = window.innerHeight - r.bottom > count * 36 + 16;
  return { right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) };
}

export default function ActionsMenu({ items, label = 'More actions' }) {
  const [pos, setPos] = useState(null); // { top, right } while open
  const btn = useRef(null);
  const menu = useRef(null);
  const visible = (items || []).filter((i) => i && !i.hidden);
  const count = visible.length;

  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && (menu.current?.contains(e.target) || btn.current?.contains(e.target))) return;
      setPos(null);
      if (e.type === 'keydown') btn.current?.focus(); // back where the keyboard was
    };
    // Keyboard users land on the first item, as in any menu.
    menu.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    // The menu follows its button while the page scrolls, and closes once the
    // button has left the screen.
    const follow = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { setPos(null); return; }
      setPos(placeFor(r, count));
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pos]);

  if (!visible.length) return null;
  const toggle = () => setPos(pos ? null : placeFor(btn.current.getBoundingClientRect(), visible.length));
  // Arrow keys, Home and End move between the items; Tab leaves the menu.
  const onMenuKey = (e) => {
    const all = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const i = all.indexOf(document.activeElement);
    const go = { ArrowDown: (i + 1) % all.length, ArrowUp: (i - 1 + all.length) % all.length, Home: 0, End: all.length - 1 }[e.key];
    if (go !== undefined) { e.preventDefault(); all[go]?.focus(); }
    else if (e.key === 'Tab') setPos(null);
  };

  return (
    <>
      <button ref={btn} type="button" className="icon-btn" onClick={toggle} title={label}
        aria-label={label} aria-haspopup="menu" aria-expanded={!!pos}>
        <MoreHorizontal size={15} />
      </button>
      {pos && createPortal(
        <div ref={menu} role="menu" className="actions-menu" aria-label={label} onKeyDown={onMenuKey} style={{
          position: 'fixed', zIndex: 1000, ...pos, minWidth: 190,
          background: 'var(--card, #fff)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: 4,
        }}>
          {visible.map((item) => {
            const Icon = item.icon;
            const color = item.tone === 'danger' ? 'var(--danger, #dc2626)' : item.tone === 'green' ? '#059669' : 'var(--text)';
            return (
              <button key={item.label} type="button" role="menuitem" title={item.title || item.label}
                onClick={() => { setPos(null); btn.current?.focus(); item.onClick(); }}
                onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '0.45rem 0.6rem', border: 'none', background: 'transparent', borderRadius: 6,
                  cursor: 'pointer', fontSize: '0.84rem', color,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                {Icon && <Icon size={15} />} {item.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
