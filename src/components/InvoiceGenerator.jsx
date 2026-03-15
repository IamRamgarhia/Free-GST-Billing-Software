import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Download, Save, UserPlus, Users, Settings, ChevronUp, ChevronDown, MessageCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveBill, getNextInvoiceNumber, getTermsTemplates, getAllClients, saveClient, getProfile } from '../store';
import { INDIAN_STATES, INVOICE_TYPES } from '../utils';
import { ensureToken, findOrCreateFolder, uploadPDF } from '../services/googleDrive';
import InvoicePreview from './InvoicePreview';
import { toast } from './Toast';

// Rich text editor component that works with contentEditable properly
function RichEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (ref.current && !isInitialized.current) {
      ref.current.innerHTML = value || '';
      isInitialized.current = true;
    }
  }, []);

  // Update if value changes externally (e.g. draft restore, editing bill)
  useEffect(() => {
    if (ref.current && isInitialized.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
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
};

export default function InvoiceGenerator({ onBack, profile, editingBill }) {
  const draft = loadDraft();
  const [invoiceType, setInvoiceType] = useState(draft?.invoiceType || 'tax-invoice');
  const [client, setClient] = useState(draft?.client || { name: '', address: '', state: '', gstin: '' });
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
  const [extraSections, setExtraSections] = useState(draft?.extraSections || []);
  const [savedClients, setSavedClients] = useState([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState(draft?.invoiceOptions || { ...DEFAULT_OPTIONS });
  const [showOptions, setShowOptions] = useState(false);
  const printRef = useRef(null);
  const draftInitialized = useRef(!!draft);

  const typeConfig = INVOICE_TYPES[invoiceType];
  const showGST = invoiceOptions.showGST;

  // Auto-save draft to sessionStorage
  useEffect(() => {
    const draftData = { invoiceType, client, details, items, customTerms, customNotes, extraSections, selectedTermsId, invoiceOptions };
    sessionStorage.setItem('gst_invoiceDraft', JSON.stringify(draftData));
  }, [invoiceType, client, details, items, customTerms, customNotes, extraSections, selectedTermsId, invoiceOptions]);

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
    getAllClients().then(setSavedClients);
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
      if (d.extraSections) setExtraSections(d.extraSections);
      if (d.invoiceOptions) setInvoiceOptions(d.invoiceOptions);

      if (editingBill._isDuplicate) {
        const type = d.invoiceType || 'tax-invoice';
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
      cgst: isInterstate ? 0 : taxTotal / 2,
      sgst: isInterstate ? 0 : taxTotal / 2,
      igst: isInterstate ? taxTotal : 0,
      total: subtotal - totalDiscount + taxTotal
    });
  }, [items, client.state, profile?.state, showGST]);

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
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
    setClient({ name: cli.name, address: cli.address, state: cli.state, gstin: cli.gstin });
    setShowClientPicker(false);
    toast(`Loaded client: ${cli.name}`, 'info');
  };

  const handleSaveClient = async () => {
    if (!client.name.trim()) { toast('Enter client name first', 'warning'); return; }
    await saveClient({ name: client.name, address: client.address, state: client.state, gstin: client.gstin });
    toast(`Client "${client.name}" saved!`, 'success');
    setSavedClients(await getAllClients());
  };

  const saveInvoiceToDB = async () => {
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
      data: { profile, client, details, items, totals, invoiceType, customTerms, customNotes, extraSections, invoiceOptions }
    };
    await saveBill(bill);
  };

  // Upload PDF to Google Drive if configured
  const uploadToGoogleDrive = async (pdfBlob, fileName) => {
    try {
      const latestProfile = await getProfile();
      const clientId = latestProfile.googleClientId;
      const folderName = latestProfile.googleDriveFolder || 'BillKaro Invoices';
      if (!clientId) return;

      const hasToken = await ensureToken(clientId);
      if (!hasToken) {
        toast('Google Drive: Please reconnect in Settings', 'warning');
        return;
      }

      const folderId = await findOrCreateFolder(folderName);
      await uploadPDF(fileName, pdfBlob, folderId);
      toast('Uploaded to Google Drive!', 'success');
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
        if (inv) { inv.style.width = '210mm'; inv.style.overflow = 'visible'; inv.style.minHeight = 'unset'; }
        clonedDoc.querySelectorAll('[data-pdf-page]').forEach(el => el.style.display = 'none');
      }
    });
    extraPages.forEach(el => el.style.display = '');

    // Add main invoice page(s)
    const mainImg = mainCanvas.toDataURL('image/jpeg', 0.92);
    const mainImgHeight = (mainCanvas.height * pdfWidth) / mainCanvas.width;
    if (mainImgHeight <= pdfPageHeight) {
      pdf.addImage(mainImg, 'JPEG', 0, 0, pdfWidth, mainImgHeight);
    } else {
      let heightLeft = mainImgHeight, position = 0;
      pdf.addImage(mainImg, 'JPEG', 0, position, pdfWidth, mainImgHeight);
      heightLeft -= pdfPageHeight;
      while (heightLeft > 0) { position -= pdfPageHeight; pdf.addPage(); pdf.addImage(mainImg, 'JPEG', 0, position, pdfWidth, mainImgHeight); heightLeft -= pdfPageHeight; }
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
      toast('Invoice downloaded & saved!', 'success');

      const pdfBlob = pdf.output('blob');
      uploadToGoogleDrive(pdfBlob, fileName);
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = async () => {
    if (!printRef.current) return;
    try {
      setSaving(true);
      const pdf = await buildPDF();
      const fileName = `${typeConfig.prefix}_${details.invoiceNumber.replace(/\//g, '-')}.pdf`;
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Try Web Share API with PDF attachment
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        const msg = `Invoice: ${details.invoiceNumber}\nClient: ${client?.name || ''}\nAmount: ${formatCurrency(items.reduce((s, i) => s + (i.quantity * i.rate), 0))}`;
        await navigator.share({ title: `Invoice ${details.invoiceNumber}`, text: msg, files: [pdfFile] });
        toast('Shared successfully!', 'success');
      } else {
        // Fallback: open WhatsApp with text
        const phone = client?.phone ? client.phone.replace(/\D/g, '') : '';
        const msg = `*Invoice: ${details.invoiceNumber}*\nClient: ${client?.name || ''}\nAmount: ${formatCurrency(items.reduce((s, i) => s + (i.quantity * i.rate), 0))}\nDate: ${details.invoiceDate}`;
        const encoded = encodeURIComponent(msg);
        const desktopUrl = `whatsapp://send?${phone ? `phone=${phone}&` : ''}text=${encoded}`;
        const webUrl = `https://web.whatsapp.com/send?${phone ? `phone=${phone}&` : ''}text=${encoded}`;

        window.open(desktopUrl, '_self');
        setTimeout(() => {
          if (!document.hidden) window.open(webUrl, '_blank');
        }, 1500);
        toast('PDF not attached — use Download + share manually, or try on mobile.', 'info', 5000);
      }

      await saveInvoiceToDB();
      clearDraft();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        toast('Failed to share.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    try {
      setSaving(true);
      await saveInvoiceToDB();
      clearDraft();
      toast('Invoice saved!', 'success');
      onBack();
    } catch (err) {
      console.error(err);
      toast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="generator-container">
      <div className="generator-toolbar">
        <button className="btn btn-secondary" onClick={() => { clearDraft(); onBack(); }}><ArrowLeft size={18} /> Back</button>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleSaveOnly} disabled={saving}><Save size={18} /> Save Only</button>
          <button className="btn btn-primary" onClick={generatePDF} disabled={saving}>
            <Download size={18} /> {saving ? 'Generating...' : 'Download PDF'}
          </button>
          <button className="btn btn-secondary" onClick={shareWhatsApp} disabled={saving} style={{ background: '#25d366', color: '#fff', borderColor: '#25d366' }}>
            <MessageCircle size={18} /> WhatsApp
          </button>
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

          {/* Client Details */}
          <div className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title" style={{ margin: 0 }}>Billed To</h3>
              <div className="flex gap-2">
                {savedClients.length > 0 && (
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => setShowClientPicker(!showClientPicker)}>
                    <Users size={15} /> {showClientPicker ? 'Hide' : 'Saved Clients'}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={handleSaveClient} title="Save current client for future use">
                  <UserPlus size={15} /> Save Client
                </button>
              </div>
            </div>

            {/* Client picker dropdown */}
            {showClientPicker && savedClients.length > 0 && (
              <div className="client-picker">
                {savedClients.map(cli => (
                  <button key={cli.id} className="client-picker-item" onClick={() => selectSavedClient(cli)}>
                    <strong>{cli.name}</strong>
                    <span>{cli.state}{cli.gstin ? ` | ${cli.gstin}` : ''}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group full-width">
                <label className="form-label">Client Name</label>
                <input type="text" className="form-input" value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Company or Individual" />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Billing Address</label>
                <textarea rows="2" className="form-input" value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Full billing address" />
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
                <div className="line-item-field" style={{ flex: 2.5 }}>
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} />
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
