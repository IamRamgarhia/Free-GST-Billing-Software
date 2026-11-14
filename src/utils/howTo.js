// v1.10.86 - "How do I…" answers for the quick search (Ctrl+K), asked for on
// 15 Nov: questions people really ask, each with where it is done in the app
// (`go`) and the part of the online guide that explains it (`doc`, as
// HelpButton's doc="page#section").
//
// go: { view } opens a screen (App's currentView ids);
//     { section } opens Settings at that section (SettingsView's section ids);
//     { find } then scrolls to and highlights the first visible title, label
//       or button that starts with that text; { click } clicks it (tabs and
//       buttons that only open a window - never one that changes data);
//     { action } runs an App action ('new-invoice', 'customise-menu',
//       'dark-mode', 'shortcuts').
// k: extra words people type, Hindi / Hinglish included.
// pop: shown when the search box is empty.
// scripts/howto-test.mjs checks every view, section, text and guide link.

export const VIEW_LABELS = {
  dashboard: 'Dashboard', new: 'New Invoice', clients: 'Clients', inventory: 'Products',
  expenses: 'Expenses', purchases: 'Purchases', recurring: 'Recurring', receipts: 'Receipts',
  cashbook: 'Cash book', reports: 'Reports', filing: 'GST Returns', incometax: 'Income Tax',
  settings: 'Settings', support: 'Support & About',
};

export const SECTION_LABELS = {
  'section-biztype': 'Business type', 'section-company': 'Company details', 'section-profiles': 'Business profiles',
  'section-terms': 'Terms & Conditions', 'section-print': 'Print & PDF', 'section-region': 'Region',
  'section-modules': 'Features', 'section-costcentres': 'Cost centres', 'section-stock': 'Low-stock alerts',
  'section-lock': 'App lock (PIN)', 'section-phone': 'Phone access', 'section-privacy': 'Privacy & internet',
  'section-backups': 'Backups', 'section-books': 'Close the books', 'section-cloud': 'Google Drive backup',
  'section-data': 'Data management', 'section-appearance': 'Appearance', 'section-updates': 'App & updates',
  // v1.10.86 - the Control Panel's cards, now in Settings.
  'section-app': 'Restart, stop or remove the app', 'section-backupzip': 'Backup files (ZIP)',
};

const ACTION_LABELS = {
  'new-invoice': 'New Invoice', 'customise-menu': 'Customise menu', 'dark-mode': 'Dark mode', shortcuts: 'Keyboard shortcuts',
};

const S = (section, find, more) => ({ view: 'settings', section, ...(find ? { find } : {}), ...more });
const NEW = (find) => ({ view: 'new', action: 'new-invoice', ...(find ? { find } : {}) });

export const HOW_TO = [
  // ---- Sales ----
  { q: 'How do I make an invoice?', k: 'new bill create sale tax invoice bill kaise banaye banana banao naya', go: NEW(), doc: 'first-invoice#walkthrough', pop: true },
  { q: 'How do I make a credit note?', k: 'return refund sales return goods back maal wapas cn', go: NEW('Document type'), doc: 'invoices#credit-note', pop: true },
  { q: 'How do I make a quotation or estimate?', k: 'quote proforma estimate offer rate list', go: NEW('Document type'), doc: 'invoices#invoice-types' },
  { q: 'How do I turn a quotation into an invoice?', k: 'convert quote proforma to invoice', go: { view: 'dashboard', find: 'Invoices' }, doc: 'invoices#proforma-to-invoice' },
  { q: 'How do I make a delivery challan?', k: 'challan dispatch delivery note dc', go: NEW('Document type'), doc: 'invoices#invoice-types' },
  { q: 'How do I take a sales order?', k: 'order booking advance order sales order', go: NEW('Document type'), doc: 'invoices#sales-orders' },
  { q: 'How do I record a part payment?', k: 'partial payment received paid some amount jama advance installment kisht', go: { view: 'dashboard', find: 'Invoices' }, doc: 'dashboard#payments', pop: true },
  { q: 'How do I make a payment receipt?', k: 'receipt voucher money received parchi raseed rasid', go: { view: 'receipts' }, doc: 'receipts#new-receipt' },
  { q: 'How do I send an invoice on WhatsApp?', k: 'whatsapp share send pdf message bhejna bheje', go: { view: 'dashboard', find: 'Invoices' }, doc: 'dashboard#share', pop: true },
  { q: 'How do I send payment reminders?', k: 'remind overdue due tagada yaad dilana follow up', go: { view: 'dashboard' }, doc: 'dashboard#remind-all' },
  { q: 'How do I see who owes me money?', k: 'outstanding due udhaar udhar baki bakaya receivable pending payment credit khata', go: { view: 'reports', click: 'Outstanding & Aging' }, doc: 'reports#outstanding' },
  { q: 'How do I send a statement to a client?', k: 'statement ledger account khata hisaab ageing aging pdf', go: { view: 'clients' }, doc: 'clients#statement' },
  { q: 'How do I set up a recurring invoice?', k: 'repeat monthly rent subscription every month automatic', go: { view: 'recurring' }, doc: 'recurring#two-ways' },
  { q: 'How do I cancel an invoice?', k: 'cancel void delete invoice galat bill', go: { view: 'dashboard', find: 'Invoices' }, doc: 'dashboard#cancel' },
  { q: 'How do I get a deleted invoice back?', k: 'trash restore undo deleted recycle bin wapas', go: S('section-backups', 'Trash bin'), doc: 'backup#trash' },
  { q: 'How do I give a discount before GST?', k: 'discount less chhoot chhut kam off percent', go: NEW('Line Items'), doc: 'invoices#discounts' },
  { q: 'How do I bill prices that already include GST?', k: 'inclusive mrp counter price with tax incl', go: NEW('Line Items'), doc: 'invoices#tax-inclusive' },
  { q: 'How do I add delivery or transport charges?', k: 'freight shipping transport courier packing kiraya bhada', go: NEW(), doc: 'invoices#delivery-charges' },
  { q: 'How do I add a different shipping address?', k: 'ship to delivery address consignee', go: NEW(), doc: 'invoices#ship-to' },
  { q: 'How do I scan a barcode on an invoice?', k: 'barcode scanner scan qr code', go: NEW(), doc: 'products#barcode-scan' },
  { q: 'How do I show an MRP column?', k: 'mrp maximum retail price column', go: NEW(), doc: 'invoice-options#show-items' },
  { q: 'How do I bill in dollars or another currency?', k: 'export foreign usd dollar euro currency abroad', go: NEW(), doc: 'invoices#currency' },
  { q: 'How do I apply reverse charge?', k: 'rcm reverse charge', go: NEW(), doc: 'invoices#reverse-charge' },
  { q: 'How do I add TDS or TCS on an invoice?', k: 'tds tcs tax deducted collected at source', go: NEW(), doc: 'invoices#tds-tcs' },
  { q: 'How do I make an e-way bill?', k: 'eway ewaybill e way transport goods 50000', go: NEW(), doc: 'invoices#eway-bill' },
  { q: 'How do I make an e-invoice (IRN)?', k: 'einvoice irn e invoicing qr 5 crore', go: { view: 'dashboard' }, doc: 'dashboard#einvoice' },
  { q: 'How do I bill by size (glass, flex)?', k: 'size sqft square feet glass mirror flex length width', go: NEW(), doc: 'invoices#size-billing' },
  { q: 'How do I print many invoices at once?', k: 'bulk print multiple quick print one pdf', go: { view: 'dashboard', find: 'Invoices' }, doc: 'dashboard#quick-print' },
  { q: 'How do I print on a thermal printer?', k: 'thermal receipt 80mm 58mm pos printer slip parchi', go: S('section-print', 'Thermal'), doc: 'thermal-printing#setup', pop: true },

  // ---- Buying ----
  { q: 'How do I enter a purchase bill?', k: 'purchase buy supplier bill kharid kharidi maal liya', go: { view: 'purchases' }, doc: 'purchases#add-purchase' },
  { q: 'How do I return goods to a supplier?', k: 'debit note purchase return maal wapas supplier return', go: { view: 'purchases' }, doc: 'purchases#purchase-returns' },
  { q: 'How do I record a payment to a supplier?', k: 'pay supplier vendor payment paid', go: { view: 'purchases' }, doc: 'purchases#record-payment' },
  { q: 'How do I read a bill from a photo?', k: 'ocr photo scan camera picture bill', go: { view: 'purchases' }, doc: 'purchases#ocr' },
  { q: 'How do I make a purchase order?', k: 'po purchase order supplier order', go: { view: 'purchases' }, doc: 'purchases#purchase-orders' },
  { q: 'How do I add an expense?', k: 'expense kharcha kharch rent salary bill electricity', go: { view: 'expenses' }, doc: 'expenses#add-expense' },

  // ---- Clients, products, stock ----
  { q: 'How do I add a client?', k: 'customer party buyer naya grahak', go: { view: 'clients' }, doc: 'clients#client-form' },
  { q: 'How do I add a product?', k: 'item product service maal saman', go: { view: 'inventory' }, doc: 'products#add-product' },
  { q: 'How do I add MRP to a product?', k: 'mrp maximum retail price product', go: { view: 'inventory' }, doc: 'products#add-product' },
  { q: 'How do I sell in boxes (Box = 12 Pcs)?', k: 'unit units box pcs carton dozen alternate second unit', go: { view: 'inventory' }, doc: 'products#alternate-units' },
  { q: 'How do I use categories and brands?', k: 'category categories brand group', go: { view: 'inventory' }, doc: 'products#categories' },
  { q: 'How do I set different prices for wholesale and retail?', k: 'price levels wholesale dealer retail rate list daam keemat', go: S('section-modules', 'Price levels'), doc: 'settings#price-levels' },
  { q: 'How do I correct the stock?', k: 'stock adjust damaged lost found godown inventory', go: { view: 'inventory' }, doc: 'products#stock-adjust' },
  { q: 'How do I get low-stock alerts?', k: 'low stock alert reorder minimum', go: S('section-stock'), doc: 'settings#stock' },
  { q: 'How do I print barcode labels?', k: 'barcode label sticker print', go: { view: 'inventory' }, doc: 'products#barcode-labels' },
  { q: 'How do I record manufacturing?', k: 'manufacturing production raw material bill of materials bom', go: { view: 'inventory' }, doc: 'products#manufacturing' },
  { q: 'How do I import from Tally, Vyapar or Excel?', k: 'import tally vyapar excel xlsx csv spreadsheet migrate move data', go: { view: 'clients' }, doc: 'clients#import-csv', pop: true },
  { q: 'How do I import products from Excel?', k: 'import products excel csv spreadsheet items', go: { view: 'inventory' }, doc: 'products#import' },
  { q: 'How do I import old invoices?', k: 'import invoices sales csv excel vyapar old', go: { view: 'dashboard' }, doc: 'dashboard#csv' },

  // ---- Money ----
  { q: 'How do I keep a cash book?', k: 'cash book rokad galla cash in hand bahi', go: { view: 'cashbook' }, doc: 'cash-book#add-entry' },
  { q: 'How do I match my bank statement?', k: 'bank matching reconcile statement passbook', go: { view: 'cashbook', click: 'Bank matching' }, doc: 'cash-book#bank-matching' },
  { q: 'How do I see my profit?', k: 'profit loss p&l munafa fayda kamai', go: { view: 'reports' }, doc: 'reports#profit-loss' },
  { q: 'How do I see the stock report?', k: 'stock report inventory value', go: { view: 'reports', click: 'Stock' }, doc: 'reports#stock' },

  // ---- GST ----
  { q: 'How do I file GSTR-1?', k: 'gstr1 gstr 1 return json upload portal file', go: { view: 'filing' }, doc: 'gst-returns#gstr-1-files', pop: true },
  { q: 'How do I see GSTR-3B?', k: 'gstr3b 3b tax payable return', go: { view: 'filing', click: 'GSTR-3B' }, doc: 'gst-returns#gstr-3b' },
  { q: 'How do I check my credit against GSTR-2B?', k: 'gstr2b 2b itc reconcile match input credit', go: { view: 'filing' }, doc: 'gst-returns#gstr-2b' },
  { q: 'How do I file a NIL return?', k: 'nil return zero no sales', go: { view: 'filing', click: 'Filing Guide' }, doc: 'gst-returns#nil-return' },
  { q: 'How do I export without paying IGST (LUT)?', k: 'lut export sez letter of undertaking igst', go: S('section-company', 'LUT'), doc: 'settings#lut' },
  { q: 'How do I find the HSN code?', k: 'hsn sac code find search', go: { view: 'inventory' }, doc: 'gst-basics#hsn-sac' },
  { q: 'How do I see TDS and TCS?', k: 'tds tcs report 26as deducted', go: { view: 'reports', click: 'TDS & TCS' }, doc: 'reports#tds-tcs' },
  { q: 'How do I close the books after filing?', k: 'close books lock period month filed freeze', go: S('section-books', 'Close the books'), doc: 'backup#close-books' },
  { q: 'How do I work out income tax?', k: 'income tax itr regime 44ad presumptive advance tax', go: { view: 'incometax' }, doc: 'income-tax#regime-calculator' },

  // ---- Your business and invoice look ----
  { q: 'How do I add my logo?', k: 'logo branding signature stamp seal picture image', go: S('section-company', 'Branding'), doc: 'settings#branding', pop: true },
  { q: 'How do I change the invoice number?', k: 'invoice number prefix series start numbering format sequence', go: S('section-company', 'Invoice Number Format'), doc: 'settings#invoice-numbers', pop: true },
  { q: 'How do I add my bank details and UPI?', k: 'bank account upi qr ifsc payment details', go: S('section-company', 'Payment Accounts'), doc: 'settings#payment-accounts' },
  { q: 'How do I change my GSTIN or address?', k: 'gstin address company details business name phone pan', go: S('section-company', 'Company Details'), doc: 'settings#company-details' },
  { q: 'How do I change my business type?', k: 'business type shop kirana restaurant services trader', go: S('section-biztype'), doc: 'settings#business-type' },
  { q: 'How do I add a second business?', k: 'second business another company firm multiple profiles dusri dukaan', go: S('section-profiles'), doc: 'settings#multiple-businesses' },
  { q: 'How do I change my terms and conditions?', k: 'terms conditions notes footer', go: S('section-terms'), doc: 'settings#terms' },
  { q: 'How do I change the invoice design?', k: 'design template style look layout colour tally style', go: S('section-print'), doc: 'print-settings#template' },
  { q: 'How do I print invoice words in Hindi?', k: 'hindi language labels section labels', go: S('section-print'), doc: 'print-settings#labels-language' },
  { q: 'How do I print on A5 or another paper size?', k: 'paper size a5 a4 letter half page', go: NEW(), doc: 'invoice-options#paper-size' },
  { q: 'How do I turn features on or off?', k: 'features modules enable disable hide show', go: S('section-modules'), doc: 'settings#features' },
  { q: 'How do I customise the menu?', k: 'menu sidebar arrange reorder hide show', go: { action: 'customise-menu' }, doc: 'settings#features-menu' },
  { q: 'How do I customise the Dashboard?', k: 'dashboard customise hide cards arrange', go: { view: 'dashboard', click: 'Customise' }, doc: 'dashboard#customise' },
  { q: 'How do I change the app colour or text size?', k: 'colour color theme text size font bigger zoom compact', go: S('section-appearance'), doc: 'settings#appearance' },
  { q: 'How do I switch on dark mode?', k: 'dark mode night black theme', go: { action: 'dark-mode' }, doc: 'shortcuts#dark-mode' },

  // ---- Safety, phone, updates ----
  { q: 'How do I back up my data?', k: 'backup back up save copy data safe', go: S('section-backups'), doc: 'backup#automatic-backups', pop: true },
  { q: 'How do I back up to Google Drive?', k: 'google drive cloud backup online', go: S('section-cloud'), doc: 'settings#google-drive' },
  { q: 'How do I restore a backup?', k: 'restore backup import data bring back', go: S('section-data'), doc: 'backup#restore-from-backup' },
  { q: 'How do I move to a new computer?', k: 'new pc computer laptop move transfer shift', go: S('section-backupzip'), doc: 'backup#move-pc' },
  { q: 'How do I set a PIN lock?', k: 'pin password lock security', go: S('section-lock'), doc: 'settings#lock' },
  { q: 'How do I reset my PIN?', k: 'forgot pin reset password remove lock bhool gaya', go: S('section-lock'), doc: 'troubleshooting#pin-forgotten' },
  { q: 'How do I pair my phone?', k: 'phone mobile tablet pair qr wifi android iphone', go: S('section-phone', 'Pair a phone or tablet'), doc: 'phone#pair', pop: true },
  { q: 'How do I keep the app offline?', k: 'offline mode internet privacy no internet', go: S('section-privacy'), doc: 'security#offline-mode' },
  { q: 'How do I update the app?', k: 'update upgrade new version latest', go: S('section-updates'), doc: 'update#in-app' },
  { q: 'How do I report a problem?', k: 'problem error bug issue report help support', go: { view: 'support' }, doc: 'troubleshooting#report-problem' },
  { q: 'How do I see the keyboard shortcuts?', k: 'keyboard shortcuts keys ctrl', go: { action: 'shortcuts' }, doc: 'shortcuts#keyboard' },
];

// Where "Take me there" goes, in words ("Settings → Branding").
export const whereLabel = (go = {}) => {
  if (go.view === 'settings') return ['Settings', go.find || SECTION_LABELS[go.section]].filter(Boolean).join(' → ');
  if (go.view) return [VIEW_LABELS[go.view], go.click || go.find].filter(Boolean).join(' → ');
  return ACTION_LABELS[go.action] || '';
};

// ---- matching -------------------------------------------------------------
// Words that say nothing about the subject, English and Hinglish.
const STOP = new Set(('how do does i to a an the my me we our can is are what where which when why of in on for with and or '
  + 'it this that be use using add make get set see do kaise kaisa kese kare karen karu karna kya hai hain mein me ka ki ke ko se par '
  + 'aur ya please pls').split(' '));
export const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
const queryWords = (q) => { const all = words(q); const kept = all.filter((w) => !STOP.has(w)); return kept.length ? kept : all; };

// One letter wrong, missing or extra (only for words of 4+ letters).
const nearly = (a, b) => {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4 || b.length < 4) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
const wordScore = (qw, list) => {
  if (list.includes(qw)) return 3;
  if (qw.length >= 2 && list.some((w) => w.startsWith(qw))) return 2;
  return list.some((w) => nearly(qw, w)) ? 1 : 0;
};

// Score `text` (+ extra keywords) for the query: 0 = no match. At least half
// the meaningful words must match; the question's own words count a bit more.
export const scoreText = (query, text, keywords = '') => {
  const qs = queryWords(query);
  if (!qs.length) return 0;
  const own = words(text), extra = words(keywords);
  let score = 0, hits = 0;
  for (const qw of qs) {
    const s = Math.max(wordScore(qw, own) * 1.2, wordScore(qw, extra));
    if (s) { hits++; score += s; }
  }
  return hits * 2 >= qs.length ? score + hits * 2 : 0;
};

// The best "How do I…" rows for a query; the popular ones for an empty query.
export const matchHowTo = (query, limit = 6, list = HOW_TO) => {
  if (!String(query || '').trim()) return list.filter((h) => h.pop).slice(0, 5);
  // A popular question wins a tie ("backup": back up, before restore).
  return list.map((h) => ({ h, s: scoreText(query, h.q, h.k) }))
    .filter((x) => x.s > 0).map((x) => (x.h.pop ? { ...x, s: x.s + 1 } : x)).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.h);
};

// The help index (src/utils/helpIndex.json): ["page", name] and
// ["page#section", title]. Sections show their page's name.
export const matchHelp = (query, index, limit = 6) => {
  if (!String(query || '').trim()) return [];
  const pageName = new Map(index.filter(([d]) => !d.includes('#')));
  return index.map(([d, title]) => {
    const page = pageName.get(d.split('#')[0]) || '';
    return { doc: d, title, page: d.includes('#') ? page : '', s: scoreText(query, title, page) };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit);
};
