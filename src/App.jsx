import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Home, FileText, Settings, Plus, Users, Package, BarChart3, Wallet, RefreshCw, Receipt, BookOpen, Moon, Sun, Download, X, ShoppingCart, ChevronDown, Building2, Pencil, HelpCircle, Search, Command, Bell, Calculator } from 'lucide-react';
import { getAllProfiles, saveProfile, getEnabledModules, getAllBills, getAllProducts, getStockAlertSettings, getAllClients } from './store';
import { isModuleEnabled, getUpcomingFilings } from './utils';
// v1.10.4 — Route-level lazy loading. Prior App.jsx synchronously
// imported all 12 views (~15k LOC combined), so a first-paint on
// Dashboard downloaded and parsed GSTReturns (1952), InvoiceGenerator
// (2409), IncomeTax (1038), SettingsView (1479), PrintSettings (1294)
// etc. before the user even asked for them.
//
// Now:
//  - Dashboard stays eager — it's the default landing route.
//  - InvoiceGenerator stays eager — new-invoice is the primary action
//    reachable from Ctrl+K / manifest shortcut / big blue button.
//  - Every other view is React.lazy → own Vite chunk → fetched on
//    first navigation only. Suspense fallback is a lightweight spinner.
// Result: smaller initial JS payload; each heavy view chunk-caches
// once fetched.
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SetupWizard from './components/SetupWizard';
import ToastContainer from './components/Toast';
import ConfirmModalContainer from './components/ConfirmModal';
import WelcomeGuide from './components/WelcomeGuide';
const SettingsView = lazy(() => import('./components/SettingsView'));
const ClientsView = lazy(() => import('./components/ClientsView'));
const InventoryView = lazy(() => import('./components/InventoryView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const ExpenseTracker = lazy(() => import('./components/ExpenseTracker'));
const RecurringInvoices = lazy(() => import('./components/RecurringInvoices'));
const ReceiptVoucher = lazy(() => import('./components/ReceiptVoucher'));
const GSTReturns = lazy(() => import('./components/GSTReturns'));
const IncomeTax = lazy(() => import('./components/IncomeTax'));
const PurchaseBills = lazy(() => import('./components/PurchaseBills'));
const UserGuideView = lazy(() => import('./components/UserGuideView'));
import { getPrintSettings } from './utils/printSettings';

// v1.10.4 — Lightweight Suspense fallback shown while a lazy view
// downloads. Purely visual — no data fetching, no state.
function ViewLoading() {
  return (
    <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <span style={{
          display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Loading…
      </div>
    </div>
  );
}

function App() {
  // v1.9.3 — Setup Wizard shown on first-run (before onboardingComplete = true)
  const [showWizard, setShowWizard] = useState(() => {
    try { return !getPrintSettings().onboardingComplete; } catch { return false; }
  });
  const [currentView, setCurrentView] = useState(() => {
    // PWA manifest "shortcuts" deep-link in via ?view=X (e.g. right-clicking
    // the pinned taskbar icon → "New Invoice" opens /?view=new). Honour that
    // before falling back to whatever the user was last looking at.
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      const valid = ['dashboard', 'new', 'clients', 'inventory', 'expenses', 'purchases', 'recurring', 'receipts', 'reports', 'filing', 'incometax', 'guide', 'settings'];
      if (v && valid.includes(v)) {
        // Strip the query string so a refresh doesn't keep snapping back to
        // the shortcut target — only the *first* navigation honours it.
        window.history.replaceState({}, '', window.location.pathname);
        return v;
      }
    } catch { /* sandboxed history API — fall through */ }
    return sessionStorage.getItem('gst_currentView') || 'dashboard';
  });
  const [profile, setProfile] = useState(null);
  const [editingBill, setEditingBill] = useState(() => {
    try {
      const saved = sessionStorage.getItem('gst_editingBill');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('freegstbill_theme') === 'dark';
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const deferredPrompt = useRef(null);
  const retryTimer = useRef(null);

  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const profileLoaded = useRef(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Update notification state. Auto-checks GitHub on mount + every 6h.
  // The user can dismiss a specific version (stored in localStorage) so the
  // banner doesn't keep nagging once they've seen it. A NEW version released
  // after that dismissal will re-show the banner.
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updateBannerVisible = updateInfo?.updateAvailable
    && localStorage.getItem('freegstbill_dismissedUpdate') !== updateInfo.latest;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/check-update');
        const data = await res.json();
        if (!cancelled) setUpdateInfo(data);
      } catch { /* offline — quietly skip */ }
    };
    // First check ~5 seconds after mount so it doesn't fight the initial load.
    const initial = setTimeout(check, 5000);
    // Then re-check every 6 hours while the app is open.
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, []);

  // ---- Notification centre ----
  // Computed from server data on app boot + every 10 minutes; tucked under a
  // bell icon next to dark-mode toggle in the sidebar. Each section is one
  // click away from the relevant page.
  const [notifications, setNotifications] = useState({ overdue: [], dueSoon: [], lowStock: [], filings: [], autoFire: null });
  const [showNotifs, setShowNotifs] = useState(false);
  const notifTotal = notifications.overdue.length + notifications.dueSoon.length
    + notifications.lowStock.length + notifications.filings.length
    + (notifications.autoFire?.count > 0 ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const [bills, products, stockAlertCfg] = await Promise.all([
          getAllBills().catch(() => []),
          getAllProducts().catch(() => []),
          getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
        ]);
        if (cancelled) return;
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 3);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const overdue = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d < today && b.status !== 'paid';
        });
        const dueSoon = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d >= today && d <= tomorrowStr && b.status !== 'paid';
        });
        // Honour the user's stock-alert preferences. When disabled, the filter
        // returns nothing — bell badge drops to 0 for the stock category.
        // When enabled, use the configured threshold (default 5).
        const stockThreshold = Number(stockAlertCfg?.threshold ?? 5);
        const lowStock = stockAlertCfg?.enabled === false
          ? []
          : products.filter(p => (p.stock ?? 999) <= stockThreshold);
        const filings = getUpcomingFilings().filter(f => f.daysAway <= 10);
        // Recurring auto-fire breadcrumb — set by server.js processDueRecurring().
        // Only "fresh" (today's) auto-fires count as a notification; older ones
        // would otherwise stay sticky forever.
        let autoFire = null;
        try {
          const r = await fetch('/api/meta/lastRecurringAutoFire');
          if (r.ok) {
            const j = await r.json();
            if (j.value && j.value.date === today && j.value.count > 0) autoFire = j.value;
          }
        } catch { /* fine */ }
        setNotifications({ overdue, dueSoon, lowStock, filings, autoFire });
      } catch { /* offline / server down — leave previous counts */ }
    };
    compute();
    const interval = setInterval(compute, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentView]); // recompute on view change so the bell stays fresh after the user records a payment

  // ---- Keyboard shortcuts + command palette ----
  // Ctrl+K opens a Spotlight-style command palette; Ctrl+N starts a new
  // invoice from anywhere; Ctrl+/ shows the full shortcuts list. Ctrl+S /
  // Ctrl+P live in InvoiceGenerator (they need invoice-form context). All
  // global handlers also accept Meta (⌘) for macOS users.
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  // v1.9.4 — pre-load searchable content so Ctrl+K acts as a true global
  // search across invoices, clients, products, and settings sections.
  // Small cost (fires once on mount + when palette opens); big UX win.
  const [searchCorpus, setSearchCorpus] = useState({ bills: [], clients: [], products: [] });
  useEffect(() => {
    Promise.all([
      getAllBills().catch(() => []),
      getAllClients().catch(() => []),
      getAllProducts().catch(() => []),
    ]).then(([bills, clients, products]) => {
      setSearchCorpus({
        bills: bills.slice(0, 100),
        clients: clients.slice(0, 200),
        products: products.slice(0, 200),
      });
    });
  }, [showPalette]); // refresh when palette opens
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Palette useMemo + dependent effects are declared further down, AFTER
  // `navItems` and `handleNewInvoice` exist. Declaring them up here would
  // throw "Cannot access 'X' before initialization" at render time because
  // useMemo's dependency array is evaluated synchronously every render.

  const dismissUpdate = () => {
    if (updateInfo?.latest) {
      localStorage.setItem('freegstbill_dismissedUpdate', updateInfo.latest);
      // v1.10.6 — audit L10: was `setUpdateInfo(prev => prev ? { ...prev }
      // : prev)` "to trigger re-render". No-op — `setShowUpdateModal(false)`
      // below already re-renders, and `updateBannerVisible` reads
      // localStorage every render so the new dismissal is picked up.
    }
    setShowUpdateModal(false);
  };

  // Check if server is running — continuously monitors
  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      try {
        const res = await fetch('/api/profile', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          if (cancelled) return;
          setServerDown(false);
          setServerStatus('online');
          if (!profileLoaded.current) {
            profileLoaded.current = true;
            const p = await res.json();
            setProfile(p);
            if (!p.businessName && !localStorage.getItem('freegstbill_onboarded')) {
              setShowWelcome(true);
            }
          }
          return;
        }
        throw new Error('not ok');
      } catch {
        if (!cancelled) {
          setServerDown(true);
          setServerStatus('offline');
        }
      }
    };

    checkServer();
    // Keep checking every 5 seconds (fast when down, normal heartbeat when up)
    retryTimer.current = setInterval(checkServer, 5000);

    return () => {
      cancelled = true;
      if (retryTimer.current) clearInterval(retryTimer.current);
    };
  }, []);

  // Capture PWA install prompt. Banner re-appears 14 days after dismissal
  // (was: dismissed forever — too aggressive, users who closed it during
  // a busy moment never saw it again).
  useEffect(() => {
    const dismissedAt = localStorage.getItem('freegstbill_pwa_dismissed_at');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari
    if (isStandalone) return;
    // 14-day cool-down on dismissal
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / 86400000;
      if (days < 14) return;
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('gst_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (editingBill) {
      sessionStorage.setItem('gst_editingBill', JSON.stringify(editingBill));
    } else {
      sessionStorage.removeItem('gst_editingBill');
    }
  }, [editingBill]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('freegstbill_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Load all saved business profiles
  useEffect(() => {
    if (serverStatus === 'online') {
      getAllProfiles().then(setAllProfiles).catch(() => {});
    }
  }, [serverStatus]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  const handleSwitchProfile = async (bp) => {
    setShowProfileMenu(false);
    const loaded = { ...bp };
    delete loaded.id;
    await saveProfile(loaded);
    setProfile(loaded);
  };

  const handleNewInvoice = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleEditInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(bill);
    setCurrentView('new');
  };

  const handleDuplicateInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const result = await deferredPrompt.current.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    deferredPrompt.current = null;
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    // Timestamp-based dismissal — the 14-day cool-down in the install-prompt
    // effect uses this to decide whether to re-show. Old boolean key kept for
    // back-compat with v1.6.0 — readers that find only the legacy key treat
    // it as "permanently dismissed" (same as today's behaviour for them).
    localStorage.setItem('freegstbill_pwa_dismissed_at', String(Date.now()));
  };

  const handleConvertToInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    clone._convertToType = 'tax-invoice';
    setEditingBill(clone);
    setCurrentView('new');
  };

  // Pull the user's module preferences once per render. Re-mount happens
  // when settings save, which triggers a re-render via the profile state.
  const enabledModules = getEnabledModules();
  const showIfModule = (moduleId) => isModuleEnabled(moduleId, enabledModules);

  // If the user just disabled the module backing the current view, kick them to dashboard
  // so they don't land on an empty page after toggling.
  useEffect(() => {
    const map = { new: 'invoicing', clients: 'clients', inventory: 'inventory', expenses: 'expenses', purchases: 'purchases', recurring: 'recurring', receipts: 'receipts', reports: 'reports', filing: 'gstReturns' };
    const moduleForView = map[currentView];
    if (moduleForView && !isModuleEnabled(moduleForView, enabledModules)) {
      setCurrentView('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, JSON.stringify(enabledModules)]);

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', module: 'dashboard' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice, module: 'invoicing' },
    { id: 'clients', icon: Users, label: 'Clients', module: 'clients' },
    { id: 'inventory', icon: Package, label: 'Products', module: 'inventory' },
    { id: 'expenses', icon: Wallet, label: 'Expenses', module: 'expenses' },
    { id: 'purchases', icon: ShoppingCart, label: 'Purchases', module: 'purchases' },
    { id: 'recurring', icon: RefreshCw, label: 'Recurring', module: 'recurring' },
    { id: 'receipts', icon: Receipt, label: 'Receipts', module: 'receipts' },
    { id: 'reports', icon: BarChart3, label: 'Reports', module: 'reports' },
    { id: 'filing', icon: BookOpen, label: 'GST Returns', module: 'gstReturns' },
    { id: 'incometax', icon: Calculator, label: 'Income Tax', module: 'incomeTax' },
    { id: 'guide', icon: HelpCircle, label: 'User Guide', module: 'dashboard' }, // gated by dashboard so it's always available
  ].filter(item => showIfModule(item.module));

  // Command palette actions — declared here (not earlier) because the deps
  // array references `navItems` and `handleNewInvoice`, which are consts.
  // Reading a const before its declaration triggers a Temporal Dead Zone
  // ReferenceError ("Cannot access 'X' before initialization") at runtime.
  const paletteActions = useMemo(() => {
    const acts = [
      { label: 'New Invoice', hint: 'Ctrl+N', category: 'action', run: () => { handleNewInvoice(); } },
    ];
    navItems.forEach(item => {
      if (item.id === 'new') return; // already covered above
      acts.push({ label: `Go to ${item.label}`, hint: '', category: 'nav', run: item.onClick || (() => setCurrentView(item.id)) });
    });
    acts.push({ label: 'Go to Settings', hint: '', category: 'nav', run: () => setCurrentView('settings') });
    acts.push({ label: 'Toggle dark mode', hint: '', category: 'action', run: () => setDarkMode(d => !d) });
    acts.push({ label: 'Show keyboard shortcuts', hint: 'Ctrl+/', category: 'help', run: () => setShowShortcutsHelp(true) });
    if (updateInfo?.updateAvailable) {
      acts.push({ label: `View update — v${updateInfo.latest}`, hint: '', category: 'update', run: () => setShowUpdateModal(true) });
    }
    // v1.9.4 — cross-app search: invoices, clients, products
    // v1.10.5 — audit H24 fix. Prior code dispatched
    // `CustomEvent('fgsb-open-bill', { detail: b.id })` but no one
    // listened for it — selecting an invoice in the palette silently
    // dropped the ID and just landed on Dashboard. Now: reuse
    // handleEditInvoice() directly, which is already the canonical way
    // to open a bill for editing (works from Dashboard row-click too).
    searchCorpus.bills.forEach(b => {
      acts.push({
        label: `📄 ${b.invoiceNumber || 'INV-?'} — ${b.clientName || 'No client'}`,
        hint: b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString('en-IN') : '',
        category: 'invoice',
        run: () => handleEditInvoice(b),
      });
    });
    searchCorpus.clients.forEach(c => {
      acts.push({
        label: `👤 ${c.name} — client${c.gstin ? ' · GSTIN: ' + c.gstin : ''}`,
        hint: c.phone || c.email || '',
        category: 'client',
        run: () => setCurrentView('clients'),
      });
    });
    searchCorpus.products.forEach(p => {
      acts.push({
        label: `📦 ${p.name} — product${p.hsn ? ' · HSN: ' + p.hsn : ''}`,
        hint: (p.stock ?? 0) + ' in stock',
        category: 'product',
        run: () => setCurrentView('inventory'),
      });
    });
    // Settings sections (jump to specific area)
    const settingsJumps = [
      'Company profile', 'Payment accounts', 'Print & PDF Settings', 'PDF Style Editor',
      'Business type presets', 'Section labels', 'Watermarks', 'Multi-copy print',
      'Digital signature', 'Company letterhead', 'Modules', 'Region preference',
      'Google Drive backup', 'App updates',
    ];
    settingsJumps.forEach(s => {
      acts.push({ label: `⚙️ Settings → ${s}`, hint: '', category: 'settings', run: () => setCurrentView('settings') });
    });
    return acts;
  }, [navItems, updateInfo, handleNewInvoice, searchCorpus]);

  const filteredPalette = paletteActions.filter(a =>
    !paletteQuery.trim() || a.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // Global keyboard shortcuts. Lives down here for the same TDZ reason —
  // the handler closes over `handleNewInvoice` which is declared above only.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowPalette(p => !p);
        setPaletteQuery('');
        setPaletteIdx(0);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(s => !s);
      } else if ((e.key === 'n' || e.key === 'N') && !editable) {
        e.preventDefault();
        handleNewInvoice();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v1.9.4 — Accessibility hooks (v1.10.4/1.10.6 updated):
  //   1. Mirror `title` → `aria-label` on every icon button that lacks one.
  //      Runs on mount + via a MutationObserver when the DOM adds new
  //      icon buttons (bulk toolbars, modals, etc.). See M15.
  //   2. Global ESC handler for any open `.modal-overlay` — clicks the
  //      backdrop (which triggers the overlay's own close). No CSS
  //      class is added; the earlier `.esc-closable` idea was never
  //      implemented, comment cleaned up (audit L7).
  useEffect(() => {
    // v1.10.4 — audit M15. Prior code polled the DOM every 3 seconds
    // to mirror title→aria-label on new .icon-btn elements. Constant
    // idle-time work for a paper-thin accessibility win. Replaced with
    // a MutationObserver that fires ONLY when new buttons enter the
    // DOM. Existing buttons get the treatment once at mount.
    const mirrorTitleToAria = (root = document) => {
      root.querySelectorAll('button.icon-btn[title]:not([aria-label])').forEach(btn => {
        btn.setAttribute('aria-label', btn.getAttribute('title'));
      });
    };
    mirrorTitleToAria();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {  // Element
              if (node.matches?.('button.icon-btn[title]:not([aria-label])')) {
                node.setAttribute('aria-label', node.getAttribute('title'));
              }
              mirrorTitleToAria(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Global ESC → click the topmost modal-overlay (dismisses it).
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
      const top = overlays[overlays.length - 1];
      if (!top) return;
      if (showPalette) return;
      top.click();
    };
    window.addEventListener('keydown', onEsc);
    return () => { observer.disconnect(); window.removeEventListener('keydown', onEsc); };
  }, [showPalette]);

  // Palette-only arrow / Enter / Esc nav. Filtered list dep keeps the
  // handler in sync with the user's current query.
  useEffect(() => {
    if (!showPalette) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowPalette(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx(i => Math.min(i + 1, filteredPalette.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const action = filteredPalette[paletteIdx];
        if (action) { action.run(); setShowPalette(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPalette, paletteIdx, filteredPalette]);

  if (serverDown) {
    return (
      <div className="server-down-overlay">
        <div className="server-down-modal">
          <FileText size={48} color="#3b82f6" />
          <h2>Free GST Billing Software Needs a Quick Start</h2>
          <p>
            Your data is <strong>100% safe</strong> on your computer — nothing is lost.
            The app just needs to be started once.
          </p>
          <a href="freegstbill://start" className="server-start-btn">
            Open GST Billing
          </a>
          <div className="server-down-steps">
            <p className="server-down-hint">Or start manually:</p>
            <ol>
              <li>Double-click <strong>Free GST Billing Software</strong> on your Desktop</li>
              <li>Or search <strong>"Free GST Billing"</strong> in Start Menu</li>
            </ol>
          </div>
          <p className="server-down-safe">All your invoices, clients, and data are safely stored on your computer. They are never deleted or shared.</p>
          <div className="server-down-waiting">
            <div className="server-down-spinner" />
            <span>Starting... this page will open automatically.</span>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <>
        <WelcomeGuide onComplete={(p) => {
          if (p) setProfile(p);
          setShowWelcome(false);
        }} />
        <ToastContainer />
        <ConfirmModalContainer />
      </>
    );
  }

  // v1.10.33 — "Finish setup" bottom-right pill. Shown when the user
  // hit Skip on the wizard (onboardingSkipped=true) so they can come
  // back later without hunting through Settings. Hidden after they
  // finish setup (finish() clears the flag) or if they explicitly said
  // "None of these — I'll configure manually".
  const showResumeSetupPill = (() => {
    try {
      const ps = getPrintSettings();
      return !showWizard && ps.onboardingComplete === true && ps.onboardingSkipped === true;
    } catch { return false; }
  })();

  return (
    <div className="app-layout">
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
      {showResumeSetupPill && (
        <button type="button"
          onClick={() => setShowWizard(true)}
          title="Come back to the setup wizard — pick a business type, paper size, and language."
          style={{
            position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 9998,
            padding: '0.6rem 1rem', borderRadius: 999,
            background: 'var(--primary)', color: '#fff', border: 'none',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(30,64,175,0.35), 0 2px 4px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
          ✨ Finish setup
        </button>
      )}
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="sidebar-title">GST Billing</h2>
            <p className="sidebar-subtitle">by DiceCodes</p>
          </div>
        </div>

        <div className="profile-switcher" ref={profileMenuRef} style={{ position: 'relative' }}>
          <div className="profile-switcher-row">
            <button
              className="profile-switcher-btn"
              onClick={() => allProfiles.length > 1 && setShowProfileMenu(v => !v)}
              title={allProfiles.length > 1 ? 'Switch business profile' : profile?.businessName || 'My Business'}
              style={{ cursor: allProfiles.length > 1 ? 'pointer' : 'default' }}
            >
              <Building2 size={14} />
              <span className="profile-switcher-name">{profile?.businessName || 'My Business'}</span>
              {allProfiles.length > 1 && <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
            <button
              className="profile-switcher-edit"
              onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              title="Edit business profile"
            >
              <Pencil size={13} />
            </button>
          </div>
          {showProfileMenu && (
            <div className="profile-switcher-menu">
              {allProfiles.map(bp => (
                <button
                  key={bp.id || bp.businessName}
                  className={`profile-switcher-item${bp.businessName?.trim().toLowerCase() === profile?.businessName?.trim().toLowerCase() ? ' active' : ''}`}
                  onClick={() => handleSwitchProfile(bp)}
                >
                  {bp.businessName}
                </button>
              ))}
              <button
                className="profile-switcher-item profile-switcher-manage"
                onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              >
                Manage profiles...
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${currentView === item.id ? 'nav-btn-active' : ''}`}
              onClick={item.onClick || (() => setCurrentView(item.id))}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Update-available banner — only shows when GitHub has a newer version
                AND the user hasn't already dismissed THIS specific version. New
                releases re-show the banner. Click to view notes + update. */}
            {updateBannerVisible && (
              <button
                className="nav-btn"
                onClick={() => setShowUpdateModal(true)}
                title={`v${updateInfo.latest} is available`}
                style={{
                  background: 'var(--info-bg)',
                  borderColor: 'var(--info-border)',
                  color: 'var(--info-text)',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <Download size={18} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  Update to v{updateInfo.latest}
                </span>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)',
                  flexShrink: 0,
                }} />
              </button>
            )}
            {/* Notification bell — opens a popover listing overdue / due-soon
                invoices, GST filing deadlines, and low-stock items. Each row
                is a single click away from the page that fixes it. */}
            <button
              className="nav-btn"
              onClick={() => setShowNotifs(s => !s)}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              Notifications
              {notifTotal > 0 && (
                <span style={{
                  position: 'absolute', top: '8px', right: '12px',
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: '9px',
                  background: 'var(--danger)', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{notifTotal > 99 ? '99+' : notifTotal}</span>
              )}
            </button>
            <button
              className="nav-btn"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              className={`nav-btn ${currentView === 'settings' ? 'nav-btn-active' : ''}`}
              onClick={() => setCurrentView('settings')}
              style={updateBannerVisible ? { position: 'relative' } : undefined}
            >
              <Settings size={18} /> Settings
              {updateBannerVisible && (
                <span style={{
                  position: 'absolute', top: '8px', right: '12px',
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f59e0b',
                }} title="Update available" />
              )}
            </button>
            <div className={`server-status server-status-${serverStatus}`}>
              <span className="server-status-dot" />
              {serverStatus === 'online' ? 'App Ready' : serverStatus === 'offline' ? 'App Not Running' : 'Connecting...'}
            </div>
          </div>
        </nav>
      </div>

      {showInstallBanner && (
        <div className="pwa-install-banner">
          <Download size={18} />
          <span>
            <strong>Install as Desktop App</strong> — own icon, no browser, opens instantly. Right-click the icon for quick-jump to New Invoice / GST Returns.
          </span>
          <button className="pwa-install-btn" onClick={handleInstallPWA}>Install App</button>
          <button className="pwa-dismiss-btn" onClick={dismissInstallBanner} title="Remind me later (re-shows in 14 days)"><X size={16} /></button>
        </div>
      )}
      <div className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} onConvert={handleConvertToInvoice} />
        )}
        {currentView === 'new' && (
          <InvoiceGenerator
            onBack={() => { setEditingBill(null); setCurrentView('dashboard'); }}
            profile={profile} editingBill={editingBill}
          />
        )}
        {/* v1.10.4 — All lazy views under one Suspense boundary. Only the
             matched view's chunk actually loads; others stay unfetched. */}
        <Suspense fallback={<ViewLoading />}>
        {currentView === 'clients' && (
          <ClientsView onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
        )}
        {currentView === 'inventory' && (
          <InventoryView />
        )}
        {currentView === 'expenses' && (
          <ExpenseTracker />
        )}
        {currentView === 'purchases' && (
          <PurchaseBills />
        )}
        {currentView === 'recurring' && (
          <RecurringInvoices onEdit={handleEditInvoice} />
        )}
        {currentView === 'receipts' && (
          <ReceiptVoucher />
        )}
        {currentView === 'reports' && (
          <ReportsView />
        )}
        {currentView === 'filing' && (
          <GSTReturns />
        )}
        {currentView === 'incometax' && (
          <IncomeTax />
        )}
        {currentView === 'guide' && (
          <UserGuideView />
        )}
        {currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
        </Suspense>
      </div>

      {/* Update modal — release notes + Export-backup-first nudge + Update Now */}
      {/* Notification popover — rendered as a click-out modal so it works on
          tablets too. Grouped by category with a navigate-to button per group. */}
      {showNotifs && (
        <div className="modal-overlay" onClick={() => setShowNotifs(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Notifications</h3>
              <button className="icon-btn" onClick={() => setShowNotifs(false)} title="Close"><X size={18} /></button>
            </div>
            {notifTotal === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', margin: 0 }}>
                All clear ✨ — nothing needs your attention right now.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notifications.autoFire?.count > 0 && (
                  <button type="button" className="notice notice-info" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">🔁</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.autoFire.count} recurring invoice{notifications.autoFire.count !== 1 ? 's' : ''} auto-generated today</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        Check the Dashboard for the new bills · review and download PDFs as needed
                      </div>
                    </div>
                  </button>
                )}
                {notifications.overdue.length > 0 && (
                  <button type="button" className="notice notice-danger" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">⚠</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.overdue.length} overdue invoice{notifications.overdue.length !== 1 ? 's' : ''}</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.overdue.slice(0, 3).map(b => b.invoiceNumber).join(' · ')}{notifications.overdue.length > 3 ? ` · +${notifications.overdue.length - 3} more` : ''}
                      </div>
                    </div>
                  </button>
                )}
                {notifications.dueSoon.length > 0 && (
                  <button type="button" className="notice notice-warn" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">⏰</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.dueSoon.length} invoice{notifications.dueSoon.length !== 1 ? 's' : ''} due in next 3 days</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.dueSoon.slice(0, 3).map(b => `${b.invoiceNumber} (${b.clientName})`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
                {notifications.filings.length > 0 && (
                  <button type="button" className="notice notice-info" onClick={() => { setShowNotifs(false); setCurrentView('filing'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">📋</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.filings.length} GST filing{notifications.filings.length !== 1 ? 's' : ''} due in next 10 days</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.filings.slice(0, 3).map(f => `${f.label} (${f.daysAway === 0 ? 'today' : f.daysAway + 'd'})`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
                {notifications.lowStock.length > 0 && (
                  <button type="button" className="notice notice-note" onClick={() => { setShowNotifs(false); setCurrentView('inventory'); }} style={{ cursor: 'pointer', border: 'none', textAlign: 'left' }}>
                    <span className="notice-icon">📦</span>
                    <div style={{ flex: 1 }}>
                      <strong>{notifications.lowStock.length} product{notifications.lowStock.length !== 1 ? 's' : ''} low on stock</strong>
                      <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.2rem' }}>
                        {notifications.lowStock.slice(0, 3).map(p => `${p.name} (${p.stock} left)`).join(' · ')}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command palette — Ctrl/Cmd+K. Spotlight-style: type to filter actions,
          ↑/↓ to navigate, Enter to run, Esc to close. */}
      {showPalette && (
        <div className="modal-overlay" onClick={() => setShowPalette(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input autoFocus type="text" placeholder="Type a command or page name…"
                value={paletteQuery}
                onChange={e => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                className="form-input" style={{ border: 0, background: 'transparent', flex: 1, fontSize: '0.95rem' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc</span>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {filteredPalette.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.25rem', margin: 0, fontSize: '0.85rem' }}>
                  Nothing matches "{paletteQuery}".
                </p>
              )}
              {filteredPalette.map((a, i) => (
                <button key={a.label} type="button"
                  onClick={() => { a.run(); setShowPalette(false); }}
                  onMouseEnter={() => setPaletteIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.6rem 1rem', border: 0, cursor: 'pointer',
                    background: i === paletteIdx ? 'var(--bg-tertiary)' : 'transparent',
                    color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.88rem',
                  }}>
                  <span>{a.label}</span>
                  {a.hint && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.hint}</span>}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><Command size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Ctrl+K to toggle · ↑↓ navigate · Enter run</span>
              <button type="button" onClick={() => { setShowPalette(false); setShowShortcutsHelp(true); }} style={{ background: 'none', border: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem' }}>
                All shortcuts (Ctrl+/)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard-shortcuts help — Ctrl/Cmd+/. Single-pane reference. */}
      {showShortcutsHelp && (
        <div className="modal-overlay" onClick={() => setShowShortcutsHelp(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Keyboard Shortcuts</h3>
              <button className="icon-btn" onClick={() => setShowShortcutsHelp(false)} title="Close"><X size={18} /></button>
            </div>
            <table className="kv-list">
              <tbody>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>K</kbd></td><td>Open command palette (jump to any page)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>N</kbd></td><td>New invoice</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>S</kbd></td><td>Save current invoice (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>P</kbd></td><td>Download PDF (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>/</kbd></td><td>Toggle this help</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Close any open modal</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
              On macOS, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.
            </p>
          </div>
        </div>
      )}

      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
                  Update available — v{updateInfo.latest}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  You're on v{updateInfo.current}
                  {updateInfo.releasePublishedAt && ` · released ${new Date(updateInfo.releasePublishedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowUpdateModal(false)} title="Close"><X size={18} /></button>
            </div>

            {/* Data-safety reassurance — explicit, prominent. Same .notice-info style
                as the Data Management privacy card so users learn one visual pattern. */}
            <div className="notice notice-info" style={{ marginBottom: '0.85rem' }}>
              <span className="notice-icon">🔒</span>
              <div>
                <strong>Your data is safe.</strong> Updates only refresh the app code and dependencies — your <code>data/</code> folder (invoices, clients, products, settings) and <code>Saved Invoices/</code> PDF archive are <strong>never touched</strong>. The updater pulls the latest source from GitHub and rebuilds, then restarts.
              </div>
            </div>

            {/* Release notes */}
            <div className="surface-card" style={{ maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '0.85rem' }}>
              {updateInfo.releaseNotes || (
                <span style={{ color: 'var(--text-muted)' }}>
                  No release notes available — see the full changelog at{' '}
                  <a href={updateInfo.releaseUrl || 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub Releases</a>.
                </span>
              )}
            </div>

            {/* Suggested pre-update step: export a backup */}
            <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
              <span className="notice-icon">💡</span>
              <div>
                <strong>Recommended:</strong> export a backup before updating, just in case. <button type="button" className="btn-link" onClick={() => { setShowUpdateModal(false); setCurrentView('settings'); }} style={{ background: 'none', border: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>Open Settings → Data Management</button> and click <em>Export Backup…</em>.
              </div>
            </div>

            <div className="flex gap-2 justify-end" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={dismissUpdate}>
                Skip this version
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
                Remind me later
              </button>
              {updateInfo.releaseUrl && (
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  View on GitHub
                </a>
              )}
              <a href="freegstbill-update://run" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <Download size={16} /> Update Now
              </a>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.6rem', marginBottom: 0 }}>
              <em>Update Now</em> launches <code>Update FreeGSTBill.bat</code> in a window. Wait for it to finish (~30 seconds), then refresh this page.
            </p>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmModalContainer />
    </div>
  );
}

export default App;
