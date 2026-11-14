import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, RotateCcw, Check, GripVertical } from 'lucide-react';
import { MENU_ITEMS, isModuleEnabled } from '../utils';
import { menuGroups, normalOrder, orderedMenu, moveMenuItem, moveItem, moveGroup, stepGroup, closedGroups, toggleGroup, hiddenItems, toggleHidden, canHide } from '../utils/menuGroups';
import { getMenuOrder, setMenuOrder, getMenuClosed, setMenuClosed, getMenuHidden, setMenuHidden, getEnabledModules } from '../store';
import { toast } from './Toast';
import HelpButton from './HelpButton';

// v1.10.86 - "Customise menu", opened by the pencil at the top of the
// sidebar (asked for: "this button should work as arrange menu ... open a
// modal which will then have more options like add or remove things in the
// menu"). Everything is saved straight away, in the same storage as the
// sidebar's open / close (utils/menuGroups.js), so the sidebar, this window
// and Settings -> Features always agree. Arranging happens only here (the
// maintainer: "it should be only on [the pencil] button"): arrows for every
// row, and a grip to drag an item (also into another group) or a group.
//
// Hiding an item here only takes it out of the menu; the screen stays on
// (Ctrl+K search and links still open it). A feature switched off in
// Settings -> Features is shown greyed, with a link there.

const OPEN_EVENT = 'fgsb:customise-menu';
export const openCustomiseMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const onOpenCustomiseMenu = (fn) => {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
};

// Where a drag at height `y` would land: the nearest gap between rows (or
// between groups, for a group), read from the screen. `y` of the result is
// inside the scrolling body, for the blue line.
function findSlot(body, drag, y) {
  const groupEls = [...body.querySelectorAll('[data-mc-group]:not([data-mc-group="bottom"])')];
  if (!groupEls.length) return null;
  const slots = [];
  if (drag.kind === 'group') {
    for (const el of groupEls) slots.push({ beforeId: el.dataset.mcGroup, y: el.getBoundingClientRect().top - 7 });
    slots.push({ beforeId: null, y: groupEls.at(-1).getBoundingClientRect().bottom + 7 });
  } else {
    for (const el of groupEls) {
      const groupId = el.dataset.mcGroup;
      const rows = [...el.querySelectorAll('[data-mc-item]')].filter(r => r.dataset.mcItem !== drag.id);
      if (!rows.length) {
        slots.push({ groupId, beforeId: null, y: el.querySelector('.mc-group-head').getBoundingClientRect().bottom + 4 });
        continue;
      }
      for (const r of rows) slots.push({ groupId, beforeId: r.dataset.mcItem, y: r.getBoundingClientRect().top - 1 });
      slots.push({ groupId, beforeId: null, y: rows.at(-1).getBoundingClientRect().bottom + 1 });
    }
  }
  const best = slots.reduce((a, s) => (Math.abs(s.y - y) < Math.abs(a.y - y) ? s : a));
  return { ...best, y: best.y - body.getBoundingClientRect().top + body.scrollTop };
}

function Arrows({ label, onUp, onDown, upOff, downOff }) {
  return (
    <span className="mc-arrows">
      <button type="button" className="mc-arrow" disabled={upOff} onClick={onUp} aria-label={`Move ${label} up`} title="Move up"><ArrowUp size={15} /></button>
      <button type="button" className="mc-arrow" disabled={downOff} onClick={onDown} aria-label={`Move ${label} down`} title="Move down"><ArrowDown size={15} /></button>
    </span>
  );
}

function Switch({ on, onChange, label, disabled }) {
  return (
    <label className={`mc-switch${disabled ? ' mc-switch-off' : ''}`} title={label}>
      <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={onChange} aria-label={label} />
      <span className="mc-switch-track" aria-hidden="true" />
    </label>
  );
}

// `extras`: id -> { icon, label } as the sidebar shows them (App.jsx).
export default function MenuCustomise({ extras, onClose, onOpenFeatures }) {
  const order = getMenuOrder();
  const now = normalOrder(order).join();
  const closed = closedGroups(getMenuClosed());
  const hidden = hiddenItems(getMenuHidden());
  const modules = getEnabledModules();
  const groups = menuGroups(order);
  const bottom = orderedMenu(order).filter(m => m.section === 'bottom');
  const byId = Object.fromEntries(MENU_ITEMS.map(m => [m.id, m]));

  const save = (next) => { if (next.join() !== now) setMenuOrder(next); };
  const stuck = (id, dir) => moveMenuItem(order, id, dir).join() === now;
  // Drag by the grip (mouse or finger). Pointer capture keeps the moves
  // coming to the grip; the list scrolls near its top and bottom edges.
  const bodyRef = useRef(null);
  const [drag, setDrag] = useState(null); // { kind, id, startY, active, slot }
  const startDrag = (e, kind, id) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser: drag still works over the grip */ }
    setDrag({ kind, id, startY: e.clientY, active: false, slot: null });
  };
  const moveDrag = (e) => {
    const body = bodyRef.current;
    if (!drag || !body) return;
    if (!drag.active && Math.abs(e.clientY - drag.startY) < 4) return;
    const r = body.getBoundingClientRect();
    if (e.clientY < r.top + 40) body.scrollTop -= 10;
    else if (e.clientY > r.bottom - 40) body.scrollTop += 10;
    setDrag({ ...drag, active: true, slot: findSlot(body, drag, e.clientY) });
  };
  const endDrag = () => {
    if (drag?.active && drag.slot) {
      save(drag.kind === 'item'
        ? moveItem(order, drag.id, drag.slot.groupId, drag.slot.beforeId)
        : moveGroup(order, drag.id, drag.slot.beforeId));
    }
    setDrag(null);
  };
  const grip = (kind, id, label) => (
    <span className="mc-grip" aria-hidden="true" title={`Drag to move ${label}`}
      onPointerDown={(e) => startDrag(e, kind, id)} onPointerMove={moveDrag}
      onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
      <GripVertical size={16} />
    </span>
  );
  const held = (kind, id) => (drag?.active && drag.kind === kind && drag.id === id ? ' mc-held' : '');

  const reset = () => {
    setMenuOrder([]);
    setMenuClosed([]);
    setMenuHidden([]);
    toast('Menu reset: the usual groups and order, everything shown.', 'success');
  };

  // Keyboard: focus moves into the window, Esc closes it, and focus goes
  // back to the pencil afterwards.
  // Once per opening (a ref, so a redraw after each change keeps your place).
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const before = document.activeElement;
    boxRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, []);

  const row = (id) => {
    const item = byId[id];
    const Icon = extras[id]?.icon;
    const label = extras[id]?.label || item.label;
    const featureOn = !item.module || isModuleEnabled(item.module, modules);
    const isHidden = hidden.includes(id);
    return (
      <li key={id} data-mc-item={id} className={`mc-row${featureOn ? '' : ' mc-row-off'}${isHidden ? ' mc-row-hidden' : ''}${held('item', id)}`}>
        {item.section === 'main' ? grip('item', id, label) : <span className="mc-grip-space" aria-hidden="true" />}
        <span className="mc-icon">{Icon && <Icon size={16} />}</span>
        <span className="mc-name">
          <span className="mc-label">{label}</span>
          {!featureOn && (
            <span className="mc-note">Off in <button type="button" className="mc-link" onClick={onOpenFeatures}>Settings → Features</button></span>
          )}
          {featureOn && isHidden && <span className="mc-note">Not in the menu</span>}
        </span>
        {canHide(id)
          ? <Switch on={!isHidden} disabled={!featureOn} label={`Show ${label} in the menu`} onChange={() => setMenuHidden(toggleHidden(hidden, id))} />
          : <span className="mc-always">Always shown</span>}
        <Arrows label={label} onUp={() => save(moveMenuItem(order, id, -1))} onDown={() => save(moveMenuItem(order, id, 1))}
          upOff={stuck(id, -1)} downOff={stuck(id, 1)} />
      </li>
    );
  };

  return (
    <div className="modal-overlay mc-overlay" onClick={onClose}>
      <div ref={boxRef} tabIndex={-1} className="modal-content mc-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="mc-head">
          <h3 id="mc-title" className="mc-title">Customise menu <HelpButton title="Customise menu" doc="shortcuts#menu-groups" size={16} /></h3>
          <button type="button" className="mc-close" onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
        </div>
        <div ref={bodyRef} className={`mc-body${drag?.active ? ' mc-drag-on' : ''}`}>
          <p className="mc-intro">
            Move items and groups with the arrows or by dragging the grip, choose which groups start open, and switch items off to take them out of the menu.
            The screen itself stays on: <kbd>Ctrl</kbd> + <kbd>K</kbd> still finds it. Saved straight away.
          </p>
          {groups.map((g, gi) => (
            <section key={g.id} data-mc-group={g.id} className={`mc-group${held('group', g.id)}`} aria-label={g.label}>
              <div className="mc-group-head">
                {grip('group', g.id, g.label)}
                <span className="mc-group-name">{g.label}</span>
                <span className="mc-open">
                  <span className="mc-open-text" aria-hidden="true">{closed.includes(g.id) ? 'Closed' : 'Open'}</span>
                  <Switch on={!closed.includes(g.id)} label={`${g.label} group open`} onChange={() => setMenuClosed(toggleGroup(closed, g.id))} />
                </span>
                <Arrows label={`the ${g.label} group`} onUp={() => save(stepGroup(order, g.id, -1))} onDown={() => save(stepGroup(order, g.id, 1))}
                  upOff={gi === 0} downOff={gi === groups.length - 1} />
              </div>
              {g.items.length
                ? <ul className="mc-list">{g.items.map(row)}</ul>
                : <p className="mc-empty">Empty. Move an item here with the arrows, or drag one here.</p>}
            </section>
          ))}
          <section className="mc-group" data-mc-group="bottom" aria-label="Bottom of the menu">
            <div className="mc-group-head"><span className="mc-grip-space" aria-hidden="true" /><span className="mc-group-name">Bottom of the menu</span></div>
            <ul className="mc-list">{bottom.map(m => row(m.id))}</ul>
          </section>
          {drag?.active && drag.slot && <div className="mc-drop-line" style={{ top: drag.slot.y }} aria-hidden="true" />}
        </div>
        <div className="mc-foot">
          <button type="button" className="btn btn-secondary" onClick={reset} title="The usual groups and order, every group open, everything shown">
            <RotateCcw size={15} /> Reset menu
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}><Check size={15} /> Done</button>
        </div>
      </div>
    </div>
  );
}
