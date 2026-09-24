const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;

export default [
// =============================================================================
{
  slug: 'invoices',
  title: 'Making an invoice',
  nav: 'Making an invoice',
  lead: 'Every part of the New Invoice screen, from top to bottom: the toolbar, the document type, the client, the items, terms, extra pages, and what happens when you save, print or share.',
  body: `
<section id="screen-layout">
<h2>How the screen is laid out</h2>
<p>Open it with ${ui('New Invoice')} in the sidebar, or <kbd>Ctrl</kbd> + <kbd>N</kbd>. The form is on the left and a live preview of the printed invoice is on the right. From top to bottom, the form has these cards:</p>
<ol>
  <li><b>Invoice Type</b>, with the ${ui('Customize')} panel when it is open</li>
  <li><b>Billed To</b>: the client</li>
  <li><b>Invoice Details</b>: number, dates, place of supply and delivery address</li>
  <li><b>Line Items</b></li>
  <li><b>Terms &amp; Conditions</b>, notes and a private note</li>
  <li><b>Additional Pages / Sections</b></li>
</ol>
<p>The totals are not in the form. They are worked out as you type and shown in the preview.</p>
<figure><img src="assets/img/app-invoice-editor.png" alt="The invoice screen: the form on the left, the live preview on the right." loading="lazy"><figcaption>The invoice screen: the form on the left, the live preview on the right.</figcaption></figure>
</section>

<section id="toolbar">
<h2>The toolbar</h2>
<p>The toolbar stays at the top of the screen as you scroll.</p>
<figure><img src="${img('toolbar.png')}" alt="The invoice toolbar: Save, Save and Download, Print, WhatsApp, E-Way Bill, Customize, Hide Preview"></figure>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('←')} Back</td><td>Leaves the invoice. If you have changed something that is not saved, you are asked first (see <a href="#leaving">Leaving with unsaved changes</a>).</td></tr>
  <tr><td>${ui('?')}</td><td>A short how-to for this screen.</td></tr>
  <tr><td>Save status</td><td>Shows <b>Draft - click to complete</b> until the invoice has a client and an item (click it to jump to what is missing), then <b>Not saved yet</b> until you first save it, then <b>Saving…</b>, <b>All changes saved</b> or <b>Ready</b>.</td></tr>
  <tr><td>${ui('Save')}</td><td>Saves the invoice without making a PDF. <kbd>Ctrl</kbd> + <kbd>S</kbd> does the same.</td></tr>
  <tr><td>${ui('Save &amp; Download')}</td><td>Saves the invoice and downloads the PDF. See <a href="#save-download">Save &amp; Download</a>.</td></tr>
  <tr><td>${ui('Print')}</td><td>Saves the invoice, then prints it. See <a href="#print">Printing</a>.</td></tr>
  <tr><td>${ui('WhatsApp')}</td><td>Opens WhatsApp with the invoice details typed in. See <a href="#whatsapp">Sending on WhatsApp</a>.</td></tr>
  <tr><td>${ui('E-Way Bill')}</td><td>Tax invoices and delivery challans only. Downloads the e-way bill file. See <a href="#eway-bill">E-way bill</a>.</td></tr>
  <tr><td>${ui('Customize')}</td><td>Opens the panel that controls what prints, the paper size, currency and more. See <a href="invoice-options.html">Customize: what prints and how</a>.</td></tr>
  <tr><td>${ui('Hide Preview')}</td><td>Hides the preview so the form uses the whole width, handy for long invoices. ${ui('Show Preview')} brings it back, and the app remembers your choice.</td></tr>
</table></div>
</section>

<section id="invoice-types">
<h2>Choosing the document type</h2>
<p>The six chips at the top decide the printed title, whether GST is charged, and whether the document counts as a sale in your totals and returns.</p>
<div class="table-wrap"><table>
  <tr><th>Type</th><th>Prints as</th><th>Use it for</th><th>GST</th><th>Counts as a sale?</th></tr>
  <tr><td>Tax Invoice</td><td>TAX INVOICE</td><td>A normal sale by a GST-registered business</td><td>Yes</td><td>Yes</td></tr>
  <tr><td>Proforma / Estimate</td><td>PROFORMA INVOICE</td><td>A quote before the sale. Prints "This is not a tax invoice" and a faint ESTIMATE watermark.</td><td>Shown</td><td>No</td></tr>
  <tr><td>Bill of Supply (No GST)</td><td>BILL OF SUPPLY</td><td>Exempt goods or services</td><td>No</td><td>Yes</td></tr>
  <tr><td>Composition (Bill of Supply)</td><td>BILL OF SUPPLY</td><td>Sales under the composition scheme. The declaration required by Rule 46A prints automatically.</td><td>No</td><td>Yes</td></tr>
  <tr><td>Credit Note</td><td>CREDIT NOTE</td><td>Returns, a price cut after the sale, or a correction. Its total is subtracted from your sales.</td><td>Yes</td><td>Subtracted</td></tr>
  <tr><td>Delivery Challan</td><td>DELIVERY CHALLAN</td><td>Moving goods without a sale, such as to a job worker or on approval</td><td>No</td><td>No</td></tr>
</table></div>
<p>Changing the type also changes the invoice number to that type's series, replacing any number you typed.</p>
<p><strong>Once an invoice is saved, its type is locked.</strong> The other chips are greyed out, because the number and the tax already issued to your client must not change. To make a different document from it, use ${ui('Duplicate')} on the Dashboard.</p>
</section>

<section id="goods-services">
<h2>Goods, services or both</h2>
<p>Under the type chips, <b>This invoice is for</b> sets which units you are offered:</p>
<table>
  <tr><td>📦 Goods</td><td>Units such as Nos, Kg and Pcs. The default.</td></tr>
  <tr><td>⏱ Services</td><td>Hours, sessions, visits and months. It also reminds you to put a SAC code in the HSN field.</td></tr>
  <tr><td>🔀 Mixed</td><td>Every unit, unfiltered.</td></tr>
</table>
</section>

<section id="client">
<h2>Billed To: the client</h2>
<ol class="steps">
  <li><strong>Type the name</strong>Clicking <b>Client Name</b> lists your saved clients. As you type, the list narrows. Use <kbd>↓</kbd> <kbd>↑</kbd> and <kbd>Enter</kbd>, or click one. Picking a saved client fills in all their details.</li>
  <li><strong>Or save a new one</strong>For someone new, type their name and fill in the fields, then click <b>Save "name" as new client</b> to keep them for next time. You do not have to: an invoice can go to a name that is not saved.</li>
  <li><strong>Check the address and GSTIN</strong>Address, country, city, PIN, state and GSTIN print on the invoice.</li>
</ol>
<p>A saved client's pencil icon opens their details for editing. Their email, phone and <b>SEZ</b> setting are only edited there, not on the invoice: see <a href="clients.html#client-form">Adding and editing a client</a>. A client can also have a preferred paper size, currency and auto-print setting, which are applied when you pick them on a new invoice.</p>
<p>Changing the <b>country</b> clears the state, since each country has its own list.</p>
</section>

<section id="gstin-check">
<h2>What the GSTIN check tells you</h2>
<p>When you leave the GSTIN box, the app reads the number. This works offline, with no GST portal lookup.</p>
<table>
  <tr><th>Message</th><th>Meaning</th></tr>
  <tr><td>✓ Registered in <i>state</i>. State filled in.</td><td>The state was blank, so it has been filled in from the first two digits.</td></tr>
  <tr><td>✓ Registered in <i>state</i>.</td><td>The GSTIN and the state agree.</td></tr>
  <tr><td>⚠ This GSTIN is registered in <i>state</i>, but the state says <i>other state</i>.</td><td>Check which is right. The tax split follows the state and place of supply.</td></tr>
  <tr><td>⚠ This GSTIN fails its own checksum. Check for a typo.</td><td>Every GSTIN ends with a check character. This one does not add up, so a character is almost certainly mistyped.</td></tr>
</table>
<p>These are warnings only. They never stop you saving.</p>
</section>

<section id="client-credit">
<h2>Using a client's credit</h2>
<p>If the client overpaid on earlier invoices, a banner shows how much credit they have and where it came from. On a new invoice you can:</p>
<ul>
  <li>type an amount to use, or click ${ui('Apply full')} to use as much as this invoice needs;</li>
  <li>click ${ui('Skip')} to use none;</li>
  <li>tick <b>Auto-apply available client credit on future invoices</b> to have it used automatically.</li>
</ul>
<p>When you save, the credit is recorded as a payment on this invoice.</p>
</section>

<section id="details">
<h2>Invoice Details</h2>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Invoice Number</td><td>Filled in with the next number for this type. It is only taken when you first save, so an invoice you abandon does not use up a number. If someone else's invoice took it meanwhile, yours gets the next free number and you are told. See <a href="settings.html#invoice-numbers">Invoice number format</a>.</td></tr>
  <tr><td>Invoice Date</td><td>Today, unless you change it.</td></tr>
  <tr><td>Due Date</td><td>Blank unless you set it. Once it passes, an unpaid invoice becomes <b>Overdue</b>.</td></tr>
  <tr><td>Place of Supply</td><td>Where the goods or services are supplied. Leave it on <b>Defaults to Client State</b> unless the delivery is in a different state from the client's address. The tax split follows it. Not shown for bills of supply, composition bills or delivery challans.</td></tr>
  <tr><td>Original Invoice Reference</td><td>Credit notes only: the invoice it is against, such as INV/2026-27/0001. It prints as "Against Invoice".</td></tr>
  <tr><td>Ship to same as bill-to address</td><td>Ticked by default. Untick it to enter a delivery address, city, PIN and state. The invoice then prints a separate <b>SHIP TO</b> block.</td></tr>
</table></div>
</section>

<section id="items">
<h2>Line items</h2>
<p>Each row has these fields:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Description</td><td>The item name. Typing searches your <a href="products.html">products</a> by name or HSN; picking one fills in the HSN, rate, unit and GST rate, and links the row to the product so its stock is counted.</td></tr>
  <tr><td>HSN/SAC</td><td>For common codes the app knows the usual GST rate, and shows it in green under the box. If the row's rate is still 18% or 0%, it is changed to match.</td></tr>
  <tr><td>Qty</td><td>1 to start. Clicking the box selects the number, so typing replaces it.</td></tr>
  <tr><td>Unit</td><td>From the list for Goods, Services or Mixed. ${ui('＋ Add custom…')} adds your own unit (up to 20 characters), marked ★, and ${ui('− Remove')} takes it away again. Invoices already made keep the unit they used.</td></tr>
  <tr><td>Rate</td><td>Price for one unit.</td></tr>
  <tr><td>Discount</td><td>An amount (₹) or a percentage (%) of the line. For an amount, a second box chooses what it comes off: <b>Net</b>, the line total (the default); <b>Unit</b>, that much off each unit; or <b>W/Tax</b>, off the total including tax.</td></tr>
  <tr><td>GST %</td><td>0, 0.1, 0.25, 3, 5, 12, 18, 28 or 40%, plus any rates you added in <a href="print-settings.html#tax-rates">Print Settings</a>. ${ui('Custom…')} takes any rate from 0 to 100. New rows start at 18%. Since 22 September 2025 most goods are at 5%, 18% or 40%; 12% and 28% stay for older invoices and the items still taxed at them.</td></tr>
  <tr><td>Cess %</td><td>Compensation cess, for tobacco, cars, coal and the like. Hidden until you turn on <b>GST Cess % column</b> under Customize.</td></tr>
</table></div>
<ul>
  <li>${ui('+ Add description')} under a row adds a longer note that prints under the item name.</li>
  <li>${ui('Add Item')} adds a row. So does pressing <kbd>Enter</kbd> in the last row once it has something in it.</li>
  <li>The bin removes a row. The last remaining row cannot be removed.</li>
  <li>Hiding a column under Customize, such as HSN or Discount, also hides it here.</li>
</ul>
</section>

<section id="tax-inclusive">
<h2>Prices that already include GST</h2>
<p>If your rates already include GST, tick <b>Prices include tax</b> at the top of the Line Items card. The GST is then worked out backwards from each rate, and the invoice shows the taxable value and the tax separately.</p>
</section>

<section id="discounts">
<h2>Discounts</h2>
<ul>
  <li><strong>On a line</strong>: in the row's Discount box, as described above. This is the GST-correct way, because the discount comes off before tax.</li>
  <li><strong>On the whole bill</strong>: <b>Discount on total</b>, under the items, as an amount or a percentage. It is taken off <em>after</em> tax, so it does not reduce the GST.</li>
</ul>
</section>

<section id="gst">
<h2>How GST is worked out</h2>
<p>You never choose between CGST, SGST and IGST. The app decides from your state and the place of supply:</p>
<table>
  <tr><th>Situation</th><th>Charged as</th></tr>
  <tr><td>Client in your state</td><td>CGST + SGST, half each</td></tr>
  <tr><td>Client in another state</td><td>IGST</td></tr>
  <tr><td>Within a Union Territory without a legislature (Chandigarh, Ladakh, Lakshadweep, Andaman and Nicobar, Dadra and Nagar Haveli and Daman and Diu)</td><td>CGST + UTGST</td></tr>
  <tr><td>SEZ client, or a client outside India</td><td>IGST</td></tr>
</table>
<p>The preview shows <b>Intrastate (CGST + SGST)</b> or <b>Interstate (IGST)</b> next to the place of supply, so you can check it before saving.</p>
<div class="note warn"><strong>Your own state must be set</strong>
<p>If your business state is blank in <a href="settings.html#company-details">Settings</a>, the app warns you once and does not guess, because a wrong guess would charge the wrong tax on every invoice.</p></div>
</section>

<section id="reverse-charge">
<h2>Reverse charge</h2>
<p>When the buyer pays the GST instead of you, under section 9(3) or 9(4), open ${ui('Customize')} and tick <b>Reverse Charge applies</b> under Compliance flags. The invoice then says <i>Reverse Charge: Yes</i> and prints a notice that the recipient pays the GST. Every tax invoice and credit note prints Reverse Charge Yes or No, as the rules require.</p>
</section>

<section id="tds-tcs">
<h2>TDS and TCS</h2>
<p>Both are under ${ui('Customize')}, for Indian businesses. Turn on <b>TDS / TCS on invoices</b> in <a href="settings.html#modules">Settings, Modules</a> first; it is off to begin with.</p>
<ul>
  <li><strong>TCS</strong>, tax you collect: tick it and pick the section. 206C(1H) at 0.1% is the default; CGST section 52 (1%), 206C(1) and a custom rate are also offered. TCS is added to the invoice total.</li>
  <li><strong>TDS</strong>, tax your client deducts: tick it and pick the section, such as 194Q, 194C, 194J, 194I, 194H, 194O or 195. It is for information: the invoice shows <b>Less: TDS</b> and the <b>Net Receivable</b>, and the total does not change.</li>
</ul>
<p>Both are worked out on the amount including GST.</p>
<ul>
  <li><strong>194Q and 206C(1H)</strong> only apply above ₹50 lakh a year with that client. The app adds up what you have already billed the client this financial year, and charges only the part above ₹50 lakh.</li>
  <li><strong>Every other section</strong>, such as 194C, 194J or CGST section 52, applies from the first rupee. Tick it only when the rules say it applies to this client.</li>
</ul>
<p>Invoices with TDS or TCS are summed in <a href="gst-returns.html#tds-tcs">the TDS / TCS report</a>. Have your CA confirm which sections apply to you.</p>
</section>

<section id="currency">
<h2>Billing in another currency</h2>
<p>Under ${ui('Customize')}, <b>Currency</b> offers 20 currencies, each with its own symbol and amount in words. For anything other than rupees you can enter the <b>exchange rate</b> for the day. It is kept with the invoice, so later reports stay right even when rates change, and it prints as an EXCHANGE RATE line.</p>
<p>The UPI QR code only prints on rupee invoices.</p>
</section>

<section id="terms-notes">
<h2>Terms, notes and a private note</h2>
<ul>
  <li><strong>Terms &amp; Conditions</strong>: a text box with <b>B</b>, <i>I</i>, <u>U</u>, bulleted and numbered lists, headings, links and ${ui('✕')} to clear formatting.
    <ul>
      <li><b>Insert preset</b> fills in starter wording for your kind of business: generic trader, freelancer, manufacturer or wholesaler, retail shop, restaurant, IT services, construction, medical, education and coaching, transport, real estate and rental, e-commerce seller, or export under LUT. If you already have terms, you are asked once before they are replaced.</li>
      <li><b>Load saved template</b> uses one of <a href="settings.html#terms">your saved templates</a>. On a new invoice, your first template is loaded automatically.</li>
    </ul>
  </li>
  <li><strong>PDF layout</strong>: <b>Compact</b> prints the terms and notes small, to save paper; <b>Formatted</b> prints them as readable paragraphs.</li>
  <li><strong>Notes / Remarks</strong> print on the invoice, for the client.</li>
  <li><strong>Private Note</strong> is only for you, such as "follow up on the 20th". It never prints. On the Dashboard, a yellow note icon next to the client shows it.</li>
</ul>
</section>

<section id="extra-pages">
<h2>Extra pages</h2>
<p>Under <b>Additional Pages / Sections</b>, ${ui('+ Add Section')} adds a titled section, such as a scope of work or delivery timeline. Each one prints as its own page after the invoice. You can paste formatted text, lists and tables from Word or Google Docs, and use the arrows to change the order.</p>
</section>

<section id="preview">
<h2>The live preview</h2>
<p>The preview shows the invoice exactly as it will print, with the paper size, style and options you chose. ${ui('−')} and ${ui('+')} zoom out and in from 50% to 200%, and ${ui('Fit')} fits it to the space. A saved invoice that has been cancelled shows CANCELLED across it.</p>
</section>

<section id="before-saving">
<h2>What must be filled in</h2>
<p>A new invoice needs a <b>client name</b> and <b>at least one item</b> with a description, quantity and rate. Otherwise ${ui('Save')}, ${ui('Save &amp; Download')} and ${ui('Print')} tell you what is missing.</p>
</section>

<section id="save-download">
<h2>Save &amp; Download</h2>
<p>${ui('Save &amp; Download')} does all of this in one go:</p>
<ol>
  <li>Saves the invoice, giving a new invoice its number, and counts it as printed once more.</li>
  <li>Downloads the PDF, showing that saved number, named after the type and number, such as <code>INV_INV-2026-27-0001.pdf</code>.</li>
  <li>Keeps a copy of the PDF in the app's <code>Saved Invoices</code> folder, in a folder for that client.</li>
  <li>Uploads it to Google Drive, if you have connected Drive in <a href="settings.html#google-drive">Settings</a>.</li>
  <li>Prints it, if auto-print is on in <a href="print-settings.html#auto-print">Print Settings</a> or for this client.</li>
</ol>
<p>The first save of an invoice, however you save it, takes the items out of stock, for rows picked from your products. If stock runs low or out, you are told.</p>
<p>Long invoices are split between rows, never through a row, and the signature and stamp are never cut across a page break: if they would be, the whole footer moves to the next page.</p>
</section>

<section id="print">
<h2>Printing</h2>
<ul>
  <li><strong>On A4, A5 and other sheet sizes</strong>, ${ui('Print')} opens your browser's print window.</li>
  <li><strong>On a thermal paper size</strong>, it first shows a <b>Print preview</b> of the receipt, with ${ui('Print')}, ${ui('Download PDF')} and ${ui('Cancel')}. See <a href="thermal-printing.html">Thermal receipt printing</a>.</li>
</ul>
<p>Printing saves the invoice first, like ${ui('Save &amp; Download')}, so what you hand the client is always in your records with the same number.</p>
</section>

<section id="whatsapp">
<h2>Sending on WhatsApp</h2>
<p>${ui('WhatsApp')} opens WhatsApp with the invoice number, date, client, subtotal and total typed in, and your business name. If the client is saved with a phone number, the chat opens with them; otherwise you choose the contact.</p>
<p>From the invoice screen the PDF is not attached. Download it with ${ui('Save &amp; Download')} and drag it into the chat. The WhatsApp button on the <a href="dashboard.html#row-actions">Dashboard</a> can attach the PDF on phones.</p>
</section>

<section id="eway-bill">
<h2>E-way bill</h2>
<p>For tax invoices and delivery challans, ${ui('E-Way Bill')} downloads a file, such as <code>EWB-INV-2026-27-0001.json</code>, in the format the NIC e-way bill portal accepts. Upload it there instead of typing everything again. Your own GSTIN must be set in Settings first. An e-way bill is generally needed when goods worth more than ₹50,000 are moved.</p>
</section>

<section id="autosave">
<h2>Saving as you go</h2>
<ul>
  <li>What you type is kept while the browser tab stays open. If you leave the screen by mistake and come back, the invoice is still there.</li>
  <li>A <strong>new</strong> invoice is not stored in your records until you first click ${ui('Save')}, ${ui('Save &amp; Download')} or ${ui('Print')}. Until then the badge says <b>Not saved yet</b>.</li>
  <li>After that, changes are saved automatically about two seconds after you stop typing.</li>
</ul>
</section>

<section id="leaving">
<h2>Leaving with unsaved changes</h2>
<p>If you click Back with unsaved changes, you choose ${ui('Keep editing')}, ${ui('Discard &amp; leave')} or ${ui('Save &amp; leave')}. Closing or reloading the browser tab asks too.</p>
</section>

<section id="keyboard">
<h2>Keyboard shortcuts on this screen</h2>
<table>
  <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Save</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>P</kbd></td><td>Save and download the PDF (not print)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Add an item row</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd></td><td>Duplicate the last row</td></tr>
  <tr><td><kbd>Enter</kbd> in the last row</td><td>Add a row</td></tr>
  <tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></td><td>Pick from the client or product suggestions</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Close suggestions or a dialog</td></tr>
</table>
<p>On a Mac, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>. More shortcuts: <a href="shortcuts.html">Shortcuts, search and notifications</a>.</p>
</section>

<section id="credit-note">
<h2>How to make a credit note</h2>
<ol class="steps">
  <li><strong>Start a new invoice</strong>Choose <b>Credit Note</b> as the type.</li>
  <li><strong>Point it at the original</strong>In <b>Original Invoice Reference</b>, enter the number of the invoice it corrects.</li>
  <li><strong>Enter what is being credited</strong>Add the returned items, or the price difference, with the same GST rates as the original.</li>
  <li><strong>Save</strong>Its total is subtracted from your sales on the Dashboard, and it goes into GSTR-1 as a credit note.</li>
</ol>
</section>

<section id="proforma-to-invoice">
<h2>Turning a quote into an invoice</h2>
<p>When a client accepts a Proforma / Estimate, click ${ui('Convert to Tax Invoice')} on it in the Dashboard. A new tax invoice opens with the same client and items, and gets its own number when you save it. The same works for a delivery challan.</p>
</section>

<section id="cancel">
<h2>Cancelling an invoice</h2>
<p>An invoice number, once issued, has to stay in your records, so a saved invoice is cancelled rather than deleted. Cancel it from the <a href="dashboard.html#cancel">Dashboard</a>: it keeps its number, prints with CANCELLED across it, drops out of your totals and GST returns, and its stock goes back.</p>
<p>To correct an invoice already sent to a client, the GST way is a <a href="#credit-note">credit note</a> rather than a cancellation.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'invoice-options',
  title: 'Customize: what prints and how',
  nav: 'Customize panel',
  lead: 'The Customize panel on the invoice screen: title, currency, style, colour, every show-or-hide option, paper size and thermal settings, and exactly what each part of the printed invoice shows.',
  body: `
<section id="remembered">
<h2>Your choices become the default</h2>
<p>Open the panel with ${ui('Customize')} in the invoice toolbar. Whatever you change here is used for this invoice <strong>and remembered for your next new invoice</strong>, including the title, reverse charge, TDS and TCS. If a setting was only meant for one invoice, change it back afterwards.</p>
<p>A saved invoice keeps the options it was saved with.</p>
<p>These are per-invoice settings. The app-wide look, such as fonts, watermarks, copies and translated labels, is in <a href="print-settings.html">Print and PDF settings</a>.</p>
<figure><img src="assets/img/app-customize.png" alt="The Customize panel opens inside the Invoice Type card." loading="lazy"><figcaption>The Customize panel opens inside the Invoice Type card.</figcaption></figure>
</section>

<section id="title-currency">
<h2>Title, currency and exchange rate</h2>
<table>
  <tr><td>Invoice Title</td><td>Replaces the printed title, such as TAX INVOICE. Leave it blank to use the type's own title. Thermal receipts ignore it.</td></tr>
  <tr><td>Currency</td><td>Rupees to start. See <a href="invoices.html#currency">Billing in another currency</a>.</td></tr>
  <tr><td>Exchange Rate</td><td>Only for currencies other than rupees. Kept with the invoice.</td></tr>
</table>
</section>

<section id="recurring">
<h2>Make this a recurring invoice</h2>
<p>Tick <b>🔁 Make this a recurring invoice</b> to have the app create this invoice again on a schedule, with the same client, items and amounts, a new number and that day's date.</p>
<table>
  <tr><td>Frequency</td><td>Weekly, Monthly (the default), Quarterly or Yearly</td></tr>
  <tr><td>Every N</td><td>1 to 12. Monthly with 3 means every three months.</td></tr>
  <tr><td>Next invoice date</td><td>One month after this invoice, to start</td></tr>
  <tr><td>End condition</td><td><b>Never (until I stop it)</b>, <b>On a specific date</b>, or <b>After N invoices</b>, for example 12 for a one-year monthly contract</td></tr>
</table>
<p>The schedule is saved when you save the invoice, and can be paused or changed from <a href="recurring.html">Recurring</a>.</p>
</section>

<section id="tds-tcs-account">
<h2>TCS, TDS and the payment account</h2>
<ul>
  <li><b>TCS</b> and <b>TDS</b>: see <a href="invoices.html#tds-tcs">TDS and TCS</a>.</li>
  <li><b>Payment account on this invoice</b>: if you have more than one bank account, choose which one prints. New invoices start with your ⭐ default account. The bank details and UPI QR are copied onto the invoice when you save it, so changing the account in Settings later never changes an invoice you have already sent.</li>
</ul>
</section>

<section id="style">
<h2>PDF style and accent colour</h2>
<table>
  <tr><th>Style</th><th>Look</th></tr>
  <tr><td>Classic</td><td>Clean, with a coloured bar across the top. The default.</td></tr>
  <tr><td>Modern</td><td>A solid colour block behind your business name, with the logo in white.</td></tr>
  <tr><td>Minimal</td><td>Simple, with no borders.</td></tr>
</table>
<p><b>Accent Color</b>: <b>Auto</b> gives each type its own colour, such as blue for tax invoices, purple for proformas, teal for bills of supply and red for credit notes. You can also choose one of eight fixed colours: blue, purple, teal, red, orange, green, sky or dark.</p>
</section>

<section id="show-hide">
<h2>Showing and hiding parts of the invoice</h2>
<p>Each tick box shows or hides one part of the printed invoice. Hiding something never deletes it.</p>
<div class="table-wrap"><table>
  <tr><th>Group</th><th>Options</th><th>Off to start</th></tr>
  <tr><td>Header &amp; branding</td><td>Logo, business name, address, phone, email, state, Tax ID (GSTIN)</td><td></td></tr>
  <tr><td>Client / Bill-to</td><td>Client address, phone, email, Place of Supply</td><td></td></tr>
  <tr><td>Invoice meta</td><td>Invoice number, invoice date, due date</td><td></td></tr>
  <tr><td>Items table</td><td>HSN/SAC column, Qty column, unit next to the quantity, Rate column, Discount column, Tax % column, GST Cess % column</td><td>GST Cess</td></tr>
  <tr><td>Totals</td><td>Subtotal row, amount in words, round-off line</td><td>Round-off</td></tr>
  <tr><td>Compliance flags</td><td>Reverse Charge applies</td><td>Reverse Charge</td></tr>
  <tr><td>Footer</td><td>Bank details, "Pay via" account label, UPI QR, signature block, "Authorized Signatory" caption, Terms &amp; Conditions, Notes, system-generated note</td><td>"Pay via" label, system-generated note</td></tr>
</table></div>
<p>A few options do more than show or hide:</p>
<ul>
  <li><strong>Tax % column</strong> off means no GST is charged at all, and the tax rows disappear from the totals. Bill of Supply and Delivery Challan turn it off for you.</li>
  <li><strong>Round-off line</strong> rounds the grand total to the nearest rupee, and shows the difference.</li>
  <li><strong>Business state</strong> also hides the client's state, and <strong>Tax ID</strong> also hides the client's GSTIN.</li>
  <li><strong>Bank details</strong> also hides your PAN, which prints in the bank block.</li>
  <li><strong>GST Cess % column</strong> adds a Cess box to each row of the form. The printed invoice shows cess as one line in the totals.</li>
  <li>Hiding HSN, Discount, Place of Supply, state or Tax ID also hides the matching box in the form.</li>
</ul>
<p>${ui('Hide all')} turns off everything in the header, client, invoice, items, totals and footer groups at once. ${ui('Reset to default')} puts <em>every</em> option back as it was on a fresh install, including currency, paper size, recurring, TDS, TCS and reverse charge.</p>
</section>

<section id="system-generated-note">
<h2>The "system-generated invoice" note</h2>
<p>In the Footer group, <b>Note: system-generated invoice</b> adds this line below the terms:</p>
<p><i><b>Note:</b> This is a system-generated invoice. No signature or stamp is required.</i></p>
<p>It is off unless you turn it on. If you use it, consider turning the signature block off too, so the invoice does not contradict itself.</p>
</section>

<section id="paper-size">
<h2>Paper size</h2>
<div class="table-wrap"><table>
  <tr><th>Option</th><th>Size</th></tr>
  <tr><td>A4 Portrait (default)</td><td>210 × 297 mm</td></tr>
  <tr><td>A4 Landscape</td><td>297 × 210 mm</td></tr>
  <tr><td>A5 Portrait (compact)</td><td>148 × 210 mm</td></tr>
  <tr><td>A5 Landscape (2 per A4 sheet)</td><td>210 × 148 mm</td></tr>
  <tr><td>US Letter</td><td>216 × 279 mm</td></tr>
  <tr><td>US Legal</td><td>216 × 356 mm</td></tr>
  <tr><td>B5</td><td>176 × 250 mm</td></tr>
  <tr><td>80mm Thermal (POS receipt)</td><td>72 mm printable</td></tr>
  <tr><td>76mm Thermal (kitchen printer)</td><td>68 mm printable</td></tr>
  <tr><td>58mm Thermal (compact / mobile)</td><td>48 mm printable</td></tr>
  <tr><td>112mm Thermal (wide receipt)</td><td>104 mm printable</td></tr>
  <tr><td>Custom size</td><td>Width 30 to 500 mm, height 50 to 1200 mm</td></tr>
</table></div>
<p>For a custom size, enter the printer's <em>printable</em> width, not the roll width. Anything under 100 mm wide prints as a receipt. The quick buttons ${ui('40mm')}, ${ui('76mm')}, ${ui('90mm')} and ${ui('110mm')} fill in common rolls.</p>
<p>A client can have their own preferred paper size, which is used when you pick them on a new invoice.</p>
</section>

<section id="thermal-options">
<h2>Thermal printer settings</h2>
<p>When a thermal size is chosen, three more settings appear:</p>
<table>
  <tr><td>Font size</td><td>Small, Medium (the default) or Large</td></tr>
  <tr><td>Compact mode</td><td>Tighter item rows. Off to start.</td></tr>
  <tr><td>Cut mark at bottom</td><td>Prints a CUT HERE line, for printers without an automatic cutter. On to start.</td></tr>
</table>
<p>More receipt settings are in <a href="print-settings.html#thermal">Print Settings</a>. See also <a href="thermal-printing.html">Thermal receipt printing</a>.</p>
</section>

<section id="printed-header">
<h2>What prints: the header</h2>
<ul>
  <li><strong>Your side</strong>: logo, business name, address with city and PIN, state, GSTIN, email and phone. Each can be hidden.</li>
  <li><strong>The invoice's side</strong>: the title; for a proforma, "This is not a tax invoice"; for a credit note, "Against Invoice" and the original number; then the number, date and due date; and, for tax invoices and credit notes in India, <b>Reverse Charge</b> Yes or No.</li>
</ul>
<p>With a letterhead set in Print Settings, the header is replaced by your letterhead.</p>
</section>

<section id="printed-parties">
<h2>What prints: Bill To, Ship To and Place of Supply</h2>
<ul>
  <li><strong>BILL TO</strong>: the client's name, address, state, GSTIN, email and phone.</li>
  <li><strong>SHIP TO</strong>: only when a different delivery address is entered.</li>
  <li><strong>PLACE OF SUPPLY</strong>: the state, with <b>Interstate (IGST)</b> or <b>Intrastate (CGST + SGST)</b> beside it.</li>
</ul>
</section>

<section id="printed-items">
<h2>What prints: the items table</h2>
<p>Columns, left to right: <b>#</b>, <b>Description</b> (with its longer note underneath), <b>HSN/SAC</b>, <b>Qty</b> with the unit, <b>Rate</b>, <b>Disc.</b> (only when a line has a discount), the tax columns, and <b>Amount</b>.</p>
<ul>
  <li>Within your state: <b>CGST</b> and <b>SGST</b>, each with its rate and amount.</li>
  <li>Another state: one <b>IGST</b> column.</li>
  <li>Outside India: one column with the local tax name, such as VAT.</li>
</ul>
<p><b>Amount</b> is the line's value after discount and <em>before</em> tax. The tax is in the columns beside it.</p>
</section>

<section id="printed-totals">
<h2>What prints: the totals</h2>
<p>On the left, the <b>amount in words</b> and a <b>Scan to pay (UPI)</b> QR code with your UPI ID and the amount. The QR only prints on rupee invoices, with a UPI ID set and a total above zero.</p>
<p>On the right, in order: Subtotal, Discount, CGST and SGST or IGST, GST Cess, TCS, Discount on total, Round-off, and <b>Total Due</b>. For a credit note, the last line reads <b>Credit Amount</b>. With TDS, <b>Less: TDS</b> and <b>Net Receivable</b> follow.</p>
</section>

<section id="printed-footer">
<h2>What prints: notices and footer</h2>
<ul>
  <li><strong>Reverse charge notice</strong>, when turned on.</li>
  <li><strong>Composition declaration</strong>, always on composition bills: "Composition taxable person, not eligible to collect tax on supplies."</li>
  <li><strong>BANK DETAILS</strong>: "Pay via" label if on, account name, bank, account number and type, IFSC, SWIFT, and your PAN.</li>
  <li><strong>EXCHANGE RATE</strong>, on foreign-currency invoices.</li>
  <li><strong>TERMS &amp; CONDITIONS</strong> and <strong>NOTES</strong>, compact or formatted.</li>
  <li><strong>Signature block</strong>: your signature and stamp side by side, "Authorized Signatory", and your business name. It only prints when a signature or stamp has been uploaded.</li>
</ul>
<p>Export and SEZ invoices print no LUT declaration by themselves. Use the <b>Export / International (LUT)</b> terms preset, or write your own.</p>
</section>

<section id="watermarks">
<h2>Watermarks</h2>
<ul>
  <li><strong>CANCELLED</strong>, in red, on a cancelled invoice.</li>
  <li><strong>ESTIMATE</strong>, very faint, on a proforma.</li>
  <li>Your own watermark, copy labels such as ORIGINAL and DUPLICATE, REPRINT, page numbers and QR codes come from <a href="print-settings.html">Print Settings</a>, and only on sheet paper, not receipts.</li>
</ul>
</section>
`,
},

// =============================================================================
{
  slug: 'thermal-printing',
  title: 'Thermal receipt printing',
  nav: 'Thermal receipts',
  lead: 'Printing bills on a 58 mm or 80 mm receipt printer at a shop counter, from setting it up to what the receipt shows.',
  body: `
<section id="setup">
<h2>Setting it up</h2>
<ol class="steps">
  <li><strong>Install the printer in Windows</strong>Use the driver that came with it, set the paper size in the driver to your roll width, and make it your default printer, or pick it in the print window each time.</li>
  <li><strong>Choose the receipt size</strong>On an invoice, open ${ui('Customize')} and set <b>Paper / print size</b> to <b>80mm Thermal</b> or <b>58mm Thermal</b>. The app remembers it for your next invoice.</li>
  <li><strong>Try a test print</strong>In <a href="print-settings.html#how-it-saves">Print Settings</a>, pick the <b>Thermal (80mm)</b> preview tab and click ${ui('Test Print')}.</li>
  <li><strong>Print a real bill</strong>Save the invoice, then click ${ui('Print')}. A preview of the receipt opens; click ${ui('Print')} again.</li>
</ol>
<p>Picking the <b>Retail Shop</b> or <b>Restaurant</b> business type in <a href="print-settings.html#business-type">Print Settings</a> sets sensible receipt defaults in one go.</p>
</section>

<section id="print-preview">
<h2>The print preview</h2>
<p>On a receipt size, ${ui('Print')} shows the receipt at 160% so you can read it. Its buttons:</p>
<table>
  <tr><td>${ui('Print')}</td><td>Sends it to the printer. Shows "Sending…" while it works.</td></tr>
  <tr><td>${ui('Download PDF')}</td><td>Saves and downloads a PDF instead, the same as Save &amp; Download.</td></tr>
  <tr><td>${ui('Cancel')}</td><td>Closes it. So does <kbd>Esc</kbd>.</td></tr>
</table>
</section>

<section id="auto-print">
<h2>Printing straight after saving</h2>
<p>At a busy counter, turn on <a href="print-settings.html#auto-print">Auto-print on save</a>: ${ui('Save &amp; Download')} then prints the receipt as well, with no extra click. It can also be turned on for just one client, in their details.</p>
</section>

<section id="receipt-contents">
<h2>What a receipt shows</h2>
<ul>
  <li>Your logo (if turned on in Print Settings), business name in capitals, tagline, address, GSTIN and phone.</li>
  <li>The document type, such as TAX INVOICE, then the invoice number, reverse charge, date, and the client's name, GSTIN and phone.</li>
  <li>Each item: its name, then quantity × rate, GST rate and HSN, with the amount on the right. The amount is quantity × rate, before discount and tax.</li>
  <li>Subtotal, discount, CGST, SGST or IGST, cess, round-off and <b>TOTAL</b>.</li>
  <li>Amount in words, bank details, a UPI QR code with "Scan to pay via UPI", and notes.</li>
  <li>Your footer message, such as "Thank you for your business!", your email, the cut line and blank lines to tear against.</li>
</ul>
</section>

<section id="not-on-receipts">
<h2>What a receipt leaves out</h2>
<p>To fit a narrow roll, receipts do not print: terms and conditions, the signature and stamp, extra pages, the due date, place of supply, client address, TCS, TDS, whole-bill discount lines, the exchange rate, watermarks, the reverse charge and composition notices, or the PDF style and colour. The custom invoice title is not used either.</p>
<p>If you need any of these, print that invoice on A4 or A5 instead.</p>
</section>

<section id="receipt-settings">
<h2>Changing how receipts look</h2>
<p>Font, boldness, capitals, spacing, darkness, what is shown, the QR size, the footer message, the cut mark and feed lines are all in <a href="print-settings.html#thermal">Print Settings, Thermal receipts</a>.</p>
</section>

<section id="receipt-problems">
<h2>When a receipt prints badly</h2>
<table>
  <tr><th>Problem</th><th>Try</th></tr>
  <tr><td>Text is cut off on the right</td><td>Use a smaller printable width: most 80 mm printers print 72 mm, and most 58 mm printers print 48 mm. Use <b>Custom size</b> if yours differs.</td></tr>
  <tr><td>Print is faint</td><td>Set <b>Font weight</b> to Bold or Ultra bold, and <b>Thermal ink darkness</b> to Dark.</td></tr>
  <tr><td>The printer jams or stops half-way</td><td>Turn on <a href="print-settings.html#thermal-compatibility">Buffer-safe mode</a>.</td></tr>
  <tr><td>Blurry text, or nothing prints</td><td>Set <b>Thermal print method</b> to <b>Via PDF</b>.</td></tr>
  <tr><td>Paper does not feed far enough to tear</td><td>Increase <b>Feed lines after cut</b>.</td></tr>
</table>
</section>
`,
},
];
