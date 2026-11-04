const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;

export default [
// =============================================================================
{
  slug: 'invoices',
  title: 'Making an invoice',
  nav: 'Making an invoice',
  lead: 'Every card of the New Invoice screen, from top to bottom: the toolbar, the document type, the client, invoice details, ship-to and order details, the items, discounts, GST, TDS and TCS, terms, extra pages, and what happens when you save, print or share.',
  body: `
<section id="screen-layout">
<h2>How the screen is laid out</h2>
<p>Open it with ${ui('New Invoice')} in the sidebar, or <kbd>Ctrl</kbd> + <kbd>N</kbd>. The same screen opens when you edit, duplicate or convert an invoice from the Dashboard. The form is on the left and a live preview of the printed invoice is on the right. From top to bottom, the form has these cards:</p>
<ol>
  <li><a href="#invoice-types"><b>Invoice Type</b></a>: the kind of document, and whether it is for goods or services. The ${ui('Customize')} panel opens inside this card.</li>
  <li><a href="#billed-to"><b>Billed To</b></a>: the client's name, address, state and GSTIN.</li>
  <li><a href="#details"><b>Invoice Details</b></a>: number, dates, place of supply, the <a href="#ship-to">Ship to</a> address and the optional <a href="#order-details">order, dispatch and reference details</a>.</li>
  <li><a href="#items"><b>Line Items</b></a>: what you are selling, with the <a href="#discounts">whole-bill discount</a> under them.</li>
  <li><a href="#terms-notes"><b>Terms &amp; Conditions</b></a>: terms, notes for the client and a private note for you.</li>
  <li><a href="#extra-pages"><b>Additional Pages / Sections</b></a>: extra pages printed after the invoice.</li>
</ol>
<p>The totals are not typed anywhere. They are worked out as you type and shown in the <a href="#preview">live preview</a>.</p>
<p>Every card title has a small ${ui('?')} next to it. It opens this guide at the part about that card.</p>
<figure><img src="assets/img/app-invoice-editor.png" alt="The invoice screen: the form on the left, the live preview on the right." loading="lazy"><figcaption>The invoice screen: the form on the left, the live preview on the right.</figcaption></figure>
</section>

<section id="toolbar">
<h2>The toolbar</h2>
<p>The toolbar stays at the top of the screen as you scroll, so Save, Print and the rest are always in reach on a long invoice.</p>
<figure><img src="${img('toolbar.png')}" alt="The invoice toolbar: Save, Save and Download, Print, WhatsApp, E-Way Bill, Customize, Hide Preview"></figure>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('←')} ${ui('Back')}</td><td>Leaves the invoice. If you have changed something that is not saved, you are asked first (see <a href="#leaving">Leaving with unsaved changes</a>).</td></tr>
  <tr><td>${ui('?')}</td><td>Opens this guide.</td></tr>
  <tr><td>Save status</td><td>A small coloured badge that tells you whether the invoice is saved. See <a href="#autosave">Saving as you go</a>.</td></tr>
  <tr><td>${ui('Save')}</td><td>Saves the invoice without making a PDF. <kbd>Ctrl</kbd> + <kbd>S</kbd> does the same.</td></tr>
  <tr><td>${ui('Save &amp; Download')}</td><td>Saves the invoice and downloads the PDF. See <a href="#save-download">Save &amp; Download</a>.</td></tr>
  <tr><td>${ui('Print')}</td><td>Saves the invoice, then prints it. See <a href="#print">Printing</a>.</td></tr>
  <tr><td>${ui('WhatsApp')}</td><td>Opens WhatsApp with the invoice details typed in. See <a href="#whatsapp">Sending on WhatsApp</a>.</td></tr>
  <tr><td>${ui('E-Way Bill')}</td><td>Only on tax invoices and delivery challans, and only while <b>E-way bill</b> is on in <a href="settings.html#features">Settings, Features</a>. Downloads the e-way bill file. See <a href="#eway-bill">E-way bill</a>.</td></tr>
  <tr><td>${ui('E-invoice')}</td><td>Only when <b>E-invoicing (IRN)</b> is on in Settings, Features, and only on tax invoices and credit notes. Downloads the e-invoice file and takes back the IRN. A ✓ after the name means this invoice already has an IRN. See <a href="gst-returns.html#e-invoice">E-invoicing</a>.</td></tr>
  <tr><td>${ui('Customize')}</td><td>Opens the panel that controls what prints, the paper size, currency and more. While it is open the button reads ${ui('Hide Options')}. See <a href="invoice-options.html">Customize: what prints and how</a>.</td></tr>
  <tr><td>${ui('Hide Preview')}</td><td>Hides the preview so the form uses the whole width, handy for long invoices. ${ui('Show Preview')} brings it back. The app remembers your choice in this browser. Save &amp; Download and Print still work while it is hidden.</td></tr>
</table></div>
<p>While a save, download or print is running, the buttons are greyed out and Save &amp; Download reads <b>Generating...</b>. Wait for it to finish.</p>
</section>

<section id="invoice-types">
<h2>Invoice Type: choosing the document</h2>
<p>The chips at the top of the first card decide the printed title, the number series, whether GST is charged, and whether the document counts as a sale in your totals and GST returns. Hover over a chip to see a one-line description; the same line shows under the chips for the one you picked.</p>
<div class="table-wrap"><table>
  <tr><th>Chip</th><th>Prints as</th><th>Numbered</th><th>Use it for</th><th>GST</th><th>Counts as a sale?</th></tr>
  <tr><td>Tax Invoice</td><td>TAX INVOICE</td><td>INV…</td><td>A normal sale by a GST-registered business</td><td>Yes</td><td>Yes</td></tr>
  <tr><td>Quotation</td><td>QUOTATION</td><td>QUO…</td><td>A priced offer for work or supply. Convert it to a tax invoice when the client accepts.</td><td>Shown</td><td>No</td></tr>
  <tr><td>Proforma / Estimate</td><td>PROFORMA INVOICE</td><td>EST…</td><td>A quote before the sale. Prints "This is not a tax invoice" and a faint ESTIMATE watermark.</td><td>Shown</td><td>No</td></tr>
  <tr><td>Bill of Supply (No GST)</td><td>BILL OF SUPPLY</td><td>BOS…</td><td>Exempt goods or services, where no GST is charged</td><td>No</td><td>Yes</td></tr>
  <tr><td>Composition (Bill of Supply)</td><td>BILL OF SUPPLY</td><td>COMP…</td><td>Sales under the composition scheme (section 10). The declaration required by Rule 46A prints automatically.</td><td>No</td><td>Yes</td></tr>
  <tr><td>Credit Note</td><td>CREDIT NOTE</td><td>CN…</td><td>Returns, a price cut after the sale, or a correction. Its total is subtracted from your sales. See <a href="#credit-note">How to make a credit note</a>.</td><td>Yes</td><td>Subtracted</td></tr>
  <tr><td>Delivery Challan</td><td>DELIVERY CHALLAN</td><td>DC…</td><td>Moving goods without a sale, such as to a job worker or on approval</td><td>No</td><td>No</td></tr>
</table></div>
<p>The prefixes above are the defaults. You can change each one in <a href="settings.html#invoice-numbers">Settings, Invoice number format</a> or <a href="print-settings.html#prefixes">Print Settings</a>.</p>
<h3>What changes when you click a chip</h3>
<ul>
  <li><strong>The number</strong> moves to that type's own series. Any number you typed is replaced.</li>
  <li><strong>Charge GST on this invoice</strong> is turned on for types with GST and off for the others (bill of supply, composition, delivery challan). <b>Place of Supply</b> is shown or hidden the same way.</li>
  <li><strong>The title</strong> printed at the top changes, unless you typed your own <a href="invoice-options.html#title-currency">Invoice Title</a>.</li>
</ul>
<p><strong>Once an invoice is saved, its type is locked.</strong> The other chips are greyed out and a note under them says why: the number and the tax already issued to your client must not change. To make a different document from it, use ${ui('Duplicate')} on the <a href="dashboard.html#row-actions">Dashboard</a>. A quotation, proforma or challan is turned into an invoice with ${ui('Convert to Tax Invoice')} (see <a href="#proforma-to-invoice">Turning a quote into an invoice</a>).</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>No GST box on the items, or no tax on a new tax invoice?</b> <b>Charge GST on this invoice</b> is remembered for the next invoice. After making a bill of supply or a challan, the next new invoice can start without it. Click the ${ui('Tax Invoice')} chip again, or tick <b>Charge GST on this invoice</b> under ${ui('Customize')} (group <b>Tax</b>). See <a href="troubleshooting.html#no-tax">No GST is charged at all</a>.</p>
<p><b>The chips are greyed out.</b> The invoice is already saved. Use Duplicate to make a new document of another type.</p></div>
</section>

<section id="goods-services">
<h2>Goods, services or both</h2>
<p>Under the type chips, <b>This invoice is for:</b> sets which units the Unit list offers and which unit a new row starts with. It does not change the tax.</p>
<div class="table-wrap"><table>
  <tr><th>Chip</th><th>Units offered</th><th>Good for</th></tr>
  <tr><td>📦 Goods</td><td>Pcs, Nos, Kg, g, Tonne, Ltr, ml, Mtr, cm, Ft, In, Sq.ft, Sq.m, Box, Dozen, Pair, Set, Bag, Roll, Bottle and the like. The default.</td><td>Shops, traders, manufacturers</td></tr>
  <tr><td>⏱ Services</td><td>Hrs, Day, Week, Month, Year, Visit, Session, Project, Word, Page, plus Nos, Sq.ft and Sq.m. A reminder appears to use a <b>SAC code</b> (the services version of HSN) in the HSN/SAC box. Terms print in the <b>Formatted</b> layout unless you choose otherwise.</td><td>Freelancers, consultants, repair and service businesses</td></tr>
  <tr><td>🔀 Mixed</td><td>Every unit, unfiltered.</td><td>Selling goods and doing the work, such as supply and installation</td></tr>
</table></div>
<p>Your own custom units show in every mode. The choice is remembered for your next invoice.</p>
<p><b>A service with no quantity (a fixed fee).</b> Keep the line's quantity at 1 and type the fee as the rate. Then click ${ui('Customize')} and untick <b>Qty column</b> (see <a href="invoice-options.html#show-items">Items table</a>): the invoice prints the item and its amount with no Qty column. Untick <b>Rate column</b> too if you want only the amount. Totals and GST do not change. The choice carries on to your next new invoices, so tick it again for an invoice that needs quantities; invoices already saved keep their own setting.</p>
<p>In <b>Services</b> mode the unit list starts with the units services use most: Hrs, Day, Month, Project and Nos. The HSN/SAC box of each line is labelled <b>SAC</b>, and the unit is not printed next to the quantity unless you turn it on (see <a href="invoice-options.html#show-items">Unit next to Qty</a>).</p>
<p><b>A Services invoice shows only what services need.</b> The <b>Freelancer / consultant</b> business type starts every invoice in Services mode. There, the screen leaves out:</p>
<ul>
  <li>the <b>Unit</b> column, while the unit is not printed;</li>
  <li>the ${ui('Delivery charges')} button;</li>
  <li>the <b>Ship to</b> box;</li>
  <li>the goods boxes under <b>Order, dispatch &amp; reference details</b> (vehicle no, delivery note, dispatch, destination, terms of delivery). The PO number, service period and work details stay.</li>
</ul>
<p>The <b>Discount</b> on a line is just an amount or a percent, and the discount on the whole bill is behind ${ui('+ Discount on the whole bill')}. Anything already filled in still shows. Click <b>📦 Goods</b> or <b>🔀 Mixed</b> to get every box back.</p>
<p><b>Long item names.</b> The item box grows as you type, so a long name stays readable. Drag its bottom corner to make it taller. Press <kbd>Enter</kbd> to add the next row; a name stays on one line. Use ${ui('+ Add description')} for more detail under the item.</p>
</section>

<section id="billed-to">
<h2>Billed To: the client</h2>
<p>This card says who the invoice is for. Their name, address, state and GSTIN print in the <b>BILL TO</b> block. The <b>state</b> matters most: it decides whether GST is charged as CGST + SGST or as IGST (see <a href="#gst">How GST is worked out</a>).</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to enter</th></tr>
  <tr><td>Client Name</td><td>Click it to see your saved clients, or type to search. Pick one to fill in everything below. You can also bill a name that is not saved.</td></tr>
  <tr><td>Pencil button</td><td>Appears beside the name once a saved client is picked. Opens their full details for editing (see <a href="clients.html#client-form">Adding and editing a client</a>). Typing a different name unlinks the saved client and the pencil goes.</td></tr>
  <tr><td>Billing Address</td><td>Street address and locality.</td></tr>
  <tr><td>Country</td><td>India to start (your own country). Changing it clears the state, since each country has its own list. A client outside India makes the sale an export: see <a href="#gst">How GST is worked out</a>.</td></tr>
  <tr><td>City</td><td>For example Mumbai.</td></tr>
  <tr><td>PIN Code</td><td>The 6-digit PIN. For other countries the label changes, such as ZIP Code or Postcode.</td></tr>
  <tr><td>State</td><td>Pick from the list. Leave it blank if you enter a GSTIN: the app fills it in from the GSTIN (see <a href="#gstin-check">What the GSTIN check tells you</a>). Hidden when <b>Business state</b> is turned off under Customize.</td></tr>
  <tr><td>GSTIN</td><td>The client's 15-character GST number, if they are registered. Optional: leave it blank for a consumer or an unregistered business (a B2C sale). Letters are made capitals for you. Hidden when <b>Tax ID</b> is turned off under Customize.</td></tr>
</table></div>
<p>The client's email, phone and <b>SEZ</b> setting are not on this card. They are kept with the saved client and edited with the pencil. A client marked SEZ is always charged IGST.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>CGST + SGST where it should be IGST, or the other way round?</b> Check the client's State and the <a href="#details">Place of Supply</a>, and your own state in <a href="settings.html#company-details">Settings</a>. See <a href="troubleshooting.html#wrong-tax">The invoice has the wrong tax split</a>.</p>
<p><b>The client list does not open.</b> You have no saved clients yet. Type the name and use <b>Save "name" as new client</b>, or add clients on the <a href="clients.html#client-list">Clients</a> screen.</p></div>
</section>

<section id="client">
<h3>Picking a saved client, or saving a new one</h3>
<ol class="steps">
  <li><strong>Click Client Name</strong>Your saved clients drop down, each with their city and state, and their GSTIN when they have one.</li>
  <li><strong>Type to narrow the list</strong>Any part of the name works. Use <kbd>↓</kbd> <kbd>↑</kbd> to move and <kbd>Enter</kbd> to pick, or click one. <kbd>Esc</kbd> closes the list. Each row has its own pencil to edit that client straight away.</li>
  <li><strong>Check what was filled in</strong>Picking a client fills in their address, country, city, PIN, state and GSTIN, and a message says <i>Loaded client: name</i>.</li>
  <li><strong>Or save someone new</strong>Type their name; at the bottom of the list click <b>Save "name" as new client</b>. The client form opens with what you have typed so far. Save it and the client is picked on this invoice and kept for next time. You do not have to: an invoice can go to a name that is not saved.</li>
</ol>
<p><strong>Client preferences.</strong> A saved client can carry their own paper size (a custom size too), currency and auto-print setting. When you pick them on a <em>new</em> invoice, those are applied. When you save an invoice for a saved client, the paper size and currency it used become that client's preference, so their next invoice starts the same way.</p>
</section>

<section id="gstin-check">
<h3>What the GSTIN check tells you</h3>
<p>When you leave the GSTIN box, the app reads the number. The first two digits are the state code, and the last character is a check character. This works offline, with no GST portal lookup.</p>
<div class="table-wrap"><table>
  <tr><th>Message under the box</th><th>Meaning</th><th>What to do</th></tr>
  <tr><td>✓ Registered in <i>state</i> — state filled in.</td><td>The State was blank, so it has been filled in from the GSTIN.</td><td>Nothing.</td></tr>
  <tr><td>✓ Registered in <i>state</i>.</td><td>The GSTIN and the State agree.</td><td>Nothing.</td></tr>
  <tr><td>⚠ This GSTIN is registered in <i>state</i>, but the state says <i>other state</i>.</td><td>The two disagree.</td><td>Check which is right. The tax split follows the State and Place of Supply, not the GSTIN.</td></tr>
  <tr><td>⚠ This GSTIN fails its own checksum — check for a typo.</td><td>The check character does not add up, so a character is almost certainly mistyped (0 for O, 1 for I and so on).</td><td>Compare it with the client's GST certificate or their last invoice.</td></tr>
</table></div>
<p>These are warnings only. They never stop you saving. The message clears as soon as you type in the box again.</p>
</section>

<section id="client-credit">
<h3>Using a client's credit</h3>
<p>If the client paid more than they owed on earlier invoices, a blue banner appears at the top of Billed To on a <em>new</em> invoice: <b>💳 Client has ₹… credit</b>, with the invoices the overpayment came from.</p>
<ol class="steps">
  <li><strong>Choose how much to use</strong>Type an amount in the box, or click ${ui('Apply full')} to use as much as this invoice needs. It can never be more than the credit or the invoice total.</li>
  <li><strong>Check the line under it</strong>It says how much will be applied and how much credit will remain.</li>
  <li><strong>Save</strong>The credit is recorded as a payment on this invoice, and taken off the invoices it came from. A message says which ones.</li>
</ol>
<ul>
  <li>${ui('Skip')} (shown once an amount is entered) sets it back to nothing.</li>
  <li>Tick <b>Auto-apply available client credit on future invoices</b> to have the credit used automatically whenever you pick a client who has some.</li>
</ul>
<p>The banner does not show when editing a saved invoice. To see a client's credit and payments, open <a href="clients.html#ledger">their account</a>.</p>
</section>

<section id="details">
<h2>Invoice Details</h2>
<p>The number, the dates and where the supply happens. Under them are the <a href="#ship-to">Ship to</a> box and the <a href="#order-details">order, dispatch and reference details</a>.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Invoice Number</td><td>Filled in with the next number for this type. It is only taken when you first save, so an invoice you abandon does not use up a number. If another invoice took it meanwhile, yours gets the next free number and you are told. You can also type your own number, such as the next page of a paper bill book: a number you type is kept. See <a href="settings.html#invoice-numbers">Invoice number format</a>.</td></tr>
  <tr><td>Invoice Date</td><td>Today, unless you change it. A duplicated or converted invoice starts on today's date too.</td></tr>
  <tr><td>Due Date</td><td>Blank unless you set it. Once it passes, an unpaid invoice shows as <b>Overdue</b> on the Dashboard.</td></tr>
  <tr><td>Cost centre</td><td>Only when cost centres are turned on. Tags the sale to a branch, project or department for the <a href="reports.html#cost-centres">By cost centre</a> report. It is not printed.</td></tr>
  <tr><td>Place of Supply</td><td>The state where the goods are delivered or the service is supplied. Leave it on <b>Defaults to Client State</b> unless that is a different state from the client's address. The tax split follows it. Not shown for bills of supply, composition bills or delivery challans, or when <b>Place of Supply</b> is turned off under Customize.</td></tr>
  <tr><td>Original Invoice Reference</td><td>Credit notes only: the invoice it is against, such as INV/2025-26/0001. It prints as "Against Invoice".</td></tr>
</table></div>
<h3>Changing the number of a saved invoice</h3>
<p>You can edit the number of an invoice that is already saved. On the next save it moves to the new number, which must not be used by another invoice, and the copy under the old number goes to the <a href="backup.html#trash">Trash</a>. An invoice whose overpayment was used as credit on another invoice cannot be renumbered; the app says so.</p>
<div class="note warn"><strong>Keep GST invoice numbers to 16 characters</strong>
<p>GSTR-1 accepts at most 16 characters (letters, digits, - and /) for tax invoice and credit note numbers. If yours is longer, a warning appears when you save. Shorten the format in <a href="settings.html#invoice-numbers">Settings, Invoice Number Format</a>.</p></div>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Invoice number ... already exists"</b> or <b>"was already used — saved as ... instead"</b>: see <a href="troubleshooting.html#duplicate-number">Invoice number already exists</a>.</p>
<p><b>The number jumped</b>, for example from 0007 to 0009: another invoice, a quotation of the same series or a restored backup used it. Numbers are only taken on save, never by opening the screen.</p></div>
<p id="due-in">Under <b>Due Date</b>, the buttons ${ui('7 days')}, ${ui('15 days')} and ${ui('30 days')} set the due date that many days after the invoice date. If your business type is Freelancer, new invoices start due in 15 days.</p>
<p>The <b>Currency</b> box appears here when you bill abroad; see <a href="#currency">Billing in another currency</a>.</p>
</section>

<section id="lut">
<h3>Exports and SEZ supplies under a LUT</h3>
<p>When the client is <b>abroad</b> (its country is not India) or is an <b>SEZ unit or developer</b> (the SEZ tick on the client), a box appears in Invoice Details: <b>Export under LUT (no IGST)</b>, or <b>SEZ supply under LUT (no IGST)</b>.</p>
<ul>
  <li><strong>Ticked</strong>: the supply is zero-rated. No IGST (and no cess) is charged, the items keep their GST rate for the returns, and the total is the taxable value. The invoice prints, word for word, the declaration Rule 46 requires: <i>SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX - LUT ARN AD290426123456X (FY 2026-27)</i>. Every invoice design prints it, the thermal receipt too.</li>
  <li><strong>Not ticked</strong>: IGST is charged ("with payment of IGST"), which you claim back later as a refund. The invoice prints the matching declaration <i>…ON PAYMENT OF INTEGRATED TAX</i>.</li>
</ul>
<figure><img src="assets/img/invoice-lut-export.png" alt="An export invoice to a client in the United States, billed in US dollars: Export under LUT under the place of supply, IGST 0%, and the LUT declaration with the ARN under the total." loading="lazy" style="max-width:min(600px,100%)"><figcaption>An export under a LUT: no IGST, and the Rule 46 declaration with the ARN printed under the total.</figcaption></figure>
<p>On a new invoice the box is ticked for you when your business has a LUT saved in <a href="settings.html#lut">Settings, Company</a> for the financial year of the invoice date. Untick it to charge IGST instead. An invoice saved earlier keeps its own choice. The ARN and year are copied onto the invoice when you tick it, so a new LUT next year never changes an old invoice.</p>
<p>Under the box:</p>
<ul>
  <li><b>Have a LUT?</b> appears when no LUT is saved. It explains why to file one (no tax to pay and wait for), and links to <a href="gst-basics.html#lut">how to file it</a> (form GST RFD-11, free, once a financial year). You can still tick the box if you have a LUT and have not added it yet; the declaration then prints without the ARN.</li>
  <li><b>⚠ Your saved LUT is for FY …</b> appears when the saved LUT is for another year than the invoice date. File the new year's LUT and update Settings.</li>
</ul>
<p><b>No LUT box?</b> Then the app does not see this invoice as an export. A note says why, with a button to fix it:</p>
<ul>
  <li><b>Export under LUT? First set the client's country.</b> You are billing in a foreign currency, but the client is saved in India (the client form starts on India). Click ${ui("Set the client's country")} and choose their country.</li>
  <li><b>Export under LUT? Place of supply is …</b> The client is abroad, but Place of supply is an Indian state. Click ${ui('Make it an export')} to set it back to <b>Outside India (export)</b>.</li>
  <li><b>Export under LUT? GST is turned off on this invoice.</b> The <b>Charge GST on this invoice</b> tick in ${ui('Customize')} switches GST off for the whole invoice, which hides the LUT too. Click ${ui('Turn GST on')}; under the LUT the tax is still 0.</li>
</ul>
<p>The tick also decides the GST returns and the e-invoice: SEZ invoices go in GSTR-1 as <b>SEZ without payment</b> (SEWOP) or <b>with payment</b> (SEWP), and the e-invoice file uses EXPWOP / SEZWOP or EXPWP / SEZWP. Exports abroad still go in Table 6A on the portal by hand, see <a href="gst-returns.html#top-bar">the warnings above the tabs</a>. The E-Way Bill file uses 0% rates under a LUT. More on export invoices: <a href="gst-basics.html#export-invoice">What to print on an export or SEZ invoice</a>.</p>
</section>

<section id="ship-to">
<h3>Ship to: a different delivery address</h3>
<p><b>Ship to same as bill-to address</b> is ticked to start, so the invoice has only a BILL TO block. When the goods go somewhere else, such as a site, a warehouse or the client's customer, untick it and fill in:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to enter</th></tr>
  <tr><td>Shipping Address</td><td>The delivery address, warehouse or consignee location. Can run to two lines.</td></tr>
  <tr><td>Shipping City</td><td>The delivery city.</td></tr>
  <tr><td>Shipping PIN</td><td>The 6-digit delivery PIN.</td></tr>
  <tr><td>Shipping State</td><td>The delivery state. <b>Same as billing state</b> leaves it as the client's state.</td></tr>
</table></div>
<p>The invoice then prints a separate <b>SHIP TO</b> block beside BILL TO.</p>
<div class="note info"><strong>The ship-to state does not change the tax</strong>
<p>CGST + SGST or IGST follows <b>Place of Supply</b>, not the shipping state. If the delivery is in another state, set Place of Supply too. For "bill to one party, ship to another" sales, ask your CA which state is the place of supply.</p></div>
</section>

<section id="order-details">
<h3>Order, dispatch and reference details</h3>
<p>At the bottom of Invoice Details, click <b>Order, dispatch &amp; reference details</b> to open a set of optional boxes, the ones a Tally invoice carries. It shows how many are filled, and stays open on an invoice that has any of them.</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>For example</th></tr>
  <tr><td>Work details</td><td>Supply and installation of high mast lights, scope as per annexure</td></tr>
  <tr><td>Revision No</td><td>Rev-1, when you reissue a corrected quotation</td></tr>
  <tr><td>Vehicle No</td><td>TS09AB1234</td></tr>
  <tr><td>Service period from / to</td><td>The period a service bill covers, such as a monthly AMC. A warning appears if the end is before the start.</td></tr>
  <tr><td>Buyer's Order No and Order date</td><td>The client's purchase order (PO) or work order</td></tr>
  <tr><td>Reference No &amp; Date, Other references</td><td>Any other number your client wants quoted</td></tr>
  <tr><td>Delivery Note and Delivery note date</td><td>The delivery challan or note that went with the goods</td></tr>
  <tr><td>Dispatch Doc No, Dispatched through, Destination</td><td>LR or docket number, transporter such as VRL Logistics by road, and the destination town</td></tr>
  <tr><td>Mode / Terms of payment</td><td>30 days, NEFT</td></tr>
  <tr><td>Terms of delivery</td><td>Ex-works, door delivery, FOR destination</td></tr>
</table></div>
<p>Only what you fill in prints. The <a href="invoice-options.html#style">Tally style</a> design shows them in its reference boxes, Boxed grid prints Work details on its own line, and the other designs list them under Bill To.</p>
<h3 id="own-fields">Your own fields</h3>
<p>Under the boxes, ${ui('Add a field')} adds a box you name yourself: an optician's <b>R SPH</b> and <b>L SPH</b>, a patient name, a job card number. Type the name on the left and the value on the right. A filled one prints with the details above; an empty one does not. The names stay for your next invoice, so you type them once, and the panel opens by itself while you have any. The bin removes a field.</p>
</section>

<section id="items">
<h2>Line Items</h2>
<p>One row for each thing you are selling. The amount for each row and the totals are worked out for you and shown in the preview.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Item</td><td>The item name. Typing searches your <a href="products.html">products</a> by name or HSN and shows up to five, with their HSN and price. Pick one with the mouse, or with <kbd>↓</kbd> <kbd>↑</kbd> and <kbd>Enter</kbd>. Picking fills in the HSN, selling price, unit and GST rate, and links the row to the product so its stock is counted. You can also type any name that is not a product.</td></tr>
  <tr><td>HSN/SAC</td><td>The goods (HSN) or services (SAC) code. GST returns need it. For common codes the app knows the usual GST rate since 22 September 2025: from the fourth digit it shows the rate and the item type in green under the box, and if the row's GST is still 18% or 0% it is changed to match. Where the rate depends on the price, size or packing (clothes and shoes up to or above ₹2,500, cars and bikes by engine size, loose or packed food) it shows every possible rate and leaves your GST % alone. Always check it: see <a href="gst-basics.html#which-rate">GST basics: what rate do I charge?</a> Finding your code: see <a href="gst-basics.html#hsn-search">GST basics: HSN and SAC</a>.</td></tr>
  <tr><td>Qty</td><td>1 to start. Clicking the box selects the number, so typing replaces it. Decimals are fine, such as 2.5 kg. With the unit <b>NA</b> there is no quantity: the box shows "-" and the amount is the rate (for a service such as a setup fee). GSTR-1 reports such a line with unit NA and quantity 0, as the portal expects.</td></tr>
  <tr><td>Unit</td><td>From the list for Goods, Services or Mixed. A new row starts with the unit of the row above. ${ui('＋ Add custom…')} adds your own unit (up to 20 characters), marked ★ and kept in this browser for later invoices; ${ui('− Remove "unit"')} takes one away again. Invoices already made keep the unit they used. <b>NA</b> is for a service with no quantity (see Qty). With <a href="#size-billing">Size billing</a> on, <b>Sq.ft</b> makes the row a size row.</td></tr>
  <tr><td>Rate</td><td>Price for one unit. Without GST, unless <a href="#tax-inclusive">Prices include tax</a> is ticked.</td></tr>
  <tr><td>Discount</td><td>A discount on this row, as an amount or a percentage. See <a href="#discounts">Discounts</a>. Hidden when <b>Discount column</b> is off under Customize.</td></tr>
  <tr><td>GST %</td><td>0, 0.1, 0.25, 3, 5, 12, 18, 28 or 40%, plus any rates you added in <a href="print-settings.html#tax-rates">Print Settings</a>. ${ui('Custom…')} takes any rate from 0 to 100, up to two decimals. New rows start at 18%. Since 22 September 2025 most goods are at 5%, 18% or 40%; 12% and 28% stay for older invoices and the items still taxed at them. Which rate applies to your item: see <a href="gst-basics.html#which-rate">GST basics: what rate do I charge?</a> Hidden when there is no GST on the invoice. Outside India the label is your country's tax, such as VAT %.</td></tr>
  <tr><td>Cess %</td><td>Compensation cess, for tobacco, cars, coal and the like. Hidden until you turn on <b>GST Cess % column</b> under Customize.</td></tr>
  <tr><td>Bin</td><td>Removes the row. The last remaining row cannot be removed.</td></tr>
</table></div>
<h3>Buttons under the rows</h3>
<ul>
  <li>${ui('+ Add description')} under a row opens a box for a longer note, such as a model number, size or what the work covered. It prints under the item name.</li>
  <li>${ui('Add Item')} adds a row and puts the cursor in it. So does pressing <kbd>Enter</kbd> in the last row once it has something in it, or <kbd>Ctrl</kbd> + <kbd>Enter</kbd> anywhere.</li>
  <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> copies the last row as a new row.</li>
  <li>${ui('Delivery charges')} adds a delivery line: see <a href="#delivery-charges">Delivery charges</a>.</li>
</ul>
<ol class="steps">
  <li><strong>Type the item</strong>Start typing in <b>Item</b> and pick your product from the list.</li>
  <li><strong>Set the quantity</strong>Click <b>Qty</b> and type the number. Check the unit.</li>
  <li><strong>Check the rate and GST</strong>They come from the product. Change them for this invoice if needed; the product itself is not changed.</li>
  <li><strong>Next row</strong>Press <kbd>Enter</kbd> to add the next row, and repeat.</li>
</ol>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>No product list appears while typing.</b> The product is not saved yet, or its name is spelt differently. Add it on the <a href="products.html#add-product">Products</a> screen, or just type the row by hand.</p>
<p><b>The GST rate changed by itself.</b> You typed an HSN/SAC code the app knows, and the row was still on 18% or 0%. Pick the right rate from the list.</p>
<p><b>The green hint shows two or three rates.</b> That item's rate depends on its price, size or packing, so the app does not pick one. Choose the rate that fits your item.</p>
<p><b>A column such as HSN or Discount is missing.</b> It is turned off under ${ui('Customize')}, in <a href="invoice-options.html#show-items">Items table</a>.</p></div>
</section>

<section id="delivery-charges">
<h3>Delivery charges</h3>
<p>${ui('Delivery charges')} adds one <b>Delivery charges</b> line with SAC 996812. Type the amount in its <b>Rate</b>. The button goes away once the line is there; remove the line with its bin to add it again.</p>
<ul>
  <li>Delivery that comes with the goods is a <i>composite supply</i>, taxed like the goods, so the line starts at the highest GST rate among the goods on the invoice (18% if there are none). A note under the buttons says so. Change its GST % if your delivery is a separate service.</li>
  <li>It counts in the total and in GST returns, and never touches stock.</li>
  <li>Picking a product in its Item box turns it into an ordinary product line.</li>
</ul>
</section>

<section id="tax-inclusive">
<h3>Prices that already include GST</h3>
<p>If your rates already include GST, such as an MRP or a counter price, tick <b>Prices include tax</b> at the top right of the Line Items card. The box only shows when the invoice charges GST.</p>
<p>The GST is then worked out backwards from each rate: a ₹1,180 item at 18% is ₹1,000 taxable value plus ₹180 GST. The printed Subtotal is the value before tax, so Subtotal + tax = Total, and the client pays exactly the price you typed.</p>
<p><b>Print rates before GST</b> appears beside it once it is ticked. Tick it and the Rate column prints each price without GST (₹13.25 at 18% prints as ₹11.23), so Qty × Rate matches the Amount on the invoice. Only the printing changes: the GST and the total stay exactly the same.</p>
</section>

<section id="discounts">
<h2>Discounts</h2>
<p>There are two kinds, and they do different things to the GST.</p>
<h3>On a line (before tax)</h3>
<p>In the row's <b>Discount</b> box, type the amount and choose ₹ or % in the small list beside it. For a ₹ amount, a second list chooses what it comes off:</p>
<div class="table-wrap"><table>
  <tr><th>Choice</th><th>Means</th><th>Example: 10 pcs at ₹100, 18% GST, discount 50</th></tr>
  <tr><td>Net</td><td>₹ off the row's total (quantity × rate). The default.</td><td>₹50 off ₹1,000: taxable ₹950</td></tr>
  <tr><td>Unit</td><td>₹ off each unit.</td><td>₹50 × 10 = ₹500 off: taxable ₹500</td></tr>
  <tr><td>W/Tax</td><td>₹ off the total including tax, so the client's total drops by exactly that much.</td><td>₹50 off ₹1,180: taxable about ₹957.63</td></tr>
</table></div>
<p>A % discount is a percentage of the row (at most 100%). A discount can never be more than the row itself. This is the GST-correct way to give a discount, because it comes off before tax and lowers the GST too.</p>
<h3>On the whole bill (after tax)</h3>
<p>Under the items, <b>Discount on total (whole bill)</b> takes an amount (fixed) or a <b>% of total</b>. It is taken off <em>after</em> tax, as a cash discount: the GST stays the same and the GST returns are not changed. It prints as its own line above the total. Leave it at 0 for none.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>The GST did not go down after a discount.</b> You used the whole-bill discount, which is after tax. Use a line discount instead.</p></div>
</section>

<section id="gst">
<h2>How GST is worked out</h2>
<p>You never choose between CGST, SGST and IGST. The app decides from your state and the place of supply (the client's state, unless you set Place of Supply):</p>
<div class="table-wrap"><table>
  <tr><th>Situation</th><th>Charged as</th></tr>
  <tr><td>Client in your state</td><td>CGST + SGST, half each</td></tr>
  <tr><td>Client in another state</td><td>IGST</td></tr>
  <tr><td>Within a Union Territory without a legislature (Chandigarh, Ladakh, Lakshadweep, Andaman and Nicobar, Dadra and Nagar Haveli and Daman and Diu)</td><td>CGST + UTGST</td></tr>
  <tr><td>SEZ client</td><td>IGST</td></tr>
  <tr><td>Client outside India (an export)</td><td>IGST, unless you set an Indian state as Place of Supply (goods delivered in India for a foreign buyer)</td></tr>
</table></div>
<p>If a state is blank, the first two digits of the GSTIN stand in for it. The preview shows <b>Intrastate (CGST + SGST)</b> or <b>Interstate (IGST)</b> next to the place of supply, so you can check it before saving. See also <a href="glossary.html#terms">the glossary</a> for these terms.</p>
<div class="note warn"><strong>Your own state must be set</strong>
<p>If your business state is blank in <a href="settings.html#company-details">Settings</a>, the app warns you once (<i>Set your business State in Settings</i>) and does not guess, because a wrong guess would charge the wrong tax on every invoice. See <a href="troubleshooting.html#state-missing">this fix</a>.</p></div>
</section>

<section id="reverse-charge">
<h2>Reverse charge</h2>
<p>Under reverse charge (RCM), the <em>buyer</em> pays the GST to the government instead of you, under section 9(3) or 9(4). Common cases are goods transport (GTA) services, legal services from an advocate, and supplies from an unregistered person to a registered one. Ask your CA whether it applies.</p>
<ol class="steps">
  <li><strong>Open Customize</strong>Click ${ui('Customize')} in the toolbar.</li>
  <li><strong>Tick reverse charge</strong>Under <b>Compliance flags (India)</b>, tick <b>Reverse Charge applies (Section 9(3)/9(4)) — recipient pays GST</b>.</li>
  <li><strong>Check the preview</strong>The invoice now says <i>Reverse Charge: Yes</i> and prints a notice that the recipient pays the GST.</li>
</ol>
<p>The GST is still shown, so the buyer knows how much to pay, but it is <strong>not added to the total</strong>: the total is the taxable value only, and cess is not collected either. Every tax invoice and credit note prints Reverse Charge Yes or No, as the rules require.</p>
<div class="note warn"><strong>It is remembered</strong>
<p>Like every Customize option, the tick carries over to your next new invoice. Untick it when you are done.</p></div>
</section>

<section id="tds-tcs">
<h2>TDS and TCS</h2>
<p>Both are in the ${ui('Customize')} panel, for Indian businesses. They show unless your <a href="settings.html#business-type">business type</a> hides them; the switch is <b>TDS / TCS</b> in <a href="settings.html#features">Settings, Features</a>. An invoice that already has TDS or TCS keeps its box, so it can still be changed.</p>
<ul>
  <li><strong>TCS</strong>, tax <em>you collect</em> from the client, is added to the invoice total. See <a href="#tcs">TCS</a>.</li>
  <li><strong>TDS</strong>, tax <em>your client deducts</em> when paying you, is for information: the total does not change. See <a href="#tds">TDS</a>.</li>
</ul>
<p>Each has a section list and a <b>Rate %</b> box beside it. Picking a section fills in its usual rate; you can type another rate.</p>
<p>TDS is worked out on the value before GST, as CBDT Circular 23/2017 says when GST is shown separately. TCS under CGST section 52 is worked out on the net taxable value, and TCS under 206C(1) on the amount including GST. Who deducts what, and how to check it reached your PAN: see <a href="gst-basics.html#income-tax-tds">GST basics: TDS and TCS</a>.</p>
<ul>
  <li><strong>194Q</strong> (and 206C(1H) on invoices before April 2025) only applies above ₹50 lakh a year with that client. The app adds up what you have already billed the client this financial year, and charges only the part above ₹50 lakh.</li>
  <li><strong>Every other section</strong>, such as 194C, 194J or CGST section 52, applies from the first rupee. Tick it only when the rules say it applies to this client.</li>
</ul>
<p>Invoices with TDS or TCS are listed in <a href="reports.html#tds-tcs">Reports, TDS &amp; TCS</a>, where you also tick off each TDS certificate, and summed in <a href="gst-returns.html#tds-tcs">the GST Returns TDS / TCS tab</a>. A client deducted TDS you did not put on the invoice? Record it with the payment: see <a href="dashboard.html#payment-tds">TDS when recording a payment</a>. Have your CA confirm which sections and rates apply to you.</p>
</section>

<section id="tcs">
<h3>TCS: tax collected at source</h3>
<p>Tick <b>TCS — Tax Collected at Source</b> (marked <i>Adds to invoice total</i>), then pick the section:</p>
<div class="table-wrap"><table>
  <tr><th>Section</th><th>Starting rate</th><th>Worked out on</th></tr>
  <tr><td>CGST 52 — E-commerce operator</td><td>0.5% (since 10 July 2024; it was 1%. Invoices made earlier keep their rate)</td><td>The taxable value, without GST</td></tr>
  <tr><td>206C(1) — Tendu leaves / scrap / minerals (varies)</td><td>1% (type the right rate for your goods)</td><td>The amount including GST</td></tr>
  <tr><td>Custom rate</td><td>Type it</td><td>The amount including GST</td></tr>
</table></div>
<p>The TCS prints as its own line and is added to the total. Section 206C(1H), TCS on sale of goods, was removed from 1 April 2025, so new invoices cannot choose it; invoices already made with it keep it, and it shows greyed out in the list.</p>
</section>

<section id="tds">
<h3>TDS: tax deducted at source</h3>
<p>Tick <b>TDS — Tax Deducted at Source</b> (marked <i>Buyer deducts; informational</i>), then pick the section your client deducts under:</p>
<div class="table-wrap"><table>
  <tr><th>Section</th><th>Starting rate</th></tr>
  <tr><td>194Q — Purchase of goods (buyer turnover &gt; ₹10cr)</td><td>0.1%, only above ₹50 lakh a year</td></tr>
  <tr><td>194C — Contractor / sub-contractor</td><td>1%</td></tr>
  <tr><td>194C — Contractor (company)</td><td>2%</td></tr>
  <tr><td>194J — Professional / technical services</td><td>10%</td></tr>
  <tr><td>194J — Technical services (lower rate)</td><td>2%</td></tr>
  <tr><td>194I — Rent (land / building)</td><td>10%</td></tr>
  <tr><td>194I — Rent (plant / machinery)</td><td>2%</td></tr>
  <tr><td>194H — Commission / brokerage</td><td>5%</td></tr>
  <tr><td>194O — E-commerce participant</td><td>1%</td></tr>
  <tr><td>195 — Payments to non-residents (varies)</td><td>Type it</td></tr>
  <tr><td>Custom section / rate</td><td>Type it</td></tr>
</table></div>
<p>TDS is worked out on the value <em>without</em> GST, as the CBDT circulars require when the invoice shows GST separately. The invoice shows <b>Less: TDS</b> and the <b>Net Receivable</b>, the amount you should actually receive. The invoice counts as paid once payments cover the total less the TDS.</p>
</section>

<section id="currency">
<h2>Billing in another currency</h2>
<p>If you bill clients abroad, you can make the invoice in their currency: US dollars, euros, pounds, dirhams and the other currencies of the countries the app supports.</p>
<h3>Where the currency box is</h3>
<p>A <b>Currency</b> box (for example <b>$ USD</b>) sits in the <a href="#details">Invoice Details</a> card, next to the dates, when any of these is true:</p>
<ul>
  <li><a href="settings.html#region">Settings, Region</a> is <b>International</b> or <b>Both / Auto</b>.</li>
  <li>The client's country is not India.</li>
  <li>The invoice is already in a currency other than rupees.</li>
</ul>
<p>If your Region is <b>India only</b> and you bill an Indian client in rupees, the box stays out of the way. It is always in ${ui('Customize')} at the top of the panel.</p>
<p>Changing the currency changes every money symbol on the screen and in the preview at once. The Rate box of each line shows the symbol too, such as <b>Rate ($)</b>.</p>
<h3>Which currency a new invoice starts in</h3>
<ul>
  <li>A client you saved with a <b>Preferred currency</b> gets that currency.</li>
  <li>A client abroad without one gets their country's currency (a UK client gets pounds). For the country <b>Other</b>, the last foreign currency you used is picked.</li>
  <li>An Indian client gets rupees. Before, the app kept whatever the last invoice used, so after a dollar invoice the next Indian client was billed in dollars too.</li>
  <li>When you save, the currency is remembered on the client, so the next invoice for them starts the same way.</li>
</ul>
<h3>The exchange rate</h3>
<p>For any currency other than rupees, a second box asks <b>1 USD = ? INR</b>. Type how many rupees one unit was worth on the invoice date, such as 84.10. Use your bank's rate for that day or the RBI reference rate. The app does not fetch rates from the internet.</p>
<figure><img src="assets/img/invoice-currency.png" alt="The Currency box set to $ USD, the rate box 1 USD = ? INR filled in with 84.2, and the total in rupees shown below." loading="lazy" style="max-width:min(480px,100%)"><figcaption>A US dollar invoice: the currency, the rate for the invoice date, and the total in rupees under them.</figcaption></figure>
<ul>
  <li>Under the boxes the app shows the invoice total in rupees, for example <b>≈ ₹84,100.00 in all</b>.</li>
  <li>The rate is saved with the invoice. GST returns, reports, the Dashboard and income tax turn the invoice into rupees with this rate, never with today's, so a return you filed last month gives the same figures today.</li>
  <li>The rate you last typed for a currency shows in grey in the box as a reminder. It is not filled in for you, because rates change every day.</li>
  <li>If you leave the rate empty, a warning says so. The GST returns screen then lists the invoice as an error and will not make the GSTR-1 file until you add the rate.</li>
</ul>
<h3>What prints on the invoice</h3>
<ul>
  <li>An <b>EXCHANGE RATE</b> line, such as <i>1 USD = 84.1000 INR</i>. Turn on <a href="print-settings.html#dual-currency">Print Settings, Dual currency display</a> to add the rupee total to that line: <i>1 USD = 84.1000 INR · Total ₹84,100.00</i>.</li>
  <li>The UPI QR code is left off: UPI only takes rupees. If your payment account has an <a href="settings.html#paid-from-abroad">online payment link</a> (PayPal, Wise, Payoneer), it prints instead as <b>PAY ONLINE</b>.</li>
  <li>The currency decides the money symbol, not the tax. A client outside India is an export whatever currency you bill in; see <a href="gst-basics.html#exports">Exports</a> and <a href="gst-basics.html#lut">LUT</a>.</li>
</ul>
</section>

<section id="terms-notes">
<h2>Terms &amp; Conditions, notes and a private note</h2>
<p>The fourth card holds three boxes: the <b>Terms</b> that print at the foot of the invoice, <b>Notes / Remarks</b> for the client, and a <b>Private Note</b> only you see.</p>
<h3>Terms</h3>
<p>A text box with a small toolbar: <b>B</b>, <i>I</i>, <u>U</u>, ${ui('• List')}, ${ui('1. List')}, ${ui('H')} for a heading, ${ui('¶')} for a normal paragraph, ${ui('🔗')} to turn the selected words into a link, and ${ui('✕')} to clear formatting. You can paste from Word or Google Docs.</p>
<ul>
  <li><b>Insert preset (by business type)</b> fills in India-specific starter wording: Generic SME / Trader, Freelancer / Consultant, Manufacturer / Wholesale, Retail Shop, Restaurant / Café, IT / Software Services, Construction / Contractor, Medical / Healthcare, Educational Services / Coaching, Transport / Logistics, Real Estate / Rental Invoice, E-commerce Seller, or Export / International (LUT). <b>— Start from blank —</b> empties the box. If you already have terms, you are asked once (<i>Replace current Terms?</i>); later swaps in the same browser session happen without asking. Edit the wording freely afterwards.</li>
  <li><b>Load saved template</b> uses one of <a href="settings.html#terms">your saved templates</a>. It only shows when you have saved one. On a brand-new invoice, your first template is loaded for you. Once you edit the text the list shows <b>— Custom —</b>.</li>
</ul>
<h3>Notes / Remarks (optional)</h3>
<p>Prints on the invoice under the terms, for the client: project details, special instructions, a thank-you. It has the same toolbar as Terms.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>Terms or notes do not print.</b> Check <b>Terms &amp; Conditions</b> and <b>Notes / Remarks</b> are ticked under ${ui('Customize')}, in <a href="invoice-options.html#show-footer">Footer</a>. Thermal receipts never print terms.</p>
<p><b>A saved invoice got my new terms.</b> It does not: the first template only fills a brand-new blank invoice. A saved invoice keeps its own terms.</p></div>
</section>

<section id="terms-layout">
<h3>PDF layout: Compact or Formatted</h3>
<p>On the right of the Terms &amp; Conditions title, <b>PDF layout</b> chooses how the terms and notes print:</p>
<div class="table-wrap"><table>
  <tr><th>Choice</th><th>Prints</th><th>Good for</th></tr>
  <tr><td>Compact</td><td>Small footer text, to save paper</td><td>Standard boilerplate terms on goods invoices</td></tr>
  <tr><td>Formatted</td><td>Larger, readable paragraphs with lists kept</td><td>Long service terms, scope and payment schedules</td></tr>
</table></div>
<p>Until you choose, the layout follows <a href="print-settings.html#terms-page">Print Settings</a>, and a <b>Services</b> invoice starts as Formatted.</p>
</section>

<section id="private-note">
<h3>Private Note (not shown on invoice)</h3>
<p>The yellow box at the bottom of the card is only for you, such as <i>Client asked for 15-day credit, follow up on 20th, referred by Ravi</i>. It is saved with the invoice but never prints or goes to the client. On the Dashboard, a yellow note icon next to the client shows it.</p>
</section>

<section id="extra-pages">
<h2>Additional Pages / Sections</h2>
<p>Extra pages printed <em>after</em> the invoice, such as a scope of work, a delivery timeline, a warranty card or a price breakup. Each section prints as its own page in the PDF.</p>
<ol class="steps">
  <li><strong>Add a section</strong>Click ${ui('Add Section')} at the top right of the card.</li>
  <li><strong>Give it a title</strong>For example <i>Scope of Work</i> or <i>Delivery Timeline</i>. It prints as the page heading.</li>
  <li><strong>Write or paste the content</strong>Type, or paste formatted text, lists and tables from Word or Google Docs; the formatting is kept.</li>
  <li><strong>Order them</strong>The up and down arrows move a section. The red bin removes it.</li>
</ol>
<div class="note warn"><strong>Removing a section is immediate</strong>
<p>The bin does not ask first and there is no undo. Copy the text somewhere before you remove a section you may need again.</p></div>
<p>Extra pages do not print on thermal receipts. Each section is fitted onto one page, so very long content comes out squeezed: split a long annexure into two or more sections.</p>
</section>

<section id="preview">
<h2>The live preview</h2>
<p>The <b>Live preview</b> on the right shows the invoice exactly as it will print, with the paper size, style and options you chose, and updates as you type. ${ui('−')} and ${ui('+')} zoom out and in from 50% to 200%, and ${ui('Fit')} fits it to the width of the space. The zoom is remembered.</p>
<ul>
  <li>A cancelled invoice shows CANCELLED across it; a proforma shows a faint ESTIMATE.</li>
  <li>On a thermal paper size the preview is a narrow receipt.</li>
  <li>${ui('Full view')} opens the whole page in the <a href="dashboard.html#print-preview">print preview</a> window, with ${ui('Print')} and ${ui('Download PDF')}.</li>
  <li>To give the form more room, click ${ui('Hide Preview')} in the toolbar.</li>
</ul>
<p>If something prints differently from the preview, see <a href="troubleshooting.html#missing-on-pdf">Something is missing from the PDF</a>.</p>
</section>

<section id="before-saving">
<h2>What must be filled in</h2>
<p>A new invoice needs a <b>client name</b> and <b>at least one item</b> with a name, a quantity and a rate. Otherwise ${ui('Save')}, ${ui('Save &amp; Download')} and ${ui('Print')} stop with <i>Add a client name before saving.</i> or <i>Add at least one item with a quantity and rate before saving.</i> Click the amber <b>Draft — click to complete</b> badge in the toolbar to jump to what is missing.</p>
<p>This is so a blank invoice never takes an invoice number: GST expects numbers without gaps.</p>
</section>

<section id="save-download">
<h2>Save &amp; Download</h2>
<p>${ui('Save &amp; Download')} (or <kbd>Ctrl</kbd> + <kbd>P</kbd>) does all of this in one go:</p>
<ol>
  <li>Saves the invoice, giving a new invoice its number, and counts it as printed once more.</li>
  <li>Downloads the PDF, showing that saved number, named after the type and number, such as <code>INV_INV-2026-27-0001.pdf</code>.</li>
  <li>Keeps a copy of the PDF in the app's <code>Saved Invoices</code> folder, in a folder for that client and month.</li>
  <li>Uploads it to Google Drive, if you have connected Drive in <a href="settings.html#google-drive">Settings</a>.</li>
  <li>Prints it, if auto-print is on in <a href="print-settings.html#auto-print">Print Settings</a> or for this client.</li>
</ol>
<p>Saving takes the items out of stock, for rows picked from your products; saving again after changing a quantity moves only the difference, a credit note puts stock back, and a quotation or proforma moves none (see <a href="products.html#stock">How stock is counted</a>). If stock runs low (5 or fewer) or out, you are told.</p>
<p>If you change an invoice you have already downloaded or printed, a plain ${ui('Save')} also updates its PDF in the <code>Saved Invoices</code> folder, without downloading it again.</p>
<p>Long invoices are split between rows, never through a row, and the signature and stamp are never cut across a page break: if they would be, the whole footer moves to the next page.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Failed to generate PDF."</b> See <a href="troubleshooting.html#print-blocked">Print does nothing, or "Print failed"</a>. <b>"Its PDF in Saved Invoices could not be updated"</b>: close that PDF if it is open, see <a href="troubleshooting.html#pdf-file-in-use">this fix</a>.</p></div>
</section>

<section id="print">
<h2>Printing</h2>
<ul>
  <li><strong>On A4, A5 and other sheet sizes</strong>, ${ui('Print')} saves the invoice, makes a sharp print copy and opens your browser's print window, which has its own page preview.</li>
  <li><strong>On a thermal paper size</strong>, it first shows a <b>Print preview</b> of the receipt, with ${ui('Print')}, ${ui('Download PDF')} and ${ui('Cancel')}. See <a href="thermal-printing.html#print-preview">Thermal receipt printing</a>.</li>
</ul>
<p>Printing saves the invoice first, like ${ui('Save &amp; Download')}, so what you hand the client is always in your records with the same number.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>Nothing happens, or "Print failed — try Download PDF instead".</b> Allow pop-ups for the app, or download the PDF and print that. See <a href="troubleshooting.html#print-blocked">Print does nothing</a>.</p></div>
</section>

<section id="size-billing">
<h2>Size billing (glass, mirror, flex)</h2>
<p>For shops that sell by the square foot. Turn on <b>Size billing (Sq.ft)</b> in <a href="settings.html#features">Settings → Features</a>. Then pick the unit <b>Sq.ft</b> on a row (or pick a product saved with the unit Sq.ft) and the row asks for:</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What to know</th></tr>
  <tr><td>Length (in), Width (in)</td><td>The measured size in inches.</td></tr>
  <tr><td>Pcs</td><td>How many pieces of that size.</td></tr>
  <tr><td>Round up</td><td>No, 3 inch or 6 inch. Each side is rounded up to it before the square feet are worked out: 25 inches becomes 30 with 6 inch rounding, 27 with 3 inch. The app remembers your last choice for new rows.</td></tr>
  <tr><td>Sq.ft</td><td>Worked out for you: rounded length × rounded width ÷ 144 × pieces. 25 × 30, 2 pieces, 6 inch rounding = 12.50 sq.ft.</td></tr>
  <tr><td>Rate / sq.ft</td><td>The amount is Sq.ft × rate: 12.50 × ₹50 = ₹625.</td></tr>
  <tr><td>Type amount</td><td>Tick it to type the amount yourself; the box beside it becomes <b>Amount</b> and nothing is worked out. The size and square feet still print.</td></tr>
</table></div>
<p>The invoice then prints <b>Size</b> (25 x 30, as measured) and <b>SQFT</b> columns, and <b>Qty</b> shows the pieces. Tally style and Boxed grid print the size under the item name. Items sold by the piece (hole cutting, silicon) stay ordinary rows. GSTR-1 counts a size row in Sq.ft (unit SQF). Pick any other unit to turn a size row back into an ordinary one.</p>
</section>

<section id="whatsapp">
<h2>Sending on WhatsApp</h2>
<p>${ui('WhatsApp')} opens WhatsApp with this message typed in: your business name, the client, the invoice number and date (and due date), the total, what is paid and still due, the status, and your UPI ID while money is due on a rupee invoice. The Invoices list and the Clients page send the same message. If the client is saved with a phone number, the chat opens with them; otherwise you choose the contact. It does not save the invoice.</p>
<p>From the invoice screen the PDF is not attached. Download it with ${ui('Save &amp; Download')} and drag it into the chat. The WhatsApp button on the <a href="dashboard.html#row-actions">Dashboard</a> can attach the PDF on phones.</p>
</section>

<section id="eway-bill">
<h2>E-way bill</h2>
<p>An e-way bill is generally needed when goods worth more than ₹50,000 are moved. For tax invoices and delivery challans, ${ui('E-Way Bill')} downloads a file, such as <code>EWB-INV-2026-27-0001.json</code>, in the format the NIC e-way bill portal accepts. Upload it there with its JSON upload option instead of typing everything again. The app makes the file; the e-way bill number itself comes from the portal (see <a href="limitations.html#eway-generation">what the app does not do</a>).</p>
<ol class="steps">
  <li><strong>Turn it on</strong>The button shows only while <b>E-way bill</b> is on in <a href="settings.html#features">Settings, Features</a>.</li>
  <li><strong>Save the invoice first</strong>The file uses the number on screen, so save first to be sure it is the final number.</li>
  <li><strong>Click E-Way Bill</strong>The file downloads, and a message says <i>E-Way Bill JSON downloaded</i>.</li>
  <li><strong>Upload it on the portal</strong>Add the vehicle and transporter details there if the portal asks.</li>
</ol>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Set your GSTIN in Settings first"</b>: your own GSTIN is missing in <a href="settings.html#company-details">Settings</a>. <b>"Add at least one item with a quantity and rate first."</b>: the invoice has no real item yet.</p>
<p><b>"Your business PIN code is missing"</b> or <b>"The client's PIN code is missing"</b>: the file needs both 6-digit PIN codes. Yours is in <a href="settings.html#company-details">Settings, Company Details</a>; the client's is <b>PIN Code</b> under Billed To on the invoice (or on the client in Clients). Fill it in and click again. The file uses the client's billing address, not the Ship to address, so check the delivery details on the portal.</p></div>
</section>

<section id="autosave">
<h2>Saving as you go</h2>
<ul>
  <li>What you type is kept while the browser tab stays open. If you leave the screen by mistake and come back, the invoice is still there.</li>
  <li>A <strong>new</strong> invoice (or a duplicate or conversion) is not stored in your records until you first click ${ui('Save')}, ${ui('Save &amp; Download')} or ${ui('Print')}. It takes its number only then.</li>
  <li>After that, changes are saved automatically about two seconds after you stop typing.</li>
</ul>
<p>The badge beside ${ui('Back')} tells you where you are:</p>
<div class="table-wrap"><table>
  <tr><th>Badge</th><th>Means</th></tr>
  <tr><td><b>Draft — click to complete</b> (amber)</td><td>A new invoice still missing a client name or an item. Click it to jump to the first missing box.</td></tr>
  <tr><td><b>Not saved yet</b></td><td>Ready to save, but not saved even once. Click ${ui('Save')}.</td></tr>
  <tr><td><b>Saving…</b> (blue)</td><td>An automatic save is running.</td></tr>
  <tr><td><b>All changes saved</b> (green)</td><td>The last change is stored. Shows for a moment after each save.</td></tr>
  <tr><td><b>Ready</b></td><td>Saved; nothing waiting.</td></tr>
</table></div>
</section>

<section id="leaving">
<h2>Leaving with unsaved changes</h2>
<p>If you click ${ui('Back')} after changing an invoice that has a client and an item, an <b>Unsaved changes</b> window asks what to do:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Keep editing')}</td><td>Closes the window and stays on the invoice. <kbd>Esc</kbd> does the same.</td></tr>
  <tr><td>${ui('Discard &amp; leave')}</td><td>Leaves without saving. A new invoice that was never saved is gone, and its number is not used. On a saved invoice, only the changes since the last automatic save are lost.</td></tr>
  <tr><td>${ui('Save &amp; leave')}</td><td>Saves, then goes back. A new invoice takes its number now. If the save fails, you stay on the page so you can try again.</td></tr>
</table></div>
<p>Closing or reloading the browser tab asks too, with the browser's own message. Opening an invoice and leaving without changing anything does not ask.</p>
</section>

<section id="keyboard">
<h2>Keyboard shortcuts on this screen</h2>
<table>
  <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Save (once the invoice has a client and an item; before that the browser's own save window may open, just close it)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>P</kbd></td><td>Save and download the PDF (not print)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Add an item row</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd></td><td>Duplicate the last row</td></tr>
  <tr><td><kbd>Enter</kbd> in the last row</td><td>Add a row</td></tr>
  <tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></td><td>Pick from the client or product suggestions</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Close suggestions or a dialog</td></tr>
</table>
<p>On a Mac, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>. More shortcuts: <a href="shortcuts.html">Shortcuts, search and notifications</a>.</p>
</section>

<section id="read-only">
<h2>When an invoice cannot be changed</h2>
<p>Two kinds of document open read-only, with a blue note at the top:</p>
<ul>
  <li><strong>A cancelled invoice</strong>: <i>This invoice is cancelled and read-only</i>. Undo the cancel on the <a href="dashboard.html#cancel">Dashboard</a> to change it.</li>
  <li><strong>A quotation, proforma or challan already converted</strong>: <i>Converted to INV/…. This copy is read-only</i>.</li>
</ul>
<p>You can still download or print them. Nothing is saved automatically, and ${ui('Save')} explains why. To make a new document from one, use ${ui('Duplicate')} on the Dashboard.</p>
<p>An invoice with an <b>IRN</b> (e-invoice) shows an amber note instead: changes made here are not sent to the e-invoice portal. To correct an e-invoice, cancel it on the portal within 24 hours and issue a new one, or issue a <a href="#credit-note">credit note</a>. See <a href="gst-returns.html#e-invoice">E-invoicing</a>.</p>
</section>

<section id="credit-note">
<h2>How to make a credit note</h2>
<ol class="steps">
  <li><strong>Start a new invoice</strong>Choose <b>Credit Note</b> as the type.</li>
  <li><strong>Point it at the original</strong>In <b>Original Invoice Reference</b>, enter the number of the invoice it corrects.</li>
  <li><strong>Enter what is being credited</strong>Add the returned items, or the price difference, with the same GST rates as the original.</li>
  <li><strong>Save</strong>Its total is subtracted from your sales on the Dashboard, returned goods go back into stock, and it goes into GSTR-1 as a credit note.</li>
</ol>
</section>

<section id="proforma-to-invoice">
<h2>Turning a quote into an invoice</h2>
<p>When a client accepts a Quotation or a Proforma / Estimate, click ${ui('Convert to Tax Invoice')} on it in the Dashboard. A new tax invoice opens with the same client and items, and gets its own number when you save it. The same works for a delivery challan. Once saved, the original shows <b>Converted</b> and its Convert button goes away, so it cannot be turned into a second invoice by mistake.</p>
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
<p>The first three boxes at the top of the Customize panel.</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What it does</th></tr>
  <tr><td>Invoice Title</td><td>Replaces the printed title, such as TAX INVOICE. The box shows the type's own title in grey; leave it blank to use that. Useful for wording such as <i>INVOICE CUM CHALLAN</i>. Thermal receipts ignore it.</td></tr>
  <tr><td>Currency</td><td>The same box as in Invoice Details. See <a href="invoices.html#currency">Billing in another currency</a>.</td></tr>
  <tr><td>1 USD = ? INR</td><td>Only for currencies other than rupees: how many rupees one unit was worth on the invoice date, such as 84.10. Kept with the invoice; returns and reports use it.</td></tr>
</table></div>
<p>A custom title is remembered for your next invoice too (see <a href="#remembered">Your choices become the default</a>). Clear the box when you go back to normal invoices.</p>
</section>

<section id="recurring">
<h2>Make this a recurring invoice</h2>
<p>Tick <b>🔁 Make this a recurring invoice</b> to have the app create this invoice again on a schedule, with the same client, items and amounts, a fresh number and that day's date. Good for rent, retainers, AMCs and subscriptions.</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What to enter</th></tr>
  <tr><td>Frequency</td><td>Weekly, Monthly (the default), Quarterly or Yearly</td></tr>
  <tr><td>Every N (interval)</td><td>1 to 12. Monthly with 3 means every three months.</td></tr>
  <tr><td>Next invoice date</td><td>When the first copy is made. Starts one month after this invoice's date (31 January becomes 28 February, not 3 March).</td></tr>
  <tr><td>End condition</td><td><b>Never (until I stop it)</b>; <b>On a specific date</b>, which adds a <b>Stop generating after this date</b> box; or <b>After N invoices</b>, which adds a box for how many, for example 12 for a one-year monthly contract</td></tr>
</table></div>
<ol class="steps">
  <li><strong>Make the first invoice as usual</strong>Client, items, terms.</li>
  <li><strong>Tick the box and set the schedule</strong>In ${ui('Customize')}, tick <b>🔁 Make this a recurring invoice</b> and fill in the boxes.</li>
  <li><strong>Save the invoice</strong>The schedule is saved with it. Saving the invoice again later keeps the schedule running where it is, unless you change the Next invoice date.</li>
</ol>
<p>New copies are made whenever you open the app on or after the due date (or once a day if it stays running). If this invoice has a due date, each copy gets one the same number of days after its own date. Pause, change or stop the schedule from <a href="recurring.html">Recurring</a> in the sidebar.</p>
</section>

<section id="tds-tcs-account">
<h2>TCS, TDS and the payment account</h2>
<ul>
  <li><b>TCS — Tax Collected at Source</b> and <b>TDS — Tax Deducted at Source</b>: see <a href="invoices.html#tcs">TCS</a> and <a href="invoices.html#tds">TDS</a>.</li>
  <li><b>Payment account on this invoice</b>: which bank account and UPI ID print. See <a href="#payment-account">below</a>.</li>
</ul>
</section>

<section id="payment-account">
<h3>Payment account on this invoice</h3>
<p>If you have saved bank accounts in <a href="settings.html#payment-accounts">Settings, Bank accounts and UPI</a>, this list chooses which one prints in the bank block and the UPI QR. Each is shown by its label and bank, with ⭐ before your default. With no accounts saved, the list is not shown.</p>
<ul>
  <li>New invoices start with your ⭐ default account (or, with no default, the one you used last).</li>
  <li>The preview changes as soon as you pick another account.</li>
  <li>The bank details and UPI ID are copied onto the invoice when you save it, so editing or removing the account in Settings later never changes an invoice you have already sent.</li>
</ul>
</section>

<section id="style">
<h2>PDF style and accent colour</h2>
<p><b>PDF Style</b> picks the design. Hover over a chip for a one-line description. The preview changes straight away.</p>
<table>
  <tr><th>Style</th><th>Look</th></tr>
  <tr><td>Classic</td><td>Clean, with a coloured bar across the top. The default.</td></tr>
  <tr><td>Modern</td><td>A solid colour block behind your business name, with the logo in white.</td></tr>
  <tr><td>Minimal</td><td>Simple, with no borders.</td></tr>
  <tr><td>Boxed grid</td><td>Every section in ruled boxes: your name large at the top, seller and document details side by side, Billing To and Shipping To, a Work Details line, and an item table filled with empty rows to a fixed height, like a printed quotation pad.</td></tr>
  <tr><td>Tally style</td><td>The Tally layout: reference and dispatch boxes beside your details, state names with their codes, taxes inside the item table, amount in words with E. &amp; O.E, an HSN/SAC tax summary, tax amount in words, your PAN, a declaration, and a "Customer's Seal and Signature" box.</td></tr>
</table>
<figure class="pair">
  <img src="assets/img/design-tally.png" alt="A tax invoice in Tally style" loading="lazy">
  <img src="assets/img/design-boxed.png" alt="A quotation in the Boxed grid design" loading="lazy">
  <figcaption>Tally style (left) and Boxed grid (right), with a made-up business.</figcaption>
</figure>
<p>Boxed grid and Tally style pad the item table to fill the page. If that padding alone would push the invoice onto a second page, the PDF trims it so the terms, bank details and signature stay on page 1. The boxes for <a href="invoices.html#order-details">order, dispatch and reference details</a> are filled from Invoice Details.</p>
</section>

<section id="accent-colour">
<h3>Accent Color</h3>
<p>The row of round swatches sets the colour of headings, bars and lines on the invoice.</p>
<ul>
  <li><b>Auto</b>, the multicoloured swatch, gives each type its own colour, such as blue for tax invoices, purple for proformas, teal for bills of supply and red for credit notes, so you can tell them apart at a glance. The default.</li>
  <li>The other eight are fixed colours: blue, purple, teal, red, orange, green, sky and dark. Hover over one to see its name. Pick one to use it on every type, for example to match your logo.</li>
</ul>
<p>The chosen swatch has a white ring inside it. The colour is remembered for your next invoice. For black-and-white printers, <b>dark</b> prints most clearly.</p>
</section>

<section id="show-hide">
<h2>Showing and hiding parts of the invoice</h2>
<p>Below the style, the panel lists tick boxes in groups. Each one shows or hides one part of the printed invoice. Hiding something never deletes it: tick it again and it comes back. Each group title has its own ${ui('?')} that opens the part below about it.</p>
<div class="table-wrap"><table>
  <tr><th>Group</th><th>Options</th><th>Off to start</th></tr>
  <tr><td><a href="#show-header">Header &amp; branding</a></td><td>Logo, Business name, Business address, Business phone, Business email, Business state, Tax ID (GSTIN/VAT/etc.)</td><td></td></tr>
  <tr><td><a href="#show-client">Client / Bill-to</a></td><td>Client address, Client phone, Client email, Place of Supply</td><td></td></tr>
  <tr><td><a href="#show-meta">Invoice meta</a></td><td>Invoice number, Invoice date, Due date</td><td></td></tr>
  <tr><td><a href="#show-items">Items table</a></td><td>HSN/SAC column, Qty column, Unit suffix (next to Qty), Rate column, Discount column, Tax % columns, GST Cess % column</td><td>GST Cess</td></tr>
  <tr><td><a href="#show-totals">Totals</a></td><td>Subtotal row, Amount in words, Round-off line, HSN/SAC tax summary table, Tax amount in words</td><td>The HSN summary and tax in words are on only in Tally style. Round-off follows <a href="print-settings.html#round-off">Print &amp; PDF</a> (on for new installs).</td></tr>
  <tr><td><a href="invoices.html#reverse-charge">Compliance flags (India)</a></td><td>Reverse Charge applies (Section 9(3)/9(4)) — recipient pays GST</td><td>Reverse Charge</td></tr>
  <tr><td><a href="#show-footer">Footer</a></td><td>Bank details, "Pay via" account label, UPI QR (rupee invoices), Signature block, "Authorized Signatory" caption, Terms &amp; Conditions, Notes / Remarks, system-generated note, Declaration, "Customer's Seal and Signature" box</td><td>"Pay via" label, system-generated note. Declaration and the seal box are on only in Tally style.</td></tr>
</table></div>
<p>Between Compliance flags and Footer sits the <a href="#paper-size">Paper / print size</a> list.</p>
<h3>Hide all and Reset to default</h3>
<ul>
  <li>${ui('Hide all')} turns off, in one click, everything in Header &amp; branding, Client / Bill-to and Invoice meta; in Items table everything but GST Cess; in Totals the subtotal, amount in words and round-off; and in Footer the bank details, "Pay via" label, UPI QR, signature, caption, terms and notes. Then tick back only what you want. It leaves the HSN summary, tax in words, reverse charge, system-generated note, declaration and seal box as they were.</li>
  <li>${ui('Reset to default')} puts <em>every</em> option back as it was on a fresh install, including the title, currency, style, colour, paper size, Goods/Services choice, whole-bill discount, recurring, TDS, TCS and reverse charge. The payment account you picked for this invoice stays.</li>
</ul>
<div class="note"><strong>Hide all only hides</strong>
<p>Since v1.10.84 it leaves <b>Charge GST on this invoice</b> and the <b>Round-off line</b> alone, because those change the money, not just what is printed.</p></div>
</section>

<section id="show-header">
<h3>Header &amp; branding</h3>
<p>Your side of the top of the invoice: <b>Logo</b>, <b>Business name</b>, <b>Business address</b>, <b>Business phone</b>, <b>Business email</b>, <b>Business state</b> and <b>Tax ID (GSTIN/VAT/etc.)</b>. All on to start. The logo, name and address come from <a href="settings.html#company-details">Settings</a>.</p>
<ul>
  <li><b>Business state</b> off also hides the client's state, on the invoice and in the Billed To card.</li>
  <li><b>Tax ID</b> off also hides the client's GSTIN, on the invoice and in the Billed To card. A GST tax invoice must show both GSTINs, so keep it on for tax invoices.</li>
  <li>Using a printed letterhead? Turn the header items off, or set a letterhead in <a href="print-settings.html#letterhead">Print Settings</a>.</li>
</ul>
</section>

<section id="show-client">
<h3>Client / Bill-to</h3>
<p><b>Client address</b>, <b>Client phone</b>, <b>Client email</b> and <b>Place of Supply</b>, in the BILL TO block. All on to start. The client's name always prints.</p>
<p><b>Place of Supply</b> off also hides the Place of Supply box in Invoice Details; the tax then follows the client's state. Choosing a type without GST turns it off for you.</p>
</section>

<section id="show-meta">
<h3>Invoice meta</h3>
<p><b>Invoice number</b>, <b>Invoice date</b> and <b>Due date</b> on the invoice's side of the header. All on to start. A GST tax invoice must show its number and date, so keep those on. The due date only prints when one is set.</p>
</section>

<section id="show-items">
<h3>Items table</h3>
<div class="table-wrap"><table>
  <tr><th>Option</th><th>Turning it off</th></tr>
  <tr><td>HSN/SAC column</td><td>Hides the column on the invoice and the HSN/SAC box in each row of the form. GST rules require HSN for most businesses, so keep it on for tax invoices.</td></tr>
  <tr><td>Qty column</td><td>Hides the quantity column on the invoice (the unit goes with it). The form keeps its Qty box. Useful for a fixed-fee job billed as quantity 1.</td></tr>
  <tr><td>Unit (Hrs, Nos...) next to Qty</td><td>Prints "5" instead of "5 Hrs". In Classic, Modern, Minimal and on thermal receipts the unit is part of the Qty column; in Boxed grid the UNIT column goes away, and in Tally style the "per" column goes away. <b>It turns off by itself</b> when you pick <b>Services</b> for an invoice (and back on for Goods or Mixed), until you tick or untick it yourself; after that your choice stays. A freelancer's invoices start with it off.</td></tr>
  <tr><td>Rate column</td><td>Hides the price per unit; the Amount still prints.</td></tr>
  <tr><td>Discount column</td><td>Hides the Disc. column and the Discount box in each row.</td></tr>
  <tr><td>Tax % columns</td><td>Hides the GST rate and tax amount on each line. GST is still charged: CGST/SGST or IGST still print in the totals. (Until v1.10.84 this switch was called "Tax % column" and turned GST off; that is now <b>Charge GST on this invoice</b>, below.)</td></tr>
  <tr><td>Charge GST on this invoice (group Tax)</td><td>Untick it and no GST is charged at all: the tax columns and tax rows disappear, and the GST % box goes from the form. Bill of Supply, Composition and Delivery Challan turn it off for you.</td></tr>
  <tr><td>GST Cess % column</td><td>Off to start. Turning it <em>on</em> adds a Cess % box to each row of the form. The printed invoice shows cess as one line in the totals.</td></tr>
</table></div>
</section>

<section id="show-totals">
<h3>Totals</h3>
<ul>
  <li><b>Subtotal row</b>: the value of the items before tax.</li>
  <li><b>Amount in words</b>: the total written out in words, in the invoice's currency.</li>
  <li><b>Round-off line</b>: rounds the grand total to the nearest rupee and shows the difference. The default for new invoices is set in <a href="print-settings.html#round-off">Print &amp; PDF</a>; a saved invoice keeps what it was saved with.</li>
  <li><b>HSN/SAC tax summary table</b>: the tax grouped by HSN code and rate, as on a Tally invoice. On to start only in Tally style.</li>
  <li><b>Tax amount in words</b>: the total GST in words. On to start only in Tally style.</li>
</ul>
</section>

<section id="show-footer">
<h3>Footer</h3>
<div class="table-wrap"><table>
  <tr><th>Option</th><th>What it prints</th></tr>
  <tr><td>Bank details</td><td>The BANK DETAILS block from the <a href="#payment-account">payment account</a>, with your PAN. Off hides the PAN too.</td></tr>
  <tr><td>Show "Pay via: &lt;account&gt;" label</td><td>The account's label above the bank block. Off to start.</td></tr>
  <tr><td>UPI QR (rupee invoices)</td><td>A <b>Scan to pay</b> QR with the amount filled in. Needs a UPI ID on the account and a rupee invoice.</td></tr>
  <tr><td>Signature block</td><td>Your signature and stamp, uploaded in <a href="settings.html#branding">Settings</a>. Prints only when one is uploaded.</td></tr>
  <tr><td>Show "Authorized Signatory" caption</td><td>The words under the signature.</td></tr>
  <tr><td>Terms &amp; Conditions, Notes / Remarks</td><td>What you typed in the <a href="invoices.html#terms-notes">Terms &amp; Conditions card</a>.</td></tr>
  <tr><td>Note: system-generated invoice…</td><td>See <a href="#system-generated-note">below</a>. Off to start.</td></tr>
  <tr><td>Declaration</td><td>A declaration paragraph. When on, a <b>Declaration text</b> box appears to change its wording. It starts as the standard "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct." On to start only in Tally style.</td></tr>
  <tr><td>"Customer's Seal and Signature" box</td><td>An empty box for the client to stamp and sign, in Boxed grid and Tally style. On to start only in Tally style.</td></tr>
</table></div>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>Logo, signature, stamp or UPI QR missing from the PDF?</b> See <a href="troubleshooting.html#missing-on-pdf">Something is missing from the PDF</a>.</p></div>
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
<p>A one-line hint under the <b>Paper / print size</b> list says what the chosen size is good for. The preview changes to the new size straight away.</p>
<p>A client can have their own preferred paper size, which is used when you pick them on a new invoice. Saving an invoice for a saved client makes its paper size that client's preference, so a client you always bill on a receipt gets a receipt next time while the others stay on A4.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>Every invoice turned into a receipt.</b> The last size you chose is remembered for new invoices. Pick <b>A4 Portrait (default)</b> again. <b>Text cut off on a receipt</b>: see <a href="thermal-printing.html#receipt-problems">When a receipt prints badly</a>.</p></div>
</section>

<section id="thermal-options">
<h2>Thermal printer settings</h2>
<p>When a thermal size is chosen (or a custom size under 100 mm wide), a <b>Thermal printer settings</b> box appears under the paper size:</p>
<table>
  <tr><td>Font size</td><td>Small (fits more per page), Medium (recommended, the default) or Large (easier to read)</td></tr>
  <tr><td>Compact mode</td><td>Tighter item rows, to save paper on long orders. Off to start. Whether HSN and the quantity × rate line print is set in Print Settings.</td></tr>
  <tr><td>Cut mark at bottom</td><td>Prints a CUT HERE line to tear against. On to start. Turn it off if your printer cuts the paper itself.</td></tr>
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
