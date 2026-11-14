// v1.10.86 - the Dashboard's "Dates & more" button: the less-used filters
// (From / To date, cost centre) in a small box under it, so the filter row
// fits on one line. The button counts the filters set inside ("Dates & more (2)").
// Closes on Escape or a click outside it.
import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';

export default function FilterPopover({ label, count = 0, children }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef(null);
  const btn = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && box.current?.contains(e.target)) return;
      setOpen(false);
      if (e.type === 'keydown') btn.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const toggle = () => {
    // Opens to the left when there is no room on the right (a phone).
    const r = btn.current.getBoundingClientRect();
    setAlignRight(r.left + 300 > window.innerWidth - 16);
    setOpen((v) => !v);
  };

  return (
    <div ref={box} className="filter-popover-wrap">
      <button ref={btn} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        className={`btn btn-secondary dash-filter-btn dash-more-btn${count ? ' is-set' : ''}`}
        title={count ? `${label}: ${count} set` : label}>
        <CalendarRange size={15} /> {label}{count > 0 && ` (${count})`} <ChevronDown size={14} />
      </button>
      {open && (
        <div className={`filter-popover${alignRight ? ' align-right' : ''}`} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
