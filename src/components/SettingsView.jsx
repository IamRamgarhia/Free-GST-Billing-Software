import { useState, useEffect, useRef } from 'react';
import { getProfile, saveProfile, exportAllData, importData, inspectBackup, getTermsTemplates, saveTermsTemplate, deleteTermsTemplate, getAllProfiles, saveBusinessProfile, deleteBusinessProfile, getRegionMode, setRegionMode, getStockAlertSettings, saveStockAlertSettings, renameNumberSeries, getInvoiceDisplayOptions, saveInvoiceDisplayOptions, getCostCentres, saveCostCentres } from '../store';
import { ensureToken, findOrCreateFolder, uploadJSON } from '../services/googleDrive';
import { getCountryConfig, getStatesForCountry, validateTaxId, getCountriesForRegion, isModuleEnabled, getPaymentAccounts, createEmptyAccount, maskAccountNumber, reorderAccounts, setDefaultAccount, isValidUpiId, findSameBusiness, businessKeyOf, localToday } from '../utils';
import { normaliseLutArn, isLikelyLutArn, lutFyOptions, fyOf } from '../utils/lut';
// v1.10.36 — lucide's `Image` icon was imported as `Image`, which
// SHADOWED the browser's `HTMLImageElement` constructor. Reported:
// "Uncaught TypeError: et is not a constructor at onChange" on logo
// upload — the minified `et` was our imported React component, and
// `new Image()` inside handleImageUpload was trying to construct a
// React icon. Aliased to `ImageIcon` so `new Image()` resolves to
// the browser primitive again.
import { Save, Upload, Download, Plus, Trash2, Edit3, Image as ImageIcon, PenTool, Cloud, CloudOff, Building2, Hash, RefreshCw, Save as SaveIcon } from 'lucide-react';
import { initGoogleDrive, isConnected, disconnect } from '../services/googleDrive';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import PrintSettings from './PrintSettings';
import HelpButton from './HelpButton';
import AppLockSettings from './AppLockSettings';
import PrivacyInternet from './PrivacyInternet';
import CostCentreSettings from './CostCentreSettings';
import { BusinessTypePanel, FeaturesPanel, useFeatureDraft } from './FeatureSettings';
import { rekeyCentres } from '../utils/costCentres';
import InvoiceNumberSettings from './InvoiceNumberSettings';
import SignatureImages, { SIGN_LAYOUTS } from './SignatureImages';
import { PURPOSE_CODES } from '../utils/purposeCodes';
import { getBackupsList, restoreBackup, triggerBackup, deleteBackup, getTrashedBills, restoreBillFromTrash, purgeTrashedBill, runUpdateNow, getBackupFolder, setBackupFolder } from '../store';

// v1.10.36 — Section order for the jump-nav pill bar. Keeping this at
// module scope so the scroll-spy effect below can reference it without
// re-computing on every render.
// v1.10.83 - "Business type comes first": it decides which features show.
// v1.10.84 (maintainer, 7 Nov: "so many options which can be merged in
// tabs") - 14 tabs became 6; each shows its sections one under the other.
// The names keep the words the guide and the app already use ("Settings ->
// Features", "Settings -> Data & Backups"). Old section ids (Ctrl+K search,
// the app window's "Check for updates", saved tabs) open their tab and scroll
// to the section.
const SETTINGS_TABS = [
  ['tab-company',  'Company',            ['section-biztype', 'section-company', 'section-profiles', 'section-terms']],
  ['tab-print',    'Print & PDF',        ['section-print', 'section-region']],
  ['tab-features', 'Features',           ['section-modules', 'section-costcentres', 'section-stock']],
  ['tab-privacy',  'Privacy & Security', ['section-lock', 'section-privacy']],
  ['tab-data',     'Data & Backups',     ['section-backups', 'section-cloud', 'section-data']],
  ['tab-updates',  'Updates',            ['section-updates']],
];
const ALL_SECTIONS = SETTINGS_TABS.flatMap(([, , sections]) => sections);
// A tab id or a section id -> its tab (the first tab for anything unknown).
const tabOf = (id) => (SETTINGS_TABS.find(([tab, , sections]) => tab === id || sections.includes(id)) || SETTINGS_TABS[0])[0];
const sectionsOf = (tab) => (SETTINGS_TABS.find(([t]) => t === tab) || SETTINGS_TABS[0])[2];
// v1.10.83 - the ? button opens the guide for the tab that is open.
// Each card inside a tab has its own ? next to its title too. The docs build
// (docs-site/build.mjs) checks that every one of these exists.
const SETTINGS_TAB_DOCS = {
  'section-biztype': 'settings#business-type',
  'section-company': 'settings#company-details', 'section-profiles': 'settings#business-profiles',
  'section-terms': 'settings#terms', 'section-print': 'print-settings', 'section-modules': 'settings#features',
  'section-stock': 'settings#stock', 'section-region': 'settings#region', 'section-lock': 'settings#lock', 'section-privacy': 'security#offline-mode',
  'section-backups': 'backup#automatic-backups', 'section-cloud': 'settings#google-drive', 'section-data': 'backup#export-import',
  'section-updates': 'settings#updates',
};

export default function SettingsView({ onSaved }) {
  const [profile, setProfile] = useState({
    businessName: '', address: '', state: '', gstin: '', pan: '',
    email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
    logo: '', logoHeight: 48, signature: '', signatureHeight: 60, stamp: '', stampHeight: 70, upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
  });
  // v1.10.83 - Settings is tabbed: each tab shows only its own page (asked
  // for: "instead of bigger setting pages it should load as tab pages").
  // Hidden tabs stay mounted, so an unsaved change on one tab is kept when
  // switching and the one Save bar still covers every tab. The open tab is
  // remembered for this browser session.
  const TAB_KEY = 'gst_settingsTab';
  // `activeSection` holds the open TAB's id; setActiveSection takes a tab or
  // a section id (a section: its tab opens and the page scrolls to it).
  const [activeSection, setActiveSectionState] = useState(() => {
    try { return tabOf(sessionStorage.getItem(TAB_KEY)); } catch { return SETTINGS_TABS[0][0]; }
  });
  const scrollToSection = (id) => {
    if (!ALL_SECTIONS.includes(id) || id === sectionsOf(tabOf(id))[0]) return;
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const setActiveSection = (id) => {
    const tab = tabOf(id);
    setActiveSectionState(tab);
    try { sessionStorage.setItem(TAB_KEY, tab); } catch { /* storage blocked */ }
    scrollToSection(id);
  };
  // Opened at a section from elsewhere (App's openSettingsAt): first open
  // through sessionStorage, already open through this event.
  useEffect(() => {
    try { scrollToSection(sessionStorage.getItem(TAB_KEY)); } catch { /* storage blocked */ }
    const onOpen = (e) => setActiveSection(e.detail);
    window.addEventListener('fgsb:settings-open', onOpen);
    return () => window.removeEventListener('fgsb:settings-open', onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v1.10.55 — reported (#43, @sangwanmail-eng): "Some time details not save
  // after update in setting tab", and the title said there was no save button
  // at all.
  //
  // There is one, but the Company form runs ~450 lines of UI and its only
  // Save button sits at the very bottom. Edit your GSTIN near the top, scroll
  // on to another section, and nothing on screen tells you the change is
  // still unsaved — leave the page and it is gone.
  //
  // It reads as "sometimes" because this page mixes three persistence models
  // with no visible difference between them: Features toggles save silently
  // on click, Region saves on click and shows a toast, while Company, Invoice
  // Numbers and Terms each need their own button. Some edits stick, some
  // vanish, and the UI gives the user no way to predict which.
  //
  // Fix: track whether the profile differs from what was last persisted and
  // surface a sticky bar while it does, so the save is reachable from
  // anywhere on the page and unsaved work is never silent.
  const savedProfileRef = useRef(null);
  const [profileDirty, setProfileDirty] = useState(false);
  // v1.10.75 - the Company form stays locked until the saved profile has
  // loaded. On a slow PC, anything typed before then was silently replaced
  // when the load finished (found by the release gate on a busy machine).
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Both the save bar and the "Jump to" bar stick to the top. They used to
  // share top: 0, so the save bar sat on top of the jump bar and hid it. The
  // jump bar now sticks just below the save bar, measured live because the
  // save bar wraps to two lines on narrow screens.
  // v1.10.83 - its height only set where a scrolled-to section stopped; tabs
  // open each page at the top, so that measurement went.
  const saveBarRef = useRef(null);

  // v1.10.56 — reported (#44, @sangwanmail-eng): "Firm profile setting not
  // saved. every time show popup".
  //
  // The profile was in fact saving fine. The v1.10.55 unsaved-changes
  // tracker was wrong: it recorded the on-disk baseline in handleSave only,
  // but the profile is persisted from THREE places —
  //   1. handleSave              (the Save Profile button)
  //   2. updateAccounts          (payment accounts auto-persist, v1.10.16)
  //   3. handleLoadProfile       (switching business profile)
  // After 2 or 3, the data was on disk but the baseline still held the older
  // copy, so the bar insisted there were unsaved changes forever — and the
  // beforeunload guard then threw a browser confirm dialog on every close.
  // That popup is what the user was seeing.
  //
  // Fix: one helper, called from every path that persists, so the baseline
  // can never drift from what is actually stored.
  const markProfileSaved = (p) => {
    savedProfileRef.current = JSON.stringify(p);
    setActiveBusiness(p);
    setProfileDirty(false);
  };

  // Recompute against the persisted baseline whenever the form changes.
  // Compared by value, not by "did an onChange fire", so typing a character
  // and deleting it again correctly leaves you clean.
  useEffect(() => {
    if (savedProfileRef.current === null) return; // profile not loaded yet
    setProfileDirty(JSON.stringify(profile) !== savedProfileRef.current);
  }, [profile]);

  // v1.10.56 — the beforeunload confirm added in v1.10.55 is GONE.
  // Even with the baseline bug fixed it was the wrong tool: it hijacks the
  // browser's own close dialog for a form the user may have no intention of
  // saving, and any future drift in the dirty check turns straight into a
  // popup on every exit. The sticky bar already makes unsaved work visible
  // without interrupting anyone.
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  // v1.10.79 - Invoice Number Format is its own component (InvoiceNumberSettings);
  // the page's "Save all" bar talks to it through this ref and two flags.
  const invNumRef = useRef(null);
  const [invNumDirty, setInvNumDirty] = useState(false);
  const [invNumSaving, setInvNumSaving] = useState(false);
  // The business this page belongs to (as saved), for its own numbering (#95).
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // v1.10.69 - see runUpdateNow() in store.js: this used to be a link to a URL
  // protocol that no current install registers, so it did nothing at all.
  const [updatingNow, setUpdatingNow] = useState(false);
  const handleSettingsUpdateNow = async () => {
    setUpdatingNow(true);
    toast('Updating… your data is backed up first. This takes about a minute.', 'info', 8000);
    const result = await runUpdateNow();
    setUpdatingNow(false);
    toast(result.ok ? 'Update finished. Reload the page to use the new version.' : `Update failed — ${result.error}`,
      result.ok ? 'success' : 'error', 10000);
  };
  const [regionMode, setRegionModeState] = useState(getRegionMode());
  // v1.10.83 - Business type + Features: a draft, applied by "Save all changes".
  const features = useFeatureDraft();
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  const [stockAlertsSaving, setStockAlertsSaving] = useState(false);
  // v1.10.75 - what is on disk for the forms that have their own Save, so
  // the bottom "Save all changes" bar knows what is still unsaved.
  const [stockSaved, setStockSaved] = useState(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const sigInputRef = useRef(null);
  const stampInputRef = useRef(null);
  const companyFormRef = useRef(null);
  const visibleCountries = getCountriesForRegion(regionMode);

  const handleRegionChange = (mode) => {
    setRegionModeState(mode);
    setRegionMode(mode);
    toast(`Region preference: ${mode === 'india' ? 'India only' : mode === 'international' ? 'International only' : 'Both'}`, 'success');
  };

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      // Baseline for the unsaved-changes check — what is currently on disk.
      savedProfileRef.current = JSON.stringify(p);
      setActiveBusiness(p);
    }).catch(() => {}).finally(() => setProfileLoaded(true));
    loadTemplates();
    loadBusinessProfiles();
    setDriveConnected(isConnected());
    getStockAlertSettings().then((v) => { setStockAlerts(v); setStockSaved(JSON.stringify(v)); }).catch(() => {});
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
      // v1.10.56 (#44) — refresh the baseline on success, or the bar would
      // keep claiming unsaved changes for something already on disk.
      saveProfile(next)
        .then(() => markProfileSaved(next))
        .catch(() => { /* non-fatal — user can retry via Save */ });
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
      message: 'Existing invoices that used this account keep their bank details as they were saved, so their PDFs stay exactly as printed.',
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
    // v1.10.36 — Reset the input so re-selecting the SAME file re-fires
    // onChange. Without this, if a user's upload silently failed once
    // (browser can't decode HEIC etc.) they had to pick a DIFFERENT file
    // to try again; picking the same file was a no-op.
    try { e.target.value = ''; } catch { /* ignore */ }
    if (!file) return;

    // v1.10.36 — Reported "not able to set logo it show nothing".
    // Previous strict MIME whitelist (png/jpeg/webp/svg) silently
    // rejected HEIC/HEIF (iPhone default), GIF, BMP, TIFF with a
    // one-line toast users often missed. Now: accept anything the
    // browser can decode. The <img>.onerror fallback catches truly
    // undecodable files with a clearer message. Non-image files are
    // still caught by the .type prefix guard.
    if (!file.type.startsWith('image/') && file.type !== '') {
      toast(`This doesn't look like an image (type: ${file.type || 'unknown'}). Try a PNG or JPEG.`, 'warning', 6000);
      return;
    }
    // Size ceiling relaxed to 5MB (server body limit) so a phone photo
    // doesn't hit the arbitrary 2MB gate before downscaling gets to run.
    if (file.size > 5 * 1024 * 1024) {
      toast(`Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — over the 5MB cap. Try compressing at tinypng.com.`, 'warning', 6000);
      return;
    }

    // SVGs are vector — embed as-is (no canvas needed).
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProfile(prev => ({ ...prev, [field]: ev.target.result }));
        toast(`${({ logo: 'Logo', signature: 'Signature', stamp: 'Stamp' })[field] || 'Image'} uploaded — click Save Profile to keep it.`, 'success', 4000);
      };
      reader.onerror = () => toast('Could not read the SVG file.', 'error');
      reader.readAsDataURL(file);
      return;
    }

    // Raster: load into an Image, downscale to max 1024px on the longer edge
    // v1.10.36 — Explicit `window.Image` so a future import (e.g. lucide's
    // `Image` icon) can't shadow the browser primitive again.
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (!width || !height) {
        toast(`Image has zero dimensions — cannot use as logo.`, 'error');
        return;
      }
      if (width > MAX || height > MAX) {
        const ratio = MAX / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Fill white for JPEG so transparent PNGs don't come out with black
      // backgrounds on printers that can't render alpha.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      // Keep PNG for images that had alpha (so signature on transparent
      // stays transparent when placed on invoice), JPEG otherwise.
      const preservesAlpha = /png|webp|svg/i.test(file.type) && field !== 'logo';
      const dataUrl = canvas.toDataURL(preservesAlpha ? 'image/png' : 'image/jpeg', 0.92);
      setProfile(prev => ({ ...prev, [field]: dataUrl }));
      toast(`${({ logo: 'Logo', signature: 'Signature', stamp: 'Stamp' })[field] || 'Image'} uploaded — click Save Profile to keep it.`, 'success', 4000);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // v1.10.36 — better error message. Common cause of the silent
      // "logo not showing" report on iOS: user uploads a HEIC file from
      // Photos, Chrome/desktop Safari can't decode it, we ended up here
      // with a generic error. Now the toast names likely fixes.
      toast(`Could not decode this image (type: ${file.type || 'unknown'}). If it's a HEIC from iPhone, share it as JPEG — in Photos: Share → Copy Photo → Files → paste, or set Camera Format = "Most Compatible".`, 'error', 10000);
    };
    img.src = url;
  };

  const removeImage = (field) => setProfile(prev => ({ ...prev, [field]: '' }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await saveProfile(profile);
      // v1.10.79 (#95) - saved under a new GSTIN or name: its own numbering follows.
      const oldKey = businessKeyOf(activeBusiness);
      const newKey = businessKeyOf(profile);
      if (oldKey && newKey && oldKey !== newKey) await renameNumberSeries(oldKey, newKey).catch(() => {});
      // v1.10.83 (#112) - and its cost centres.
      if (oldKey && newKey && oldKey !== newKey) {
        await getCostCentres()
          .then((list) => list.some((c) => c.business === oldKey) && saveCostCentres(rekeyCentres(list, oldKey, newKey)))
          .catch(() => {});
      }
      // v1.10.16 — reported: "uploaded logo and saved but it's not showing on
      // invoice". Root cause was a stale `freegstbill_invoiceOptions.showLogo`
      // in localStorage from before the upload — DEFAULT_OPTIONS has it true,
      // but a false persisted from an earlier state kept it hidden even after
      // the upload. Now: whenever the user saves a profile that has a logo,
      // we force `showLogo: true` in the persisted invoice options. Same for
      // signature. Users who consciously want to hide the logo can still
      // uncheck it in the Customize panel — this fix only rescues the
      // silent-fail case.
      //
      // v1.10.36 — Reported again: "not able to set logo it show nothing
      // after saving". Root cause of the recurrence: v1.10.16 only wrote
      // to localStorage, but InvoiceGenerator fetches display options
      // from the SERVER on mount (see line ~631) and merges those over
      // the localStorage value. So a stale server-side `showLogo:false`
      // kept overriding the local override. Fix: PUSH the updated
      // display options to the server too — one API call keeps both
      // stores in sync. Non-blocking (.catch()) so a slow server
      // doesn't delay the "Profile saved" toast.
      if (profile.logo || profile.signature) {
        try {
          const raw = localStorage.getItem('freegstbill_invoiceOptions');
          const opts = raw ? JSON.parse(raw) : {};
          if (profile.logo) opts.showLogo = true;
          if (profile.signature) opts.showSignature = true;
          localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(opts));
          // Also sync to server so InvoiceGenerator's mount-load doesn't
          // overwrite our fix with a stale server-side value.
          try {
            const serverOpts = await getInvoiceDisplayOptions().catch(() => null);
            const merged = { ...(serverOpts || {}), ...opts };
            saveInvoiceDisplayOptions(merged).catch(() => { /* non-blocking */ });
          } catch { /* server unreachable — localStorage still updated */ }
        } catch { /* localStorage full or blocked — skip */ }
      }
      if (onSaved) onSaved(profile);
      // v1.10.55 (#43) — mark this state as the persisted baseline so the
      // unsaved-changes bar disappears.
      markProfileSaved(profile);
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

  // Export / Import (granular)
  const ALL_BACKUP_PARTS = [
    { id: 'profile',        label: 'Active business profile',  hint: 'Name, address, GSTIN, bank, logo, signature' },
    { id: 'profiles',       label: 'All business profiles',    hint: 'Multi-business switcher entries' },
    { id: 'bills',          label: 'Invoices / bills',         hint: 'Tax invoices, proforma, credit notes, etc.' },
    { id: 'clients',        label: 'Clients',                  hint: 'Saved client directory' },
    { id: 'products',       label: 'Products / Inventory',     hint: 'Product catalog with HSN, rate, stock' },
    { id: 'expenses',       label: 'Expenses',                 hint: 'Expense tracker entries and the cash book' },
    { id: 'purchases',      label: 'Purchase bills',           hint: 'Vendor bills used for ITC, and purchase orders' },
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
  // v1.10.74 - "Select all (with data)" ticks only categories that have data in the file
  const importToggleAll = (val) => setImportSel(Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, val && (importInspection?.counts?.[p.id] || 0) > 0])));

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
      // v1.10.74 - list every restored category, not just five of them
      const parts = [];
      if (result.billCount) parts.push(`${result.billCount} invoice(s)`);
      if (result.hasProfile) parts.push('profile');
      if (result.profileCount) parts.push(`${result.profileCount} business profile(s)`);
      if (result.templateCount) parts.push(`${result.templateCount} template(s)`);
      if (result.clientCount) parts.push(`${result.clientCount} client(s)`);
      if (result.productCount) parts.push(`${result.productCount} product(s)`);
      if (result.expenseCount) parts.push(`${result.expenseCount} expense(s)`);
      if (result.purchaseCount) parts.push(`${result.purchaseCount} purchase bill(s)`);
      if (result.recurringCount) parts.push(`${result.recurringCount} recurring invoice(s)`);
      if (result.receiptCount) parts.push(`${result.receiptCount} receipt(s)`);
      const lsCount = importSel.localStorage ? (importInspection?.counts?.localStorage || 0) : 0;
      if (lsCount) parts.push(`${lsCount} local preference(s)`);
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

  const saveStockAlerts = async () => {
    setStockAlertsSaving(true);
    try {
      await saveStockAlertSettings(stockAlerts);
      setStockSaved(JSON.stringify(stockAlerts));
      toast('Low-stock alert settings saved', 'success');
    } catch { toast('Failed to save', 'error'); }
    setStockAlertsSaving(false);
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
  // The saved profile the form was last loaded from (see findSameBusiness).
  const loadedProfileId = useRef(null);
  const sameSavedBusiness = () => findSameBusiness(businessProfiles, profile,
    businessProfiles.find((bp) => bp.id === loadedProfileId.current));

  const handleSaveAsProfile = async () => {
    if (!profile.businessName.trim()) { toast('Business name required', 'warning'); return; }
    // Update the saved profile of this same business, or create a new one
    const existing = sameSavedBusiness();
    await saveBusinessProfile({ ...profile, id: existing?.id || undefined });
    toast(existing ? 'Profile updated!' : 'Profile saved!', 'success');
    loadBusinessProfiles();
  };

  const handleLoadProfile = async (bp) => {
    // Auto-save current profile before switching (so it's not lost)
    if (profile.businessName?.trim()) {
      const existing = sameSavedBusiness();
      await saveBusinessProfile({ ...profile, id: existing?.id || undefined });
    }
    loadedProfileId.current = bp.id;
    const loaded = { ...bp };
    delete loaded.id;
    setProfile(loaded);
    await saveProfile(loaded);
    // v1.10.56 (#44) — switching profiles persists immediately, so this IS
    // the saved state now.
    markProfileSaved(loaded);
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

  // v1.10.67 (#66 item 3, @sangwanmail-eng) — park the company that is on
  // screen into Business Profiles BEFORE clearing the form. This used to just
  // blank the fields, so the next Save wrote the new company over the old one
  // - and on a fresh install the old one had never been saved as a profile,
  // which meant it was gone for good. Clearing also resets the unsaved-changes
  // baseline, so an empty form no longer claims you have unsaved work.
  const handleAddNewProfile = async () => {
    const current = profile.businessName?.trim();
    if (current) {
      const existing = sameSavedBusiness();
      try {
        await saveBusinessProfile({ ...profile, id: existing?.id || undefined });
        loadedProfileId.current = null; // the form is about to be a new company
        await loadBusinessProfiles();
      } catch {
        toast('Could not save the current company, so nothing was cleared. Try Save Profile first.', 'error');
        return;
      }
    }
    // #66 item 2 — a second company is almost always in the same country as
    // the first, and this is an India-first app; the browser locale guessed
    // United States on an Indian shop and started them on a US form.
    const blank = {
      businessName: '', address: '', city: '', state: '', pin: '', country: profile.country || 'India',
      gstin: '', pan: '', email: '', phone: '', bankName: '', accountNumber: '', ifsc: '', swift: '',
      logo: '', logoHeight: 48, signature: '', signatureHeight: 60, stamp: '', stampHeight: 70, upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
    };
    setProfile(blank);
    markProfileSaved(blank);
    setTaxIdWarning('');
    toast(current ? `${current} is safe under the Profiles tab - fill in the new company and press Save Profile` : 'Fill in the new company, then press Save Profile', 'info', 6000);
    setActiveSection('section-company');
    setTimeout(() => companyFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // v1.10.75 - one Save for the whole page (asked for: "a global save button
  // at the bottom, sticky, that saves all data filled anywhere"). Bank
  // accounts, Region and Print & PDF already save as they change; these wait
  // for a Save. v1.10.83 - Business type and Features joined them (asked for:
  // "just checkbox and save button to apply").
  const unsaved = [
    profileDirty && 'Company Details',
    invNumDirty && 'Invoice Number Format',
    stockSaved !== null && JSON.stringify(stockAlerts) !== stockSaved && 'Low-stock alerts',
    !!editingTemplate && 'Terms template',
    ...features.unsaved,
  ].filter(Boolean);
  const saveAll = async () => {
    if (!unsaved.length) { toast('Everything is already saved', 'info'); return; }
    // The Company form goes through its own submit, so its checks still run.
    if (profileDirty) companyFormRef.current?.requestSubmit();
    const jobs = [];
    if (unsaved.includes('Invoice Number Format')) jobs.push(invNumRef.current?.save());
    if (unsaved.includes('Low-stock alerts')) jobs.push(saveStockAlerts());
    if (editingTemplate) jobs.push(handleSaveTemplate());
    if (features.unsaved.length) features.save();
    await Promise.all(jobs);
  };
  const discardAll = () => {
    if (profileDirty && savedProfileRef.current) setProfile(JSON.parse(savedProfileRef.current));
    invNumRef.current?.discard();
    if (stockSaved !== null) setStockAlerts(JSON.parse(stockSaved));
    setEditingTemplate(null);
    features.discard();
  };

  const [taxIdWarning, setTaxIdWarning] = useState('');
  const handleTaxIdBlur = () => {
    const result = validateTaxId(profile.country, profile.gstin);
    setTaxIdWarning(result.ok ? '' : result.message);
  };


  return (
    <div className="settings-container">
      {/* v1.10.36 — Header lifted with a soft primary-accent gradient
           card, gear glyph in a rounded badge for visual identity, and
           a subtle count chip showing how many sections there are so
           the user has a scale expectation before diving in. */}
      <div className="page-header" style={{
        padding: '1.1rem 1.35rem',
        background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.12), var(--card-bg))',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-darker))',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.15rem',
            boxShadow: '0 6px 18px rgba(var(--primary-rgb), 0.35)',
          }}>⚙</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Settings <HelpButton title="Settings" doc={SETTINGS_TAB_DOCS[sectionsOf(activeSection)[0]] || 'settings'} size={16} /></h1>
            <p className="page-subtitle" style={{ margin: '0.15rem 0 0' }}>
              Business profile, branding, integrations & data
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginLeft: '0.55rem', fontWeight: 600 }}>
                {SETTINGS_TABS.length} tabs
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* v1.10.75 - the section buttons, pinned at the top. They wrap onto a
           second line rather than scroll sideways (asked for: "top should not
           be scrollable"). Saving moved to one bar at the bottom of the page,
           below. It used to be two stacked sticky bars (~140px), one of them a
           white strip in dark mode from an undefined --card-bg-rgb.
           History: v1.10.36/37 scroll-spy pills; v1.10.55 (#43) unsaved
           Company edits made visible; v1.10.67 (#66 item 9) one Save always
           on screen. */}
      <div ref={saveBarRef} className="settings-bar" style={{
          position: 'sticky',
          zIndex: 30,
          padding: '0.45rem 0.55rem',
          marginBottom: '1.25rem',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', // solid: content must not show through
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        }}>
        <style>{ALL_SECTIONS
          .filter((id) => !sectionsOf(activeSection).includes(id))
          .map((id) => `#${id}`).join(', ') + ' { display: none !important; }'}</style>
        <nav className="settings-jumpnav" aria-label="Settings sections" style={{
          display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          {SETTINGS_TABS.map(([id, label]) => {
            const active = activeSection === id;
            return (
              <a key={id} href={`#${id}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(id);
                  window.scrollTo({ top: 0 });
                }}
                style={{
                  fontSize: '0.76rem',
                  fontWeight: active ? 700 : 600,
                  padding: '0.38rem 0.8rem',
                  borderRadius: 999,
                  background: active
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-darker))'
                    : 'var(--bg-secondary)',
                  color: active ? '#fff' : 'var(--text)',
                  textDecoration: 'none',
                  border: active ? '1px solid transparent' : '1px solid var(--border)',
                  transition: 'all 0.18s ease',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 4px 12px rgba(var(--primary-rgb), 0.4)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--primary-light, rgba(30,64,175,0.08))';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}>
                {label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* v1.10.37 — Flex-column wrapper for visual reordering. Each
           section keeps its DOM position (safe for the anchor IDs +
           scroll-spy IntersectionObserver + tab order for the primary
           actions) but the CSS `order:` on each section root controls
           the on-screen sequence. Reported: "if you click on first
           Company it goes down then if you click on Profiles comes up
           — should be sorted in a way the pages". Now the on-screen
           order matches the jump-nav pill order exactly.
           Target: Company → Profiles → Terms → Print & PDF → Features
           → Stock → Region → Backups → Google Drive → Import/Export
           → Updates. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ---- Stock Alerts ---- */}
      {/* v1.10.36 — Redesign: prior layout had an awkward grid with the
           threshold input crammed next to inline "Common picks: 0, 3,
           5, 10" text — hard to scan, hard to click. Now: master toggle
           + one big Threshold row with clickable preset chips ABOVE the
           input so users can pick a common value in one click, then a
           number field for fine-tuning. Save button gets a subtle live
           status text next to it. */}
      <div id="section-stock" className="glass-panel p-6 mb-6" style={{ order: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '0.9rem' }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0,
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.15rem',
          }}>🔔</div>
          <div>
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>Low-stock alerts <HelpButton title="Low-stock alerts" doc="settings#stock" size={16} style={{ marginLeft: 6 }} /></h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Powers the 🔔 sidebar badge and the Dashboard low-stock list. The Inventory page colour-codes products against this threshold too.
            </p>
          </div>
        </div>

        {/* Master toggle row */}
        <div style={{
          padding: '0.75rem 0.9rem',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          marginBottom: stockAlerts.enabled ? '0.85rem' : 0,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
            <input type="checkbox" checked={!!stockAlerts.enabled}
              onChange={e => setStockAlerts(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
            Show low-stock alerts
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1, minWidth: 200 }}>
            {stockAlerts.enabled
              ? 'Notifications fire when a product\'s stock falls to or below the threshold.'
              : 'Alerts are silenced. Inventory still tracks stock; it just doesn\'t nag you.'}
          </span>
        </div>

        {/* Threshold — chip presets + fine-tune input, only shown when enabled */}
        {stockAlerts.enabled && (
          <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Threshold</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Alert when stock ≤ <strong style={{ color: 'var(--text)' }}>{stockAlerts.threshold}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { val: 0, label: '0', hint: 'Only when fully out' },
                { val: 3, label: '3', hint: 'Very tight' },
                { val: 5, label: '5', hint: 'Recommended' },
                { val: 10, label: '10', hint: 'Loose' },
              ].map(p => {
                const active = stockAlerts.threshold === p.val;
                return (
                  <button key={p.val} type="button"
                    onClick={() => setStockAlerts(prev => ({ ...prev, threshold: p.val }))}
                    title={p.hint}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: 999,
                      background: active
                        ? 'linear-gradient(135deg, var(--primary), var(--primary-darker))'
                        : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text)',
                      border: active ? '1px solid transparent' : '1px solid var(--border)',
                      fontSize: '0.85rem', fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      minWidth: 44,
                      boxShadow: active ? '0 4px 10px rgba(var(--primary-rgb), 0.35)' : 'none',
                    }}>
                    {p.label}
                    <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 500, opacity: 0.85, marginTop: 1 }}>{p.hint}</span>
                  </button>
                );
              })}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>or</span>
              <input type="number" min="0" max="9999" step="1"
                className="form-input" style={{ width: 90 }}
                value={stockAlerts.threshold}
                onChange={e => setStockAlerts(prev => ({ ...prev, threshold: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Changes take effect after saving
          </span>
          <button type="button" className="btn btn-primary"
            disabled={stockAlertsSaving}
            onClick={saveStockAlerts}>
            <Save size={16} /> {stockAlertsSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ---- Thermal Printer Settings ---- */}
      <div id="section-print" style={{ order: 4 }}><PrintSettings /></div>

      {/* v1.9.5 — Backup Management + Trash Bin */}
      <div id="section-backups" style={{ order: 8 }}><BackupAndTrashPanel /></div>

      {/* v1.10.83 - Business type (first tab) and Features: FeatureSettings.jsx. */}
      <BusinessTypePanel features={features} />
      <FeaturesPanel features={features} regionMode={regionMode} />

      {/* v1.10.83 (#112) - only while the feature is on, right under Features. */}
      {isModuleEnabled('costCentres', features.saved.modules) && (
        <div id="section-costcentres" style={{ order: 5 }}><CostCentreSettings profile={activeBusiness} /></div>
      )}

      {/* ---- Region Preference ---- */}
      <div id="section-region" className="glass-panel p-6 mb-6" style={{ order: 7 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Region Preference <HelpButton title="Region Preference" doc="settings#region" size={16} style={{ marginLeft: 6 }} /></h3>
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

      {/* v1.10.77 (#84) - optional PIN lock. Same order as Region, so it sits right after it. */}
      <div id="section-lock" className="glass-panel p-6 mb-6" style={{ order: 7 }}>
        <AppLockSettings />
      </div>
      <div id="section-privacy" className="glass-panel p-6 mb-6" style={{ order: 7 }}>
        <PrivacyInternet />
      </div>

      {/* ---- Business Profile ---- */}
      <form id="section-company" onSubmit={handleSave} className="glass-panel p-6 mb-6" ref={companyFormRef} style={{ order: 1 }}>
        <fieldset disabled={!profileLoaded} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <h3 className="section-title">Company Details <HelpButton title="Company Details" doc="settings#company-details" size={16} style={{ marginLeft: 6 }} /></h3>
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
              {/* v1.10.43 — GST-specific fields: AATO band + turnover
                  numbers. Drive the GSTR-1 export's HSN digit-length
                  gate (the gt/cur_gt turnover boxes were removed in v1.10.83;
                  the portal no longer wants them). India-only. */}
              {(profile.country || 'India') === 'India' && (
                <div className="form-group full-width" style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ marginBottom: 6 }}>GSTR filing details (used only for GSTR-1 / GSTR-3B JSON export) <HelpButton title="GSTR filing details" doc="settings#gstr-details" size={16} style={{ marginLeft: 6 }} /></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 8 }}>
                    <input type="checkbox" id="aato-above-5cr" name="aatoAbove5Cr"
                      checked={!!profile.aatoAbove5Cr}
                      onChange={(e) => setProfile(p => ({ ...p, aatoAbove5Cr: e.target.checked }))} />
                    <label htmlFor="aato-above-5cr" style={{ fontSize: '0.82rem', margin: 0 }}>
                      Aggregate turnover (AATO) is <strong>above ₹5 crore</strong>
                    </label>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                    Drives HSN reporting rule — <strong>{profile.aatoAbove5Cr ? '6-digit HSN' : '4-digit HSN'}</strong> minimum on every item. Since Jan 2025 the portal blocks GSTR-1 if any HSN falls short.
                  </p>
                  {/* v1.10.83 (#133) - the turnover boxes (JSON gt / cur_gt) are
                      gone: those fields were only for 2017-18 returns. */}
                </div>
              )}
              {/* v1.10.83 - LUT for exports / SEZ supplies (form GST RFD-11),
                  one per financial year, per business. */}
              {(profile.country || 'India') === 'India' && (
                <div id="lut" className="form-group full-width" style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ marginBottom: 6 }}>LUT for exports and SEZ supplies <HelpButton title="LUT for exports" doc="settings#lut" size={16} style={{ marginLeft: 6 }} /></label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                    With a Letter of Undertaking (filed free on the GST portal, Form GST RFD-11, once per financial year) you bill exports and SEZ supplies without IGST. Invoices dated in the year below tick “under LUT” by themselves and print its ARN.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
                    <div>
                      <label className="form-label" htmlFor="lut-arn" style={{ fontSize: '0.72rem' }}>LUT ARN (acknowledgement number)</label>
                      <input id="lut-arn" type="text" name="lutArn" className="form-input" maxLength={20}
                        value={profile.lutArn || ''}
                        onChange={(e) => setProfile(p => ({ ...p, lutArn: normaliseLutArn(e.target.value) }))}
                        placeholder="e.g. AD290426123456X" style={profile.lutArn && !isLikelyLutArn(profile.lutArn) ? { borderColor: '#f59e0b' } : undefined} />
                      {profile.lutArn && !isLikelyLutArn(profile.lutArn) && (
                        <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ An ARN is usually 15 letters and digits, starting with AD. Check it against the portal's acknowledgement.</small>
                      )}
                    </div>
                    <div>
                      <label className="form-label" htmlFor="lut-fy" style={{ fontSize: '0.72rem' }}>Financial year it covers</label>
                      <select id="lut-fy" name="lutFy" className="form-input" value={profile.lutFy || ''} onChange={handleChange}>
                        <option value="">Choose the year</option>
                        {[...new Set([...lutFyOptions(), profile.lutFy].filter(Boolean))].map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="lut-date" style={{ fontSize: '0.72rem' }}>Date filed (optional)</label>
                      <input id="lut-date" type="date" name="lutDate" className="form-input" value={profile.lutDate || ''} onChange={handleChange} />
                    </div>
                  </div>
                  {profile.lutArn && profile.lutFy && profile.lutFy !== fyOf(localToday()) && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--warn-text)', margin: '0.5rem 0 0' }}>
                      This LUT is for FY {profile.lutFy}; today is in FY {fyOf(localToday())}. File a fresh LUT for the current year before your next export.
                    </p>
                  )}
                </div>
              )}
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
                  <h3 className="section-title" style={{ margin: 0 }}>Payment Accounts <HelpButton title="Payment Accounts" doc="settings#payment-accounts" size={16} style={{ marginLeft: 6 }} /></h3>
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
                          {a.iban && <span> · IBAN {a.iban}</span>}
                          {a.purposeCode && <span> · Purpose code {a.purposeCode}</span>}
                          {a.paymentLink && <span> · 🔗 {a.paymentLink}</span>}
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
                    <h3 className="section-title" style={{ marginTop: 0 }}>{getPaymentAccounts(profile).some(a => a.id === editingAccount.id) ? 'Edit account' : 'Add account'} <HelpButton title="Add or edit a payment account" doc="settings#add-account" size={16} style={{ marginLeft: 6 }} /></h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Label (shown in the dropdown)</label>
                        <input type="text" className="form-input" value={editingAccount.label}
                          onChange={e => setEditingAccount(a => ({ ...a, label: e.target.value }))}
                          placeholder="e.g. HDFC Current — 1234" />
                      </div>
                      {/* v1.10.37 — Account Holder Name + Account Type
                          added. Reported: clients get "beneficiary name
                          mismatch" errors on NEFT/RTGS when the account
                          name differs from the trading name (common for
                          proprietorships, HUFs, abbreviated Pvt Ltd
                          names). Both fields are optional and print on
                          the invoice PDF when filled. */}
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Account Holder Name <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>(name printed on the cheque / registered with the bank)</span></label>
                        <input type="text" className="form-input" value={editingAccount.accountHolderName || ''}
                          onChange={e => setEditingAccount(a => ({ ...a, accountHolderName: e.target.value }))}
                          placeholder={`Leave blank to use "${profile.businessName || 'Business Name'}"`} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bank Name</label>
                        <input type="text" className="form-input" value={editingAccount.bankName}
                          onChange={e => setEditingAccount(a => ({ ...a, bankName: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Account Type <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>(optional)</span></label>
                        <select className="form-input" value={editingAccount.accountType || ''}
                          onChange={e => setEditingAccount(a => ({ ...a, accountType: e.target.value }))}>
                          <option value="">— Not specified —</option>
                          <option value="savings">Savings Account</option>
                          <option value="current">Current Account</option>
                          <option value="cc">Cash Credit (CC)</option>
                          <option value="od">Overdraft (OD)</option>
                          <option value="nre">NRE Account</option>
                          <option value="nro">NRO Account</option>
                        </select>
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
                      {/* v1.10.83 - getting paid from abroad. */}
                      <div className="form-group">
                        <label className="form-label">IBAN (optional) <HelpButton title="Getting paid from abroad" doc="settings#paid-from-abroad" size={14} /></label>
                        <input type="text" className="form-input" value={editingAccount.iban || ''}
                          onChange={e => setEditingAccount(a => ({ ...a, iban: e.target.value.toUpperCase() }))}
                          placeholder="Only if a foreign bank gave you one" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Purpose code for payments from abroad (optional) <HelpButton title="Purpose codes" doc="settings#paid-from-abroad" size={14} /></label>
                        <input type="text" className="form-input" list="purpose-codes" value={editingAccount.purposeCode || ''}
                          onChange={e => setEditingAccount(a => ({ ...a, purposeCode: e.target.value.toUpperCase().trim() }))}
                          placeholder="e.g. P0802 for software work" />
                        <datalist id="purpose-codes">
                          {PURPOSE_CODES.map(p => <option key={p.code} value={p.code}>{`${p.code} - ${p.label}`}</option>)}
                        </datalist>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>The RBI code for what you are paid for. Printed with these bank details on invoices to clients abroad, so they can quote it on the transfer. Your bank can confirm it.</small>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Online payment link (optional)</label>
                        <input type="text" className="form-input" value={editingAccount.paymentLink || ''}
                          onChange={e => setEditingAccount(a => ({ ...a, paymentLink: e.target.value }))}
                          placeholder="PayPal, Wise or Payoneer link" />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Printed on invoices in a foreign currency.</small>
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

        {/* Invoice Number Format (per business since v1.10.79, #95) */}
        <InvoiceNumberSettings ref={invNumRef}
          businessKey={businessKeyOf(activeBusiness)} businessName={activeBusiness?.businessName}
          showScope={businessProfiles.length > 1}
          businesses={businessProfiles.map((bp) => ({ key: businessKeyOf(bp), name: bp.businessName || bp.gstin || 'Unnamed business' }))}
          onDirtyChange={setInvNumDirty} onSavingChange={setInvNumSaving} />

        {/* Logo & Signature */}
        <h3 className="section-title mt-8">Branding <HelpButton title="Branding: logo, signature and stamp" doc="settings#branding" size={16} style={{ marginLeft: 6 }} /></h3>
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
                  <ImageIcon size={20} /><span>Upload Logo</span><span className="upload-hint">PNG or JPG, square or wide (up to 5 MB)</span>
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload('logo', e)} />
            </div>
            {/* v1.10.83 - the business's own name and logo at the top of the menu. */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.6rem' }}>
              <input type="checkbox" checked={!!profile.showInMenu}
                onChange={(e) => setProfile(prev => ({ ...prev, showInMenu: e.target.checked }))}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--primary)' }} />
              <span>Show my business name and logo in the app&apos;s menu (top left)</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Signature</label>
            <div className="upload-area">
              {profile.signature ? (
                <div className="logo-upload-section">
                  <div className="logo-preview-box">
                    <img src={profile.signature} alt="Signature" style={{ height: `${profile.signatureHeight || 60}px`, maxWidth: '180px', objectFit: 'contain', display: 'block' }} />
                    <button type="button" className="icon-btn icon-btn-red upload-remove" onClick={() => removeImage('signature')}><Trash2 size={14} /></button>
                  </div>
                  <div className="logo-size-control">
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Signature Size on Invoice</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>S</span>
                      <input type="range" min="30" max="110" value={profile.signatureHeight || 60} onChange={(e) => setProfile(prev => ({ ...prev, signatureHeight: Number(e.target.value) }))} className="logo-slider" />
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>L</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{profile.signatureHeight || 60}px height</span>
                  </div>
                  <button type="button" className="upload-change-btn" onClick={() => sigInputRef.current?.click()}>Change Signature</button>
                </div>
              ) : (
                <button type="button" className="upload-btn" onClick={() => sigInputRef.current?.click()}>
                  <PenTool size={20} /><span>Upload Signature</span><span className="upload-hint">PNG or JPG (up to 5 MB)</span>
                </button>
              )}
              <input ref={sigInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload('signature', e)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Company Stamp / Seal</label>
            <div className="upload-area">
              {profile.stamp ? (
                <div className="logo-upload-section">
                  <div className="logo-preview-box">
                    <img src={profile.stamp} alt="Stamp" style={{ height: `${profile.stampHeight || 70}px`, maxWidth: '180px', objectFit: 'contain', display: 'block' }} />
                    <button type="button" className="icon-btn icon-btn-red upload-remove" onClick={() => removeImage('stamp')}><Trash2 size={14} /></button>
                  </div>
                  <div className="logo-size-control">
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Stamp Size on Invoice</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>S</span>
                      <input type="range" min="30" max="120" value={profile.stampHeight || 70} onChange={(e) => setProfile(prev => ({ ...prev, stampHeight: Number(e.target.value) }))} className="logo-slider" />
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>L</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{profile.stampHeight || 70}px height</span>
                  </div>
                  <button type="button" className="upload-change-btn" onClick={() => stampInputRef.current?.click()}>Change Stamp</button>
                </div>
              ) : (
                <button type="button" className="upload-btn" onClick={() => stampInputRef.current?.click()}>
                  <ImageIcon size={20} /><span>Upload Stamp</span><span className="upload-hint">PNG with a transparent background looks best (up to 5 MB)</span>
                </button>
              )}
              <input ref={stampInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageUpload('stamp', e)} />
            </div>
            {/* v1.10.83 (#117) - where the stamp goes relative to the signature. */}
            {profile.stamp && profile.signature && (
              <div style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="sign-layout">Signature and stamp layout <HelpButton title="Signature and stamp layout" doc="settings#sign-layout" size={16} style={{ marginLeft: 6 }} /></label>
                <select id="sign-layout" className="form-input" value={profile.signLayout || 'side'}
                  onChange={(e) => setProfile(prev => ({ ...prev, signLayout: e.target.value }))}>
                  {SIGN_LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: 8, color: '#0f172a', fontSize: '0.8rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '0.3rem', color: '#64748b' }}>Preview</div>
                  <SignatureImages sigImg={profile.signature} stampImg={profile.stamp}
                    sigHeight={profile.signatureHeight || 60} stampHeight={profile.stampHeight || 70} layout={profile.signLayout || 'side'} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
        </fieldset>
      </form>

      {/* ---- Multi-Business Profiles ---- */}
      {/* v1.10.36 — Moved from ~line 1300 (was 500+ lines below the
           Company Details form) to sit immediately after it. Natural
           flow: fill Company Details → Save as Profile → see it in the
           switcher below. Prior placement forced users to scroll past
           9 sections to find the switcher. */}
      <div id="section-profiles" className="glass-panel p-6 mb-6" style={{ order: 2 }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>Business Profiles <HelpButton title="Business Profiles" doc="settings#business-profiles" size={16} style={{ marginLeft: 6 }} /></h3>
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

      {/* ---- Cloud Backup ---- */}
      <div id="section-cloud" className="glass-panel p-6 mb-6" style={{ order: 9 }}>
        <h3 className="section-title">Cloud Backup (Google Drive) <HelpButton title="Cloud Backup (Google Drive)" doc="settings#google-drive" size={16} style={{ marginLeft: 6 }} /></h3>
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
            Advanced: Direct API Upload (for developers) <HelpButton title="Advanced: Direct API Upload" doc="settings#google-drive-api" size={16} style={{ marginLeft: 6 }} />
          </summary>
          <div style={{ paddingTop: '0.75rem' }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width">
                <label className="form-label">Google OAuth Client ID</label>
                <input type="text" name="googleClientId" className="form-input" value={profile.googleClientId} onChange={handleChange}
                  placeholder="xxxx.apps.googleusercontent.com" />
                <p className="field-hint">
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--primary)' }}>Open Google Cloud Console</a> &rarr; Create Project &rarr; Enable Drive API &rarr; Create OAuth Client ID (Web app) &rarr; Add <code>{window.location.origin}</code> as origin.
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
      <div id="section-terms" className="glass-panel p-6 mb-6" style={{ order: 3 }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title" style={{ margin: 0 }}>Terms & Conditions Templates <HelpButton title="Terms & Conditions Templates" doc="settings#terms" size={16} style={{ marginLeft: 6 }} /></h3>
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
                  // v1.10.74 - don't add a second copy when clicked twice
                  if (termsTemplates.some(t => t.name === qt.name)) { toast('You already have this template', 'info'); return; }
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

      {/* v1.10.36 — Multi-Business Profiles block relocated above,
           immediately after the Company Details form. Placeholder here
           kept as a comment so a code search for "Multi-Business
           Profiles" still lands somewhere sensible. */}

      {/* ---- App Updates ---- */}
      <div id="section-updates" className="glass-panel p-6 mb-6" style={{ order: 11 }}>
        <h3 className="section-title">App Updates <HelpButton title="App Updates" doc="settings#updates" size={16} style={{ marginLeft: 6 }} /></h3>
        <p className="page-subtitle mb-4">Check if a newer version is available.</p>
        <div className="flex gap-4 items-center">
          <button type="button" className="btn btn-secondary" disabled={checkingUpdate} onClick={async () => {
            setCheckingUpdate(true);
            try {
              const res = await fetch('/api/check-update?now=1');
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
            {updateInfo.updateHint ? (
              <p>{updateInfo.updateHint}{updateInfo.releaseUrl && <> <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer">Open the release page</a></>}</p>
            ) : (
              <>
                <p>Your data is backed up first and is not affected. Click below to update:</p>
                <button type="button" className="btn btn-primary" disabled={updatingNow} onClick={handleSettingsUpdateNow} style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                  <Download size={18} /> {updatingNow ? 'Updating…' : 'Update Now'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div id="section-data" className="glass-panel p-6 mb-6" style={{ order: 10 }}>
        <h3 className="section-title">Data Management <HelpButton title="Data Management: Export and Import Backup" doc="backup#export-import" size={16} style={{ marginLeft: 6 }} /></h3>

        {/* Privacy notice — uses the global .notice .notice-info utility so dark/light look identical to every other info card. */}
        <div className="notice notice-info" style={{ marginBottom: '1rem' }}>
          <span className="notice-icon">🔒</span>
          <div>
            <strong>Your data is on this computer only.</strong> Nothing is uploaded to
            us, our servers, or any third party — not invoices, not clients, not
            settings. Your data leaves this computer only if you send it to{' '}
            <strong>your own</strong> Google Drive (<em>Save to Drive</em> below, or
            with each PDF once Drive is set up). See Privacy &amp; internet for
            everything the app uses the internet for.
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
            <h3 className="section-title" style={{ marginTop: 0 }}>Export Backup <HelpButton title="Export Backup" doc="backup#export-backup" size={16} style={{ marginLeft: 6 }} /></h3>
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

      {/* v1.10.37 — end of flex-column reorder wrapper (opened after the
           jump-nav). Modal below stays outside so its z-index isn't
           captured by the flex context. */}
      </div>

      {/* ----------------------- Import modal ----------------------- */}
      {showImportModal && importInspection && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Restore from Backup <HelpButton title="Restore from Backup" doc="backup#restore-from-backup" size={16} style={{ marginLeft: 6 }} /></h3>
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

      {/* v1.10.75 - Save all changes, docked flat along the bottom edge of the
           screen (asked for: stuck to the bottom, not floating). Position and
           width are in index.css (.settings-savebar). */}
      <div className="settings-savebar" style={{
          zIndex: 40,
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          padding: '0.6rem 1.5rem',
          borderTop: unsaved.length ? '2px solid #f59e0b' : '1px solid var(--border)',
          background: unsaved.length ? 'color-mix(in srgb, #f59e0b 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
          boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.10)',
        }}>
        <span style={{ flex: '1 1 220px', fontSize: '0.85rem', fontWeight: 600, color: unsaved.length ? '#f59e0b' : 'var(--text-muted)' }}
          title="Payment accounts, Print & PDF, Region and App lock save as you change them. Business type and Features wait for Save all changes.">
          {unsaved.length ? <>● Unsaved changes in {unsaved.join(', ')}</> : '✓ All changes saved'}
        </span>
        {unsaved.length > 0 && (
          <button type="button" className="btn" onClick={discardAll} style={{ fontSize: '0.85rem' }}>Discard</button>
        )}
        <button type="button" className="btn btn-primary" disabled={saving || invNumSaving || stockAlertsSaving} onClick={saveAll} style={{ fontSize: '0.85rem' }}>
          <Save size={16} /> {saving || invNumSaving || stockAlertsSaving ? 'Saving…' : 'Save all changes'}
        </button>
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

// ============================================================
// v1.9.5 — Backup Management + Trash Bin
// ============================================================
function BackupAndTrashPanel() {
  const [backups, setBackups] = useState([]);
  const [trash, setTrash] = useState([]);
  const [loading, setLoading] = useState(false);
  // v1.10.80 (#99) - extra backup folder (another drive).
  const [backupFolder, setBackupFolderState] = useState({ path: '', error: '' });
  const [folderInput, setFolderInput] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [b, t, f] = await Promise.all([
        getBackupsList().catch(() => []),
        getTrashedBills().catch(() => []),
        getBackupFolder().catch(() => null),
      ]);
      setBackups(b);
      setTrash(t);
      if (f) { setBackupFolderState(f); setFolderInput(f.path || ''); }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const saveBackupFolder = async (value) => {
    setFolderBusy(true);
    try {
      const res = await setBackupFolder(value);
      if (!value) toast('Backups are kept in the app folder only.', 'info');
      else if (res?.error) toast(`Folder saved, but copying today's backup failed: ${res.error}`, 'warning', 9000);
      else toast(`Daily backups are now also copied to ${res.copiesIn}`, 'success', 8000);
      loadAll();
    } catch (err) {
      toast(err.body?.error || err.message || 'Could not use that folder', 'error', 9000);
    } finally {
      setFolderBusy(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleRestoreBackup = async (date) => {
    if (!await confirmAction({
      title: `Restore all data from backup ${date}?`,
      message: 'This OVERWRITES your current data. A copy of your data as it is now is kept first, in data/backups/pre-restore-…, so you can go back to it if the restore looks wrong.',
      confirmLabel: 'Restore backup',
      tone: 'warning',
    })) return;
    try {
      await triggerBackup().catch(() => {}); // today's daily backup, if not made yet
      const res = await restoreBackup(date);
      toast(`Backup restored — please reload the page to see the data.${res?.snapshot ? ` Your data from before is in data/backups/${res.snapshot}.` : ''}`, 'success', 10000);
    } catch (err) {
      toast('Restore failed: ' + err.message, 'error');
    }
  };

  const handleRestoreTrash = async (id) => {
    try {
      // Shared with the Trash tab on the Invoices screen (stock taken out again).
      await restoreBillFromTrash(trash.find((b) => b.id === id) || { id });
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
            💾 Backup Management + 🗑 Trash Bin <HelpButton title="Backup Management + Trash Bin" doc="backup#automatic-backups" size={16} style={{ marginLeft: 6 }} />
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Automatic daily snapshots kept for 30 days · Deleted invoices stay in the trash for 30 days.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }}
          onClick={async () => {
            // v1.10.74 - show an error instead of failing silently
            try {
              await triggerBackup();
              toast('Manual backup triggered', 'success');
              loadAll();
            } catch (err) {
              toast('Backup failed: ' + (err.message || 'unknown error'), 'error');
            }
          }}>
          <SaveIcon size={14} /> Backup now
        </button>
      </div>

      {/* v1.10.80 (#99) - requested: backups only on C: are lost when Windows fails. */}
      <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 8, marginTop: '0.75rem' }}>
        <label className="form-label" htmlFor="backup-folder">Also keep a copy of every daily backup in this folder <HelpButton title="Backup copy in another folder" doc="backup#backup-copy" size={16} style={{ marginLeft: 6 }} /></label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input id="backup-folder" type="text" className="form-input" style={{ flex: 1, minWidth: 220 }}
            placeholder={'e.g. D:\\FreeGSTBill or E:\\ (a second drive or USB disk)'}
            value={folderInput} onChange={(e) => setFolderInput(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={folderBusy || folderInput.trim() === (backupFolder.path || '')}
            onClick={() => saveBackupFolder(folderInput.trim())}>Save folder</button>
          {backupFolder.path && (
            <button type="button" className="btn btn-secondary" disabled={folderBusy} onClick={() => saveBackupFolder('')}>Stop copying</button>
          )}
        </div>
        <p className="field-hint" style={{ marginBottom: 0 }}>
          {backupFolder.path
            ? <>Copies go to <strong>{backupFolder.copiesIn}</strong> (30 days kept). If this PC fails, install the app again, set the same folder here, and its backups appear in the list below to restore.</>
            : 'Backups are kept in the app folder on this drive. Choose a folder on another drive (D:, a USB disk) so they survive if this drive fails.'}
        </p>
        {backupFolder.error && <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0.35rem 0 0' }}>{backupFolder.error}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {/* Backups list */}
        <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>📅 Daily backups ({backups.length}) <HelpButton title="Daily backups" doc="backup#restore-daily-backup" size={16} style={{ marginLeft: 6 }} /></h4>
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
                    {b.onlyInBackupFolder ? ' · in your backup folder only' : (b.inBackupFolder ? ' · also in your backup folder' : '')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleRestoreBackup(b.date)}>
                    Restore
                  </button>
                  {!b.onlyInBackupFolder && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={() => handleDeleteBackup(b.date)} title="Delete this backup (the copy in your backup folder stays)">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trash bin */}
        <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>🗑 Trash bin ({trash.length}) <HelpButton title="Trash bin" doc="backup#trash" size={16} style={{ marginLeft: 6 }} /></h4>
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
