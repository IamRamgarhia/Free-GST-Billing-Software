// Builds the public documentation site: plain HTML/CSS/JS with relative links,
// so the output folder can be uploaded under any path on any web server.
//
//   node docs-site/build.mjs   ->  docs-site/out/<SITE.folder>/
//
// Every page shares one layout, so the sidebar, header and footer cannot drift
// between pages. Page content lives in docs-site/pages/*.mjs as HTML strings;
// each <section id="..."><h2> becomes an anchor, a table-of-contents entry and
// a search result. Those section ids are what the app's Help buttons link to,
// so treat them as a public API: rename one and a Help button breaks.
//
// Search engines and AI tools: every page gets a canonical address, a
// description, social-preview tags and structured data; the build also writes
// sitemap.xml, robots.txt, llms.txt and llms-full.txt. Those need full
// addresses, taken from SITE.url.

import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { NAV, SITE, SEO } from './site.mjs';
import start from './pages/start.mjs';
import daily from './pages/daily.mjs';
import money from './pages/money.mjs';
import setup from './pages/setup.mjs';
import invoice from './pages/invoice.mjs';
import print from './pages/print.mjs';
import help from './pages/help.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out', SITE.folder);
const IMG_SRC = join(HERE, 'assets', 'img');
const PAGES = [...start, ...invoice, ...daily, ...money, ...setup, ...print, ...help];
const TODAY = new Date().toISOString().slice(0, 10);
const BRAND = 'Free GST Billing Software';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const pageUrl = (slug) => (slug === 'index' ? SITE.url : `${SITE.url}${slug}.html`);
// Search results show about 155 characters; cut on a word, never mid-word.
const clip = (s, n = 155) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n - 1))}…`);

// ---- checks: a broken anchor is a broken Help button ------------------------
const bySlug = new Map(PAGES.map((p) => [p.slug, p]));
for (const group of NAV) for (const slug of group.pages) {
  if (!bySlug.has(slug)) throw new Error(`nav lists "${slug}" but no page has that slug`);
}
for (const p of PAGES) {
  if (!NAV.some((g) => g.pages.includes(p.slug))) throw new Error(`page "${p.slug}" is not in the sidebar`);
}
const sectionsOf = (p) => [...p.body.matchAll(/<section id="([a-z0-9-]+)"[^>]*>\s*<h2>([\s\S]*?)<\/h2>/g)]
  .map((m) => ({ id: m[1], title: text(m[2]) }));
for (const p of PAGES) {
  const ids = sectionsOf(p).map((s) => s.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`${p.slug}: section id "${dupe}" is used twice`);
}
for (const p of PAGES) {
  for (const m of p.body.matchAll(/href="([a-z0-9-]+)\.html(?:#([a-z0-9-]+))?"/g)) {
    const target = bySlug.get(m[1]);
    if (!target) throw new Error(`${p.slug}: link to missing page ${m[1]}.html`);
    if (m[2] && !sectionsOf(target).some((s) => s.id === m[2])) {
      throw new Error(`${p.slug}: link to missing section ${m[1]}.html#${m[2]}`);
    }
  }
  for (const m of p.body.matchAll(/src="assets\/img\/([^"]+)"/g)) {
    if (!existsSync(join(IMG_SRC, m[1]))) throw new Error(`${p.slug}: missing image ${m[1]}`);
  }
}

// ---- images: PNG screenshots are served as WebP (a third of the size) -------
// Pages are written with .png sources; the build swaps in .webp and adds
// width/height so the page does not jump while images load.
const imgSize = new Map();
async function buildImages() {
  for (const f of readdirSync(IMG_SRC)) {
    const src = join(IMG_SRC, f);
    if (f.endsWith('.png')) {
      const img = sharp(src);
      const meta = await img.metadata();
      // Screenshots were taken at 1.5x; 1600 px wide is sharp on any screen.
      const width = Math.min(meta.width, 1600);
      const info = await img.resize({ width, withoutEnlargement: true }).webp({ quality: 82 })
        .toFile(join(OUT, 'assets', 'img', f.replace(/\.png$/, '.webp')));
      imgSize.set(f, { w: info.width, h: info.height });
    } else {
      copyFileSync(src, join(OUT, 'assets', 'img', f));
    }
  }
  // Social preview (1200x630) and the home-screen icon.
  await makeSocialImage(join(OUT, 'assets', 'img', 'og.png'));
  await sharp(join(IMG_SRC, 'icon.svg'), { density: 400 }).resize(180, 180)
    .png().toFile(join(OUT, 'assets', 'img', 'apple-touch-icon.png'));
}
const withImages = (html) => html.replace(/<img src="assets\/img\/([^"]+)\.png"/g, (_, name) => {
  const s = imgSize.get(`${name}.png`);
  return `<img src="assets/img/${name}.webp"${s ? ` width="${s.w}" height="${s.h}"` : ''}`;
});

async function makeSocialImage(file) {
  const shot = await sharp(join(IMG_SRC, 'app-dashboard.png')).resize({ width: 600 }).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#f6f8fb"/>
    <rect x="0" y="0" width="14" height="630" fill="#2563eb"/>
    <text x="64" y="170" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" fill="#15233f">Free GST</text>
    <text x="64" y="240" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700" fill="#15233f">Billing Software</text>
    <text x="64" y="310" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#44526d">GST invoices, payments, stock</text>
    <text x="64" y="352" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#44526d">and GSTR-1 / GSTR-3B.</text>
    <text x="64" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#0e7a5c">Free · Offline · No signup</text>
    <text x="64" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#44526d">Documentation</text>
  </svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: shot, left: 560, top: 140 }]).png().toFile(file);
}

// ---- structured data ----------------------------------------------------------
const publisher = { '@type': 'Organization', name: SITE.publisher.name, url: SITE.publisher.url };
function jsonLd(p, title, description) {
  const group = NAV.find((g) => g.pages.includes(p.slug));
  const graph = [{
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Documentation', item: SITE.url },
      ...(p.slug === 'index' ? [] : [
        { '@type': 'ListItem', position: 2, name: group.title, item: pageUrl(group.pages[0]) },
        { '@type': 'ListItem', position: 3, name: p.title, item: pageUrl(p.slug) },
      ]),
    ],
  }];
  if (p.slug === 'index') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: BRAND,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'GST billing and invoicing',
      operatingSystem: 'Windows 10, Windows 11, macOS, Linux',
      softwareVersion: SITE.version,
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      downloadUrl: SITE.download,
      url: SITE.url,
      sameAs: [SITE.repo],
      description,
      publisher,
    }, {
      '@type': 'WebSite', name: `${BRAND} documentation`, url: SITE.url, inLanguage: 'en-IN', publisher,
    });
  } else {
    graph.push({
      '@type': 'TechArticle',
      headline: title,
      description,
      url: pageUrl(p.slug),
      dateModified: TODAY,
      inLanguage: 'en-IN',
      about: { '@type': 'SoftwareApplication', name: BRAND },
      publisher,
      image: `${SITE.url}assets/img/og.png`,
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---- layout -------------------------------------------------------------------
const order = NAV.flatMap((g) => g.pages);
const sidebar = (current) => NAV.map((g) => `
      <div class="nav-group">
        <p class="nav-heading">${esc(g.title)}</p>
        <ul>${g.pages.map((slug) => {
          const p = bySlug.get(slug);
          const here = slug === current;
          return `<li><a href="${slug}.html"${here ? ' aria-current="page"' : ''}>${esc(p.nav || p.title)}</a></li>`;
        }).join('')}</ul>
      </div>`).join('');

function page(p) {
  const sections = sectionsOf(p);
  const i = order.indexOf(p.slug);
  const prev = i > 0 ? bySlug.get(order[i - 1]) : null;
  const next = i < order.length - 1 ? bySlug.get(order[i + 1]) : null;
  const seo = SEO[p.slug] || {};
  const title = seo.title || p.title;
  const docTitle = p.slug === 'index' ? title : `${title} | ${BRAND}`;
  const description = seo.description || clip(text(p.lead));
  const url = pageUrl(p.slug);
  const group = NAV.find((g) => g.pages.includes(p.slug));
  const body = withImages(p.body).replace(/<section id="([a-z0-9-]+)"([^>]*)>\s*<h2>/g,
    (_, id, rest) => `<section id="${id}"${rest}>\n<h2><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>`);
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#2563eb">
<meta property="og:type" content="${p.slug === 'index' ? 'website' : 'article'}">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE.url}assets/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE.url}assets/img/og.png">
<link rel="icon" href="assets/img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="alternate" type="text/plain" title="Documentation for AI tools" href="llms.txt">
<script type="application/ld+json">${jsonLd(p, title, description)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,750&family=Hind:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/style.css">
<script>try{var t=localStorage.getItem('fgb-docs-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button class="menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Open the menu">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
  </button>
  <a class="brand" href="index.html">
    <img src="assets/img/icon.svg" alt="" width="30" height="30">
    <span>${esc(SITE.name)}</span>
  </a>
  <div class="search">
    <label class="sr-only" for="q">Search the docs</label>
    <input id="q" type="search" placeholder="Search" autocomplete="off" spellcheck="false">
    <kbd class="search-key" aria-hidden="true">/</kbd>
    <div class="results" role="listbox" hidden></div>
  </div>
  <button class="theme-btn" type="button" aria-label="Switch between light and dark">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </button>
  <a class="download" href="${SITE.download}">Download</a>
</header>
<div class="shell">
  <nav class="sidebar" id="sidebar" aria-label="Documentation">${sidebar(p.slug)}
    <p class="sidebar-foot">Written for version ${esc(SITE.version)}. <a href="${SITE.repo}/releases">What changed in each version</a></p>
  </nav>
  <div class="scrim" hidden></div>
  <main id="main" class="doc">
    ${p.slug === 'index' ? '' : `<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Documentation</a> <span aria-hidden="true">/</span> ${esc(group.title)}</nav>`}
    <h1>${esc(p.title)}</h1>
    <p class="lead">${p.lead}</p>
    <div class="ledger">
${body}
    </div>
    <nav class="pager" aria-label="Previous and next page">
      ${prev ? `<a class="prev" href="${prev.slug}.html"><span>Previous</span>${esc(prev.nav || prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="next" href="${next.slug}.html"><span>Next</span>${esc(next.nav || next.title)}</a>` : '<span></span>'}
    </nav>
    <footer class="foot">
      <p>${esc(BRAND)} is free and open source under the MIT licence, made by <a href="${SITE.publisher.url}">${esc(SITE.publisher.name)}</a>. Something wrong or missing on this page?
      <a href="${SITE.repo}/issues">Tell us on GitHub</a>.</p>
    </footer>
  </main>
  <aside class="toc" aria-label="On this page">
    ${sections.length > 1 ? `<p class="toc-heading">On this page</p>
    <ul>${sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
  </aside>
</div>
<script src="assets/search-index.js" defer></script>
<script src="assets/docs.js" defer></script>
</body>
</html>
`;
}

// ---- plain text for AI tools (llms.txt / llms-full.txt) -----------------------
// A small HTML -> Markdown pass: enough for headings, lists, tables and links.
function toMarkdown(html) {
  return html
    .replace(/<figure>[\s\S]*?<\/figure>/g, '')
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_, c) => `\n\`\`\`\n${c.replace(/<[^>]+>/g, '')}\n\`\`\`\n`)
    .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, t) => `\n## ${text(t)}\n`)
    .replace(/<h3>([\s\S]*?)<\/h3>/g, (_, t) => `\n### ${text(t)}\n`)
    .replace(/<a href="([a-z0-9-]+)\.html(#[a-z0-9-]+)?">([\s\S]*?)<\/a>/g, (_, s, h, t) => `[${text(t)}](${pageUrl(s)}${h || ''})`)
    .replace(/<a (?:class="[^"]*" )?href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, u, t) => `[${text(t)}](${u})`)
    .replace(/<(strong|b)>([^<]*)<\/\1>/g, '**$2**')
    .replace(/<tr>([\s\S]*?)<\/tr>/g, (_, r) => `\n| ${[...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]) || ' ').join(' | ')} |`)
    .replace(/<li>/g, '\n- ')
    .replace(/<\/(p|ul|ol|table|div|section)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n')
    .replace(/(\n- [^\n]*)\n\n(?=- )/g, '$1\n')
    .replace(/(\n- [^\n]*)\n\n(?=- )/g, '$1\n')
    .trim();
}
function llmsTxt() {
  const lines = [
    `# ${BRAND}`,
    '',
    `> Free, open-source GST billing and invoicing software for small businesses in India, also usable in 20 currencies. It runs on the user's own Windows, macOS or Linux computer and opens in the web browser; there is no account, no subscription and no cloud. Version ${SITE.version}, made by ${SITE.publisher.name}.`,
    '',
    'It makes GST tax invoices, bills of supply, proforma estimates, credit notes and delivery challans; works out CGST, SGST, UTGST and IGST; tracks payments, clients, products and stock, purchases and expenses; and prepares GSTR-1 and GSTR-3B JSON for the GST portal. It does not file returns itself and does not generate e-invoice IRNs.',
    '',
    `- Download (always the latest version): ${SITE.download}`,
    `- Source code and issues: ${SITE.repo}`,
    `- Everything in one file: ${SITE.url}llms-full.txt`,
  ];
  for (const g of NAV) {
    lines.push('', `## ${g.title}`, '');
    for (const slug of g.pages) {
      const p = bySlug.get(slug);
      lines.push(`- [${p.title}](${pageUrl(slug)}): ${clip(text(p.lead), 200)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
function llmsFullTxt() {
  const parts = [`# ${BRAND}: complete documentation (version ${SITE.version})`, '', `Source: ${SITE.url}`];
  for (const slug of order) {
    const p = bySlug.get(slug);
    parts.push('', '---', '', `# ${p.title}`, '', `URL: ${pageUrl(slug)}`, '', text(p.lead), '', toMarkdown(p.body));
  }
  return `${parts.join('\n')}\n`;
}

// ---- write ----------------------------------------------------------------------
// Empty the folder rather than delete it: on Windows a folder that any shell
// or Explorer window has open cannot be removed.
if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'img'), { recursive: true });
await buildImages();

for (const p of PAGES) writeFileSync(join(OUT, `${p.slug}.html`), page(p));

const index = [];
for (const p of PAGES) {
  index.push({ u: `${p.slug}.html`, p: p.nav || p.title, s: p.title, t: text(p.lead) });
  const parts = p.body.split(/<section id="/).slice(1);
  for (const part of parts) {
    const id = part.slice(0, part.indexOf('"'));
    const h = /<h2>([\s\S]*?)<\/h2>/.exec(part);
    index.push({ u: `${p.slug}.html#${id}`, p: p.nav || p.title, s: h ? text(h[1]) : id, t: text(part.replace(/<h2>[\s\S]*?<\/h2>/, '')).slice(0, 600) });
  }
}
writeFileSync(join(OUT, 'assets', 'search-index.js'), `window.DOCS_INDEX=${JSON.stringify(index)};\n`);
for (const f of ['style.css', 'docs.js']) copyFileSync(join(HERE, 'assets', f), join(OUT, 'assets', f));

const priority = (slug) => (slug === 'index' ? '1.0'
  : ['install', 'first-invoice', 'invoices', 'gst-returns'].includes(slug) ? '0.9' : '0.7');
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${order.map((slug) => `  <url><loc>${pageUrl(slug)}</loc><lastmod>${TODAY}</lastmod><priority>${priority(slug)}</priority></url>`).join('\n')}
</urlset>
`);
// Search engines only read robots.txt at the root of the domain. This copy is
// a ready-made block to add to https://dicecodes.com/robots.txt.
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}sitemap.xml\n`);
writeFileSync(join(OUT, 'llms.txt'), llmsTxt());
writeFileSync(join(OUT, 'llms-full.txt'), llmsFullTxt());

const anchors = PAGES.map((p) => ({ page: `${p.slug}.html`, title: p.title, sections: sectionsOf(p) }));
writeFileSync(join(HERE, 'out', 'anchors.json'), JSON.stringify(anchors, null, 2));

console.log(`Built ${PAGES.length} pages, ${index.length} search entries, ${imgSize.size} images -> ${OUT}`);
