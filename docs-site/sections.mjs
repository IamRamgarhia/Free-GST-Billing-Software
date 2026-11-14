// v1.10.86 - the documentation pages and their sections, shared by the docs
// build (build.mjs) and the app's quick search index (scripts/build-help-index.mjs),
// so both read the same section ids and titles.
import start from './pages/start.mjs';
import gstBasics from './pages/gst-basics.mjs';
import install from './pages/install.mjs';
import daily from './pages/daily.mjs';
import clients from './pages/clients.mjs';
import products from './pages/products.mjs';
import payments from './pages/payments.mjs';
import buying from './pages/buying.mjs';
import money from './pages/money.mjs';
import reports from './pages/reports.mjs';
import incomeTax from './pages/income-tax.mjs';
import setup from './pages/setup.mjs';
import invoice from './pages/invoice.mjs';
import print from './pages/print.mjs';
import help from './pages/help.mjs';
import about from './pages/about.mjs';
import security from './pages/security.mjs';

export const PAGES = [...start, ...gstBasics, ...install, ...invoice, ...daily, ...clients, ...products, ...payments, ...buying, ...money, ...reports, ...incomeTax, ...setup, ...print, ...help, ...about, ...security];

export const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// v1.10.83 - an <h3> section is an entry under the <h2> group before it (the
// Troubleshooting error catalogue): linkable and searchable, not in the TOC.
export const sectionsOf = (p) => [...p.body.matchAll(/<section id="([a-z0-9-]+)"[^>]*>\s*<h([23])>([\s\S]*?)<\/h\2>/g)]
  .map((m) => ({ id: m[1], title: text(m[3]), level: Number(m[2]) }));

// The app's quick search: one row per page and per section, titles only:
// ["page", page name] and ["page#section", section title] (HelpButton's doc).
export const helpIndex = () => PAGES.flatMap((p) => [
  [p.slug, p.nav || p.title],
  ...sectionsOf(p).map((s) => [`${p.slug}#${s.id}`, s.title]),
]);
