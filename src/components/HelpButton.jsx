import { HelpCircle } from 'lucide-react';
import { docsLink } from '../utils';

/*
 * v1.10.22 — Per-view help button.
 *
 * v1.10.83 - it opens that part of the online guide straight away, in the
 * browser (asked for: "all docs buttons should take the user to the same
 * module in the docs"). The small pop-up summary it used to show first is
 * gone; the guide is the one place help is kept up to date.
 *
 * `doc` is "page" or "page#section" of the documentation site. `title` names
 * what the guide is about (shown on hover and read out by screen readers).
 * Older callers still pass `body` / `children`; they are no longer shown.
 * v1.10.86 - `hint`: a line about the screen (the page header's old subtitle),
 * shown first in the tooltip; the name screen readers hear is unchanged.
 */
export default function HelpButton({ title, doc, size = 18, style, hint }) {
  const label = `${title ? title.replace(/\s*[—-]\s*how to use$/i, '') : 'This screen'}: open the guide (opens in your browser)`;
  // A small "?" sits inline after a card or section title: a compact box and a
  // gap from the text, so it does not make the title row taller.
  const inline = size < 18 ? { width: size + 8, height: size + 8, marginLeft: 6, flexShrink: 0 } : null;
  return (
    <a href={docsLink(doc || '')} target="_blank" rel="noopener noreferrer"
      className="icon-btn" title={hint ? `${hint}.\n${label}` : label} aria-label={label}
      style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', ...inline, ...style }}>
      <HelpCircle size={size} />
    </a>
  );
}
