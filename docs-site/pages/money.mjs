const ui = (s) => `<span class="ui">${s}</span>`;

export default [
// =============================================================================
{
  slug: 'gst-returns',
  title: 'GST returns',
  lead: 'GSTR-1 and GSTR-3B built from the invoices, purchases and expenses you have already entered, checked against GSTR-2B, and ready to upload to the GST portal.',
  body: `
<div class="note info"><strong>The app prepares, you file</strong>
<p>The app works out the figures and makes the files. It does not log in to the GST portal. Filing is always done by you, or your CA, on gst.gov.in.</p></div>

<section id="period">
<h2>Choosing the period</h2>
<p>At the top, pick <b>Monthly</b>, <b>Quarterly (QRMP)</b> or <b>Full Year</b>:</p>
<ul>
  <li><strong>Monthly</strong>: a month and year. This month to start.</li>
  <li><strong>Quarterly</strong>: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec) or Q4 (Jan-Mar), and a year. The year is the calendar year of those months, so the Jan-Mar 2027 quarter is Q4 with 2027.</li>
  <li><strong>Full Year</strong>: a financial year, such as FY 2026-27.</li>
</ul>
<p>Everything on the screen follows the period and the business selected in the sidebar.</p>
</section>

<section id="whats-included">
<h2>What is included</h2>
<ul>
  <li><strong>GSTR-1 and GSTR-3B</strong> use tax invoices and credit notes only.</li>
  <li>Proforma estimates, bills of supply, composition bills and delivery challans are left out. So are cancelled invoices.</li>
  <li>The <b>Documents issued</b> table lists every kind of document you numbered, as the portal asks.</li>
  <li>Input tax credit comes from your <a href="purchases.html">purchase bills</a> and <a href="expenses.html">expenses</a> with GST.</li>
</ul>
</section>

<section id="top-bar">
<h2>Filed status, portal link and warnings</h2>
<ul>
  <li><strong>R1 Filed / R1 Pending</strong> and <strong>3B Filed / 3B Pending</strong>: green when filed, red when not. Click to switch, if you marked one by mistake. The status is kept in this browser, for each period.</li>
  <li>${ui('GST Portal')} opens gst.gov.in.</li>
  <li>A <strong>red box</strong> lists problems to fix first, such as a client GSTIN in the wrong format, your own GSTIN missing, or export invoices that need adding on the portal by hand.</li>
  <li>If the period has no invoices and no expenses, a banner reminds you to <a href="#nil-return">file a NIL return</a>.</li>
  <li>The strip shows <b>Invoices</b>, <b>Taxable</b> value, <b>Tax</b> and <b>Net Payable</b> for the period.</li>
</ul>
</section>

<section id="gstr-1">
<h2>GSTR-1: your sales</h2>
<p>The GSTR-1 tab lays your sales out in the portal's tables:</p>
<div class="table-wrap"><table>
  <tr><th>Table</th><th>What is in it</th></tr>
  <tr><td>B2B Sales (4A)</td><td>Invoices to GST-registered clients, one row each: GSTIN, client, number, date, place of supply code, Inter or Intra, taxable value, CGST, SGST, IGST and total</td></tr>
  <tr><td>Credit/Debit Notes (9B)</td><td>Credit notes, to registered clients or marked Unregistered</td></tr>
  <tr><td>B2C Sales (7)</td><td>Sales to unregistered buyers, added up by tax rate. Inter-state B2C invoices above ₹1 lakh (₹2.5 lakh for invoices before 1 August 2024) are reported separately as B2C Large.</td></tr>
  <tr><td>HSN Summary (12)</td><td>Quantity, taxable value and tax for each HSN code. Items with no HSN show as N/A.</td></tr>
  <tr><td>Document Summary (13)</td><td>For each document type, the first and last number and how many were issued</td></tr>
  <tr><td>Summary Totals</td><td>B2B and B2C together, less credit notes</td></tr>
</table></div>
<p>Exports to clients abroad are not in the GSTR-1 file. The red box lists them: add them in Table 6A on the portal with the shipping bill details.</p>
<figure><img src="assets/img/app-gstr1.png" alt="The GSTR-1 tab for one month." loading="lazy"><figcaption>The GSTR-1 tab for one month.</figcaption></figure>
</section>

<section id="gstr-1-files">
<h2>GSTR-1 downloads</h2>
<table>
  <tr><td>${ui('JSON Export')}</td><td>The file you upload to the portal: <code>GSTR1_<i>GSTIN</i>_<i>MMYYYY</i>.json</code>. See <a href="#json-checks">Checks before the file is made</a>.</td></tr>
  <tr><td>${ui('B2B')}</td><td><code>GSTR1_B2B_Invoices.csv</code></td></tr>
  <tr><td>${ui('B2C')}</td><td><code>GSTR1_B2C_Small.csv</code>, and <code>GSTR1_B2C_Large.csv</code> if there are any</td></tr>
  <tr><td>${ui('HSN')}</td><td><code>GSTR1_HSN_Summary.csv</code>, with the unit code (UQC) for each unit</td></tr>
  <tr><td>${ui('CDNR')}</td><td><code>GSTR1_CDNR.csv</code> for credit notes to registered clients, <code>GSTR1_CDNUR.csv</code> for unregistered</td></tr>
  <tr><td>${ui('Docs')}</td><td><code>GSTR1_Doc_Summary.csv</code></td></tr>
  <tr><td>${ui('Mark Filed')}</td><td>Marks GSTR-1 filed for this period</td></tr>
</table>
<p>The CSV files are for checking and for your CA. The JSON is what the portal takes.</p>
</section>

<section id="json-checks">
<h2>Checks before the file is made</h2>
<p>The portal rejects some mistakes outright, so the app checks for them first.</p>
<p><strong>These stop the download until fixed:</strong></p>
<ul>
  <li>An invoice number longer than 16 characters, or with anything other than letters, digits, <code>-</code> or <code>/</code>.</li>
  <li>An item with a GST rate the portal does not accept. The app accepts 0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28 and 40%.</li>
</ul>
<p><strong>These download with a warning:</strong></p>
<ul>
  <li>Items with no HSN code. They are left out of the HSN table.</li>
  <li>HSN codes shorter than 4 digits, or 6 if you ticked turnover above ₹5 crore in <a href="settings.html#gstr-details">Settings</a>.</li>
  <li>Custom units, which are sent as OTH (others).</li>
</ul>
<p>Your turnover figures for the JSON are set in <a href="settings.html#gstr-details">Settings, GSTR filing details</a>. They are optional.</p>
</section>

<section id="upload">
<h2>Uploading GSTR-1 to the portal</h2>
<ol class="steps">
  <li><strong>Download the JSON</strong>${ui('JSON Export')} on the GSTR-1 tab, for the right month.</li>
  <li><strong>Open the return</strong>Log in at gst.gov.in, go to <b>Returns Dashboard</b>, pick the period, and open GSTR-1.</li>
  <li><strong>Upload it</strong>Choose <b>Prepare Offline</b>, upload the JSON, and wait for it to be processed.</li>
  <li><strong>Add what the file cannot hold</strong>Exports, in Table 6A.</li>
  <li><strong>Check and file</strong>Compare the portal's summary with the app's totals, then file with DSC or EVC.</li>
  <li><strong>Mark it filed</strong>Back in the app, click ${ui('Mark Filed')}.</li>
</ol>
</section>

<section id="gstr-3b">
<h2>GSTR-3B: tax to pay</h2>
<table>
  <tr><th>Table</th><th>What it shows</th></tr>
  <tr><td>3.1 Outward supplies</td><td>(a) taxable sales, (b) zero-rated exports with their IGST, (c) nil</td></tr>
  <tr><td>3.2 Inter-state to unregistered</td><td>Your inter-state sales to unregistered buyers, by state</td></tr>
  <tr><td>4 Eligible ITC</td><td>Credit from purchases and expenses, by IGST, CGST and SGST</td></tr>
  <tr><td>6 Tax payment</td><td>Output tax, less credit, and the <b>Net Tax Payable</b> for each tax</td></tr>
</table>
<p>The <b>Net GST Payable</b> box shows the amount to pay through the Electronic Cash Ledger, or "ITC covers your liability".</p>
<p>${ui('3B CSV')} and ${ui('3B JSON')} download it. The portal now fills most of GSTR-3B from your GSTR-1, so use the app's figures to check what it shows before you pay and file.</p>
<div class="note warn"><strong>Check the credit against GSTR-2B</strong>
<p>The credit here is everything you entered. Only what appears in your GSTR-2B can usually be claimed. Use the next tab to check.</p></div>
<figure><img src="assets/img/app-gstr3b.png" alt="The GSTR-3B tab." loading="lazy"><figcaption>The GSTR-3B tab.</figcaption></figure>
</section>

<section id="gstr-2b">
<h2>Checking your credit against GSTR-2B</h2>
<ol class="steps">
  <li><strong>Download GSTR-2B</strong>On the portal: <b>Returns</b>, <b>GSTR-2B</b>, <b>Download JSON</b>.</li>
  <li><strong>Import it</strong>On the <b>GSTR-2B Reconciliation</b> tab, click ${ui('Import 2B JSON')} and choose the file.</li>
  <li><strong>Read the results</strong>Each entry is matched to your purchase bills by the supplier's GSTIN and invoice number.</li>
</ol>
<table>
  <tr><td><b>✓ Matched</b></td><td>In both, and the amounts agree to within ₹1</td></tr>
  <tr><td><b>⚠ Amount mismatch</b></td><td>In both, but the amounts differ</td></tr>
  <tr><td><b>⚠ Books only</b></td><td>In your purchases but not in GSTR-2B. The supplier may not have filed yet.</td></tr>
  <tr><td><b>⚠ 2B only</b></td><td>In GSTR-2B but not entered in the app</td></tr>
</table>
<p>Click a count to show only those rows. ${ui('Export reconciliation CSV')} saves the result. Chase suppliers before claiming credit that is not in GSTR-2B.</p>
<p>The imported file is not kept: import it again after leaving the screen. Only B2B invoices in GSTR-2B are compared.</p>
</section>

<section id="tds-tcs">
<h2>TDS and TCS report</h2>
<p>The <b>TDS / TCS Report</b> tab adds up the period's invoices that have <a href="invoices.html#tds-tcs">TDS or TCS</a>:</p>
<ul>
  <li><strong>TDS Receivable</strong>: tax your clients should have deducted, which you claim against your own income tax. By quarter and section.</li>
  <li><strong>TCS Collected</strong>: tax you collected, which must be deposited and reported in Form 27EQ.</li>
</ul>
<p>${ui('Export TDS CSV')} and ${ui('Export TCS CSV')} list every invoice with quarter, section, rate, client, GSTIN, PAN, taxable value and amount. They are for your CA to prepare Form 26Q and 27EQ from; they are not the forms themselves.</p>
</section>

<section id="filing-guide">
<h2>The Filing Guide tab</h2>
<p>Step-by-step portal instructions inside the app, with due dates, late fees and interest:</p>
<ul>
  <li><strong>Regular Filing</strong>: GSTR-1 in 9 steps, then GSTR-3B in 7, with tips.</li>
  <li><strong>NIL Return</strong>: when a NIL return is due, and how to file it, including by SMS.</li>
  <li><strong>Common Errors &amp; Fixes</strong>: portal errors and what to do, and the GST rules worth remembering.</li>
</ul>
<p>Tick each step's circle as you go. The ticks are not saved.</p>
</section>

<section id="nil-return">
<h2>NIL returns</h2>
<p>If a period has no sales and no expenses, the app says so. A NIL return is still due, on time. The Filing Guide's <b>NIL Return</b> tab shows how, including by SMS to 14409.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'reports',
  title: 'Reports',
  lead: 'Profit and loss, who owes you and for how long, your best clients, and your best-selling products.',
  body: `
<section id="included">
<h2>What the reports include</h2>
<p>All four tabs cover the business selected in the sidebar and count only real sales, as the Dashboard does: tax invoices, bills of supply and composition bills count; credit notes are subtracted; proforma estimates, delivery challans and cancelled invoices are left out. Purchase bills are not part of these reports; they are in <a href="income-tax.html#itr-summary">Income Tax, ITR Summary</a>.</p>
</section>

<section id="profit-loss">
<h2>Profit &amp; Loss</h2>
<p>Choose <b>Fiscal Year</b> or <b>Month / Year</b>. If you bill in more than one currency, a <b>Currency</b> choice appears, since different currencies are never added together.</p>
<table>
  <tr><td><b>Revenue (ex. tax)</b></td><td>Sales without GST</td></tr>
  <tr><td><b>Expenses (ex. GST)</b></td><td>Expenses without their GST</td></tr>
  <tr><td><b>Net Profit</b> or <b>Net Loss</b></td><td>The difference. Green for profit, red for loss.</td></tr>
  <tr><td><b>Margin</b></td><td>Profit as a percentage of revenue</td></tr>
</table>
<p>The <b>Profit &amp; Loss Statement</b> sets it out: total revenue, less GST collected; total expenses, less GST on expenses; and the result. The <b>Monthly Breakdown</b> shows revenue, expenses and profit or loss for each month with activity.</p>
<p>The period chosen here is also used by the Client Analytics and Product Performance tabs.</p>
<figure><img src="assets/img/app-reports.png" alt="The Profit and Loss tab." loading="lazy"><figcaption>The Profit &amp; Loss tab.</figcaption></figure>
</section>

<section id="outstanding">
<h2>Outstanding &amp; Aging</h2>
<p>Every unpaid or part-paid invoice, whatever its date, grouped by how late it is: <b>Current (0-30 days)</b>, <b>31-60</b>, <b>61-90</b> and <b>90+ days</b>, counted from the due date.</p>
<p>The table lists client, invoice, date, due date, amount, paid, outstanding and days overdue, latest first, with the worst in red. <b>Filter by client name…</b> narrows the table and the totals together.</p>
</section>

<section id="clients">
<h2>Client Analytics</h2>
<ul>
  <li><strong>Top clients by revenue</strong>: the ten who bought the most, with invoice counts.</li>
  <li><strong>Highest outstanding</strong>: the ten who owe the most, and what share of their billing is unpaid.</li>
  <li><strong>All clients breakdown</strong>: invoices, revenue, paid, outstanding and last invoice date for everyone.</li>
</ul>
<p>Revenue here includes GST.</p>
</section>

<section id="products">
<h2>Product Performance</h2>
<ul>
  <li><strong>Top revenue producers</strong>: the ten items that brought in the most.</li>
  <li><strong>Most units sold</strong>: the ten sold in the largest quantity.</li>
  <li><strong>All products</strong>: HSN, quantity sold, revenue, average rate, number of sales and when last sold.</li>
</ul>
<p>Revenue here is quantity × rate, before discounts and tax, so it will not match invoice totals exactly.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'income-tax',
  title: 'Income tax helper',
  nav: 'Income tax',
  lead: 'Estimate your income tax under the old and new regimes, presumptive taxation, advance tax, bank statement import, and an ITR-4 summary to file from.',
  body: `
<div class="note warn"><strong>An estimate for one year</strong>
<p>The tax rules built in are for <b>FY 2025-26</b> (AY 2026-27). When today is in a later year, a banner says so, and invoices from the later year are not counted: enter that income yourself. Treat every figure as an estimate and have your CA confirm it before filing.</p></div>

<section id="tabs">
<h2>The five tabs</h2>
<table>
  <tr><td>Regime Calculator</td><td>Old and new regimes side by side, and which costs less</td></tr>
  <tr><td>Presumptive</td><td>Income under sections 44AD, 44ADA and 44AE</td></tr>
  <tr><td>Advance Tax</td><td>Instalments, and interest for paying late</td></tr>
  <tr><td>Bank Statement Import</td><td>Read a bank CSV and sort each transaction</td></tr>
  <tr><td>ITR Summary</td><td>The year in one place, and the ITR-4 summary PDF</td></tr>
</table>
<p>What you type on the first three tabs is remembered in this browser.</p>
</section>

<section id="regime-calculator">
<h2>Regime Calculator</h2>
<p>First tell it your <b>age</b> (under 60, 60 to 79, or 80 or older), whether your <b>parents are 60 or older</b>, and whether you are a <b>government employee</b>. These decide the old-regime slabs and the limits for 80D, 80DDB and 80CCD(2).</p>
<p>Then enter your income, in rupees, for the year:</p>
<ul>
  <li><strong>Gross Salary</strong>, as in box 1 of Form 16. The standard deduction is applied for you.</li>
  <li><strong>Business / Professional Income</strong>: filled in from your rupee sales, less purchases and business expenses, all without GST, if you leave it at zero. Change it if your books say otherwise.</li>
  <li><strong>House Property</strong> (rent less municipal tax and the 30% deduction; home-loan interest goes under 24(b) below), <strong>Other Sources</strong> such as bank interest, and <strong>capital gains</strong> on listed shares: short-term at 20%, long-term at 12.5% above ₹1.25 lakh.</li>
  <li><strong>Deductions</strong>, which only reduce old-regime tax: 80C, 80CCD(1B), 80D, 80TTA, 80TTB, 80E, 80G, 80GG, 80DDB, 80U and home-loan interest under 24(b). Each shows its limit.</li>
  <li><strong>80CCD(2)</strong>, employer NPS, allowed under both regimes.</li>
</ul>
<p>The right side shows each regime: gross income, deductions, taxable income, slab tax, capital-gains tax, rebate under 87A, surcharge, 4% cess and <b>Total Tax</b>. The cheaper one is marked <b>Recommended</b>, with how much it saves. To use the old regime you must file Form 10-IEA before the due date. ${ui('Reset')} clears everything.</p>

<figure><img src="assets/img/app-income-tax.png" alt="The Regime Calculator." loading="lazy"><figcaption>The Regime Calculator.</figcaption></figure>
</section>

<section id="presumptive">
<h2>Presumptive income</h2>
<p>Choose the section that fits you:</p>
<table>
  <tr><td><b>44AD</b></td><td>Trading, retail and manufacturing. Enter digital and cash turnover: 6% of digital and 8% of cash counts as income. The limit is ₹3 crore if cash is no more than 5% of turnover, otherwise ₹2 crore.</td></tr>
  <tr><td><b>44ADA</b></td><td>Professionals such as CAs, doctors, lawyers and consultants. 50% of receipts counts as income, up to ₹75 lakh of receipts (₹50 lakh if cash is over 5%).</td></tr>
  <tr><td><b>44AE</b></td><td>Owners of up to 10 goods vehicles. ₹1,000 per tonne per month for heavy vehicles, ₹7,500 per month for others.</td></tr>
</table>
<p>If your real profit is higher, enter it: you cannot declare less than the presumptive figure. Warnings appear if you are over a limit. ${ui('Use ₹… as Business Income')} copies the result into the calculator.</p>
</section>

<section id="advance-tax">
<h2>Advance tax</h2>
<p>Based on the recommended regime's tax, less <b>TDS already deducted</b>. If what is left is under ₹10,000, no advance tax is due.</p>
<p>Otherwise the schedule shows how much is due by 15 June (15%), 15 September (45%), 15 December (75%) and 15 March (100%). Tick <b>Presumptive</b> to pay it all by 15 March instead. Add the payments you made with ${ui('+ Add payment')}, and the interest for paying late or short, under sections 234B and 234C, is worked out.</p>
</section>

<section id="bank-import">
<h2>Bank statement import</h2>
<ol class="steps">
  <li><strong>Download a CSV</strong>From net-banking or your bank's app, save the statement for the year as CSV. Excel files must be saved as CSV first; PDFs are not accepted.</li>
  <li><strong>Drop it in</strong>SBI, HDFC, ICICI, Axis, Kotak, PNB and Yes Bank formats are recognised, and most others work too. It is read on your computer; nothing is uploaded.</li>
  <li><strong>Check the categories</strong>Each transaction is sorted by its description, such as salary, interest, rent received, investments, insurance, GST or business expense. Change any that are wrong. Mark your sales receipts as <b>Business receipts</b> yourself.</li>
  <li><strong>Push to the calculator</strong>${ui('Push to Calculator')} adds business receipts, interest, rent (less 30%), 80C and 80D to the calculator. Each statement can be pushed once; import it again to push a fresh copy.</li>
</ol>
<p>The imported statement is not kept after you leave the screen.</p>
</section>

<section id="itr-summary">
<h2>ITR Summary and the ITR-4 PDF</h2>
<p>The year's figures from the app: sales, trading purchases and business expenses (all without GST, and without drawings and asset purchases) and net business income, then salary, rent, other income and capital gains from the calculator, and the tax under each regime.</p>
<p>${ui('Download ITR-4 Summary')} makes a PDF with each ITR-4 (Sugam) field worked out, from income to deductions to tax and advance tax, to copy into incometax.gov.in or hand to your CA. ITR-4 is only for some taxpayers: if you have capital gains, or income above the limits, you need a different form.</p>
</section>
`,
},
];
