// v1.10.81 - on Support & About: the weekly update (a new version every
// Saturday, decided with the maintainer), where to report problems and ask
// for features (GitHub issue forms), and "What's new" from the CHANGELOG.md
// that ships with the app. The changelog is shown as text (changelog.js
// parses it), never as HTML.
// v1.10.86 - What's new lists only the main titles, with a link to each
// version's full notes on GitHub.
import { useEffect, useState } from 'react';
import { Bug, Lightbulb, CalendarClock, ListChecks, Sparkles } from 'lucide-react';
import { parseChangelog, releaseTitles } from '../utils/changelog';
import HelpButton from './HelpButton';

const REPO = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software';
const CHANGELOG_URL = `${REPO}/blob/main/CHANGELOG.md`;
const card = { padding: '1.25rem 1.5rem' };

// v1.10.86 - only each version's main titles here (maintainer, 14 Nov: "it
// looks too big"); "Read the full notes" opens that version on GitHub.
const notesUrl = (version) => `${REPO}/releases/tag/v${encodeURIComponent(version)}`;

function Release({ entry }) {
  return (
    <div style={{ fontSize: '0.84rem', lineHeight: 1.5 }}>
      {releaseTitles(entry).map((s) => (
        <div key={s.title} style={{ marginTop: '0.45rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{s.title}</div>
          <ul style={{ margin: '0.15rem 0 0', paddingLeft: '1.1rem' }}>
            {s.items.map((t, i) => <li key={i}>{t}</li>)}
            {s.more > 0 && <li style={{ listStyle: 'none', marginLeft: '-1.1rem', color: 'var(--text-muted)' }}>and {s.more} more</li>}
          </ul>
        </div>
      ))}
      <a href={notesUrl(entry.version)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>
        Read the full notes
      </a>
    </div>
  );
}

const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default function WhatsNew() {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/api/changelog')
      .then((r) => (r.ok ? r.json() : { text: '' }))
      .then(({ text }) => { if (live) setEntries(parseChangelog(text, 6)); })
      .catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, []);

  return (
    <>
      <div className="glass-panel" style={{ ...card, marginBottom: '1.25rem' }} aria-labelledby="weekly-title">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <CalendarClock size={26} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <h3 id="weekly-title" style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>A new update every Saturday <HelpButton title="A new update every Saturday" doc="support#weekly" size={16} /></h3>
            <p style={{ margin: '0 0 0.5rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '72ch' }}>
              Every Saturday we release one update with that week&apos;s fixes and new features. The app tells you when it is
              ready: click <b>Update</b> in the sidebar, and your invoices and settings are kept. Anything urgent, such as the
              app not opening, is fixed straight away.
            </p>
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: '72ch' }}>
              Tell us on GitHub what is wrong or what you need. We read every request each week, the ones most people ask
              for come first, and you get a reply there when it is done.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <a className="btn btn-primary" href={`${REPO}/issues/new?template=bug_report.yml`} target="_blank" rel="noopener noreferrer">
                <Bug size={16} /> Report a problem
              </a>
              <a className="btn btn-secondary" href={`${REPO}/issues/new?template=feature_request.yml`} target="_blank" rel="noopener noreferrer">
                <Lightbulb size={16} /> Ask for a feature
              </a>
              <a className="btn btn-secondary" href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">
                <ListChecks size={16} /> See all requests
              </a>
              {/* The changelog: the list below, or every version on GitHub. */}
              {entries && entries.length > 0 ? (
                <button type="button" className="btn btn-secondary"
                  onClick={() => document.getElementById('whats-new')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <Sparkles size={16} /> What&apos;s new
                </button>
              ) : (
                <a className="btn btn-secondary" href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">
                  <Sparkles size={16} /> Changelog
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {entries && entries.length > 0 && (
        <div id="whats-new" className="glass-panel" style={{ ...card, marginBottom: '1.25rem', scrollMarginTop: '1rem' }} aria-labelledby="whats-new-title">
          <h3 id="whats-new-title" style={{ margin: '0 0 0.25rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} /> What&apos;s new <HelpButton title="What's new" doc="support#whats-new" size={16} />
          </h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            The latest updates. Every version since the first is in the <a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>full changelog</a>, and the downloads are on <a href={`${REPO}/releases`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub Releases</a>.
          </p>
          {entries.map((e, i) => (
            <details key={e.version} open={i === 0} style={{ borderTop: '1px solid var(--border-color)', padding: '0.65rem 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                v{e.version} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>· {longDate(e.date)}</span>
              </summary>
              <Release entry={e} />
            </details>
          ))}
        </div>
      )}
    </>
  );
}
