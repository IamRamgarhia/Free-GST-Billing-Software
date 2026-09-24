const ui = (s) => `<span class="ui">${s}</span>`;

export default [
// =============================================================================
{
  slug: 'settings',
  title: 'Settings',
  lead: 'Every section of Settings, in the order it appears: your business, bank accounts, invoice numbers, logo and stamp, more than one business, terms, features, stock alerts, region, backups, Google Drive, import and export, and updates.',
  body: `
<section id="save-bar">
<h2>Saving your changes</h2>
<p>A bar at the top of Settings says whether <b>Company Details</b> has unsaved changes. When it does, it turns amber, with ${ui('Discard')} to undo them and ${ui('Save Profile')} to keep them.</p>
<p>Not everything waits for Save Profile:</p>
<table>
  <tr><th>Saves by itself as you change it</th><th>Has its own Save button</th><th>Needs Save Profile</th></tr>
  <tr><td>Payment accounts, Modules, Region</td><td>Invoice number format, Low-stock alerts, Terms templates</td><td>Company details, PAN, logo, signature, stamp, GSTR filing details, Google Drive fields</td></tr>
</table>
<p>The row of buttons under the title jumps to each section.</p>
</section>

<section id="company-details">
<h2>Company details</h2>
<p>The header of every invoice.</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Business Name</td><td>Required</td></tr>
  <tr><td>Country</td><td>India to start. The list follows your <a href="#region">Region</a>.</td></tr>
  <tr><td>Address, City, PIN Code</td><td></td></tr>
  <tr><td>State</td><td>The one to get right: it decides whether GST is split into CGST and SGST or charged as IGST</td></tr>
  <tr><td>GSTIN</td><td>Warns if the format looks wrong. The label changes for other countries, such as VAT or TRN.</td></tr>
  <tr><td>Email, Phone</td><td></td></tr>
</table></div>
</section>

<section id="gstr-details">
<h2>GSTR filing details</h2>
<p>Indian businesses only, and only used in the <a href="gst-returns.html#json-checks">GSTR-1 and GSTR-3B files</a>. All optional.</p>
<ul>
  <li><strong>Aggregate turnover (AATO) is above ₹5 crore</strong>: tick it if so. HSN codes then need 6 digits instead of 4.</li>
  <li><strong>Previous FY aggregate turnover</strong> and <strong>Current FY turnover so far</strong>, in rupees. You can also change these on the portal while filing.</li>
</ul>
</section>

<section id="payment-accounts">
<h2>Bank accounts and UPI</h2>
<p>Add as many bank and UPI accounts as you like with ${ui('+ Add account')}. Each account has:</p>
<div class="table-wrap"><table>
  <tr><th>Field</th><th>What to know</th></tr>
  <tr><td>Label</td><td>Your name for it, such as "HDFC Current - 1234"</td></tr>
  <tr><td>Account Holder Name</td><td>Leave blank to use your business name</td></tr>
  <tr><td>Bank Name, Account Number</td><td></td></tr>
  <tr><td>Account Type</td><td>Optional: Savings, Current, Cash Credit, Overdraft, NRE or NRO</td></tr>
  <tr><td>IFSC Code</td><td>Or the local bank code outside India</td></tr>
  <tr><td>SWIFT / BIC</td><td>Optional, for payments from abroad</td></tr>
  <tr><td>UPI ID</td><td>Optional. With one, rupee invoices using this account carry a QR code the client can scan to pay the exact amount.</td></tr>
  <tr><td>Internal notes</td><td>Never printed</td></tr>
  <tr><td>Set as default</td><td>The ⭐ account is used on new invoices</td></tr>
</table></div>
<p>In the list, each account has buttons to make it the default (⭐), move it up or down, switch it off or on, edit and delete it. Switched-off accounts are not offered on new invoices. Deleting one never changes invoices already made with it: they keep the bank details they were saved with.</p>
<p>Pick a different account for one invoice under <a href="invoice-options.html#tds-tcs-account">Customize</a>.</p>
<p><b>PAN Number</b>, below the accounts, prints in the bank details block. It needs Save Profile.</p>
<p>If you set up bank details in an older version, a banner offers ${ui('Import &amp; continue')} to turn them into your first account.</p>
</section>

<section id="invoice-numbers">
<h2>Invoice number format</h2>
<p>The preview at the top shows exactly how the next number will look.</p>
<table>
  <tr><td>Branded Sequential</td><td><code>PREFIX/2026-27/0001</code>, with the financial year. The default.</td></tr>
  <tr><td>Simple Sequential</td><td><code>PREFIX/0001</code></td></tr>
  <tr><td>Random</td><td><code>PREFIX/A3X9K2</code></td></tr>
</table>
<p>Under ${ui('⚙ Customize prefix, separator &amp; padding')}:</p>
<ul>
  <li><strong>Brand Prefix</strong>: up to 10 capital letters and digits, such as ACME. Leave it empty to use each type's own prefix: INV, EST, BOS, COMP, CN and DC.</li>
  <li><strong>Separator</strong>: <code>/</code>, <code>-</code> or <code>#</code>.</li>
  <li><strong>Include Financial Year</strong>: yes or no.</li>
  <li><strong>Number Padding</strong>: 3 to 6 digits, such as 0001.</li>
</ul>
<p>Click ${ui('Save Number Format')}. Each document type keeps its own count. A type can also have its own prefix in <a href="print-settings.html#prefixes">Print Settings</a>.</p>
<figure><img src="assets/img/app-settings-accounts.png" alt="A payment account, and the invoice number format with its preview." loading="lazy"><figcaption>A payment account, and the invoice number format with its preview.</figcaption></figure>
</section>

<section id="branding">
<h2>Logo, signature and stamp</h2>
<p>Upload each one separately. Any image up to 5 MB works; large images are made smaller for you. A signature or stamp on a transparent PNG looks best. Each has a size slider: logo 24 to 80 pixels high, signature 30 to 110, stamp 30 to 120.</p>
<p>Click ${ui('Save Profile')} to keep them. The signature and stamp print side by side above the signatory's name, and on a long invoice they always move to the next page together rather than being split.</p>
<p>A photo from an iPhone in HEIC format may not open; share it as JPEG first.</p>
</section>

<section id="multiple-businesses">
<h2>More than one business</h2>
<p>If you run more than one business, each gets its own profile with its own GSTIN, bank accounts, logo and signature, and its <b>own books</b>. Invoices, totals, purchases, expenses, receipts, recurring invoices, reports and GST returns all follow the business selected at the top of the sidebar.</p>
<ul>
  <li>${ui('+ Add New Profile')} saves the business on screen to the list, then clears the form for the new one. Fill it in and click Save Profile.</li>
  <li>${ui('Save as Profile')} saves the form into the list, or updates the entry with the same name.</li>
  <li>${ui('Switch')} on a card changes business. The current one is saved first.</li>
  <li>Deleting a profile only removes it from the list. Its invoices stay.</li>
</ul>
<p>Your client list is shared by all businesses. Records made before you had several businesses show under all of them until you <a href="purchases.html#unassigned">assign them</a>.</p>
</section>

<section id="terms">
<h2>Terms and conditions templates</h2>
<p>Keep the terms you use as templates, then pick one on each invoice.</p>
<ul>
  <li><strong>Quick Start</strong>: one click adds a ready-made set for Services, Goods, Manufacturing and Trading, Export, or Freelancer.</li>
  <li>${ui('+ New Template')}: give it a name and paste your terms.</li>
</ul>
<p>Deleting a template does not change invoices that used it.</p>
</section>

<section id="print-settings">
<h2>Print and PDF settings</h2>
<p>The app-wide look of every invoice has its own page: <a href="print-settings.html">Print and PDF settings</a>.</p>
</section>

<section id="modules">
<h2>Turning features off</h2>
<p>Untick anything you do not use, and it disappears from the sidebar and forms. Your data is kept, and ticking it again brings it all back.</p>
<div class="table-wrap"><table>
  <tr><th>Group</th><th>Features</th></tr>
  <tr><td>Sales &amp; Invoicing</td><td>Invoices (always on), Recurring invoices, Payment receipts</td></tr>
  <tr><td>Directory</td><td>Clients (always on), Products &amp; Services</td></tr>
  <tr><td>Purchases &amp; Expenses</td><td>Expense tracker, Purchase bills, GSTR-2B reconciliation</td></tr>
  <tr><td>GST &amp; Tax (India)</td><td>GSTR-1 / GSTR-3B, E-Way Bill, TDS / TCS on invoices (<b>off</b> to start), Income Tax Helper</td></tr>
  <tr><td>Reports</td><td>Dashboard (always on), Reports</td></tr>
  <tr><td>Integrations</td><td>Google Drive backup, UPI QR code on invoices</td></tr>
</table></div>
<p>🇮🇳 marks features that only apply in India. They are hidden when Region is International. ${ui('Reset to default')} puts every feature back as it was on install.</p>
</section>

<section id="stock">
<h2>Low-stock alerts</h2>
<p><b>Show low-stock alerts</b> is on to start. Set the threshold with a chip, 0, 3, 5 (recommended) or 10, or type a number, then click ${ui('Save')}. With alerts off, stock is still counted; you are just not warned.</p>
</section>

<section id="region">
<h2>Region</h2>
<table>
  <tr><td>🇮🇳 India only</td><td>GST, rupees first, GSTR-1 and 3B, e-way bill, UPI QR</td></tr>
  <tr><td>🌍 International</td><td>VAT and other tax names, several currencies, no India-only features</td></tr>
  <tr><td>🌐 Both / Auto</td><td>All countries, chosen per invoice. The default.</td></tr>
</table>
<p>It saves as soon as you click, and changes the country lists and which features you see. Your data is not touched.</p>
</section>

<section id="backups">
<h2>Daily backups and the trash bin</h2>
<p>Settings lists the automatic daily backups, with ${ui('Backup now')}, ${ui('Restore')} and ${ui('Delete')}, and the trash bin for deleted invoices. See <a href="backup.html#automatic-backups">Automatic daily backups</a> and <a href="backup.html#trash">Trash</a>.</p>
</section>

<section id="google-drive">
<h2>Google Drive</h2>
<p><strong>The easy way</strong>: install <a href="https://www.google.com/drive/download/">Google Drive for Desktop</a>, sign in, and move the app's <code>Saved Invoices</code> folder into your Drive, or set it to sync. Every PDF you download is then in your Drive, on any device. No setup in the app is needed.</p>
<p><strong>Direct upload</strong>, under <b>Advanced</b>, is for people comfortable with Google Cloud: it needs a Google OAuth Client ID of your own. Enter it and a folder name, click Save Profile, then ${ui('Connect Google Drive')}. After that, ${ui('Save &amp; Download')} uploads each invoice PDF, and a backup can be saved to Drive when exporting.</p>
</section>

<section id="data">
<h2>Import and export (Data Management)</h2>
<p>${ui('Export Backup…')} and ${ui('Import Backup…')} move your data in and out as one file. See <a href="backup.html#export-import">Export everything to one file</a>.</p>
</section>

<section id="updates">
<h2>Updates</h2>
<p>${ui('Check for Updates')} shows your version and the latest. If there is a newer one, ${ui('Update Now')} backs up your data and installs it; reload the page when it finishes. See <a href="backup.html#update">Updating</a>.</p>
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
<h2>Automatic daily backups</h2>
<p>Every day the app copies all your data into a dated backup, and keeps the last 30 days. They are listed in <b>Settings, Backup Management</b>:</p>
<ul>
  <li>${ui('Backup now')} makes one straight away.</li>
  <li>${ui('Restore')} puts all your data back as it was on that day. It saves what you have now first, so you can go back if it looks wrong. Reload the page afterwards.</li>
  <li>${ui('Delete')} removes one backup to free space.</li>
</ul>
<div class="note warn"><strong>These are on the same computer</strong>
<p>Daily backups protect you from mistakes, not from a broken hard disk or a lost laptop. Keep a copy somewhere else too.</p></div>
</section>

<section id="backup-copy">
<h2>Keeping a copy somewhere else</h2>
<ul>
  <li><strong>One click</strong>: ${ui('Create Backup')} in the <a href="control-panel.html">Control Panel</a>, or ${ui('Back up my data')} in the launcher under ${ui('More options')}, saves a ZIP in <code>Documents\\FreeGSTBill Backups</code>. Copy it to a pen drive or cloud storage.</li>
  <li><strong>One file you choose</strong>: see <a href="#export-import">Export everything to one file</a>.</li>
  <li><strong>Google Drive</strong>: see <a href="settings.html#google-drive">Google Drive</a>.</li>
</ul>
</section>

<section id="export-import">
<h2>Export everything to one file</h2>
<p>In <b>Settings, Data Management</b>, ${ui('Export Backup…')} lets you tick what to include; everything is ticked to start:</p>
<p>active business profile, all business profiles, invoices, clients, products, expenses, purchase bills, recurring invoices, receipts, terms templates, app settings, and local preferences such as custom units and theme.</p>
<p>${ui('Download Backup')} saves <code>freegstbill-backup-<i>date</i>.json</code>. Tick <b>Also save a copy to my Google Drive</b> if you have connected Drive.</p>
<p>${ui('Import Backup…')} reads a backup file and shows what is in it, with a count for each part, before anything changes. Tick the parts to restore and click ${ui('Restore selected')}. Records in the file replace the matching records in the app; anything you did not tick is left alone. Export your current data first, just in case.</p>
</section>

<section id="trash">
<h2>Trash</h2>
<p>Invoices deleted from a client's account on the <a href="clients.html#ledger">Clients</a> screen go to the trash for 30 days. In <b>Settings, Backup Management</b>, ${ui('Restore')} brings one back, and ${ui('Delete forever')} removes it and its PDF for good.</p>
</section>

<section id="move-pc">
<h2>Moving to a new computer</h2>
<ol class="steps">
  <li><strong>On the old computer</strong>Click ${ui('Export for Move')} in the <a href="control-panel.html">Control Panel</a>, or ${ui('Move to another PC')} in the launcher under ${ui('More options')}. It saves your data and settings as one ZIP on your Desktop. Copy it to a pen drive or cloud storage.</li>
  <li><strong>On the new computer</strong><a href="install.html">Install the app</a> as usual.</li>
  <li><strong>Bring your data in</strong>In the new Control Panel, click ${ui('Choose Backup ZIP')} under <b>Restore Backup</b> and pick the file.</li>
</ol>
<p>You can use an exported backup file instead: <a href="#export-import">export</a> on the old computer, and import it in Settings on the new one.</p>
<div class="note warn"><strong>One computer at a time</strong>
<p>Do not run the same data on two computers at once, for example through a shared OneDrive or Dropbox folder. Two copies writing the same files can damage them.</p></div>
</section>

<section id="update">
<h2>Updating</h2>
<p>Any of these installs the newest version:</p>
<ul>
  <li>The ${ui('Update to v…')} button that appears in the sidebar when a new version is out. It shows what changed, with ${ui('Update Now')}, ${ui('Remind me later')} and ${ui('Skip this version')}.</li>
  <li>${ui('Update Now')} in <b>Settings, App Updates</b>.</li>
  <li>${ui('Update Now')} in the <a href="control-panel.html">Control Panel</a>.</li>
  <li>In the launcher, ${ui('More options')}, then ${ui('Update to the latest version')}.</li>
</ul>
<p>Every update first saves a backup of your data in <code>Documents\\FreeGSTBill Backups</code>, then replaces the app. It never touches your data folder or your saved PDFs. It takes about a minute; reload the page when it finishes.</p>
<p>To update by hand instead: download the ZIP, stop the app, extract the ZIP over your app folder replacing the files, and open the launcher again.</p>
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
  <tr><td>Update Software</td><td>${ui('Update Now')}</td><td>Downloads the latest version. Your data is backed up first and never touched.</td></tr>
  <tr><td>Backup Data</td><td>${ui('Create Backup')}</td><td>Saves your data as a dated ZIP in <code>Documents\\FreeGSTBill Backups</code>.</td></tr>
  <tr><td>Restore Backup</td><td>${ui('Choose Backup ZIP')}</td><td>Pick a backup ZIP to restore. What you have now is saved first, as a safety net.</td></tr>
  <tr><td>Move to Another PC</td><td>${ui('Export for Move')}</td><td>Saves your data and settings as one ZIP on your Desktop. See <a href="backup.html#move-pc">Moving to a new computer</a>.</td></tr>
  <tr><td>Open Data Folder</td><td>${ui('Open')}</td><td>Opens the folder with your bills, clients, products and settings.</td></tr>
  <tr><td>Open Backups Folder</td><td>${ui('Open')}</td><td>Opens <code>Documents\\FreeGSTBill Backups</code>.</td></tr>
  <tr><td>Stop Server</td><td>${ui('Stop Server')}</td><td>Stops the app. Open it again from the launcher or shortcut.</td></tr>
</table></div>
<p>After each action a panel shows whether it worked, with the details underneath if something went wrong.</p>
<figure><img src="assets/img/app-control-panel.png" alt="The Control Panel." loading="lazy"><figcaption>The Control Panel.</figcaption></figure>
</section>

<section id="scripts-missing">
<h2>"Launcher scripts not detected"</h2>
<p>This appears when the app was started from source code rather than the downloaded ZIP. Update, backup, restore, move and stop then do not work. Install from the <a href="install.html#download">downloaded ZIP</a> to use them, or use <a href="backup.html#export-import">Export Backup</a> in Settings for your data.</p>
</section>
`,
},
];
