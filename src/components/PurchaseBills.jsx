import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { ShoppingCart, Plus, Edit3, Trash2, Search, X, Save, Download, Wand2, Eye, ClipboardList, IndianRupee, RotateCcw, FileText } from 'lucide-react';
import HelpButton from './HelpButton';
import PageHeader, { BarButton } from './PageHeader';
import { getAllPurchases, savePurchase, deletePurchase, getAllProducts, saveProduct, getProfile, getEnabledModules, getAllPurchaseOrders, savePurchaseOrder, getNextPoNumber, getAllDebitNotes, saveDebitNote } from '../store';
import { formatCurrency, getFYOptions, belongsToProfile, isUnassignedToBusiness, isInterstateSupply, localToday, roundQty, splitPurchaseTax, isModuleEnabled, businessKeyOf, getAllUnits, TDS_SECTIONS_2025, tdsSectionsFor, movedSection, sectionOptionLabel, sectionShort } from '../utils';
import { purchaseTdsAmount } from '../utils/tdsTcs';
import { purchaseTotals as calcPurchaseTotal, billFormFromPo, purchaseLineTax, purchaseUnitCost, lineDiscountFields, purchaseHasSerial } from '../utils/purchaseOrders';
import PurchaseOrders from './PurchaseOrders';
import TableExport from './TableExport';
import ActionsMenu from './ActionsMenu';
import BulkCsvImport from './BulkCsvImport';
import UnassignedBanner from './UnassignedBanner';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import { useCostCentres } from './useCostCentres';
import { CostCentreSelect, CostCentreFilter } from './CostCentrePicker';
import { matchesCentre, centreFields } from '../utils/costCentres';
import { PURCHASE_STATUS_LABEL, OVERPAY_SLACK, purchaseStatus, purchaseBalance, purchasePaid, purchaseOwed, purchaseRcmTax, hasPurchasePayments, withPurchasePayments, markPurchasePaid, markPurchaseUnpaid, purchasePaymentModeName, purchasePaymentDue } from '../utils/purchasePayments';
import PurchasePaymentModal from './PurchasePaymentModal';
import DebitNotesList, { ReturnToSupplierModal } from './DebitNotes';
import { askPaidMode } from './askPaidMode';
import { withReturns, returnableLines, debitNoteTotals, editProblem, notesToRestamp } from '../utils/debitNotes';
// v1.10.85 (#137, #158) - barcodes: labels for a bill, and a scanned code in
// the item name box. Kept to these imports, one state, one button, one modal
// and one onKeyDown, marked "#137 barcodes" below.
import { Barcode } from 'lucide-react';
import BarcodeLabels from './BarcodeLabels';
import { findByBarcode } from '../utils/barcode';
// v1.10.85 (#148) - alternate units on a purchase line, and the low-stock PO
// handed over from Products or the Dashboard.
import { baseQty, lineFactor, altLineFields } from '../utils';
import { hasAltUnit, lineInUnit } from '../utils/stock';
import { takeReorderDraft } from '../utils/reorderDraft';
// v1.10.86 - sort by a column header, remembered in this browser.
import { useListSort, sortRows } from '../utils/listPrefs';
import SortTh from './SortTh';

const SORT_GETTERS = {
  date: (p) => p.date,
  supplier: (p) => p.supplierName,
  invoice: (p) => p.invoiceNumber,
  taxable: (p) => calcPurchaseTotal(p.items, !!p.applyRoundOff).taxable,
  tax: (p) => calcPurchaseTotal(p.items, !!p.applyRoundOff).tax,
  total: (p) => calcPurchaseTotal(p.items, !!p.applyRoundOff).finalTotal,
  balance: (p) => purchaseBalance(p),
  status: (p) => purchaseStatus(p),
};
// v1.10.86 - (#148, #194) a supplier's statement, from the Purchase Records header.
import SupplierStatement from './SupplierStatement';
import ComboInput from './ComboInput';
// v1.10.86 - (#175) a bill handed over from GST Returns -> GSTR-2B ("2B only").
import { takeTwoBDraft, isTwoBPlaceholder, markBackToTwoB } from '../utils/gstr2bBill';

// v1.10.31 — UI-C3: Same accent-color helper as ClientsView so the
// Purchase Bill PDF header rule + totals line pick up the user's brand.
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore */ }
  return [30, 64, 175];
}

// v1.10.22 — Purchase-bill OCR modal. Lazy-loaded because tesseract.js is
// ~2MB gzipped; we only pay the download cost when the user actually
// opens the OCR flow.
const BillOCR = lazy(() => import('./BillOCR'));

const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partial'];

// v1.10.69 (#71 item 3) - the same three colours the pill used, now shared
// with the dropdown in the records table.
const PAYMENT_STATUS_COLORS = {
  Unpaid:  { bg: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b' },
  Paid:    { bg: 'rgba(5, 150, 105, 0.14)',  color: '#059669' },
  Partial: { bg: 'rgba(139, 92, 246, 0.14)', color: '#8b5cf6' },
};

// cessPercent added in v1.6.8 (P1 #16) — suppliers of tobacco / aerated
// drinks / motor vehicles / coal charge GST + Cess. Without a slot for it,
// we couldn't reclaim ITC on the cess in GSTR-3B Table 4(A).
// v1.10.83 (#112) - unit is shown on purchase orders only; a bill made from
// a PO keeps it for the products it adds.
// _auto marks the 18% default as not typed by the user (see isOursToReplace),
// so picking a 12% product sets 12%. Before, the default was never replaced
// and every product picked on a new row came in at 18%.
const emptyItem = { name: '', hsn: '', quantity: 1, unit: '', rate: 0, taxPercent: 18, cessPercent: 0, _auto: { taxPercent: 18 } };


const emptyForm = {
  date: '', // v1.10.74 - set to localToday() when the form opens
  supplierName: '',
  // v1.10.29 — supplier address for the PDF header. Optional; blank
  // pre-v1.10.29 records fall through gracefully.
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  items: [{ ...emptyItem }],
  paymentStatus: 'Unpaid',
  interstate: false, // true ⇒ supplier charged IGST; false ⇒ CGST + SGST. Routes ITC correctly in GSTR-3B.
  reverseCharge: false, // v1.10.86 - you pay the GST yourself (GSTR-3B 3.1(d)); off for every older bill
  applyRoundOff: false, // off by default — purchase bill totals are usually pre-rounded by the supplier. Users with suppliers that don't pre-round can opt in here.
  note: '',
  // v1.10.83 (#112) - the same form edits purchase orders (kind 'po'): it
  // already knows suppliers, products and the GST split. fromPo links a bill
  // to the order it was made from.
  kind: 'bill',
  poNumber: '',
  expectedDate: '',
  fromPo: '',
  // v1.10.83 (#112) - optional; see utils/costCentres.js
  costCentre: '',
  costCentreName: '',
  // v1.10.83 - TDS you deduct from the supplier (194C, 194J...): worked out on
  // the value before GST at tdsRate, or the amount typed in tdsAmountManual.
  tdsOn: false,
  tdsSection: '194C',
  tdsRate: 1,
  tdsAmountManual: '',
};

// v1.10.83 (#112) - calcItemTax / calcPurchaseTotal moved to
// utils/purchaseOrders.js unchanged, shared with purchase orders.

// v1.10.6 — audit L4: local copy removed, imported from utils above.

// v1.10.85 (#171, #160) - the small print under a line's name: its discount
// and its serial numbers / IMEI.
const lineNote = (it) => [
  (Number(it?.discount) || 0) > 0 ? `Discount ${it.discountType === 'percent' ? `${it.discount}%` : formatCurrency(it.discount)}` : '',
  String(it?.serialNo || '').trim() ? `S/N: ${String(it.serialNo).trim()}` : '',
].filter(Boolean).join(' · ');
// v1.10.85 - the Discount and Serial No. columns of the form: shown when
// switched on (remembered in this browser) or when a line already has one.
const COLS_KEY = 'fgsb_purchaseLineCols';
const savedCols = () => { try { return JSON.parse(localStorage.getItem(COLS_KEY) || '{}') || {}; } catch { return {}; } };

// The TDS fields stored on a purchase bill (cleared when TDS is off).
const purchaseTdsFields = (form, taxable) => {
  if (!form.tdsOn) return { tdsAmount: 0, tdsSection: '', tdsRate: 0, tdsManual: false };
  const manual = String(form.tdsAmountManual ?? '').trim();
  return {
    tdsSection: form.tdsSection || '194C',
    tdsRate: parseFloat(form.tdsRate) || 0,
    tdsAmount: purchaseTdsAmount(taxable, form.tdsRate, manual),
    tdsManual: manual !== '',
  };
};

export default function PurchaseBills({ onOpenGstReturns } = {}) {
  const [purchases, setPurchases] = useState([]);
  // v1.10.65 (#58 item 3) — the business these records belong to.
  const [ownerProfile, setOwnerProfile] = useState(null);
  // v1.10.54 (#42) — the Products & Services master, used to seed item
  // suggestions. Loaded on mount alongside purchases.
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [centreFilter, setCentreFilter] = useState('');
  const { on: ccOn, centres } = useCostCentres(ownerProfile);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, items: [{ ...emptyItem }] });
  // v1.10.85 (#171, #160) - optional Discount and Serial No. columns.
  const [lineCols, setLineCols] = useState(savedCols);
  const toggleLineCol = (key) => setLineCols(prev => {
    const next = { ...prev, [key]: !prev[key] };
    try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  const showDiscountCol = !!lineCols.discount || form.items.some(i => (Number(i.discount) || 0) > 0);
  const showSerialCol = !!lineCols.serial || form.items.some(i => String(i.serialNo || '').trim());
  // v1.10.22 — OCR modal state.
  const [showOCR, setShowOCR] = useState(false);
  // v1.10.30 — reported: "add a view only option modal type so can user
  // check the price without downloading the file every time". Holds the
  // purchase being previewed; modal has a Download PDF button inside.
  const [viewPurchase, setViewPurchase] = useState(null);
  // #137 barcodes - the bill whose labels are being printed.
  const [labelBill, setLabelBill] = useState(null);
  // v1.10.83 (#123) - the bill whose supplier payments are open, and the
  // status filter ('' all, 'due' unpaid or partly paid, 'Paid').
  const [payPurchase, setPayPurchase] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  // v1.10.83 (#112) - purchase orders, when switched on in Settings -> Features.
  const [poEnabled] = useState(() => isModuleEnabled('purchaseOrders', getEnabledModules()));
  const [tab, setTab] = useState('bills');
  const [orders, setOrders] = useState([]);
  // v1.10.85 (#168) - purchase returns, and the bill being returned.
  const [debitNotes, setDebitNotes] = useState([]);
  const [returnBill, setReturnBill] = useState(null);
  const [statementFor, setStatementFor] = useState(null); // v1.10.86 - (#194) '' or a supplier name: statement open
  // The number shown on a new PO; only that one is swapped for a reserved
  // number on save, so a number the user typed is kept.
  const previewedPoRef = useRef('');
  const applyOCR = (extracted) => {
    // v1.10.35 — Now consumes the richer payload from BillOCR:
    // extracted.items[] with name/hsn/qty/rate/taxPercent/amount, and
    // extracted.taxBreakdown with cgst/sgst/igst/cess. Falls back to
    // the old single-line-from-grand-total behaviour only if no line
    // items were detected at all.
    setEditingId(null);
    let items;
    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      // Trust the OCR-extracted line items. Strip the internal match
      // metadata (_matchedProductId etc.) since the purchase form
      // doesn't consume it.
      items = extracted.items.map(it => ({
        name: it.name || '',
        hsn: it.hsn || '',
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        cessPercent: 0,
      }));
    } else if (extracted.grandTotal > 0) {
      // Legacy fallback — no line items detected, seed a single-row
      // placeholder from the grand total so the user has something to
      // split.
      items = [{ name: 'From OCR — split into real items', hsn: '', quantity: 1, rate: extracted.grandTotal, taxPercent: 0, cessPercent: 0 }];
    } else {
      items = [{ ...emptyItem }];
    }
    // v1.10.74 - IGST on the bill and no CGST means the supplier is in
    // another state, so open the form with Inter-state ticked.
    const tb = extracted.taxBreakdown || {};
    setForm({
      ...emptyForm,
      date: extracted.date || localToday(),
      supplierName: extracted.supplierName || '',
      supplierGstin: extracted.supplierGstin || '',
      invoiceNumber: extracted.invoiceNumber || '',
      items,
      interstate: Number(tb.igst) > 0 && !Number(tb.cgst),
    });
    setShowForm(true);
    const msg = Array.isArray(extracted.items) && extracted.items.length > 0
      ? `OCR loaded ${extracted.items.length} line item${extracted.items.length === 1 ? '' : 's'} — review HSN + tax rates before saving.`
      : 'OCR values loaded — please review, then break the total into line items with correct GST.';
    toast(msg, 'info');
  };

  const fyOptions = getFYOptions();


  // v1.10.65 (#58 item 3) — assign records saved before businesses were kept
  // separate. Never automatic: only the user knows which business an old
  // record belonged to, so guessing would file it into the wrong books.
  const unassignedPurchases = purchases.filter(isUnassignedToBusiness);
  const assignUnassignedPurchases = async () => {
    const assigned = unassignedPurchases.map(r => ({
      ...r,
      ownerGstin: ownerProfile?.gstin || '',
      ownerName: ownerProfile?.businessName || '',
    }));
    await Promise.all(assigned.map(r => savePurchase(r)));
    await restampDebitNotes(assigned);
    loadPurchases();
  };
  // v1.10.85 (#168) - a bill's debit notes follow it to its business, so they
  // never show under every company. Loads every note: one under another
  // business (or none) is exactly the one to fix.
  const restampDebitNotes = async (bills) => {
    try {
      const all = await getAllDebitNotes();
      await Promise.all(notesToRestamp(bills, all).map(dn => saveDebitNote(dn)));
    } catch { /* shown again next time; the bills are saved */ }
  };

  const loadPurchases = async () => {
    try {
      const [rows, prof, pos, dns] = await Promise.all([
        getAllPurchases(),
        getProfile().catch(() => null),
        poEnabled ? getAllPurchaseOrders().catch(() => []) : [],
        getAllDebitNotes().catch(() => []),
      ]);
      setOwnerProfile(prof);
      // v1.10.65 (#58 item 3) — show only this business's records. Anything
      // saved before businesses were separated has no owner recorded and is
      // always shown, so nothing disappears from an existing ledger.
      // v1.10.85 (#168) - each bill knows what its debit notes took off it
      // (_returned), so its balance and status follow.
      const mineDn = (dns || []).filter(r => belongsToProfile(r, prof));
      setDebitNotes(mineDn);
      setPurchases(withReturns((rows || []).filter(r => belongsToProfile(r, prof)), mineDn));
      setOrders((pos || []).filter(r => belongsToProfile(r, prof)));
    } catch {
      toast('Failed to load purchases', 'error');
    }
  };

  // v1.10.54 — reported (#42, @sangwanmail-eng): "Product not show properly
  // in purchase tab". The Products & Services master held Keyboard,
  // motherboard, Mouse, Pen drive — but the purchase item dropdown offered
  // "mouse", "key", "Pen drive": lowercase variants and a half-typed entry
  // from old bills, with two real products missing entirely.
  //
  // Cause: v1.10.50 built the suggestion list purely from what had been
  // TYPED on past purchase bills, and never read the product master. The
  // save path already calls getAllProducts() to update stock, so the data
  // was right there — it just was not being used for suggestions.
  const loadProducts = async () => {
    try {
      setProducts(await getAllProducts());
    } catch {
      // Non-fatal: suggestions fall back to purchase history alone.
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadPurchases();
    loadProducts();
  }, []);

  const filtered = purchases.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      // v1.10.85 (#160) - also a serial number / IMEI on any line.
      if (!(p.supplierName || '').toLowerCase().includes(q) &&
          !(p.invoiceNumber || '').toLowerCase().includes(q) &&
          !(p.supplierGstin || '').toLowerCase().includes(q) &&
          !purchaseHasSerial(p, q)) return false;
    }
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && p.date) {
        if (p.date < fy.from || p.date > fy.to) return false;
      }
    }
    if (statusFilter === 'due' && purchaseStatus(p) === 'Paid') return false;
    if (statusFilter === 'Paid' && purchaseStatus(p) !== 'Paid') return false;
    return matchesCentre(p, centreFilter);
  });

  const { sort, toggle: toggleSort } = useListSort('purchases', Object.keys(SORT_GETTERS));
  const sortedPurchases = sortRows(filtered, sort, SORT_GETTERS);

  const totalStats = filtered.reduce((acc, p) => {
    const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
    return { taxable: acc.taxable + t.taxable, tax: acc.tax + t.tax, total: acc.total + t.finalTotal, owed: acc.owed + purchaseBalance(p) };
  }, { taxable: 0, tax: 0, total: 0, owed: 0 });
  // v1.10.85 (#168) - returns against the bills shown come off the cards.
  const shownIds = new Set(filtered.map(p => p.id));
  const returnStats = debitNotes.filter(dn => !dn.cancelled && shownIds.has(dn.purchaseId)).map(debitNoteTotals)
    .reduce((acc, t) => ({ total: acc.total + t.total, tax: acc.tax + t.tax }), { total: 0, tax: 0 });
  const canReturn = (p) => returnableLines(p, debitNotes).some(l => l.left > 0);

  const openAdd = () => {
    setForm({ ...emptyForm, date: localToday(), items: [{ ...emptyItem }] });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (purchase) => {
    setForm({
      date: purchase.date || '',
      supplierName: purchase.supplierName || '',
      supplierAddress: purchase.supplierAddress || '',
      supplierGstin: purchase.supplierGstin || '',
      invoiceNumber: purchase.invoiceNumber || '',
      items: purchase.items && purchase.items.length > 0 ? purchase.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      paymentStatus: purchase.paymentStatus || 'Unpaid',
      interstate: !!purchase.interstate,
      reverseCharge: !!purchase.reverseCharge, // v1.10.86
      // Detect round-off from older entries: if roundOff field exists and is
      // non-zero, treat applyRoundOff as on. Older entries without the field
      // just default to off — they won't suddenly change totals on re-save.
      applyRoundOff: !!purchase.applyRoundOff || (typeof purchase.roundOff === 'number' && purchase.roundOff !== 0),
      note: purchase.note || '',
      kind: 'bill',
      poNumber: '',
      expectedDate: '',
      fromPo: purchase.fromPo || '',
      costCentre: purchase.costCentre || '',
      costCentreName: purchase.costCentreName || '',
      tdsOn: (Number(purchase.tdsAmount) || 0) > 0,
      tdsSection: purchase.tdsSection || '194C',
      tdsRate: purchase.tdsRate ?? 1,
      tdsAmountManual: purchase.tdsManual ? String(purchase.tdsAmount) : '',
    });
    setEditingId(purchase.id);
    setShowForm(true);
  };

  // v1.10.83 (#112) - a new purchase order, blank or copied from `from`
  // (Duplicate). The next number is shown at once; it is reserved on save.
  const openNewPo = async (from = null) => {
    const date = localToday();
    previewedPoRef.current = '';
    setForm({
      ...emptyForm,
      kind: 'po',
      date,
      ...(from ? {
        supplierName: from.supplierName || '',
        supplierAddress: from.supplierAddress || '',
        supplierGstin: from.supplierGstin || '',
        interstate: !!from.interstate,
        note: from.note || '',
      } : {}),
      items: from?.items?.length ? from.items.map(i => ({ ...i })) : [{ ...emptyItem }],
    });
    setEditingId(null);
    setShowForm(true);
    try {
      const next = await getNextPoNumber({ peek: true, businessKey: businessKeyOf(ownerProfile), date });
      previewedPoRef.current = next;
      setForm(prev => (prev.kind === 'po' && !prev.poNumber ? { ...prev, poNumber: next } : prev));
    } catch { /* offline: the user can type a number */ }
  };

  // v1.10.85 - "Make purchase order" for low stock: the lines handed over open
  // in a new PO once the business is known (its PO number series).
  const reorderRef = useRef(null);
  useEffect(() => {
    reorderRef.current = reorderRef.current || takeReorderDraft();
  }, []);
  // v1.10.86 - (#175) a 2B entry opens in a new bill once the business is
  // known (the bill is stamped with it); the user checks it and saves.
  const twoBRef = useRef(null);
  useEffect(() => {
    twoBRef.current = twoBRef.current || takeTwoBDraft();
  }, []);
  useEffect(() => {
    if (!twoBRef.current || !ownerProfile) return;
    const draft = twoBRef.current;
    twoBRef.current = null;
    setTab('bills');
    setForm({ ...emptyForm, ...draft, date: draft.date || localToday(), items: draft.items.map(i => ({ ...i })), from2b: true });
    setEditingId(null);
    setShowForm(true);
  }, [ownerProfile]);
  useEffect(() => {
    if (!reorderRef.current || !ownerProfile) return;
    const items = reorderRef.current;
    reorderRef.current = null;
    if (poEnabled) setTab('orders');
    openNewPo({ items });
    toast('Purchase order for the low-stock products: pick the supplier, check the quantities and save', 'info');
    // Runs when the business has loaded; openNewPo reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerProfile]);

  const openEditPo = (po) => {
    setForm({
      ...emptyForm,
      kind: 'po',
      date: po.date || '',
      expectedDate: po.expectedDate || '',
      poNumber: po.poNumber || '',
      supplierName: po.supplierName || '',
      supplierAddress: po.supplierAddress || '',
      supplierGstin: po.supplierGstin || '',
      interstate: !!po.interstate,
      note: po.note || '',
      costCentre: po.costCentre || '',
      costCentreName: po.costCentreName || '',
      items: po.items?.length ? po.items.map(i => ({ ...i })) : [{ ...emptyItem }],
    });
    setEditingId(po.id);
    setShowForm(true);
  };

  // Convert to purchase bill: the bill form, filled with what is still to
  // come on the order. Stock moves only when that bill is saved.
  const openBillFromPo = (po) => {
    setForm({ ...emptyForm, date: localToday(), ...billFormFromPo(po, purchases) });
    setEditingId(null);
    setShowForm(true);
  };

  const cancelPo = async (po) => {
    if (!await confirmAction({
      title: `Cancel ${po.poNumber || 'this purchase order'}?`,
      message: 'It keeps its number and can still be viewed and duplicated, but no longer edited or turned into a bill. Bills already saved from it stay as they are.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      tone: 'danger',
    })) return;
    try {
      await savePurchaseOrder({ ...po, cancelled: true, cancelledAt: new Date().toISOString() });
      toast(`${po.poNumber || 'Purchase order'} cancelled`, 'success');
      loadPurchases();
    } catch {
      toast('Could not cancel the purchase order', 'error');
    }
  };

  const handleSavePo = async () => {
    if (!form.date) { toast('PO date is required', 'warning'); return; }
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    const items = form.items
      .filter(i => (i.name || '').trim() && (parseFloat(i.quantity) || 0) > 0)
      .map(i => ({
        name: i.name.trim(),
        hsn: (i.hsn || '').trim(),
        quantity: parseFloat(i.quantity) || 0,
        unit: (i.unit || '').trim(),
        rate: parseFloat(i.rate) || 0,
        taxPercent: parseFloat(i.taxPercent) || 0,
        cessPercent: parseFloat(i.cessPercent) || 0,
        ...lineDiscountFields(i), // v1.10.85 (#171)
        ...altLineFields(i), // v1.10.85 (#148) - ordered in boxes: billed in boxes
      }));
    if (!items.length) { toast('Add at least one item with a quantity', 'warning'); return; }
    const existing = editingId ? orders.find(o => o.id === editingId) : null;
    let poNumber = (form.poNumber || '').trim();
    try {
      if (!existing && (!poNumber || poNumber === previewedPoRef.current)) {
        poNumber = await getNextPoNumber({ businessKey: businessKeyOf(ownerProfile), date: form.date });
      }
    } catch {
      if (!poNumber) { toast('Could not get the next PO number. Type one in PO number.', 'error'); return; }
    }
    if (orders.some(o => o.id !== editingId && String(o.poNumber || '').trim().toLowerCase() === poNumber.toLowerCase())) {
      setForm(prev => ({ ...prev, poNumber }));
      toast(`${poNumber} is already used by another purchase order`, 'warning');
      return;
    }
    const t = calcPurchaseTotal(items);
    try {
      await savePurchaseOrder({
        ...(existing || {}),
        poNumber,
        date: form.date,
        expectedDate: form.expectedDate || '',
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        interstate: !!form.interstate,
        // Same rule as receipts: an edited order keeps the business it had.
        ownerGstin: existing ? (existing.ownerGstin || '') : (ownerProfile?.gstin || ''),
        ownerName: existing ? (existing.ownerName || '') : (ownerProfile?.businessName || ''),
        items,
        note: (form.note || '').trim(),
        // v1.10.83 (#112) - cost centre on the order too (cleared when unpicked:
        // undefined drops the old value from the saved file).
        costCentre: undefined,
        costCentreName: undefined,
        ...centreFields(form.costCentre, form.costCentreName),
        taxableAmount: t.taxable,
        totalTax: t.tax,
        totalCess: t.cess,
        totalAmount: t.finalTotal,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
      toast(existing ? `${poNumber} updated` : `${poNumber} saved`, 'success');
      closeForm();
      loadPurchases();
    } catch {
      toast('Failed to save the purchase order', 'error');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
  };

  // v1.10.29 — reported: "option to view as pdf give it that will be
  // better". Generates a simple one-page purchase-bill PDF with header,
  // supplier block, line items table, tax breakdown, and total. Uses
  // jsPDF's built-in text/rect helpers (same as the ledger PDF) so we
  // don't pull autotable and keep the bundle small.
  const viewAsPdf = async (purchase) => {
    try {
      const { jsPDF } = await import('jspdf');
      const t = calcPurchaseTotal(purchase.items, !!purchase.applyRoundOff);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('PURCHASE BILL', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(`Invoice #: ${purchase.invoiceNumber || '-'}`, marginL, y); y += 5;
      doc.text(`Date: ${purchase.date ? new Date(purchase.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}`, marginL, y); y += 5;
      doc.text(`Payment: ${PURCHASE_STATUS_LABEL[purchaseStatus(purchase)]}   ·   ${purchase.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}${purchase.reverseCharge ? '   ·   Reverse charge: Yes' : ''}`, marginL, y); y += 8;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Supplier', marginL, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(purchase.supplierName || '-', marginL, y); y += 5;
      // v1.10.29 — supplier address (wraps at ~110mm so it doesn't collide
      // with anything on the right side of the header).
      if (purchase.supplierAddress) {
        const wrapped = doc.splitTextToSize(purchase.supplierAddress, 110);
        wrapped.forEach(line => { doc.text(line, marginL, y); y += 5; });
      }
      if (purchase.supplierGstin) { doc.text(`GSTIN: ${purchase.supplierGstin}`, marginL, y); y += 5; }
      y += 4;

      // Items header
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('#', marginL, y);
      doc.text('Description', marginL + 8, y);
      doc.text('HSN', marginL + 80, y);
      doc.text('Qty', marginL + 100, y, { align: 'right' });
      doc.text('Rate', marginL + 122, y, { align: 'right' });
      doc.text('GST%', marginL + 140, y, { align: 'right' });
      doc.text('Amount', marginR, y, { align: 'right' });
      y += 2; doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;

      doc.setFont('helvetica', 'normal');
      (purchase.items || []).forEach((item, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        // v1.10.85 (#171) - after its discount.
        const lineTotal = purchaseLineTax({ ...item, quantity: Number(item.quantity) || 0, rate: Number(item.rate) || 0 }).amount;
        const withTax = lineTotal * (1 + (Number(item.taxPercent) || 0) / 100);
        // v1.10.30 — reported: "in purchase bill pdf long names got cut in
        // pdf fix". Prior code used `.slice(0, 40)` which mid-word truncated
        // "4 Copier Paper (Pack of..." → "4 Copier Paper (Pack o". Now we
        // wrap the description into as many lines as needed (70mm column
        // width). The row height grows to fit the wrapped text so nothing
        // clips into the next line.
        const nameCol = 70; // mm — width of description column
        // v1.10.85 (#171, #160) - its discount and serial numbers under the name.
        const nameLines = [String(item.name || '-'), lineNote(item)].filter(Boolean).flatMap((s) => doc.splitTextToSize(s, nameCol));
        const rowH = Math.max(6, nameLines.length * 4.5);
        // Page break if this row won't fit.
        if (y + rowH > 275) { doc.addPage(); y = 20; }
        doc.text(String(idx + 1), marginL, y);
        // Description wraps top-aligned.
        nameLines.forEach((line, lineIdx) => {
          doc.text(line, marginL + 8, y + lineIdx * 4.5);
        });
        // Everything else aligns to the top of the row (so it lines up
        // with the first line of the wrapped description).
        doc.text(String(item.hsn || '-'), marginL + 80, y);
        doc.text(String(item.quantity || 0), marginL + 100, y, { align: 'right' });
        doc.text(fmt(item.rate), marginL + 122, y, { align: 'right' });
        doc.text(String(item.taxPercent || 0) + '%', marginL + 140, y, { align: 'right' });
        doc.text(fmt(withTax), marginR, y, { align: 'right' });
        y += rowH;
      });

      // Totals
      y += 4; doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text('Taxable', marginL + 100, y); doc.text(fmt(t.taxable), marginR, y, { align: 'right' }); y += 5;
      // v1.10.74 - show the tax split instead of one combined line.
      if (purchase.interstate) {
        doc.text('IGST', marginL + 100, y); doc.text(fmt(t.tax), marginR, y, { align: 'right' }); y += 5;
      } else {
        const sp = splitPurchaseTax(t.tax, false);
        doc.text('CGST', marginL + 100, y); doc.text(fmt(sp.cgst), marginR, y, { align: 'right' }); y += 5;
        doc.text('SGST', marginL + 100, y); doc.text(fmt(sp.sgst), marginR, y, { align: 'right' }); y += 5;
      }
      if (t.cess > 0.005) { doc.text('Cess', marginL + 100, y); doc.text(fmt(t.cess), marginR, y, { align: 'right' }); y += 5; }
      if (Math.abs(t.roundOff) > 0.005) { doc.text('Round-off', marginL + 100, y); doc.text((t.roundOff > 0 ? '+' : '') + fmt(t.roundOff), marginR, y, { align: 'right' }); y += 5; }
      y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
      doc.text('TOTAL', marginL + 100, y); doc.text(fmt(t.finalTotal), marginR, y, { align: 'right' });
      if ((Number(purchase.tdsAmount) || 0) > 0 || purchase.reverseCharge) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); y += 6;
        // v1.10.86 - reverse charge: the GST is paid to the government by you.
        if (purchase.reverseCharge) { doc.text('Less: GST you pay (reverse charge)', marginL + 100, y); doc.text('-' + fmt(purchaseRcmTax(purchase)), marginR, y, { align: 'right' }); y += 5; }
        if ((Number(purchase.tdsAmount) || 0) > 0) { doc.text(`Less: TDS (${sectionShort(purchase.tdsSection) || 'TDS'})`, marginL + 100, y); doc.text('-' + fmt(purchase.tdsAmount), marginR, y, { align: 'right' }); y += 5; }
        doc.setFont('helvetica', 'bold');
        doc.text('Paid to supplier', marginL + 100, y); doc.text(fmt(purchaseOwed(purchase)), marginR, y, { align: 'right' });
      }

      // v1.10.83 (#123) - payments made to the supplier, and what is left.
      const pays = purchase.payments || [];
      if (pays.length) {
        y += 12;
        if (y + 14 + pays.length * 5 > 280) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
        doc.text('Payments made', marginL, y); y += 2;
        doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        for (const x of pays) {
          if (y > 280) { doc.addPage(); y = 20; }
          const when = x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
          doc.text(when, marginL, y);
          doc.text(purchasePaymentModeName(x.mode), marginL + 30, y);
          doc.text(doc.splitTextToSize([x.reference, x.note].filter(Boolean).join(' · ') || '', 90)[0] || '', marginL + 60, y);
          doc.text(fmt(x.amount), marginR, y, { align: 'right' });
          y += 5;
        }
      }
      if (pays.length || purchaseStatus(purchase) === 'Paid' || purchase._returned > 0) {
        y += pays.length ? 1 : 8;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
        if (pays.length) { doc.text('Paid', marginL + 100, y); doc.text(fmt(purchasePaid(purchase)), marginR, y, { align: 'right' }); y += 5; }
        if (purchase._returned > 0) { doc.text('Returned (debit notes)', marginL + 100, y); doc.text('-' + fmt(purchase._returned), marginR, y, { align: 'right' }); y += 5; }
        doc.setFont('helvetica', 'bold');
        doc.text('Balance due', marginL + 100, y); doc.text(fmt(purchaseBalance(purchase)), marginR, y, { align: 'right' });
      }

      if (purchase.note) {
        y += 14; doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(90);
        doc.text('Note: ' + purchase.note, marginL, y);
      }

      const safeInv = String(purchase.invoiceNumber || 'purchase').replace(/[^A-Za-z0-9._-]/g, '_');
      const filename = `Purchase-${safeInv}-${purchase.date || 'undated'}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Purchase PDF failed:', err);
      toast('Could not generate PDF — see console', 'error');
    }
  };

  const handleSave = async () => {
    if (form.kind === 'po') return handleSavePo();
    const from2b = !!form.from2b && !editingId; // v1.10.86 - (#175) back to GSTR-2B once saved
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!form.invoiceNumber.trim()) { toast('Invoice number is required', 'warning'); return; }
    // v1.10.58 — reported (#47 item 2, @sangwanmail-eng): "Purchase also
    // save without adding any product." Supplier and invoice number were
    // checked, but nothing verified the bill had any line items, so an
    // empty bill saved with a zero total.
    //
    // That is not merely untidy: a purchase bill is the ITC record. A zero
    // bill sits in GSTR-3B reconciliation as a vendor invoice claiming
    // nothing, and the empty rows also feed the stock/product sync on save.
    if (!form.items.some(i => (i.name || '').trim() && (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0) > 0)) {
      toast('Add at least one item with a quantity and rate', 'warning');
      return;
    }
    // v1.10.85 (#168) - goods already sent back on a debit note: their line
    // cannot drop below what went back, nor be renamed or removed.
    const returnsProblem = editingId ? editProblem(purchases.find(p => p.id === editingId), form.items, debitNotes) : '';
    if (returnsProblem) { toast(returnsProblem, 'warning', 10000); return; }
    try {
      const totals = calcPurchaseTotal(form.items, form.applyRoundOff);
      const before = editingId ? purchases.find(p => p.id === editingId) : null;
      const purchaseFields = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        // Which of YOUR businesses bought this. Distinct from supplierGstin
        // directly above, which is who sold it.
        ownerGstin: ownerProfile?.gstin || '',
        ownerName: ownerProfile?.businessName || '',
        items: form.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
          // v1.10.83 (#112) - only lines from a purchase order carry a unit.
          ...(String(i.unit || '').trim() ? { unit: String(i.unit).trim() } : {}),
          // v1.10.85 (#171, #160) - a discount and serial numbers only when given.
          ...lineDiscountFields(i),
          ...(String(i.serialNo || '').trim() ? { serialNo: String(i.serialNo).trim() } : {}),
          // v1.10.85 (#148) - bought in the product's second unit (Box = 12).
          ...altLineFields(i),
        })),
        // v1.10.85 (#168) - what its debit notes took off (never saved), so
        // Paid below records the balance less the returns.
        ...(before?._returned ? { _returned: before._returned } : {}),
        // The purchase order this bill was made from; its status follows the
        // quantities on the bills linked to it.
        ...(form.fromPo ? { fromPo: form.fromPo } : {}),
        // totalAmount is the grand total INCLUDING round-off so the table
        // sum and GSTR-3B reconciliation both reflect what the supplier
        // actually charged. roundOff stored separately for audit clarity.
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        applyRoundOff: !!form.applyRoundOff,
        roundOff: totals.roundOff,
        paymentStatus: form.paymentStatus,
        interstate: !!form.interstate,
        // v1.10.86 - written only when ticked, so an unticked bill is saved as before.
        ...(form.reverseCharge ? { reverseCharge: true } : {}),
        note: form.note.trim(),
        ...centreFields(form.costCentre, form.costCentreName),
        ...purchaseTdsFields(form, totals.taxable),
      };
      // v1.10.83 (#123) - payments to the supplier stay with the bill when it
      // is edited, and the status follows them (and a new total or TDS). With
      // no payments, choosing Paid records one for the balance, as the list
      // does; an old bill already marked Paid keeps its mark.
      let purchase = purchaseFields;
      if (hasPurchasePayments(before)) {
        purchase = withPurchasePayments(purchaseFields, before.payments);
        if (purchasePaid(purchase) > purchaseOwed(purchase) + OVERPAY_SLACK) {
          toast(`Payments of ${formatCurrency(purchasePaid(purchase))} are already recorded, more than this bill now comes to (${formatCurrency(purchaseOwed(purchase))}). Change or delete a payment first (₹ button in the list).`, 'warning');
          return;
        }
      } else if (form.paymentStatus === 'Paid' && (before?.paymentStatus || 'Unpaid') !== 'Paid') {
        // v1.10.85 (#184) - how it was paid: Cash reaches the Cash book.
        const mode = purchasePaymentDue(purchaseFields) > 0.005 ? await askPaidMode('How was this bill paid?') : 'other';
        if (!mode) return;
        purchase = markPurchasePaid(purchaseFields, localToday(), new Date(), mode);
      }
      await savePurchase(purchase);
      if (editingId) await restampDebitNotes([purchase]);

      // v1.10.29 — reported: "items added in purchase bill also available
      // for sale means automatically added to the product page too".
      // On save, upsert each line item into Products. Match by trimmed
      // lowercase name to avoid duplicates. For existing products we
      // update purchasePrice (latest cost) but leave sellingPrice alone
      // so we don't accidentally overwrite the user's margin. For new
      // products we seed sellingPrice = purchasePrice as a starting
      // point (user can raise it in Inventory later). Runs in parallel
      // and non-fatal — a single-item failure doesn't block the
      // purchase-bill save.
      // v1.10.31 — Data-F10.1-3: delta-based stock sync. Previously stock
      // was incremented only on FIRST save (create). If the user edited the
      // purchase later — changing qty from 10 → 20, or removing a line, or
      // renaming a line — the product's stock stayed at 10 (F10.1) or a
      // duplicate product was created (F10.3). Now:
      //   • Save (edit path): compute per-line delta from the pre-edit
      //     snapshot; apply that delta to each existing product's stock.
      //   • Save (create path): increment stock by full quantity.
      //   • Rename detection: match by productId first (persisted below),
      //     then by name — a rename with productId keeps the same product.
      try {
        const existingProducts = await getAllProducts();
        const byName = new Map(existingProducts.map(p => [(p.name || '').trim().toLowerCase(), p]));
        const byId = new Map(existingProducts.map(p => [p.id, p]));

        // Pre-edit snapshot: on edit, compute deltas per productId/name.
        const priorLines = editingId
          ? (purchases.find(p => p.id === editingId)?.items || [])
          : [];
        const priorQtyByKey = new Map();
        for (const p of priorLines) {
          const key = p.productId || `name:${(p.name || '').trim().toLowerCase()}`;
          priorQtyByKey.set(key, (priorQtyByKey.get(key) || 0) + baseQty(p)); // #148 - in the base unit
        }

        // Batch stock adjustments per product so we don't race on parallel saves.
        const stockDeltaById = new Map();
        const productsToUpsert = new Map();
        const seenPriorKeys = new Set();

        // v1.10.86 - (#175) lines still named "... (from GSTR-2B)" are no product: no stock.
        for (const it of purchase.items.filter(x => x.name && !isTwoBPlaceholder(x.name))) {
          const qty = baseQty(it); // #148 - 3 boxes of 12 add 36
          // Match order: productId (persisted below) → name (case-insensitive).
          let existing = it.productId ? byId.get(it.productId) : null;
          if (!existing) {
            const key = it.name.trim().toLowerCase();
            existing = byName.get(key);
          }
          if (existing) {
            // Delta = current qty − prior qty (for this product).
            const priorKey = it.productId
              ? it.productId
              : `name:${(it.name || '').trim().toLowerCase()}`;
            const priorQty = priorQtyByKey.get(priorKey) || 0;
            seenPriorKeys.add(priorKey);
            const delta = qty - priorQty; // may be negative (line reduced) or zero (unchanged)
            stockDeltaById.set(existing.id, (stockDeltaById.get(existing.id) || 0) + delta);
            productsToUpsert.set(existing.id, {
              ...existing,
              purchasePrice: purchaseUnitCost(it) / lineFactor(it), // v1.10.85 (#171) after its discount; #148 per base unit
              hsn: existing.hsn || it.hsn,
              taxPercent: existing.taxPercent || it.taxPercent,
              cessPercent: existing.cessPercent || it.cessPercent || 0,
              // stock filled after we sum all deltas for this product.
              _placeholderId: existing.id,
            });
          } else {
            // New product — seed stock with the line qty (all its lines: two
            // lines of the same new item used to keep only the last one's).
            const newKey = `__new__::${it.name.trim().toLowerCase()}`;
            const seeded = Number(productsToUpsert.get(newKey)?.stock) || 0;
            productsToUpsert.set(newKey, {
              name: it.name.trim(),
              hsn: it.hsn || '',
              purchasePrice: purchaseUnitCost(it),
              sellingPrice: it.rate,
              rate: it.rate,
              taxPercent: it.taxPercent || 0,
              cessPercent: it.cessPercent || 0,
              unit: it.unit || 'Nos',
              stock: roundQty(seeded + qty),
              description: '',
            });
          }
        }

        // Rows removed while editing: their stock was added when the bill was
        // first saved, so take it back out (it used to stay in stock forever).
        for (const [key, priorQty] of priorQtyByKey) {
          if (seenPriorKeys.has(key)) continue;
          const gone = key.startsWith('name:') ? byName.get(key.slice(5)) : byId.get(key);
          if (!gone) continue;
          stockDeltaById.set(gone.id, (stockDeltaById.get(gone.id) || 0) - priorQty);
          if (!productsToUpsert.has(gone.id)) productsToUpsert.set(gone.id, { ...gone, _placeholderId: gone.id });
        }

        // Apply deltas + write.
        const upserts = [];
        for (const [, prod] of productsToUpsert) {
          if (prod._placeholderId) {
            const existing = byId.get(prod._placeholderId);
            const delta = stockDeltaById.get(prod._placeholderId) || 0;
            // Not clamped at 0: sales may take stock below zero, and clamping
            // here made a purchase edit and its undo leave different stock
            // (stock 2, reduce a purchase by 5 -> 0, put it back -> 5).
            const newStock = roundQty((Number(existing.stock) || 0) + delta);
            upserts.push(saveProduct({ ...prod, stock: newStock, _placeholderId: undefined }));
          } else {
            upserts.push(saveProduct(prod));
          }
        }
        await Promise.all(upserts);
        toast(editingId ? 'Purchase updated' : from2b ? 'Purchase added. Back to GSTR-2B.' : 'Purchase added — items synced to Products', 'success');
      } catch (e) {
        console.warn('Products auto-sync from purchase failed (non-fatal):', e);
        toast('Purchase saved, but updating stock in Products failed - check them there', 'warning');
      }

      closeForm();
      loadPurchases();
      // v1.10.54 — saving a bill upserts its items into the product master
      // (that is what the toast above means by "synced to Products"), so
      // refresh it too. Otherwise a brand-new item would not appear in the
      // suggestions until the page was reloaded.
      loadProducts();
      if (from2b && onOpenGstReturns) { markBackToTwoB(); onOpenGstReturns(); }
    } catch {
      toast('Failed to save purchase', 'error');
    }
  };

  // v1.10.69 (#71 item 3) - change the payment status straight from the list.
  // Saves the whole record back, so nothing else about the bill is disturbed;
  // the list is reloaded afterwards so the supplier-payable totals follow.
  // v1.10.83 (#123) - Paid records one payment for the balance, Unpaid takes
  // that payment back (yours stay), Partly paid opens Record payment for the
  // amount. See utils/purchasePayments.js.
  const changePaymentStatus = async (purchase, paymentStatus) => {
    if (purchaseStatus(purchase) === paymentStatus) return;
    if (paymentStatus === 'Partial') { setPayPurchase(purchase); return; }
    // v1.10.85 (#184) - Paid asks how it was paid (Cash reaches the Cash book).
    let mode = 'other';
    if (paymentStatus === 'Paid' && purchasePaymentDue(purchase) > 0.005) {
      mode = await askPaidMode('How was this bill paid?');
      if (!mode) { loadPurchases(); return; }
    }
    const next = paymentStatus === 'Paid' ? markPurchasePaid(purchase, localToday(), new Date(), mode) : markPurchaseUnpaid(purchase);
    try {
      await savePurchase(next);
      const now = purchaseStatus(next);
      toast(now === paymentStatus ? `Marked ${PURCHASE_STATUS_LABEL[now].toLowerCase()}`
        : `Now ${PURCHASE_STATUS_LABEL[now].toLowerCase()}: payments you recorded stay. Delete them with the ₹ button.`, now === paymentStatus ? 'success' : 'info');
      loadPurchases();
    } catch {
      toast('Could not change the status', 'error');
    }
  };

  // Take a deleted bill's quantities back out of product stock.
  // Matches products the same way saving does: productId, then name.
  const revertPurchaseStock = async (bill) => {
    const lines = (bill?.items || []).filter(it => it.name && baseQty(it) > 0);
    if (!lines.length) return;
    const products = await getAllProducts();
    const byName = new Map(products.map(p => [(p.name || '').trim().toLowerCase(), p]));
    const byId = new Map(products.map(p => [p.id, p]));
    const minus = new Map();
    for (const it of lines) {
      const prod = (it.productId && byId.get(it.productId)) || byName.get(it.name.trim().toLowerCase());
      if (prod) minus.set(prod.id, (minus.get(prod.id) || 0) + baseQty(it)); // #148 - 3 boxes take back 36
    }
    await Promise.all([...minus].map(([pid, qty]) => {
      const prod = byId.get(pid);
      return saveProduct({ ...prod, stock: roundQty((Number(prod.stock) || 0) - qty) });
    }));
  };

  const handleDelete = async (id) => {
    // A bill's payments are kept only on the bill, so they go with it.
    const target = purchases.find(p => p.id === id);
    // v1.10.85 (#168) - its returns would be left pointing at nothing.
    const dns = debitNotes.filter(dn => dn.purchaseId === id);
    if (dns.length) {
      toast(`This bill has ${dns.length === 1 ? 'a debit note' : `${dns.length} debit notes`} (${dns.map(dn => dn.dnNumber).join(', ')}). Delete ${dns.length === 1 ? 'it' : 'them'} on the Returns tab first.`, 'warning', 8000);
      return;
    }
    const paidNote = hasPurchasePayments(target)
      ? ` Its payments of ${formatCurrency(purchasePaid(target))} are deleted with it and leave the Cash book. To re-enter the bill, edit it instead.`
      : '';
    if (await confirmAction({
      title: 'Delete this purchase bill?',
      message: `Stock levels for the products in this bill will be reverted. Any GST ITC already claimed against this bill in past returns stays as filed.${paidNote}`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        const bill = purchases.find(p => p.id === id);
        await deletePurchase(id);
        // The confirm above promises this: the bill's quantities were added to
        // stock when it was saved, so deleting it takes them back out.
        let stockOk = true;
        try { await revertPurchaseStock(bill); } catch (e) { stockOk = false; console.warn('Stock revert failed', e); }
        toast(stockOk ? 'Purchase deleted' : 'Purchase deleted, but its stock could not be taken out of Products', stockOk ? 'success' : 'warning');
        loadPurchases();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  // v1.10.50 — reported (#39, @sangwanmail-eng): "In add purchase option
  // previous added supplier and item not shown. So all details need to be
  // fill again, like supplier name, gst number, address, item name etc".
  //
  // Purchase bills store supplier details INLINE (supplierName /
  // supplierGstin / supplierAddress) rather than against a supplier master
  // record, so unlike the invoice side — which has saved clients and
  // product suggestions — there was nothing to recall and every bill meant
  // retyping the GSTIN by hand. For someone entering a stack of bills from
  // the same three or four vendors that is the bulk of the typing, and a
  // mistyped GSTIN quietly breaks ITC reconciliation in GSTR-3B.
  //
  // Rather than introduce a supplier master (a migration, and a second
  // place for the same data to drift), derive the history from the bills
  // already loaded in `purchases`. Newest first, so the most recent
  // spelling of a supplier wins.
  const supplierHistory = useMemo(() => {
    const seen = new Map();
    for (const p of purchases) {
      const name = (p.supplierName || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      // First wins: `purchases` arrives newest-first, so this keeps the
      // most recent details for a supplier rather than the oldest.
      if (!seen.has(key)) {
        seen.set(key, {
          name,
          gstin: (p.supplierGstin || '').trim(),
          address: (p.supplierAddress || '').trim(),
          interstate: !!p.interstate,
        });
      }
    }
    return [...seen.values()];
  }, [purchases]);

  // v1.10.54 (#42) — suggestions come from the product master FIRST, then
  // anything else that has been typed on a past bill.
  //
  // Order matters: the master is inserted first and the map is first-wins,
  // so "Mouse" from Products beats a stray "mouse" typed on an old bill.
  // Deduping is case-insensitive for the same reason — the user should see
  // one entry with the spelling they curated, not two differing in case.
  //
  // Purchase-only names are still kept. A one-off item bought once and
  // never added to the catalogue is legitimate history, and there is no
  // reliable way to tell that apart from an old typo — so both stay, and
  // the user decides.
  const itemHistory = useMemo(() => {
    const seen = new Map();

    for (const pr of products) {
      const name = (pr.name || '').trim();
      if (!name) continue;
      seen.set(name.toLowerCase(), {
        name,
        hsn: (pr.hsn || '').trim(),
        // purchasePrice is what we PAY a supplier; `rate`/sellingPrice is
        // what we charge a customer. On a purchase bill the former is the
        // sensible prefill.
        rate: Number(pr.purchasePrice) || Number(pr.rate) || 0,
        taxPercent: Number(pr.taxPercent) || 0,
        cessPercent: Number(pr.cessPercent) || 0,
        unit: String(pr.unit || '').trim(),
      });
    }

    for (const p of purchases) {
      for (const it of (p.items || [])) {
        const name = (it.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            name,
            hsn: (it.hsn || '').trim(),
            rate: Number(it.rate) || 0,
            taxPercent: Number(it.taxPercent) || 0,
            cessPercent: Number(it.cessPercent) || 0,
            unit: String(it.unit || '').trim(),
          });
        }
      }
    }

    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [products, purchases]);
  // v1.10.86 - the names for the item boxes' suggestion lists (ComboInput), and the units on an order.
  const itemNames = useMemo(() => itemHistory.map(i => i.name), [itemHistory]);
  const unitNames = getAllUnits().map(u => u.label);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // v1.10.76 (#82) - a full supplier GSTIN sets "Inter-state" from the two
  // states, the way sales invoices already work it out. The box stays
  // editable for the rare exception.
  const updateSupplierGstin = (value) => setForm(prev => {
    const interstate = isInterstateSupply(value, ownerProfile);
    return interstate === null ? { ...prev, supplierGstin: value } : { ...prev, supplierGstin: value, interstate };
  });

  // Typing or picking a known supplier fills in the rest of their details.
  //
  // Deliberately only fills fields the user has left BLANK. Overwriting
  // whatever they already typed would be worse than not helping — someone
  // correcting a supplier's new GSTIN would watch the old one reappear as
  // they finished typing the name.
  const updateSupplierName = (value) => {
    const match = supplierHistory.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
    setForm(prev => {
      const next = { ...prev, supplierName: value };
      if (match) {
        // v1.10.55 (#43) — same re-selection bug as the item rows, and worse
        // here: switching supplier used to leave the PREVIOUS supplier's
        // GSTIN in place, so the bill was filed against the wrong taxpayer
        // and ITC reconciliation broke. See isOursToReplace above.
        const last = prev._autoSupplier || {};
        if (isOursToReplace(prev.supplierGstin, last.gstin)) next.supplierGstin = match.gstin;
        if (isOursToReplace(prev.supplierAddress, last.address)) next.supplierAddress = match.address;
        // Interstate drives CGST+SGST vs IGST, so recall it too — it is a
        // property of where the supplier is, and getting it wrong routes
        // ITC to the wrong GSTR-3B column.
        next.interstate = match.interstate;
        next._autoSupplier = { gstin: match.gstin, address: match.address };
      }
      return next;
    });
  };

  // Same idea for line items: recall HSN, rate and tax rates from the last
  // time this item was purchased. Rate is filled only when still 0 so a
  // price change the user has already typed is never clobbered.
  // v1.10.55 — reported (#43, @sangwanmail-eng): "when we select item all
  // details fetch ok. But when we change item in same field details not
  // change."
  //
  // v1.10.50 filled a field only when it was BLANK, to avoid overwriting
  // something the user had typed. That protected typed input but broke
  // re-selection: pick "Pen drive" (HSN fills to `s`), then change the same
  // row to "Mouse" — HSN is no longer blank, so it stayed on Pen drive's
  // value. The bill then carried the wrong HSN and the wrong rate, silently.
  //
  // The flaw was treating "field is non-empty" as "user typed this". We now
  // record what WE auto-filled on the row (`_auto`, transient — the save
  // path whitelists fields, so it never persists). A field is ours to
  // replace when it is empty or still holds exactly what we last put there;
  // once the user edits it, it stops matching and we leave it alone.
  //
  // So: re-selecting updates the details, and a hand-typed correction still
  // survives — both, rather than one at the cost of the other.
  const isOursToReplace = (current, lastAuto) => {
    const cur = current === undefined || current === null ? '' : String(current).trim();
    if (cur === '' || cur === '0') return true;              // never filled, or still zero
    if (lastAuto === undefined || lastAuto === null) return false;
    return cur === String(lastAuto).trim();                  // untouched since we filled it
  };

  const updateItemName = (index, value) => {
    const match = itemHistory.find(i => i.name.toLowerCase() === value.trim().toLowerCase());
    setForm(prev => {
      const items = [...prev.items];
      const cur = { ...items[index], name: value };
      // #148 - a new item name starts in its own unit again.
      if (cur.unitFactor) {
        delete cur.unitFactor;
        delete cur.baseUnit;
        if (prev.kind !== 'po') delete cur.unit;
      }
      if (match) {
        const last = cur._auto || {};
        if (isOursToReplace(cur.hsn, last.hsn)) cur.hsn = match.hsn;
        if (isOursToReplace(cur.rate, last.rate)) cur.rate = match.rate;
        // A product with no GST rate saved keeps the row's default (18%), as
        // the invoice screen does, instead of turning it into 0%.
        const hasRate = match.taxPercent !== undefined && match.taxPercent !== null && match.taxPercent !== '';
        if (hasRate && isOursToReplace(cur.taxPercent, last.taxPercent)) cur.taxPercent = match.taxPercent;
        if (isOursToReplace(cur.cessPercent, last.cessPercent)) cur.cessPercent = match.cessPercent;
        // v1.10.83 (#112) - unit only on a purchase order; bills have no unit field.
        if (prev.kind === 'po' && isOursToReplace(cur.unit, last.unit)) cur.unit = match.unit;
        // Remember exactly what we just wrote, so the next re-selection can
        // tell our values apart from the user's.
        cur._auto = {
          hsn: match.hsn,
          rate: match.rate,
          taxPercent: cur.taxPercent,
          cessPercent: match.cessPercent,
          unit: match.unit,
        };
      }
      items[index] = cur;
      return { ...prev, items };
    });
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    // Tag the new row so we can focus its first input after React renders.
    // Tab → Enter on the Add Item button now keeps the user in keyboard
    // flow instead of forcing a mouse click on the empty row.
    const focusKey = 'new-' + Date.now();
    setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem, _focusKey: focusKey }] }));
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-focus-key="${focusKey}"] input.form-input`);
      if (el) el.focus();
    });
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // v1.10.77 (#85) - the purchase register as CSV, Excel or Print / PDF, with
  // a total row. v1.10.74 columns kept: Cess and Inter-state; Tax never
  // included cess.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const registerRows = (() => {
    if (!filtered.length) return [];
    const sum = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, roundOff: 0, finalTotal: 0, paid: 0, balance: 0 };
    const rows = [...filtered].sort((x, y) => String(x.date || '').localeCompare(String(y.date || ''))).map(p => {
      const t = { ...calcPurchaseTotal(p.items, !!p.applyRoundOff), paid: purchasePaid(p), balance: purchaseBalance(p) };
      Object.assign(t, splitPurchaseTax(t.tax, !!p.interstate));
      for (const k of Object.keys(sum)) sum[k] += Number(t[k]) || 0;
      return [p.date || '', p.supplierName || '', p.supplierGstin || '', p.invoiceNumber || '', r2(t.taxable), r2(t.cgst), r2(t.sgst), r2(t.igst), r2(t.cess),
        p.interstate ? 'Y' : 'N', p.reverseCharge ? 'Y' : 'N', r2(t.roundOff), r2(t.finalTotal), r2(t.paid), r2(t.balance), PURCHASE_STATUS_LABEL[purchaseStatus(p)], p.note || ''];
    });
    return [...rows, ['Total', '', '', '', r2(sum.taxable), r2(sum.cgst), r2(sum.sgst), r2(sum.igst), r2(sum.cess), '', '', r2(sum.roundOff), r2(sum.finalTotal), r2(sum.paid), r2(sum.balance), '', '']];
  })();

  const isPo = form.kind === 'po';
  const editingBill = !isPo && editingId ? purchases.find(p => p.id === editingId) : null;
  const fromPoNumber = form.fromPo ? orders.find(o => o.id === form.fromPo)?.poNumber : '';
  const formTotals = calcPurchaseTotal(form.items, !isPo && form.applyRoundOff);
  const formTds = !isPo && form.tdsOn ? purchaseTdsFields(form, formTotals.taxable).tdsAmount : 0;

  return (
    <div className="dashboard-container">
      {/* v1.10.86 - one name: the menu and the page say Purchases; a bill is a Purchase Bill.
          In the top bar: Import from image and Import / export CSV as icons. */}
      <PageHeader
        title="Purchases"
        help={{ title: 'Purchases — how to use', doc: 'purchases' }}
        subtitle="Track supplier invoices for ITC claims in GSTR-3B"
        secondary={tab !== 'orders' && <>
          <BarButton icon={Wand2} label="Import from image (OCR)" onClick={() => setShowOCR(true)}
            title="Import from image (OCR): fill in a bill from a photo or scan of it" />
          <BulkCsvImport kind="purchase" onDone={() => { loadPurchases(); loadProducts(); }} />
        </>}
        primary={tab === 'orders'
          ? <button className="btn btn-primary" onClick={() => openNewPo()}><Plus size={18} /> New purchase order</button>
          : <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase Bill</button>}
      />

      {/* v1.10.83 (#112) - Purchase bills | Purchase orders, only when the
          Purchase orders feature is on. */}
      {/* v1.10.85 (#168) - and Returns, once there is a debit note. */}
      {(poEnabled || debitNotes.length > 0) && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button className={`btn ${tab === 'bills' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bills')} aria-pressed={tab === 'bills'}>
            <ShoppingCart size={16} /> Purchase bills
          </button>
          {poEnabled && (
            <button className={`btn ${tab === 'orders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('orders')} aria-pressed={tab === 'orders'}>
              <ClipboardList size={16} /> Purchase orders
            </button>
          )}
          {debitNotes.length > 0 && (
            <button className={`btn ${tab === 'returns' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('returns')} aria-pressed={tab === 'returns'}>
              <RotateCcw size={16} /> Returns ({debitNotes.length})
            </button>
          )}
        </div>
      )}

      {statementFor !== null && (
        <SupplierStatement purchases={purchases} debitNotes={debitNotes} profile={ownerProfile}
          initialSupplier={statementFor} onClose={() => setStatementFor(null)} />
      )}
      {tab === 'returns' && <DebitNotesList notes={debitNotes} purchases={purchases} ownerProfile={ownerProfile} onChanged={() => { loadPurchases(); loadProducts(); }} />}
      {returnBill && (
        <ReturnToSupplierModal bill={returnBill} debitNotes={debitNotes} ownerProfile={ownerProfile}
          onClose={() => setReturnBill(null)}
          onSaved={() => { setReturnBill(null); setTab('returns'); loadPurchases(); loadProducts(); }} />
      )}

      {tab === 'orders' && (
        <PurchaseOrders orders={orders} purchases={purchases} ownerProfile={ownerProfile}
          onNew={() => openNewPo()} onEdit={openEditPo} onConvert={openBillFromPo}
          onDuplicate={openNewPo} onCancel={cancelPo} />
      )}

      {/* v1.10.22 — Bill OCR modal (tesseract.js, lazy-loaded). */}
      {showOCR && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 320, textAlign: 'center' }}>Loading OCR…</div></div>}>
          <BillOCR onClose={() => setShowOCR(false)} onExtracted={applyOCR} />
        </Suspense>
      )}

      {/* v1.10.30 — Purchase view modal (quick check, no download). */}
      {/* #137 barcodes */}
      {labelBill && <BarcodeLabels bill={labelBill} debitNotes={debitNotes} title="Print labels for this purchase" onClose={() => setLabelBill(null)} />}
      {viewPurchase && (() => {
        const p = viewPurchase;
        const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
        return (
          <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Purchase Bill · {p.invoiceNumber || '—'} <HelpButton title="Viewing a purchase bill" doc="purchases#view-bill" size={16} /></h3>
                <button className="icon-btn" onClick={() => setViewPurchase(null)} title="Close"><X size={18} /></button>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} · {PURCHASE_STATUS_LABEL[purchaseStatus(p)]} · {p.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}{p.reverseCharge ? ' · Reverse charge: Yes' : ''}
              </div>
              {/* Supplier block */}
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Supplier</div>
                <div style={{ fontWeight: 600 }}>{p.supplierName || '—'}</div>
                {p.supplierAddress && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.supplierAddress}</div>}
                {p.supplierGstin && <div style={{ fontSize: '0.82rem' }}>GSTIN: <strong>{p.supplierGstin}</strong></div>}
              </div>
              {/* Line items */}
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '1rem' }}>
                <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>GST%</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.items || []).map((it, idx) => {
                      const line = purchaseLineTax({ ...it, quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0 }).amount;
                      const withTax = line * (1 + (Number(it.taxPercent) || 0) / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.name || '—'}
                            {lineNote(it) && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{lineNote(it)}</div>}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{it.hsn || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{it.quantity || 0}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{it.taxPercent || 0}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(withTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1rem', fontSize: '0.9rem', maxWidth: 320, marginLeft: 'auto' }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxable</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</span>
                {/* v1.10.74 - tax split: IGST, or CGST + SGST half each. */}
                {p.interstate ? (
                  <><span style={{ color: 'var(--text-muted)' }}>IGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.tax)}</span></>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>CGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(splitPurchaseTax(t.tax, false).cgst)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>SGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(splitPurchaseTax(t.tax, false).sgst)}</span>
                  </>
                )}
                {t.cess > 0.005 && <><span style={{ color: 'var(--text-muted)' }}>Cess</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.cess)}</span></>}
                {Math.abs(t.roundOff) > 0.005 && <><span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Round-off</span><span style={{ textAlign: 'right', fontStyle: 'italic' }}>{(t.roundOff > 0 ? '+' : '') + formatCurrency(t.roundOff)}</span></>}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, fontWeight: 700 }}>TOTAL</span>
                {/* v1.10.34 — was hardcoded color:'#0f172a' (slate-900) which
                    disappeared against the dark card background. Reported
                    with screenshot showing invisible total on Purchase Bill
                    view modal. Now uses --text so it flips with theme. */}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{formatCurrency(t.finalTotal)}</span>
                {((Number(p.tdsAmount) || 0) > 0 || p.reverseCharge) && (
                  <>
                    {/* v1.10.86 - reverse charge: the GST is yours to pay, not the supplier's. */}
                    {p.reverseCharge && <><span style={{ color: 'var(--text-muted)' }}>Less: GST you pay (reverse charge)</span><span style={{ textAlign: 'right' }}>-{formatCurrency(purchaseRcmTax(p))}</span></>}
                    {(Number(p.tdsAmount) || 0) > 0 && <><span style={{ color: 'var(--text-muted)' }}>Less: TDS ({sectionShort(p.tdsSection)}{p.tdsRate ? ` @ ${p.tdsRate}%` : ''})</span>
                    <span style={{ textAlign: 'right' }}>-{formatCurrency(p.tdsAmount)}</span></>}
                    <span style={{ fontWeight: 600 }}>Paid to supplier</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(purchaseOwed(p))}</span>
                  </>
                )}
                {/* v1.10.83 (#123) - paid so far and what is left. */}
                {hasPurchasePayments(p) && (
                  <><span style={{ color: 'var(--text-muted)' }}>Paid</span><span style={{ textAlign: 'right' }}>{formatCurrency(purchasePaid(p))}</span></>
                )}
                {/* v1.10.85 (#168) */}
                {p._returned > 0 && (
                  <><span style={{ color: 'var(--text-muted)' }}>Returned (debit notes)</span><span style={{ textAlign: 'right' }}>-{formatCurrency(p._returned)}</span></>
                )}
                <span style={{ fontWeight: 600 }}>Balance due</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: purchaseBalance(p) > 0.005 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(purchaseBalance(p))}</span>
              </div>
              {hasPurchasePayments(p) && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="form-label">Payments made <HelpButton title="Payment history" doc="purchases#payment-history" size={14} /></div>
                  <div className="payment-history">
                    {p.payments.map((x, i) => (
                      <div key={x.id || i} className="payment-row" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 90 }}>{x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN') : '-'}</span>
                        <span className="font-bold" style={{ minWidth: 100 }}>{formatCurrency(x.amount)}</span>
                        <span className="text-muted">{purchasePaymentModeName(x.mode)}</span>
                        {(x.reference || x.note) && <span className="text-muted" style={{ overflowWrap: 'anywhere' }}>· {[x.reference, x.note].filter(Boolean).join(' · ')}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {p.note &&<p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '1rem' }}>Note: {p.note}</p>}
              {/* Action bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setViewPurchase(null)}>Close</button>
                <button className="btn btn-secondary" onClick={() => { setPayPurchase(p); setViewPurchase(null); }}><IndianRupee size={14} /> Payments</button>
                <button className="btn btn-secondary" onClick={() => { openEdit(p); setViewPurchase(null); }}><Edit3 size={14} /> Edit</button>
                {/* #137 barcodes - one label per piece bought, matched to Products. */}
                {isModuleEnabled('barcodes', getEnabledModules()) && (
                  <button className="btn btn-secondary" onClick={() => { setLabelBill(p); setViewPurchase(null); }}><Barcode size={14} /> Print labels for this purchase</button>
                )}
                <button className="btn btn-primary" onClick={() => viewAsPdf(p)}><Download size={14} /> Download PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {payPurchase && (
        <PurchasePaymentModal purchase={payPurchase} onClose={() => setPayPurchase(null)} onChanged={() => loadPurchases()} />
      )}

      {/* Stats */}
      {tab === 'bills' && (<>
      <UnassignedBanner
        count={unassignedPurchases.length}
        businessName={ownerProfile?.businessName}
        noun="purchase bill"
        onAssign={assignUnassignedPurchases}
      />

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">{returnStats.total > 0 ? 'Total Purchases (less returns)' : 'Total Purchases'}</p><h2 className="stat-value stat-value-purple" style={{ '--len': formatCurrency(totalStats.total - returnStats.total).length }}>{formatCurrency(totalStats.total - returnStats.total)}</h2>
            {returnStats.total > 0 && <p className="text-muted" style={{ fontSize: '0.72rem', margin: 0 }}>{formatCurrency(totalStats.total)} bought, {formatCurrency(returnStats.total)} returned</p>}</div>
        </div>
        {/* v1.10.83 (#123) - what is still to pay on the bills shown. */}
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><IndianRupee size={22} /></div>
          <div>
            <p className="stat-label">Owed to suppliers <HelpButton title="Owed to suppliers" doc="purchases#owed-to-suppliers" size={13} /></p>
            <h2 className="stat-value" style={{ color: totalStats.owed > 0.005 ? 'var(--danger)' : undefined, '--len': formatCurrency(totalStats.owed).length }}>{formatCurrency(totalStats.owed)}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">GST (ITC Eligible)</p><h2 className="stat-value stat-value-green" style={{ '--len': formatCurrency(totalStats.tax - returnStats.tax).length }}>{formatCurrency(totalStats.tax - returnStats.tax)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search supplier, invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {/* v1.10.74 - '' already means no FY filter below. */}
            <option value="">All years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Payment status">
            <option value="">All bills</option>
            <option value="due">Unpaid / Partly paid</option>
            <option value="Paid">Paid</option>
          </select>
          {ccOn && <CostCentreFilter centres={centres} value={centreFilter} onChange={setCentreFilter} />}
          {(search || centreFilter || statusFilter) && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setCentreFilter(''); setStatusFilter(''); }} title="Clear search" aria-label="Clear search"><X size={15} /></button>
          )}
        </div>
      </div>

      </>)}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <h3 className="section-title">{isPo ? (editingId ? 'Edit purchase order' : 'New purchase order') : (editingId ? 'Edit Purchase Bill' : 'Add Purchase Bill')} <HelpButton title="Purchases" doc={isPo ? 'purchases#new-po' : (fromPoNumber && !editingId) ? 'purchases#convert-po' : 'purchases#add-purchase'} size={16} style={{ marginLeft: 6 }} /></h3>
            {/* v1.10.86 - (#175) filled in from GSTR-2B. */}
            {!isPo && form.from2b && !editingId && (
              <div className="notice notice-info twob-draft-note" style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Filled in from GSTR-2B: one line per GST rate. Check it and Save. To add the goods to stock, change each line to your item name, quantity and rate; lines left as &quot;(from GSTR-2B)&quot; are not added to Products.
              </div>
            )}
            {/* v1.10.83 (#112) - a bill made from a purchase order. */}
            {!isPo && fromPoNumber && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                From purchase order <strong>{fromPoNumber}</strong>. Type the supplier's bill number, and change quantities to what actually came.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">{isPo ? 'PO date *' : 'Date *'}</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              {isPo ? (
                <div className="form-group">
                  <label className="form-label">Expected delivery</label>
                  <input type="date" className="form-input" value={form.expectedDate} onChange={e => updateField('expectedDate', e.target.value)} />
                </div>
              ) : (
              <div className="form-group">
                <label className="form-label">Payment Status <HelpButton title="Paying suppliers" doc="purchases#payment-status" size={13} /></label>
                {/* v1.10.83 (#123) - with payments recorded, they decide the
                    status: change them from the ₹ button in the list. A part
                    payment needs its amount, so Partly paid is not offered here
                    (an old bill already Partial keeps it). */}
                {hasPurchasePayments(editingBill) ? (
                  <div className="form-input" style={{ background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                    {PURCHASE_STATUS_LABEL[purchaseStatus(editingBill)]} · {editingBill.payments.length} payment{editingBill.payments.length === 1 ? '' : 's'} (₹ button in the list)
                  </div>
                ) : (
                  <select className="form-input" value={form.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}>
                    {PAYMENT_STATUSES.filter(s => s !== 'Partial' || form.paymentStatus === 'Partial').map(s => <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>)}
                  </select>
                )}
              </div>
              )}
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                {/* v1.10.50 (#39) — recall previously used suppliers; a
                    supplier not yet in the history must still be typeable.
                    v1.10.86 - the app's own list (ComboInput) in place of the
                    browser's <datalist>. Still the name only (#40: Firefox
                    showed a datalist label INSTEAD of the value); the GSTIN is
                    filled in on picking anyway. */}
                <ComboInput type="text" className="form-input" value={form.supplierName} listId="fgsb-supplier-history" listLabel="Previous suppliers"
                  options={supplierHistory.map(s => s.name)}
                  onChange={e => updateSupplierName(e.target.value)}
                  placeholder={supplierHistory.length ? 'Type or pick a previous supplier' : 'Vendor / Supplier name'} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier GSTIN</label>
                <input type="text" className="form-input" value={form.supplierGstin}
                  onChange={e => updateSupplierGstin(e.target.value)} placeholder="15-digit GSTIN" maxLength={15} />
              </div>
              {/* v1.10.29 — Supplier address for the PDF. Optional; full width row. */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Supplier Address (optional)</label>
                <input type="text" className="form-input" value={form.supplierAddress || ''}
                  onChange={e => updateField('supplierAddress', e.target.value)}
                  placeholder={isPo ? 'Street, City, State — printed on the PO' : 'Street, City, State — printed on the Purchase Bill PDF'} />
              </div>
              {isPo ? (<>
                <div className="form-group">
                  <label className="form-label">PO number *</label>
                  <input type="text" className="form-input" value={form.poNumber}
                    onChange={e => updateField('poNumber', e.target.value)} placeholder="PO/26-27/0001" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes / terms (optional)</label>
                  <textarea className="form-input" rows={3} value={form.note}
                    onChange={e => updateField('note', e.target.value)} placeholder="Delivery address, payment terms, packing..." />
                </div>
              </>) : (<>
              <div className="form-group">
                <label className="form-label">Invoice Number *</label>
                <input type="text" className="form-input" value={form.invoiceNumber}
                  onChange={e => updateField('invoiceNumber', e.target.value)} placeholder="Supplier invoice no." />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any note..." />
              </div>
              </>)}
              {ccOn && (
                <div className="form-group">
                  <label className="form-label" htmlFor="cost-centre">Cost centre</label>
                  <CostCentreSelect centres={centres} value={form.costCentre} name={form.costCentreName}
                    onChange={(id, name) => setForm(prev => ({ ...prev, costCentre: id, costCentreName: name }))} />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state purchase</strong> — supplier charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B instead of CGST + SGST. Tip: first 2 digits of supplier GSTIN = their state code.
                    </span>
                  </span>
                </label>
              </div>
              {/* v1.10.86 - reverse charge: you pay this bill's GST to the government. */}
              {!isPo && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" className="purchase-rcm" checked={!!form.reverseCharge}
                      onChange={e => updateField('reverseCharge', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    <span>
                      <strong>Reverse charge</strong> — you pay this GST to the government, not the supplier
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                        For example a transporter (GTA), an advocate, or goods the law puts under reverse charge. GSTR-3B shows the tax in 3.1(d), paid in cash, and as credit in 4(A)(3). The supplier is owed the bill without GST.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Items <HelpButton title="Items on the bill" doc="purchases#purchase-items" size={16} /></h4>
              {/* v1.10.85 (#171, #160) - extra columns, off until wanted. */}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={showDiscountCol} disabled={showDiscountCol && !lineCols.discount}
                  onChange={() => toggleLineCol('discount')} style={{ accentColor: 'var(--primary)' }} /> Discount column
              </label>
              {!isPo && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={showSerialCol} disabled={showSerialCol && !lineCols.serial}
                    onChange={() => toggleLineCol('serial')} style={{ accentColor: 'var(--primary)' }} /> Serial No. column
                </label>
              )}
            </div>
            {form.items.map((item, idx) => (
              <div key={idx} data-focus-key={item._focusKey} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: isPo ? 1.2 : 2, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Name</label>}
                  {/* v1.10.50 (#39) — recall previously purchased items along
                      with their HSN, rate and tax rates. v1.10.86 - in the
                      app's own list (ComboInput); the name only, as above. */}
                  <ComboInput type="text" className="form-input" value={item.name}
                    listId="fgsb-item-history" listLabel="Previous items" options={itemNames}
                    onChange={e => updateItemName(idx, e.target.value)}
                    // #137 barcodes - a scanned (or typed) barcode + Enter puts in its product.
                    // Only with Barcodes on, and not when a product is called exactly what was typed.
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !isModuleEnabled('barcodes', getEnabledModules())) return;
                      const typed = (item.name || '').trim().toLowerCase();
                      const hit = !products.some(pr => (pr.name || '').trim().toLowerCase() === typed) && findByBarcode(products, item.name);
                      if (hit) { e.preventDefault(); updateItemName(idx, hit.name); }
                    }}
                    placeholder={itemHistory.length ? 'Type or pick a previous item' : 'Item name'} />
                </div>
                <div className="form-group" style={{ flex: isPo ? 0.8 : 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">HSN</label>}
                  <input type="text" className="form-input" value={item.hsn}
                    onChange={e => updateItem(idx, 'hsn', e.target.value)} placeholder="HSN" />
                </div>
                <div className="form-group" style={{ flex: isPo ? 0.9 : 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Qty</label>}
                  {/* v1.6.8 (P2 #30): decimal quantity for 2.5 kg / 0.5 hr / etc. */}
                  {/* v1.10.69 - requested (#71 item 2, @sangwanmail-eng): the
                      number fields here now select their contents on focus, as
                      the invoice screen has since v1.10.67. Without it, typing
                      into a field showing 0 gave you 018 rather than 18. */}
                  <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                    onFocus={e => e.target.select()}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                </div>
                {(() => {
                  // v1.10.85 (#148) - a product with a second unit: pick Pcs or Box.
                  const altProduct = products.find(pr => hasAltUnit(pr) && (pr.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase());
                  if (altProduct) {
                    return (
                      <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                        {idx === 0 && <label className="form-label">Unit</label>}
                        <select className="form-input" aria-label={`Unit of ${item.name}`} value={lineFactor(item) !== 1 ? altProduct.altUnit : (altProduct.unit || 'Nos')}
                          onChange={e => { const unit = e.target.value; setForm(prev => ({ ...prev, items: prev.items.map((x, i) => (i === idx ? lineInUnit(x, altProduct, unit, { kind: 'purchase' }) : x)) })); }}>
                          <option value={altProduct.unit || 'Nos'}>{altProduct.unit || 'Nos'}</option>
                          <option value={altProduct.altUnit}>{altProduct.altUnit} of {Number(altProduct.altFactor)}</option>
                        </select>
                      </div>
                    );
                  }
                  return isPo && (
                    <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                      {idx === 0 && <label className="form-label">Unit</label>}
                      <ComboInput type="text" className="form-input" value={item.unit || ''} options={unitNames} listLabel="Units"
                        onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Nos" />
                    </div>
                  );
                })()}
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Rate</label>}
                  <input type="number" className="form-input" value={item.rate} min="0" step="any"
                    onFocus={e => e.target.select()}
                    onChange={e => updateItem(idx, 'rate', e.target.value)} />
                </div>
                {/* v1.10.85 (#171) - a discount off the line, % or an amount, before GST. */}
                {showDiscountCol && (
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    {idx === 0 && <label className="form-label">Discount</label>}
                    <div style={{ display: 'flex', gap: 2 }}>
                      <input type="number" className="form-input" value={item.discount ?? ''} min="0" step="any" placeholder="0"
                        aria-label={`Discount on line ${idx + 1}`} style={{ minWidth: 0 }}
                        onFocus={e => e.target.select()}
                        onChange={e => updateItem(idx, 'discount', e.target.value)} />
                      <select className="form-input" value={item.discountType === 'percent' ? 'percent' : 'fixed'} style={{ width: 52, padding: '0 0.2rem' }}
                        aria-label={`Discount type on line ${idx + 1}`} onChange={e => updateItem(idx, 'discountType', e.target.value)}>
                        <option value="percent">%</option>
                        <option value="fixed">₹</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ flex: isPo ? 0.95 : 0.75, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Tax %</label>}
                  {/* v1.6.8 (P2 #29): "Other…" for jeweller 3% / diamond 0.25% /
                       agriculture 0.1% and any bespoke rate. */}
                  <select className="form-input" value={
                    ['0','0.1','0.25','3','5','12','18','28','40'].includes(String(item.taxPercent)) ? String(item.taxPercent) : '__custom__'
                  } onChange={async e => {
                    if (e.target.value === '__custom__') {
                      const v = await promptAction({
                        title: 'Custom tax rate',
                        message: 'Enter a GST rate between 0% and 100% (up to 2 decimals).',
                        defaultValue: String(item.taxPercent || 0),
                        placeholder: 'e.g. 7.5',
                        inputType: 'number',
                        confirmLabel: 'Apply rate',
                      });
                      const n = parseFloat(v);
                      if (Number.isFinite(n) && n >= 0 && n <= 100) updateItem(idx, 'taxPercent', n);
                    } else {
                      updateItem(idx, 'taxPercent', e.target.value);
                    }
                  }}>
                    <option value="0">0%</option>
                    <option value="0.1">0.1%</option>
                    <option value="0.25">0.25%</option>
                    <option value="3">3%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                    <option value="40">40%</option>
                    <option value="__custom__">Other…{['0','0.1','0.25','3','5','12','18','28','40'].includes(String(item.taxPercent)) ? '' : ` (${item.taxPercent}%)`}</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label" title="Compensation Cess — for tobacco, aerated, motor vehicles, coal, etc.">Cess %</label>}
                  <input type="number" className="form-input" value={item.cessPercent ?? 0} min="0" step="any"
                    onFocus={e => e.target.select()}
                    onChange={e => updateItem(idx, 'cessPercent', e.target.value)} />
                </div>
                {/* v1.10.85 (#160) - the serial number / IMEI of each piece. */}
                {showSerialCol && !isPo && (
                  <div className="form-group" style={{ flex: '1 1 100%', margin: 0 }}>
                    {idx === 0 && <label className="form-label">Serial No. / IMEI</label>}
                    <input type="text" className="form-input" value={item.serialNo || ''} maxLength={2000}
                      aria-label={`Serial numbers on line ${idx + 1}`} placeholder="One per piece, separated by commas"
                      onChange={e => updateItem(idx, 'serialNo', e.target.value)} />
                  </div>
                )}
                <div style={{ flex: '0 0 auto', marginBottom: idx === 0 ? 0 : 0 }}>
                  {form.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => removeItem(idx)} title="Remove"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={addItem}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Taxable: <strong>{formatCurrency(formTotals.taxable)}</strong></span>
                {/* v1.10.83 (#117) - the split as filed, not one tax figure. */}
                {form.interstate ? (
                  <span>IGST: <strong>{formatCurrency(formTotals.tax)}</strong></span>
                ) : (
                  <>
                    <span>CGST: <strong>{formatCurrency(splitPurchaseTax(formTotals.tax, false).cgst)}</strong></span>
                    <span>SGST: <strong>{formatCurrency(splitPurchaseTax(formTotals.tax, false).sgst)}</strong></span>
                  </>
                )}
                {formTotals.cess > 0 && (
                  <span>Cess: <strong>{formatCurrency(formTotals.cess)}</strong></span>
                )}
                {/* v1.10.74 - hide when there is nothing to round, like View/PDF. */}
                {form.applyRoundOff && Math.abs(formTotals.roundOff) > 0.005 && (
                  <span style={{ color: '#475569' }}>
                    Round-off: <strong>{(formTotals.roundOff >= 0 ? '+' : '') + formatCurrency(formTotals.roundOff)}</strong>
                  </span>
                )}
                <span>Total: <strong>{formatCurrency(formTotals.finalTotal)}</strong></span>
                {(formTds > 0 || (!isPo && form.reverseCharge)) && (
                  <>
                    {!isPo && form.reverseCharge && <span>Less GST you pay (reverse charge): <strong>{formatCurrency(formTotals.tax + formTotals.cess)}</strong></span>}
                    {formTds > 0 && <span>Less TDS: <strong>{formatCurrency(formTds)}</strong></span>}
                    <span>Paid to supplier: <strong>{formatCurrency(formTotals.finalTotal - formTds - (!isPo && form.reverseCharge ? formTotals.tax + formTotals.cess : 0))}</strong></span>
                  </>
                )}
              </div>
              {!isPo && (
                <div style={{ marginTop: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    {/* v1.10.85 (#180) - ticking TDS on a bill dated from 1 April 2026 moves an old section to its 2025 place. */}
                    <input type="checkbox" checked={!!form.tdsOn} onChange={e => {
                      const on = e.target.checked;
                      const moved = on && tdsSectionsFor(form.date) === TDS_SECTIONS_2025 ? movedSection(form.tdsSection, form.tdsRate, 'tds') : null;
                      setForm(prev => ({ ...prev, tdsOn: on, ...(moved ? { tdsSection: moved.section, tdsRate: moved.rate } : {}) }));
                    }}
                      style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                    <span><strong>TDS deducted</strong> — you keep back income-tax TDS from this supplier's payment and deposit it yourself</span>
                    <HelpButton title="TDS on a purchase bill" doc="purchases#purchase-tds" size={14} />
                  </label>
                  {form.tdsOn && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <select className="form-input" aria-label="TDS section" value={form.tdsSection}
                        onChange={e => {
                          const code = e.target.value;
                          const sec = tdsSectionsFor(form.date).find(x => x.code === code);
                          setForm(prev => ({ ...prev, tdsSection: code, tdsRate: code === 'custom' ? prev.tdsRate : (sec?.rate ?? prev.tdsRate), tdsAmountManual: '' }));
                        }}>
                        {form.tdsSection && !tdsSectionsFor(form.date).some(x => x.code === form.tdsSection) && (
                          <option value={form.tdsSection} disabled>{sectionOptionLabel(form.tdsSection)}</option>
                        )}
                        {tdsSectionsFor(form.date).map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
                      </select>
                      <input type="number" step="any" min="0" max="100" className="form-input" aria-label="TDS rate %" placeholder="Rate %"
                        value={form.tdsRate} onChange={e => setForm(prev => ({ ...prev, tdsRate: e.target.value, tdsAmountManual: '' }))} />
                      <input type="number" step="any" min="0" className="form-input" aria-label="TDS amount" placeholder={`Amount (${formatCurrency(purchaseTdsAmount(formTotals.taxable, form.tdsRate))})`}
                        value={form.tdsAmountManual} onChange={e => updateField('tdsAmountManual', e.target.value)} />
                    </div>
                  )}
                </div>
              )}
              {!isPo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer', marginTop: '0.6rem', color: '#475569' }}>
                <input type="checkbox" checked={!!form.applyRoundOff}
                  onChange={e => updateField('applyRoundOff', e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                <span>
                  <strong>Apply round-off</strong> — round the grand total to the nearest rupee.
                  Use when the supplier's bill is rounded (e.g. ₹1,234.56 → ₹1,235). Off by default —
                  most suppliers' totals already match what's calculated from line items.
                </span>
              </label>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Table */}
      {tab === 'bills' && (
      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Purchase Records <HelpButton title="Purchase Records" doc="purchases#purchase-list" size={16} /></h3>
          {/* v1.10.86 - (#194) opens on the supplier searched for, when the list shows only one. */}
          {purchases.length > 0 && (
            <button type="button" className="btn btn-secondary" style={{ marginLeft: 'auto' }}
              title="A supplier's bills, payments and returns for a period, with what you still owe (PDF, print, WhatsApp, email)"
              onClick={() => setStatementFor(new Set(filtered.map(p => (p.supplierName || '').trim().toLowerCase())).size === 1 ? filtered[0].supplierName : '')}>
              <FileText size={15} /> Supplier statement
            </button>
          )}
          <TableExport title="Purchase register" filename="Purchases" landscape
            subtitle={ownerProfile?.businessName || ''}
            headers={['Date', 'Supplier', 'GSTIN', 'Invoice No', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Cess', 'Inter-state', 'Reverse charge', 'Round-off', 'Total', 'Paid', 'Balance due', 'Status', 'Note']}
            rows={registerRows} />
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={48} />
            <p>{purchases.length === 0 ? 'No purchase bills recorded yet.' : 'No purchases match your filters.'}</p>
            {purchases.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase Bill</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <SortTh col="date" label="Date" sort={sort} onSort={toggleSort} />
                  <SortTh col="supplier" label="Supplier" sort={sort} onSort={toggleSort} />
                  <th>GSTIN</th>
                  <SortTh col="invoice" label="Invoice No" sort={sort} onSort={toggleSort} />
                  <SortTh col="taxable" label="Taxable" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <SortTh col="tax" label="Tax" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <SortTh col="total" label="Total" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <SortTh col="balance" label="Balance due" style={{ textAlign: 'right' }} sort={sort} onSort={toggleSort} />
                  <SortTh col="status" label="Status" sort={sort} onSort={toggleSort} />
                  <th className="col-center col-sticky-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPurchases.map(p => {
                  const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
                  const st = purchaseStatus(p);
                  const bal = purchaseBalance(p);
                  return (
                    <tr key={p.id}>
                      <td className="text-muted">{p.date ? new Date(p.date).toLocaleDateString('en-IN') : ''}</td>
                      <td className="font-medium">{p.supplierName}</td>
                      <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.supplierGstin || '-'}</td>
                      <td><span className="invoice-badge">{p.invoiceNumber}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</td>
                      <td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(t.tax)}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(t.finalTotal)}</td>
                      <td style={{ textAlign: 'right', color: bal > 0.005 ? 'var(--danger)' : 'var(--text-muted)' }}>{bal > 0.005 ? formatCurrency(bal) : '-'}</td>
                      {/* v1.10.69 - requested (#71 item 3, @sangwanmail-eng):
                          "the Status column should have a drop-down option,
                          similar to the Status drop-down available on the
                          Dashboard." Marking a supplier bill paid took
                          opening it, changing one field and saving. */}
                      <td>
                        <select className="status-select"
                          value={st} aria-label={`Payment status of ${p.invoiceNumber}`}
                          style={{ background: PAYMENT_STATUS_COLORS[st].bg, color: PAYMENT_STATUS_COLORS[st].color, borderColor: PAYMENT_STATUS_COLORS[st].color + '44' }}
                          onChange={e => changePaymentStatus(p, e.target.value)}>
                          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="col-sticky-actions">
                        <div className="table-actions">
                          {/* v1.10.30 — quick View modal (no download).
                              Modal has a Download PDF button inside for
                              users who do want the file. */}
                          {/* v1.10.86 - the same row buttons as every list: View · Edit · Payment · More. */}
                          <button className="icon-btn icon-btn-blue" onClick={() => setViewPurchase(p)} title="View details (no download)" aria-label={`View ${p.invoiceNumber}`}><Eye size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => openEdit(p)} title="Edit" aria-label={`Edit ${p.invoiceNumber}`}><Edit3 size={15} /></button>
                          {/* v1.10.83 (#123) - record / see payments to the supplier. */}
                          <button className="icon-btn icon-btn-green" onClick={() => setPayPurchase(p)} title={st === 'Paid' ? 'Payment history' : 'Payment to supplier'} aria-label={`Payment for ${p.invoiceNumber}`}><IndianRupee size={15} /></button>
                          <ActionsMenu label={`More actions for ${p.invoiceNumber}`} items={[
                            // v1.10.85 (#168) - send goods back: a debit note against this bill.
                            // v1.10.86 - in More, with its words (the arrow icon read as Undo).
                            { label: 'Return to supplier (debit note)', icon: RotateCcw, onClick: () => setReturnBill(p), hidden: !canReturn(p) },
                            { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => handleDelete(p.id) },
                          ]} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.tax)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.total)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.owed)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
