// v1.10.75 - a small floating line on the Dashboard only (on other screens it
// took working space): the app's
// name and version, who makes it, and the Support page. Only the user sees
// it; it is never printed on an invoice. The version comes from the local
// server, so it works offline.
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

export default function AppFooter({ onOpenSupport }) {
  const [version, setVersion] = useState('');
  useEffect(() => {
    let live = true;
    fetch('/api/version').then((r) => r.json()).then((d) => { if (live && d?.current) setVersion(d.current); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const link = { color: 'inherit', textDecoration: 'none', fontWeight: 600 };
  return (
    <footer style={{
      // Floats over the Dashboard as it scrolls (sticky inside the scroll area).
      position: 'sticky', bottom: 0, zIndex: 5, marginTop: 'auto', paddingTop: '1.5rem', pointerEvents: 'none',
      textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'center',
        pointerEvents: 'auto', // only the pill takes clicks, not the strip around it
        padding: '0.3rem 0.85rem', borderRadius: 999, background: 'var(--card-bg)', border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}>
        <span>Free GST Billing{version ? ` v${version}` : ''}</span>
        <span aria-hidden="true">·</span>
        <a href="https://dicecodes.com" target="_blank" rel="noopener noreferrer" style={link}>by DiceCodes</a>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onOpenSupport}
          style={{ ...link, background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Heart size={11} style={{ color: '#e11d48', fill: '#e11d48' }} /> Support
        </button>
      </span>
    </footer>
  );
}
