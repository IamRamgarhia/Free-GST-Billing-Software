import { ChevronDown } from 'lucide-react';
import { menuGroups, closedGroups, toggleGroup } from '../utils/menuGroups';
import { getMenuOrder, getMenuClosed, setMenuClosed } from '../store';
import { rollupDot } from '../utils/attention';

// v1.10.86 - the top part of the sidebar in groups that open and close
// (asked for on 14 Nov). The order is the one saved list that Settings ->
// Features also shows (utils/menuGroups.js), so the two always agree.
//
// - Group header: click / Enter / Space opens or closes it (remembered).
//   A closed group still shows the screen you are on.
// - Moving items and groups, taking them out of the menu and Reset menu are
//   all in "Customise menu" (MenuCustomise.jsx), opened by the pencil at the
//   top of the sidebar (maintainer: arranging "should be only on" that
//   button, so the sidebar has no grips). `items` comes without the items
//   taken out there.
// `data-keep-open` stops the phone menu from closing on a group header.
//
// v1.10.86 - `dots` ({ id: { count, text } }, utils/attention.js menuDots): a
// red dot on an item that needs the user. A group header shows one for the
// items it does not show right now (closed, or taken out of the menu).

// The red dot, with a small count when it helps. Its words are read out with
// the button's name and shown on hover.
export function NavDot({ dot }) {
  if (!dot) return null;
  return (
    <span className={`nav-dot${dot.count ? ' nav-dot-count' : ''}`} role="img" aria-label={dot.text} title={dot.text}>
      {dot.count ? (dot.count > 99 ? '99+' : dot.count) : ''}
    </span>
  );
}

export default function SidebarMenu({ items, currentView, onPick, dots = {} }) {
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const closed = closedGroups(getMenuClosed());
  // Switched-off and hidden items are left out; a group with none to show is hidden.
  const groups = menuGroups(getMenuOrder())
    .map(g => ({ ...g, visible: g.items.filter(id => byId[id]) }))
    .filter(g => g.visible.length);

  return (
    <div className="nav-groups">
      {groups.map(g => {
        const isClosed = closed.includes(g.id);
        const rows = isClosed ? g.visible.filter(id => id === currentView) : g.visible;
        const headDot = rollupDot(g.items.filter(id => !rows.includes(id)), dots);
        return (
          <div key={g.id} data-nav-group={g.id} className={`nav-group${isClosed && !rows.length ? ' nav-group-shut' : ''}${headDot ? ' nav-group-has-dot' : ''}`}>
            <div className="nav-group-head">
              <button type="button" className="nav-group-btn" data-keep-open
                aria-expanded={!isClosed} aria-controls={`nav-group-${g.id}`}
                title={`${isClosed ? 'Open' : 'Close'} ${g.label}${headDot ? ` - ${headDot.text}` : ''}`}
                onClick={() => setMenuClosed(toggleGroup(closed, g.id))}>
                <span className="nav-group-label">{g.label}</span>
                <NavDot dot={headDot} />
                <ChevronDown size={14} className={`nav-group-chevron${isClosed ? ' closed' : ''}`} aria-hidden="true" />
              </button>
            </div>
            <div id={`nav-group-${g.id}`} className="nav-group-items">
              {rows.map(id => {
                const item = byId[id];
                const Icon = item.icon;
                return (
                  <div key={id} data-nav-item={id} className="nav-row">
                    <button type="button" className={`nav-btn ${currentView === id ? 'nav-btn-active' : ''}`}
                      aria-current={currentView === id ? 'page' : undefined} title={dots[id]?.text} onClick={() => onPick(item)}>
                      <Icon size={18} /> <span>{item.label}</span>
                      <NavDot dot={dots[id]} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
