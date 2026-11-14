// v1.10.37 - Reusable page header (was a gradient card with an icon badge,
// a title, a subtitle line and the action buttons on the right).
//
// v1.10.86 - the header is the top bar now (maintainer, 15 Nov: "what if we
// have all things in one in top bar", chosen: one line, some icons). It is
// drawn into App.jsx's top bar through two portals (components/pageBarSlots.js):
//   [title (?) meta extras]   [search]   [secondary icons][primary]   [? bell ...]
//
// Props:
//   title      the page name (plain words; the (?) is added from `help`)
//   help       { title, doc } for the (?) button next to the title
//   subtitle   the line that was under the title: now the (?) button's tooltip
//   meta       a short count or note after the title ("26 invoices")
//   extras     controls that belong to the title (Dashboard's "Totals for",
//              a Year box, Cash / Bank tabs); they keep their words
//   secondary  the screen's other buttons, as <BarButton>s (icons with a
//              tooltip); in the "⋯" menu on a phone or a narrow window
//   primary    the screen's main button, with its words ("New Invoice")
import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import HelpButton from './HelpButton';
import { PageBarSlots } from './pageBarSlots';

// An icon button for the top bar. `label` is its name (what it said before it
// became an icon, so screen readers and the tests find it the same way); it is
// shown again as words inside the ⋯ menu. With `href` it is a link.
export function BarButton({ icon, label, title, ...rest }) {
  const Icon = icon;
  const Tag = rest.href ? 'a' : 'button';
  return (
    <Tag type={rest.href ? undefined : 'button'} className="topbar-btn page-bar-btn" title={title || label} aria-label={label} {...rest}>
      <Icon size={18} aria-hidden="true" /><span className="pb-label">{label}</span>
    </Tag>
  );
}

export default function PageHeader({ title, help, subtitle, meta, extras, secondary, primary }) {
  const slots = useContext(PageBarSlots);
  const [open, setOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !moreRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // The bar mounts in the same render as the first screen; the portals follow
  // straight after (before anything is painted).
  if (!slots?.title || !slots?.actions) return null;
  return (
    <>
      {createPortal(
        <div className="page-bar-head">
          <h1 className="page-title">
            {title}
            {help && <HelpButton title={help.title} doc={help.doc} hint={subtitle} size={16} />}
          </h1>
          {meta ? <span className="page-bar-meta">{meta}</span> : null}
          {extras}
        </div>,
        slots.title,
      )}
      {createPortal(
        <>
          {secondary && (
            <div className="page-bar-more" ref={moreRef}>
              <button type="button" className="topbar-btn page-bar-more-btn" onClick={() => setOpen((o) => !o)}
                title="More buttons for this page" aria-label="More buttons" aria-haspopup="true" aria-expanded={open}>
                <MoreHorizontal size={18} />
              </button>
              <div className={`page-bar-secondary${open ? ' is-open' : ''}`} onClick={() => setOpen(false)}>
                {secondary}
              </div>
            </div>
          )}
          {primary}
        </>,
        slots.actions,
      )}
    </>
  );
}
