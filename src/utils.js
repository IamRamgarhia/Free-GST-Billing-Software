export const numberToWords = (num) => {
  if (num === 0) return 'Zero Rupees Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertToWords = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  const getIndianFormatString = (n) => {
    let res = '';
    const crore = Math.floor(n / 10000000);
    n -= crore * 10000000;
    const lakh = Math.floor(n / 100000);
    n -= lakh * 100000;
    const thousand = Math.floor(n / 1000);
    n -= thousand * 1000;
    const hundred = Math.floor(n / 100);
    n -= hundred * 100;

    if (crore > 0) res += convertToWords(crore) + ' Crore ';
    if (lakh > 0) res += convertToWords(lakh) + ' Lakh ';
    if (thousand > 0) res += convertToWords(thousand) + ' Thousand ';
    if (hundred > 0) res += convertToWords(hundred) + ' Hundred ';
    if (n > 0) res += (res !== '' ? 'and ' : '') + convertToWords(n);
    return res.trim();
  };

  const roundedNum = Math.round(num * 100) / 100;
  const rupees = Math.floor(roundedNum);
  const paise = Math.round((roundedNum - rupees) * 100);

  let result = getIndianFormatString(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + getIndianFormatString(paise) + ' Paise';
  }
  return result + ' Only';
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

export const calculateLineItemTax = (item) => {
  const amount = item.quantity * item.rate;
  const discount = item.discount || 0;
  const afterDiscount = amount - discount;
  const taxAmount = (afterDiscount * (item.taxPercent || 0)) / 100;
  return {
    amount,
    discount,
    afterDiscount,
    taxAmount,
    total: afterDiscount + taxAmount
  };
};

// Invoice type configuration
export const INVOICE_TYPES = {
  'tax-invoice': {
    label: 'Tax Invoice',
    prefix: 'INV',
    title: 'TAX INVOICE',
    showGST: true,
    description: 'Standard GST tax invoice',
  },
  'proforma': {
    label: 'Proforma / Estimate',
    prefix: 'EST',
    title: 'PROFORMA INVOICE',
    showGST: true,
    description: 'Quotation or estimate — not a legal tax document',
  },
  'bill-of-supply': {
    label: 'Bill of Supply (No GST)',
    prefix: 'BOS',
    title: 'BILL OF SUPPLY',
    showGST: false,
    description: 'For exempt goods/services or composition dealers',
  },
  'credit-note': {
    label: 'Credit Note',
    prefix: 'CN',
    title: 'CREDIT NOTE',
    showGST: true,
    description: 'Issued for returns, price adjustments, or corrections',
  },
  'delivery-challan': {
    label: 'Delivery Challan',
    prefix: 'DC',
    title: 'DELIVERY CHALLAN',
    showGST: false,
    description: 'For goods transport, job work, or supply on approval — not a tax document',
  },
};

// Indian states list for dropdowns
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// GST State Codes (as per GST portal) — used in GSTR-1 JSON export
export const GST_STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
  'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06',
  'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12',
  'nagaland': '13', 'manipur': '14', 'mizoram': '15',
  'tripura': '16', 'meghalaya': '17', 'assam': '18',
  'west bengal': '19', 'jharkhand': '20', 'odisha': '21',
  'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'andhra pradesh': '37', 'karnataka': '29', 'goa': '30',
  'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35',
  'telangana': '36', 'ladakh': '38',
};

// Get 2-digit GST state code from state name or GSTIN
export const getStateCode = (stateOrGstin) => {
  if (!stateOrGstin) return '';
  const s = stateOrGstin.trim();
  // If it looks like a GSTIN (15 chars), extract first 2 digits
  if (/^\d{2}[A-Z0-9]{13}$/i.test(s)) return s.substring(0, 2);
  return GST_STATE_CODES[s.toLowerCase()] || '';
};

// Format date as DD-MM-YYYY (GST portal format)
export const formatDateGST = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Generate E-Way Bill JSON (NIC portal format)
export const generateEWayBillJSON = (profile, client, details, items, totals, invoiceType) => {
  const supplyType = profile.state === client.state ? 'O' : 'I'; // O=Outward Intrastate, I=Outward Interstate
  const fromStateCode = getStateCode(profile.state || profile.gstin);
  const toStateCode = getStateCode(client.state || client.gstin);

  const itemList = items.map((item, idx) => {
    const taxable = (item.quantity * item.rate) - (item.discount || 0);
    const taxRate = item.taxPercent || 0;
    const isInter = supplyType === 'I';
    return {
      itemNo: idx + 1,
      productName: item.name || '',
      productDesc: item.name || '',
      hsnCode: Number(item.hsn) || 0,
      quantity: item.quantity || 0,
      qtyUnit: 'NOS',
      taxableAmount: Math.round(taxable * 100) / 100,
      cgstRate: isInter ? 0 : taxRate / 2,
      sgstRate: isInter ? 0 : taxRate / 2,
      igstRate: isInter ? taxRate : 0,
      cessRate: 0,
    };
  });

  return {
    version: '1.0.1221',
    billLists: [{
      userGstin: profile.gstin || '',
      supplyType: supplyType,
      subSupplyType: 1, // 1=Supply
      docType: invoiceType === 'delivery-challan' ? 'CHL' : 'INV',
      docNo: details.invoiceNumber || '',
      docDate: formatDateGST(details.invoiceDate),
      fromGstin: profile.gstin || '',
      fromAddr1: (profile.address || '').substring(0, 120),
      fromPlace: profile.state || '',
      fromPincode: 0,
      fromStateCode: Number(fromStateCode) || 0,
      toGstin: client.gstin || 'URP',
      toAddr1: (client.address || '').substring(0, 120),
      toPlace: client.state || '',
      toPincode: 0,
      toStateCode: Number(toStateCode) || 0,
      totalValue: Math.round((totals.subtotal - totals.totalDiscount) * 100) / 100,
      cgstValue: Math.round(totals.cgst * 100) / 100,
      sgstValue: Math.round(totals.sgst * 100) / 100,
      igstValue: Math.round(totals.igst * 100) / 100,
      cessValue: 0,
      totInvValue: Math.round(totals.total * 100) / 100,
      transMode: 1, // 1=Road
      transDistance: 0,
      transporterName: '',
      transporterId: '',
      transDocNo: '',
      transDocDate: '',
      vehicleNo: '',
      vehicleType: 'R', // R=Regular
      itemList: itemList,
    }]
  };
};

// Get filing period as MMYYYY from a date range
export const getFilingPeriod = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${mm}${d.getFullYear()}`;
};
