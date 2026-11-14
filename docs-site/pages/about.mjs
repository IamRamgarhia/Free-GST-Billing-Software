// Support & About - the docs-site twin of the app's Support & About page
// (src/components/SupportView.jsx). Keep the two saying the same things.
import QRCode from 'qrcode';
import { SITE } from '../site.mjs';

const ui = (s) => `<span class="ui">${s}</span>`;
const UPI_ID = 'princeramgarhiaa-1@okaxis';
const upi = (amount) => `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=DiceCodes&cu=INR`
  + `&tn=${encodeURIComponent('Free GST Billing support')}${amount ? `&am=${amount}.00` : ''}`;
// Drawn at build time: the page needs no script, and the QR works offline once saved.
const qrSvg = await QRCode.toString(upi(0), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });

const SERVICES = [
  ['Custom software &amp; web apps', 'Websites, web apps and business tools built for how you work.'],
  ['Customising this app', 'Your own invoice layout, reports or features in Free GST Billing.'],
  ['Setup &amp; data migration', 'Installation, moving your data from Tally or Excel, and training.'],
  ['Support plans for businesses', 'Priority help and updates on a yearly plan.'],
  ['AI integration', 'Add AI to your product: assistants, document reading, smart search.'],
  ['AI automation', 'Automate the repetitive work in the software you already use.'],
  ['Mobile apps', 'Android and iPhone apps for your business or customers.'],
];
const share = encodeURIComponent(`I make my GST invoices with Free GST Billing Software. It's free, works offline and keeps data on your own computer: ${SITE.repo}`);

export default [
{
  slug: 'support',
  title: 'Support & About',
  nav: 'Support & About',
  lead: 'Who makes Free GST Billing, how you can help it grow, and what DiceCodes builds for businesses.',
  body: `
<section id="about">
<h2>Free, and it stays free</h2>
<p>Free GST Billing is built and maintained by <a href="${SITE.publisher.url}">DiceCodes</a> in India. No ads, no account, no locked features, and your invoices never leave your computer. The full source code is on <a href="${SITE.repo}">GitHub</a> under the MIT licence.</p>
<p>After the ways to support, <b>Safe and private</b> lists what happens to your data: it stays on this computer, no account, works offline, no tracking, other computers cannot open it, open source, a safe install, daily backups, the PIN lock, problem reports, security fixes, and your part. Each point opens its part of <a href="security.html">Is it safe? Security and privacy</a>.</p>
<p>If it saves you time every month, you can help keep the fixes and new features coming.</p>
</section>

<section id="upi">
<h2>Support with UPI</h2>
<p>Scan with GPay, PhonePe, Paytm or any UPI app. Any amount helps.</p>
<div class="upi-box">
  <div class="upi-qr" role="img" aria-label="UPI QR code to pay DiceCodes">${qrSvg}</div>
  <div class="upi-text">
    <p class="upi-label">UPI ID</p>
    <p class="upi-id"><code>${UPI_ID}</code></p>
    <p class="upi-amounts">On your phone, tap an amount to open your UPI app:
      <a href="${upi(200)}">₹200</a> <a href="${upi(500)}">₹500</a> <a href="${upi(1000)}">₹1,000</a> <a href="${upi(0)}">Any amount</a></p>
  </div>
</div>
<p>The payment note says "Free GST Billing support". Paying from the app's Support &amp; About page adds your business name to it, so DiceCodes can thank you.</p>

<h3>The Support with UPI card in the app</h3>
<p>Giving money is completely optional. Nothing in the app is locked, and nothing is ever printed on your invoices, whatever you choose. The QR code is drawn inside the app, so the card works even without internet.</p>
<div class="table-wrap"><table>
  <tr><th>On the card</th><th>What it does</th></tr>
  <tr><td>${ui('₹200')} ${ui('₹500')} ${ui('₹1000')} ${ui('Any amount')}</td><td>Picks the amount the QR code asks for. <b>Any amount</b> leaves it blank so you type it in your UPI app.</td></tr>
  <tr><td>The QR code</td><td>Scan it with GPay, PhonePe, Paytm, BHIM or your bank's app. The payee is <b>DiceCodes</b>.</td></tr>
  <tr><td><b>UPI ID</b> and ${ui('Copy UPI ID')}</td><td>To pay from a phone that cannot scan this screen: copy the ID and paste it in your UPI app as "Pay to UPI ID". It shows <b>Copied</b> for two seconds.</td></tr>
  <tr><td><b>Payment note</b></td><td>The note your UPI app fills in: "Free GST Billing support", plus your business name from Settings.</td></tr>
  <tr><td><b>Include my business name, so DiceCodes can thank you</b></td><td>Shown when your business name is saved. Untick it to pay without your name in the note.</td></tr>
</table></div>
<ol class="steps">
  <li><strong>Open Support &amp; About</strong>Near the bottom of the sidebar.</li>
  <li><strong>Choose an amount</strong>Click one of the amount buttons, or leave <b>Any amount</b>.</li>
  <li><strong>Scan and pay</strong>Open your UPI app, scan the QR code, check the amount and the note, and enter your UPI PIN as usual.</li>
</ol>
<div class="note tip"><strong>Something wrong?</strong>
<p><b>The QR does not scan.</b> Make the screen brighter and hold the phone 15 to 20 cm away, or use ${ui('Copy UPI ID')} instead.</p>
<p><b>Copy does nothing.</b> If the browser blocks copying, the UPI ID is shown in a small message at the bottom of the screen for a few seconds; type it in your UPI app.</p>
</div>
</section>

<section id="supporters-card">
<h2>Received so far, and the supporters list</h2>
<p>In the app, below the two support cards, a card shows how much users have given so far and from how many supporters, or <b>Be the first to support Free GST Billing</b> before anyone has. The figures come from a list the maintainer keeps on GitHub. The app reads it when the page opens and keeps the last figures it saw, so they still show when you are offline (the card is left out until it has been read once).</p>
<ul>
  <li><b>Goal</b>, when there is one: what the money is going towards, with a bar showing how far it has got.</li>
  <li>${ui('Thank you to our N supporters - see all')} opens the list of names, newest first, with the date and amount where known. ${ui('Hide the list')} closes it.</li>
  <li>With six or more names, a <b>Find your name</b> box searches the list.</li>
</ul>
<figure><img src="assets/img/support-supporters.png" alt="The supporters card on Support and About: the amount received so far and from how many supporters, the goal with its progress bar, and the open list of names with date and amount, plus a Find your name box." loading="lazy"><figcaption>The supporters card with the list open.</figcaption></figure>
<p>Paid but not on the list yet? The list is updated by hand, so a new payment can take a little while to appear. Paying with <b>Include my business name</b> ticked helps us match your payment.</p>
</section>

<section id="supporters" class="supporters" hidden>
<h2>Supporters</h2>
<!-- Filled in by docs.js from supporters.json in the GitHub repo, which the
     maintainer updates; stays hidden when it cannot be read. -->
<p class="supporters-total"></p>
<p class="supporters-meta"></p>
<div class="supporters-goal" hidden>
  <p class="supporters-goal-text"></p>
  <div class="supporters-bar" role="progressbar" aria-label="Progress towards the goal" aria-valuemin="0"><span></span></div>
</div>
<p class="supporters-thanks" hidden></p>
</section>

<section id="free-ways">
<h2>Help without paying</h2>
<p>These matter just as much.</p>
<ul>
  <li><strong><a href="${SITE.repo}">Star it on GitHub</a></strong>: helps other businesses find it.</li>
  <li><strong><a href="https://wa.me/?text=${share}">Tell another business</a></strong>: send it to a friend on WhatsApp.</li>
  <li><strong><a href="${SITE.repo}/issues/new/choose">Report a bug or ask for a feature</a></strong>: many features started as a request.</li>
</ul>
<p>In the app each line is a link that opens in your browser. <b>Star it on GitHub</b> needs a free GitHub account: click the ☆ <b>Star</b> button at the top right of the page. <b>Tell another business</b> opens WhatsApp with a short message and the link already written; pick a contact and send. <b>Report a bug or ask for a feature</b> opens GitHub's forms (see <a href="troubleshooting.html#report-problem">Reporting a problem</a>).</p>
</section>

<section id="weekly">
<h2>A new update every Saturday</h2>
<p>Every Saturday we release one update with that week's fixes and new features. The app tells you when it is ready: click <b>Update</b> in the sidebar, and your invoices and settings are kept. Anything urgent, such as the app not opening, is fixed straight away.</p>
<ul>
  <li><strong><a href="${SITE.repo}/issues/new?template=bug_report.yml">Report a problem</a></strong>: say which version, which computer, and what you did. That lets us fix it the same week.</li>
  <li><strong><a href="${SITE.repo}/issues/new?template=feature_request.yml">Ask for a feature</a></strong>: we read every request each week, and the ones most people ask for come first. Add a 👍 to an <a href="${SITE.repo}/issues">open request</a> to vote for it.</li>
</ul>
<p>You get a reply on GitHub when it ships. What each update changed is in the app under <b>Support &amp; About → What's new</b>, in the <a href="${SITE.repo}/blob/main/CHANGELOG.md">full changelog</a>, and on <a href="${SITE.repo}/releases">GitHub Releases</a>.</p>
<p>The card in the app has four buttons:</p>
<div class="table-wrap"><table>
  <tr><th>Button</th><th>What it does</th></tr>
  <tr><td>${ui('Report a problem')}</td><td>Opens GitHub's problem form. For a problem the app logged, ${ui('Report')} in the <a href="troubleshooting.html#problem-log">Problem log</a> is better: it fills in the details for you.</td></tr>
  <tr><td>${ui('Ask for a feature')}</td><td>Opens GitHub's feature request form.</td></tr>
  <tr><td>${ui('See all requests')}</td><td>Every open request. Search it first; if yours is already there, add a 👍 to it.</td></tr>
  <tr><td>${ui("What's new")} or ${ui('Changelog')}</td><td>Scrolls down to the <a href="#whats-new">What's new</a> card. When the app cannot read its changelog, the button is called <b>Changelog</b> and opens the full list on GitHub instead.</td></tr>
</table></div>
<p>To install an update, see <a href="update.html#in-app">Updating the app</a>.</p>
</section>

<section id="whats-new">
<h2>What's new</h2>
<p>The <b>What's new</b> card in the app lists the last six updates, read from the changelog that comes with your copy of the app. The newest is open; click any version number to open or close it. Each shows its date, a one-line summary and the changes grouped under headings such as <i>Added</i> and <i>Fixed</i>.</p>
<p>The card shows what <b>your</b> copy contains. If it stops at an older version, you have not updated yet: see <a href="update.html#in-app">Updating the app</a>. The <b>full changelog</b> link has every version since the first, and <b>GitHub Releases</b> has the downloads. If the card is missing, the changelog file could not be read; the ${ui('Changelog')} button above opens it on GitHub.</p>
</section>

<section id="services">
<h2>Work with DiceCodes</h2>
<p>The team behind this app builds software for businesses too.</p>
<div class="service-grid">
${SERVICES.map(([t, d]) => `  <div class="service"><strong>${t}</strong><span>${d}</span></div>`).join('\n')}
</div>
<p>Email <a href="mailto:contact@dicecodes.com?subject=${encodeURIComponent('Project enquiry (from the Free GST Billing docs)')}">contact@dicecodes.com</a> or visit <a href="${SITE.publisher.url}">dicecodes.com</a>.</p>
<p>In the app, ${ui('Email contact@dicecodes.com')} opens your email program with the subject "Project enquiry (from Free GST Billing)" filled in; say what you need and roughly when. ${ui('dicecodes.com')} opens the website. This is paid work and separate from the free app: the app stays free whether or not you hire us. For a problem with the app itself, use <a href="troubleshooting.html#report-problem">Reporting a problem</a> instead.</p>
</section>

<section id="in-the-app">
<h2>In the app</h2>
<p>The same page is in the app: <b>Support &amp; About</b>, near the bottom of the sidebar. From top to bottom it has these cards, each with a small ? that opens its part of this page:</p>
<ul>
  <li><a href="#about">Free, and it stays free</a></li>
  <li><a href="#upi">Support with UPI</a> and <a href="#free-ways">Help without paying</a>, side by side</li>
  <li><a href="#supporters-card">Received so far</a>, with the supporters list</li>
  <li><a href="#weekly">A new update every Saturday</a> and <a href="#whats-new">What's new</a></li>
  <li><a href="troubleshooting.html#problem-log">Problem log</a></li>
  <li><a href="#services">Work with DiceCodes</a></li>
</ul>
<p>See <a href="shortcuts.html#support">Getting around</a> for the thank-you card and the GitHub star note.</p>
</section>
`,
},
];
