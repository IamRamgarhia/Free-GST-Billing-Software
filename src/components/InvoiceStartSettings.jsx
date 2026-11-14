import { useState, useEffect, useRef } from 'react';
import { getInvoiceDisplayOptions, patchInvoiceDefaults, getEnabledModules, getBusinessType } from '../store';
import { INVOICE_TYPES, getCountryConfig, isModuleEnabled } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { PAID_MODES } from './askPaidMode';
import { START_KEY, DUE_CHOICES, MODE_CHOICES, startTaxRate } from '../utils/invoiceStart';
import HelpButton from './HelpButton';
import { toast } from './Toast';

// v1.10.86 - Settings -> "New invoice starts with": document type, due date,
// GST %, how "Received now" was paid, and goods or services. Saved in the
// invoice defaults (both copies, through patchInvoiceDefaults); only a
// brand-new invoice reads it, so saved bills, edits and copies never change.
// Empty means as before: the last one used (or, for the due date, 15 days
// for a freelancer and none for others).
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem('freegstbill_invoiceOptions') || '{}')[START_KEY] || {}; } catch { return {}; }
};

export default function InvoiceStartSettings({ country }) {
  const [start, setStart] = useState(readLocal);
  const [customDays, setCustomDays] = useState(false);
  const touched = useRef(false); // a change before the server answers must win
  useEffect(() => {
    getInvoiceDisplayOptions().then((o) => {
      if (!touched.current && o?.[START_KEY]) setStart(o[START_KEY]);
    }).catch(() => {});
  }, []);

  const save = async (patch) => {
    touched.current = true;
    const next = { ...start, ...patch };
    setStart(next);
    try {
      await patchInvoiceDefaults({ [START_KEY]: next });
      toast('Saved. New invoices start this way.', 'success');
    } catch { toast('Could not save this setting', 'error'); }
  };

  const salesOrdersOn = isModuleEnabled('salesOrders', getEnabledModules());
  const types = Object.entries(INVOICE_TYPES).filter(([key]) => key !== 'sales-order' || salesOrdersOn || start.type === key);
  const customRates = (getPrintSettings().customTaxRates || []).map(Number).filter((n) => isFinite(n) && n >= 0 && n <= 100);
  const baseRates = getCountryConfig(country).taxRates?.length ? getCountryConfig(country).taxRates : [0, 5, 12, 18, 28, 40];
  const rates = [...new Set([...baseRates, ...customRates])].sort((a, b) => a - b);
  const set = start.dueDays !== '' && start.dueDays !== undefined && start.dueDays !== null;
  const days = set ? Math.max(0, Math.floor(Number(start.dueDays)) || 0) : (getBusinessType() === 'freelancer' ? 15 : 0);
  const dueChoice = customDays || (days && !DUE_CHOICES.includes(days)) ? 'custom' : String(days);

  return (
    <div id="section-newinvoice" className="glass-panel p-6 mb-6" style={{ order: 3 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>New invoice starts with <HelpButton title="New invoice starts with" doc="settings#new-invoice" size={16} style={{ marginLeft: 6 }} /></h3>
      <p className="page-subtitle mb-4">What a new invoice is filled in with. Change any of it on the invoice itself; invoices already made, edited or duplicated keep their own.</p>
      <div className="invoice-start-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="start-type">Document type</label>
          <select id="start-type" className="form-input" value={start.type || ''} onChange={(e) => save({ type: e.target.value })}>
            <option value="">The last one used</option>
            {types.map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="start-due">Due in</label>
          <div className="invoice-start-due">
            <select id="start-due" className="form-input" value={dueChoice}
              onChange={(e) => {
                if (e.target.value === 'custom') { setCustomDays(true); return; }
                setCustomDays(false);
                save({ dueDays: Number(e.target.value) });
              }}>
              <option value="0">No due date</option>
              {DUE_CHOICES.map((n) => <option key={n} value={String(n)}>{n} days</option>)}
              <option value="custom">Other number of days</option>
            </select>
            {dueChoice === 'custom' && (
              <input type="number" min="1" max="365" className="form-input" aria-label="Days after the invoice date"
                defaultValue={days || ''} placeholder="Days"
                onBlur={(e) => { const n = Math.min(365, Math.max(0, Math.floor(Number(e.target.value)) || 0)); if (n) save({ dueDays: n }); }} />
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="start-rate">GST % on a new line</label>
          <select id="start-rate" className="form-input" value={String(startTaxRate(start, rates))} onChange={(e) => save({ taxRate: Number(e.target.value) })}>
            {rates.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="start-paid">&quot;Received now&quot; paid by</label>
          <select id="start-paid" className="form-input" value={start.paidMode || ''} onChange={(e) => save({ paidMode: e.target.value })}>
            <option value="">The last one used</option>
            {PAID_MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="start-mode">Goods or services</label>
          <select id="start-mode" className="form-input" value={start.mode || ''} onChange={(e) => save({ mode: e.target.value })}>
            <option value="">The last one used</option>
            {MODE_CHOICES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
