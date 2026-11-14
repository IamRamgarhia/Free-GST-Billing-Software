// v1.10.86 - "What's new" in a few slides, once after the app is updated
// (Filee-style; maintainer's pick for 21 Nov). Built from the CHANGELOG.md that
// ships with the app: the main titles only, Added first, then Fixed, then the
// rest, and a last slide with "Read the full notes" (GitHub) and Done.
//
// Shown when this browser's "last version seen" is older than the running
// version. A new install stores the version silently (the welcome screens are
// shown there); someone who finished setup before this feature existed did
// update, so sees it once. Not while the app is locked (AppLockGate does not
// render or hides the app) or during setup (`blocked`). A paired phone is a
// browser like any other: it sees the slides once, unless the PC's "seen" was
// restored to it from the data folder first (the key is mirrored).
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Wrench, RefreshCw, ShieldCheck, BookOpen, X } from 'lucide-react';
import { parseChangelog, whatsNewSlides, shouldShowWhatsNew } from '../utils/changelog';
import { getPrintSettings } from '../utils/printSettings';
import { APP_VERSION } from '../utils/problemLog';

export const SEEN_KEY = 'freegstbill_lastSeenVersion';
const REPO = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software';
const notesUrl = (version) => `${REPO}/releases/tag/v${encodeURIComponent(version)}`;

const LOOK = {
  added: { Icon: Sparkles, heading: 'New in this update' },
  fixed: { Icon: Wrench, heading: 'Fixed' },
  changed: { Icon: RefreshCw, heading: 'Changed' },
  security: { Icon: ShieldCheck, heading: 'Safer' },
};

export default function WhatsNewSlides({ entry, onClose }) {
  const { slides, more } = whatsNewSlides(entry);
  const all = [...slides, { kind: 'end' }];
  const [at, setAt] = useState(0);
  const last = at === all.length - 1;
  const boxRef = useRef(null);
  const go = (i) => setAt(Math.max(0, Math.min(all.length - 1, i)));

  useEffect(() => {
    const prevFocus = document.activeElement;
    boxRef.current?.focus();
    return () => { try { prevFocus?.focus?.(); } catch { /* element gone */ } };
  }, []);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
  };

  const slide = all[at];
  const look = LOOK[slide.kind] || { Icon: Sparkles, heading: slide.title };
  const Icon = slide.kind === 'end' ? BookOpen : look.Icon;

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="modal-content wns" role="dialog" aria-modal="true" aria-labelledby="wns-title"
        aria-describedby="wns-body" tabIndex={-1} onKeyDown={onKey}>
        <div className="wns-top">
          <span className="wns-kicker">What&apos;s new in v{entry.version}</span>
          <button type="button" className="wns-close" onClick={onClose} aria-label="Close" title="Close (Esc)"><X size={18} /></button>
        </div>
        <div key={at} className="wns-slide" id="wns-body" aria-live="polite">
          <span className="wns-icon" aria-hidden="true"><Icon size={26} /></span>
          {slide.kind === 'end' ? (
            <>
              <h2 id="wns-title" className="wns-title">That&apos;s the main news</h2>
              <p className="wns-text">
                {more > 0 ? `And ${more} more change${more === 1 ? '' : 's'}` : 'Every change, with the details,'} in the full notes on GitHub.
                Your invoices and settings were kept.
              </p>
            </>
          ) : (
            <>
              <h2 id="wns-title" className="wns-title">{look.heading}</h2>
              <ul className="wns-list">
                {slide.items.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </>
          )}
        </div>
        <div className="wns-dots" role="group" aria-label="Slides">
          {all.map((_, i) => (
            <button key={i} type="button" className={`wns-dot${i === at ? ' on' : ''}`} onClick={() => go(i)}
              aria-label={`Slide ${i + 1} of ${all.length}`} aria-current={i === at ? 'step' : undefined} />
          ))}
        </div>
        <div className="wns-actions">
          {at > 0
            ? <button type="button" className="btn btn-secondary" onClick={() => go(at - 1)}>Back</button>
            : <button type="button" className="btn btn-secondary" onClick={onClose}>Skip</button>}
          {last ? (
            <div className="wns-actions-end">
              <a className="btn btn-secondary" href={notesUrl(entry.version)} target="_blank" rel="noopener noreferrer">Read the full notes</a>
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          ) : <button type="button" className="btn btn-primary" onClick={() => go(at + 1)}>Next</button>}
        </div>
      </div>
    </div>
  );
}

const getSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const setSeen = (v) => { try { localStorage.setItem(SEEN_KEY, v); } catch { /* private window */ } };

// Mounted once in App. Fetches the notes only when they are to be shown.
export function WhatsNewAfterUpdate({ blocked }) {
  const [entry, setEntry] = useState(null);
  useEffect(() => {
    const seen = getSeen();
    let existingUser = false;
    try { existingUser = getPrintSettings().onboardingComplete === true; } catch { /* first run */ }
    if (!shouldShowWhatsNew(seen, APP_VERSION, existingUser)) {
      if (!seen && APP_VERSION !== 'unknown') setSeen(APP_VERSION); // a new install: no slides, ever, for this version
      return undefined;
    }
    let live = true;
    fetch('/api/changelog')
      .then((r) => (r.ok ? r.json() : { text: '' }))
      .then(({ text }) => {
        // No dated notes for this version (yet): try again next time.
        const e = parseChangelog(text, 20).find((x) => x.version === APP_VERSION);
        if (live && e && whatsNewSlides(e).slides.length) setEntry(e);
      })
      .catch(() => { /* offline: next start */ });
    return () => { live = false; };
  }, []);
  if (!entry || blocked) return null;
  return <WhatsNewSlides entry={entry} onClose={() => { setSeen(APP_VERSION); setEntry(null); }} />;
}
