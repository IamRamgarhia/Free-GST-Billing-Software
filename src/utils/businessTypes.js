// v1.10.83 - business type decides which features are switched on.
//
// Asked for: "business type comes first" - a kirana shop should not see
// Manufacturing, and a freelancer should not see Products or Purchases.
// The first-run wizard and Settings → Business type both use this file, so
// the two can never disagree. Pure: no storage, no React (unit-tested in
// scripts/businesstype-test.mjs).
//
// Applying a type only changes what is SHOWN. Nothing is ever deleted.

import { FEATURE_GROUPS, MENU_ITEMS, isModuleEnabled } from '../utils.js';
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
const APP_HELPERS = ['guide', 'notifications', 'darkMode', 'controlPanel', 'offlineButton'];
// Every type sells, and every business handles cash (the cash book).
const SELLING = ['receipts', 'cashBook', 'reports', 'gstReturns', 'incomeTax', 'upiQr', 'googleDrive'];
const GOODS = ['inventory', 'purchases', 'expenses'];
const TRADING = [...GOODS, 'purchaseOrders', 'gstr2b', 'ewayBill', 'tdsTcs'];

// `on` lists what the type turns on; every other switchable module goes off.
// Ids match BUSINESS_PRESETS in printSettings.js, so the wizard can apply
// the invoice style and the features from one choice.
export const BUSINESS_TYPES = [
  { id: 'retail_shop', label: 'Retail shop / kirana', hint: 'Sell from a counter, keep stock, buy from suppliers.',
    on: [...GOODS, 'gstr2b', 'phoneFirst', ...SELLING] },
  { id: 'freelancer', label: 'Freelancer / consultant', hint: 'Bill for your time or services; no stock.',
    on: ['expenses', 'recurring', 'tdsTcs', ...SELLING] },
  { id: 'restaurant', label: 'Restaurant / cafe', hint: 'Quick bills, UPI payments, buy supplies.',
    on: [...GOODS, 'phoneFirst', ...SELLING] },
  { id: 'wholesale', label: 'Wholesale / trading', hint: 'Buy and sell goods in bulk, send them with e-way bills.',
    on: [...TRADING, ...SELLING] },
  { id: 'manufacturer', label: 'Manufacturing', hint: 'Make products from raw material, maybe in more than one unit.',
    on: [...TRADING, 'manufacturing', 'costCentres', ...SELLING] },
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
// `order` is the saved list of item ids. Items missing from it (new in a
// later version) keep their place after the saved ones; unknown ids are
// ignored, so an old saved order never breaks the menu.
export const orderedMenu = (order = []) => {
  const saved = Array.isArray(order) ? order : [];
  const rank = (item) => {
    const i = saved.indexOf(item.id);
    return i === -1 ? saved.length + MENU_ITEMS.indexOf(item) : i;
  };
  return [...MENU_ITEMS].sort((a, b) => rank(a) - rank(b));
};

// Move one item up (-1) or down (+1) inside its own part of the sidebar.
// Returns the new order (all ids); the same order if it cannot move.
export const moveMenuItem = (order, id, dir) => {
  const list = orderedMenu(order).map(m => m.id);
  const item = MENU_ITEMS.find(m => m.id === id);
  if (!item) return list;
  const sameSection = list.filter(x => MENU_ITEMS.find(m => m.id === x).section === item.section);
  const pos = sameSection.indexOf(id);
  const other = sameSection[pos + dir];
  if (!other) return list;
  const a = list.indexOf(id), b = list.indexOf(other);
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};
