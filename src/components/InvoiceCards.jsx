// v1.10.86 - New Invoice: each card opens and closes from its header and,
// while closed, says in one line what is in it ("Tax Invoice · Goods").
// A card moves by dragging its grip (mouse or finger; a blue line shows where
// it lands) or with Move up / Move down in its ⋯ menu. Only the screen
// changes: never the invoice, its numbers or the PDF. Requested by the
// maintainer (15 Nov 2026): "add accordion in this page ... the user can drag
// anything to top or bottom".
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, GripVertical, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import ActionsMenu from './ActionsMenu';
import { toast } from './Toast';
import { DEFAULT_CARD_LAYOUT, readCardLayout, saveCardLayout, placeCard, moveCardBy, setCardOpen, slotAt, isSameSlot } from '../utils/invoiceCards';

// The nearest box that scrolls the form: the form's own pane on a wide
// screen, the page on a phone.
function scrollerOf(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return document.scrollingElement || document.documentElement;
}

export function useInvoiceCards() {
  const [layout, setLayout] = useState(readCardLayout);
  const update = useCallback((fn) => setLayout((prev) => {
    const next = fn(prev);
    if (next !== prev) saveCardLayout(next);
    return next;
  }), []);

  // Drag by the grip. Pointer capture keeps the moves coming to the grip; the
  // form scrolls by itself near its top and bottom edges.
  const [drag, setDrag] = useState(null); // { id, slot, active }
  const dragRef = useRef(null); // { id, startY, y, active, slot, el }
  const frame = useRef(0);

  const stop = useCallback((commit) => {
    const d = dragRef.current;
    cancelAnimationFrame(frame.current);
    dragRef.current = null;
    document.body.classList.remove('inv-card-drag-on');
    setDrag(null);
    if (commit && d?.active && d.slot !== null) update((l) => placeCard(l, d.id, d.slot));
  }, [update]);

  // Esc while dragging puts the card back.
  const dragging = !!drag;
  useEffect(() => {
    if (!dragging) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); stop(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging, stop]);
  // Leaving the screen mid-drag leaves nothing behind.
  useEffect(() => () => { cancelAnimationFrame(frame.current); document.body.classList.remove('inv-card-drag-on'); }, []);

  const tick = useCallback(() => {
    const d = dragRef.current;
    if (!d?.active) return;
    const box = scrollerOf(d.el);
    const isPage = box === document.scrollingElement || box === document.documentElement;
    const r = isPage ? { top: 0, bottom: window.innerHeight } : box.getBoundingClientRect();
    // The sticky button bar covers the top of the form.
    const top = Math.max(r.top, document.querySelector('.generator-toolbar')?.getBoundingClientRect().bottom || 0);
    const edge = 56;
    const speed = d.y < top + edge ? -Math.ceil((top + edge - d.y) / 4) : d.y > r.bottom - edge ? Math.ceil((d.y - (r.bottom - edge)) / 4) : 0;
    if (speed) box.scrollTop += Math.max(-24, Math.min(24, speed));
    const cards = [...document.querySelectorAll('[data-inv-card]')];
    const mids = cards.map((c) => { const b = c.getBoundingClientRect(); return b.top + b.height / 2; });
    const order = cards.map((c) => c.getAttribute('data-inv-card'));
    const slot = slotAt(mids, d.y);
    d.slot = isSameSlot(order, d.id, slot) ? null : slot;
    setDrag((cur) => (cur && (cur.slot !== d.slot || !cur.active) ? { ...cur, slot: d.slot, active: true } : cur));
    frame.current = requestAnimationFrame(tick);
  }, []);

  const gripProps = (id) => ({
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser: drag still works over the grip */ }
      dragRef.current = { id, startY: e.clientY, y: e.clientY, active: false, slot: null, el: e.currentTarget };
      setDrag({ id, slot: null, active: false });
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d) return;
      d.y = e.clientY;
      if (!d.active && Math.abs(e.clientY - d.startY) > 4) {
        d.active = true;
        document.body.classList.add('inv-card-drag-on');
        frame.current = requestAnimationFrame(tick);
      }
    },
    onPointerUp: () => stop(true),
    onPointerCancel: () => stop(false),
  });

  return {
    order: layout.order,
    isOpen: (id) => !layout.closed.includes(id),
    toggle: (id) => update((l) => setCardOpen(l, id, l.closed.includes(id))),
    open: (id) => update((l) => (l.closed.includes(id) ? setCardOpen(l, id, true) : l)),
    move: (id, step) => update((l) => moveCardBy(l, id, step)),
    reset: () => update(() => DEFAULT_CARD_LAYOUT),
    drag,
    gripProps,
  };
}

// One card. `cards` is what useInvoiceCards returned; `summary` is shown while
// the card is closed. A closed card's form is not drawn at all.
export function InvoiceCard({ id, title, help, summary, cards, children }) {
  const open = cards.isOpen(id);
  const at = cards.order.indexOf(id);
  const last = cards.order.length - 1;
  const { drag } = cards;
  const box = useRef(null);
  const bodyId = `inv-card-body-${id}`;
  const cls = ['glass-panel', 'inv-card', open && 'inv-card-open', at === 0 && 'inv-card-first',
    drag?.active && drag.id === id && 'inv-card-held',
    drag?.active && drag.slot === at && 'inv-card-drop-before',
    drag?.active && drag.slot === last + 1 && at === last && 'inv-card-drop-after'].filter(Boolean).join(' ');
  // A click anywhere on the header opens or closes the card, except on its
  // own buttons (help, ⋯) and the grip.
  const onHeadClick = (e) => {
    if (e.target.closest('.inv-card-grip, a, input, select, label') || (e.target.closest('button') && !e.target.closest('.inv-card-toggle'))) return;
    cards.toggle(id);
  };
  // After Move up / down the card stays in sight.
  const moveBy = (step) => { cards.move(id, step); requestAnimationFrame(() => box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); };
  return (
    <section ref={box} data-inv-card={id} className={cls}>
      <div className="inv-card-head" onClick={onHeadClick}>
        <h3 className="section-title inv-card-title">
          <button type="button" className="inv-card-toggle" aria-expanded={open} aria-controls={open ? bodyId : undefined}
            title={open ? `Close ${title}` : `Open ${title}`}>{title}</button>
          {help}
        </h3>
        {!open && summary ? <span className="inv-card-summary" title={summary}>{summary}</span> : <span className="inv-card-space" />}
        <span className="inv-card-tools">
          <span className="inv-card-grip" aria-hidden="true" title={`Drag to move ${title} up or down`} {...cards.gripProps(id)}>
            <GripVertical size={16} />
          </span>
          <ActionsMenu label={`Move ${title}`} items={[
            { label: 'Move up', icon: ArrowUp, onClick: () => moveBy(-1), hidden: at === 0 },
            { label: 'Move down', icon: ArrowDown, onClick: () => moveBy(1), hidden: at === last },
            { label: 'Reset layout', icon: RotateCcw, title: 'The usual order, every card open',
              onClick: () => { cards.reset(); toast('Layout reset: the usual order, every card open.', 'success'); } },
          ]} />
          <ChevronDown size={18} className="inv-card-chevron" aria-hidden="true" />
        </span>
      </div>
      {open && <div id={bodyId} className="inv-card-body">{children}</div>}
    </section>
  );
}
