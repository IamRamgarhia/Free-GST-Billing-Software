// v1.10.75 - Support & About. Who builds the app, how to help (free ways
// first, then UPI), and what DiceCodes does for businesses. Decided with the
// maintainer: ask gently, never lock a feature, never print anything on a
// user's invoice. UPI only for money: it works offline (the QR is drawn here)
// and costs the giver nothing.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Heart, Star, Share2, Bug, Copy, Check, Mail, Globe, Code, Wrench, Database, LifeBuoy, Bot, Smartphone, Workflow, Users } from 'lucide-react';
import { toast } from './Toast';
import { getProfile } from '../store';
import { upiNote } from '../utils/supporters';
import useSupporters from './useSupporters';
import { useOfflineMode } from '../utils/offlineMode';
import WhatsNew from './WhatsNew';
import SupportersList from './SupportersList';
import ProblemLog from './ProblemLog';
import HelpButton from './HelpButton';
import PageHeader from './PageHeader';
import { SafePrivateSection } from './SafePrivateNote';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const SUPPORT_UPI_ID = 'princeramgarhiaa-1@okaxis';
const UPI_NAME = 'DiceCodes';
const REPO = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software';
const EMAIL = 'contact@dicecodes.com';
const SITE = 'https://dicecodes.com';
// v1.10.83 - ₹200 is the smallest suggested amount; "Any amount" (0) comes last.
const AMOUNTS = [200, 500, 1000, 0];

const SERVICES = [
  { icon: Code, title: 'Custom software & web apps', text: 'Websites, web apps and business tools built for how you work.' },
  { icon: Wrench, title: 'Customising this app', text: 'Your own invoice layout, reports or features in Free GST Billing.' },
  { icon: Database, title: 'Setup & data migration', text: 'Installation, moving your data from Tally or Excel, and training.' },
  { icon: LifeBuoy, title: 'Support plans for businesses', text: 'Priority help and updates on a yearly plan.' },
  { icon: Bot, title: 'AI integration', text: 'Add AI to your product: assistants, document reading, smart search.' },
  { icon: Workflow, title: 'AI automation', text: 'Automate the repetitive work in the software you already use.' },
  { icon: Smartphone, title: 'Mobile apps', text: 'Android and iPhone apps for your business or customers.' },
];

// v1.10.80 - the note carries the payer's business name (unless they untick
// it), so the maintainer can see who paid and thank them.
const upiLink = (amount, note) => `upi://pay?pa=${encodeURIComponent(SUPPORT_UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&cu=INR`
  + `&tn=${encodeURIComponent(note)}${amount ? `&am=${amount}.00` : ''}`;

export default function SupportView() {
  const [amount, setAmount] = useState(AMOUNTS[0]);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [withName, setWithName] = useState(true);
  const tracker = useSupporters();
  const [offline] = useOfflineMode();
  const note = upiNote(withName ? businessName : '');

  useEffect(() => { getProfile().then((p) => setBusinessName(p?.businessName || '')).catch(() => {}); }, []);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(upiLink(amount, note), { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) setQr(url); })
      .catch(() => { if (live) setQr(''); });
    return () => { live = false; };
  }, [amount, note]);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast(`UPI ID: ${SUPPORT_UPI_ID}`, 'info', 6000); }
  };

  const shareText = `I make my GST invoices with Free GST Billing Software. It's free, works offline and keeps data on your own computer: ${REPO}`;
  const freeWays = [
    { icon: Star, title: 'Star it on GitHub', text: 'Helps other businesses find it.', href: REPO },
    { icon: Share2, title: 'Tell another business', text: 'Send it to a friend on WhatsApp.', href: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { icon: Bug, title: 'Report a bug or ask for a feature', text: 'Many features started as a request.', href: `${REPO}/issues/new/choose` },
  ];

  const card = { padding: '1.25rem 1.5rem' };
  const linkRow = { display: 'flex', gap: '0.85rem', alignItems: 'flex-start', padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', color: 'inherit', textDecoration: 'none' };

  return (
    <div className="dashboard-container">
      <PageHeader
        title="Support & About"
        help={{ title: 'Support & About', doc: 'support' }}
        subtitle="Who makes Free GST Billing, and how you can help it grow"
      />

      <div className="glass-panel" style={{ ...card, marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <Heart size={28} style={{ color: '#e11d48', flexShrink: 0, marginTop: 2 }} />
        <div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Free, and it stays free <HelpButton title="Free, and it stays free" doc="support#about" size={16} /></h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '70ch' }}>
            Free GST Billing is built and maintained by <b>DiceCodes</b> in India. No ads, no account, no locked features,
            and your invoices never leave this computer. If it saves you time every month, you can help keep the
            fixes and new features coming.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="glass-panel" style={card}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Support with UPI <HelpButton title="Support with UPI" doc="support#upi" size={16} /></h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Scan with GPay, PhonePe, Paytm or any UPI app. Any amount helps.</p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }} role="group" aria-label="Amount">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" className={`btn ${amount === a ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={amount === a} onClick={() => setAmount(a)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}>
                {a ? `₹${a}` : 'Any amount'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', padding: 8, borderRadius: 8, lineHeight: 0, border: '1px solid var(--border-color)' }}>
              {qr ? <img src={qr} width={180} height={180} alt={`UPI QR code to pay ${UPI_NAME}${amount ? ` ₹${amount}` : ''}`} />
                : <div style={{ width: 180, height: 180 }} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UPI ID</div>
              <div style={{ fontWeight: 700, wordBreak: 'break-all', margin: '0.15rem 0 0.6rem' }}>{SUPPORT_UPI_ID}</div>
              <button type="button" className="btn btn-secondary" onClick={copyUpi} style={{ fontSize: '0.82rem' }}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy UPI ID</>}
              </button>
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Payment note: <b style={{ color: 'var(--text-primary)' }}>{note}</b>
            {businessName && (
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.35rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
                Include my business name, so DiceCodes can thank you
              </label>
            )}
          </div>
        </div>

        <div className="glass-panel" style={card}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Help without paying <HelpButton title="Help without paying" doc="support#free-ways" size={16} /></h3>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>These matter just as much.</p>
          {freeWays.map((w) => (
            <a key={w.title} href={w.href} target="_blank" rel="noopener noreferrer" style={linkRow}>
              <w.icon size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{w.title}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{w.text}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      {tracker && (
        <div className="glass-panel" style={{ ...card, marginBottom: '1.25rem' }} aria-label="Supporters">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Users size={26} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 0.2rem', fontSize: '1rem' }}>
                {tracker.totalReceived > 0
                  ? <>{inr(tracker.totalReceived)} received so far{tracker.supporters ? ` from ${tracker.supporters} supporter${tracker.supporters === 1 ? '' : 's'}` : ''}</>
                  : 'Be the first to support Free GST Billing'}
                {' '}<HelpButton title="Supporters" doc="support#supporters-card" size={16} />
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Every rupee goes into fixes and new features.{tracker.updated ? ` Updated ${new Date(`${tracker.updated}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}
              </p>
              {/* v1.10.83 - Offline mode does not read the list, so say these
                  are the last numbers seen (reported: "I only see 6"). */}
              {offline && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#d97706' }}>
                  Offline mode is on, so these are the last numbers this app saw. Turn it off with the Wi-Fi button at the top to see the latest.
                </p>
              )}
              {tracker.goal && (
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                    <span>Goal{tracker.goal.label ? `: ${tracker.goal.label}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{inr(tracker.totalReceived)} of {inr(tracker.goal.amount)}</span>
                  </div>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={tracker.goal.amount} aria-valuenow={Math.min(tracker.totalReceived, tracker.goal.amount)}
                    aria-label="Progress towards the goal"
                    style={{ height: 8, borderRadius: 4, background: 'var(--bg-secondary)', marginTop: '0.35rem', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (tracker.totalReceived / tracker.goal.amount) * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 4 }} />
                  </div>
                </div>
              )}
              <SupportersList people={tracker.people} names={tracker.thanks} count={tracker.supporters} />
            </div>
          </div>
        </div>
      )}

      <SafePrivateSection style={{ marginBottom: '1.25rem' }} />

      <WhatsNew />

      <ProblemLog />

      <div className="glass-panel" style={card}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Work with DiceCodes <HelpButton title="Work with DiceCodes" doc="support#services" size={16} /></h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>The team behind this app builds software for businesses too.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.1rem' }}>
          {SERVICES.map((w) => (
            <div key={w.title} style={{ display: 'flex', gap: '0.7rem', padding: '0.85rem', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <w.icon size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{w.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.45 }}>{w.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Project enquiry (from Free GST Billing)')}`}>
            <Mail size={16} /> Email {EMAIL}
          </a>
          <a className="btn btn-secondary" href={SITE} target="_blank" rel="noopener noreferrer"><Globe size={16} /> dicecodes.com</a>
        </div>
      </div>
    </div>
  );
}
