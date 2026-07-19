import { useState } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';
import { getPrintSettings, savePrintSettings, BUSINESS_PRESETS, applyBusinessPreset } from '../utils/printSettings';
import { toast } from './Toast';

// ============================================================================
// v1.9.3 — First-run Setup Wizard
// Shown when onboardingComplete = false. 3 steps:
//   1. Business type (auto-configures 15+ settings via BUSINESS_PRESETS)
//   2. Paper size + language
//   3. Confirm + save
// User can Skip at any time; setting is marked complete either way.
// ============================================================================

export default function SetupWizard({ onClose }) {
  const [step, setStep] = useState(1);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [paperSize, setPaperSize] = useState('a4');
  const [language, setLanguage] = useState('en');

  // v1.10.6 — audit L9. Prior code let `finish()` with no business
  // preset selected behave identically to `skip()` — user got two
  // indistinguishable "did nothing" exits. Now: finish() is disabled
  // (see button below) until at least one choice is made, so hitting
  // Finish always writes something meaningful. skip() stays available
  // for users who genuinely want to dismiss and configure later.
  const finish = () => {
    const current = getPrintSettings();
    // v1.10.33 — Clear onboardingSkipped when the user actually
    // completes setup, so the "Finish setup" pill hides for good.
    let next = { ...current, onboardingComplete: true, onboardingSkipped: false, labelLanguage: language };
    if (selectedBiz) next = applyBusinessPreset(next, selectedBiz);
    if (paperSize) next.paperSize = paperSize;
    savePrintSettings(next);
    toast('Setup complete! Your defaults are configured.', 'success');
    onClose();
  };

  const skip = () => {
    // v1.10.33 — Distinguishes "Skip" from "None of these":
    //   Skip           → onboardingComplete=true, onboardingSkipped=true
    //                    (App shows a bottom-right "Finish setup" pill)
    //   None of these  → onboardingComplete=true, onboardingSkipped=false
    //                    (user chose to configure manually — no nag)
    // Reported: "if user skip it should show in right side bottom so
    // they can do it again".
    const current = getPrintSettings();
    savePrintSettings({ ...current, onboardingComplete: true, onboardingSkipped: true });
    toast('Setup skipped — use the "Finish setup" pill to come back to it.', 'info');
    onClose();
  };
  const canFinish = !!selectedBiz || !!paperSize || language !== 'en';

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>👋 Welcome to Free GST Billing</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Step {step} of 3 · Takes 90 seconds
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={skip} title="Skip setup — I'll configure later"><X size={18} /></button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: n <= step ? 'var(--primary)' : 'var(--border)',
            }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h3 style={{ marginTop: 0 }}>What kind of business do you run?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Pick one and we'll auto-configure 15+ settings (paper size · template · font · features) that work for that industry. You can change anything later.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              {Object.entries(BUSINESS_PRESETS).map(([key, preset]) => (
                <button key={key} type="button"
                  onClick={() => setSelectedBiz(key)}
                  style={{
                    padding: '0.85rem',
                    background: selectedBiz === key ? 'var(--primary)' : 'var(--card)',
                    color: selectedBiz === key ? '#fff' : 'var(--text)',
                    border: `2px solid ${selectedBiz === key ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                  }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>{preset.label}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{preset.hint}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              {/* v1.10.33 — Was a plain "clear selection" button that did
                  nothing visible (the wizard stayed open, no progress).
                  Users tapped it, nothing happened, then reported "None
                  of these — I'll configure manually not working". Now:
                  the button treats "configure manually" as an explicit
                  intent → mark onboarded (so the wizard stops nagging)
                  AND close. User lands on the dashboard with all defaults
                  intact, free to tweak from Settings when they want. */}
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.82rem' }}
                onClick={() => {
                  const current = getPrintSettings();
                  savePrintSettings({ ...current, onboardingComplete: true, onboardingSkipped: false });
                  toast('Setup dismissed — configure any time from Settings → Print & PDF.', 'info');
                  onClose();
                }}>
                None of these — I'll configure manually
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ marginTop: 0 }}>Paper size + language</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              What are you mostly printing on?
            </p>

            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Paper size</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                ['a4', 'A4 · Standard'],
                ['a5', 'A5 · Compact'],
                ['thermal80', '80mm Thermal'],
                ['thermal58', '58mm Thermal'],
              ].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPaperSize(key)}
                  style={{
                    padding: '0.7rem',
                    background: paperSize === key ? 'var(--primary)' : 'var(--card)',
                    color: paperSize === key ? '#fff' : 'var(--text)',
                    border: `2px solid ${paperSize === key ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Section label language</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
              {[
                ['en', 'English'], ['hi', 'हिन्दी (Hindi)'], ['ta', 'தமிழ் (Tamil)'],
                ['mr', 'मराठी (Marathi)'], ['bn', 'বাংলা (Bengali)'],
              ].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setLanguage(key)}
                  style={{
                    padding: '0.55rem',
                    background: language === key ? 'var(--primary)' : 'var(--card)',
                    color: language === key ? '#fff' : 'var(--text)',
                    border: `1px solid ${language === key ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ marginTop: 0 }}>Ready to go 🚀</h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              We'll apply these defaults to every new invoice. You can change any of them later in <strong>Settings → Thermal Printer Settings → PDF & universal print features</strong>.
            </p>

            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.9rem' }}>
              <Row label="Business type" value={selectedBiz ? BUSINESS_PRESETS[selectedBiz]?.label : '(none — manual config)'} />
              <Row label="Default paper size" value={paperSize} />
              <Row label="Section label language" value={
                { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', mr: 'मराठी', bn: 'বাংলা' }[language]
              } />
            </div>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(30, 64, 175, 0.06)', borderRadius: 6, fontSize: '0.82rem' }}>
              💡 <strong>What happens next:</strong> When you create your first invoice, these settings apply automatically. Use the <strong>PDF Style Editor</strong> to tune colours or the <strong>Live preview</strong> to see any change instantly.
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={skip} style={{ fontSize: '0.82rem' }}>
            Skip setup
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step > 1 && (
              <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 3 ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={finish}
                disabled={!canFinish}
                title={canFinish ? '' : 'Pick a business type, paper size, or language first — or use Skip.'}>
                <Check size={16} /> Finish setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value || '—'}</span>
    </div>
  );
}
