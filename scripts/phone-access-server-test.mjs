// v1.10.85 - phone / tablet access with real servers: a copy of server.js in
// a throw-away folder, its books in another (FGSB_HOME), on test ports
// 47466-47469, called over HTTPS at this PC's own LAN address like a phone.
//   1. off by default: nothing on the network port; switching on needs a PIN;
//   2. on: HTTPS with the PC's certificate; unpaired = refused (401 / pairing
//      page); wrong Host or Origin refused;
//   3. pairing: no code / wrong PIN refused (and counted), right PIN = cookie;
//      the code works once; the token works; the PC-only parts stay PC-only;
//   4. Remove revokes at once; switch off = connection refused;
//   5. the key and devices never go into a backup; only the token's hash is kept;
//   6. a server with no screen (Docker: FGSB_PHONE_ACCESS=1 + FGSB_PIN) prints
//      a pairing code in its log, and FGSB_ALLOW_UNSAFE_LAN opens nothing.
//
// Run: `node scripts/phone-access-server-test.mjs`
import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { lanAddresses } from '../src/utils/phoneAccess.js';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PORT = 47466, PHONE = 47467, NAS_PORT = 47468, NAS_PHONE = 47469;
// v1.10.86 - the guide page is on the phone port + 1.
const GUIDE = PHONE + 1, NAS_GUIDE = NAS_PHONE + 1;
const PIN = '13572468';
let passed = 0, failed = 0;
const ok = (cond, label, extra = '') => { if (cond) { passed++; console.log(`  ok ${label}`); } else { failed++; console.log(`  FAIL ${label} ${extra}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LAN = lanAddresses()[0];
if (!LAN) {
  // A machine with no network card (some CI runners): the unit tests still ran.
  console.log('phone-access-server: SKIPPED - this machine has no local network address to test with');
  process.exit(0);
}

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-phone-test-'));
const APP = path.join(T, 'app');
for (const f of ['server.js', 'package.json', 'src/utils.js', ...fs.readdirSync(path.join(ROOT, 'src', 'utils')).filter((n) => n.endsWith('.js')).map((n) => `src/utils/${n}`)]) {
  fs.mkdirSync(path.dirname(path.join(APP, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
}
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), 'junction');

const children = [];
function start(books, port, env = {}) {
  fs.mkdirSync(path.join(books, 'data'), { recursive: true });
  fs.writeFileSync(path.join(books, 'data', 'port.txt'), String(port));
  const child = spawn(process.execPath, [path.join(APP, 'server.js')], {
    cwd: APP, env: { ...process.env, FGSB_HOME: books, FGSB_PHONE_ACCESS: '', FGSB_PIN: '', FGSB_ALLOW_UNSAFE_LAN: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.out = '';
  child.stdout.on('data', (d) => { child.out += d; });
  child.stderr.on('data', (d) => { child.out += d; });
  child.exited = new Promise((r) => child.on('exit', r));
  children.push(child);
  return child;
}
async function until(fn, ms) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (await fn()) return true;
  return false;
}
// The PC itself (loopback, plain HTTP).
const pc = async (port, method, url, body) => {
  const r = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};
// A phone: HTTPS to the LAN address. The certificate is the PC's own, so it is
// not checked against a CA here; its fingerprint is compared instead.
const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
function phoneReq(port, method, url, { cookie, origin, host, body, keepAlive = false } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}), ...(host ? { Host: host } : {}) };
    const req = https.request({ host: LAN, port, method, path: url, headers, rejectUnauthorized: false, agent: keepAlive ? agent : false, timeout: 5000 }, (res) => {
      const fp = res.socket.getPeerCertificate?.()?.fingerprint256;
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(text); } catch { /* html */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json, fp });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    if (data) req.write(data);
    req.end();
  });
}

// v1.10.86 - the guide page: plain HTTP to the LAN address, like a phone.
function guideReq(port, method, url, { host } = {}) {
  return new Promise((resolve) => {
    const req = http.request({ host: LAN, port, method, path: url, headers: host ? { Host: host } : {}, agent: false, timeout: 5000 }, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    req.end();
  });
}

try {
  // ---- 1. off by default ----
  const BOOKS = path.join(T, 'books');
  const a = start(BOOKS, PORT, { FGSB_PHONE_PORT: String(PHONE) });
  ok(await until(async () => (await pc(PORT, 'GET', '/api/version').catch(() => ({}))).status === 200, 45000), 'server starts on the test books', 'exit=' + a.exitCode + ' ' + a.out);
  let st = (await pc(PORT, 'GET', '/api/phone-access')).json;
  ok(st && st.enabled === false && st.listening === false && st.pinSet === false && st.devices.length === 0, 'off by default, no PIN, no devices', JSON.stringify(st));
  ok((await phoneReq(PHONE, 'GET', '/api/bills')).error === 'ECONNREFUSED', 'off: nothing answers on the network port');
  ok((await phoneReq(PORT, 'GET', '/api/bills')).error === 'ECONNREFUSED', 'the PC port is not reachable from the network either');
  ok((await guideReq(GUIDE, 'GET', '/')).error === 'ECONNREFUSED', 'off: no guide page either');
  const noPin = await pc(PORT, 'POST', '/api/phone-access', { enabled: true });
  ok(noPin.status === 409 && noPin.json?.code === 'pin-needed', 'cannot switch on without a PIN', JSON.stringify(noPin));

  // ---- 2. on ----
  ok((await pc(PORT, 'POST', '/api/lock/set', { pin: PIN })).status === 200, 'PIN set');
  await pc(PORT, 'POST', '/api/phone-access', { enabled: true });
  ok(await until(async () => (await pc(PORT, 'GET', '/api/phone-access')).json?.listening, 10000), 'switched on: listening', a.out);
  st = (await pc(PORT, 'GET', '/api/phone-access')).json;
  ok(st.urls.includes(`https://${LAN}:${PHONE}`) && /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(st.fingerprint), 'status lists this PC\'s address and the certificate fingerprint', JSON.stringify(st));
  const home = `https://${LAN}:${PHONE}`;
  const unpaired = await phoneReq(PHONE, 'GET', '/api/bills');
  ok(unpaired.status === 401 && unpaired.json?.code === 'not-paired', 'unpaired phone: API refused (401)', JSON.stringify(unpaired));
  ok(unpaired.fp === st.fingerprint, 'the phone sees the same certificate fingerprint as the PC screen');
  const page = await phoneReq(PHONE, 'GET', '/');
  ok(page.status === 302 && page.headers.location === '/pair', 'unpaired phone opening the app: sent to the pairing page');
  const pairPage = await phoneReq(PHONE, 'GET', '/pair');
  ok(pairPage.status === 200 && pairPage.text.includes(st.shortFingerprint) && /nonce-/.test(pairPage.headers['content-security-policy'] || ''), 'pairing page shows the short fingerprint, under a strict CSP');
  ok((await phoneReq(PHONE, 'GET', '/api/export')).status === 401, 'unpaired: no export (all the books)');
  ok((await phoneReq(PHONE, 'GET', '/pair', { host: 'evil.example' })).json?.code === 'bad-host', 'DNS rebinding Host refused');
  // v1.10.86 - the guide page (plain HTTP): one static page, nothing else.
  ok(await until(async () => (await guideReq(GUIDE, 'GET', '/')).status === 200, 5000), 'on: the guide page answers on the phone port + 1');
  const guide = await guideReq(GUIDE, 'GET', '/');
  const gcsp = guide.headers?.['content-security-policy'] || '';
  ok(guide.text?.includes(`href="https://${LAN}:${PHONE}/pair"`) && guide.text.includes(st.shortFingerprint) && /Advanced/.test(guide.text), 'guide page: the security code and Continue to the HTTPS pairing page', guide.text?.slice(0, 200));
  ok(/default-src 'none'/.test(gcsp) && /nonce-/.test(gcsp) && !/connect-src/.test(gcsp) && !guide.headers['set-cookie'] && guide.headers['cache-control'] === 'no-store' && guide.headers['x-frame-options'] === 'DENY', 'guide page: strict CSP (no fetch), no cookie, not cached, not in a frame', JSON.stringify(guide.headers));
  ok((await guideReq(GUIDE, 'GET', '/', { host: 'evil.example' })).status === 403, 'guide page: DNS rebinding Host refused');
  const guideApi = await guideReq(GUIDE, 'GET', '/api/bills');
  ok(guideApi.status === 404 && !guideApi.text.includes('['), 'guide port: no API (404)', JSON.stringify(guideApi));
  ok((await guideReq(GUIDE, 'GET', '/pair')).status === 404 && (await guideReq(GUIDE, 'GET', '/index.html')).status === 404, 'guide port: no pairing page, no app files');
  ok((await guideReq(GUIDE, 'POST', '/')).status === 405, 'guide port: nothing but GET');

  // ---- 3. pairing ----
  const noCode = await phoneReq(PHONE, 'POST', '/api/pair', { origin: home, body: { code: 'AAAAAAAA', pin: PIN } });
  ok(noCode.status === 403 && noCode.json?.code === 'pairing-code', 'right PIN but no valid code: refused', JSON.stringify(noCode));
  const codeRes = (await pc(PORT, 'POST', '/api/phone-access/pairing-code')).json;
  ok(/^[A-Z2-9]{8}$/.test(codeRes?.code) && codeRes.urls.includes(`${home}/pair#code=${codeRes.code}`) && codeRes.guideUrls.includes(`http://${LAN}:${GUIDE}/#code=${codeRes.code}`) && codeRes.expiresAt - Date.now() > 9 * 60000, 'PC shows a one-time code (10 minutes) in the QR link, after # (guide page first, HTTPS as the fallback)', JSON.stringify(codeRes));
  const crossSite = await phoneReq(PHONE, 'POST', '/api/pair', { origin: 'https://evil.example', body: { code: codeRes.code, pin: PIN } });
  ok(crossSite.status === 403 && crossSite.json?.code === 'cross-origin', 'pairing from another site refused');
  ok((await phoneReq(PHONE, 'POST', '/api/pair', { body: { code: codeRes.code, pin: PIN } })).status === 403, 'pairing without Origin refused');
  const wrong = await phoneReq(PHONE, 'POST', '/api/pair', { origin: home, body: { code: codeRes.code, pin: '11112222', name: 'Test phone' } });
  ok(wrong.status === 401 && wrong.json?.code === 'wrong-pin' && wrong.json.triesLeft === 4 && !wrong.headers['set-cookie'], 'wrong PIN refused, counted (4 tries left), no cookie', JSON.stringify(wrong));
  const right = await phoneReq(PHONE, 'POST', '/api/pair', { origin: home, body: { code: codeRes.code, pin: PIN, name: 'Test phone' } });
  const setCookie = String(right.headers?.['set-cookie'] || '');
  ok(right.status === 200 && /fgsb_device=[A-Za-z0-9_-]{43}/.test(setCookie) && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Strict/.test(setCookie), 'right PIN: device token as an HttpOnly, Secure, SameSite=Strict cookie', setCookie);
  const cookie = setCookie.split(';')[0];
  const token = cookie.split('=')[1];
  ok((await phoneReq(PHONE, 'POST', '/api/pair', { origin: home, body: { code: codeRes.code, pin: PIN } })).json?.code === 'pairing-code', 'the code works once (a photo of the QR is useless now)');
  const bills = await phoneReq(PHONE, 'GET', '/api/bills', { cookie });
  ok(bills.status === 200 && Array.isArray(bills.json), 'paired phone: the app\'s data answers', JSON.stringify(bills).slice(0, 200));
  const add = await phoneReq(PHONE, 'POST', '/api/clients', { cookie, origin: home, body: { id: 'phonetest-client', name: 'Phone Test Client' } });
  ok(add.status === 200, 'paired phone can save (from the app page)', JSON.stringify(add));
  // Review (7 Nov): the backup folder only through the PC-only route, the PIN
  // changed only on the PC, and a phone's wrong PINs never make the PC wait.
  ok((await phoneReq(PHONE, 'POST', '/api/meta/backupFolder', { cookie, origin: home, body: { value: '\\\\192.168.1.66\\x' } })).status === 403
    && (await pc(PORT, 'POST', '/api/meta/BackupFolder', { value: 'C:\\x' })).status === 403, 'nobody sets the backup folder through /api/meta (a phone could send every book to its own share)');
  ok((await phoneReq(PHONE, 'POST', '/api/backup-folder', { cookie, origin: home, body: { path: 'C:\\x' } })).json?.code === 'pc-only', 'a phone cannot choose the backup folder');
  ok((await phoneReq(PHONE, 'POST', '/api/lock/set', { cookie, origin: home, body: { pin: null, currentPin: PIN } })).json?.code === 'pc-only', 'a phone cannot change or remove the PIN');
  ok(!('books' in ((await phoneReq(PHONE, 'GET', '/api/version', { cookie })).json || { books: 1 })), 'the books folder path is not told to a phone');
  ok((await phoneReq(PHONE, 'POST', '/api/clients', { cookie, body: { id: 'phonetest-x', name: 'x' } })).json?.code === 'cross-origin', 'paired, but a change without Origin: refused');
  ok((await phoneReq(PHONE, 'GET', '/api/control-panel/status', { cookie })).json?.code === 'pc-only', 'Control Panel stays PC-only');
  ok((await phoneReq(PHONE, 'POST', '/api/phone-access', { cookie, origin: home, body: { enabled: false } })).json?.code === 'pc-only', 'a phone cannot switch phone access');
  ok((await phoneReq(PHONE, 'POST', '/api/phone-access/pairing-code', { cookie, origin: home })).json?.code === 'pc-only', 'a phone cannot make pairing codes');
  ok((await phoneReq(PHONE, 'GET', '/api/pair/info', { cookie })).json?.paired === true, 'pairing page knows the phone is paired (goes to the app)');

  // ---- 5. on disk ----
  const dataDir = path.join(BOOKS, 'data');
  const settings = JSON.parse(fs.readFileSync(path.join(dataDir, 'phone-access', 'settings.json'), 'utf8'));
  const everything = fs.readdirSync(dataDir, { recursive: true }).filter((f) => fs.statSync(path.join(dataDir, String(f))).isFile())
    .map((f) => fs.readFileSync(path.join(dataDir, String(f)), 'utf8')).join('\n');
  ok(settings.devices.length === 1 && settings.devices[0].name === 'Test phone' && /^[0-9a-f]{64}$/.test(settings.devices[0].hash) && !everything.includes(token), 'only the token\'s hash is stored, nowhere the token');
  ok(fs.existsSync(path.join(dataDir, 'phone-access', 'key.pem')), 'the private key is in data/phone-access');
  ok(await until(() => fs.existsSync(path.join(dataDir, 'backups')) && fs.readdirSync(path.join(dataDir, 'backups')).length > 0, 15000), 'daily backup made');
  const backupDir = path.join(dataDir, 'backups', fs.readdirSync(path.join(dataDir, 'backups')).find((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)) || 'none');
  ok(fs.existsSync(path.join(backupDir, 'clients')) && !fs.existsSync(path.join(backupDir, 'phone-access')), 'the backup has the books but not the key or the devices');
  const exported = (await pc(PORT, 'GET', '/api/export')).json;
  ok(!JSON.stringify(exported).includes('BEGIN PRIVATE KEY') && !JSON.stringify(exported).includes(settings.devices[0].hash), 'Export has neither the key nor the devices');

  // ---- 4. Remove, then off ----
  st = (await pc(PORT, 'GET', '/api/phone-access')).json;
  ok(st.devices.length === 1 && st.devices[0].name === 'Test phone' && !('hash' in st.devices[0]), 'PC lists the paired device (without its hash)');
  const keep = await phoneReq(PHONE, 'GET', '/api/bills', { cookie, keepAlive: true });
  ok(keep.status === 200, 'phone on a kept-open connection');
  ok((await pc(PORT, 'DELETE', `/api/phone-access/devices/${st.devices[0].id}`)).status === 200, 'Remove on the PC');
  const revoked = await phoneReq(PHONE, 'GET', '/api/bills', { cookie, keepAlive: true });
  ok(revoked.status === 401, 'removed: the same phone is refused at once, even on its open connection', JSON.stringify(revoked));

  const code2 = (await pc(PORT, 'POST', '/api/phone-access/pairing-code')).json.code;
  const again = await phoneReq(PHONE, 'POST', '/api/pair', { origin: home, body: { code: code2, pin: PIN } });
  const cookie2 = String(again.headers?.['set-cookie'] || '').split(';')[0];
  ok(again.status === 200 && (await phoneReq(PHONE, 'GET', '/api/bills', { cookie: cookie2, keepAlive: true })).status === 200, 'paired again');
  await pc(PORT, 'POST', '/api/phone-access', { enabled: false });
  const afterOff = await phoneReq(PHONE, 'GET', '/api/bills', { cookie: cookie2, keepAlive: true });
  ok(afterOff.error && afterOff.status === undefined, 'switch off: the open connection is cut', JSON.stringify(afterOff));
  ok((await phoneReq(PHONE, 'GET', '/api/bills', { cookie: cookie2 })).error === 'ECONNREFUSED', 'switch off: connection refused');
  ok((await guideReq(GUIDE, 'GET', '/')).error === 'ECONNREFUSED', 'switch off: the guide page is gone too');
  ok((await pc(PORT, 'GET', '/api/bills')).status === 200, 'the PC itself works as before');

  // Removing the PIN turns phone access off too.
  await pc(PORT, 'POST', '/api/phone-access', { enabled: true });
  await until(async () => (await pc(PORT, 'GET', '/api/phone-access')).json?.listening, 10000);
  await pc(PORT, 'POST', '/api/lock/set', { pin: null, currentPin: PIN });
  st = (await pc(PORT, 'GET', '/api/phone-access')).json;
  ok(st.enabled === false && st.listening === false && (await phoneReq(PHONE, 'GET', '/pair')).error === 'ECONNREFUSED', 'removing the PIN turns phone access off', JSON.stringify(st));
  a.kill();
  await a.exited;

  // ---- 6. a server with no screen (the NAS image) ----
  const NAS = path.join(T, 'nas');
  const n = start(NAS, NAS_PORT, { FGSB_PHONE_ACCESS: '1', FGSB_PIN: '24681357', FGSB_PHONE_PORT: String(NAS_PHONE), FGSB_PHONE_HOSTS: 'my-nas', FGSB_ALLOW_UNSAFE_LAN: '1' });
  ok(await until(() => /pair#code=([A-Z2-9]{8})/.test(n.out), 20000), 'NAS: the log shows a pairing link for the first device', n.out);
  ok(/no longer used/.test(n.out), 'NAS: FGSB_ALLOW_UNSAFE_LAN is ignored, with a warning');
  ok((await phoneReq(NAS_PORT, 'GET', '/api/bills')).error === 'ECONNREFUSED', 'NAS: the plain-HTTP port is not on the network, even with FGSB_ALLOW_UNSAFE_LAN');
  const nasHome = `https://${LAN}:${NAS_PHONE}`;
  ok((await phoneReq(NAS_PHONE, 'GET', '/api/bills')).status === 401, 'NAS: unpaired request refused');
  ok((await guideReq(NAS_GUIDE, 'GET', '/')).error === 'ECONNREFUSED', 'NAS: no guide page (Docker publishes the HTTPS port only)');
  const nasCode = /pair#code=([A-Z2-9]{8})/.exec(n.out)[1];
  const nasPair = await phoneReq(NAS_PHONE, 'POST', '/api/pair', { origin: nasHome, body: { code: nasCode, pin: '24681357' } });
  const nasCookie = String(nasPair.headers?.['set-cookie'] || '').split(';')[0];
  ok(nasPair.status === 200 && nasCookie, 'NAS: paired with the code from the log and FGSB_PIN', JSON.stringify(nasPair));
  ok((await phoneReq(NAS_PHONE, 'GET', '/api/phone-access', { cookie: nasCookie })).json?.devices?.[0]?.thisDevice === true, 'NAS: a paired device sees the device list');
  ok((await phoneReq(NAS_PHONE, 'POST', '/api/phone-access', { cookie: nasCookie, origin: nasHome, body: { enabled: false } })).json?.code === 'pc-only', 'NAS: it cannot switch access off');
  ok((await phoneReq(NAS_PHONE, 'POST', '/api/phone-access/pairing-code', { cookie: nasCookie, origin: nasHome })).json?.code?.length === 8, 'NAS: a paired device shows codes for more devices');
  ok((await phoneReq(NAS_PHONE, 'GET', '/', { cookie: nasCookie, host: 'my-nas:8443' })).status !== 403, 'NAS: its name from FGSB_PHONE_HOSTS is accepted as Host');
  for (let i = 0; i < 5; i++) await phoneReq(NAS_PHONE, 'POST', '/api/lock/verify', { cookie: nasCookie, origin: nasHome, body: { pin: '99998888' } });
  const phoneWait = await phoneReq(NAS_PHONE, 'POST', '/api/lock/verify', { cookie: nasCookie, origin: nasHome, body: { pin: '24681357' } });
  const pcStill = await pc(NAS_PORT, 'POST', '/api/lock/verify', { pin: '24681357' });
  ok(phoneWait.status === 429 && pcStill.status === 200, 'five wrong PINs on a phone make the phones wait, not the PC itself', JSON.stringify({ phone: phoneWait.status, pc: pcStill.status }));
  n.kill();
  await n.exited;
} finally {
  for (const c of children) { try { c.kill(); } catch { /* gone */ } }
  agent.destroy();
  await sleep(300);
  fs.rmSync(T, { recursive: true, force: true });
}

console.log(`phone-access-server: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
