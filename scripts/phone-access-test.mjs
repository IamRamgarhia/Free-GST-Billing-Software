// v1.10.85 - unit tests for phone / tablet access (src/utils/phoneAccess.js,
// src/utils/selfSignedCert.js): addresses, Host and Origin checks, tokens and
// the cookie, pairing-code expiry, PIN tries, the request gate, and the
// certificate (with a real TLS handshake on test port 47470).
//
// Run: `node scripts/phone-access-test.mjs`
import crypto from 'crypto';
import https from 'https';
import {
  isPrivateIp, isLoopbackIp, normalizeIp, hostAllowed, sameOrigin, lanAddresses, newToken, hashToken,
  readCookie, deviceCookie, deviceLabel, cleanDeviceName, createTryLimiter, createPairing, createPhoneGate,
  isPcOnly, shortFingerprint, DEVICE_COOKIE, PAIR_CODE_TTL_MS,
} from '../src/utils/phoneAccess.js';
import { makeSelfSignedCert, certStillGood, CERT_DAYS } from '../src/utils/selfSignedCert.js';

let passed = 0, failed = 0;
const ok = (cond, label, extra = '') => { if (cond) { passed++; } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };

// ---- addresses ----
for (const ip of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254', '192.168.1.20', '::ffff:192.168.0.5', 'fd12:3456::1', 'fc00::1', 'fe80::1', 'FE80::abcd'])
  ok(isPrivateIp(ip), `private: ${ip}`);
for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '100.64.0.1', '169.254.1.1', '11.0.0.1', '127.0.0.1', '::1', '2001:db8::1', '', 'abc', '999.1.1.1', '::ffff:8.8.8.8'])
  ok(!isPrivateIp(ip), `not private: ${ip}`);
ok(isLoopbackIp('127.0.0.1') && isLoopbackIp('127.5.0.1') && isLoopbackIp('::1') && isLoopbackIp('::ffff:127.0.0.1'), 'loopback addresses');
ok(!isLoopbackIp('192.168.1.2') && !isLoopbackIp('') && !isLoopbackIp(undefined), 'not loopback');
ok(normalizeIp('::FFFF:10.1.2.3') === '10.1.2.3', 'IPv4-mapped IPv6 is read as IPv4');
ok(JSON.stringify(lanAddresses({
  eth: [{ address: '172.20.0.5', family: 'IPv4', internal: false }, { address: 'fe80::1', family: 'IPv6', internal: false }],
  wifi: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
  lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  vpn: [{ address: '100.70.1.2', family: 'IPv4', internal: false }],
})) === '["192.168.1.20","172.20.0.5"]', 'LAN addresses: private IPv4 only, Wi-Fi-like first');

// ---- Host (DNS rebinding) ----
const names = ['my-pc', 'my-pc.local'];
for (const h of ['192.168.1.20:47443', '192.168.1.20', '10.0.0.7:8443', 'MY-PC:47443', 'my-pc.local', 'my-pc.local.', '[fd00::5]:47443', '127.0.0.1:47443'])
  ok(hostAllowed(h, names), `host allowed: ${h}`);
for (const h of ['evil.example', 'evil.example:47443', 'my-pc.evil.example', '8.8.8.8:47443', '', 'localhost.evil', '[2001:db8::1]:1', 'my-pc@evil', '192.168.1.20.nip.io'])
  ok(!hostAllowed(h, names), `host refused: ${h}`);

// ---- Origin ----
ok(sameOrigin('https://192.168.1.20:47443', '192.168.1.20:47443'), 'same origin');
ok(!sameOrigin('http://192.168.1.20:47443', '192.168.1.20:47443'), 'http origin refused');
ok(!sameOrigin('https://evil.example', '192.168.1.20:47443'), 'other origin refused');
ok(!sameOrigin('', '192.168.1.20:47443') && !sameOrigin(undefined, 'x') && !sameOrigin('null', '192.168.1.20:47443'), 'missing / null origin refused');

// ---- tokens and the cookie ----
const t1 = newToken(), t2 = newToken();
ok(t1 !== t2 && t1.length >= 43 && /^[A-Za-z0-9_-]+$/.test(t1), 'tokens are long, random, cookie-safe');
ok(hashToken(t1) === hashToken(t1) && hashToken(t1) !== t1 && /^[0-9a-f]{64}$/.test(hashToken(t1)), 'token hash is SHA-256 hex, not the token');
const cookie = deviceCookie(t1);
ok(/HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie) && /Path=\//.test(cookie) && /Max-Age=\d{8}/.test(cookie), 'cookie: HttpOnly, Secure, SameSite=Strict, long life', cookie);
ok(readCookie(`a=1; ${DEVICE_COOKIE}=${t1}; b=2`, DEVICE_COOKIE) === t1 && readCookie('', DEVICE_COOKIE) === '' && readCookie(`x${DEVICE_COOKIE}=1`, DEVICE_COOKIE) === '', 'cookie read by exact name');
ok(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1') === 'iPhone - Safari', 'label iPhone Safari');
ok(deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit Chrome/120.0 Mobile Safari/537.36') === 'Android phone - Chrome', 'label Android Chrome');
ok(cleanDeviceName('<b>Shop\nphone</b>', '') === 'bShopphone/b' && cleanDeviceName('', 'Firefox') === 'Device - Firefox' && cleanDeviceName('x'.repeat(99)).length === 60, 'device name cleaned');

// ---- PIN tries ----
{
  let t = 1000;
  const lim = createTryLimiter({ now: () => t });
  ok(lim.wait() === 0, 'no wait at first');
  ok([lim.fail(), lim.fail(), lim.fail(), lim.fail()].join() === '4,3,2,1', 'tries left counts down');
  ok(lim.fail() === 0 && lim.wait() === 30, '5th wrong PIN: wait 30 seconds');
  t += 29000; ok(lim.wait() === 1, 'still waiting after 29 s');
  t += 1000; ok(lim.wait() === 0 && lim.fail() === 4, 'after 30 s: tries again, counter started over');
  lim.reset(); ok(lim.fail() === 4, 'right PIN resets the counter');
}
{
  // v1.10.85 (review): each lockout in a row waits twice as long, at most 15 min.
  let t = 0;
  const lim = createTryLimiter({ now: () => t });
  const lockout = () => { for (let i = 0; i < 5; i++) lim.fail(); const w = lim.wait(); t += w * 1000; return w; };
  ok([lockout(), lockout(), lockout(), lockout()].join() === '30,60,120,240', 'lockouts in a row: 30 s, 1 min, 2 min, 4 min');
  for (let i = 0; i < 6; i++) lockout();
  ok(lockout() === 900, 'never more than 15 minutes');
  lim.reset();
  ok(lockout() === 30, 'a right PIN starts again from 30 s');
}

// ---- pairing codes ----
{
  let t = 0;
  const pair = createPairing({ now: () => t });
  ok(pair.check('ANYTHING') === 'invalid' && !pair.active(), 'no code before one is shown');
  const a = pair.issue();
  ok(/^[A-HJ-NP-Z2-9]{8}$/.test(a.code) && a.expiresAt === PAIR_CODE_TTL_MS, 'code: 8 letters/digits, 10 minutes', JSON.stringify(a));
  ok(pair.check(a.code) === 'ok' && pair.check(a.code.toLowerCase()) === 'ok' && pair.check(`${a.code.slice(0, 4)}-${a.code.slice(4)}`) === 'ok', 'code ok (any case, with a dash)');
  ok(pair.check('WRONGCDE') === 'invalid', 'wrong code invalid');
  t = PAIR_CODE_TTL_MS + 1;
  ok(pair.check(a.code) === 'expired' && pair.check(a.code) === 'invalid', 'after 10 minutes: expired, then gone (an old QR photo is useless)');
  t = 0;
  const b = pair.issue(); const c = pair.issue();
  ok(pair.check(b.code) === 'invalid' && pair.check(c.code) === 'ok', 'a new QR makes the previous code useless');
  pair.consume(); ok(pair.check(c.code) === 'invalid', 'a code works once');
  const d = pair.issue();
  for (let i = 0; i < 4; i++) pair.wrongPin();
  ok(pair.check(d.code) === 'ok', 'code survives 4 wrong PINs');
  pair.wrongPin(); ok(pair.check(d.code) === 'invalid', 'code thrown away after 5 wrong PINs');
}

// ---- PC-only routes ----
const r = (method, path) => ({ method, path });
ok(isPcOnly(r('POST', '/api/control-panel/restart')) && isPcOnly(r('GET', '/api/control-panel/status')), 'control panel is PC-only');
ok(isPcOnly(r('POST', '/api/backup-folder')) && !isPcOnly(r('GET', '/api/backup-folder')), 'choosing a backup folder is PC-only');
ok(isPcOnly(r('POST', '/api/phone-access')) && isPcOnly(r('POST', '/api/phone-access', ), { headless: true }), 'the switch is PC-only (even headless)');
ok(isPcOnly(r('GET', '/api/phone-access')) && !isPcOnly(r('GET', '/api/phone-access'), { headless: true }), 'status / devices: PC-only, except on a server with no screen');
ok(isPcOnly(r('DELETE', '/api/phone-access/devices/x')) && !isPcOnly(r('DELETE', '/api/phone-access/devices/x'), { headless: true }), 'remove device: PC, or a paired device when headless');
ok(!isPcOnly(r('GET', '/api/bills')) && !isPcOnly(r('POST', '/api/bills')), 'invoices are not PC-only');
// v1.10.85 (review): whole-books actions stay on the PC (a paired device when headless).
ok(['/api/export', '/api/import', '/API/Import/'].every((p) => isPcOnly(r(p === '/api/export' ? 'GET' : 'POST', p))) && !isPcOnly(r('GET', '/api/export'), { headless: true }), 'backup out / in: PC-only');
ok(isPcOnly(r('POST', '/api/backups/2026-11-07/restore')) && isPcOnly(r('DELETE', '/api/backups/2026-11-07')) && !isPcOnly(r('GET', '/api/backups')), 'restoring or deleting a daily backup: PC-only; the list is not');
ok(isPcOnly(r('POST', '/api/period-lock')) && !isPcOnly(r('GET', '/api/period-lock')), 'closing or opening the books: PC-only');
ok(isPcOnly(r('POST', '/api/profiles/biz_1/hide-pin')) && !isPcOnly(r('POST', '/api/profiles/unlock')) && !isPcOnly(r('POST', '/api/profiles')), 'hiding a company: PC-only; opening one with its PIN is not');
ok(isPcOnly(r('POST', '/api/lock/set')) && !isPcOnly(r('POST', '/api/lock/set'), { headless: true }) && !isPcOnly(r('POST', '/api/lock/verify')), 'changing the PIN is PC-only (a phone may unlock its own screen)');
// Express routes ignore case and a trailing slash: so must this check.
ok(isPcOnly(r('POST', '/API/Control-Panel/restart')) && isPcOnly(r('POST', '/api/backup-folder/')) && isPcOnly(r('POST', '/api//control-panel/restart'))
  && isPcOnly(r('POST', '/api/control%2Dpanel/restart')) && isPcOnly(r('POST', '/api/%E0%A4%A')) && isPcOnly(r('POST', '/API/PHONE-ACCESS/'), { headless: true }), 'case, trailing slash and %-encoding do not get round PC-only');
ok(DEVICE_COOKIE.startsWith('__Host-'), 'cookie name has the __Host- prefix (HTTPS only, this address only)');

// ---- the gate ----
{
  const token = newToken();
  const device = { id: 'd1', name: 'Test phone' };
  let on = true;
  const gate = createPhoneGate({ isOn: () => on, deviceFor: (tk) => (tk && hashToken(tk) === hashToken(token) ? device : null), names: () => names });
  const run = ({ encrypted = true, ip = '192.168.1.30', method = 'GET', path = '/api/bills', host = '192.168.1.20:47443', origin, cookie: ck } = {}) => {
    const req = { method, path, socket: { encrypted, remoteAddress: ip }, headers: { host, ...(origin ? { origin } : {}), ...(ck ? { cookie: ck } : {}) } };
    const res = { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b = '') { this.body = String(b); this.ended = true; } };
    let nexted = false;
    gate(req, res, () => { nexted = true; });
    const json = (() => { try { return JSON.parse(res.body); } catch { return null; } })();
    return { nexted, status: res.statusCode, code: json?.code, location: res.headers.location, req };
  };
  const paired = `${DEVICE_COOKIE}=${token}`;
  const pc = run({ encrypted: false, ip: '127.0.0.1', host: 'localhost:47371' });
  ok(pc.nexted && pc.req.fromPc, 'PC listener (loopback HTTP): passes unchanged');
  ok(run({ encrypted: false, ip: '::1' }).nexted, 'PC listener over ::1 passes');
  ok(run({ encrypted: false, ip: '192.168.1.30' }).status === 403, 'plain HTTP from the network: refused');
  ok(run({}).status === 401 && run({}).code === 'not-paired', 'network, no cookie, API: 401 not-paired');
  ok(run({ cookie: `${DEVICE_COOKIE}=${newToken()}` }).status === 401, 'network, unknown token: 401');
  ok(run({ path: '/' }).status === 302 && run({ path: '/' }).location === '/pair', 'network, no cookie, page: sent to the pairing page');
  ok(run({ path: '/assets/index.js' }).status === 302, 'network, no cookie: no app files either');
  ok(run({ path: '/pair' }).nexted && run({ path: '/api/pair/info' }).nexted, 'pairing page open without a cookie');
  ok(run({ method: 'POST', path: '/api/pair', origin: 'https://192.168.1.20:47443' }).nexted, 'pairing call from the pairing page passes');
  ok(run({ method: 'POST', path: '/api/pair' }).status === 403, 'pairing call without Origin: refused');
  ok(run({ method: 'POST', path: '/api/pair', origin: 'https://evil.example' }).code === 'cross-origin', 'pairing call from another site: refused');
  const good = run({ cookie: paired });
  ok(good.nexted && good.req.device === device, 'paired device: passes, device attached');
  ok(run({ cookie: paired, method: 'POST', path: '/api/bills' }).code === 'cross-origin', 'paired, change without Origin: refused');
  ok(run({ cookie: paired, method: 'POST', path: '/api/bills', origin: 'https://192.168.1.20:47443' }).nexted, 'paired, change from the app page: passes');
  ok(run({ cookie: paired, method: 'DELETE', path: '/api/bills/x', origin: 'https://evil.example' }).status === 403, 'paired, change from another site: refused');
  ok(run({ cookie: paired, ip: '8.8.8.8' }).code === 'not-local-network', 'internet address: refused even with a cookie');
  ok(run({ cookie: paired, ip: '100.64.1.1' }).status === 403, 'carrier-NAT / VPN range refused');
  ok(run({ cookie: paired, host: 'evil.example:47443' }).code === 'bad-host', 'DNS rebinding Host: refused');
  ok(run({ cookie: paired, path: '/api/control-panel/status' }).code === 'pc-only', 'paired phone cannot use the Control Panel');
  ok(run({ cookie: paired, path: '/api/phone-access' }).code === 'pc-only', 'paired phone cannot manage phone access');
  ok(run({ cookie: paired, host: 'my-pc.local:47443' }).nexted, 'PC host name works');
  on = false;
  ok(run({ cookie: paired }).code === 'phone-access-off', 'switch off: refused at once, cookie or not');
  const headless = createPhoneGate({ isOn: () => true, deviceFor: () => device, names: () => [], headless: true });
  let hn = false;
  headless({ method: 'GET', path: '/api/phone-access', socket: { encrypted: true, remoteAddress: '172.17.0.1' }, headers: { host: '192.168.1.50:47443', cookie: paired } }, { setHeader() {}, end() {} }, () => { hn = true; });
  ok(hn, 'headless (NAS): a paired device sees the device list');
}

// ---- the certificate ----
{
  const made = makeSelfSignedCert({ names: ['My-PC', 'my-pc.local', 'bad name!'], ips: ['192.168.1.20', '10.0.0.7'] });
  const x = new crypto.X509Certificate(made.cert);
  ok(x.verify(x.publicKey), 'certificate is self-signed and its signature checks');
  ok(x.checkPrivateKey(crypto.createPrivateKey(made.key)), 'certificate matches the private key');
  ok(/DNS:my-pc/.test(x.subjectAltName) && /DNS:my-pc\.local/.test(x.subjectAltName) && /IP Address:192\.168\.1\.20/.test(x.subjectAltName) && /IP Address:10\.0\.0\.7/.test(x.subjectAltName) && !/bad/.test(x.subjectAltName), 'names and addresses in subjectAltName', x.subjectAltName);
  const daysValid = (new Date(x.validTo) - new Date(x.validFrom)) / 86400000;
  ok(daysValid <= 825 && daysValid >= CERT_DAYS, 'valid at most 825 days (Apple limit)', String(daysValid));
  ok((x.keyUsage || []).includes('1.3.6.1.5.5.7.3.1'), 'extended key usage: serverAuth', JSON.stringify(x.keyUsage));
  ok(!x.ca, 'not a CA certificate');
  ok(made.fingerprint256 === x.fingerprint256 && /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(made.fingerprint256), 'SHA-256 fingerprint');
  ok(shortFingerprint(made.fingerprint256) === made.fingerprint256.split(':').slice(0, 8).join(' '), 'short fingerprint: first 8 bytes');
  ok(/BEGIN PRIVATE KEY/.test(made.key) && certStillGood(made.cert, made.key), 'PEM key, still good');
  ok(!certStillGood(made.cert, makeSelfSignedCert().key), 'a certificate with the wrong key is not good');
  ok(!certStillGood(made.cert, made.key, Date.now() + 790 * 86400000), 'a certificate with less than 30 days left is renewed');
  ok(!certStillGood('junk', 'junk'), 'damaged files are renewed');
  const two = makeSelfSignedCert();
  ok(two.fingerprint256 !== made.fingerprint256, 'each install has its own certificate');
  // Strict DER (review): a serial with a needless leading zero byte, or a
  // keyUsage bit string with the wrong unused-bits count, is refused by
  // Firefox's parser with no way past it. 40 certificates: each serial starts 0x40-0x7f.
  const serials = Array.from({ length: 40 }, () => new crypto.X509Certificate(makeSelfSignedCert().cert).serialNumber);
  ok(serials.every((s) => /^[4-7][0-9A-F]{31}$/i.test(s)), 'serial: 16 bytes, positive, no leading zero byte', serials.find((s) => !/^[4-7][0-9A-F]{31}$/i.test(s)));
  const der = Buffer.from(made.cert.replace(/-----[^-]+-----|\s/g, ''), 'base64');
  ok(der.includes(Buffer.from([0x03, 0x02, 0x07, 0x80])), 'keyUsage encoded as DER wants (03 02 07 80)');

  // A real TLS handshake with it: the browser sees exactly this fingerprint.
  const srv = https.createServer({ key: made.key, cert: made.cert, minVersion: 'TLSv1.2' }, (q, s) => s.end('hi'));
  await new Promise((res) => srv.listen(47470, '127.0.0.1', res));
  const got = await new Promise((resolve) => {
    const rq = https.get({ host: '127.0.0.1', port: 47470, path: '/', ca: made.cert, servername: 'my-pc', checkServerIdentity: () => undefined }, (s) => {
      const fp = s.socket.getPeerCertificate().fingerprint256, authorized = s.socket.authorized;
      let b = ''; s.on('data', (d) => { b += d; });
      s.on('end', () => resolve({ body: b, fp, authorized }));
    });
    rq.on('error', (e) => resolve({ error: e.message }));
  });
  srv.close();
  ok(got.body === 'hi' && got.fp === made.fingerprint256, 'TLS handshake works and shows the same fingerprint', JSON.stringify(got));
  ok(got.authorized === true, 'trusted once accepted (the certificate is its own authority)', JSON.stringify(got));
}

// ---- v1.10.86 - the guide page's port never takes one the app may use ----
{
  const { guidePortFor, APP_PORT_RANGE } = await import('../src/utils/phoneAccess.js');
  ok(guidePortFor(47443, 47371) === 47444 && guidePortFor(47452, 47402) === 47453 && guidePortFor(65535, 47371) === 65534, 'guide port: the phone port + 1 (or - 1 at the top)');
  ok(guidePortFor(47370, 47371) === 0 && guidePortFor(47400, 47371) === 0 && guidePortFor(47419, 47371) === 0, "guide port: none inside the app's start-up range 47371-47420");
  ok(guidePortFor(47420, 47371) === 47421 && APP_PORT_RANGE[0] === 47371 && APP_PORT_RANGE[1] === 47420, 'guide port: just above the range is fine');
  ok(guidePortFor(50000, 50001) === 0 && guidePortFor(50000, 47371, [APP_PORT_RANGE, [50001, 50050]]) === 0, "guide port: never the app's own port or its saved range");
}

// ---- v1.10.86 - the pages a phone sees before it is paired ----
{
  const { pairPageHtml, guidePageHtml, guidePageCsp, pairPageCsp, UNLOCKED_SESSION_KEY } = await import('../src/utils/pairPage.js');
  const { UNLOCKED_KEY } = await import('../src/utils/appLock.js');
  ok(UNLOCKED_SESSION_KEY === UNLOCKED_KEY, 'the pairing page unlocks the app lock with its own key (PIN typed once)');
  const pair = pairPageHtml({ fingerprint: 'AB CD', nonce: 'n1' });
  ok(pair.includes(`sessionStorage.setItem('${UNLOCKED_KEY}', '1')`) && /x\.s === 200\) \{ try \{ sessionStorage/.test(pair), 'only a successful pairing marks this tab unlocked');
  ok(/location\.hash/.test(pair) && /history\.replaceState/.test(pair), 'pairing page reads the code after # and drops it from the address');
  const g = guidePageHtml({ fingerprint: 'AB CD EF', address: '192.168.1.5', pairUrl: 'https://192.168.1.5:47443/pair', nonce: 'n2' });
  ok(g.includes('href="https://192.168.1.5:47443/pair"') && g.includes('AB CD EF') && g.includes('Proceed to 192.168.1.5') && g.includes('nonce="n2"'), 'guide page: Continue to HTTPS, the security code, the address to tap');
  ok(g.includes('Advanced') && g.includes('Show Details') && g.includes('visit this website'), 'guide page: Chrome and Safari steps');
  ok(!/\bsrc=|<link rel="stylesheet|fetch\(|<form|<iframe/.test(g.replace('<link rel="icon" href="data:," />', '')), 'guide page loads nothing and sends nothing');
  ok(/\[#&\]code=\(\[A-Za-z0-9\]\{4,12\}\)/.test(g), 'guide page takes only letters and digits from #code=');
  const evil = guidePageHtml({ fingerprint: '<b>', address: '"><script>x</script>', pairUrl: 'https://"><script>/pair', nonce: '"x' });
  ok(!evil.includes('<script>x') && !evil.includes('"><script>/pair') && !evil.includes('nonce=""x'), 'guide page escapes what it shows');
  const csp = guidePageCsp('abc');
  ok(/default-src 'none'/.test(csp) && /script-src 'nonce-abc'/.test(csp) && !/connect-src/.test(csp) && /form-action 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp), 'guide page CSP: nothing but its own script, no fetch, no forms, no frames');
  ok(/connect-src 'self'/.test(pairPageCsp('x')), 'pairing page CSP unchanged (it calls /api/pair)');
}

console.log(`phone-access: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
