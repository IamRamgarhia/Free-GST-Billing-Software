const ui = (s) => `<span class="ui">${s}</span>`;

export default [
// =============================================================================
{
  slug: 'settings',
  title: 'Settings',
  lead: 'Every tab of Settings, card by card, in the order the tabs appear: Business type, Company, Profiles, Terms, Print & PDF, Features, Stock, Region, App lock, Backups, Google Drive, Import/Export and Updates. Each card in the app has a ? next to its title that opens the matching part of this page.',
  body: `
<section id="save-bar">
<h2>Settings tabs and the Save all changes bar</h2>
<p>Open ${ui('Settings')} from the sidebar. Settings is split into six <b>tabs</b>, a row of buttons at the top of the page. Each tab shows its cards one under the other:</p>
<div class="table-wrap"><table>
  <tr><th>Tab</th><th>Cards in it</th></tr>
  <tr><td>${ui('Company')}</td><td>Business type, Company details (with payment accounts), Business profiles, Terms</td></tr>
  <tr><td>${ui('Print &amp; PDF')}</td><td>Print and PDF settings, Region</td></tr>
  <tr><td>${ui('Features')}</td><td>Features, Cost centres (when turned on), Stock alerts</td></tr>
  <tr><td>${ui('Privacy &amp; Security')}</td><td>App lock (PIN), Privacy &amp; internet</td></tr>
  <tr><td>${ui('Data &amp; Backups')}</td><td>Backups and the Trash bin, Google Drive, Import/Export</td></tr>
  <tr><td>${ui('Updates')}</td><td>App updates</td></tr>
</table></div>
<p>Click a tab to show it; the tab you are on is filled in blue. On a phone or a small screen the buttons wrap onto two lines; nothing is hidden. Searching with ${ui('Ctrl + K')} for a setting (for example "Google Drive") opens its tab at that card.</p>
<p>The app remembers the tab you had open until you close the browser tab, so coming back to Settings opens the same tab.</p>
<p><b>The ? buttons.</b> The ${ui('?')} at the top right of Settings opens the help for the tab you are on. Every card inside a tab also has its own small ${ui('?')} next to its title, which opens the help for just that card, here or on the <a href="print-settings.html">Print and PDF</a> and <a href="backup.html">Backups</a> pages. They open in your web browser and need internet.</p>
<h3>The Save all changes bar</h3>
<p>One bar is fixed to the bottom of the screen on every tab. It shows one of two things:</p>
<ul>
  <li><b>✓ All changes saved</b>, in grey: nothing is waiting to be saved.</li>
  <li><b>● Unsaved changes in …</b>, in amber, with the names of the cards you changed, for example <i>Unsaved changes in Company Details, Low-stock alerts</i>. Two buttons appear: ${ui('Discard')} throws away every unsaved change and puts the cards back as they were saved, and ${ui('Save all changes')} saves them all in one click.</li>
</ul>
<p>You can change things on several tabs and save once at the end: switching tabs never loses what you typed.</p>
<h3>What waits for a save, and what saves by itself</h3>
<div class="table-wrap"><table>
  <tr><th>Saves the moment you change it</th><th>Waits for ${ui('Save all changes')} (or its own button)</th></tr>
  <tr><td>Payment accounts (add, edit, delete, default, order, on or off), Business Profiles (Switch, Delete, Save as Profile), quick-start Terms templates, Print &amp; PDF, Region, App lock, the backup folder, Cost centres</td><td>Company Details, GSTR filing details, PAN, logo, signature, stamp and Google Drive fields (own button: ${ui('Save Profile')}); Invoice Number Format (${ui('Save Number Format')}); Low-stock alerts (${ui('Save')}); a Terms template you are writing (${ui('Save Template')}); Business type and Features (no button of their own)</td></tr>
</table></div>
<h3>Something wrong?</h3>
<ul>
  <li><b>The bar still says unsaved after I saved</b>: one card may have refused to save. Look for a message at the top of the screen (for example an invoice number that is too long) and fix what it says, then click ${ui('Save all changes')} again.</li>
  <li><b>The Company form is greyed out</b>: it stays locked for a moment while your saved details load, so nothing you type is lost. Wait a second; on a slow computer it can take a few seconds.</li>
  <li><b>I closed the app without saving</b>: unsaved changes are lost. Saved ones are on your computer and come back next time.</li>
</ul>
</section>

<section id="business-type">
<h2>Business type</h2>
<p>The first tab. Pick what kind of business you run, and the app shows the screens and features that business needs and hides the rest, so the menu stays short. Use it when you first set the app up, or when the menu shows things you never use.</p>
<p>The card shows <b>Your business type:</b> with the type that is saved now, or <b>Not chosen yet</b>.</p>
<figure><img src="assets/img/settings-business-type.png" alt="Settings, Business type tab: the row of Settings tabs at the top and seven business type cards, with Everything picked." loading="lazy"><figcaption>The Business type tab. The saved type is shown in blue; the Save all changes bar is at the bottom.</figcaption></figure>
<ol class="steps">
  <li><strong>Pick a type</strong>Click one of the seven cards. Each says in one line who it is for.</li>
  <li><strong>Check what will change</strong>A yellow box, <b>Not saved yet</b>, lists what will be turned on (<i>Turn on: …</i>) and turned off (<i>Turn off: …</i>). The tick boxes on the Features tab are filled in to match.</li>
  <li><strong>Save</strong>Click ${ui('Save all changes')} at the bottom. The message <i>Features saved. The menu now shows your choices.</i> appears and the sidebar changes. ${ui('Discard')} instead puts everything back.</li>
</ol>
<p><b>Nothing is ever deleted.</b> A business type only changes what you see. Your invoices, products and purchases stay, and come back the moment the feature is shown again. You can switch any single feature back on in <a href="#features">Features</a>.</p>
<div class="table-wrap"><table>
  <tr><th>Business type</th><th>Hidden (everything else is shown)</th></tr>
  <tr><td>Retail shop / kirana</td><td>Recurring, TDS / TCS, E-way bill, E-invoicing, Purchase orders, Manufacturing, Cost centres</td></tr>
  <tr><td>Freelancer / consultant</td><td>Products, Purchases, E-way bill, E-invoicing, Purchase orders, GSTR-2B matching, Manufacturing, Cost centres</td></tr>
  <tr><td>Restaurant / cafe</td><td>Recurring, TDS / TCS, E-way bill, E-invoicing, Purchase orders, GSTR-2B matching, Manufacturing, Cost centres</td></tr>
  <tr><td>Wholesale / trading</td><td>Recurring, E-invoicing, Manufacturing, Cost centres</td></tr>
  <tr><td>Manufacturing</td><td>Recurring, E-invoicing</td></tr>
  <tr><td>Service / repair shop</td><td>TDS / TCS, E-way bill, E-invoicing, Purchase orders, GSTR-2B matching, Manufacturing, Cost centres</td></tr>
  <tr><td>Everything</td><td>Nothing: every feature is shown</td></tr>
</table></div>
<p>Every type keeps Dashboard, New invoice, Clients, Settings, Support &amp; About, User guide, Notifications, Dark mode and Control Panel. E-invoicing is only for businesses with a yearly turnover above ₹5 crore, so only <b>Everything</b> turns it on; tick it in Features if you need it.</p>
<p>The choice is kept on this computer and is the same for every business you run in the app. It is not the same as the <b>Business type</b> on the <a href="print-settings.html#business-type">Print &amp; PDF</a> tab, which only changes how invoices look.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>A screen I use has gone from the menu</b>: open the <a href="#features">Features</a> tab, tick it, and click ${ui('Save all changes')}.</li>
  <li><b>I picked a type but nothing changed</b>: you have not saved yet. The bottom bar shows <i>Unsaved changes in Business type</i>; click ${ui('Save all changes')}.</li>
  <li><b>It says Not chosen yet</b>: you used the app before this tab existed. Your switches stay exactly as they are until you pick a type and save.</li>
</ul>
<p id="business-type-invoices">Choosing <b>Freelancer / consultant</b> also sets how new invoices start: in <b>Services</b> mode, without the unit next to the quantity, and due in 15 days. Invoices you already made are not changed, and you can change any of it on the invoice.</p>
</section>

<section id="company-details">
<h2>Company Details</h2>
<p>The first card on the ${ui('Company')} tab: your business name and address, printed at the top of every invoice. Fill it in once when you start. Change it if you move, get a GSTIN, or change your phone number.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put</th></tr>
  <tr><td>Business Name *</td><td>Your shop or company name, as it should print. The only field you must fill.</td></tr>
  <tr><td>Country</td><td>India for most users. The list follows your <a href="#region">Region</a>. Changing the country changes the names of the fields below (for example VAT number instead of GSTIN).</td></tr>
  <tr><td>Address</td><td>Street, building and area. Two lines are enough.</td></tr>
  <tr><td>City, PIN Code</td><td>Your town and 6-digit PIN code.</td></tr>
  <tr><td>State</td><td><b>The one to get right.</b> GST depends on it: a sale inside your state is charged CGST + SGST, a sale to another state IGST. Pick it from the list.</td></tr>
  <tr><td>GSTIN</td><td>Your 15-character GST number, such as <code>22AAAAA0000A1Z5</code>. Leave it blank if you are not registered. When you click out of the box, the app checks the pattern and shows <i>GSTIN format looks unusual</i> in orange if a character looks wrong. It is only a warning; you can still save.</td></tr>
  <tr><td>Email, Phone</td><td>Printed on the invoice so clients can reach you.</td></tr>
</table></div>
<p>Below these come the <a href="#gstr-details">GSTR filing details</a> (Indian businesses only), <a href="#payment-accounts">Payment Accounts</a>, <a href="#invoice-numbers">Invoice Number Format</a> and <a href="#branding">Branding</a>.</p>
<ol class="steps">
  <li><strong>Type your details</strong>Fill in the fields. The bottom bar turns amber: <i>Unsaved changes in Company Details</i>.</li>
  <li><strong>Save</strong>Click ${ui('Save Profile')} at the bottom of the Company tab, or ${ui('Save all changes')} in the bar. The message <i>Profile saved!</i> appears.</li>
</ol>
<p>The next invoice you make uses the new details. Invoices already saved keep the details they were made with.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>GST is split wrongly (IGST instead of CGST + SGST, or the other way)</b>: your State is wrong or empty. Pick the right one and save. If it is empty, the invoice screen warns you once rather than guess.</li>
  <li><b>The GSTIN warning will not go away</b>: check for the letter O typed instead of the digit 0, or a missing character. A GSTIN has 15 characters.</li>
  <li><b>My new address is not on an old invoice</b>: that is on purpose. Saved invoices never change. Open the invoice and save it again if you need the new details on it.</li>
</ul>
</section>

<section id="gstr-details">
<h2>GSTR filing details</h2>
<p>A grey box inside Company Details, shown only when the country is India. It is used for one thing: the <a href="gst-returns.html#json-checks">GSTR-1 and GSTR-3B JSON files</a> you upload to the GST portal.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What it does</th></tr>
  <tr><td>Aggregate turnover (AATO) is above ₹5 crore</td><td>Tick it if your total sales last year, for all your GSTINs together on one PAN, were more than ₹5 crore. The line below then says <b>6-digit HSN</b>: every item needs an HSN code of at least 6 digits. Unticked, 4 digits are enough. The GST portal refuses a GSTR-1 where an HSN is too short.</td></tr>
</table></div>
<p>Save with ${ui('Save Profile')} or ${ui('Save all changes')}. (Older versions also asked for last year's and this year's turnover. The GSTR-1 file no longer carries them: those fields were only for 2017-18 returns.)</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>GSTR-1 upload fails on HSN length</b>: check whether the tick box matches your turnover, then lengthen the HSN codes on your <a href="products.html">products</a>.</li>
  <li><b>I do not see this box</b>: the country in Company Details is not India.</li>
</ul>
</section>

<section id="lut">
<h2>LUT for exports and SEZ supplies</h2>
<p>A second grey box inside Company Details, shown only when the country is India. Fill it in if you export, or sell to units in a Special Economic Zone (SEZ), <b>without charging IGST</b>.</p>
<p><b>What a LUT is.</b> A Letter of Undertaking (form <b>GST RFD-11</b>) is a promise to the GST department that you will follow the export rules. With a LUT, exports and SEZ supplies are billed without IGST (they are "zero-rated"), so you do not pay the tax and then wait months for a refund. Without one, you must charge IGST and claim it back. It is free, filed online in a few minutes, and valid for <b>one financial year</b>: file a fresh one every April, before your first export of the year. How to file it, step by step: <a href="gst-basics.html#lut">GST basics: LUT</a>.</p>
<figure><img src="assets/img/settings-lut.png" alt="The LUT for exports and SEZ supplies box: LUT ARN AD290426123456X, financial year FY 2026-27 and the date filed." loading="lazy"><figcaption>The LUT box in Settings, Company, filled in.</figcaption></figure>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put in</th></tr>
  <tr><td>LUT ARN (acknowledgement number)</td><td>The ARN the GST portal gave you when you filed the LUT, such as <code>AD290426123456X</code>: usually 15 letters and digits starting with AD. Spaces are removed and letters made capital for you. If it does not look like an ARN, an amber note asks you to check it, but it is still saved.</td></tr>
  <tr><td>Financial year it covers</td><td>The year you chose on the portal under <b>LUT Applied for Financial Year</b>, such as FY 2026-27.</td></tr>
  <tr><td>Date filed (optional)</td><td>The date on the acknowledgement, for your records.</td></tr>
</table></div>
<p>Save with ${ui('Save Profile')} or ${ui('Save all changes')}. Each business in <a href="#business-profiles">Business Profiles</a> has its own LUT, because a LUT belongs to one GSTIN.</p>
<p><b>What it does.</b> On a new invoice for a client abroad or an SEZ client, dated in that financial year, <b>Export under LUT (no IGST)</b> is ticked for you: no IGST is charged and the invoice prints the Rule 46 declaration with your ARN. See <a href="invoices.html#lut">Exports and SEZ supplies under a LUT</a>.</p>
<div class="note tip"><strong>Something wrong?</strong><p>"This LUT is for FY 2025-26; today is in FY 2026-27": your LUT has run out. File a new one on the portal, then type its ARN and choose the new year here. Older invoices keep the ARN they were made with. I do not see this box: the country in Company Details is not India.</p></div>
</section>

<section id="payment-accounts">
<h2>Payment Accounts: bank and UPI</h2>
<p>The bank accounts and UPI IDs your clients pay into. The default one prints in the bank details block of every new invoice; with a UPI ID, rupee invoices also carry a QR code the client scans to pay the exact amount. Add every account you use: you pick which one goes on each invoice.</p>
<ol class="steps">
  <li><strong>Add the first account</strong>Click ${ui('+ Add account')}. A form opens; see <a href="#add-account">Add account</a> for each field.</li>
  <li><strong>Save the account</strong>Click ${ui('Save account')}. The account appears in the list. The first account is marked ⭐, the default.</li>
  <li><strong>Add more if you have them</strong>Each one you add is listed under the first.</li>
</ol>
<p>Accounts save themselves straight away: you do not need ${ui('Save Profile')} for them.</p>
<p>Each account in the list shows its name, bank, the last digits of the account number, IFSC and UPI ID, with these buttons on the right:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>⭐</td><td>Makes this the default account, used on every new invoice. Only shown on accounts that are not the default.</td></tr>
  <tr><td>↑ ↓</td><td>Moves the account up or down the list. The order is the order in the account picker on the invoice.</td></tr>
  <tr><td>∅ / ✓</td><td>Switches the account off (it turns pale and says <b>Inactive</b>) or back on. Switched-off accounts are not offered on new invoices.</td></tr>
  <tr><td>Pencil</td><td>Opens the account to edit it.</td></tr>
  <tr><td>Bin</td><td>Deletes the account after asking. Invoices already made with it keep the bank details they were saved with.</td></tr>
</table></div>
<p>To use a different account on one invoice, pick it under <a href="invoice-options.html#tds-tcs-account">Customize</a> on the invoice screen.</p>
<p><b>PAN Number (business-level)</b> sits below the list, for Indian businesses. It is your 10-character PAN, such as <code>AAAAA1234A</code>, and prints in the bank details block. Unlike the accounts, it needs ${ui('Save Profile')} or ${ui('Save all changes')}.</p>
<p>If you entered bank details in an older version, a yellow box says <b>Your existing bank details are still on this profile</b>. Click ${ui('Import &amp; continue →')} to turn them into your first account.</p>
<figure><img src="assets/img/app-settings-accounts.png" alt="A payment account, and the invoice number format with its preview." loading="lazy"><figcaption>A payment account, and the invoice number format with its preview.</figcaption></figure>
<h3>Something wrong?</h3>
<ul>
  <li><b>No QR code on the invoice</b>: the account used on that invoice has no UPI ID, the invoice is not in rupees, or <b>UPI QR code</b> is switched off in <a href="#features">Features</a>.</li>
  <li><b>The wrong bank prints</b>: make the right account the default (⭐), or pick it under Customize on that invoice.</li>
  <li><b>Clients get "beneficiary name mismatch" on NEFT or RTGS</b>: fill in <b>Account Holder Name</b> exactly as the bank has it.</li>
</ul>
</section>

<section id="add-account">
<h3>Add account and Edit account</h3>
<p>The form that opens from ${ui('+ Add account')} or the pencil on an account.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to put</th></tr>
  <tr><td>Label (shown in the dropdown)</td><td>Your own name for the account, such as <i>HDFC Current — 1234</i>. Only you see it, in the account picker.</td></tr>
  <tr><td>Account Holder Name</td><td>The name the bank has on the account. Leave it blank to use your business name. Fill it in when they differ, for example a proprietor's own name.</td></tr>
  <tr><td>Bank Name</td><td>Such as State Bank of India.</td></tr>
  <tr><td>Account Type</td><td>Optional: Savings, Current, Cash Credit (CC), Overdraft (OD), NRE or NRO.</td></tr>
  <tr><td>Account Number</td><td>The full number. The list shows only the last digits. Outside India it also takes an IBAN.</td></tr>
  <tr><td>IFSC Code</td><td>The 11-character branch code on your cheque book, such as <code>SBIN0001234</code>. Outside India this is the local bank code (Sort Code, Routing Number, IBAN…).</td></tr>
  <tr><td>SWIFT / BIC (optional)</td><td>Only for payments from abroad, such as <code>HDFCINBB</code>.</td></tr>
  <tr><td>UPI ID (optional — drives the QR for this account)</td><td>Such as <code>yourbusiness@hdfcbank</code> or <code>9876543210@paytm</code>. If it does not look like a UPI ID (it needs an @), an orange warning appears when you click out of the box.</td></tr>
  <tr><td>Internal notes (not printed on the PDF)</td><td>A reminder for yourself, such as <i>Use for export clients only</i>.</td></tr>
  <tr><td>⭐ Set as default account</td><td>Tick to use this account on every new invoice. Only one account can be the default.</td></tr>
</table></div>
<p>Click ${ui('Save account')} to keep it, or ${ui('Cancel')} to close without changes. The message <i>Account added</i> or <i>Account updated</i> appears.</p>
</section>

<section id="paid-from-abroad">
<h3>Getting paid from abroad</h3>
<p>Two optional boxes in a payment account help clients outside India pay you:</p>
<ul>
  <li><b>SWIFT / BIC</b>: the code a foreign bank needs to send money to your bank. Ask your bank for it; it is printed with the bank details.</li>
  <li><b>IBAN</b>: Indian banks do not use IBANs. Fill this only if you have an account abroad that has one (for example a Wise or Payoneer euro account). It prints under SWIFT.</li>
  <li><b>Purpose code</b>: the RBI code for what the money is for. The bank asks for it on every payment from abroad: the client's bank when sending, or your bank when it credits you and issues the FIRC / e-BRC. Pick from the list or type your own, for example <code>P0802</code> software consultancy, <code>P0807</code> off-site software exports, <code>P1006</code> business and management consultancy, <code>P1007</code> advertising and market research, <code>P1101</code> audio-visual work, or <code>P1099</code> other services. It prints with the bank details on invoices to clients abroad or in a foreign currency, so the client can quote it on the transfer. One invoice can use another code: type it in <b>Purpose code (RBI)</b> on the invoice. Your bank decides which code is right, so check with them once.</li>
  <li><b>Online payment link</b>: a PayPal.me, Wise or Payoneer link. It prints as <b>PAY ONLINE</b> on invoices in a foreign currency, in place of the UPI QR code (UPI only takes rupees). It does not print on rupee invoices.</li>
</ul>
<p>Money for an export of services should come in convertible foreign exchange (or in rupees where the RBI allows it). Ask your bank for the FIRC or e-BRC for each payment and note its number when you <a href="dashboard.html#payment-foreign">record the payment</a>.</p>
</section>

<section id="invoice-numbers">
<h2>Invoice Number Format</h2>
<p>How your invoice numbers look, and where they start. Set it before your first real invoice. You can change it later; numbers already given never change.</p>
<p>The box at the top, <b>Next tax invoice:</b>, shows exactly the number your next tax invoice will get, and changes as you change the settings below. With a brand prefix it also shows the next quotation, delivery challan and credit note.</p>
<h3>Format Style</h3>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>Looks like</th><th>When to use it</th></tr>
  <tr><td>Branded Sequential</td><td><code>INV/2026-27/0001</code></td><td>The default. Numbers start again each financial year.</td></tr>
  <tr><td>Simple Sequential</td><td><code>INV/0001</code></td><td>One running number, no year.</td></tr>
  <tr><td>Random</td><td><code>INV/A3X9K2</code></td><td>Numbers nobody can guess. Not in order, so most shops do not use it.</td></tr>
</table></div>
<h3>Start numbering from</h3>
<p>For tax invoices. If you used a paper bill book up to 1000, type <b>1001</b>: the next tax invoice is <code>.../1001</code>, then 1002 and so on. When you save, the app asks <b>Start tax invoices from 1001?</b> because numbers never go back down; skipped numbers cannot be used later. If you have already gone past the number, numbering simply continues; a number already used is never given again. Quotations, challans, credit notes and receipts keep their own count. Hidden for Random.</p>
<p><b>A number you type yourself</b> on the invoice is kept. If it is written like your series (same prefix and year) and is higher than the last number, the next invoice carries on after it: type <code>.../0049</code> and the next one is <code>.../0050</code>. A lower one, such as an old paper bill entered late, leaves the series alone.</p>
<ol class="steps">
  <li><strong>Pick a style</strong>Click ${ui('Branded Sequential')}, ${ui('Simple Sequential')} or ${ui('Random')}.</li>
  <li><strong>Set the first number</strong>Type it in <b>Start numbering from</b>, or leave 1.</li>
  <li><strong>Change the details if you like</strong>Open ${ui('⚙ Customize prefix, separator &amp; padding')}: see <a href="#number-customize">below</a>.</li>
  <li><strong>Check the preview, then save</strong>Click ${ui('Save Number Format')} (or ${ui('Save all changes')}). The message <i>Invoice number settings saved!</i> appears.</li>
</ol>
<div class="note warn"><strong>16 characters at most</strong>
<p>GST allows invoice and credit note numbers of up to 16 characters (letters, digits, <code>-</code> and <code>/</code>), and GSTR-1 refuses longer ones. If the prefix, year and number together would be longer, a red line under the preview says so and the format will not save. Use a shorter prefix, the short year, or fewer digits.</p></div>
<p>Each document type keeps its own count, and a type can have its own prefix in <a href="print-settings.html#prefixes">Print &amp; PDF, Custom prefix per invoice type</a>.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>The red line says the number is too long</b>: shorten the Brand Prefix, choose the short year (26-27), or fewer padding digits.</li>
  <li><b>I typed 10001 instead of 1001</b>: choose ${ui('No')} when the app asks to confirm. Once saved, numbers cannot go back down.</li>
  <li><b>Changing one business changed another's numbers</b>: they share numbering. Give the business <a href="#own-numbering">its own numbering</a>.</li>
</ul>
</section>

<section id="own-numbering">
<h3>Shared numbering or own numbering for this business</h3>
<p>Shown under <b>Numbering for <i>your business</i></b> when you have more than one business in <a href="#business-profiles">Business Profiles</a>. Every business uses <b>Shared numbering</b> to start: one series for all of them. The line below names who shares it, such as <i>Shared by Firm 1, Firm 2</i>; saving a change then asks <b>Change numbering for all 2 businesses?</b></p>
<p>To keep one business's numbers separate:</p>
<ol class="steps">
  <li><strong>Select the business</strong>Pick it at the top of the sidebar.</li>
  <li><strong>Choose own numbering</strong>Click ${ui('Own numbering for this business')}.</li>
  <li><strong>Give it a prefix</strong>Type a <b>Prefix for this business</b>, such as its initials <code>KS</code>. It is required and must differ from every other business's, because two invoices can never share a number.</li>
  <li><strong>Save</strong>Set <b>Start numbering from</b> if you like, then click ${ui('Save Number Format')}.</li>
</ol>
<p>Its invoices then run <code>KS/26-27/0502</code>, <code>0503</code>… whatever the other businesses do. It starts with the short year, so its credit notes, <code>KS-CN/26-27/0001</code>, fit the 16 characters. Its receipts follow its numbering too, and it keeps its numbering when you change its name or add its GSTIN. ${ui('Shared numbering')} puts it back on the shared series after asking; invoices it already made keep their numbers.</p>
</section>

<section id="number-customize">
<h3>Customize prefix, separator &amp; padding</h3>
<p>Click ${ui('⚙ Customize prefix, separator &amp; padding')} under the format to open it. The defaults are fine for most businesses.</p>
<div class="table-wrap"><table>
  <tr><th>Setting</th><th>What it does</th></tr>
  <tr><td>Brand Prefix</td><td>Up to 10 capital letters and digits, such as <code>ACME</code>. Tax invoices print it alone (<code>ACME/2026-27/0001</code>); every other document adds its type (<code>ACME-QUO/…</code>, <code>ACME-DC/…</code>, <code>ACME-CN/…</code>). Leave it empty to use each type's own prefix: INV, QUO, EST, BOS, COMP, CN and DC. With own numbering, the business's prefix is set above instead.</td></tr>
  <tr><td>Separator</td><td>The mark between the parts: <code>/</code>, <code>-</code> or <code>#</code>.</td></tr>
  <tr><td>Include Financial Year</td><td><b>Yes</b> (<code>2026-27</code>), <b>Short</b> (<code>26-27</code>) or <b>No</b>. Not shown for Random.</td></tr>
  <tr><td>Number Padding</td><td>How many digits: 3 (<code>001</code>), 4 (<code>0001</code>), 5 or 6. Not shown for Random.</td></tr>
</table></div>
</section>

<section id="branding">
<h2>Branding: logo, signature and stamp</h2>
<p>The last card on the Company tab. Your logo prints at the top of the invoice, and your signature and company stamp (seal) at the bottom, above the signatory line.</p>
<ol class="steps">
  <li><strong>Upload</strong>Click ${ui('Upload Logo')}, ${ui('Upload Signature')} or ${ui('Upload Stamp')} and pick a picture from your computer: PNG or JPG, up to 5 MB. The message says <i>Logo uploaded — click Save Profile to keep it.</i></li>
  <li><strong>Set the size</strong>Drag the slider under the picture between S and L. Logo 24 to 80 pixels high (48 to start), signature 30 to 110 (60), stamp 30 to 120 (70).</li>
  <li><strong>Save</strong>Click ${ui('Save Profile')} or ${ui('Save all changes')}. Until you save, the pictures are not kept.</li>
</ol>
<p>${ui('Change Logo')}, ${ui('Change Signature')} and ${ui('Change Stamp')} pick a new picture; the red bin on a picture removes it (save to keep the change). Saving a logo or signature also ticks <b>Show logo</b> and <b>Show signature</b> for new invoices.</p>
<p><b>Tips for good pictures.</b> Large photos are made smaller for you (to 1024 pixels on the longer side). For the signature and stamp, a PNG with a transparent background looks best, so the paper shows through; sign on white paper, photograph it in good light, and crop it close. A logo photo (PNG or JPG) is saved with a white background, so it prints cleanly on any printer.</p>
<p>On a long invoice the signature and stamp always move to the next page together, never split.</p>
<p><b>Your name and logo in the menu.</b> Tick <b>Show my business name and logo in the app's menu</b> under the logo, then save: the top of the menu shows your logo (or your first letter) and business name instead of "GST Billing". With several businesses, it shows the one that is open. "by DiceCodes" stays under it. New installs ask this during the first setup.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>"Could not decode this image"</b>: often an iPhone photo in HEIC format. Share it as JPEG first, or set the iPhone camera to <i>Most Compatible</i>.</li>
  <li><b>"over the 5MB cap"</b>: make the picture smaller first, for example with a free online compressor.</li>
  <li><b>The logo is not on the invoice</b>: check you clicked ${ui('Save Profile')}, and that <b>Show logo</b> is ticked under Customize on the invoice.</li>
</ul>
</section>

<section id="sign-layout">
<h3>Signature and stamp layout</h3>
<p>Appears under the stamp once both a signature and a stamp are uploaded. It decides where the stamp goes:</p>
<ul>
  <li><b>Side by side</b>: the signature and stamp next to each other. The default.</li>
  <li><b>Stamp above the signature</b>: the stamp on top, the signature under it.</li>
  <li><b>Stamp on the signature</b>: the stamp printed over the signature, as a real rubber stamp often is.</li>
</ul>
<p>The white <b>Preview</b> box below shows the result at the sizes you set. Save with ${ui('Save Profile')} or ${ui('Save all changes')}.</p>
</section>

<section id="business-profiles">
<h2>Business Profiles</h2>
<p>The ${ui('Profiles')} tab. If you run more than one business, or more than one GSTIN, save each one as a profile and switch between them. Each profile keeps its own name, address, GSTIN, bank accounts, logo, signature and stamp.</p>
<p>Each saved profile is a card with its name, state and GSTIN, and its address. The one in use has a blue border and an <b>Active</b> badge.</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('+ Add New Profile')}</td><td>Saves the business now on the Company tab into the list first (so it is never lost), then opens the Company tab with an empty form for the new business.</td></tr>
  <tr><td>${ui('Save as Profile')}</td><td>Saves the Company tab as it is into the list, or updates that business's card if it is already there.</td></tr>
  <tr><td>${ui('Switch')}</td><td>Makes that business the active one. The current one is saved first. Every screen then shows the new business. The active card shows ${ui('Current')} instead.</td></tr>
  <tr><td>Bin</td><td>Removes the profile from the list after asking. Its invoices stay.</td></tr>
</table></div>
<h3>Adding a second business</h3>
<ol class="steps">
  <li><strong>Save the first</strong>Make sure the first business's Company details are filled in and saved.</li>
  <li><strong>Start the new one</strong>On the Profiles tab, click ${ui('+ Add New Profile')}. The message says the first business is safe under the Profiles tab, and the Company tab opens empty.</li>
  <li><strong>Fill it in</strong>Type the new business's details, accounts, logo and so on.</li>
  <li><strong>Save it</strong>Click ${ui('Save Profile')}, then ${ui('Save as Profile')} on the Profiles tab. Both businesses are now in the list.</li>
</ol>
<p>You can also change business from the name at the top of the sidebar.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>No saved profiles yet</b>: fill in Company Details and click ${ui('Save as Profile')}.</li>
  <li><b>Two cards for the same business</b>: delete the older one with the bin. Invoices are not affected.</li>
  <li><b>The invoice numbers of two businesses run together</b>: give one <a href="#own-numbering">its own numbering</a>.</li>
</ul>
</section>

<section id="multiple-businesses">
<h3>More than one business: separate books</h3>
<p>Each business has its <b>own books</b>. Invoices, totals, purchases, expenses, receipts, recurring invoices, reports and GST returns all follow the business selected at the top of the sidebar. ${ui('Manage profiles…')} there opens the Profiles tab.</p>
<p>Your client list is shared by all businesses. Records made before you had several businesses show under all of them until you <a href="purchases.html#unassigned">assign them</a>.</p>
</section>

<section id="terms">
<h2>Terms &amp; Conditions Templates</h2>
<p>The ${ui('Terms')} tab. The terms you print at the bottom of invoices, such as payment due dates, interest on late payment and returns, kept as templates so you pick one instead of typing it each time. On a new invoice your first template is loaded for you; see <a href="invoices.html#terms-notes">Terms and notes on an invoice</a>.</p>
<h3>Quick Start</h3>
<p>Under <b>Quick Start — Pick a template for your business</b>, one click adds a ready-made set of Indian terms: <b>Services (IT, Consulting, Freelance)</b>, <b>Goods &amp; Products (Retail, Wholesale)</b>, <b>Manufacturing &amp; Trading</b>, <b>Export / International</b> or <b>Freelancer (Simple)</b>. It is saved straight away; clicking the same one again says <i>You already have this template</i>. Edit it afterwards to put in your own city, days and rates.</p>
<h3>Your own template</h3>
<ol class="steps">
  <li><strong>Start</strong>Click ${ui('+ New Template')}.</li>
  <li><strong>Name it</strong>Type a <b>Template Name</b>, such as <i>Standard Terms</i> or <i>Export Terms</i>. A name is required.</li>
  <li><strong>Write or paste the terms</strong>Into <b>Content (paste your terms here)</b>. One point per line reads best.</li>
  <li><strong>Save</strong>Click ${ui('Save Template')} (or ${ui('Save all changes')}). ${ui('Cancel')} closes without saving.</li>
</ol>
<p>Each saved template is listed with its text. The pencil edits it; the bin deletes it after asking. Deleting or changing a template never changes invoices that already used it.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>The terms run onto a second page</b>: turn on <a href="print-settings.html#terms-page">Print T&amp;C on a separate page</a>, or shorten them.</li>
  <li><b>A different template loads on new invoices</b>: the first one in the list is used. Pick another on the invoice with <b>Load saved template</b>.</li>
</ul>
</section>

<section id="print-settings">
<h2>Print &amp; PDF</h2>
<p>The ${ui('Print &amp; PDF')} tab sets the look of every printed invoice and PDF: designs, thermal receipts, watermarks, copies, colours, languages and formats. It has its own page with a section for each card: <a href="print-settings.html">Print and PDF settings</a>.</p>
</section>

<section id="features">
<h2>Features</h2>
<p>The ${ui('Features')} tab: what shows in the menu and on the screens, and in what order. Turn off what you never use to keep the app simple, or turn on extras such as Purchase orders or E-invoicing.</p>
<ol class="steps">
  <li><strong>Tick and untick</strong>Tick what you want to see and untick what you do not. A yellow box, <b>Not saved yet</b>, lists what will be turned on and off.</li>
  <li><strong>Save</strong>Click ${ui('Save all changes')} at the bottom. Only then does the menu change. ${ui('Discard')} undoes your ticks.</li>
</ol>
<p>Unticked things disappear from the menu and the screens. <b>Nothing is deleted</b>: your data is kept, and ticking it again brings it all back. Each switch has a line saying what it does.</p>
<figure><img src="assets/img/settings-features.png" alt="Settings, Features tab: tick boxes for the top of the menu, the bottom of the menu and the buttons at the top right, each with arrows to change the order." loading="lazy"><figcaption>The Features tab. Tick what you want in the menu, and use the arrows to change its order.</figcaption></figure>
<p>${ui('Reset to my business type')}, at the top right, sets every switch back to what your <a href="#business-type">business type</a> gives; save to apply it. Before a business type is chosen, the button is ${ui('Reset to default')}.</p>
<p>When <b>Cost centres</b> is on, a <b>Cost centres</b> card appears under Features on this tab, to add your branches, sites or projects: see <a href="reports.html#cost-centres">Cost centres</a>.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>I ticked it but it is not in the menu</b>: click ${ui('Save all changes')}.</li>
  <li><b>Recurring invoices still arrive after I hid Recurring</b>: hiding a screen does not stop recurring invoices being made, and the switch says so. Pause them on the Recurring screen.</li>
  <li><b>A switch is missing</b>: India-only switches (TDS / TCS, E-way bill, E-invoicing, UPI QR code, GSTR-2B matching) are not listed when <a href="#region">Region</a> is International.</li>
</ul>
</section>

<section id="features-menu">
<h3>Menu: show, hide and reorder</h3>
<p>The <b>Menu</b> part lists every item of the sidebar in two boxes, <b>Top of the menu</b> and <b>Bottom of the menu</b>, in the order they appear, and a third box, <b>Buttons at the top right</b>, for the User Guide, Notifications, Lock and Dark mode buttons.</p>
<ul>
  <li>The tick box shows or hides the item.</li>
  <li>The ${ui('▲')} and ${ui('▼')} arrows on the left move the item up or down. ${ui('Default order')}, shown once you have moved something, puts the menu back in the usual order.</li>
  <li><b>Dashboard</b>, <b>New invoice</b>, <b>Clients</b>, <b>Settings</b>, <b>Support &amp; About</b> and <b>Lock app</b> (shown only when a PIN is set) say <b>(always shown)</b> and have no tick box. You can still move them.</li>
</ul>
<p>Quick search (<kbd>Ctrl</kbd> + <kbd>K</kbd>) leaves out anything hidden. Save with ${ui('Save all changes')}.</p>
</section>

<section id="features-inside-screens">
<h3>Features inside screens</h3>
<p>Switches for parts of a screen, grouped by the screen they appear on:</p>
<div class="table-wrap"><table>
  <tr><th>Screen</th><th>Switch</th><th>What it shows</th></tr>
  <tr><td rowspan="4">Invoice screen</td><td>TDS / TCS</td><td>Tax deducted or collected at source on an invoice. See <a href="invoices.html#tds-tcs">TDS and TCS</a>.</td></tr>
  <tr><td>E-way bill</td><td>The button to download the e-way bill file for goods you send.</td></tr>
  <tr><td>E-invoicing (IRN)</td><td>Only if your yearly turnover is above ₹5 crore. <b>Off</b> to start. See <a href="gst-returns.html#e-invoice">E-invoicing</a>.</td></tr>
  <tr><td>UPI QR code</td><td>The scan-to-pay QR code on invoices.</td></tr>
  <tr><td rowspan="2">Purchases screen</td><td>Purchase orders</td><td>Orders to suppliers, turned into bills when goods arrive. <b>Off</b> to start. See <a href="purchases.html#purchase-orders">Purchase orders</a>.</td></tr>
  <tr><td>GSTR-2B matching</td><td>Matching your purchase bills with GSTR-2B, a tab on GST returns.</td></tr>
  <tr><td>Products screen</td><td>Manufacturing (bill of materials)</td><td>What goes into a product, and ${ui('Make')} to move the stock. <b>Off</b> to start. See <a href="products.html#manufacturing">Manufacturing</a>.</td></tr>
  <tr><td>Reports screen</td><td>Cost centres</td><td>Tag bills, purchases and expenses with a branch, site or project, and see profit for each. <b>Off</b> to start.</td></tr>
  <tr><td>Integrations</td><td>Google Drive</td><td>Saving invoice PDFs and backups to your Google Drive.</td></tr>
</table></div>
</section>

<section id="stock">
<h2>Low-stock alerts</h2>
<p>The ${ui('Stock')} tab. Warns you when a product is running out, so you reorder in time. It powers the 🔔 bell at the top right and the low-stock list on the Dashboard, and the Products screen colours a product amber when it is at or below the number you set.</p>
<ol class="steps">
  <li><strong>Turn it on or off</strong><b>Show low-stock alerts</b> is ticked to start.</li>
  <li><strong>Pick the threshold</strong>Click a chip: <b>0</b> (only when fully out), <b>3</b> (very tight), <b>5</b> (recommended) or <b>10</b> (loose), or type any number from 0 in the box. The line above says <i>Alert when stock ≤ 5</i>.</li>
  <li><strong>Save</strong>Click ${ui('Save')} on the card, or ${ui('Save all changes')}. The message <i>Low-stock alert settings saved</i> appears.</li>
</ol>
<p>It is one threshold for every product. With alerts off, stock is still counted; you are just not warned.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>No alerts at all</b>: check the box is ticked and saved, and that your products have a stock quantity.</li>
  <li><b>Too many alerts</b>: pick a lower threshold, such as 3 or 0.</li>
</ul>
</section>

<section id="region">
<h2>Region Preference</h2>
<p>The ${ui('Region')} tab. Choose whether you bill only in India, only abroad, or both. It changes the country lists and which features you see. Your data is not touched, and you can change it any time.</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What you get</th></tr>
  <tr><td>🇮🇳 India only</td><td>GST, rupees first, GSTR-1 and 3B, e-way bill, UPI QR code.</td></tr>
  <tr><td>🌍 International</td><td>VAT and other tax names, several currencies, no India-only features or switches.</td></tr>
  <tr><td>🌐 Both / Auto</td><td>All countries, chosen on each invoice. The default.</td></tr>
</table></div>
<p>Click one: it saves straight away, with the message <i>Region preference: …</i>. No Save button is needed.</p>
<p>Region, Print &amp; PDF and your other display choices are also kept in the app's data folder, so they come back even if the browser clears its saved data.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>My country is missing from Company Details</b>: choose 🌐 Both / Auto.</li>
  <li><b>GST features disappeared</b>: Region is International. Choose 🇮🇳 India only or 🌐 Both / Auto.</li>
</ul>
</section>

<section id="lock">
<h2>App lock (PIN)</h2>
<p>The ${ui('App lock')} tab. For a computer other people also use: the app asks for a 6 or 8 digit PIN each time it opens. It is off to start. The card says whether it is on.</p>
<h3>Turning it on</h3>
<ol class="steps">
  <li><strong>Start</strong>Click ${ui('Turn on PIN lock')}.</li>
  <li><strong>Choose the length</strong>Under <b>Digits</b>, pick 6 or 8.</li>
  <li><strong>Type the PIN twice</strong>In <b>New PIN</b> and <b>New PIN again</b>. Only digits are accepted.</li>
  <li><strong>Save</strong>Click ${ui('Save PIN')}. The message <i>PIN saved. It is asked each time the app opens.</i> appears. This browser tab stays unlocked; other tabs and the next start ask for it.</li>
</ol>
<h3>When it is on</h3>
<ul>
  <li>${ui('Lock now')} locks the app straight away, when you step away. So do ${ui('Lock')} on the Dashboard, the padlock at the top right and <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> anywhere. Anything you were typing is still there after you unlock.</li>
  <li>${ui('Change PIN')} and ${ui('Turn off')} ask for the <b>Current PIN</b> first. ${ui('Cancel')} closes the form.</li>
  <li>After five wrong tries in a row, wait 30 seconds before the next.</li>
</ul>
<p>It locks the screen only; it does not encrypt your files. Keep your backups safe as before. Backup files never contain the PIN, and restoring a backup keeps the PIN you have now.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>"The two PINs do not match"</b> or <b>"The PIN must be 6 digits"</b>: type the same PIN, of the length you chose, in both boxes.</li>
  <li><b>"Current PIN is wrong"</b>: check Caps Lock is not the problem (PINs are digits only) and try again; after five tries, wait 30 seconds.</li>
  <li><b>Forgot the PIN?</b> Open the Free-GST-Billing folder (where you start the app), make a new empty file there named <code>RESET-PIN</code>, and reload the app. The PIN is removed and the file deleted. Your invoices are not touched.</li>
</ul>
</section>

<section id="privacy-internet">
<h2>Privacy &amp; internet</h2>
<p>The ${ui('Privacy &amp; internet')} tab says, in one table, everything the app uses the internet for and when. Tick <b>Offline mode</b> and the app never goes online by itself: no update check, no supporters list, no automatic copy of each PDF to Google Drive. ${ui('Check for Updates')} and other things you click still work when you click them. It also tells you how to check this yourself in two minutes. The full answer is on <a href="security.html#offline-mode">Is it safe?</a>.</p>
</section>

<section id="backups">
<h2>Backups</h2>
<p>The ${ui('Backups')} tab holds the <b>Backup Management + Trash Bin</b> card: the automatic daily backups (${ui('Backup now')}, ${ui('Restore')}, ${ui('Delete')}), a folder on another drive for a second copy of each, and the trash bin for deleted invoices. Each part is explained on the Backups page:</p>
<ul>
  <li><a href="backup.html#automatic-backups">Daily backups</a> and <a href="backup.html#restore-daily-backup">restoring one</a></li>
  <li><a href="backup.html#backup-copy">Keeping a copy in another folder</a></li>
  <li><a href="backup.html#trash">Trash bin</a></li>
</ul>
</section>

<section id="google-drive">
<h2>Cloud Backup (Google Drive)</h2>
<p>The ${ui('Google Drive')} tab. Keeps a copy of your invoice PDFs in your own Google Drive, so you can open them from your phone or another computer, and they survive if this computer is lost.</p>
<h3>Easiest Way — Google Drive for Desktop (Recommended)</h3>
<p>No setup in the app is needed.</p>
<ol class="steps">
  <li><strong>Install Google Drive</strong>Click ${ui('Download Google Drive for Desktop')} on the card (free, from Google) and install it.</li>
  <li><strong>Sign in</strong>With your Google account. A <b>Google Drive (G:)</b> drive appears on your computer.</li>
  <li><strong>Sync the PDFs</strong>Move the app's <code>Saved Invoices</code> folder into Google Drive, or set Google Drive to back up that folder.</li>
  <li><strong>Done</strong>Every PDF you download is now in your Drive too, at drive.google.com.</li>
</ol>
<div class="note warn"><strong>PDFs only, not your data folder</strong>
<p>Sync the <code>Saved Invoices</code> folder, never the app's data folder: two computers writing the same data files can damage them. For your data, use <a href="backup.html#backup-copy">a backup folder</a> or <a href="backup.html#export-backup">Export Backup</a>.</p></div>
<h3>Something wrong?</h3>
<ul>
  <li><b>PDFs do not appear in Drive</b>: check Google Drive for Desktop is running (its icon near the clock) and signed in, and that you moved the right folder.</li>
  <li><b>"Google Drive not configured" when exporting</b>: that tick box needs the Advanced setup below. The backup file still downloads to your computer.</li>
</ul>
</section>

<section id="google-drive-api">
<h3>Advanced: Direct API Upload</h3>
<p>For people comfortable with Google Cloud. Click <b>Advanced: Direct API Upload (for developers)</b> to open it. It lets the app upload each invoice PDF itself, and save a copy of an exported backup to Drive.</p>
<ol class="steps">
  <li><strong>Make a Client ID</strong>Click ${ui('Open Google Cloud Console')}, create a project, enable the Drive API, and create an OAuth Client ID of type <i>Web application</i>, with the app's address as an allowed origin. The card shows that address in grey; it is the one in your browser's address bar, such as <code>http://localhost:…</code>.</li>
  <li><strong>Paste it</strong>Into <b>Google OAuth Client ID</b>. It ends in <code>.apps.googleusercontent.com</code>.</li>
  <li><strong>Name the folder</strong><b>Drive Folder Name</b> is <i>GST Billing Invoices</i> to start. Backups go to a folder of the same name ending in <i>- Backups</i>.</li>
  <li><strong>Save</strong>Click ${ui('Save all changes')}: these fields are saved with Company Details.</li>
  <li><strong>Connect</strong>Click ${ui('Connect Google Drive')} and allow access in the Google window. <b>Status</b> then says <b>Connected</b>; ${ui('Disconnect')} undoes it.</li>
</ol>
<p>After that, ${ui('Save &amp; Download')} on an invoice also uploads its PDF, and <b>Also save a copy to my Google Drive</b> works in <a href="backup.html#export-backup">Export Backup</a>. If it stops working, connect again.</p>
<p><b>"Enter your Google OAuth Client ID first"</b> means the Client ID box is empty.</p>
</section>

<section id="data">
<h2>Import/Export (Data Management)</h2>
<p>The ${ui('Import/Export')} tab. ${ui('Export Backup…')} saves your data to one file you keep anywhere; ${ui('Import Backup…')} brings a file back. Your data stays on your computer: nothing is sent to us. Step by step: <a href="backup.html#export-import">Export Backup and Import Backup</a>.</p>
</section>

<section id="updates">
<h2>App Updates</h2>
<p>The ${ui('Updates')} tab. Checks whether a newer version of the app is out, and installs it.</p>
<ol class="steps">
  <li><strong>Check</strong>Click ${ui('Check for Updates')}. It needs internet. Next to the button you see <i>Current: v… | Latest: v…</i>.</li>
  <li><strong>Update</strong>If there is a newer version, a green box says <b>New version v… is available!</b>. Click ${ui('Update Now')}.</li>
  <li><strong>Wait</strong>The message says <i>Updating… your data is backed up first. This takes about a minute.</i></li>
  <li><strong>Reload</strong>When it says <i>Update finished</i>, reload the page (<kbd>F5</kbd>) to use the new version.</li>
</ol>
<p>Your invoices, data and saved PDFs are never touched by an update. For the other ways to update, see <a href="backup.html#update">Updating</a>.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>"Could not check for updates"</b>: check your internet connection and try again.</li>
  <li><b>"Update failed"</b>: the message gives the reason. Try ${ui('Update Now')} in the <a href="control-panel.html">Control Panel</a>, or update from the launcher.</li>
  <li><b>Still the old version after updating</b>: reload the page, or close the browser tab and open the app again.</li>
</ul>
</section>
`,
},

// =============================================================================
{
  slug: 'backup',
  title: 'Backups, updates and moving PC',
  nav: 'Backups and updates',
  lead: 'Your data is plain files on your own computer. Here is how it is backed up, how to keep a copy somewhere safe, update the app, and move to a new computer.',
  body: `
<section id="where-data-lives">
<h2>Where your data is</h2>
<p>Everything is in the <code>_system\\data</code> folder inside the app's folder. The installer hides <code>_system</code> to keep things tidy; in File Explorer, turn on <b>View, Show, Hidden items</b> to see it. ${ui('Open Data Folder')} in the <a href="control-panel.html">Control Panel</a> opens it for you.</p>
<p>Downloaded PDFs are also kept in the app's <code>Saved Invoices</code> folder, one folder per client.</p>
</section>

<section id="automatic-backups">
<h2>Daily backups (Backup Management)</h2>
<p>Every day the app copies all your data, invoices, clients, products, purchases, expenses, settings and the trash, into a dated backup, and keeps the last 30 days. The first backup of the day is made a few seconds after the app starts, and a computer left on overnight makes the next one soon after midnight. You do not have to do anything.</p>
<p>They are on the ${ui('Backups')} tab of Settings, in the <b>💾 Backup Management + 🗑 Trash Bin</b> card:</p>
<div class="table-wrap"><table>
  <tr><th>Part of the card</th><th>What it does</th></tr>
  <tr><td>${ui('Backup now')}</td><td>Makes today's backup straight away, for example before a big change. The message says <i>Manual backup triggered</i>.</td></tr>
  <tr><td><b>Also keep a copy of every daily backup in this folder</b></td><td>A second copy on another drive. See <a href="#backup-copy">Keeping a copy somewhere else</a>.</td></tr>
  <tr><td><b>📅 Daily backups</b></td><td>The list of backups, newest first, with ${ui('Restore')} and ${ui('Delete')}. See <a href="#restore-daily-backup">Restoring a daily backup</a>.</td></tr>
  <tr><td><b>🗑 Trash bin</b></td><td>Deleted invoices, kept for 30 days. See <a href="#trash">Trash bin</a>.</td></tr>
</table></div>
<div class="note warn"><strong>These are on the same computer</strong>
<p>Daily backups protect you from mistakes, not from a broken hard disk or a lost laptop. Keep a copy somewhere else too.</p></div>
</section>

<section id="restore-daily-backup">
<h3>Restoring a daily backup</h3>
<p>Each row of <b>📅 Daily backups</b> shows the date and time it was made, and <i>also in your backup folder</i> when a second copy exists. Use ${ui('Restore')} when something went badly wrong, for example many records deleted by mistake, and you want <b>all</b> your data back as it was on that day.</p>
<ol class="steps">
  <li><strong>Pick the day</strong>Find the last day your data was right and click ${ui('Restore')} on its row.</li>
  <li><strong>Confirm</strong>The app asks <b>Restore all data from backup …?</b> and explains that it overwrites your current data. Click ${ui('Restore backup')}.</li>
  <li><strong>Reload</strong>When it says <i>Backup restored — please reload the page</i>, press <kbd>F5</kbd>.</li>
</ol>
<p>Before restoring, the app saves your data as it is now in <code>data/backups/pre-restore-…</code>, so you can go back if the restore looks wrong.</p>
<p>${ui('Delete')} removes one backup after asking, to free space; the copy in your backup folder stays. A row marked <i>in your backup folder only</i> has no Delete button.</p>
<div class="note tip"><strong>Only one invoice is wrong?</strong>
<p>Restoring a day puts <b>everything</b> back to that day, including work done since. For one deleted invoice, use the <a href="#trash">Trash bin</a> instead.</p></div>
</section>

<section id="backup-copy">
<h2>Keeping a copy somewhere else</h2>
<p><strong>Every day, automatically, on another drive.</strong> On the Backups tab of Settings, under <b>Also keep a copy of every daily backup in this folder</b>:</p>
<ol class="steps">
  <li><strong>Type a folder</strong>On another drive, a USB disk or a synced folder, such as <code>D:\\FreeGSTBill</code> or <code>E:\\</code>.</li>
  <li><strong>Save it</strong>Click ${ui('Save folder')}. The app checks it can write there and copies today's backup at once. The message says where the copies go.</li>
</ol>
<p>Each daily backup is then also copied into <code>FreeGSTBill Backups\\<i>date</i></code> inside that folder, keeping 30 days. The line under the box shows where. If a copy fails (a USB disk not plugged in), the card says so in red. ${ui('Stop copying')} turns it off; copies already made stay.</p>
<p><b>If the computer fails</b>: install the app again, set the same folder here, and its backups appear in the list with ${ui('Restore')}.</p>
<p>Or by hand:</p>
<ul>
  <li><strong>One click</strong>: ${ui('Create Backup')} in the <a href="control-panel.html">Control Panel</a>, or ${ui('Back up my data')} in the launcher under ${ui('More options')}, saves a ZIP in <code>Documents\\FreeGSTBill Backups</code>. Copy it to a pen drive or cloud storage.</li>
  <li><strong>One file you choose</strong>: see <a href="#export-import">Export Backup</a>.</li>
  <li><strong>Google Drive</strong>: see <a href="settings.html#google-drive">Cloud Backup (Google Drive)</a>.</li>
</ul>
<h3>Something wrong?</h3>
<ul>
  <li><b>"Could not use that folder"</b>: the folder does not exist, or the app may not write there. Make the folder first in File Explorer, or pick another drive.</li>
  <li><b>"copying today's backup failed"</b>: the folder was saved, but the drive was not ready. Plug the disk in; the next daily backup tries again.</li>
</ul>
</section>

<section id="export-import">
<h2>Export Backup and Import Backup (Data Management)</h2>
<p>On the ${ui('Import/Export')} tab of Settings, the <b>Data Management</b> card saves your data to one file, or brings a file back. Use it to keep a copy on a pen drive, to move data to another computer, or to bring back just your clients or products from an older backup.</p>
<p>Your data is on this computer only. Nothing is uploaded to us or anyone else; the only time anything leaves your computer is when you tick <b>Also save a copy to my Google Drive</b>, which goes to <b>your own</b> Drive. The file is plain text (JSON) you can keep anywhere.</p>
<ul>
  <li>${ui('Export Backup…')}: see <a href="#export-backup">Export Backup</a>.</li>
  <li>${ui('Import Backup…')}: see <a href="#restore-from-backup">Restore from Backup</a>.</li>
</ul>
</section>

<section id="export-backup">
<h3>Export Backup</h3>
<ol class="steps">
  <li><strong>Open it</strong>Click ${ui('Export Backup…')}. A window lists every part of your data, all ticked.</li>
  <li><strong>Choose what to include</strong>Untick anything you do not want. ${ui('Select all')} and ${ui('Clear all')} tick or untick every one.</li>
  <li><strong>Google Drive copy (optional)</strong>Tick <b>Also save a copy to my Google Drive</b> if you set up <a href="settings.html#google-drive-api">Direct API Upload</a>.</li>
  <li><strong>Download</strong>Click ${ui('Download Backup')}. The file <code>freegstbill-backup-<i>date</i>.json</code> goes to your Downloads folder. Copy it somewhere safe.</li>
</ol>
<div class="table-wrap"><table>
  <tr><th>Part</th><th>What is in it</th></tr>
  <tr><td>Active business profile</td><td>Name, address, GSTIN, bank, logo, signature</td></tr>
  <tr><td>All business profiles</td><td>Every business in <a href="settings.html#business-profiles">Business Profiles</a></td></tr>
  <tr><td>Invoices / bills</td><td>Tax invoices, proforma, credit notes and the rest</td></tr>
  <tr><td>Clients</td><td>Your client list</td></tr>
  <tr><td>Products / Inventory</td><td>Products with HSN, rate and stock</td></tr>
  <tr><td>Expenses</td><td>Expense entries and the cash book</td></tr>
  <tr><td>Purchase bills</td><td>Supplier bills used for ITC, and purchase orders</td></tr>
  <tr><td>Recurring invoices</td><td>Repeat-billing schedules</td></tr>
  <tr><td>Receipts</td><td>Payment receipts</td></tr>
  <tr><td>Terms templates</td><td>Your terms and conditions templates</td></tr>
  <tr><td>App settings</td><td>Region, features, invoice number format, display options</td></tr>
  <tr><td>Local preferences</td><td>Custom units, theme, last region choice</td></tr>
</table></div>
</section>

<section id="restore-from-backup">
<h3>Restore from Backup</h3>
<ol class="steps">
  <li><strong>Pick the file</strong>Click ${ui('Import Backup…')} and choose a <code>.json</code> backup file.</li>
  <li><strong>Check what is in it</strong>The <b>Restore from Backup</b> window shows when the file was made and, for each part, how many items it holds. Parts the file has are ticked; empty parts say <i>empty</i> and cannot be ticked.</li>
  <li><strong>Choose what to restore</strong>Untick anything you want to keep as it is now. ${ui('Select all (with data)')} and ${ui('Clear all')} help.</li>
  <li><strong>Restore</strong>Click ${ui('Restore selected')}. The message lists what came back, such as <i>Restored: 120 invoice(s), 45 client(s)</i>.</li>
</ol>
<p>Records in the file <b>replace the matching records</b> in the app; records the file does not have are left alone, and parts you did not tick are untouched. Export your current data first, just in case.</p>
<h3>Something wrong?</h3>
<ul>
  <li><b>"This file doesn't look like a Free GST Billing backup"</b>: you picked a different file. Backups are named <code>freegstbill-backup-<i>date</i>.json</code>. A ZIP from the Control Panel is restored there, with ${ui('Choose Backup ZIP')}.</li>
  <li><b>Restored, but I do not see it</b>: reload the page, and check the business selected at the top of the sidebar.</li>
</ul>
</section>

<section id="trash">
<h2>Trash bin</h2>
<p>Invoices deleted from a client's account on the <a href="clients.html#ledger">Clients</a> screen, or from the invoice list, go to the trash for 30 days, then are removed for good. They are listed under <b>🗑 Trash bin</b> on the Backups tab of Settings, with the invoice number, client and date deleted.</p>
<ul>
  <li>${ui('Restore')} puts the invoice back where it was. The stock its delete returned is taken out again. The message says <i>Invoice restored</i>.</li>
  <li>${ui('Delete forever')} removes it and its PDF straight away, after asking. This cannot be undone.</li>
</ul>
<p>For an invoice already given to a client, <a href="dashboard.html#cancel">cancel it</a> instead of deleting it, so its number stays in your records.</p>
</section>

<section id="move-pc">
<h2>Moving to a new computer</h2>
<ol class="steps">
  <li><strong>On the old computer</strong>Click ${ui('Export for Move')} in the <a href="control-panel.html">Control Panel</a>, or ${ui('Move to another PC')} in the launcher under ${ui('More options')}. It saves your data and settings as one ZIP on your Desktop. Copy it to a pen drive or cloud storage.</li>
  <li><strong>On the new computer</strong><a href="install.html">Install the app</a> as usual.</li>
  <li><strong>Bring your data in</strong>In the new Control Panel, click ${ui('Choose Backup ZIP')} under <b>Restore Backup</b> and pick the file.</li>
</ol>
<p>You can use an exported backup file instead: <a href="#export-backup">export</a> on the old computer, and <a href="#restore-from-backup">import</a> it in Settings on the new one.</p>
<div class="note warn"><strong>One computer at a time</strong>
<p>Do not run the same data on two computers at once, for example through a shared OneDrive or Dropbox folder. Two copies writing the same files can damage them.</p></div>
</section>

<section id="update">
<h2>Updating</h2>
<p>Any of these installs the newest version:</p>
<ul>
  <li>The ${ui('Update to v…')} button that appears in the sidebar when a new version is out. It shows what changed, with ${ui('Update Now')}, ${ui('Remind me later')} and ${ui('Skip this version')}.</li>
  <li>${ui('Update Now')} in <a href="settings.html#updates">Settings, App Updates</a>.</li>
  <li>${ui('Update Now')} in the <a href="control-panel.html">Control Panel</a>.</li>
  <li>In the launcher, ${ui('More options')}, then ${ui('Update to the latest version')}.</li>
</ul>
<p>Every update first saves a backup of your data in <code>Documents\\FreeGSTBill Backups</code>, then replaces the app. It never touches your data folder or your saved PDFs. It takes about a minute; reload the page when it finishes.</p>
<p>To update by hand instead: download the ZIP, stop the app, extract the ZIP over your app folder replacing the files, and open the launcher again.</p>
<p>If you extract a new ZIP into a different folder by mistake, its launcher does not install a second copy. It shows <b>Already installed on this computer</b>, with the folder, version and number of invoices, and offers ${ui('Update the installed copy')} and ${ui('Open the installed copy')}. The update uses the files in the folder you extracted, so it needs no download and works without internet; your invoices, saved PDFs and trash stay as they are. The new folder can then be deleted.</p>
<p>Updating also removes files that older versions left behind, such as launchers under their old names, once their replacements are in place. Your data, backups and Node.js are never touched.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'control-panel',
  title: 'Control Panel',
  lead: 'Update, back up, restore, move to another PC, open your folders, and stop the app, from inside the app.',
  body: `
<section id="about">
<h2>What it is</h2>
<p>${ui('Control Panel')} in the sidebar does the launcher's jobs without leaving the app. At the top it shows your system, Node.js version, the port the app runs on, and how much space your data takes.</p>
</section>

<section id="actions">
<h2>The buttons</h2>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>Button</th><th>What it does</th></tr>
  <tr><td><a href="#update">Update Software</a></td><td>${ui('Update Now')}</td><td>Downloads the latest version. Your data is backed up first and never touched.</td></tr>
  <tr><td><a href="#backup">Backup Data</a></td><td>${ui('Create Backup')}</td><td>Saves your data as a dated ZIP in <code>Documents\\FreeGSTBill Backups</code>.</td></tr>
  <tr><td><a href="#restore">Restore Backup</a></td><td>${ui('Choose Backup ZIP')}</td><td>Pick a backup ZIP to restore. What you have now is saved first, as a safety net.</td></tr>
  <tr><td><a href="#move">Move to Another PC</a></td><td>${ui('Export for Move')}</td><td>Saves your data and settings as one ZIP on your Desktop. See <a href="backup.html#move-pc">Moving to a new computer</a>.</td></tr>
  <tr><td>Open Data Folder</td><td>${ui('Open')}</td><td>Opens the folder with your bills, clients, products and settings.</td></tr>
  <tr><td>Open Backups Folder</td><td>${ui('Open')}</td><td>Opens <code>Documents\\FreeGSTBill Backups</code>.</td></tr>
  <tr><td><a href="#restart">Restart the App</a></td><td>${ui('Restart')}</td><td>Restarts the app when something is not working, then reloads the page.</td></tr>
  <tr><td><a href="#stop">Stop Server</a></td><td>${ui('Stop Server')}</td><td>Stops the app. Open it again from the launcher or shortcut.</td></tr>
  <tr><td><a href="#remove">Remove the App</a></td><td>${ui('Remove…')}</td><td>Uninstalls the app. You tick whether your data, PDFs and backups are deleted too. Where it cannot remove itself, the button reads ${ui('How to remove it')} and opens the steps.</td></tr>
</table></div>
<p>After each action a panel shows whether it worked, with the details underneath if something went wrong. See <a href="#result">The result panel</a>. Each button is explained step by step below.</p>
<figure><img src="assets/img/app-control-panel.png" alt="The Control Panel." loading="lazy"><figcaption>The Control Panel.</figcaption></figure>
</section>

<section id="each">
<h2>Each button in detail</h2>
<p>One section per card: what it does, when to use it, what to click, and what to do if something looks wrong. Nothing here deletes your bills, clients or products. Anything that changes your data saves a copy first.</p>
</section>

<section id="update">
<h3>Update Software</h3>
<p><b>What it does.</b> Downloads the newest version from GitHub and puts it in place of the old one. Your data folder is not changed.</p>
<p><b>When to use it.</b> When a new version is out (we ship one most Saturdays) or a problem you reported has been fixed. You need internet.</p>
<ol>
  <li>Click ${ui('Update Now')}. The button shows <b>Updating...</b>; wait until it finishes. It can take a few minutes.</li>
  <li><b>Windows:</b> a black window opens. It first saves a backup of your data, <code>pre-update-<i>date</i>.zip</code>, in <code>Documents\\FreeGSTBill Backups</code>, then downloads and applies the update. It ends with <b>[OK] Update complete!</b></li>
  <li><b>Mac and Linux:</b> it does the same, saving the backup as <code>pre-update-<i>date</i>.tar.gz</code> in <code>Documents/FreeGSTBill Backups</code>. If you already have the newest version it says so and changes nothing. It ends with <b>[OK] Update complete</b> and the old and new version numbers.</li>
  <li>Restart the app to run the new version: click ${ui('Stop Server')} (see <a href="#stop">Stop Server</a>), then open the app again from its icon or launcher. Then press <kbd>Ctrl</kbd> + <kbd>F5</kbd> (Mac: <kbd>&#8984;</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).</li>
</ol>
<p><b>Is it safe?</b> Yes. Your data is backed up first and the update never touches the data folder. On Mac and Linux, if the update fails half way, the old app files are put back.</p>
<p><b>Something wrong?</b></p>
<ul>
  <li>"Update complete" but the old version still shows: <a href="troubleshooting.html#update-not-showing">the old version is still there</a>.</li>
  <li>An error, or "could not reach GitHub": <a href="troubleshooting.html#update-failed">an update went wrong</a>. On Linux or Mac also see <a href="troubleshooting.html#linux-update-failed">the Linux update stopped</a>.</li>
  <li>The button says <b>Not available here</b>: <a href="#scripts-missing">scripts not found</a>.</li>
</ul>
</section>

<section id="backup">
<h3>Backup Data</h3>
<p><b>What it does.</b> Saves all your bills, clients, products and settings as one dated ZIP file, <code>backup-<i>date_time</i>.zip</code>, in the <code>Documents\\FreeGSTBill Backups</code> folder (Mac and Linux: <code>Documents/FreeGSTBill Backups</code>).</p>
<p><b>When to use it.</b> Before a big change, at the end of the month, or any time you want a copy to keep on a pen drive. The app also makes its own daily backup; this is an extra one at a moment you choose.</p>
<ol>
  <li>Click ${ui('Create Backup')}. It shows <b>Backing up...</b> for a moment.</li>
  <li>The result panel below says <b>Backup - OK</b>, with the file name and size in its output. A folder window usually opens with the new file shown.</li>
  <li>Copy that ZIP to a pen drive or cloud storage so it survives if this computer breaks. ${ui('Open Backups Folder')} on the Control Panel opens the folder.</li>
</ol>
<p><b>Is it safe?</b> Yes. It only reads your data and writes a new file. Old backups are never replaced.</p>
<p><b>Something wrong?</b> If it says "No data folder found - nothing to back up", or fails with a disk or permission message, see <a href="troubleshooting.html#restore-failed">a backup or restore failed</a>, <a href="troubleshooting.html#disk-full">the disk is full</a> and <a href="troubleshooting.html#no-permission">the app is not allowed to write</a>. More ways to back up: <a href="backup.html">Backups and updates</a>.</p>
</section>

<section id="restore">
<h3>Restore Backup</h3>
<p><b>What it does.</b> Replaces the data in the app with the data from a backup ZIP you choose.</p>
<p><b>When to use it.</b> After moving to a new computer, or to go back to how things were on an earlier day. It works with ZIPs made by ${ui('Create Backup')} or ${ui('Export for Move')}.</p>
<ol>
  <li><b>Windows.</b> Click ${ui('Choose Backup ZIP')}. A file window opens in your <code>FreeGSTBill Backups</code> folder. Pick the ZIP and click <b>Open</b>. (Close the window to cancel; nothing changes.)</li>
  <li>The app first saves what you have now as <code>pre-restore-<i>date</i>.zip</code> in the same folder. This is your way back if you chose the wrong file.</li>
  <li>It then replaces the data with the backup's contents and shows <b>[OK] Restore complete!</b> Press <b>Enter</b> to close the black window.</li>
  <li>Restart the app (<a href="#stop">Stop Server</a>, then open it again) to see the restored data.</li>
</ol>
<p><b>Mac and Linux:</b> this button says <b>Not available here</b>. To bring data back there, use <b>Settings, Backup Management, Import Backup</b> with a file saved by Export Backup (see <a href="backup.html#export-import">Export and import</a>).</p>
<p><b>Is it safe?</b> Your current data is replaced by the backup, so what you entered after that backup was made will not be there. That is why a <code>pre-restore</code> copy is saved first. Keep it until you are happy.</p>
<p><b>Something wrong?</b> See <a href="troubleshooting.html#restore-failed">a backup or restore failed</a>. If the old data still shows, restart the app; if it will not open, see <a href="troubleshooting.html#not-answered">the server has not answered</a>.</p>
</section>

<section id="move">
<h3>Move to Another PC</h3>
<p><b>What it does.</b> Saves your data as one ZIP on your Desktop named <code>MOVE-FreeGSTBill-<i>date_time</i>.zip</code>, ready to carry to a new computer.</p>
<p><b>In the app installed with the Windows Setup:</b> this card is not there. Use ${ui('Backup Data')} on the old computer and ${ui('Restore Backup')} on the new one.</p>
<p><b>When to use it.</b> When you buy a new computer, or want the same books on a second one.</p>
<ol>
  <li><b>Windows:</b> click ${ui('Export for Move')}. A black window shows the progress and the size, then a folder window opens with the ZIP highlighted on your Desktop.</li>
  <li>Copy the ZIP to a pen drive, or send it to yourself by email or cloud storage.</li>
  <li>On the new PC, install the app (<a href="install.html">Install guide</a>), open the Control Panel and use ${ui('Choose Backup ZIP')} (<a href="#restore">Restore Backup</a>) to pick this file.</li>
</ol>
<p><b>Mac and Linux:</b> this button says <b>Not available here</b>. Follow <a href="backup.html#move-pc">Moving to a new computer</a> instead.</p>
<p><b>Is it safe?</b> Yes. It only makes a copy; your data here stays as it is. Keep the ZIP private, since it holds your business records.</p>
<p><b>Something wrong?</b> If it says "No data folder to export", or the disk is full, see <a href="troubleshooting.html#disk-full">the disk is full</a>; for the restore step see <a href="troubleshooting.html#restore-failed">a backup or restore failed</a>.</p>
</section>

<section id="restart">
<h3>Restart the App</h3>
<p><b>What it does.</b> Turns the app off and on again in a few seconds, then reloads the page by itself.</p>
<p><b>When to use it.</b> When something is not working: a page will not load, a button does nothing, or after an update or restore.</p>
<ol>
  <li>Save any bill you are typing. Then click ${ui('Restart')}. The button shows <b>Restarting...</b>.</li>
  <li>After a few seconds the page reloads with the app running again, on the same address.</li>
</ol>
<p><b>Is it safe?</b> Yes. Everything is saved as you work. A bill still being typed and not saved is not kept.</p>
<p><b>Something wrong?</b> If it says the app did not come back within 30 seconds, open it again from its Desktop icon or launcher. See <a href="troubleshooting.html#cannot-connect">Failed to fetch, App Not Running</a>.</p>
</section>

<section id="stop">
<h3>Stop Server</h3>
<p><b>What it does.</b> Turns the app off. The page stops answering until you open the app again.</p>
<p><b>In the app installed with the Windows Setup:</b> this card is not there. Right-click the app's icon near the clock and choose ${ui('Quit (stop the app)')}: it closes the window and stops the app.</p>
<p><b>When to use it.</b> After an update or restore, so the new version or data is loaded when you start it again. Also when the app seems stuck, or you want to shut it down cleanly.</p>
<ol>
  <li>Finish and save any bill you are typing. Then click ${ui('Stop Server')}.</li>
  <li><b>Windows:</b> it finds the app's process on your port and ends it. <b>Mac and Linux:</b> the app stops itself a moment after replying; the result panel says <b>Stopped. Open the app again from its icon or launcher.</b></li>
  <li>The browser page will then show errors such as "Failed to fetch". That is normal.</li>
  <li>Open the app again: double-click <b>Free GST Billing</b> on your Desktop (Mac: <b>Free GST Billing - MAC</b>; Linux: your start command).</li>
</ol>
<p><b>Is it safe?</b> Yes. Everything is saved as you work, so nothing already saved is lost. A bill still being typed and not saved is not kept. If the app runs as a service or in Docker, it may start again by itself.</p>
<p><b>Something wrong?</b> If it will not start again, see <a href="troubleshooting.html#cannot-connect">Failed to fetch, App Not Running</a> and <a href="troubleshooting.html#not-answered">the server has not answered</a>. Mac and Linux: <a href="troubleshooting.html#mac">Mac</a>, <a href="troubleshooting.html#linux">Linux and NAS</a>.</p>
</section>

<section id="remove">
<h3>Remove the App</h3>
<p><b>What it does.</b> Uninstalls Free GST Billing from this computer in one go: the app, its Desktop and Start-menu icons (Mac: the app in Applications; Linux: the menu entry) and the start-with-computer entry. You choose what else goes.</p>
<p><b>In the app installed with the Windows Setup:</b> the button is ${ui('Open Windows Apps')}. It opens Windows' <b>Settings → Apps → Installed apps</b>: find Free GST Billing, click the three dots, then <b>Uninstall</b>. It asks whether to delete your books too; the answer is No unless you choose Yes.</p>
<ol>
  <li>Click ${ui('Remove…')}. A list opens below the cards. (On Windows the launcher window has the same: <b>More options</b> → ${ui('Remove the app...')}.)</li>
  <li>Tick what to delete as well. Nothing is ticked at first, so by default <b>only the program goes and your books stay</b>:
    <ul>
      <li><b>My invoices, clients, products and settings</b>: the data folder, with the daily backups inside it.</li>
      <li><b>Saved invoice PDFs</b>: the <code>Saved Invoices</code> and <code>Trash</code> folders.</li>
      <li><b>All backup files</b> in <code>Documents\\FreeGSTBill Backups</code>.</li>
    </ul>
    ${ui('Select everything')} ticks all three, for a computer you are giving away.</li>
  <li>Click ${ui('Remove the app')}. If your data is ticked, it asks once more. The app closes and the page says it is being removed. Close the window.</li>
</ol>
<p><b>Is it safe?</b> If you delete your data but keep the backups, a last copy, <code>before-removal-<i>date</i>.zip</code> (Mac and Linux: <code>.tar.gz</code>), is saved in <code>Documents\\FreeGSTBill Backups</code> first. If that copy cannot be made, your data is kept. Whatever you keep stays in the app folder; install the app into the same folder again and it is all there. Other files you put in the app folder yourself are not touched, and neither is a second backup folder you chose in Settings.</p>
<p><b>Something wrong?</b> If the button reads ${ui('How to remove it')}, the app is running from source code or an old ZIP and cannot remove itself; the button opens <a href="install.html#uninstall">Removing the app</a> with the other ways. On Windows, if a file is in use, a message names the folder to delete by hand after a restart.</p>
</section>

<section id="result">
<h3>The result panel</h3>
<p>After you click an action, a panel appears at the bottom with a green tick and <b>OK</b>, or a red mark and <b>Failed</b>, next to the action's name. A short pop-up message appears too.</p>
<ul>
  <li><b>Output</b>: what the script printed, such as where a backup file was saved.</li>
  <li><b>Errors</b>: shown only when something went wrong. Copy this text when you <a href="troubleshooting.html#report-problem">report a problem</a>.</li>
  <li>A red line of text: the reason in plain words, for example that the script is not in the app folder.</li>
</ul>
<p>The panel is cleared each time you click another button, so it only describes the last action.</p>
<p><b>Something wrong?</b> Check <a href="troubleshooting.html#scripts-not-found">"Not available here"</a>, <a href="troubleshooting.html#restore-failed">a backup or restore failed</a> and <a href="troubleshooting.html#update-failed">an update went wrong</a>.</p>
</section>

<section id="scripts-missing">
<h2>"Update and backup scripts not found"</h2>
<p>The Control Panel runs scripts that come with the downloaded ZIP, in the <code>_system</code> folder. This message appears when they are missing, for example when the app was started from source code or copied without them. Install from the <a href="install.html#download">downloaded ZIP</a> to get them, or use <a href="backup.html#export-import">Export Backup</a> in Settings for your data.</p>
<p>Versions 1.10.44 to 1.10.71 showed this message, then called "Launcher scripts not detected", on every installed copy by mistake. Update to 1.10.72 or later using the launcher's <b>Update to the latest version</b>.</p>
<p>On Linux and macOS only Update and Backup have scripts, so Restore, Move and Stop show <b>Not available here</b>.</p>
</section>
`,
},
];
