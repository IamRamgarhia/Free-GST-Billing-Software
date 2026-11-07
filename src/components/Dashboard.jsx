import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Trash2, Plus, IndianRupee, Receipt, Edit3, TrendingUp, Search, Copy, X, CheckCircle, Clock, AlertTriangle, MessageCircle, Mail, StickyNote, Send, Package, Download, Printer, Ban, Undo2, Eye, QrCode, Upload } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllBills, saveBill, getAllProducts, applyStockChanges, getProfile, getAllClients, getStockAlertSettings, saveReceipt, deleteReceipt, getAllReceipts, markSavedPdfCancelled, getEnabledModules, trashBill, getTrashedBills, restoreBillFromTrash, purgeTrashedBill } from '../store';
import { formatCurrency, INVOICE_TYPES, getFYOptions, numberToWords, belongsToProfile, salesSign, isCancelledBill, markPaidPatch, markUnpaidPatch, stockEffect, appliedStock, stockDelta, SALES_INVOICE_TYPES, localToday, amountDue, paymentStatusFor, isModuleEnabled, TDS_SECTIONS, findLowStock, trackedStock, billMatchesSearch } from '../utils';
import { billInInr, billCurrency as fxBillCurrency, baseCurrencyOf } from '../utils/fx';
import { withClientTds } from '../utils/tdsTcs';
import { prepareEInvoices, parseIrpResponse, matchIrnEntries, downloadJson, einvoiceFileName } from '../utils/einvoice';
import { EInvoiceReport } from './EInvoiceModal';
import { openWhatsAppShare, invoiceShareMessage } from '../utils/share';
import PageHeader from './PageHeader';
import LockButton from './LockButton';
import ActionsMenu from './ActionsMenu';
import BulkCsvImport from './BulkCsvImport';
import PrintPreviewModal from './PrintPreviewModal';
import InvoiceTrash from './InvoiceTrash';
import SupportNudge from './SupportNudge';
import WelcomeCard from './WelcomeCard';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import { useCostCentres } from './useCostCentres';
import { CostCentreFilter } from './CostCentrePicker';
import { matchesCentre, centreFields, centreLabel, UNTAGGED } from '../utils/costCentres';

// v1.10.13 — `bg` values switched from opaque tints (#fffbeb / #f5f3ff /
// etc.) to translucent alpha versions of the accent color. Reason:
// prior hex backgrounds were LIGHT-MODE ONLY. In dark mode the status
// pills appeared as pale rectangles on the dark row background — the
// user reported "NEW ISSUE IN CASE OF DARK MODE". rgba() with 12%
// alpha lets the underlying row bg show through and works in both
// themes.
// v1.10.79 - put a captured invoice on A4 pages. It used to be drawn into one
// page whatever its height (`Math.min(h, 297)`), so a long invoice shared on
// WhatsApp or in Bulk PDF came out squashed into a single page. Now each
// 297 mm slice is its own page.
// `breaks` are canvas heights where a page may end (row and block bottoms,
// see safeBreaks): a page ends at the last one that fits, so rows and the
// signature are not cut in half.
function addCanvasAsA4Pages(doc, canvas, startOnNewPage, breaks = []) {
  const pageW = 210;
  const pageH = 297;
  const slicePx = Math.floor((canvas.width * pageH) / pageW);
  for (let y = 0, page = 0; y < canvas.height; page++) {
    let h = Math.min(slicePx, canvas.height - y);
    if (y + h < canvas.height) {
      const cut = breaks.filter((b) => b > y + slicePx * 0.5 && b <= y + slicePx).pop();
      if (cut) h = cut - y;
    }
    if (page > 0 && h < 4) break; // a sliver of white margin is not worth a page
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0 || startOnNewPage) doc.addPage();
    doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (h * pageW) / canvas.width, undefined, 'FAST');
    y += h;
  }
}

// Heights (in canvas pixels) where a page may end: the bottom of each table
// row and of each block the editor's own PDF also keeps whole.
function safeBreaks(el, canvas) {
  const top = el.getBoundingClientRect().top;
  const scale = canvas.height / Math.max(1, el.getBoundingClientRect().height);
  return [...el.querySelectorAll('tr, .inv-footer-block, [data-pdf-page-boundary], .inv-signature')]
    .map((n) => Math.round((n.getBoundingClientRect().bottom - top) * scale))
    .filter((b) => b > 0 && b < canvas.height)
    .sort((a, b) => a - b);
}

const STATUS_CONFIG = {
  unpaid:  { label: 'Unpaid',  icon: Clock,          color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  partial: { label: 'Partial', icon: Clock,          color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
  paid:    { label: 'Paid',    icon: CheckCircle,    color: '#059669', bg: 'rgba(5, 150, 105, 0.14)'  },
  overdue: { label: 'Overdue', icon: AlertTriangle,  color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)'  },
  // v1.10.67 (#66 item 12) — a cancelled document keeps its number but counts
  // for nothing. Picking any other status here un-cancels it.
  cancelled: { label: 'Cancelled', icon: Ban, color: '#64748b', bg: 'rgba(100, 116, 139, 0.16)' },
};

// v1.10.74 - one list for the Record Payment mode select and its Payment
// History, so history shows "Bank Transfer" instead of "bank-transfer".
const PAYMENT_MODES = [
  ['bank-transfer', 'Bank Transfer'], ['upi', 'UPI'], ['cash', 'Cash'],
  ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other'],
];
const paymentModeName = (mode) => (PAYMENT_MODES.find(([v]) => v === mode) || [])[1] || mode;

// v1.10.6 — audit L4: was a local copy of getFYOptions. Now imported
// from ../utils so a bugfix touches one file, not five.

// v1.10.9 — Payment Receipt modal. Renders a printable receipt for a
// specific payment against a specific invoice. Print button uses
// window.print() and the CSS injected on mount hides everything else so
// only the receipt shows on paper.
function ReceiptModal({ target, onClose }) {
  const { bill, payment, remaining } = target;
  const currency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
  const businessName = bill.data?.profile?.businessName || 'Your Business';
  const businessAddress = bill.data?.profile?.address || '';
  const businessGstin = bill.data?.profile?.gstin || '';
  const businessPhone = bill.data?.profile?.phone || '';
  const businessEmail = bill.data?.profile?.email || '';
  const clientName = bill.data?.client?.name || bill.clientName || 'Client';
  const clientAddress = bill.data?.client?.address || '';
  const clientPhone = bill.data?.client?.phone || '';
  const receiptNo = `RCPT-${(payment.id || '').replace('pay_', '').toUpperCase().slice(0, 10)}`;
  const paymentModeLabel = {
    'bank-transfer': 'Bank Transfer', 'upi': 'UPI', 'cash': 'Cash',
    'cheque': 'Cheque', 'card': 'Card', 'other': 'Other',
  }[payment.mode] || payment.mode;

  const doPrint = () => {
    let styleEl = document.getElementById('fgsb-receipt-print-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'fgsb-receipt-print-css';
      styleEl.textContent = `
        @media print {
          body * { visibility: hidden !important; }
          .fgsb-receipt-page, .fgsb-receipt-page * { visibility: visible !important; }
          .fgsb-receipt-page { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: #fff !important; color: #000 !important; }
          .fgsb-receipt-noprint { display: none !important; }
          @page { size: A5; margin: 12mm; }
        }
      `;
      document.head.appendChild(styleEl);
    }
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="fgsb-receipt-noprint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Payment Receipt <HelpButton title="Payment Receipt" doc="dashboard#receipt" size={16} /></h3>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="fgsb-receipt-page" style={{
          background: '#fff', color: '#111', padding: '1.5rem 1.75rem',
          border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Helvetica, Arial, sans-serif',
        }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em' }}>{businessName}</div>
            {businessAddress && <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 3 }}>{businessAddress}</div>}
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 3 }}>
              {businessGstin && <>GSTIN: <strong>{businessGstin}</strong> · </>}
              {businessPhone && <>Ph: {businessPhone} · </>}
              {businessEmail}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            PAYMENT RECEIPT
          </div>
          <table style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <tbody>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Receipt No.</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{receiptNo}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Payment Date</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Against Invoice</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{bill.invoiceNumber}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Payment Mode</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{paymentModeLabel}</td></tr>
              {payment.note && <tr><td style={{ padding: '3px 0', color: '#475569' }}>Ref / Note</td><td style={{ textAlign: 'right' }}>{payment.note}</td></tr>}
            </tbody>
          </table>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>Received with thanks from</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 3 }}>{clientName}</div>
            {clientAddress && <div style={{ fontSize: '0.72rem', color: '#475569' }}>{clientAddress}</div>}
            {clientPhone && <div style={{ fontSize: '0.72rem', color: '#475569' }}>Ph: {clientPhone}</div>}
          </div>
          <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>Amount Received</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(payment.amount, currency)}</span>
            </div>
            {currency === 'INR' && (
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
                In words: {numberToWords(Number(payment.amount) || 0)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#334155', marginBottom: '1rem' }}>
            <span>Invoice Total: <strong>{formatCurrency(Number(bill.totalAmount) || 0, currency)}</strong></span>
            <span>Total Paid: <strong>{formatCurrency(Number(bill.paidAmount) || 0, currency)}</strong></span>
            {/* v1.10.22 — surface overpayments explicitly. Was previously
                clamped to zero via Math.max, silently swallowing the
                "customer paid extra by ₹X" case. */}
            <span>
              {remaining < -0.005
                ? <>Overpaid: <strong style={{ color: '#059669' }}>{formatCurrency(Math.abs(remaining), currency)}</strong></>
                : <>Balance: <strong style={{ color: remaining > 0.005 ? '#dc2626' : '#059669' }}>{formatCurrency(Math.max(0, remaining), currency)}</strong></>}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', fontSize: '0.75rem', color: '#475569' }}>
            <div><div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, minWidth: 140, textAlign: 'center' }}>Customer Signature</div></div>
            <div><div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, minWidth: 140, textAlign: 'center' }}>For {businessName}</div></div>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.75rem' }}>
            This is a computer-generated receipt. Recorded on {new Date(payment.recordedAt || Date.now()).toLocaleString('en-IN')}.
          </div>
        </div>
        <div className="fgsb-receipt-noprint" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={doPrint}><Printer size={16} /> Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

// v1.10.83 - a payment on an invoice in a foreign currency: the rupees that
// reached the bank, its charges and the FIRC / e-BRC number, when filled in.
const foreignReceiptFields = (input) => {
  const inr = Number(input?.inrReceived), charges = Number(input?.bankCharges);
  const firc = String(input?.fircRef || '').trim();
  return {
    ...(inr > 0 ? { inrReceived: Math.round(inr * 100) / 100 } : {}),
    ...(charges > 0 ? { bankCharges: Math.round(charges * 100) / 100 } : {}),
    ...(firc ? { fircRef: firc.slice(0, 60) } : {}),
  };
};

export default function Dashboard({ onNew, onEdit, onPrint, onDuplicate, onConvert, onOpenProducts, onOpenSettings, onOpenGuide, onOpenSupport, activeProfile }) {
  // v1.10.64 — requested (#55, @sangwanmail-eng): "An invoice belonging to one
  // company should not appear under the other."
  //
  // Bills and the active business load independently, so filtering at load
  // time would race — whichever arrived second would be ignored. Instead the
  // raw list is held and the visible list derived, which stays correct when
  // either changes, including when the user switches business from the
  // header without a reload.
  //
  // Anything that cannot be attributed to a business is SHOWN, never hidden.
  // See belongsToProfile() in utils.js for why that matters here.
  const [allBills, setBills] = useState([]);
  const [profileState, setProfileState] = useState(null);

  // v1.10.65 — requested (#58 item 1, @sangwanmail-eng): "Dashboard should
  // refresh automatically after company switch."
  //
  // It did not, because the dashboard fetched the business ONCE when it
  // mounted. Switching business from the header updated the app, but this
  // screen never heard about it and kept showing the previous company's
  // invoices until a manual reload.
  //
  // The live value is now passed in as a prop, so a switch re-filters
  // immediately. The locally fetched copy stays as a fallback for the first
  // paint, before the prop has arrived.
  const profile = activeProfile ?? profileState;

  const bills = useMemo(
    () => allBills.filter(b => belongsToProfile(b, profile)),
    [allBills, profile],
  );
  const [filtered, setFiltered] = useState([]);
  // v1.10.66 (#64 item 3) — the headline cards are computed from `bills`, the
  // list already narrowed to the active business. They used to be summed in
  // loadBills() from the raw server response, so Total Invoiced, Tax Collected,
  // Outstanding and the invoice count added up EVERY company's invoices while
  // the table underneath showed only one.
  const baseCur = baseCurrencyOf(profile);
  const stats = useMemo(() => {
    // v1.10.67 (#66 item 7, @sangwanmail-eng) — these cards are turnover, so
    // only real sales count. A proforma is a quote, a delivery challan moves
    // goods without selling them, a credit note takes money back, and a
    // cancelled document counts for nothing.
    const byCurrency = {};
    let count = 0;
    for (const b of bills) {
      const sign = salesSign(b);
      if (sign === 0) continue;
      count += 1;
      const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
      if (!byCurrency[cur]) byCurrency[cur] = { total: 0, tax: 0, unpaid: 0 };
      byCurrency[cur].total += sign * (b.totalAmount || 0);
      byCurrency[cur].tax += sign * (b.totalTaxAmount || 0);
      if (sign > 0 && b.status !== 'paid') byCurrency[cur].unpaid += Math.max(0, amountDue(b) - (b.paidAmount || 0));
    }
    // v1.10.83 - more than one currency: the total in rupees too, each
    // invoice at its own exchange rate (one without a rate is counted apart).
    let inBase = 0, noRate = 0;
    if (Object.keys(byCurrency).length > 1) {
      for (const b of bills) {
        const sign = salesSign(b);
        if (sign === 0) continue;
        const c = billInInr(b, baseCur);
        if (c) inBase += sign * (c.totalAmount || 0); else noRate += 1;
      }
    }
    return { byCurrency, count, inBase, noRate };
  }, [bills, baseCur]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // v1.10.83 (#112) - '' = all; see utils/costCentres.js.
  const [centreFilter, setCentreFilter] = useState('');
  const { on: ccOn, centres } = useCostCentres(profile);
  // v1.10.84 (maintainer, 7 Nov) - folder tabs on top of the list: Invoices
  // (active), Cancelled, Trash (deleted, 30 days; InvoiceTrash).
  const [folder, setFolder] = useState('invoices');
  const [allTrash, setAllTrash] = useState([]);
  const trash = useMemo(() => allTrash.filter((b) => belongsToProfile(b, profile)), [allTrash, profile]);
  const cancelledCount = useMemo(() => bills.filter((b) => isCancelledBill(b)).length, [bills]);
  // Bulk-selection state. Stores a Set of bill IDs (not the bills themselves)
  // so we don't hold stale references when the underlying bill is edited
  // elsewhere. Cleared whenever filters change so the user doesn't accidentally
  // bulk-act on bills they can no longer see.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // v1.10.74 - the comment above was never wired up, so bulk actions could hit
  // ticked rows hidden by a filter. Reset during render (React's "adjust state
  // on prop change" pattern) when any filter changes.
  const filterKey = [search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo, centreFilter, folder].join('|');
  const [selectionFilterKey, setSelectionFilterKey] = useState(filterKey);
  if (selectionFilterKey !== filterKey) {
    setSelectionFilterKey(filterKey);
    if (selectedIds.size) setSelectedIds(new Set());
  }
  // v1.9.4 — column picker. Persist to localStorage. Default set matches
  // the pre-v1.9.4 hardcoded columns so no visual change on upgrade.
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gst_dashboardColumns') || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch { /* ignore */ }
    return {
      date: true, invoice: true, type: true, client: true, amount: true,
      status: true, actions: true, printed: false, currency: false, dueDate: false,
    };
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('gst_dashboardColumns', JSON.stringify(visibleColumns)); } catch { /* ignore */ }
  }, [visibleColumns]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  // v1.10.80 (#100) - the invoice shown read-only by the View button.
  const [viewBill, setViewBill] = useState(null);
  // v1.10.83 (#111) - e-invoicing: problems after an export, results after an IRN import.
  const einvoiceOn = isModuleEnabled('einvoice', getEnabledModules());
  const [einvReport, setEinvReport] = useState(null);
  const irnFileRef = useRef(null);
  // v1.10.9 — receipt modal state. Opens automatically after
  // recordPayment succeeds; can also be opened via openReceiptFor(...)
  // for reprints.
  const [receiptTarget, setReceiptTarget] = useState(null); // { bill, payment, remaining }

  // v1.10.13 — full-edit payment modal. { bill, idx, form: { amount, date, mode, note } }
  const [editPaymentModal, setEditPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', date: '', mode: 'bank-transfer', note: '' });
  const [showRemindAll, setShowRemindAll] = useState(false);
  const [clients, setClients] = useState([]);
  const [productCount, setProductCount] = useState(null);   // null = not loaded yet
  const [guideDismissed, setGuideDismissed] = useState(() => {
    try { return localStorage.getItem('freegstbill_startedDismissed') === '1'; } catch { return false; }
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // v1.10.4 — audit M14. getFYOptions is date-based (only changes across
  // April-1 boundary); memoize with an empty dep so we run it once per
  // component mount, not on every render.
  const fyOptions = useMemo(() => getFYOptions(), []);

  const loadBills = async () => {
    // The Trash tab's list (and count), refreshed with the invoices.
    getTrashedBills().then((t) => setAllTrash(Array.isArray(t) ? t : [])).catch(() => setAllTrash([]));
    try {
      const data = await getAllBills();
      // Local date (toISOString() is UTC: still yesterday in India until 05:30).
      const today = localToday();

      // v1.10.41 — Orphaned-payment reconciliation. Reported: user
      // recorded a payment in an older version — the receipt file
      // exists on disk (Receipts page shows it) but the bill's
      // paidAmount stayed at 0 and Dashboard showed the invoice as
      // Overdue with PAID = "—". Root cause was cross-file data
      // drift: receipts persist in data/receipts/*.json with a
      // billId reference; bills persist in data/bills/*.json with
      // their own payments[] array. If a save regression or stale
      // editingBill overwrite ever emptied the bill's payments,
      // the receipt survived but the linkage was lost.
      //
      // Reconciliation: for every receipt with a bill reference,
      // check if the bill's payments array contains a matching
      // entry (by receiptNo or by amount+date+mode). If not, merge
      // it back and re-save the bill. Runs once per Dashboard mount,
      // catches this whole class of orphaned-payment bugs
      // retroactively, and silently no-ops in the healthy case.
      let reconciled = 0;
      try {
        const receipts = await getAllReceipts().catch(() => []);
        const receiptsByBillKey = new Map();
        for (const r of receipts) {
          const key = r.billId || r.againstInvoice;
          if (!key) continue;
          if (!receiptsByBillKey.has(key)) receiptsByBillKey.set(key, []);
          receiptsByBillKey.get(key).push(r);
        }
        const reconcileWrites = [];
        for (const bill of data) {
          // v1.10.66 (#64) — only a receipt from the business that raised the
          // invoice may repair it. Two businesses can share an invoice number,
          // and matching on the number alone posted one company's payment onto
          // the other company's invoice every time the Dashboard opened.
          // Receipts saved before businesses were separated carry no business
          // and still match, as before.
          const rcpts = (receiptsByBillKey.get(bill.id) || receiptsByBillKey.get(bill.invoiceNumber) || [])
            .filter(r => belongsToProfile(bill, { gstin: r.ownerGstin, businessName: r.ownerName }));
          if (!rcpts.length) continue;
          const currentPayments = Array.isArray(bill.payments) ? bill.payments : [];
          const missing = rcpts.filter(r => {
            // Match by receiptNo (post-v1.10.10 payments store the receipt no),
            // OR by amount+date signature for pre-v1.10.10 payments.
            return !currentPayments.some(p =>
              // Receipts made from a payment carry the payment's id.
              (r.id && p.id === r.id)
              || (r.receiptNo && p.receiptNo === r.receiptNo)
              || (Math.abs((Number(p.amount) || 0) - (Number(r.amount) || 0)) < 0.005
                  && p.date === r.date
                  && (p.mode || '').toLowerCase() === (r.paymentMode || '').toLowerCase().replace(' ', '-'))
            );
          });
          if (!missing.length) continue;
          const modeMap = { 'Bank Transfer': 'bank-transfer', 'UPI': 'upi', 'Cash': 'cash', 'Cheque': 'cheque', 'Card': 'card', 'Other': 'other' };
          const merged = [...currentPayments, ...missing.map(r => ({
            id: r.id || ('pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            amount: Number(r.amount) || 0,
            date: r.date,
            mode: modeMap[r.paymentMode] || (r.paymentMode || 'other').toLowerCase().replace(' ', '-'),
            note: r.note || (r.receiptNo ? `Reconciled from receipt ${r.receiptNo}` : 'Reconciled from orphaned receipt'),
            recordedAt: r.recordedAt || new Date().toISOString(),
            receiptNo: r.receiptNo,
          }))];
          const totalPaid = merged.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          // A cancelled invoice stays cancelled: restoring a payment must not
          // bring it back into totals and GST returns without its stock.
          const nextStatus = isCancelledBill(bill) ? 'cancelled' : paymentStatusFor(bill, totalPaid);
          // Mutate the in-memory bill so setBills(data) below shows the
          // reconciled value immediately; also queue the server write.
          bill.payments = merged;
          bill.paidAmount = totalPaid;
          bill.status = nextStatus;
          reconciled += missing.length;
          reconcileWrites.push(saveBill(bill, { overwrite: true }).catch(() => null));
        }
        if (reconcileWrites.length) await Promise.allSettled(reconcileWrites);
      } catch { /* non-fatal — worst case, user still sees orphaned state */ }
      if (reconciled > 0) {
        toast(`Reconciled ${reconciled} orphaned payment${reconciled === 1 ? '' : 's'} against ${reconciled === 1 ? 'its' : 'their'} invoice${reconciled === 1 ? '' : 's'}`, 'success', 6000);
      }

      // Auto-detect overdue: if due date passed and not paid, mark as overdue.
      // Previously this did sequential `await saveBill(bill)` inside a for-loop,
      // which (a) made N round-trips serialised and (b) silently stopped on the
      // first failure. Now we collect dirty bills and save them concurrently via
      // allSettled so one slow save can't block the rest.
      const dirty = data.filter(bill => {
        const dueDate = bill.data?.details?.dueDate;
        // Only sales can be overdue: a quotation, proforma, challan or credit
        // note is not money the client owes.
        return dueDate && dueDate < today && bill.status !== 'paid' && bill.status !== 'overdue' && bill.status !== 'cancelled'
          && SALES_INVOICE_TYPES.includes(bill.invoiceType || 'tax-invoice');
      });
      if (dirty.length > 0) {
        const updates = dirty.map(bill => { bill.status = 'overdue'; return saveBill(bill, { overwrite: true }); });
        await Promise.allSettled(updates);
      }

      // Headline totals are derived from the business-filtered list (`stats`).
      setBills(data);
    } catch {
      toast('Failed to load invoices', 'error');
    }
  };

  useEffect(() => {
    loadBills();
    getProfile().then(p => setProfileState(p)).catch(() => {});
    getAllClients().then(c => setClients(c)).catch(() => {});
    // Pull the stock-alert config alongside products so the Dashboard's
    // low-stock card honours the user's threshold + on/off preference.
    Promise.all([
      getAllProducts().catch(() => []),
      getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
    ]).then(([prods, cfg]) => {
      setProductCount(prods.length);
      if (cfg?.enabled === false) { setLowStockProducts([]); return; }
      const threshold = Number(cfg?.threshold ?? 5);
      setLowStockProducts(findLowStock(prods, threshold)); // services and uncounted left out (#121)
    });
  }, []);

  useEffect(() => {
    let result = bills;
    if (search.trim()) result = result.filter((b) => billMatchesSearch(b, search));
    if (typeFilter !== 'all') result = result.filter(b => (b.invoiceType || 'tax-invoice') === typeFilter);
    if (statusFilter !== 'all') result = result.filter(b => (b.status || 'unpaid') === statusFilter);
    // The folder tabs: Invoices = not cancelled, Cancelled = only cancelled.
    if (folder === 'invoices') result = result.filter((b) => !isCancelledBill(b));
    else if (folder === 'cancelled') result = result.filter((b) => isCancelledBill(b));
    if (fyFilter !== 'all') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy) result = result.filter(b => b.invoiceDate >= fy.from && b.invoiceDate <= fy.to);
    }
    if (dateFrom) result = result.filter(b => b.invoiceDate >= dateFrom);
    if (dateTo) result = result.filter(b => b.invoiceDate <= dateTo);
    if (centreFilter) result = result.filter(b => matchesCentre(b, centreFilter));
    setFiltered(result);
  }, [bills, search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo, centreFilter, folder]);

  // v1.10.67 (#66 item 12, @sangwanmail-eng) — an issued invoice is not
  // deleted: its number has to stay in the books, gapless, for GST. Cancelling
  // keeps the document and takes it out of every total and return. Any other
  // status from the dropdown brings it back.
  // Put an invoice's stock back (+1, on cancel) or take it out again (-1, on
  // un-cancel). One place for the single-row and bulk paths: bulk cancel used
  // to skip this, so stock went missing for invoices cancelled in bulk.
  // v1.10.76 (#80) - moves stock from what each bill has done to what it
  // should do in its new status (stockEffect), and returns the bills with
  // their new stock record, ready to save. Cancelling a quotation used to put
  // back stock it never took; now it moves nothing.
  // Plans it from each bill AS SAVED (its current status), so an old bill
  // cancelled before v1.10.76 is known to have had its stock put back. The bill
  // is saved first and the stock moved only for bills whose save succeeded,
  // so a failed save never leaves stock moved with the old record.
  const planStock = (b, newStatus) => {
    if (!b.data) return { bill: b, changes: {} };
    const next = stockEffect(b.data.items, b.invoiceType || b.data.invoiceType, newStatus);
    return { bill: { ...b, data: { ...b.data, stockApplied: next } }, changes: stockDelta(appliedStock(b), next) };
  };
  const moveStock = (plans) => {
    const total = {};
    for (const p of plans) for (const [id, d] of Object.entries(p.changes)) total[id] = (total[id] || 0) + d;
    return applyStockChanges(total);
  };
  // Saves each planned bill with its new status; moves the stock of those that saved.
  const saveWithStock = async (plans, patchFor) => {
    const results = await Promise.allSettled(plans.map((p) => saveBill(patchFor(p.bill), { overwrite: true })));
    await moveStock(plans.filter((_, i) => results[i].status === 'fulfilled'));
    return results;
  };

  // v1.10.79 (#94) - the PDF in Saved Invoices follows: stamped CANCELLED, or
  // back to the original on Undo. A save problem here never undoes the cancel.
  const syncSavedPdfs = async (bills, cancelled) => {
    const results = await Promise.allSettled(bills.map((b) => markSavedPdfCancelled(b, cancelled)));
    const failed = results.filter((r) => r.status === 'rejected' || r.value?.failed > 0).length;
    if (failed) toast(`${failed === 1 ? 'A saved PDF' : `${failed} saved PDFs`} could not be ${cancelled ? 'marked CANCELLED' : 'put back'}. Close the PDF if it is open, then ${cancelled ? 'cancel' : 'undo'} again.`, 'warning', 8000);
  };

  const handleCancelInvoice = async (bill) => {
    if (isCancelledBill(bill)) return;
    const ok = await confirmAction({
      title: 'Cancel this invoice?',
      message: `Invoice ${bill.invoiceNumber} for ${bill.clientName} keeps its number but stops counting in totals, reports and GST returns. Stock is restored for any products on it. To undo it, click the Undo cancel arrow among the row's actions.`,
      confirmLabel: 'Cancel invoice',
      tone: 'danger',
    });
    if (ok) {
      try {
        const [res] = await saveWithStock([planStock(bill, 'cancelled')], (b) => ({ ...b, status: 'cancelled', cancelledAt: new Date().toISOString() }));
        if (res.status === 'rejected') throw res.reason;
        syncSavedPdfs([bill], true);
        toast('Invoice cancelled & stock restored', 'success');
        loadBills();
      } catch { toast('Failed to cancel', 'error'); }
    }
  };

  // v1.10.84 (maintainer, 7 Nov) - Delete on the Invoices list too: to Trash
  // for 30 days, with its stock put back (trashBill, as on the Clients page).
  const handleDeleteInvoice = async (bill) => {
    if (!(await confirmAction({
      title: 'Delete this invoice?',
      message: `Invoice ${bill.invoiceNumber} for ${bill.clientName} goes to the Trash tab (above the invoice list) for 30 days; restore it from there. Its stock goes back. To keep its number in your records instead, use Cancel invoice.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    }))) return;
    try {
      const { stockWarning } = await trashBill(bill);
      if (stockWarning) toast('Invoice moved to Trash, but its stock could not be put back. Check Products.', 'warning');
      else toast('Invoice moved to Trash (30 days)', 'success');
      loadBills();
    } catch { toast('Failed to delete', 'error'); }
  };

  // The Trash tab: put an invoice back (stock taken out again), or delete it now.
  const [trashBusy, setTrashBusy] = useState(false);
  const restoreFromTrash = async (bill) => {
    setTrashBusy(true);
    try { await restoreBillFromTrash(bill); toast(`${bill.invoiceNumber || 'Invoice'} restored to your invoices`, 'success'); }
    catch (err) { toast('Restore failed: ' + err.message, 'error'); }
    setTrashBusy(false);
    loadBills();
  };
  const purgeFromTrash = async (bill) => {
    if (!await confirmAction({
      title: 'Delete this invoice for good?',
      message: `${bill.invoiceNumber || 'This invoice'} is removed now instead of after the 30 days. It cannot be brought back.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
    })) return;
    setTrashBusy(true);
    try { await purgeTrashedBill(bill.id); toast('Invoice deleted for good', 'success'); }
    catch (err) { toast('Could not delete it: ' + err.message, 'error'); }
    setTrashBusy(false);
    loadBills();
  };

  const handleView = (bill) => {
    if (bill.data) onEdit(bill);
    else toast('No editable data saved for this invoice', 'warning');
  };

  const changeStatus = async (bill, newStatus) => {
    // v1.10.67 (#66 item 12) / v1.10.76 - moving into or out of Cancelled moves
    // the stock (into it from the dropdown too, which used to skip that).
    const plan = isCancelledBill(bill) !== (newStatus === 'cancelled') ? planStock(bill, newStatus) : { bill, changes: {} };
    const updated = { ...plan.bill, status: newStatus };
    if (newStatus === 'cancelled') updated.cancelledAt = new Date().toISOString();
    else delete updated.cancelledAt;
    if (newStatus === 'paid') {
      // Also records a payment for the balance, so payment history and
      // reports agree with the status (see markPaidPatch).
      Object.assign(updated, markPaidPatch(bill));
    }
    if (newStatus === 'unpaid') Object.assign(updated, markUnpaidPatch(bill));
    await saveBill(updated, { overwrite: true });
    // A payment taken back also leaves the Receipts page.
    for (const p of (bill.payments || []).filter((x) => !(updated.payments || []).includes(x))) {
      if (p.id) deleteReceipt(p.id).catch(() => {});
    }
    try { await moveStock([plan]); } catch { /* the status change is saved */ }
    if (isCancelledBill(bill) !== (updated.status === 'cancelled')) syncSavedPdfs([bill], updated.status === 'cancelled');
    toast(updated.status === newStatus
      ? `Marked as ${STATUS_CONFIG[newStatus].label}`
      : `Payments recorded with a receipt remain, so it is ${STATUS_CONFIG[updated.status]?.label || updated.status}`, 'info');
    loadBills();
  };

  // v1.10.77 (#86) - Undo on a cancelled document: back to the status its
  // payments say (it used to come back as Unpaid even when it had been paid).
  // v1.10.78 (#92) - asks first: it puts the document back into totals, GST
  // returns and stock.
  const undoCancel = async (bill) => {
    const type = bill.invoiceType || 'tax-invoice';
    const what = SALES_INVOICE_TYPES.includes(type) ? 'comes back into your totals and GST returns, and any stock it uses is taken out again.'
      : type === 'credit-note' ? 'comes back into your GST returns, and the stock it returned is added back.'
        : type === 'delivery-challan' ? 'comes back, and the stock it sends out is taken out again.'
          : 'comes back as an open document.';
    const ok = await confirmAction({
      title: 'Undo the cancel?',
      message: `${bill.invoiceNumber} ${what}`,
      confirmLabel: 'Yes, undo',
      cancelLabel: 'No',
    });
    if (!ok) return undefined;
    const paid = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const next = !SALES_INVOICE_TYPES.includes(bill.invoiceType || 'tax-invoice') ? 'unpaid' : paymentStatusFor(bill, paid);
    return changeStatus(bill, next);
  };

  const openPaymentModal = (bill) => {
    setPaymentModal(bill);
    setPaymentInput({ amount: '', date: localToday(), mode: 'bank-transfer', note: '', tdsOn: false, tdsSection: '194J', tdsRate: 10 });
  };
  // TDS can be added while recording a payment on an Indian sales invoice that
  // does not already show TDS (one that does is owed its Net Receivable).
  const tdsEntryAllowed = (bill) => !!bill && SALES_INVOICE_TYPES.includes(bill.invoiceType || 'tax-invoice')
    && (bill.data?.profile?.country || 'India') === 'India' && !(Number(bill.data?.totals?.tdsAmount) > 0)
    // v1.10.83 - a client abroad does not deduct Indian TDS.
    && ['', 'India'].includes(String(bill.data?.client?.country || '').trim());

  const recordPayment = async () => {
    // v1.10.74 - a payment used to flip a cancelled invoice to paid/partial
    // without taking its stock back out. Block it; un-cancel from the status
    // dropdown first (that path fixes stock).
    if (isCancelledBill(paymentModal)) {
      toast('This invoice is cancelled. Change its status back before recording a payment.', 'warning'); return;
    }
    const amount = parseFloat(paymentInput.amount);
    const hasAmount = isFinite(amount) && amount > 0;
    // v1.10.83 - the client paid less because they deducted TDS the invoice
    // did not show: the TDS goes on the invoice, so it is owed only the Net
    // Receivable. A TDS-only entry (no amount) is allowed.
    const tdsNow = tdsEntryAllowed(paymentModal) && !!paymentInput.tdsOn;
    if (!hasAmount && !(tdsNow && !String(paymentInput.amount || '').trim())) {
      toast('Enter a positive payment amount', 'warning'); return;
    }
    const bill = tdsNow ? withClientTds(paymentModal, { section: paymentInput.tdsSection, rate: paymentInput.tdsRate }) : paymentModal;
    if (tdsNow && !(bill.data.totals.tdsAmount > 0)) {
      toast('Enter the TDS rate the client deducted', 'warning'); return;
    }
    const alreadyPaid = Number(bill.paidAmount) || 0;
    if (!hasAmount) {
      await saveBill({ ...bill, status: paymentStatusFor(bill, alreadyPaid) }, { overwrite: true });
      toast(`TDS of ${formatCurrency(bill.data.totals.tdsAmount, bill.currency)} recorded on ${bill.invoiceNumber}`, 'success');
      setPaymentModal(null);
      loadBills();
      return;
    }
    // What is left to receive: the total less TDS the client deducts.
    const outstanding = Math.max(0, amountDue(bill) - alreadyPaid);
    if (amount > outstanding + 0.01) {
      const proceed = await confirmAction({
        title: 'Record as overpayment?',
        message: `This payment (${formatCurrency(amount, bill.currency)}) is more than the outstanding balance (${formatCurrency(outstanding, bill.currency)}).\n\nThe extra will be saved as client credit and can be applied to future invoices.`,
        confirmLabel: 'Yes, record overpayment',
        tone: 'warning',
      });
      if (!proceed) return;
    }
    const paymentEntry = {
      id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      amount, date: paymentInput.date, mode: paymentInput.mode,
      note: paymentInput.note, recordedAt: new Date().toISOString(),
      ...foreignReceiptFields(paymentInput),
    };
    const payments = [...(bill.payments || []), paymentEntry];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const updatedBill = {
      ...bill, payments, paidAmount: totalPaid,
      status: paymentStatusFor(bill, totalPaid),
    };
    await saveBill(updatedBill, { overwrite: true });
    // v1.10.10 — Also persist a Receipt record so this payment shows up
    // in the Receipts view. Prior code only appended to bill.payments —
    // the standalone Receipts page saw "No receipts generated yet"
    // even after multiple payments were recorded, which was the user's
    // exact complaint. `saveReceipt` writes to data/receipts/*.json.
    try {
      await saveReceipt({
        id: paymentEntry.id,
        date: paymentEntry.date,
        receiptNo: `RCPT-${paymentEntry.id.replace('pay_', '').toUpperCase().slice(0, 10)}`,
        clientName: bill.data?.client?.name || bill.clientName || '',
        clientAddress: bill.data?.client?.address || '',
        amount: paymentEntry.amount,
        paymentMode: paymentEntry.mode,
        referenceNo: paymentEntry.note || '',
        againstInvoice: bill.invoiceNumber || bill.id || '',
        note: paymentEntry.note || '',
        currency: bill.currency || bill.data?.invoiceOptions?.currency || 'INR',
        ...foreignReceiptFields(paymentInput),
        source: 'auto-from-payment',
        billId: bill.id,
        // The business that raised the invoice: without it the receipt was
        // listed under every business on the Receipts page.
        ownerGstin: bill.data?.profile?.gstin || bill.ownerGstin || '',
        ownerName: bill.data?.profile?.businessName || bill.ownerName || '',
      });
    } catch { /* non-fatal — receipt is still viewable from the invoice's Payment History */ }
    toast(`Payment of ${formatCurrency(amount, bill.currency)} recorded`, 'success');
    setPaymentModal(null);
    // v1.10.22 — reported: "Balance should be 1 but calculating zero" —
    // ₹649 invoice + ₹650 paid was hiding the ₹1 overpayment because the
    // remaining calc used Math.max(0, …). Now: send the signed value so
    // the receipt can show "Overpaid ₹1" instead of silently rounding away.
    setReceiptTarget({ bill: updatedBill, payment: paymentEntry, remaining: amountDue(bill) - totalPaid });
    loadBills();
  };

  // v1.10.9 — Reprint / view an existing payment's receipt.
  const openReceiptFor = (bill, payment) => {
    const totalPaid = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    // v1.10.22 — signed remaining; see setReceiptTarget above for context.
    setReceiptTarget({ bill, payment, remaining: amountDue(bill) - totalPaid });
  };

  // v1.10.10 — Delete/Edit a specific payment BY INDEX.
  // Prior code used `p.id === paymentId`, but legacy payments (recorded
  // before v1.10.9 which added `pay_<base36>` ids) don't have ids —
  // `(p.id || '') === undefined` matched EVERY legacy row, so editing
  // one silently edited none (or all). Now the caller passes the row
  // index directly. Modern rows still have ids for the receipt modal
  // to reference, but mutation is index-based.
  const deletePaymentAt = async (bill, idx) => {
    if (!await confirmAction({
      title: 'Delete this payment?',
      message: 'The invoice will revert to unpaid/partial if the sum drops below the total.',
      confirmLabel: 'Delete payment',
      tone: 'danger',
    })) return;
    const target = (bill.payments || [])[idx];
    const payments = (bill.payments || []).filter((_, i) => i !== idx);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const updated = { ...bill, payments, paidAmount: totalPaid, status: paymentStatusFor(bill, totalPaid) };
    await saveBill(updated, { overwrite: true });
    // v1.10.10 — Also remove the linked Receipt record so the Receipts
    // page stays in sync. Silently skips if this was a legacy payment
    // that never had a receipt written (pre-v1.10.10 recordings).
    if (target?.id) {
      try { await deleteReceipt(target.id); } catch { /* ignore */ }
    }
    toast('Payment deleted', 'success');
    setPaymentModal(updated);
    loadBills();
  };

  // v1.10.13 — reported: "receipt edit option edit only enables to add
  // notes to that should give option to edit the amount too because by
  // mistake if wrong amount entered, customer without delete can edit
  // directly". Now opens a proper edit modal (see editPaymentModal
  // state + JSX below) that lets the user change amount, date, mode,
  // and note together — with the same "cannot exceed outstanding"
  // guard that recordPayment already enforces.
  const editPaymentAt = (bill, idx) => {
    const target = (bill.payments || [])[idx];
    if (!target) return;
    setEditPaymentModal({
      bill, idx,
      form: {
        amount: String(target.amount || ''),
        date: target.date || localToday(),
        mode: target.mode || 'bank-transfer',
        note: target.note || '',
      },
    });
  };

  const saveEditedPayment = async () => {
    if (!editPaymentModal) return;
    const { bill, idx, form } = editPaymentModal;
    const newAmount = parseFloat(form.amount);
    if (!isFinite(newAmount) || newAmount <= 0) {
      toast('Enter a positive amount', 'warning'); return;
    }
    // Check the new total doesn't exceed the invoice unless user confirms.
    const others = (bill.payments || []).filter((_, i) => i !== idx);
    const othersSum = others.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const newTotal = othersSum + newAmount;
    const billTotal = Number(bill.totalAmount) || 0;
    if (newTotal > billTotal + 0.01) {
      const ok = await confirmAction({
        title: 'Save as overpayment?',
        message: `This edit brings the total received (${formatCurrency(newTotal, bill.currency)}) above the invoice total (${formatCurrency(billTotal, bill.currency)}).`,
        confirmLabel: 'Save overpayment',
        tone: 'warning',
      });
      if (!ok) return;
    }
    const target = (bill.payments || [])[idx];
    const withId = target.id || ('pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const payments = (bill.payments || []).map((p, i) => i === idx
      // Edited by you, so no longer the automatic "Marked paid" payment (auto is dropped).
      ? { ...p, id: withId, amount: newAmount, date: form.date, mode: form.mode, note: form.note, auto: false }
      : p);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const status = paymentStatusFor(bill, totalPaid);
    const updated = { ...bill, payments, paidAmount: totalPaid, status };
    await saveBill(updated, { overwrite: true });
    // Also update the linked Receipt record so the Receipts page reflects the edit.
    try {
      await saveReceipt({
        id: withId,
        date: form.date,
        // A receipt made on the Receipts page keeps its own number (RCP/...).
        receiptNo: target.receiptNo || `RCPT-${withId.replace('pay_', '').toUpperCase().slice(0, 10)}`,
        clientName: bill.data?.client?.name || bill.clientName || '',
        clientAddress: bill.data?.client?.address || '',
        amount: newAmount,
        paymentMode: form.mode,
        referenceNo: form.note || '',
        againstInvoice: bill.invoiceNumber || bill.id || '',
        note: form.note || '',
        currency: bill.currency || bill.data?.invoiceOptions?.currency || 'INR',
        source: 'auto-from-payment',
        billId: bill.id,
        // The business that raised the invoice: without it the receipt was
        // listed under every business on the Receipts page.
        ownerGstin: bill.data?.profile?.gstin || bill.ownerGstin || '',
        ownerName: bill.data?.profile?.businessName || bill.ownerName || '',
      });
    } catch { /* non-fatal */ }
    toast('Payment updated', 'success');
    setPaymentModal(updated);
    setEditPaymentModal(null);
    loadBills();
  };

  // ---- Bulk operations ----
  // All bulk handlers fan out concurrently via Promise.allSettled so one
  // failure can't strand the rest. After every bulk action we refresh the
  // bills list and clear the selection.
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAllVisible = () => setSelectedIds(prev => {
    const allVisible = filtered.every(b => prev.has(b.id));
    if (allVisible) {
      // Deselect only the visible ones, leave any off-screen selections alone
      const next = new Set(prev);
      filtered.forEach(b => next.delete(b.id));
      return next;
    }
    const next = new Set(prev);
    filtered.forEach(b => next.add(b.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const getSelectedBills = () => bills.filter(b => selectedIds.has(b.id));

  const bulkMarkStatus = async (newStatus) => {
    // v1.10.76 (#83) - payment statuses only apply to real sales; a ticked
    // quotation or challan is left alone unless it is being un-cancelled.
    const sel = getSelectedBills().filter((b) => isCancelledBill(b) || SALES_INVOICE_TYPES.includes(b.invoiceType || 'tax-invoice'));
    if (sel.length === 0) { toast('Payment status only applies to tax invoices and bills of supply', 'info'); return; }
    if (!await confirmAction({
      title: `Mark ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as ${STATUS_CONFIG[newStatus]?.label || newStatus}?`,
      message: newStatus === 'paid'
        ? 'A payment for the balance is recorded on each, so payment history and reports stay right.'
        : 'The status change is reversible — you can flip it back any time.',
      confirmLabel: `Mark as ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
    })) return;
    setBulkBusy(true);
    try {
      // Bulk mark-paid must push synthetic payments per bill so payment
       // history and cashflow stay consistent — see changeStatus above for
       // the same fix on the single-row path (P1 #18).
      // Invoices being brought back from Cancelled take their stock out
      // again, as on the single-row dropdown.
      const plans = sel.map((b) => (isCancelledBill(b) ? planStock(b, newStatus) : { bill: b, changes: {} }));
      const results = await saveWithStock(plans, (b) => {
        const patch = { ...b, status: newStatus };
        delete patch.cancelledAt;
        if (newStatus === 'paid') Object.assign(patch, markPaidPatch(b, 'Marked paid (bulk)'));
        if (newStatus === 'unpaid') Object.assign(patch, markUnpaidPatch(b));
        return patch;
      });
      const failed = results.filter(r => r.status === 'rejected').length;
      const done = sel.filter((_, i) => results[i]?.status !== 'rejected');
      syncSavedPdfs(done.filter((b) => isCancelledBill(b)), false);
      if (newStatus === 'unpaid') {
        for (const b of done) {
          const kept = markUnpaidPatch(b).payments;
          for (const pay of (b.payments || []).filter((x) => !kept.includes(x))) if (pay.id) deleteReceipt(pay.id).catch(() => {});
        }
      }
      if (failed > 0) toast(`${sel.length - failed} updated, ${failed} failed`, 'warning');
      else toast(`Marked ${sel.length} as ${newStatus}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk update failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkCancel = async () => {
    const sel = getSelectedBills().filter(b => !isCancelledBill(b));
    // 7 Nov (maintainer: "cancel button not working") - with only cancelled
    // invoices ticked it did nothing, silently. Say so, and where Delete is.
    if (sel.length === 0) {
      if (selectedIds.size) toast('The ticked invoices are already cancelled. To remove them, use Delete invoices.', 'warning', 7000);
      return;
    }
    if (!await confirmAction({
      title: `Cancel ${sel.length} invoice${sel.length !== 1 ? 's' : ''}?`,
      message: 'They keep their numbers but stop counting in totals, reports and GST returns. Stock is restored for any products on them. To undo one, click the Undo cancel arrow among the actions on its row.',
      confirmLabel: `Cancel ${sel.length}`,
      tone: 'danger',
    })) return;
    setBulkBusy(true);
    try {
      const at = new Date().toISOString();
      const results = await saveWithStock(sel.map((b) => planStock(b, 'cancelled')), (b) => ({ ...b, status: 'cancelled', cancelledAt: at }));
      const failed = results.filter(r => r.status === 'rejected').length;
      syncSavedPdfs(sel.filter((_, i) => results[i]?.status !== 'rejected'), true);
      if (failed > 0) toast(`${sel.length - failed} cancelled, ${failed} failed`, 'warning');
      else toast(`Cancelled ${sel.length} invoice${sel.length !== 1 ? 's' : ''}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk cancel failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  // 7 Nov (maintainer) - Delete in the bar too: the ticked invoices (cancelled
  // ones as well) go to the Trash for 30 days, stock put back (trashBill).
  // One at a time, so two stock updates never race.
  const bulkDelete = async () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    const n = sel.length;
    if (!await confirmAction({
      title: `Delete ${n} invoice${n !== 1 ? 's' : ''}?`,
      message: 'They go to the Trash tab (above the invoice list) for 30 days; restore them from there. Their stock goes back. To keep their numbers in your records instead, use Cancel invoices.',
      confirmLabel: `Delete ${n}`,
      tone: 'danger',
    })) return;
    setBulkBusy(true);
    let done = 0, stockWarn = 0;
    for (const b of sel) {
      try { const r = await trashBill(b); done += 1; if (r.stockWarning) stockWarn += 1; } catch { /* counted below */ }
    }
    if (done < n) toast(`${done} moved to Trash, ${n - done} could not be deleted`, 'warning');
    else if (stockWarn) toast(`${done} moved to Trash, but the stock of ${stockWarn} could not be put back. Check Products.`, 'warning');
    else toast(`${done} invoice${done !== 1 ? 's' : ''} moved to Trash (30 days)`, 'success');
    clearSelection();
    loadBills();
    setBulkBusy(false);
  };

  // v1.10.83 (#112) - tag (or untag, UNTAGGED) the ticked invoices in one go,
  // so invoices made before cost centres existed can be sorted quickly.
  const bulkSetCentre = async (centreId) => {
    const sel = getSelectedBills().filter(b => b.data);
    if (!centreId || sel.length === 0) return;
    const centre = centres.find(c => c.id === centreId);
    const what = centre ? `"${centreLabel(centre)}"` : 'no cost centre';
    if (!await confirmAction({
      title: `Set ${what} on ${sel.length} invoice${sel.length !== 1 ? 's' : ''}?`,
      message: 'Only the cost centre changes. Amounts, numbers and status stay as they are.',
      confirmLabel: 'Set cost centre',
    })) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(sel.map((b) => {
        const { costCentre: _id, costCentreName: _name, ...details } = b.data.details || {};
        return saveBill({ ...b, data: { ...b.data, details: { ...details, ...centreFields(centre?.id, centre?.name) } } }, { overwrite: true });
      }));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast(`${sel.length - failed} updated, ${failed} failed`, 'warning');
      else toast(`Cost centre set on ${sel.length} invoice${sel.length !== 1 ? 's' : ''}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk update failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkExportJSON = () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    // Lightweight "give me these N bills as a portable file". Different from
    // the full Settings → Export Backup — this is a per-selection share, e.g.
    // for sending a CA only Q1 invoices. Could be re-imported via the
    // existing Import Backup modal (which only restores ticked sections).
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      __freegstbill_backup: true,
      __selection: true,
      bills: sel,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freegstbill-bills-${sel.length}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as JSON`, 'success');
  };

  // Bulk PDF export — feature C from the v1.6.7 audit ("All March invoices
   // as one zip"). Renders each selected bill through the existing
   // InvoicePreview → jsPDF pipeline (see openBillPDF in this file's edit
   // handler) and stitches them into a single multi-page PDF. Zip would be
   // cleaner but pulling in JSZip inflates the bundle by ~140KB; one big
   // PDF is what CAs want anyway (one file to archive).
  // v1.10.35 — `billsOverride` skips the selectedIds read entirely. Used
  // by the "Quick print" filter buttons (bulkPrintByFilter) which need
  // to export a computed set WITHOUT waiting for a React state commit
  // — the old code called `setSelectedIds(new Set(target))` then
  // `setTimeout(bulkExportPDF, 20)`, but the setTimeout captured the
  // stale bulkExportPDF closure whose getSelectedBills read the OLD
  // (empty) selectedIds → silent no-op. Reported: "Paid button blinks,
  // shows nothing."
  // v1.10.83 (#111) - one e-invoice JSON for the ticked invoices. Only the
  // valid ones go in the file; the rest are listed with what to fix.
  const bulkExportEInvoice = () => {
    const { docs, problems } = prepareEInvoices(getSelectedBills(), { profile, bills: allBills });
    if (docs.length) {
      downloadJson(einvoiceFileName(docs.length === 1 ? docs[0].DocDtls.No : `${docs.length}-invoices-${localToday()}`), docs);
      toast(`E-invoice JSON downloaded with ${docs.length} invoice${docs.length === 1 ? '' : 's'}. Upload it on einvoice1.gst.gov.in.`, 'success', 6000);
    }
    if (problems.length) {
      setEinvReport({
        title: docs.length ? `${problems.length} invoice${problems.length === 1 ? ' was' : 's were'} left out` : 'Nothing was exported',
        intro: 'Fix these, then export them again.',
        rows: problems,
      });
    }
  };

  // Bring the IRNs back from the portal's response file. Each one is stored on
  // the invoice with the same number, date and GSTIN; nothing else changes.
  const importIrnFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let entries;
    try { entries = parseIrpResponse(JSON.parse(await file.text())); } catch { entries = []; }
    if (!entries.length) { toast('No IRN was found in that file. Choose the JSON the e-invoice portal gave you.', 'error', 7000); return; }
    setBulkBusy(true);
    try {
      const fresh = (await getAllBills()).filter((b) => belongsToProfile(b, profile));
      const results = matchIrnEntries(entries, fresh);
      let saved = 0;
      for (const r of results) {
        if (!r.einvoice) continue;
        await saveBill({ ...r.bill, einvoice: r.einvoice }, { overwrite: true });
        saved += 1;
      }
      await loadBills();
      const skipped = results.filter((r) => !r.einvoice);
      if (saved) toast(`IRN saved on ${saved} invoice${saved === 1 ? '' : 's'}. It now prints on them.`, 'success', 6000);
      if (skipped.length) {
        setEinvReport({
          title: saved ? `IRN saved on ${saved} invoice${saved === 1 ? '' : 's'}; ${skipped.length} not saved` : 'No IRN was saved',
          rows: skipped.map((r) => ({ invoiceNumber: r.entry.docNo || `IRN ${r.entry.irn.slice(0, 12)}…`, errors: [r.reason] })),
        });
      }
    } catch (err) {
      console.error('IRN import failed', err);
      toast('Could not save the IRNs. Try again.', 'error');
    }
    setBulkBusy(false);
  };

  // v1.10.83 - mode 'separate': one PDF per invoice, all in one ZIP
  // (asked for: "download pdf in bulk one by one, not only in a merged file").
  const bulkExportPDF = async (billsOverride = null, mode = 'merged') => {
    const sel = billsOverride || getSelectedBills();
    if (sel.length === 0) return;
    if (sel.length > 100 && !await confirmAction({
      title: `Export ${sel.length} invoices?`,
      message: `This may take a minute and produce a large PDF file.`,
      confirmLabel: 'Continue',
      tone: 'warning',
    })) return;
    setBulkBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const newDoc = () => new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const doc = newDoc();
      const files = {};
      // Build each bill in a hidden container, snap it, add as a page.
      // Reuses InvoicePreview via a dynamic import so its CSS + fonts
      // are hydrated once, then reused for each iteration.
      const InvoicePreviewMod = await import('./InvoicePreview');
      const { createRoot } = await import('react-dom/client');
      const { createElement } = await import('react');
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
      document.body.appendChild(container);
      const root = createRoot(container);
      // v1.10.3 — Audit H18/H19: bulk export used to freeze the tab
      // silently (no progress UI). On a 3× DPR Android, scale went to
      // 4.5× → 16MP canvas per invoice × 50 invoices retained as JPEG
      // data URLs = OOM before doc.save() fired. Now: capped scale,
      // per-invoice progress toast, immediate abort via
      // window.__fgsbBulkAbort.
      const capScale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2)));
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch { /* non-fatal */ }
      }
      window.__fgsbBulkAbort = false;
      let ok = 0;
      for (let i = 0; i < sel.length; i++) {
        if (window.__fgsbBulkAbort) break;
        const bill = sel[i];
        const data = bill.data || {};
        // Progress every 5 invoices (or every one for very small batches).
        if (sel.length > 5 && (i % 5 === 0)) {
          toast(`Exporting ${i + 1} of ${sel.length}…`, 'info', 1500);
        }
        await new Promise((resolve) => {
          root.render(createElement(InvoicePreviewMod.default, {
            profile: data.profile, client: data.client, details: data.details, items: data.items,
            totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
            customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
            cancelled: bill.status === 'cancelled', einvoice: bill.einvoice,
          }));
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
        });
        try {
          const canvas = await html2canvas(container.firstElementChild || container, {
            scale: capScale,
            backgroundColor: '#ffffff', useCORS: false, logging: false,
          });
          const breaks = safeBreaks(container.firstElementChild || container, canvas);
          if (mode === 'separate') {
            const one = newDoc();
            addCanvasAsA4Pages(one, canvas, false, breaks);
            const base = String(bill.invoiceNumber || `invoice-${i + 1}`).replace(/[\\/:*?"<>|]+/g, '-');
            let name = `${base}.pdf`;
            for (let n = 2; files[name]; n++) name = `${base} (${n}).pdf`;
            files[name] = new Uint8Array(one.output('arraybuffer'));
          } else {
            addCanvasAsA4Pages(doc, canvas, ok > 0, breaks);
          }
          ok++;
        } catch { /* skip broken bill silently */ }
        // Yield to the event loop between invoices so the browser can
        // paint the progress toast and handle any user click on Abort.
        await new Promise(r => setTimeout(r, 0));
      }
      root.unmount();
      document.body.removeChild(container);
      if (window.__fgsbBulkAbort) { toast(`Aborted after ${ok} of ${sel.length}`, 'warning'); }
      window.__fgsbBulkAbort = false;
      if (ok === 0) { toast('Could not generate any PDFs', 'error'); return; }
      if (mode === 'separate') {
        const { zipSync } = await import('fflate');
        // PDFs are already compressed: store them as they are.
        const blob = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `invoices-${ok}-${localToday()}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        doc.save(`freegstbill-invoices-${ok}-${localToday()}.pdf`);
      }
      toast(`Exported ${ok} of ${sel.length} invoices`, 'success');
    } catch (e) {
      toast('Bulk PDF export failed — see console', 'error');
      console.error('bulkExportPDF', e);
    } finally {
      // Also after "Could not generate any PDFs", which returns early.
      setBulkBusy(false);
    }
  };

  // v1.9.1 — Quick bulk-print by filter. Reuses the existing bulkExportPDF
  // engine by temporarily overriding the selection with a computed set.
  // Selection is restored afterwards.
  const bulkPrintByFilter = async (filterKind) => {
    const targetBills = filterKind === 'all'
      ? filtered
      : filtered.filter(b => (filterKind === 'unpaid' ? (b.status || 'unpaid') === 'unpaid' : b.status === filterKind));
    if (targetBills.length === 0) {
      toast(`No ${filterKind === 'all' ? '' : filterKind + ' '}invoices to print`, 'warning');
      return;
    }
    // v1.10.35 — Pass the computed bill set directly. Prior code briefly
    // mutated selectedIds via setState then setTimeout(...bulkExportPDF)
    // which read stale state through the setTimeout closure and printed
    // nothing. Now the export runs immediately with the correct set and
    // the user's selection is left untouched.
    await bulkExportPDF(targetBills);
  };

  // v1.10.22 — Generate a single-bill PDF as a Blob. Split out of the
  // bulk-export path so the WhatsApp / native share flows can attach the
  // actual PDF via navigator.share (with a text-only URL fallback on
  // desktop / browsers that don't support file sharing yet).
  const generateSingleBillPdfBlob = async (bill) => {
    const data = bill.data || {};
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    const InvoicePreviewMod = await import('./InvoicePreview');
    const { createRoot } = await import('react-dom/client');
    const { createElement } = await import('react');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await new Promise((resolve) => {
        root.render(createElement(InvoicePreviewMod.default, {
          profile: data.profile, client: data.client, details: data.details, items: data.items,
          totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
          customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
          cancelled: bill.status === 'cancelled', einvoice: bill.einvoice,
        }));
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
      });
      const capScale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2)));
      const canvas = await html2canvas(container.firstElementChild || container, {
        scale: capScale, backgroundColor: '#ffffff', useCORS: false, logging: false,
      });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      addCanvasAsA4Pages(doc, canvas, false, safeBreaks(container.firstElementChild || container, canvas));
      return doc.output('blob');
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  };

  // v1.10.24 — Build a rich WhatsApp / Email caption that carries the full
  // payment status. Reported: "please forward with text message too with
  // status op payment." On mobile the message rides as WhatsApp caption
  // alongside the PDF; on desktop (where PDF can't attach via Web Share)
  // this text is ALL the client sees, so we want it to stand alone.
  // v1.10.84 (#156) - the one message every screen sends (utils/share.js).
  const buildShareMessage = (bill) => invoiceShareMessage(bill, profile);

  const shareWhatsApp = async (bill) => {
    const msg = buildShareMessage(bill);
    // v1.10.22 — try the native Web Share API first, with the actual PDF
    // attached. On mobile Chrome / Safari the share sheet lets the user
    // pick WhatsApp (or any other target). Falls through to the text-only
    // wa.me URL on desktop and older browsers.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        toast('Preparing PDF for share…', 'info', 1500);
        const blob = await generateSingleBillPdfBlob(bill);
        const file = new File([blob], `${bill.invoiceNumber}.pdf`, { type: 'application/pdf' });
        const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShareFile) {
          await navigator.share({
            title: `Invoice ${bill.invoiceNumber}`,
            text: msg,
            files: [file],
          });
          return;
        }
      } catch (e) {
        // AbortError = user dismissed the share sheet; not an error.
        if (e?.name !== 'AbortError') console.warn('Web Share failed, falling back to WhatsApp URL:', e);
        else return;
      }
    }
    // Fallback (desktop): WhatsApp Web cannot be handed a file by a web page
    // (a browser security rule), so the PDF is downloaded and the client's
    // chat opened with the message, ready to drag the file in.
    // v1.10.81 (#117) - the client's saved number is used (it was only the
    // number on the invoice record, which is rarely set), and the PDF is
    // downloaded for them instead of "download it yourself".
    const phone = getClientPhone(bill);
    // Opened first, while it still counts as the click: opened after the PDF
    // is made, browsers block it as a popup.
    openWhatsAppShare(phone, msg);
    let downloaded = false;
    try {
      const blob = await generateSingleBillPdfBlob(bill);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${String(bill.invoiceNumber).replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      downloaded = true;
    } catch { /* PDF failed: still open the chat with the text */ }
    toast(downloaded
      ? `PDF downloaded. Drag it into the WhatsApp chat${phone ? '' : ' (choose the contact there)'} — browsers can't attach it for you.`
      : 'WhatsApp opened with the invoice details. Download the PDF from the invoice to send the file.', 'info', 7000);
  };

  const shareEmail = (bill) => {
    // v1.10.24 — same rich payment status as the WhatsApp share (strip
    // markdown asterisks since mailto: doesn't render them).
    const subject = `Invoice ${bill.invoiceNumber} - ${formatCurrency(bill.totalAmount, bill.currency)}`;
    const richBody = buildShareMessage(bill).replace(/\*/g, '');
    const body = `Dear ${bill.clientName},\n\n${richBody}\n\nRegards`;
    // v1.10.74 - fill in the client's email (from the invoice, else the saved
    // client) so the mail opens addressed. Only a plain address is used, so a
    // stray "?" or "&" can't break the mailto link.
    const rawTo = (bill.data?.client?.email || clients.find(c => c.name === bill.clientName)?.email || '').trim();
    const to = /^[^\s@?&#]+@[^\s@?&#]+$/.test(rawTo) ? rawTo : '';
    window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setFyFilter('all'); setDateFrom(''); setDateTo(''); setCentreFilter('');
  };

  // v1.10.4 — trivial boolean, still cheap but consistent with the rest.
  const hasFilters = useMemo(
    () => Boolean(search || typeFilter !== 'all' || statusFilter !== 'all' || fyFilter !== 'all' || dateFrom || dateTo || centreFilter),
    [search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo, centreFilter]);

  const sendReminder = (bill) => {
    // Only sales are owed money: a quotation, proforma, challan or credit note
    // never gets a payment reminder.
    if (!SALES_INVOICE_TYPES.includes(bill.invoiceType || 'tax-invoice')) {
      toast('Only invoices that are owed money get a payment reminder.', 'info');
      return;
    }
    const clientPhone = bill.clientPhone || bill.data?.client?.phone || '';
    const clientName = bill.clientName || 'Sir/Madam';
    const dueDate = bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN') : 'N/A';
    const businessName = profile?.businessName || 'Our Company';
    const outstanding = amountDue(bill) - (bill.paidAmount || 0);
    // v1.10.23 — don't send a payment reminder for overpaid or already-paid
    // bills. The old message read "Hi X, kindly arrange the payment of -₹1"
    // which is obviously wrong.
    if (outstanding <= 0.005) {
      toast('This invoice has no outstanding balance — no reminder to send.', 'info');
      return;
    }
    const outstandingStr = formatCurrency(outstanding, bill.currency);
    const totalStr = formatCurrency(bill.totalAmount || 0, bill.currency);
    // v1.10.12 — Status-aware message. Prior code said "due on X" even
    // for partial invoices, which read oddly ("paid Rs. 5000 was due
    // on...") to clients. Now the wording matches the actual state.
    const isPartial = (bill.paidAmount || 0) > 0.01 && outstanding > 0.01;
    const isOverdueDate = bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
    const msg = isPartial
      ? `Hi ${clientName}, this is a gentle reminder that a balance of ${outstandingStr} is pending on Invoice ${bill.invoiceNumber} (total ${totalStr}). Kindly clear the remaining amount at your earliest convenience. Thank you! - ${businessName}`
      : isOverdueDate
        ? `Hi ${clientName}, this is a gentle reminder that Invoice ${bill.invoiceNumber} for ${outstandingStr} was due on ${dueDate}. Kindly arrange the payment at your earliest convenience. Thank you! - ${businessName}`
        : `Hi ${clientName}, this is a gentle reminder about the pending payment of ${outstandingStr} on Invoice ${bill.invoiceNumber}. Kindly arrange the payment at your earliest convenience. Thank you! - ${businessName}`;
    openWhatsAppShare(clientPhone, msg);
  };

  const getClientPhone = (bill) => {
    if (bill.clientPhone) return bill.clientPhone;
    if (bill.data?.client?.phone) return bill.data.client.phone;
    const savedClient = clients.find(c => c.name === bill.clientName);
    return savedClient?.phone || '';
  };

  // v1.10.4 — audit M14. Both were rebuilt every render even though
  // they only change when `bills` changes.
  const overdueBills = useMemo(() => bills.filter(b => b.status === 'overdue' && SALES_INVOICE_TYPES.includes(b.invoiceType || 'tax-invoice')), [bills]);
  const overdueByCurrency = useMemo(() => {
    const acc = {};
    for (const b of overdueBills) {
      const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
      acc[cur] = (acc[cur] || 0) + amountDue(b) - (b.paidAmount || 0);
    }
    return acc;
  }, [overdueBills]);
  const overdueStr = Object.entries(overdueByCurrency).map(([cur, amt]) => formatCurrency(amt, cur)).join(' + ');

  // The four things a shop owner has to do before this app is useful to them,
  // each answered from what is actually saved - never from "did you look at
  // this screen". null while the data is still loading, so the card cannot
  // flash up half-ticked; null once it is all done, so it retires itself.
  const startedSteps = useMemo(() => {
    if (guideDismissed || productCount === null || !profile) return null;
    const hasBank = !!(profile.paymentAccounts?.length || profile.upiId || profile.accountNumber);
    const steps = [
      { key: 'business', done: !!profile.businessName?.trim(),
        title: 'Add your business details', hint: 'Name, address and GSTIN - these print on every invoice',
        cta: 'Open Settings', go: onOpenSettings },
      { key: 'invoice', done: allBills.length > 0,
        title: 'Make your first invoice', hint: 'Client, what you sold, and the GST is worked out for you',
        cta: 'Start', go: onNew },
      { key: 'products', done: productCount > 0,
        title: 'Add your products or services', hint: 'Saves typing - pick them from a list on every invoice',
        cta: 'Open', go: onOpenProducts },
      { key: 'bank', done: hasBank,
        title: 'Add bank details or UPI', hint: 'So clients can pay you, with a UPI QR on the invoice',
        cta: 'Open Settings', go: onOpenSettings },
    // v1.10.83 - no products step when Products is switched off (a freelancer).
    ].filter(s => s.key !== 'products' || isModuleEnabled('inventory', getEnabledModules()));
    return steps.every(s => s.done) ? null : steps;
  }, [guideDismissed, productCount, profile, allBills.length, onNew, onOpenProducts, onOpenSettings]);

  return (
    <div className="dashboard-container">
      <PageHeader
        compact
        icon="📊"
        title={<>Dashboard <HelpButton title="Dashboard — how to use" doc="dashboard" size={16} /></>}
        subtitle="Overview of your invoices"
        meta={`${bills.length} invoice${bills.length === 1 ? '' : 's'}`}>
        <LockButton />
        <BulkCsvImport kind="sales" onDone={loadBills} />
        {einvoiceOn && (
          <>
            <input ref={irnFileRef} type="file" accept=".json,application/json" onChange={importIrnFile} style={{ display: 'none' }} />
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => irnFileRef.current?.click()}
              title="Choose the JSON file the e-invoice portal gave back, to save each IRN on its invoice">
              <Upload size={16} /> Import IRN
            </button>
          </>
        )}
        <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> New Invoice</button>
      </PageHeader>

      {/* v1.10.69 - a new user used to land here on "No invoices yet." and
          nothing else. The welcome wizard does end with a list of what to do,
          but it is shown once and then gone forever, which is no help on day
          two. This stays until the work is actually done, ticks itself off
          from real data rather than from "have you seen this screen", and
          removes itself for good once everything is set up. */}
      {onOpenSupport && <WelcomeCard invoiceCount={bills.length} onOpenSupport={onOpenSupport} />}

      {startedSteps && (
        <div className="glass-panel p-6 mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
            <span style={{ fontSize: '1.15rem' }}>👋</span>
            <h3 className="section-title" style={{ margin: 0, flex: 1 }}>Getting started <HelpButton title="Getting started" doc="dashboard#getting-started" size={16} /></h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {startedSteps.filter(s => s.done).length} of {startedSteps.length} done
            </span>
            <button type="button" className="btn-link" title="Hide this"
              onClick={() => { try { localStorage.setItem('freegstbill_startedDismissed', '1'); } catch { /* private mode */ } setGuideDismissed(true); }}
              style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1 }}>
              <X size={16} />
            </button>
          </div>
          {startedSteps.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? 'rgba(5, 150, 105, 0.16)' : 'transparent', border: s.done ? 'none' : '1.5px solid var(--border-color)' }}>
                {s.done && <CheckCircle size={15} style={{ color: '#059669' }} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: s.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</div>
                {!s.done && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.hint}</div>}
              </div>
              {!s.done && (
                <button type="button" className="btn btn-secondary" onClick={s.go}
                  style={{ flexShrink: 0, padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>{s.cta}</button>
              )}
            </div>
          ))}
          <div style={{ marginTop: '0.9rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            New to this?{' '}
            <button type="button" onClick={onOpenGuide}
              style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}>
              Read the 5-minute guide
            </button>
          </div>
        </div>
      )}

      {!startedSteps && onOpenSupport && <SupportNudge invoiceCount={bills.length} onOpen={onOpenSupport} />}

      {overdueBills.length > 0 && (
        <div className="overdue-banner" onClick={() => { setStatusFilter('overdue'); }}
          style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-light)', borderRadius: 10, padding: '0.85rem 1.25rem', marginBottom: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              {overdueBills.length} overdue invoice{overdueBills.length > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#991b1b', marginLeft: 8, fontSize: '0.85rem' }}>
              — {overdueStr} outstanding
            </span>
            {/* Its own click: the banner's click sets the Overdue filter. */}
            <span onClick={(e) => e.stopPropagation()}>
              <HelpButton title="Overdue invoices" doc="dashboard#overdue" size={16} />
            </span>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
            onClick={(e) => { e.stopPropagation(); setShowRemindAll(true); }}>
            <Send size={13} /> Remind All
          </button>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>View all &rarr;</span>
        </div>
      )}

      {/* Remind All Modal */}
      {showRemindAll && (
        <div className="modal-overlay" onClick={() => setShowRemindAll(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 className="section-title">Send Payment Reminders <HelpButton title="Send Payment Reminders" doc="dashboard#remind-all" size={16} /></h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Click on a client below to send a WhatsApp payment reminder.
            </p>
            {overdueBills.length === 0 ? (
              <p className="text-muted">No overdue invoices.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {overdueBills.map(bill => {
                  const phone = getClientPhone(bill);
                  return (
                    <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <span className="font-medium">{bill.clientName}</span>
                        <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>{bill.invoiceNumber}</span>
                        {(() => {
                          // v1.10.23 — signed outstanding label. Show
                          // "Overpaid ₹1" in blue on the reminder card
                          // instead of "-₹1" in red for overpayments.
                          const outCur = bill.currency || bill.data?.invoiceOptions?.currency;
                          const out = amountDue(bill) - (bill.paidAmount || 0);
                          if (out < -0.005) {
                            return <span style={{ marginLeft: 8, fontWeight: 600, color: '#0369a1', fontSize: '0.85rem' }}>
                              Overpaid {formatCurrency(Math.abs(out), outCur)}
                            </span>;
                          }
                          return <span style={{ marginLeft: 8, fontWeight: 600, color: '#dc2626', fontSize: '0.85rem' }}>
                            {formatCurrency(Math.max(0, out), outCur)}
                          </span>;
                        })()}
                        {phone && <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>{phone}</span>}
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                        onClick={() => sendReminder({ ...bill, clientPhone: phone })}>
                        <MessageCircle size={13} /> Remind
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setShowRemindAll(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><IndianRupee size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Total Invoiced <HelpButton title="Total Invoiced" doc="dashboard#total-invoiced" size={14} /></p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.total, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value">—</h2>}
            {Object.keys(stats.byCurrency).length > 1 && (
              <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: 2 }} title="Each invoice at the exchange rate saved on it">
                ≈ {formatCurrency(stats.inBase, baseCur)} in all{stats.noRate ? ` (${stats.noRate} without a rate left out)` : ''}
              </div>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Tax Collected <HelpButton title="Tax Collected" doc="dashboard#tax-collected" size={14} /></p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value stat-value-green" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.tax, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value stat-value-green">—</h2>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><Clock size={22} /></div>
          <div style={{ flex: 1 }}>
            <p className="stat-label">Outstanding <HelpButton title="Outstanding" doc="dashboard#outstanding" size={14} /></p>
            {Object.entries(stats.byCurrency).map(([cur, v]) => (
              <div key={cur} className="stat-value stat-value-amber" style={{ fontSize: Object.keys(stats.byCurrency).length > 1 ? '1.1rem' : undefined }}>
                {formatCurrency(v.unpaid, cur)}
              </div>
            ))}
            {Object.keys(stats.byCurrency).length === 0 && <h2 className="stat-value stat-value-amber">—</h2>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Receipt size={22} /></div>
          <div><p className="stat-label">Invoices <HelpButton title="Invoices count" doc="dashboard#invoice-count" size={14} /></p><h2 className="stat-value stat-value-purple">{stats.count}</h2></div>
        </div>
      </div>

      {/* Low stock: one line, moving only when it does not fit (LowStockTicker, below). */}
      {lowStockProducts.length > 0 && (
        <LowStockTicker products={lowStockProducts} onOpenProducts={onOpenProducts} />
      )}

      <div className="glass-panel">
        <div className="table-header"><h3>Invoices <HelpButton title="Finding an invoice" doc="dashboard#invoice-list" size={16} /></h3></div>
        {/* v1.10.84 (maintainer) - folders on top: active invoices, cancelled ones, and the Trash. */}
        <div className="invoice-folders" role="tablist" aria-label="Invoice folders" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0 0 0.25rem', padding: '0 1.25rem' }}>
          {[
            ['invoices', 'Invoices', bills.length - cancelledCount, <FileText size={14} />],
            ['cancelled', 'Cancelled', cancelledCount, <Ban size={14} />],
            ['trash', 'Trash', trash.length, <Trash2 size={14} />],
          ].map(([id, label, count, icon]) => {
            const active = folder === id;
            return (
              <button key={id} type="button" role="tab" aria-selected={active} onClick={() => setFolder(id)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem', padding: '0.35rem 0.8rem', fontWeight: active ? 700 : 600,
                  background: active ? 'var(--primary)' : undefined, color: active ? '#fff' : undefined,
                  borderColor: active ? 'var(--primary)' : undefined,
                }}>
                {icon} {label} <span style={{ opacity: 0.85 }}>({count})</span>
              </button>
            );
          })}
        </div>
        <div className="filters-bar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search client, invoice, order no, AWB, phone..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          {/* v1.10.84 - in the Trash tab only the search applies. */}
          {folder !== 'trash' && (<>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            <option value="all">All Years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(INVOICE_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            {/* v1.10.74 - rows can be Cancelled, so the filter needs it too */}
            <option value="cancelled">Cancelled</option>
          </select>
          {/* v1.10.83 - visible labels: the boxes alone read as "dd-mm-yyyy". */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>From
            <input type="date" className="filter-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>To
            <input type="date" className="filter-date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" /></label>
          {ccOn && <CostCentreFilter centres={centres} value={centreFilter} onChange={setCentreFilter} />}
          {hasFilters && <button className="icon-btn icon-btn-red" onClick={clearFilters} title="Clear" aria-label="Clear filters"><X size={15} /></button>}
          <button type="button" className="btn btn-secondary" onClick={() => setShowColumnPicker(v => !v)}
            title="Choose which columns to show" aria-label="Column picker"
            style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
            <FileText size={15} /> Columns
          </button>
          </>)}
        </div>

        {/* v1.9.4 — column picker popover */}
        {showColumnPicker && folder !== 'trash' && (
          <div style={{
            padding: '0.75rem 1rem', margin: '0.5rem 0',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Pick columns to show <HelpButton title="Choosing the columns" doc="dashboard#columns" size={14} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[
                ['date', 'Date'], ['invoice', 'Invoice #'], ['type', 'Type'],
                ['client', 'Client'], ['amount', 'Amount'], ['currency', 'Currency'],
                ['status', 'Status'], ['dueDate', 'Due date'],
                ['printed', 'Print count'], ['actions', 'Actions'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!visibleColumns[key]}
                    onChange={e => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                    style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* v1.9.1 — Quick bulk-print filters. One-click "print everything
             matching X" without needing to manually tick rows. Useful for
             month-end filing, wholesale reminders, CA handoffs. */}
        {folder !== 'trash' && (
        <div style={{
          padding: '0.5rem 0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          alignItems: 'center', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick print: <HelpButton title="Quick print" doc="dashboard#quick-print" size={14} />
          </span>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('all')}
            title="Combine all filtered invoices into one PDF">
            <Download size={12} /> All shown ({filtered.length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('unpaid')}
            title="Only invoices marked Unpaid (not Partial or Overdue)">
            {/* v1.10.74 - label says "only": Partial and Overdue are not included */}
            <Clock size={12} /> Unpaid only ({filtered.filter(b => (b.status || 'unpaid') === 'unpaid').length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('overdue')}>
            <AlertTriangle size={12} /> Overdue ({filtered.filter(b => b.status === 'overdue').length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('paid')}>
            <CheckCircle size={12} /> Paid ({filtered.filter(b => b.status === 'paid').length})
          </button>
        </div>
        )}

        {/* Bulk-action toolbar — only renders when at least one row is ticked. */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            padding: '0.6rem 0.85rem', marginBottom: '0.6rem',
            background: 'var(--info-bg)', border: '1px solid var(--info-border)',
            borderRadius: '8px', color: 'var(--info-text)',
          }}>
            <strong style={{ fontSize: '0.88rem' }}>{selectedIds.size} selected <HelpButton title="Ticking several invoices" doc="dashboard#bulk" size={14} /></strong>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('paid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><CheckCircle size={13} /> Mark paid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('unpaid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><Clock size={13} /> Mark unpaid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('overdue')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><AlertTriangle size={13} /> Mark overdue</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportJSON}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><FileText size={13} /> Export JSON</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkExportPDF()}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="Combine the ticked invoices into one multi-page PDF, for filing or your CA"><Download size={13} /> One merged PDF</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkExportPDF(null, 'separate')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="One PDF file per ticked invoice, named by invoice number, downloaded together in a ZIP"><Download size={13} /> Separate PDFs (ZIP)</button>
            {einvoiceOn && (
              <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportEInvoice}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="One e-invoice JSON with the ticked invoices, to upload on einvoice1.gst.gov.in"><QrCode size={13} /> E-invoice JSON</button>
            )}
            {ccOn && (
              <select className="filter-select" value="" disabled={bulkBusy} aria-label="Set cost centre"
                onChange={e => bulkSetCentre(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', width: 'auto' }}>
                <option value="">Set cost centre…</option>
                {centres.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{centreLabel(c)}</option>)}
                <option value={UNTAGGED}>Remove cost centre</option>
              </select>
            )}
            {/* v1.10.7 — Cancel button for the in-flight bulk export. The
                 underlying abort flag was wired in v1.10.3; this is the
                 UI surface promised by that changelog. Setting the flag
                 stops the export loop after the current invoice, so
                 whatever's already assembled still gets saved. */}
            {bulkBusy && (
              <button type="button" className="btn btn-secondary"
                onClick={() => { window.__fgsbBulkAbort = true; }}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--warn-text)', borderColor: 'var(--warn-border)' }}
                title="Stop the bulk export after the current invoice — partial results still get saved."><X size={13} /> Cancel</button>
            )}
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkCancel}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <Ban size={13} /> Cancel invoices
            </button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkDelete}
              title="Move the ticked invoices to the Trash tab for 30 days (Restore there puts them back)"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <Trash2 size={13} /> Delete invoices
            </button>
            <button type="button" className="icon-btn" onClick={clearSelection} title="Clear selection" style={{ marginLeft: 'auto' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {folder === 'trash' ? (
          <InvoiceTrash items={trash.filter((b) => billMatchesSearch(b, search))} busy={trashBusy}
            onRestore={restoreFromTrash} onPurge={purgeFromTrash} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>{bills.length === 0 ? 'No invoices yet.' : folder === 'cancelled' ? 'No cancelled invoices.' : 'No invoices match your filters.'}</p>
            {bills.length === 0 && <button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Create Invoice</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table invoice-table">
              <thead>
                <tr>
                  <th style={{ width: '32px', padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(b => selectedIds.has(b.id))}
                      onChange={toggleSelectAllVisible}
                      title="Select all visible"
                      style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </th>
                  {visibleColumns.date && <th>Date</th>}
                  {visibleColumns.invoice && <th>Invoice No.</th>}
                  {visibleColumns.type && <th className="col-center">Type</th>}
                  {visibleColumns.client && <th>Client</th>}
                  {visibleColumns.amount && <th>Amount</th>}
                  {visibleColumns.currency && <th>Currency</th>}
                  {visibleColumns.dueDate && <th>Due Date</th>}
                  {visibleColumns.printed && <th>Printed</th>}
                  <th className="col-center">Paid</th>
                  {visibleColumns.status && <th className="col-center">Status</th>}
                  {visibleColumns.actions && <th className="col-center col-sticky-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(bill => {
                  const status = bill.status || 'unpaid';
                  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
                  // v1.10.76 (#83) - only real sales get paid, so only they get the
                  // Paid / Unpaid / Partial menu (and can be overdue).
                  const tracksPayment = SALES_INVOICE_TYPES.includes(bill.invoiceType || 'tax-invoice');
                  const readOnly = status === 'cancelled' || !!bill.convertedTo;
                  const isOverdue = tracksPayment && status !== 'paid' && status !== 'cancelled' && bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
                  const daysOverdue = isOverdue ? Math.floor((new Date() - new Date(bill.data.details.dueDate)) / 86400000) : 0;
                  const billCurrency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
                  return (
                    <tr key={bill.id} className={isOverdue || status === 'overdue' ? 'row-overdue' : ''}
                      style={selectedIds.has(bill.id) ? { background: 'var(--info-bg)' } : undefined}>
                      <td style={{ padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                        <input type="checkbox" checked={selectedIds.has(bill.id)} onChange={() => toggleSelect(bill.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      </td>
                      {visibleColumns.date && <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>}
                      {visibleColumns.invoice && <td><span className="invoice-badge">{bill.invoiceNumber}</span>
                        {bill.einvoice?.irn && <span title={`IRN ${bill.einvoice.irn}`} style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, color: '#059669' }}>IRN</span>}</td>}
                      {visibleColumns.type && <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>}
                      {visibleColumns.client && <td className="font-medium td-client" title={bill.clientName}>
                        {bill.clientName}
                        {bill.data?.internalNote && (
                          <span title={bill.data.internalNote} style={{ marginLeft: 4, cursor: 'help', verticalAlign: 'middle' }}>
                            <StickyNote size={13} style={{ color: '#ca8a04' }} />
                          </span>
                        )}
                      </td>}
                      {visibleColumns.amount && <td className="font-bold">
                        {formatCurrency(bill.totalAmount, billCurrency)}
                        {billCurrency !== 'INR' && !visibleColumns.currency && <span className="currency-chip">{billCurrency}</span>}
                      </td>}
                      {visibleColumns.currency && <td className="text-muted">{billCurrency}</td>}
                      {visibleColumns.dueDate && <td className="text-muted">{bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN') : <span className="cell-empty">—</span>}</td>}
                      {visibleColumns.printed && <td className="text-muted" style={{ textAlign: 'center' }}>{Number(bill.printedCount) || 0}×</td>}
                      <td className="text-muted col-center">{(bill.paidAmount || 0) > 0 ? formatCurrency(bill.paidAmount, billCurrency) : <span className="cell-empty">—</span>}</td>
                      {visibleColumns.status && <td className="col-center">
                        {/* v1.10.77 (#86) - a cancelled document is read-only: its status
                            menu is locked, with Undo to bring it back. */}
                        {status === 'cancelled' ? (
                          <span className="type-badge" style={{ background: sc.bg, color: sc.color }}>Cancelled</span>
                        ) : !tracksPayment ? (
                          <span className="type-badge" title={bill.convertedTo ? `Converted to ${bill.convertedTo}` : ''}>
                            {bill.convertedTo ? 'Converted' : bill.invoiceType === 'credit-note' ? 'Issued' : 'Open'}
                          </span>
                        ) : <>
                        <select className="status-select" value={isOverdue && status !== 'overdue' ? 'overdue' : status}
                          style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '44' }}
                          onChange={e => changeStatus(bill, e.target.value)}>
                          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                        {daysOverdue > 0 && <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'block', marginTop: 2 }}>{daysOverdue}d overdue</span>}
                        </>}
                      </td>}
                      {visibleColumns.actions && <td className="col-sticky-actions" style={selectedIds.has(bill.id) ? { backgroundImage: 'linear-gradient(var(--info-bg), var(--info-bg))' } : undefined}>
                        {/* v1.10.80 (#100) - View (read-only preview) and Edit up front,
                            with Payment, Convert and Undo where they apply; the rest
                            in the ⋯ menu instead of a long row of icons. */}
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          {bill.data && (
                            <button className="icon-btn icon-btn-blue" onClick={() => setViewBill(bill)} title="View"
                              aria-label={`View ${bill.invoiceNumber}`}><Eye size={15} /></button>
                          )}
                          {!readOnly && (
                            <button className="icon-btn icon-btn-blue" onClick={() => handleView(bill)} title="Edit"><Edit3 size={15} /></button>
                          )}
                          {status === 'cancelled' && (
                            <button className="icon-btn icon-btn-blue" onClick={() => undoCancel(bill)} title="Undo cancel" aria-label={`Undo cancel of ${bill.invoiceNumber}`}>
                              <Undo2 size={15} />
                            </button>
                          )}
                          {/* Payments on sales; on anything else (cancelled, converted, an
                              advance on a proforma) only to see the history it has. */}
                          {((tracksPayment && !readOnly) || (bill.payments || []).length > 0) && (
                            <button className="icon-btn icon-btn-green" onClick={() => openPaymentModal(bill)}
                              title={tracksPayment && !readOnly ? 'Payment' : 'Payment history'}><IndianRupee size={15} /></button>
                          )}
                          {/* v1.10.76 (#83) - gone once it has been converted (bill.convertedTo) */}
                          {!readOnly && ['quotation', 'proforma', 'delivery-challan'].includes(bill.invoiceType) && !bill.convertedTo && (
                            <button className="icon-btn icon-btn-green" onClick={() => onConvert(bill)} title="Convert to Tax Invoice"><FileText size={15} /></button>
                          )}
                          {/* v1.10.77 (#86) - cancelled and converted documents are read-only:
                              View and Duplicate only (Undo is in the Status column). */}
                          <ActionsMenu label={`More actions for ${bill.invoiceNumber}`} items={[
                            { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(bill) },
                            { label: 'Print', icon: Printer, onClick: () => onPrint(bill), hidden: readOnly },
                            { label: 'WhatsApp', icon: MessageCircle, tone: 'green', onClick: () => shareWhatsApp(bill), hidden: readOnly,
                              title: 'Share via WhatsApp — PDF attaches on mobile Chrome/Safari. On desktop it sends the invoice as text only (browser can\'t attach files to WhatsApp Web — security limitation, not our app).' },
                            // v1.10.12 — reminder for unpaid, partial and overdue bills.
                            { label: status === 'partial' ? 'Reminder (partial pending)' : 'Send reminder', icon: Send, onClick: () => sendReminder({ ...bill, clientPhone: getClientPhone(bill) }),
                              hidden: readOnly || !tracksPayment || isCancelledBill(bill) || !(isOverdue || status === 'overdue' || status === 'unpaid' || status === 'partial') || !(amountDue(bill) - (bill.paidAmount || 0) > 0.01) },
                            { label: 'Email', icon: Mail, onClick: () => shareEmail(bill), hidden: readOnly },
                            { label: 'Cancel invoice', icon: Ban, tone: 'danger', onClick: () => handleCancelInvoice(bill), hidden: readOnly,
                              title: 'Cancel invoice — keeps the number; undo it with the Undo cancel arrow on the row' },
                            // Also on a cancelled invoice: cancel it, then delete it if it should go.
                            { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => handleDeleteInvoice(bill),
                              title: 'Move to the Trash tab for 30 days (Restore there puts it back)' },
                          ]} />
                        </div>
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {einvReport && <EInvoiceReport {...einvReport} onClose={() => setEinvReport(null)} />}

      {/* v1.10.80 (#100) - View: the invoice as it prints, without opening the editor. */}
      {viewBill?.data && (
        <PrintPreviewModal
          isOpen
          onClose={() => setViewBill(null)}
          onPrint={() => onPrint(viewBill)}
          cancelled={isCancelledBill(viewBill)}
          einvoice={viewBill.einvoice}
          profile={viewBill.data.profile}
          client={viewBill.data.client || {}}
          details={viewBill.data.details || {}}
          items={viewBill.data.items || []}
          totals={viewBill.data.totals || {}}
          invoiceType={viewBill.invoiceType || viewBill.data.invoiceType || 'tax-invoice'}
          customTerms={viewBill.data.customTerms}
          customNotes={viewBill.data.customNotes}
          extraSections={viewBill.data.extraSections || []}
          invoiceOptions={viewBill.data.invoiceOptions || {}}
        />
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">Record Payment <HelpButton title="Recording a payment" doc="dashboard#payments" size={16} style={{ marginLeft: 6 }} /></h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Invoice: <strong>{paymentModal.invoiceNumber}</strong> | Total: <strong>{formatCurrency(paymentModal.totalAmount, paymentModal.currency)}</strong>
              {(paymentModal.paidAmount || 0) > 0 && <> | Paid: <strong>{formatCurrency(paymentModal.paidAmount, paymentModal.currency)}</strong></>}
              {' '}| {(() => {
                // v1.10.23 — signed remaining so overpayments surface here too.
                const rem = amountDue(paymentModal) - (paymentModal.paidAmount || 0);
                if (rem < -0.005) {
                  return <>Overpaid: <strong style={{ color: '#0369a1' }}>{formatCurrency(Math.abs(rem), paymentModal.currency)}</strong></>;
                }
                return <>Balance: <strong style={{ color: rem > 0.005 ? '#dc2626' : '#059669' }}>{formatCurrency(Math.max(0, rem), paymentModal.currency)}</strong></>;
              })()}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Amount Received</label>
                <input type="number" className="form-input" value={paymentInput.amount}
                  onChange={e => setPaymentInput(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={String(Math.max(0, Math.round((amountDue(paymentModal) - (paymentModal.paidAmount || 0)) * 100) / 100))} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-input" value={paymentInput.date}
                  onChange={e => setPaymentInput(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={paymentInput.mode}
                  onChange={e => setPaymentInput(prev => ({ ...prev, mode: e.target.value }))}>
                  {PAYMENT_MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={paymentInput.note}
                  onChange={e => setPaymentInput(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Transaction ID, ref..." />
              </div>
            </div>
            {/* v1.10.83 - paid from abroad: what reached the bank in rupees, the
                bank's charges and the FIRC / e-BRC number (the proof of foreign
                exchange received for an export). All optional. */}
            {fxBillCurrency(paymentModal) !== baseCur && (
              <div style={{ marginTop: '0.5rem', padding: '0.6rem', borderRadius: 6, border: '1px dashed var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Received from abroad (optional) <HelpButton title="Payments from abroad" doc="dashboard#payment-foreign" size={14} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label" htmlFor="pay-inr">Credited to your bank ({baseCur})</label>
                    <input id="pay-inr" type="number" min="0" step="any" className="form-input" value={paymentInput.inrReceived || ''}
                      onChange={e => setPaymentInput(prev => ({ ...prev, inrReceived: e.target.value }))} placeholder="As on the bank statement" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="pay-charges">Bank charges ({baseCur})</label>
                    <input id="pay-charges" type="number" min="0" step="any" className="form-input" value={paymentInput.bankCharges || ''}
                      onChange={e => setPaymentInput(prev => ({ ...prev, bankCharges: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="pay-firc">FIRC / e-BRC number</label>
                    <input id="pay-firc" type="text" className="form-input" value={paymentInput.fircRef || ''}
                      onChange={e => setPaymentInput(prev => ({ ...prev, fircRef: e.target.value }))} placeholder="From your bank, for export of services" />
                  </div>
                </div>
                {Number(paymentInput.inrReceived) > 0 && Number(paymentInput.amount) > 0 && (
                  <p className="text-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.75rem' }}>
                    Works out to 1 {fxBillCurrency(paymentModal)} = {((Number(paymentInput.inrReceived) + (Number(paymentInput.bankCharges) || 0)) / Number(paymentInput.amount)).toFixed(4)} {baseCur} before bank charges.
                  </p>
                )}
              </div>
            )}
            {tdsEntryAllowed(paymentModal) && (() => {
              const preview = withClientTds(paymentModal, { section: paymentInput.tdsSection, rate: paymentInput.tdsRate }).data.totals;
              return (
                <div className={paymentInput.tdsOn ? 'notice notice-info' : ''} style={{ display: 'block', marginTop: '0.5rem', padding: '0.6rem', borderRadius: 6, border: paymentInput.tdsOn ? undefined : '1px dashed var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!paymentInput.tdsOn}
                      onChange={e => setPaymentInput(prev => ({ ...prev, tdsOn: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    <strong>Client deducted TDS</strong>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>paid you less and deposited the rest as TDS against your PAN</span>
                    <HelpButton title="TDS when recording a payment" doc="dashboard#payment-tds" size={14} />
                  </label>
                  {paymentInput.tdsOn && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <select className="form-input" aria-label="TDS section" value={paymentInput.tdsSection}
                          onChange={e => {
                            const code = e.target.value;
                            const sec = TDS_SECTIONS.find(x => x.code === code);
                            setPaymentInput(prev => ({ ...prev, tdsSection: code, tdsRate: code === 'custom' ? prev.tdsRate : (sec?.rate ?? prev.tdsRate) }));
                          }}>
                          {TDS_SECTIONS.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
                        </select>
                        <input type="number" step="any" min="0" max="100" className="form-input" aria-label="TDS rate %" placeholder="Rate %"
                          value={paymentInput.tdsRate} onChange={e => setPaymentInput(prev => ({ ...prev, tdsRate: e.target.value }))} />
                      </div>
                      <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
                        TDS {formatCurrency(preview.tdsAmount, paymentModal.currency)} on the value before GST · the client now owes <strong>{formatCurrency(preview.netReceivable, paymentModal.currency)}</strong> in all.
                        {' '}Leave Amount Received empty to record only the TDS.
                      </p>
                    </>
                  )}
                </div>
              );
            })()}
            {paymentModal.payments?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <label className="form-label">Payment History <HelpButton title="Payment History" doc="dashboard#payment-history" size={14} /></label>
                <div className="payment-history">
                  {/* v1.10.9 — each row now has View Receipt / Edit Note /
                      Delete actions. Prior code showed values only with no
                      way to reprint or fix a typo. */}
                  {paymentModal.payments.map((p, i) => (
                    <div key={p.id || i} className="payment-row" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 90 }}>{p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</span>
                      <span className="font-bold" style={{ minWidth: 100 }}>{formatCurrency(p.amount, paymentModal.currency)}</span>
                      <span className="text-muted" style={{ minWidth: 90 }}>{paymentModeName(p.mode)}</span>
                      {p.note && <span className="text-muted" style={{ flex: 1 }}>· {p.note}</span>}
                      {p.inrReceived > 0 && <span className="text-muted">· {formatCurrency(p.inrReceived, baseCur)} credited{p.fircRef ? ` · FIRC ${p.fircRef}` : ''}</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => openReceiptFor(paymentModal, p)}
                          title="View / Print receipt for this payment"><Receipt size={12} /> Receipt</button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => editPaymentAt(paymentModal, i)}
                          title="Edit amount / date / mode / note"><Edit3 size={12} /></button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => deletePaymentAt(paymentModal, i)}
                          title="Delete this payment"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={recordPayment}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* v1.10.13 — Payment Edit modal. Lets the user fix a wrong amount
           without having to delete + re-record. Recomputes bill status
           on save; keeps the Receipts store in sync. */}
      {editPaymentModal && (
        <div className="modal-overlay" onClick={() => setEditPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Edit Payment <HelpButton title="Edit Payment" doc="dashboard#edit-payment" size={16} /></h3>
              <button className="icon-btn" onClick={() => setEditPaymentModal(null)} title="Close"><X size={18} /></button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              Invoice: <strong>{editPaymentModal.bill.invoiceNumber}</strong>
              {' '}| Total: <strong>{formatCurrency(editPaymentModal.bill.totalAmount, editPaymentModal.bill.currency)}</strong>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input type="number" className="form-input" value={editPaymentModal.form.amount}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, amount: e.target.value } }))}
                  min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={editPaymentModal.form.date}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, date: e.target.value } }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-input" value={editPaymentModal.form.mode}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, mode: e.target.value } }))}>
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note / reference</label>
                <input type="text" className="form-input" value={editPaymentModal.form.note}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, note: e.target.value } }))}
                  placeholder="Transaction ID, ref..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setEditPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditedPayment}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* v1.10.9 — Payment Receipt modal. */}
      {receiptTarget && (
        <ReceiptModal target={receiptTarget} onClose={() => setReceiptTarget(null)} />
      )}
    </div>
  );
}

// v1.10.77 (#84) - low stock as one line under a "Low stock" heading, like a
// news ticker. v1.10.78 - it only moves when the list is wider than its strip
// (then a second copy makes the loop seamless); a short list stays still, so
// two products no longer show up as four. Pauses while pointed at; with
// reduced motion it is a plain row that scrolls sideways. Each name opens
// Products (#44).
function LowStockTicker({ products, onOpenProducts }) {
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const win = windowRef.current;
    const track = trackRef.current;
    if (!win || !track || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const oneCopy = track.scrollWidth / (track.dataset.copies === '2' ? 2 : 1);
      setScrolls(oneCopy > win.clientWidth + 1);
    });
    ro.observe(win);
    ro.observe(track);
    return () => ro.disconnect();
  }, [products.length]);
  const copies = scrolls ? [0, 1] : [0];
  return (
    <div className="glass-panel low-stock-ticker" style={{ marginBottom: '1rem', padding: '0.55rem 1rem' }}>
      <span className="low-stock-ticker-label">
        <Package size={16} /> Low stock ({products.length}) <HelpButton title="Low stock" doc="dashboard#low-stock" size={14} />
      </span>
      <div ref={windowRef} className={`low-stock-ticker-window${scrolls ? ' is-scrolling' : ''}`}>
        <div ref={trackRef} data-copies={copies.length} className="low-stock-ticker-track"
          style={scrolls ? { animationDuration: `${Math.max(12, products.length * 4)}s` } : undefined}>
          {copies.map((copy) => products.map((p) => (
            <button
              key={`${copy}-${p.id}`}
              type="button"
              onClick={onOpenProducts}
              aria-hidden={copy === 1 ? 'true' : undefined}
              tabIndex={copy === 1 ? -1 : undefined}
              title={onOpenProducts ? `Open Products to restock ${p.name}` : undefined}
              className={`low-stock-chip${trackedStock(p) <= 0 ? ' low-stock-out' : ''}`}>
              <strong>{p.name}</strong>
              {p.hsn ? <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.72rem' }}>({p.hsn})</span> : null}
              <span style={{ marginLeft: 6, fontWeight: 700 }}>
                {trackedStock(p) <= 0 ? 'Out of Stock' : `Stock: ${trackedStock(p)}`}
              </span>
            </button>
          )))}
        </div>
      </div>
    </div>
  );
}
