const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

export default [
// =============================================================================
{
  slug: 'purchases',
  title: 'Purchase bills',
  lead: 'Record every supplier bill, so the GST you paid comes back as input tax credit and your stock stays right. Includes reading a bill from a photo, importing bills from a CSV file, and purchase orders to send suppliers.',
  body: `
<div class="note info"><strong>Purchase bill or expense?</strong>
<p>Use <b>Purchases</b> for goods you buy to sell or to make things with (stock), from a supplier's tax invoice. Use <a href="expenses.html">Expenses</a> for running costs that are not stock: rent, electricity, phone, software, travel, salary. Enter each bill in one place only. A bill entered in both is counted twice, and its GST is claimed twice in GSTR-3B.</p></div>

<section id="purchase-list">
<h2>The purchase list</h2>
<p>Open <b>Purchases</b> from the menu. The screen is called <b>Purchase Bills</b>, or <b>Purchases</b> when <a href="#purchase-orders">purchase orders</a> are turned on. Then two buttons sit under the title: ${ui('Purchase bills')} (the list on this page) and ${ui('Purchase orders')}.</p>
<p>The buttons at the top right:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Import from image (OCR)')}</td><td>Reads a photo of a supplier's bill and fills the form for you. See <a href="#ocr">Reading a bill from a photo</a>.</td></tr>
  <tr><td>${ui('CSV import / export')}</td><td>Brings in many bills at once from a spreadsheet, or saves all of them as one CSV. See <a href="#csv-purchases">Importing purchase bills from CSV</a>.</td></tr>
  <tr><td>${ui('Add Purchase')}</td><td>Opens a blank purchase bill. See <a href="#add-purchase">Adding a purchase bill</a>.</td></tr>
</table></div>

<h3>The four totals</h3>
<p><b>Total Purchases</b> is the full value of the bills shown, with GST, cess and round-off. <b>Owed to suppliers</b> is what you still have to pay on those bills (see <a href="#owed-to-suppliers">What you owe suppliers</a>). <b>GST (ITC Eligible)</b> is the GST on those bills (CGST + SGST + IGST, without cess): the input tax credit they give you. <b>Entries</b> is how many bills are shown. All four follow the search and filters below them, so picking last year shows last year's totals.</p>

<h3>Search and filters</h3>
<ul>
  <li><b>Search supplier, invoice...</b>: type part of a supplier's name, their invoice number or their GSTIN.</li>
  <li><b>Year</b>: the current financial year (April to March) to start. Pick one of the last five years, or <b>All years</b>.</li>
  <li><b>All bills</b> / <b>Unpaid / Partly paid</b> / <b>Paid</b>: pick <b>Unpaid / Partly paid</b> to see only the bills you still have to pay.</li>
  <li><b>Cost centre</b>: only when <a href="reports.html#cost-centres">cost centres</a> are turned on. <b>All cost centres</b>, <b>No cost centre</b>, or one branch, site or project.</li>
  <li>The red ${ui('✕')} clears the search, the status and the cost centre. The year stays as it is.</li>
</ul>

<h3>Purchase Records</h3>
<p>The table lists <b>Date</b>, <b>Supplier</b>, <b>GSTIN</b>, <b>Invoice No</b>, <b>Taxable</b> (value before GST), <b>Tax</b> (GST), <b>Total</b>, <b>Balance due</b> (what is still to pay, in red; a dash when nothing is), <b>Status</b> and <b>Actions</b>, newest first, with a <b>Total</b> row at the bottom. The ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} buttons at the top of the table save the <a href="#export">purchase register</a>.</p>
<div class="table-wrap"><table>
  <tr><th>On each row</th><th>What it does</th></tr>
  <tr><td><b>Status</b> dropdown</td><td>Unpaid, Partly paid or Paid. Picking Paid or Unpaid saves at once; Partly paid opens the payment window for the amount. See <a href="#mark-paid">Marking a bill paid from the list</a>.</td></tr>
  <tr><td>Eye</td><td>Opens the bill to look at, without downloading anything. See <a href="#view-bill">Viewing a bill</a>.</td></tr>
  <tr><td>${ui('₹')} (green)</td><td>Records a payment to the supplier, and shows the payments already made. See <a href="#record-payment">Recording a payment to a supplier</a>.</td></tr>
  <tr><td>Pencil</td><td>Opens the bill in the form to change it.</td></tr>
  <tr><td>Bin</td><td>Deletes the bill, after asking. Its quantities are taken back out of stock (see <a href="#stock">What saving does to your products</a>). GST credit already claimed in a return you filed stays as filed.</td></tr>
</table></div>
<p>With no bills yet, the table says <b>No purchase bills recorded yet.</b> with an ${ui('Add Purchase')} button. If you have bills but the filters hide them all, it says <b>No purchases match your filters.</b>: clear the search or pick <b>All years</b>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>A bill I entered is missing.</b> Check the year: a bill dated March 2026 is in FY 2025-26, not the current year. Pick <b>All years</b> and search for the invoice number. Also check the business selected in the sidebar: each business sees only its own bills.</p>
<p><b>The same bills show under two businesses.</b> They were saved before you kept businesses separate. See <a href="#unassigned">Not assigned to a business</a>.</p></div>
</section>

<section id="view-bill">
<h3>Viewing a bill</h3>
<p>Click the eye on a row. A window titled <b>Purchase Bill · </b><i>invoice number</i> shows:</p>
<ul>
  <li>the date, payment status, and <b>Intrastate (CGST+SGST)</b> or <b>Interstate (IGST)</b>;</li>
  <li>the <b>Supplier</b> box: name, address and GSTIN;</li>
  <li>the items: <b>#</b>, <b>Description</b>, <b>HSN</b>, <b>Qty</b>, <b>Rate</b>, <b>GST%</b> and <b>Amount</b> (quantity × rate, plus GST);</li>
  <li>the totals: <b>Taxable</b>, then <b>CGST</b> and <b>SGST</b> (half each) or <b>IGST</b>, <b>Cess</b> and <b>Round-off</b> when there are any, and the <b>TOTAL</b>;</li>
  <li><b>Less: TDS</b> and <b>Paid to supplier</b> when you keep back TDS, then <b>Paid</b> (the payments added up) and <b>Balance due</b>;</li>
  <li><b>Payments made</b>: each payment's date, amount, mode and reference;</li>
  <li>the note, if the bill has one.</li>
</ul>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Close')}</td><td>Closes the window. Clicking outside it does the same.</td></tr>
  <tr><td>${ui('Payments')}</td><td>Opens the payment window to record, change or delete a payment. See <a href="#record-payment">Recording a payment to a supplier</a>.</td></tr>
  <tr><td>${ui('Edit')}</td><td>Opens the bill in the form.</td></tr>
  <tr><td>${ui('Download PDF')}</td><td>Saves a one-page A4 <b>PURCHASE BILL</b> PDF named <code>Purchase-</code><i>invoice no</i><code>-</code><i>date</i><code>.pdf</code>, with the supplier, the items, the tax split and the total, then the payments made, <b>Paid</b> and <b>Balance due</b>. Long item names wrap onto more lines instead of being cut. The coloured lines follow your PDF accent colour in <a href="print-settings.html#colours">print settings</a>.</td></tr>
</table></div>
<p>This PDF is your own record of the bill. It is not a tax invoice: the supplier's bill is.</p>
</section>

<section id="add-purchase">
<h2>Adding a purchase bill</h2>
<p>Click ${ui('Add Purchase')}. The <b>Add Purchase Bill</b> form opens (<b>Edit Purchase Bill</b> when you clicked a pencil). Copy the details from the supplier's bill.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put in</th></tr>
  <tr><td><b>Date *</b></td><td>The date on the supplier's bill. Today to start. This decides which month's GSTR-3B the credit goes into.</td></tr>
  <tr><td><b>Payment Status</b></td><td>Unpaid (to start) or Paid. Paid records one payment for the whole amount. To record what you actually paid (a part payment, UPI, cash), save the bill and use the green ${ui('₹')} button in the list. Once a bill has payments, this box only shows its status. See <a href="#payment-status">Paying suppliers</a>.</td></tr>
  <tr><td><b>Supplier Name *</b></td><td>Required. Suppliers from your earlier bills are suggested as you type. Picking one fills in their GSTIN, address and <b>Inter-state purchase</b> from their last bill.</td></tr>
  <tr><td><b>Supplier GSTIN</b></td><td>The supplier's 15-character GST number, from the top of their bill. Typing the full GSTIN ticks or unticks <b>Inter-state purchase</b> for you (see <a href="#interstate">Suppliers in another state</a>). Leave it blank for an unregistered supplier.</td></tr>
  <tr><td><b>Supplier Address (optional)</b></td><td>Street, city, state. Printed on the purchase bill PDF.</td></tr>
  <tr><td><b>Invoice Number *</b></td><td>Required. The <i>supplier's</i> invoice number exactly as printed, such as <code>GS/2026/0457</code>. GSTR-2B matching uses it, so do not shorten it.</td></tr>
  <tr><td><b>Note (optional)</b></td><td>Anything for yourself, such as "paid by cheque 004512".</td></tr>
  <tr><td><b>Cost centre</b></td><td>Only when cost centres are on. The branch, site or project this bill belongs to, or <b>None</b>. See <a href="reports.html#cost-centres">Cost centres</a>.</td></tr>
  <tr><td><b>Inter-state purchase</b></td><td>Tick when the supplier charged IGST. See <a href="#interstate">Suppliers in another state</a>.</td></tr>
</table></div>
<p>Under the fields come the <a href="#purchase-items">Items</a>, the running totals and <a href="#round-off">Apply round-off</a>.</p>
<ol class="steps">
  <li><strong>Supplier</strong>Type the supplier's name. If you have bought from them before, pick them from the list: GSTIN and address fill in.</li>
  <li><strong>Bill details</strong>Set the <b>Date</b> and type the <b>Invoice Number</b> from their bill. Leave <b>Payment Status</b> on Unpaid and record the payment after saving (<a href="#record-payment">see how</a>), or pick Paid if you paid it all and do not need the details.</li>
  <li><strong>Items</strong>Add one row for each line on their bill: name, HSN, quantity, rate before GST, and GST rate. See <a href="#purchase-items">Items on the bill</a>.</li>
  <li><strong>Check the total</strong>The strip under the items shows Taxable, CGST and SGST (or IGST), Cess and Total. Compare them with the supplier's bill. If only the paise differ, tick <b>Apply round-off</b>.</li>
  <li><strong>Save</strong>Click ${ui('Save')} (${ui('Update')} when editing). ${ui('Cancel')}, or clicking outside the form, closes it without saving.</li>
</ol>
<p>After saving, the message <b>Purchase added — items synced to Products</b> appears, the bill is at the top of the list, and the quantities are added to your <a href="#stock">product stock</a>.</p>
<p>A bill made from a purchase order shows <b>From purchase order</b> <i>PO number</i> under the title. See <a href="#convert-po">Turning a purchase order into a bill</a>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Supplier name is required"</b> or <b>"Invoice number is required"</b>: fill in that field. <b>"Add at least one item with a quantity and rate"</b>: a bill needs at least one item with a name, a quantity and a rate above zero.</p>
<p><b>My total does not match the supplier's bill.</b> Check that <b>Rate</b> is the price <i>before</i> GST (the taxable rate), that each <b>Tax %</b> is right, and that cess is entered. Then check <b>Inter-state purchase</b>: it changes the split, not the total. Paise differences are what round-off is for.</p>
<p><b>The wrong GSTIN came in when I picked a supplier.</b> The suggestion uses their last bill. Type the correct GSTIN over it; it is kept.</p>
<p><b>"Failed to save purchase"</b>: the app could not reach its data. See <a href="troubleshooting.html#saving">Saving problems</a>.</p></div>
</section>

<section id="purchase-tds">
<h3>TDS on a purchase bill</h3>
<p>If you must deduct income-tax TDS when you pay this supplier (a contractor under 194C, a professional under 194J, rent under 194I...), record it on the bill. Under the totals strip, tick <b>TDS deducted</b>:</p>
<ol class="steps">
  <li><strong>Section</strong>Pick the section. Its usual rate fills in.</li>
  <li><strong>Rate or amount</strong>Check the <b>Rate %</b>: the TDS is worked out on the taxable value (before GST), and the amount box shows it as a hint. To use an exact figure instead, type it in the amount box.</li>
  <li><strong>Check</strong>The strip shows <b>Less TDS</b> and <b>Paid to supplier</b> (the bill total less the TDS): that is what you pay the supplier. The bill's total itself does not change, and nor does the GST credit.</li>
</ol>
<p>When you <a href="#record-payment">record payments</a> on this bill, they are measured against <b>Paid to supplier</b>, not the total: paying that amount makes the bill <b>Paid</b>, and its <b>Balance due</b> is what is left of it.</p>
<p>The view and the PDF of the bill show the TDS and <b>Paid to supplier</b> under the total. Every bill with TDS is listed in <a href="reports.html#tds-on-purchases">Reports, TDS &amp; TCS</a>, totalled by section and quarter, for depositing the TDS and filing your Form 26Q. You need a TAN to deduct TDS; ask your CA whether a payment needs it.</p>
</section>

<section id="purchase-items">
<h3>Items on the bill</h3>
<p>Each row of <b>Items</b> is one line of the supplier's bill.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>What to put in</th></tr>
  <tr><td><b>Name</b></td><td>The item. As you type, your products and items from earlier bills are suggested (your Products list first). Picking one fills in its <b>HSN</b>, its purchase price as <b>Rate</b>, its <b>Tax %</b> and <b>Cess %</b>. Use the same name as in Products, so stock goes to the right product.</td></tr>
  <tr><td><b>HSN</b></td><td>The HSN code (goods) or SAC code (services) printed on the supplier's bill.</td></tr>
  <tr><td><b>Qty</b></td><td>How many. Decimals are fine: 2.5 kg, 0.75 m.</td></tr>
  <tr><td><b>Rate</b></td><td>The price of <b>one</b> unit <b>before GST</b>, as on the supplier's bill.</td></tr>
  <tr><td><b>Tax %</b></td><td>The GST rate: 0%, 0.1%, 0.25%, 3%, 5%, 12%, 18% (to start), 28% or 40%. For any other rate pick ${ui('Other…')}: a box asks for a rate between 0 and 100 (up to two decimals), then ${ui('Apply rate')}.</td></tr>
  <tr><td><b>Cess %</b></td><td>Compensation cess, only for goods that carry it (tobacco, pan masala, aerated drinks, coal, some vehicles). 0 for everything else.</td></tr>
  <tr><td>Bin</td><td>Removes the row. The last row cannot be removed.</td></tr>
</table></div>
<p>${ui('Add Item')} adds a new row and puts the cursor in its name, so you can keep typing: ${key('Tab')} to the button, ${key('Enter')}, and type the next item.</p>
<p>Clicking <b>Qty</b>, <b>Rate</b> or <b>Cess %</b> selects what is in it, so typing replaces it (you get 18, not 018).</p>
<p>If you pick a different item in the same row, its details replace the old item's. A value you typed yourself is kept.</p>
<p>The strip under the items adds up as you type: <b>Taxable</b> (quantity × rate for every row), <b>CGST</b> and <b>SGST</b> (half the GST each) or <b>IGST</b> for an inter-state bill, <b>Cess</b> when there is any, <b>Round-off</b> when ticked, and <b>Total</b>.</p>
<div class="note info"><strong>HSN, CGST, SGST, IGST?</strong>
<p><b>HSN</b> is the code for the type of goods (<b>SAC</b> for services). <b>CGST</b> and <b>SGST</b> are the central and state halves of GST, charged when the supplier is in your state; <b>IGST</b> is the single tax charged when they are in another state. See the <a href="glossary.html#terms">glossary</a>.</p></div>
</section>

<section id="round-off">
<h2>Round-off</h2>
<p>Most suppliers round their bill total to the nearest rupee. If yours did, tick <b>Apply round-off</b> under the items, so your total matches theirs: ₹1,234.56 becomes ₹1,235 (round-off +₹0.44), ₹1,234.40 becomes ₹1,234 (round-off −₹0.40).</p>
<p>It is off to start, because many bills already match the items exactly. The round-off is kept separate: it changes the bill's total, not its GST, so your input tax credit stays exactly what the supplier charged. It shows on the view, the PDF and the purchase register.</p>
<p>An old bill with a round-off amount saved on it opens with the box already ticked.</p>
</section>

<section id="interstate">
<h2>Suppliers in another state</h2>
<p>When a supplier is in <b>your</b> state, their bill charges <b>CGST + SGST</b>. When they are in a <b>different</b> state, it charges <b>IGST</b> instead. Tick <b>Inter-state purchase</b> for an IGST bill, so the credit goes to IGST in GSTR-3B rather than CGST and SGST. Getting it wrong puts the credit in the wrong column.</p>
<p>You rarely need to tick it yourself:</p>
<ul>
  <li><strong>Typing the supplier's full GSTIN</strong> ticks or unticks it. The first two digits of a GSTIN are the state code (03 Punjab, 07 Delhi, 27 Maharashtra...), compared with the state of your business in <a href="settings.html#company-details">Settings</a>.</li>
  <li><strong>Picking a supplier</strong> you have bought from before uses what their last bill had.</li>
  <li><strong>Reading a bill photo</strong> ticks it when the bill shows IGST and no CGST.</li>
</ul>
<p>You can still change it by hand, for the rare exception. Simply look at the supplier's bill: IGST printed means ticked; CGST and SGST printed means not ticked.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>If the box does not tick itself when you type a GSTIN, your own state may be missing. Fill in <b>State</b> in <a href="settings.html#company-details">Settings, Company Details</a>. See also <a href="troubleshooting.html#wrong-tax">The wrong tax split</a>.</p></div>
</section>

<section id="itc">
<h2>How the GST credit is used</h2>
<p>Input tax credit (ITC) is the GST you paid on what you bought, which you subtract from the GST you collected on sales. The app adds up the GST on every purchase bill and every <a href="expenses.html#gst-credit">expense</a> in the period, and puts it in Table 4 (Eligible ITC) of <a href="gst-returns.html#gstr-3b">GSTR-3B</a>: to IGST for an inter-state bill, otherwise half to CGST and half to SGST. Cess on purchase bills goes in as cess credit. The credit goes into the month of the bill's <b>Date</b>.</p>
<p>The purchase form has no switch for reverse charge, blocked credit or a separate place of supply. Every bill's GST is counted as credit. So:</p>
<ul>
  <li><strong>Check against GSTR-2B.</strong> Only credit your supplier has reported usually can be claimed. Import your GSTR-2B on the GST Returns screen and compare: see <a href="gst-returns.html#gstr-2b">Checking your credit against GSTR-2B</a>. Matching uses the supplier GSTIN and invoice number, so type them exactly.</li>
  <li><strong>Credit you cannot claim</strong> (food and drinks, personal use, motor cars in most cases, a supplier who has not filed): leave it out when you file on the portal, or ask your CA. The app does not know which credit is blocked.</li>
  <li><strong>Reverse charge</strong> (you pay the GST instead of the supplier, for example on goods transport or legal services): the app does not work this out on purchases. Ask your CA how to show it.</li>
</ul>
<p>Purchase bills also feed the <a href="income-tax.html#itr-summary">Income Tax</a> screen (your purchases, without GST, are subtracted from sales). The <a href="reports.html#profit-loss">Profit &amp; Loss</a> report on Reports uses sales and expenses only, not purchase bills.</p>
</section>

<section id="payment-status">
<h2>Paying suppliers</h2>
<p>Each time you pay a supplier, record the payment on their bill: how much, when, and how (cash, UPI, bank transfer, cheque, card). You can pay a bill in parts, and record as many payments as you made. The app then shows what each bill, and each supplier, still needs to be paid.</p>
<p>Each bill has a status, shown in colour in the <b>Status</b> column of the list:</p>
<div class="table-wrap"><table>
  <tr><th>Status</th><th>Means</th></tr>
  <tr><td><b>Unpaid</b> (amber)</td><td>No payment recorded yet. The whole amount is still to pay.</td></tr>
  <tr><td><b>Partly paid</b> (purple)</td><td>Some payments are recorded, but they add up to less than the bill. <b>Balance due</b> shows what is left.</td></tr>
  <tr><td><b>Paid</b> (green)</td><td>The payments add up to the bill (less any TDS you keep back). Nothing is due.</td></tr>
</table></div>
<p>You do not set the status by hand: it follows the payments. Record a payment and it changes; delete one and it changes back.</p>
<figure><img src="${img('purchase-status.png')}" alt="Purchase Records with a Status dropdown on each row"></figure>
<p>The status does not change the GST credit: credit depends on the bill, not on whether you have paid it yet. (By law you must pay the supplier within 180 days to keep the credit.)</p>
<div class="note info"><strong>Bills from before payments could be recorded</strong>
<p>A bill you marked <b>Paid</b> in an older version has no payments on it. It stays <b>Paid</b> and owes nothing; you do not need to do anything. A bill marked <b>Partial</b> stays Partly paid, but the app does not know how much was paid, so its Balance due shows the whole amount until you record the payments you made.</p></div>
</section>

<section id="record-payment">
<h3>Recording a payment to a supplier</h3>
<p>In <b>Purchase Records</b>, find the bill and click the green ${ui('₹')} button under <b>Actions</b> (or open the bill with the eye and click ${ui('Payments')}). The window <b>Record payment to supplier</b> opens. At the top it shows the bill number and supplier, the <b>Total</b>, <b>Less TDS</b> if you keep back TDS, what is <b>Paid</b> so far and the <b>Balance</b> still to pay.</p>
<ol class="steps">
  <li><strong>Amount paid</strong>It starts at the balance still to pay. Leave it to pay the bill off, or type what you actually paid, such as 5000.</li>
  <li><strong>Payment date</strong>Today to start. Change it to the day the money left you.</li>
  <li><strong>Payment mode</strong>Cash, UPI, Bank transfer, Cheque, Card or Other.</li>
  <li><strong>Reference / cheque no.</strong>Optional: the UTR or UPI reference from your bank, or the cheque number.</li>
  <li><strong>Note</strong>Optional, anything you want to remember.</li>
  <li><strong>Save</strong>Click ${ui('Record Payment')}. The message says how much was recorded and what is left, for example "Payment of ₹5,000.00 recorded · ₹6,800.00 left to pay".</li>
</ol>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>Details</th></tr>
  <tr><td><b>Amount paid *</b></td><td>More than 0, paise allowed. It cannot be more than the balance still to pay (a rupee over is allowed for rounding).</td></tr>
  <tr><td><b>Payment date *</b></td><td>The day you paid.</td></tr>
  <tr><td><b>Payment mode</b></td><td>Bank transfer to start. Pick <b>Cash</b> for cash: it then shows in the <a href="#payments-cash-book">Cash book</a> too.</td></tr>
  <tr><td><b>Reference / cheque no.</b></td><td>Up to 60 letters.</td></tr>
  <tr><td><b>Note (optional)</b></td><td>Up to 300 letters.</td></tr>
</table></div>
<p>After saving, the list shows the new <b>Balance due</b> and status straight away.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"That is more than the ₹... still to pay on this bill"</b>: the amount is more than the balance. Check the amount, or the payments already recorded (they are listed under <b>Payment History</b> in the same window). If you really paid the supplier more, the extra is an advance against their next bill: record only the bill's balance here and note the rest.</p>
<p><b>"Enter an amount more than 0"</b> or <b>"Enter the payment date"</b>: fill in that box.</p>
<p><b>"Could not save the payment. Try again."</b>: the app could not reach its data. See <a href="troubleshooting.html#saving">Saving problems</a>.</p></div>
</section>

<section id="part-payments">
<h3>Part payments</h3>
<p>Pay a bill in as many parts as you like. Each part is one payment. For example, a bill of ₹11,800:</p>
<ol class="steps">
  <li><strong>First part</strong>Click ${ui('₹')}, type 5000, pick <b>UPI</b>, add the UPI reference and click ${ui('Record Payment')}. The bill is now <b>Partly paid</b> and its Balance due is ₹6,800.</li>
  <li><strong>The rest</strong>Later, click ${ui('₹')} again. The amount already says 6800. Pick <b>Cash</b> and click ${ui('Record Payment')}. The bill is now <b>Paid</b>, and the ₹6,800 shows in the Cash book as money out.</li>
</ol>
<p>Payments made to a supplier in one go for several bills: record one payment on each bill, for the part of the money that went to it.</p>
</section>

<section id="payment-history">
<h3>Payment history: changing or deleting a payment</h3>
<p>Every payment on a bill is listed under <b>Payment History</b> in the payment window, oldest first: date, amount, mode, and the reference and note. The status of the bill is under the list. The same payments show in the bill's view (eye) and on its PDF, under <b>Payments made</b>.</p>
<ul>
  <li><b>Change a payment</b>: click its pencil. The boxes above fill with that payment and the title becomes <b>Edit payment</b>. Change what you need and click ${ui('Save payment')}, or ${ui('Cancel edit')} to leave it as it was.</li>
  <li><b>Delete a payment</b>: click its red bin. The app asks first, saying the amount and date. Click ${ui('Delete payment')}. The bill goes back to Partly paid or Unpaid, and a cash payment leaves the Cash book.</li>
</ul>
</section>

<section id="mark-paid">
<h3>Marking a bill paid from the list</h3>
<p>The <b>Status</b> dropdown on each row is a shortcut:</p>
<ul>
  <li><b>Paid</b> records one payment for the whole balance, dated today, mode <b>Other</b> and noted "Marked paid", and says <b>Marked paid</b>. Use it when you do not need the details. Mode Other is not counted as cash, so it does not show in the Cash book.</li>
  <li><b>Unpaid</b> takes back that "Marked paid" payment. Payments you recorded yourself stay: the bill then stays Partly paid and the message says so; delete them from the ${ui('₹')} window if they were wrong.</li>
  <li><b>Partly paid</b> opens the payment window, because a part payment needs its amount.</li>
</ul>
<p>Choosing <b>Paid</b> in the <a href="#add-purchase">bill form</a> does the same as choosing it here.</p>
</section>

<section id="owed-to-suppliers">
<h3>What you owe suppliers</h3>
<p>Four places show what is still to pay:</p>
<ul>
  <li>The <b>Owed to suppliers</b> card above the list: the balance due on all the bills shown (it follows the year, search and filters; pick <b>All years</b> for everything).</li>
  <li>The <b>Balance due</b> column, with its total at the bottom. Pick <b>Unpaid / Partly paid</b> in the filters to see only those bills.</li>
  <li>The purchase register (${ui('Print / PDF')}, ${ui('Excel')}, ${ui('CSV')}), which has <b>Paid</b> and <b>Balance due</b> columns. See <a href="#export">For your accountant</a>.</li>
  <li><a href="reports.html#supplier-outstanding">Reports, Party Outstanding</a> with <b>You owe suppliers</b>: one row per supplier, month by month, like Tally.</li>
</ul>
<p>The balance of a bill is its total, less TDS you keep back, less the payments recorded. A bill marked Paid before payments could be recorded owes nothing.</p>
</section>

<section id="payments-cash-book">
<h3>Cash payments and the Cash book</h3>
<p>A payment with mode <b>Cash</b> shows in the <a href="cash-book.html#from-elsewhere">Cash book</a> by itself, as money out, labelled <b>Purchase bill</b> <i>number</i> <b>payment</b>, with the supplier's name and the reference. It is counted once. Do not also add it in the Cash book.</p>
<p>To change or delete it, click its label in the Cash book (it opens Purchases), then use the ${ui('₹')} button on the bill. The Cash book follows.</p>
<p>If you added supplier cash payments to the Cash book by hand before this version, and now also record them on the bill, delete your own Cash book entry so the money is not counted twice.</p>
<p>UPI, bank transfer, cheque, card and Other payments are not cash, so they do not show in the Cash book.</p>
</section>

<section id="stock">
<h2>What saving does to your products</h2>
<p>Each item on the bill is matched to your <a href="products.html">products</a> by name (capitals do not matter):</p>
<ul>
  <li><strong>A product you already have</strong>: its stock goes up by the quantity, and its purchase price becomes this bill's rate. Its selling price is not touched. Its HSN, GST rate and cess are filled in from the bill only if the product had none.</li>
  <li><strong>A new item</strong>: it is added to your products, with the rate as both purchase and selling price, unit <b>Nos</b> (or the unit from the purchase order), and the quantity as its stock. <b>Check its selling price afterwards</b> in Products, or you will sell at cost.</li>
  <li><strong>Editing a bill</strong>: only the difference is added. Change 10 to 12 and stock goes up by 2; remove a row and its quantity is taken back out.</li>
  <li><strong>Deleting a bill</strong>: its quantities are taken back out of stock.</li>
</ul>
<p>Stock can go below zero (if you sold before you entered the purchase); it is not stopped at zero.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>A second product appeared with a slightly different name</b> ("Pen drive 32GB" and "Pendrive 32 GB"). The bill's name did not match. Pick the item from the suggestions when typing a bill. To fix it, edit the bill to use the right name (the stock moves back), then delete the extra product.</p>
<p><b>"Purchase saved, but updating stock in Products failed"</b>: the bill is saved; check the stock of its items in <a href="products.html#stock">Products</a> and correct it there.</p></div>
</section>

<section id="ocr">
<h2>Reading a bill from a photo</h2>
<p>Instead of typing a long bill, let the app read it from a photo or scan. Click ${ui('Import from image (OCR)')}. The window <b>Import from bill image (OCR)</b> opens.</p>
<ol class="steps">
  <li><strong>Choose the picture</strong>Click the dashed box, or drag a photo or scan of the bill onto it: PNG, JPG or WebP, up to 8 MB. PDFs are not accepted; take a screenshot of the page instead. A preview appears.</li>
  <li><strong>Read it</strong>Click ${ui('Extract fields')}. <b>Reading image…</b> shows a percentage. It takes a few seconds, longer on an older computer.</li>
  <li><strong>Check everything</strong>The <b>Extracted fields</b> panel appears on the right. Correct anything it read wrong, and add or remove item rows. See <a href="#ocr-review">Checking what was read</a>.</li>
  <li><strong>Use it</strong>Click ${ui('Use these values')}. The <b>Add Purchase Bill</b> form opens with it all filled in.</li>
  <li><strong>Check once more and save</strong>Compare the form's total with the bill, fix any rate or tax, and click ${ui('Save')}.</li>
</ol>
<p>Everything is read on your own computer, in English, with no internet needed and nothing uploaded anywhere.</p>
<p><strong>For best results:</strong> a sharp, straight, well-lit photo of a printed bill, taken from above, with the whole bill in the frame and nothing else. Handwritten bills, crumpled paper, shadows and photos at an angle read badly.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Please upload an image (PNG, JPG, WebP)."</b>: you chose a PDF or another file. <b>"Image is over 8MB"</b>: take a smaller photo, or crop it. <b>"OCR failed: ..."</b>: the message ends with a hint; see <a href="troubleshooting.html#ocr-failed">Reading a bill photo failed</a>. If a bill will not read well, type it in with ${ui('Add Purchase')}: suggestions make it quick for suppliers and items you have used before.</p></div>
</section>

<section id="ocr-review">
<h3>Checking what was read</h3>
<p>The <b>Extracted fields</b> panel shows what the app found. Every box can be changed.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to check</th></tr>
  <tr><td><b>Supplier</b></td><td>Read from the capital-letter line above their GSTIN. Often needs correcting.</td></tr>
  <tr><td><b>GSTIN</b></td><td>The first GSTIN on the bill. If the bill shows your GSTIN before the supplier's, replace it with theirs.</td></tr>
  <tr><td><b>Invoice No.</b></td><td>The number after "Invoice", "Bill" or "No.".</td></tr>
  <tr><td><b>Date</b></td><td>Read day first, as on Indian bills (03/04/2026 is 3 April).</td></tr>
  <tr><td><b>Grand total</b></td><td>The amount after "Grand Total", "Amount Payable", "Total" or "Net Amount". Used only when no item rows are found.</td></tr>
</table></div>
<p><b>Tax breakdown</b>, when found, lists the Taxable value, CGST, SGST / UTGST, IGST, Cess and Round-off printed on the bill, for you to compare. They are not copied into the form: the form works its own figures out from the items.</p>
<p><b>Line items</b> shows each row it read, with the number found in brackets. Each row has the name, <b>HSN/SAC</b>, <b>Qty</b>, <b>Rate ₹</b>, <b>GST%</b> and <b>Amount ₹</b>, and a bin to remove it. ${ui('Add row')} adds an empty one. A row that matches one of your saved products shows <b>Matched saved product:</b> <i>name</i> (with a percentage of how close the names are), and takes that product's GST rate and, if the bill had none, its HSN.</p>
<p>Check each row against the bill. The commonest mistakes: the <b>Rate</b> is really the line amount, the quantity was missed (it then shows 1), or a total line was read as an item. The <b>Amount</b> is only for comparing; the form uses quantity × rate.</p>
<p><b>Raw OCR text</b> (click to open) shows everything the app read, if you want to copy a figure from it.</p>
<p>${ui('Use these values')} shows how many rows will go into the form. In the form, items come in with cess 0, so add cess yourself if the bill has it. A row where no GST % was found comes in at 0%: set its real <b>Tax %</b>. If no rows were found but a total was, one row named <b>From OCR — split into real items</b> holds the total: replace it with the real items and their GST rates before saving. <b>Inter-state purchase</b> is ticked when the bill showed IGST and no CGST.</p>
</section>

<section id="export">
<h2>For your accountant</h2>
<p>The ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} buttons at the top of <b>Purchase Records</b> save the <b>Purchase register</b>: the bills shown, after the search, year, status and cost centre filters, oldest first, with a <b>Total</b> row. Your business name is at the top.</p>
<p>Columns: <b>Date</b>, <b>Supplier</b>, <b>GSTIN</b>, <b>Invoice No</b>, <b>Taxable Amount</b>, <b>CGST</b>, <b>SGST</b>, <b>IGST</b>, <b>Cess</b>, <b>Inter-state</b> (Y or N), <b>Round-off</b>, <b>Total</b>, <b>Paid</b> (payments to the supplier), <b>Balance due</b>, <b>Status</b> and <b>Note</b>.</p>
<ul>
  <li>${ui('Print / PDF')} opens the register on its own page in landscape. Choose your printer, or <b>Save as PDF</b>. If nothing opens, allow pop-ups for the app (the message <b>"Allow pop-ups for this page to print the report"</b> appears).</li>
  <li>${ui('Excel')} downloads an <code>.xlsx</code> file, with numbers as numbers.</li>
  <li>${ui('CSV')} downloads the same as a CSV file.</li>
</ul>
<p>For one quarter, pick the year and give your CA the file; they can filter the dates. The register has one row per bill. To get one row per <i>item</i> (and a file you can import back), use ${ui('Export all as CSV')} in <a href="#csv-purchases">CSV import / export</a>.</p>
</section>

<section id="csv-purchases">
<h2>Importing purchase bills from CSV</h2>
<p>Use this to bring in many bills at once: from another billing program, from Tally, or a sheet your accountant keeps. Click ${ui('CSV import / export')} at the top of Purchases. The window <b>Purchase bills: CSV import / export</b> opens.</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Template')}</td><td>Downloads <code>Purchase-import-template.csv</code>: the right columns and one example bill.</td></tr>
  <tr><td>${ui('Export all as CSV')}</td><td>Downloads every purchase bill of this business as <code>Purchase-bills-</code><i>date</i><code>.csv</code>, one row per item, in the same columns. Good for a backup, or to move bills to another business.</td></tr>
  <tr><td>${ui('Choose CSV or Excel file')}</td><td>Reads your file and shows what will happen. Nothing is saved yet.</td></tr>
  <tr><td>${ui('Import')}</td><td>Saves the bills that are ready. The button shows how many.</td></tr>
  <tr><td>${ui('Close')}</td><td>Closes without importing.</td></tr>
</table></div>
<ol class="steps">
  <li><strong>Start from the template</strong>Click ${ui('Template')}. Open it in Excel or Google Sheets, delete the example row, and fill in your bills. Save it as <b>CSV</b> (in Excel: <b>File → Save As → CSV (Comma delimited)</b>).</li>
  <li><strong>Choose the file</strong>Click ${ui('Choose CSV or Excel file')}. A box shows the file name, how many bills are <b>ready</b>, how many are <b>already there (skipped)</b>, and every problem, row by row (a bad date, a missing rate, no item name).</li>
  <li><strong>Fix problems</strong>Bills with problems are not imported. Fix them in the file, save it, and choose it again.</li>
  <li><strong>Import</strong>Click ${ui('Import')}. A message says how many were imported, how many skipped, and how many had errors.</li>
</ol>
<h3>The columns</h3>
<p>One row per item. Rows with the same supplier and invoice number make one bill.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>What to know</th></tr>
  <tr><td><b>Invoice Number</b></td><td>Required. The supplier's bill number.</td></tr>
  <tr><td><b>Invoice Date</b></td><td>Required. YYYY-MM-DD (2026-10-03) or DD-MM-YYYY (03-10-2026).</td></tr>
  <tr><td><b>Supplier Name</b>, <b>Supplier GSTIN</b></td><td>At least one of the two. A bill with only a GSTIN uses it as the name.</td></tr>
  <tr><td><b>Supplier Address</b></td><td>Optional.</td></tr>
  <tr><td><b>Item Name</b></td><td>Required on every row.</td></tr>
  <tr><td><b>HSN/SAC</b></td><td>Optional.</td></tr>
  <tr><td><b>Quantity</b></td><td>1 if blank.</td></tr>
  <tr><td><b>Rate</b></td><td>Required. Per unit, before GST.</td></tr>
  <tr><td><b>GST %</b>, <b>Cess %</b></td><td>0 if blank. GST up to 100.</td></tr>
  <tr><td><b>Inter-state</b></td><td>Yes or No. If blank, it is worked out from the supplier's GSTIN and your state.</td></tr>
  <tr><td><b>Payment Status</b></td><td>Unpaid, Partial or Paid. Unpaid if blank.</td></tr>
  <tr><td><b>Note</b></td><td>Optional.</td></tr>
</table></div>
<p>Other common headings are understood too: <b>Bill No</b>, <b>Vendor</b>, <b>Party Name</b>, <b>GSTIN</b>, <b>Item</b>, <b>Particulars</b>, <b>HSN</b>, <b>Qty</b>, <b>Price</b>, <b>Tax %</b>, <b>Remarks</b> and so on, so a file from another program often works as it is.</p>
<p>A bill already entered (same supplier and invoice number, matched by GSTIN or by name) is skipped, never changed. Imported bills have no round-off. Quantities are added to product stock and new items become products, as when you type a bill in (see <a href="#stock">What saving does to your products</a>).</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"The dates are month first"</b>: your Excel wrote dates as MM/DD/YYYY. Change the date column to DD-MM-YYYY or YYYY-MM-DD. A yellow line saying <b>Dates are read day first</b> is a reminder to check one example date.</p>
<p><b>"The file has no rows under the header"</b>, or nothing is read: the file is not a real CSV, or the headings are not in the first row. See <a href="troubleshooting.html#csv-import">A CSV import did not work</a>.</p>
<p><b>A bill was skipped that I wanted.</b> One with the same supplier and invoice number is already there. Delete it first if you want to bring it in again.</p></div>
</section>

<section id="purchase-orders">
<h2>Purchase orders</h2>
<p>A purchase order (PO) is what you send a supplier <b>before</b> the goods come: what you want, how many, at what rate. It is not a bill, so it changes neither your stock nor your GST returns. When the goods come, you turn it into a purchase bill in one click.</p>
<p>Turn it on in <a href="settings.html#features">Settings, Features</a>: tick <b>Purchase orders</b> under <b>Purchases screen</b>, and save. It is on to start if you picked <b>Wholesale / trading</b> or <b>Manufacturing</b> as your <a href="settings.html#business-type">business type</a>. Purchases then has two buttons under the title, ${ui('Purchase bills')} and ${ui('Purchase orders')}. On the purchase orders tab, the top-right button is ${ui('New purchase order')}.</p>
<ol class="steps">
  <li><strong>Make one</strong>Click ${ui('New purchase order')}, fill in the supplier and items, and ${ui('Save')}. See <a href="#new-po">The purchase order form</a>.</li>
  <li><strong>Send it</strong>Click the eye to view it, then ${ui('WhatsApp')}, ${ui('Email')}, ${ui('Print')} or ${ui('Download PDF')}. See <a href="#po-view">Viewing and sending a purchase order</a>.</li>
  <li><strong>When the goods come</strong>Click ${ui('Convert to purchase bill')}, type the supplier's bill number, change any quantity to what actually came, and ${ui('Save')}. See <a href="#convert-po">Turning a purchase order into a bill</a>.</li>
</ol>
</section>

<section id="po-list">
<h3>The purchase order list</h3>
<p>Search by PO number, supplier or GSTIN in <b>Search PO number, supplier...</b>, and filter by status with <b>All statuses</b>. The red ${ui('✕')} clears both.</p>
<p>The <b>Purchase orders</b> table lists <b>PO number</b>, <b>Date</b>, <b>Supplier</b>, <b>Expected</b> (delivery date), <b>Total</b> (with GST) and <b>Status</b>. The actions on each row:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th><th>Shown for</th></tr>
  <tr><td>Eye</td><td>View the order</td><td>Every order</td></tr>
  <tr><td>Pencil</td><td>Edit the order</td><td>Open orders only</td></tr>
  <tr><td>Green page</td><td>${ui('Convert to purchase bill')}</td><td>Open and Partly received</td></tr>
  <tr><td>${ui('⋯')} menu</td><td>${ui('Duplicate')}, ${ui('Print')}, ${ui('Download PDF')}, ${ui('WhatsApp')}, ${ui('Email')}, ${ui('Cancel order')}</td><td>Received and Cancelled orders show only Duplicate</td></tr>
</table></div>
<p>With no orders yet, the list says <b>No purchase orders yet.</b> with a ${ui('New purchase order')} button.</p>
</section>

<section id="po-status">
<h3>Purchase order status</h3>
<p>The status is worked out from the purchase bills made from the order; you only set Cancelled yourself.</p>
<div class="table-wrap"><table>
  <tr><th>Status</th><th>Means</th></tr>
  <tr><td>Open</td><td>No bill saved from it yet. You can edit it.</td></tr>
  <tr><td>Partly received</td><td>Bills saved from it have less than was ordered. ${ui('Convert to purchase bill')} again fills in only what is still to come.</td></tr>
  <tr><td>Received</td><td>Bills saved from it cover every item.</td></tr>
  <tr><td>Cancelled</td><td>You cancelled it with ${ui('Cancel order')} in the row's ${ui('⋯')} menu. It keeps its number.</td></tr>
</table></div>
<p>Received and cancelled orders can only be viewed and duplicated (${ui('Duplicate')} starts a new PO with the same supplier, items and notes, and a new number). Items are matched between the order and its bills by name, so keep the item names the same on the bill.</p>
<p><strong>Cancelling:</strong> ${ui('Cancel order')} asks first. ${ui('Cancel order')} again confirms, ${ui('Keep it')} leaves it. Bills already saved from it stay as they are. A cancelled order cannot be made Open again; duplicate it instead.</p>
</section>

<section id="new-po">
<h3>The purchase order form</h3>
<p>${ui('New purchase order')} opens <b>New purchase order</b> (<b>Edit purchase order</b> from the pencil). It is the purchase bill form with a few changes:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put in</th></tr>
  <tr><td><b>PO date *</b></td><td>The date of the order. Today to start.</td></tr>
  <tr><td><b>Expected delivery</b></td><td>Optional. When you want the goods. Printed on the PO as <b>Expected by</b>.</td></tr>
  <tr><td><b>Supplier Name *</b>, <b>Supplier GSTIN</b></td><td>As on a bill. Suppliers from your purchase bills are suggested.</td></tr>
  <tr><td><b>Supplier Address (optional)</b></td><td>Printed on the PO.</td></tr>
  <tr><td><b>PO number *</b></td><td>Filled in for you as <code>PO/26-27/0001</code>, counting up for each business and financial year. You can type your own.</td></tr>
  <tr><td><b>Notes / terms (optional)</b></td><td>Delivery address, payment terms, packing. Printed on the PO under <b>Notes / terms</b>.</td></tr>
  <tr><td><b>Cost centre</b></td><td>Only when cost centres are on. A bill made from the PO gets the same one.</td></tr>
  <tr><td><b>Inter-state purchase</b></td><td>Tick for a supplier in another state: the PO shows IGST instead of CGST + SGST.</td></tr>
</table></div>
<p>The <b>Items</b> are the same as on a bill (see <a href="#purchase-items">Items on the bill</a>) with one more column, <b>Unit</b> (Nos, Kg, Box...), filled in from the product. There is no Payment Status and no round-off. Rows without a name or a quantity are left out when you save.</p>
<p>A number is never handed out twice. If you type a number already used by another PO, the message <b>"... is already used by another purchase order"</b> appears; change it.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"PO date is required"</b>, <b>"Supplier name is required"</b>, <b>"Add at least one item with a quantity"</b>: fill those in. <b>"Could not get the next PO number. Type one in PO number."</b>: the app could not reach its data for a moment; type a number yourself, or close and try again.</p></div>
</section>

<section id="po-view">
<h3>Viewing and sending a purchase order</h3>
<p>The eye opens <b>Purchase order · </b><i>PO number</i>: the date, expected date, status and tax type, the supplier, the items with <b>Unit</b>, <b>Taxable value</b>, CGST and SGST or IGST, cess, <b>TOTAL</b> and your <b>Notes / terms</b>.</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Close')}</td><td>Closes the window.</td></tr>
  <tr><td>${ui('Duplicate')}</td><td>A new PO with the same supplier and items.</td></tr>
  <tr><td>${ui('Edit')}</td><td>Open orders only.</td></tr>
  <tr><td>${ui('WhatsApp')}</td><td>On a phone that can share files, sends the PDF with a short message. On a computer, opens WhatsApp with the message (PO number, date, items, quantities, rates and total) for you to pick the supplier; attach the PDF yourself if you want it.</td></tr>
  <tr><td>${ui('Email')}</td><td>Opens your email program with the subject <b>Purchase order</b> <i>number</i> and the order typed out. Add the supplier's email address, and attach the PDF from ${ui('Download PDF')} if you want.</td></tr>
  <tr><td>${ui('Print')}</td><td>Opens the PDF ready to print. If pop-ups are blocked, it downloads instead.</td></tr>
  <tr><td>${ui('Download PDF')}</td><td>Saves the PDF, named after the PO number with <code>_</code> for each slash, such as <code>PO_26-27_0001.pdf</code>.</td></tr>
  <tr><td>${ui('Convert to purchase bill')}</td><td>See <a href="#convert-po">Turning a purchase order into a bill</a>.</td></tr>
</table></div>
<p>Received and cancelled orders show only ${ui('Close')} and ${ui('Duplicate')}.</p>
<p>The PDF is an A4 <b>PURCHASE ORDER</b>: your business name, address, state, GSTIN, phone and email at the top; the PO number, date and expected date; <b>TO (SUPPLIER)</b>; the items; taxable value, CGST and SGST (or IGST), cess and <b>TOTAL (INR)</b> with the amount in words; your notes; and <b>For</b> <i>your business</i> with your signature image (from your business details or <a href="print-settings.html#signature">print settings</a>) and <b>Authorised signatory</b>.</p>
</section>

<section id="convert-po">
<h3>Turning a purchase order into a bill</h3>
<ol class="steps">
  <li><strong>Click Convert</strong>Click the green ${ui('Convert to purchase bill')} on the row, or the same button in the view.</li>
  <li><strong>The bill form opens</strong>The <b>Add Purchase Bill</b> form shows <b>From purchase order</b> <i>PO number</i>, with the supplier, the items still to come, their rates, GST and cost centre filled in. The date is today.</li>
  <li><strong>Type the supplier's bill number</strong>In <b>Invoice Number</b>, from the bill that came with the goods. Set the <b>Date</b> to the date on their bill.</li>
  <li><strong>Change quantities</strong>If fewer came, change <b>Qty</b> to what actually came. Change a rate if the bill differs.</li>
  <li><strong>Save</strong>The bill is saved, stock goes up, and the order becomes Partly received or Received.</li>
</ol>
<p>When the rest comes, convert the same order again: only what is still to come is filled in. Deleting a bill made from an order takes the stock back out and puts the order back to Open or Partly received.</p>
</section>

<section id="unassigned">
<h2>"Not assigned to a business"</h2>
<p>This only matters if you keep <a href="settings.html#multiple-businesses">more than one business</a> in the app. Records saved before you began keeping businesses separate have no business recorded, so they show under <b>every</b> business. Nothing is hidden, so nothing goes missing.</p>
<p>When there are any, a blue banner says, for example, <b>3 purchase bills are not assigned to a business, so they show under all of them.</b> The same banner appears on <a href="expenses.html">Expenses</a>, <a href="recurring.html">Recurring</a> and <a href="receipts.html">Receipts</a>, for their own records.</p>
<ol class="steps">
  <li><strong>Pick the right business</strong>Switch to the business those records belong to in the sidebar.</li>
  <li><strong>Assign</strong>Click ${ui('Assign to')} <i>business name</i> on the banner. A box asks you to confirm, naming the business.</li>
  <li><strong>Confirm</strong>Click ${ui('Assign to')} <i>business name</i> again. The records now belong to that business only, and no longer show under the others. The banner goes away.</li>
</ol>
<div class="note warn"><strong>Only if they all belong to it</strong>
<p>The button assigns <b>all</b> the unassigned records on that screen to the business selected. The app never guesses. If some belong to one business and some to another, do not use the button: open each one under the right business instead, or ask on the <a href="support.html">support page</a>.</p></div>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Could not assign — please try again"</b>: the app could not save for a moment; click again. If it keeps happening, see <a href="troubleshooting.html#saving">Saving problems</a>.</p></div>
</section>
`,
},

// =============================================================================
{
  slug: 'expenses',
  title: 'Expenses',
  lead: 'Costs that are not stock, such as rent, electricity, software or travel, for your profit and loss, your income tax and the GST credit on them.',
  body: `
<div class="note info"><strong>Expense or purchase bill?</strong>
<p>Goods you buy to sell, with a supplier's tax invoice, go in <a href="purchases.html">Purchases</a> (they add to stock). Everything else you spend to run the business goes here. Enter each bill in one place only, or it is counted, and its GST claimed, twice.</p></div>

<section id="expense-list">
<h2>The expense list</h2>
<p>Open <b>Expenses</b> from the menu. ${ui('Add Expense')} at the top right opens a new expense.</p>
<h3>The three totals</h3>
<p><b>Total Expenses</b> is everything you paid, with GST. <b>GST Paid (ITC)</b> is the GST inside those amounts, your input tax credit. <b>Entries</b> is how many expenses are shown. All three follow the search and filters.</p>
<h3>Search and filters</h3>
<ul>
  <li><b>Search expenses...</b>: part of the description, the vendor's name or the bill number.</li>
  <li><b>All Categories</b>: show one <a href="#categories">category</a> only, such as Office Rent.</li>
  <li><b>Year</b>: the current financial year (April to March) to start; one of the last five, or <b>All years</b>.</li>
  <li><b>Cost centre</b>: only when <a href="reports.html#cost-centres">cost centres</a> are on.</li>
  <li>The red ${ui('✕')} clears the search, category and cost centre, and puts the year back to the current one.</li>
</ul>
<h3>Expense Records</h3>
<p>The table lists <b>Date</b>, <b>Description</b>, <b>Category</b>, <b>Vendor</b>, <b>Amount</b>, <b>GST</b> and <b>Mode</b> (how you paid), with a <b>Total</b> row. The pencil opens an expense to change it; the bin deletes it, after asking. The ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} buttons save the <a href="#export">expense statement</a>.</p>
<p>With nothing yet, it says <b>No expenses recorded yet.</b>; with filters hiding everything, <b>No expenses match your filters.</b></p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>An expense is missing.</b> Check the year (an expense dated in March belongs to the year that ends that March), the category filter, and the business selected in the sidebar. If old expenses show under every business, see <a href="purchases.html#unassigned">Not assigned to a business</a>.</p></div>
</section>

<section id="add-expense">
<h2>Adding an expense</h2>
<p>Click ${ui('Add Expense')}. The <b>Add Expense</b> form opens (<b>Edit Expense</b> from the pencil).</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put in</th></tr>
  <tr><td><b>Date *</b></td><td>The date on the bill, or the day you paid. Today to start. It decides the month the GST credit goes into.</td></tr>
  <tr><td><b>Category</b></td><td>What kind of cost it is. <b>Other</b> to start. See <a href="#categories">Categories</a>.</td></tr>
  <tr><td><b>Description *</b></td><td>Required. What it was for, such as "Shop rent - October" or "AWS Hosting - March".</td></tr>
  <tr><td><b>Amount (incl. GST) *</b></td><td>Required, above zero. The full amount you paid, with GST.</td></tr>
  <tr><td><b>GST % (for ITC)</b></td><td>The GST rate on the bill, such as 18. The GST inside the amount is worked out and shown underneath as <b>GST: ₹...</b>. Leave it blank (or 0) when the bill has no GST: rent from an unregistered owner, salary, bank charges without GST.</td></tr>
  <tr><td><b>Vendor Name</b></td><td>Who you paid. Optional, but needed to claim the credit.</td></tr>
  <tr><td><b>Vendor GSTIN</b></td><td>Their 15-character GSTIN, from their bill. Needed to claim the credit.</td></tr>
  <tr><td><b>Invoice / Bill No</b></td><td>Their bill number. Optional.</td></tr>
  <tr><td><b>Payment Mode</b></td><td>Bank Transfer (to start), UPI, Cash, Cheque, Card or Other. Expenses paid in <b>Cash</b> appear in the <a href="cash-book.html#from-elsewhere">Cash book</a> as money out.</td></tr>
  <tr><td><b>Cost centre</b></td><td>Only when cost centres are on. The branch, site or project it belongs to.</td></tr>
  <tr><td><b>Inter-state expense</b></td><td>Tick when the vendor charged IGST (a different state), as with cloud and software firms billing from another state. The first two digits of their GSTIN are their state code.</td></tr>
  <tr><td><b>Note (optional)</b></td><td>Anything for yourself.</td></tr>
</table></div>
<ol class="steps">
  <li><strong>Pick the category</strong>And type a <b>Description</b> you will recognise later.</li>
  <li><strong>Type the amount</strong>The total on the bill, with GST.</li>
  <li><strong>Type the GST rate</strong>If the bill shows GST. Check the <b>GST: ₹...</b> underneath against the GST printed on the bill.</li>
  <li><strong>Vendor details</strong>Name, GSTIN and bill number, if you will claim the credit.</li>
  <li><strong>Save</strong>Click ${ui('Save')} (${ui('Update')} when editing). The message <b>Expense added</b> appears.</li>
</ol>
<p><strong>Example:</strong> internet bill ₹1,180 with 18% GST. Amount 1180, GST % 18: the app shows GST ₹180 (1180 × 18 ÷ 118), and the cost without GST is ₹1,000.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Description is required"</b> or <b>"Enter a valid amount"</b>: fill in a description and an amount above zero. <b>"GST % must be between 0 and 100"</b>: type just the number, such as 18.</p>
<p><b>The GST shown differs a little from the bill</b>: the bill may be rounded. It is worked out from the amount and rate; if the difference matters, check the amount you typed is the bill's total with GST, not before.</p>
<p><b>Deleting an expense</b> removes it from your list, reports and future returns. Credit already claimed in a return you filed stays as filed.</p></div>
</section>

<section id="categories">
<h2>Categories</h2>
<p>Office Rent, Utilities, Internet &amp; Phone, Software &amp; Tools, Travel, Meals &amp; Entertainment, Office Supplies, Salary &amp; Wages, Professional Fees, Insurance, Marketing &amp; Ads, Raw Materials, Shipping &amp; Courier, Repairs &amp; Maintenance, Bank Charges, GST Paid, Asset Purchase, Personal / Drawings, and Other. The list is fixed; use <b>Other</b> with a clear description for anything else.</p>
<div class="table-wrap"><table>
  <tr><th>Category</th><th>Use it for</th></tr>
  <tr><td>Asset Purchase</td><td>Things that last years: a computer, furniture, a machine, a vehicle. The <a href="income-tax.html">Income Tax</a> screen leaves these out of business expenses (assets are written off over years as depreciation, not in one go).</td></tr>
  <tr><td>Personal / Drawings</td><td>Money you take out for yourself or spend on the family from the business account. Left out of business expenses on the Income Tax screen.</td></tr>
  <tr><td>Salary &amp; Wages</td><td>Pay to staff. Usually no GST.</td></tr>
  <tr><td>Raw Materials</td><td>Small material buys without a proper tax invoice. Material bought on a supplier's GST bill, which you want in stock, belongs in <a href="purchases.html">Purchases</a>.</td></tr>
  <tr><td>GST Paid</td><td>Only for cases your CA tells you to record this way. The GST you pay the government on your returns is not an expense.</td></tr>
</table></div>
<p>The <a href="reports.html#profit-loss">Profit &amp; Loss</a> report includes every category, without GST. Use the category filter on the list to see, for example, all Office Rent for the year.</p>
</section>

<section id="gst-credit">
<h2>How the GST credit is used</h2>
<p>The GST on each expense is added to your input tax credit in Table 4 of <a href="gst-returns.html#gstr-3b">GSTR-3B</a>, in the month of its date: to IGST if <b>Inter-state expense</b> is ticked, otherwise half to CGST and half to SGST. It is added to the credit from your <a href="purchases.html#itc">purchase bills</a>.</p>
<p>Every expense with a GST % is counted. Only claim credit you are entitled to:</p>
<ul>
  <li>The vendor must be GST-registered, and their bill must show your GSTIN. Without the vendor's GSTIN, put the GST % as 0.</li>
  <li>Food and drinks, personal spending, club fees and most car costs usually do not qualify (blocked credit). Put the GST % as 0 for these.</li>
  <li>Check the total against your GSTR-2B: see <a href="gst-returns.html#gstr-2b">Checking your credit against GSTR-2B</a>.</li>
</ul>
<p>In the <a href="reports.html#profit-loss">Profit &amp; Loss</a> report, the GST on expenses is taken off, so your costs are shown without the GST you get back.</p>
</section>

<section id="export">
<h2>For your accountant</h2>
<p>The ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} buttons at the top of <b>Expense Records</b> save the <b>Expense statement</b>: the rows shown, oldest first, with a <b>Total</b> row. The heading names your business and what was chosen (the year, the category, the cost centre, the search), and so does the file name: for example <code>Expenses-FY 2026-27, Office Rent</code>.</p>
<p>Columns: <b>Date</b>, <b>Description</b>, <b>Category</b>, <b>Amount</b>, <b>GST Amount</b>, <b>GST %</b>, <b>Vendor</b>, <b>Vendor GSTIN</b>, <b>Invoice No</b>, <b>Payment Mode</b>, <b>Inter-state</b> (Y or N) and <b>Note</b>.</p>
<ol class="steps">
  <li><strong>Choose what to include</strong>Pick the year, and a category or cost centre, or search. For example: all Rent for the year.</li>
  <li><strong>Save it</strong>${ui('Excel')} downloads an <code>.xlsx</code> file, ${ui('CSV')} a CSV file, and ${ui('Print / PDF')} opens it on its own page to print or <b>Save as PDF</b>.</li>
</ol>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>Print / PDF does nothing</b>, or says <b>"Allow pop-ups for this page to print the report"</b>: allow pop-ups for the app in your browser and click again. See <a href="troubleshooting.html#print-blocked">Print does nothing</a>.</p></div>
</section>
`,
},
];
