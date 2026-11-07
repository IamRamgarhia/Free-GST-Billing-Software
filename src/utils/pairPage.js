// v1.10.85 - the page a phone sees before it is paired (GET /pair on the
// network listener, see phoneAccess.js). One self-contained page: the app's
// own files are only served to paired devices. Its script runs under a
// per-response nonce (Content-Security-Policy set by server.js).
//
// Standalone on purpose: shipped in the release ZIP.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const pairPageCsp = (nonce) =>
  `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

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
  button { width: 100%; margin-top: 16px; padding: 12px; font-size: 1rem; font-weight: 600; border: 0; border-radius: 8px; background: #1e40af; color: #fff; }
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
  var q = new URLSearchParams(location.search);
  var code = q.get('code') || '';
  var $ = function (id) { return document.getElementById(id); };
  if (!code) { $('codeBox').hidden = false; $('pinNo').textContent = '3'; }
  else history.replaceState(null, '', '/pair');
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
        if (x.s === 200) { location.replace('/'); return; }
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
