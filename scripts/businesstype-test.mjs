// v1.10.83 - business type → features, and the sidebar order.
//
// Run: `node scripts/businesstype-test.mjs`

import {
  BUSINESS_TYPES, SWITCHABLE_MODULES, modulesForType, applyBusinessType,
  businessTypeChanges, featureChanges, orderedMenu, moveMenuItem, wizardResult,
} from '../src/utils/businessTypes.js';
import { isModuleEnabled, MENU_ITEMS, FEATURE_GROUPS } from '../src/utils.js';
import { BUSINESS_PRESETS } from '../src/utils/printSettings.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const onIn = (type) => Object.entries(modulesForType(type)).filter(([, v]) => v).map(([k]) => k).sort();
const shown = (type, id) => isModuleEnabled(id, applyBusinessType(type, {}));

console.log('Every type is complete and known');
for (const t of BUSINESS_TYPES) {
  eq(Object.keys(modulesForType(t.id)).sort(), [...SWITCHABLE_MODULES].sort(), `${t.id}: decides every switch`);
  if (t.id !== 'everything') eq(!!BUSINESS_PRESETS[t.id], true, `${t.id}: matches an invoice-style preset`);
}
eq(modulesForType('nope'), null, 'unknown type gives nothing');
eq(applyBusinessType('nope', { reports: false }), { reports: false }, 'unknown type changes nothing');

for (const t of BUSINESS_TYPES) eq(shown(t.id, 'cashBook'), true, `${t.id}: cash book on (every business handles cash)`);

console.log('Freelancer');
for (const id of ['inventory', 'purchases', 'purchaseOrders', 'manufacturing']) eq(shown('freelancer', id), false, `freelancer: ${id} off`);
for (const id of ['recurring', 'receipts', 'expenses', 'gstReturns', 'tdsTcs', 'incomeTax']) eq(shown('freelancer', id), true, `freelancer: ${id} on`);

console.log('Wholesale and manufacturing');
for (const id of ['purchases', 'purchaseOrders', 'inventory', 'ewayBill', 'gstr2b']) eq(shown('wholesale', id), true, `wholesale: ${id} on`);
eq(shown('wholesale', 'manufacturing'), false, 'wholesale: manufacturing off');
for (const id of ['manufacturing', 'purchaseOrders', 'costCentres', 'ewayBill']) eq(shown('manufacturer', id), true, `manufacturer: ${id} on`);

console.log('Retail, restaurant, service');
eq(shown('retail_shop', 'inventory') && shown('retail_shop', 'purchases'), true, 'retail: products and purchases on');
eq(shown('retail_shop', 'manufacturing') || shown('retail_shop', 'purchaseOrders'), false, 'retail: no manufacturing, no purchase orders');
eq(shown('restaurant', 'upiQr') && !shown('restaurant', 'recurring'), true, 'restaurant: UPI QR on, recurring off');
eq(shown('service', 'recurring') && shown('service', 'inventory'), true, 'service: recurring and spare parts on');

console.log('Everything');
eq(onIn('everything'), [...SWITCHABLE_MODULES].sort(), 'everything: all on');
eq(SWITCHABLE_MODULES.every(id => shown('everything', id)), true, 'everything: shown');

console.log('Never off');
const core = FEATURE_GROUPS.flatMap(g => g.modules).filter(m => m.core).map(m => m.id);
eq(core.sort(), ['clients', 'dashboard', 'invoicing'], 'core: dashboard, new invoice, clients');
for (const t of BUSINESS_TYPES) eq(core.every(id => shown(t.id, id)), true, `${t.id}: core stays on`);
eq(core.every(id => isModuleEnabled(id, { dashboard: false, invoicing: false, clients: false })), true, 'core ignores a saved "off"');
const always = MENU_ITEMS.filter(m => !m.module).map(m => m.id).sort();
eq(always, ['lock', 'settings', 'support'], 'Settings, Support & About and Lock app have no switch');
eq(SWITCHABLE_MODULES.some(id => ['settings', 'support'].includes(id)), false, 'no type can hide Settings or Support');
for (const t of BUSINESS_TYPES) eq(['guide', 'notifications', 'controlPanel', 'offlineButton'].every(id => shown(t.id, id)), true, `${t.id}: app helpers stay on (incl. the Offline mode button)`);

console.log('Existing switches untouched until a type is applied');
const mine = { reports: false, tdsTcs: true, futureThing: true };
const before = JSON.stringify(mine);
const changes = businessTypeChanges('freelancer', mine);
eq(JSON.stringify(mine), before, 'asking what changes does not change the map');
eq(changes.turnOn.includes('reports'), true, 'freelancer would turn Reports back on');
eq(changes.turnOff.includes('inventory') && changes.turnOff.includes('purchases'), true, 'freelancer would turn off Products and Purchases');
eq(changes.turnOn.includes('tdsTcs'), false, 'already-on TDS/TCS is not listed');
const applied = applyBusinessType('freelancer', mine);
eq(applied.futureThing, true, 'a key from a newer version is kept');
eq(JSON.stringify(mine), before, 'applying returns a new map');
eq(businessTypeChanges('freelancer', applied), { turnOn: [], turnOff: [] }, 'after applying, nothing left to change');

console.log('Unsaved draft vs saved');
eq(featureChanges({}, {}), { turnOn: [], turnOff: [] }, 'same switches: nothing to save');
eq(featureChanges({}, { reports: true }), { turnOn: [], turnOff: [] }, 'ticking something already on by default is no change');
eq(featureChanges({ reports: false }, {}), { turnOn: ['reports'], turnOff: [] }, 'back to default turns Reports on');
eq(featureChanges({}, { recurring: false, einvoice: true }), { turnOn: ['einvoice'], turnOff: ['recurring'] }, 'on and off listed');
eq(featureChanges({}, { dashboard: false }), { turnOn: [], turnOff: [] }, 'core items never count as a change');
eq(featureChanges({}, applyBusinessType('freelancer', {})), businessTypeChanges('freelancer', {}), 'picking a type = the same changes');

console.log('Sidebar order');
const def = MENU_ITEMS.map(m => m.id);
eq(orderedMenu([]).map(m => m.id), def, 'no saved order = default');
eq(orderedMenu(['ghost', 'reports']).map(m => m.id)[0], 'reports', 'saved first item comes first, unknown ids ignored');
eq(orderedMenu(undefined).length, MENU_ITEMS.length, 'bad saved order is safe');
let o = moveMenuItem([], 'reports', -1);
const aboveReports = def[def.indexOf('reports') - 1];
eq(o.indexOf('reports') < o.indexOf(aboveReports), true, `Reports moved above ${aboveReports}`);
eq(moveMenuItem(o, 'reports', +1), def, 'moving back down restores');
eq(moveMenuItem([], 'dashboard', -1), def, 'first item cannot go up');
const idsIn = (section) => MENU_ITEMS.filter(m => m.section === section).map(m => m.id);
eq(moveMenuItem([], idsIn('main').at(-1), +1), def, 'last of the top part cannot jump into the bottom part');
eq(moveMenuItem([], idsIn('bottom')[0], -1), def, 'first of the bottom part cannot jump into the top part');
eq(moveMenuItem([], idsIn('top')[0], -1), def, 'first top-bar button cannot jump into another part');
eq(['guide', 'notifications', 'lock', 'darkMode'].every(id => idsIn('top').includes(id)), true, 'dark mode, notifications, guide and lock are top-bar buttons');
o = moveMenuItem([], 'settings', -1);
eq(o.indexOf('settings') < o.indexOf('controlpanel'), true, 'bottom items reorder among themselves');
eq(moveMenuItem([], 'nope', 1), def, 'unknown item: no change');

console.log('[ERR-033] The wizard keeps the language and paper picked in it');
for (const biz of ['retail_shop', 'freelancer', 'wholesale', 'service']) {
  const r = wizardResult({ labelLanguage: 'en', paperSize: 'a4' }, { biz, language: 'hi', paperSize: '80mm' });
  eq([r.printSettings.labelLanguage, r.printSettings.paperSize, r.invoiceDefaults.paperSize, r.printSettings.onboardingComplete],
    ['hi', '80mm', '80mm', true], `${biz} + Hindi + 80mm: Hindi kept (the preset sets English), paper in the invoice defaults`);
}
eq(wizardResult({}, { biz: '', language: 'ta', paperSize: '' }).printSettings.labelLanguage, 'ta', 'no business type: the language still saves');
eq('paperSize' in wizardResult({}, { biz: '', language: 'en', paperSize: '' }).invoiceDefaults, false, 'no paper picked: the invoice paper is left as it was');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
