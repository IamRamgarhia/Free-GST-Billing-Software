import { useState, useEffect, useRef } from 'react';
import { getProfile, saveProfile, exportAllData, importData, getTermsTemplates, saveTermsTemplate, deleteTermsTemplate, getAllClients, deleteClient } from '../store';
import { INDIAN_STATES } from '../utils';
import { Save, Upload, Download, Plus, Trash2, Image, PenTool, Cloud, CloudOff } from 'lucide-react';
import { initGoogleDrive, isConnected, disconnect } from '../services/googleDrive';
import { toast } from './Toast';

export default function SettingsView({ onSaved }) {
  const [profile, setProfile] = useState({
    businessName: '', address: '', state: '', gstin: '', pan: '',
    email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
    logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'BillKaro Invoices',
  });
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savedClients, setSavedClients] = useState([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const sigInputRef = useRef(null);

  useEffect(() => {
    getProfile().then(setProfile);
    loadTemplates();
    loadClients();
    setDriveConnected(isConnected());
  }, []);

  const loadTemplates = async () => setTermsTemplates(await getTermsTemplates());
  const loadClients = async () => setSavedClients(await getAllClients());

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast('Image must be under 500KB', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setProfile(prev => ({ ...prev, [field]: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const removeImage = (field) => setProfile(prev => ({ ...prev, [field]: '' }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await saveProfile(profile);
      if (onSaved) onSaved(profile);
      toast('Profile saved!', 'success');
    } catch { toast('Failed to save profile', 'error'); }
    finally { setSaving(false); }
  };

  // Google Drive
  const handleConnectDrive = async () => {
    if (!profile.googleClientId.trim()) {
      toast('Enter your Google OAuth Client ID first', 'warning');
      return;
    }
    setConnecting(true);
    try {
      const result = await initGoogleDrive(profile.googleClientId);
      if (result.success) {
        setDriveConnected(true);
        toast('Connected to Google Drive!', 'success');
      } else {
        toast('Failed: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      toast('Connection failed: ' + err.message, 'error');
    }
    setConnecting(false);
  };

  const handleDisconnectDrive = () => {
    disconnect();
    setDriveConnected(false);
    toast('Disconnected from Google Drive', 'info');
  };

  // Export / Import
  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billkaro-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Data exported!', 'success');
    } catch { toast('Export failed', 'error'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importData(text);
      const parts = [];
      if (result.billCount) parts.push(`${result.billCount} invoice(s)`);
      if (result.hasProfile) parts.push('profile');
      if (result.templateCount) parts.push(`${result.templateCount} template(s)`);
      if (result.clientCount) parts.push(`${result.clientCount} client(s)`);
      toast(`Imported: ${parts.join(', ')}`, 'success');
      if (result.hasProfile) { const p = await getProfile(); setProfile(p); if (onSaved) onSaved(p); }
      if (result.templateCount) loadTemplates();
      if (result.clientCount) loadClients();
    } catch { toast('Invalid backup file.', 'error'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Terms templates
  const handleSaveTemplate = async () => {
    if (!editingTemplate.name.trim()) { toast('Name required', 'warning'); return; }
    await saveTermsTemplate({ ...editingTemplate });
    toast('Template saved!', 'success');
    setEditingTemplate(null);
    loadTemplates();
  };

  const handleDeleteTemplate = async (id) => {
    if (confirm('Delete this template?')) { await deleteTermsTemplate(id); toast('Deleted', 'success'); loadTemplates(); }
  };

  // Saved clients
  const handleDeleteClient = async (id) => {
    if (confirm('Remove this saved client?')) { await deleteClient(id); toast('Client removed', 'success'); loadClients(); }
  };

  return (
    <div className="settings-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Business profile, branding, integrations & data</p>
        </div>
      </div>

      {/* ---- Business Profile ---- */}
      <form onSubmit={handleSave} className="glass-panel p-6 mb-6">
        <h3 className="section-title">Company Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group full-width">
            <label className="form-label">Business Name *</label>
            <input required type="text" name="businessName" className="form-input" value={profile.businessName} onChange={handleChange} />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Address *</label>
            <textarea required rows="3" name="address" className="form-input" value={profile.address} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">State *</label>
            <select required name="state" className="form-input" value={profile.state} onChange={handleChange}>
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">GSTIN</label>
            <input type="text" name="gstin" className="form-input" value={profile.gstin} onChange={handleChange} placeholder="Optional" maxLength={15} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" name="email" className="form-input" value={profile.email} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="text" name="phone" className="form-input" value={profile.phone} onChange={handleChange} />
          </div>
        </div>

        <h3 className="section-title mt-8">Bank Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Bank Name</label>
            <input type="text" name="bankName" className="form-input" value={profile.bankName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Account Number</label>
            <input type="text" name="accountNumber" className="form-input" value={profile.accountNumber} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">IFSC Code</label>
            <input type="text" name="ifsc" className="form-input" value={profile.ifsc} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">PAN Number</label>
            <input type="text" name="pan" className="form-input" value={profile.pan} onChange={handleChange} />
          </div>
        </div>

        {/* UPI */}
        <h3 className="section-title mt-8">UPI Payment</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group full-width">
            <label className="form-label">UPI ID</label>
            <input type="text" name="upiId" className="form-input" value={profile.upiId} onChange={handleChange}
              placeholder="e.g. yourbusiness@upi or 9876543210@paytm" />
            <p className="field-hint">If set, a QR code will appear on invoices for instant UPI payment.</p>
          </div>
        </div>

        {/* Logo & Signature */}
        <h3 className="section-title mt-8">Branding</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Business Logo</label>
            <div className="upload-area">
              {profile.logo ? (
                <div className="upload-preview">
                  <img src={profile.logo} alt="Logo" className="upload-img" />
                  <button type="button" className="icon-btn icon-btn-red upload-remove" onClick={() => removeImage('logo')}><Trash2 size={14} /></button>
                </div>
              ) : (
                <button type="button" className="upload-btn" onClick={() => logoInputRef.current?.click()}>
                  <Image size={20} /><span>Upload Logo</span><span className="upload-hint">PNG, JPG (max 500KB)</span>
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload('logo', e)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Signature / Stamp</label>
            <div className="upload-area">
              {profile.signature ? (
                <div className="upload-preview">
                  <img src={profile.signature} alt="Signature" className="upload-img" />
                  <button type="button" className="icon-btn icon-btn-red upload-remove" onClick={() => removeImage('signature')}><Trash2 size={14} /></button>
                </div>
              ) : (
                <button type="button" className="upload-btn" onClick={() => sigInputRef.current?.click()}>
                  <PenTool size={20} /><span>Upload Signature</span><span className="upload-hint">PNG, JPG (max 500KB)</span>
                </button>
              )}
              <input ref={sigInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload('signature', e)} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* ---- Google Drive ---- */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="section-title">Google Drive Auto-Upload</h3>
        <p className="page-subtitle mb-4">
          Automatically upload invoice PDFs to a Google Drive folder when you download them.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group full-width">
            <label className="form-label">Google OAuth Client ID</label>
            <input type="text" name="googleClientId" className="form-input" value={profile.googleClientId} onChange={handleChange}
              placeholder="xxxx.apps.googleusercontent.com" />
            <p className="field-hint">
              Create one at console.cloud.google.com &rarr; APIs &rarr; Credentials &rarr; OAuth 2.0 Client ID (Web app).
              Add your app URL as an authorized origin.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Drive Folder Name</label>
            <input type="text" name="googleDriveFolder" className="form-input" value={profile.googleDriveFolder} onChange={handleChange}
              placeholder="BillKaro Invoices" />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div className="flex gap-2 mt-2">
              {driveConnected ? (
                <>
                  <span className="status-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <Cloud size={14} /> Connected
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={handleDisconnectDrive}>
                    <CloudOff size={14} /> Disconnect
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  onClick={handleConnectDrive} disabled={connecting}>
                  <Cloud size={16} /> {connecting ? 'Connecting...' : 'Connect Google Drive'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Saved Clients ---- */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="section-title">Saved Clients</h3>
        <p className="page-subtitle mb-4">Clients saved while creating invoices appear here. You can delete ones you no longer need.</p>
        {savedClients.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            No saved clients yet. Use the "Save Client" button on the invoice form to save one.
          </p>
        ) : (
          <div className="template-list">
            {savedClients.map(cli => (
              <div key={cli.id} className="template-card">
                <div className="template-card-header">
                  <div>
                    <strong>{cli.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {cli.state}{cli.gstin ? ` | ${cli.gstin}` : ''}
                    </span>
                  </div>
                  <button className="icon-btn icon-btn-red" onClick={() => handleDeleteClient(cli.id)} title="Delete"><Trash2 size={14} /></button>
                </div>
                {cli.address && <p className="template-card-preview">{cli.address}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Terms Templates ---- */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>Terms & Conditions Templates</h3>
          <button type="button" className="btn btn-secondary" onClick={() => setEditingTemplate({ id: '', name: '', content: '' })}>
            <Plus size={16} /> New Template
          </button>
        </div>
        <p className="page-subtitle mb-4">Create reusable templates — copy-paste your terms here and select them per invoice.</p>

        {editingTemplate && (
          <div className="template-editor">
            <div className="form-group">
              <label className="form-label">Template Name</label>
              <input type="text" className="form-input" value={editingTemplate.name}
                onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder="e.g. Standard Terms, Export Terms" />
            </div>
            <div className="form-group">
              <label className="form-label">Content (paste your terms here)</label>
              <textarea rows="8" className="form-input" value={editingTemplate.content}
                onChange={e => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                placeholder="Paste or type your terms & conditions..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveTemplate}><Save size={16} /> Save Template</button>
            </div>
          </div>
        )}

        {termsTemplates.length === 0 && !editingTemplate ? (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>No templates yet.</p>
        ) : (
          <div className="template-list">
            {termsTemplates.map(tpl => (
              <div key={tpl.id} className="template-card">
                <div className="template-card-header">
                  <strong>{tpl.name}</strong>
                  <div className="flex gap-2">
                    <button className="icon-btn icon-btn-blue" onClick={() => setEditingTemplate({ ...tpl })} title="Edit"><EditIcon size={14} /></button>
                    <button className="icon-btn icon-btn-red" onClick={() => handleDeleteTemplate(tpl.id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="template-card-preview">{tpl.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Data Management ---- */}
      <div className="glass-panel p-6">
        <h3 className="section-title">Data Management</h3>
        <p className="page-subtitle mb-6">Export all data (invoices, profile, clients, templates) as a backup, or import from one.</p>
        <div className="flex gap-4">
          <button type="button" className="btn btn-secondary" onClick={handleExport}><Download size={18} /> Export Backup</button>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18} /> Import Backup</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}

function EditIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
  );
}
