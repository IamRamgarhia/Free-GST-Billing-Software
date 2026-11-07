// Step-by-step install and update guides, written for people who have never
// unzipped a file or opened a Terminal (asked for by the maintainer: "so many
// people don't know how to use things or use the terminal"). Every step says
// what to click and what you should see next.
import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;
const key = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join(' + ');

// v1.10.83 - the one-line install. A file fetched by PowerShell or curl gets
// no "downloaded from the internet" mark, so Windows and macOS show no
// warning; the same line installs, updates and repairs.
const RAW = 'https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main';
const WIN_LINE = `powershell -ExecutionPolicy Bypass -c "[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm ${RAW}/install.ps1 | iex"`;
const WIN_REMOVE = `powershell -ExecutionPolicy Bypass -c "[Net.ServicePointManager]::SecurityProtocol='Tls12'; &amp; ([scriptblock]::Create((irm ${RAW}/install.ps1))) -Uninstall"`;
const UNIX_LINE = `curl -fsSL ${RAW}/install.sh | bash`;
const UNIX_REMOVE = `curl -fsSL ${RAW}/install.sh | bash -s -- --uninstall`;
// The .deb's name carries the version, so it is linked through the release page.
const RELEASES = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest';

const which = `
<div class="note tip"><strong>Which guide is mine?</strong>
<p><b>Windows</b> (most PCs and laptops): <a href="install.html">Install on Windows</a>.
<b>Mac</b> (Apple logo top left): <a href="install-mac.html">Install on a Mac</a>.
<b>Linux or a NAS</b>: <a href="install-linux.html">Install on Linux or a NAS</a>.
Already installed? <a href="update.html">Updating</a>.
Wondering whether it is safe? <a href="security.html">Is it safe? Security and privacy</a>.</p></div>`;

export default [
// =============================================================================
{
  slug: 'install',
  title: 'Install on Windows, step by step',
  nav: 'Install on Windows',
  lead: 'Download the Setup program and double-click it: it installs like any other Windows program, in about 2 minutes, with no administrator password. Every step below says what to press and what you will see.',
  body: `
${which}

<section id="before">
<h2>Before you start</h2>
<ul>
  <li><strong>Windows 10 or Windows 11.</strong> To check: press ${key('Windows', 'R')}, type <code>winver</code>, press ${key('Enter')}.</li>
  <li><strong>Internet</strong> for the install only (it downloads about 25 MB). After that the app works offline.</li>
  <li><strong>About 600 MB of free space.</strong></li>
</ul>
</section>

<section id="setup-exe">
<h2>Install with the Setup program (recommended)</h2>
<p>Installs like any other Windows program: an icon in the Start menu and on the Desktop, the app in a window of its own (closing it keeps it running near the clock), updates from inside the app, and removal in Windows Settings. No administrator password.</p>
<ol class="steps">
  <li><strong>Download it</strong><a class="download" href="https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing-Windows-Setup.exe">Download Free-GST-Billing-Windows-Setup.exe</a> (about 35 MB).</li>
  <li><strong>Open it</strong>Double-click <code>Free-GST-Billing-Windows-Setup.exe</code> in your Downloads folder.</li>
  <li><strong>If Windows says "Windows protected your PC"</strong>That blue box is SmartScreen. It appears because the Setup is new and not yet signed with a paid certificate, not because anything is wrong with it. Click ${ui('More info')}, then ${ui('Run anyway')}.</li>
  <li><strong>Answer "Your books"</strong>Your books are your invoices, clients, products and settings. Setup asks where they should be kept:
    <ul>
      <li><b>First time on this computer:</b> leave <i>Start new books in C:\\Users\\&lt;your name&gt;\\Free GST Billing</i> ticked.</li>
      <li><b>You already use Free GST Billing (the ZIP or the one-line install):</b> Setup finds it and shows how many invoices it has. If it finds more than one copy, it lists them all (the one you changed last first, with its invoices and date) and you pick the one you use. <i>Keep using my books where they are</i> uses them in their folder (do not delete that folder afterwards). <i>Copy my books to C:\\Users\\&lt;your name&gt;\\Free GST Billing</i> makes a copy, checks every file, and leaves your old folder exactly as it was, as a backup. Either way nothing in your old folder is changed or deleted.</li>
      <li><b>Your books are somewhere else</b> (another drive, a copied folder): choose <i>browse</i> and pick the folder that has the <code>data</code> folder in it.</li>
    </ul></li>
  <li><strong>Choose the icons</strong>A Desktop icon is ticked. Tick <i>Open Free GST Billing when Windows starts</i> if you want it to open by itself.</li>
  <li><strong>Click Install, then Finish</strong>The app opens in its own window. The last page shows where your books are and where Setup wrote what it did (<code>Free GST Billing - install log.txt</code>).</li>
</ol>
<p><b>Your old icons</b> are not deleted: they are moved into the <code>Old shortcuts (backup)</code> folder next to that log, so two icons never start two copies of the app.</p>
<p><b>Updates:</b> when a new version is out, the app shows <i>Update to vX</i> in the menu (and a Windows notification, if you allow it in the update window). Click it, then ${ui('Update Now')}: the new Setup downloads and installs by itself, and the app reloads in about a minute. Your books are not touched. You never need to reinstall.</p>
<p><b>Removing it:</b> Windows ${ui('Settings')} → ${ui('Apps')} → <b>Free GST Billing</b> → ${ui('Uninstall')}. It asks <i>Also delete your books?</i>: the answer is <b>No</b> unless you click Yes, and books in your earlier copy's folder are never deleted by it.</p>
</section>

<section id="one-line">
<h2>Other way: install with one line</h2>
<p>No download to open and no "Windows protected your PC" box: paste one line instead. It sets up the same app with the ZIP's launcher and opens it in Edge's app window.</p>
<ol class="steps">
  <li><strong>Copy this line</strong>Click the ${ui('Copy')} button at the right end of the line below. (Or select all of it with the mouse and press ${key('Ctrl', 'C')}.)
<pre><code>${WIN_LINE}</code></pre></li>
  <li><strong>Press Windows + R</strong>Hold the ${key('Windows')} key (the one with the Windows logo) and press ${key('R')}. A small <b>Run</b> box opens at the bottom left.</li>
  <li><strong>Paste and press Enter</strong>Click in the box, press ${key('Ctrl', 'V')}, then press ${key('Enter')}.</li>
  <li><strong>Watch it work</strong>A blue or black window shows four steps, each ending in <b>OK</b>:
<pre><code>[1/4] Checking this computer ... OK
[2/4] Downloading (25 MB) ...
[3/4] Installing ... OK
[4/4] Adding icons ... OK</code></pre>
  It may also fetch Node.js, the engine the app runs on (about 30 MB, kept inside the app folder).</li>
  <li><strong>Answer one question</strong>It asks <i>Open Free GST Billing by itself when this computer starts?</i> Type <code>Y</code> and press ${key('Enter')} for yes, or just press ${key('Enter')} for no.</li>
  <li><strong>The app opens in its own window</strong>The window says <i>Done! Opening Free GST Billing...</i> and the app appears, with no browser tabs or address bar. A short welcome asks for your business details; see <a href="first-run.html">The first-run setup</a>. The install window closes by itself.</li>
</ol>
<p><b>Every day after that:</b> click the <b>Free GST Billing</b> icon on your Desktop or in the Start menu.</p>
<p><b>To update or repair it:</b> do the same three steps again. It finds your install, backs up your data to <code>Documents\\FreeGSTBill Backups</code>, and replaces only the app's own files. Your invoices, clients and settings stay exactly as they are.</p>
<div class="note tip"><strong>If the window shows PROBLEM in red</strong>
<p>The line under it says what to do (no internet, the disk is full, the folder cannot be written to). Do that, then paste the same line again; it carries on where it stopped. Nothing in your data is changed by a failed install.</p></div>
<p>The app is installed to <code>%LOCALAPPDATA%\\Programs\\Free GST Billing</code>. If you installed it from the ZIP before, the line finds that copy (through its Desktop shortcut) and updates it where it is. Your data is in the <code>_system\\data</code> folder inside it.</p>
</section>

<section id="zip">
<h2>Other way: download the ZIP</h2>
<p>For offices that copy the app from a USB stick, or where the Setup and the line above are blocked. It takes a few more clicks and Windows shows a warning the first time.</p>
</section>

<section id="download">
<h2>Step 1: Download</h2>
<ol class="steps">
  <li><strong>Click this button</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Wait for the download to finish</strong>Your browser shows it at the top right (Chrome and Edge) or bottom left. The file is called <code>Free-GST-Billing.zip</code>.</li>
  <li><strong>Open your Downloads folder</strong>Click the folder icon next to the download, or open <b>File Explorer</b> (the yellow folder on the taskbar) and click <b>Downloads</b> on the left.</li>
</ol>
<div class="note warn"><strong>Use this button, not GitHub's green Code button</strong>
<p>The green ${ui('Code')} button on GitHub gives you the source code, not the app. It will not install.</p></div>
</section>

<section id="extract-first">
<h2>Step 2: Unzip (extract) it</h2>
<p>A ZIP is a packed folder. Windows can open it, but the app cannot run from inside it, so it has to be unpacked first.</p>
<ol class="steps">
  <li><strong>Right-click the ZIP</strong>Right-click <code>Free-GST-Billing.zip</code> and choose ${ui('Extract All\u2026')}. (On Windows 11 it may be under ${ui('Show more options')}.)</li>
  <li><strong>Choose where</strong>Click ${ui('Browse\u2026')} and pick <b>Documents</b>, or a drive like <code>D:\\</code>. Not <b>Downloads</b>: things there get deleted when people tidy up. Do not choose <code>C:\\Program Files</code>.</li>
  <li><strong>Click Extract</strong>A new folder called <b>Free-GST-Billing</b> opens. Inside you see <b>Free GST Billing - WINDOWS</b>, <b>READ ME FIRST</b>, and launchers for Mac and Linux.</li>
</ol>
<p>If you double-click the launcher while still looking inside the ZIP, it says <i>Please extract the ZIP first</i>. Close it and do this step.</p>
<figure class="narrow"><img src="${img('launcher-zip.png')}" alt="The launcher explaining that the ZIP needs to be extracted first"></figure>
</section>

<section id="launch">
<h2>Step 3: Open the launcher and click Install</h2>
<ol class="steps">
  <li><strong>Double-click "Free GST Billing - WINDOWS"</strong>In the Free-GST-Billing folder.</li>
  <li><strong>If Windows warns you</strong>See <a href="#windows-protected">"Windows protected your PC"</a> just below: click ${ui('More info')}, then ${ui('Run anyway')}. If it asks <i>Do you want to run this file?</i>, click ${ui('Run')} or ${ui('Open')}.</li>
  <li><strong>Click Install</strong>A small window opens with one big button. Click ${ui('Install')}. There is nothing to fill in.</li>
  <li><strong>Leave the black window alone</strong>A black window appears and does the work: it may get Node.js (the engine the app runs on, about 30 MB, kept inside the app folder). This takes 1 to 3 minutes. Don't close it; it closes by itself.</li>
  <li><strong>The app opens by itself</strong>in its own window, at <code>http://localhost:47371</code>. A <b>Free GST Billing</b> icon is now on your Desktop and in the Start menu. A short welcome asks for your business details. See <a href="first-run.html">The first-run setup</a>.</li>
</ol>
<figure class="pair">
  <img src="${img('launcher-install.png')}" alt="The launcher before install, showing one Install button">
  <img src="${img('launcher-ready.png')}" alt="The launcher after install, showing one Open App button">
  <figcaption>Before install the launcher shows one button. Afterwards it shows ${ui('Open App')}, and the rest is under ${ui('More options')}.</figcaption>
</figure>
<div class="note tip"><strong>If the black window shows a message in red</strong>
<p>It says what is wrong and what to do (no internet, disk full, folder in the wrong place, antivirus). Do that, then click ${ui('Install')} again; it carries on where it stopped. The full list is in <a href="troubleshooting.html#install-failed">The install stopped with an error</a>.</p></div>
</section>

<section id="windows-protected">
<h2>"Windows protected your PC"</h2>
<p>This blue box appears the first time for any program that is not signed with a paid certificate (a few hundred dollars a year, which would make a free app not free). It does not mean anything is wrong. More in <a href="security.html#install-safety">Is the install safe?</a></p>
<ol>
  <li>Click the small link ${ui('More info')}.</li>
  <li>Click the button ${ui('Run anyway')}.</li>
</ol>
<p>If the file will not open at all: right-click <b>Free GST Billing - WINDOWS</b>, choose ${ui('Properties')}, tick ${ui('Unblock')} at the bottom, click ${ui('OK')}, and double-click it again.</p>
<p>If your antivirus deletes a file during the install, add the Free-GST-Billing folder to its exclusions (often under <i>Exclusions</i> or <i>Allowed apps</i>) and click ${ui('Install')} again.</p>
</section>

<section id="every-day">
<h2>Every day after that</h2>
<ol class="steps">
  <li><strong>Double-click the "Free GST Billing" icon on your Desktop</strong>The install put this icon (the blue <b>B</b>) there and in the Start menu. It starts the app and opens it in its own window. There is nothing else to click.</li>
</ol>
<p>Update, back up, restore, restart and stop the app from the <a href="control-panel.html">Control Panel</a> in the app's menu. Restarting the computer also stops it. The launcher, <b>Free GST Billing - WINDOWS</b> in the Free-GST-Billing folder, stays there for updates and repairs.</p>
<p>Your data is in the <code>_system\\data</code> folder inside Free-GST-Billing; see <a href="backup.html">Backups</a>.</p>
<p>Use only this icon. If you also have a Free GST Billing app icon made by Chrome or Edge, remove it (right-click it, then ${ui('Uninstall')}): it opens a window but cannot start the app.</p>
</section>

<section id="what-install-does">
<h2>What the installer does</h2>
<ul>
  <li><strong>Checks your PC</strong>: Windows 10 or 11, enough free space, a folder it can write to, and the internet.</li>
  <li><strong>Sets up Node.js inside the app folder</strong> if the PC does not have a recent one. It is downloaded once from nodejs.org into <code>_system\\node</code>. Nothing is installed into Windows and no administrator password is needed. If that download fails, it asks before using Windows' own installer (winget), and otherwise opens the download page.</li>
  <li><strong>Adds a Free GST Billing shortcut</strong> to your Desktop and Start menu.</li>
  <li><strong>Opens the app</strong> in your browser.</li>
</ul>
<p>The app's parts come inside the ZIP, so nothing else is downloaded.</p>
</section>

<section id="one-command">
<h2>For IT people</h2>
<p>The one line can also be pasted into an open PowerShell window. To install into another folder, set it first: <code>$env:FREEGSTBILL_DIR = 'D:\\Apps\\Free GST Billing'</code>. If that folder already has the app, it is updated in place.</p>
</section>

<section id="uninstall">
<h2>Removing the app</h2>
<p><strong>Back up your data first</strong> if you may want it again. See <a href="backup.html#export-import">Export everything to one file</a>.</p>
<p><b>Installed with the Setup program (.exe)?</b> Use Windows ${ui('Settings')} → ${ui('Apps')} → <b>Free GST Billing</b> → ${ui('Uninstall')}. See <a href="#setup-exe">the Setup program</a>.</p>
<p><b>The easy way:</b> in the app, open ${ui('Control Panel')} and use ${ui('Remove…')}. Tick what else to delete (your data, PDFs, backups) and click ${ui('Remove the app')}. See <a href="control-panel.html#remove">Remove the App</a>. Or, with the app closed, double-click <b>Free GST Billing - WINDOWS</b> in the app folder, click <b>More options</b>, then ${ui('Remove the app...')}: the same tick boxes, then ${ui('Remove the app')}.</p>
<p><b>Or with one line:</b> press ${key('Windows', 'R')}, paste this line and press ${key('Enter')}:</p>
<pre><code>${WIN_REMOVE}</code></pre>
<p>It stops the app and removes it and its icons. Your invoices, clients and settings are kept unless you type <code>DELETE</code> when it asks (and even then a last copy goes to <code>Documents\\FreeGSTBill Backups</code>).</p>
<p>By hand: in the launcher, ${ui('More options')} → ${ui('Stop the app')}, then delete the app folder and the <b>Free GST Billing</b> shortcuts on the Desktop and in the Start menu. Nothing is installed into Windows itself.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'install-mac',
  title: 'Install on a Mac, step by step',
  nav: 'Install on a Mac',
  lead: 'Paste one line into Terminal and press Return. About 3 minutes, no password, and no "Apple cannot check it" message. Every step says what you will see.',
  body: `
${which}

<section id="before">
<h2>Before you start</h2>
<ul>
  <li><strong>macOS 11 Big Sur or newer.</strong> To check: click the Apple menu (the apple logo at the top left), then ${ui('About This Mac')}.</li>
  <li><strong>Internet</strong> for the install. After that the app works offline.</li>
  <li><strong>About 600 MB of free space.</strong></li>
</ul>
</section>

<section id="one-line">
<h2>Install with one line</h2>
<ol class="steps">
  <li><strong>Copy this line</strong>Click the ${ui('Copy')} button at the right end of the line below. (Or select all of it and press ${key('Cmd', 'C')}.)
<pre><code>${UNIX_LINE}</code></pre></li>
  <li><strong>Open Terminal</strong>Press ${key('Cmd', 'Space')}, type <code>Terminal</code> and press ${key('Return')}. A plain text window opens. (More help: <a href="terminal.html#mac">Opening Terminal on a Mac</a>.)</li>
  <li><strong>Paste and press Return</strong>Press ${key('Cmd', 'V')}, then ${key('Return')}.</li>
  <li><strong>Watch it work</strong>It shows four steps, each ending in <b>OK</b>: <i>[1/4] Checking this computer</i>, <i>[2/4] Downloading</i> (also Node.js, the engine the app runs on, if this Mac does not have it), <i>[3/4] Installing</i>, <i>[4/4] Adding icons</i>.</li>
  <li><strong>Answer two questions</strong><i>Add Free GST Billing to the Dock? [y/N]</i> and <i>Open Free GST Billing by itself when this computer starts? [y/N]</i>. Type <code>y</code> and press ${key('Return')} for yes, or just ${key('Return')} for no.</li>
  <li><strong>The app opens</strong>It says <i>Done! Opening Free GST Billing...</i> and the app appears in its own window if you have Chrome or Edge, or in Safari otherwise. A short welcome asks for your business details; see <a href="first-run.html">The first-run setup</a>. You can close Terminal.</li>
</ol>
<p><b>Every day after that:</b> click <b>Free GST Billing</b> in the Dock or in Launchpad. (It lives in the <b>Applications</b> folder inside your home folder: Finder → ${ui('Go')} → ${ui('Home')} → <b>Applications</b>.)</p>
<p><b>To update or repair it:</b> paste the same line again. It backs up your data to <code>Documents/FreeGSTBill Backups</code> and replaces only the app's own files; your invoices, clients and settings stay as they are.</p>
<p>If something goes wrong, Terminal shows <b>PROBLEM</b> and, under it, what to do. Do that, then paste the line again.</p>
<p>The app's files are in <code>Applications/Free GST Billing</code> in your home folder; your data is in <code>_system/data</code> inside it.</p>
</section>

<section id="uninstall-mac">
<h2>Removing the app</h2>
<p><b>The easy way:</b> in the app, open ${ui('Control Panel')} and use ${ui('Remove…')}, then tick what else to delete. See <a href="control-panel.html#remove">Remove the App</a>.</p>
<p><b>Or</b> paste this into Terminal and press ${key('Return')}:</p>
<pre><code>${UNIX_REMOVE}</code></pre>
<p>It removes the app and its icon. Your invoices are kept unless you type <code>DELETE</code> when it asks. If the app is in the Dock, drag it out.</p>
</section>

<section id="zip">
<h2>Other way: download the ZIP</h2>
<p>Three parts: install Node.js, download the app, open it. About 10 minutes.</p>
</section>

<section id="node">
<h2>Part 1: Install Node.js (once)</h2>
<p>Node.js is free software the app runs on. It installs like any other Mac app.</p>
<ol class="steps">
  <li><strong>Go to nodejs.org</strong>Open <a href="https://nodejs.org/en/download">nodejs.org/en/download</a> in Safari or Chrome.</li>
  <li><strong>Download the macOS Installer</strong>Click the button for the <b>macOS Installer (.pkg)</b> of the <b>LTS</b> version. (LTS means the stable version.)</li>
  <li><strong>Open the downloaded file</strong>Click the download arrow in your browser, or open <b>Finder</b> → <b>Downloads</b>, and double-click the file whose name starts with <code>node-v</code> and ends in <code>.pkg</code>.</li>
  <li><strong>Click through the installer</strong>${ui('Continue')}, ${ui('Continue')}, ${ui('Agree')}, ${ui('Install')}. Type your Mac password when asked and click ${ui('Install Software')}. Then ${ui('Close')}. (If it asks to move the installer to the Bin, that is fine.)</li>
</ol>
</section>

<section id="download">
<h2>Part 2: Download and unzip the app</h2>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Find it in Downloads</strong>Open <b>Finder</b> (the blue face in the Dock) and click <b>Downloads</b> on the left. <b>Safari</b> usually unzips it for you, so you see a folder called <b>Free-GST-Billing</b>. If you see <code>Free-GST-Billing.zip</code> instead, double-click it to unzip.</li>
  <li><strong>Move the folder to Documents</strong>Drag the <b>Free-GST-Billing</b> folder onto <b>Documents</b> on the left of Finder, so it is not deleted when Downloads is cleared. Your invoices will be kept inside it.</li>
</ol>
</section>

<section id="open">
<h2>Part 3: Open it the first time</h2>
<p>Apple asks you to confirm apps that are not from the App Store. This is needed <b>once</b>.</p>
<ol class="steps">
  <li><strong>Control-click the launcher</strong>In the Free-GST-Billing folder, hold the ${key('Control')} key and click <b>Free GST Billing - MAC</b> (or right-click it, or click with two fingers on a trackpad). Choose ${ui('Open')}.</li>
  <li><strong>Confirm</strong>A box says macOS cannot check the developer. Click ${ui('Open')}.</li>
  <li><strong>On macOS 15 Sequoia or newer, if there is no Open button</strong>Click ${ui('Done')}. Open the Apple menu (the apple logo) → ${ui('System Settings')} → ${ui('Privacy &amp; Security')}, scroll down to the message about <b>Free GST Billing - MAC</b>, click ${ui('Open Anyway')}, type your password, then ${ui('Open Anyway')} again.</li>
  <li><strong>A Terminal window opens</strong>It is a plain text window; you do not need to type anything in it. (A download from before version 1.10.83 asks <i>Install now? [Y/n]</i>: press ${key('Return')}.)</li>
  <li><strong>Wait up to a minute</strong>When it says <i>Server running. This window can be closed</i>, the app opens in your browser at <code>http://localhost:47371</code>.</li>
  <li><strong>Close the Terminal window</strong>The app keeps running. A short welcome asks for your business details; see <a href="first-run.html">The first-run setup</a>.</li>
</ol>
</section>

<section id="mac-messages">
<h2>If the Mac shows a message</h2>
<ul>
  <li><strong>"could not be executed because you do not have appropriate access privileges"</strong>: you have a download from before v1.10.82. Download it again (Part 2), or fix this copy: open Terminal (see <a href="terminal.html#mac">Opening Terminal on a Mac</a>), type <code>chmod +x</code> and a space, drag <b>Free GST Billing - MAC</b> from Finder into the Terminal window, press ${key('Return')}, then go back to Part 3.</li>
  <li><strong>"Node.js is not installed"</strong> in the Terminal window: do Part 1, then open the launcher again. If it asks <i>Open the Node.js download page now? [y/N]</i>, type <code>y</code> and press ${key('Return')}.</li>
  <li><strong>"Node.js ... is too old"</strong>: install the current LTS from nodejs.org (Part 1); it replaces the old one.</li>
  <li><strong>"The app cannot reach the internet"</strong> or the install stops: check the Wi-Fi, then open the launcher again; it carries on.</li>
</ul>
<p>More in <a href="troubleshooting.html#mac-blocked">The Mac will not open the launcher</a>.</p>
</section>

<section id="every-day">
<h2>Every day after that</h2>
<ol class="steps">
  <li><strong>Double-click "Free GST Billing - MAC"</strong>After the first time, a normal double-click works. If the app is already running it just opens your browser.</li>
</ol>
<p><b>Tip:</b> make a Desktop shortcut. Control-click the launcher → ${ui('Make Alias')}, and drag the alias to your Desktop. You can also bookmark <code>http://localhost:47371</code> in your browser; it works while the app is running.</p>
<p>To stop the app: in the app open <b>Control Panel</b> in the sidebar and click ${ui('Stop Server')}. Restarting the Mac also stops it.</p>
<p>Your data is in <code>Free-GST-Billing/_system/data</code>. Updating: see <a href="update.html#mac">Updating on a Mac</a>; never drag a new download over the old folder.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'install-linux',
  title: 'Install on Linux or a NAS, step by step',
  nav: 'Install on Linux / NAS',
  lead: 'Ubuntu, Linux Mint and Debian: install the .deb package like any other program. Any other Linux: the AppImage, one file you double-click. Or paste one line into the Terminal. Each step is explained.',
  body: `
${which}

<section id="deb">
<h2>Ubuntu, Linux Mint, Debian: the .deb package</h2>
<p>The easiest way. Everything the app needs is inside, including Node.js: nothing else to install.</p>
<ol class="steps">
  <li><strong>Download</strong>Open the <a href="${RELEASES}">latest release</a> and, under <b>Assets</b>, click <b>free-gst-billing_<i>version</i>_amd64.deb</b>. It goes into your <b>Downloads</b> folder.</li>
  <li><strong>Install it</strong>Double-click the file. <b>Software Install</b> (Ubuntu) or <b>Package Installer</b> (Mint) opens: click ${ui('Install')} and type the password you use to log in. Or in the Terminal:
<pre><code>sudo apt install ~/Downloads/free-gst-billing_*_amd64.deb</code></pre></li>
  <li><strong>Open it</strong>Open your applications menu and click <b>Free GST Billing</b>. The app opens in its own window if you have Chrome, Chromium or Edge, or in your browser otherwise.</li>
</ol>
<p><b>Your books</b> (invoices, clients, settings, saved PDFs) are kept in your home folder, in <code>~/.local/share/free-gst-billing-data</code>. Each person who logs in to the computer has their own. The app answers this computer only.</p>
<p><b>To update:</b> download the new .deb from the release page and install it the same way. The app says so when a new version is out. Your books are not touched.</p>
<p><b>To remove the program:</b> <code>sudo apt remove free-gst-billing</code>. Your books stay in <code>~/.local/share/free-gst-billing-data</code>; delete that folder yourself only if you want them gone.</p>
</section>

<section id="appimage">
<h2>Any other Linux: the AppImage</h2>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${RELEASES}/download/Free-GST-Billing-Linux-x86_64.AppImage">Download the AppImage</a> (for 64-bit Intel or AMD computers).</li>
  <li><strong>Allow it to run, once</strong>Right-click the file → ${ui('Properties')} → ${ui('Permissions')} → tick ${ui('Allow executing file as program')}. Or in the Terminal: <code>chmod +x ~/Downloads/Free-GST-Billing-Linux-x86_64.AppImage</code></li>
  <li><strong>Double-click it</strong>The app opens. Keep the file somewhere you will find it again, for example your home folder.</li>
</ol>
<p>Your books are kept in <code>~/.local/share/free-gst-billing-data</code>, the same folder the .deb uses. <b>To update:</b> download the new AppImage and use it instead of the old file; your books are not touched.</p>
<p>If nothing happens on an older system, it is missing FUSE: run it once from the Terminal with <code>--appimage-extract-and-run</code> after the file name, or install the .deb instead.</p>
</section>

<section id="old-books">
<h2>Used the app before? Your earlier books</h2>
<p>If you used the ZIP or the one-line install before, the .deb and the AppImage start with <b>empty books</b> and leave the earlier copy exactly as it was. The first time they open, they show where the earlier books are (and keep that note in <code>~/.local/share/free-gst-billing-data/OLD-BOOKS-FOUND.txt</code>). To bring them across, before you enter anything new:</p>
<ol class="steps">
  <li><strong>Stop the new app</strong><b>Control Panel</b> in the app → ${ui('Stop Server')}.</li>
  <li><strong>Copy the books</strong>Paste the copy command from that note into the Terminal. For the one-line install it is:
<pre><code>cp -a ~/.local/share/free-gst-billing/_system/data/. ~/.local/share/free-gst-billing-data/data/</code></pre>
  It <b>copies</b>: the earlier copy keeps its books too.</li>
  <li><strong>Open Free GST Billing again</strong>Your invoices and clients are there.</li>
</ol>
<p>Or use the app itself: in the earlier copy, <a href="backup.html#export-import">Settings → Data Management → Export Backup</a>, then import that file in the new app.</p>
</section>

<section id="nas-docker">
<h2>On a NAS or home server: Docker</h2>
<p>For a Synology, QNAP, TrueNAS or any machine with Docker. The app runs in a container; your books are kept in a Docker volume.</p>
<div class="note warn"><strong>Opening it from other PCs comes on 14 November</strong>
<p>The app has no login yet, so for now the container answers <b>the NAS itself only</b>. Safe access from the other PCs and phones on your network, with pairing, a PIN and HTTPS, comes with the 14 November update. Until then, from another PC open a tunnel in its Terminal (<code>ssh -L 47371:127.0.0.1:47371 you@your-nas</code>) and go to <code>http://localhost:47371</code>.</p></div>
<ol class="steps">
  <li><strong>Get docker-compose.yml</strong>Download it from the <a href="${RELEASES}">latest release</a> into a folder on the NAS.</li>
  <li><strong>Start it</strong>In that folder: <code>docker compose up -d</code></li>
  <li><strong>Open it</strong><code>http://localhost:47371</code> on the NAS, or through the tunnel above.</li>
</ol>
<p><b>Never change</b> the line <code>"127.0.0.1:47371:47371"</code> to <code>"47371:47371"</code>: everyone on your network could then open and change your books without a password. To update: put the new version number in the <code>image:</code> line and run <code>docker compose up -d</code> again; the books stay in the volume. The container runs as an ordinary user, never as root.</p>
</section>

<section id="terminal">
<h2>Open the Terminal</h2>
<p>Press ${key('Ctrl', 'Alt', 'T')}. A window opens where you type commands. New to this? Read <a href="terminal.html">Using the Terminal</a> first; it takes two minutes.</p>
<p>To paste a command into the Terminal, use ${key('Ctrl', 'Shift', 'V')} (not ${key('Ctrl', 'V')}), then press ${key('Enter')}.</p>
</section>

<section id="one-line">
<h2>Other way: install with one line</h2>
<ol class="steps">
  <li><strong>Copy this line, paste it into the Terminal, press Enter</strong>
<pre><code>${UNIX_LINE}</code></pre></li>
  <li><strong>Watch it work</strong>It shows four steps, each ending in <b>OK</b>: <i>[1/4] Checking this computer</i>, <i>[2/4] Downloading</i> (also Node.js, the engine the app runs on, if the computer does not have version 18 or newer; it is kept inside the app folder), <i>[3/4] Installing</i>, <i>[4/4] Adding icons</i>.</li>
  <li><strong>Answer one question</strong><i>Open Free GST Billing by itself when this computer starts? [y/N]</i>: type <code>y</code> and press ${key('Enter')}, or just ${key('Enter')} for no.</li>
  <li><strong>The app opens</strong>In its own window if you have Chrome, Chromium or Edge, or in your browser otherwise.</li>
</ol>
<p><b>Every day after that:</b> open <b>Free GST Billing</b> from your applications menu. <b>To update or repair it:</b> run the same line again; your data is backed up to <code>~/Documents/FreeGSTBill Backups</code> first and never touched.</p>
<p>If it says <i>curl: command not found</i>, run <code>sudo apt install -y curl</code> first. The app goes to <code>~/.local/share/free-gst-billing</code>; your data is in <code>_system/data</code> inside it.</p>
<p><b>NAS or Alpine:</b> there may be no <code>bash</code>; end the line with <code>| sh</code> instead. Alpine needs Node.js from its own store first: <code>sudo apk add nodejs</code>. To choose the folder, put <code>FREEGSTBILL_DIR=/volume1/apps/free-gst-billing</code> just before <code>sh</code>.</p>
<p><b>To remove it</b> (your invoices are kept unless you type <code>DELETE</code> when asked):</p>
<pre><code>${UNIX_REMOVE}</code></pre>
</section>

<section id="zip">
<h2>Other way: download the ZIP</h2>
<p>Install Node.js yourself, then unzip and start the app.</p>
</section>

<section id="node">
<h2>Step 1: Install Node.js 20</h2>
<p>The Node.js in Ubuntu's own store is often too old for the app, so it comes from NodeSource, the official source for Linux. Paste these one at a time, pressing ${key('Enter')} after each:</p>
<pre><code>sudo apt install -y curl unzip</code></pre>
<pre><code>curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -</code></pre>
<pre><code>sudo apt install -y nodejs</code></pre>
<p><b>When it asks for your password</b>, type the password you use to log in and press ${key('Enter')}. <b>Nothing appears while you type</b>, not even dots; that is normal.</p>
<p>Check it worked:</p>
<pre><code>node -v</code></pre>
<p>It should print <code>v20</code> or higher, for example <code>v20.19.0</code>.</p>
<p><b>Fedora:</b> <code>sudo dnf install nodejs npm</code>. <b>Arch:</b> <code>sudo pacman -S nodejs npm</code>. <b>Alpine / NAS:</b> <code>sudo apk add nodejs npm</code>.</p>
</section>

<section id="download">
<h2>Step 2: Download and unzip</h2>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a> It goes into your <b>Downloads</b> folder.</li>
  <li><strong>Unzip it</strong>Paste this in the Terminal and press ${key('Enter')}: it unpacks the app into a folder in your home folder.
<pre><code>cd ~ && unzip -o ~/Downloads/Free-GST-Billing.zip</code></pre></li>
</ol>
</section>

<section id="start">
<h2>Step 3: Start the app</h2>
<pre><code>cd ~/Free-GST-Billing && bash "Free GST Billing - LINUX.sh"</code></pre>
<ol class="steps">
  <li><strong>Wait up to a minute</strong>When it says <i>Server running</i>, the app opens in your browser at <code>http://localhost:47371</code>. You can close the Terminal; the app keeps running. (A download from before version 1.10.83 first asks <i>Install now? [Y/n]</i>: press ${key('Enter')}.)</li>
</ol>
<p><b>Every day after that</b>, open the Terminal and run the same command. Or bookmark <code>http://localhost:47371</code>; it works while the app is running. To stop the app: <b>Control Panel</b> in the app → ${ui('Stop Server')}, or restart the computer.</p>
</section>

<section id="nas">
<h2>On a NAS or server (for IT people)</h2>
<pre><code>unzip Free-GST-Billing.zip
cd Free-GST-Billing
bash "_system/start-unix.sh"</code></pre>
<p>The ZIP carries the app's packages, so there is no <code>npm install</code>; any Node.js 18 or newer runs it.</p>
<p>The app listens on <code>127.0.0.1:47371</code> only (it has no login, so it is never opened to the network). Updating from inside the app needs <code>unzip</code> or python3.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'update',
  title: 'Updating the app, step by step',
  nav: 'Updating',
  lead: 'A new version comes out every Saturday. Updating keeps all your invoices, clients and settings, and the app backs them up first. The easiest way is one button inside the app.',
  body: `
<section id="in-app">
<h2>The easy way: the Update button (Windows, Mac, Linux)</h2>
<ol class="steps">
  <li><strong>Open the app</strong>When a new version is out, the sidebar shows <b>Update to v…</b> (you can also go to <b>Settings → App Updates</b>).</li>
  <li><strong>Read what is new and click Update Now</strong>A window shows what changed. Click ${ui('Update Now')}.</li>
  <li><strong>Wait about a minute</strong>A window shows the progress; it backs up your data first, then updates.</li>
  <li><strong>Reload the page</strong>Press ${key('F5')} (on a Mac ${key('Cmd', 'R')}). The version at the bottom of the Dashboard shows the new number.</li>
</ol>
<p>Changes still look the same? Press ${key('Ctrl', 'F5')} (Mac: ${key('Cmd', 'Shift', 'R')}) to make the browser load the new version.</p>
</section>

<section id="update-window">
<h3>The "Update available" window</h3>
<p>It opens when you click <b>Update to v…</b> in the sidebar. At the top it shows the new version and the one you are on, with the date it was released.</p>
<div class="table-wrap"><table>
  <tr><th>Part</th><th>What it means</th></tr>
  <tr><td><b>Your data is safe.</b></td><td>Updating replaces only the app itself. Your <code>data</code> folder (invoices, clients, products, settings) and your <code>Saved Invoices</code> PDFs are never touched.</td></tr>
  <tr><td>The release notes</td><td>What changed in this version.</td></tr>
  <tr><td><b>Recommended:</b> export a backup</td><td>${ui('Open Settings → Data Management')} takes you to <a href="backup.html#export-import">Export Backup</a>. Worth doing before any update, just in case.</td></tr>
  <tr><td>${ui('Skip this version')}</td><td>Hides the <b>Update to v…</b> button for this version. The next version will be offered as usual, and you can still update from <b>Settings → App Updates</b>.</td></tr>
  <tr><td>${ui('Remind me later')}</td><td>Closes the window; the sidebar button stays.</td></tr>
  <tr><td>${ui('View on GitHub')}</td><td>Opens the release page in your browser.</td></tr>
  <tr><td>${ui('Update Now')}</td><td>Backs up your data, then fetches and installs the new version. It takes about a minute: leave the window open, then reload the page when it finishes.</td></tr>
</table></div>
<div class="note tip"><strong>Something wrong?</strong>
<p>If the update stops with an error, your data is still safe. See <a href="troubleshooting.html#update-failed">The update failed</a>, or use one of the other ways on this page.</p>
</div>
</section>

<section id="one-line">
<h2>Also easy: the install line again</h2>
<p>The line that installs the app also updates it, and repairs it if it will not start. It finds your install, backs up your data first, replaces only the app's own files and opens the new version.</p>
<p><b>Windows:</b> press ${key('Windows', 'R')}, paste this, press ${key('Enter')}:</p>
<pre><code>${WIN_LINE}</code></pre>
<p><b>Mac and Linux:</b> open Terminal, paste this, press ${key('Return')}:</p>
<pre><code>${UNIX_LINE}</code></pre>
</section>

<section id="windows">
<h2>Windows: other ways</h2>
<p><b>From the launcher:</b> double-click <b>Free GST Billing - WINDOWS</b> in the Free-GST-Billing folder → ${ui('More options')} → ${ui('Update to the latest version')} → then ${ui('Open App')}.</p>
<p><b>By hand, with the ZIP</b> (if the app does not open at all):</p>
<ol class="steps">
  <li><strong>Download</strong><a class="download" href="${SITE.download}">Download Free GST Billing</a></li>
  <li><strong>Stop the app</strong>Launcher → ${ui('More options')} → ${ui('Stop the app')}.</li>
  <li><strong>Extract into the same place as before</strong>Right-click the ZIP → ${ui('Extract All\u2026')} → ${ui('Browse\u2026')} → choose the folder that <i>contains</i> your Free-GST-Billing folder (for example <b>Documents</b>) → ${ui('Extract')}.</li>
  <li><strong>Replace the files</strong>Windows asks about files that already exist: choose ${ui('Replace the files in the destination')}. On Windows this <b>adds</b> to your folder; your <code>_system\\data</code> folder is not touched.</li>
  <li><strong>Open the app</strong>Double-click <b>Free GST Billing - WINDOWS</b> → ${ui('Open App')}. The first start after an update takes a minute.</li>
</ol>
<p>If you extracted the new ZIP somewhere else and opened its launcher, it says <i>Free GST Billing is already installed on this computer</i> and offers ${ui('Update the installed copy')}: use that, and delete the new folder.</p>
</section>

<section id="mac">
<h2>Mac: other ways</h2>
<p>Use the <a href="#in-app">Update button</a> in the app. That is the safe way on a Mac.</p>
<div class="note warn"><strong>Never drag a new download over your old folder on a Mac</strong>
<p>On a Mac, Finder's ${ui('Replace')} swaps the <b>whole</b> folder, including <code>_system/data</code> with all your invoices. (Windows merges folders; the Mac does not.)</p></div>
<p>If the app will not open and you need the new download:</p>
<ol class="steps">
  <li><strong>Back up first</strong>If the app opens: <b>Settings → Data Management → Export Backup…</b>.</li>
  <li><strong>Download and unzip the new version</strong>It appears as a new folder (macOS may call it <b>Free-GST-Billing 2</b>).</li>
  <li><strong>Move your data across</strong>In your <b>old</b> folder open <code>_system</code> (if you cannot see it, press ${key('Cmd', 'Shift', '.')} in Finder to show hidden folders) and copy the <code>data</code> folder. In the <b>new</b> folder open <code>_system</code> and paste it (${key('Cmd', 'V')}), choosing ${ui('Replace')} for that <b>data</b> folder only.</li>
  <li><strong>Open the new launcher</strong>As in <a href="install-mac.html#open">Install on a Mac, Part 3</a>. When everything works, you can delete the old folder.</li>
</ol>
</section>

<section id="linux">
<h2>Linux: other ways</h2>
<p>Use the Update button, or in the Terminal:</p>
<pre><code>sh ~/Free-GST-Billing/_system/update-unix.sh</code></pre>
<p>It downloads the newest version, checks every file, keeps <code>_system/data</code>, and rolls back if anything fails. Restart the app afterwards.</p>
<p><b>Installed the .deb?</b> The Update button does not apply: download the new <b>.deb</b> from the <a href="${RELEASES}">release page</a> and install it over the old one (<a href="install-linux.html#deb">how</a>). <b>The AppImage?</b> Download the new AppImage and use it instead of the old file. <b>Docker?</b> Put the new version in the <code>image:</code> line and run <code>docker compose up -d</code>. Your books are kept every time.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'terminal',
  title: 'Using the Terminal, for beginners',
  nav: 'Using the Terminal',
  lead: 'Some fixes ask you to type a command. The Terminal (Command Prompt on Windows) is just a window where you type an instruction and press Enter. This page shows how, on every computer.',
  body: `
<section id="what">
<h2>What it is</h2>
<p>A plain window with a blinking cursor. You type (or paste) one line, press ${key('Enter')} (Mac: ${key('Return')}), and the computer does it and prints the result. You cannot break anything by opening it, and closing the window is always safe.</p>
</section>

<section id="windows">
<h2>Opening it on Windows</h2>
<ol class="steps">
  <li><strong>Press Windows + R</strong>A small <b>Run</b> box opens at the bottom left.</li>
  <li><strong>Type <code>cmd</code> and press Enter</strong>A black <b>Command Prompt</b> window opens.</li>
</ol>
<p>To paste a command: ${key('Ctrl', 'V')}, or right-click inside the window. Then press ${key('Enter')}.</p>
<p><b>Example:</b> to see your Node.js version, type <code>node -v</code> and press ${key('Enter')}. It prints something like <code>v20.19.0</code>. If it prints <i>not recognized</i>, Node.js is not installed for the whole PC, which is fine: the app keeps its own copy.</p>
</section>

<section id="mac">
<h2>Opening it on a Mac</h2>
<ol class="steps">
  <li><strong>Press Cmd + Space</strong>The Spotlight search bar opens in the middle of the screen.</li>
  <li><strong>Type <code>Terminal</code> and press Return</strong>A white or black <b>Terminal</b> window opens.</li>
</ol>
<p>Or: <b>Finder</b> → <b>Applications</b> → <b>Utilities</b> → <b>Terminal</b>.</p>
<p>To paste a command: ${key('Cmd', 'V')}, then ${key('Return')}.</p>
</section>

<section id="linux">
<h2>Opening it on Linux</h2>
<p>Press ${key('Ctrl', 'Alt', 'T')}, or search for <b>Terminal</b> in your apps. To paste: ${key('Ctrl', 'Shift', 'V')}, then ${key('Enter')}.</p>
</section>

<section id="tips">
<h2>Four things worth knowing</h2>
<ul>
  <li><strong>Drag a file in to type its location.</strong> Instead of typing a long folder path, drag the file from Finder or File Explorer into the Terminal window; its full path appears, ready to use.</li>
  <li><strong>Passwords are invisible.</strong> When it asks for your password, nothing appears as you type, not even dots. Type it anyway and press ${key('Enter')}.</li>
  <li><strong>Names with spaces need quotes.</strong> <code>"Free GST Billing - MAC.command"</code>. Dragging the file in adds what is needed for you.</li>
  <li><strong>To stop a command</strong> that keeps running, press ${key('Ctrl', 'C')}.</li>
</ul>
</section>

<section id="example">
<h2>Example: fixing the Mac launcher</h2>
<p>If a Mac says the launcher <i>could not be executed because you do not have appropriate access privileges</i>:</p>
<ol class="steps">
  <li><strong>Open Terminal</strong>${key('Cmd', 'Space')}, type <code>Terminal</code>, ${key('Return')}.</li>
  <li><strong>Type the start of the command</strong>Type <code>chmod +x</code> and then one space. Do not press Return yet.</li>
  <li><strong>Drag the launcher in</strong>Drag <b>Free GST Billing - MAC</b> from your Free-GST-Billing folder into the Terminal window. The line now ends with its location.</li>
  <li><strong>Press Return</strong>Nothing is printed: that means it worked. Close Terminal and open the launcher again (Control-click → ${ui('Open')}).</li>
</ol>
</section>
`,
},
];
