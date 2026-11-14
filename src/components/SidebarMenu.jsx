import { ChevronDown } from 'lucide-react';
import { menuGroups, closedGroups, toggleGroup } from '../utils/menuGroups';
import { getMenuOrder, getMenuClosed, setMenuClosed } from '../store';

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

export default function SidebarMenu({ items, currentView, onPick }) {
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
        return (
          <div key={g.id} data-nav-group={g.id} className={`nav-group${isClosed && !rows.length ? ' nav-group-shut' : ''}`}>
            <div className="nav-group-head">
              <button type="button" className="nav-group-btn" data-keep-open
                aria-expanded={!isClosed} aria-controls={`nav-group-${g.id}`}
                title={isClosed ? `Open ${g.label}` : `Close ${g.label}`}
                onClick={() => setMenuClosed(toggleGroup(closed, g.id))}>
                <span className="nav-group-label">{g.label}</span>
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
                      aria-current={currentView === id ? 'page' : undefined} onClick={() => onPick(item)}>
                      <Icon size={18} /> <span>{item.label}</span>
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
