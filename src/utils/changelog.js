// v1.10.81 - "What's new" on the Support & About page, from the CHANGELOG.md
// that ships with the app (GET /api/changelog). Only the little Markdown the
// changelog uses is understood, and the result is plain data the page shows as
// text - no HTML is ever built from the file.
//
// parseChangelog(md, limit) -> [{ version, date, summary, sections: [{ title,
//   blocks: [{ kind: 'item' | 'para', text, children: [text] }] }] }]
// "How to update" is left out (whoever reads it already has the version), and
// so is an entry not released yet (no date).

const ENTRY = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})\s*$/;

export function parseChangelog(md, limit = 6) {
  const lines = String(md || '').split(/\r?\n/);
  const entries = [];
  let entry = null; let section = null; let skip = false; let last = null;
  const startEntry = (m) => {
    entry = { version: m[1], date: m[2], summary: '', sections: [] };
    entries.push(entry); section = null; skip = false; last = null;
  };
  for (const raw of lines) {
    if (raw.startsWith('## ')) {
      const m = ENTRY.exec(raw.trim());
      if (m) startEntry(m); else entry = null; // unreleased or not an entry
      continue;
    }
    if (!entry) continue;
    if (raw.startsWith('### ')) {
      const title = raw.slice(4).trim();
      skip = /^how to update/i.test(title);
      section = skip ? null : { title, blocks: [] };
      if (section) entry.sections.push(section);
      last = null;
      continue;
    }
    if (skip || raw.startsWith('#### ') || raw.trim() === '---' || raw.trim().startsWith('>')) { if (!raw.trim()) last = null; continue; }
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { last = null; continue; }
    if (!section) { // the bold one-paragraph summary under the version line
      entry.summary = `${entry.summary} ${line.trim()}`.trim();
      continue;
    }
    const item = /^- (.*)$/.exec(line);
    const child = /^ {2,}- (.*)$/.exec(line);
    if (item) { last = { kind: 'item', text: item[1], children: [] }; section.blocks.push(last); }
    else if (child && last) { last.children.push(child[1]); }
    else if (last) { // continuation of the last item or child
      if (last.children.length && /^ {4,}/.test(line)) last.children[last.children.length - 1] += ` ${line.trim()}`;
      else last.text += ` ${line.trim()}`;
    } else { last = { kind: 'para', text: line.trim(), children: [] }; section.blocks.push(last); }
  }
  for (const e of entries) e.summary = e.summary.replace(/^\*\*|\*\*$/g, '').trim();
  return entries.slice(0, limit);
}

// v1.10.86 - Support & About shows only the main titles (maintainer, 14 Nov:
// "write short main titles here only in app"; the full notes are on GitHub).
// A bullet's title is its bold lead ("**Sales orders, with a dispatch
// status** (#135): ..." -> "Sales orders, with a dispatch status"); a bullet
// without one (or with a one-word lead such as "**Duplicate** keeps ...") gives
// its first sentence or clause instead, cut short. Plain text, no Markdown.
const plainText = (s) => String(s || '')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*([^*\s][^*]*)\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

export function headline(text, max = 80) {
  const s = String(text || '').trim();
  const bold = /^\*\*(.+?)\*\*/.exec(s);
  let t = bold && /\s/.test(bold[1].trim()) ? plainText(bold[1]) : '';
  if (!t) {
    const p = plainText(s);
    const stop = /[.:;](?=\s|$)| \(/g;
    let m;
    while ((m = stop.exec(p))) { const c = p.slice(0, m.index).trim(); if (/\s/.test(c)) { t = c; break; } }
    if (!t) t = p;
  }
  t = t.trim().replace(/[\s,.:;]+$/, '');
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}\u2026` : t;
}

// The titles of one version, by section ("Changed (#92, thanks ...)" is
// "Changed"); Thanks and the like have no titles. At most `per` per section:
// `more` says how many others the full notes have.
export function releaseTitles(entry, per = 8) {
  return (entry?.sections || [])
    .filter((s) => !/^(thanks|not changed)/i.test(s.title))
    .map((s) => {
      const all = s.blocks.filter((b) => b.kind === 'item').map((b) => headline(b.text)).filter(Boolean);
      return { title: s.title.replace(/\s*\(.*$/, ''), items: all.slice(0, per), more: Math.max(0, all.length - per) };
    })
    .filter((s) => s.items.length);
}
