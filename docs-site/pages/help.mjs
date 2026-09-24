import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;

export default [
// =============================================================================
{
  slug: 'shortcuts',
  title: 'Getting around the app',
  nav: 'Getting around',
  lead: 'The sidebar, switching business, notifications, quick search with Ctrl + K, keyboard shortcuts and dark mode.',
  body: `
<section id="sidebar">
<h2>The sidebar</h2>
<p>From top to bottom:</p>
<ul>
  <li><strong>Your business</strong>, with a pencil to edit it. If you have more than one, click the name to <a href="#switch-business">switch</a>.</li>
  <li><strong>The screens</strong>: Dashboard, New Invoice, Clients, Products, Expenses, Purchases, Recurring, Receipts, Reports, GST Returns, Income Tax and User Guide. Features you <a href="settings.html#modules">turn off</a> disappear from here.</li>
  <li><strong>Update to v…</strong>, when a new version is out.</li>
  <li><strong>Notifications</strong>, <strong>Dark Mode</strong> or <strong>Light Mode</strong>, <strong>Control Panel</strong> and <strong>Settings</strong>.</li>
  <li>At the bottom, <b>App Ready</b> when all is well.</li>
</ul>
<p>On a narrow screen, the sidebar folds away behind the ☰ menu button.</p>
</section>

<section id="switch-business">
<h2>Switching business</h2>
<p>With more than one business saved, click its name at the top of the sidebar and choose another. Every screen changes to that business's invoices, purchases, expenses, receipts, recurring invoices, reports and returns. <b>Manage profiles…</b> opens <a href="settings.html#multiple-businesses">Settings</a>.</p>
</section>

<section id="notifications">
<h2>Notifications</h2>
<p>The bell shows a count of things that need you. Clicking it lists them, and clicking one takes you there:</p>
<ul>
  <li>🔁 recurring invoices created today</li>
  <li>⚠ overdue invoices</li>
  <li>⏰ invoices due in the next 3 days</li>
  <li>📋 GST, TDS, TCS, advance tax and ITR dates in the next 10 days</li>
  <li>📦 products low on stock</li>
</ul>
<p>${ui('Mark all as read')} clears the list. Anything new brings it back. The bell counts all your businesses together.</p>
</section>

<section id="command-palette">
<h2>Quick search: Ctrl + K</h2>
<p>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> anywhere, even while typing, and start typing. You can:</p>
<ul>
  <li>go to any screen, or start a new invoice;</li>
  <li>open an invoice by its number or client;</li>
  <li>find a client by name or GSTIN, or a product by name or HSN, which opens their list;</li>
  <li>jump to Settings, switch dark mode, or see what is new in an update.</li>
</ul>
<p>Use <kbd>↑</kbd> <kbd>↓</kbd> and <kbd>Enter</kbd>. <kbd>Esc</kbd> closes it.</p>
<figure><img src="assets/img/app-palette.png" alt="Quick search finding a client and their invoices." loading="lazy"><figcaption>Quick search finding a client and their invoices.</figcaption></figure>
</section>

<section id="keyboard">
<h2>Keyboard shortcuts</h2>
<table>
  <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Quick search</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>N</kbd></td><td>New invoice</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>/</kbd></td><td>Show all shortcuts</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Close a dialog</td></tr>
  <tr><td><kbd>Enter</kbd></td><td>Confirm a dialog</td></tr>
</table>
<p>On the invoice screen there are more: see <a href="invoices.html#keyboard">Keyboard shortcuts on this screen</a>. On a Mac, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.</p>
</section>

<section id="dark-mode">
<h2>Dark mode</h2>
<p>${ui('Dark Mode')} in the sidebar switches the app to dark colours, and ${ui('Light Mode')} switches back. Invoices and PDFs always print in their normal colours.</p>
</section>

<section id="install-as-app">
<h2>Opening it like a desktop app</h2>
<p>In Chrome and Edge, the app may offer ${ui('Install App')}. It then opens in its own window with its own icon, like any other program, and right-clicking the icon jumps straight to New Invoice or GST Returns. It is the same app and the same data.</p>
</section>

<section id="app-not-running">
<h2>"Needs a Quick Start"</h2>
<p>If the app's engine is not running, the page says <b>Free GST Billing Software Needs a Quick Start</b>. Your data is safe. Double-click <b>Free GST Billing</b> on your Desktop and click ${ui('Open App')}; the page carries on by itself once it is running.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'troubleshooting',
  title: 'Troubleshooting and questions',
  nav: 'Troubleshooting',
  lead: 'The problems people run into most, what causes each one, and how to fix it.',
  body: `
<section id="files-missing">
<h2>The launcher says files are missing, or to extract the ZIP</h2>
<p>The launcher was opened from inside the ZIP, or the ZIP was only partly extracted. Close it, right-click the ZIP, choose ${ui('Extract All…')}, and open the launcher from the extracted folder. Keep the launcher and the <code>_system</code> folder together. See <a href="install.html#extract-first">Extract the ZIP before opening anything</a>.</p>
</section>

<section id="windows-protected">
<h2>Windows blocked the launcher</h2>
<p>Click ${ui('More info')}, then ${ui('Run anyway')}. If it still will not open, right-click the launcher, choose ${ui('Properties')} and tick ${ui('Unblock')}. See <a href="install.html#windows-protected">"Windows protected your PC"</a>.</p>
</section>

<section id="install-failed">
<h2>The install stopped with an error</h2>
<ul>
  <li><strong>"Could not download Node.js"</strong> or <strong>"could not install the app's dependencies"</strong>: the first install needs the internet. Check the connection, or a work proxy or firewall, and click ${ui('Install')} again. It carries on where it stopped.</li>
  <li><strong>"Node.js was downloaded but will not run"</strong>: antivirus probably removed it. Add the app's folder to your antivirus exclusions, or install Node.js yourself from <a href="https://nodejs.org">nodejs.org</a>, then click ${ui('Install')} again.</li>
</ul>
</section>

<section id="cannot-connect">
<h2>"Cannot connect", a blank page, or "Needs a Quick Start"</h2>
<p>The app is not running. Open the <b>Free GST Billing</b> shortcut and click ${ui('Open App')}; it starts the app if needed and opens the right address. You never need to type the address yourself; if its usual port is busy, the app picks another and the shortcut follows it.</p>
</section>

<section id="wrong-tax">
<h2>The invoice has the wrong tax split</h2>
<ul>
  <li>Check your own <b>state</b> in <a href="settings.html#company-details">Settings</a>.</li>
  <li>Check the <b>client's state</b>, or their GSTIN, which fills the state in.</li>
  <li>If goods go to a different state from the client's address, set <b>Place of Supply</b> on the invoice.</li>
  <li>For a client abroad, set their <b>country</b>: it is then an export, charged as IGST. For an SEZ unit, tick <b>SEZ</b> on the client.</li>
</ul>
<p>See <a href="invoices.html#gst">How GST is worked out</a>.</p>
</section>

<section id="no-tax">
<h2>No GST is charged at all</h2>
<p>The <b>Tax % column</b> is probably turned off under ${ui('Customize')}. Turning it off removes GST from the invoice, and your choice carries over to new invoices. Tick it again. Bills of supply and delivery challans never charge GST.</p>
</section>

<section id="missing-on-pdf">
<h2>Something is missing from the PDF</h2>
<ul>
  <li><strong>Logo, signature or stamp</strong>: check it is uploaded and saved in <a href="settings.html#branding">Settings</a>, and ticked under Customize.</li>
  <li><strong>UPI QR code</strong>: needs a UPI ID on the account, a rupee invoice, and <b>UPI QR</b> ticked under Customize.</li>
  <li><strong>Bank details or PAN</strong>: tick <b>Bank details</b> under Customize; the account needs a bank name.</li>
  <li><strong>Anything on a receipt printer</strong>: receipts leave some things out on purpose. See <a href="thermal-printing.html#not-on-receipts">What a receipt leaves out</a>.</li>
</ul>
</section>

<section id="gstr1-blocked">
<h2>GSTR-1 export says "blocked"</h2>
<p>An invoice number is too long or has characters the portal refuses, or an item has a GST rate the portal does not accept. The message names the first one. See <a href="gst-returns.html#json-checks">Checks before the file is made</a>.</p>
</section>

<section id="update-failed">
<h2>An update went wrong</h2>
<p>Your data folder is never changed by an update, and a backup was saved in <code>Documents\\FreeGSTBill Backups</code> before it started. Run the update again, which fixes most problems. If it still fails, download the ZIP and extract it over the app folder by hand.</p>
</section>

<section id="gst-labels">
<h2>It says VAT instead of GST, or the other way round</h2>
<p>Change <a href="settings.html#region">Region</a> in Settings, and check your country in Company Details. Tax names follow the seller's country.</p>
</section>

<section id="ocr-failed">
<h2>Reading a bill photo failed</h2>
<p>Use a sharp, straight, well-lit JPG or PNG under 8 MB, cropped to the bill. If it still fails, reload the page with <kbd>Ctrl</kbd> + <kbd>F5</kbd> and try again, or enter the bill by hand.</p>
</section>

<section id="other-devices">
<h2>Can I use it on my phone or another computer?</h2>
<p>The app runs on the computer it is installed on, and only that computer can open it. It has no login, so it is deliberately not shared over your network, where anyone connected could read your books. To work on another computer, <a href="backup.html#move-pc">move your data</a> there.</p>
</section>

<section id="internet">
<h2>Does it need the internet?</h2>
<p>Only to install and to update. Invoices, reports, GST returns and even reading bills from photos all work offline. Google Drive upload uses the internet too.</p>
</section>

<section id="privacy">
<h2>Is my data sent anywhere?</h2>
<p>No. There is no account, no tracking and no server of ours. Your data stays in the app's folder unless you choose Google Drive, which copies files into your own Drive.</p>
</section>

<section id="report-problem">
<h2>Reporting a problem</h2>
<p>Open an issue on <a href="${SITE.repo}/issues">GitHub</a> with a screenshot, the version from <b>Settings, App Updates</b>, and what you did just before it happened. Fixes and new versions come from these reports.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'limitations',
  title: 'What the app does not do',
  nav: 'What it does not do',
  lead: 'So you can plan around them: the things this app leaves to the government portals, your CA, or other tools.',
  body: `
<section id="e-invoicing">
<h2>E-invoicing (IRN and signed QR)</h2>
<p>The app does not connect to the Invoice Registration Portal, so it cannot get an IRN or the signed QR code. If your turnover makes e-invoicing compulsory for you, generate the IRN on the IRP and keep it with the invoice.</p>
</section>

<section id="portal-filing">
<h2>Filing returns for you</h2>
<p>It makes the GSTR-1 and GSTR-3B files and figures. It does not log in to the GST portal or file anything. You, or your CA, upload and file on gst.gov.in.</p>
</section>

<section id="eway-generation">
<h2>Generating e-way bills</h2>
<p>It makes the file for the e-way bill portal. The e-way bill number itself is generated on the portal.</p>
</section>

<section id="not-in-gstr1">
<h2>Things not in the GSTR-1 file</h2>
<ul>
  <li><strong>Exports</strong> (Table 6A) must be added on the portal with the shipping bill details.</li>
  <li><strong>Nil-rated, exempt and non-GST supplies</strong> (Table 8), such as bills of supply, are not included.</li>
  <li><strong>Debit notes</strong> are not supported as a document type.</li>
  <li><strong>Advances</strong> received before invoicing are not tracked.</li>
</ul>
</section>

<section id="accounting">
<h2>Full accounting</h2>
<p>There is no double-entry ledger, balance sheet, bank reconciliation or journal entries. It covers invoicing, receivables, purchases, expenses, stock counts and GST. For the rest, give your CA the CSV exports.</p>
</section>

<section id="multi-user">
<h2>Several people, or several computers</h2>
<p>There are no logins or user roles, and the app only opens on the computer it runs on. One computer holds the books; see <a href="backup.html#move-pc">moving to a new computer</a>.</p>
</section>

<section id="income-tax-limits">
<h2>Income tax</h2>
<p>The income tax helper estimates tax for FY 2025-26, for someone under 60. It does not file your return or produce the ITR file the portal takes. See <a href="income-tax.html">Income tax helper</a>.</p>
</section>

<section id="stock-limits">
<h2>Stock</h2>
<p>Stock is one count per product. There are no batches, expiry dates, serial numbers, warehouses or stock valuation.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'glossary',
  title: 'Glossary',
  lead: 'The GST and tax terms used in the app and in these pages, in plain words.',
  body: `
<section id="terms">
<h2>Terms A to Z</h2>
<div class="table-wrap"><table>
  <tr><th>Term</th><th>Meaning</th></tr>
  <tr><td>AATO</td><td>Annual aggregate turnover: your total sales in a year across all your GSTINs on one PAN.</td></tr>
  <tr><td>B2B / B2C</td><td>Sales to a GST-registered business / to someone unregistered, such as a consumer.</td></tr>
  <tr><td>B2C Large</td><td>An inter-state sale to an unregistered buyer above ₹1 lakh (₹2.5 lakh before 1 August 2024), reported invoice by invoice in GSTR-1.</td></tr>
  <tr><td>Bill of supply</td><td>A bill without GST, for exempt goods or services, or from a composition dealer.</td></tr>
  <tr><td>CGST, SGST, UTGST, IGST</td><td>Central, State and Union Territory GST are charged together on a sale within one state or territory. Integrated GST is charged on a sale between states, or to an SEZ or abroad.</td></tr>
  <tr><td>Cess</td><td>Compensation cess, an extra charge on some goods such as tobacco, cars and coal.</td></tr>
  <tr><td>Composition scheme</td><td>A simpler scheme for small businesses, who pay tax at a flat rate and cannot charge GST to customers.</td></tr>
  <tr><td>Credit note</td><td>A document that reduces a sale already invoiced, for a return, discount or correction.</td></tr>
  <tr><td>Delivery challan</td><td>A document for moving goods without a sale.</td></tr>
  <tr><td>E-way bill</td><td>A permit generated on the NIC portal for moving goods, generally worth more than ₹50,000.</td></tr>
  <tr><td>GSTIN</td><td>Your 15-character GST number. The first two digits are the state code, the next ten are the PAN, and the last is a check character.</td></tr>
  <tr><td>GSTR-1</td><td>The return listing your sales, filed monthly or quarterly.</td></tr>
  <tr><td>GSTR-2B</td><td>The portal's statement of what your suppliers reported selling to you. It sets how much credit you can usually claim.</td></tr>
  <tr><td>GSTR-3B</td><td>The summary return where you pay the tax due after credit.</td></tr>
  <tr><td>HSN / SAC</td><td>Codes that classify goods (HSN) and services (SAC). They decide the GST rate and go into your returns.</td></tr>
  <tr><td>ITC</td><td>Input tax credit: the GST you paid on purchases, which you subtract from the GST you owe.</td></tr>
  <tr><td>LUT</td><td>Letter of Undertaking, which lets you export without paying IGST.</td></tr>
  <tr><td>NIL return</td><td>A return filed for a period with no activity. Still compulsory.</td></tr>
  <tr><td>Place of supply</td><td>Where the supply is treated as happening. It decides CGST and SGST versus IGST.</td></tr>
  <tr><td>Proforma invoice</td><td>A quote or estimate. Not a tax invoice, and not a sale.</td></tr>
  <tr><td>QRMP</td><td>Quarterly return, monthly payment: a scheme letting small businesses file GSTR-1 and 3B quarterly.</td></tr>
  <tr><td>Reverse charge</td><td>When the buyer, not the seller, pays the GST to the government.</td></tr>
  <tr><td>SEZ</td><td>Special Economic Zone. Supplies to a unit there are charged IGST, or none under LUT.</td></tr>
  <tr><td>TCS</td><td>Tax collected at source: tax the seller collects from the buyer and deposits.</td></tr>
  <tr><td>TDS</td><td>Tax deducted at source: tax the buyer deducts from the payment and deposits for the seller.</td></tr>
  <tr><td>UQC</td><td>Unit quantity code, the standard unit names used in GST returns, such as NOS, KGS or OTH.</td></tr>
</table></div>
</section>
`,
},
];
