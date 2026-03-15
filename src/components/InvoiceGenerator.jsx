import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Download, UserPlus, Pencil, Settings, ChevronUp, ChevronDown, MessageCircle, Check, Loader, Truck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveBill, getNextInvoiceNumber, getTermsTemplates, getAllClients, saveClient, getProfile, getAllProducts, saveProduct, getInvoiceDisplayOptions, saveInvoiceDisplayOptions } from '../store';
import { INDIAN_STATES, INVOICE_TYPES, generateEWayBillJSON } from '../utils';
import { ensureToken, findOrCreateFolder, uploadPDF } from '../services/googleDrive';
import DOMPurify from 'dompurify';
import InvoicePreview from './InvoicePreview';
import ClientModal from './ClientModal';
import { toast } from './Toast';

// Rich text editor component that works with contentEditable properly
function RichEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (ref.current && !isInitialized.current) {
      ref.current.innerHTML = DOMPurify.sanitize(value || '');
      isInitialized.current = true;
    }
  }, []);

  // Update if value changes externally (e.g. draft restore, editing bill)
  useEffect(() => {
    if (ref.current && isInitialized.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = DOMPurify.sanitize(value || '');
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onChange(ref.current.innerHTML);
    }
  }, [onChange]);

  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      className="form-input rich-editor"
      onInput={handleInput}
      style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}
      data-placeholder={placeholder} />
  );
}

// Load draft from sessionStorage
function loadDraft() {
  try {
    const saved = sessionStorage.getItem('gst_invoiceDraft');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

const DEFAULT_OPTIONS = {
  showGST: true,
  showState: true,
  showGSTIN: true,
  showPlaceOfSupply: true,
  showHSN: true,
  showDiscount: true,
  showBankDetails: true,
  showUPI: true,
  showLogo: true,
  showSignature: true,
  showTerms: true,
  showNotes: true,
  showAmountWords: true,
  showDueDate: true,
  showItemQty: true,
  customTitle: '',
  currency: 'INR',
  accentColor: '',
  pdfStyle: 'classic',
};

const ACCENT_PRESETS = [
  { color: '#1e40af', label: 'Blue' },
  { color: '#7c3aed', label: 'Purple' },
  { color: '#0f766e', label: 'Teal' },
  { color: '#be123c', label: 'Red' },
  { color: '#c2410c', label: 'Orange' },
  { color: '#15803d', label: 'Green' },
  { color: '#0369a1', label: 'Sky' },
  { color: '#1e293b', label: 'Dark' },
];

const PDF_STYLES = [
  { id: 'classic', label: 'Classic', desc: 'Clean with top accent bar' },
  { id: 'modern', label: 'Modern', desc: 'Bold header with color block' },
  { id: 'minimal', label: 'Minimal', desc: 'Simple, borderless layout' },
];

export default function InvoiceGenerator({ onBack, profile, editingBill }) {
  const draft = loadDraft();
  const [invoiceType, setInvoiceType] = useState(draft?.invoiceType || 'tax-invoice');
  const [client, setClient] = useState(draft?.client || { name: '', address: '', city: '', pin: '', state: '', gstin: '' });
  const [details, setDetails] = useState(draft?.details || {
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    placeOfSupply: '',
    originalInvoiceRef: '',
  });

  const [items, setItems] = useState(draft?.items || [
    { id: Date.now().toString(), name: '', hsn: '', quantity: 1, rate: 0, discount: 0, taxPercent: 18 }
  ]);

  const [totals, setTotals] = useState({ subtotal: 0, totalDiscount: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [termsTemplates, setTermsTemplates] = useState([]);
  const [selectedTermsId, setSelectedTermsId] = useState(draft?.selectedTermsId || '');
  const [customTerms, setCustomTerms] = useState(draft?.customTerms || '');
  const [customNotes, setCustomNotes] = useState(draft?.customNotes || '');
  const [internalNote, setInternalNote] = useState(draft?.internalNote || '');
  const [extraSections, setExtraSections] = useState(draft?.extraSections || []);
  const [savedClients, setSavedClients] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [modalClient, setModalClient] = useState(null);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const clientNameRef = useRef(null);
  const clientSuggestionsRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState({ itemId: null, query: '' });
  const [invoiceOptions, setInvoiceOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('freegstbill_invoiceOptions');
      const persisted = saved ? JSON.parse(saved) : {};
      // Persisted options are the user's defaults, draft can override for in-progress work
      return { ...DEFAULT_OPTIONS, ...persisted, ...(draft?.invoiceOptions || {}) };
    } catch { return draft?.invoiceOptions || { ...DEFAULT_OPTIONS }; }
  });
  const [showOptions, setShowOptions] = useState(false);
  const printRef = useRef(null);
  const draftInitialized = useRef(!!draft);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const autoSaveTimer = useRef(null);
  const stockDeducted = useRef(!!editingBill); // skip stock deduction for existing invoices
  const hasInitialized = useRef(false); // prevent auto-save during initial load

  const typeConfig = INVOICE_TYPES[invoiceType];
  const showGST = invoiceOptions.showGST;

  // Persist options to both localStorage (instant) and server (durable)
  useEffect(() => {
    localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(invoiceOptions));
    if (hasInitialized.current) {
      saveInvoiceDisplayOptions(invoiceOptions).catch(() => {});
    }
  }, [invoiceOptions]);

  // Load saved display options from server on mount (overrides localStorage if available)
  useEffect(() => {
    getInvoiceDisplayOptions().then(serverOpts => {
      if (serverOpts) {
        const merged = { ...DEFAULT_OPTIONS, ...serverOpts };
        setInvoiceOptions(prev => {
          // Only update if different to avoid unnecessary re-renders
          const changed = Object.keys(merged).some(k => merged[k] !== prev[k]);
          if (changed) {
            localStorage.setItem('freegstbill_invoiceOptions', JSON.stringify(merged));
            return merged;
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  // Auto-save draft to sessionStorage
  useEffect(() => {
    const draftData = { invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, selectedTermsId, invoiceOptions };
    sessionStorage.setItem('gst_invoiceDraft', JSON.stringify(draftData));
  }, [invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, selectedTermsId, invoiceOptions]);

  // Mark initialized after first render cycle so auto-save doesn't trigger on load
  useEffect(() => {
    const t = setTimeout(() => { hasInitialized.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Debounced auto-save to server (2s after last change)
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (!details.invoiceNumber) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await saveInvoiceToDB(true);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('idle');
      }
    }, 2000);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [invoiceType, client, details, items, customTerms, customNotes, internalNote, extraSections, invoiceOptions]);

  const clearDraft = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
  };

  // Load terms templates and saved clients
  useEffect(() => {
    getTermsTemplates().then(templates => {
      setTermsTemplates(templates);
      if (templates.length > 0 && !selectedTermsId && !draftInitialized.current) {
        setSelectedTermsId(templates[0].id);
        setCustomTerms(templates[0].content);
      }
    });
    getAllClients().then(clients => {
      setSavedClients(clients);
      // Auto-link if editing a bill with a known client
      if (client.name.trim()) {
        const match = clients.find(c => c.name.toLowerCase() === client.name.trim().toLowerCase());
        if (match) setSelectedClientId(match.id);
      }
    });
    getAllProducts().then(setProducts);
  }, []);

  // Initialize from editing bill or generate new number (skip if restoring from draft)
  useEffect(() => {
    if (draftInitialized.current) {
      draftInitialized.current = false;
      return;
    }
    if (editingBill?.data) {
      const d = editingBill.data;
      setClient(d.client);
      setItems(d.items);
      setInvoiceType(d.invoiceType || 'tax-invoice');
      if (d.customTerms !== undefined) setCustomTerms(d.customTerms);
      if (d.customNotes !== undefined) setCustomNotes(d.customNotes);
      if (d.internalNote !== undefined) setInternalNote(d.internalNote);
      if (d.extraSections) setExtraSections(d.extraSections);
      if (d.invoiceOptions) {
        // User's persisted defaults as base, bill options overlay
        try {
          const saved = localStorage.getItem('freegstbill_invoiceOptions');
          const persisted = saved ? JSON.parse(saved) : {};
          setInvoiceOptions({ ...DEFAULT_OPTIONS, ...persisted, ...d.invoiceOptions });
        } catch { setInvoiceOptions({ ...DEFAULT_OPTIONS, ...d.invoiceOptions }); }
      }

      if (editingBill._isDuplicate) {
        const convertType = editingBill._convertToType;
        const type = convertType || d.invoiceType || 'tax-invoice';
        if (convertType) {
          setInvoiceType(convertType);
          const config = INVOICE_TYPES[convertType];
          if (config) setInvoiceOptions(prev => ({ ...prev, showGST: config.showGST, showPlaceOfSupply: config.showGST }));
        }
        const prefix = INVOICE_TYPES[type]?.prefix || 'INV';
        getNextInvoiceNumber(prefix).then(num => {
          setDetails({ ...d.details, invoiceNumber: num, invoiceDate: new Date().toISOString().split('T')[0] });
        });
      } else {
        setDetails(d.details);
      }
    } else if (!details.invoiceNumber) {
      getNextInvoiceNumber('INV').then(num => {
        setDetails(prev => ({ ...prev, invoiceNumber: num }));
      });
    }
  }, [editingBill]);

  const handleTypeChange = async (type) => {
    setInvoiceType(type);
    const config = INVOICE_TYPES[type];
    const prefix = config?.prefix || 'INV';
    const num = await getNextInvoiceNumber(prefix);
    setDetails(prev => ({ ...prev, invoiceNumber: num }));

    // Auto-set options based on type
    if (type === 'bill-of-supply') {
      setInvoiceOptions(prev => ({ ...prev, showGST: false, showPlaceOfSupply: false }));
    } else {
      setInvoiceOptions(prev => ({ ...prev, showGST: config.showGST, showPlaceOfSupply: config.showGST }));
    }
  };

  const toggleOption = (key) => {
    setInvoiceOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Recalculate totals
  useEffect(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxTotal = 0;

    items.forEach(item => {
      const amount = item.quantity * item.rate;
      const discount = item.discount || 0;
      const afterDiscount = amount - discount;
      subtotal += amount;
      totalDiscount += discount;
      if (showGST) {
        taxTotal += (afterDiscount * (item.taxPercent || 0)) / 100;
      }
    });

    const businessState = profile?.state?.trim().toLowerCase();
    const clientState = client?.state?.trim().toLowerCase();
    const isInterstate = businessState && clientState && businessState !== clientState;

    setTotals({
      subtotal,
      totalDiscount,
      taxableAmount: subtotal - totalDiscount,
      cgst: isInterstate ? 0 : taxTotal / 2,
      sgst: isInterstate ? 0 : taxTotal / 2,
      igst: isInterstate ? taxTotal : 0,
      total: subtotal - totalDiscount + taxTotal
    });
  }, [items, client.state, profile?.state, showGST]);

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    if (field === 'name') {
      setProductSearch({ itemId: id, query: value });
    }
  };

  const selectProduct = (itemId, product) => {
    setItems(prev => prev.map(item => item.id === itemId ? {
      ...item,
      name: product.name,
      hsn: product.hsn || '',
      rate: product.rate || 0,
      taxPercent: product.taxPercent ?? 18,
      productId: product.id,
    } : item));
    setProductSearch({ itemId: null, query: '' });
  };

  const getProductSuggestions = (itemId) => {
    if (productSearch.itemId !== itemId || !productSearch.query.trim()) return [];
    const q = productSearch.query.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) || p.hsn?.toLowerCase().includes(q)
    ).slice(0, 5);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now().toString(), name: '', hsn: '', quantity: 1, rate: 0, discount: 0,
      taxPercent: showGST ? 18 : 0
    }]);
  };

  const removeItem = (id) => {
    if (items.length > 1) setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleTermsSelect = (templateId) => {
    setSelectedTermsId(templateId);
    const tpl = termsTemplates.find(t => t.id === templateId);
    if (tpl) setCustomTerms(tpl.content);
  };

  const selectSavedClient = (cli) => {
    setClient({ name: cli.name, address: cli.address || '', city: cli.city || '', pin: cli.pin || '', state: cli.state || '', gstin: cli.gstin || '' });
    setSelectedClientId(cli.id);
    setShowClientSuggestions(false);
    toast(`Loaded client: ${cli.name}`, 'info');
  };

  // Open modal to add new client (pre-fill from current invoice fields)
  const openAddClientModal = () => {
    setModalClient({ name: client.name || '', address: client.address || '', city: client.city || '', pin: client.pin || '', state: client.state || '', gstin: client.gstin || '' });
    setIsEditingClient(false);
    setShowClientModal(true);
    setShowClientSuggestions(false);
  };

  // Open modal to edit existing saved client
  const openEditClientModal = (cli) => {
    setModalClient(cli);
    setIsEditingClient(true);
    setShowClientModal(true);
  };

  // Save from modal (add or update)
  const handleClientModalSave = async (formData) => {
    const data = { ...formData };
    if (isEditingClient && modalClient?.id) data.id = modalClient.id;
    await saveClient(data);
    const updated = await getAllClients();
    setSavedClients(updated);
    // Also update the invoice form fields
    setClient({ name: data.name, address: data.address, city: data.city || '', pin: data.pin || '', state: data.state, gstin: data.gstin });
    if (isEditingClient && modalClient?.id) {
      setSelectedClientId(modalClient.id);
      toast(`Client "${data.name}" updated!`, 'success');
    } else {
      const found = updated.find(c => c.name === data.name.trim() && !savedClients.some(old => old.id === c.id));
      if (found) setSelectedClientId(found.id);
      toast(`Client "${data.name}" saved!`, 'success');
    }
    setShowClientModal(false);
  };

  // Filter saved clients based on typed name
  const filteredClients = client.name.trim()
    ? savedClients.filter(cli => cli.name.toLowerCase().includes(client.name.trim().toLowerCase()))
    : savedClients;

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientSuggestionsRef.current && !clientSuggestionsRef.current.contains(e.target) &&
          clientNameRef.current && !clientNameRef.current.contains(e.target)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveInvoiceToDB = async (skipStockDeduction = false) => {
    const bill = {
      id: details.invoiceNumber,
      clientName: client.name,
      invoiceNumber: details.invoiceNumber,
      invoiceDate: details.invoiceDate,
      invoiceType,
      totalAmount: totals.total,
      totalTaxAmount: totals.cgst + totals.sgst + totals.igst,
      status: editingBill?.status || 'unpaid',
      paidAmount: editingBill?.paidAmount || 0,
      payments: editingBill?.payments || [],
      data: { profile, client, details, items, totals, invoiceType, customTerms, customNotes, internalNote, extraSections, invoiceOptions }
    };
    await saveBill(bill);

    // Auto-deduct stock only once for new invoices (not edits, not auto-saves)
    if (!skipStockDeduction && !stockDeducted.current) {
      stockDeducted.current = true;
      const currentProducts = await getAllProducts();
      const lowStockWarnings = [];

      for (const item of items) {
        if (!item.productId) continue;
        const product = currentProducts.find(p => p.id === item.productId);
        if (!product) continue;

        const updatedStock = (product.stock || 0) - (item.quantity || 0);
        await saveProduct({ ...product, stock: updatedStock });

        if (updatedStock <= 0) {
          lowStockWarnings.push(`${product.name} is now out of stock!`);
        } else if (updatedStock <= 5) {
          lowStockWarnings.push(`${product.name} has only ${updatedStock} left in stock`);
        }
      }

      const refreshed = await getAllProducts();
      setProducts(refreshed);

      for (const warning of lowStockWarnings) {
        toast(warning, 'warning');
      }
    }
  };

  // Upload PDF to Google Drive if configured
  const uploadToGoogleDrive = async (pdfBlob, fileName) => {
    try {
      const latestProfile = await getProfile();
      const clientId = latestProfile.googleClientId;
      const folderName = latestProfile.googleDriveFolder || 'GST Billing Invoices';
      if (!clientId) return;

      const hasToken = await ensureToken(clientId);
      if (!hasToken) {
        toast('Google Drive: Please reconnect in Settings', 'warning');
        return;
      }

      const folderId = await findOrCreateFolder(folderName);
      await uploadPDF(fileName, pdfBlob, folderId);
      toast(`Saved to Google Drive → ${folderName}`, 'success');
    } catch (err) {
      console.error('Google Drive upload error:', err);
      toast('Google Drive upload failed: ' + err.message, 'warning');
    }
  };

  // Shared PDF generation helper
  const buildPDF = async () => {
    const scalerEl = printRef.current.closest('.preview-scaler');
    if (scalerEl) scalerEl.style.transform = 'none';

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const extraPages = printRef.current.querySelectorAll('[data-pdf-page]');

    // Hide extra pages, capture main invoice
    extraPages.forEach(el => el.style.display = 'none');
    const mainCanvas = await html2canvas(printRef.current, {
      scale: 2, useCORS: true,
      width: printRef.current.scrollWidth, height: printRef.current.scrollHeight,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('*').forEach(n => { n.style.letterSpacing = '0px'; n.style.wordSpacing = '0px'; });
        const inv = clonedDoc.getElementById('invoice-preview');
        if (inv) { inv.style.width = '210mm'; inv.style.overflow = 'visible'; inv.style.minHeight = 'unset'; inv.style.border = 'none'; inv.style.boxShadow = 'none'; inv.style.borderRadius = '0'; }
        clonedDoc.querySelectorAll('[data-pdf-page]').forEach(el => el.style.display = 'none');
      }
    });
    extraPages.forEach(el => el.style.display = '');

    // Add main invoice page(s)
    const mainImg = mainCanvas.toDataURL('image/jpeg', 0.92);
    const mainImgHeight = (mainCanvas.height * pdfWidth) / mainCanvas.width;
    if (mainImgHeight <= pdfPageHeight + 2) {
      pdf.addImage(mainImg, 'JPEG', 0, 0, pdfWidth, Math.min(mainImgHeight, pdfPageHeight));
    } else {
      let heightLeft = mainImgHeight, position = 0;
      pdf.addImage(mainImg, 'JPEG', 0, position, pdfWidth, mainImgHeight);
      heightLeft -= pdfPageHeight;
      while (heightLeft > 2) { position -= pdfPageHeight; pdf.addPage(); pdf.addImage(mainImg, 'JPEG', 0, position, pdfWidth, mainImgHeight); heightLeft -= pdfPageHeight; }
    }

    // Capture each extra section as a separate PDF page
    for (const pageEl of extraPages) {
      const c = await html2canvas(pageEl, {
        scale: 2, useCORS: true, width: pageEl.scrollWidth, height: pageEl.scrollHeight,
        onclone: (cd) => { cd.querySelectorAll('*').forEach(n => { n.style.letterSpacing = '0px'; n.style.wordSpacing = '0px'; }); }
      });
      pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfWidth, Math.min((c.height * pdfWidth) / c.width, pdfPageHeight));
    }

    if (scalerEl) scalerEl.style.transform = '';
    return pdf;
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    try {
      setSaving(true);
      const pdf = await buildPDF();
      const fileName = `${typeConfig.prefix}_${details.invoiceNumber.replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
      await saveInvoiceToDB();
      clearDraft();

      const pdfBlob = pdf.output('blob');

      // Save to local "Saved Invoices" folder (Client Name / Month / file.pdf)
      const invoiceDate = details.invoiceDate ? new Date(details.invoiceDate) : new Date();
      const monthName = invoiceDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const clientName = client?.name || 'General';
      const params = new URLSearchParams({ name: fileName, client: clientName, month: monthName });
      fetch(`/api/save-pdf?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: pdfBlob }).catch(() => {});

      toast(`Invoice downloaded & saved to Saved Invoices/${clientName}/`, 'success');
      uploadToGoogleDrive(pdfBlob, fileName);
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = () => {
    const phone = client?.phone ? client.phone.replace(/\D/g, '') : '';
    const amount = formatCurrency(items.reduce((s, i) => s + (i.quantity * i.rate), 0));
    const msg = `*Invoice: ${details.invoiceNumber}*\nClient: ${client?.name || ''}\nAmount: ${amount}\nDate: ${details.invoiceDate}`;
    const encoded = encodeURIComponent(msg);
    const waUrl = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.location.href = waUrl;
  };

  const exportEWayBill = () => {
    if (!profile?.gstin) { toast('Set your GSTIN in Settings first', 'warning'); return; }
    const ewb = generateEWayBillJSON(profile, client, details, items, totals, invoiceType);
    const blob = new Blob([JSON.stringify(ewb, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EWB-${details.invoiceNumber?.replace(/\//g, '-') || 'draft'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('E-Way Bill JSON downloaded', 'success');
  };

  return (
    <div className="generator-container">
      <div className="generator-toolbar">
        <div className="flex gap-2 items-center">
          <button className="btn btn-secondary" onClick={() => { clearDraft(); onBack(); }}><ArrowLeft size={18} /> Back</button>
          <span style={{ fontSize: '0.78rem', color: autoSaveStatus === 'saving' ? 'var(--text-muted)' : '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
            {autoSaveStatus === 'saving' && <><Loader size={13} className="spin" /> Saving...</>}
            {autoSaveStatus === 'saved' && <><Check size={13} /> All changes saved</>}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={generatePDF} disabled={saving}>
            <Download size={18} /> {saving ? 'Generating...' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary" onClick={shareWhatsApp} disabled={saving} style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }}>
            <MessageCircle size={18} /> WhatsApp
          </button>
          {(invoiceType === 'tax-invoice' || invoiceType === 'delivery-challan') && (
            <button className="btn btn-secondary" onClick={exportEWayBill} title="Download E-Way Bill JSON for NIC portal upload">
              <Truck size={18} /> E-Way Bill
            </button>
          )}
        </div>
      </div>

      <div className="split-view">
        <div className="editor-pane">

          {/* Invoice Type */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center">
              <h3 className="section-title" style={{ margin: 0 }}>Invoice Type</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setShowOptions(!showOptions)}>
                <Settings size={15} /> {showOptions ? 'Hide Options' : 'Customize'}
              </button>
            </div>
            <div className="type-selector" style={{ marginTop: '0.75rem' }}>
              {Object.entries(INVOICE_TYPES).map(([key, val]) => (
                <button key={key} className={`type-chip ${invoiceType === key ? 'type-chip-active' : ''}`}
                  onClick={() => handleTypeChange(key)}>{val.label}</button>
              ))}
            </div>
            <p className="type-desc">{typeConfig?.description}</p>

            {/* Customization Options */}
            {showOptions && (
              <div className="invoice-options">
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Invoice Title</label>
                  <input type="text" className="form-input" value={invoiceOptions.customTitle}
                    onChange={(e) => setInvoiceOptions(prev => ({ ...prev, customTitle: e.target.value }))}
                    placeholder={typeConfig?.title || 'TAX INVOICE'} />
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={invoiceOptions.currency}
                    onChange={(e) => setInvoiceOptions(prev => ({ ...prev, currency: e.target.value }))}>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                    <option value="CAD">CAD (Canadian Dollar)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">PDF Style</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {PDF_STYLES.map(s => (
                      <button key={s.id} type="button"
                        className={`type-chip ${(invoiceOptions.pdfStyle || 'classic') === s.id ? 'type-chip-active' : ''}`}
                        onClick={() => setInvoiceOptions(prev => ({ ...prev, pdfStyle: s.id }))}
                        title={s.desc}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Accent Color</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" title="Auto (match invoice type)"
                      style={{ width: '28px', height: '28px', borderRadius: '50%', border: !invoiceOptions.accentColor ? '2.5px solid #334155' : '2px solid #cbd5e1', background: 'conic-gradient(#1e40af, #7c3aed, #0f766e, #be123c, #1e40af)', cursor: 'pointer', position: 'relative' }}
                      onClick={() => setInvoiceOptions(prev => ({ ...prev, accentColor: '' }))}>
                      {!invoiceOptions.accentColor && <span style={{ position: 'absolute', inset: '3px', borderRadius: '50%', border: '2px solid white' }} />}
                    </button>
                    {ACCENT_PRESETS.map(p => (
                      <button key={p.color} type="button" title={p.label}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: p.color, border: invoiceOptions.accentColor === p.color ? '2.5px solid #334155' : '2px solid #cbd5e1', cursor: 'pointer', position: 'relative' }}
                        onClick={() => setInvoiceOptions(prev => ({ ...prev, accentColor: p.color }))}>
                        {invoiceOptions.accentColor === p.color && <span style={{ position: 'absolute', inset: '3px', borderRadius: '50%', border: '2px solid white' }} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="options-grid">
                  {[
                    ['showLogo', 'Logo'],
                    ['showSignature', 'Signature'],
                    ['showGST', 'GST'],
                    ['showState', 'State'],
                    ['showGSTIN', 'GSTIN'],
                    ['showPlaceOfSupply', 'Place of Supply'],
                    ['showHSN', 'HSN/SAC'],
                    ['showDiscount', 'Discount'],
                    ['showItemQty', 'Qty Column'],
                    ['showDueDate', 'Due Date'],
                    ['showAmountWords', 'Amount in Words'],
                    ['showBankDetails', 'Bank Details'],
                    ['showUPI', 'UPI QR Code'],
                    ['showTerms', 'Terms & Conditions'],
                    ['showNotes', 'Notes / Remarks'],
                  ].map(([key, label]) => (
                    <label key={key} className="option-toggle">
                      <input type="checkbox" checked={invoiceOptions[key] !== false} onChange={() => toggleOption(key)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Client Modal */}
          <ClientModal show={showClientModal} onClose={() => setShowClientModal(false)} onSave={handleClientModalSave} client={modalClient} isEditing={isEditingClient} />

          {/* Client Details */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Billed To</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width" style={{ position: 'relative' }}>
                <label className="form-label">Client Name</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="text" className="form-input" style={{ flex: 1 }} value={client.name} ref={clientNameRef}
                    onChange={(e) => {
                      setClient({ ...client, name: e.target.value });
                      setSelectedClientId(null);
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => { if (savedClients.length > 0) setShowClientSuggestions(true); }}
                    placeholder="Type client name to search or add new" autoComplete="off" />
                  {selectedClientId && (
                    <button type="button" className="btn-client-edit" onClick={() => openEditClientModal(savedClients.find(c => c.id === selectedClientId))} title="Edit saved client">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {showClientSuggestions && savedClients.length > 0 && (
                  <div className="client-suggestions" ref={clientSuggestionsRef}>
                    {filteredClients.length > 0 && filteredClients.map(cli => (
                      <div key={cli.id} className="client-suggestion-row">
                        <button type="button" className="client-suggestion-item" onClick={() => selectSavedClient(cli)}>
                          <div className="client-suggestion-main">
                            <strong>{cli.name}</strong>
                            {(cli.city || cli.address) && <small className="client-suggestion-addr">{cli.city || cli.address.substring(0, 30)}{!cli.city && cli.address.length > 30 ? '...' : ''}</small>}
                          </div>
                          <span>{cli.state}{cli.gstin ? ` · ${cli.gstin}` : ''}</span>
                        </button>
                        <button type="button" className="client-suggestion-edit" onClick={() => { openEditClientModal(cli); setShowClientSuggestions(false); }} title="Edit client">
                          <Pencil size={12} />
                        </button>
                      </div>
                    ))}
                    {client.name.trim() && (
                      <button type="button" className="client-suggestion-save" onClick={openAddClientModal}>
                        <UserPlus size={14} /> Save "{client.name.trim()}" as new client
                      </button>
                    )}
                    {filteredClients.length === 0 && !client.name.trim() && (
                      <div className="client-picker-empty">Type to search clients</div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group full-width">
                <label className="form-label">Billing Address</label>
                <input type="text" className="form-input" value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Street address, locality" />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" value={client.city}
                  onChange={(e) => setClient({ ...client, city: e.target.value })} placeholder="e.g. Mumbai" />
              </div>
              <div className="form-group">
                <label className="form-label">PIN Code</label>
                <input type="text" className="form-input" value={client.pin}
                  onChange={(e) => setClient({ ...client, pin: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 400001" maxLength={6} />
              </div>
              {invoiceOptions.showState && (
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select className="form-input" value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value })}>
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {invoiceOptions.showGSTIN && (
                <div className="form-group">
                  <label className="form-label">GSTIN</label>
                  <input type="text" className="form-input" value={client.gstin}
                    onChange={(e) => setClient({ ...client, gstin: e.target.value.toUpperCase() })} placeholder="Optional" maxLength={15} />
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" value={details.invoiceNumber}
                  onChange={(e) => setDetails({ ...details, invoiceNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-input" value={details.invoiceDate}
                  onChange={(e) => setDetails({ ...details, invoiceDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={details.dueDate}
                  onChange={(e) => setDetails({ ...details, dueDate: e.target.value })} />
              </div>
              {invoiceOptions.showPlaceOfSupply && (
                <div className="form-group">
                  <label className="form-label">Place of Supply</label>
                  <select className="form-input" value={details.placeOfSupply}
                    onChange={(e) => setDetails({ ...details, placeOfSupply: e.target.value })}>
                    <option value="">Defaults to Client State</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {invoiceType === 'credit-note' && (
                <div className="form-group full-width">
                  <label className="form-label">Original Invoice Reference</label>
                  <input type="text" className="form-input" value={details.originalInvoiceRef}
                    onChange={(e) => setDetails({ ...details, originalInvoiceRef: e.target.value })} placeholder="e.g. INV/2025-26/0001" />
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Line Items</h3>
            {items.map((item) => (
              <div key={item.id} className="line-item-row">
                <div className="line-item-field" style={{ flex: 2.5, position: 'relative' }}>
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    onBlur={() => setTimeout(() => setProductSearch({ itemId: null, query: '' }), 200)}
                    autoComplete="off" />
                  {getProductSuggestions(item.id).length > 0 && (
                    <div className="product-suggestions">
                      {getProductSuggestions(item.id).map(p => (
                        <div key={p.id} className="product-suggestion-item"
                          onMouseDown={() => selectProduct(item.id, p)}>
                          <span className="product-suggestion-name">{p.name}</span>
                          <span className="product-suggestion-meta">
                            {p.hsn && `HSN: ${p.hsn}`}{p.hsn && p.rate ? ' · ' : ''}{p.rate ? `₹${p.rate}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {invoiceOptions.showHSN && (
                  <div className="line-item-field" style={{ flex: 1 }}>
                    <label className="form-label">HSN/SAC</label>
                    <input type="text" className="form-input" value={item.hsn}
                      onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)} />
                  </div>
                )}
                <div className="line-item-field" style={{ flex: 0.8 }}>
                  <label className="form-label">Qty</label>
                  <input type="number" min="1" className="form-input" value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="line-item-field" style={{ flex: 1.2 }}>
                  <label className="form-label">Rate</label>
                  <input type="number" min="0" className="form-input" value={item.rate}
                    onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)} />
                </div>
                {invoiceOptions.showDiscount && (
                  <div className="line-item-field" style={{ flex: 1 }}>
                    <label className="form-label">Discount</label>
                    <input type="number" min="0" className="form-input" value={item.discount}
                      onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)} />
                  </div>
                )}
                {showGST && (
                  <div className="line-item-field" style={{ flex: 0.8 }}>
                    <label className="form-label">Tax %</label>
                    <select className="form-input" value={item.taxPercent}
                      onChange={(e) => handleItemChange(item.id, 'taxPercent', parseFloat(e.target.value) || 0)}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                )}
                <div className="line-item-field line-item-delete">
                  <button className="icon-btn icon-btn-red" onClick={() => removeItem(item.id)} title="Remove"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary mt-2" onClick={addItem}><Plus size={18} /> Add Item</button>
          </div>

          {/* Terms */}
          <div className="glass-panel p-6 mb-6">
            <h3 className="section-title">Terms & Conditions</h3>
            {termsTemplates.length > 0 && (
              <div className="form-group">
                <label className="form-label">Load from Template</label>
                <select className="form-input" value={selectedTermsId} onChange={(e) => handleTermsSelect(e.target.value)}>
                  <option value="">-- Custom --</option>
                  {termsTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Terms (appears on invoice)</label>
              <textarea rows="5" className="form-input" value={customTerms}
                onChange={(e) => { setCustomTerms(e.target.value); setSelectedTermsId(''); }}
                placeholder="Enter or paste your terms & conditions..." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Remarks (optional)</label>
              <textarea rows="3" className="form-input" value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Project details, special instructions, additional notes..." />
            </div>
            <div className="form-group" style={{ background: '#fefce8', border: '1px dashed #ca8a04', borderRadius: 8, padding: '0.75rem 1rem' }}>
              <label className="form-label" style={{ color: '#92400e', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v4m0 4h.01"/></svg>
                Private Note (not shown on invoice)
              </label>
              <textarea rows="2" className="form-input" value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                style={{ background: '#fffef5', fontSize: '0.82rem' }}
                placeholder="e.g. Client asked for 15-day credit, follow up on 20th, referred by Ravi..." />
            </div>
          </div>

          {/* Extra Sections */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Additional Pages / Sections</h3>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setExtraSections(prev => [...prev, { id: Date.now().toString(), title: '', content: '' }])}>
                <Plus size={15} /> Add Section
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Add extra sections that appear after the invoice footer. You can paste formatted HTML content (bold, lists, tables, etc.).
            </p>
            {extraSections.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No extra sections. Click "Add Section" to create one.</p>
            ) : (
              extraSections.map((section, idx) => (
                <div key={section.id} className="extra-section-editor">
                  <div className="flex gap-2 items-center mb-2">
                    <input type="text" className="form-input" value={section.title}
                      onChange={(e) => setExtraSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                      placeholder="Section title (e.g. Scope of Work, Delivery Timeline)" style={{ flex: 1 }} />
                    <button className="icon-btn" onClick={() => {
                      if (idx > 0) setExtraSections(prev => { const arr = [...prev]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; return arr; });
                    }} title="Move up" disabled={idx === 0}><ChevronUp size={14} /></button>
                    <button className="icon-btn" onClick={() => {
                      if (idx < extraSections.length - 1) setExtraSections(prev => { const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr; });
                    }} title="Move down" disabled={idx === extraSections.length - 1}><ChevronDown size={14} /></button>
                    <button className="icon-btn icon-btn-red" onClick={() => setExtraSections(prev => prev.filter(s => s.id !== section.id))} title="Remove"><Trash2 size={14} /></button>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <RichEditor
                      value={section.content}
                      onChange={(html) => setExtraSections(prev => prev.map(s => s.id === section.id ? { ...s, content: html } : s))}
                      placeholder="Type or paste formatted content here (supports bold, lists, tables from Word/Docs)..." />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Preview */}
        <div className="preview-pane">
          <div className="preview-pane-label">PDF Preview — This is how your invoice will look</div>
          <div className="preview-scaler">
            <InvoicePreview ref={printRef} profile={profile} client={client} details={details}
              items={items} totals={totals} invoiceType={invoiceType} customTerms={customTerms}
              customNotes={customNotes} extraSections={extraSections} options={invoiceOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
