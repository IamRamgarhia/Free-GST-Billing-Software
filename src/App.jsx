import { useState, useEffect } from 'react';
import { Home, FileText, Settings, Plus, Users } from 'lucide-react';
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SettingsView from './components/SettingsView';
import ClientsView from './components/ClientsView';
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

  useEffect(() => {
    getProfile().then(setProfile);
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

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'new', icon: Plus, label: 'New Invoice', onClick: handleNewInvoice },
    { id: 'clients', icon: Users, label: 'Clients' },
  ];

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="sidebar-title">BillKaro</h2>
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
          <button
            className={`nav-btn nav-btn-bottom ${currentView === 'settings' ? 'nav-btn-active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <Settings size={18} /> Settings
          </button>
        </nav>
      </div>

      <div className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
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
        {currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
