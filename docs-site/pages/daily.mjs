const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;

export default [
// =============================================================================
{
  slug: 'dashboard',
  title: 'Dashboard',
  lead: 'Your invoices at a glance: what you have sold, what you are owed, what is overdue, and every action you can take on an invoice.',
  body: `
<section id="header">
<h2>At the top</h2>
<p>The count beside the title is every document for the business selected in the sidebar, including estimates, challans and cancelled invoices. ${ui('New Invoice')} starts a blank invoice.</p>
<figure><img src="assets/img/app-dashboard.png" alt="The Dashboard with an overdue invoice, the four totals and low stock." loading="lazy"><figcaption>The Dashboard with an overdue invoice, the four totals and low stock.</figcaption></figure>
</section>

<section id="getting-started">
<h2>The Getting started list</h2>
<p>New installs show four steps. Each ticks itself off once you have really done it, and has a button that takes you there:</p>
<table>
  <tr><th>Step</th><th>Done when</th><th>Button</th></tr>
  <tr><td>Add your business details</td><td>A business name is saved</td><td>${ui('Open Settings')}</td></tr>
  <tr><td>Make your first invoice</td><td>Any invoice exists</td><td>${ui('Start')}</td></tr>
  <tr><td>Add your products or services</td><td>At least one product is saved</td><td>${ui('Open')}</td></tr>
  <tr><td>Add bank details or UPI</td><td>A bank account or UPI ID is saved</td><td>${ui('Open Settings')}</td></tr>
</table>
<p>It disappears when all four are done, or when you close it with ${ui('✕')}. <b>Read the 5-minute guide</b> opens the User Guide.</p>
<figure><img src="${img('getting-started.png')}" alt="The Getting started list with three of four steps done"></figure>
</section>

<section id="overdue">
<h2>Overdue invoices and reminders</h2>
<p>When any invoice is overdue, a red banner shows how many and how much is outstanding. Click the banner to show only overdue invoices.</p>
<p>${ui('Remind All')} lists each overdue invoice with the client, amount and phone number. ${ui('Remind')} opens WhatsApp with a polite reminder already written, such as "Invoice INV/0012 for ₹11,800 was due on 5 Sep 2026. Kindly arrange the payment…".</p>
</section>

<section id="totals">
<h2>The four totals</h2>
<table>
  <tr><td><b>Total Invoiced</b></td><td>The total of your sales, including GST</td></tr>
  <tr><td><b>Tax Collected</b></td><td>The GST on those sales</td></tr>
  <tr><td><b>Outstanding</b></td><td>What clients still owe on unpaid and part-paid invoices</td></tr>
  <tr><td><b>Invoices</b></td><td>How many sales documents there are</td></tr>
</table>
<p>They cover only the selected business and only real sales. Tax invoices, bills of supply and composition bills count. Credit notes are subtracted. Proforma estimates, delivery challans and cancelled invoices are left out. Foreign-currency sales are shown on their own line, never added to rupees.</p>
</section>

<section id="low-stock">
<h2>Low stock</h2>
<p>If alerts are on in <a href="settings.html#stock">Settings</a>, products at or below your threshold are listed, with <b>Out of Stock</b> in red or the number left in amber. Click one to open Products.</p>
</section>

<section id="invoice-list">
<h2>Finding an invoice</h2>
<table>
  <tr><td>Search</td><td>By client name or invoice number</td></tr>
  <tr><td>Financial year</td><td>All years, or one of the last five</td></tr>
  <tr><td>Type</td><td>Any of the six document types</td></tr>
  <tr><td>Status</td><td>Unpaid, Partial, Paid or Overdue</td></tr>
  <tr><td>From / To</td><td>A range of invoice dates</td></tr>
</table>
<p>${ui('✕')} clears all filters at once.</p>
</section>

<section id="columns">
<h2>Choosing the columns</h2>
<p>${ui('Columns')} lets you show or hide: Date, Invoice #, Type, Client, Amount, Currency, Status, Due date, Print count and Actions. Currency, due date and print count are hidden to start. The <b>Paid</b> column is always shown. Your choice is remembered.</p>
<p>A yellow note icon next to a client means the invoice has a private note. Point at it to read it.</p>
</section>

<section id="status">
<h2>Status</h2>
<p>Each invoice is <b>Unpaid</b>, <b>Partial</b>, <b>Paid</b>, <b>Overdue</b> or <b>Cancelled</b>. Recording payments sets it for you. Each time the Dashboard opens, unpaid and part-paid invoices past their due date become Overdue, and the row shows how many days late they are.</p>
<p>You can also change it from the dropdown on the row. Choosing <b>Paid</b> records a payment for the rest of the balance, so your payment history stays complete.</p>
</section>

<section id="payments">
<h2>Recording a payment</h2>
<ol class="steps">
  <li><strong>Open it</strong>Click the ${ui('₹')} Payment button on the invoice. The top line shows the total, what is paid, and the balance.</li>
  <li><strong>Fill it in</strong>Enter <b>Amount Received</b>, the <b>Payment Date</b> (today to start), the <b>Payment Mode</b> (Bank Transfer, UPI, Cash, Cheque, Card or Other), and a note such as the transaction ID.</li>
  <li><strong>Record it</strong>Click ${ui('Record Payment')}. The status becomes Partial or Paid, and a printable receipt opens.</li>
</ol>
<p>If the amount is more than the balance, you are asked whether to record it as an overpayment. The extra is kept as the client's credit, to use on <a href="invoices.html#client-credit">their next invoice</a>.</p>
<p>Under <b>Payment History</b>, each payment has ${ui('Receipt')} to reprint it, a pencil to edit it, and a bin to delete it. The status is worked out again after any change.</p>
<figure><img src="assets/img/app-payment.png" alt="Recording the rest of a part-paid invoice. The earlier payment is under Payment History." loading="lazy"><figcaption>Recording the rest of a part-paid invoice. The earlier payment is under Payment History.</figcaption></figure>
</section>

<section id="receipt">
<h2>The payment receipt</h2>
<p>It shows your business details, <b>PAYMENT RECEIPT</b>, the receipt number, date, invoice, payment mode and note, "Received with thanks from" the client, the amount (in words for rupees), the invoice total, total paid and balance, and signature lines. ${ui('Print Receipt')} prints it on A5.</p>
</section>

<section id="row-actions">
<h2>What you can do with an invoice</h2>
<table>
  <tr><td>Edit</td><td>Opens it on the invoice screen.</td></tr>
  <tr><td>Duplicate</td><td>A new invoice with the same client and items, a new number and today's date.</td></tr>
  <tr><td>Convert to Tax Invoice</td><td>Proformas and delivery challans only. See <a href="invoices.html#proforma-to-invoice">Turning a quote into an invoice</a>.</td></tr>
  <tr><td>₹ Payment</td><td>Record a payment, as above.</td></tr>
  <tr><td>WhatsApp</td><td>On a phone, attaches the PDF through your phone's share menu. On a computer, WhatsApp does not let websites attach files, so it sends the details as text; download the PDF and drop it into the chat.</td></tr>
  <tr><td>Send reminder</td><td>Shown for unpaid, part-paid and overdue invoices. Opens WhatsApp with a reminder suited to the situation.</td></tr>
  <tr><td>Email</td><td>Opens your email program with the subject and a short message. Add the address and attach the PDF yourself.</td></tr>
  <tr><td>Cancel</td><td>See <a href="#cancel">Cancelling an invoice</a>.</td></tr>
</table>
</section>

<section id="cancel">
<h2>Cancelling an invoice</h2>
<p>${ui('Cancel')} asks first, then marks the invoice cancelled. It keeps its number, which GST requires, but no longer counts in totals, reports or GST returns, and any stock it used goes back.</p>
<p>To undo it, change the status on the row back to Unpaid, Paid or another status. The stock is taken out again. A cancelled invoice is never shown as overdue.</p>
</section>

<section id="quick-print">
<h2>Printing many invoices as one PDF</h2>
<p>The <b>Quick print</b> buttons combine invoices from the list as it is currently filtered into one PDF, one invoice per page:</p>
<ul>
  <li>${ui('All shown')}: every invoice in the list</li>
  <li>${ui('Unpaid')}: only those marked Unpaid, not part-paid or overdue</li>
  <li>${ui('Overdue')} and ${ui('Paid')}</li>
</ul>
<p>For more than five invoices, a message shows how far it has got. For more than 100, you are asked first.</p>
</section>

<section id="bulk">
<h2>Ticking several invoices</h2>
<p>Tick the box on each row, or the box in the header for every visible row. A bar appears with:</p>
<table>
  <tr><td>${ui('Mark paid')}, ${ui('Mark unpaid')}, ${ui('Mark overdue')}</td><td>Change them all, after asking. Mark paid records a payment for each balance.</td></tr>
  <tr><td>${ui('Export JSON')}</td><td>Saves the ticked invoices to a file, which can be imported as a backup.</td></tr>
  <tr><td>${ui('Bulk PDF')}</td><td>Combines the ticked invoices into one PDF, useful for your CA or for filing. ${ui('Cancel')} stops it part-way and keeps what is done.</td></tr>
  <tr><td>${ui('Cancel invoices')}</td><td>Cancels the ticked invoices, after asking, and puts their stock back. Marking cancelled invoices as anything else brings them back and takes the stock out again.</td></tr>
</table>
<p>Ticks stay when you change the filters, so check the count before acting.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'clients',
  title: 'Clients',
  lead: 'Everyone you bill, what each one owes, their account statement, and how quickly they pay.',
  body: `
<section id="client-list">
<h2>The client list</h2>
<p>Every client you have saved, and every name you have invoiced, appears as a card, with the ones who owe the most at the top. <b>Search clients…</b> finds them by name.</p>
<p>Each card shows the number of invoices, the state and GSTIN, and three figures: <b>Total</b>, <b>Paid</b>, and <b>Outstanding</b> in red, or <b>Overpaid</b> in blue if they have paid too much. Click a card to open it.</p>
<p>Your client list is shared by all your businesses, since the same customer may buy from each.</p>
</section>

<section id="client-form">
<h2>Adding and editing a client</h2>
<p>${ui('Add Client')} opens the form. The same form opens from the invoice screen.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Client / Business Name</td><td>Required</td></tr>
  <tr><td>Address, City, PIN Code</td><td>The postal label changes with the country</td></tr>
  <tr><td>Country</td><td>Starts as your own country. Changing it clears the state.</td></tr>
  <tr><td>State</td><td>A list for India, a text box for countries without one</td></tr>
  <tr><td>GSTIN</td><td>Checked when you leave the box, as on the invoice: the state is filled in if blank, and typos and a mismatched state are pointed out. See <a href="invoices.html#gstin-check">What the GSTIN check tells you</a>.</td></tr>
  <tr><td>Email, Phone</td><td>The phone number is used for WhatsApp</td></tr>
  <tr><td>SEZ unit / Developer</td><td>India only. Charges IGST whatever their state, under section 16 of the IGST Act.</td></tr>
</table></div>
<p>Under <b>Print preferences (optional)</b>, a client can have a <b>preferred paper size</b>, a <b>preferred currency</b> and <b>Auto-print on save</b>. They are applied whenever you pick this client on a new invoice.</p>
</section>

<section id="ledger">
<h2>A client's account</h2>
<p>Open a card to see all their invoices, newest first, with date, number, type, amount and status. Each row has buttons to edit, duplicate, share on WhatsApp, email or delete it. The status can be changed from the row too; choosing Paid records a payment for the balance, as on the Dashboard.</p>
<p>At the bottom: ${ui('Edit Client')} and ${ui('Delete Client')}, or, for a name that was never saved, ${ui('Save as Client')}. Deleting a client only removes them from your saved list; their invoices stay.</p>
<p>Deleting an invoice here moves it to the Trash for 30 days. It can be restored from <a href="backup.html#trash">Settings, Trash bin</a>. For an invoice already given to a client, <a href="dashboard.html#cancel">cancel it</a> instead, so its number stays in your records.</p>
<figure><img src="assets/img/app-clients.png" alt="A client opened, with their invoices, ageing strip and PDFs." loading="lazy"><figcaption>A client opened, with their invoices, ageing strip and PDFs.</figcaption></figure>
</section>

<section id="ageing">
<h2>Ageing: who is slow to pay</h2>
<p>When a client owes money, a strip shows it split by how late it is: <b>Current</b> (up to 30 days), <b>31-60 days</b>, <b>61-90 days</b> and <b>90+ days</b>. Lateness is counted from the due date, or from the invoice date when there is none.</p>
</section>

<section id="statement">
<h2>Statement and ageing PDFs</h2>
<ul>
  <li><strong>Statement PDF</strong>: their whole account, from your business to theirs. It has a summary of invoices, total billed, paid and outstanding, then every invoice, credit note and payment with a running balance marked Dr (they owe you) or Cr (you owe them), and a closing balance. Send it when a bill is disputed.</li>
  <li><strong>Aging PDF</strong>: only what is outstanding, invoice by invoice, with how many days old each is, and totals for each group. Amounts over 60 days are in red. Useful for collection calls.</li>
</ul>
</section>

<section id="import-csv">
<h2>Importing clients from a spreadsheet</h2>
<p>${ui('Import CSV')} adds clients from a CSV file, one per row. Save your spreadsheet as CSV first. The first row must name the columns:</p>
<table>
  <tr><th>Column heading</th><th>Holds</th></tr>
  <tr><td><code>name</code> (or <code>client</code>, <code>client name</code>)</td><td>Required. Rows without a name are skipped.</td></tr>
  <tr><td><code>address</code>, <code>state</code>, <code>gstin</code>, <code>email</code>, <code>phone</code></td><td>Optional</td></tr>
</table>
<pre><code>name,address,state,gstin,email,phone
Sharma Traders,12 MG Road,Punjab,03AAAAA0000A1Z5,accounts@sharma.example,9876543210</code></pre>
<p>Every row becomes a new client, so importing the same file twice gives you two of each. Other columns, such as city or PIN, are ignored.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'products',
  title: 'Products and stock',
  nav: 'Products and stock',
  lead: 'Save what you sell once, then pick it on every invoice. Stock goes down as you sell and up as you buy.',
  body: `
<section id="product-list">
<h2>The product list</h2>
<p>${ui('Products')} in the sidebar opens your catalogue. The table shows name, HSN/SAC, rate, GST %, unit and stock. Point at a name to see its description. Search by name or HSN.</p>
<figure><img src="assets/img/app-products.png" alt="The product list. Low stock shows in amber, none in red." loading="lazy"><figcaption>The product list. Low stock shows in amber, none in red.</figcaption></figure>
</section>

<section id="add-product">
<h2>Adding a product or service</h2>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Product / Service Name</td><td>Required</td></tr>
  <tr><td>HSN / SAC Code</td><td>HSN for goods, SAC for services</td></tr>
  <tr><td>Purchase Price</td><td>What you pay the supplier. Filled in on new purchase bills.</td></tr>
  <tr><td>Selling Price</td><td>What you charge. Filled in on new invoices, and shown as the rate in the list.</td></tr>
  <tr><td>GST %</td><td>Type the rate, such as 18</td></tr>
  <tr><td>Unit</td><td>Pcs to start, or any unit from the list, including your own <a href="invoices.html#items">custom units</a></td></tr>
  <tr><td>Stock Quantity</td><td>How many you have now</td></tr>
  <tr><td>Description</td><td>For your own reference</td></tr>
</table></div>
<p>Deleting a product does not change invoices that used it.</p>
</section>

<section id="stock">
<h2>How stock is counted</h2>
<ul>
  <li><strong>Selling</strong>: saving an invoice takes the quantity out, for rows picked from your products.</li>
  <li><strong>Buying</strong>: saving a <a href="purchases.html#stock">purchase bill</a> adds the quantity in, and adds any new item to your products.</li>
  <li><strong>Cancelling</strong> an invoice puts its stock back; un-cancelling takes it out again.</li>
</ul>
<p><b>Out of Stock</b> shows in red at zero or below. Purchases and deletions never take stock below zero; selling more than you have does, so you notice.</p>
</section>

<section id="low-stock">
<h2>Low-stock alerts</h2>
<p>A product at or below your threshold shows its stock in amber here, is listed on the Dashboard, and adds to the notification bell. The threshold is 5 to start; change it, or turn alerts off, in <a href="settings.html#stock">Settings</a>. It is one threshold for every product.</p>
</section>

<section id="import">
<h2>Importing products from a spreadsheet</h2>
<p>${ui('Import CSV')} loads a price list. The first row must name the columns:</p>
<table>
  <tr><th>Column heading</th><th>Holds</th></tr>
  <tr><td><code>name</code> (or <code>product</code>, <code>product name</code>)</td><td>Required</td></tr>
  <tr><td><code>hsn</code> (or <code>hsn code</code>, <code>sac</code>)</td><td>HSN or SAC code</td></tr>
  <tr><td><code>rate</code> (or <code>price</code>)</td><td>Selling price</td></tr>
  <tr><td><code>gst%</code> (or <code>tax%</code>, <code>taxpercent</code>, <code>tax</code>)</td><td>GST rate, such as 18. Note: no space before the %.</td></tr>
  <tr><td><code>unit</code></td><td>Nos if left out</td></tr>
  <tr><td><code>stock</code> (or <code>quantity</code>)</td><td>Opening stock</td></tr>
  <tr><td><code>description</code></td><td>Optional</td></tr>
</table>
<pre><code>name,hsn,rate,gst%,unit,stock
A4 Paper Ream,4802,280,12,Nos,50
Website Maintenance,998314,5000,18,Month,0</code></pre>
<p>Every row becomes a new product, so importing the same file twice gives you two of each.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'purchases',
  title: 'Purchase bills',
  lead: 'Record every supplier bill, so the GST you paid comes back as input tax credit and your stock stays right. Includes reading a bill from a photo.',
  body: `
<section id="purchase-list">
<h2>The purchase list</h2>
<p>At the top, <b>Total Purchases</b>, <b>GST (ITC Eligible)</b> and <b>Entries</b> add up what is shown. Search by supplier, invoice number or GSTIN, and pick a financial year; the last five are offered.</p>
<p>The table shows date, supplier, GSTIN, invoice number, taxable value, tax, total, status and actions, with totals at the bottom. Each row has:</p>
<ul>
  <li>the eye, to view the bill without downloading anything;</li>
  <li>the pencil, to edit it;</li>
  <li>the bin, to delete it.</li>
</ul>
<p>The view has ${ui('Download PDF')}.</p>
</section>

<section id="add-purchase">
<h2>Adding a purchase bill</h2>
<p>${ui('Add Purchase')} opens the form:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Date</td><td>Today to start</td></tr>
  <tr><td>Payment Status</td><td>Unpaid, Paid or Partial</td></tr>
  <tr><td>Supplier Name</td><td>Required. Suppliers you have used before are suggested; picking one fills in their GSTIN, address and whether they are in another state.</td></tr>
  <tr><td>Supplier GSTIN</td><td>15 characters</td></tr>
  <tr><td>Supplier Address</td><td>Optional. Printed on the purchase bill PDF.</td></tr>
  <tr><td>Invoice Number</td><td>Required. The supplier's invoice number.</td></tr>
  <tr><td>Note</td><td>Optional</td></tr>
  <tr><td>Inter-state purchase</td><td>See <a href="#interstate">Suppliers in another state</a></td></tr>
</table></div>
<p>Each item row has <b>Name</b>, <b>HSN</b>, <b>Qty</b>, <b>Rate</b>, <b>Tax %</b> (0, 0.1, 0.25, 3, 5, 12, 18 or 28, or ${ui('Other…')} for any rate) and <b>Cess %</b>. Typing a name suggests your products and items from earlier bills, and fills in the HSN, rate and tax you used before. Clicking Qty, Rate or Cess selects what is in it, so typing replaces it.</p>
<p>A bill needs a supplier name, an invoice number, and at least one item with a quantity and rate.</p>
</section>

<section id="round-off">
<h2>Round-off</h2>
<p>If the supplier rounded their total to the rupee, tick <b>Apply round-off</b> so yours matches, for example ₹1,234.56 becomes ₹1,235. It is off to start, since most bills already match the line items.</p>
</section>

<section id="interstate">
<h2>Suppliers in another state</h2>
<p>If the supplier charged IGST because they are in a different state, tick <b>Inter-state purchase</b>. The credit then goes to IGST in GSTR-3B rather than CGST and SGST. The first two digits of the supplier's GSTIN are their state code.</p>
</section>

<section id="payment-status">
<h2>Paying suppliers</h2>
<p>Change a bill's status straight from the coloured <b>Status</b> dropdown in the list: <b>Unpaid</b> in amber, <b>Paid</b> in green, <b>Partial</b> in purple.</p>
<figure><img src="${img('purchase-status.png')}" alt="Purchase Records with a Status dropdown on each row"></figure>
</section>

<section id="stock">
<h2>What saving does to your products</h2>
<p>Each item on the bill is matched to your products by name:</p>
<ul>
  <li><strong>A product you already have</strong>: its stock goes up by the quantity, and its purchase price is updated. When you edit a bill, only the difference is added, and a row you remove is taken back out.</li>
  <li><strong>A new item</strong>: it is added to your products, with the rate as both purchase and selling price, and the quantity as its stock. Check its selling price afterwards.</li>
  <li><strong>Deleting a bill</strong> takes its quantities back out of stock.</li>
</ul>
</section>

<section id="ocr">
<h2>Reading a bill from a photo</h2>
<ol class="steps">
  <li><strong>Open it</strong>Click ${ui('Import from image (OCR)')}.</li>
  <li><strong>Choose the picture</strong>Click or drag a photo or scan of the bill: PNG, JPG or WebP, up to 8 MB. PDFs are not accepted; take a screenshot of the page instead.</li>
  <li><strong>Read it</strong>Click ${ui('Extract fields')}. It takes a few seconds, with a percentage showing progress.</li>
  <li><strong>Check everything</strong>The supplier, GSTIN, invoice number, date and grand total are filled in, with the line items it could read: name, HSN, quantity, rate and GST rate. Items that match your saved products take your stored HSN and GST rate. Fix anything wrong, add or remove rows.</li>
  <li><strong>Use it</strong>${ui('Use these values')} opens the purchase form with it all filled in. Check it once more and save.</li>
</ol>
<p>Everything is read on your computer, in English, with no internet needed and nothing uploaded. Sharp, straight, well-lit photos read best. If no items are found but a total is, one line with the total is added, for you to split into the real items.</p>
<p>The purchase form does not take the tax breakdown or grand total from the photo: it works them out from the items, so check they match the bill. Tick <b>Inter-state purchase</b> yourself if the bill shows IGST.</p>
</section>

<section id="export">
<h2>For your accountant</h2>
<p>${ui('Export CSV')} saves <code>purchases.csv</code> with the bills in the current search and year: date, supplier, GSTIN, invoice number, taxable amount, tax, round-off, total, status and note.</p>
</section>

<section id="unassigned">
<h2>"Not assigned to a business"</h2>
<p>If you have more than one business, bills saved before you started keeping them separate show under all of them, with a banner. ${ui('Assign to')} moves them all to the business now selected. Only do this if they belong to it. The same banner appears on Expenses, Recurring and Receipts.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'expenses',
  title: 'Expenses',
  lead: 'Costs that are not stock, such as rent, electricity, software or travel, for your profit and loss and for the GST credit on them.',
  body: `
<section id="expense-list">
<h2>The expense list</h2>
<p><b>Total Expenses</b>, <b>GST Paid (ITC)</b> and <b>Entries</b> add up what is shown. Search by description, vendor or bill number, and filter by category and financial year. The table shows date, description, category, vendor, amount, GST and payment mode, with totals at the bottom.</p>
</section>

<section id="add-expense">
<h2>Adding an expense</h2>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Date</td><td>Today to start</td></tr>
  <tr><td>Category</td><td>See the list below. Other to start.</td></tr>
  <tr><td>Description</td><td>Required, such as "AWS Hosting - March"</td></tr>
  <tr><td>Amount (incl. GST)</td><td>Required. The full amount you paid.</td></tr>
  <tr><td>GST % (for ITC)</td><td>The GST rate on the bill. The GST inside the amount is worked out and shown underneath.</td></tr>
  <tr><td>Vendor Name, Vendor GSTIN</td><td>Needed to claim the credit</td></tr>
  <tr><td>Invoice / Bill No</td><td>Optional</td></tr>
  <tr><td>Payment Mode</td><td>Bank Transfer, UPI, Cash, Cheque, Card or Other</td></tr>
  <tr><td>Inter-state expense</td><td>Tick when the vendor charged IGST, as with cloud and software firms billing from another state</td></tr>
  <tr><td>Note</td><td>Optional</td></tr>
</table></div>
</section>

<section id="categories">
<h2>Categories</h2>
<p>Office Rent, Utilities, Internet &amp; Phone, Software &amp; Tools, Travel, Meals &amp; Entertainment, Office Supplies, Salary &amp; Wages, Professional Fees, Insurance, Marketing &amp; Ads, Raw Materials, Shipping &amp; Courier, Repairs &amp; Maintenance, Bank Charges, GST Paid, Asset Purchase, Personal / Drawings, and Other.</p>
<p>The <a href="income-tax.html">Income Tax</a> screen leaves out <b>Personal / Drawings</b> and <b>Asset Purchase</b> when working out business income, since they are not business expenses for tax. The <a href="reports.html">profit and loss report</a> includes every category.</p>
</section>

<section id="gst-credit">
<h2>How the GST credit is used</h2>
<p>The GST on each expense is added to your input tax credit in <a href="gst-returns.html#gstr-3b">GSTR-3B</a>: to IGST if the expense is inter-state, otherwise split between CGST and SGST. Only claim credit you are entitled to: food, personal spending and bills without the vendor's GSTIN usually do not qualify. Check against GSTR-2B.</p>
</section>

<section id="export">
<h2>For your accountant</h2>
<p>${ui('Export CSV')} saves <code>expenses.csv</code> with the rows shown: date, description, category, amount, GST amount, GST %, vendor, vendor GSTIN, invoice number, payment mode and note.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'recurring',
  title: 'Recurring invoices',
  lead: 'Invoices that repeat on a schedule, such as a monthly retainer, rent or an annual maintenance contract.',
  body: `
<section id="two-ways">
<h2>Two ways to set one up</h2>
<ul>
  <li><strong>From an invoice</strong> (recommended): make the first invoice as usual, and under ${ui('Customize')} tick <a href="invoice-options.html#recurring">Make this a recurring invoice</a>. This keeps everything on the invoice, including taxes, terms and options, and lets you set <b>Every N</b> and an end date or number of invoices.</li>
  <li><strong>From the Recurring screen</strong>: ${ui('New Template')} with a client, frequency, next date, when to stop, type and simple item lines.</li>
</ul>
</section>

<section id="template-form">
<h2>The New Template form</h2>
<table>
  <tr><td>Quick Select Client</td><td>Fills in the client's name, GSTIN, state and address</td></tr>
  <tr><td>Client Name</td><td>Required</td></tr>
  <tr><td>Client GSTIN</td><td>Optional</td></tr>
  <tr><td>Frequency</td><td>Weekly, Monthly, Quarterly or Yearly</td></tr>
  <tr><td>Every</td><td>1 to 12. Monthly with 3 means every three months.</td></tr>
  <tr><td>Next Due Date</td><td>The 1st of next month, to start</td></tr>
  <tr><td>Stop</td><td><b>Never (until I stop it)</b>, <b>On a specific date</b>, or <b>After N invoices</b></td></tr>
  <tr><td>Invoice Type</td><td>Any of the six types</td></tr>
  <tr><td>Line Items</td><td>Description, Qty, Rate and GST%. At least one item with a rate is needed.</td></tr>
</table>
</section>

<section id="list">
<h2>The template list</h2>
<p>Each template shows the client, how often (such as "Every 3 months"), type, amount, next due date and whether it is <b>Active</b> or <b>Paused</b>. Its buttons: ${ui('▶')} Generate Now, Pause or Activate, Edit, and Delete. Editing keeps everything the form does not show, such as terms and options from the original invoice. Deleting a template stops future invoices; invoices already made stay.</p>
<p>When templates are due, a banner lists them, with a button for each to create its invoice now.</p>
<figure><img src="assets/img/app-recurring.png" alt="The recurring template list." loading="lazy"><figcaption>The recurring template list.</figcaption></figure>
</section>

<section id="automatic">
<h2>How invoices are created automatically</h2>
<p>A few seconds after the app starts, and then once a day while it is running, every active template whose date has come creates its invoice, with a fresh number and that day's date. Its next date then moves on by the schedule, and it stops at its end condition.</p>
<p>The notification bell tells you how many were created. They appear on the Dashboard, ready to check and send.</p>
<p>If the app was closed for a while, one invoice is created each time it catches up, so a missed month is not skipped.</p>
</section>

<section id="generate-now">
<h2>Generate Now</h2>
<p>${ui('▶')} creates the invoice straight away, even if the template is paused or not yet due, exactly as the automatic run would: same tax, a fresh number, today's date. Its next date moves on by the schedule and it counts towards "After N invoices". Once a template has reached its end, it says so instead. Open the new invoice from the Dashboard to check it before sending.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'receipts',
  title: 'Payment receipts',
  lead: 'Receipts for money you have received, whether against an invoice or not, ready to print.',
  body: `
<section id="receipt-list">
<h2>The receipts list</h2>
<p>${ui('Receipts')} lists every receipt, newest first: date, receipt number, client, the invoice it was against, amount and mode. Search by client or receipt number. Each row can be printed, edited or deleted.</p>
<p>Recording a payment on the <a href="dashboard.html#payments">Dashboard</a> makes its own receipt, which you print from the payment history there.</p>
</section>

<section id="new-receipt">
<h2>Making a receipt</h2>
<ol class="steps">
  <li><strong>Start it</strong>Click ${ui('New Receipt')}.</li>
  <li><strong>Pick the invoice, if there is one</strong><b>Quick Select, Unpaid Invoices</b> lists up to ten unpaid invoices. Picking one fills in the client, the amount still owed and the invoice number.</li>
  <li><strong>Fill in the rest</strong>Date, <b>Received From</b> (required), <b>Amount</b> (required), <b>Payment Mode</b>, <b>Reference / Transaction No</b>, <b>Against Invoice</b> and a note.</li>
  <li><strong>Save</strong>${ui('Save Receipt')} gives it the next receipt number.</li>
</ol>
<p>When <b>Against Invoice</b> exactly matches one of your invoice numbers, the payment is also recorded on that invoice, and its status becomes Partial or Paid. If it does not match any invoice, the receipt is saved on its own.</p>
</section>

<section id="numbers">
<h2>Receipt numbers</h2>
<p>Receipts have their own series, starting RCP, and follow your <a href="settings.html#invoice-numbers">invoice number format</a>: separator, financial year and digits. If you set a brand prefix, it is used for receipts too. The number is given when you save, even if you typed one.</p>
</section>

<section id="print">
<h2>Printing</h2>
<p>The print button opens the receipt in a new window and your print dialog. It shows your business name, address and GSTIN, <b>PAYMENT RECEIPT</b>, the receipt number, date, who paid, how, the reference and invoice, the amount in figures and words, any note, and lines for <b>Received By</b> and <b>Authorized Signatory</b>. If nothing happens, allow pop-ups for the app in your browser.</p>
</section>

<section id="delete">
<h2>Deleting a receipt</h2>
<p>Deleting a receipt removes only the receipt. A payment it recorded on an invoice stays there; delete that from the invoice's payment history on the Dashboard if it was a mistake.</p>
</section>
`,
},
];
