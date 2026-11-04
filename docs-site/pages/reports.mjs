const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

export default [
// =============================================================================
{
  slug: 'reports',
  title: 'Reports',
  lead: 'Profit and loss, who owes you and for how long, party outstanding by month, your best clients, your best-selling products, closing stock with its value, TDS and TCS, and profit by branch or project. Every report prints and downloads as Excel or CSV.',
  body: `
<section id="tabs">
<h2>The report tabs</h2>
<p>Open ${ui('Reports')} from the sidebar. A row of buttons at the top picks the report; the one you are on is filled in blue. The small ${ui('?')} at the end of that row opens the part of this guide for the report you are looking at.</p>
<div class="table-wrap"><table>
  <tr><th>Tab</th><th>What it answers</th><th>Period</th></tr>
  <tr><td>${ui('Profit & Loss')}</td><td>Did I make money? Sales minus expenses, without GST, and month by month.</td><td>The period you choose</td></tr>
  <tr><td>${ui('Outstanding & Aging')}</td><td>Who owes me money today, on which invoice, and how late is it?</td><td>Every unpaid invoice, any date</td></tr>
  <tr><td>${ui('Party Outstanding')}</td><td>The same money owed, one row per party and one column per month, the way Tally shows it.</td><td>A financial or calendar year</td></tr>
  <tr><td>${ui('Client Analytics')}</td><td>Who are my best customers, and who pays slowest?</td><td>The period you choose</td></tr>
  <tr><td>${ui('Product Performance')}</td><td>What sells most, by money and by quantity?</td><td>The period you choose</td></tr>
  <tr><td>${ui('Stock')}</td><td>How much of each product did I have at the end of a month, and what was it worth?</td><td>The month you choose</td></tr>
  <tr><td>${ui('TDS & TCS')}</td><td>Which clients deducted TDS from my sales, have their certificates come, what TCS did I collect, and what TDS did I deduct from suppliers?</td><td>A financial year, a quarter or your own dates</td></tr>
  <tr><td>${ui('By cost centre')}</td><td>What did each branch, site or project sell, spend and earn? Shows only when cost centres are turned on.</td><td>The period you choose</td></tr>
</table></div>
<p>Reports always open on Profit &amp; Loss. Which tab you were on is not remembered after you leave the screen.</p>
</section>

<section id="included">
<h2>What the reports include</h2>
<p>The sales tabs cover the business selected at the top of the sidebar, and count only real sales, as the Dashboard does:</p>
<ul>
  <li><b>Counted:</b> tax invoices, bills of supply and composition bills.</li>
  <li><b>Subtracted:</b> credit notes (goods returned or a discount given after the sale) reduce the sales of the period they are dated in.</li>
  <li><b>Left out:</b> proforma invoices and estimates (a quote is not a sale), delivery challans (goods moved, not sold) and cancelled invoices.</li>
</ul>
<p>Purchase bills are not part of these reports, except <a href="#cost-centres">By cost centre</a>; they are in <a href="income-tax.html#itr-summary">Income Tax, ITR Summary</a> and the <a href="purchases.html#export">purchase register</a>. Expenses are counted in Profit &amp; Loss and By cost centre.</p>
<p>Two exceptions to "this business only":</p>
<ul>
  <li><b>Stock</b> covers every business, because products and stock are shared by all your businesses.</li>
  <li>To see another business's reports, switch business at the top of the sidebar (see <a href="settings.html#multiple-businesses">More than one business</a>).</li>
</ul>
<div class="note info"><strong>GST in plain words</strong><p>GST you charge on a sale is not your money: you collect it for the government. GST you pay on purchases and expenses usually comes back as input tax credit (ITC). So Profit &amp; Loss, Product Performance and By cost centre show amounts <b>without GST</b>. Client Analytics and the outstanding reports show the full invoice amount <b>with GST</b>, because that is what the customer owes you. See the <a href="glossary.html#terms">glossary</a> for GST words.</p></div>
</section>

<section id="period">
<h2>Choosing the period and currency</h2>
<p>Profit &amp; Loss, Client Analytics, Product Performance and By cost centre share one period box at the top. Change it on one tab and the others follow. (Outstanding &amp; Aging, Party Outstanding and Stock have their own choices, described in their sections.)</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What it does</th></tr>
  <tr><td><b>Filter By</b></td><td><b>Fiscal Year</b> (1 April to 31 March) or <b>Month / Year</b> (one calendar month).</td></tr>
  <tr><td><b>Fiscal Year</b></td><td>Shows with Fiscal Year. The current financial year and the four before it, such as FY 2026-27. It starts on the current one.</td></tr>
  <tr><td><b>Month</b> and <b>Year</b></td><td>Show with Month / Year. Any month of this year or the five years before. They start on the current month.</td></tr>
  <tr><td><b>Currency</b></td><td>Shows only when invoices in the period are in more than one currency, for example rupees and US dollars for export. Different currencies are never added together; pick one and the tab shows only invoices (and expenses) in it.</td></tr>
</table></div>
<p>The small ${ui('?')} at the end of this box opens this section.</p>
<div class="note tip"><strong>Something wrong?</strong><p>A figure looks too small or is zero: check the period (a month you have not billed in shows nothing), the business at the top of the sidebar, and the currency. An invoice dated 31 March belongs to the financial year that ends that day, not the next one.</p></div>
<p id="all-in-rupees">If you bill in more than one currency, the <b>Currency</b> list starts with <b>All, in ₹</b> (the default): every invoice is counted, a foreign-currency one in rupees at the exchange rate saved on it, so export income is in your profit and loss with your rupee expenses. Pick one currency to see only its invoices, in that currency. Invoices with no exchange rate are left out of <b>All, in ₹</b> and named above the statement, so you can add the rate.</p>
</section>

<section id="export">
<h2>Printing and downloading a report</h2>
<p>Every report table has three buttons at its top right:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What you get</th></tr>
  <tr><td>${ui('Print / PDF')}</td><td>Opens the table alone in a new window, with its title and a line saying the business and period, and the print box opens. Choose your printer, or <b>Save as PDF</b> as the printer to keep a PDF. Wide reports (outstanding, party outstanding, cost centres) print landscape.</td></tr>
  <tr><td>${ui('Excel')}</td><td>Downloads an <code>.xlsx</code> file. Amounts are real numbers, so Excel can total, sort and filter them.</td></tr>
  <tr><td>${ui('CSV')}</td><td>The same table as a CSV file, for any spreadsheet, Tally import or your CA's software.</td></tr>
</table></div>
<p>They export what the screen shows: the period, currency and filters you chose, with a <b>Total</b> row where the screen has one. Files go to your browser's Downloads folder, named after the report and period, such as <code>Profit-and-loss-FY_2026-27.xlsx</code>.</p>
<p>The Expense statement and Purchase register have the same three buttons on their own screens.</p>
<div class="note tip"><strong>Something wrong?</strong><p><b>"Nothing to export"</b>: the table is empty for that period; choose another period. <b>"Allow pop-ups for this page to print the report"</b>: the browser blocked the print window; allow pop-ups for the app and click again (see <a href="troubleshooting.html#print-blocked">Print does nothing</a>). Excel shows odd characters in a CSV: use the ${ui('Excel')} button instead.</p></div>
</section>

<section id="profit-loss">
<h2>Profit &amp; Loss</h2>
<p>Did the business make money in the period? Choose the period in the box at the top (see <a href="#period">Choosing the period</a>). If you bill in more than one currency, a <b>Currency</b> choice appears, since different currencies are never added together.</p>
<p>Four cards at the top give the answer:</p>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>What it is</th></tr>
  <tr><td><b>Revenue (ex. tax)</b></td><td>Your sales without GST (and without any TCS collected on the invoices). Credit notes are subtracted.</td></tr>
  <tr><td><b>Cost of goods sold</b></td><td>What the goods you sold cost you: the quantity sold times each product's <b>Purchase price</b> (<a href="products.html#add-product">Products page</a>). Goods returned on credit notes are taken back out. Services cost nothing here.</td></tr>
  <tr><td><b>Expenses (ex. GST)</b></td><td>Your <a href="expenses.html">expenses</a> without the GST on them.</td></tr>
  <tr><td><b>Net Profit</b> or <b>Net Loss</b></td><td>Revenue minus cost of goods sold minus expenses. Green for a profit; red with a minus sign for a loss. Under it, the <b>Margin</b>: profit as a percentage of revenue (₹20,000 profit on ₹1,00,000 revenue is a 20% margin).</td></tr>
</table></div>
<p>Fill in the <b>Purchase price</b> of every product you sell, or the profit shows too high. A product sold with no purchase price counts as costing nothing, and the statement below names it so you can fill it in. Purchase bills themselves are not subtracted (the goods you bought and still hold are not a cost yet). Cost of goods sold is worked out only in your own currency (rupees for an Indian business), because purchase prices are in that currency.</p>
<figure><img src="${img('app-reports.png')}" alt="The Profit and Loss tab." loading="lazy"><figcaption>The Profit &amp; Loss tab.</figcaption></figure>
<p>The same period choice appears on the Client Analytics and Product Performance tabs.</p>
</section>

<section id="pl-statement">
<h3>Profit &amp; Loss Statement</h3>
<p>The card below the four figures sets the sum out line by line, the way an accountant would:</p>
<div class="table-wrap"><table>
  <tr><th>Line</th><th>Meaning</th></tr>
  <tr><td><b>Total Revenue</b></td><td>Everything billed in the period, GST included, less credit notes.</td></tr>
  <tr><td><b>Less: GST Collected</b></td><td>The GST (and TCS) on those invoices. It belongs to the government.</td></tr>
  <tr><td><b>Net Revenue</b></td><td>What you actually earned from sales.</td></tr>
  <tr><td><b>Less: Cost of goods sold</b></td><td>Quantity sold times the product's Purchase price, less goods returned on credit notes. A warning under it names the items sold with no purchase price.</td></tr>
  <tr><td><b>Gross Profit</b></td><td>Net Revenue minus the cost of goods sold.</td></tr>
  <tr><td><b>Total Expenses</b></td><td>Expenses with their GST.</td></tr>
  <tr><td><b>Less: GST on Expenses (ITC)</b></td><td>The GST on those expenses, which comes back to you as input tax credit.</td></tr>
  <tr><td><b>Net Expenses</b></td><td>What the expenses really cost you.</td></tr>
  <tr><td><b>Net Profit</b> / <b>Net Loss</b></td><td>Gross Profit minus Net Expenses.</td></tr>
</table></div>
<p>With more than one currency, the card says <b>Showing USD invoices only</b> (or whichever currency you picked).</p>
<div class="note tip"><strong>Something wrong?</strong><p>Profit looks too high: some products have no Purchase price (the warning under Cost of goods sold names them), or an invoice line was typed without picking the product and its name matches no product. An expense entered without its GST split counts in full. Revenue looks too low: check that the invoices are not saved as proforma or challans, and are not cancelled.</p></div>
</section>

<section id="monthly-breakdown">
<h3>Monthly Breakdown</h3>
<p>One row for each month that had sales or expenses in the period, oldest first, with <b>Revenue</b>, <b>Cost of goods sold</b>, <b>Expenses</b> and <b>Profit/Loss</b> for that month, all without GST. A profit shows in green, a loss in red. Months with nothing in them are left out.</p>
<p>The card appears only when the period has some activity. ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} export it with a <b>Total</b> row at the bottom.</p>
<ol class="steps">
  <li><strong>Pick the year</strong>Filter By <b>Fiscal Year</b>, and the year.</li>
  <li><strong>Read the months</strong>Look for months in red: those are the months you spent more than you sold.</li>
  <li><strong>Send it to your CA</strong>Click ${ui('Excel')} and email the file.</li>
</ol>
</section>

<section id="outstanding">
<h2>Outstanding &amp; Aging</h2>
<p>Every unpaid or part-paid sales invoice, whatever its date, grouped by how late it is. Use it each week to decide whom to call first. The period box does not apply here: this is what is owed <b>today</b>.</p>
<p>Five cards at the top:</p>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>Money owed on invoices that are</th></tr>
  <tr><td><b>Total Outstanding</b></td><td>All of them added up</td></tr>
  <tr><td><b>Current (0-30d)</b></td><td>Not yet due, or up to 30 days past the due date (green)</td></tr>
  <tr><td><b>31-60 days</b></td><td>31 to 60 days late (amber)</td></tr>
  <tr><td><b>61-90 days</b></td><td>61 to 90 days late (purple)</td></tr>
  <tr><td><b>90+ days</b></td><td>More than 90 days late (red): the ones to chase first</td></tr>
</table></div>
<p>Days are counted from the invoice's <b>due date</b>; an invoice with no due date counts from its invoice date. If you have invoices in more than one currency, there is one row of cards for each currency, labelled INR, USD and so on.</p>
<p>What "outstanding" means: the invoice total, less any TDS your client deducted (they pay you the Net Receivable), less what they have paid so far. Invoices marked paid, and credit notes, estimates, challans and cancelled invoices are not listed.</p>
<p><b>Filter by client name...</b> narrows the table and the five cards together. Type part of a name, such as "shar" for Sharma Traders; the ${ui('×')} clears it.</p>
</section>

<section id="outstanding-receivables">
<h3>Outstanding Receivables</h3>
<p>The table lists each unpaid invoice, the most overdue at the top:</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td><b>Client</b></td><td>Who owes it</td></tr>
  <tr><td><b>Invoice No</b>, <b>Date</b>, <b>Due Date</b></td><td>Which invoice, and when it was due</td></tr>
  <tr><td><b>Amount</b></td><td>The invoice total, with GST</td></tr>
  <tr><td><b>Paid</b></td><td>What they paid so far (a dash if nothing)</td></tr>
  <tr><td><b>Outstanding</b></td><td>What is still owed, in red</td></tr>
  <tr><td><b>Days Overdue</b></td><td><b>Current</b> if not late yet, otherwise the days late, such as <b>45d</b>. Rows more than 30 days late are highlighted, and more than 90 days late even more strongly.</td></tr>
</table></div>
<p>${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} export the list (landscape), with a <b>Currency</b> column and the date "unpaid as on" in the title line. Handy for a collection round or to send to a salesman.</p>
<ol class="steps">
  <li><strong>Find who to call</strong>Read the 90+ days card, then the red rows at the top of the table.</li>
  <li><strong>Record the money when it comes</strong>Record the payment on the <a href="dashboard.html#payments">Dashboard</a> or make a <a href="receipts.html#new-receipt">receipt</a>. The invoice drops off this list once it is fully paid.</li>
</ol>
<div class="note tip"><strong>Something wrong?</strong><p>An invoice the client has paid still shows: the payment was not recorded in the app. Record it on the Dashboard. "No outstanding receivables found." with money owed: check the business at the top of the sidebar, and clear the client filter. For one client's full account, see their <a href="clients.html#ledger">ledger</a>.</p></div>
</section>

<section id="party-outstanding">
<h2>Party Outstanding</h2>
<p>The same money owed, laid out the way Tally does it: one row per party (client), A to Z, one column per month, a <b>Total</b> for each party on the right and a <b>Total</b> for each month at the bottom. Each unpaid amount sits in the month of its invoice, so you can see at a glance that, say, Mehta Traders still owes ₹12,000 from June and ₹8,500 from August.</p>
<p>The card is titled <b>Party outstanding by month</b>. Its boxes:</p>
<div class="table-wrap"><table>
  <tr><th>Box</th><th>What it does</th></tr>
  <tr><td><b>Financial year (Apr-Mar)</b> / <b>Calendar year (Jan-Dec)</b></td><td>Twelve columns from April to March (the default), or January to December.</td></tr>
  <tr><td>Year</td><td>Which year: FY 2026-27 and the five before it, or 2026 and the five before it.</td></tr>
  <tr><td>Currency</td><td>Shows only when you have invoices in more than one currency.</td></tr>
</table></div>
<ul>
  <li>Bills from before that year that are still unpaid appear in an <b>Earlier</b> column at the start, so nothing owed drops out of the total. The column shows only when there is something in it.</li>
  <li>Invoices dated after the year you chose are not shown.</li>
  <li>The Party column and the Total column stay in place while you scroll sideways through the months.</li>
  <li>${ui('Print / PDF')} opens the table on its own page, landscape; choose your printer or Save as PDF. ${ui('Excel')} and ${ui('CSV')} download it.</li>
</ul>
<p>Only sales count; estimates, challans and cancelled invoices are left out, and TDS the client deducted is taken off. Credit notes are <b>not</b> subtracted here (as on Outstanding &amp; Aging).</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Nobody owes you anything for FY ..." while money is owed: the invoices may be from after that year (pick a later year) or in another currency (pick it in the currency box). The same customer shows twice: the client name is spelt differently on the invoices (capital letters and spaces at the start or end are ignored, other differences are not).</p></div>
</section>

<section id="supplier-outstanding">
<h3>What you owe suppliers</h3>
<p>The same table the other way round. In the first box of the card, pick <b>You owe suppliers</b> (it starts on <b>Clients owe you</b>). The card is then titled <b>Owed to suppliers by month</b>: one row per supplier, A to Z, with what you still have to pay them in the month of their bill, an <b>Earlier</b> column for older unpaid bills, and totals.</p>
<ul>
  <li>What is owed on a bill is its total, less TDS you keep back, less the <a href="purchases.html#record-payment">payments recorded on it</a>. A Paid bill is left out.</li>
  <li>A bill marked Paid before payments could be recorded owes nothing. A bill marked Partial then, with no payments recorded, shows its whole amount.</li>
  <li>Purchase bills are in rupees, so there is no currency box.</li>
  <li>${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} save it, titled "Owed to suppliers".</li>
</ul>
<div class="note tip"><strong>Something wrong?</strong><p>"You owe no supplier anything for FY ..." while you do: the bills may be dated after that year, or marked Paid. The same supplier shows twice: their name is spelt differently on the bills.</p></div>
</section>

<section id="clients">
<h2>Client Analytics</h2>
<p>Who buys the most, and who owes the most, in the period chosen at the top. Revenue here includes GST (it is what the client was billed), less their credit notes.</p>
</section>

<section id="top-clients">
<h3>Top clients by revenue</h3>
<p>The ten clients who were billed the most in the period, highest first, with <b>Revenue</b> and the number of <b>Invoices</b> (credit notes are not counted as invoices). Use it to know whom to look after: a discount or a call to your best ten pays back the most.</p>
<p>"No client data for this period." means there were no sales in that period and currency.</p>
</section>

<section id="worst-payers">
<h3>Highest outstanding (worst payers)</h3>
<p>The ten clients who owe you the most on invoices from this period, with <b>Outstanding</b> and <b>% Unpaid</b>: what share of what they were billed is still unpaid. 80% unpaid is a customer to stop giving credit to. Outstanding is after any TDS they deducted.</p>
<p>"Everyone is up to date." means nobody owes anything on this period's invoices. For money owed from any date, see <a href="#outstanding">Outstanding &amp; Aging</a>.</p>
</section>

<section id="all-clients">
<h3>All clients breakdown</h3>
<p>Every client billed in the period, the number in brackets being how many. Columns: <b>Client</b>, <b>Invoices</b>, <b>Revenue</b>, <b>Paid</b>, <b>Outstanding</b> (a dash if nothing), <b>Last Invoice</b> date. Highest revenue first. ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} export it.</p>
<div class="note tip"><strong>Something wrong?</strong><p>One customer appears on two rows: the name is typed differently on some invoices ("Sharma Traders" and "Sharma Traders Pvt Ltd"). Clients are grouped by the exact name on the invoice. To see one client's whole history, open their <a href="clients.html#ledger">ledger</a>.</p></div>
</section>

<section id="products">
<h2>Product Performance</h2>
<p>What you sold, by item, in the period chosen at the top. Revenue here is the line's taxable value: after line discounts and without GST, so it matches your invoices. Credit notes are subtracted (returned quantities come off too). Delivery charges and other charge lines are not a product and are left out. Items are grouped by the name on the invoice line.</p>
</section>

<section id="top-products">
<h3>Top revenue producers</h3>
<p>The ten items that brought in the most money, with <b>Revenue</b> and <b>Qty sold</b>. Rest the mouse on a name to see its HSN code. "No product data for this period." means no sales in that period.</p>
</section>

<section id="most-units">
<h3>Most units sold</h3>
<p>The ten items sold in the largest quantity, with <b>Qty sold</b> and <b>Txns</b> (on how many invoice lines it appeared). A cheap item that sells in large numbers shows here even if it is not in the revenue top ten. Quantities of different units (kg, pieces, boxes) are not converted, so compare like with like.</p>
</section>

<section id="all-products">
<h3>All products</h3>
<p>Every item sold in the period, the number in brackets being how many, highest revenue first:</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td><b>Product</b></td><td>The item name as on the invoice</td></tr>
  <tr><td><b>HSN</b></td><td>The HSN or SAC code (the GST code for the goods or service), from the first invoice line that has one</td></tr>
  <tr><td><b>Qty sold</b></td><td>Total quantity, less returns</td></tr>
  <tr><td><b>Revenue</b></td><td>Taxable value, without GST</td></tr>
  <tr><td><b>Avg rate</b></td><td>Revenue ÷ quantity: the average price you really got</td></tr>
  <tr><td><b>Txns</b></td><td>Number of invoice lines</td></tr>
  <tr><td><b>Last sold</b></td><td>Date of the latest invoice with it</td></tr>
</table></div>
<p>${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} export it.</p>
<div class="note tip"><strong>Something wrong?</strong><p>The same item appears twice: it was typed with different names on different invoices. Pick items from the <a href="products.html">product list</a> when billing so the name is always the same. A product you sold is missing: lines with no item name are not counted.</p></div>
</section>

<section id="stock">
<h2>Stock</h2>
<p>Closing stock of every product at the end of a month, and what it is worth. Useful at year end (closing stock for your accounts or a bank loan), and to check stock against the shelf. The card is titled <b>Closing stock as on</b> and the date.</p>
<p>Choose the month in the box next to the title: this month and the 35 before it. A past month shows its last day; the current month shows today's stock.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td><b>Product</b>, <b>HSN/SAC</b>, <b>Unit</b></td><td>From the <a href="products.html">product list</a>, A to Z. Unit shows Nos when none is set.</td></tr>
  <tr><td><b>Closing qty</b></td><td>Worked back from today's stock, using the dates of your invoices, purchase bills and <a href="products.html#manufacturing">production entries</a>. Negative stock shows in red.</td></tr>
  <tr><td><b>Rate</b></td><td>The purchase price. A product with no purchase price is valued at its selling price, marked with *.</td></tr>
  <tr><td><b>Value</b></td><td>Quantity × rate. A dash for zero or negative stock.</td></tr>
  <tr><td><b>Total stock value</b></td><td>The bottom row: all the values added up. Negative stock is not added in.</td></tr>
</table></div>
<p>Stock you typed in by hand on the Products screen has no date, so it counts as if it changed today. Products are shared by all your businesses, so this report covers every business. ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} export it, "valued at purchase price".</p>
<figure><img src="${img('app-stock-report.png')}" alt="Reports, Stock: closing quantity, rate and value of each product, with the total stock value." loading="lazy"><figcaption>Closing stock and its value at the end of a month.</figcaption></figure>
<div class="note tip"><strong>Something wrong?</strong><p>A red (negative) quantity means more was sold than was bought: a purchase bill is missing, or opening stock was never entered. Add the purchase, or correct the stock on the <a href="products.html#stock">Products</a> screen. Values marked * use the selling price: add a purchase price to the product for a true value. "No products yet." means the product list is empty; stock is tracked only for items in it. See also <a href="limitations.html#stock-limits">what stock does not do</a>.</p></div>
</section>

<section id="tds-tcs">
<h2>TDS &amp; TCS</h2>
<p>Three lists of tax that is cut from, or added to, a payment, so you can match your books with the income tax department's records and with your CA's returns. Open ${ui('Reports')} and click ${ui('TDS & TCS')}. New to TDS and TCS? Read <a href="gst-basics.html#tds-tcs">GST basics: TDS and TCS</a> first; it explains them with an example.</p>
<p>In plain words:</p>
<ul>
  <li><b>TDS (Tax Deducted at Source)</b>: when a business client pays you for contract work, professional fees, rent, commission and the like, it keeps back a small part (for example 10% under 194J) as income tax and deposits it against <b>your PAN</b>. That money is not lost: you claim it in your income tax return.</li>
  <li><b>TCS (Tax Collected at Source)</b>: tax you add to your own invoice and collect from the buyer, for example under CGST section 52 if you run an online marketplace. You deposit it with the government.</li>
  <li><b>TDS you deduct</b>: when you pay a contractor or professional above the limits, <em>you</em> keep back TDS from their bill and deposit it yourself, then file a quarterly TDS return (Form 26Q).</li>
</ul>
<p><b>Choose the period</b> at the top: a <b>Financial year</b>, then <b>Whole year</b>, one quarter (<b>Q1</b> April to June, <b>Q2</b> July to September, <b>Q3</b> October to December, <b>Q4</b> January to March) or <b>Custom dates</b> with From and To. TDS returns and certificates go quarter by quarter, so a quarter is usually what you want. Like the other reports, it covers the business selected at the top of the sidebar; cancelled invoices, quotations, proformas and challans are left out.</p>
<p>Four cards at the top give the totals: <b>TDS by your clients</b>, <b>Certificates received</b> (ticked out of all), <b>TCS you collected</b> and <b>TDS you deducted</b>. Each list has ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} buttons for your CA.</p>
<figure><img src="assets/img/reports-tds-tcs.png" alt="Reports, TDS and TCS tab for FY 2026-27: four total cards, empty lists for TDS by clients and TCS, and one purchase bill with 2% TDS under section 194C in TDS you deducted from suppliers, with totals by section and by quarter." loading="lazy"><figcaption>The TDS &amp; TCS tab: here only one purchase bill has TDS, so the first two lists are empty.</figcaption></figure>
<div class="note tip"><strong>Something wrong?</strong><p>An invoice is missing from the TDS list: TDS was not ticked on it. Open it and tick TDS under ${ui('Customize')} (see <a href="invoices.html#tds-tcs">TDS and TCS</a>), or record the TDS with the client's payment (see <a href="dashboard.html#payment-tds">TDS when recording a payment</a>). A purchase bill is missing: tick <b>TDS deducted</b> on it (see <a href="purchases.html#purchase-tds">TDS on a purchase bill</a>). The GST Returns screen has a similar <a href="gst-returns.html#tds-tcs">TDS / TCS tab</a> with Form 26Q / 27EQ figures.</p></div>
</section>

<section id="tds-by-clients">
<h3>TDS deducted by your clients</h3>
<p>One row per sales invoice on which the client deducts TDS: <b>Date</b>, <b>Invoice No</b>, <b>Client</b>, the client's <b>PAN</b> (read from its GSTIN), the <b>Section</b> (194J, 194C...), <b>Rate</b>, the <b>Taxable</b> value it is worked out on (the value before GST) and the <b>TDS</b> amount. Under the list, <b>By client</b> and <b>By quarter</b> add them up.</p>
<p><b>How to reconcile it.</b> The TDS a client deducts reaches your PAN only when the client deposits it and files its own TDS return. Check it once a quarter:</p>
<ol class="steps">
  <li><strong>Pick the quarter</strong>Choose the financial year and, say, <b>Q2 (Jul-Sep)</b>.</li>
  <li><strong>Open your tax statement</strong>Log in at <a href="https://www.incometax.gov.in/" rel="noopener">incometax.gov.in</a> and open <b>Form 26AS</b> (Form 168 from tax year 2026-27) or the <b>AIS</b> (Annual Information Statement). They list the TDS every client deposited against your PAN.</li>
  <li><strong>Tick what matches</strong>When an invoice's TDS shows there, or the client sends its <b>TDS certificate (Form 16A)</b>, tick the box in the <b>Certificate</b> column. The tick is saved on the invoice at once and is kept if you edit the invoice later.</li>
  <li><strong>Chase the rest</strong>An unticked row after the quarter's due date means that client has not deposited or filed yet. Ask them: until it shows in your tax statement you cannot claim it.</li>
  <li><strong>Claim it</strong>Give the year's total (and the Excel file) to your CA for your income tax return.</li>
</ol>
<p>Form 16A is the certificate for payments up to 31 March 2026; under the Income-tax Act, 2025 the certificate has a new form, but it does the same job. See <a href="gst-basics.html#income-tax-tds">A client deducts income-tax TDS</a>.</p>
</section>

<section id="tcs-collected">
<h3>TCS you collected</h3>
<p>One row per sales invoice with TCS: the same columns as above, with the <b>TCS</b> amount, and totals <b>By client</b> and <b>By quarter</b>. This is money you collected for the government: deposit it and report it in your TCS return (Form 27EQ for income-tax TCS; GSTR-8 for GST TCS under CGST section 52). Since 10 July 2024 the section 52 rate is 0.5% (it was 1%); new invoices start at 0.5%, older ones keep the rate they were made with. See <a href="gst-basics.html#gst-tds-tcs">GST TDS and GST TCS</a>.</p>
</section>

<section id="tds-on-purchases">
<h3>TDS you deducted from suppliers</h3>
<p>One row per purchase bill on which you ticked <b>TDS deducted</b>: <b>Date</b>, <b>Bill No</b>, <b>Supplier</b>, the supplier's <b>PAN</b> (read from its GSTIN), <b>Section</b>, <b>Rate</b>, <b>Taxable</b>, <b>TDS</b> and what you actually <b>Paid to supplier</b> (bill total less TDS). Under the list, <b>By section</b> and <b>By quarter</b> add them up: these are the figures for your TDS payments and your quarterly TDS return (Form 26Q).</p>
<ol class="steps">
  <li><strong>Record it on the bill</strong>On the purchase bill, tick <b>TDS deducted</b>, pick the section and check the rate (see <a href="purchases.html#purchase-tds">TDS on a purchase bill</a>).</li>
  <li><strong>Deposit it</strong>Pay each month's TDS by the 7th of the next month (30 April for March) on the income tax portal, using your TAN.</li>
  <li><strong>File the return</strong>Pick the quarter here, export to Excel and give it to whoever files your Form 26Q. Then send each supplier its TDS certificate.</li>
</ol>
<p>You need a TAN (Tax Deduction Account Number) to deduct TDS. Whether you must deduct at all depends on the section and its limits; ask your CA if unsure.</p>
</section>

<section id="cost-centres">
<h2>By cost centre</h2>
<p>A cost centre is a branch, a site or a project: "Branch: Jalandhar", "Site A - Ludhiana", "Project Mehta House". Tag your invoices, purchase bills and expenses with one, and this tab shows what each one sold, spent and earned. The feature is off to start.</p>
<ol>
  <li><b>Turn it on.</b> Settings, Features, under Reports tick <b>Cost centres</b>.</li>
  <li><b>Add your cost centres.</b> A <b>Cost centres</b> section appears in Settings, under Features. Type a <b>Name</b>, an optional <b>Code</b>, and click ${ui('+ Add cost centre')}. Each business has its own list.</li>
  <li><b>Tag your documents.</b> The new invoice form (Invoice Details), the purchase bill form and the expense form get a <b>Cost centre</b> box. Pick one, or leave it on <b>None</b>. A document has one cost centre; to split one bill between two sites, enter it as two bills.</li>
  <li><b>Tag old invoices in one go.</b> On the Dashboard, tick the invoices, then pick a centre from <b>Set cost centre…</b> in the bar that appears. <b>Remove cost centre</b> takes it off.</li>
  <li><b>Read the report.</b> Reports, ${ui('By cost centre')}. Choose the fiscal year or month at the top (see <a href="#period">Choosing the period</a>).</li>
</ol>
<table>
  <tr><td><b>Sales (taxable)</b>, <b>GST on sales</b>, <b>Sales total</b></td><td>As on the Profit &amp; Loss tab: credit notes are subtracted; cancelled invoices, estimates and challans are left out.</td></tr>
  <tr><td><b>Purchases (ex. GST)</b></td><td>The taxable value of your purchase bills</td></tr>
  <tr><td><b>Expenses (ex. GST)</b></td><td>Expenses without their GST</td></tr>
  <tr><td><b>Profit</b></td><td>Sales (taxable) minus purchases minus expenses. Green for a profit, red for a loss.</td></tr>
</table>
<p>Documents with no cost centre are added up in an <b>Untagged</b> row, so the <b>Total</b> row is the whole business. ${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} download the table. Purchase bills have no currency, so they count only when the currency is INR.</p>
<h3>Worked example</h3>
<p>DiceCodes adds two cost centres, <b>Branch: Ludhiana</b> (code LDH) and <b>Project Mehta House</b>. In April it enters:</p>
<ul>
  <li>An invoice tagged Branch: Ludhiana: ₹10,000 + 18% GST = ₹11,800.</li>
  <li>An invoice tagged Project Mehta House: ₹20,000 + 18% GST = ₹23,600, and a credit note on it for ₹2,000 + ₹360 GST.</li>
  <li>A purchase bill tagged Project Mehta House: ₹8,000 + 18% GST.</li>
  <li>An expense tagged Branch: Ludhiana: shop rent ₹5,000, no GST.</li>
  <li>One old invoice with no cost centre: ₹1,000 + 18% GST.</li>
</ul>
<div class="table-wrap"><table>
  <tr><th>Cost centre</th><th>Sales (taxable)</th><th>GST on sales</th><th>Sales total</th><th>Purchases</th><th>Expenses</th><th>Profit</th></tr>
  <tr><td>Branch: Ludhiana (LDH)</td><td>10,000</td><td>1,800</td><td>11,800</td><td>0</td><td>5,000</td><td>5,000</td></tr>
  <tr><td>Project Mehta House</td><td>18,000</td><td>3,240</td><td>21,240</td><td>8,000</td><td>0</td><td>10,000</td></tr>
  <tr><td>Untagged</td><td>1,000</td><td>180</td><td>1,180</td><td>0</td><td>0</td><td>1,000</td></tr>
  <tr><td><b>Total</b></td><td>29,000</td><td>5,220</td><td>34,220</td><td>8,000</td><td>5,000</td><td>16,000</td></tr>
</table></div>
<h3>Renaming, archiving and filtering</h3>
<ul>
  <li>Edit (pencil) renames a cost centre; reports show the new name.</li>
  <li>Archive takes it out of the <b>Cost centre</b> box for new documents. Documents already tagged keep it, and it stays in the lists and in this report, marked <b>(archived)</b>, whenever it has something in the period. Restore brings it back. There is no delete, so old documents never lose their tag.</li>
  <li>The Dashboard, Purchases and Expenses lists get an <b>All cost centres</b> filter: pick one centre, or <b>No cost centre</b> to find what is still untagged.</li>
  <li>The cost centre is not printed on the invoice. Cost centres are part of your backup (they are saved with the settings).</li>
  <li>Turning the feature off hides the boxes, filters and this tab. The tags stay on your documents, and come back when you turn it on again.</li>
</ul>
<div class="note tip"><strong>Something wrong?</strong><p>The ${ui('By cost centre')} tab is missing: turn on <b>Cost centres</b> in <a href="settings.html#features">Settings, Features</a> and save, then open Reports again. Most of the money is in <b>Untagged</b>: tag the older invoices from the Dashboard (step 4 above) and the purchase bills and expenses from their forms.</p></div>
</section>
`,
},
];
