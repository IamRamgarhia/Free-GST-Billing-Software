// v1.10.86 - sidebar groups that open and close, and drag to any place
// (the dragging and arrows live in Customise menu, components/MenuCustomise.jsx).
//
// Asked for: "all this sidebar can have accordion button if user want to
// expand or not ... and they can also drag to any place".
//
// ONE saved order (gst_menuOrder, store.js), as before: a list of strings.
// Group markers ("group:sales") now sit in it before their items:
//   ['group:sales', 'dashboard', 'new', ..., 'group:stock', 'inventory', ...,
//    'support', 'controlpanel', 'settings', 'guide', ...]
// Only the top part of the menu ('main' items) is grouped; the bottom part
// (Support & About, Control Panel, Settings) and the top-bar buttons keep
// their own order, as before.
//
// Old saved orders (no markers) still load: each item goes into its default
// group, keeping the order the user gave it. Unknown ids and unknown groups
// are ignored; items new in a later version join their default group at the
// end. Pure: no storage, no React (tested in scripts/menu-groups-test.mjs).

import { MENU_ITEMS } from '../utils.js';

export const MENU_GROUPS = [
  { id: 'sales', label: 'Sales', items: ['dashboard', 'new', 'clients', 'receipts', 'recurring'] },
  { id: 'stock', label: 'Stock & buying', items: ['inventory', 'purchases', 'expenses'] },
  { id: 'money', label: 'Money & reports', items: ['cashbook', 'reports', 'filing', 'incometax'] },
];

const MARK = 'group:';
const isMark = (x) => typeof x === 'string' && x.startsWith(MARK);
const MAIN = MENU_ITEMS.filter(m => m.section === 'main').map(m => m.id);
const isGroup = (id) => MENU_GROUPS.some(g => g.id === id);
const defaultGroupOf = (id) => (MENU_GROUPS.find(g => g.items.includes(id)) || MENU_GROUPS[0]).id;
const labelOf = (id) => MENU_GROUPS.find(g => g.id === id).label;
const asList = (order) => (Array.isArray(order) ? order : []);

// Every item in the saved order; items not in it keep their default place
// after the saved ones. (The v1.10.83 rule, unchanged.)
const ranked = (order) => {
  const saved = asList(order);
  const rank = (item) => {
    const i = saved.indexOf(item.id);
    return i === -1 ? saved.length + MENU_ITEMS.indexOf(item) : i;
  };
  return [...MENU_ITEMS].sort((a, b) => rank(a) - rank(b));
};

// The groups of the top part: [{ id, label, items: [item ids] }], every
// group and every 'main' item exactly once (an empty group stays, so an
// item can be dragged back into it).
export const menuGroups = (order = []) => {
  const saved = asList(order);
  const byRank = ranked(saved).filter(m => m.section === 'main').map(m => m.id);
  if (!saved.some(isMark)) {
    return MENU_GROUPS.map(g => ({ id: g.id, label: g.label, items: byRank.filter(id => defaultGroupOf(id) === g.id) }));
  }
  const groups = [];
  const seen = new Set();
  let current = null;
  for (const x of saved) {
    if (isMark(x)) {
      const id = x.slice(MARK.length);
      current = isGroup(id) && !groups.some(g => g.id === id) ? { id, items: [] } : null;
      if (current) groups.push(current);
    } else if (current && MAIN.includes(x) && !seen.has(x)) {
      current.items.push(x);
      seen.add(x);
    }
  }
  for (const g of MENU_GROUPS) if (!groups.some(x => x.id === g.id)) groups.push({ id: g.id, items: [] });
  for (const id of byRank) if (!seen.has(id)) groups.find(g => g.id === defaultGroupOf(id)).items.push(id);
  return groups.map(g => ({ ...g, label: labelOf(g.id) }));
};

// Groups (+ the other parts in their saved order) back to one saved list.
const toOrder = (groups, order) => [
  ...groups.flatMap(g => [MARK + g.id, ...g.items]),
  ...ranked(order).filter(m => m.section !== 'main').map(m => m.id),
];

// The full saved list for any order (old or new): used to compare orders.
export const normalOrder = (order = []) => toOrder(menuGroups(order), order);

// Every MENU_ITEMS entry, in menu order: the groups top to bottom, then the
// bottom part and the top-bar buttons.
export const orderedMenu = (order = []) => {
  const byId = Object.fromEntries(MENU_ITEMS.map(m => [m.id, m]));
  return normalOrder(order).filter(x => !isMark(x)).map(id => byId[id]);
};

// Which group an item is in (null for the bottom part / top bar).
export const groupOfItem = (order, id) => menuGroups(order).find(g => g.items.includes(id))?.id || null;

// Put item `id` into group `groupId`, just before item `beforeId` (null =
// at the end of the group). Same order back if the move makes no sense.
export const moveItem = (order, id, groupId, beforeId = null) => {
  const groups = menuGroups(order);
  if (!MAIN.includes(id) || !isGroup(groupId) || id === beforeId) return normalOrder(order);
  const without = groups.map(g => ({ ...g, items: g.items.filter(x => x !== id) }));
  const next = without.map(g => {
    if (g.id !== groupId) return g;
    const at = beforeId ? g.items.indexOf(beforeId) : -1;
    return at === -1 ? { ...g, items: [...g.items, id] } : { ...g, items: [...g.items.slice(0, at), id, ...g.items.slice(at)] };
  });
  return toOrder(next, order);
};

// Put group `groupId` just before group `beforeId` (null = last).
export const moveGroup = (order, groupId, beforeId = null) => {
  const groups = menuGroups(order);
  const moving = groups.find(g => g.id === groupId);
  if (!moving || groupId === beforeId) return normalOrder(order);
  const rest = groups.filter(g => g.id !== groupId);
  const at = beforeId ? rest.findIndex(g => g.id === beforeId) : -1;
  const next = at === -1 ? [...rest, moving] : [...rest.slice(0, at), moving, ...rest.slice(at)];
  return toOrder(next, order);
};

// One step up (-1) or down (+1), for the arrow buttons and the keyboard.
// Inside a group it jumps over items that are switched off (`shown` says
// which are on), so every press visibly moves it; at the top / bottom of a
// group it goes to the end / start of the group above / below.
export const stepItem = (order, id, dir, shown = () => true) => {
  const groups = menuGroups(order);
  const gi = groups.findIndex(g => g.items.includes(id));
  if (gi === -1) return normalOrder(order);
  const items = groups[gi].items;
  const pos = items.indexOf(id);
  const look = dir < 0 ? items.slice(0, pos).reverse() : items.slice(pos + 1);
  const neighbour = look.find(shown);
  if (neighbour) {
    const rest = items.filter(x => x !== id);
    return moveItem(order, id, groups[gi].id, dir < 0 ? neighbour : rest[rest.indexOf(neighbour) + 1] || null);
  }
  const other = groups[gi + dir];
  if (!other) return normalOrder(order);
  return moveItem(order, id, other.id, dir < 0 ? null : other.items[0] || null);
};

export const stepGroup = (order, groupId, dir) => {
  const ids = menuGroups(order).map(g => g.id);
  const i = ids.indexOf(groupId);
  if (i === -1 || !ids[i + dir]) return normalOrder(order);
  return dir < 0 ? moveGroup(order, groupId, ids[i - 1]) : moveGroup(order, groupId, ids[i + 2] || null);
};

// Move one item up (-1) or down (+1) inside its own part of the menu
// (Settings -> Features arrows). Top-part items move through the groups.
export const moveMenuItem = (order, id, dir) => {
  const item = MENU_ITEMS.find(m => m.id === id);
  if (!item) return normalOrder(order);
  if (item.section === 'main') return stepItem(order, id, dir);
  const list = ranked(order).filter(m => m.section !== 'main').map(m => m.id);
  const same = list.filter(x => MENU_ITEMS.find(m => m.id === x).section === item.section);
  const other = same[same.indexOf(id) + dir];
  if (!other) return normalOrder(order);
  const a = list.indexOf(id), b = list.indexOf(other);
  const swapped = list.map((x, i) => (i === a ? other : i === b ? id : x));
  return [...menuGroups(order).flatMap(g => [MARK + g.id, ...g.items]), ...swapped];
};

// Open / closed groups: the saved list of closed group ids, cleaned.
export const closedGroups = (saved) => asList(saved).filter(isGroup);
export const toggleGroup = (closed, id) => (closed.includes(id) ? closed.filter(x => x !== id) : [...closed, id]);

// v1.10.86 - items taken out of the menu in "Customise menu" (the pencil at
// the top of the sidebar). Menu only: the screen itself stays on, reachable
// through Ctrl+K search and links; switching a feature off is still done in
// Settings -> Features. The screens you can never lose (the core ones and
// the always-shown Support & About and Settings) cannot be taken out.
// Saved as a list of item ids (gst_menuHidden); nothing saved = all shown.
export const canHide = (id) => {
  const item = MENU_ITEMS.find(m => m.id === id);
  return !!item && item.section !== 'top' && !item.core && item.module !== null;
};
export const hiddenItems = (saved) => [...new Set(asList(saved).filter(canHide))];
export const toggleHidden = (hidden, id) => {
  if (!canHide(id)) return hiddenItems(hidden);
  const list = hiddenItems(hidden);
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
};
