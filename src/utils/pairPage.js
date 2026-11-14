// v1.10.85 - the page a phone sees before it is paired (GET /pair on the
// network listener, see phoneAccess.js). One self-contained page: the app's
// own files are only served to paired devices. Its script runs under a
// per-response nonce (Content-Security-Policy set by server.js).
//
// Standalone on purpose: shipped in the release ZIP.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// v1.10.86 - the app lock's "already unlocked in this tab" key (UNLOCKED_KEY
// in src/utils/appLock.js; a unit test keeps the two the same).
export const UNLOCKED_SESSION_KEY = 'gst_unlocked';

export const pairPageCsp = (nonce) =>
  `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

// v1.10.86 - the guide page: what a phone opens first when it scans the QR
// code (plain HTTP on the phone port + 1, server.js startGuideListener). It
// says what the browser's "not private" warning will look like and where to
// tap, then Continue goes to the HTTPS pairing page. It is the only thing on
// that port: no API, no cookies, no app files, no data. The pairing code is
// after # in its address, so it is never sent over plain HTTP: the script
// below moves it into the Continue link. No fetch, no form: connect-src none.
export const guidePageCsp = (nonce) =>
  `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

// One drawing of a phone's warning screen: a red sign, the title, and the
// two things to tap ringed in orange with their step number.
const warningDrawing = ({ title, first, second }) => `<svg viewBox="0 0 200 250" role="img" aria-label="${esc(`${title}: tap ${first}, then ${second}`)}" class="pic">
<rect x="20" y="4" width="160" height="242" rx="18" style="fill:var(--card);stroke:var(--muted)" stroke-width="3"/>
<path d="M100 26 L122 64 H78 Z" fill="#dc2626"/><rect x="98" y="38" width="4" height="14" fill="#fff"/><rect x="98" y="55" width="4" height="4" fill="#fff"/>
<text x="100" y="86" text-anchor="middle" font-size="8.5" font-weight="700" style="fill:var(--text)">${esc(title)}</text>
<rect x="38" y="96" width="124" height="6" rx="3" style="fill:var(--border)"/><rect x="38" y="108" width="100" height="6" rx="3" style="fill:var(--border)"/>
<rect x="38" y="128" width="84" height="24" rx="6" style="fill:none;stroke:var(--muted)" stroke-width="1.5"/>
<text x="80" y="144" text-anchor="middle" font-size="9.5" font-weight="700" style="fill:var(--text)">${esc(first)}</text>
<circle cx="80" cy="140" r="30" fill="none" stroke="#f97316" stroke-width="4"/>
<circle cx="30" cy="124" r="11" fill="#f97316"/><text x="30" y="128" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">1</text>
<rect x="38" y="178" width="124" height="6" rx="3" style="fill:var(--border)"/>
<text x="100" y="204" text-anchor="middle" font-size="10" font-weight="700" style="fill:var(--link)" text-decoration="underline">${esc(second)}</text>
<rect x="34" y="190" width="132" height="22" rx="11" fill="none" stroke="#f97316" stroke-width="4"/>
<circle cx="30" cy="226" r="11" fill="#f97316"/><text x="30" y="230" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">2</text>
</svg>`;

// address: the PC's address as the phone typed it (checked by server.js);
// pairUrl: the HTTPS pairing page, which the script adds #code=... to.
export function guidePageHtml({ fingerprint, address, pairUrl, nonce }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<link rel="icon" href="data:," />
<title>Connect to your PC - Free GST Billing</title>
<style>
  :root { color-scheme: light dark; --bg: #eef2f7; --card: #fff; --text: #0f172a; --muted: #475569; --blue: #1e40af; --link: #1d4ed8; --border: #cbd5e1; --ok: #15803d; --okbg: #ecfdf5; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1220; --card: #111a2e; --text: #e2e8f0; --muted: #94a3b8; --blue: #93c5fd; --link: #93c5fd; --border: #334155; --ok: #4ade80; --okbg: #052e1a; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 18px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; padding: 16px; }
  main { max-width: 480px; margin: 0 auto; }
  section { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin: 0 0 14px; }
  h1 { font-size: 1.45rem; line-height: 1.25; margin: 4px 0 12px; color: var(--blue); }
  h2 { font-size: 1.15rem; margin: 0 0 8px; }
  p { margin: 8px 0; }
  .ok { background: var(--okbg); color: var(--ok); border-radius: 10px; padding: 12px; font-weight: 700; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  ol { margin: 6px 0 4px; padding-left: 1.4em; } li { margin: 6px 0; }
  .row { display: flex; gap: 12px; align-items: center; }
  .pic { width: 120px; flex-shrink: 0; height: auto; }
  .fp { font: 700 1.1rem/1.5 ui-monospace, Consolas, monospace; text-align: center; word-spacing: 0.2em; padding: 10px; border: 2px dashed var(--border); border-radius: 10px; }
  .go { display: block; text-align: center; text-decoration: none; background: #1e40af; color: #fff; font-size: 1.25rem; font-weight: 700; padding: 16px; border-radius: 12px; min-height: 56px; margin: 6px 0 12px; }
  .alt { word-break: break-all; }
  @media (max-width: 360px) { .row { flex-direction: column; align-items: flex-start; } }
</style>
</head><body><main>
<h1>Connect this phone to your PC</h1>
<section>
<p>After you tap <b>Continue</b>, your phone will say <b>"Your connection is not private"</b> (or <b>"This connection is not private"</b>).</p>
<p class="ok">This is your own PC. It is safe to go on.</p>
<p class="muted">The app on your PC uses its own security certificate. Phones do not know it, so they warn once. You see this only the first time.</p>
</section>
<section>
<h2>Android (Chrome)</h2>
<div class="row">${warningDrawing({ title: 'Your connection is not private', first: 'Advanced', second: 'Proceed to ...' })}
<ol><li>Tap <b>Advanced</b></li><li>Tap <b>Proceed to ${esc(address)} (unsafe)</b></li></ol></div>
</section>
<section>
<h2>iPhone or iPad (Safari)</h2>
<div class="row">${warningDrawing({ title: 'This Connection Is Not Private', first: 'Show Details', second: 'visit this website' })}
<ol><li>Tap <b>Show Details</b></li><li>Tap <b>visit this website</b></li><li>Tap <b>Visit Website</b></li></ol></div>
<p class="muted">Other browsers: tap <b>Advanced</b> or <b>Details</b>, then <b>Continue</b> or <b>Proceed</b>.</p>
</section>
<section>
<h2>Security code of your PC</h2>
<p class="fp">${esc(fingerprint)}</p>
<p class="muted">The PC shows the same code under the QR code, and the next page shows it again.</p>
</section>
<a class="go" id="go" href="${esc(pairUrl)}">Continue</a>
<p class="muted alt">Or open: ${esc(pairUrl)}</p>
</main>
<script nonce="${esc(nonce)}">
(function () {
  var m = /[#&]code=([A-Za-z0-9]{4,12})/.exec(location.hash);
  if (!m) return;
  var go = document.getElementById('go');
  go.href = go.getAttribute('href') + '#code=' + m[1].toUpperCase();
  history.replaceState(null, '', location.pathname);
})();
</script>
</body></html>`;
}

export function pairPageHtml({ fingerprint, nonce }) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<link rel="icon" href="data:," />
<title>Pair this device - Free GST Billing</title>
<style>
  :root { color-scheme: light dark; --bg: #eef2f7; --card: #fff; --text: #0f172a; --muted: #475569; --blue: #1e40af; --border: #cbd5e1; --err: #b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1220; --card: #111a2e; --text: #e2e8f0; --muted: #94a3b8; --blue: #93c5fd; --border: #334155; --err: #fca5a5; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; padding: 16px; }
  main { max-width: 440px; margin: 0 auto; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  h1 { font-size: 1.3rem; margin: 0 0 4px; color: var(--blue); }
  p { margin: 8px 0; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  .fp { font: 600 1.05rem/1.4 ui-monospace, Consolas, monospace; letter-spacing: 0.04em; padding: 10px; border: 1px dashed var(--border); border-radius: 8px; text-align: center; word-spacing: 0.2em; }
  label { display: block; font-weight: 600; margin: 14px 0 4px; }
  input { width: 100%; font-size: 1.15rem; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); }
  input { min-height: 48px; }
  button { width: 100%; min-height: 52px; margin-top: 16px; padding: 12px; font-size: 1.1rem; font-weight: 600; border: 0; border-radius: 10px; background: #1e40af; color: #fff; }
  summary { padding: 8px 0; }
  button:disabled { opacity: 0.6; }
  .err { color: var(--err); font-weight: 600; min-height: 1.5em; }
  details { margin-top: 10px; }
</style>
</head><body><main>
<h1>Pair this device</h1>
<p class="muted">Free GST Billing on your PC. This phone or tablet must be on the same Wi-Fi as the PC.</p>

<p><strong>1. Check the security code.</strong> The PC shows a security code next to the QR code. This is the code of the certificate this page came with:</p>
<p class="fp" id="fp">${esc(fingerprint)}</p>
<p class="muted">Different from the PC? Stop: something else answered. The sure check is in your browser, because a fake page could copy this text: tap the warning sign or "Not secure" next to the address, open the certificate, and compare the start of its SHA-256 fingerprint with the PC.</p>
<details><summary class="muted">Why did the browser warn me?</summary>
<p class="muted">The connection to your PC is encrypted with the PC's own certificate. Your browser does not know that certificate, so it warned you first ("Your connection is not private"). The security code is how you know it is your PC's.</p></details>

<form id="f" autocomplete="off">
  <div id="codeBox" hidden>
    <label for="code">2. Pairing code (shown on the PC under the QR code)</label>
    <input id="code" autocapitalize="characters" spellcheck="false" maxlength="9" />
  </div>
  <label for="pin"><span id="pinNo">2</span>. The app's PIN</label>
  <input id="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" />
  <label for="name">Name for this device (shown on the PC)</label>
  <input id="name" maxlength="60" />
  <button id="go" type="submit">Pair this device</button>
  <p class="err" id="err" role="alert"></p>
</form>
<p class="muted">Not your PC's app? Close this page. The PC can remove a paired device at any time: Settings, Privacy &amp; Security, Use on phone or tablet.</p>
</main>
<script nonce="${esc(nonce)}">
(function () {
  // v1.10.86 - the code comes after # (the guide page and the QR put it there:
  // a browser never sends that part to any server); ?code= still works.
  var h = /[#&]code=([A-Za-z0-9]{4,12})/.exec(location.hash);
  var code = (h && h[1]) || new URLSearchParams(location.search).get('code') || '';
  var $ = function (id) { return document.getElementById(id); };
  if (!code) { $('codeBox').hidden = false; $('pinNo').textContent = '3'; }
  if (location.search || location.hash) history.replaceState(null, '', '/pair');
  fetch('/api/pair/info').then(function (r) { return r.json(); }).then(function (j) {
    if (j.paired) location.replace('/');
    if (j.name) $('name').value = j.name;
  }).catch(function () {});
  $('pin').addEventListener('input', function () { this.value = this.value.replace(/\\D/g, '').slice(0, 8); });
  $('f').addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = $('pin').value;
    if (!/^(\\d{6}|\\d{8})$/.test(pin)) { $('err').textContent = 'The PIN has 6 or 8 digits.'; return; }
    $('go').disabled = true; $('err').textContent = '';
    fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code || $('code').value, pin: pin, name: $('name').value }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        // v1.10.86 - the PIN was just checked by the PC: the app opens without
        // asking it again in this tab (AppLock.jsx reads the same key). A new
        // session on the phone asks for it as usual.
        if (x.s === 200) { try { sessionStorage.setItem('${UNLOCKED_SESSION_KEY}', '1'); } catch (err) { /* storage blocked */ } location.replace('/'); return; }
        $('pin').value = '';
        $('err').textContent = x.j.code === 'wrong-pin' ? ('Wrong PIN.' + (x.j.triesLeft ? ' ' + x.j.triesLeft + ' tries left.' : ''))
          : x.j.code === 'wait' ? ('Too many wrong tries. Wait ' + x.j.wait + ' seconds.')
          : (x.j.error || 'Could not pair.');
      })
      .catch(function () { $('err').textContent = 'No answer from the PC. Is the app still running there?'; })
      .then(function () { $('go').disabled = false; });
  });
})();
</script>
</body></html>`;
}
