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
<p>The Dashboard is the first screen you see. It lists every invoice of the business selected in the sidebar, with the totals above and the actions on each row. If you run more than one business, <a href="shortcuts.html#switch-business">switch business</a> in the sidebar and the Dashboard shows only that business's invoices straight away. An old invoice that cannot be matched to any business is shown under every business, so nothing is ever hidden.</p>
<p>The count beside the title (for example <b>42 invoices</b>) is every document of that business: tax invoices, quotations, proformas, challans, credit notes and cancelled invoices too. The buttons on the right:</p>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('?')}</td><td>Opens this page in your browser. The small ${ui('?')} next to each card's title on the Dashboard opens the part of this page about that card.</td></tr>
  <tr><td>${ui('Lock')}</td><td>Locks the app straight away. It shows only when a <a href="settings.html#lock">PIN</a> is set.</td></tr>
  <tr><td>${ui('CSV import / export')}</td><td>Brings in many invoices from a spreadsheet, or saves all of them to one. See <a href="#csv">Importing and exporting invoices as CSV</a>.</td></tr>
  <tr><td>${ui('Import IRN')}</td><td>Only when <b>E-invoicing (IRN)</b> is on in <a href="settings.html#features">Settings, Features</a>. Reads the file the e-invoice portal gives back and saves each IRN on its invoice. See <a href="#einvoice">E-invoicing from the Dashboard</a>.</td></tr>
  <tr><td>${ui('New Invoice')}</td><td>Starts a blank invoice. See <a href="invoices.html">Making an invoice</a>.</td></tr>
</table>
<p>From top to bottom the screen then shows: the welcome note and the Getting started list (new users only), the support card, the red overdue banner (only when something is overdue), the four totals, the low-stock strip (only when a product is running low), and the invoice list with its filters.</p>
<figure><img src="assets/img/app-dashboard.png" alt="The Dashboard: CSV import / export, Import IRN and New Invoice at the top right, a red banner for two overdue invoices, the four total cards in rupees and dollars, low stock, and the invoice list." loading="lazy"><figcaption>The Dashboard with two overdue invoices, the four totals, low stock and the buttons at the top right.</figcaption></figure>
</section>

<section id="welcome-card">
<h2>The welcome note</h2>
<p>A new install shows a large note at the top: <b>Thank you for choosing Free GST Billing</b>. It says the app is free for good, your data stays on your own computer and works offline, a new update comes every Saturday, and support is welcome but never needed.</p>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Support with any amount')}</td><td>Opens <a href="shortcuts.html#support">Support &amp; About</a>, where you can pay any amount by <a href="support.html#upi">UPI</a>. Nothing is charged unless you pay yourself.</td></tr>
  <tr><td>${ui('Share on WhatsApp')}</td><td>Opens WhatsApp with a short message about the app and its download link, so you can send it to a friend or your CA.</td></tr>
  <tr><td>${ui('Start billing')} or ${ui('✕')}</td><td>Closes the note for good on this computer and browser.</td></tr>
</table>
<p>It shows only while the business has fewer than 10 documents. From 10 on, the smaller <a href="#support-card">support card</a> takes its place, so the two never show together.</p>
</section>

<section id="getting-started">
<h2>The Getting started list</h2>
<p>A new install also shows four things to do before the app is really useful. Each one ticks itself off when it is <b>really done</b> (the app checks what is saved, not whether you opened a screen), and has a button that takes you there. The top right shows how many are done, such as <b>2 of 4 done</b>.</p>
<table>
  <tr><th>Step</th><th>Done when</th><th>Button</th></tr>
  <tr><td>Add your business details</td><td>A business name is saved</td><td>${ui('Open Settings')}</td></tr>
  <tr><td>Make your first invoice</td><td>Any invoice exists</td><td>${ui('Start')}</td></tr>
  <tr><td>Add your products or services</td><td>At least one product is saved</td><td>${ui('Open')} (opens Products)</td></tr>
  <tr><td>Add bank details or UPI</td><td>A bank account or UPI ID is saved</td><td>${ui('Open Settings')}</td></tr>
</table>
<ol class="steps">
  <li><strong>Business details</strong>In <a href="settings.html#company-details">Settings, Company details</a>, fill in your business name, address, state and GSTIN (your 15-character GST number). They print on every invoice.</li>
  <li><strong>Products</strong>Add what you sell once, with its HSN code (goods) or SAC code (services) and GST rate. Then you pick it from a list instead of typing it on every invoice. See <a href="products.html#add-product">Adding a product</a>.</li>
  <li><strong>Bank and UPI</strong>Add your bank account or UPI ID in <a href="settings.html#payment-accounts">Settings, Bank accounts and UPI</a>. Invoices then show where to pay, with a UPI QR code the client can scan.</li>
  <li><strong>First invoice</strong>Pick the client, add the items, and the GST is worked out for you. See <a href="first-invoice.html">Your first invoice</a>.</li>
</ol>
<p>The list disappears by itself once all four are done. ${ui('✕')} at the top right hides it for good on this computer even if steps are left. <b>Read the 5-minute guide</b> at the bottom opens this documentation in your browser.</p>
<figure><img src="${img('getting-started.png')}" alt="The Getting started list with three of four steps done"></figure>
<div class="note tip"><strong>Something wrong?</strong>
<p>A step stays unticked after you did it? Make sure you clicked ${ui('Save')} in Settings (see <a href="settings.html#save-bar">Saving your changes</a>), then come back to the Dashboard: the list is checked again each time the Dashboard opens. The bank step needs an account number or a UPI ID, not only a bank name.</p></div>
</section>

<section id="support-card">
<h2>The support card</h2>
<p>Once the business has 10 or more documents, and the Getting started list is finished or hidden, a small card at the top shows how many invoices you have made with the app, a different short line each day about how the app is kept free, and, when the computer is online, how much users have given so far (with a progress bar when there is a goal).</p>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Support with UPI')}</td><td>Opens <a href="shortcuts.html#support">Support &amp; About</a>, and hides the card for the rest of the day.</td></tr>
  <tr><td>${ui('Not today')}</td><td>Hides it until tomorrow.</td></tr>
  <tr><td>${ui('Hide for 30 days')}</td><td>Hides it for a month.</td></tr>
</table>
<p>It never blocks your work, is never a pop-up, and is never printed on an invoice. It is remembered per browser, so a different browser or computer may show it again.</p>
</section>

<section id="star-banner">
<h3>The "star on GitHub" line</h3>
<p>A few days after you start using the app, a slim blue line may appear at the top of most screens: <b>Finding Free GST Billing useful? A star on GitHub helps other businesses find it.</b> ${ui('Star on GitHub')} opens the app's GitHub page (a free account is needed to give a star) and hides the line for good. ${ui('Already starred')} also hides it for good. ${ui('✕')} hides it for 30 days. It is never shown on the new invoice screen.</p>
</section>

<section id="overdue">
<h2>Overdue invoices and reminders</h2>
<p>An invoice is <b>overdue</b> when its due date has passed and it is not fully paid. Each time the Dashboard opens, every Unpaid or Partial tax invoice, bill of supply or composition bill whose <b>Due Date</b> is before today is marked Overdue for you. Quotations, proformas, challans and credit notes are never overdue, and neither is a cancelled invoice or one with no due date.</p>
<p>When at least one invoice is overdue, a red banner shows above the totals, for example <b>3 overdue invoices — ₹41,300 outstanding</b>. The amount is what is still owed on them (less any TDS the client deducts); foreign-currency invoices are added after a ${ui('+')}, never mixed with rupees.</p>
<ul>
  <li>Click anywhere on the banner (or <b>View all →</b>) to set the Status filter to <b>Overdue</b>, so the list shows only those invoices. Set the filter back to <b>All Status</b>, or click ${ui('✕')}, to see everything again.</li>
  <li>${ui('Remind All')} opens the <a href="#remind-all">Send Payment Reminders</a> window.</li>
</ul>
<p>Each overdue row in the list has a light red background, and under its status it says how many days late it is, such as <b>12d overdue</b>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>An invoice shows Overdue but the client has paid: record the payment with the ${ui('₹')} button (see <a href="#payments">Recording a payment</a>); it becomes Paid. An invoice is never overdue? Give it a <b>Due Date</b> on the invoice screen (see <a href="invoices.html#details">Invoice Details</a>).</p></div>
</section>

<section id="remind-all">
<h3>Send Payment Reminders</h3>
<p>${ui('Remind All')} on the red banner opens this window. It lists every overdue invoice on its own line: the client, the invoice number, the balance still owed in red (or <b>Overpaid ₹…</b> in blue if the client paid too much), and the client's phone number when one is saved.</p>
<ol class="steps">
  <li><strong>Pick a client</strong>Click ${ui('Remind')} on their line.</li>
  <li><strong>WhatsApp opens</strong>In a new tab, with the client's chat and a polite message already written, such as "Hi Sharma Traders, this is a gentle reminder that Invoice INV/0012 for ₹11,800 was due on 5/9/2026. Kindly arrange the payment at your earliest convenience. Thank you! - Your Business".</li>
  <li><strong>Send it</strong>Check the message and press send in WhatsApp. Come back to the app tab and click ${ui('Remind')} for the next client.</li>
</ol>
<p>The message suits the situation: if part is paid, it asks for the <b>balance</b> and mentions the invoice total; if the due date has passed, it gives the due date. An invoice with nothing left to pay is not sent a reminder (you see "This invoice has no outstanding balance — no reminder to send"). ${ui('Close')} closes the window.</p>
<p>The phone number comes from the invoice, or else from the saved client with the same name in <a href="clients.html#client-form">Clients</a>. If there is none, WhatsApp opens without a contact and you choose the chat yourself.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>WhatsApp says the phone number is invalid? Save the client's phone with the country code, such as <code>+91 98765 43210</code> or <code>919876543210</code>. Nothing opens? Your browser blocked the new tab: allow pop-ups for the app (see <a href="troubleshooting.html#print-blocked">Print does nothing</a>, step 1). On a computer, WhatsApp Web or WhatsApp Desktop must be logged in.</p></div>
</section>

<section id="totals">
<h2>The four totals</h2>
<p>The four cards under the banner add up your sales. They cover only the business selected in the sidebar, and only <b>real sales</b>:</p>
<ul>
  <li>Tax invoices, bills of supply and composition bills <b>count</b>.</li>
  <li>Credit notes are <b>subtracted</b> (money given back to clients).</li>
  <li>Quotations, proforma estimates and delivery challans are <b>left out</b>: they are not sales yet.</li>
  <li>Cancelled invoices are <b>left out</b>.</li>
</ul>
<p>The totals are for <b>all years</b> together and do not follow the filters on the invoice list. For one month, quarter or year, use <a href="reports.html">Reports</a> or <a href="gst-returns.html">GST Returns</a>. Sales in a foreign currency get a line of their own on each card (for example ₹4,25,000 and \$1,200), never added to rupees. A card shows <b>—</b> when there are no sales yet.</p>
</section>

<section id="total-invoiced">
<h3>Total Invoiced</h3>
<p>The grand total of your sales, <b>including GST</b>: the final amount printed on each invoice, added up, less credit notes. It is what you have billed, not what you have received.</p>
<p>When you bill in more than one currency, each currency has its own line, and a small line under them gives <b>≈ ₹ in all</b>: every invoice in rupees at its own exchange rate. Invoices without a rate are left out of that line and counted beside it.</p>
</section>

<section id="tax-collected">
<h3>Tax Collected</h3>
<p>The GST on those sales: CGST + SGST (or UTGST) on sales within your state, IGST on sales to other states, and cess, less the GST on credit notes. This is tax you collected for the government, not your income. Bills of supply and composition bills carry no GST, so they add nothing here. For what you actually have to pay after input tax credit (ITC, the GST you paid on purchases), see <a href="gst-returns.html#gstr-3b">GSTR-3B</a>.</p>
</section>

<section id="outstanding">
<h3>Outstanding</h3>
<p>What clients still owe you: for every sale not marked Paid, the invoice total less any TDS the client deducts (see <a href="invoices.html#tds-tcs">TDS and TCS</a>), less what has been received. An overpaid invoice counts as zero here, not as a minus. Credit notes are not taken off this card. To see who owes what and for how long, use <a href="reports.html#outstanding">Reports, Outstanding &amp; Aging</a> or a client's <a href="clients.html#ledger">account</a>.</p>
</section>

<section id="invoice-count">
<h3>Invoices</h3>
<p>How many sales documents the totals are made of: tax invoices, bills of supply, composition bills and credit notes, not cancelled. It is usually smaller than the count beside the Dashboard title, which also counts quotations, challans and cancelled invoices.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>A total looks too high or too low? Check the business selected in the sidebar first. Then look for a quotation or challan that should have been converted to a tax invoice (they do not count until converted), or a wrong invoice that should be cancelled (see <a href="#cancel">Cancelling an invoice</a>).</p></div>
</section>

<section id="low-stock">
<h2>Low stock</h2>
<p>If low-stock alerts are on in <a href="settings.html#stock">Settings</a> (they are on to start, with a limit of 5), every product whose stock is at or below your limit is listed in one line under <b>Low stock (n)</b>, where n is how many there are. Each shows the product name, its HSN code if it has one, and either <b>Out of Stock</b> in red (0 or less) or <b>Stock: 3</b> in amber.</p>
<p>When the list is wider than the screen, it scrolls past slowly like a news ticker; point at it with the mouse to stop it. A short list stays still. If your computer is set to reduce motion, it does not move and you scroll it sideways instead. Click any product to open <a href="products.html">Products</a> and restock it.</p>
<p>The strip disappears when no product is low, or when alerts are turned off. The limit is one number for all products; change it in Settings. How stock goes up and down is explained in <a href="products.html#stock">How stock is counted</a>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>A product shows Out of Stock but you have plenty? Its stock in Products was never set, or sales took it below zero. Open Products and correct the stock. Old invoices imported without "Take sold quantities out of product stock" do not touch stock.</p></div>
</section>

<section id="invoice-list">
<h2>Finding an invoice</h2>
<p><b>Three tabs at the top of the list:</b></p>
<table>
  <tr><th>Tab</th><th>Shows</th></tr>
  <tr><td>${ui('Invoices')}</td><td>Your invoices, quotations and other documents, except cancelled ones.</td></tr>
  <tr><td>${ui('Cancelled')}</td><td>Cancelled invoices. They keep their numbers and count for nothing in totals, reports and GST returns. ${ui('Undo cancel')} on a row puts it back in Invoices.</td></tr>
  <tr><td>${ui('Trash')}</td><td>Deleted invoices, with the days left. Each waits 30 days, then it is removed for good. ${ui('Restore')} puts it back in your invoices (with its stock); ${ui('Delete forever')} removes it at once.</td></tr>
</table>
<p>To delete an invoice: ${ui('⋯')} on its row, then ${ui('Delete')}. For several: tick them, then ${ui('Delete invoices')} in the bar that appears. Cancel keeps the number in your records; Delete takes the invoice out.</p>
<p>The <b>Invoices</b> card lists every document of the business, newest first. Above the list are the filters. They work together: for example "Overdue" and "FY 2026-27" shows only this year's overdue invoices.</p>
<table>
  <tr><th>Filter</th><th>What it does</th></tr>
  <tr><td>Search client, invoice, order no, AWB, phone...</td><td>Type part of a client's name, an invoice number, the client's phone or GSTIN, or anything in the invoice's order and dispatch details (Buyer's Order No, Dispatch Doc No / AWB, courier, your own fields), such as <code>sharma</code>, <code>0012</code> or an order ID. Capital letters do not matter.</td></tr>
  <tr><td>All Years</td><td>Pick one financial year (1 April to 31 March).</td></tr>
  <tr><td>All Types</td><td>Pick one document type: Tax Invoice, Quotation, Proforma / Estimate, Bill of Supply (No GST), Composition (Bill of Supply), Credit Note or Delivery Challan.</td></tr>
  <tr><td>All Status</td><td>Unpaid, Partial, Paid, Overdue or Cancelled. See <a href="#status">Status</a>.</td></tr>
  <tr><td>From / To</td><td>A range of invoice dates. Fill in one or both.</td></tr>
  <tr><td>All cost centres</td><td>Only when <a href="reports.html#cost-centres">cost centres</a> are on: one branch, site or project, or <b>No cost centre</b> to find invoices not yet tagged.</td></tr>
  <tr><td>${ui('✕')}</td><td>Shows once any filter is set. Clears all of them at once.</td></tr>
  <tr><td>${ui('Columns')}</td><td>Choose which columns the list shows. See <a href="#columns">Choosing the columns</a>.</td></tr>
</table>
<p>What you see on a row:</p>
<ul>
  <li>A green <b>IRN</b> beside the invoice number: the invoice is registered on the e-invoice portal. Point at it to see the IRN.</li>
  <li>A yellow note icon beside the client: the invoice has a private note (never printed). Point at it to read it.</li>
  <li>A small currency code such as <b>USD</b> beside the amount: an invoice in a foreign currency.</li>
  <li><b>Paid</b>: how much has been received so far, or — when nothing has.</li>
  <li>A light red row: overdue. A light blue row: ticked.</li>
</ul>
<p>"No invoices yet." with a ${ui('Create Invoice')} button means the business has none. "No invoices match your filters." means the filters hide them all: click ${ui('✕')}.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>An invoice you made is missing? Check the business selected in the sidebar, then clear the filters with ${ui('✕')}. Changing a filter also clears any ticks, so you never act on rows you cannot see.</p></div>
</section>

<section id="columns">
<h2>Choosing the columns</h2>
<p>${ui('Columns')} at the right end of the filters opens <b>Pick columns to show</b>. Tick or untick:</p>
<table>
  <tr><th>Column</th><th>Shows</th><th>To start</th></tr>
  <tr><td>Date</td><td>The invoice date</td><td>Shown</td></tr>
  <tr><td>Invoice #</td><td>The invoice number, with IRN when it has one</td><td>Shown</td></tr>
  <tr><td>Type</td><td>Tax Invoice, Quotation and so on</td><td>Shown</td></tr>
  <tr><td>Client</td><td>The client's name and the private-note icon</td><td>Shown</td></tr>
  <tr><td>Amount</td><td>The invoice total</td><td>Shown</td></tr>
  <tr><td>Currency</td><td>INR, USD and so on, in its own column</td><td>Hidden</td></tr>
  <tr><td>Status</td><td>The status dropdown (see <a href="#status">Status</a>)</td><td>Shown</td></tr>
  <tr><td>Due date</td><td>The due date, or —</td><td>Hidden</td></tr>
  <tr><td>Print count</td><td>How many times it was printed or downloaded, such as 2×</td><td>Hidden</td></tr>
  <tr><td>Actions</td><td>The buttons for each invoice (see <a href="#row-actions">What you can do with an invoice</a>)</td><td>Shown</td></tr>
</table>
<p>The <b>Paid</b> column and the tick boxes are always shown. Your choice is remembered on this computer and browser. Click ${ui('Columns')} again to close the list. On a narrow screen, hiding a few columns saves sideways scrolling.</p>
</section>

<section id="status">
<h2>Status</h2>
<p>Each sale is <b>Unpaid</b>, <b>Partial</b> (part paid), <b>Paid</b>, <b>Overdue</b> or <b>Cancelled</b>, shown in a coloured dropdown on its row. Recording payments sets it for you: nothing received is Unpaid, some is Partial, the full balance is Paid. Each time the Dashboard opens, unpaid and part-paid invoices past their due date become Overdue, and the row shows how many days late they are.</p>
<p>You can also change it yourself from the dropdown:</p>
<table>
  <tr><th>Choose</th><th>What happens</th></tr>
  <tr><td>Paid</td><td>Records a payment for the rest of the balance (mode Other, note "Marked paid", today's date), so your payment history, Receipts and reports stay complete.</td></tr>
  <tr><td>Unpaid</td><td>Takes back the payment that marking it Paid recorded, so the Paid column clears and ${ui('Send reminder')} comes back. Payments you recorded yourself stay: the invoice then shows Partial or Paid, with a message saying so. Delete a wrong payment under <a href="#payment-history">Payment History</a>.</td></tr>
  <tr><td>Partial, Overdue</td><td>Only the label changes.</td></tr>
  <tr><td>Cancelled</td><td>Cancels it at once, without asking, and puts its stock back. See <a href="#cancel">Cancelling an invoice</a>.</td></tr>
</table>
<p>Only sales get paid, so only Tax Invoices, Bills of Supply and Composition bills have this dropdown. Quotations, proformas and delivery challans show <b>Open</b>, or <b>Converted</b> once turned into an invoice; credit notes show <b>Issued</b>. A cancelled one shows <b>Cancelled</b>; ${ui('Undo cancel')} is with its actions.</p>
</section>

<section id="payments">
<h2>Recording a payment</h2>
<p>When a client pays you, by UPI, bank transfer, cash or cheque, record it against the invoice. The status then changes for you, a receipt is made, and the payment appears in <a href="receipts.html#receipt-list">Receipts</a>, the client's <a href="clients.html#ledger">account</a> and <a href="reports.html#outstanding">Outstanding</a>.</p>
<ol class="steps">
  <li><strong>Open it</strong>Click the green ${ui('₹')} button on the invoice's row. The <b>Record Payment</b> window opens. Its top line shows the invoice number, the <b>Total</b>, what is <b>Paid</b> so far, and the <b>Balance</b> (in red while something is owed, green when nothing is).</li>
  <li><strong>Amount Received</strong>Type the amount received. The box shows the balance as a hint; for a full payment, type that amount.</li>
  <li><strong>Payment Date</strong>Today to start. Change it if the money came on another day.</li>
  <li><strong>Payment Mode</strong>Bank Transfer (to start), UPI, Cash, Cheque, Card or Other.</li>
  <li><strong>Note (optional)</strong>The UTR or UPI transaction ID, the cheque number, or anything that helps you match it later.</li>
  <li><strong>Record it</strong>Click ${ui('Record Payment')}. You see "Payment of ₹… recorded", the status becomes Partial or Paid, and the <a href="#receipt">payment receipt</a> opens, ready to print.</li>
</ol>
<p>${ui('Cancel')}, or a click outside the window, closes it without saving.</p>
<p><b>TDS.</b> If the invoice already shows TDS (see <a href="invoices.html#tds-tcs">TDS and TCS</a>), the balance here is already less that TDS, and paying that balance makes the invoice Paid. If the client deducted TDS the invoice does not show, record it here: see <a href="#payment-tds">TDS when recording a payment</a>.</p>
<p><b>Overpayment.</b> If the amount is more than the balance, you are asked <b>Record as overpayment?</b>. ${ui('Yes, record overpayment')} keeps the extra as the client's credit, to use on <a href="invoices.html#client-credit">their next invoice</a>. The window then shows <b>Overpaid</b> in blue instead of a balance.</p>
<p><b>Cancelled invoice.</b> A cancelled invoice cannot take a payment: you see "This invoice is cancelled. Change its status back before recording a payment." Undo the cancel first. On a cancelled or converted document that already has payments, the ${ui('₹')} button is called <b>Payment history</b> and opens the same window so you can see, reprint or fix them.</p>
<figure><img src="assets/img/app-payment.png" alt="Recording the rest of a part-paid invoice. The earlier payment is under Payment History." loading="lazy"><figcaption>Recording the rest of a part-paid invoice. The earlier payment is under Payment History.</figcaption></figure>
<div class="note tip"><strong>Something wrong?</strong>
<p>"Enter a positive payment amount": the amount is empty, zero or not a number. A message "Reconciled 1 orphaned payment…" when the Dashboard opens means a receipt saved earlier had lost its link to the invoice; the app put the payment back on the invoice for you, and nothing else is needed. To record one payment that covers several invoices, record it on each invoice for its share.</p></div>
</section>

<section id="payment-foreign">
<h3>Payments from abroad</h3>
<p>On an invoice billed in another currency (for example US dollars), the ${ui('Record Payment')} window has an extra, optional box, <b>Received from abroad</b>:</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What to type</th></tr>
  <tr><td>Amount Received</td><td>The amount in the invoice's currency, as before (for example 1,000 USD). This is what marks the invoice paid.</td></tr>
  <tr><td>Credited to your bank (₹)</td><td>The rupees that reached your account, from your bank statement.</td></tr>
  <tr><td>Bank charges (₹)</td><td>What the banks took on the way, if anything.</td></tr>
  <tr><td>FIRC / e-BRC number</td><td>The number on the Foreign Inward Remittance Certificate or e-BRC your bank issues. For an export of services it is the proof you were paid in foreign exchange; keep it with the invoice.</td></tr>
</table></div>
<p>The window shows the rate this works out to. The rupees and the FIRC number are saved with the payment and its receipt, and show in the payment history. They do not change the invoice or its GST figures, which stay at the invoice's own exchange rate.</p>
<p>The <b>Client deducted TDS</b> box is not offered for a client outside India: foreign clients do not deduct Indian TDS.</p>
</section>

<section id="payment-tds">
<h3>TDS when recording a payment</h3>
<p>A business client often pays less than the invoice because it kept back income-tax TDS (for example 10% of the value before GST for professional fees under 194J) and deposited it against your PAN. Record that TDS so the invoice shows Paid instead of Partial for ever.</p>
<p>On an Indian tax invoice, bill of supply or composition bill that does not already show TDS, the Record Payment window has a box <b>Client deducted TDS</b>:</p>
<ol class="steps">
  <li><strong>Tick it</strong>Tick <b>Client deducted TDS</b>. A section list and a rate box appear.</li>
  <li><strong>Section and rate</strong>Pick the section the client used (it is on their payment advice or TDS certificate). The usual rate fills in; type another if needed. The line below shows the TDS amount and what the client now owes in all.</li>
  <li><strong>Amount Received</strong>Type what actually reached your bank. Or leave it empty to record only the TDS, if you already recorded the payment.</li>
  <li><strong>Record it</strong>Click ${ui('Record Payment')}. The TDS is saved on the invoice (as if you had ticked TDS under Customize), so it is owed only its Net Receivable, and it appears in <a href="reports.html#tds-by-clients">Reports, TDS &amp; TCS</a> for checking against your Form 26AS.</li>
</ol>
<p><b>Example.</b> Invoice ₹1,18,000 (₹1,00,000 + 18% GST). The client pays ₹1,08,000 and deducts ₹10,000 TDS under 194J. Tick <b>Client deducted TDS</b>, pick 194J at 10%, type 1,08,000 and record it: the invoice is Paid.</p>
<p>To change or remove the TDS later, open the invoice and change TDS under ${ui('Customize')}.</p>
<p>The TDS you record here stays as recorded. Opening the invoice later and saving it again no longer works it out afresh (for 194Q the ₹50 lakh threshold could turn it into zero). If you change the TDS section or rate on the invoice, it is worked out again from the new rate.</p>
</section>

<section id="payment-history">
<h3>Payment History</h3>
<p>Once an invoice has payments, the Record Payment window lists them under <b>Payment History</b>: date, amount, mode and note. Each line has three buttons:</p>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Receipt')}</td><td>Opens the <a href="#receipt">payment receipt</a> for that payment, to view or print it again.</td></tr>
  <tr><td>Pencil</td><td>Opens <a href="#edit-payment">Edit Payment</a> to correct the amount, date, mode or note.</td></tr>
  <tr><td>Bin (red)</td><td>Deletes the payment after asking <b>Delete this payment?</b>. Its receipt is removed from Receipts too.</td></tr>
</table>
<p>After any change the paid amount and the status are worked out again: deleting the only payment makes the invoice Unpaid again (or Overdue the next time the Dashboard opens, if the due date has passed).</p>
</section>

<section id="edit-payment">
<h3>Edit Payment</h3>
<p>The pencil on a payment opens <b>Edit Payment</b>, showing the invoice number and total. Change the <b>Amount</b>, <b>Date</b>, <b>Mode</b> or <b>Note / reference</b> and click ${ui('Save changes')}; ${ui('Cancel')} or ${ui('✕')} closes it without saving. Use it to fix a typing mistake instead of deleting and recording again.</p>
<p>If the new amount takes the total received above the invoice total, you are asked <b>Save as overpayment?</b> first. The receipt in Receipts is updated to match, and keeps its receipt number. A payment made by choosing Paid from the status dropdown becomes an ordinary payment once you edit it, so choosing Unpaid later no longer removes it.</p>
</section>

<section id="receipt">
<h2>The payment receipt</h2>
<p>A receipt is the paper you give a client to say you have received their money. It opens by itself after ${ui('Record Payment')}, and again from ${ui('Receipt')} under <a href="#payment-history">Payment History</a>. It shows:</p>
<ul>
  <li>Your business name, address, GSTIN, phone and email, as saved on the invoice.</li>
  <li><b>PAYMENT RECEIPT</b>, with the <b>Receipt No.</b> (such as RCPT-LZ8K2M4A), <b>Payment Date</b>, <b>Against Invoice</b>, <b>Payment Mode</b> and the <b>Ref / Note</b> if you gave one.</li>
  <li>"Received with thanks from" the client's name, address and phone.</li>
  <li>The <b>Amount Received</b>, and for rupees the amount in words.</li>
  <li>The <b>Invoice Total</b>, <b>Total Paid</b> so far, and the <b>Balance</b> still owed (or <b>Overpaid</b> by how much).</li>
  <li>Lines for the customer's signature and yours, and when it was recorded.</li>
</ul>
<p>${ui('Print Receipt')} prints only the receipt, on A5 paper (half of A4); in the print window choose your printer, or <b>Save as PDF</b> to send it on WhatsApp or email. ${ui('Close')} closes it. Every receipt is also listed on the <a href="receipts.html#receipt-list">Receipts</a> screen.</p>
</section>

<section id="row-actions">
<h2>What you can do with an invoice</h2>
<p>The row shows the actions you use most as buttons. The rest are in the ${ui('⋯')} menu at the end of the row; it closes with <kbd>Esc</kbd> or a click elsewhere, and the arrow keys move through it.</p>
<table>
  <tr><th>Action</th><th>What it does</th></tr>
  <tr><td>👁 View</td><td>Shows the invoice exactly as it prints, without opening the editor. See <a href="#print-preview">The print preview</a>.</td></tr>
  <tr><td>Edit (pencil)</td><td>Opens it on the invoice screen to change it. See <a href="invoices.html">Making an invoice</a>.</td></tr>
  <tr><td>Undo cancel (curved arrow)</td><td>Only on a cancelled invoice. See <a href="#cancel">Cancelling an invoice</a>.</td></tr>
  <tr><td>${ui('₹')} Payment</td><td>Record a payment. See <a href="#payments">Recording a payment</a>.</td></tr>
  <tr><td>Convert to Tax Invoice</td><td>Quotations, proformas and delivery challans only, until they have been converted. See <a href="invoices.html#proforma-to-invoice">Turning a quote into an invoice</a>.</td></tr>
  <tr><td>${ui('⋯')} Duplicate</td><td>A new invoice with the same client and items, a new number and today's date. It starts Unpaid, with no payments. Handy for a client you bill the same things every month.</td></tr>
  <tr><td>${ui('⋯')} Print</td><td>Prints the invoice straight away: it opens for a moment, the print window appears, the print count goes up by one, and you are back on the Dashboard.</td></tr>
  <tr><td>${ui('⋯')} WhatsApp</td><td>Sends the invoice to the client. See <a href="#share">Sending an invoice by WhatsApp or email</a>.</td></tr>
  <tr><td>${ui('⋯')} Send reminder</td><td>Shown only on tax invoices, bills of supply and composition bills while money is still owed (never on quotations, proformas, challans or credit notes). Opens WhatsApp with a payment reminder suited to the situation, as in <a href="#remind-all">Send Payment Reminders</a>. On a part-paid invoice it is called <b>Reminder (partial pending)</b> and asks for the balance.</td></tr>
  <tr><td>${ui('⋯')} Email</td><td>Opens your email program with the invoice details. See <a href="#share">Sending an invoice by WhatsApp or email</a>.</td></tr>
  <tr><td>${ui('⋯')} Cancel invoice</td><td>See <a href="#cancel">Cancelling an invoice</a>.</td></tr>
</table>
<p>A cancelled invoice keeps only View, Duplicate and ${ui('Undo cancel')}. A quotation, proforma or challan already converted keeps only View and Duplicate, so it cannot be changed or converted twice. Opened, either one is read-only: you can download or print it, not change it. Payments they already have stay viewable from the ${ui('₹')} button.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>"No editable data saved for this invoice" on Edit: the invoice came from a very old version and holds only its totals, so it cannot be opened on the invoice screen. Print does nothing: see <a href="troubleshooting.html#print-blocked">Print does nothing, or "Print failed"</a>.</p></div>
</section>

<section id="print-preview">
<h2>The print preview</h2>
<p>The <b>Print preview</b> window shows an invoice exactly as it will print, on the paper size chosen for it, with the same design, logo, QR code and totals. A cancelled invoice shows <b>CANCELLED</b> across it, and an invoice with an IRN shows the IRN and QR code. It opens in three places:</p>
<ul>
  <li>From the 👁 <b>View</b> button on a Dashboard row, for any invoice, to check it without opening the editor.</li>
  <li>From ${ui('Full view')} in the Live preview bar while you make or edit an invoice, on any paper size. See <a href="invoices.html#preview">The live preview</a>.</li>
  <li>From ${ui('Print')} on the invoice screen when the invoice is on a <b>receipt (thermal) paper</b> size. On A4 and other sheet sizes, Print goes straight to your browser's print window, which has its own preview. See also <a href="thermal-printing.html#print-preview">the thermal print preview</a>.</li>
</ul>
<p>The line under the title names the paper, such as <b>A4 — click Print to send to your printer</b>.</p>
<table>
  <tr><th>Control</th><th>What it does</th></tr>
  <tr><td>Zoom slider, ${ui('−')} and ${ui('+')}</td><td>Make the preview smaller or bigger, from 30% to 250%. ${ui('−')} and ${ui('+')} step 10% at a time. It opens at 70% for A4 so the whole page fits, and 160% for a narrow receipt so you can read it; on a smaller window or a phone it opens smaller, so the whole width of the page fits. Zoom only changes this preview: the print is always full size on the chosen paper.</td></tr>
  <tr><td>The percentage (such as ${ui('70%')})</td><td>Click it to go back to the normal size.</td></tr>
  <tr><td>${ui('Download PDF')}</td><td>Only when opened from the invoice screen. Saves and downloads the PDF instead of printing, the same as <a href="invoices.html#save-download">Save &amp; Download</a>.</td></tr>
  <tr><td>${ui('Cancel')}, ${ui('✕')} or <kbd>Esc</kbd></td><td>Close it without printing. A click outside the window also closes it.</td></tr>
  <tr><td>${ui('Print')}</td><td>Closes the preview and sends the invoice to print, then your browser's print window opens: choose the printer and click Print there. The button shows "Sending…" while it works. From the Dashboard this works like ${ui('⋯')} <b>Print</b>: the print count goes up by one.</td></tr>
</table>
<div class="note tip"><strong>Something wrong?</strong>
<p>The preview looks right but the paper is cut off or tiny: check the paper size in the browser's print window matches your paper, with scale at 100% and margins at Default. Settings for paper, margins and design are in <a href="print-settings.html">Print and PDF settings</a>. Nothing happens on Print: see <a href="troubleshooting.html#print-blocked">Print does nothing</a>. Something missing on the page: see <a href="troubleshooting.html#missing-on-pdf">Something is missing on the PDF</a>.</p></div>
</section>

<section id="share">
<h2>Sending an invoice by WhatsApp or email</h2>
<p><b>WhatsApp</b> (in the ${ui('⋯')} menu) sends a message with the invoice number, date and due date, client, total, what is paid or still due (or "FULLY PAID"), the status, and your business name.</p>
<ul>
  <li><b>On a phone or tablet</b> (Chrome or Safari): the app makes the PDF and opens your phone's share menu with it attached. Pick WhatsApp and the client.</li>
  <li><b>On a computer</b>: WhatsApp does not let any website attach a file. So the client's chat opens in a new tab with the message, using the phone number saved for them, and the PDF is downloaded to your Downloads folder. Drag that PDF into the chat and send. If no number is saved, choose the contact in WhatsApp yourself.</li>
</ul>
<p><b>Email</b> opens your email program (Outlook, Windows Mail, Gmail if set as your mail app) with the subject <b>Invoice INV/0012 - ₹11,800</b>, a short "Dear …" message with the same details, and the client's email address filled in when the invoice or the saved client has one. Email links cannot attach files, so attach the PDF yourself: download it first with ${ui('Save &amp; Download')} on the invoice screen, or tick the invoice and use ${ui('One merged PDF')}.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>Email does nothing: no email program is set as the default on this computer. Set one in Windows Settings, Apps, Default apps, Email, or copy the details into Gmail yourself. WhatsApp opens the wrong chat or says the number is invalid: save the client's phone with the country code, such as <code>+91 98765 43210</code>, in <a href="clients.html#client-form">Clients</a>. For sending from the invoice screen, see <a href="invoices.html#whatsapp">Sharing on WhatsApp</a>.</p></div>
</section>

<section id="cancel">
<h2>Cancelling an invoice</h2>
<p>Under GST an invoice number, once issued, must stay in your books, so an issued invoice is <b>cancelled</b>, never deleted. Cancel one that was made by mistake, or for a sale that did not happen. (If goods came back after a real sale, issue a <a href="invoices.html#credit-note">credit note</a> instead.)</p>
<ol class="steps">
  <li><strong>Choose Cancel invoice</strong>In the ${ui('⋯')} menu on the row, click <b>Cancel invoice</b>. (Choosing <b>Cancelled</b> in the status dropdown does the same at once, without asking.)</li>
  <li><strong>Confirm</strong>The window <b>Cancel this invoice?</b> explains what happens, and that you can undo it with the ${ui('Undo cancel')} arrow among the row's actions. Click ${ui('Cancel invoice')} to go ahead, or close it to keep the invoice.</li>
  <li><strong>Done</strong>You see "Invoice cancelled &amp; stock restored". The row shows <b>Cancelled</b> in grey.</li>
</ol>
<p>A cancelled invoice keeps its number but no longer counts in totals, reports or GST returns, and any stock it used goes back. If you saved or printed its PDF, the copy in the <code>Saved Invoices</code> folder gets <b>CANCELLED</b> across every page. It is never shown as overdue, and cannot take a payment.</p>
<p><b>To undo it</b>, click the ${ui('Undo cancel')} arrow among the row's actions and answer <b>Yes, undo</b>. It goes back to Unpaid, Partial or Paid, from its payments, the stock is taken out again, and its saved PDF is put back exactly as it was.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>"A saved PDF could not be marked CANCELLED": that PDF is open in a PDF reader. Close it and cancel (or undo) again; see <a href="troubleshooting.html#pdf-file-in-use">Its PDF could not be updated</a>. "Failed to cancel": nothing was changed; try again.</p></div>
</section>

<section id="csv">
<h2>Importing and exporting invoices as CSV</h2>
<p>For moving many invoices in from Excel, Tally or another program, including <b>old invoices</b> from before you started using the app, or out to your CA, in one go. A CSV file is a plain spreadsheet file that Excel and Google Sheets can open and save.</p>
<ol class="steps">
  <li><strong>Open it</strong>Click ${ui('CSV import / export')} at the top of the Dashboard. The window <b>Sales invoices: CSV import / export</b> opens.</li>
  <li><strong>Start from the template</strong>${ui('Template')} downloads <code>Sales-import-template.csv</code> with the right columns and one example invoice of two items. Open it in Excel or Google Sheets, replace the example with your invoices, and save it as <b>CSV (Comma delimited)</b>.</li>
  <li><strong>Fill in your invoices</strong>One row per item; an invoice of three items is three rows with the same invoice number. Write the client name and invoice date on each invoice's first row. The table below says what goes in each column. Save as CSV again when done.</li>
  <li><strong>Choose the two options</strong><b>Take sold quantities out of product stock</b> (off to start): tick it for new sales; leave it off for old invoices whose stock you have already counted. <b>Add new clients to Clients</b> (on to start): clients not yet saved are added to your client list. A client is found by its <b>GSTIN</b> first: a row with a saved client's GSTIN goes to that client under its saved name, even if the name in the file is spelt differently, so no duplicate is made.</li>
  <li><strong>Choose the file</strong>${ui('Choose CSV or Excel file')} reads it and shows what will happen <b>before</b> anything is saved: the file name, how many invoices are ready, how many already exist and will be skipped, how many new clients there are, any warning about dates, and every invoice with a problem.</li>
  <li><strong>Import</strong>Click ${ui('Import')} (it shows the number ready, such as <b>Import 25</b>). It says "Importing…" while it works, then a message such as "25 invoices imported · 2 already there, skipped". The list refreshes by itself.</li>
</ol>
<p><b>From Vyapar or Excel:</b> you can choose an Excel file (<code>.xlsx</code>) instead of a CSV, such as Vyapar's sale report. The window opens on the sheet with the invoice items (pick another under <b>Sheet</b>), and what Vyapar's <b>Sale Report</b> sheet says was received is recorded as a payment. Cancelled sales are left out.</p>
<p>${ui('Export all as CSV')} downloads every invoice of this business, oldest first, in the same columns as the template (cancelled invoices are left out), as <code>Sales-invoices-YYYY-MM-DD.csv</code>. You can edit that file and import it into another copy of the app.</p>
<p><b>How to fill the file.</b> One row per item. Rows with the same invoice number make one invoice; give the client, date and other invoice details on the first row (later rows may leave them blank). Column names are matched loosely, so <b>Qty</b> or <b>Quantity</b>, <b>GSTIN</b> or <b>Client GSTIN</b>, <b>Customer</b> or <b>Client Name</b> all work. Dates can be <code>2026-10-01</code>, <code>01-10-2026</code> or <code>01/10/2026</code> (day first, as in India).</p>
<table>
  <tr><th>Column</th><th>What to put</th></tr>
  <tr><td>Invoice Number, Invoice Date</td><td>Required.</td></tr>
  <tr><td>Invoice Type</td><td>Tax Invoice (if blank), Bill of Supply, Composition, Quotation, Proforma, Delivery Challan or Credit Note.</td></tr>
  <tr><td>Due Date</td><td>Optional. Needed for the invoice to become overdue.</td></tr>
  <tr><td>Client Name, Client GSTIN, Client State, Client Address, Client Country</td><td>The name is required. A client already in Clients (same name) fills in the rest. The state can be a name (Maharashtra), a 2-digit GST state code (27), or left blank to take it from the GSTIN.</td></tr>
  <tr><td>Place of Supply</td><td>Only if it differs from the client's state. It decides CGST + SGST (same state as you) or IGST (another state).</td></tr>
  <tr><td>Item Name, HSN/SAC, Quantity, Unit, Rate</td><td>Item name and rate are required; quantity is 1 if blank. A product of the same name fills in a missing HSN or unit.</td></tr>
  <tr><td>Discount</td><td>Rupees off that line.</td></tr>
  <tr><td>GST %, Cess %</td><td>Such as 18 and 0.</td></tr>
  <tr><td>Prices Include Tax</td><td>Yes if the rates already include GST.</td></tr>
  <tr><td>Notes</td><td>Printed on the invoice.</td></tr>
  <tr><td>Bill Discount, Round Off</td><td>For the whole invoice: rupees off after tax, and Yes to round the total to the rupee.</td></tr>
</table>
<p>GST, CGST + SGST or IGST and the totals are worked out exactly as on the invoice screen. Imported invoices start <b>Unpaid</b>, in rupees. An invoice number that already exists is <b>skipped, never overwritten</b>. Two different invoices with the same number (for example, numbering that restarts each year) are refused: give one of them its own number.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>Each problem names the row or invoice and what to fix, for example "Invoice INV/0101: row 3 has no item name." or "date "31/02/2026" is not a date". Invoices with problems are not imported; fix the file and choose it again (the good ones already imported are then skipped as "already there"). "The dates are month first": your Excel wrote US dates; change the date columns to DD-MM-YYYY. A file saved as <code>.xlsx</code> does not work, even if renamed: see <a href="troubleshooting.html#csv-import">A CSV import did not work</a>. For purchase bills, use the same window on the Purchases screen: <a href="purchases.html#csv-purchases">Importing purchase bills</a>.</p></div>
</section>

<section id="quick-print">
<h2>Printing many invoices as one PDF</h2>
<p>The <b>Quick print</b> row above the list combines invoices into one PDF file, without ticking anything. It uses the list <b>as it is filtered now</b>, so set the filters first: for example From 1 October To 31 October, then ${ui('All shown')} gives October's invoices for your CA.</p>
<table>
  <tr><th>Button</th><th>Puts in the PDF</th></tr>
  <tr><td>${ui('All shown (n)')}</td><td>Every invoice in the list</td></tr>
  <tr><td>${ui('Unpaid only (n)')}</td><td>Only those marked Unpaid, not part-paid or overdue</td></tr>
  <tr><td>${ui('Overdue (n)')}</td><td>Only overdue ones, for chasing payments</td></tr>
  <tr><td>${ui('Paid (n)')}</td><td>Only fully paid ones</td></tr>
</table>
<p>The number in brackets is how many will go in. Each invoice starts on a new A4 page; a long one takes as many pages as it needs. For more than five invoices, a message shows how far it has got; for more than 100 you are asked first, as it can take a minute. The file <code>freegstbill-invoices-25-2026-10-31.pdf</code> lands in your Downloads folder, and a message says how many were included.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>"No overdue invoices to print": none in the list match; check the filters. "Could not generate any PDFs": see <a href="troubleshooting.html#print-blocked">Print does nothing, or "Print failed"</a>. To choose exactly which invoices go in, tick them and use ${ui('One merged PDF')} or ${ui('Separate PDFs (ZIP)')} instead (see below).</p></div>
</section>

<section id="bulk">
<h2>Ticking several invoices</h2>
<p>Tick the box at the start of each row, or the box in the header to tick every row in the list as filtered. For a set of dates, such as one month, fill in <b>From</b> and <b>To</b> in the filters first, then tick the header box. A blue bar appears above the list with how many are ticked, such as <b>3 selected</b>, and these buttons:</p>
<table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Mark paid')}, ${ui('Mark unpaid')}, ${ui('Mark overdue')}</td><td>Change them all, after asking. Mark paid records a payment for each balance (note "Marked paid (bulk)"); Mark unpaid takes such payments back, as the <a href="#status">status dropdown</a> does. Only tax invoices, bills of supply and composition bills change; ticked quotations or challans are left alone. Marking a cancelled invoice as anything brings it back and takes its stock out again.</td></tr>
  <tr><td>${ui('Export JSON')}</td><td>Saves the ticked invoices to one file, such as <code>freegstbill-bills-3-2026-10-31.json</code>, which can be brought back with <a href="backup.html#export-import">Import</a> in Settings, Backup.</td></tr>
  <tr><td>${ui('One merged PDF')}</td><td>Combines the ticked invoices into one PDF, one invoice per page, useful for your CA or for filing. Works like <a href="#quick-print">Quick print</a>.</td></tr>
  <tr><td>${ui('Separate PDFs (ZIP)')}</td><td>One PDF file per ticked invoice, named by its invoice number (such as <code>INV-0012.pdf</code>), downloaded together in one ZIP, such as <code>invoices-26-2026-10-31.zip</code>. Open the ZIP to get the files.</td></tr>
  <tr><td>${ui('E-invoice JSON')}</td><td>Only when e-invoicing is on. One file with the ticked invoices, to upload on the e-invoice portal. See <a href="#einvoice">E-invoicing from the Dashboard</a>.</td></tr>
  <tr><td>Set cost centre…</td><td>Only when <a href="reports.html#cost-centres">cost centres</a> are on. Tags the ticked invoices with one branch, site or project, after asking; <b>Remove cost centre</b> takes it off. Only the cost centre changes.</td></tr>
  <tr><td>${ui('Cancel')}</td><td>Shows only while a PDF is being made. Stops after the current invoice and still saves the PDF of those done.</td></tr>
  <tr><td>${ui('Cancel invoices')}</td><td>Cancels the ticked invoices, after asking, and puts their stock back. See <a href="#cancel">Cancelling an invoice</a>.</td></tr>
  <tr><td>${ui('✕')}</td><td>Unticks everything.</td></tr>
</table>
<p>Changing any filter or the search clears the ticks, so you never act on invoices you can no longer see. When some fail to save, a message says how many were updated and how many failed; try those again.</p>
</section>

<section id="einvoice">
<h2>E-invoicing from the Dashboard</h2>
<p>E-invoicing is only for businesses whose yearly turnover has crossed ₹5 crore: their B2B invoices must be registered on the government's e-invoice portal, which gives each one an <b>IRN</b> (Invoice Reference Number) and a signed QR code. If that is not you, leave it off. When <b>E-invoicing (IRN)</b> is on in <a href="settings.html#features">Settings, Features</a>, the Dashboard gets two extra buttons:</p>
<ol class="steps">
  <li><strong>E-invoice JSON</strong>Tick the invoices to register and click ${ui('E-invoice JSON')} in the bar. A JSON file downloads with every invoice that passed the checks. Upload it on einvoice1.gst.gov.in (e-Invoice, Bulk Upload).</li>
  <li><strong>Import IRN</strong>Download the result file from the portal, then click ${ui('Import IRN')} at the top of the Dashboard and choose it. Each IRN is saved on the invoice with the same number, date and GSTIN, and you see "IRN saved on 3 invoices. It now prints on them." Nothing else on the invoice changes.</li>
</ol>
<p>Invoices left out of the file, or IRNs that could not be matched, are listed in a window with what to fix for each (for example a client with no GSTIN, an item with no HSN code, or an invoice that already has an IRN). Fix them and export again. Registered invoices show a green <b>IRN</b> beside their number on the Dashboard. The full rules and checks are in <a href="gst-returns.html#e-invoice">E-invoicing (IRN)</a>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>"No IRN was found in that file": you chose the file you uploaded, not the one the portal gave back. Download the portal's result as JSON and import that.</p></div>
</section>
`,
},
];
