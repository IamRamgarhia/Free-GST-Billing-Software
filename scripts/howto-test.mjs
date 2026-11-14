// v1.10.86 - the quick search's "How do I…" answers and Help pages:
// every app target is a real screen / Settings section / text on screen,
// every guide link is a real docs section, and typical questions find the
// right answer. Run: `node scripts/howto-test.mjs`
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HOW_TO, VIEW_LABELS, SECTION_LABELS, matchHowTo, matchHelp, whereLabel } from '../src/utils/howTo.js';
import { helpIndex } from '../docs-site/sections.mjs';
import { HELP_INDEX_FILE, helpIndexJson } from './build-help-index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log(`  FAIL ${label}`); } };

const app = read('src/App.jsx');
const settings = read('src/components/SettingsView.jsx');
const quick = read('src/components/QuickSearch.jsx');
const components = readdirSync(join(ROOT, 'src', 'components')).filter((f) => f.endsWith('.jsx'))
  .map((f) => read(`src/components/${f}`)).join('\n').toLowerCase();
const docs = new Set(helpIndex().map(([d]) => d));

ok(HOW_TO.length >= 60 && HOW_TO.length <= 90, `60-90 questions (${HOW_TO.length})`);
ok(new Set(HOW_TO.map((h) => h.q)).size === HOW_TO.length, 'No question twice');
for (const h of HOW_TO) {
  const { view, section, find, click, action } = h.go || {};
  ok(/^How do I .+\?$/.test(h.q), `${h.q}: reads "How do I …?"`);
  ok(view || action, `${h.q}: goes somewhere`);
  if (view) ok(VIEW_LABELS[view] && app.includes(`currentView === '${view}'`), `${h.q}: screen "${view}" exists`);
  if (section) ok(view === 'settings' && SECTION_LABELS[section] && settings.includes(`'${section}'`), `${h.q}: Settings section "${section}" exists`);
  for (const t of [find, click].filter(Boolean)) ok(components.includes(t.toLowerCase()), `${h.q}: "${t}" is on a screen`);
  if (action) ok(quick.includes(`'${action}'`), `${h.q}: action "${action}" is handled`);
  ok(docs.has(h.doc), `${h.q}: guide link ${h.doc} exists in docs-site/pages`);
  ok(whereLabel(h.go).length > 0, `${h.q}: says where it goes`);
}
for (const s of Object.keys(SECTION_LABELS)) ok(settings.includes(`'${s}'`), `SECTION_LABELS ${s} is a Settings section`);

// The bundled Help pages index matches docs-site/pages (npm run help:index).
ok(readFileSync(HELP_INDEX_FILE, 'utf8').replace(/\r\n/g, '\n') === helpIndexJson(), 'src/utils/helpIndex.json is up to date (run npm run help:index)');

// Typical questions find the expected answer first.
const first = (q) => matchHowTo(q)[0]?.q;
const expect = [
  ['credit note', 'How do I make a credit note?'],
  ['how do i add my logo', 'How do I add my logo?'],
  ['pair phone', 'How do I pair my phone?'],
  ['change invoice number', 'How do I change the invoice number?'],
  ['gstr1', 'How do I file GSTR-1?'],
  ['part payment', 'How do I record a part payment?'],
  ['backup', 'How do I back up my data?'],
  ['bill kaise banaye', 'How do I make an invoice?'],
  ['udhaar', 'How do I see who owes me money?'],
  ['maal wapas supplier', 'How do I return goods to a supplier?'],
  ['challan', 'How do I make a delivery challan?'],
  ['tally', 'How do I import from Tally, Vyapar or Excel?'],
  ['forgot pin', 'How do I reset my PIN?'],
  ['whatsap', 'How do I send an invoice on WhatsApp?'],
  ['thermel printer', 'How do I print on a thermal printer?'],
  ['box 12', 'How do I sell in boxes (Box = 12 Pcs)?'],
];
for (const [q, want] of expect) ok(first(q) === want, `"${q}" -> ${want} (got ${first(q)})`);
ok(matchHowTo('').length === 5 && matchHowTo('').every((h) => h.pop), 'Empty search: 5 popular questions');
ok(matchHowTo('zzqx').length === 0, 'Nonsense finds nothing');
const help = matchHelp('thermal', helpIndex());
ok(help.length > 0 && help.every((x) => docs.has(x.doc)), 'Help pages: "thermal" finds real sections');
ok(matchHelp('wrong pin', helpIndex())[0]?.doc === 'troubleshooting#pin-forgotten', `Help pages: "wrong pin" -> troubleshooting#pin-forgotten (got ${matchHelp('wrong pin', helpIndex())[0]?.doc})`);
ok(matchHelp('', helpIndex()).length === 0, 'Help pages: nothing for an empty search');

console.log(`howto-test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
