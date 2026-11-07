const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

export default [
// =============================================================================
{
  slug: 'products',
  title: 'Products and stock',
  nav: 'Products and stock',
  lead: 'Save what you sell once, then pick it on every invoice. Stock goes down as you sell and up as you buy.',
  body: `
<section id="product-list">
<h2>The product list</h2>
<p>${ui('Products')} in the sidebar opens your catalogue: the goods and services you sell or buy, with their prices, GST rate and stock. Save an item here once, and on every invoice you just type a few letters of its name to fill in the HSN, rate, unit and GST.</p>
<figure><img src="${img('app-products.png')}" alt="The product list. Low stock shows in amber, none in red." loading="lazy"><figcaption>The product list. Low stock shows in amber, none in red.</figcaption></figure>
<p>The buttons at the top of the screen:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Import CSV')}</td><td>Adds many products at once from a spreadsheet. See <a href="#import">Importing products</a>.</td></tr>
  <tr><td>${ui('Bulk edit')}</td><td>Turns the list into a grid you can type in, to change many products at once. See <a href="#bulk-edit">Bulk edit</a>. Greyed out until you have a product.</td></tr>
  <tr><td>${ui('Make')}</td><td>Only when manufacturing is turned on: records goods you made from raw materials. See <a href="#manufacturing">Manufacturing</a>.</td></tr>
  <tr><td>${ui('Add Product')}</td><td>Opens the product form. See <a href="#add-product">Adding a product or service</a>.</td></tr>
</table></div>
<p><b>Search by name or HSN...</b> narrows the list as you type. The cross clears it.</p>
<p><b>Deleting many products at once:</b> tick the box at the start of each row (the box in the header ticks every product the list shows), then click ${ui('Delete selected')} and confirm. Only ticked products the list shows are deleted; invoices that used them keep their lines. ${ui('Clear')} unticks them all.</p>
<p>The <b>Products &amp; Services</b> table:</p>
<div class="table-wrap"><table>
  <tr><th>Column</th><th>Shows</th></tr>
  <tr><td>Name</td><td>The product name. Point at it to see its description. A product made from raw materials also shows <b>Made here · cost ₹… per unit</b> under its name.</td></tr>
  <tr><td>HSN/SAC</td><td>Its HSN or SAC code, or a dash.</td></tr>
  <tr><td>Rate</td><td>The selling price.</td></tr>
  <tr><td>GST %</td><td>The GST rate.</td></tr>
  <tr><td>Unit</td><td>Pcs, Kg, Hrs and so on.</td></tr>
  <tr><td>Stock</td><td>How many you have. <b>Out of Stock</b> in red at zero or below; the number in amber when it is at or below your <a href="#low-stock">low-stock threshold</a>. <b>Service</b> for a <a href="#goods-or-service">service</a>, which has no stock, and a dash (-) for goods whose stock was never entered: neither is ever out of stock.</td></tr>
  <tr><td>Actions</td><td>The pencil (<b>Edit</b>) opens the product form; the bin (<b>Delete</b>) deletes it after asking.</td></tr>
</table></div>
<p>Products are shared by all your businesses, so each business sees the same list and the same stock.</p>
</section>

<section id="product-export">
<h3>Printing or exporting the list</h3>
<p>${ui('Print / PDF')}, ${ui('Excel')} and ${ui('CSV')} beside the table title save the products shown, with name, type (Goods or Service), HSN/SAC, purchase price, selling price, GST %, unit and stock. Search first to save only some. ${ui('Print / PDF')} opens the print window, where you can choose a printer or <b>Save as PDF</b>. The buttons are hidden during a bulk edit.</p>
<p>A CSV saved here can be opened in Excel, and is a handy way to send your price list to an accountant. It can also be brought back in with ${ui('Import CSV')}, or into another copy of the app.</p>
</section>

<section id="product-delete">
<h3>Deleting a product</h3>
<p>The bin asks <b>Delete this product?</b> first. Deleting removes it from your catalogue only: invoices and purchase bills that used it keep their lines unchanged. If it is a raw material of a product made here, the message names those products: remove it from their raw materials list too.</p>
<p>A product deleted here is not in the Trash; to get it back, add it again.</p>
</section>

<section id="add-product">
<h2>Adding a product or service</h2>
<ol class="steps">
  <li><strong>Open the form</strong>Click ${ui('Add Product')}. To change a product, click its pencil instead; the form opens as <b>Edit Product</b>.</li>
  <li><strong>Name it</strong>Type the name as you want it printed on the invoice, such as "A4 Paper Ream 75 GSM" or "Website Maintenance".</li>
  <li><strong>Goods or service</strong>Under <b>This is a</b>, leave <b>Goods (stock counted)</b> for things you keep on a shelf, or click <b>Service (no stock)</b> for work you do, such as printing, repairs or consulting. See <a href="#goods-or-service">Goods or service</a>.</li>
  <li><strong>Codes and prices</strong>Fill in the HSN or SAC code, the purchase price, the selling price and the GST %.</li>
  <li><strong>Unit and stock</strong>Choose the unit and, for goods, type how many you have today. A service has no stock box.</li>
  <li><strong>Save</strong>Click ${ui('Save')} (or ${ui('Update')} when editing). You see "Product added" or "Product updated", and it appears in the list.</li>
</ol>
<p>${ui('Cancel')} closes the form without saving. So does clicking outside it, so finish and save before you click elsewhere.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Product / Service Name *</td><td>Required. Two products should not share a name: invoices, purchase bills and imports find products by name.</td></tr>
  <tr><td>This is a</td><td><b>Goods (stock counted)</b> (to start) or <b>Service (no stock)</b>. See <a href="#goods-or-service">Goods or service</a>.</td></tr>
  <tr><td>HSN / SAC Code</td><td>HSN for goods, SAC for services. For a service the box is labelled <b>SAC Code</b>. See <a href="#product-hsn">HSN and SAC codes</a>.</td></tr>
  <tr><td>Purchase Price</td><td>What you pay the supplier for one unit. Filled in on new purchase bills, used to value your stock and to cost things you make.</td></tr>
  <tr><td>Selling Price</td><td>What you charge for one unit. Filled in on new invoices, and shown as the <b>Rate</b> in the list. Type it the same way your invoices work: before GST, unless you make <a href="invoices.html#tax-inclusive">tax-inclusive</a> invoices.</td></tr>
  <tr><td>GST %</td><td>The GST rate, such as 5 or 18. 0 to 100; blank counts as 0. Since 22 September 2025 most goods are at 5%, 18% or 40%.</td></tr>
  <tr><td>Unit</td><td>Pcs to start. Pcs, Nos, Kg, g, Tonne, Ltr, ml, Mtr, cm, Ft, In, Sq.ft, Sq.m, Hrs, Day, Week, Month, Year, Visit, Session, Project, Word, Page, Box, Dozen, Pair, Set, Bag, Roll, Bottle, and your own <a href="invoices.html#items">custom units</a>, marked ★.</td></tr>
  <tr><td>Stock Quantity</td><td>Goods only. How many you have now. After this, sales and purchases change it for you; see <a href="#stock">How stock is counted</a>. Left blank, the stock is <b>not counted</b>: the list shows a dash, never <b>Out of Stock</b>, until you type a number, buy it on a purchase bill or sell it.</td></tr>
  <tr><td>Description (optional)</td><td>For your own reference. It shows when you point at the name in the list.</td></tr>
  <tr><td>Made here (from raw materials)</td><td>Only when manufacturing is turned on. See <a href="#bill-of-materials">Bill of materials</a>.</td></tr>
</table></div>
<p>Changing a product's price or GST % does not change invoices already made. New invoices use the new figures.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"Product name is required": fill in the name. "GST % must be between 0 and 100": type just the number, such as 18, not 18% or 0.18.</p><p>A service shows <b>Out of Stock</b> in red: it was saved as Goods (all products made before version 1.10.83 are). Click its pencil, choose <b>Service (no stock)</b> and click ${ui('Update')}.</p></div>
</section>

<section id="goods-or-service">
<h3>Goods or service</h3>
<p>Every product is either <b>Goods</b>, things you buy, keep and sell, whose stock is counted, or a <b>Service</b>, work you do, such as printing, repairs, design, consulting or transport, which has no stock.</p>
<div class="table-wrap"><table>
  <tr><th></th><th>Goods (stock counted)</th><th>Service (no stock)</th></tr>
  <tr><td>Stock box in the form</td><td>Yes</td><td>No</td></tr>
  <tr><td>Selling it on an invoice</td><td>Takes the quantity out of stock</td><td>Moves no stock, and never says "out of stock"</td></tr>
  <tr><td>Buying it on a purchase bill</td><td>Adds the quantity to stock</td><td>Moves no stock</td></tr>
  <tr><td>Low-stock alerts, the bell, the Dashboard low-stock strip, the stock report</td><td>Included</td><td>Never included</td></tr>
  <tr><td>Manufacturing</td><td>Can be a raw material or be made here</td><td>Neither</td></tr>
  <tr><td>Code box</td><td>HSN / SAC Code</td><td>SAC Code</td></tr>
  <tr><td>Unit list</td><td>Every unit</td><td>Service units first (Hrs, Day, Month, Project, Nos, Page...). A new service starts on Hrs; change it to whatever you bill by.</td></tr>
  <tr><td>Stock column in the list</td><td>The count, or <b>Out of Stock</b></td><td><b>Service</b></td></tr>
</table></div>
<p><b>Products you already have</b> stay Goods. To switch one, click its pencil, choose <b>Service (no stock)</b> and click ${ui('Update')}; any stock it had is dropped. To switch back, choose <b>Goods</b> and type its stock.</p>
<p>On an invoice, picking a service from your products fills in that line's SAC, unit, rate and GST; other lines are not touched. For a service billed as one fixed fee, with no quantity on the invoice, see <a href="invoices.html#goods-services">Goods, services or both</a>.</p>
<p>When importing products from a spreadsheet, a <code>Type</code> column with <code>Service</code> makes the row a service. See <a href="#import">Importing products</a>.</p>
</section>

<section id="product-hsn">
<h3>HSN and SAC codes</h3>
<p><b>HSN</b> (Harmonised System of Nomenclature) codes classify goods, such as 4802 for paper or 8471 for computers. <b>SAC</b> (Services Accounting Code) codes classify services and start with 99, such as 998314 for IT services. The code decides the GST rate and is reported in your GSTR-1, in the HSN summary.</p>
<ul>
  <li>Businesses with a turnover up to ₹5 crore must show at least a <strong>4-digit</strong> HSN on invoices to registered buyers; above ₹5 crore, <strong>6 digits</strong> on every invoice.</li>
  <li>Find your code on your supplier's bill, from your accountant, or with the HSN search on the GST portal.</li>
  <li>On the invoice, the app knows the usual GST rate of common codes and shows it under the HSN box. See <a href="invoices.html#items">Line items</a>.</li>
</ul>
<p>See also the <a href="glossary.html#terms">glossary</a>.</p>
</section>

<section id="bulk-edit">
<h2>Bulk edit: changing many products at once</h2>
<p>Use it when prices go up across the board, after a GST rate change, or to correct stock after counting your shelves. ${ui('Bulk edit')} turns the table into a grid of boxes: <b>Name</b>, <b>HSN/SAC</b>, <b>Purchase price</b>, <b>Selling price</b>, <b>GST %</b>, <b>Unit</b> and <b>Stock</b>.</p>
<ol class="steps">
  <li><strong>Narrow the list (optional)</strong>Search first, for example by an HSN code, to edit only those products. The search box is locked while you edit.</li>
  <li><strong>Start</strong>Click ${ui('Bulk edit')}.</li>
  <li><strong>Type the changes</strong>Change any boxes, in any rows. Each changed row turns blue, and the bar at the top counts them: "3 products changed".</li>
  <li><strong>Save once</strong>Click ${ui('Save changes (3)')}. You see "3 products updated" and the normal list comes back.</li>
</ol>
<p>${ui('Cancel')} drops every change. Only the boxes you changed are saved: if an invoice in another window sold some stock meanwhile, that is not undone (unless you changed that product's stock yourself).</p>
<p>The same rules as the product form apply: every product needs a name, GST % must be 0 to 100, and prices and stock must be numbers. If one row breaks a rule, <strong>nothing</strong> is saved and you are told which product to fix, such as "Not saved: Tea: GST % must be 0 to 100". ${ui('Make')} and the export buttons wait until you save or cancel.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"2 saved, 1 failed. Try again.": the app could not reach its data for one product. Click ${ui('Bulk edit')} again, check the product, and save it again.</p></div>
</section>

<section id="stock">
<h2>How stock is counted</h2>
<p>Stock is counted for a line only when it is linked to a product: picked from your products on the invoice or bill, not just typed in.</p>
<ul>
  <li><strong>Selling</strong>: saving a Tax Invoice, Bill of Supply, Composition bill or Delivery Challan takes the quantity out. Change the quantity later and save, and only the difference moves.</li>
  <li><strong>Returns</strong>: a Credit Note puts the quantity back.</li>
  <li><strong>Quotations and proformas</strong> move no stock. The invoice you convert them into does.</li>
  <li><strong>Buying</strong>: saving a <a href="purchases.html#stock">purchase bill</a> adds the quantity in, and adds any new item to your products.</li>
  <li><strong>Cancelling</strong> an invoice puts its stock back; un-cancelling takes it out again. Deleting an invoice puts its stock back too.</li>
  <li><strong>Making</strong>: a <a href="#make-production">production entry</a> uses up raw materials and adds the finished product.</li>
</ul>
<p><b>Out of Stock</b> shows in red at zero or below. Purchases and deletions never take stock below zero; selling more than you have does, so you notice.</p>
<p>A <a href="#goods-or-service">service</a> is never counted. Goods whose stock box was left blank are not counted either until stock first moves: a purchase bill adds to them from zero, and a sale takes them below zero, so you notice.</p>
<p>The <a href="reports.html#stock">stock report</a> shows each product's stock and value on any date.</p>
</section>

<section id="stock-adjust">
<h3>Correcting stock by hand</h3>
<p>There is no separate stock adjustment screen. After counting your shelves, or for breakage, a free sample or opening stock:</p>
<ol class="steps">
  <li><strong>One product</strong>Click its pencil, type the real count in <b>Stock Quantity</b>, and click ${ui('Update')}.</li>
  <li><strong>Many products</strong>Click ${ui('Bulk edit')}, type the counts in the <b>Stock</b> column, and click ${ui('Save changes')}.</li>
</ol>
<p>Stock typed in by hand has no date, so the stock report counts it as if it changed today. Write the reason in the product's description if you want to remember it.</p>
<div class="note info"><p>Stock is one count per product. There are no batches, expiry dates, serial numbers or godowns. See <a href="limitations.html#stock-limits">Limitations</a>.</p></div>
</section>

<section id="low-stock">
<h2>Low-stock alerts</h2>
<p>A product at or below your threshold shows its stock in amber here, is listed on the <a href="dashboard.html#low-stock">Dashboard</a>, and adds to the notification bell. The threshold is 5 to start; change it, or turn alerts off, in <a href="settings.html#stock">Settings</a>. It is one threshold for every product. With alerts off, stock is still counted and <b>Out of Stock</b> still shows in red.</p>
</section>

<section id="import">
<h2>Importing products from a spreadsheet</h2>
<p>Have your price list in Excel, or moving from another program? ${ui('Import CSV')} adds all the products and services at once.</p>
<ol class="steps">
  <li><strong>Open the window</strong>Click ${ui('Import CSV')} on the Products screen. The window <b>Import products</b> opens.</li>
  <li><strong>Get the sample file</strong>Click ${ui('Download sample file')}. <code>Products-sample.csv</code> lands in your Downloads folder, with the right column headings and two demo rows: a product (Goods) and a service.</li>
  <li><strong>Fill it in</strong>Open it in Excel or Google Sheets. Replace the two demo rows with your own, one product or service per row. Keep the first row (the headings) as it is.</li>
  <li><strong>Save as CSV</strong>In Excel, <b>File → Save As → CSV UTF-8 (Comma delimited)</b> or <b>CSV (Comma delimited)</b>. In Google Sheets, <b>File → Download → Comma-separated values</b>.</li>
  <li><strong>Choose the file</strong>Click ${ui('Choose file')}. Nothing is saved yet: the window shows how many are new, how many saved products will get their empty details filled in, how many are already in your list (skipped), and every row with a problem.</li>
  <li><strong>Import</strong>Click ${ui('Import')} (it shows the number, such as <b>Import 40</b>). You see "Imported 40 products", and they appear in the list.</li>
</ol>
<p><b>From Excel or Vyapar:</b> you can choose an Excel file (<code>.xlsx</code>) instead of a CSV, such as the item list Vyapar exports. If the file has several sheets, pick the one with your items under <b>Sheet</b>.</p>
<p><b>From Tally:</b> in Tally, go to <b>Gateway of Tally → Export → Masters</b>, choose format <b>XML</b> and export. Choose that <code>.xml</code> file here. Your stock items come in with their HSN, GST rate, unit and price. Stock is not brought in: enter today's stock after the import.</p>
<p><b>Importing again fills in blanks.</b> A product already in your list is never added twice. If it has empty details (no HSN, no price, 0% GST with no HSN, no unit or stock), they are filled in from the file. A detail that already has a value is never changed.</p>
<p>The columns (headings in small or capital letters, in any order; spaces and % do not matter):</p>
<div class="table-wrap"><table>
  <tr><th>Column heading</th><th>Holds</th></tr>
  <tr><td><code>Name</code> (or <code>Product</code>, <code>Product Name</code>, <code>Item</code>)</td><td>Required. Rows without a name are skipped.</td></tr>
  <tr><td><code>Type</code></td><td><code>Goods</code> or <code>Service</code>. Blank means Goods. A service gets no stock. See <a href="#goods-or-service">Goods or service</a>.</td></tr>
  <tr><td><code>HSN/SAC</code> (or <code>HSN</code>, <code>SAC</code>, <code>HSN Code</code>)</td><td>HSN or SAC code</td></tr>
  <tr><td><code>Unit</code></td><td>Nos if left out. Write it as in the app's list (Kg, Ltr, Pcs, Hrs, Page), so the GST returns get the right unit code.</td></tr>
  <tr><td><code>Purchase Price</code> (or <code>Cost</code>)</td><td>What you pay for one unit</td></tr>
  <tr><td><code>Selling Price</code> (or <code>Rate</code>, <code>Price</code>)</td><td>What you charge for one unit</td></tr>
  <tr><td><code>GST %</code> (or <code>GST Rate</code>, <code>Tax %</code>)</td><td>GST rate, such as 18. 0 to 100.</td></tr>
  <tr><td><code>Stock</code> (or <code>Quantity</code>, <code>Opening Stock</code>)</td><td>Opening stock of goods. Leave it blank for a service, or for goods you do not count.</td></tr>
  <tr><td><code>Description</code></td><td>Optional</td></tr>
</table></div>
<p>The sample file looks like this:</p>
<pre><code>Name,Type,HSN/SAC,Unit,Purchase Price,Selling Price,GST %,Stock,Description
Demo A4 Paper Ream 75 GSM,Goods,4802,Nos,220,280,18,50,Sample goods row - replace with your own
Demo Printing service,Service,998912,Page,,5,18,,Sample service row - a service has no stock</code></pre>
<p>Products you already have (same name, any capitals) are skipped, and so are repeats inside the file, so importing the same file twice is safe. The CSV saved by the ${ui('CSV')} button above the list uses the same columns, so you can export, edit in Excel and import into another copy of the app.</p>
<div class="note info"><p><b>Old invoices</b> are imported somewhere else: on the Dashboard, with ${ui('CSV import / export')}, which has its own template. See <a href="dashboard.html#csv">Importing and exporting invoices as CSV</a>. The link at the bottom of the import window goes there too.</p></div>
<div class="note tip"><strong>Something wrong?</strong><p>A row is listed as a problem, such as "Row 4 (Tea): GST % must be 0 to 100" or "Type must be Goods or Service": fix that row in the file and choose it again (the rows already imported are skipped). Nothing is read: the file is not a plain CSV, or the headings are not in the first row. An <code>.xlsx</code> file renamed to <code>.csv</code> does not work. See <a href="troubleshooting.html#csv-import">A CSV import did not work</a>.</p></div>
</section>

<section id="manufacturing">
<h2>Manufacturing: making products from raw materials</h2>
<p>If you make what you sell (furniture, sweets, garments, printed boxes), the app can use up the raw materials and add the finished product to stock in one step, and tell you what each unit costs you to make.</p>
<p>Turn it on first: <a href="settings.html#features">Settings → Features</a>, tick ${ui('Manufacturing (bill of materials)')} and save. It is off to start, and turning it off again hides it without deleting anything. Once on, you get:</p>
<ul>
  <li>a <b>Made here (from raw materials)</b> tick in the product form, for its <a href="#bill-of-materials">bill of materials</a>;</li>
  <li>a ${ui('Make')} button at the top of Products, to <a href="#make-production">record production</a>;</li>
  <li>a <a href="#production-list">Production</a> list under the product table.</li>
</ul>
</section>

<section id="bill-of-materials">
<h3>1. Give the product its raw materials (bill of materials)</h3>
<p>A <b>bill of materials</b> is the recipe: which raw materials, and how much of each, go into <strong>one</strong> unit of the finished product.</p>
<ol class="steps">
  <li><strong>Add the raw materials</strong>Add each raw material as a normal product, with its purchase price and stock (or buy it in on a purchase bill).</li>
  <li><strong>Open the finished product</strong>Click its pencil (or ${ui('Add Product')} for a new one).</li>
  <li><strong>Tick Made here</strong>Tick ${ui('Made here (from raw materials)')}. A box opens: <b>Raw materials used to make 1 unit of this product</b>.</li>
  <li><strong>List the materials</strong>On each line, choose the material under <b>Choose a product…</b> and type the quantity for one unit made; its unit shows beside the box. ${ui('Add material')} adds a line; the cross removes one.</li>
  <li><strong>Check the cost</strong><b>Cost per unit</b> shows the materials' purchase prices times those quantities.</li>
  <li><strong>Save</strong>Click ${ui('Update')} (or ${ui('Save')}). The list now shows <b>Made here · cost</b> under the name.</li>
</ol>
<p>Rules, checked when you save: at least one material; a product chosen on every line; every quantity more than 0; no product listed twice (add the quantities together on one line); a product cannot be in its own list; and two products cannot use each other (chair uses seat, seat uses chair). The message says which, and nothing is saved.</p>
<p>A raw material can itself be made here (a seat made from wood and foam). If it has no purchase price, its cost comes from its own raw materials.</p>
<p>Unticking <b>Made here</b> and saving stops the product being made; production already recorded stays.</p>
</section>

<section id="make-production">
<h3>2. Make: record what you made</h3>
<p>Each time a batch is finished, record it so stock stays right.</p>
<ol class="steps">
  <li><strong>Open Make</strong>Click ${ui('Make')} at the top of Products. The window is <b>Make (record production)</b>.</li>
  <li><strong>Product made</strong>Choose the product. Only products with a raw materials list are offered.</li>
  <li><strong>Quantity made</strong>How many you made, in the product's unit.</li>
  <li><strong>Date</strong>Today to start. Change it if you are recording a batch made earlier.</li>
  <li><strong>Note (optional)</strong>Anything to remember, such as "Batch 12".</li>
  <li><strong>Check the table</strong>Each raw material shows <b>Per unit</b>, <b>Will use</b>, <b>In stock</b> and <b>Left after</b>; the last row is the finished product with its stock after. Below it, <b>Cost of materials</b> for this batch, at today's purchase prices.</li>
  <li><strong>Save</strong>Click ${ui('Save production')}. You see "Production saved: 10 Nos of Chair", the stock changes, and the entry is added to the Production list.</li>
</ol>
<p>If a raw material would go below zero, it is shown in red with a warning, and saving asks <b>Not enough raw materials in stock</b>; ${ui('Save anyway')} goes ahead. That is fine when you record production late and have not entered the purchase bill yet.</p>
<div class="note tip"><strong>Something wrong?</strong><p><b>No product has a raw materials list yet.</b>: give a product its <a href="#bill-of-materials">raw materials</a> first.</p><p>"Quantity made must be more than 0" or "Enter the date it was made": fill in those boxes. A message naming a product and a raw material means its list has a problem; open that product and fix the list.</p><p>"Could not save production, nothing was changed.": try again; if it keeps happening, see <a href="troubleshooting.html#saving">Saving and working in the app</a>.</p></div>
</section>

<section id="mfg-example">
<h3>Worked example</h3>
<p>DiceCodes makes chairs. One chair takes 4 chair legs (₹50 each), 1 seat (₹300) and 0.2 kg screws (₹400 a kg), so the cost per unit is 4 × 50 + 300 + 0.2 × 400 = <b>₹580</b>. Stock before: 100 legs, 20 seats, 5 kg screws, 3 chairs.</p>
<div class="table-wrap"><table>
  <tr><th>Make 10 chairs</th><th>Used</th><th>Stock after</th></tr>
  <tr><td>Chair leg</td><td>40</td><td>60</td></tr>
  <tr><td>Seat</td><td>10</td><td>10</td></tr>
  <tr><td>Screws</td><td>2 kg</td><td>3 kg</td></tr>
  <tr><td>Chair (made)</td><td>+10</td><td>13</td></tr>
</table></div>
<p>The entry's cost of materials is 10 × ₹580 = ₹5,800.</p>
</section>

<section id="production-list">
<h3>3. The production list</h3>
<p>Under the product table, <b>Production</b> lists the entries of the business you have open, newest first: <b>Date</b>, <b>Product</b>, <b>Qty made</b>, <b>Cost of materials</b> and <b>Note</b>.</p>
<div class="table-wrap"><table>
  <tr><th>Control</th><th>What it does</th></tr>
  <tr><td>${ui('From')} / ${ui('To')}</td><td>Show only entries between these dates. Leave blank for all.</td></tr>
  <tr><td>${ui('Print / PDF')}, ${ui('Excel')}, ${ui('CSV')}</td><td>Save the entries shown.</td></tr>
  <tr><td>Eye (<b>View</b>)</td><td>Opens the entry: see <a href="#production-entry">below</a>.</td></tr>
  <tr><td>Bin (<b>Delete</b>)</td><td>Deletes the entry after asking, and puts its stock back exactly: in the example, 40 legs, 10 seats and 2 kg screws back, 10 chairs out.</td></tr>
</table></div>
<p>An entry cannot be edited: to change one, delete it and enter it again. The <a href="reports.html#stock">stock report</a> counts production by its date.</p>
</section>

<section id="production-entry">
<h3>Viewing a production entry</h3>
<p>The eye opens <b>Made 10 Nos of Chair</b> (the quantity and product), with its date and note, and a table of each <b>Raw material used</b> with its <b>Qty</b>, <b>Rate</b> and <b>Cost</b>, and the <b>Total cost of materials</b>. The rates are the purchase prices on the day it was saved, so changing a price later does not change old entries. ${ui('Delete')} deletes it as above; ${ui('Close')} closes it.</p>
</section>
`,
},
];
