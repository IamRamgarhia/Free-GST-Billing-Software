// v1.10.75 - Support & About. Who builds the app, how to help (free ways
// first, then UPI), and what DiceCodes does for businesses. Decided with the
// maintainer: ask gently, never lock a feature, never print anything on a
// user's invoice. UPI only for money: it works offline (the QR is drawn here)
// and costs the giver nothing.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Heart, Star, Share2, Bug, Copy, Check, Mail, Globe, Code, Wrench, Database, LifeBuoy, Bot, Smartphone, Workflow } from 'lucide-react';
import { toast } from './Toast';

const SUPPORT_UPI_ID = 'princeramgarhiaa-1@okaxis';
const UPI_NAME = 'DiceCodes';
const REPO = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software';
const EMAIL = 'contact@dicecodes.com';
const SITE = 'https://dicecodes.com';
const AMOUNTS = [0, 101, 251, 501];

const SERVICES = [
  { icon: Code, title: 'Custom software & web apps', text: 'Websites, web apps and business tools built for how you work.' },
  { icon: Wrench, title: 'Customising this app', text: 'Your own invoice layout, reports or features in Free GST Billing.' },
  { icon: Database, title: 'Setup & data migration', text: 'Installation, moving your data from Tally or Excel, and training.' },
  { icon: LifeBuoy, title: 'Support plans for businesses', text: 'Priority help and updates on a yearly plan.' },
  { icon: Bot, title: 'AI integration', text: 'Add AI to your product: assistants, document reading, smart search.' },
  { icon: Workflow, title: 'AI automation', text: 'Automate the repetitive work in the software you already use.' },
  { icon: Smartphone, title: 'Mobile apps', text: 'Android and iPhone apps for your business or customers.' },
];

const upiLink = (amount) => `upi://pay?pa=${encodeURIComponent(SUPPORT_UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&cu=INR`
  + `&tn=${encodeURIComponent('Support Free GST Billing')}${amount ? `&am=${amount}.00` : ''}`;

export default function SupportView() {
  const [amount, setAmount] = useState(0);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(upiLink(amount), { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) setQr(url); })
      .catch(() => { if (live) setQr(''); });
    return () => { live = false; };
  }, [amount]);

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
    { icon: Bug, title: 'Report a bug or ask for a feature', text: 'Many features started as a request.', href: `${REPO}/issues` },
  ];

  const card = { padding: '1.25rem 1.5rem' };
  const linkRow = { display: 'flex', gap: '0.85rem', alignItems: 'flex-start', padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', color: 'inherit', textDecoration: 'none' };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support &amp; About</h1>
          <p className="page-subtitle">Who makes Free GST Billing, and how you can help it grow</p>
        </div>
      </div>

      <div className="glass-panel" style={{ ...card, marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <Heart size={28} style={{ color: '#e11d48', flexShrink: 0, marginTop: 2 }} />
        <div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Free, and it stays free</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '70ch' }}>
            Free GST Billing is built and maintained by <b>DiceCodes</b> in India. No ads, no account, no locked features,
            and your invoices never leave this computer. If it saves you time every month, you can help keep the
            fixes and new features coming.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="glass-panel" style={card}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Support with UPI</h3>
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
        </div>

        <div className="glass-panel" style={card}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Help without paying</h3>
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

      <div className="glass-panel" style={card}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Work with DiceCodes</h3>
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
