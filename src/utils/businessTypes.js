// v1.10.83 - business type decides which features are switched on.
//
// Asked for: "business type comes first" - a kirana shop should not see
// Manufacturing, and a freelancer should not see Products or Purchases.
// The first-run wizard and Settings → Business type both use this file, so
// the two can never disagree. Pure: no storage, no React (unit-tested in
// scripts/businesstype-test.mjs).
//
// Applying a type only changes what is SHOWN. Nothing is ever deleted.

import { FEATURE_GROUPS, isModuleEnabled } from '../utils.js';
import { applyBusinessPreset } from './printSettings.js';

// ERR-033 - what the first-run wizard saves. The business preset goes first,
// THEN the language and paper picked in the wizard (four presets set English,
// which overwrote a Hindi / Tamil choice), and the paper also goes into the
// invoice defaults, which is what the invoice screen reads. Tested in
// scripts/businesstype-test.mjs.
export function wizardResult(current, { biz, language, paperSize }) {
  let next = { ...current, onboardingComplete: true, onboardingSkipped: false };
  if (biz) next = applyBusinessPreset(next, biz);
  next.labelLanguage = language;
  if (paperSize) next.paperSize = paperSize;
  const invoiceDefaults = { ...(biz ? invoiceDefaultsForType(biz) : {}), ...(paperSize ? { paperSize } : {}) };
  return { printSettings: next, invoiceDefaults };
}

// Every module a person can switch (core ones are always on).
export const SWITCHABLE_MODULES = FEATURE_GROUPS.flatMap(g => g.modules).filter(m => !m.core).map(m => m.id);

// Menu helpers every type keeps: they are about the app, not the business.
const APP_HELPERS = ['guide', 'notifications', 'darkMode', 'controlPanel', 'offlineButton', 'phoneButton']; // v1.10.86 - phoneButton
// Every type sells, and every business handles cash (the cash book).
const SELLING = ['receipts', 'cashBook', 'reports', 'gstReturns', 'incomeTax', 'upiQr', 'googleDrive'];
const GOODS = ['inventory', 'purchases', 'expenses'];
// v1.10.85 (#135) - sales orders go with purchase orders: wholesale and manufacturing.
const TRADING = [...GOODS, 'purchaseOrders', 'salesOrders', 'gstr2b', 'ewayBill', 'tdsTcs'];
// v1.10.85 (#137) - 'barcodes' is on for retail, wholesale and manufacturing (and Everything).

// `on` lists what the type turns on; every other switchable module goes off.
// Ids match BUSINESS_PRESETS in printSettings.js, so the wizard can apply
// the invoice style and the features from one choice.
export const BUSINESS_TYPES = [
  { id: 'retail_shop', label: 'Retail shop / kirana', hint: 'Sell from a counter, keep stock, buy from suppliers.',
    on: [...GOODS, 'gstr2b', 'phoneFirst', 'barcodes', ...SELLING] },
  { id: 'freelancer', label: 'Freelancer / consultant', hint: 'Bill for your time or services; no stock.',
    on: ['expenses', 'recurring', 'tdsTcs', ...SELLING] },
  { id: 'restaurant', label: 'Restaurant / cafe', hint: 'Quick bills, UPI payments, buy supplies.',
    on: [...GOODS, 'phoneFirst', ...SELLING] },
  { id: 'wholesale', label: 'Wholesale / trading', hint: 'Buy and sell goods in bulk, send them with e-way bills.',
    on: [...TRADING, 'barcodes', ...SELLING] },
  { id: 'manufacturer', label: 'Manufacturing', hint: 'Make products from raw material, maybe in more than one unit.',
    on: [...TRADING, 'manufacturing', 'costCentres', 'barcodes', ...SELLING] },
  { id: 'service', label: 'Service / repair shop', hint: 'Repairs and services, spare parts in stock, yearly contracts.',
    on: [...GOODS, 'recurring', 'phoneFirst', ...SELLING] },
  { id: 'everything', label: 'Everything', hint: 'Show every feature the app has.',
    on: SWITCHABLE_MODULES },
];

export const businessTypeById = (id) => BUSINESS_TYPES.find(t => t.id === id) || null;

// v1.10.83 - what a type sets on NEW invoices (saved as the invoice defaults
// when the type is chosen; invoices already made keep their own options).
// A freelancer bills services by the hour, day or job, so invoices start in
// Services mode and the unit is not printed next to the quantity.
export const invoiceDefaultsForType = (typeId) => (typeId === 'freelancer'
  ? { invoiceMode: 'services', showItemUnit: false }
  : {});

// The full switch map a type gives: every switchable module, true or false.
export const modulesForType = (typeId) => {
  const type = businessTypeById(typeId);
  if (!type) return null;
  const on = new Set([...type.on, ...APP_HELPERS]);
  return Object.fromEntries(SWITCHABLE_MODULES.map(id => [id, on.has(id)]));
};

// The new saved map after applying a type. Keys this file does not know
// (a module from a newer version) are kept as they were.
export const applyBusinessType = (typeId, currentMap = {}) => {
  const target = modulesForType(typeId);
  return target ? { ...currentMap, ...target } : { ...currentMap };
};

// What would change going from one switch map to another (the "Turn on /
// Turn off" line under the unsaved Business type and Features tabs).
export const featureChanges = (fromMap = {}, toMap = {}) => {
  const turnOn = [], turnOff = [];
  for (const id of SWITCHABLE_MODULES) {
    const now = isModuleEnabled(id, fromMap), want = isModuleEnabled(id, toMap);
    if (want && !now) turnOn.push(id);
    if (!want && now) turnOff.push(id);
  }
  return { turnOn, turnOff };
};

// What applying a type would change.
export const businessTypeChanges = (typeId, currentMap = {}) =>
  featureChanges(currentMap, applyBusinessType(typeId, currentMap));

const LABELS = Object.fromEntries(FEATURE_GROUPS.flatMap(g => g.modules).map(m => [m.id, m.label]));
export const moduleLabel = (id) => LABELS[id] || id;

// ---- Sidebar order ----
// v1.10.86 - the order now has groups; it lives in utils/menuGroups.js.
export { orderedMenu, moveMenuItem } from './menuGroups.js';
