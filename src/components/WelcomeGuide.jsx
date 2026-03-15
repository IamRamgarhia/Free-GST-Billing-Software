import { useState } from 'react';
import { Building2, FileText, BarChart3, Shield, ChevronRight, ChevronLeft, Check, ArrowRight, Image, PenTool } from 'lucide-react';
import { saveProfile } from '../store';
import { INDIAN_STATES } from '../utils';
import { toast } from './Toast';

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: FileText },
  { id: 'business', title: 'Business Details', icon: Building2 },
  { id: 'bank', title: 'Bank & UPI', icon: Shield },
  { id: 'ready', title: 'You\'re Ready!', icon: BarChart3 },
];

export default function WelcomeGuide({ onComplete }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    businessName: '', address: '', state: '', gstin: '', pan: '',
    email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
    logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleFileUpload = (field) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        toast('Image must be under 500KB', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setProfile(p => ({ ...p, [field]: reader.result }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveProfile(profile);
      localStorage.setItem('freegstbill_onboarded', 'true');
      toast('Setup complete! Start creating invoices.', 'success');
      onComplete(profile);
    } catch {
      toast('Failed to save. Try again.', 'error');
    }
    setSaving(false);
  };

  const handleSkip = () => {
    localStorage.setItem('freegstbill_onboarded', 'true');
    onComplete(null);
  };

  const canProceed = () => {
    if (step === 1) return profile.businessName.trim().length > 0;
    return true;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '640px', width: '100%' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              width: i === step ? '3rem' : '2rem', height: '4px', borderRadius: '2px',
              background: i <= step ? 'var(--primary)' : 'var(--border-color)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem' }}>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <FileText size={32} color="white" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Welcome to Free GST Billing Software</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                Free, open-source GST billing software that runs 100% on your computer. Your data never leaves your machine.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  { title: 'Create Invoices', desc: 'Tax Invoice, Proforma, Credit Note, Bill of Supply, Delivery Challan' },
                  { title: 'Auto GST Calculation', desc: 'CGST/SGST for same state, IGST for different state — automatic' },
                  { title: 'GST Filing Ready', desc: 'GSTR-1, GSTR-3B, HSN reports auto-generated. Download CSVs for portal.' },
                  { title: '100% Private', desc: 'All data stored locally as files. No cloud, no signup, no tracking.' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Let's set up your business profile so your invoices look professional. Takes about 2 minutes.
              </p>
            </div>
          )}

          {/* Step 1: Business Details */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Business Details</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                This info appears on every invoice you generate. You can change it anytime in Settings.
              </p>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Business Name *</label>
                  <input type="text" name="businessName" className="form-input" value={profile.businessName} onChange={handleChange}
                    placeholder="e.g. Sharma Consultants Pvt. Ltd." />
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea name="address" className="form-input" rows={2} value={profile.address} onChange={handleChange}
                    placeholder="e.g. 42, MG Road, Sector 15, Gurugram 122001" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select name="state" className="form-input" value={profile.state} onChange={handleChange}>
                      <option value="">Select state</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="field-hint">Needed for auto CGST/SGST vs IGST</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input type="text" name="gstin" className="form-input" value={profile.gstin} onChange={handleChange}
                      placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                    <span className="field-hint">Leave blank if not GST registered</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">PAN</label>
                    <input type="text" name="pan" className="form-input" value={profile.pan} onChange={handleChange}
                      placeholder="AAAAA1234A" maxLength={10} style={{ textTransform: 'uppercase' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="text" name="phone" className="form-input" value={profile.phone} onChange={handleChange}
                      placeholder="+91 98765 43210" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-input" value={profile.email} onChange={handleChange}
                    placeholder="billing@yourbusiness.com" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Bank & UPI */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Bank & UPI Details</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Shown on your invoices so clients know where to pay. Optional — you can add this later.
              </p>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input type="text" name="bankName" className="form-input" value={profile.bankName} onChange={handleChange}
                      placeholder="e.g. HDFC Bank" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <input type="text" name="accountNumber" className="form-input" value={profile.accountNumber} onChange={handleChange}
                      placeholder="e.g. 12345678901234" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input type="text" name="ifsc" className="form-input" value={profile.ifsc} onChange={handleChange}
                      placeholder="e.g. HDFC0001234" style={{ textTransform: 'uppercase' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">UPI ID</label>
                    <input type="text" name="upiId" className="form-input" value={profile.upiId} onChange={handleChange}
                      placeholder="e.g. business@upi" />
                    <span className="field-hint">Auto-generates QR code on invoices</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Business Logo</label>
                    <button type="button" className="btn btn-secondary" onClick={() => handleFileUpload('logo')}
                      style={{ width: '100%', justifyContent: 'center' }}>
                      <Image size={16} /> {profile.logo ? 'Change Logo' : 'Upload Logo'}
                    </button>
                    {profile.logo && <img src={profile.logo} alt="Logo" style={{ height: '40px', marginTop: '0.5rem', objectFit: 'contain' }} />}
                    <span className="field-hint">PNG/JPG, max 500KB</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Digital Signature</label>
                    <button type="button" className="btn btn-secondary" onClick={() => handleFileUpload('signature')}
                      style={{ width: '100%', justifyContent: 'center' }}>
                      <PenTool size={16} /> {profile.signature ? 'Change Signature' : 'Upload Signature'}
                    </button>
                    {profile.signature && <img src={profile.signature} alt="Signature" style={{ height: '40px', marginTop: '0.5rem', objectFit: 'contain' }} />}
                    <span className="field-hint">PNG/JPG, max 500KB</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Check size={32} color="white" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>You're All Set!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                Your business profile is ready. Here's what to do next:
              </p>

              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                {[
                  { num: '1', title: 'Create your first invoice', desc: 'Click "New Invoice" in the sidebar. Pick invoice type, add client details and line items.' },
                  { num: '2', title: 'Download or share', desc: 'Generate PDF, share via WhatsApp or email. UPI QR auto-appears if you added your UPI ID.' },
                  { num: '3', title: 'Check GST reports', desc: 'After a few invoices, go to "Reports & P&L". Your GSTR-1, GSTR-3B, and HSN data is auto-generated.' },
                  { num: '4', title: 'File GST returns', desc: 'Download CSVs from Reports → Upload to GST portal. Follow the built-in "GST Filing" guide for step-by-step help.' },
                ].map((item) => (
                  <div key={item.num} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                      {item.num}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  All your data is stored locally in the <code style={{ background: 'var(--border-color)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>data/</code> folder on this computer. Nothing is sent to any server. You can export a full backup anytime from Settings.
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              {step === 0 && (
                <button className="btn btn-secondary" onClick={handleSkip} style={{ fontSize: '0.85rem' }}>
                  Skip Setup
                </button>
              )}
              {step > 0 && step < 3 && (
                <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                  <ChevronLeft size={16} /> Back
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {step < 3 && (
                <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  {step === 0 ? 'Get Started' : 'Next'} <ChevronRight size={16} />
                </button>
              )}
              {step === 2 && (
                <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ fontSize: '0.85rem' }}>
                  Skip, I'll add later
                </button>
              )}
              {step === 3 && (
                <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
                  {saving ? 'Saving...' : 'Start Billing'} <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step labels */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ fontSize: '0.7rem', color: i === step ? 'var(--primary)' : 'var(--text-muted)', fontWeight: i === step ? 600 : 400, transition: 'all 0.3s' }}>
              {s.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
