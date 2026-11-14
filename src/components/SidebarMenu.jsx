import { useState, useRef } from 'react';
import { ChevronDown, GripVertical, ArrowUp, ArrowDown, Pencil, RotateCcw, Check } from 'lucide-react';
import { menuGroups, normalOrder, moveItem, moveGroup, stepItem, stepGroup, closedGroups, toggleGroup } from '../utils/menuGroups';
import { getMenuOrder, setMenuOrder, getMenuClosed, setMenuClosed } from '../store';
import { toast } from './Toast';

// v1.10.86 - the top part of the sidebar in groups that open and close, and
// drag to any place (asked for on 14 Nov). The order is the one saved list
// that Settings -> Features also shows (utils/menuGroups.js), so the two
// always agree.
//
// - Group header: click / Enter / Space opens or closes it (remembered).
//   A closed group still shows the screen you are on.
// - Mouse: a grip appears on hover; drag an item or a whole group. A line
//   shows where it will land. Clicking the item itself still opens it.
// - Phone / keyboard: "Arrange menu" shows up / down arrows (and, with a
//   mouse, the grips), plus "Reset menu".
// `data-keep-open` stops the phone menu from closing on these buttons.

const sameOrder = (a, b) => a.join() === b.join();

// Where a drag at height `y` would land: the nearest gap between rows (or
// between groups, for a group). Read from the screen, so hidden and closed
// items never get in the way.
function findSlot(nav, drag, y) {
  const groupEls = [...nav.querySelectorAll('[data-nav-group]')];
  if (!groupEls.length) return null;
  const slots = [];
  if (drag.kind === 'group') {
    for (const el of groupEls) slots.push({ beforeId: el.dataset.navGroup, y: el.getBoundingClientRect().top - 5 });
    slots.push({ beforeId: null, y: groupEls.at(-1).getBoundingClientRect().bottom + 5 });
  } else {
    for (const el of groupEls) {
      const groupId = el.dataset.navGroup;
      const rows = [...el.querySelectorAll('[data-nav-item]')].filter(r => r.dataset.navItem !== drag.id);
      if (!rows.length) {
        slots.push({ groupId, beforeId: null, y: el.querySelector('.nav-group-head').getBoundingClientRect().bottom + 2 });
        continue;
      }
      for (const r of rows) slots.push({ groupId, beforeId: r.dataset.navItem, y: r.getBoundingClientRect().top - 2 });
      slots.push({ groupId, beforeId: null, y: rows.at(-1).getBoundingClientRect().bottom + 2 });
    }
  }
  const best = slots.reduce((a, s) => (Math.abs(s.y - y) < Math.abs(a.y - y) ? s : a));
  return { ...best, y: best.y - nav.getBoundingClientRect().top };
}

// Scroll the sidebar while dragging near its top or bottom edge.
function edgeScroll(nav, y) {
  const box = nav.closest('.sidebar');
  if (!box) return;
  const r = box.getBoundingClientRect();
  if (y < r.top + 40) box.scrollTop -= 10;
  else if (y > r.bottom - 40) box.scrollTop += 10;
}

function Arrows({ label, onUp, onDown, upOff, downOff }) {
  return (
    <span className="nav-arrows">
      <button type="button" className="nav-arrow" data-keep-open disabled={upOff} onClick={onUp} aria-label={`Move ${label} up`} title="Move up"><ArrowUp size={14} /></button>
      <button type="button" className="nav-arrow" data-keep-open disabled={downOff} onClick={onDown} aria-label={`Move ${label} down`} title="Move down"><ArrowDown size={14} /></button>
    </span>
  );
}

export default function SidebarMenu({ items, currentView, onPick }) {
  const order = getMenuOrder();
  const now = normalOrder(order);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const shown = (id) => !!byId[id];
  const [closed, setClosed] = useState(() => closedGroups(getMenuClosed()));
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState(null); // { kind, id, startY, active, slot }
  const navRef = useRef(null);

  const arranging = editing || !!drag?.active;
  // Switched-off items are left out; a group with none to show is hidden
  // (an emptied group shows while arranging, so items can go back into it).
  const groups = menuGroups(order)
    .map(g => ({ ...g, visible: g.items.filter(shown) }))
    .filter(g => g.visible.length || (arranging && !g.items.length));

  const save = (next) => { if (!sameOrder(next, now)) setMenuOrder(next); };
  const toggle = (id) => {
    const next = toggleGroup(closed, id);
    setClosed(next);
    setMenuClosed(next);
  };
  const reset = () => {
    setMenuOrder([]);
    setClosed([]);
    setMenuClosed([]);
    toast('Menu reset to the default groups and order.', 'success');
  };

  const startDrag = (e, kind, id) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser: drag still works over the grip */ }
    setDrag({ kind, id, startY: e.clientY, active: false, slot: null });
  };
  const moveDrag = (e) => {
    if (!drag || !navRef.current) return;
    if (!drag.active && Math.abs(e.clientY - drag.startY) < 4) return;
    edgeScroll(navRef.current, e.clientY);
    setDrag({ ...drag, active: true, slot: findSlot(navRef.current, drag, e.clientY) });
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
    <span className="nav-grip" aria-hidden="true" title={`Drag to move ${label}`}
      onPointerDown={(e) => startDrag(e, kind, id)} onPointerMove={moveDrag}
      onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
      <GripVertical size={14} />
    </span>
  );
  // Held: the grip stays shown while the pointer moves away from it.
  const held = (kind, id) => (drag?.kind === kind && drag.id === id ? ' nav-held' : '');

  return (
    <div ref={navRef} className={`nav-groups${editing ? ' nav-editing' : ''}${drag?.active ? ' nav-drag-on' : ''}`}>
      {editing && <p className="nav-edit-hint">Use the arrows, or drag <GripVertical size={12} /> with the mouse. Saved straight away.</p>}
      {groups.map((g, gi) => {
        const isClosed = !editing && closed.includes(g.id);
        const rows = isClosed ? g.visible.filter(id => id === currentView) : g.visible;
        return (
          <div key={g.id} data-nav-group={g.id} className={`nav-group${isClosed && !rows.length ? ' nav-group-shut' : ''}${held('group', g.id)}`}>
            <div className="nav-group-head">
              <button type="button" className="nav-group-btn" data-keep-open
                aria-expanded={!isClosed} aria-controls={`nav-group-${g.id}`}
                title={editing ? g.label : isClosed ? `Open ${g.label}` : `Close ${g.label}`}
                onClick={() => !editing && toggle(g.id)}>
                <span className="nav-group-label">{g.label}</span>
                {!editing && <ChevronDown size={14} className={`nav-group-chevron${isClosed ? ' closed' : ''}`} aria-hidden="true" />}
              </button>
              {editing && (
                <Arrows label={g.label}
                  onUp={() => save(stepGroup(order, g.id, -1))} onDown={() => save(stepGroup(order, g.id, 1))}
                  upOff={gi === 0} downOff={gi === groups.length - 1} />
              )}
              {grip('group', g.id, g.label)}
            </div>
            <div id={`nav-group-${g.id}`} className="nav-group-items">
              {rows.map(id => {
                const item = byId[id];
                const Icon = item.icon;
                return (
                  <div key={id} data-nav-item={id} className={`nav-row${held('item', id)}`}>
                    {editing ? (
                      <div className="nav-btn nav-btn-editing"><Icon size={18} /> <span>{item.label}</span></div>
                    ) : (
                      <button type="button" className={`nav-btn ${currentView === id ? 'nav-btn-active' : ''}`}
                        aria-current={currentView === id ? 'page' : undefined} onClick={() => onPick(item)}>
                        <Icon size={18} /> <span>{item.label}</span>
                      </button>
                    )}
                    {editing && (
                      <Arrows label={item.label}
                        onUp={() => save(stepItem(order, id, -1, shown))} onDown={() => save(stepItem(order, id, 1, shown))}
                        upOff={sameOrder(stepItem(order, id, -1, shown), now)} downOff={sameOrder(stepItem(order, id, 1, shown), now)} />
                    )}
                    {grip('item', id, item.label)}
                  </div>
                );
              })}
              {arranging && !g.items.length && <div className="nav-group-empty">Drag an item here</div>}
            </div>
          </div>
        );
      })}
      {drag?.active && drag.slot && <div className="nav-drop-line" style={{ top: drag.slot.y }} aria-hidden="true" />}
      <div className="nav-edit-row">
        {editing ? (
          <>
            <button type="button" className="nav-edit-btn nav-edit-done" data-keep-open onClick={() => setEditing(false)}><Check size={14} /> Done</button>
            <button type="button" className="nav-edit-btn" data-keep-open onClick={reset} title="Back to the default groups and order"><RotateCcw size={14} /> Reset menu</button>
          </>
        ) : (
          <button type="button" className="nav-edit-btn" data-keep-open onClick={() => setEditing(true)} title="Move menu items and groups"><Pencil size={13} /> Arrange menu</button>
        )}
      </div>
    </div>
  );
}
