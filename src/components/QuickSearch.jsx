import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Command, ExternalLink, HelpCircle, BookOpen } from 'lucide-react';
import { getAllBills, getAllClients, getAllProducts } from '../store';
import { docsLink, trackedStock } from '../utils';
import { HOW_TO, VIEW_LABELS, matchHowTo, matchHelp, whereLabel } from '../utils/howTo';
import HELP_INDEX from '../utils/helpIndex.json';
import { openCustomiseMenu } from './MenuCustomise';
import { toast } from './Toast';
import HelpButton from './HelpButton';

/*
 * v1.10.86 - the quick search (Ctrl+K, and the "Search…" box),
 * moved out of App.jsx. Besides screens, Settings sections, invoices,
 * clients and products it now answers "How do I…" questions
 * (src/utils/howTo.js): Enter / click takes you there in the app, the Guide
 * button opens that part of the online guide. "Help pages" searches the
 * guide's page and section titles (src/utils/helpIndex.json).
 */

const openGuide = (doc) => window.open(docsLink(doc), '_blank', 'noopener,noreferrer');
const RECORDS_PER_KIND = 10;
const GUIDE_LABEL = 'Read the guide (opens in your browser, needs internet)';

// After "Take me there": scroll to and briefly outline the box the answer is
// about (a lazy screen may take a moment to appear, so look for ~4 s).
const SPOT_TARGETS = 'h1, h2, h3, h4, h5, label, legend, summary, button, [role="tab"], .section-title, .form-label';
const visible = (el) => !!el && el.offsetParent !== null;
const findByText = (text) => {
  const want = text.toLowerCase();
  const root = document.querySelector('.main-content') || document.body;
  const els = [...root.querySelectorAll(SPOT_TARGETS)].filter(visible);
  // Leading icons and emoji ("🗑 Trash bin") do not count.
  const norm = (el) => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase().replace(/^[^a-z0-9]+/, '');
  return els.find((el) => norm(el) === want) || els.find((el) => norm(el).startsWith(want));
};
const mark = (el) => {
  el.classList.add('qs-spot');
  setTimeout(() => el.classList.remove('qs-spot'), 2600);
};
// `fallbackId`: the Settings section, outlined when the box is not shown
// (for example Pair a phone while phone access is off).
function spotlight({ id, text, click, fallbackId }) {
  const started = Date.now();
  const tick = () => {
    const el = id ? document.getElementById(id) : findByText(text);
    if (!visible(el)) {
      if (Date.now() - started < 3000) setTimeout(tick, 150);
      else if (fallbackId) spotlight({ id: fallbackId });
      return;
    }
    if (click) {
      el.click();
      // The tab redraws with its new look; outline it after that.
      setTimeout(() => mark(findByText(text) || el), 250);
      return;
    }
    // Settings scrolls to its own sections; a box inside one is scrolled to
    // here, a moment later so Settings' own scroll does not undo it.
    if (!id) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    mark(el);
  };
  setTimeout(tick, 150);
}

const SETTINGS_JUMPS = [
  ['Company profile', 'section-company'], ['Payment accounts', 'section-company'],
  ['Print & PDF Settings', 'section-print'], ['PDF Style Editor', 'section-print'],
  ['Business type presets', 'section-print'], ['Section labels', 'section-print'],
  ['Watermarks', 'section-print'], ['Multi-copy print', 'section-print'],
  ['Digital signature', 'section-company'], ['Company letterhead', 'section-print'],
  ['Business type', 'section-biztype'], ['Features', 'section-modules'], ['Region preference', 'section-region'],
  ['Google Drive backup', 'section-cloud'], ['App updates', 'section-updates'],
  ['Appearance: App colour', 'section-appearance'], ['Appearance: Text size', 'section-appearance'], ['Appearance: Compact lists', 'section-appearance'], ['Appearance: Red dots in the menu', 'section-appearance'],
];

export default function QuickSearch({
  onClose, navItems, bottomIds, topIds, updateInfo,
  onNewInvoice, onEditInvoice, onView, onSettings, onDarkMode, onShortcuts, onUpdate, onOpenDocs,
}) {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);
  // v1.9.4 - invoices, clients and products, read each time the search opens.
  const [corpus, setCorpus] = useState({ bills: [], clients: [], products: [] });
  useEffect(() => {
    let live = true;
    Promise.all([
      getAllBills().catch(() => []), getAllClients().catch(() => []), getAllProducts().catch(() => []),
    ]).then(([bills, clients, products]) => {
      if (live) setCorpus({ bills: bills.slice(0, 100), clients: clients.slice(0, 200), products: products.slice(0, 200) });
    });
    return () => { live = false; };
  }, []);

  // A screen switched off in Settings -> Features is not opened (App would
  // send it back to the Dashboard): Features opens instead, with a word why.
  const canOpen = (view) => view === 'settings' || view === 'support'
    || (view === 'controlpanel' ? bottomIds.includes('controlpanel') : navItems.some((i) => i.id === view));
  const takeMeThere = ({ view, section, find, click, action }) => {
    if (action === 'customise-menu') openCustomiseMenu();
    else if (action === 'dark-mode') onDarkMode();
    else if (action === 'shortcuts') onShortcuts();
    if (!view) return;
    if (!canOpen(view)) {
      onSettings('section-modules');
      toast(`${VIEW_LABELS[view]} is switched off. Turn it on here, under Features.`, 'info', 6000);
      return;
    }
    if (action === 'new-invoice') onNewInvoice();
    else if (view === 'settings') onSettings(section);
    else onView(view);
    if (find || click) spotlight({ text: find || click, click: !!click, fallbackId: section });
    else if (section) spotlight({ id: section });
  };

  const actions = useMemo(() => {
    const acts = [{ label: 'New Invoice', hint: 'Ctrl+N', run: onNewInvoice }];
    navItems.forEach((item) => {
      if (item.id !== 'new') acts.push({ label: `Go to ${item.label}`, run: item.onClick || (() => onView(item.id)) });
    });
    acts.push({ label: 'Go to Settings', run: () => onView('settings') });
    // v1.10.83 - like every menu item, not when it is switched off.
    if (bottomIds.includes('controlpanel')) acts.push({ label: 'Go to Control Panel', run: () => onView('controlpanel') });
    acts.push({ label: 'Go to Support & About', run: () => onView('support') });
    if (topIds.includes('guide')) acts.push({ label: 'Open the User Guide', run: onOpenDocs });
    acts.push({ label: 'Toggle dark mode', run: onDarkMode });
    acts.push({ label: 'Show keyboard shortcuts', hint: 'Ctrl+/', run: onShortcuts });
    if (updateInfo?.updateAvailable) acts.push({ label: `View update — v${updateInfo.latest}`, run: onUpdate });
    return acts;
  }, [navItems, bottomIds, topIds, updateInfo, onNewInvoice, onView, onOpenDocs, onDarkMode, onShortcuts, onUpdate]);

  const records = useMemo(() => ({
    // v1.10.5 - an invoice opens for editing, as a Dashboard row click does.
    invoices: corpus.bills.map((b) => ({
      name: b.invoiceNumber || '', label: `📄 ${b.invoiceNumber || 'INV-?'} — ${b.clientName || 'No client'}`,
      hint: b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString('en-IN') : '', run: () => onEditInvoice(b),
    })),
    clients: corpus.clients.map((c) => ({
      name: c.name || '', label: `👤 ${c.name} — client${c.gstin ? ' · GSTIN: ' + c.gstin : ''}`,
      hint: c.phone || c.email || '', run: () => onView('clients'),
    })),
    // v1.10.83 - a product result opens Products, so none while it is hidden.
    products: navItems.some((i) => i.id === 'inventory') ? corpus.products.map((p) => ({
      name: p.name || '', label: `📦 ${p.name} — product${p.hsn ? ' · HSN: ' + p.hsn : ''}`,
      hint: trackedStock(p) === null ? '' : trackedStock(p) + ' in stock', run: () => onView('inventory'),
    })) : [],
  }), [corpus, navItems, onEditInvoice, onView]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const has = (a) => !q || a.label.toLowerCase().includes(q);
    const screens = actions.filter(has);
    const settings = SETTINGS_JUMPS.map(([s, id]) => ({ label: `⚙️ Settings → ${s}`, run: () => onSettings(id) })).filter(has);
    const howTo = matchHowTo(q).map((h) => ({
      label: h.q, sub: `Opens ${whereLabel(h.go)}`, guide: h.doc, how: true, run: () => takeMeThere(h.go),
    }));
    const shownDocs = new Set(howTo.map((h) => h.guide));
    const help = matchHelp(q, HELP_INDEX).filter((x) => !shownDocs.has(x.doc)).map((x) => ({
      label: x.title, sub: x.page, hint: 'Opens in your browser', doc: true, run: () => openGuide(x.doc),
    }));
    const recs = q ? [
      ['Invoices', records.invoices], ['Clients', records.clients], ['Products', records.products],
    ].map(([title, list]) => [title, list.filter(has).slice(0, RECORDS_PER_KIND)]) : [];
    // An invoice number or a name typed: the records come first.
    const exact = q && (/\d/.test(q) || recs.some(([, list]) => list.some((r) => r.name.toLowerCase().startsWith(q))));
    // Empty box: the popular questions first, so they are seen without scrolling.
    const main = q ? [['Screens', screens], ['How do I…', howTo], ['Settings', settings]]
      : [['How do I…', howTo], ['Screens', screens], ['Settings', settings]];
    const all = exact ? [...recs, ...main, ['Help pages', help]] : [...main, ...recs, ['Help pages', help]];
    return all.filter(([, items]) => items.length);
    // takeMeThere only uses the props listed via actions / records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions, records, onSettings]);
  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  const run = (item) => { onClose(); item.run(); };
  const guide = (item) => { onClose(); openGuide(item.guide); };

  // Arrows / Enter / Esc; Shift+Enter on a "How do I…" row opens its guide.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON') {
        e.preventDefault();
        const item = flat[idx];
        if (item) (e.shiftKey && item.guide ? guide : run)(item);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, idx, onClose]);
  useEffect(() => {
    listRef.current?.querySelector('[data-qs-on="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  let n = -1;
  return (
    <div className="modal-overlay qs-overlay" onClick={onClose}>
      <div className="modal-content qs-panel" role="dialog" aria-label="Quick search" onClick={(e) => e.stopPropagation()}>
        <div className="qs-head">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input autoFocus type="text" placeholder="Search, or ask: how do I…" aria-label="Search, or ask how do I"
            value={query} onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
            className="form-input qs-input" />
          <button type="button" className="qs-esc" onClick={onClose} aria-label="Close">Esc</button>
        </div>
        <div className="qs-list" ref={listRef}>
          {flat.length === 0 && (
            <p className="qs-empty">
              Nothing matches "{query}". Try fewer words, or <button type="button" className="qs-link" onClick={() => { onClose(); onOpenDocs(); }}>search the user guide</button>.
            </p>
          )}
          {groups.map(([title, items]) => (
            <div key={title} role="group" aria-label={title}>
              <div className="qs-group">{title}</div>
              {items.map((a) => {
                n += 1;
                const i = n;
                const on = i === idx;
                return (
                  <div key={`${title}-${a.label}`} className={`qs-row${on ? ' qs-row-on' : ''}`} data-qs-on={on ? '1' : '0'} onMouseEnter={() => setIdx(i)}>
                    <button type="button" className="qs-main" onClick={() => run(a)}>
                      {a.how && <HelpCircle size={15} className="qs-icon" />}
                      {a.doc && <BookOpen size={15} className="qs-icon" />}
                      <span className="qs-text">
                        <span className="qs-label">{a.label}</span>
                        {a.sub && <span className="qs-sub">{a.sub}</span>}
                      </span>
                      {a.hint && <span className="qs-hint">{a.hint}</span>}
                    </button>
                    {a.guide && (
                      <button type="button" className="qs-guide" onClick={() => guide(a)} title={GUIDE_LABEL} aria-label={`${a.label} ${GUIDE_LABEL}`}>
                        Guide <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="qs-foot">
          <span><Command size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /><span className="qs-keys">↑↓ move · Enter open · Shift+Enter guide · </span>{HOW_TO.length} how-to answers <HelpButton title="Quick search" doc="shortcuts#command-palette" size={16} /></span>
          <button type="button" className="qs-link" onClick={() => { onClose(); onShortcuts(); }}>All shortcuts (Ctrl+/)</button>
        </div>
      </div>
    </div>
  );
}
