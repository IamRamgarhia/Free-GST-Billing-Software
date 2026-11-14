// v1.10.86 - sidebar groups (open / close, drag to any place): the pure
// order logic in src/utils/menuGroups.js.
//
// Run: `node scripts/menu-groups-test.mjs`

import {
  MENU_GROUPS, menuGroups, normalOrder, orderedMenu, moveItem, moveGroup,
  stepItem, stepGroup, moveMenuItem, groupOfItem, closedGroups, toggleGroup,
  canHide, hiddenItems, toggleHidden,
} from '../src/utils/menuGroups.js';
import { MENU_ITEMS } from '../src/utils.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const shape = (order) => menuGroups(order).map(g => `${g.id}:${g.items.join(',')}`);
const items = (order, gid) => menuGroups(order).find(g => g.id === gid).items;
const MAIN = MENU_ITEMS.filter(m => m.section === 'main').map(m => m.id);
const DEFAULT = MENU_GROUPS.map(g => `${g.id}:${g.items.join(',')}`);

console.log('Default groups');
eq(shape([]), DEFAULT, 'no saved order = the default groups');
eq(shape(undefined), DEFAULT, 'bad saved order is safe');
eq(shape('nonsense'), DEFAULT, 'a saved string is safe');
eq(MENU_GROUPS.flatMap(g => g.items).sort(), [...MAIN].sort(), 'every top-part item is in exactly one default group');
eq(orderedMenu([]).map(m => m.id), MENU_ITEMS.map(m => m.id), 'MENU_ITEMS is listed in the default group order');
eq(normalOrder([]).filter(x => x.startsWith('group:')), ['group:sales', 'group:stock', 'group:money'], 'markers in the saved list');

console.log('Old saved orders (v1.10.83 - v1.10.85, no groups)');
const old = ['reports', 'dashboard', 'expenses', 'inventory', 'clients', 'settings', 'support', 'ghost'];
eq(items(old, 'sales').slice(0, 2), ['dashboard', 'clients'], 'items keep their saved order inside their default group');
eq(items(old, 'stock'), ['expenses', 'inventory', 'purchases'], 'saved order first, the rest after');
eq(items(old, 'money')[0], 'reports', 'Reports first in Money & reports, as saved');
eq(orderedMenu(old).filter(m => m.section === 'bottom').map(m => m.id), ['settings', 'support', 'controlpanel'], 'bottom part keeps its saved order');
eq(orderedMenu(old).length, MENU_ITEMS.length, 'unknown ids ignored, nothing lost');

console.log('Move inside a group');
let o = moveItem([], 'recurring', 'sales', 'dashboard');
eq(items(o, 'sales'), ['recurring', 'dashboard', 'new', 'clients', 'receipts'], 'Recurring dragged to the top of Sales');
o = moveItem(o, 'recurring', 'sales', null);
eq(shape(o), DEFAULT, 'and back to the end');
eq(shape(moveItem([], 'clients', 'sales', 'clients')), DEFAULT, 'dropped on itself: no change');

console.log('Move across groups');
o = moveItem([], 'cashbook', 'sales', 'clients');
eq(items(o, 'sales'), ['dashboard', 'new', 'cashbook', 'clients', 'receipts', 'recurring'], 'Cash book dragged into Sales');
eq(items(o, 'money'), ['reports', 'filing', 'incometax'], 'and gone from Money & reports');
eq(groupOfItem(o, 'cashbook'), 'sales', 'groupOfItem follows');
eq(shape(normalOrder(o)), shape(o), 'saved list reads back the same');
o = moveItem([], 'inventory', 'money', null);
o = moveItem(o, 'purchases', 'money', null);
o = moveItem(o, 'expenses', 'money', null);
eq(items(o, 'stock'), [], 'a group can be emptied');
eq(menuGroups(o).map(g => g.id), ['sales', 'stock', 'money'], 'the empty group stays (so items can go back)');
eq(items(moveItem(o, 'expenses', 'stock'), 'stock'), ['expenses'], 'an item dragged into the empty group');
eq(normalOrder(moveItem([], 'settings', 'sales')), normalOrder([]), 'bottom-part items cannot go into a group');
eq(normalOrder(moveItem([], 'reports', 'nope')), normalOrder([]), 'unknown group: no change');

console.log('Reorder groups');
o = moveGroup([], 'money', 'sales');
eq(menuGroups(o).map(g => g.id), ['money', 'sales', 'stock'], 'Money & reports dragged to the top');
eq(orderedMenu(o)[0].id, 'cashbook', 'and its items lead the menu');
eq(menuGroups(moveGroup(o, 'money', null)).map(g => g.id), ['sales', 'stock', 'money'], 'and back to the end');
eq(menuGroups(stepGroup([], 'stock', -1)).map(g => g.id), ['stock', 'sales', 'money'], 'group up one');
eq(menuGroups(stepGroup([], 'stock', 1)).map(g => g.id), ['sales', 'money', 'stock'], 'group down one');
eq(normalOrder(stepGroup([], 'sales', -1)), normalOrder([]), 'first group cannot go up');
eq(normalOrder(stepGroup([], 'money', 1)), normalOrder([]), 'last group cannot go down');

console.log('Arrows / keyboard (one step)');
eq(items(stepItem([], 'new', -1), 'sales').slice(0, 2), ['new', 'dashboard'], 'up one');
eq(items(stepItem([], 'new', 1), 'sales').slice(0, 3), ['dashboard', 'clients', 'new'], 'down one');
o = stepItem([], 'inventory', -1);
eq([items(o, 'sales').at(-1), items(o, 'stock')[0]], ['inventory', 'purchases'], 'top of a group: up goes to the end of the group above');
o = stepItem([], 'recurring', 1);
eq(items(o, 'stock')[0], 'recurring', 'bottom of a group: down goes to the start of the group below');
eq(normalOrder(stepItem([], 'dashboard', -1)), normalOrder([]), 'very first item cannot go up');
eq(normalOrder(stepItem([], 'incometax', 1)), normalOrder([]), 'very last item cannot go down');
eq(items(moveMenuItem([], 'new', 1), 'sales').slice(0, 3), ['dashboard', 'clients', 'new'], 'Settings -> Features arrows use the same steps');
o = moveMenuItem(moveItem([], 'cashbook', 'sales'), 'settings', -1);
eq([groupOfItem(o, 'cashbook'), orderedMenu(o).filter(m => m.section === 'bottom').map(m => m.id)], ['sales', ['support', 'settings', 'controlpanel']], 'moving a bottom item keeps the groups');

console.log('Switched-off items');
const shown = (id) => id !== 'receipts'; // Receipts switched off
eq(items(stepItem([], 'recurring', -1, shown), 'sales'), ['dashboard', 'new', 'recurring', 'clients', 'receipts'], 'up jumps over a hidden item');
eq(items(stepItem([], 'clients', 1, shown), 'sales'), ['dashboard', 'new', 'receipts', 'recurring', 'clients'], 'down jumps over a hidden item');
eq(items(moveItem([], 'reports', 'stock', 'inventory'), 'stock')[0], 'reports', 'a hidden item never blocks a drop');

console.log('Saved list survives anything');
const odd = ['group:money', 'reports', 'group:money', 'dashboard', 'group:nope', 'clients', 'new', 'group:sales', 'reports', 'ghost'];
eq(menuGroups(odd).map(g => g.id), ['money', 'sales', 'stock'], 'duplicate / unknown markers ignored, missing groups added');
eq(menuGroups(odd).flatMap(g => g.items).sort(), [...MAIN].sort(), 'every item once');
eq(items(odd, 'money')[0], 'reports', 'first place wins');
eq(MAIN.filter(id => !menuGroups(['group:sales', 'dashboard']).some(g => g.items.includes(id))), [], 'items new in a later version join their default group');
eq(items(['group:stock', 'group:sales', 'dashboard'], 'sales'), ['dashboard', 'new', 'clients', 'receipts', 'recurring'], 'missing items go to the end of their default group');

console.log('Reset');
eq(shape(normalOrder([])), DEFAULT, 'Reset menu (empty saved order) = default groups and order');

console.log('Open / closed');
eq(closedGroups(['money', 'ghost', 3]), ['money'], 'unknown closed ids ignored');
eq(closedGroups('x'), [], 'bad saved value is safe');
eq(toggleGroup([], 'sales'), ['sales'], 'close');
eq(toggleGroup(['sales', 'money'], 'sales'), ['money'], 'open');

console.log('Taken out of the menu (Customise menu)');
eq(hiddenItems(undefined), [], 'nothing saved (older versions) = everything shown');
eq(hiddenItems('x'), [], 'bad saved value is safe');
eq(['dashboard', 'new', 'clients', 'settings', 'support'].filter(canHide), [], 'core screens, Support & About and Settings can never be taken out');
eq(['inventory', 'reports', 'controlpanel'].every(canHide), true, 'other screens and Control Panel can');
eq(['guide', 'darkMode', 'ghost'].filter(canHide), [], 'top-right buttons and unknown ids are not menu items here');
eq(hiddenItems(['reports', 'settings', 'ghost', 'reports', 'dashboard']), ['reports'], 'saved list cleaned: unknown, locked and repeated ids dropped');
eq(toggleHidden([], 'reports'), ['reports'], 'take out');
eq(toggleHidden(['reports', 'expenses'], 'reports'), ['expenses'], 'put back');
eq(toggleHidden([], 'settings'), [], 'Settings cannot be taken out');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
