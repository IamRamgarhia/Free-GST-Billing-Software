const ui = (s) => `<span class="ui">${s}</span>`;

export default [
{
  slug: 'print-settings',
  title: 'Print and PDF settings',
  nav: 'Print and PDF settings',
  lead: 'The app-wide defaults for how every invoice looks on paper and in a PDF: business-type presets, designs, thermal receipts, copies, watermarks, fonts, colours, languages and formats. Each part of the Print & PDF tab in Settings has a ? that opens its section here. Each invoice can still override the basics from its own Customize panel.',
  body: `
<section id="how-it-saves">
<h2>Print &amp; PDF Settings: how they save</h2>
<p>Open ${ui('Settings')} and click the ${ui('Print &amp; PDF')} tab. Use it once when you start, to make your invoices look the way you want, and again whenever you change printer or paper.</p>
<p>There is no Save button: every change is kept the moment you make it. The <a href="#preview">Live preview</a> on the right updates as you change things, using a sample invoice with your business name, so you can see the effect without touching a real invoice. On a narrow screen the preview moves below the settings.</p>
<p>Two buttons sit at the top of the card:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Reset defaults')}</td><td>Puts <b>every</b> print setting back to how it was on a fresh install, straight away and without asking. That includes your <a href="#templates">saved templates</a>, number prefixes, signature image and letterhead, so there is no way back: use it only to start over.</td></tr>
  <tr><td>${ui('Test Print')}</td><td>Sends a test print of the preview to your default printer. Pick the <b>Thermal (80mm)</b> preview tab first; in Split view it says the preview is not ready.</td></tr>
</table></div>
<p>These are the defaults for new invoices. On one invoice you can still turn things on or off under <a href="invoice-options.html#show-hide">Customize</a>.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>The preview does not change</b>: thermal settings show only on the <b>Thermal (80mm)</b> preview tab, and <a href="#pdf-font-scale">font scale</a> only in a downloaded PDF.</li>
  <li><b>I pressed Reset defaults by mistake</b>: there is no undo. Set things again, starting with the <a href="#business-type">print style</a> and <a href="#visual-style">Visual style</a>, which set most of them in two clicks.</li>
</ul>
</section>

<section id="business-type">
<h2>Print style (from your business type)</h2>
<p>The first box says <b>Print style:</b> and the style in use, for example <b>Retail Shop / Kirana (from your business type)</b>. Your <a href="settings.html#business-type">business type</a> (Settings → Company) sets it: choosing a type and saving sets a dozen or so print settings in one go, and hides options that do not apply to you. Every setting below stays editable afterwards. ${ui('Change business type')} opens the Business type card.</p>
<p>To print in another style without changing your business type, open <b>Use another print style (keeps your business type)</b> under it:</p>
<ol class="steps">
  <li><strong>Pick a style</strong>Click a card. The app asks <b>Apply "…" preset?</b> and says how many settings it will change.</li>
  <li><strong>Confirm</strong>Click ${ui('Apply preset')}. The card is marked <b>ACTIVE</b> and the preview changes.</li>
</ol>
<div class="table-wrap"><table>
  <tr><th>Print style</th><th>Set up for</th><th>Main settings it applies</th></tr>
  <tr><td>Retail Shop / Kirana</td><td>A counter with a thermal printer</td><td>Bold capitals, prints straight after saving, "Qty × Rate" lines, no HSN, "Thank you! Visit again!", cut mark and 2 feed lines</td></tr>
  <tr><td>Freelancer / Consultant</td><td>Professional A4 PDFs</td><td>Minimalist design, HSN, amount in words, page numbers and header on long invoices</td></tr>
  <tr><td>Restaurant / Cafe / Bar</td><td>80 mm receipts with a big UPI QR</td><td>Bold, prints on save, no HSN or amount in words, large UPI QR, 3 feed lines, "Thanks for dining with us!"</td></tr>
  <tr><td>Wholesale / Trading</td><td>GST copies of goods invoices</td><td>Classic design, three copies (ORIGINAL, DUPLICATE, TRIPLICATE), HSN, amount in words, darker print</td></tr>
  <tr><td>Manufacturing</td><td>Detailed A4 invoices</td><td>Corporate design, HSN, amount in words, page numbers and header, invoice QR, three copies</td></tr>
  <tr><td>Service / Repair Shop</td><td>Simple single-copy bills</td><td>Classic design, no HSN, amount in words, signature shown</td></tr>
</table></div>
<p>While a print style is chosen, options it does not need are hidden, and a note says <i>Some options are hidden because they don't apply to your … print style</i>. ${ui('Show all options')} in that note clears the print style so you can see everything; your settings stay as they are. Some options are marked <b>★ Recommended for your business</b>.</p>
<p><b>Everything</b> as the business type has no print style of its own: your print settings stay as they are.</p>
<figure><img src="assets/img/app-print-settings.png" alt="Business types, designs and the live preview." loading="lazy"><figcaption>Business types, designs and the live preview.</figcaption></figure>
</section>

<section id="visual-style">
<h2>Visual style</h2>
<p>The second box, <b>🎨 Visual style</b>: eight ready-made designs that set the colours and type for both PDFs and thermal receipts in one click. Each card shows a small invoice in its own colours; the one in use is marked <b>ACTIVE</b>. Click a card to use it, then change anything below.</p>
<div class="table-wrap"><table>
  <tr><th>Design</th><th>Suits</th><th>Look</th></tr>
  <tr><td>Aurora</td><td>Freelancers, tech</td><td>Cool slate with electric blue</td></tr>
  <tr><td>Editorial</td><td>Law, consulting</td><td>Charcoal on warm ivory, capitals</td></tr>
  <tr><td>Executive</td><td>Enterprise, B2B</td><td>Deep navy with soft champagne</td></tr>
  <tr><td>Whisper</td><td>Designers, studios</td><td>Off-white, one hairline, nothing else</td></tr>
  <tr><td>Sunset</td><td>Retail, cafes, salons</td><td>Warm terracotta on cream, with a tagline</td></tr>
  <tr><td>Monoline</td><td>Developers, agencies</td><td>Monospace, dense rows, 90% size</td></tr>
  <tr><td>Nordic</td><td>SaaS, studios</td><td>Teal on frosted white</td></tr>
  <tr><td>Bold Retail</td><td>Fashion, sports</td><td>Black with a red accent, capitals</td></tr>
</table></div>
<div class="note info"><strong>A design applies at once</strong>
<p>Unlike business types, a design is applied without asking. A few designs also change one or two other settings (Monoline shrinks the text to 90% and hides the "Qty × Rate" line; Sunset turns the tagline on), and those stay as they are when you pick another design.</p></div>
</section>

<section id="thermal">
<h2>Thermal receipts</h2>
<p>Four groups, <b>Typography</b>, <b>Layout</b>, <b>Content</b> and <b>Footer</b>, that only affect 58 mm and 80 mm receipt printers (the small roll printers at shop counters). A4 and A5 PDFs are not changed by them.</p>
<p>They are hidden when your <a href="#business-type">business type</a> prints A4 or A5 PDFs (Freelancer, Service, Wholesale, Manufacturing); a grey note says so. Pick Retail or Restaurant, or ${ui('Show all options')}, to see them.</p>
<p>For setting a printer up from scratch, see <a href="thermal-printing.html">Thermal receipt printing</a>. Switch the preview to <b>Thermal (80mm)</b> to see your changes.</p>
</section>

<section id="thermal-typography">
<h3>Typography (Thermal receipts)</h3>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>Options</th><th>Default</th></tr>
  <tr><td>Font family</td><td>Monospace (Courier), made for thermal printers, or sans-serif (like Arial). For A4/A5 PDFs use <a href="#pdf-font">PDF font family</a>.</td><td>Monospace</td></tr>
  <tr><td>Font size</td><td>Small (fits more), Medium, Large, Extra Large (easier for older customers)</td><td>Medium</td></tr>
  <tr><td>Font weight</td><td>Normal, Bold, Ultra bold. Thermal heads print bold much darker, so bold is recommended.</td><td>Bold</td></tr>
  <tr><td>ALL CAPS mode</td><td>Every line in capitals, like big supermarket receipts</td><td>Off</td></tr>
</table></div>
</section>

<section id="thermal-layout">
<h3>Layout (thermal)</h3>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>Options</th><th>Default</th></tr>
  <tr><td>Line spacing</td><td>Compact (saves paper), Normal, Comfortable</td><td>Normal</td></tr>
  <tr><td>Header alignment</td><td>Centre, or left</td><td>Centre</td></tr>
  <tr><td>Thermal ink darkness</td><td>Standard, Dark (for older printers), Extra-dark. Darkens the logo and QR code so faded prints come out darker.</td><td>Standard</td></tr>
  <tr><td>Force ALL CAPS in header</td><td>Business name always in capitals</td><td>On</td></tr>
</table></div>
</section>

<section id="thermal-content">
<h3>Content (thermal)</h3>
<p>Tick or untick what prints on the receipt: <b>Show business logo</b>, <b>Show HSN code per item</b> (needed on GST tax invoices; turn off for informal counter receipts), <b>Show "Qty × Rate" line per item</b>, <b>Show amount in words</b>, <b>Show bank details</b> and <b>Show UPI QR code</b>. All are on to start. With the QR on, <b>UPI QR size</b> is Small, Medium (the default) or Large.</p>
<p>With both HSN and "Qty × Rate" off, items print as a compact single line.</p>
</section>

<section id="thermal-footer">
<h3>Footer (thermal)</h3>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>What it does</th><th>Default</th></tr>
  <tr><td>Custom footer message</td><td>Printed above the cut line. Leave blank for none.</td><td>"Thank you for your business!"</td></tr>
  <tr><td>Show cut mark ("✂ cut here")</td><td>For printers without an automatic cutter. Turn off if yours cuts by itself.</td><td>On</td></tr>
  <tr><td>Feed lines after cut</td><td>None, 1, 2, 3, 4 or 6 blank lines so the paper tears cleanly</td><td>2</td></tr>
  <tr><td>Show tagline</td><td>A line of your choice under the business name, typed in <b>Tagline text</b></td><td>Off</td></tr>
</table></div>
</section>

<section id="pdf-features">
<h2>PDF &amp; universal print features</h2>
<p>The grey box <b>📄 PDF &amp; universal print features</b> holds the groups below. They apply to every paper size, A4, A5, Letter, Legal and thermal, unless a group says otherwise. Each group title has its own ${ui('?')}.</p>
<p>Some groups only show for certain <a href="#business-type">business types</a>: Multi-copy for Wholesale and Manufacturing, Customer feedback QR and Reprint tracking for Retail and Restaurant, Dual currency for Freelancer and Service. With no business type chosen, everything shows.</p>
</section>

<section id="auto-print">
<h2>Auto-print</h2>
<p><b>Auto-print on save</b>: with this on, ${ui('Save &amp; Download')} also sends the invoice straight to your default printer, with no extra click. Made for busy shop counters. Off by default. It can also be turned on for one client only, in their details.</p>
</section>

<section id="watermark">
<h2>Watermark</h2>
<p>A large, faint diagonal word across every page of the PDF, such as PAID or DRAFT.</p>
<ol class="steps">
  <li><strong>Turn it on</strong>Tick <b>Show watermark</b>. More settings appear.</li>
  <li><strong>Choose the word</strong>Pick one under <b>Watermark text</b>: PAID, DUPLICATE (the default), DRAFT, OVERDUE, COPY, ORIGINAL, CANCELLED or REPRINT. Or tick <b>Use custom text instead of preset</b> and type your own in <b>Custom watermark text</b>, such as FOR INTERNAL USE.</li>
  <li><strong>Choose how strong</strong><b>Opacity</b>: very faint (5%) to very strong (40%); medium (15%) is the default.</li>
</ol>
<p>If you choose your own text and leave the box empty, no watermark prints. Watermarks are never printed on thermal receipts. Cancelled invoices get their own CANCELLED mark whatever this setting says.</p>
</section>

<section id="copies">
<h2>Multi-copy (GST rule 48)</h2>
<p>GST rules expect three copies of an invoice for goods (for the buyer, the transporter and yourself) and two for services. Tick <b>Print multiple copies with labels</b> and choose the <b>Number of copies</b>: 2 (Original + Duplicate, for services) or 3 (Original + Duplicate + Triplicate, for goods; the default). The PDF then holds every page once for each copy, labelled in a small box at the top right:</p>
<ul>
  <li>ORIGINAL FOR RECIPIENT</li>
  <li>DUPLICATE FOR TRANSPORTER</li>
  <li>TRIPLICATE FOR SUPPLIER</li>
</ul>
<p>Shown for the Wholesale and Manufacturing business types, or with none chosen.</p>
</section>

<section id="multi-page">
<h2>Multi-page invoices</h2>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>What it does</th><th>Default</th></tr>
  <tr><td>Page numbers on pages 2+</td><td>Prints "Page 2 of 3" at the bottom right of the second page onwards. The first page is not numbered.</td><td>On</td></tr>
  <tr><td>Business name header on pages 2+</td><td>Repeats your business name, with a line under it, at the top of every page after the first</td><td>On</td></tr>
</table></div>
<p>Both only appear when an invoice runs to more than one page. Page breaks always fall between rows, and never through the signature, stamp or an image.</p>
</section>

<section id="margins">
<h2>Print margins (mm)</h2>
<p><b>Top</b>, <b>Bottom</b>, <b>Left</b> and <b>Right</b>, in millimetres, from 0 to 100 (all 0 to start). Use them when printing on pre-printed letterhead paper, to move the invoice clear of the printed logo, or to leave room for binding. For example, a top margin of 40 starts the invoice 4 cm down the page.</p>
</section>

<section id="verification-codes">
<h2>Verification codes</h2>
<ul>
  <li><strong>Invoice number as QR</strong>: an 18 mm QR code at the bottom right of the last page, captioned "Verify invoice". It holds the invoice number, or, if you type a <b>Verification URL (optional)</b> such as <code>https://mycompany.com/verify/{invoice_number}</code>, that address with the number filled in. Off by default.</li>
  <li><strong>Invoice number as barcode text</strong>: prints the invoice number large, in a typewriter font, at the bottom left of the last page, for filing. It is text, not a scannable barcode. Off by default.</li>
</ul>
<p>Neither is the GST e-invoice QR code; that comes with <a href="gst-returns.html#e-invoice">E-invoicing</a>.</p>
</section>

<section id="feedback-qr">
<h2>Customer feedback QR</h2>
<p>Tick <b>Feedback / review QR</b> to print a QR code at the bottom left of the PDF that opens any web address, such as your Google review page or a WhatsApp chat. Paste the address in <b>URL to encode</b>; it only prints once an address is entered. <b>Label above QR</b>, "Rate us · Give feedback" unless you change it, prints with the code. Shown for the Retail and Restaurant business types, or with none chosen.</p>
</section>

<section id="signature">
<h2>Digital signature</h2>
<p>A default signature, used when a business has none of its own. <b>Show signature on invoice</b> is on to start. Upload a picture (PNG, JPG, WebP or SVG, up to 2 MB) with <b>Upload signature</b>; ${ui('Remove signature')} takes it off. <b>Signatory name</b>, such as <i>Rakesh Kumar · Director</i>, prints under it; left blank, the business name is used.</p>
<p>A signature and stamp uploaded in <a href="settings.html#branding">Settings, Branding</a> for a business take priority over this one.</p>
</section>

<section id="terms-page">
<h2>Terms &amp; Conditions on a separate page</h2>
<p><b>Print T&amp;C on a separate page</b> moves long terms and notes to a page of their own, instead of squeezing them under the totals. Only affects invoices that have terms. Off by default. Your terms themselves are kept in <a href="settings.html#terms">Terms &amp; Conditions Templates</a>.</p>
</section>

<section id="pdf-font">
<h2>PDF font family</h2>
<p><b>Font used in generated PDFs</b>: Helvetica (clean, the default), Times New Roman (traditional and formal), or Courier (typewriter style). It applies to A4, A5, Letter and Legal PDFs; thermal receipts have their own <a href="#thermal-typography">font setting</a>.</p>
</section>

<section id="thermal-compatibility">
<h2>Layout &amp; printer compatibility</h2>
<ul>
  <li><strong>Compact upper header (fit more items on page 1)</strong>: tightens the space above the items table so more rows fit on the first page. Use it when invoices often spill onto page 2. Off by default.</li>
  <li><strong>Thermal buffer-safe mode</strong>: for cheap or old receipt printers that jam or stop half-way on large print jobs. Prints in black and white at lower quality. Off by default.</li>
  <li><strong>Thermal print method</strong>: <b>Direct HTML</b>, the default, sends sharp text straight to the printer. If your printer or browser mishandles it, choose <b>Via PDF</b>.</li>
</ul>
</section>

<section id="prefixes">
<h2>Custom prefix per invoice type</h2>
<p>Each document type numbers separately, with a built-in prefix: INV for Tax Invoice, QUO for Quotation, EST for Proforma / Estimate, BOS for Bill of Supply, COMP for Composition, CN for Credit Note and DC for Delivery Challan. Type your own in the box next to a type to replace it: letters, numbers, hyphens and underscores only, up to 8 characters. Leave it blank to use the built-in one.</p>
<p>A new prefix starts its own count from 1. The rest of the number (year, separator, digits) follows <a href="settings.html#invoice-numbers">Invoice Number Format</a>.</p>
</section>

<section id="reprint">
<h2>Reprint tracking</h2>
<p><b>Show REPRINT badge on reprints</b>: once an invoice has been printed before, this prints a red "REPRINT · Copy #2" (and so on) at the top of each page, so a copy cannot pass as the original. Off by default. The app counts every print either way. Shown for the Retail and Restaurant business types, or with none chosen.</p>
</section>

<section id="pdf-quality">
<h2>PDF quality vs file size</h2>
<p><b>Print quality</b>: Draft (about half the file size, fine for email and WhatsApp), Standard (balanced), or HD (sharpest text, largest file, best for printing and keeping). HD is the default.</p>
</section>

<section id="dual-currency">
<h2>Dual currency display</h2>
<p>For rupee invoices to clients abroad. Tick <b>Show foreign-currency equivalent</b> to show the total in a second currency too.</p>
<ul>
  <li><b>Secondary currency</b>: USD, EUR, GBP, AED, SGD, AUD or JPY.</li>
  <li><b>Rate (1 USD = ? INR)</b>: you set it, 83 to start. There is no live exchange rate; update it yourself.</li>
  <li><b>Display position</b>: on a line below the ₹ amount, or in brackets after it.</li>
</ul>
<p>Shown for the Freelancer and Service business types, or with none chosen.</p>
<p>On an invoice billed in another currency (for example US dollars), the same switch adds the rupee total to the invoice's EXCHANGE RATE line, at that invoice's own rate: <i>1 USD = 84.1000 INR · Total ₹84,100.00</i>. See <a href="invoices.html#currency">Billing in another currency</a>.</p>
</section>

<section id="letterhead">
<h2>Company letterhead</h2>
<p>If you have printed stationery, upload it as a picture and invoices print on top of it.</p>
<ol class="steps">
  <li><strong>Turn it on</strong>Tick <b>Use pre-printed letterhead image</b>.</li>
  <li><strong>Upload</strong>Under <b>Upload letterhead</b>, pick a PNG, JPG or WebP picture of the full A4 page, up to 3 MB. Until you do, a yellow warning says the switch does nothing yet.</li>
  <li><strong>Avoid printing your details twice</strong><b>Hide invoice header block</b>, on by default, drops the app's own header because the letterhead already has your name and address.</li>
</ol>
<p>${ui('Remove letterhead')} takes the picture off. Use <a href="#margins">Print margins</a> to keep the invoice clear of the letterhead's printed parts.</p>
</section>

<section id="template">
<h2>PDF template style (visual design)</h2>
<p><b>Template</b> changes the header and table style of A4 and A5 PDFs: Modern (a coloured header, the default), Classic (professional), Minimal (lots of white space), Corporate (formal blue), Minimalist (grey), Boxed grid (ruled boxes, like a quotation pad) and Tally style (order boxes, an HSN tax summary and a declaration). A design chosen under <a href="#visual-style">Visual style</a> sets this for you. Thermal receipts have their own compact layout.</p>
</section>

<section id="print-darkness">
<h2>Print darkness</h2>
<p><b>Force darker text on printed PDF</b> darkens grey labels and addresses so they do not fade on paper printers. On by default. It only changes the PDF, not the screen. Turn it off if your printer already prints greys crisply.</p>
</section>

<section id="pdf-font-scale">
<h2>PDF font scale</h2>
<p>A slider for the <b>Overall size</b> of the PDF, from 80% to 140% (100% to start). Smaller fits more on a page; larger is easier to read. The on-screen preview always shows 100%; download a PDF to see the result.</p>
</section>

<section id="colours">
<h2>PDF Style Editor: your own colours</h2>
<p>To match your brand, tick <b>Use custom colours</b> and set six colours with the colour picker or a hex code such as <code>#1e40af</code>. The preview changes as you go. ${ui('Reset colours to defaults')} undoes them.</p>
<div class="table-wrap"><table>
  <tr><th>Colour</th><th>Used for</th></tr>
  <tr><td>Primary text</td><td>Client name, item names, totals</td></tr>
  <tr><td>Muted text</td><td>Labels, addresses, dates and numbers</td></tr>
  <tr><td>Accent colour</td><td>Section titles and the table header</td></tr>
  <tr><td>Accent text</td><td>Text on the accent colour, usually white</td></tr>
  <tr><td>Header background</td><td>Behind the business name and invoice title</td></tr>
  <tr><td>Divider lines</td><td>Lines between sections and table rows</td></tr>
</table></div>
<p>Keep text dark on a light background so it prints clearly.</p>
</section>

<section id="labels-language">
<h2>Section labels and language</h2>
<p><b>Language preset</b> prints the section labels in English, Hindi, Tamil, Marathi or Bengali. You can also type your own wording for six labels: <b>BILL TO</b>, <b>PLACE OF SUPPLY</b>, <b>BANK DETAILS</b>, <b>AMOUNT IN WORDS</b>, <b>TERMS &amp; CONDITIONS</b> and <b>NOTES</b>. The grey text in each box shows the current wording. Your own wording wins over the language; clear the box to go back.</p>
</section>

<section id="formats">
<h2>Formatting: date, number, currency</h2>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>Options</th></tr>
  <tr><td>Date format</td><td>02 Apr 2026 (Indian, the default), 02-Apr-2026, 02/04/2026, 04/02/2026 (US), 2026-04-02, or ISO 8601</td></tr>
  <tr><td>Number grouping</td><td>1,00,000.00 (Indian, the default), 100,000.00 (Western), 100.000,00 (European)</td></tr>
  <tr><td>Decimal places</td><td>0, 2 (the default), 3 or 4</td></tr>
  <tr><td>Currency symbol position</td><td>Before the number (₹100, the default) or after it</td></tr>
</table></div>
</section>

<section id="round-off">
<h2>Totals: round off invoice totals</h2>
<p>Under <b>🧮 Totals</b>. <b>Round off invoice totals</b>: when on, new invoices round the grand total to the nearest rupee and print the difference as a <b>Round-off</b> line, such as −0.40. It is on for new installs and saves as soon as you click. You can still turn it off for one invoice in <a href="invoice-options.html#show-hide">Customize</a>, under Totals. Changing it never alters invoices you have already saved.</p>
</section>

<section id="row-density">
<h2>Row density</h2>
<p><b>Vertical spacing in tables + sections</b>: Compact (fits more per page), Normal (the default) or Comfortable (easier to read). It changes both the PDF and the on-screen preview.</p>
</section>

<section id="tax-rates">
<h2>Custom tax rate presets</h2>
<p>The built-in GST rates are 0, 0.1, 0.25, 3, 5, 12, 18, 28 and 40%. Since 22 September 2025 most goods are at 5%, 18% or 40%; 12% and 28% stay for older invoices (see <a href="gst-basics.html#which-rate">GST basics: what rate do I charge?</a>). Add your own, such as 1.5% or 7.5%: type the numbers separated by commas, such as <code>1.5, 7.5</code>, and click ${ui('Add')}. Each must be between 0 and 100. They appear in the rate list on every invoice. The × next to a rate removes it.</p>
</section>

<section id="templates">
<h2>My saved templates</h2>
<p>Save your whole print setup under a name, so you can switch between setups (for example one for A4 and one for the receipt printer). ${ui('Reset defaults')} clears the saved templates too.</p>
<ol class="steps">
  <li><strong>Name it</strong>Type a name, such as <i>Retail v1</i>.</li>
  <li><strong>Save it</strong>Click ${ui('Save current as template')}. It appears in the list.</li>
</ol>
<p>${ui('Load')} brings one back after asking. It replaces your current settings, so save the current setup first if you want to keep it. The bin deletes a template.</p>
</section>

<section id="preview">
<h2>Live preview</h2>
<p>On the right of the tab (below the settings on a narrow screen). Three tabs: <b>📄 PDF (A4)</b>, <b>🖨 Thermal (80mm)</b>, and <b>⊞ Split view</b> with both side by side. It shows a sample invoice numbered TEST/PRINT/0001 with three items, using your business name, so terms and notes are not shown. Some settings, such as <a href="#pdf-font-scale">font scale</a>, only show in a downloaded PDF.</p>
</section>
`,
},
];
