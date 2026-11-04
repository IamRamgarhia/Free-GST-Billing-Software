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
  <li><strong>The screens</strong>: Dashboard, New Invoice, Clients, Products, Expenses, Purchases, Recurring, Receipts, Cash book, Reports, GST Returns and Income Tax. Features you <a href="settings.html#features">turn off</a> disappear from here.</li>
  <li><strong>Update to v…</strong>, when a new version is out.</li>
  <li><a href="#support"><strong>Support &amp; About</strong></a>, <strong>Control Panel</strong> and <strong>Settings</strong>.</li>
  <li>A dot on <b>Control Panel</b>: green when the app is running, red when it is not (hover over it to read which).</li>
</ul>
<p>At the end of the Dashboard, below the invoices, a small line shows the app's version, a link to DiceCodes and <a href="#support">Support</a>. It is never printed.</p>
<p>The ☰ button beside the app name shrinks the sidebar to a slim strip of icons and gives the page more room; it is highlighted while the menu hides itself. Point at the strip to open it. Click ☰ again to keep the menu open.</p>
<p><b>At the top right of every screen</b> are small buttons: <b>?</b> opens this User Guide in your browser (it needs internet), the 🔔 bell opens <a href="#notifications">Notifications</a>, the Wi-Fi button turns <a href="security.html#offline-mode">Offline mode</a> on or off and shows what it changes (it turns orange, with a line through it, while Offline mode is on), the moon or sun switches <a href="#dark-mode">dark mode</a>, and, when a <a href="settings.html#lock">PIN</a> is set, the padlock locks the app. On a phone they sit in the bar at the top, beside the ☰ menu button. You can hide or reorder them in <a href="settings.html#features-menu">Settings → Features</a>.</p>
<p>On a narrow screen, the sidebar folds away behind the ☰ menu button.</p>
<figure class="narrow"><img src="assets/img/dashboard-phone.png" alt="The Dashboard on a phone: the ☰ menu button, app name, business name and the ?, bell and moon buttons in the bar at the top, then the Dashboard buttons, the overdue banner and the total cards one under another." loading="lazy"><figcaption>The Dashboard at phone width.</figcaption></figure>
</section>

<section id="support">
<h2>Support &amp; About</h2>
<p>Who makes the app, and how to help it grow. Free ways come first: star it on GitHub, tell another business, report a bug or ask for a feature. If you want to give money, scan the UPI QR with any UPI app, for any amount. The page also lists what DiceCodes builds for businesses: custom software and web apps, changes to this app, setup and data migration, support plans, AI integration and automation, and mobile apps.</p>
<p>The app stays free whatever you choose. Nothing is locked, and nothing is ever printed on your invoices. Once you have made 10 invoices, the Dashboard shows a small <a href="dashboard.html#support-card">support card</a> once a day; ${ui('Not today')} hides it until tomorrow and ${ui('Hide for 30 days')} for a month.</p>
<p>Scanning the QR fills in the payment note "Free GST Billing support - <i>your business name</i>", so DiceCodes can thank you; untick <b>Include my business name</b> to leave it out. The page also shows how much users have given so far and what it is going towards.</p>
<p>Once a month at most, a one-line note at the top of the app asks for a star on GitHub. ${ui('✕')} hides it for 30 days; ${ui('Star on GitHub')} or ${ui('Already starred')} hides it for good. It never appears while you are making an invoice.</p>
</section>

<section id="switch-business">
<h2>Switching business</h2>
<p>With more than one business saved, click its name at the top of the sidebar and choose another. Every screen changes to that business's invoices, purchases, expenses, receipts, recurring invoices, reports and returns. <b>Manage profiles…</b> opens <a href="settings.html#multiple-businesses">Settings</a>.</p>
</section>

<section id="notifications">
<h2>Notifications</h2>
<p>The 🔔 bell at the top right of every screen has a small red count when something needs you. It is your daily to-do list: who has not paid, what is due soon, which return to file, what to re-order. The app works it out by itself when it opens and again every 10 minutes; nothing is sent to you by SMS or email.</p>
<p>Click it to open the <b>Notifications</b> window. Each line is a button: click it and the window closes and takes you to the screen where you deal with it.</p>
<div class="table-wrap"><table>
  <tr><th>Line</th><th>What it means</th><th>Clicking it opens</th></tr>
  <tr><td>🔁 <b>N recurring invoices auto-generated today</b></td><td>The app made invoices from your <a href="recurring.html#automatic">recurring templates</a> today. Check them and download the PDFs.</td><td>Dashboard</td></tr>
  <tr><td>⚠ <b>N overdue invoices</b></td><td>Tax invoices, bills of supply and composition bills not fully paid whose <b>Due Date</b> has passed. The first three numbers are shown. Quotations, proformas, challans, credit notes and cancelled invoices never appear.</td><td>Dashboard (see <a href="dashboard.html#overdue">Overdue invoices and reminders</a>)</td></tr>
  <tr><td>⏰ <b>N invoices due in next 3 days</b></td><td>Unpaid sales whose due date is today or within 3 days, with the client's name. A good time for a polite reminder.</td><td>Dashboard</td></tr>
  <tr><td>📋 <b>N GST filings due in next 10 days</b></td><td>GSTR-1, GSTR-3B, TDS, TCS, advance tax and ITR dates coming up, with how many days are left ("today" or "4d").</td><td>GST Returns (see <a href="gst-returns.html#filing-guide">the filing guide</a>)</td></tr>
  <tr><td>📦 <b>N products low on stock</b></td><td>Products at or below your low-stock limit (5 unless you changed it), with how many are left. Not shown when stock alerts are off in <a href="settings.html#stock">Settings</a>.</td><td>Products (see <a href="products.html#low-stock">Low stock</a>)</td></tr>
</table></div>
<p>When nothing needs you, the window says <b>All clear ✨ — nothing needs your attention right now.</b></p>
<p>${ui('Mark all as read')} clears everything shown and the count goes to zero. The app remembers exactly what you cleared, so a line comes back by itself only when something changes: a new invoice becomes overdue, a different product runs low, or the stock number changes. Clearing does not mark any invoice as paid; record the payment on the <a href="dashboard.html#payments">Dashboard</a> for that.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>An invoice I was paid for still shows as overdue.</b> The payment is not recorded yet. Record it with the ${ui('₹')} button on the Dashboard and the line goes away at the next check.</p>
<p><b>No due-date reminders at all.</b> Only invoices with a <b>Due Date</b> can become overdue or due soon. Set one in <a href="invoices.html#details">Invoice Details</a>, or give the client payment terms.</p>
<p><b>The filing dates do not match my returns.</b> The dates are the usual monthly due dates. If you file quarterly (QRMP) or the government extends a date, go by the GST portal.</p>
</div>
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
<ol class="steps">
  <li><strong>Open it</strong>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (Mac: <kbd>⌘</kbd> + <kbd>K</kbd>). A box opens with <b>Type a command or page name…</b></li>
  <li><strong>Type a few letters</strong>For example <code>gst</code>, an invoice number such as <code>0012</code>, or part of a client's name. The list narrows as you type.</li>
  <li><strong>Pick one</strong>Move with <kbd>↑</kbd> <kbd>↓</kbd> and press <kbd>Enter</kbd>, or click it. The box closes and the screen opens.</li>
</ol>
<p><kbd>Esc</kbd>, or a click outside the box, closes it. If nothing fits you see <b>Nothing matches "…"</b>: try fewer letters. ${ui('All shortcuts (Ctrl+/)')} at the bottom opens the list of <a href="#keyboard">keyboard shortcuts</a>.</p>
<figure><img src="assets/img/app-palette.png" alt="Quick search finding a client and their invoices." loading="lazy"><figcaption>Quick search finding a client and their invoices.</figcaption></figure>
</section>

<section id="keyboard">
<h2>Keyboard shortcuts</h2>
<table>
  <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Quick search</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>N</kbd></td><td>New invoice</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td><td>Save the invoice (on the invoice screen)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>P</kbd></td><td>Download the PDF (on the invoice screen)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd></td><td>Lock the app (when a PIN is set)</td></tr>
  <tr><td><kbd>Ctrl</kbd> + <kbd>/</kbd></td><td>Show or hide the <b>Keyboard Shortcuts</b> window, which lists these</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>Close a dialog</td></tr>
  <tr><td><kbd>Enter</kbd></td><td>Confirm a dialog</td></tr>
</table>
<p>On the invoice screen there are more: see <a href="invoices.html#keyboard">Keyboard shortcuts on this screen</a>. On a Mac, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.</p>
</section>

<section id="dark-mode">
<h2>Dark mode</h2>
<p>The moon button at the top right of every screen switches the app to dark colours, and the sun button switches back. Invoices and PDFs always print in their normal colours.</p>
<figure><img src="assets/img/dashboard-dark.png" alt="The Dashboard in dark mode: dark sidebar and cards, with the sun button at the top right to switch back." loading="lazy"><figcaption>The Dashboard in dark mode. The sun button at the top right switches back.</figcaption></figure>
</section>

<section id="install-as-app">
<h2>Opening it like a desktop app</h2>
<p>It already is one. The <b>Free GST Billing</b> icon (the blue <b>B</b>) on your Desktop and in the Start menu starts the app and opens it in its own window, with no tabs or address bar.</p>
<p>Don't use the browser's own ${ui('Install app')} button (in Chrome or Edge's address bar). That makes a second icon which opens a window but cannot start the app, so after a restart it only shows "Needs a Quick Start". If you have one, right-click it and choose ${ui('Uninstall')}.</p>
</section>

<section id="app-not-running">
<h2>"Needs a Quick Start"</h2>
<p>If the app's engine is not running, the page says <b>Free GST Billing Software Needs a Quick Start</b>. Your data is safe. Double-click the <b>Free GST Billing</b> icon on your Desktop or in the Start menu: it starts the app, and the page carries on by itself once it is running. An app icon made by Chrome or Edge cannot start the app; use ours, and remove the other one (right-click it, then ${ui('Uninstall')}).</p>
</section>
`,
},

// =============================================================================
{
  slug: 'troubleshooting',
  title: 'Troubleshooting and questions',
  nav: 'Troubleshooting',
  lead: 'Every message the app, the launcher and the installer can show, what it means, and the steps to fix it yourself.',
  body: `
<p>Find your message below (<kbd>Ctrl</kbd> + <kbd>F</kbd> helps; on a Mac <kbd>⌘</kbd> + <kbd>F</kbd>). Your data is safe in every case listed here.</p>
<p><a href="#installing">Installing</a> · <a href="#starting">Starting</a> · <a href="#updating">Updating</a> · <a href="#saving">Saving and working</a> · <a href="#printing">Printing and PDFs</a> · <a href="#gst-returns-problems">GST and returns</a> · <a href="#backups">Backups</a> · <a href="#mac">Mac</a> · <a href="#linux">Linux and NAS</a> · <a href="#problem-log">Problem log</a> · <a href="#questions">Questions</a></p>

<section id="installing">
<h2>Installing</h2>
<p>Messages from the launcher and the black install window, the first time you set the app up.</p>
</section>

<section id="files-missing">
<h3>"Please extract the ZIP first" or "Some files are missing"</h3>
<p>You may see: <strong>"Please extract the ZIP first"</strong>, <strong>"Some files are missing"</strong>, <strong>"The _system folder is not next to this launcher"</strong>, <strong>"_system folder is missing. Please re-extract the ZIP or re-download from GitHub."</strong> (Mac and Linux), <strong>"Missing file: start-windows.ps1"</strong> or <strong>"Could not find start-windows.ps1"</strong>.</p>
<p>The launcher was opened from inside the ZIP, or the ZIP was only partly extracted, so the rest of the app is not next to it.</p>
<ol>
  <li>Close the launcher.</li>
  <li>Right-click the ZIP and choose ${ui('Extract All…')}.</li>
  <li>Open the extracted <b>Free-GST-Billing</b> folder and double-click the launcher there. Keep the launcher and the <code>_system</code> folder together.</li>
  <li>Still missing? Download the ZIP again; the download may have been cut short.</li>
</ol>
<p>See <a href="install.html#extract-first">Step 2: Unzip (extract) it</a>.</p>
</section>

<section id="windows-protected">
<h3>"Windows protected your PC"</h3>
<p>Windows shows this the first time for any program without a paid certificate. Nothing is wrong.</p>
<ol>
  <li>Click ${ui('More info')}, then ${ui('Run anyway')}.</li>
  <li>If it still will not open, right-click the launcher, choose ${ui('Properties')}, tick ${ui('Unblock')} and click ${ui('OK')}.</li>
</ol>
<p>See <a href="install.html#windows-protected">"Windows protected your PC"</a>.</p>
</section>

<section id="install-failed">
<h3>The install stopped with an error</h3>
<p>The black window shows <strong>PROBLEM:</strong> and what went wrong. Fix it, then click ${ui('Install')} again; it carries on where it stopped.</p>
<ul>
  <li><strong>"The app cannot reach the internet to download its packages"</strong>, <strong>"Could not download Node.js"</strong> or <strong>"The download did not work"</strong>: the first install needs the internet. Check the connection (open any website). On an office network, a proxy or firewall may block it; ask whoever runs the network to allow <code>registry.npmjs.org</code> and <code>nodejs.org</code>.</li>
  <li><strong>"The app packages did not install"</strong>: the internet, disk and folder look fine, so antivirus is the usual cause. Add the Free-GST-Billing folder to its exclusions and click ${ui('Install')} again.</li>
  <li><strong>"Node.js could not be set up automatically"</strong>: install Node.js LTS yourself from <a href="https://nodejs.org">nodejs.org</a> (the page opens by itself), keep the default options, and open the launcher again. If antivirus removed it, add the folder to its exclusions.</li>
  <li><strong>"Windows can install Node.js LTS for this PC ... Install Node.js LTS now?"</strong>: the app could not download Node.js itself, so it offers Windows' own installer. Type <b>Y</b> and press <kbd>Enter</kbd> to accept (Windows may ask for permission), or anything else to install it yourself.</li>
  <li><strong>"This version of Windows is too old"</strong>: the app needs Windows 10 or 11. Node.js no longer runs on Windows 7 or 8.</li>
  <li><strong>"The app cannot write to its own folder"</strong>: see <a href="#no-permission">The app is not allowed to write</a>.</li>
  <li><strong>"Drive C:\\ is almost full"</strong>: the install needs about 400 MB. See <a href="#disk-full">The disk is full</a>.</li>
  <li><strong>"too old"</strong>, <strong><code>npm ERR!</code></strong> or <strong>"Unsupported engine"</strong>: see <a href="#old-node">Node.js is too old</a>.</li>
  <li><strong>"Free GST Billing is already installed on this computer"</strong>: see <a href="#already-installed">Already installed on this computer</a>.</li>
</ul>
<p>Never delete the <code>data</code> folder to fix an install.</p>
</section>

<section id="already-installed">
<h3>"Already installed on this computer"</h3>
<p>You may see: <strong>"Already installed on this computer"</strong> in the launcher, or <strong>"Free GST Billing is already installed on this computer, in: ..."</strong> in the black window.</p>
<p>You extracted a new ZIP into a new folder. Your invoices are in the copy it names, so it does not make a second, empty copy.</p>
<ol>
  <li>Click ${ui('Update the installed copy')}. It uses the files you just extracted, so no download is needed.</li>
  <li>When it finishes, open the app from your <b>Free GST Billing</b> shortcut as usual.</li>
  <li>The new folder is not needed after that. You can delete it.</li>
</ol>
</section>

<section id="old-node">
<h3>"Node.js is too old" or "npm ERR!"</h3>
<p>You may see: <strong>"The Node.js v... on this PC is too old for this app"</strong>, <strong>"Node.js v... on this machine is too old"</strong>, <strong>"npm ... on this machine is too old"</strong>, <strong>"Unsupported engine"</strong>, <strong><code>npm ERR!</code></strong>, a file named <code>npm-debug.log</code>, or <strong>"SyntaxError: Unexpected token"</strong> when the app starts.</p>
<p>The app runs on Node.js 18 or newer (with npm 7 or newer). An older Node.js on the computer cannot install or run it.</p>
<ol>
  <li><strong>Windows, v1.10.81 or newer:</strong> click ${ui('Install')} or ${ui('Open App')} again, with the internet on. The app fetches a current Node.js into its own folder by itself (about 30 MB, once) and leaves your other Node.js alone.</li>
  <li><strong>Windows, older version:</strong> install Node.js LTS from <a href="https://nodejs.org">nodejs.org</a>, delete the <code>_system\\node_modules</code> folder (the <code>_system</code> folder is hidden: in File Explorer, <b>View → Show → Hidden items</b>), and click ${ui('Install')} again.</li>
  <li><strong>Mac:</strong> install the LTS <b>macOS Installer (.pkg)</b> from <a href="https://nodejs.org/en/download">nodejs.org</a>, or run <code>brew install node@20</code>, then open the launcher again. See <a href="install-mac.html#node">Part 1: Install Node.js</a>.</li>
  <li><strong>Linux or NAS:</strong> install Node.js 20 with the commands in <a href="install-linux.html#node">Step 1: Install Node.js 20</a> (the window also prints the command for your system), then start the app again.</li>
</ol>
<p>Only the <code>node_modules</code> folder may be deleted. Never delete the <code>data</code> folder.</p>
</section>

<section id="starting">
<h2>Starting the app</h2>
<p>The launcher or the browser cannot reach the app, or the app asks for a PIN.</p>
</section>

<section id="not-answered">
<h3>"Still starting..." or "The server has not answered in 90 seconds"</h3>
<p>You may see: <strong>"Still starting... (30 seconds. The first start after an update is the slow one.)"</strong>, <strong>"The server has not answered in 90 seconds"</strong>, or, on versions before v1.10.69, <strong>"Server did not respond in 15s"</strong>.</p>
<p>The first start after an install or update is slow, because antivirus checks every new file.</p>
<ol>
  <li>Wait a minute, then open <code>http://localhost:47371</code> in your browser.</li>
  <li>If it does not open, close the black window and click ${ui('Open App')} again. From v1.10.81 this also finishes an install that an update left half done.</li>
  <li>If the window shows a <strong>PROBLEM:</strong> above that line, the entries under <a href="#install-failed">The install stopped with an error</a> say what to do.</li>
  <li>Still nothing? The reason is written in the <code>errors.log</code> file in the data folder, on a line with <b>Failed to start server</b>. Send it with your <a href="#report-problem">report</a>.</li>
</ol>
</section>

<section id="cannot-connect">
<h3>"Failed to fetch", "App Not Running" or "Needs a Quick Start"</h3>
<p>You may see: <strong>"Failed to fetch"</strong> (Chrome, Edge), <strong>"NetworkError when attempting to fetch resource"</strong> (Firefox) or <strong>"Load failed"</strong> (Safari), often after words like <i>Restore failed:</i> or <i>Export failed:</i>; a red dot on <b>Control Panel</b> in the menu; a page saying <strong>"Free GST Billing Software Needs a Quick Start"</strong>; <strong>"Could not check the PIN. Is the app still running?"</strong>; or the browser's own <strong>"This site can't be reached"</strong> or a blank page.</p>
<p>The app's engine (the server on your computer) is not running: the computer was restarted, the app was stopped, or it closed. Nothing already saved is lost.</p>
<ol>
  <li>Double-click the <b>Free GST Billing</b> icon on your Desktop or in the Start menu (Mac: <b>Free GST Billing - MAC</b>; Linux: the start command in <a href="install-linux.html#start">Step 3</a>). It starts the app if needed and opens the right address. If a small launcher window opens instead (an install from before version 1.10.83, the first time), click ${ui('Open App')}.</li>
  <li>Wait up to a minute. The "Needs a Quick Start" page carries on by itself once the app is running; otherwise press <kbd>F5</kbd> to reload.</li>
  <li>Try what failed again.</li>
</ol>
<p>You never need to type the address yourself. If it keeps stopping, see <a href="#port-in-use">Port is busy</a> and the <a href="#problem-log">Problem log</a>.</p>
</section>

<section id="port-in-use">
<h3>"Port 47371 is busy" or "address already in use"</h3>
<p>You may see: <strong>"Port 47371 is busy, trying 47372..."</strong>, <strong><code>EADDRINUSE</code></strong> or <strong>"address already in use"</strong>. These lines only appear when the app is started from a Terminal or Command Prompt.</p>
<p>Another program, or a second copy of Free GST Billing, already uses that port (the "door" the browser knocks on). The app picks the next free one by itself and saves it in <code>data\\port.txt</code>; the launcher reads that file, so ${ui('Open App')} goes to the right address.</p>
<ol>
  <li>Always open the app with its <b>Free GST Billing</b> icon (or the launcher's ${ui('Open App')}), not a bookmark of <code>localhost:47371</code>, which may now be the other program.</li>
  <li>If the launcher says it has not answered, close it and click ${ui('Open App')} once more: it reads the new port.</li>
  <li>The <a href="control-panel.html#about">Control Panel</a> shows the port the app is using.</li>
  <li>Two copies of the app on one computer? Keep using the one with your invoices; see <a href="#already-installed">Already installed</a>.</li>
</ol>
</section>

<section id="pin-forgotten">
<h3>PIN problems: "Wrong PIN" or a forgotten PIN</h3>
<p>You may see: <strong>"Wrong PIN. Try again."</strong>, <strong>"Too many wrong tries. Wait 30 seconds and try again."</strong> (after 5 wrong PINs in a row), <strong>"Could not check the PIN. Is the app still running?"</strong>, or in Settings <strong>"Current PIN is wrong"</strong>, <strong>"The two PINs do not match"</strong>, <strong>"The PIN must be 6 digits"</strong> (or 8).</p>
<p>The <a href="settings.html#lock">PIN lock</a> asks for the PIN once per browser tab. "Could not check the PIN" means the app is not running: see <a href="#cannot-connect">Failed to fetch</a>.</p>
<p><b>Forgot the PIN?</b> It can be removed on this computer without losing anything:</p>
<ol>
  <li>Open the <b>Free-GST-Billing</b> folder, the one with the launcher in it.</li>
  <li>Make a new empty file there named <code>RESET-PIN</code>. On Windows: right-click an empty space, ${ui('New')} → ${ui('Text Document')}, and name it <code>RESET-PIN</code> (<code>RESET-PIN.txt</code> also works). On a Mac or Linux, in the Terminal: <code>touch ~/Free-GST-Billing/RESET-PIN</code> (change the path if your folder is elsewhere).</li>
  <li>Reload the app's page. The PIN is removed and the file deleted by itself. Your invoices are not touched.</li>
  <li>Set a new PIN in <a href="settings.html#lock">Settings</a> if you want one.</li>
</ol>
</section>

<section id="updating">
<h2>Updating</h2>
<p>Problems during or right after an update. An update never changes your data folder, and backs it up first.</p>
</section>

<section id="update-failed">
<h3>An update went wrong</h3>
<p>You may see: <strong>"Update failed — ..."</strong> in the app, <strong>"ERROR: could not reach GitHub. Are you online?"</strong>, <strong>"Could not check for updates. Check internet connection."</strong>, or <strong>"The new version is in place, but it is not ready to run yet"</strong>.</p>
<p>Your data folder is never changed by an update, and a backup was saved in <code>Documents\\FreeGSTBill Backups</code> before it started.</p>
<ol>
  <li>Check the internet, then run the update again. This fixes most problems.</li>
  <li>If the window showed a <strong>PROBLEM:</strong>, fix that first (see <a href="#install-failed">The install stopped with an error</a>), then click ${ui('Open App')}: it finishes the install by itself.</li>
  <li>If it still fails, update by hand with the ZIP: see <a href="update.html#windows">Windows: other ways</a>.</li>
</ol>
</section>

<section id="update-not-showing">
<h3>"Update complete", but the old version is still there</h3>
<p>You may see: <strong>"[OK] Update complete! Restart the app (Stop Server -> Open App) to run the new version."</strong> or <strong>"Update finished. Reload the page to use the new version."</strong></p>
<p>The new files are in place, but the running app or your browser still has the old version.</p>
<ol>
  <li>Press <kbd>Ctrl</kbd> + <kbd>F5</kbd> (Mac: <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).</li>
  <li>Still the old number at the bottom of the Dashboard? Stop the app (launcher, ${ui('More options')} → ${ui('Stop the app')}, or ${ui('Stop Server')} in the Control Panel), then click ${ui('Open App')}.</li>
  <li>If the app does not start after that, see <a href="#not-answered">The server has not answered</a>.</li>
</ol>
</section>

<section id="app-out-of-date">
<h3>"Failed to fetch dynamically imported module"</h3>
<p>You may see: <strong>"Failed to fetch dynamically imported module"</strong>, <strong>"error loading dynamically imported module"</strong> or <strong>"Loading chunk ... failed"</strong>, or a screen that will not open after an update.</p>
<p>The browser kept parts of the old version after an update. The app normally reloads itself once to fix this.</p>
<ol>
  <li>Press <kbd>Ctrl</kbd> + <kbd>F5</kbd> (Mac: <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).</li>
  <li>If it comes back, close every tab of the app, then open it again from its <b>Free GST Billing</b> icon.</li>
</ol>
</section>

<section id="scripts-not-found">
<h3>"Update and backup scripts not found" or "Not available here"</h3>
<p>You may see: <strong>"Update and backup scripts not found."</strong> in the Control Panel, buttons that say <b>Not available here</b>, or <strong>"Not available here: the script for this action is not in the app folder. Download the latest ZIP to get it."</strong></p>
<p>The Control Panel runs scripts that come with the downloaded ZIP, and they are not in this copy. On Mac and Linux only Update and Backup have scripts, so Restore, Move and Stop always say Not available here.</p>
<ol>
  <li>Update with the launcher's ${ui('More options')} → ${ui('Update to the latest version')}, or by hand with the <a href="update.html">downloaded ZIP</a>.</li>
  <li>For your data in the meantime, use <a href="backup.html#export-import">Export Backup</a> in Settings.</li>
</ol>
<p>More in <a href="control-panel.html#scripts-missing">"Update and backup scripts not found"</a>.</p>
</section>

<section id="saving">
<h2>Saving and working in the app</h2>
<p>Messages while making invoices, saving settings or importing.</p>
</section>

<section id="screen-problem">
<h3>"This screen ran into a problem. Your data is safe."</h3>
<p>One screen of the app hit an error and was stopped, so the rest of the app keeps working. Nothing that was already saved is lost.</p>
<ol>
  <li>Click ${ui('Try again')}.</li>
  <li>If the panel comes back, click ${ui('Go to Dashboard')} and carry on with other work.</li>
  <li>Click ${ui('Report this problem')} so it gets fixed. The report is filled in for you, and private details (GSTIN, PAN, phone, email, UPI ID and bank account numbers) are removed before it leaves. You can read it before you submit it on GitHub.</li>
  <li>No GitHub account? Click ${ui('Copy details')} and paste them into an email or WhatsApp message; see <a href="#copy-details">Sending the details another way</a>.</li>
</ol>
</section>

<section id="duplicate-number">
<h3>"Invoice number ... already exists"</h3>
<p>You may see: <strong>"Invoice number INV/0007 was already used — saved as INV/0008 instead."</strong>, <strong>"Invoice number ... already exists. Change it before saving."</strong>, <strong>"Invoice number ... is already used by another invoice. This invoice is still saved as ..."</strong>, <strong>"A bill with this invoice number already exists"</strong>, or <strong>"An invoice with this number exists again. Rename or delete it first."</strong> (restoring from the trash).</p>
<p>Two invoices cannot share a number, and the app never overwrites the other one. A new invoice simply moves on to the next free number by itself.</p>
<ol>
  <li>For an invoice you are editing, change the number in the invoice details to one that is not used, and save again.</li>
  <li>To find the other invoice, search its number with <kbd>Ctrl</kbd> + <kbd>K</kbd>.</li>
  <li><strong>"Could not find a free invoice number after 1000 attempts"</strong>: type a number yourself, or set <b>Start numbering from</b> in <a href="settings.html#invoice-numbers">Settings</a> past your last invoice.</li>
</ol>
</section>

<section id="payload-too-large">
<h3>"Request body too large"</h3>
<p>Usually after <i>Failed to save</i>, <i>Restore failed:</i> or <i>Import failed:</i>.</p>
<p>Something you saved was bigger than the app accepts in one go: up to 5 MB for an everyday save, up to 500 MB for restoring a backup file. The usual cause is a very large logo, signature or stamp picture, because every invoice keeps a copy of your business details with their pictures.</p>
<ol>
  <li>Make the picture smaller, ideally under 500 KB: crop it to just the logo or signature, or save it as a JPG. A free site such as tinypng.com can shrink it.</li>
  <li>Upload the smaller picture in <a href="settings.html#branding">Settings</a> and save.</li>
  <li>Try what failed again.</li>
  <li>For a backup file over 500 MB, restore a daily backup from <b>Settings, Backup Management</b>, or the ZIP with ${ui('Choose Backup ZIP')} in the <a href="control-panel.html#actions">Control Panel</a>.</li>
</ol>
</section>

<section id="disk-full">
<h3>"The disk is full"</h3>
<p>You may see: <strong>"The disk is full"</strong>, <strong><code>ENOSPC</code></strong>, <strong>"no space left on device"</strong>, <strong>"Drive C:\\ is almost full"</strong> (install), or <strong>"the disk is full"</strong> in an update message.</p>
<p>The drive the app is on has no free space, so the app could not write. The app writes each file in full or not at all, so nothing already saved is lost or half-written.</p>
<ol>
  <li>Free some space: empty the Recycle Bin (Mac: Bin), delete old downloads and videos you do not need.</li>
  <li>Backups you have already copied somewhere else can be deleted from <code>Documents\\FreeGSTBill Backups</code>.</li>
  <li>Try again.</li>
</ol>
</section>

<section id="no-permission">
<h3>"The app is not allowed to write to its data folder"</h3>
<p>You may see: <strong>"The app is not allowed to write to its data folder"</strong>, <strong>"The app cannot write to its own folder"</strong> (install), <strong><code>EACCES</code></strong>, <strong><code>EPERM</code></strong>, <strong>"permission denied"</strong> or <strong>"operation not permitted"</strong>.</p>
<p>Windows or antivirus is stopping the app from changing its own files. Usual causes: the app folder is inside <code>C:\\Program Files</code>, on a read-only or synced drive, or antivirus <b>Controlled folder access</b> blocks it.</p>
<ol>
  <li>Stop the app (launcher, ${ui('More options')} → ${ui('Stop the app')}).</li>
  <li>Move the whole <b>Free-GST-Billing</b> folder to <b>Documents</b> or <code>D:\\</code>, and open the launcher from there. The old Desktop shortcut points at the old place: right-click the launcher → ${ui('Send to')} → ${ui('Desktop (create shortcut)')} for a new one.</li>
  <li>If antivirus blocks it, allow the app: in <b>Windows Security → Virus &amp; threat protection → Ransomware protection</b>, use <b>Allow an app through Controlled folder access</b>, or add the folder to your antivirus's exclusions.</li>
  <li><strong>Mac or Linux:</strong> the folder may belong to another user (for example after using <code>sudo</code>). In the Terminal: <code>sudo chown -R $(whoami) ~/Free-GST-Billing</code> (change the path if your folder is elsewhere).</li>
</ol>
</section>

<section id="csv-import">
<h3>A CSV import did not work</h3>
<p>You may see: <strong>"CSV file is empty or has no data rows"</strong>, <strong>"Failed to parse CSV file"</strong>, <strong>"Could not read ..."</strong>, <strong>"Import stopped after ..."</strong>, or for bank statements <strong>"Could not parse this CSV"</strong> or <strong>"No transactions found"</strong>.</p>
<p>The file is not a plain CSV, or its first row is not the column headings.</p>
<ol>
  <li>In Excel, use <b>File → Save As → CSV (Comma delimited)</b>. An <code>.xlsx</code> file renamed to <code>.csv</code> does not work.</li>
  <li>Keep the column headings in the first row and the data from the second row down.</li>
  <li>After "Import stopped after ...", the rows before it are saved. Fix the row the message names and import the rest.</li>
  <li>For bank statements, use the CSV straight from your bank's download, not one edited by hand.</li>
</ol>
<p>See <a href="clients.html#import-csv">clients</a>, <a href="products.html#import">products</a>, <a href="purchases.html#csv-purchases">purchases</a> and <a href="income-tax.html#bank-import">bank statements</a>.</p>
</section>

<section id="ocr-failed">
<h3>Reading a bill photo failed</h3>
<p>You may see: <strong>"OCR failed: ..."</strong>, <strong>"Please upload an image (PNG, JPG, WebP)."</strong> or <strong>"Image is over 8MB"</strong>.</p>
<ol>
  <li>Use a sharp, straight, well-lit JPG or PNG under 8 MB, cropped to the bill.</li>
  <li>If the message mentions <i>fetch</i>, <i>network</i> or <i>worker</i>, press <kbd>Ctrl</kbd> + <kbd>F5</kbd> and try again; if it persists, see <a href="#cannot-connect">Failed to fetch</a>.</li>
  <li>If it still fails, enter the bill by hand.</li>
</ol>
</section>

<section id="printing">
<h2>Printing and PDFs</h2>
<p>Print does nothing, or the PDF is not right.</p>
</section>

<section id="print-blocked">
<h3>Print does nothing, or "Print failed"</h3>
<p>You may see: <strong>"Your browser blocked the print window. Allow pop-ups for this app and try again."</strong>, <strong>"Allow pop-ups for this page to print the report"</strong>, <strong>"Print failed — try Download PDF instead"</strong>, <strong>"Failed to generate PDF."</strong> or <strong>"Could not generate any PDFs"</strong>.</p>
<ol>
  <li>Allow pop-ups for the app: click the blocked pop-up icon at the right end of the address bar, choose <b>Always allow</b> for <code>localhost</code>, and try again.</li>
  <li>Use ${ui('Download PDF')} and print the PDF instead.</li>
  <li>Press <kbd>Ctrl</kbd> + <kbd>F5</kbd> and try again.</li>
</ol>
<p>For receipt printers, see <a href="thermal-printing.html#receipt-problems">Receipt printer problems</a>.</p>
</section>

<section id="pdf-file-in-use">
<h3>"Its PDF in Saved Invoices could not be updated"</h3>
<p>You may see: <strong>"Invoice saved, but its PDF in Saved Invoices could not be updated. Use Save &amp; Download."</strong> or <strong>"A saved PDF could not be marked CANCELLED. Close the PDF if it is open, then cancel again."</strong></p>
<p>The invoice itself is saved. Only its PDF copy could not be replaced, usually because that PDF is open in a PDF reader.</p>
<ol>
  <li>Close the PDF in Adobe Reader, Edge or your browser.</li>
  <li>Click ${ui('Save &amp; Download')} again, or repeat the cancel or undo.</li>
</ol>
</section>

<section id="missing-on-pdf">
<h3>Something is missing from the PDF</h3>
<ul>
  <li><strong>Logo, signature or stamp</strong>: check it is uploaded and saved in <a href="settings.html#branding">Settings</a>, and ticked under Customize.</li>
  <li><strong>UPI QR code</strong>: needs a UPI ID on the account, a rupee invoice, and <b>UPI QR</b> ticked under Customize.</li>
  <li><strong>Bank details or PAN</strong>: tick <b>Bank details</b> under Customize; the account needs a bank name.</li>
  <li><strong>Anything on a receipt printer</strong>: receipts leave some things out on purpose. See <a href="thermal-printing.html#not-on-receipts">What a receipt leaves out</a>.</li>
</ul>
</section>

<section id="image-problem">
<h3>A logo or signature picture will not upload</h3>
<p>You may see: <strong>"This doesn't look like an image"</strong>, <strong>"Image is ... MB — over the 5MB cap"</strong>, <strong>"Image too large (max 2MB)"</strong>, <strong>"Image too large (max 3MB)"</strong>, <strong>"Image must be under 500KB"</strong>, or <strong>"Could not decode this image"</strong>.</p>
<ol>
  <li>Use a PNG or JPG. An iPhone photo (HEIC) must be turned into a JPEG first: share it to Files as a JPEG, or on the iPhone set <b>Settings → Camera → Formats → Most Compatible</b> for new photos.</li>
  <li>Make it smaller, ideally under 500 KB: crop it or shrink it with a free site such as tinypng.com.</li>
  <li>Upload it again.</li>
</ol>
</section>

<section id="gst-returns-problems">
<h2>GST, tax and returns</h2>
<p>Wrong tax on an invoice, and messages from GST Returns.</p>
</section>

<section id="wrong-tax">
<h3>The invoice has the wrong tax split</h3>
<ol>
  <li>Check your own <b>state</b> in <a href="settings.html#company-details">Settings</a>.</li>
  <li>Check the <b>client's state</b>, or their GSTIN, which fills the state in.</li>
  <li>If goods go to a different state from the client's address, set <b>Place of Supply</b> on the invoice.</li>
  <li>For a client abroad, set their <b>country</b>: it is then an export, charged as IGST. For an SEZ unit, tick <b>SEZ</b> on the client.</li>
</ol>
<p>See <a href="invoices.html#gst">How GST is worked out</a>.</p>
</section>

<section id="state-missing">
<h3>"Set your business State in Settings"</h3>
<p>You may see: <strong>"Set your business State in Settings — required for correct CGST/SGST vs IGST split."</strong> or <strong>"Set your GSTIN in Settings first"</strong> (E-Way Bill).</p>
<p>The app needs your state to choose CGST + SGST or IGST, and your GSTIN for E-Way Bill files.</p>
<ol>
  <li>Open <a href="settings.html#company-details">Settings, Company Details</a>.</li>
  <li>Fill in <b>State</b> (and <b>GSTIN</b>, which fills the state in), and save.</li>
  <li>Go back to the invoice; the tax is worked out again.</li>
</ol>
</section>

<section id="no-tax">
<h3>No GST is charged at all</h3>
<p><b>Charge GST on this invoice</b> (group <b>Tax</b>) is probably turned off under ${ui('Customize')}. Turning it off removes GST from the invoice, and your choice carries over to new invoices. Tick it again. Bills of supply and delivery challans never charge GST.</p>
</section>

<section id="gstr1-blocked">
<h3>"GSTR-1 export blocked — fix these first"</h3>
<p>You may also see <strong>"GSTR-1 JSON exported. ⚠ ..."</strong>: the file was made, with warnings worth reading.</p>
<p>An invoice number is too long or has characters the portal refuses, or an item has a GST rate the portal does not accept. The message names the first ones.</p>
<ol>
  <li>Open the invoice the message names and fix its number or rate.</li>
  <li>Export again.</li>
</ol>
<p>See <a href="gst-returns.html#json-checks">Checks before the file is made</a>.</p>
</section>

<section id="gstr2b-wrong-file">
<h3>"That doesn't look like a GSTR-2B JSON"</h3>
<p>You may see: <strong>"That doesn't look like a GSTR-2B JSON. Expected docdata.b2b array."</strong> or <strong>"Failed to parse GSTR-2B JSON"</strong>.</p>
<p>The file chosen is not the GSTR-2B JSON from the GST portal: often the Excel or PDF version, or a different return.</p>
<ol>
  <li>On the GST portal, download GSTR-2B for the month as a <b>JSON</b> file.</li>
  <li>If it comes as a ZIP, extract it first.</li>
  <li>Choose that <code>.json</code> file. See <a href="gst-returns.html#gstr-2b">GSTR-2B</a>.</li>
</ol>
</section>

<section id="nothing-to-export">
<h3>"No data to export for this period"</h3>
<p>You may see: <strong>"No data to export for this period"</strong>, <strong>"No invoices to export"</strong>, <strong>"No B2B data to export"</strong>, <strong>"No TDS entries in this period"</strong>, or <strong>"Nothing to export"</strong>.</p>
<p>The chosen period has nothing of that kind for this business.</p>
<ol>
  <li>Check the <a href="gst-returns.html#period">period</a> at the top.</li>
  <li>Check the business at the top of the sidebar: each business has its own invoices. See <a href="shortcuts.html#switch-business">Switching business</a>.</li>
</ol>
</section>

<section id="gst-labels">
<h3>It says VAT instead of GST, or the other way round</h3>
<p>Change <a href="settings.html#region">Region</a> in Settings, and check your country in Company Details. Tax names follow the seller's country.</p>
</section>

<section id="backups">
<h2>Backups, restore and Google Drive</h2>
<p>Daily backups, backup files and restoring.</p>
</section>

<section id="restore-failed">
<h3>A backup or restore failed</h3>
<p>You may see: <strong>"This file doesn't look like a Free GST Billing backup."</strong>, <strong>"Could not read the file"</strong>, <strong>"Import failed: ..."</strong>, <strong>"Restore failed: ..."</strong>, <strong>"Backup failed: ..."</strong> or <strong>"No data folder found - nothing to back up."</strong></p>
<p>A restore saves what you have now first, so a failed one changes nothing.</p>
<ol>
  <li>Read the end of the message: <a href="#cannot-connect">Failed to fetch</a>, <a href="#payload-too-large">Request body too large</a>, <a href="#disk-full">disk full</a> and <a href="#no-permission">permission</a> each have their own entry.</li>
  <li>For <b>Import Backup</b>, choose the <code>freegstbill-backup-<i>date</i>.json</code> file saved by Export Backup. A ZIP from the launcher or Control Panel is restored with ${ui('Choose Backup ZIP')} in the <a href="control-panel.html#actions">Control Panel</a> instead.</li>
  <li>Try another day from <b>Settings, Backup Management</b>.</li>
</ol>
<p>See <a href="backup.html">Backups and updates</a>.</p>
</section>

<section id="backup-folder">
<h3>"Cannot write to that folder" (backup copy folder)</h3>
<p>You may see: <strong>"Give the full folder path, for example D:\\Backups"</strong>, <strong>"Choose a folder outside the app's data folder."</strong>, <strong>"Cannot write to that folder: ..."</strong>, or <strong>"Folder saved, but copying today's backup failed: ..."</strong>.</p>
<ol>
  <li>Type the whole path, starting with the drive letter, such as <code>D:\\FreeGSTBill</code>; on a Mac or Linux, a path starting with <code>/</code>.</li>
  <li>Choose a folder outside the app's own folder.</li>
  <li>For a USB disk, plug it in first. Settings says when a copy fails.</li>
  <li>For a permission code such as <code>EACCES</code>, choose a folder in your own Documents or another drive.</li>
</ol>
<p>See <a href="backup.html#backup-copy">Keeping a copy somewhere else</a>.</p>
</section>

<section id="google-drive">
<h3>Google Drive upload failed</h3>
<p>You may see: <strong>"Google Drive not configured."</strong>, <strong>"Enter your Google OAuth Client ID first"</strong>, <strong>"Drive auth failed — backup downloaded locally only"</strong>, <strong>"Google Drive: Please reconnect in Settings"</strong> or <strong>"Google Drive upload failed: ..."</strong>.</p>
<p>The file was still saved on this computer. Only the copy to Drive did not happen.</p>
<ol>
  <li>Check the internet.</li>
  <li>In <a href="settings.html#google-drive">Settings, Google Drive</a>, connect again (and fill in the Client ID if it is empty).</li>
  <li>Save or export again.</li>
</ol>
</section>

<section id="damaged-file">
<h3>"Skipped damaged file" in the log</h3>
<p>You may see a log line like: <strong>"Skipped damaged file data/bills/INV_0007.json (not valid JSON)"</strong>, and that one invoice, client or product is missing from its list.</p>
<p>One saved file was damaged, by a power cut, a disk error or editing it by hand. The app skips it so everything else still opens.</p>
<ol>
  <li>Note the file name in the line (for example <code>bills/INV_0007.json</code>).</li>
  <li>Open the data folder: ${ui('Open Data Folder')} in the <a href="control-panel.html#actions">Control Panel</a>.</li>
  <li>Open <code>backups</code>, then the newest date folder, then the same subfolder (<code>bills</code>). Copy that file.</li>
  <li>Paste it into the same subfolder of the data folder, replacing the damaged one, and reload the page.</li>
  <li>No good copy there? Look in the ZIPs in <code>Documents\\FreeGSTBill Backups</code>, or move the damaged file to your Desktop (everything else keeps working) and <a href="#report-problem">send it to us</a>.</li>
</ol>
<p>Restoring a whole day from <b>Settings, Backup Management</b> also works, but it puts all your data back to that day. See <a href="backup.html#automatic-backups">Automatic daily backups</a>.</p>
</section>

<section id="mac">
<h2>Mac</h2>
<p>Messages macOS shows before the app starts.</p>
</section>

<section id="mac-blocked">
<h3>The Mac will not open the launcher</h3>
<ul>
  <li><strong>"could not be executed because you do not have appropriate access privileges"</strong>: open <b>Terminal</b> (Applications → Utilities), type <code>chmod +x </code> with a space after it, drag <b>Free GST Billing - MAC</b> into the Terminal window, press <kbd>Return</kbd>, and open the file again. Downloads from v1.10.82 do not need this. See <a href="terminal.html#example">the step-by-step example</a>.</li>
  <li><strong>"cannot be opened because Apple cannot check it for malicious software"</strong> or <strong>"unidentified developer"</strong>: the app is not signed by Apple. Hold <kbd>Control</kbd>, click <b>Free GST Billing - MAC</b>, choose <b>Open</b>, then <b>Open</b> again. Only the first time. Or use <b>System Settings → Privacy &amp; Security → Open Anyway</b>.</li>
  <li><strong>"Node.js is not installed"</strong> or <strong>too old</strong>: see <a href="#old-node">Node.js is too old</a>.</li>
</ul>
<p>Updating on a Mac: never drag a new download over the old folder; see <a href="update.html#mac">Mac: other ways</a>.</p>
</section>

<section id="linux">
<h2>Linux and NAS</h2>
<p>Messages in the Terminal.</p>
</section>

<section id="linux-permission">
<h3>"Permission denied" or "bash: not found"</h3>
<p>You may see: <strong>"Permission denied"</strong> when starting <code>./Free GST Billing - LINUX.sh</code>, or <strong>"bash: not found"</strong> on a NAS.</p>
<ol>
  <li>Start it through bash, which needs no permission change: <code>cd ~/Free-GST-Billing &amp;&amp; bash "Free GST Billing - LINUX.sh"</code>.</li>
  <li>No bash (Alpine, some NAS systems): install it, for example <code>sudo apk add bash</code>.</li>
  <li>"Permission denied" while the app writes files: see <a href="#no-permission">The app is not allowed to write</a>.</li>
</ol>
</section>

<section id="linux-update-failed">
<h3>The Linux update stopped</h3>
<p>The update says <strong>ERROR:</strong> and, in most cases, <strong>"Nothing was changed."</strong> If it fails while applying, the old app files are put back.</p>
<ul>
  <li><strong>"Updating needs "unzip" (or python3)"</strong>: run <code>sudo apt install unzip</code> (Alpine: <code>apk add unzip</code>) and update again.</li>
  <li><strong>"Could not download the update"</strong>: check the internet and try again.</li>
  <li><strong>"could not be extracted (damaged download, or the disk is full)"</strong>: free some space (see <a href="#disk-full">The disk is full</a>) and try again.</li>
  <li><strong>"Update Node.js as shown above"</strong>: see <a href="#old-node">Node.js is too old</a>.</li>
  <li><strong>"npm install failed."</strong>: check the internet and the free space, then run <code>sh ~/Free-GST-Billing/_system/update-unix.sh</code> again.</li>
  <li><strong>"This copy runs from a git checkout"</strong>: update it with <code>git pull &amp;&amp; npm install &amp;&amp; npm run build</code>.</li>
</ul>
<p>After <strong>"[OK] Update complete"</strong>, restart the app (or its Docker container or service).</p>
</section>

<section id="problem-log">
<h2>Problem log and reporting a problem</h2>
<p>The app keeps a list of recent problems on this computer: a save that failed, a screen that went wrong, the app server not answering. Open <b>Support &amp; About</b> in the sidebar and scroll to the <b>Problem log</b> card. Use it when something did not work and you want to know why, or when you want to send the details to get it fixed.</p>
<p>Private details are removed before anything is kept: GSTIN, PAN, phone numbers, email addresses, UPI IDs and bank account numbers. Nothing is sent anywhere unless you click ${ui('Report')}.</p>
<div class="table-wrap"><table>
  <tr><th>On the card</th><th>What it is or does</th></tr>
  <tr><td>The list</td><td>Newest first. Each line shows the date and time, the screen it happened on, and the message. If the app was talking to its server, the request and its answer (for example <code>POST /api/bills (500)</code>, or <i>no answer</i>) come first.</td></tr>
  <tr><td><b>How to fix</b></td><td>Shown on a line the app recognises (a full disk, a damaged file, a blocked pop-up…). It opens the matching fix on this Troubleshooting page.</td></tr>
  <tr><td>${ui('Copy')} / ${ui('Report')} on a line</td><td>Copy that one problem as text, or open the GitHub report form already filled in. See <a href="#report-problem">Reporting a problem</a>.</td></tr>
  <tr><td>${ui('Copy all')}</td><td>Copies every problem, newest first, plus the server log lines, ready to paste into an email or a GitHub issue.</td></tr>
  <tr><td>${ui('Clear log')}</td><td>Empties the list once the problem is solved. It does not touch your invoices or any other data.</td></tr>
  <tr><td><b>Server log</b></td><td>Click to open. The app server's last lines from the <code>errors.log</code> file in your data folder. Known problems found in it are listed above the lines, each with a <b>How to fix</b> link.</td></tr>
</table></div>
<p><b>No problems logged. Good.</b> means nothing has gone wrong in this browser. <b>The server log is empty.</b> means the same for the server.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Could not copy."</b> Your browser blocked the clipboard. Open <b>Server log</b> or select the text with the mouse and press <kbd>Ctrl</kbd> + <kbd>C</kbd>.</p>
<p><b>The list is empty but something failed.</b> The list is kept in this browser (in a private window it may not be kept at all). If the problem happened in another browser or on another computer, open the app there. Problems from before you cleared the log are gone.</p>
</div>
</section>

<section id="report-problem">
<h3>Reporting a problem</h3>
<ol>
  <li>In the Problem log, click ${ui('Report')} next to the problem (or ${ui('Report this problem')} on the panel that showed it).</li>
  <li>GitHub's <a href="${SITE.repo}/issues/new?template=bug_report.yml">Report a problem</a> form opens, already filled in with the version, your computer and the error details. Private details (GSTIN, PAN, phone, email, UPI ID, bank account) are removed first.</li>
  <li>Add what you did just before it happened, check the text, and submit. This needs a free GitHub account.</li>
</ol>
<p>Reporting without the Problem log: the form asks for the version (bottom of the Dashboard, or <b>Settings, App Updates</b>), your computer, what you did and what you saw, and a screenshot (hide your GSTIN and bank details). If the app does not start, add what <code>node -v</code> and <code>npm -v</code> show in Command Prompt; see <a href="terminal.html#windows">Using the Terminal</a>.</p>
<p>Problems are fixed in the <a href="support.html#weekly">Saturday update</a>, and anything urgent, such as the app not opening, straight away. For a new feature use <a href="${SITE.repo}/issues/new?template=feature_request.yml">Ask for a feature</a>.</p>
</section>

<section id="copy-details">
<h3>Sending the details another way</h3>
<p>No GitHub account? Click ${ui('Copy details')} (or ${ui('Copy')} in the Problem log), paste it into an email to <a href="mailto:contact@dicecodes.com">contact@dicecodes.com</a> or a WhatsApp message, and add what you did just before it happened. Read it before sending; it is plain text.</p>
</section>

<section id="questions">
<h2>Questions</h2>
<p>Things people ask that are not errors.</p>
</section>

<section id="other-devices">
<h3>Can I use it on my phone or another computer?</h3>
<p>The app runs on the computer it is installed on, and only that computer can open it. It has no user accounts, so it is deliberately not shared over your network, where anyone connected could read your books. (The optional <a href="settings.html#lock">PIN lock</a> locks the screen on this computer only.) To work on another computer, <a href="backup.html#move-pc">move your data</a> there.</p>
</section>

<section id="internet">
<h3>Does it need the internet?</h3>
<p>Only to install and to update. Invoices, reports, GST returns and even reading bills from photos all work offline. Google Drive upload uses the internet too.</p>
</section>

<section id="privacy">
<h3>Is my data sent anywhere?</h3>
<p>No. There is no account, no tracking and no server of ours. Your data stays in the app's folder unless you choose Google Drive, which copies files into your own Drive, or you send a <a href="#report-problem">problem report</a> yourself. The full answer, with every address the app connects to, is in <a href="security.html">Is it safe?</a></p>
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
<p>There is no double-entry ledger, balance sheet, trial balance, cash or bank book, bank reconciliation or journal entries yet. It covers invoicing, receivables, purchases, expenses, stock and GST. For the rest, give your CA the Excel or CSV exports.</p>
</section>

<section id="multi-user">
<h2>Several people, or several computers</h2>
<p>There are no user accounts or roles (an optional <a href="settings.html#lock">PIN</a> can lock the screen), and the app only opens on the computer it runs on. One computer holds the books; see <a href="backup.html#move-pc">moving to a new computer</a>. Hosting it online (Railway, Render, a server) is not supported yet; see <a href="security.html#host-online">why</a>.</p>
</section>

<section id="income-tax-limits">
<h2>Income tax</h2>
<p>The income tax helper estimates tax for FY 2025-26, including for seniors (60 to 79) and super seniors (80 and above). It does not file your return or produce the ITR file the portal takes. See <a href="income-tax.html">Income tax helper</a>.</p>
</section>

<section id="stock-limits">
<h2>Stock</h2>
<p>Stock is one count per product. There are no batches, expiry dates, serial numbers or warehouses. Stock is valued at purchase price in <a href="reports.html#stock">Reports, Stock</a>.</p>
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
