const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

export default [
// =============================================================================
{
  slug: 'receipts',
  title: 'Payment receipts',
  lead: 'Receipts for money you have received, whether against an invoice or not, ready to print.',
  body: `
<p>A payment receipt is the slip you give a customer when they pay you: "Received ₹5,000 from Sharma Traders by UPI against invoice INV/2026-27/0012". Open ${ui('Receipts')} in the sidebar to make, print, change or delete them. Each business keeps its own receipts: switching the business at the top of the sidebar shows that business's receipts only.</p>

<section id="receipt-list">
<h2>The Payment Receipts list</h2>
<p>The <b>Payment Receipts</b> card lists every receipt of the business you are working in, newest date first. Receipts you make here and the ones made when you record a payment on the <a href="dashboard.html#payments">Dashboard</a> both appear in it.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>What it shows</th></tr>
  <tr><td><b>Date</b></td><td>The date on the receipt.</td></tr>
  <tr><td><b>Receipt No</b></td><td>Its number, such as RCP/2026-27/0012 (made here) or RCPT-... (made from a Dashboard payment). See <a href="#numbers">Receipt numbers</a>.</td></tr>
  <tr><td><b>Client</b></td><td>Who paid you (<b>Received From</b>).</td></tr>
  <tr><td><b>Against Invoice</b></td><td>The invoice it was for, or a dash if none.</td></tr>
  <tr><td><b>Amount</b></td><td>The money received.</td></tr>
  <tr><td><b>Mode</b></td><td>Bank Transfer, UPI, Cash, Cheque, Card or Other.</td></tr>
  <tr><td><b>Actions</b></td><td>The printer prints it (<a href="#print">Printing</a>), the pencil edits it (<a href="#edit-receipt">Editing</a>), the bin deletes it (<a href="#delete">Deleting</a>).</td></tr>
</table></div>
<p><strong>Searching.</strong> Type in the <b>Search receipts...</b> box above the list. It finds receipts whose client name or receipt number contains what you typed. Clear the box to see them all again.</p>
<p><strong>Empty list.</strong> With no receipts yet you see "No receipts generated yet." and a ${ui('New Receipt')} button. With a search that finds nothing you see "No receipts match your search."</p>
<div class="note tip"><strong>Something wrong?</strong><p>A receipt you made is missing: check the business selected at the top of the sidebar, since each business sees only its own receipts. A receipt from a Dashboard payment is missing: it is made when you click ${ui('Record Payment')}, so a payment recorded in a very old version may not have one; print it from the invoice's Payment History instead.</p></div>
</section>

<section id="unassigned">
<h2>Receipts not assigned to a business</h2>
<p>Receipts saved before the app kept businesses separate do not say which business took the money, so they show under every business. If you have any, a blue strip above the list says, for example, "<b>3 receipts</b> are not assigned to a business, so they show under all of them", with a button ${ui('Assign to')} followed by the business you are working in.</p>
<p>Click it only if those receipts belong to that business. The app asks you to confirm, naming the business, and then they show only under it. The app never does this by itself, because only you know which business received the money. See <a href="settings.html#multiple-businesses">More than one business</a>.</p>
</section>

<section id="new-receipt">
<h2>Making a receipt (New Payment Receipt)</h2>
<p>Make a receipt whenever a customer pays you and wants a slip, or when you want a record of money received: a payment against an invoice, an advance before you have billed, a security deposit, or any other money in.</p>
<div class="note info"><strong>Paid against an invoice on the Dashboard?</strong><p>If you record the payment on the invoice itself (the ${ui('₹')} Payment button on the <a href="dashboard.html#payments">Dashboard</a>), a receipt is made for you. You do not need to make another one here.</p></div>
<ol class="steps">
  <li><strong>Open the form</strong>Click ${ui('New Receipt')} at the top right. A box titled <b>New Payment Receipt</b> opens, with the next receipt number and today's date filled in.</li>
  <li><strong>Pick the invoice, if there is one</strong>Under <b>Quick Select — Unpaid Invoices</b>, click the invoice being paid. The client, the amount still owed and the invoice number are filled in for you (<a href="#quick-select">more</a>).</li>
  <li><strong>Check the amount</strong>If the customer paid only part, change <b>Amount</b> to what they actually paid.</li>
  <li><strong>Choose how they paid</strong>Pick the <b>Payment Mode</b> and type the UPI transaction ID, cheque number or bank reference in <b>Reference / Transaction No</b>.</li>
  <li><strong>Save</strong>Click ${ui('Save Receipt')}. You see "Receipt saved" and it appears in the list. Click the printer on its row to print it.</li>
</ol>
<p>The fields in the form:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to enter</th></tr>
  <tr><td><b>Receipt No</b></td><td>Filled in with the next number. Leave it, and the number is confirmed when you save. Type your own if you need to (for example to match a paper receipt book), and yours is kept. See <a href="#numbers">Receipt numbers</a>.</td></tr>
  <tr><td><b>Date</b></td><td>Today to start. Change it if the money came on another day.</td></tr>
  <tr><td><b>Received From (Client Name) *</b></td><td>Required. Who paid you. Filled in when you pick an invoice. As you type, your saved clients are suggested; pick one, or type any other name.</td></tr>
  <tr><td><b>Amount *</b></td><td>Required, more than 0. The money received, in rupees.</td></tr>
  <tr><td><b>Payment Mode</b></td><td>Bank Transfer (the default), UPI, Cash, Cheque, Card or Other. Receipts in <b>Cash</b> also show in the <a href="cash-book.html#from-elsewhere">Cash book</a>.</td></tr>
  <tr><td><b>Reference / Transaction No</b></td><td>Optional. UPI reference, cheque number, NEFT/IMPS UTR and so on. It prints on the receipt.</td></tr>
  <tr><td><b>Against Invoice</b></td><td>Optional. The invoice number this money is for, typed exactly as on the invoice, for example INV/2026-27/0012. Leave it empty for an advance or other money. See <a href="#against-invoice">below</a>.</td></tr>
  <tr><td><b>Note (optional)</b></td><td>Anything else, such as "Advance for March order". It prints on the receipt.</td></tr>
</table></div>
<p>${ui('Cancel')}, or a click outside the box, closes it without saving. Anything typed is lost, so save first.</p>
</section>

<section id="quick-select">
<h3>Quick Select — Unpaid Invoices</h3>
<p>This list at the top of the form shows up to 50 sales invoices of this business that are not fully paid: tax invoices, bills of supply and composition bills. Quotations, proforma invoices, delivery challans, credit notes and cancelled invoices are left out, because no money is owed on them. Each line shows the client, the invoice number and, on the right, the amount still owed. The list scrolls if it is long.</p>
<p>Clicking an invoice fills in <b>Received From</b>, the client's address (it prints on the receipt), <b>Amount</b> with what is still owed (less any TDS the client deducts, and never below zero) and <b>Against Invoice</b>. Once <b>Against Invoice</b> has something in it, the list hides. Empty that field to see the list again and pick a different invoice.</p>
<p>The list does not show when every invoice is paid, or when you have no sales invoices yet. Then just type the details.</p>
</section>

<section id="against-invoice">
<h3>Against Invoice: what happens to the invoice</h3>
<p>When <b>Against Invoice</b> exactly matches the number of one of this business's invoices, saving the receipt also records the payment on that invoice, with the same amount, date and mode and the note "Receipt RCP/... · ref ...". The invoice's status on the Dashboard then becomes <b>Partial</b> or <b>Paid</b>, and you do not record the payment again there. A cancelled invoice stays Cancelled.</p>
<p>If the number does not match any invoice (a typing mistake, or an invoice of another business), the receipt is still saved, and you see: "No invoice numbered ... was found, so this receipt is saved on its own." Nothing changes on any invoice. Check the number and <a href="#edit-receipt">edit the receipt</a> if it was meant for an invoice.</p>
<p>For an <strong>advance</strong> (money before you have made the invoice), leave <b>Against Invoice</b> empty. The receipt stands on its own and no invoice changes.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Client name required" or "Enter valid amount": fill in <b>Received From</b> and an <b>Amount</b> more than 0. The invoice did not become Paid: the number in <b>Against Invoice</b> must match exactly, including slashes and the year (picking from Quick Select avoids typing it), and the amount must cover what is owed. "Failed to save": the app could not reach its data; see <a href="troubleshooting.html#saving">Saving and working in the app</a>.</p></div>
</section>

<section id="edit-receipt">
<h2>Editing a receipt (Edit Payment Receipt)</h2>
<p>Click the pencil on a receipt's row. The same form opens, titled <b>Edit Payment Receipt</b>, with everything filled in. Change what you need and click ${ui('Save Receipt')}. The receipt keeps its number.</p>
<ul>
  <li>Changing the <b>Amount</b>, <b>Date</b> or <b>Payment Mode</b> of a receipt against an invoice updates the same payment on that invoice. It is not added twice.</li>
  <li>Changing <b>Against Invoice</b> to another invoice moves the payment: it is taken off the old invoice and recorded on the new one. Emptying it takes the payment off the old invoice.</li>
  <li>The receipt stays with the business it was made for, even if another business is selected while you edit it.</li>
</ul>
<p>A receipt made from a Dashboard payment can be edited here too. You can also edit that payment on the Dashboard (Payment History, pencil), and its receipt follows.</p>
</section>

<section id="numbers">
<h2>Receipt numbers</h2>
<p>Receipts made on this screen have their own series, starting RCP, and follow your <a href="settings.html#invoice-numbers">invoice number format</a>: separator, financial year (April to March) and digits, for example RCP/2026-27/0001. If you set a brand prefix, it is used for receipts too (ACME-RCP/...). A business with its own numbering numbers its receipts separately. Receipts never share a count with invoices.</p>
<p>The number you see when the form opens is a preview. The number is only taken when you save, so two people saving at once never get the same one. If you typed your own number, yours is kept and the series does not move.</p>
<p>Receipts made by recording a payment on the Dashboard are numbered differently, RCPT- followed by letters and numbers from the payment (for example RCPT-LX3K9A2B1C). That is normal.</p>
</section>

<section id="print">
<h2>Printing a receipt</h2>
<p>Click the printer on a receipt's row. The receipt opens in a new window and your browser's print box appears. Choose your printer, or <b>Save as PDF</b> to keep or send it on WhatsApp or email. The window closes after printing.</p>
<p>The printed receipt shows:</p>
<ul>
  <li>Your business name, address and GSTIN (from <a href="settings.html#company-details">Company details</a> of the business selected now), and the heading <b>PAYMENT RECEIPT</b>;</li>
  <li><b>Receipt No</b>, <b>Date</b>, <b>Received From</b>, the client's <b>Address</b> (when the receipt was made from Quick Select), <b>Payment Mode</b>, and <b>Reference No</b> and <b>Against Invoice</b> when filled in;</li>
  <li>the amount in large figures, and in words underneath, then the note;</li>
  <li>signature lines for <b>Received By</b> and <b>Authorized Signatory</b>.</li>
</ul>
<p>A payment recorded on the Dashboard also has a fuller receipt with the invoice total and balance, printed on A5 from the invoice's Payment History. See <a href="dashboard.html#receipt">The payment receipt</a>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Your browser blocked the print window": allow pop-ups for the app in your browser (the icon at the right of the address bar) and click the printer again. See <a href="troubleshooting.html#print-blocked">Print does nothing</a>. It says "Your Business": fill in your business name in Settings, Company details.</p></div>
</section>

<section id="delete">
<h2>Deleting a receipt</h2>
<p>Click the bin on the receipt's row. The app asks "Delete this receipt?"; click ${ui('Delete')} to remove it. This cannot be undone.</p>
<p>Deleting a receipt removes only the receipt. A payment it recorded on an invoice stays on the invoice, so the invoice stays Paid or Partial. If the payment itself was a mistake, delete it from the invoice's Payment History on the <a href="dashboard.html#payments">Dashboard</a>; that also removes its receipt.</p>
</section>

<section id="from-invoice">
<h2>Receipts made from an invoice</h2>
<p>A payment recorded with ${ui('₹')} on the Dashboard, or typed in <a href="invoices.html#received-now">Received now</a> while making the invoice, saves its receipt here by itself, against that invoice. Clearing Received now on the invoice removes that receipt too.</p>
</section>

<section id="cash-receipts">
<h2>Cash receipts and the cash book</h2>
<p>A receipt with Payment Mode <b>Cash</b> shows in the <a href="cash-book.html#from-elsewhere">Cash book</a> as money in, labelled with its receipt number, so you never type it there again. A receipt against an invoice and the payment it records on that invoice are the same money, and the cash book counts it once. To change it, change the receipt here; the cash book follows.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'cash-book',
  title: 'Cash book',
  lead: 'Every rupee that comes in or goes out in cash, with names and notes, and how much cash you should have in the drawer right now.',
  body: `
<section id="what-it-is">
<h2>What the cash book is for</h2>
<p>Use it for cash that does not belong on an invoice or a bill: money taken at the counter, an advance from a customer, salary paid in cash, tea and snacks, auto fare, money you take home, or cash you deposit in the bank. Each entry is either <b>Money in</b> or <b>Money out</b>, with an amount, a date, a name (who or what) and a note if you like.</p>
<p>Open it from ${ui('Cash book')} in the sidebar. If you do not see it, tick <b>Cash book</b> under <b>Menu</b> in <a href="settings.html#features">Settings, Features</a> and save. It is on to start, whatever your business type.</p>
<p>Each business has its own cash book, like its expenses and receipts. Switching the business at the top of the sidebar shows that business's cash.</p>
<p>The screen has, from top to bottom: the <a href="#cash-in-hand">cash in hand cards</a>, the <a href="#add-entry">entry form</a>, the <a href="#filters">dates and search</a> bar, and the <a href="#list">list</a> with its <a href="#export">Print / PDF, Excel and CSV</a> buttons.</p>
<figure><img src="assets/img/cash-book.png" alt="The Cash book: cash in hand, today and this month cards, the New entry form with Money in and Money out, the search bar, and the month's list with an opening balance, tea, auto fare, a cash sale, an invoice payment and a bank deposit, each with its running balance." loading="lazy"><figcaption>The cash book for a month. The invoice payment received in cash comes in by itself, and the balance runs down the right.</figcaption></figure>
</section>

<section id="opening-balance">
<h2>Start with the cash you have today</h2>
<p>Count the cash in your drawer (or cash box) on the day you start, then add it as your first entry:</p>
<ol class="steps">
  <li><strong>Money in</strong>Make sure ${ui('Money in')} is selected (it turns green).</li>
  <li><strong>Amount</strong>Type the cash you counted, such as 12500.</li>
  <li><strong>Category</strong>Click the Category box and pick <b>Opening balance</b>.</li>
  <li><strong>Save</strong>Press Enter or click ${ui('Save')}.</li>
</ol>
<p>From then on, <b>Cash in hand</b> is this amount plus everything that comes in, less everything that goes out. While the cash book is empty, the list reminds you: "No cash entries yet. Add your cash in hand today as Money in, category Opening balance, to start."</p>
</section>

<section id="add-entry">
<h2>Adding an entry</h2>
<p>The <b>New entry</b> form is at the top of the screen, so you can add one entry after another without opening anything.</p>
<ol class="steps">
  <li><strong>In or out</strong>Click ${ui('Money in')} (green) for cash you received, or ${ui('Money out')} (red) for cash you paid.</li>
  <li><strong>Amount</strong>Required. More than 0, in rupees and paise.</li>
  <li><strong>Name</strong>Who paid you or whom you paid, or what it was for: "Ramesh", "Milk", "Auto". Your clients' names, and names you used before, appear as you type.</li>
  <li><strong>Category</strong>Optional. Pick one of Opening balance, Sales, Advance, Salary, Tea &amp; snacks, Transport, Owner drawing, Deposit to bank or Other, or type your own.</li>
  <li><strong>Date</strong>Today to start. Change it for an entry you forgot yesterday.</li>
  <li><strong>Note</strong>Optional, anything you want to remember.</li>
  <li><strong>Save</strong>Press Enter in any box, or click ${ui('Save')}.</li>
</ol>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>Details</th></tr>
  <tr><td><b>In or out *</b></td><td>${ui('Money in')} or ${ui('Money out')}. The one chosen is coloured.</td></tr>
  <tr><td><b>Amount *</b></td><td>More than 0. Paise allowed (12.50).</td></tr>
  <tr><td><b>Name (who / what)</b></td><td>Up to 120 letters. Suggestions come from your clients and names used before in this cash book.</td></tr>
  <tr><td><b>Category</b></td><td>Pick from the list or type your own, up to 60 letters. Your own word is kept as you typed it.</td></tr>
  <tr><td><b>Date *</b></td><td>The day the cash moved.</td></tr>
  <tr><td><b>Note</b></td><td>Up to 500 letters.</td></tr>
</table></div>
<p><b>The suggestion list.</b> Clicking the Name or Category box, or typing in it, opens a white list under it with the choices that match what you typed. Click one, or use the ↑ and ↓ keys and Enter. Esc closes the list, and Tab moves on to the next box. You can always type your own word instead.</p>
<p>After saving you see, for example, "Money in of ₹500.00 saved." The entry appears in the list, and the amount, name, category and note are cleared for the next one, with the cursor back in Amount. Money in or out and the date stay as they were, so ten counter sales in a row are quick. If the date you gave is outside the dates the list shows, the message says so ("It is dated 05 Oct 2026, outside This month: choose All dates to see it.").</p>
<div class="note tip"><strong>Something wrong?</strong><p>If something is missing you see a message saying what to fix, and nothing is saved: "Enter an amount more than 0", "Enter a date", "Choose Money in or Money out", or "The name is too long (120 letters at most)". "Could not save the entry. Try again.": the app could not reach its data; see <a href="troubleshooting.html#saving">Saving and working in the app</a>. The entry saved but you do not see it: it may be outside the dates chosen below the form; pick <b>All dates</b>.</p></div>
</section>

<section id="from-elsewhere">
<h2>Cash already recorded in the app</h2>
<p>You do not type cash in twice. These show in the cash book on their own, with a small dashed label saying where they came from:</p>
<div class="table-wrap"><table>
  <tr><th>Label</th><th>Where it was made</th><th>Shows when</th></tr>
  <tr><td>Invoice INV-5 payment</td><td>A payment recorded on the <a href="dashboard.html#payments">Dashboard</a></td><td>The payment mode is Cash (money in)</td></tr>
  <tr><td>Invoice CN-2 payment</td><td>A refund recorded on a credit note</td><td>The payment mode is Cash (money out)</td></tr>
  <tr><td>Receipt RCP/26-27/0012</td><td>A <a href="receipts.html">payment receipt</a>; the invoice number follows if it was against one</td><td>The payment mode is Cash (money in)</td></tr>
  <tr><td>Expense</td><td>An <a href="expenses.html#add-expense">expense</a>; its category shows too</td><td>The payment mode is Cash (money out)</td></tr>
  <tr><td>Purchase bill GS/0457 payment</td><td>A <a href="purchases.html#record-payment">payment to a supplier</a> recorded on a purchase bill, with the supplier's name and the reference</td><td>The payment mode is Cash (money out)</td></tr>
</table></div>
<p>These lines cannot be edited or deleted in the cash book (they have no pencil or bin). Click the label to go to the screen it was made on, and change it there; the cash book follows.</p>
<p><strong>Counted once.</strong> Recording a payment on the Dashboard also makes a receipt, and a receipt against an invoice also records a payment on it. It is the same money, so the cash book shows it once, as the receipt.</p>
<p><strong>Paying suppliers.</strong> Record a cash payment to a supplier on the purchase bill (green ${ui('₹')} button in Purchases), not here: it then shows here once, and the bill's balance goes down too. A bill marked Paid from the Status dropdown is not counted as cash (how it was paid is not known). If you added supplier payments here by hand before, and now record them on the bill as well, delete your own entry. See <a href="purchases.html#payments-cash-book">Cash payments and the Cash book</a>.</p>
<p>Invoices and receipts in another currency (export invoices in dollars, for example) are left out: the cash book is in rupees.</p>
</section>

<section id="cash-in-hand">
<h2>Cash in hand and the totals</h2>
<p>The cards at the top show:</p>
<ul>
  <li><b>Cash in hand</b>: all money in, less all money out, up to today. Entries dated in the future are not counted until their day comes. It turns red if it goes below zero, which usually means an entry is missing or the opening balance was not added.</li>
  <li><b>Today</b>: cash in and out today.</li>
  <li><b>This month</b>: cash in and out since the 1st.</li>
</ul>
<p>These cards always count every line, whatever dates or search you choose for the list.</p>
<p>Count the drawer at the end of the day and compare it with Cash in hand. If they differ, look for an entry you forgot.</p>
<div class="note tip"><strong>Something wrong?</strong><p>Cash in hand is red or too low: add your <a href="#opening-balance">opening balance</a>, and check that cash sales recorded on invoices or receipts used mode <b>Cash</b>. It is too high: a cash payment may be entered here and also on a receipt; delete your own entry, since the receipt already counts.</p></div>
</section>

<section id="list">
<h2>The list and the running balance</h2>
<p>The list's title is the dates you chose (such as <b>This month</b>) with the money in and out of the lines shown. The list is oldest first, like a paper cash book; on the same day, lines go in the order entered, money in before money out. Each line shows the date, name and note, category (or where it came from), the amount under <b>Money in</b> or <b>Money out</b>, and the <b>Balance</b>: the cash you had after that line. A line with no name shows "Money in" or "Money out".</p>
<p>The first line, <b>Opening balance (brought forward)</b>, is the cash you had when the chosen dates begin. With <b>All dates</b> there is no such line. The last line, <b>Closing balance</b>, is the cash at the end of them, with the total in and out. When nothing falls in the dates, you see "Nothing in these dates."</p>
</section>

<section id="edit-entry">
<h3>Changing or deleting an entry (Edit entry)</h3>
<p>Your own entries have a pencil and a bin under <b>Actions</b>. The pencil opens the entry in a small <b>Edit entry</b> window, with the same boxes as the New entry form (on a phone it comes up from the bottom of the screen). Change it and click ${ui('Save')} or press Enter. ${ui('Cancel')}, the ${ui('X')}, Esc or a click outside the window leave it as it was. The New entry form at the top is not touched, so you can go back to adding straight away.</p>
<p>${ui('Delete')} at the bottom left of the window deletes the entry, after the same question as the bin below.</p>
<p>The bin deletes the entry. The app asks first, saying how cash in hand will change ("Money out of ₹200.00 on 05 Oct 2026 (Auto) is removed from the cash book..."). Click ${ui('Delete')}. This cannot be undone.</p>
<p>Lines from invoices, receipts and expenses have no pencil or bin. Change them where they were made (<a href="#from-elsewhere">see above</a>).</p>
</section>

<section id="filters">
<h2>Choosing dates and searching</h2>
<p>The bar between the form and the list chooses which lines the list shows.</p>
<div class="table-wrap"><table>
  <tr><th>Choice</th><th>Shows</th></tr>
  <tr><td><b>This month</b></td><td>The 1st to the last day of this month. The choice when you open the screen.</td></tr>
  <tr><td><b>Last month</b></td><td>The whole of last month.</td></tr>
  <tr><td><b>This financial year</b></td><td>1 April to 31 March of the current year.</td></tr>
  <tr><td><b>All dates</b></td><td>Everything, from your first entry.</td></tr>
  <tr><td><b>Choose dates</b></td><td>Two date boxes appear: a from date and a to date. Leave one empty for no limit on that side.</td></tr>
</table></div>
<p>The <b>Search name, note, category...</b> box finds lines by name, note, category, where they came from (such as a receipt or invoice number), or amount. While you search, the totals at the bottom add up only the lines found, and the last line reads <b>Total of these lines</b>; each line still shows its real balance. The red ${ui('X')} button (it shows once you search or change the dates) clears the search and goes back to This month.</p>
</section>

<section id="export">
<h2>Print, PDF and Excel</h2>
<p>${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} above the list save the lines shown, with the dates and search you chose: the opening balance, each line with its balance, and the total. The columns are Date, Name, Note, Category, From (where the line came from, or "Cash book" for your own entries), Money in, Money out and Balance. To make a PDF, click ${ui('Print / PDF')} and choose <b>Save as PDF</b> as the printer. The CSV opens in Excel too.</p>
<p>Your cash book is also saved in your backups. In <a href="backup.html#export-import">Export Backup</a> it travels with <b>Expenses</b>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Nothing to export": no lines are shown for the dates and search chosen; widen the dates. Print / PDF does nothing: allow pop-ups for the app; see <a href="troubleshooting.html#print-blocked">Print does nothing</a>.</p></div>
</section>

<section id="bank-matching">
<h2>Bank matching</h2>
<p>Bank matching checks your bank statement against your books: every payment that came into or went out of the bank should be on an invoice, a purchase bill or an expense. It shows which lines are matched and which are still to match, and records the payments you have not entered yet.</p>
<p>Open ${ui('Cash book')} in the sidebar and click ${ui('Bank matching')} next to the title at the top (${ui('Cash')} goes back). Each business has its own statements, like its cash book.</p>
</section>

<section id="bank-import">
<h3>Importing a statement</h3>
<ol class="steps">
  <li><strong>Download it</strong>In your net-banking, open the account statement for the dates you want and download it as <b>CSV</b> or <b>Excel (.xlsx)</b>. Old Excel files (.xls) cannot be read: open them in Excel and save as .xlsx or CSV.</li>
  <li><strong>Bank</strong>Leave <b>Find out from the file</b>: SBI, HDFC, ICICI, Axis, Kotak, PNB and Yes Bank are recognised from their columns. Other banks work when the file has a date, a description and either Debit and Credit columns or one Amount column (with a minus for money out, a Dr / Cr column, or written as 500.00 Dr). If the lines come out wrong, choose your bank here and import again.</li>
  <li><strong>Import</strong>Click ${ui('Import statement (CSV or Excel)')} and choose the file. You see, for example, "4 lines read (HDFC)".</li>
</ol>
<p>Each line keeps its date, description, the amount in or out, and the bank's reference (cheque, UTR or reference number) when the bank gives one. Dates may be written 05/11/2026, 05-Nov-2026 or 5 November 2026. Opening balance and total rows are left out. A statement of more than 1,000 lines is kept in parts ("part 1 of 3"), each listed under the statements.</p>
<p><strong>Importing twice is safe.</strong> A line already here (same date, amount and reference; when one of the two has no reference, the same description) is skipped, so you can import an overlapping statement, such as the whole month again: "All 4 lines of this statement are already here. Nothing was added."</p>
<p>The cards on top show the <b>Lines</b> imported, how many are <b>Matched</b> (and ignored), how many are still <b>To match</b> with their money in and out, and the total <b>Money in / out</b>. Choose a statement in the bar below the cards to see the numbers for that one statement.</p>
</section>

<section id="bank-suggestions">
<h3>How lines are matched</h3>
<p>For each line still to match, the <b>Match</b> column shows the best suggestion and why it was made, such as "Same amount, 2 days after the unpaid invoice, INV/26-27/0007 is in the description".</p>
<div class="table-wrap"><table>
  <tr><th>Bank line</th><th>Can be</th></tr>
  <tr><td>Money in</td><td>A payment already recorded on an invoice, or an unpaid or partly paid invoice whose balance is that amount</td></tr>
  <tr><td>Money out</td><td>A payment already recorded on a purchase bill, an unpaid purchase bill, or an expense (paid or unpaid)</td></tr>
</table></div>
<ul>
  <li><b>Amount</b>: the same, or within ₹1 (round-off). For an unpaid invoice or bill, its balance or up to ₹1 more: a payment short of the balance is not suggested, since it would leave the invoice Partly paid (pick it by hand if the client really paid less).</li>
  <li><b>Date</b>: within 7 days of a payment or expense already entered. An unpaid invoice or bill may be paid any time after its date, but not more than 7 days before it.</li>
  <li><b>Name or number</b>: a suggestion comes first when the client's or supplier's name, or the invoice or bill number, is in the bank's description.</li>
</ul>
<p>Invoices in another currency, cancelled invoices, quotations and challans are not suggested, nor are partly paid expenses. Payments and expenses paid in <b>Cash</b> are never suggested: cash does not go through the bank. A payment or expense matched to one line is not offered for another.</p>
</section>

<section id="bank-actions">
<h3>Confirm, pick, ignore, undo</h3>
<p>The buttons under <b>Actions</b>:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>Green tick (Confirm)</td><td>Accepts the suggestion: the line becomes <b>Matched</b>. For an unpaid invoice or purchase bill it also records the payment on it, dated the bank date, mode <b>Bank transfer</b>, with the bank's reference, exactly as Record Payment does: the balance and status change, and an invoice payment gets its receipt. For an unpaid expense it marks the expense paid by bank transfer.</td></tr>
  <tr><td>Magnifier, or the receipt icon on money out (Pick)</td><td>Opens a list under the line: the suggestions, then the other invoices, bills and expenses nearest in amount. Type an invoice number, a name or an amount to find one, and click ${ui('Use')}. On money out you can instead type a category (Bank Charges to start) and click ${ui('Add as expense')}: an expense paid by bank transfer is added, dated the bank date.</td></tr>
  <tr><td>Crossed eye (Ignore)</td><td>For lines that are not in your books: bank charges you do not track, transfers between your own accounts, a loan. The line is counted as <b>Ignored</b>.</td></tr>
  <tr><td>Curved arrow (Undo)</td><td>Puts the line back to <b>To match</b>. If confirming recorded a payment, the payment (and its receipt) is taken back and the balance goes up again; if it added an expense, the expense is deleted; if it marked an expense paid, the expense is as it was. The app asks first.</td></tr>
</table></div>
<p>The list shows the lines <b>To match</b> to start; choose <b>All lines</b>, <b>Matched</b> or <b>Ignored</b> in the bar, or search by description, reference or amount. The bin next to a chosen statement removes it from Bank matching (your invoices, bills and expenses are not changed); undo its lines that recorded a payment or added an expense first.</p>
<p>Payments recorded here use mode Bank transfer, so they are not in the cash book, which counts cash only. Your statements and their matches are in your backups: in <a href="backup.html#export-import">Export Backup</a> they travel with <b>Expenses</b>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"No transactions found": the file is not a statement the app can read; download the CSV or Excel statement again, or choose your bank. "Could not read this statement": the file is damaged, or an old .xls. No suggestion for a line you know is there: the amount or date may be off by more than ₹1 or 7 days; use the magnifier to pick it by hand. "Payments of ... are more than ... this bill comes to": the bank amount is more than the purchase bill's balance; pick the right bill. "Could not save the match, so the payment was taken back. Try again.": the app could not save the line, so it undid the payment it had just recorded; nothing is half done. Try again, and if it keeps happening see <a href="troubleshooting.html#saving">Saving and working in the app</a>.</p></div>
</section>
`,
},

// =============================================================================
{
  slug: 'recurring',
  title: 'Recurring invoices',
  lead: 'Invoices that repeat on a schedule, such as a monthly retainer, rent or an annual maintenance contract.',
  body: `
<p>A recurring invoice is a template: the client, the items and a schedule. On each due date the app makes a real invoice from it by itself, with a fresh number, ready for you to check and send. Use it for anything you bill the same way again and again: monthly rent, an accountant's retainer, an AMC (annual maintenance contract), a weekly supply.</p>

<section id="two-ways">
<h2>Two ways to set one up</h2>
<ul>
  <li><strong>From an invoice</strong> (recommended): make the first invoice as usual, and under ${ui('Customize')} tick <a href="invoice-options.html#recurring">Make this a recurring invoice</a>. This keeps everything on the invoice, including HSN/SAC codes, discounts, taxes, place of supply, terms and options, and lets you set <b>Every N</b> and an end date or number of invoices.</li>
  <li><strong>From the Recurring screen</strong>: ${ui('New Template')} with a client, frequency, next date, when to stop, type and simple item lines (<a href="#template-form">below</a>). Quicker, but the item lines have no HSN/SAC code or discount.</li>
</ul>
<p>Both appear in the same <a href="#list">Recurring Templates</a> list and are made into invoices the same way.</p>
</section>

<section id="template-form">
<h2>The New Recurring Invoice form</h2>
<p>Click ${ui('New Template')} at the top right (or ${ui('Create Template')} when the list is empty). A box titled <b>New Recurring Invoice</b> opens.</p>
<ol class="steps">
  <li><strong>Pick the client</strong>Click them under <b>Quick Select Client</b> (<a href="#quick-select-client">why this matters</a>), or type the <b>Client Name</b>.</li>
  <li><strong>Set the schedule</strong>Choose the <b>Frequency</b> and <b>Every</b>, and the <b>Next Due Date</b>: the date of the first invoice.</li>
  <li><strong>Say when to stop</strong>Leave <b>Stop</b> at Never, or pick a date or a number of invoices.</li>
  <li><strong>Add the items</strong>Fill in at least one line under <a href="#line-items">Line Items</a>.</li>
  <li><strong>Save</strong>Click ${ui('Save')}. You see "Recurring invoice created" and it appears in the list.</li>
</ol>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What it does</th></tr>
  <tr><td><b>Quick Select Client</b></td><td>Your saved clients. Picking one fills in the name and GSTIN, and also keeps their state, address, country and SEZ status for the invoices.</td></tr>
  <tr><td><b>Client Name *</b></td><td>Required. Printed on every invoice.</td></tr>
  <tr><td><b>Client GSTIN</b></td><td>Optional, 15 characters. Leave empty for a customer without GST (B2C).</td></tr>
  <tr><td><b>Frequency</b></td><td>Weekly, Monthly (the default), Quarterly or Yearly.</td></tr>
  <tr><td><b>Every</b></td><td>1 to 12. 1 means every period. Monthly with 3 means every three months; Weekly with 2 means every fortnight.</td></tr>
  <tr><td><b>Next Due Date</b></td><td>When the next invoice is made. The 1st of next month, to start. Monthly schedules come back to this day of the month: start on the 31st and you get 31 January, 28 (or 29) February, 31 March.</td></tr>
  <tr><td><b>Stop</b></td><td><b>Never (until I stop it)</b>; <b>On a specific date</b>, which shows <b>Stop after this date</b> (an invoice due on that date is still made); or <b>After N invoices</b>, which shows <b>Number of invoices</b>, such as 12 for a one-year monthly contract.</td></tr>
  <tr><td><b>Invoice Type</b></td><td>Tax Invoice (the default), Quotation, Proforma / Estimate, Bill of Supply (No GST), Composition (Bill of Supply), Credit Note or Delivery Challan. Each type uses its own number series (INV, QUO, EST, BOS, COMP, CN, DC).</td></tr>
  <tr><td><b>Line Items</b></td><td>What you bill each time. See <a href="#line-items">Line Items</a>.</td></tr>
</table></div>
<p>${ui('Cancel')}, or a click outside the box, closes it without saving.</p>
</section>

<section id="quick-select-client">
<h3>Quick Select Client</h3>
<p>This list shows when you start a new template, you have saved <a href="clients.html">clients</a>, and <b>Client Name</b> is still empty. Each line shows the client's name, state and GSTIN. Clicking one fills in the form and hides the list. To pick someone else, empty <b>Client Name</b> and the list comes back.</p>
<p><strong>Why pick rather than type:</strong> the client's state, country and SEZ status decide the tax on each invoice: CGST + SGST for a client in your own state, IGST for another state, an SEZ or a client abroad. These are not shown in the form, so they are only kept when you pick the client from the list. A name typed by hand has no state saved with it. See <a href="glossary.html#terms">GST terms</a> for place of supply, CGST, SGST and IGST.</p>
</section>

<section id="line-items">
<h3>Line Items</h3>
<p>Each line is one thing you bill every time:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to enter</th></tr>
  <tr><td><b>Description</b></td><td>What it is, such as "Monthly accounting retainer" or "Shop rent, Ground floor". A line with no description is left out when you save.</td></tr>
  <tr><td><b>Qty</b></td><td>How many, 1 to start.</td></tr>
  <tr><td><b>Rate</b></td><td>The price of one, before GST.</td></tr>
  <tr><td><b>GST%</b></td><td>The GST rate, 18 to start. Use 0 for exempt items or a bill of supply.</td></tr>
</table></div>
<p>${ui('Add Item')} adds another line. The red ${ui('X')} at the end of a line removes it (it shows once there is more than one line). You need at least one line with a description and a rate, or you see "Add at least one item with description and rate".</p>
<p>The amount in the list is worked out from these lines with the full GST rules, exactly as the invoice will be.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Client name required": fill in <b>Client Name</b>. The invoices charge IGST instead of CGST + SGST, or the other way round: the client's state was not saved; delete the template and make it again, picking the client from Quick Select (or make it from an invoice). See <a href="troubleshooting.html#wrong-tax">The invoice has the wrong tax split</a> and <a href="troubleshooting.html#state-missing">Set your business State</a>. You need an HSN/SAC code or a discount on the lines: make the template <a href="invoice-options.html#recurring">from an invoice</a>.</p></div>
</section>

<section id="list">
<h2>The Recurring Templates list</h2>
<p>Every template of the business you are working in, by client name A to Z.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>What it shows</th></tr>
  <tr><td><b>Client</b></td><td>Who is billed.</td></tr>
  <tr><td><b>Frequency</b></td><td>Weekly, Monthly, Quarterly, Yearly, or "Every 3 months" and so on.</td></tr>
  <tr><td><b>Type</b></td><td>The invoice type made.</td></tr>
  <tr><td><b>Amount</b></td><td>The total of each invoice, with GST, in the template's currency.</td></tr>
  <tr><td><b>Next Due</b></td><td>When the next invoice will be made. Shown in bold orange, and the row is highlighted, when it is due today or overdue.</td></tr>
  <tr><td><b>Status</b></td><td><b>Active</b> (green) or <b>Paused</b> (grey).</td></tr>
  <tr><td><b>Actions</b></td><td>${ui('▶')} Generate Now (green), Pause or Activate, the pencil to <a href="#edit-template">edit</a>, the bin to <a href="#pause-delete">delete</a>.</td></tr>
</table></div>
<figure><img src="${img('app-recurring.png')}" alt="The recurring template list." loading="lazy"><figcaption>The recurring template list.</figcaption></figure>
</section>

<section id="due-banner">
<h2>Invoices due for generation</h2>
<p>When an <b>Active</b> template's next date has come and its invoice has not been made yet, an orange box at the top says, for example, "<b>2 invoices due for generation</b>", with one button per template showing the client and frequency (such as "Sharma Traders — Monthly").</p>
<p>Usually you do nothing: the app makes them by itself within the hour (<a href="#automatic">see below</a>). Click a button to make that invoice straight away; it works exactly like <a href="#generate-now">Generate Now</a>. Paused templates never show here.</p>
</section>

<section id="automatic">
<h2>How invoices are created automatically</h2>
<p>A few seconds after the app starts, and then every hour while it is running, every <b>Active</b> template whose next date has come, and which has not reached its end, creates its invoice:</p>
<ul>
  <li>a fresh number in that type's series (and the business's own series, if it has one);</li>
  <li>that day's date, status Unpaid, and a due date the same number of days later as on the invoice it was made from (none for templates made on this screen);</li>
  <li>the client, items and full GST working: CGST + SGST or IGST, cess, TDS/TCS, discounts and round-off, as on the invoice screen.</li>
</ul>
<p>Its <b>Next Due</b> then moves on by the schedule, and it stops at its end condition. The notification bell says how many were made today ("2 recurring invoices auto-generated today"). They appear on the <a href="dashboard.html#invoice-list">Dashboard</a>, ready to check and send.</p>
<p>If the app was closed for a while, a missed month is not skipped: one invoice is made at start-up and one more at each hourly check, until the template has caught up. Each is dated the day it is made; change the date on the invoice if you need the missed date.</p>
<div class="note tip"><strong>Something wrong?</strong><p>No invoice was made: check that the template is <b>Active</b>, its <b>Next Due</b> is today or earlier, it has not reached its <b>Stop</b> condition, and the app is running. Two invoices for one month: the template was caught up after the app was closed, or ${ui('▶')} was clicked as well; delete or cancel the extra one on the Dashboard. "Invoice number ... already exists": see <a href="troubleshooting.html#duplicate-number">this fix</a>.</p></div>
</section>

<section id="generate-now">
<h2>Generate Now</h2>
<p>${ui('▶')} creates the invoice straight away, even if the template is paused or not yet due, exactly as the automatic run would: same tax, a fresh number, today's date. You see "Invoice INV/2026-27/0042 generated for ..." Its next date moves on by the schedule and it counts towards "After N invoices". Once a template has reached its end, you see "Failed to generate: This template has reached its end date or number of invoices" instead. Open the new invoice from the Dashboard to check it before sending.</p>
</section>

<section id="edit-template">
<h2>Editing a template (Edit Template)</h2>
<p>Click the pencil on a template's row. The form opens titled <b>Edit Template</b>, with everything filled in. Change the schedule, stop condition, type or lines and click ${ui('Update')}. You see "Template updated". Invoices already made do not change; the next one uses the new details.</p>
<ul>
  <li>Everything the form does not show is kept: terms, notes, invoice options, HSN codes and discounts on the lines, tax-inclusive prices, place of supply, and the client's state and country.</li>
  <li>Changing <b>Next Due Date</b> also moves the day of the month the schedule comes back to.</li>
  <li>Quick Select Client does not show while editing. To bill a different client, make a new template.</li>
  <li>Saving files the template under the business selected now, so edit it while that business is selected.</li>
</ul>
</section>

<section id="pause-delete">
<h2>Pause, Activate and Delete</h2>
<p><strong>Pause</strong> (the pause button on an Active row) stops the automatic invoices but keeps the template; you see "Paused". The button becomes <strong>Activate</strong> (a play button); click it to start again ("Activated"). If the next date passed while it was paused, the invoice is made at the next check. Use Pause for a client who stops for a few months.</p>
<p><strong>Delete</strong> (the bin) asks "Delete this recurring invoice?"; click ${ui('Delete template')}. No more invoices are made from it. Invoices already made stay on the Dashboard. This cannot be undone.</p>
</section>

<section id="unassigned">
<h2>Templates not assigned to a business</h2>
<p>Templates saved before the app kept businesses separate show under every business. If you have any, a blue strip says, for example, "<b>2 recurring templates</b> are not assigned to a business", with a button ${ui('Assign to')} followed by the business selected now. Click it only if they belong to that business; the app asks you to confirm first. See <a href="settings.html#multiple-businesses">More than one business</a>.</p>
</section>
`,
},
];
