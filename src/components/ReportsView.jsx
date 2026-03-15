import { useState, useEffect } from 'react';
import { FileText, Download, BarChart3, TrendingUp, TrendingDown, Wallet, Upload } from 'lucide-react';
import { getAllBills, getAllExpenses } from '../store';
import { formatCurrency, INVOICE_TYPES, calculateLineItemTax, getStateCode, formatDateGST, getFilingPeriod } from '../utils';
import { toast } from './Toast';

const GST_TYPES = ['tax-invoice', 'credit-note'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let i = 0; i < 5; i++) {
    const y = currentYear - i;
    options.push({
      value: `${y}-${y + 1}`,
      label: `FY ${y}-${String(y + 1).slice(-2)}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return options;
}

function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(row.map(escape).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function round2(n) { return Math.round(n * 100) / 100; }

function computeItemTaxSplit(item, isInterState) {
  const { afterDiscount, taxAmount } = calculateLineItemTax(item);
  if (isInterState) {
    return { taxable: afterDiscount, cgst: 0, sgst: 0, igst: taxAmount };
  }
  const half = Math.round((taxAmount / 2) * 100) / 100;
  return { taxable: afterDiscount, cgst: half, sgst: taxAmount - half, igst: 0 };
}

export default function ReportsView() {
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filterMode, setFilterMode] = useState('fy');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [activeTab, setActiveTab] = useState('gstr1');

  const fyOptions = getFYOptions();

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billData, expData] = await Promise.all([getAllBills(), getAllExpenses()]);
      setBills(billData);
      setExpenses(expData);
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  // Filter helper
  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy) return date >= fy.from && date <= fy.to;
      return true;
    } else {
      const d = new Date(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  const filteredBills = bills.filter(bill => {
    const type = bill.invoiceType || 'tax-invoice';
    if (!GST_TYPES.includes(type)) return false;
    if (!bill.data) return false;
    return filterByPeriod(bill.invoiceDate);
  });

  const allFilteredBills = bills.filter(bill => bill.data && filterByPeriod(bill.invoiceDate));

  const filteredExpenses = expenses.filter(exp => filterByPeriod(exp.date));

  // B2B / B2C split
  const b2bBills = filteredBills.filter(b => b.data?.client?.gstin);
  const b2cBills = filteredBills.filter(b => !b.data?.client?.gstin);

  // B2B rows
  const b2bRows = b2bBills.map(bill => {
    const { client, totals, details } = bill.data;
    const isInterState = bill.data.profile?.state && client?.state && bill.data.profile.state.toLowerCase() !== client.state.toLowerCase();
    const pos = getStateCode(details?.placeOfSupply || client?.state || '');
    return {
      gstin: client.gstin,
      clientName: client.name || bill.clientName || '',
      invoiceNo: bill.invoiceNumber || '',
      date: bill.invoiceDate || '',
      pos,
      supplyType: isInterState ? 'Inter' : 'Intra',
      taxable: totals?.taxableAmount || 0,
      cgst: isInterState ? 0 : (totals?.cgst || 0),
      sgst: isInterState ? 0 : (totals?.sgst || 0),
      igst: isInterState ? (totals?.igst || 0) : 0,
      total: totals?.total || 0,
    };
  });

  // B2C aggregated by rate
  const b2cByRate = {};
  b2cBills.forEach(bill => {
    const { profile, client, items } = bill.data;
    const isInterState = profile?.state && client?.state && profile.state !== client.state;
    (items || []).forEach(item => {
      const rate = item.taxPercent || 0;
      if (!b2cByRate[rate]) b2cByRate[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      const split = computeItemTaxSplit(item, isInterState);
      b2cByRate[rate].taxable += split.taxable;
      b2cByRate[rate].cgst += split.cgst;
      b2cByRate[rate].sgst += split.sgst;
      b2cByRate[rate].igst += split.igst;
      b2cByRate[rate].total += split.taxable + split.cgst + split.sgst + split.igst;
    });
  });
  const b2cRates = Object.keys(b2cByRate).map(Number).sort((a, b) => a - b);

  // HSN summary
  const hsnMap = {};
  filteredBills.forEach(bill => {
    const { profile, client, items } = bill.data;
    const isInterState = profile?.state && client?.state && profile.state !== client.state;
    (items || []).forEach(item => {
      const hsn = item.hsn || 'N/A';
      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsn, description: item.description || '', quantity: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      }
      const split = computeItemTaxSplit(item, isInterState);
      hsnMap[hsn].quantity += item.quantity || 0;
      hsnMap[hsn].taxable += split.taxable;
      hsnMap[hsn].cgst += split.cgst;
      hsnMap[hsn].sgst += split.sgst;
      hsnMap[hsn].igst += split.igst;
      hsnMap[hsn].totalTax += split.cgst + split.sgst + split.igst;
    });
  });
  const hsnRows = Object.values(hsnMap).sort((a, b) => a.hsn.localeCompare(b.hsn));

  // Totals
  const sumRows = (rows) => rows.reduce((acc, r) => ({
    taxable: acc.taxable + r.taxable, cgst: acc.cgst + r.cgst,
    sgst: acc.sgst + r.sgst, igst: acc.igst + r.igst, total: acc.total + r.total,
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const b2bTotals = sumRows(b2bRows);
  const b2cTotals = b2cRates.reduce((acc, rate) => {
    const d = b2cByRate[rate];
    return { taxable: acc.taxable + d.taxable, cgst: acc.cgst + d.cgst, sgst: acc.sgst + d.sgst, igst: acc.igst + d.igst, total: acc.total + d.total };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const grandTotals = {
    taxable: b2bTotals.taxable + b2cTotals.taxable, cgst: b2bTotals.cgst + b2cTotals.cgst,
    sgst: b2bTotals.sgst + b2cTotals.sgst, igst: b2bTotals.igst + b2cTotals.igst, total: b2bTotals.total + b2cTotals.total,
  };

  // GSTR-3B calculations
  const outputTax = { cgst: grandTotals.cgst, sgst: grandTotals.sgst, igst: grandTotals.igst };
  const itcFromExpenses = filteredExpenses.reduce((acc, e) => {
    const gst = e.gstAmount || 0;
    // Simplified: if vendor has GSTIN, split ITC equally
    const half = Math.round((gst / 2) * 100) / 100;
    return { cgst: acc.cgst + half, sgst: acc.sgst + (gst - half), igst: acc.igst };
  }, { cgst: 0, sgst: 0, igst: 0 });
  const netTax = {
    cgst: Math.max(0, outputTax.cgst - itcFromExpenses.cgst),
    sgst: Math.max(0, outputTax.sgst - itcFromExpenses.sgst),
    igst: Math.max(0, outputTax.igst - itcFromExpenses.igst),
  };

  // Document Summary
  const docSummary = {};
  allFilteredBills.forEach(bill => {
    const type = bill.invoiceType || 'tax-invoice';
    const prefix = INVOICE_TYPES[type]?.prefix || 'INV';
    if (!docSummary[prefix]) docSummary[prefix] = { type: INVOICE_TYPES[type]?.label || type, from: bill.invoiceNumber, to: bill.invoiceNumber, total: 0 };
    docSummary[prefix].total++;
    if (bill.invoiceNumber < docSummary[prefix].from) docSummary[prefix].from = bill.invoiceNumber;
    if (bill.invoiceNumber > docSummary[prefix].to) docSummary[prefix].to = bill.invoiceNumber;
  });

  // P&L
  const totalRevenue = allFilteredBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalTaxCollected = allFilteredBills.reduce((s, b) => s + (b.totalTaxAmount || 0), 0);
  const revenueExTax = totalRevenue - totalTaxCollected;
  const totalExpenseAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenseGST = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
  const expenseExGST = totalExpenseAmount - totalExpenseGST;
  const netProfit = revenueExTax - expenseExGST;

  // Monthly P&L breakdown
  const monthlyPL = {};
  allFilteredBills.forEach(b => {
    if (!b.invoiceDate) return;
    const key = b.invoiceDate.substring(0, 7); // YYYY-MM
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].revenue += b.totalAmount || 0;
    monthlyPL[key].tax += b.totalTaxAmount || 0;
  });
  filteredExpenses.forEach(e => {
    if (!e.date) return;
    const key = e.date.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].expense += e.amount || 0;
    monthlyPL[key].expGst += e.gstAmount || 0;
  });
  const monthlyKeys = Object.keys(monthlyPL).sort();

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  // Credit/Debit notes (separate from regular invoices for GSTR-1)
  const creditNotes = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') === 'credit-note');
  const regularBills = filteredBills.filter(b => (b.invoiceType || 'tax-invoice') !== 'credit-note');
  const b2bRegular = regularBills.filter(b => b.data?.client?.gstin);
  const b2cRegular = regularBills.filter(b => !b.data?.client?.gstin);

  // B2C Large (interstate > ₹2.5L) vs B2C Small
  const b2cLarge = b2cRegular.filter(b => {
    const isInter = b.data?.profile?.state && b.data?.client?.state && b.data.profile.state.toLowerCase() !== b.data.client.state.toLowerCase();
    return isInter && (b.totalAmount || 0) > 250000;
  });
  const b2cSmall = b2cRegular.filter(b => {
    const isInter = b.data?.profile?.state && b.data?.client?.state && b.data.profile.state.toLowerCase() !== b.data.client.state.toLowerCase();
    return !(isInter && (b.totalAmount || 0) > 250000);
  });

  // CSV exports — enhanced with GST portal fields
  const exportB2B = () => {
    if (b2bRows.length === 0) { toast('No B2B data to export', 'warning'); return; }
    const rows = b2bRegular.map(bill => {
      const { client, profile, totals, items } = bill.data;
      const isInterState = profile?.state && client?.state && profile.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || '');
      return [
        client.gstin, client.name || bill.clientName || '', bill.invoiceNumber || '',
        formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), pos,
        'N', 'Regular', isInterState ? 'Inter State' : 'Intra State',
        (totals?.taxableAmount || 0).toFixed(2),
        isInterState ? 0 : (totals?.cgst || 0).toFixed(2),
        isInterState ? 0 : (totals?.sgst || 0).toFixed(2),
        isInterState ? (totals?.igst || 0).toFixed(2) : 0,
      ];
    });
    downloadCSV('GSTR1_B2B_Invoices.csv',
      ['GSTIN/UIN', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value',
       'Place of Supply', 'Reverse Charge', 'Invoice Type', 'Supply Type',
       'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount'],
      rows);
    toast('B2B CSV downloaded — matches GSTR-1 Table 4A format', 'success');
  };

  const exportB2C = () => {
    if (b2cRates.length === 0 && b2cLarge.length === 0) { toast('No B2C data to export', 'warning'); return; }
    // B2C Small — aggregated by rate + place of supply
    const b2csData = {};
    b2cSmall.forEach(bill => {
      const { profile, client, items } = bill.data;
      const isInterState = profile?.state && client?.state && profile.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || profile?.state || '');
      const splyType = isInterState ? 'INTER' : 'INTRA';
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        const key = `${splyType}_${pos}_${rate}`;
        if (!b2csData[key]) b2csData[key] = { splyType, pos, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
        const split = computeItemTaxSplit(item, isInterState);
        b2csData[key].taxable += split.taxable;
        b2csData[key].cgst += split.cgst;
        b2csData[key].sgst += split.sgst;
        b2csData[key].igst += split.igst;
      });
    });
    const b2csRows = Object.values(b2csData).map(d => [
      d.splyType === 'INTER' ? 'Inter State' : 'Intra State', d.pos, d.rate + '%',
      d.taxable.toFixed(2), d.cgst.toFixed(2), d.sgst.toFixed(2), d.igst.toFixed(2), '0.00'
    ]);
    downloadCSV('GSTR1_B2C_Small.csv',
      ['Type', 'Place of Supply', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'],
      b2csRows);
    // B2C Large — individual invoices
    if (b2cLarge.length > 0) {
      const b2clRows = b2cLarge.map(bill => {
        const { client, profile, totals, items } = bill.data;
        const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || '');
        return [
          bill.invoiceNumber, formatDateGST(bill.invoiceDate), (totals?.total || 0).toFixed(2), pos,
          (totals?.taxableAmount || 0).toFixed(2), (totals?.igst || 0).toFixed(2), '0.00'
        ];
      });
      downloadCSV('GSTR1_B2C_Large.csv',
        ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Taxable Value', 'IGST Amount', 'Cess Amount'],
        b2clRows);
      toast('B2C Small + B2C Large CSVs downloaded', 'success');
    } else {
      toast('B2C Small CSV downloaded — matches GSTR-1 Table 7 format', 'success');
    }
  };

  const exportHSN = () => {
    if (hsnRows.length === 0) { toast('No HSN data to export', 'warning'); return; }
    // Enhanced HSN with UQC and tax rate
    const hsnDetailed = {};
    filteredBills.forEach(bill => {
      const { profile, client, items } = bill.data;
      const isInterState = profile?.state && client?.state && profile.state.toLowerCase() !== client.state.toLowerCase();
      (items || []).forEach(item => {
        const hsn = item.hsn || 'N/A';
        const rate = item.taxPercent || 0;
        const key = `${hsn}_${rate}`;
        if (!hsnDetailed[key]) {
          hsnDetailed[key] = { hsn, desc: item.name || '', uqc: 'NOS', qty: 0, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalValue: 0 };
        }
        const split = computeItemTaxSplit(item, isInterState);
        hsnDetailed[key].qty += item.quantity || 0;
        hsnDetailed[key].taxable += split.taxable;
        hsnDetailed[key].cgst += split.cgst;
        hsnDetailed[key].sgst += split.sgst;
        hsnDetailed[key].igst += split.igst;
        hsnDetailed[key].totalValue += split.taxable + split.cgst + split.sgst + split.igst;
      });
    });
    downloadCSV('GSTR1_HSN_Summary.csv',
      ['HSN', 'Description', 'UQC', 'Total Quantity', 'Rate %', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount', 'Cess Amount', 'Total Value'],
      Object.values(hsnDetailed).map(r => [
        r.hsn, r.desc, r.uqc, r.qty, r.rate, r.taxable.toFixed(2),
        r.igst.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), '0.00', r.totalValue.toFixed(2),
      ]));
    toast('HSN Summary CSV downloaded — matches GSTR-1 Table 12 format', 'success');
  };

  // Credit/Debit Note export
  const exportCDNR = () => {
    const cdnrBills = creditNotes.filter(b => b.data?.client?.gstin);
    const cdnurBills = creditNotes.filter(b => !b.data?.client?.gstin);
    if (cdnrBills.length === 0 && cdnurBills.length === 0) { toast('No Credit/Debit Notes to export', 'warning'); return; }
    if (cdnrBills.length > 0) {
      downloadCSV('GSTR1_CDNR.csv',
        ['GSTIN/UIN', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Place of Supply',
         'Reverse Charge', 'Note Value', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount'],
        cdnrBills.map(bill => {
          const { client, profile, totals } = bill.data;
          const isInter = profile?.state && client?.state && profile.state.toLowerCase() !== client.state.toLowerCase();
          const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || '');
          return [
            client.gstin, client.name || bill.clientName, bill.invoiceNumber, formatDateGST(bill.invoiceDate),
            'C', pos, 'N', (totals?.total || 0).toFixed(2), (totals?.taxableAmount || 0).toFixed(2),
            isInter ? (totals?.igst || 0).toFixed(2) : '0.00',
            isInter ? '0.00' : (totals?.cgst || 0).toFixed(2),
            isInter ? '0.00' : (totals?.sgst || 0).toFixed(2),
          ];
        }));
    }
    if (cdnurBills.length > 0) {
      downloadCSV('GSTR1_CDNUR.csv',
        ['Note Number', 'Note Date', 'Note Type', 'Place of Supply', 'Note Value',
         'Taxable Value', 'IGST Amount', 'Cess Amount'],
        cdnurBills.map(bill => {
          const { client, totals } = bill.data;
          const pos = getStateCode(bill.data.details?.placeOfSupply || client?.state || '');
          return [
            bill.invoiceNumber, formatDateGST(bill.invoiceDate), 'C', pos,
            (totals?.total || 0).toFixed(2), (totals?.taxableAmount || 0).toFixed(2),
            (totals?.igst || 0).toFixed(2), '0.00',
          ];
        }));
    }
    toast(`Credit Notes exported: ${cdnrBills.length} registered + ${cdnurBills.length} unregistered`, 'success');
  };

  // Document Summary export
  const exportDocSummary = () => {
    if (Object.keys(docSummary).length === 0) { toast('No documents to export', 'warning'); return; }
    downloadCSV('GSTR1_Doc_Summary.csv',
      ['Document Type', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
      Object.entries(docSummary).map(([prefix, d]) => [d.type, d.from, d.to, d.total, 0]));
    toast('Document Summary CSV downloaded — matches GSTR-1 Table 13', 'success');
  };

  // GSTR-3B Summary export
  const exportGSTR3B = () => {
    downloadCSV('GSTR3B_Summary.csv',
      ['Description', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total'],
      [
        ['3.1(a) Outward taxable supplies', grandTotals.taxable.toFixed(2), grandTotals.igst.toFixed(2), grandTotals.cgst.toFixed(2), grandTotals.sgst.toFixed(2), (grandTotals.igst + grandTotals.cgst + grandTotals.sgst).toFixed(2)],
        ['4(A) ITC Available', '', itcFromExpenses.igst.toFixed(2), itcFromExpenses.cgst.toFixed(2), itcFromExpenses.sgst.toFixed(2), (itcFromExpenses.igst + itcFromExpenses.cgst + itcFromExpenses.sgst).toFixed(2)],
        ['6.1 Tax Payable', '', netTax.igst.toFixed(2), netTax.cgst.toFixed(2), netTax.sgst.toFixed(2), (netTax.igst + netTax.cgst + netTax.sgst).toFixed(2)],
      ]);
    toast('GSTR-3B summary CSV downloaded', 'success');
  };

  // ========== GSTR-1 JSON Export (GST Portal Offline Tool Format) ==========
  const exportGSTR1JSON = () => {
    if (filteredBills.length === 0) { toast('No invoices to export', 'warning'); return; }
    const profile = filteredBills.find(b => b.data?.profile)?.data?.profile || {};
    const gstin = profile.gstin || '';
    // Determine filing period from first bill
    const fp = filterMode === 'month'
      ? String(parseInt(monthFilter) + 1).padStart(2, '0') + yearFilter
      : getFilingPeriod(filteredBills[0]?.invoiceDate);

    // B2B — grouped by recipient GSTIN
    const b2bMap = {};
    b2bRegular.forEach(bill => {
      const { client, profile: prof, totals, items, details } = bill.data;
      const ctin = client.gstin;
      if (!b2bMap[ctin]) b2bMap[ctin] = { ctin, inv: [] };
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      // Group items by tax rate
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        rateMap[rate].txval += split.taxable;
        rateMap[rate].iamt += split.igst;
        rateMap[rate].camt += split.cgst;
        rateMap[rate].samt += split.sgst;
      });
      b2bMap[ctin].inv.push({
        inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate),
        val: round2(totals?.total || 0), pos, rchrg: 'N', inv_typ: 'R',
        itms: Object.entries(rateMap).map(([rt, d], i) => ({
          num: i + 1,
          itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: 0 },
        })),
      });
    });

    // B2C Small — aggregated by type + POS + rate
    const b2csArr = [];
    const b2csMap = {};
    b2cSmall.forEach(bill => {
      const { profile: prof, client, items, details } = bill.data;
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || prof?.state || '');
      const splyTy = isInter ? 'INTER' : 'INTRA';
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        const key = `${splyTy}_${pos}_${rate}`;
        if (!b2csMap[key]) b2csMap[key] = { sply_ty: splyTy, pos, rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        b2csMap[key].txval += split.taxable;
        b2csMap[key].iamt += split.igst;
        b2csMap[key].camt += split.cgst;
        b2csMap[key].samt += split.sgst;
      });
    });
    Object.values(b2csMap).forEach(d => {
      b2csArr.push({ ...d, txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt) });
    });

    // B2C Large — grouped by POS
    const b2clMap = {};
    b2cLarge.forEach(bill => {
      const { client, totals, items, details, profile: prof } = bill.data;
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      if (!b2clMap[pos]) b2clMap[pos] = { pos, inv: [] };
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0 };
        const split = computeItemTaxSplit(item, true);
        rateMap[rate].txval += split.taxable;
        rateMap[rate].iamt += split.igst;
      });
      b2clMap[pos].inv.push({
        inum: bill.invoiceNumber, idt: formatDateGST(bill.invoiceDate), val: round2(totals?.total || 0),
        itms: Object.entries(rateMap).map(([rt, d], i) => ({
          num: i + 1, itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), csamt: 0 },
        })),
      });
    });

    // CDNR — Credit/Debit notes to registered persons
    const cdnrMap = {};
    creditNotes.filter(b => b.data?.client?.gstin).forEach(bill => {
      const { client, profile: prof, totals, items, details } = bill.data;
      const ctin = client.gstin;
      if (!cdnrMap[ctin]) cdnrMap[ctin] = { ctin, nt: [] };
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      const pos = getStateCode(details?.placeOfSupply || client?.state || '');
      const rateMap = {};
      (items || []).forEach(item => {
        const rate = item.taxPercent || 0;
        if (!rateMap[rate]) rateMap[rate] = { txval: 0, iamt: 0, camt: 0, samt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        rateMap[rate].txval += split.taxable;
        rateMap[rate].iamt += split.igst;
        rateMap[rate].camt += split.cgst;
        rateMap[rate].samt += split.sgst;
      });
      cdnrMap[ctin].nt.push({
        ntty: 'C', nt_num: bill.invoiceNumber, nt_dt: formatDateGST(bill.invoiceDate),
        val: round2(totals?.total || 0), pos, rchrg: 'N', inv_typ: 'R',
        itms: Object.entries(rateMap).map(([rt, d], i) => ({
          num: i + 1,
          itm_det: { rt: Number(rt), txval: round2(d.txval), iamt: round2(d.iamt), camt: round2(d.camt), samt: round2(d.samt), csamt: 0 },
        })),
      });
    });

    // HSN Summary
    const hsnJsonMap = {};
    filteredBills.forEach(bill => {
      const { profile: prof, client, items } = bill.data;
      const isInter = prof?.state && client?.state && prof.state.toLowerCase() !== client.state.toLowerCase();
      (items || []).forEach(item => {
        const hsn = item.hsn || '';
        const rate = item.taxPercent || 0;
        const key = `${hsn}_${rate}`;
        if (!hsnJsonMap[key]) hsnJsonMap[key] = { hsn_sc: hsn, desc: item.name || '', uqc: 'NOS', qty: 0, rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const split = computeItemTaxSplit(item, isInter);
        hsnJsonMap[key].qty += item.quantity || 0;
        hsnJsonMap[key].txval += split.taxable;
        hsnJsonMap[key].iamt += split.igst;
        hsnJsonMap[key].camt += split.cgst;
        hsnJsonMap[key].samt += split.sgst;
      });
    });

    // Document Summary
    const docDet = Object.entries(docSummary).map(([prefix, d], i) => ({
      doc_num: i + 1,
      docs: [{ num: 1, from: d.from, to: d.to, totnum: d.total, cancel: 0, net_issue: d.total }],
    }));

    const gstr1 = {
      gstin, fp,
      b2b: Object.values(b2bMap),
      b2cs: b2csArr,
      ...(Object.keys(b2clMap).length > 0 ? { b2cl: Object.values(b2clMap) } : {}),
      ...(Object.keys(cdnrMap).length > 0 ? { cdnr: Object.values(cdnrMap) } : {}),
      hsn: { data: Object.values(hsnJsonMap).map((r, i) => ({ num: i + 1, ...r, txval: round2(r.txval), iamt: round2(r.iamt), camt: round2(r.camt), samt: round2(r.samt) })) },
      doc_issue: { doc_det: docDet },
    };

    const blob = new Blob([JSON.stringify(gstr1, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${gstin || 'export'}_${fp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`GSTR-1 JSON exported for ${fp} — upload to GST portal offline tool`, 'success');
  };

  const isNilReturn = filteredBills.length === 0 && filteredExpenses.length === 0;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">GST Reports & P&L</h1>
          <p className="page-subtitle">GSTR-1, GSTR-3B summary, HSN, Document Summary, and Profit & Loss</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Filter By</label>
            <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="fy">Fiscal Year</option>
              <option value="month">Month / Year</option>
            </select>
          </div>
          {filterMode === 'fy' ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fiscal Year</label>
              <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Month</label>
                <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={exportGSTR1JSON} title="Download GSTR-1 JSON for GST portal offline tool"><Upload size={16} /> GSTR-1 JSON</button>
          </div>
        </div>
      </div>

      {/* NIL Return Detection */}
      {isNilReturn && (
        <div className="glass-panel p-6 mb-6" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ color: '#92400e', marginBottom: '0.25rem' }}>NIL Return Period</h4>
          <p style={{ fontSize: '0.85rem', color: '#a16207' }}>
            No invoices or expenses found for this period. You should file a NIL return on the GST portal.
            Check the GST Filing Guide for step-by-step instructions.
          </p>
        </div>
      )}

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { id: 'gstr1', label: 'GSTR-1', icon: BarChart3 },
          { id: 'gstr3b', label: 'GSTR-3B', icon: FileText },
          { id: 'hsn', label: 'HSN Summary', icon: FileText },
          { id: 'docs', label: 'Documents', icon: FileText },
          { id: 'pl', label: 'P&L Report', icon: TrendingUp },
        ].map(tab => (
          <button key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* GSTR-1 Tab */}
      {activeTab === 'gstr1' && (
        <>
          {/* B2B */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header">
              <h3>B2B Sales — Table 4A (Clients with GSTIN)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>{b2bRows.length} invoice{b2bRows.length !== 1 ? 's' : ''}</span>
                {b2bRows.length > 0 && <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportB2B}><Download size={13} /> CSV</button>}
              </div>
            </div>
            {b2bRows.length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No B2B invoices for this period.</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>GSTIN</th><th>Client</th><th>Invoice No</th><th>Date</th><th>POS</th><th>Type</th>
                    <th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {b2bRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="invoice-badge">{r.gstin}</span></td>
                        <td className="font-medium">{r.clientName}</td>
                        <td>{r.invoiceNo}</td>
                        <td className="text-muted">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : ''}</td>
                        <td className="text-muted">{r.pos}</td>
                        <td><span className="type-badge">{r.supplyType}</span></td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.igst)}</td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={6}>B2B Total</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.total)}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Credit/Debit Notes */}
          {creditNotes.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
              <div className="table-header">
                <h3>Credit/Debit Notes — Table 9B</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>{creditNotes.length} note{creditNotes.length !== 1 ? 's' : ''}</span>
                  <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportCDNR}><Download size={13} /> CSV</button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>GSTIN</th><th>Client</th><th>Note No</th><th>Date</th><th>Type</th>
                    <th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>Tax</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {creditNotes.map((bill, i) => {
                      const { client, totals } = bill.data;
                      return (
                        <tr key={i}>
                          <td><span className="invoice-badge">{client?.gstin || 'Unregistered'}</span></td>
                          <td className="font-medium">{client?.name || bill.clientName}</td>
                          <td>{bill.invoiceNumber}</td>
                          <td className="text-muted">{bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN') : ''}</td>
                          <td><span className="type-badge">Credit</span></td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(totals?.taxableAmount || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency((totals?.cgst || 0) + (totals?.sgst || 0) + (totals?.igst || 0))}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(totals?.total || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B2C */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header">
              <h3>B2C Sales — Table 7 (Without GSTIN)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  {b2cBills.length} invoice{b2cBills.length !== 1 ? 's' : ''}
                  {b2cLarge.length > 0 && <> ({b2cLarge.length} B2C Large &gt;₹2.5L)</>}
                </span>
                {b2cBills.length > 0 && <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportB2C}><Download size={13} /> CSV</button>}
              </div>
            </div>
            {b2cRates.length === 0 ? (
              <div className="empty-state"><FileText size={40} /><p>No B2C invoices for this period.</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>Rate %</th><th style={{ textAlign: 'right' }}>Taxable</th>
                    <th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {b2cRates.map(rate => {
                      const d = b2cByRate[rate];
                      return (
                        <tr key={rate}>
                          <td><span className="type-badge">{rate}%</span></td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.taxable)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.cgst)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.sgst)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(d.igst)}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(d.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                    <td>B2C Total</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.total)}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Grand Summary */}
          <div className="glass-panel">
            <div className="table-header"><h3>Summary Totals</h3></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr>
                  <th>Category</th><th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td className="font-medium">B2B Sales</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2bTotals.total)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">B2C Sales</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(b2cTotals.total)}</td>
                  </tr>
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td>Grand Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.igst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.total)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* GSTR-3B Tab */}
      {activeTab === 'gstr3b' && (
        <>
          {/* Table 3.1 — Output Tax */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header">
              <h3>Table 3.1 — Outward Supplies & Tax</h3>
              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportGSTR3B}><Download size={13} /> Summary CSV</button>
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr>
                  <th>Nature of Supplies</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td className="font-medium">(a) Outward taxable supplies (other than zero-rated, nil-rated and exempted)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(grandTotals.sgst)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">(b) Outward taxable supplies (zero-rated)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">(c) Non-GST outward supplies</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0)}</td>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>N/A</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4 — ITC */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header"><h3>Table 4 — Eligible ITC (from Expenses)</h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr>
                  <th>Details</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td className="font-medium">(A) ITC Available — All other ITC</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.sgst)}</td>
                  </tr>
                  <tr className="font-bold">
                    <td>Net ITC Available</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(itcFromExpenses.sgst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="field-hint" style={{ padding: '0.75rem 1.25rem' }}>
              ITC is calculated from your Expense Tracker entries that have GST amount. Add vendor GSTIN for eligible claims.
              Verify against GSTR-2B on the GST portal for actual eligible ITC.
            </p>
          </div>

          {/* Table 6 — Tax Payment Summary */}
          <div className="glass-panel">
            <div className="table-header"><h3>Table 6 — Tax Payment Summary</h3></div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead><tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr></thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Output Tax Liability</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.igst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outputTax.sgst)}</td>
                    <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(outputTax.igst + outputTax.cgst + outputTax.sgst)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium" style={{ color: '#059669' }}>Less: ITC Claimed</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.igst)}</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.cgst)}</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.sgst)}</td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>-{formatCurrency(itcFromExpenses.igst + itcFromExpenses.cgst + itcFromExpenses.sgst)}</td>
                  </tr>
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td>Net Tax Payable</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(netTax.igst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(netTax.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(netTax.sgst)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.1rem' }}>{formatCurrency(netTax.igst + netTax.cgst + netTax.sgst)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* HSN Tab */}
      {activeTab === 'hsn' && (
        <div className="glass-panel">
          <div className="table-header">
            <h3>HSN Summary — Table 12</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>{hsnRows.length} HSN code{hsnRows.length !== 1 ? 's' : ''}</span>
              {hsnRows.length > 0 && <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportHSN}><Download size={13} /> CSV</button>}
            </div>
          </div>
          {hsnRows.length === 0 ? (
            <div className="empty-state"><FileText size={40} /><p>No items found for this period.</p></div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr>
                  <th>HSN Code</th><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th><th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>Total Tax</th>
                </tr></thead>
                <tbody>
                  {hsnRows.map((r, i) => (
                    <tr key={i}>
                      <td><span className="invoice-badge">{r.hsn}</span></td>
                      <td className="font-medium">{r.description}</td>
                      <td style={{ textAlign: 'right' }}>{r.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.igst)}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(r.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{hsnRows.reduce((s, r) => s + r.quantity, 0)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.taxable, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.cgst, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.sgst, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.igst, 0))}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(hsnRows.reduce((s, r) => s + r.totalTax, 0))}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Document Summary Tab */}
      {activeTab === 'docs' && (
        <div className="glass-panel">
          <div className="table-header">
            <h3>Document Summary — Table 13</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {Object.keys(docSummary).length > 0 && <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={exportDocSummary}><Download size={13} /> CSV</button>}
            </div>
          </div>
          {Object.keys(docSummary).length === 0 ? (
            <div className="empty-state"><FileText size={40} /><p>No documents issued in this period.</p></div>
          ) : (
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: '500px' }}>
                <thead><tr>
                  <th>Document Type</th><th>From</th><th>To</th><th style={{ textAlign: 'right' }}>Total Issued</th>
                </tr></thead>
                <tbody>
                  {Object.entries(docSummary).map(([prefix, d]) => (
                    <tr key={prefix}>
                      <td className="font-medium">{d.type}</td>
                      <td className="text-muted">{d.from}</td>
                      <td className="text-muted">{d.to}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3}>Total Documents</td>
                  <td style={{ textAlign: 'right' }}>{Object.values(docSummary).reduce((s, d) => s + d.total, 0)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L Tab */}
      {activeTab === 'pl' && (
        <>
          {/* P&L Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
              <div><p className="stat-label">Revenue (ex. tax)</p><h2 className="stat-value stat-value-green">{formatCurrency(revenueExTax)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><TrendingDown size={22} /></div>
              <div><p className="stat-label">Expenses (ex. GST)</p><h2 className="stat-value stat-value-purple">{formatCurrency(expenseExGST)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <p className="stat-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
                <h2 className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(Math.abs(netProfit))}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><BarChart3 size={22} /></div>
              <div><p className="stat-label">Margin</p><h2 className="stat-value">{revenueExTax > 0 ? Math.round((netProfit / revenueExTax) * 100) : 0}%</h2></div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header"><h3>Profit & Loss Statement</h3></div>
            <div style={{ padding: '1.5rem' }}>
              <table style={{ width: '100%', maxWidth: '500px', margin: '0 auto', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalRevenue)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST Collected</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(totalTaxCollected)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(revenueExTax)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalExpenseAmount)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST on Expenses (ITC)</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#059669' }}>-{formatCurrency(totalExpenseGST)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(expenseExGST)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '1rem 0', fontWeight: 800, fontSize: '1.1rem' }}>
                      Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                    </td>
                    <td style={{
                      padding: '1rem 0', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem',
                      color: netProfit >= 0 ? '#059669' : '#dc2626',
                    }}>
                      {formatCurrency(Math.abs(netProfit))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {monthlyKeys.length > 0 && (
            <div className="glass-panel">
              <div className="table-header"><h3>Monthly Breakdown</h3></div>
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead><tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>Profit/Loss</th>
                  </tr></thead>
                  <tbody>
                    {monthlyKeys.map(key => {
                      const m = monthlyPL[key];
                      const rev = m.revenue - m.tax;
                      const exp = m.expense - m.expGst;
                      const pl = rev - exp;
                      const [y, mo] = key.split('-');
                      return (
                        <tr key={key}>
                          <td className="font-medium">{MONTHS[parseInt(mo) - 1]} {y}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(rev)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(exp)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: pl >= 0 ? '#059669' : '#dc2626' }}>
                            {formatCurrency(Math.abs(pl))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
