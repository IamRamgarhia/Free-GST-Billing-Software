const ui = (s) => `<span class="ui">${s}</span>`;

export default [
// =============================================================================
{
  slug: 'gst-returns',
  title: 'GST returns',
  lead: 'GSTR-1 and GSTR-3B built from the invoices, purchases and expenses you have already entered, checked against GSTR-2B, and ready to upload to the GST portal.',
  body: `
<div class="note info"><strong>The app prepares, you file</strong>
<p>The app works out the figures and makes the files. It does not log in to the GST portal. Filing is always done by you, or your CA, on gst.gov.in. Open the screen from <b>GST Returns</b> in the sidebar.</p></div>

<section id="gst-terms">
<h2>GST words on this screen, in plain language</h2>
<p>You do not need to be an accountant to use this screen. These are the words it uses. The <a href="glossary.html#terms">glossary</a> has more.</p>
<div class="table-wrap"><table>
  <tr><th>Word</th><th>What it means for you</th></tr>
  <tr><td><b>GSTR-1</b></td><td>The return that lists your <em>sales</em>: who you billed, how much, and the GST on it. Filed every month (by the 11th) or every quarter under QRMP (by the 13th after the quarter).</td></tr>
  <tr><td><b>GSTR-3B</b></td><td>The short summary return where you <em>pay</em> the tax: GST collected on sales, less the GST you paid on purchases. Filed by the 20th (monthly) or the 22nd/24th after the quarter (QRMP), depending on your state.</td></tr>
  <tr><td><b>GSTR-2B</b></td><td>A statement the portal makes for you every month, listing the purchase invoices your suppliers have reported. It shows which purchase GST you can claim back.</td></tr>
  <tr><td><b>B2B</b></td><td>Business to business: a sale to a client who has a GSTIN. Reported invoice by invoice, because your client claims credit for that GST.</td></tr>
  <tr><td><b>B2C</b></td><td>Business to consumer: a sale to someone with no GSTIN (a walk-in customer, a person, an unregistered shop). Mostly reported as totals, not invoice by invoice.</td></tr>
  <tr><td><b>B2C Large (B2CL)</b></td><td>An <em>inter-state</em> B2C invoice above ₹1 lakh (₹2.5 lakh for invoices dated before 1 August 2024). These are reported one by one.</td></tr>
  <tr><td><b>GSTIN</b></td><td>The 15-character GST number, such as 27ABCDE1234F1Z5. The first two digits are the state code (27 is Maharashtra).</td></tr>
  <tr><td><b>CGST, SGST, IGST</b></td><td>Inside your own state, GST is split half Central (CGST) and half State (SGST, or UTGST in a Union Territory). To another state, it is one Integrated tax (IGST). The app decides this from your state and the place of supply.</td></tr>
  <tr><td><b>Place of supply (POS)</b></td><td>The state the sale is treated as made in, usually the buyer's state. It decides CGST + SGST or IGST, and which state gets the tax. Shown as a code, such as 10 for Bihar.</td></tr>
  <tr><td><b>Intra-state / Inter-state</b></td><td>Intra: you and the place of supply are in the same state (CGST + SGST). Inter: different states (IGST).</td></tr>
  <tr><td><b>ITC (input tax credit)</b></td><td>The GST you paid on purchases and business expenses. You subtract it from the GST you collected, and pay only the difference.</td></tr>
  <tr><td><b>HSN / SAC code</b></td><td>The official code for what you sell: HSN for goods, SAC (starts with 99) for services. GSTR-1 needs a summary by code.</td></tr>
  <tr><td><b>Credit note / debit note</b></td><td>A credit note reduces an invoice you already issued (goods returned, a discount after the sale). It lowers your tax. A debit note increases one. The app makes credit notes.</td></tr>
  <tr><td><b>Reverse charge (RCM)</b></td><td>A few supplies where the <em>buyer</em> pays the GST instead of the seller, such as goods transport (GTA) or legal services.</td></tr>
  <tr><td><b>Zero-rated</b></td><td>Exports and sales to SEZ units. Taxed at 0%, or IGST paid and later refunded.</td></tr>
  <tr><td><b>QRMP</b></td><td>Quarterly Return, Monthly Payment: small businesses (up to ₹5 crore turnover) can file GSTR-1 and GSTR-3B every quarter.</td></tr>
  <tr><td><b>NIL return</b></td><td>A return for a period with nothing to report. It is still compulsory.</td></tr>
</table></div>
</section>

<section id="period">
<h2>Choosing the period</h2>
<p>The row at the top, next to <b>GST Returns</b>, chooses the period every tab shows. It opens on the current month.</p>
<div class="table-wrap"><table>
  <tr><th>Control</th><th>What it does</th></tr>
  <tr><td>First list: <b>Monthly</b>, <b>Quarterly (QRMP)</b> or <b>Full Year</b></td><td>How long the period is. Pick Monthly if you file every month, Quarterly (QRMP) if you file every quarter.</td></tr>
  <tr><td>Month and year (Monthly)</td><td>January to December, and a year from this year back five years.</td></tr>
  <tr><td>Quarter and year (Quarterly)</td><td>Q1 (Apr–Jun), Q2 (Jul–Sep), Q3 (Oct–Dec) or Q4 (Jan–Mar). The year is the calendar year of those months, so the Jan–Mar 2027 quarter is <b>Q4</b> with <b>2027</b>, and Apr–Jun 2026 is <b>Q1</b> with <b>2026</b>.</td></tr>
  <tr><td>Financial year (Full Year)</td><td>A financial year, such as FY 2026-27 (April to March). Useful for checking a whole year, or for your CA.</td></tr>
  <tr><td><b>R1 Pending / R1 Filed</b> and <b>3B Pending / 3B Filed</b></td><td>Whether you have filed GSTR-1 and GSTR-3B for this period. Click to switch. See <a href="#filed-status">Filed status</a>.</td></tr>
  <tr><td>${ui('GST Portal')}</td><td>Opens gst.gov.in in your browser.</td></tr>
</table></div>
<p>An invoice, purchase or expense belongs to the period of its <b>date</b>. Everything shown is for the business selected at the top of the sidebar only: each GSTIN files its own returns.</p>
<p>The files the app makes carry the <b>return period</b> the portal expects: the month for a monthly return, the <em>last month of the quarter</em> for a quarterly one (Q1 2026 is 062026), and March of the closing year for a full year.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>Figures look empty or too small? Check the period type (Monthly or Quarterly) and the year first: Jan–Mar is Q4 with the <em>new</em> calendar year. Then check the business in the sidebar. See <a href="troubleshooting.html#nothing-to-export">"No data to export for this period"</a>.</p></div>
</section>

<section id="whats-included">
<h2>What is included</h2>
<ul>
  <li><strong>Tax tables (GSTR-1 and GSTR-3B)</strong> use <b>tax invoices</b> and <b>credit notes</b> only.</li>
  <li><strong>Left out of the tax tables</strong>: proforma estimates, quotations, bills of supply, composition bills, delivery challans, and cancelled invoices.</li>
  <li><strong>Document Summary (Table 13)</strong> also counts bills of supply, composition bills, delivery challans, and cancelled documents, as the portal asks. See <a href="#doc-summary">Document Summary</a>.</li>
  <li><strong>B2B or B2C</strong> is decided by the client: a client with a GSTIN is B2B, one without is B2C.</li>
  <li><strong>Exports</strong> (a client whose country is not India) are kept out of B2B and B2C and listed in the red box. See <a href="#exports">Exports and SEZ</a>.</li>
  <li><strong>Input tax credit</strong> comes from your <a href="purchases.html">purchase bills</a> and <a href="expenses.html#gst-credit">expenses with GST</a> dated in the period.</li>
  <li><strong>Only the selected business</strong>: invoices, purchases and expenses of other businesses you keep in the app are never mixed in.</li>
</ul>
<div class="note info"><strong>Composition, annual and other returns</strong>
<p>This screen prepares GSTR-1 and GSTR-3B for a regular GST business. It does not make CMP-08, GSTR-4 (composition), GSTR-9 (annual) or TDS/TCS forms. The figures here, and the CSV files, help your CA prepare those.</p></div>
</section>

<section id="top-bar">
<h2>Filed status, warnings and the summary strip</h2>
<p>Above the tabs you see, from top to bottom: the period row, a red box and an amber box if anything needs fixing, a NIL banner if the period is empty, and a strip of four totals. Below them are the tabs:</p>
<div class="table-wrap"><table>
  <tr><th>Tab</th><th>What it is for</th></tr>
  <tr><td><b>GSTR-1</b></td><td>Your sales, in the portal's tables, with the JSON file to upload. See <a href="#gstr-1">GSTR-1</a>.</td></tr>
  <tr><td><b>GSTR-3B</b></td><td>Tax on sales, credit on purchases, and what you pay. See <a href="#gstr-3b">GSTR-3B</a>.</td></tr>
  <tr><td><b>GSTR-2B Reconciliation</b></td><td>Checks your purchase bills against GSTR-2B. Shown only while <b>GSTR-2B matching</b> is on in <a href="settings.html#features">Settings, Features</a> (it is on to start). See <a href="#gstr-2b">GSTR-2B</a>.</td></tr>
  <tr><td><b>TDS / TCS Report</b></td><td>TDS your clients deducted and TCS you collected. See <a href="#tds-tcs">TDS and TCS</a>.</td></tr>
  <tr><td><b>Filing Guide</b></td><td>Step-by-step portal instructions. See <a href="#filing-guide">Filing Guide</a>.</td></tr>
</table></div>
<p>The small ? next to the tabs opens the guide for the tab you are on.</p>
</section>

<section id="filed-status">
<h3>Filed status (R1 and 3B)</h3>
<p>The two small pills in the period row remember whether you have filed:</p>
<ul>
  <li><strong>R1 Pending</strong> (red) or <strong>R1 Filed</strong> (green): GSTR-1.</li>
  <li><strong>3B Pending</strong> (red) or <strong>3B Filed</strong> (green): GSTR-3B.</li>
</ul>
<ol class="steps">
  <li><strong>File on the portal first</strong>The app cannot see the portal, so it only knows what you tell it.</li>
  <li><strong>Mark it</strong>Click the pill, or ${ui('Mark Filed')} on the GSTR-1 or GSTR-3B tab. A message confirms "GSTR1 marked as filed for this period".</li>
  <li><strong>Undo a mistake</strong>Click the green pill again: it goes back to Pending.</li>
</ol>
<p>The mark is kept in this browser, for each business (GSTIN) and each period. Monthly, quarterly and full-year periods are separate: marking Q1 filed does not mark April, May and June. Another computer or browser does not see your marks.</p>
</section>

<section id="warnings">
<h3>The red and amber warning boxes</h3>
<p>The app checks the period's invoices and shows problems before you file. The <b>red box</b> is for problems that make the return wrong or that the portal rejects. The <b>amber box</b> is for things worth fixing. Each box shows the first three messages; fix them and the next ones appear (the amber box also says "+N more").</p>
<div class="table-wrap"><table>
  <tr><th>Message</th><th>What to do</th></tr>
  <tr><td>"<b>N export invoice(s) (…) are not in the GSTR-1 file.</b> Add them in Table 6A on the GST portal with the shipping bill details"</td><td>Nothing is wrong with the invoices. On the portal, enter each export in Table 6A with its shipping bill number, date and port code. See <a href="#exports">Exports</a>.</td></tr>
  <tr><td>"Invoice X: <b>Invalid client GSTIN format</b> — …"</td><td>The client's GSTIN is mistyped. Correct it on the <a href="clients.html#client-form">client</a> and on the invoice, then save the invoice again.</td></tr>
  <tr><td>"Invoice X: <b>inter-state sale</b> to … <b>without the buyer's state as Place of Supply</b>"</td><td>A B2C sale charged IGST, but its place of supply is missing or is your own state. The portal refuses that. Open the invoice, set <a href="invoices.html#details">Place of Supply</a> to the buyer's state, and save.</td></tr>
  <tr><td>"<b>Your business GSTIN is not set.</b> Go to Settings → Company Details to add it."</td><td>Add it in <a href="settings.html#company-details">Settings, Company Details</a>. The files need it.</td></tr>
  <tr><td>Amber: "Invoice X: Item "…" <b>has no HSN/SAC code</b>"</td><td>Add the code to the item on the invoice (and on the <a href="products.html#add-product">product</a>, so future bills have it). Without it the item is left out of the HSN table in the JSON.</td></tr>
  <tr><td>Amber: "Invoice X: Client … <b>has GSTIN but no State</b>"</td><td>Set the client's state, or the invoice's Place of Supply. Otherwise the place of supply may come out wrong.</td></tr>
</table></div>
<div class="note tip"><strong>Something wrong?</strong>
<p>Fixed an invoice but the message is still there? Save the invoice, then come back to GST Returns (switch to another screen and back) so it reads the invoices again. For a wrong CGST/IGST split, see <a href="troubleshooting.html#wrong-tax">The invoice has the wrong tax split</a>.</p></div>
</section>

<section id="summary-strip">
<h3>The summary strip</h3>
<div class="table-wrap"><table>
  <tr><th>Figure</th><th>What it counts</th></tr>
  <tr><td><b>Invoices</b></td><td>Tax invoices and credit notes in the period, exports included</td></tr>
  <tr><td><b>Taxable</b></td><td>Taxable value of B2B and B2C sales, less credit notes (exports not included)</td></tr>
  <tr><td><b>Tax</b></td><td>CGST + SGST + IGST on those sales, less credit notes</td></tr>
  <tr><td><b>Net Payable</b></td><td>What is left to pay in cash after your input tax credit, as on the <a href="#table-6-payment">GSTR-3B tab</a></td></tr>
</table></div>
</section>

<section id="gstr-1">
<h2>GSTR-1: your sales</h2>
<p>The GSTR-1 tab lays your sales out in the same tables as the portal, so you can check them before you upload. At the top is a row of buttons (see <a href="#gstr-1-files">GSTR-1 downloads</a>). Below are these cards:</p>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>Portal table</th><th>What is in it</th></tr>
  <tr><td><a href="#b2b">B2B Sales — Table 4A</a></td><td>4A</td><td>Invoices to clients with a GSTIN, one row each</td></tr>
  <tr><td><a href="#credit-notes">Credit/Debit Notes — Table 9B</a></td><td>9B</td><td>Credit notes issued in the period (shown only if there are any)</td></tr>
  <tr><td><a href="#b2c">B2C Sales — Table 7</a></td><td>7 and 5</td><td>Sales to buyers without a GSTIN, added up; B2C Large invoices listed under them</td></tr>
  <tr><td><a href="#hsn-summary">HSN Summary — Table 12</a></td><td>12</td><td>Quantity, value and tax for each HSN/SAC code</td></tr>
  <tr><td><a href="#doc-summary">Document Summary — Table 13</a></td><td>13</td><td>Number ranges of documents issued, and how many were cancelled</td></tr>
  <tr><td><a href="#gstr-1-summary">GSTR-1 Summary Totals</a></td><td>-</td><td>B2B and B2C together, less credit notes</td></tr>
</table></div>
<p>Exports to clients abroad are not in these tables or in the GSTR-1 file. The red box lists them: add them in Table 6A on the portal with the shipping bill details.</p>
<figure><img src="assets/img/app-gstr1.png" alt="The GSTR-1 tab for one month." loading="lazy"><figcaption>The GSTR-1 tab for one month.</figcaption></figure>
</section>

<section id="b2b">
<h3>B2B Sales — Table 4A</h3>
<p>Every tax invoice to a client with a GSTIN, one row each. Your client sees these in their GSTR-2B and claims the GST as credit, so they must be right. The heading shows how many invoices there are.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td>GSTIN</td><td>The client's GSTIN, from the invoice</td></tr>
  <tr><td>Client, Invoice No, Date</td><td>As on the invoice</td></tr>
  <tr><td>POS</td><td>Place of supply as a state code (27, 10, 07…)</td></tr>
  <tr><td>Type</td><td><b>Intra</b> (CGST + SGST) or <b>Inter</b> (IGST), exactly as the invoice charged it</td></tr>
  <tr><td>Taxable, CGST, SGST, IGST</td><td>Taxable value and tax. UTGST (Union Territories) is shown under SGST, as the portal takes it.</td></tr>
  <tr><td>Total</td><td>The invoice total</td></tr>
</table></div>
<p>The last row, <b>B2B Total</b>, adds them up. "No B2B invoices for this period." means no invoice in the period had a client GSTIN.</p>
<p>In the JSON, a <a href="invoices.html#reverse-charge">reverse-charge</a> invoice is marked so, and an invoice to an SEZ client goes in as an SEZ supply (with or without payment of tax, from the invoice's LUT option).</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>A sale to a business is in B2C instead? The client had no GSTIN on that invoice. Add the GSTIN to the client, open the invoice, pick the client again so the GSTIN is copied in, and save. Wrong Intra/Inter? See <a href="troubleshooting.html#wrong-tax">wrong tax split</a>.</p></div>
</section>

<section id="credit-notes">
<h3>Credit/Debit Notes — Table 9B</h3>
<p>Shown only when the period has <a href="invoices.html#credit-note">credit notes</a>. One row per note: the client's GSTIN (or <b>Unregistered</b>), client, note number, date, taxable value, tax and total.</p>
<ul>
  <li>Credit notes <strong>reduce</strong> your sales and tax. They are subtracted in the <a href="#gstr-1-summary">Summary Totals</a>, the <a href="#hsn-summary">HSN Summary</a> and GSTR-3B.</li>
  <li>Notes to clients with a GSTIN go in the JSON file (CDNR). Notes to <strong>unregistered</strong> buyers are <strong>not</strong> in the JSON: download them with ${ui('CDNR')} (the file <code>GSTR1_CDNUR.csv</code>) and enter them on the portal under 9B (Unregistered), if the portal asks for them.</li>
  <li>The app does not make debit notes. If you issue one, add it on the portal by hand.</li>
</ul>
</section>

<section id="b2c">
<h3>B2C Sales — Table 7</h3>
<p>Sales to buyers without a GSTIN. The portal does not want them one by one: it wants totals for each <b>supply type</b>, <b>place of supply</b> and <b>tax rate</b>, and that is how the card shows them.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td>Type</td><td><b>Intra-state</b>, <b>Inter-state</b>, or <b>Inter-state, large</b> for a B2C Large invoice</td></tr>
  <tr><td>Place of supply</td><td>State code and name, such as 10-Bihar</td></tr>
  <tr><td>Rate %</td><td>The GST rate. For a large invoice this column shows its invoice number instead.</td></tr>
  <tr><td>Taxable, CGST, SGST, IGST, Total</td><td>Added up for that row</td></tr>
</table></div>
<p><strong>B2C Large (Table 5).</strong> An inter-state invoice to an unregistered buyer above ₹1 lakh (₹2.5 lakh for invoices before 1 August 2024) is listed on its own row, marked <b>Inter-state, large</b>, and goes in the file invoice by invoice. The heading shows how many there are, such as "12 invoices (1 B2C Large)".</p>
<p>The last row, <b>B2C Total</b>, adds up all B2C sales. Credit notes are not taken off here; they are subtracted once, in the Summary Totals.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>An inter-state sale shows in the red box? Its place of supply is missing or is your own state. Open the invoice, set <a href="invoices.html#details">Place of Supply</a> to the buyer's state, and save. A walk-in sale in your own state should be <b>Intra-state</b>: if it is not, check your state in <a href="settings.html#company-details">Settings</a>.</p></div>
</section>

<section id="hsn-summary">
<h3>HSN Summary — Table 12</h3>
<p>One row for each HSN/SAC code, tax rate and unit. The portal requires this table, and from the May 2025 return it comes in two parts, so the screen shows two tables, each with its own total:</p>
<ul>
  <li><b>B2B (buyers with a GSTIN)</b>: sales to registered buyers, SEZ units too.</li>
  <li><b>B2C</b>: sales to buyers without a GSTIN, and exports.</li>
</ul>
<p>The two tables, the two HSN CSV files and the JSON are worked out from the same rows, so they always agree. Credit notes reduce the rows of the part their buyer belongs to.</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td>HSN</td><td>The code on the item</td></tr>
  <tr><td>Description</td><td>The name of the first item with that code</td></tr>
  <tr><td>UQC, Rate</td><td>The portal's unit code and the tax rate of the row</td></tr>
  <tr><td>Qty</td><td>Total quantity. Credit notes subtract. A service (SAC starting 99) shows unit NA and quantity 0.</td></tr>
  <tr><td>Taxable, CGST, SGST, IGST, Total Value</td><td>Added up, net of credit notes. Total Value is the taxable value plus all the tax.</td></tr>
</table></div>
<p>How many digits you need depends on your turnover: 4 digits up to ₹5 crore, 6 digits above. Tick <b>Aggregate turnover (AATO) is above ₹5 crore</b> in <a href="settings.html#gstr-details">Settings, GSTR filing details</a> if that is you, and the app checks for 6.</p>
<p>In the JSON and in the HSN CSV each unit is turned into the portal's unit code (UQC), such as NOS, KGS or MTR. A unit the portal does not know goes in as OTH (others).</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>A yellow line saying some invoice lines have <b>no HSN code</b>: those lines are left out of Table 12 on screen, in the CSV and in the JSON, because the portal needs an HSN for every line. Add the code on those invoices and on the <a href="products.html#add-product">product</a>. The same code on two rows means two rates or two units were used with it, which is correct.</p></div>
</section>

<section id="doc-summary">
<h3>Document Summary — Table 13</h3>
<p>The portal wants to know which document numbers you used in the period. One row per <b>number series</b> (the number without its last digits, such as <code>INV/26-27/</code>):</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Meaning</th></tr>
  <tr><td>Document Type</td><td><b>Invoices for outward supply</b> (tax invoices, bills of supply, composition bills), <b>Credit notes</b> or <b>Delivery challans</b></td></tr>
  <tr><td>From, To</td><td>The lowest and highest number in that series this period</td></tr>
  <tr><td>Total Issued</td><td>How many numbers were used, cancelled ones included</td></tr>
  <tr><td>Cancelled</td><td>How many of those were cancelled. The portal works out net issued as Total minus Cancelled.</td></tr>
</table></div>
<p>Quotations and proforma estimates are not reported. If you changed the number prefix during the period, you see two rows: that is correct.</p>
</section>

<section id="gstr-1-summary">
<h3>GSTR-1 Summary Totals</h3>
<p>The last card adds up the return: a <b>B2B Sales</b> row, a <b>B2C Sales</b> row, and a <b>Grand Total</b>. The Grand Total takes credit notes off, so it can be lower than B2B plus B2C. Exports are not in it (they are in GSTR-3B 3.1(b)).</p>
<p>After you upload the JSON, compare these figures with the summary the portal shows before you file.</p>
</section>

<section id="exports">
<h3>Exports and SEZ</h3>
<ul>
  <li><strong>Exports</strong>: an invoice to a client whose country is not India. It is kept out of B2B and B2C and out of the JSON file, because the portal's export table (6A) can need the shipping bill number, date and port code, which the app does not record. The <b>Exports — Table 6A</b> table on the GSTR-1 tab lists them, ready to type into Table 6A on the portal: type <b>WPAY</b> (IGST paid) or <b>WOPAY</b> (under a LUT, no IGST), invoice number and date, rate, taxable value, IGST and invoice value. ${ui('Exports')} saves the same rows as <code>GSTR1_Exports_6A.csv</code>. For services no shipping bill is needed; for goods add it on the portal.</li>
</ul>
<figure><img src="assets/img/gstr1-exports.png" alt="The Exports — Table 6A table on the GSTR-1 tab: one invoice to a US client, type WOPAY, billed in USD at a rate of 84.2, with taxable value, IGST of zero and invoice value in rupees." loading="lazy"><figcaption>An export under a LUT (WOPAY), in rupees at the rate saved on the invoice.</figcaption></figure>
<ul>
  <li><strong>SEZ units</strong>: a client with <b>SEZ</b> ticked is a B2B sale, always inter-state. In the JSON it is an SEZ supply with payment of tax, or without payment if the invoice is under LUT.</li>
  <li><strong>GSTR-3B</strong>: both exports and SEZ supplies are zero-rated, so their value (and IGST, if paid) goes in Table 3.1(b), not 3.1(a). See <a href="#gstr-3b">GSTR-3B</a>.</li>
</ul>
<h3 id="foreign-currency">Invoices in dollars, euros and other currencies</h3>
<p>Every figure on this screen is in rupees. An invoice billed in another currency is turned into rupees at the exchange rate saved on that invoice (see <a href="invoices.html#currency">Billing in another currency</a>): its value, taxable value and tax in every table, the HSN summary and GSTR-3B. The Exports table shows each invoice's currency and rate, for example <i>USD @ 84.1</i>.</p>
<p>An invoice in another currency <b>without</b> a rate cannot be turned into rupees. It is listed in the red box, its row in the Exports table shows <i>no rate</i>, and the GSTR-1 file is not made until you open the invoice and type the rate. Under GST the rate to use is the one for the date of the invoice: the RBI reference rate, or your bank's rate for that day.</p>
<p>The rupee value is worked out from the invoice amounts and rounded to the paisa. If your accountant or the shipping bill uses a different rate, the portal figures follow theirs; ask them which to use.</p>
</section>

<section id="gstr-1-files">
<h2>GSTR-1 downloads</h2>
<p>The buttons at the top of the GSTR-1 tab:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it saves</th></tr>
  <tr><td>${ui('JSON Export')}</td><td>The file you upload to the portal: <code>GSTR1_<i>GSTIN</i>_<i>MMYYYY</i>.json</code>. It is checked first: see <a href="#json-checks">Checks before the file is made</a>.</td></tr>
  <tr><td>${ui('B2B')}</td><td><code>GSTR1_B2B_Invoices.csv</code>: one row per B2B invoice, in the portal's Table 4A layout</td></tr>
  <tr><td>${ui('B2C')}</td><td><code>GSTR1_B2C_Small.csv</code> (totals by type, place of supply and rate), and <code>GSTR1_B2C_Large.csv</code> if there are any large invoices</td></tr>
  <tr><td>${ui('HSN')}</td><td>Two files, <code>GSTR1_HSN_B2B.csv</code> and <code>GSTR1_HSN_B2C.csv</code>, one for each part of Table 12 (a part with no rows is not downloaded), in the column order of the portal's Table 12 template, with the unit code (UQC). For a period before May 2025, one file, <code>GSTR1_HSN_Summary.csv</code>.</td></tr>
  <tr><td>${ui('CDNR')}</td><td><code>GSTR1_CDNR.csv</code> for credit notes to registered clients, <code>GSTR1_CDNUR.csv</code> for unregistered</td></tr>
  <tr><td>${ui('Docs')}</td><td><code>GSTR1_Doc_Summary.csv</code>: the Table 13 rows</td></tr>
  <tr><td>${ui('Mark Filed')}</td><td>Marks GSTR-1 filed for this period. The button goes away once it is marked; use the <a href="#filed-status">R1 pill</a> to undo.</td></tr>
</table></div>
<p>The CSV files are for checking and for your CA. The JSON is what the portal takes. If there is nothing of that kind in the period you see a message such as "No B2B data to export" or "No Credit Notes", and no file is saved.</p>
<p>Files go to your browser's download folder. Download them again after changing an invoice: an old file does not update itself.</p>
</section>

<section id="json-checks">
<h2>Checks before the file is made</h2>
<p>The portal rejects some mistakes outright, so ${ui('JSON Export')} checks for them first.</p>
<p><strong>These stop the download until fixed</strong> (the message starts "GSTR-1 export blocked — fix these first"):</p>
<ul>
  <li>An invoice or credit note number longer than 16 characters, or with anything other than letters, digits, <code>-</code> or <code>/</code>. The message names the first three.</li>
  <li>An item with a GST rate the portal does not accept. The portal takes 0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28 and 40%.</li>
  <li>Your own GSTIN is not set in <a href="settings.html#company-details">Settings, Company</a>.</li>
  <li><b>Full year</b> is chosen as the period. A GSTR-1 file is for one month, or one quarter if you file quarterly.</li>
  <li>An invoice to a registered buyer, or an inter-state sale, with no place of supply (no client state and no Place of Supply on the invoice).</li>
</ul>
<p><strong>These download with a warning</strong> (the message starts "GSTR-1 JSON exported. ⚠"):</p>
<ul>
  <li>Items with no HSN code. They are left out of the HSN table.</li>
  <li>HSN codes shorter than 4 digits, or 6 if you ticked turnover above ₹5 crore in <a href="settings.html#gstr-details">Settings</a>.</li>
  <li>Custom units, which are sent as OTH (others).</li>
</ul>
<p><strong>What the JSON holds:</strong> B2B invoices, B2C totals, B2C Large invoices, credit notes to registered clients, credit notes to buyers without a GSTIN (a large inter-state one in Table 9B; the rest reduce the B2C totals), the HSN summary and the document summary. It is laid out the way the portal takes it today: from the May 2025 return, the HSN summary (Table 12) comes in two lists, <b>B2B</b> (buyers with a GSTIN, SEZ units too) and <b>B2C</b> (buyers without a GSTIN, and exports), each description at most 30 characters, and services with unit <b>NA</b> and quantity 0. Empty tables and blank values are left out, because the portal rejects them.</p>
<p><strong>What you add on the portal by hand:</strong> exports (Table 6A), credit notes on exports, debit notes, advances received (Table 11), amendments to earlier periods (Table 9A), and nil-rated, exempt or non-GST sales (Table 8). Items at 0% are sent at a 0% rate in B2B and B2C.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>Blocked? Open each invoice the message names, correct the number or the rate, save, and export again. See <a href="troubleshooting.html#gstr1-blocked">"GSTR-1 export blocked"</a>. "No invoices to export" means the period has no tax invoices or credit notes: check the <a href="#period">period</a>.</p></div>
</section>

<section id="upload">
<h2>Uploading GSTR-1 to the portal</h2>
<ol class="steps">
  <li><strong>Fix the red box</strong>Clear the problems listed at the top first.</li>
  <li><strong>Download the JSON</strong>${ui('JSON Export')} on the GSTR-1 tab, for the right month or quarter.</li>
  <li><strong>Open the return</strong>Log in at gst.gov.in, go to <b>Returns Dashboard</b>, pick the financial year and period, and open GSTR-1.</li>
  <li><strong>Upload it</strong>Choose <b>Prepare Offline</b>, upload the JSON, and wait for it to be processed. If the portal reports errors, it gives an error file to download: fix those invoices in the app and upload a fresh JSON.</li>
  <li><strong>Add what the file cannot hold</strong>Exports in Table 6A, and anything else listed under <a href="#json-checks">What you add on the portal by hand</a>.</li>
  <li><strong>Check and file</strong>Compare the portal's summary with the app's <a href="#gstr-1-summary">Summary Totals</a>, then submit and file with DSC or EVC (OTP).</li>
  <li><strong>Mark it filed</strong>Back in the app, click ${ui('Mark Filed')}.</li>
</ol>
</section>

<section id="gstr-3b">
<h2>GSTR-3B: tax to pay</h2>
<p>GSTR-3B is where you pay. The tab works it out in four steps: tax on sales (3.1 and 3.2), credit on purchases (4), the credit used against the tax (6), and what is left to pay in cash.</p>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>What it shows</th></tr>
  <tr><td><a href="#table-3-1">Table 3.1 — Outward Supplies &amp; Tax</a></td><td>(a) taxable sales, (b) exports with their IGST, (c) nil and exempt</td></tr>
  <tr><td><a href="#table-3-2">Table 3.2 — Inter-state Supplies to Unregistered Persons</a></td><td>Inter-state B2C sales, by state. Shown only if there are any.</td></tr>
  <tr><td><a href="#table-4-itc">Table 4 — Eligible ITC</a></td><td>Credit from purchases and expenses, by IGST, CGST and SGST</td></tr>
  <tr><td><a href="#table-6-payment">Table 6 — Tax Payment Summary</a></td><td>Tax, credit used, <b>Net Tax Payable</b>, and credit carried forward</td></tr>
  <tr><td><a href="#net-payable">Net GST Payable</a></td><td>The one figure to pay</td></tr>
</table></div>
<p>The portal now fills most of GSTR-3B from your GSTR-1. Use the app's figures to check what it shows before you pay and file.</p>
<div class="note warn"><strong>Check the credit against GSTR-2B</strong>
<p>The credit here is everything you entered. Usually only what appears in your GSTR-2B can be claimed. Use the <a href="#gstr-2b">GSTR-2B Reconciliation</a> tab to check.</p></div>
<figure><img src="assets/img/app-gstr3b.png" alt="The GSTR-3B tab." loading="lazy"><figcaption>The GSTR-3B tab.</figcaption></figure>
<p id="zero-rated">Table <b>3.1(b) Zero-rated supplies</b> holds exports and supplies to SEZ units or developers, with or without IGST, in rupees. Supplies to an SEZ used to be counted in 3.1(a) with the other B2B sales; CBIC Circular 147/03/2021-GST (paragraph 3) treats that as a mistake that blocks the IGST refund, so they are now in 3.1(b). The IGST on them still counts in the tax you pay. Their credit notes reduce 3.1(b).</p>
</section>

<section id="table-3-1">
<h3>Table 3.1 — Outward Supplies &amp; Tax</h3>
<div class="table-wrap"><table>
  <tr><th>Row</th><th>What is in it</th></tr>
  <tr><td>(a) Outward taxable supplies (other than zero-rated, nil-rated and exempted)</td><td>B2B and B2C sales, less credit notes: the same as the GSTR-1 Grand Total. Taxable value, IGST, CGST and SGST.</td></tr>
  <tr><td>(b) Zero-rated supplies</td><td>Exports: their taxable value and any IGST charged on them</td></tr>
  <tr><td>(c) Other outward supplies (nil rated, exempted)</td><td>Always ₹0: the app does not separate exempt sales. If you have them, enter them on the portal.</td></tr>
</table></div>
<p>Reverse-charge purchases, 3.1(d), are not shown on screen, but the <a href="#gstr-3b-files">3B JSON</a> fills them from the period's purchase bills marked reverse charge. Pay that tax in cash on the portal.</p>
</section>

<section id="table-3-2">
<h3>Table 3.2 — Inter-state Supplies to Unregistered Persons</h3>
<p>Appears only when you sold to a buyer without a GSTIN in another state. One row per state (the client's state), with the taxable value and IGST. It should agree with the inter-state rows of <a href="#b2c">B2C Sales</a>. On the portal, add a row for each place of supply.</p>
</section>

<section id="table-4-itc">
<h3>Table 4 — Eligible ITC (from Expenses &amp; Purchases)</h3>
<p>The GST you paid, which you can take off the GST you owe. It adds up:</p>
<ul>
  <li><strong><a href="purchases.html">Purchase bills</a></strong> dated in the period: their GST goes to IGST if the purchase is marked inter-state, otherwise half to CGST and half to SGST.</li>
  <li><strong><a href="expenses.html#gst-credit">Expenses</a></strong> dated in the period with a GST amount: the same way.</li>
</ul>
<p>The row <b>(A) ITC Available — All other ITC</b> is the portal's Table 4(A)(5), where ordinary purchase credit goes. <b>Net ITC Available</b> is the same figure, because the app does not reverse any credit. Cess on purchases is sent in the 3B JSON.</p>
<div class="note warn"><strong>Not all GST paid is credit</strong>
<p>The app counts every GST amount you entered. Some is not claimable: food and drinks, personal spending, motor cars in most cases, bills without your GSTIN on them, or invoices the supplier has not reported (not in GSTR-2B). Leave such GST out of the expense, or reduce the figure on the portal. Ask your CA if unsure.</p></div>
</section>

<section id="table-6-payment">
<h3>Table 6 — Tax Payment Summary</h3>
<div class="table-wrap"><table>
  <tr><th>Row</th><th>Meaning</th></tr>
  <tr><td>Output Tax Liability</td><td>Tax on your sales: Table 3.1(a), plus IGST on exports</td></tr>
  <tr><td>Less: ITC utilised</td><td>The credit from Table 4 used against it, in the order the law sets</td></tr>
  <tr><td>Net Tax Payable</td><td>What is left, for each tax and in total. This is paid in cash.</td></tr>
  <tr><td>ITC carried forward</td><td>Shown only when credit is left over. It stays in your credit ledger for next month.</td></tr>
</table></div>
<p>Credit is used in the order the law sets: IGST credit first (against IGST, then CGST and SGST), then CGST credit (against CGST, then IGST) and SGST credit (against SGST, then IGST). CGST credit never pays SGST, nor SGST credit CGST. So credit you hold in CGST and SGST can pay a tax that is all IGST. When IGST credit is spread over CGST and SGST, the app sends it first to the part your own CGST or SGST credit cannot cover, so none of that credit is left stranded while you pay cash.</p>
<p><strong>Example.</strong> You owe CGST ₹9,000 and SGST ₹9,000, and no IGST. You have IGST credit ₹5,000 and CGST credit ₹6,000. CGST credit can cover only ₹6,000 of the CGST, so IGST credit pays the other ₹3,000 of CGST and its last ₹2,000 goes to SGST. CGST credit pays its ₹6,000. You pay SGST ₹7,000 in cash, and nothing is carried forward.</p>
<p>If instead you owed only SGST ₹9,000 and had CGST credit ₹6,000, that credit could not be used at all: you would pay ₹9,000 in cash and carry ₹6,000 CGST credit forward.</p>
</section>

<section id="net-payable">
<h3>Net GST Payable</h3>
<p>The big figure at the bottom of the GSTR-3B tab: the total to pay for the period. Underneath it says <b>Pay via Electronic Cash Ledger</b> (create a challan on the portal and pay by net banking, UPI, card or NEFT/RTGS), or <b>ITC covers your liability</b> when nothing is due in cash.</p>
<p>Late payment carries interest at 18% a year on the cash amount, and a late fee for filing late. See the <a href="#guide-gstr3b-steps">Filing Guide</a>.</p>
</section>

<section id="gstr-3b-files">
<h3>GSTR-3B downloads</h3>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it saves</th></tr>
  <tr><td>${ui('3B CSV')}</td><td><code>GSTR3B_Summary.csv</code>: rows for 3.1(a), 4(A) ITC available, 6.1 ITC utilised, 6.1 tax payable in cash, and ITC carried forward</td></tr>
  <tr><td>${ui('3B JSON')}</td><td><code>GSTR3B_<i>GSTIN</i>_<i>MMYYYY</i>.json</code> in the portal's GSTR-3B format: 3.1(a), 3.1(b), reverse charge 3.1(d) and Table 4(A)(5) with cess. Other rows are sent as 0.</td></tr>
  <tr><td>${ui('Mark Filed')}</td><td>Marks GSTR-3B filed for this period; use the <a href="#filed-status">3B pill</a> to undo</td></tr>
</table></div>
<p>${ui('3B JSON')} says "No data to export for this period" when the period has no invoices and no expenses, even if it has purchase bills. In that case use ${ui('3B CSV')}, or type the credit in on the portal.</p>
</section>

<section id="gstr-2b">
<h2>Checking your credit against GSTR-2B</h2>
<p>GSTR-2B lists the invoices your suppliers reported. The <b>GSTR-2B Reconciliation</b> tab compares it with the <a href="purchases.html">purchase bills</a> you entered, so you claim only credit that is really there. (If the tab is missing, turn on <b>GSTR-2B matching</b> in <a href="settings.html#features">Settings, Features</a>.)</p>
<ol class="steps">
  <li><strong>Download GSTR-2B</strong>On the portal: <b>Returns</b>, <b>GSTR-2B</b>, pick the month, <b>Download JSON</b>. If it comes as a ZIP, extract it.</li>
  <li><strong>Pick the same period here</strong>Choose the same month at the top of GST Returns.</li>
  <li><strong>Import it</strong>Click ${ui('Import 2B JSON')} and choose the file. A message says "Imported GSTR-2B for <i>GSTIN</i> — N suppliers".</li>
  <li><strong>Read the results</strong>Each 2B entry is matched to your purchase bills by the supplier's GSTIN and invoice number. See <a href="#gstr-2b-results">Reading the results</a>.</li>
  <li><strong>Act on the differences</strong>Correct your bills, add missing ones, or ask suppliers to file.</li>
</ol>
<p>Before you import, the tab shows "Import your GSTR-2B JSON to reconcile against your purchase records." If you have no purchase bills at all, it warns that everything will show as "2B only".</p>
<p>The imported file is not kept: import it again after leaving the screen. Only the B2B invoices in GSTR-2B are compared (not its credit notes, imports or ISD entries), and only purchase bills, not expenses.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>"That doesn't look like a GSTR-2B JSON": you picked the Excel or PDF, or another return. See <a href="troubleshooting.html#gstr2b-wrong-file">the GSTR-2B file message</a>.</p></div>
</section>

<section id="gstr-2b-results">
<h3>Reading the GSTR-2B results</h3>
<p>After an import you see ${ui('Export reconciliation CSV')}, ${ui('Clear')} (removes the imported file), and "Imported for <i>GSTIN</i> · period <i>MMYYYY</i>". Check that period matches the one you picked.</p>
<p>The row of counts below works as a filter: click one to show only those rows, or <b>Total entries</b> to show all.</p>
<div class="table-wrap"><table>
  <tr><th>Status</th><th>Meaning</th><th>What to do</th></tr>
  <tr><td><b>✓ Matched</b></td><td>In both, and the invoice value and taxable value agree to within ₹1</td><td>Nothing. This credit is safe to claim.</td></tr>
  <tr><td><b>⚠ Amount mismatch</b></td><td>In both, but the amounts differ by more than ₹1</td><td>Compare with the paper bill. Correct your purchase entry, or ask the supplier to amend their GSTR-1.</td></tr>
  <tr><td><b>⚠ Books only</b></td><td>A purchase bill of this period that is not in GSTR-2B</td><td>The supplier may not have filed, or filed with a different number or GSTIN. Ask them. Usually you cannot claim it until it appears.</td></tr>
  <tr><td><b>⚠ 2B only</b></td><td>In GSTR-2B but not in your purchase bills</td><td>Enter the bill in <a href="purchases.html#add-purchase">Purchases</a> if it is yours. If you never bought it, tell the supplier.</td></tr>
</table></div>
<p>The table shows Status, Supplier (name and GSTIN), Invoice No., Date, <b>2B Value</b>, <b>Books Value</b>, <b>Diff</b> (2B minus books, in red when more than ₹1) and <b>ITC</b>: ✓ when GSTR-2B says the credit is available, ✗ when it is not (Books only rows always show ✗).</p>
<p>How matching works: invoice numbers are compared ignoring capitals, spaces, slashes and dashes, so <code>INV/12</code> matches <code>inv-12</code>. Your book value includes cess and any round-off on the bill. A bill entered in an earlier month still matches; only this period's bills can show as Books only.</p>
</section>

<section id="tds-tcs">
<h2>TDS and TCS report</h2>
<p>The <b>TDS / TCS Report</b> tab adds up the period's tax invoices and credit notes that have <a href="invoices.html#tds-tcs">TDS or TCS</a> on them. These are income-tax amounts, not GST. It has two cards.</p>
<p>The CSV files list every invoice with quarter, section, rate, client, GSTIN, PAN, taxable value and amount. They are for your CA to prepare Form 26Q and Form 27EQ from (filed through tin-nsdl.com); they are not the forms themselves.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p>A card says "No invoices with TDS in this period": no invoice in the period has TDS turned on. Turn it on in the invoice under ${ui('Customize')}, then TDS, and save. Check the <a href="#period">period</a> too: for a quarterly figure pick <b>Quarterly</b>.</p></div>
</section>

<section id="tds-receivable">
<h3>TDS Receivable (deducted by clients)</h3>
<p>Tax your clients should have deducted from what they pay you, under sections such as 194C, 194J or 194Q. You claim it against your own income tax, so check it shows in your Form 26AS / AIS.</p>
<ul>
  <li>Three figures: <b>Invoices with TDS</b>, <b>Taxable value</b>, <b>Total TDS receivable</b>.</li>
  <li>A table by <b>Quarter</b> (Q1 is April–June) and <b>Section</b>, with the number of invoices, taxable value and TDS. An invoice with no section chosen is counted under 194Q.</li>
  <li>${ui('Export TDS CSV')} saves <code>TDS_Receivable_Report.csv</code>. It is greyed out when there is nothing to export.</li>
</ul>
</section>

<section id="tcs-collected">
<h3>TCS Collected (from clients)</h3>
<p>Tax you collected from buyers on top of the invoice. You must deposit it with the Income Tax Department and report it in Form 27EQ every quarter.</p>
<ul>
  <li>Three figures: <b>Invoices with TCS</b>, <b>Taxable value</b>, <b>Total TCS collected</b>.</li>
  <li>A table by quarter and section. An invoice with no section chosen is counted under 206C(1H).</li>
  <li>${ui('Export TCS CSV')} saves <code>TCS_Collected_Report.csv</code>.</li>
</ul>
</section>

<section id="filing-guide">
<h2>The Filing Guide tab</h2>
<p>Step-by-step portal instructions inside the app. At the top a one-line reminder: review the GSTR-1 and 3B tabs, export the JSON, upload it, file GSTR-1 first and GSTR-3B after, with the usual due dates (GSTR-1 by the 11th, GSTR-3B by the 20th of the next month) and the late fee.</p>
<p>Three buttons switch what is shown:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it shows</th></tr>
  <tr><td>${ui('Regular Filing (With Sales)')}</td><td>GSTR-1 in 9 steps, GSTR-1 Pro Tips, GSTR-3B in 7 steps, GSTR-3B Pro Tips</td></tr>
  <tr><td>${ui('NIL Return (No Sales)')}</td><td>When a NIL return applies, and how to file NIL GSTR-1 and NIL GSTR-3B. See <a href="#nil-return">NIL returns</a>.</td></tr>
  <tr><td>${ui('Common Errors &amp; Fixes')}</td><td>Portal error messages and what to do, and key GST rules</td></tr>
</table></div>
<p>Click a step to open its details. Tick the circle at the left of a step as you finish it: it turns green and is struck through. The ticks are not saved.</p>
<p>Due dates, fees and rules in the guide are as the app knows them; the government changes them from time to time, so confirm on gst.gov.in or with your CA.</p>
</section>

<section id="guide-gstr1-steps">
<h3>GSTR-1 steps in the Filing Guide</h3>
<p>The card <b>GSTR-1 — Sales Return (File This First)</b> walks through the portal:</p>
<ol>
  <li>Log in to the GST portal.</li>
  <li>Select the return period, and choose Prepare Online or Prepare Offline.</li>
  <li>Table 4A, B2B invoices: what each portal field means.</li>
  <li>Table 5, B2C Large.</li>
  <li>Table 7, B2C (Others), entered as totals.</li>
  <li>Table 9B, credit and debit notes.</li>
  <li>Table 12, HSN summary, and how many digits your turnover needs.</li>
  <li>Table 13, documents issued.</li>
  <li>Preview, submit and file with DSC or EVC, and keep the ARN.</li>
</ol>
<p>If you upload the app's JSON, steps 3 to 8 are already filled in: just check them.</p>
</section>

<section id="guide-gstr3b-steps">
<h3>GSTR-3B steps in the Filing Guide</h3>
<p>The card <b>GSTR-3B — Summary Return + Tax Payment (File After GSTR-1)</b>: open GSTR-3B, check Table 3.1 and 3.2, claim credit in Table 4, Table 5 (exempt and non-GST purchases), Table 6 (paying the tax, and the order credit is used), then submit, pay and file. The last step lists what happens if you file late: a late fee per day, 18% a year interest on tax paid late, the next return blocked, and e-way bills blocked after two months.</p>
</section>

<section id="guide-pro-tips">
<h3>GSTR-1 and GSTR-3B Pro Tips</h3>
<p>Two green and blue boxes in Regular Filing with practical tips: the quickest way to upload GSTR-1 (the JSON), opting for quarterly filing (QRMP) under ₹5 crore, where amendments, exports and advances go, why to check GSTR-2B before claiming credit, the order credit is used, how to pay through a challan, how interest is worked out, and where reverse-charge tax goes.</p>
</section>

<section id="guide-errors">
<h3>Common GST Portal Errors &amp; How to Fix Them</h3>
<p>The card under ${ui('Common Errors &amp; Fixes')} lists the portal messages people meet most, each with the fix: Invalid GSTIN, invoice number already exists, place of supply mismatch, invoice date outside the return period, invalid HSN code, GSTR-3B blocked because GSTR-1 is not filed, credit more than GSTR-2B, previous period not filed, taxable value and tax mismatch, EVC or OTP problems, and challan amount not matching.</p>
<p>For messages from the app itself, see <a href="troubleshooting.html#gst-returns-problems">Troubleshooting, GST and returns</a>.</p>
</section>

<section id="guide-rules">
<h3>Key GST Rules to Remember</h3>
<p>A short list of the rules behind the returns: the time limit to claim credit (Section 16(4)), the time limit for credit notes (Section 34), when an invoice must be issued (Section 31), the order credit is used (Section 49), credit only as in GSTR-2B, interest on late payment (Section 50), how long notices can come (Sections 73 and 74, keep records at least 6 years), cancellation of GSTIN for not filing (Section 29(2)(c)), and e-way bills blocked for unfiled GSTR-3B.</p>
</section>

<section id="nil-return">
<h2>NIL returns</h2>
<p>If a period has no invoices, no purchase bills and no expenses, an amber banner says: "No invoices, purchase bills or expenses found — file a NIL return on the GST portal. NIL returns are mandatory."</p>
<p>A NIL return is only right when you had no sales, no credit to claim, no tax due and no reverse-charge purchases. A period with a purchase bill has credit to claim, so the banner does not appear: file a <em>regular</em> GSTR-3B for it. (A NIL GSTR-1 may still be right if you sold nothing.)</p>
<ol class="steps">
  <li><strong>Open the NIL guide</strong>On the Filing Guide tab, click ${ui('NIL Return (No Sales)')}. The box <b>When to File NIL Return</b> lists the conditions.</li>
  <li><strong>File NIL GSTR-1 first</strong>Follow <b>NIL GSTR-1 — File First (Even with Zero Sales)</b>: open GSTR-1, check every table is empty, and file.</li>
  <li><strong>Then NIL GSTR-3B</strong>Follow <b>NIL GSTR-3B — File After NIL GSTR-1</b>: check all values are zero, submit and file.</li>
  <li><strong>Or by SMS</strong>NIL returns can also be filed by SMS to <b>14409</b> from the authorised signatory's registered mobile. Send <code>NIL R1 &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for GSTR-1, <code>NIL 3B &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for GSTR-3B, or <code>NIL C8 &lt;GSTIN&gt; &lt;MMYYYY&gt;</code> for CMP-08, for example <code>NIL 3B 29ABCDE1234F1ZW 092026</code>. A quarterly return uses the quarter's last month. You get a code back: reply <code>CNF 3B &lt;code&gt;</code> (or CNF R1, CNF C8) within 30 minutes. The <b>NIL Return Quick Summary</b> box shows the same formats. Source: the GST portal's <a href="https://tutorial.gst.gov.in/userguide/returns/faq_nilreturngstr3b.htm" rel="noopener">SMS filing FAQs</a>.</li>
  <li><strong>Mark both filed</strong>Click the R1 and 3B pills at the top.</li>
</ol>
<p>File on time even with nothing to report: late fees still apply, and not filing for six months can get your GSTIN cancelled.</p>
</section>

<section id="e-invoice">
<h2>E-invoicing (IRN)</h2>
<p>A business whose yearly turnover (aggregate, all GSTINs on one PAN) has been above <strong>₹5 crore</strong> in any year since 2017-18 must register its B2B invoices on the e-invoice portal. The portal gives each invoice an <b>IRN</b> (Invoice Reference Number) and a signed QR code, and an invoice without them is not valid. Below ₹5 crore you do not need any of this.</p>
<p>The app stays offline: it makes the file, you upload it, and you bring the IRN back. Turn on <b>E-invoicing (IRN)</b> in <a href="settings.html#features">Settings, Features</a> first; it is off to start.</p>
<ol class="steps">
  <li><strong>Download the e-invoice JSON</strong>For one invoice: open it, click ${ui('E-invoice')} in the toolbar, then ${ui('Download e-invoice JSON')}. For several: tick them on the <a href="dashboard.html#bulk">Dashboard</a> and click ${ui('E-invoice JSON')} in the bar that appears. Save the invoice first, so its number is final.</li>
  <li><strong>Upload it on the portal</strong>Log in at einvoice1.gst.gov.in, go to <b>e-Invoice</b>, <b>Bulk Upload</b>, choose the file and upload it. The portal returns the IRN, Ack No, Ack Date and Signed QR Code for each invoice; download that result as JSON.</li>
  <li><strong>Bring the IRN back</strong>On the Dashboard, click ${ui('Import IRN')} and choose that JSON file. Each IRN is saved on the invoice with the same number, date and GSTIN. Or open one invoice, click ${ui('E-invoice')}, paste the four values and click ${ui('Save IRN')}.</li>
</ol>
<p>From then on every design, A4 to thermal, prints <b>IRN</b>, <b>Ack No</b>, <b>Ack Date</b> and the QR code at the top of the invoice. The Dashboard marks such invoices <b>IRN</b>. Importing the IRN changes nothing else on the invoice.</p>
<p><strong>What goes in the file:</strong> tax invoices and credit notes to clients with a GSTIN, SEZ units and clients abroad (exports), in rupees. A credit note names its original invoice when that number is in the app. The amounts are the ones printed on the invoice, to the paisa. TCS goes in as other charges; a discount on the whole bill goes in as the invoice discount.</p>
<p><strong>What is checked first.</strong> Invoices with a problem are left out of the file and listed with what to fix:</p>
<ul>
  <li>a client with no GSTIN (a sale to a consumer needs no e-invoice), or a GSTIN that looks mistyped;</li>
  <li>a missing PIN code, city, address or state, yours or the client's (yours are in <a href="settings.html#company-details">Settings, Company Details</a>);</li>
  <li>an item with no HSN/SAC code, or one that is not 4, 6 or 8 digits; an item name shorter than 3 letters; a GST rate the portal does not accept;</li>
  <li>an invoice number longer than 16 characters, with anything other than letters, digits, <code>/</code> and <code>-</code>, or starting with 0, <code>/</code> or <code>-</code>;</li>
  <li>a date in the future, a cancelled invoice, an invoice in another currency, an invoice that charges no GST, or one that already has an IRN.</li>
</ul>
<div class="note warn"><strong>Changing an invoice after its IRN</strong>
<p>The portal does not take changes to a registered invoice. Cancel it on the portal within 24 hours and make a new one, or issue a credit note. The app warns you when you open an invoice that has an IRN.</p></div>
<p>Businesses with turnover of ₹10 crore or more must report an invoice within 30 days of its date, or the portal refuses it.</p>
</section>

<section id="e-invoice-dialog">
<h3>The E-invoice (IRN) window</h3>
<p>Opens from ${ui('E-invoice')} in the invoice toolbar (only while E-invoicing is on, and for tax invoices and credit notes). At the top it repeats the three steps: download, upload on einvoice1.gst.gov.in (e-Invoice → Bulk Upload), paste the reply.</p>
<p>Below that, one notice tells you where you stand:</p>
<div class="table-wrap"><table>
  <tr><th>Notice</th><th>Meaning</th></tr>
  <tr><td>"Save the invoice first, so its number is final."</td><td>The invoice is new or unsaved. Save it, then open this window again. The download and ${ui('Save IRN')} stay greyed out until then.</td></tr>
  <tr><td>"<b>Fix these first:</b>" and a list</td><td>Problems the portal would reject, such as a missing PIN code or HSN code. Fix each one on the invoice or in Settings, save, and reopen. ${ui('Download e-invoice JSON')} is greyed out until the list is empty.</td></tr>
  <tr><td>"This invoice has its IRN…"</td><td>The IRN is saved and prints on the invoice.</td></tr>
</table></div>
<div class="table-wrap"><table>
  <tr><th>Field or button</th><th>What to know</th></tr>
  <tr><td>${ui('Download e-invoice JSON')}</td><td>Saves <code>EINV-<i>invoice number</i>.json</code> (slashes become dashes) for upload on the portal</td></tr>
  <tr><td><b>IRN</b></td><td>64 letters and digits (0-9, a-f), from the portal's reply</td></tr>
  <tr><td><b>Ack No</b></td><td>The acknowledgement number, 10 to 20 digits</td></tr>
  <tr><td><b>Ack Date</b></td><td>As the portal shows it</td></tr>
  <tr><td><b>Signed QR Code</b></td><td>The long text that starts with <code>eyJ</code>. Copy all of it: it has three parts separated by dots, and it must be for the same IRN.</td></tr>
  <tr><td>${ui('Save IRN')}</td><td>Checks the four values and saves them on the invoice. "IRN saved. It now prints on the invoice." confirms it. A mistake is listed in red under the fields.</td></tr>
  <tr><td>${ui('Remove IRN')}</td><td>Only when an IRN is saved. Takes it off the invoice (for example, after you cancelled the e-invoice on the portal).</td></tr>
  <tr><td>${ui('Close')}</td><td>Closes without saving</td></tr>
</table></div>
<div class="note tip"><strong>Something wrong?</strong>
<p>"The Signed QR Code is not complete": part of it was missed when copying. Copy it again from the first character to the last. "The Signed QR Code is for a different IRN": the IRN and QR code came from two different invoices.</p></div>
</section>

<section id="e-invoice-report">
<h3>E-invoice results: invoices left out, IRNs not saved</h3>
<p>After ${ui('E-invoice JSON')} or ${ui('Import IRN')} on the Dashboard, a window lists any invoice that was not handled, each with the reason. Its title tells you what happened:</p>
<div class="table-wrap"><table>
  <tr><th>Title</th><th>Meaning</th></tr>
  <tr><td>"N invoices were left out"</td><td>The file was made, but without these. Fix each one, then export them again.</td></tr>
  <tr><td>"Nothing was exported"</td><td>None of the ticked invoices could go in the file. The reasons are listed.</td></tr>
  <tr><td>"IRN saved on N invoices; M not saved"</td><td>Some IRNs from the portal's file were saved, the rest were not</td></tr>
  <tr><td>"No IRN was saved"</td><td>None of the IRNs in the file matched an invoice</td></tr>
</table></div>
<p>Usual reasons an IRN is not saved:</p>
<ul>
  <li>"No invoice … for this business was found": the number or date differs, or a different business is selected in the sidebar.</li>
  <li>"More than one invoice … was found": paste the IRN into the right invoice by hand.</li>
  <li>"The file does not say which invoice this IRN is for": paste it by hand.</li>
  <li>"Already saved on this invoice", or "This invoice already has a different IRN. It was not changed."</li>
</ul>
<p>Click ${ui('OK')} to close. If the whole file is refused with "No IRN was found in that file", you chose the wrong file: pick the JSON the e-invoice portal gave back after upload.</p>
</section>
`,
},
];
