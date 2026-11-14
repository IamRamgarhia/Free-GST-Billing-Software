import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;
const img = (f) => `assets/img/${f}`;

export default [
// =============================================================================
{
  slug: 'index',
  title: 'Free GST Billing documentation',
  nav: 'Welcome',
  lead: 'Make GST invoices, keep track of who owes you, and prepare your GST returns. On your own computer, with no account and no monthly fee.',
  body: `
<div class="note tip"><strong>Free forever. Works on your computer, even offline. No tracking. No ads.</strong>
<p>Your invoices never leave your computer, there is no account to make, and nothing is ever sold to you inside the app. Don't take our word for it: <a href="security.html#check-yourself">check it yourself in two minutes</a>.</p></div>
<ul class="doors">
  <li><a href="install.html"><b>Install it</b><span>Download, extract, click Install. About three minutes, no admin rights needed.</span></a></li>
  <li><a href="first-invoice.html"><b>Make your first invoice</b><span>From a blank app to a GST tax invoice you can send, in five minutes.</span></a></li>
  <li><a href="troubleshooting.html"><b>Something isn't working</b><span>The common problems, what causes each one, and the fix.</span></a></li>
</ul>

<section id="what-it-does">
<h2>What it does</h2>
<p>Free GST Billing is invoicing and GST software for small businesses in India, and for anyone billing in other currencies: 20 are supported. It runs on your computer and opens in your web browser, the way a website does, but nothing leaves your machine.</p>
<ul>
  <li><strong>Invoices</strong>: tax invoices, bills of supply, proforma estimates, credit notes and delivery challans, with CGST, SGST, IGST and UTGST worked out for you.</li>
  <li><strong>Getting paid</strong>: record payments, print receipts, see who is overdue and by how much.</li>
  <li><strong>GST returns</strong>: GSTR-1 and GSTR-3B built from your invoices and purchases, as files you upload to the GST portal.</li>
  <li><strong>The rest of the books</strong>: clients, products and stock, purchases, expenses, recurring invoices, profit and loss, and an income tax calculator.</li>
</ul>
</section>

<section id="requirements">
<h2>What you need</h2>
<table>
  <tr><th>Computer</th><td>Windows 10 or 11, macOS, or Linux (a NAS works too).</td></tr>
  <tr><th>Browser</th><td>Chrome, Edge, Firefox or Brave. The app opens in it.</td></tr>
  <tr><th>Disk space</th><td>Roughly 200 MB once installed.</td></tr>
  <tr><th>Internet</th><td>Only for the first install and for updates. Everything else works offline.</td></tr>
  <tr><th>Account or signup</th><td>None.</td></tr>
</table>
</section>

<section id="your-data">
<h2>Where your data lives</h2>
<p>Every invoice, client and setting is saved as plain files inside the app's folder, in <code>_system\\data</code>. They never leave your computer unless you turn on Google Drive backup yourself.</p>
<p>That also means backing up is your job, and it is easy. See <a href="backup.html">Backups, updates and moving PC</a>.</p>
</section>

<section id="is-it-free">
<h2>Is it really free?</h2>
<p>Yes. It is open source under the MIT licence. There is no trial, no invoice limit, no feature that unlocks for money, and no advertising. The code is public on <a href="${SITE.repo}">GitHub</a>, so anyone can check what it does. Is it safe? See <a href="security.html">Security and privacy</a>.</p>
</section>

<section id="get-help">
<h2>Getting help</h2>
<p>Every screen in the app with a ${ui('?')} button links to the matching part of these pages. If something is missing here, or the app does something these pages don't describe, <a href="${SITE.repo}/issues">open an issue on GitHub</a> with a screenshot. Many features began as someone's request.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'first-run',
  title: 'The first-run setup',
  nav: 'First-run setup',
  lead: 'The screens you see the first time the app opens: one four-step welcome that asks what kind of business you run, your business details and your bank details. You can skip it and change everything later.',
  body: `
<section id="welcome">
<h2>Step 1 of the welcome: your business type and where you invoice from</h2>
<p>The first screen asks two things. The buttons at the bottom, ${ui('Skip Setup')} and ${ui('Get Started')}, stay on screen while you scroll, on a PC and on a phone.</p>
<p>A small <b>Safe and private</b> box at the bottom sums up how your data is kept: on this computer, with no account, working offline, in open-source code anyone can check. Its ${ui('How we keep it safe')} link opens <a href="security.html">Is it safe? Security and privacy</a>.</p>
</section>

<section id="business-type">
<h3>What kind of business do you run?</h3>
<p>Click the card that fits you best; it turns blue (click it again to un-pick it). Each card has a one-line hint:</p>
<div class="table-wrap"><table>
  <tr><th>Card</th><th>For</th></tr>
  <tr><td>Retail shop / kirana</td><td>Selling from a counter, keeping stock, buying from suppliers.</td></tr>
  <tr><td>Freelancer / consultant</td><td>Billing for your time or services, no stock.</td></tr>
  <tr><td>Restaurant / cafe</td><td>Quick bills, UPI payments, buying supplies.</td></tr>
  <tr><td>Wholesale / trading</td><td>Buying and selling goods in bulk and sending them with e-way bills.</td></tr>
  <tr><td>Manufacturing</td><td>Making products from raw material.</td></tr>
  <tr><td>Service / repair shop</td><td>Repairs and services, spare parts in stock, yearly contracts.</td></tr>
  <tr><td>Everything</td><td>Every feature the app has.</td></tr>
</table></div>
<p>When you finish (or skip) the welcome, your choice:</p>
<ul>
  <li>decides which screens the sidebar shows (a freelancer, for example, does not see Products or Purchases). Hidden screens are only hidden: nothing is deleted, and you can switch any feature back on in <a href="settings.html#features">Settings → Features</a>;</li>
  <li>sets a matching <a href="print-settings.html#business-type">print style</a>;</li>
  <li>puts the matching ready-made terms on your bills instead of the general <b>Standard Terms</b> (see <a href="settings.html#business-type">what a business type sets</a>);</li>
  <li>for a retail shop or restaurant, starts every new invoice with the customer <b>Cash Sale</b>.</li>
</ul>
<p>Pick none and every feature stays as it is. You can change the type any time in <a href="settings.html#business-type">Settings → Company → Business type</a>.</p>
<div class="note tip"><strong>Not sure?</strong>
<p>Pick the one closest to what you do most. A shop that also repairs things can pick Retail shop / kirana. If you want to see everything first, pick <b>Everything</b> and hide what you do not use later.</p>
</div>
</section>

<section id="region">
<h3>Where will you be invoicing from?</h3>
<table>
  <tr><td>🇮🇳 India</td><td>GST, GSTR-1 and 3B, UPI. The default.</td></tr>
  <tr><td>🌍 Outside India</td><td>VAT and other local taxes</td></tr>
  <tr><td>🌐 Both</td><td>India, with clients abroad</td></tr>
</table>
<p>${ui('Get Started')} carries on. ${ui('Skip Setup')} goes straight to the app (with the business type you picked, if any); fill in <a href="settings.html#company-details">Settings</a> later. Paper size and the language of the printed headings are in <a href="print-settings.html">Print and PDF settings</a>.</p>
</section>

<section id="business-details">
<h2>Step 2: business details</h2>
<p>These print at the top of every invoice. Only the <b>Business Name</b> is required.</p>
<table>
  <tr><td>Business Name</td><td>Required</td></tr>
  <tr><td>Address</td><td>Your full address</td></tr>
  <tr><td>GSTIN</td><td>Leave blank if you are not registered. Typing all 15 characters fills in the State and PAN for you (only if they are empty)</td></tr>
  <tr><td>State</td><td>Needed to work out CGST and SGST versus IGST</td></tr>
  <tr><td>PAN, Phone, Email</td><td>Optional</td></tr>
</table>
<p>${ui('Next')} stays greyed out until a Business Name is typed. ${ui('Back')} returns to the first screen without losing what you typed.</p>
<div class="note tip"><strong>Getting it right</strong>
<p><b>State</b> is where your business is registered. The app compares it with each client's state: same state means CGST + SGST, a different state means IGST. A wrong state here makes the tax wrong on every invoice.</p>
<p><b>GSTIN</b> is your 15-character GST number, for example <code>07ABCDE1234F1Z5</code>. Its first two digits are your state code. Not registered for GST? Leave it blank; you can make bills without GST. Everything here can be changed later in <a href="settings.html#company-details">Settings → Company details</a>.</p>
</div>
<p>Not sure whether you need GST registration, or which scheme to choose? See <a href="gst-basics.html#registration">GST basics: do I need GST registration?</a></p>
</section>

<section id="bank-upi">
<h2>Step 3: bank and UPI</h2>
<p>Where clients should pay you: bank name, account number, IFSC code and UPI ID. A UPI ID puts a scan-to-pay QR code on your invoices. You can also upload your logo and signature here, up to 500 KB each, and choose <b>Show my business name and logo in the app's menu</b> (ticked to start; change it any time in <a href="settings.html#branding">Settings → Company → Branding</a>). ${ui('Skip, I’ll add later')} leaves it all for <a href="settings.html#payment-accounts">Settings</a>.</p>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>"Image must be under 500KB".</b> The logo or signature file is too big. Open it in Paint (or any photo app), make it smaller, save it as PNG or JPG, and choose it again.</p>
<p><b>A typing mistake in the account number or IFSC.</b> Check them against your passbook or cheque book; they print on every invoice. You can correct them later in <a href="settings.html#payment-accounts">Settings → Payment accounts</a>.</p>
</div>
</section>

<section id="all-set">
<h2>Step 4: you're all set</h2>
<p>A short list of what to do next: make your first invoice, download or share it, check the GST reports, and file your returns. ${ui('Start Billing')} saves everything; your bank details become your first <a href="settings.html#payment-accounts">payment account</a>. You see <b>Setup complete! Start creating invoices.</b> and the app opens.</p>
<p>If you see <b>Failed to save. Try again.</b>, the app's engine stopped: check it is still running (see <a href="troubleshooting.html#cannot-connect">Failed to fetch</a>) and click ${ui('Start Billing')} again.</p>
<p>Next: <a href="first-invoice.html">make your first invoice</a>.</p>
</section>
`,
},

// =============================================================================
{
  slug: 'first-invoice',
  title: 'Your first invoice',
  lead: 'From a blank app to a GST tax invoice you can send, in about five minutes.',
  body: `
<section id="before-you-start">
<h2>Before you start</h2>
<p>Have these to hand: your business name, address and GSTIN, and your bank account or UPI ID if you want clients to pay you directly from the invoice. None of it is compulsory, and all of it can be added later.</p>
</section>

<section id="walkthrough">
<h2>Make the invoice</h2>
<ol class="steps">
  <li><strong>Add your business details</strong>If you skipped the welcome, open ${ui('Settings')} and fill in <b>Company Details</b>. This is the header of every invoice. Your state matters: it decides whether GST is split into CGST and SGST, or charged as IGST.</li>
  <li><strong>Start a new invoice</strong>Click ${ui('New Invoice')} in the sidebar. <b>Tax Invoice</b> is already selected, which is the right choice for a normal GST sale.</li>
  <li><strong>Add the client</strong>Under <b>Billed To</b>, type the client's name. If they are registered for GST, type their GSTIN and their state fills in by itself. A mistyped GSTIN is caught straight away.</li>
  <li><strong>Add what you sold</strong>For each line, give a description, quantity, unit, rate and GST rate. The HSN or SAC code is optional but helps your GST return. Not sure which rate or code? See <a href="gst-basics.html#which-rate">What GST rate do I charge?</a> and <a href="gst-basics.html#hsn-search">finding your HSN or SAC code</a>. Clicking a number field selects what is there, so you can just type.</li>
  <li><strong>Check the tax</strong>The preview on the right shows the totals. Same state as you: CGST and SGST. Another state: IGST. You do not need to choose.</li>
  <li><strong>Save and download</strong>Click ${ui('Save &amp; Download')}. The invoice gets its number, is saved to your records, and downloads as a PDF.</li>
</ol>
<figure><img src="${img('toolbar.png')}" alt="The invoice toolbar: Save, Save and Download, Print, WhatsApp, E-Way Bill, E-invoice, Customize, Hide Preview"><figcaption>The invoice toolbar stays at the top of the screen as you scroll.</figcaption></figure>
</section>

<section id="send">
<h2>Send it</h2>
<ul>
  <li>${ui('WhatsApp')} sends the PDF to the client. On a phone the share menu opens with the PDF attached; on a computer the PDF is copied and the chat opens: press <b>Ctrl+V</b> (Mac: <b>Cmd+V</b>) in the chat, then Send.</li>
  <li>${ui('Print')} opens your printer directly, including thermal receipt printers.</li>
  <li>Or attach the downloaded PDF to an email yourself.</li>
</ul>
</section>

<section id="get-paid">
<h2>When the client pays</h2>
<p>On the <a href="dashboard.html">Dashboard</a>, find the invoice and record the payment. A printable receipt opens straight away, and the invoice's status changes to <b>Partial</b> or <b>Paid</b>. Unpaid invoices past their due date are marked <b>Overdue</b> for you.</p>
</section>

<section id="whats-next">
<h2>What to do next</h2>
<ul>
  <li><a href="products.html">Add your products and services</a>, so you pick them from a list instead of typing them each time.</li>
  <li><a href="settings.html#payment-accounts">Add your bank or UPI</a>, so a payment QR code prints on every invoice.</li>
  <li><a href="settings.html#branding">Add your logo, signature and stamp</a>.</li>
  <li>At the end of the month, <a href="gst-returns.html">prepare your GST returns</a> from the invoices you have made.</li>
  <li>New to GST? Read <a href="gst-basics.html">GST basics for new business owners</a>: registration, rates, HSN codes, returns and due dates.</li>
</ul>
<p>The <b>Getting started</b> list on the Dashboard tracks these for you, and ticks each one off once it is done.</p>
</section>
`,
},
];
