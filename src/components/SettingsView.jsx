import { useState, useEffect, useRef } from 'react';
import { getProfile, saveProfile, exportAllData, importData, inspectBackup, getTermsTemplates, saveTermsTemplate, deleteTermsTemplate, getAllProfiles, saveBusinessProfile, deleteBusinessProfile, getInvoiceNumberSettings, saveInvoiceNumberSettings, getRegionMode, setRegionMode, getEnabledModules, setEnabledModules, getStockAlertSettings, saveStockAlertSettings } from '../store';
import { ensureToken, findOrCreateFolder, uploadJSON } from '../services/googleDrive';
import { getCountryConfig, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion, FEATURE_GROUPS, isModuleEnabled, getPaymentAccounts, createEmptyAccount, maskAccountNumber, reorderAccounts, setDefaultAccount, isValidUpiId } from '../utils';
import { Save, Upload, Download, Plus, Trash2, Edit3, Image, PenTool, Cloud, CloudOff, Building2, Hash, RefreshCw, Save as SaveIcon } from 'lucide-react';
import { initGoogleDrive, isConnected, disconnect } from '../services/googleDrive';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import PrintSettings from './PrintSettings';
import HelpButton from './HelpButton';
import { getBackupsList, restoreBackup, triggerBackup, deleteBackup, getTrashedBills, restoreTrashedBill, purgeTrashedBill } from '../store';

export default function SettingsView({ onSaved }) {
  const [profile, setProfile] = useState({
    businessName: '', address: '', state: '', gstin: '', pan: '',
    email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
    logo: '', logoHeight: 48, signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
  });
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [invNumSettings, setInvNumSettings] = useState({
    format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, startNumber: 1, padDigits: 4,
  });
  const [invNumSaving, setInvNumSaving] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [regionMode, setRegionModeState] = useState(getRegionMode());
  const [enabledModules, setEnabledModulesState] = useState(getEnabledModules());
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  const [stockAlertsSaving, setStockAlertsSaving] = useState(false);

  const toggleModule = (moduleId) => {
    const next = { ...enabledModules, [moduleId]: !isModuleEnabled(moduleId, enabledModules) };
    setEnabledModulesState(next);
    setEnabledModules(next);
  };

  const resetModules = () => {
    setEnabledModulesState({});
    setEnabledModules({});
    toast('Reset to default — all features visible', 'success');
  };
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const sigInputRef = useRef(null);
  const companyFormRef = useRef(null);
  const visibleCountries = getCountriesForRegion(regionMode);

  const handleRegionChange = (mode) => {
    setRegionModeState(mode);
    setRegionMode(mode);
    toast(`Region preference: ${mode === 'india' ? 'India only' : mode === 'international' ? 'International only' : 'Both'}`, 'success');
  };

  useEffect(() => {
    getProfile().then(setProfile);
    loadTemplates();
    loadBusinessProfiles();
    setDriveConnected(isConnected());
    getInvoiceNumberSettings().then(setInvNumSettings);
    getStockAlertSettings().then(setStockAlerts).catch(() => {});
  }, []);

  const loadTemplates = async () => setTermsTemplates(await getTermsTemplates());
  const loadBusinessProfiles = async () => setBusinessProfiles(await getAllProfiles());

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  // ---- Payment Accounts manager ----
  // `editingAccount` = null ⇒ closed; an account object ⇒ form open for that
  // account; a fresh `createEmptyAccount()` ⇒ Add new flow. Saving merges back
  // into profile.paymentAccounts; profile.upiId/bankName/etc. are mirrored to
  // the DEFAULT account on save so legacy code paths and v1.4.x backups keep
  // working without a data migration.
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountUpiWarning, setAccountUpiWarning] = useState('');

  const updateAccounts = (nextAccounts) => {
    // Mirror the default account's fields onto the profile's flat bank/UPI
    // fields. Means: a v1.4.x reader of the same profile.json still sees the
    // current default account's details, and the existing flat-field code
    // paths (e.g. legacy fallback in InvoicePreview) continue to work.
    const def = nextAccounts.find(a => a.isDefault) || nextAccounts[0];
    setProfile(prev => {
      const next = {
        ...prev,
        paymentAccounts: nextAccounts,
        ...(def ? {
          bankName: def.bankName || '',
          accountNumber: def.accountNumber || '',
          ifsc: def.ifsc || '',
          swift: def.swift || '',
          upiId: def.upiId || '',
        } : {}),
      };
      // v1.10.16 — reported: "also set default is not working". Root cause:
      // this function only updated React state via setProfile — the caller
      // was expected to click the main "Save Profile" button afterwards to
      // persist. Users clicked the ⭐ inline button, saw the star move, and
      // assumed it was saved. Reloading the page reverted it. Now every
      // account-level change (mark-default, add, delete, reorder, toggle
      // active) auto-persists to the server without needing the main Save
      // button. Fire-and-forget — the same handler that awaits saveProfile
      // in handleSave already exists for the "save everything" path.
      saveProfile(next).catch(() => { /* non-fatal — user can retry via Save */ });
      return next;
    });
  };

  const openAddAccount = () => {
    const fresh = createEmptyAccount();
    const existing = getPaymentAccounts(profile);
    // First account auto-marks Primary so the user never sees a "no default" state.
    if (existing.length === 0) fresh.isDefault = true;
    setEditingAccount(fresh);
    setAccountUpiWarning('');
  };

  const openEditAccount = (acc) => {
    setEditingAccount({ ...acc });
    setAccountUpiWarning('');
  };

  const cancelAccount = () => { setEditingAccount(null); setAccountUpiWarning(''); };

  const saveAccountForm = () => {
    if (!editingAccount) return;
    const existing = getPaymentAccounts(profile).filter(a => a.id !== 'legacy');
    const idx = existing.findIndex(a => a.id === editingAccount.id);
    const next = idx >= 0 ? existing.map((a, i) => i === idx ? editingAccount : a) : [...existing, editingAccount];
    // Enforce: exactly one default (or zero if list empty).
    if (editingAccount.isDefault) {
      next.forEach(a => { if (a.id !== editingAccount.id) a.isDefault = false; });
    } else if (!next.some(a => a.isDefault) && next.length > 0) {
      next[0].isDefault = true;
    }
    updateAccounts(next);
    setEditingAccount(null);
    setAccountUpiWarning('');
    toast(idx >= 0 ? 'Account updated' : 'Account added', 'success');
  };

  const removeAccount = async (acc) => {
    if (!await confirmAction({
      title: `Delete payment account "${acc.label || acc.bankName || 'this account'}"?`,
      message: 'Existing invoices that used this account keep their frozen bank-detail snapshots (v1.10.19 invariant) — the PDFs stay exactly as printed.',
      confirmLabel: 'Delete account',
      tone: 'danger',
    })) return;
    const next = getPaymentAccounts(profile).filter(a => a.id !== 'legacy' && a.id !== acc.id);
    if (next.length > 0 && !next.some(a => a.isDefault)) next[0].isDefault = true;
    updateAccounts(next);
    toast('Account removed', 'success');
  };

  const markDefault = (acc) => {
    const next = setDefaultAccount(getPaymentAccounts(profile).filter(a => a.id !== 'legacy'), acc.id);
    updateAccounts(next);
    toast(`Default → ${acc.label || acc.bankName || 'account'}`, 'success');
  };

  const toggleAccountActive = (acc) => {
    const next = getPaymentAccounts(profile)
      .filter(a => a.id !== 'legacy')
      .map(a => a.id === acc.id ? { ...a, isActive: !(a.isActive !== false) } : a);
    updateAccounts(next);
  };

  const moveAccountIdx = (idx, delta) => {
    const list = getPaymentAccounts(profile).filter(a => a.id !== 'legacy');
    const next = reorderAccounts(list, idx, idx + delta);
    updateAccounts(next);
  };

  const importLegacyAsAccount = () => {
    const fresh = createEmptyAccount(profile.bankName || 'Default account');
    fresh.bankName = profile.bankName || '';
    fresh.accountNumber = profile.accountNumber || '';
    fresh.ifsc = profile.ifsc || '';
    fresh.swift = profile.swift || '';
    fresh.upiId = profile.upiId || '';
    fresh.isDefault = true;
    updateAccounts([fresh]);
    toast('Imported existing bank details as your first account', 'success');
  };

  const handleImageUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // P2 #34 — MIME + dimension guards. accept="image/*" in the input is
    // trivially bypassable; a HEIC or WebP too large silently blows PDF
    // rendering + file size. Downscale via canvas keeps quality reasonable.
    const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED_MIME.includes(file.type)) {
      toast('Only PNG, JPEG, WebP, or SVG images are supported', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Image is over 2MB — please compress first (tinypng.com works well)', 'warning');
      return;
    }
    // SVGs are vector — no need to downscale, just embed as-is
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (ev) => setProfile(prev => ({ ...prev, [field]: ev.target.result }));
      reader.readAsDataURL(file);
      return;
    }
    // Raster: load into an Image, downscale to max 1024px on the longer edge
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = MAX / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
      setProfile(prev => ({ ...prev, [field]: dataUrl }));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not decode that image', 'error'); };
    img.src = url;
  };

  const removeImage = (field) => setProfile(prev => ({ ...prev, [field]: '' }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await saveProfile(profile);
      // v1.10.16 — reported: "uploaded logo and saved but it's not showing on
      // invoice". Root cause was a stale `freegstbill_invoiceOptions.showLogo`
      // in localStorage from before the upload — DEFAULT_OPTIONS has it true,
      // but a false persisted from an earlier state kept it hidden even after
      // the upload. Now: whenever the user saves a profile that has a logo,
      // we force `showLogo: true` in the persisted invoice options. Same for
      // signature. Users who consciously want to hide the logo can still
      // uncheck it in the Customize panel — this fix only rescues the
      // silent-fail case.
      if (profile.logo || profile.signature) {
        try {
          const raw = localStorage.getItem('freegstbill_invoiceOptions');
          const opts = raw ? JSON.parse(raw) : {};
          if (profile.logo) opts.showLogo = true;
          if (profile.signature) opts.showSignature = true;
          localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(opts));
        } catch { /* localStorage full or blocked — skip */ }
      }
      if (onSaved) onSaved(profile);
      toast('Profile saved!', 'success');
    } catch { toast('Failed to save profile', 'error'); }
    finally { setSaving(false); }
  };

  // Invoice Number Settings
  const handleInvNumChange = (field, value) => {
    setInvNumSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveInvNumSettings = async () => {
    setInvNumSaving(true);
    try {
      await saveInvoiceNumberSettings(invNumSettings);
      toast('Invoice number settings saved!', 'success');
    } catch { toast('Failed to save settings', 'error'); }
    finally { setInvNumSaving(false); }
  };

  const getInvNumPreview = () => {
    const s = invNumSettings;
    const pfx = s.brandPrefix || 'INV';
    const sep = s.separator || '/';
    const padded = String(s.startNumber || 1).padStart(s.padDigits || 4, '0');
    if (s.format === 'random') {
      return `${pfx}${sep}A3X9K2`;
    }
    if (s.showFinYear) {
      const yr = new Date().getFullYear();
      const ny = (yr + 1).toString().slice(-2);
      return `${pfx}${sep}${yr}-${ny}${sep}${padded}`;
    }
    return `${pfx}${sep}${padded}`;
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

  // Export / Import (granular)
  const ALL_BACKUP_PARTS = [
    { id: 'profile',        label: 'Active business profile',  hint: 'Name, address, GSTIN, bank, logo, signature' },
    { id: 'profiles',       label: 'All business profiles',    hint: 'Multi-business switcher entries' },
    { id: 'bills',          label: 'Invoices / bills',         hint: 'Tax invoices, proforma, credit notes, etc.' },
    { id: 'clients',        label: 'Clients',                  hint: 'Saved client directory' },
    { id: 'products',       label: 'Products / Inventory',     hint: 'Product catalog with HSN, rate, stock' },
    { id: 'expenses',       label: 'Expenses',                 hint: 'Expense tracker entries' },
    { id: 'purchases',      label: 'Purchase bills',           hint: 'Vendor bills used for ITC' },
    { id: 'recurring',      label: 'Recurring invoices',       hint: 'Auto-billing schedule entries' },
    { id: 'receipts',       label: 'Receipts',                 hint: 'Payment receipts' },
    { id: 'termsTemplates', label: 'Terms templates',          hint: 'Reusable T&C library' },
    { id: 'meta',           label: 'App settings',             hint: 'Region, modules, invoice number format, display options' },
    { id: 'localStorage',   label: 'Local preferences',        hint: 'Custom units, theme, last region preference' },
  ];

  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportSel, setExportSel] = useState(() => Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, true])));
  const [importSel, setImportSel] = useState(() => Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, true])));
  const [importInspection, setImportInspection] = useState(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [exportToDrive, setExportToDrive] = useState(false);
  const [drivePending, setDrivePending] = useState(false);

  const toggleExport = (id) => setExportSel(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleImport = (id) => setImportSel(prev => ({ ...prev, [id]: !prev[id] }));
  const exportToggleAll = (val) => setExportSel(Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, val])));
  const importToggleAll = (val) => setImportSel(Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, val])));

  const runExport = async () => {
    try {
      const json = await exportAllData(exportSel);
      const fileName = `freegstbill-backup-${new Date().toISOString().split('T')[0]}.json`;

      // Local download (always)
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);

      // Optional Google Drive copy
      if (exportToDrive) {
        if (!profile?.googleClientId) {
          toast('Google Drive not configured. Set Google Client ID in Settings to enable Drive backups.', 'warning');
        } else {
          setDrivePending(true);
          const ok = await ensureToken(profile.googleClientId);
          if (!ok) { toast('Drive auth failed — backup downloaded locally only', 'warning'); }
          else {
            const folderName = (profile.googleDriveFolder || 'GST Billing Invoices') + ' - Backups';
            const folderId = await findOrCreateFolder(folderName);
            const result = await uploadJSON(fileName, json, folderId);
            toast(`Saved to Drive — ${result.name}`, 'success');
          }
          setDrivePending(false);
        }
      }

      toast('Backup downloaded', 'success');
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast('Export failed: ' + (err.message || 'unknown error'), 'error');
      setDrivePending(false);
    }
  };

  const handleImportPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const inspection = inspectBackup(text);
      if (!inspection.valid) { toast("This file doesn't look like a Free GST Billing backup.", 'error'); return; }
      setImportInspection(inspection);
      setImportJsonText(text);
      // Auto-tick only the parts that actually have data in the file
      const auto = {};
      ALL_BACKUP_PARTS.forEach(p => { auto[p.id] = (inspection.counts[p.id] || 0) > 0; });
      setImportSel(auto);
      setShowImportModal(true);
    } catch { toast('Could not read the file', 'error'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runImport = async () => {
    try {
      const result = await importData(importJsonText, importSel);
      const parts = [];
      if (result.billCount) parts.push(`${result.billCount} invoice(s)`);
      if (result.hasProfile) parts.push('profile');
      if (result.templateCount) parts.push(`${result.templateCount} template(s)`);
      if (result.clientCount) parts.push(`${result.clientCount} client(s)`);
      if (result.productCount) parts.push(`${result.productCount} product(s)`);
      toast(parts.length ? `Restored: ${parts.join(', ')}` : 'Restore complete', 'success');
      if (importSel.profile) { const p = await getProfile(); setProfile(p); if (onSaved) onSaved(p); }
      if (importSel.termsTemplates) loadTemplates();
      if (importSel.profiles) loadBusinessProfiles();
      setShowImportModal(false);
      setImportInspection(null);
      setImportJsonText('');
    } catch (err) {
      console.error(err);
      toast('Import failed: ' + (err.message || 'unknown error'), 'error');
    }
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
    if (await confirmAction({
      title: 'Delete this template?',
      message: 'Existing invoices that used this Terms preset keep their text — this only removes the reusable template.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) { await deleteTermsTemplate(id); toast('Deleted', 'success'); loadTemplates(); }
  };

  // Multi-business profiles
  const handleSaveAsProfile = async () => {
    if (!profile.businessName.trim()) { toast('Business name required', 'warning'); return; }
    // Update existing profile with same name, or create new
    const existing = businessProfiles.find(bp => bp.businessName.trim().toLowerCase() === profile.businessName.trim().toLowerCase());
    await saveBusinessProfile({ ...profile, id: existing?.id || undefined });
    toast(existing ? 'Profile updated!' : 'Profile saved!', 'success');
    loadBusinessProfiles();
  };

  const handleLoadProfile = async (bp) => {
    // Auto-save current profile before switching (so it's not lost)
    if (profile.businessName?.trim()) {
      const existing = businessProfiles.find(p => p.businessName.trim().toLowerCase() === profile.businessName.trim().toLowerCase());
      await saveBusinessProfile({ ...profile, id: existing?.id || undefined });
    }
    const loaded = { ...bp };
    delete loaded.id;
    setProfile(loaded);
    await saveProfile(loaded);
    if (onSaved) onSaved(loaded);
    toast(`Switched to ${bp.businessName}`, 'success');
  };

  const handleDeleteProfile = async (id) => {
    if (await confirmAction({
      title: 'Delete this saved business profile?',
      message: 'Invoices already saved under this profile stay untouched. Only removes the profile from your saved list.',
      confirmLabel: 'Delete profile',
      tone: 'danger',
    })) {
      await deleteBusinessProfile(id);
      toast('Profile deleted', 'success');
      loadBusinessProfiles();
    }
  };

  const handleAddNewProfile = () => {
    setProfile({
      businessName: '', address: '', city: '', state: '', pin: '', country: detectCountryFromBrowser(),
      gstin: '', pan: '', email: '', phone: '', bankName: '', accountNumber: '', ifsc: '', swift: '',
      logo: '', logoHeight: 48, signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
    });
    setTaxIdWarning('');
    companyFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [taxIdWarning, setTaxIdWarning] = useState('');
  const handleTaxIdBlur = () => {
    const result = validateTaxId(profile.country, profile.gstin);
    setTaxIdWarning(result.ok ? '' : result.message);
  };


  return (
    <div className="settings-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Business profile, branding, integrations & data</p>
          </div>
          <HelpButton title="Settings — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Company Details</strong> — this is the header block on every invoice. GSTIN drives place-of-supply detection.</li>
              <li><strong>Multi-business profiles</strong> — Save as Profile keeps the current form as a switchable profile; switch between them from the invoice generator.</li>
              <li><strong>Payment Accounts</strong> — add multiple bank / UPI accounts; ⭐ marks the default. Every inline change (add / edit / ⭐ / reorder / delete) auto-saves.</li>
              <li><strong>Invoice Number Settings</strong> — brand prefix, financial-year suffix, padding. Live preview at the bottom.</li>
              <li><strong>Print Settings</strong> — templates, colors, watermark, thermal font size, per-type prefix overrides.</li>
              <li><strong>Backup Management</strong> — daily auto-backups kept 30 days. Restore any date, or Delete to reclaim disk. Trash bin keeps deleted invoices for 30 days.</li>
              <li><strong>Google Drive sync</strong> — connect once to auto-upload every backup to your own Drive.</li>
              <li><strong>Import / Export</strong> — CSV import for products/clients; JSON export for full backup portability.</li>
            </ul>
          </HelpButton>
        </div>
      </div>

      {/* ---- Stock Alerts ---- */}
      <div className="glass-panel p-6 mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>Low-stock alerts</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Controls the 🔔 sidebar badge and the Dashboard low-stock list. The Inventory page colour-codes products against this threshold too.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.85rem 1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={!!stockAlerts.enabled}
              onChange={e => setStockAlerts(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
            <strong>Show low-stock alerts</strong>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stockAlerts.enabled
              ? 'Notifications fire when a product\'s stock falls to or below the threshold.'
              : 'Alerts are silenced. Inventory still tracks stock; it just doesn\'t nag you.'}
          </span>

          <label style={{ fontSize: '0.85rem', fontWeight: 600, opacity: stockAlerts.enabled ? 1 : 0.5 }}>
            Threshold
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="number" min="0" max="9999" step="1"
              disabled={!stockAlerts.enabled}
              className="form-input" style={{ width: '90px' }}
              value={stockAlerts.threshold}
              onChange={e => setStockAlerts(prev => ({ ...prev, threshold: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Alert when stock ≤ this number. Common picks: <code>0</code> (only when fully out), <code>3</code>, <code>5</code> (default), <code>10</code>.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
          <button type="button" className="btn btn-primary"
            disabled={stockAlertsSaving}
            onClick={async () => {
              setStockAlertsSaving(true);
              try {
                await saveStockAlertSettings(stockAlerts);
                toast('Low-stock alert settings saved', 'success');
              } catch { toast('Failed to save', 'error'); }
              setStockAlertsSaving(false);
            }}>
            <Save size={16} /> {stockAlertsSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ---- Thermal Printer Settings ---- */}
      <PrintSettings />

      {/* v1.9.5 — Backup Management + Trash Bin */}
      <BackupAndTrashPanel />

      {/* ---- Modules / Features ---- */}
      <div className="glass-panel p-6 mb-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>Modules</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              Turn off the features you don't need. They disappear from the sidebar and forms — your data stays untouched.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={resetModules} style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}>
            Reset to default
          </button>
        </div>
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {FEATURE_GROUPS.map(group => (
            <div key={group.id} className="surface-card">
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{group.label}</div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>{group.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {group.modules.map(mod => {
                  const enabled = isModuleEnabled(mod.id, enabledModules);
                  // Hide India-only modules entirely when region is "international" — toggling
                  // them on wouldn't have any effect.
                  if (mod.indiaOnly && regionMode === 'international') return null;
                  return (
                    <label key={mod.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78rem', cursor: mod.core ? 'not-allowed' : 'pointer', opacity: mod.core ? 0.55 : 1 }}>
                      <input type="checkbox" checked={enabled} disabled={mod.core}
                        onChange={() => !mod.core && toggleModule(mod.id)}
                        style={{ width: 15, height: 15, accentColor: 'var(--primary)', marginTop: '2px' }} />
                      <span style={{ lineHeight: 1.35 }}>
                        {mod.label}
                        {mod.core && <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.4rem' }}>(always on)</span>}
                        {mod.indiaOnly && <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.4rem' }} title="India-only feature">🇮🇳</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Region Preference ---- */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="section-title" style={{ marginTop: 0 }}>Region Preference</h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.85rem' }}>
          Choose how the app behaves. You can change this any time without losing data.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'india', label: '🇮🇳 India only', desc: 'GST flows, INR-first, GSTR-1/3B, E-Way Bill, UPI QR' },
            { id: 'international', label: '🌍 International', desc: 'VAT/SST/TVA labels, multi-currency, no India-only flows' },
            { id: 'both', label: '🌐 Both / Auto', desc: 'Show all countries — pick per invoice (default)' },
          ].map(opt => (
            <button key={opt.id} type="button"
              onClick={() => handleRegionChange(opt.id)}
              className={`type-chip ${regionMode === opt.id ? 'type-chip-active' : ''}`}
              title={opt.desc}
              style={{ flex: '1 1 200px', minWidth: '200px', textAlign: 'left', padding: '0.6rem 0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontSize: '0.72rem', color: regionMode === opt.id ? 'inherit' : '#94a3b8', fontWeight: 400 }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Business Profile ---- */}
      <form onSubmit={handleSave} className="glass-panel p-6 mb-6" ref={companyFormRef}>
        <h3 className="section-title">Company Details</h3>
        {(() => {
          const cc = getCountryConfig(profile.country);
          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width">
                <label className="form-label">Business Name *</label>
                <input required type="text" name="businessName" className="form-input" value={profile.businessName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <select name="country" className="form-input" value={profile.country || 'India'} onChange={handleChange}>
                  {/* If the saved country is filtered out by the region toggle, keep it visible. */}
                  {profile.country && !visibleCountries.some(c => c.name === profile.country) && (
                    <option value={profile.country}>{profile.country}</option>
                  )}
                  {visibleCountries.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group full-width">
                <label className="form-label">Address</label>
                <textarea rows="2" name="address" className="form-input" value={profile.address} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" name="city" className="form-input" value={profile.city || ''} onChange={handleChange} placeholder="e.g. Mumbai" />
              </div>
              <div className="form-group">
                <label className="form-label">{cc.postalLabel}</label>
                <input type="text" name="pin" className="form-input" value={profile.pin || ''} onChange={handleChange} placeholder={cc.postalLabel} />
              </div>
              <div className="form-group">
                <label className="form-label">{cc.stateLabel}</label>
                {(() => {
                  const stateOpts = getStatesForCountry(profile.country || 'India');
                  return stateOpts.length > 0 ? (
                    <select name="state" className="form-input" value={profile.state} onChange={handleChange}>
                      <option value="">Select {cc.stateLabel}</option>
                      {stateOpts.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="state" className="form-input" value={profile.state || ''} onChange={handleChange} placeholder={cc.stateLabel} />
                  );
                })()}
              </div>
              <div className="form-group">
                <label className="form-label">{cc.taxIdLabel}</label>
                <input type="text" name="gstin" className="form-input"
                  style={taxIdWarning ? { borderColor: '#f59e0b' } : undefined}
                  value={profile.gstin}
                  onChange={(e) => { handleChange(e); if (taxIdWarning) setTaxIdWarning(''); }}
                  onBlur={handleTaxIdBlur}
                  placeholder={cc.taxIdPlaceholder} maxLength={20} />
                {taxIdWarning && <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ {taxIdWarning}</small>}
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
          );
        })()}

        {/* ---- Payment Accounts ---- */}
        {(() => {
          const bankCC = getCountryConfig(profile.country);
          const isIndia = (profile.country || 'India') === 'India';
          // Show real accounts only — never the synthesised legacy entry, since this
          // panel is for editing the persistent array.
          const accounts = (profile.paymentAccounts || []).filter(a => a && a.id !== 'legacy');
          const hasLegacyFlat = !accounts.length && (profile.bankName || profile.accountNumber || profile.ifsc || profile.swift || profile.upiId);
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem', marginTop: '2rem' }}>
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>Payment Accounts</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                    Multiple bank / UPI accounts per profile. Pick one per invoice in the Customize panel.
                    The ⭐ default account is preselected on new invoices.
                  </p>
                </div>
                <button type="button" className="btn btn-primary" onClick={openAddAccount}>
                  <Plus size={16} /> Add account
                </button>
              </div>

              {/* Migration banner — one-time prompt to lift the legacy flat fields into the new array. */}
              {hasLegacyFlat && (
                <div className="notice notice-warn" style={{ marginTop: '0.85rem' }}>
                  <span className="notice-icon">📋</span>
                  <div style={{ flex: 1 }}>
                    <strong>Your existing bank details are still on this profile.</strong> Click below to import them as the first Payment Account, then add more.
                    <div style={{ marginTop: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary" onClick={importLegacyAsAccount} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                        Import &amp; continue →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state — no accounts AND no legacy fields */}
              {accounts.length === 0 && !hasLegacyFlat && (
                <div className="surface-card" style={{ marginTop: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    No payment accounts yet. Add the first one — it's auto-marked ⭐ Primary.
                  </p>
                </div>
              )}

              {/* Account list */}
              {accounts.length > 0 && (
                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {accounts.map((a, idx) => (
                    <div key={a.id} className="surface-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', opacity: a.isActive === false ? 0.55 : 1 }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {a.isDefault && <span title="Default account" style={{ fontSize: '0.95rem' }}>⭐</span>}
                          <strong style={{ fontSize: '0.92rem' }}>{a.label || a.bankName || 'Untitled account'}</strong>
                          {a.isActive === false && <span className="status-pill" style={{ '--pill-color': 'var(--text-muted)' }}>Inactive</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.55 }}>
                          {a.bankName && <span>{a.bankName} · </span>}
                          {a.accountNumber && <span>A/C {maskAccountNumber(a.accountNumber)} · </span>}
                          {a.ifsc && <span>{bankCC.bankLabel || 'IFSC'} {a.ifsc}</span>}
                          {a.swift && <span> · SWIFT {a.swift}</span>}
                          {a.upiId && <span> · 📱 {a.upiId}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {!a.isDefault && (
                          <button type="button" className="icon-btn" onClick={() => markDefault(a)} title="Set as default">⭐</button>
                        )}
                        <button type="button" className="icon-btn" onClick={() => moveAccountIdx(idx, -1)} disabled={idx === 0} title="Move up">↑</button>
                        <button type="button" className="icon-btn" onClick={() => moveAccountIdx(idx, 1)} disabled={idx === accounts.length - 1} title="Move down">↓</button>
                        <button type="button" className="icon-btn" onClick={() => toggleAccountActive(a)} title={a.isActive === false ? 'Activate' : 'Deactivate'}>
                          {a.isActive === false ? '✓' : '∅'}
                        </button>
                        <button type="button" className="icon-btn icon-btn-blue" onClick={() => openEditAccount(a)} title="Edit"><Edit3 size={15} /></button>
                        <button type="button" className="icon-btn icon-btn-red" onClick={() => removeAccount(a)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PAN sits OUTSIDE the accounts list because it's profile-level, not per-account */}
              {isIndia && (
                <div className="form-group" style={{ marginTop: '1rem', maxWidth: '300px' }}>
                  <label className="form-label">PAN Number (business-level)</label>
                  <input type="text" name="pan" className="form-input" value={profile.pan || ''} onChange={handleChange} placeholder="e.g. AAAAA1234A" maxLength={10} />
                </div>
              )}

              {/* Add/Edit modal */}
              {editingAccount && (
                <div className="modal-overlay" onClick={cancelAccount}>
                  <div className="modal-content" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                    <h3 className="section-title" style={{ marginTop: 0 }}>{getPaymentAccounts(profile).some(a => a.id === editingAccount.id) ? 'Edit account' : 'Add account'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Label (shown in the dropdown)</label>
                        <input type="text" className="form-input" value={editingAccount.label}
                          onChange={e => setEditingAccount(a => ({ ...a, label: e.target.value }))}
                          placeholder="e.g. HDFC Current — 1234" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bank Name</label>
                        <input type="text" className="form-input" value={editingAccount.bankName}
                          onChange={e => setEditingAccount(a => ({ ...a, bankName: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Account Number {!isIndia && '/ IBAN'}</label>
                        <input type="text" className="form-input" value={editingAccount.accountNumber}
                          onChange={e => setEditingAccount(a => ({ ...a, accountNumber: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{bankCC.bankLabel || 'IFSC Code'}</label>
                        <input type="text" className="form-input" value={editingAccount.ifsc}
                          onChange={e => setEditingAccount(a => ({ ...a, ifsc: e.target.value }))}
                          placeholder={bankCC.bankLabel} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SWIFT / BIC (optional)</label>
                        <input type="text" className="form-input" value={editingAccount.swift}
                          onChange={e => setEditingAccount(a => ({ ...a, swift: e.target.value }))}
                          placeholder="e.g. HDFCINBB" />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">UPI ID (optional — drives the QR for this account)</label>
                        <input type="text" className="form-input"
                          style={accountUpiWarning ? { borderColor: '#f59e0b' } : undefined}
                          value={editingAccount.upiId}
                          onChange={e => { setEditingAccount(a => ({ ...a, upiId: e.target.value })); if (accountUpiWarning) setAccountUpiWarning(''); }}
                          onBlur={() => {
                            const v = (editingAccount.upiId || '').trim();
                            setAccountUpiWarning(v && !isValidUpiId(v) ? "Doesn't look like a UPI ID. Expected like merchant@hdfcbank or 9876543210@paytm." : '');
                          }}
                          placeholder="e.g. yourbusiness@hdfcbank" />
                        {accountUpiWarning && <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ {accountUpiWarning}</small>}
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Internal notes (not printed on the PDF)</label>
                        <textarea rows="2" className="form-input" value={editingAccount.notes}
                          onChange={e => setEditingAccount(a => ({ ...a, notes: e.target.value }))}
                          placeholder="e.g. Use for export clients only" />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!editingAccount.isDefault}
                            onChange={e => setEditingAccount(a => ({ ...a, isDefault: e.target.checked }))}
                            style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                          <span><strong>⭐ Set as default account</strong> — preselected on every new invoice</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-4">
                      <button type="button" className="btn btn-secondary" onClick={cancelAccount}>Cancel</button>
                      <button type="button" className="btn btn-primary" onClick={saveAccountForm}>
                        <Save size={16} /> Save account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Invoice Number Format */}
        <h3 className="section-title mt-8"><Hash size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Invoice Number Format</h3>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Preview:</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)', margin: 0 }}>{getInvNumPreview()}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group full-width">
            <label className="form-label">Format Style</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'branded', label: 'Branded Sequential', desc: 'PREFIX/2026-27/0001' },
                { id: 'sequential', label: 'Simple Sequential', desc: 'PREFIX/0001' },
                { id: 'random', label: 'Random', desc: 'PREFIX/A3X9K2' },
              ].map(f => (
                <button key={f.id} type="button"
                  className={`type-chip ${invNumSettings.format === f.id ? 'type-chip-active' : ''}`}
                  onClick={() => {
                    const updates = { format: f.id };
                    if (f.id === 'sequential') updates.showFinYear = false;
                    if (f.id === 'branded') updates.showFinYear = true;
                    setInvNumSettings(prev => ({ ...prev, ...updates }));
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Brand Prefix</label>
            <input type="text" className="form-input" value={invNumSettings.brandPrefix}
              onChange={e => handleInvNumChange('brandPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. ACME, BK (leave empty for INV/EST/CN)" maxLength={10} />
            <p className="field-hint">Your brand name or abbreviation. Leave empty to use default type prefix (INV, EST, CN, BOS).</p>
          </div>
          <div className="form-group">
            <label className="form-label">Separator</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['/', '-', '#'].map(sep => (
                <button key={sep} type="button"
                  className={`type-chip ${invNumSettings.separator === sep ? 'type-chip-active' : ''}`}
                  style={{ minWidth: 44, fontFamily: 'monospace', fontWeight: 700 }}
                  onClick={() => handleInvNumChange('separator', sep)}>
                  {sep}
                </button>
              ))}
            </div>
          </div>
          {invNumSettings.format !== 'random' && (
            <>
              <div className="form-group">
                <label className="form-label">Include Financial Year</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                  <button type="button"
                    className={`type-chip ${invNumSettings.showFinYear ? 'type-chip-active' : ''}`}
                    onClick={() => handleInvNumChange('showFinYear', true)}>Yes (2026-27)</button>
                  <button type="button"
                    className={`type-chip ${!invNumSettings.showFinYear ? 'type-chip-active' : ''}`}
                    onClick={() => handleInvNumChange('showFinYear', false)}>No</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Number Padding</label>
                <select className="form-input" value={invNumSettings.padDigits}
                  onChange={e => handleInvNumChange('padDigits', Number(e.target.value))}>
                  <option value={3}>3 digits (001)</option>
                  <option value={4}>4 digits (0001)</option>
                  <option value={5}>5 digits (00001)</option>
                  <option value={6}>6 digits (000001)</option>
                </select>
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-primary" onClick={handleSaveInvNumSettings} disabled={invNumSaving}>
            <Save size={16} /> {invNumSaving ? 'Saving...' : 'Save Number Format'}
          </button>
        </div>

        {/* Logo & Signature */}
        <h3 className="section-title mt-8">Branding</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Business Logo</label>
            <div className="upload-area">
              {profile.logo ? (
                <div className="logo-upload-section">
                  <div className="logo-preview-box">
                    <img src={profile.logo} alt="Logo" style={{ height: `${profile.logoHeight || 48}px`, maxWidth: '180px', objectFit: 'contain', display: 'block' }} />
                    <button type="button" className="icon-btn icon-btn-red upload-remove" onClick={() => removeImage('logo')}><Trash2 size={14} /></button>
                  </div>
                  <div className="logo-size-control">
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Logo Size on Invoice</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>S</span>
                      <input type="range" min="24" max="80" value={profile.logoHeight || 48} onChange={(e) => setProfile(prev => ({ ...prev, logoHeight: Number(e.target.value) }))} className="logo-slider" />
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>L</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{profile.logoHeight || 48}px height</span>
                  </div>
                  <button type="button" className="upload-change-btn" onClick={() => logoInputRef.current?.click()}>Change Logo</button>
                </div>
              ) : (
                <button type="button" className="upload-btn" onClick={() => logoInputRef.current?.click()}>
                  <Image size={20} /><span>Upload Logo</span><span className="upload-hint">PNG or JPG, square or wide (max 500KB)</span>
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

      {/* ---- Cloud Backup ---- */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="section-title">Cloud Backup (Google Drive)</h3>
        <p className="page-subtitle mb-4">
          Auto-sync your invoices to Google Drive — no coding or API setup needed.
        </p>

        {/* Easy method */}
        <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem', border: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cloud size={18} color="var(--primary)" /> Easiest Way — Google Drive for Desktop (Recommended)
          </h4>
          <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
            <li>
              <a href="https://www.google.com/drive/download/" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Download Google Drive for Desktop
              </a> (free from Google) and install it
            </li>
            <li>Sign in with your Google account — a <strong>Google Drive (G:)</strong> folder appears on your PC</li>
            <li>Move your app's <strong>Saved Invoices</strong> folder into Google Drive, or set Windows to sync it</li>
            <li>Done! All PDFs automatically sync to your Google Drive cloud</li>
          </ol>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
            Your invoices will be accessible from any device, phone, or computer via drive.google.com. No API key needed.
          </p>
        </div>

        {/* Advanced API method - collapsible */}
        <details style={{ fontSize: '0.85rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem 0' }}>
            Advanced: Direct API Upload (for developers)
          </summary>
          <div style={{ paddingTop: '0.75rem' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width">
                <label className="form-label">Google OAuth Client ID</label>
                <input type="text" name="googleClientId" className="form-input" value={profile.googleClientId} onChange={handleChange}
                  placeholder="xxxx.apps.googleusercontent.com" />
                <p className="field-hint">
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--primary)' }}>Open Google Cloud Console</a> &rarr; Create Project &rarr; Enable Drive API &rarr; Create OAuth Client ID (Web app) &rarr; Add <code>http://localhost:5173</code> as origin.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Drive Folder Name</label>
                <input type="text" name="googleDriveFolder" className="form-input" value={profile.googleDriveFolder} onChange={handleChange}
                  placeholder="GST Billing Invoices" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <div className="flex gap-2 mt-2">
                  {driveConnected ? (
                    <>
                      <span className="status-badge" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
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
        </details>
      </div>

      {/* ---- Terms Templates ---- */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>Terms & Conditions Templates</h3>
          <button type="button" className="btn btn-secondary" onClick={() => setEditingTemplate({ id: '', name: '', content: '' })}>
            <Plus size={16} /> New Template
          </button>
        </div>
        <p className="page-subtitle mb-4">Create reusable templates or pick from ready-made ones below.</p>

        {/* Quick Templates */}
        {!editingTemplate && (
          <div className="quick-templates-section">
            <p className="form-label" style={{ marginBottom: '0.5rem' }}>Quick Start — Pick a template for your business:</p>
            <div className="quick-templates-grid">
              {[
                { name: 'Services (IT, Consulting, Freelance)', content: '1. Payment is due within 15 days of invoice date via NEFT/RTGS/UPI unless otherwise agreed.\n2. Late payment interest of 18% per annum will apply on overdue amounts as per MSME Act, 2006.\n3. All amounts are exclusive of GST (CGST/SGST/IGST) as applicable under the GST Act, 2017.\n4. Services rendered are non-refundable once delivered and accepted by the client.\n5. TDS (if applicable) must be deducted as per Income Tax Act. Please share TDS certificate (Form 16A) within 15 days.\n6. All deliverables remain the intellectual property of the service provider until full payment is received.\n7. Any disputes shall be subject to the exclusive jurisdiction of courts in the service provider\'s city.\n8. This is a computer-generated invoice and does not require a physical signature.' },
                { name: 'Goods & Products (Retail, Wholesale)', content: '1. Goods once sold will not be taken back or exchanged unless defective as per Consumer Protection Act, 2019.\n2. Payment is due on delivery via Cash/UPI/NEFT unless credit terms are agreed in advance.\n3. Warranty (if applicable) covers manufacturing defects only as per terms mentioned on the product.\n4. All prices are inclusive of GST (CGST + SGST / IGST) as shown on this invoice.\n5. Claims for damaged or missing items must be reported within 48 hours of delivery with photos.\n6. E-way bill is generated for consignments exceeding Rs. 50,000 as per GST rules.\n7. Risk of loss passes to the buyer upon dispatch from our godown/warehouse.\n8. Subject to jurisdiction of courts at the seller\'s place of business.\n9. This is a computer-generated invoice and does not require a physical signature.' },
                { name: 'Manufacturing & Trading', content: '1. All prices are ex-factory/ex-godown unless otherwise specified.\n2. Payment terms: 50% advance via NEFT/RTGS, balance before dispatch (or as per agreed credit terms).\n3. Goods dispatched only after full payment or confirmed credit arrangement.\n4. Quality complaints must be raised within 7 days of receipt with photographic evidence.\n5. Returns accepted only for manufacturing defects, subject to inspection at our premises.\n6. GST, freight, insurance, loading/unloading charges are as per agreement or additional to quoted price.\n7. E-way bill will be generated as per Section 68 of CGST Act for applicable consignments.\n8. Force majeure: Delays due to natural calamities, strikes, or government orders shall not be held against us.\n9. Interest @ 18% p.a. on overdue payments as per MSME Development Act, 2006.\n10. Subject to exclusive jurisdiction of courts at the seller\'s registered office.\n11. This is a computer-generated invoice and does not require a physical signature.' },
                { name: 'Export / International', content: '1. All prices are in the agreed currency (USD/EUR/GBP) and exclusive of local taxes/duties in buyer\'s country.\n2. Payment via wire transfer (SWIFT/TT) within 30 days of invoice date as per RBI guidelines.\n3. Supply is zero-rated under GST — exported under Letter of Undertaking (LUT) / Bond.\n4. Title and risk pass to buyer upon delivery to carrier (FOB/CIF as per Incoterms 2020).\n5. Buyer is responsible for import duties, customs clearance, and local compliance in destination country.\n6. Claims for shortage or damage must be filed within 14 days of receipt with supporting documents.\n7. All payments to be received in INR equivalent or foreign currency as per FEMA regulations.\n8. Disputes shall be resolved through arbitration in India under the Arbitration & Conciliation Act, 1996.\n9. This is a computer-generated invoice and does not require a physical signature.' },
                { name: 'Freelancer (Simple)', content: '1. Payment due within 7 days of invoice via UPI/NEFT/IMPS.\n2. Late payments attract interest @ 2% per month.\n3. 50% advance required before project commencement.\n4. Scope changes after agreement will be quoted and billed separately.\n5. All work remains property of the freelancer until full payment is received.\n6. Cancellation after work begins: completed portion will be billed proportionally.\n7. TDS (if applicable) to be deducted at source. Share Form 16A within 15 days of deduction.\n8. Subject to jurisdiction of courts in the freelancer\'s city.\n9. This is a computer-generated invoice.' },
              ].map((qt, i) => (
                <button key={i} type="button" className="quick-template-btn" onClick={async () => {
                  await saveTermsTemplate({ name: qt.name, content: qt.content });
                  toast(`Added: ${qt.name}`, 'success');
                  loadTemplates();
                }}>
                  <Plus size={14} /> {qt.name}
                </button>
              ))}
            </div>
          </div>
        )}

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

      {/* ---- Multi-Business Profiles ---- */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>Business Profiles</h3>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={handleAddNewProfile}>
              <Plus size={16} /> Add New Profile
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveAsProfile}>
              <Building2 size={16} /> Save as Profile
            </button>
          </div>
        </div>
        <p className="page-subtitle mb-4">
          Save multiple business profiles and switch between them instantly. Switching auto-saves your current profile first.
        </p>
        {businessProfiles.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            No saved profiles yet. Fill in your business details above and click "Save as Profile".
          </p>
        ) : (
          <div className="template-list">
            {businessProfiles.map(bp => {
              const isActive = bp.businessName?.trim().toLowerCase() === profile.businessName?.trim().toLowerCase();
              return (
              <div key={bp.id} className="template-card" style={isActive ? { borderColor: 'var(--primary)', borderWidth: '2px' } : {}}>
                <div className="template-card-header">
                  <div>
                    <strong>{bp.businessName}</strong>
                    {isActive && <span style={{ fontSize: '0.68rem', background: 'var(--primary)', color: '#fff', borderRadius: '4px', padding: '0.1rem 0.4rem', marginLeft: '0.5rem' }}>Active</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {bp.state}{bp.gstin ? ` | ${bp.gstin}` : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => handleLoadProfile(bp)} disabled={isActive}>
                      {isActive ? 'Current' : 'Switch'}
                    </button>
                    <button className="icon-btn icon-btn-red" onClick={() => handleDeleteProfile(bp.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {bp.address && <p className="template-card-preview">{bp.address}</p>}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* ---- Data Management ---- */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="section-title">App Updates</h3>
        <p className="page-subtitle mb-4">Check if a newer version is available.</p>
        <div className="flex gap-4 items-center">
          <button type="button" className="btn btn-secondary" disabled={checkingUpdate} onClick={async () => {
            setCheckingUpdate(true);
            try {
              const res = await fetch('/api/check-update');
              const data = await res.json();
              setUpdateInfo(data);
              if (data.updateAvailable) {
                toast(`Update available: v${data.latest}`, 'info');
              } else if (data.error) {
                toast('Could not check for updates. Check internet connection.', 'warning');
              } else {
                toast('You are on the latest version!', 'success');
              }
            } catch {
              toast('Could not check for updates.', 'error');
            }
            setCheckingUpdate(false);
          }}>
            <RefreshCw size={18} className={checkingUpdate ? 'spin' : ''} /> {checkingUpdate ? 'Checking...' : 'Check for Updates'}
          </button>
          {updateInfo && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Current: v{updateInfo.current}{updateInfo.latest ? ` | Latest: v${updateInfo.latest}` : ''}
            </span>
          )}
        </div>
        {updateInfo?.updateAvailable && (
          <div className="update-available-box">
            <p><strong>New version v{updateInfo.latest} is available!</strong></p>
            <p>Your data will not be affected. Click below to update:</p>
            <a href="freegstbill-update://run" className="btn btn-primary" style={{ marginTop: '0.5rem', display: 'inline-flex', textDecoration: 'none' }}>
              <Download size={18} /> Update Now
            </a>
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="section-title">Data Management</h3>

        {/* Privacy notice — uses the global .notice .notice-info utility so dark/light look identical to every other info card. */}
        <div className="notice notice-info" style={{ marginBottom: '1rem' }}>
          <span className="notice-icon">🔒</span>
          <div>
            <strong>Your data is on this computer only.</strong> Nothing is uploaded to
            us, our servers, or any third party — not invoices, not clients, not
            settings. The only time anything leaves your machine is if you explicitly
            click <em>Save to Drive</em> below (uploads to <strong>your own</strong>
            Google Drive account).
            Files live under <code>data/</code> and <code>Saved Invoices/</code> next to the app.
          </div>
        </div>

        <p className="page-subtitle mb-6">
          Choose what to back up or restore — invoices, clients, products, settings, custom units, or just specific parts.
          Backup files are plain JSON you can keep on a USB drive, OneDrive, or your own Google Drive.
        </p>
        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowExportModal(true)}><Download size={18} /> Export Backup…</button>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18} /> Import Backup…</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportPick} style={{ display: 'none' }} />
        </div>
      </div>

      {/* ----------------------- Export modal ----------------------- */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => !drivePending && setShowExportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Export Backup</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Choose what to include. Everything is on by default — uncheck anything you don't want.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => exportToggleAll(true)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}>Select all</button>
              <button type="button" className="btn btn-secondary" onClick={() => exportToggleAll(false)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}>Clear all</button>
            </div>
            <div className="cbx-list">
              {ALL_BACKUP_PARTS.map(p => (
                <label key={p.id} className="cbx-row">
                  <input type="checkbox" checked={!!exportSel[p.id]} onChange={() => toggleExport(p.id)} />
                  <span>
                    <span className="cbx-label">{p.label}</span>
                    <span className="cbx-hint">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Optional: Google Drive copy. Uses global cbx-row utility — identical dark/light. */}
            <label className="cbx-row" style={{ marginTop: '0.5rem' }}>
              <input type="checkbox" checked={exportToDrive} onChange={e => setExportToDrive(e.target.checked)} />
              <span>
                <span className="cbx-label">Also save a copy to my Google Drive</span>
                <span className="cbx-hint">
                  Uploads to <em>{(profile.googleDriveFolder || 'GST Billing Invoices')} - Backups</em> in your Drive. Requires Google Client ID configured above. The file always downloads to your computer too.
                </span>
              </span>
            </label>

            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExportModal(false)} disabled={drivePending}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={runExport} disabled={drivePending || !Object.values(exportSel).some(Boolean)}>
                {drivePending ? 'Uploading…' : <><Download size={16} /> Download Backup</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------- Import modal ----------------------- */}
      {showImportModal && importInspection && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Restore from Backup</h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
              File contents preview
              {importInspection.exportedAt && <span> — exported {new Date(importInspection.exportedAt).toLocaleString()}</span>}
              {importInspection.version && <span> · v{importInspection.version}</span>}
            </div>
            <div style={{
              padding: '0.6rem 0.85rem', borderRadius: '6px',
              background: 'var(--warn-bg)', border: '1px solid var(--warn-border)',
              fontSize: '0.78rem', color: 'var(--warn-text)', marginBottom: '0.75rem',
            }}>
              ⚠ Restoring will <strong>overwrite matching records by ID</strong> in the categories you select. Records you didn't tick are untouched. We recommend exporting a fresh backup of your current data first.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => importToggleAll(true)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}>Select all (with data)</button>
              <button type="button" className="btn btn-secondary" onClick={() => importToggleAll(false)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}>Clear all</button>
            </div>
            <div className="cbx-list">
              {ALL_BACKUP_PARTS.map(p => {
                const count = importInspection.counts[p.id] || 0;
                return (
                  <label key={p.id} className={`cbx-row${count === 0 ? ' is-disabled' : ''}`}>
                    <input type="checkbox" checked={!!importSel[p.id]} disabled={count === 0} onChange={() => toggleImport(p.id)} />
                    <span style={{ flex: 1 }}>
                      <span className="cbx-label">{p.label}</span>
                      <span className="cbx-hint">{p.hint}</span>
                    </span>
                    <span className="cbx-meta" style={count > 0 ? { color: 'var(--success)', fontWeight: 600 } : undefined}>
                      {count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : 'empty'}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={runImport} disabled={!Object.values(importSel).some(Boolean)}>
                <Upload size={16} /> Restore selected
              </button>
            </div>
          </div>
        </div>
      )}
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

// ============================================================
// v1.9.5 — Backup Management + Trash Bin
// ============================================================
function BackupAndTrashPanel() {
  const [backups, setBackups] = useState([]);
  const [trash, setTrash] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [b, t] = await Promise.all([
        getBackupsList().catch(() => []),
        getTrashedBills().catch(() => []),
      ]);
      setBackups(b);
      setTrash(t);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleRestoreBackup = async (date) => {
    if (!await confirmAction({
      title: `Restore all data from backup ${date}?`,
      message: 'This OVERWRITES your current data. A snapshot of the current state will be taken first — if the restore looks wrong, you can roll back.',
      confirmLabel: 'Restore backup',
      tone: 'warning',
    })) return;
    try {
      await triggerBackup();
      await restoreBackup(date);
      toast('Backup restored — please reload the page to see the data', 'success');
    } catch (err) {
      toast('Restore failed: ' + err.message, 'error');
    }
  };

  const handleRestoreTrash = async (id) => {
    try {
      await restoreTrashedBill(id);
      toast('Invoice restored', 'success');
      loadAll();
    } catch (err) {
      toast('Restore failed: ' + err.message, 'error');
    }
  };

  const handlePurgeTrash = async (id) => {
    if (!await confirmAction({
      title: 'Permanently delete this invoice?',
      message: 'This bypasses the 30-day Trash grace period. The invoice and its PDF are gone for good.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    })) return;
    try {
      await purgeTrashedBill(id);
      toast('Invoice permanently deleted', 'info');
      loadAll();
    } catch (err) {
      toast('Purge failed: ' + err.message, 'error');
    }
  };

  // v1.10.22 — reported: "add here delete option i know u added 30 days
  // auto delete but manual delete also u add". Individual backup delete.
  const handleDeleteBackup = async (date) => {
    if (!await confirmAction({
      title: `Delete backup ${date}?`,
      message: 'Auto-backups still run daily, so future data will be safe. This just removes the archived snapshot.',
      confirmLabel: 'Delete backup',
      tone: 'danger',
    })) return;
    try {
      await deleteBackup(date);
      toast(`Backup ${date} deleted`, 'info');
      loadAll();
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="glass-panel p-6 mb-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
        <div>
          <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
            💾 Backup Management + 🗑 Trash Bin
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Automatic daily snapshots kept for 30 days · Deleted invoices soft-trash for 30 days (v1.9.5+).
          </p>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }}
          onClick={async () => {
            await triggerBackup();
            toast('Manual backup triggered', 'success');
            loadAll();
          }}>
          <SaveIcon size={14} /> Backup now
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {/* Backups list */}
        <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>📅 Daily backups ({backups.length})</h4>
          {loading && backups.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</p>}
          {!loading && backups.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No backups yet — the first will be created at midnight or click "Backup now" above.</p>}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {backups.map(b => (
              <div key={b.date} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.6rem', marginBottom: '0.25rem',
                background: 'var(--card)', borderRadius: 4, fontSize: '0.82rem',
              }}>
                <div>
                  <strong>{b.date}</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-IN') : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleRestoreBackup(b.date)}>
                    Restore
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => handleDeleteBackup(b.date)} title="Delete this backup">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trash bin */}
        <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>🗑 Trash bin ({trash.length})</h4>
          {loading && trash.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</p>}
          {!loading && trash.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No deleted invoices. Anything you delete lands here for 30 days.</p>}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {trash.map(bill => (
              <div key={bill.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.6rem', marginBottom: '0.25rem',
                background: 'var(--card)', borderRadius: 4, fontSize: '0.82rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{bill.invoiceNumber}</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bill.clientName} · deleted {bill._trashedAt ? new Date(bill._trashedAt).toLocaleDateString('en-IN') : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => handleRestoreTrash(bill.id)}>Restore</button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => handlePurgeTrash(bill.id)}>Delete forever</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
