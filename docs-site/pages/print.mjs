const ui = (s) => `<span class="ui">${s}</span>`;

export default [
{
  slug: 'print-settings',
  title: 'Print and PDF settings',
  nav: 'Print and PDF settings',
  lead: 'The app-wide defaults for how every invoice looks on paper and in a PDF: business-type presets, designs, thermal receipts, copies, watermarks, fonts, colours, languages and formats. Each invoice can still override the basics from its own Customize panel.',
  body: `
<section id="how-it-saves">
<h2>How these settings save</h2>
<p>Open ${ui('Settings')} and go to the <b>Print &amp; PDF</b> section. There is no Save button: every change is kept the moment you make it, and the <b>Live preview</b> on the right updates as you type. The preview uses a sample invoice with your business name, so you can see the effect without touching a real invoice.</p>
<p>Three buttons sit at the top:</p>
<table>
  <tr><td>${ui('Run setup wizard')}</td><td>Shows the first-run wizard again the next time the app is reloaded.</td></tr>
  <tr><td>${ui('Reset defaults')}</td><td>Puts <b>every</b> print setting back to how it was on a fresh install, straight away and without asking. That includes your saved templates, number prefixes, signature image and letterhead. Save a template first if you might want your setup back.</td></tr>
  <tr><td>${ui('Test Print')}</td><td>Sends a small 80 mm test print of the preview to your default printer. Use the <b>Thermal (80mm)</b> preview tab first; in Split view it reports that the preview is not ready.</td></tr>
</table>
</section>

<section id="business-type">
<h2>Business type</h2>
<p>Picking the kind of business you run sets 15 or so settings in one go, and hides options that do not apply to you. You are asked to confirm first, and every setting stays editable afterwards.</p>
<div class="table-wrap"><table>
  <tr><th>Business type</th><th>Set up for</th><th>Main settings it applies</th></tr>
  <tr><td>Retail Shop / Kirana</td><td>A counter with a thermal printer</td><td>Bold capitals, prints straight after saving, "Qty × Rate" lines, no HSN, "Thank you! Visit again!", cut mark and 2 feed lines</td></tr>
  <tr><td>Freelancer / Consultant</td><td>Professional A4 PDFs</td><td>Minimalist design, HSN, amount in words, page numbers and header on long invoices</td></tr>
  <tr><td>Restaurant / Cafe / Bar</td><td>80 mm receipts with a big UPI QR</td><td>Bold, prints on save, no HSN or amount in words, large UPI QR, 3 feed lines, "Thanks for dining with us!"</td></tr>
  <tr><td>Wholesale / Trading</td><td>GST copies of goods invoices</td><td>Classic design, three copies (ORIGINAL, DUPLICATE, TRIPLICATE), HSN, amount in words, darker print</td></tr>
  <tr><td>Manufacturing</td><td>Detailed A4 invoices</td><td>Corporate design, HSN, amount in words, page numbers and header, invoice QR, three copies</td></tr>
  <tr><td>Service / Repair Shop</td><td>Simple single-copy bills</td><td>Classic design, no HSN, amount in words, signature shown</td></tr>
</table></div>
<p>While a business type is chosen, options it does not need are hidden, and a note says so. ${ui('Show all options')} in that note clears the business type so you can see everything.</p>
<figure><img src="assets/img/app-print-settings.png" alt="Business types, designs and the live preview." loading="lazy"><figcaption>Business types, designs and the live preview.</figcaption></figure>
</section>

<section id="visual-style">
<h2>Visual style</h2>
<p>Eight ready-made designs set the colours and type for both PDFs and thermal receipts in one click. Each card shows a small preview in its own colours; the one in use is marked <b>ACTIVE</b>.</p>
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
<p>These four groups only affect 58 mm and 80 mm receipt printers. They are hidden when your business type prints A4 or A5 PDFs.</p>
<h3>Typography</h3>
<table>
  <tr><th>Setting</th><th>Options</th><th>Default</th></tr>
  <tr><td>Font family</td><td>Monospace (Courier), or sans-serif</td><td>Monospace</td></tr>
  <tr><td>Font size</td><td>Small, Medium, Large, Extra Large</td><td>Medium</td></tr>
  <tr><td>Font weight</td><td>Normal, Bold, Ultra bold. Thermal heads print bold much darker, so bold is recommended.</td><td>Bold</td></tr>
  <tr><td>ALL CAPS mode</td><td>Every line in capitals, like big supermarket receipts</td><td>Off</td></tr>
</table>
<h3>Layout</h3>
<table>
  <tr><td>Line spacing</td><td>Compact (saves paper), Normal, Comfortable</td><td>Normal</td></tr>
  <tr><td>Header alignment</td><td>Centre, or left</td><td>Centre</td></tr>
  <tr><td>Thermal ink darkness</td><td>Standard, Dark, Extra-dark. Darkens the logo and QR code for faded printers.</td><td>Standard</td></tr>
  <tr><td>Force ALL CAPS in header</td><td>Business name always in capitals</td><td>On</td></tr>
</table>
<h3>Content</h3>
<p>Each of these can be turned off: business logo, HSN code per item, the "Qty × Rate" line under each item, amount in words, bank details, and the UPI QR code. The QR comes in Small, Medium (the default) or Large. With both HSN and "Qty × Rate" off, items print as a compact single line.</p>
<h3>Footer</h3>
<table>
  <tr><td>Custom footer message</td><td>Printed above the cut line. Leave blank for none.</td><td>"Thank you for your business!"</td></tr>
  <tr><td>Show cut mark</td><td>Prints "✂ cut here", for printers without an automatic cutter</td><td>On</td></tr>
  <tr><td>Feed lines after cut</td><td>None, 1, 2, 3, 4 or 6 blank lines so the paper tears cleanly</td><td>2</td></tr>
  <tr><td>Show tagline</td><td>A line of your choice under the business name</td><td>Off</td></tr>
</table>
<p>For setting a printer up from scratch, see <a href="thermal-printing.html">Thermal receipt printing</a>.</p>
</section>

<section id="auto-print">
<h2>Auto-print on save</h2>
<p>With this on, ${ui('Save &amp; Download')} also sends the invoice straight to your default printer, with no extra click. Made for shop counters. Off by default.</p>
</section>

<section id="watermark">
<h2>Watermark</h2>
<p>A large, faint diagonal word across every page of the PDF. Turn on <b>Show watermark</b>, then choose either a ready-made word (PAID, DUPLICATE, DRAFT, OVERDUE, COPY, ORIGINAL, CANCELLED or REPRINT; DUPLICATE is selected by default) or your own text. <b>Opacity</b> ranges from very faint (5%) to very strong (40%); medium (15%) is the default.</p>
<p>If you choose your own text and leave the box empty, no watermark prints. Watermarks are never printed on thermal receipts. Cancelled invoices get their own CANCELLED mark whatever this setting says.</p>
</section>

<section id="copies">
<h2>Multiple copies (GST rule 48)</h2>
<p>GST rules expect three copies of an invoice for goods (for the buyer, the transporter and yourself) and two for services. Turn on <b>Print multiple copies with labels</b> and choose 2 or 3 (3 is the default). The PDF then holds every page once for each copy, labelled in a small box at the top right:</p>
<ul>
  <li>ORIGINAL FOR RECIPIENT</li>
  <li>DUPLICATE FOR TRANSPORTER</li>
  <li>TRIPLICATE FOR SUPPLIER</li>
</ul>
</section>

<section id="multi-page">
<h2>Invoices longer than one page</h2>
<table>
  <tr><td>Page numbers</td><td>Prints "Page 2 of 3" at the bottom right of the second page onwards. The first page is not numbered.</td><td>On</td></tr>
  <tr><td>Business name header on pages 2+</td><td>Repeats your business name, with a line under it, at the top of every page after the first</td><td>On</td></tr>
</table>
<p>Both only appear when an invoice runs to more than one page. Page breaks always fall between rows, and never through the signature, stamp or an image.</p>
</section>

<section id="margins">
<h2>Print margins</h2>
<p>Top, bottom, left and right, in millimetres, from 0 to 100 (all 0 to start). Use them for pre-printed letterhead, to move the invoice clear of a printed logo, or to leave room for binding.</p>
</section>

<section id="verification-codes">
<h2>Invoice QR and number</h2>
<ul>
  <li><strong>Invoice number as QR</strong>: an 18 mm QR code at the bottom right of the last page, captioned "Verify invoice". It holds the invoice number, or, if you give a <b>verification URL</b> such as <code>https://mycompany.com/verify/{invoice_number}</code>, that address with the number filled in.</li>
  <li><strong>Invoice number as barcode text</strong>: prints the invoice number large, in a typewriter font, at the bottom left of the last page, for filing. It is text, not a scannable barcode.</li>
</ul>
</section>

<section id="feedback-qr">
<h2>Feedback QR</h2>
<p>A QR code at the bottom left of the PDF that opens any web address you give it, such as your Google review page or a WhatsApp chat. It only prints once an address is entered. Its caption, "Rate us · Give feedback" unless you change it, prints under the code.</p>
</section>

<section id="signature">
<h2>Default signature</h2>
<p>A signature image (PNG, JPG, WebP or SVG, up to 2 MB) and signatory name used when a business has none of its own. With the name left blank, the business name is used. A signature and stamp uploaded in <a href="settings.html#branding">Settings</a> for a business take priority.</p>
</section>

<section id="terms-page">
<h2>Terms on a separate page</h2>
<p><b>Print T&amp;C on a separate page</b> moves long terms and notes to a page of their own, instead of squeezing them under the totals. Off by default.</p>
</section>

<section id="pdf-font">
<h2>PDF font, size and darkness</h2>
<table>
  <tr><td>PDF font</td><td>Helvetica (clean, the default), Times New Roman (formal), or Courier (typewriter style). Thermal receipts have their own font setting.</td></tr>
  <tr><td>Overall size</td><td>A slider from 80% to 140%. Smaller fits more on a page; larger is easier to read. The on-screen preview always shows 100%; download a PDF to see the result.</td></tr>
  <tr><td>Force darker text</td><td>Darkens grey labels and addresses so they do not fade on paper. On by default.</td></tr>
  <tr><td>Compact upper header</td><td>Tightens the space above the items table so more fits on the first page. Off by default.</td></tr>
  <tr><td>Row density</td><td>Compact, Normal or Comfortable spacing in tables and sections.</td></tr>
  <tr><td>Print quality</td><td>Draft (about half the file size, fine for email), Standard, or HD (sharpest, largest). HD is the default.</td></tr>
</table>
</section>

<section id="thermal-compatibility">
<h2>Thermal printer compatibility</h2>
<ul>
  <li><strong>Buffer-safe mode</strong>: for cheap or old receipt printers that jam on large print jobs. Prints in black and white at lower quality. Off by default.</li>
  <li><strong>Thermal print method</strong>: <b>Direct</b>, the default, sends sharp text straight to the printer. If your printer or browser mishandles it, choose <b>Via PDF</b>.</li>
</ul>
</section>

<section id="prefixes">
<h2>Number prefix for each document type</h2>
<p>Each document type numbers separately, with a built-in prefix: INV for tax invoices, EST for estimates, BOS for bills of supply, COMP for composition, CN for credit notes and DC for delivery challans. Type your own to replace one: letters, numbers, hyphens and underscores only, up to 8 characters. A new prefix starts its own count.</p>
</section>

<section id="reprint">
<h2>Reprint badge</h2>
<p>Once an invoice has been printed before, this prints a red "REPRINT · Copy #2" (and so on) at the top right of each page, so a copy cannot pass as the original. Off by default. The app counts every print either way.</p>
</section>

<section id="dual-currency">
<h2>Second currency</h2>
<p>For rupee invoices to clients abroad, shows the total in a second currency too: US dollars, euros, pounds, dirhams, Singapore or Australian dollars, or yen. You set the rate (83 rupees to the dollar to start); there is no live exchange rate. It can go on its own line or in brackets after the rupee amount.</p>
</section>

<section id="letterhead">
<h2>Letterhead</h2>
<p>Upload your printed letterhead as a picture (PNG, JPG or WebP, A4, up to 3 MB) and invoices print on top of it. <b>Hide invoice header block</b>, on by default, drops the app's own header so your details are not printed twice. The switch does nothing until an image is uploaded.</p>
</section>

<section id="template">
<h2>PDF layout template</h2>
<p>Modern (a coloured header, the default), Classic (conservative), Minimal (lots of white space), Corporate and Minimalist. Corporate and Minimalist are variations of Classic and Minimal. A design chosen under <a href="#visual-style">Visual style</a> sets this for you.</p>
</section>

<section id="colours">
<h2>Your own colours</h2>
<p>Turn on <b>Use custom colours</b> to set six colours with a picker or a hex code. ${ui('Reset colours to defaults')} undoes them.</p>
<table>
  <tr><td>Primary text</td><td>Client name, item names, totals</td></tr>
  <tr><td>Muted text</td><td>Labels, addresses, dates and numbers</td></tr>
  <tr><td>Accent colour</td><td>Section titles and the table header</td></tr>
  <tr><td>Accent text</td><td>Text on the accent colour, usually white</td></tr>
  <tr><td>Header background</td><td>Behind the business name and invoice title</td></tr>
  <tr><td>Divider lines</td><td>Lines between sections and table rows</td></tr>
</table>
</section>

<section id="labels-language">
<h2>Section labels and language</h2>
<p>Print the section labels in English, Hindi, Tamil, Marathi or Bengali. You can also type your own wording for six labels: BILL TO, PLACE OF SUPPLY, BANK DETAILS, AMOUNT IN WORDS, TERMS &amp; CONDITIONS and NOTES. Your own wording wins over the language.</p>
</section>

<section id="formats">
<h2>Dates, numbers and currency</h2>
<table>
  <tr><td>Date format</td><td>02 Apr 2026 (the default), 02-Apr-2026, 02/04/2026, 04/02/2026 (US), 2026-04-02, or ISO 8601</td></tr>
  <tr><td>Number grouping</td><td>1,00,000.00 (Indian, the default), 100,000.00 (Western), 100.000,00 (European)</td></tr>
  <tr><td>Decimal places</td><td>0, 2 (the default), 3 or 4</td></tr>
  <tr><td>Currency symbol</td><td>Before the number (₹100, the default) or after it</td></tr>
</table>
</section>

<section id="tax-rates">
<h2>Extra GST rates</h2>
<p>The built-in rates are 0, 5, 12, 18 and 28%. Add your own, such as 3% for jewellery or 0.25% for diamonds, as numbers separated by commas, and they appear in the rate list on every invoice.</p>
</section>

<section id="templates">
<h2>Saved templates</h2>
<p>Save your whole print setup under a name, such as "Retail v1", with ${ui('Save current as template')}. ${ui('Load')} brings one back after asking, and replaces your current settings, so save the current setup first if you want to keep it.</p>
</section>

<section id="preview">
<h2>The live preview</h2>
<p>Three tabs: <b>PDF (A4)</b>, <b>Thermal (80mm)</b>, and <b>Split view</b> with both side by side. It shows a sample invoice to TEST/PRINT/0001 with three items, using your business name, so terms and notes are not shown.</p>
</section>
`,
},
];
