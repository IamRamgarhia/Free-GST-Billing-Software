// v1.10.80 (#101) - bulk CSV import / export of sales invoices (Dashboard)
// and purchase bills (Purchases). The parsing and the arithmetic live in
// src/utils/bulkCsv.js; this is the window around them: template, export,
// pick a file, see what will happen, import.
// v1.10.84 (#130) - an Excel .xlsx too (Vyapar's sale report): it opens on the
// sheet with the most invoices, others can be picked, and what a "Sale Report"
// sheet says was received becomes the payments.
import { useState } from 'react';
import { FileSpreadsheet, Upload, Download, X } from 'lucide-react';
import {
  getProfile, getAllBills, saveBill, getAllProducts, saveProduct, applyStockChanges,
  getAllClients, saveClient, getAllPurchases, savePurchase,
} from '../store';
import { belongsToProfile, isCancelledBill, isInterstateSupply, roundQty, localToday } from '../utils';
import {
  salesCsvToBills, billsToSalesCsv, purchaseCsvToRecords, purchasesToCsv, SALES_TEMPLATE, PURCHASE_TEMPLATE, receivedByInvoice,
  newProductsFromBills,
} from '../utils/bulkCsv';
import { fileToSheets, bestSheet } from '../utils/importFile';
import { toast } from './Toast';
import HelpButton from './HelpButton';

const download = (text, name) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function BulkCsvImport({ kind = 'sales', onDone }) {
  const sales = kind === 'sales';
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(null); // { fileName, result, sheets, at }
  const [adjustStock, setAdjustStock] = useState(false);
  const [addClients, setAddClients] = useState(true);
  const [addProducts, setAddProducts] = useState(true);
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) { setOpen(false); setPlan(null); } };

  // Reads everything the conversion needs and works out what the file holds.
  // at: the sheet to read (undefined: the one with the most ready).
  const preview = async (fileName, sheets, at, stock = adjustStock) => {
    const profile = await getProfile().catch(() => ({}));
    let convert;
    if (sales) {
      const [bills, products, clients] = await Promise.all([getAllBills(), getAllProducts().catch(() => []), getAllClients().catch(() => [])]);
      const existingIds = new Set(bills.map((b) => b.id));
      convert = (i) => salesCsvToBills(sheets[i].rows, {
        profile, products, clients, adjustStock: stock, existingIds,
        received: sheets.filter((_, j) => j !== i).map((s) => receivedByInvoice(s.rows)).find((m) => m.size) || null,
      });
    } else {
      const existing = (await getAllPurchases()).filter((p) => belongsToProfile(p, profile));
      convert = (i) => purchaseCsvToRecords(sheets[i].rows, { profile, existing, inferInterstate: (g) => isInterstateSupply(g, profile) });
    }
    const ready = (res) => (sales ? res.bills : res.purchases).length;
    const pick = at ?? bestSheet(sheets, (_, i) => ready(convert(i)));
    setPlan({ fileName, sheets, at: pick, result: convert(pick) });
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await preview(file.name, await fileToSheets(file, kind));
    } catch (err) {
      toast(`Could not read ${file.name}: ${err.message}`, 'error', 9000);
    }
  };

  const exportAll = async () => {
    try {
      const profile = await getProfile().catch(() => null);
      if (sales) {
        const bills = (await getAllBills()).filter((b) => b.data && belongsToProfile(b, profile) && !isCancelledBill(b))
          .sort((a, b) => String(a.invoiceDate).localeCompare(String(b.invoiceDate)));
        if (!bills.length) { toast('No invoices to export', 'warning'); return; }
        download(billsToSalesCsv(bills), `Sales-invoices-${localToday()}.csv`);
      } else {
        const list = (await getAllPurchases()).filter((p) => belongsToProfile(p, profile))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (!list.length) { toast('No purchase bills to export', 'warning'); return; }
        download(purchasesToCsv(list), `Purchase-bills-${localToday()}.csv`);
      }
      toast('CSV downloaded. It uses the same columns as the import.', 'success');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    }
  };

  const runImport = async () => {
    if (!plan) return;
    setBusy(true);
    let saved = 0;
    let taken = 0;
    try {
      if (sales) {
        const stock = {};
        const savedBills = [];
        // Stock for the bills already saved is applied even if a later one
        // stops the import (it used to be skipped, leaving those bills with
        // a stock record that never happened).
        try {
          for (const bill of plan.result.bills) {
            try {
              await saveBill(bill, { overwrite: false }); // never replaces an invoice
              saved += 1;
              savedBills.push(bill);
              for (const [id, d] of Object.entries(bill.data.stockApplied || {})) stock[id] = (stock[id] || 0) + d;
            } catch (err) {
              if (err.status === 409) taken += 1; else throw err;
            }
          }
        } finally {
          if (Object.keys(stock).length) await applyStockChanges(stock);
          // #170: new items of the saved invoices go into Products too.
          // Review M2: the product list must be read, or every item would look new
          // (duplicates); then products are left as they are, and the user is told.
          if (addProducts && savedBills.length) {
            const have = await getAllProducts().catch(() => null);
            if (have) {
              for (const p of newProductsFromBills(savedBills, have)) await saveProduct(p).catch(() => {});
            } else {
              toast('The invoices were imported, but the product list could not be read, so no new items were added to Products.', 'warning', 9000);
            }
          }
        }
        if (addClients) for (const c of plan.result.newClients) await saveClient({ ...c }).catch(() => {});
      } else {
        // As when a bill is typed in: quantities go into product stock, and a
        // new item becomes a product (Purchases > save does the same).
        const products = await getAllProducts().catch(() => []);
        const byName = new Map(products.map((p) => [String(p.name || '').trim().toLowerCase(), { ...p }]));
        const touched = new Set();
        // As for sales: the bills saved so far get their stock even if a later
        // one fails.
        try {
          for (const purchase of plan.result.purchases) {
            await savePurchase(purchase);
            saved += 1;
            for (const it of purchase.items) {
              const key = it.name.trim().toLowerCase();
              const prev = byName.get(key) || { name: it.name.trim(), hsn: it.hsn, sellingPrice: it.rate, rate: it.rate, taxPercent: it.taxPercent, cessPercent: it.cessPercent, unit: 'Nos', stock: 0, description: '' };
              byName.set(key, { ...prev, stock: roundQty((Number(prev.stock) || 0) + it.quantity), purchasePrice: it.rate });
              touched.add(key);
            }
          }
        } finally {
          for (const key of touched) await saveProduct(byName.get(key));
        }
      }
      const parts = [`${saved} ${sales ? 'invoice' : 'purchase bill'}${saved === 1 ? '' : 's'} imported`];
      if (plan.result.skipped.length + taken) parts.push(`${plan.result.skipped.length + taken} already there, skipped`);
      if (plan.result.errors.length) parts.push(`${plan.result.errors.length} with errors not imported`);
      toast(parts.join(' · '), saved ? 'success' : 'warning', 8000);
      setOpen(false); setPlan(null);
      onDone?.();
    } catch (err) {
      toast(`Import stopped after ${saved}: ${err.message}`, 'error', 9000);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const r = plan?.result;
  const ready = r ? (sales ? r.bills.length : r.purchases.length) : 0;
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}
        title={`Import ${sales ? 'invoices' : 'purchase bills'} from a CSV file, or export them as CSV`}>
        <FileSpreadsheet size={16} /> CSV import / export
      </button>
      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title" style={{ margin: 0 }}>{sales ? 'Sales invoices' : 'Purchase bills'}: CSV import / export <HelpButton title="CSV import" doc={sales ? 'dashboard#csv' : 'purchases#csv-purchases'} size={16} style={{ marginLeft: 6 }} /></h3>
              <button type="button" className="icon-btn" onClick={close} title="Close"><X size={16} /></button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              One row per item. Rows with the same invoice number{sales ? '' : ' and supplier'} become one {sales ? 'invoice' : 'bill'}.
              Dates as YYYY-MM-DD or DD-MM-YYYY. {sales
                ? 'Taxes, CGST/SGST or IGST and totals are worked out exactly as on the invoice screen. An invoice number already used is skipped, never overwritten.'
                : 'A bill already entered (same supplier and invoice number) is skipped. Quantities are added to product stock, as when you type a bill in.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => download(sales ? SALES_TEMPLATE : PURCHASE_TEMPLATE, sales ? 'Sales-import-template.csv' : 'Purchase-import-template.csv')}>
                <Download size={15} /> Template
              </button>
              <button type="button" className="btn btn-secondary" onClick={exportAll}><Download size={15} /> Export all as CSV</button>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                <Upload size={15} /> Choose CSV or Excel file
                <input type="file" accept=".csv,text/csv,.xlsx" onChange={pickFile} style={{ display: 'none' }} />
              </label>
            </div>
            {sales && (
              <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <label><input type="checkbox" checked={adjustStock} onChange={(e) => { setAdjustStock(e.target.checked); if (plan) preview(plan.fileName, plan.sheets, plan.at, e.target.checked); }} /> Take sold quantities out of product stock (leave off for old invoices)</label>
                <label><input type="checkbox" checked={addClients} onChange={(e) => setAddClients(e.target.checked)} /> Add new clients to Clients</label>
                <label><input type="checkbox" checked={addProducts} onChange={(e) => setAddProducts(e.target.checked)} /> Add new items to Products</label>
              </div>
            )}
            {r && (
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem' }}>
                {plan.sheets.length > 1 && (
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Sheet:{' '}
                    <select value={plan.at} onChange={(e) => preview(plan.fileName, plan.sheets, Number(e.target.value))}>
                      {plan.sheets.map((s, i) => <option key={`${i}-${s.name}`} value={i}>{s.name || `Sheet ${i + 1}`}</option>)}
                    </select>
                  </label>
                )}
                <strong>{plan.fileName}</strong>: {ready} {sales ? 'invoice' : 'bill'}{ready === 1 ? '' : 's'} ready
                {r.skipped.length > 0 && <> · {r.skipped.length} already there (skipped)</>}
                {sales && r.newClients.length > 0 && <> · {r.newClients.length} new client{r.newClients.length === 1 ? '' : 's'}</>}
                {(r.warnings || []).map((w) => <p key={w} style={{ color: 'var(--warning, #b45309)', margin: '0.5rem 0 0' }}>{w}</p>)}
                {r.errors.length > 0 && (
                  <>
                    <p style={{ color: 'var(--danger)', margin: '0.5rem 0 0.25rem' }}>{r.errors.length} problem{r.errors.length === 1 ? '' : 's'} (these are not imported; fix the file and choose it again):</p>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 150, overflowY: 'auto' }}>
                      {r.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Close</button>
              <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy || !ready}>
                {busy ? 'Importing…' : `Import ${ready || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
