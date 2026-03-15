import { useState, useEffect, useRef } from 'react';
import { Home, FileText, Settings, Plus, Users, Package, BarChart3, Wallet, RefreshCw, Receipt, BookOpen, Moon, Sun, Download, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SettingsView from './components/SettingsView';
import ClientsView from './components/ClientsView';
import InventoryView from './components/InventoryView';
import ReportsView from './components/ReportsView';
import ExpenseTracker from './components/ExpenseTracker';
import RecurringInvoices from './components/RecurringInvoices';
import ReceiptVoucher from './components/ReceiptVoucher';
import GSTFilingGuide from './components/GSTFilingGuide';
import WelcomeGuide from './components/WelcomeGuide';
import ToastContainer from './components/Toast';
import { getProfile } from './store';

function App() {
  const [currentView, setCurrentView] = useState(() => {
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
  const deferredPrompt = useRef(null);

  useEffect(() => {
    getProfile().then(p => {
      setProfile(p);
      if (!p.businessName && !localStorage.getItem('freegstbill_onboarded')) {
        setShowWelcome(true);
      }
    });
  }, []);

  // Capture PWA install prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('freegstbill_pwa_dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (dismissed || isStandalone) return;

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
    localStorage.setItem('freegstbill_pwa_dismissed', '1');
  };

  const handleConvertToInvoice = (bill) => {
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    clone._convertToType = 'tax-invoice';
    setEditingBill(clone);
    setCurrentView('new');
  };

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice },
    { id: 'clients', icon: Users, label: 'Clients' },
    { id: 'inventory', icon: Package, label: 'Products' },
    { id: 'expenses', icon: Wallet, label: 'Expenses' },
    { id: 'recurring', icon: RefreshCw, label: 'Recurring' },
    { id: 'receipts', icon: Receipt, label: 'Receipts' },
    { id: 'reports', icon: BarChart3, label: 'Reports & P&L' },
    { id: 'filing', icon: BookOpen, label: 'GST Filing' },
  ];

  if (showWelcome) {
    return (
      <>
        <WelcomeGuide onComplete={(p) => {
          if (p) setProfile(p);
          setShowWelcome(false);
        }} />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="sidebar-title">FreeGSTBill</h2>
            <p className="sidebar-subtitle">by DiceCodes</p>
          </div>
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
            >
              <Settings size={18} /> Settings
            </button>
          </div>
        </nav>
      </div>

      {showInstallBanner && (
        <div className="pwa-install-banner">
          <Download size={18} />
          <span><strong>Install FreeGSTBill</strong> as a desktop app — opens instantly, no browser needed!</span>
          <button className="pwa-install-btn" onClick={handleInstallPWA}>Install App</button>
          <button className="pwa-dismiss-btn" onClick={dismissInstallBanner} title="Dismiss"><X size={16} /></button>
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
        {currentView === 'clients' && (
          <ClientsView onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
        )}
        {currentView === 'inventory' && (
          <InventoryView />
        )}
        {currentView === 'expenses' && (
          <ExpenseTracker />
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
          <GSTFilingGuide />
        )}
        {currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
