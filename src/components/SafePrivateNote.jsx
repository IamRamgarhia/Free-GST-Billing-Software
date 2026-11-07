// v1.10.83 - "Is this open-source app safe?" answered where people first ask
// it: the welcome screen and Support & About. Every line here must stay true;
// the full, checked answer is the docs page docs-site/pages/security.mjs.
import { ShieldCheck, HardDrive, UserX, WifiOff, EyeOff, Network, Code, Download, Archive, KeyRound, Bug, RefreshCw, ListChecks } from 'lucide-react';
import { docsLink } from '../utils';

const POINTS = [
  'Your business data stays on this computer',
  'No account, no login, no ads',
  'Works without internet',
  'Free and open source: anyone can check the code',
];

export default function SafePrivateNote({ style }) {
  return (
    <div role="note" aria-label="Safe and private"
      style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', padding: '0.75rem 0.9rem', borderRadius: 10,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', textAlign: 'left', ...style }}>
      <ShieldCheck size={22} style={{ color: 'var(--success, #16a34a)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>Safe and private</div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <a href={docsLink('security')} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
          How we keep it safe →
        </a>
      </div>
    </div>
  );
}

// v1.10.83 - the full list, as its own section on Support & About ("make
// this safe and private a different section and bigger, with every point").
// Each line is a summary of a section of docs-site/pages/security.mjs.
const SAFETY = [
  { icon: HardDrive, title: 'Your data stays on this computer', text: 'Invoices, clients and settings are files in the app folder. We run no cloud server that holds your books. Google Drive is used only if you connect your own.', doc: 'security#your-data-stays' },
  { icon: UserX, title: 'No account, no login', text: 'The app never asks for an email address or a password to use it.', doc: 'security#your-data-stays' },
  { icon: WifiOff, title: 'Works without internet', text: 'Invoices, PDFs, reports and GST returns all work offline. Turn on Offline mode (Settings → Privacy & Security → Privacy & internet) and the app never goes online by itself.', doc: 'security#offline-mode' },
  { icon: EyeOff, title: 'No tracking, no ads', text: 'No analytics and nothing sent to us. We never see your invoices, amounts, GSTIN or bank details. Free because we earn from paid work for businesses, not from data.', doc: 'security#why-free' },
  { icon: Network, title: 'Other computers cannot open it', text: 'The app answers only this computer, not your Wi-Fi or office network, and refuses requests from other websites.', doc: 'security#network' },
  { icon: Code, title: 'Open source', text: 'Anyone can read the code on GitHub, and a developer can build the app from it themselves.', doc: 'security#open-source' },
  { icon: Download, title: 'A safe install', text: 'No administrator rights, no system changes. It downloads only from this project’s GitHub page, and your data is backed up first.', doc: 'security#install-safety' },
  { icon: Archive, title: 'Daily backups', text: 'Every day your data is copied into a dated backup, kept for 30 days. Add a second folder on another drive for a copy there too.', doc: 'security#backups-and-lock' },
  { icon: KeyRound, title: 'Optional PIN lock', text: 'On a shared computer, lock the app with a PIN. It is stored only as a scrambled check value, never as the digits.', doc: 'security#backups-and-lock' },
  { icon: Bug, title: 'Problem reports only when you click', text: 'Errors are noted on this computer. A report opens only when you click Report, with GSTIN, phone, bank and other private details removed first.', doc: 'security#problem-reports' },
  { icon: RefreshCw, title: 'Security fixes in updates', text: 'A new version most Saturdays, urgent fixes sooner. GitHub security alerts watch the code libraries the app uses.', doc: 'security#updates-and-security-fixes' },
  { icon: ListChecks, title: 'Check it yourself', text: 'Switch your internet off and use the app: everything works. Download only from GitHub or dicecodes.com, and keep a backup on another drive.', doc: 'security#check-yourself' },
];

export function SafePrivateSection({ style }) {
  return (
    <section className="glass-panel" aria-labelledby="safe-private-title" style={{ padding: '1.5rem', ...style }}>
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '1.1rem' }}>
        <ShieldCheck size={34} style={{ color: 'var(--success, #16a34a)', flexShrink: 0 }} aria-hidden="true" />
        <div>
          <h2 id="safe-private-title" style={{ margin: 0, fontSize: '1.3rem' }}>Safe and private</h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            What happens to your business data, and what the app does and does not do.{' '}
            <a href={docsLink('security')} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--primary)' }}>The full answer →</a>
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem 1.5rem' }}>
        {SAFETY.map((p) => (
          <div key={p.title} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
            <p.icon size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <a href={docsLink(p.doc)} target="_blank" rel="noopener noreferrer"
                style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', textDecoration: 'none' }}>{p.title}</a>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
