const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

export default [
// =============================================================================
{
  slug: 'clients',
  title: 'Clients',
  lead: 'Everyone you bill, what each one owes, their account statement, and how quickly they pay.',
  body: `
<section id="client-list">
<h2>The client list</h2>
<p>${ui('Clients')} in the sidebar opens a list of everyone you sell to. Use it to see at a glance who owes you money, to open one client's account, and to keep their address and GSTIN ready for the next invoice.</p>
<p>Every client you have saved, and every name you have ever invoiced, appears as a card. The clients who owe you the most are at the top, so the people to call first are always first.</p>
<p>The buttons at the top of the screen:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Import CSV')}</td><td>Adds many clients at once from a spreadsheet. See <a href="#import-csv">Importing clients</a>.</td></tr>
  <tr><td>${ui('Add Client')}</td><td>Opens the client form for a new client. See <a href="#client-form">Adding and editing a client</a>.</td></tr>
  <tr><td>${ui('New Invoice')}</td><td>Opens a blank invoice.</td></tr>
</table></div>
<p><b>Search clients...</b> finds a client by any part of the name, in small or capital letters. The cross clears the search. If nothing matches, or you have no clients yet, you see <b>No clients found.</b> and a ${ui('Add Your First Client')} button.</p>
<p>Your client list is shared by all your businesses, since the same customer may buy from each.</p>
</section>

<section id="client-card">
<h3>What a client card shows</h3>
<div class="table-wrap"><table>
  <tr><th>On the card</th><th>Meaning</th></tr>
  <tr><td>Letter in a circle</td><td>The first letter of the name.</td></tr>
  <tr><td>Name</td><td>The client's name, exactly as written on the invoices.</td></tr>
  <tr><td><b>N invoices</b> | state | GSTIN</td><td>How many sales and credit notes they have, then the state and GSTIN of a saved client.</td></tr>
  <tr><td><b>Total</b></td><td>Everything you have billed them, less credit notes.</td></tr>
  <tr><td><b>Paid</b> (green)</td><td>What they have paid you on those invoices.</td></tr>
  <tr><td><b>Outstanding</b> (red)</td><td>What they still owe. TDS that the client deducted is not counted as owed, since they pay it to the government for you. Green ₹0 means all settled.</td></tr>
  <tr><td><b>Overpaid</b> (blue)</td><td>Shown instead of Outstanding when they paid more than they were billed. The extra can be used on <a href="invoices.html#client-credit">their next invoice</a>.</td></tr>
  <tr><td>${ui('View')} / ${ui('Hide')}</td><td>Click anywhere on the card to open or close the client's account.</td></tr>
</table></div>
<p>Only real sales count in these figures: Tax Invoices, Bills of Supply and Composition bills. Credit notes are subtracted. Quotations, proformas, delivery challans and cancelled invoices are left out, because nobody owes money on them.</p>
</section>

<section id="unsaved-clients">
<h3>Names you invoiced but never saved</h3>
<p>An invoice can go to a name that is not in your saved list, for example a walk-in customer. That name still gets a card, so you can see what they owe, but it shows no state or GSTIN. Open the card and click ${ui('Save as Client')} at the bottom to save them: the form opens with the name filled in.</p>
<div class="note tip"><strong>Something wrong?</strong><p><b>One client shows as two cards.</b> Cards are matched by name. "Sharma Traders" and "Sharma Traders Pvt Ltd" are two different names, so they make two cards. If you renamed a saved client, old invoices keep the name they were made with and stay on a card of their own. Small and capital letters do not matter.</p><p><b>A client is missing.</b> Clear the search box. A client with no saved record and no invoices does not exist yet: add them with ${ui('Add Client')}.</p></div>
</section>

<section id="client-form">
<h2>Adding and editing a client</h2>
<p>Save a client once and you never type their details again: on a new invoice, pick them from the list under <b>Client Name</b> and their address, state, GSTIN and preferences are filled in.</p>
<ol class="steps">
  <li><strong>Open the form</strong>Click ${ui('Add Client')} at the top of the Clients screen. To change a saved client, open their card and click ${ui('Edit Client')}. The same form opens from the invoice screen, from the pencil next to a saved client or when you save a new one there.</li>
  <li><strong>Fill in the name</strong><b>Client / Business Name</b> is the only required field. Use the name you want printed on the invoice.</li>
  <li><strong>Address and state</strong>Fill in the address, choose the country (it starts as your own) and the state. The state decides whether GST is CGST + SGST or IGST, so get it right.</li>
  <li><strong>GSTIN</strong>For a registered business, type their 15-character GSTIN. When you click out of the box it is checked (see below).</li>
  <li><strong>Save</strong>Click ${ui('Save Client')}, or ${ui('Update Client')} when editing. You see "Client added" or "Client updated" and the card appears in the list. ${ui('Cancel')} or the cross at the top closes the form without saving.</li>
</ol>
<p>The fields:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Client / Business Name *</td><td>Required. If it is blank, nothing is saved.</td></tr>
  <tr><td>Address</td><td>Street address and locality, printed on the invoice.</td></tr>
  <tr><td>Country</td><td>Starts as your own business's country. Changing it clears the state, since each country has its own list. A client outside India is billed as an export, charged as IGST: see <a href="invoices.html#gst">How GST is worked out</a>.</td></tr>
  <tr><td>City</td><td>Printed with the address.</td></tr>
  <tr><td>PIN Code</td><td>The label changes with the country, such as ZIP Code or Postcode.</td></tr>
  <tr><td>State</td><td>A list for India; a text box for countries without a list. The label changes with the country too, such as Emirate or County.</td></tr>
  <tr><td>GSTIN</td><td>The client's GST number. Leave it blank for an unregistered customer (a B2C sale). For other countries the box asks for their tax number, such as TRN or VAT Number.</td></tr>
  <tr><td>Email</td><td>Used as the "To" address when you email an invoice from the client's account.</td></tr>
  <tr><td>Phone</td><td>Used for WhatsApp. Write it with the country code, such as +91 98765 43210.</td></tr>
  <tr><td>SEZ unit / Developer</td><td>India only. See <a href="#client-sez">SEZ clients</a>.</td></tr>
  <tr><td>Print preferences (optional)</td><td>Preferred paper size, currency and auto-print for this client. See <a href="#client-print-prefs">Print preferences</a>.</td></tr>
</table></div>
<p>Changing a client's details does not change invoices already made: each invoice keeps the details it was saved with. To correct one, open it, pick the client again under <b>Client Name</b>, and save.</p>
</section>

<section id="foreign-client">
<h3>Clients abroad</h3>
<p>Pick the client's country. For a country other than India:</p>
<ul>
  <li>No GSTIN and no state are needed. The state box is marked optional, and the postal code box takes that country's name for it (ZIP Code, Postcode...).</li>
  <li>The tax ID box is named after their country's tax ID (VAT Number, EIN / TIN, TRN...). If the client gave you one, type it: it prints on the invoice with that name. It is optional.</li>
  <li>Their country prints under their address, and the place of supply prints as <i>Outside India (country)</i>, because an export is supplied outside India.</li>
  <li><b>Preferred currency</b> lists every currency the app knows. Left blank, invoices to them start in their country's currency. See <a href="invoices.html#currency">Billing in another currency</a>.</li>
</ul>
<p>Billing such a client is an export: see <a href="gst-basics.html#exports">Exports and foreign clients</a> and <a href="gst-basics.html#lut">LUT</a>.</p>
</section>

<section id="client-gstin">
<h3>The GSTIN check</h3>
<p>A GSTIN is the 15-character GST number of a registered business. Its first two digits are the state code (03 is Punjab, 27 is Maharashtra), the next ten are the PAN, and the last is a check character. When you click out of the GSTIN box, the app reads it. This works offline; nothing is looked up on the GST portal.</p>
<div class="table-wrap"><table>
  <tr><th>What happens</th><th>Meaning</th></tr>
  <tr><td>The State fills in by itself</td><td>The state was blank, so it was taken from the first two digits.</td></tr>
  <tr><td>⚠ GSTIN format looks unusual. Expected like: 22AAAAA0000A1Z5</td><td>It is not 15 characters in the GSTIN pattern. Check for a missing or extra character, or the letter O typed for zero.</td></tr>
  <tr><td>⚠ This GSTIN fails its own checksum — check for a typo.</td><td>The pattern is right but the last character does not add up, so a character is almost certainly mistyped.</td></tr>
  <tr><td>⚠ This GSTIN is registered in <i>state</i>, but the state says <i>other state</i>.</td><td>Either the GSTIN or the state you chose is wrong. Check with the client.</td></tr>
</table></div>
<p>The box turns amber while there is a warning. Warnings never stop you saving. Small letters are turned into capitals as you type. The same check runs on the invoice: see <a href="invoices.html#gstin-check">What the GSTIN check tells you</a>.</p>
</section>

<section id="client-state">
<h3>Why the state matters (place of supply)</h3>
<p>The <b>place of supply</b> is where a sale is treated as happening for GST. For most sales it is the client's state:</p>
<ul>
  <li>Client in <strong>your own state</strong>: the invoice charges <b>CGST + SGST</b> (half each).</li>
  <li>Client in <strong>another state</strong>, an SEZ, or abroad: the invoice charges <b>IGST</b>.</li>
</ul>
<p>A wrong state on the client quietly gives the wrong tax on every invoice to them, and puts the sale in the wrong place in GSTR-1. If goods go somewhere other than the client's address, set <b>Place of Supply</b> on that invoice instead. See <a href="invoices.html#gst">How GST is worked out</a> and the <a href="glossary.html#terms">glossary</a>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>IGST where you expected CGST + SGST, or the other way round: check the client's state here, your own state in <a href="settings.html#company-details">Settings</a>, and the place of supply on the invoice. See <a href="troubleshooting.html#wrong-tax">The invoice has the wrong tax split</a>.</p></div>
</section>

<section id="client-sez">
<h3>SEZ clients</h3>
<p>Tick <b>SEZ unit / Developer</b> for a client in a Special Economic Zone. Supplies to them are charged IGST whatever their state, even if they are in your own state (section 16 of the IGST Act). The box only shows when the country is India.</p>
</section>

<section id="client-print-prefs">
<h3>Print preferences</h3>
<p>Some clients always want the same thing: a thermal receipt, an A5 bill, or an invoice in dollars. Set it once here and every new invoice for them starts that way. All three are optional; leave them blank to use your normal settings.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What it does</th></tr>
  <tr><td>Preferred paper size</td><td>A4, A5, US Letter, 80mm or 76mm thermal and the other sizes. <b>Use app default</b> keeps your usual size.</td></tr>
  <tr><td>Preferred currency</td><td>INR, USD, EUR, GBP, AED, SGD or AUD. <b>Use invoice default</b> keeps the invoice's normal currency.</td></tr>
  <tr><td>Auto-print on save for this client</td><td>Sends the invoice to the printer each time you save one for this client, even if auto-print is off in <a href="print-settings.html#auto-print">Print Settings</a>.</td></tr>
</table></div>
<p>They are applied when you pick this client on a new invoice. You can still change them on that invoice.</p>
<p>The app also learns: each time you save an invoice for a saved client, the paper size and currency that invoice used become the client's preferred ones. So if you change one invoice to thermal, the next one for that client starts as thermal too.</p>
</section>

<section id="ledger">
<h2>A client's account</h2>
<p>Click a client's card to open their account. It shows everything about this one client in one place.</p>
<figure><img src="${img('app-clients.png')}" alt="A client opened, with their invoices, ageing strip and PDFs." loading="lazy"><figcaption>A client opened, with their invoices, ageing strip and PDFs.</figcaption></figure>
<p>From top to bottom:</p>
<ol>
  <li>${ui('Statement PDF')} and ${ui('Aging PDF')}: see <a href="#statement">Statement and ageing PDFs</a>.</li>
  <li>The <b>Aging</b> strip, when they owe you anything: see <a href="#ageing">Ageing</a>.</li>
  <li>Their address, email and phone, if saved.</li>
  <li>All their invoices, newest first.</li>
  <li>${ui('Edit Client')} and ${ui('Delete Client')}, or ${ui('Save as Client')}.</li>
</ol>
<p>A client with no invoices shows <b>No invoices for this client yet.</b> and a ${ui('Create Invoice')} button.</p>
</section>

<section id="client-invoices">
<h3>The invoice rows</h3>
<p>Each row has the <b>Date</b>, <b>Invoice No.</b>, <b>Type</b> (Tax Invoice, Quotation, Credit Note and so on), <b>Amount</b>, <b>Status</b> and these buttons:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>Edit Invoice (pencil)</td><td>Opens the invoice on the invoice screen to change it.</td></tr>
  <tr><td>Duplicate Invoice</td><td>A new invoice with the same client and items, a new number and today's date.</td></tr>
  <tr><td>WhatsApp</td><td>Opens WhatsApp with a short message: invoice number, amount, date and status. It goes to the phone number saved on that invoice. The PDF is not attached; send it from the invoice screen if you need it (see <a href="invoices.html#whatsapp">WhatsApp</a>).</td></tr>
  <tr><td>Email</td><td>Opens your email program with a message about the invoice, addressed to the client's saved email.</td></tr>
  <tr><td>Delete Invoice (bin)</td><td>Asks first, then moves the invoice to the Trash for 30 days and puts its stock back.</td></tr>
</table></div>
<p>A row past its due date and not paid is highlighted as overdue.</p>
<p>Deleted by mistake? Restore it from <a href="backup.html#trash">Settings, Trash bin</a> within 30 days. For an invoice already given to the client, <a href="dashboard.html#cancel">cancel it</a> on the Dashboard instead of deleting, so its number stays in your records.</p>
</section>

<section id="client-status">
<h3>Changing the status</h3>
<p>The coloured box in the <b>Status</b> column is a dropdown: <b>Unpaid</b>, <b>Partial</b>, <b>Paid</b> or <b>Overdue</b>. It works as on the Dashboard:</p>
<ul>
  <li><strong>Paid</strong> records a payment for the rest of the balance, so the client's Paid and Outstanding update.</li>
  <li><strong>Unpaid</strong> on a paid invoice takes back the payment that marking it Paid recorded. Payments you recorded yourself stay.</li>
  <li><strong>Partial</strong> and <strong>Overdue</strong> only change the label. To record part of a payment with its amount and mode, use the ${ui('₹')} button on the <a href="dashboard.html#payments">Dashboard</a>.</li>
</ul>
<p>A cancelled invoice shows <b>Cancelled</b> and cannot be changed here; undo the cancel from the Dashboard. See <a href="dashboard.html#status">Status</a>.</p>
</section>

<section id="client-actions">
<h3>Edit, delete or save the client</h3>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Edit Client')}</td><td>Opens the <a href="#client-form">client form</a> with their details.</td></tr>
  <tr><td>${ui('Delete Client')}</td><td>Asks <b>Remove this saved client?</b>, then removes them from your saved list. Their invoices stay untouched, and the name still shows as a card while it has invoices. You can add them again any time.</td></tr>
  <tr><td>${ui('Save as Client')}</td><td>Shown instead of the two above for a name you invoiced but never saved. Opens the form with the name filled in.</td></tr>
</table></div>
<div class="note tip"><strong>Something wrong?</strong><p><b>WhatsApp opens but not to the client's chat.</b> The phone number on the invoice needs the country code: 919876543210 or +91 98765 43210, not just 98765 43210. Fix it with ${ui('Edit Client')}. For an invoice already made, open it, pick the client again under <b>Client Name</b> and save, so it carries the new number.</p><p><b>Email opens with an empty "To".</b> The client has no email saved. Add it with ${ui('Edit Client')}.</p></div>
</section>

<section id="ageing">
<h2>Ageing: who is slow to pay</h2>
<p>When a client owes you money, an <b>Aging</b> strip under the PDF buttons splits what they owe by how late it is:</p>
<div class="table-wrap"><table>
  <tr><th>Group</th><th>Holds unpaid amounts that are</th></tr>
  <tr><td><b>Current</b> (green)</td><td>Not yet due, or up to 30 days past due</td></tr>
  <tr><td><b>31-60d</b> (amber)</td><td>31 to 60 days late</td></tr>
  <tr><td><b>61-90d</b> (orange)</td><td>61 to 90 days late</td></tr>
  <tr><td><b>90+ d</b> (red)</td><td>More than 90 days late. Call these first.</td></tr>
</table></div>
<p>Lateness is counted from the invoice's <b>due date</b>, or from the invoice date when it has none. Only unpaid sales are counted; TDS the client deducted is not. The strip is hidden when nothing is owed.</p>
<div class="note info"><p>The strip adds up unpaid invoices one by one, and does not take credit notes off them. So if the client has a credit note, the strip can total more than <b>Outstanding</b> on the card.</p></div>
<p>To see ageing for all clients together, use <a href="reports.html#outstanding">Reports, Outstanding</a> or <a href="reports.html#party-outstanding">Party Outstanding</a>.</p>
</section>

<section id="statement">
<h2>Statement and ageing PDFs</h2>
<p>Two buttons at the top of an opened client make PDFs you can send them or keep. Each one downloads straight away, and you see "Statement PDF generated" or "Aging report for <i>name</i> downloaded". If you set your own PDF colours in <a href="print-settings.html#colours">Print Settings</a>, the coloured bands and lines follow them.</p>
</section>

<section id="statement-pdf">
<h3>Statement PDF</h3>
<p>The client's whole account, like a bank passbook. Send it when a client disputes a bill or asks "how much do I owe?". It contains:</p>
<ul>
  <li>Your business (<b>FROM</b>) and theirs (<b>BILL TO</b>), with addresses and GSTINs.</li>
  <li>A summary: <b>Invoices</b>, <b>Total Billed</b>, <b>Paid</b> and <b>Outstanding</b>.</li>
  <li>A table with <b>Date</b>, <b>Particulars</b> (number and type), <b>Debit</b>, <b>Credit</b> and <b>Balance</b>, oldest first. Each invoice is a debit. Under it, what was paid against it shows as <i>Payment recd against above</i>, and TDS they deducted as <i>TDS deducted by client</i>, both as credits. A credit note is a credit.</li>
  <li>The running balance after each line, marked <b>Dr</b> (they owe you, in red) or <b>Cr</b> (you owe them, in green), and the <b>CLOSING BALANCE</b>.</li>
  <li>A line for your signature and a note asking them to confirm within 7 days.</li>
</ul>
<p>It covers all their invoices, from an opening balance of zero. Quotations, proformas, challans and cancelled invoices are left out. Amounts print as "Rs." because the PDF font has no ₹ sign. The file is named like <code>statement-Sharma-Traders-2026-10-29.pdf</code>.</p>
</section>

<section id="aging-pdf">
<h3>Aging PDF</h3>
<p>Only what is still unpaid, for collection calls. It lists each unpaid invoice with its <b>Invoice #</b>, <b>Date</b>, <b>Due</b> date, <b>Age</b> in days, <b>Total</b> and <b>Outstanding</b>. Amounts more than 60 days old are in red. Below the list, an <b>AGING SUMMARY</b> gives the four groups (0–30, 31–60, 61–90 and 90+ days) and the <b>TOTAL OUTSTANDING</b>. The file is named like <code>Aging-Sharma_Traders-2026-10-29.pdf</code>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"No invoices for this client" or "<i>name</i> has no outstanding balance.": there is nothing to put in that PDF. A paid-up client has no Aging PDF.</p><p>Nothing downloads: your browser may be asking where to save, or blocking downloads from the app. Allow downloads, then click again.</p><p>The balance looks wrong: check that each payment was recorded on the right invoice, and that quotations were converted into invoices. See <a href="dashboard.html#payments">Recording a payment</a>.</p></div>
</section>

<section id="import-csv">
<h2>Importing clients from a spreadsheet</h2>
<p>Moving from another program or an Excel list? ${ui('Import CSV')} adds many clients at once, one per row.</p>
<ol class="steps">
  <li><strong>Open the window</strong>Click ${ui('Import CSV')} on the Clients screen. The window <b>Import clients</b> opens.</li>
  <li><strong>Get the sample file</strong>Click ${ui('Download sample file')}. <code>Clients-sample.csv</code> lands in your Downloads folder, with the right column headings and two demo clients.</li>
  <li><strong>Fill it in</strong>Open it in Excel or Google Sheets. Replace the demo rows with your clients, one per row. Keep the first row (the headings) as it is.</li>
  <li><strong>Save as CSV</strong>In Excel, <b>File → Save As → CSV UTF-8 (Comma delimited)</b> or <b>CSV (Comma delimited)</b>. In Google Sheets, <b>File → Download → Comma-separated values</b>.</li>
  <li><strong>Choose the file</strong>Click ${ui('Choose file')}. Nothing is saved yet: the window shows how many clients are new and how many are already in your list (skipped).</li>
  <li><strong>Import</strong>Click ${ui('Import')} (such as <b>Import 12</b>). You see "Imported 12 clients", and the new cards appear.</li>
</ol>
<p><b>From Excel or Vyapar:</b> you can choose an Excel file (<code>.xlsx</code>) instead of a CSV, such as the party list Vyapar exports. If the file has several sheets, pick the one with your parties under <b>Sheet</b>.</p>
<p><b>From Tally:</b> in Tally, go to <b>Gateway of Tally → Export → Masters</b>, choose format <b>XML</b> and export. Choose that <code>.xml</code> file here. Your ledgers under <b>Sundry Debtors</b> and <b>Sundry Creditors</b> come in as clients, with GSTIN, state, address, phone and email. Other ledgers (cash, bank, sales, expenses) are left out. Old vouchers stay in Tally.</p>
<p>The columns (headings in small or capital letters, in any order):</p>
<div class="table-wrap"><table>
  <tr><th>Column heading</th><th>Holds</th></tr>
  <tr><td><code>Name</code> (or <code>Client</code>, <code>Client Name</code>, <code>Customer</code>)</td><td>Required. Rows without a name are skipped.</td></tr>
  <tr><td><code>GSTIN</code></td><td>Optional. Leave blank for a client without GST.</td></tr>
  <tr><td><code>Phone</code> (or <code>Mobile</code>), <code>Email</code></td><td>Optional</td></tr>
  <tr><td><code>Address</code></td><td>Optional</td></tr>
  <tr><td><code>State</code></td><td>Optional. Write it in full, as in the app's list (Punjab, not PB).</td></tr>
</table></div>
<p>The sample file looks like this:</p>
<pre><code>Name,GSTIN,Phone,Email,Address,State
Demo Traders,27AAAAA0000A1Z5,9800000001,accounts@demo-traders.example,"Shop 4, Demo Market, Pune",Maharashtra
Sample Studio,,9800000002,hello@sample-studio.example,"12 Sample Street, Kolkata",West Bengal</code></pre>
<p>Clients you already have (same name, any capitals) are skipped, and so are repeats inside the file, so importing the same file twice is safe. Other columns, such as city or PIN, are ignored: add them later with ${ui('Edit Client')}. Imported GSTINs are not checked; open the client and click into the GSTIN box and out again to check one.</p>
<div class="note info"><p><b>Old invoices</b> are imported on the Dashboard, with ${ui('CSV import / export')}: it can add their clients to this list at the same time. See <a href="dashboard.html#csv">Importing and exporting invoices as CSV</a>.</p></div>
<div class="note tip"><strong>Something wrong?</strong><p>Nothing is read: the file is not a plain CSV, or the headings are not in the first row. An <code>.xlsx</code> file renamed to <code>.csv</code> does not work. See <a href="troubleshooting.html#csv-import">A CSV import did not work</a>.</p><p>An address with a comma in it must be inside double quotes, <code>"12, MG Road"</code>. Excel does this for you when it saves as CSV.</p></div>
</section>
`,
},
];
