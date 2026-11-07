// v1.10.85 - use the app from a phone or tablet on the same Wi-Fi.
//
// Off by default. When it is on, the server ALSO listens on the local network
// over HTTPS (its own self-signed certificate, selfSignedCert.js), and every
// request that reaches that listener must come from a private-network address,
// name this PC (Host), come from the app's own page (Origin, for changes) and
// carry the cookie of a paired device. A device pairs once: a one-time code
// from the QR on the PC (10 minutes) plus the app's PIN, checked here.
// The 127.0.0.1 listener (this PC) is unchanged.
//
// Standalone on purpose (Node built-ins only): server.js imports it and the
// release ZIP ships it (build-release-zip.mjs). Unit tests:
// scripts/phone-access-test.mjs; with real servers: phone-access-server-test.mjs.
import crypto from 'crypto';
import os from 'os';

// __Host-: the browser accepts it only over HTTPS, for this exact address, path /.
export const DEVICE_COOKIE = '__Host-fgsb_device';
export const DEFAULT_PHONE_PORT = 47443;
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000;
// Chrome keeps a cookie at most 400 days; a device that is used is seen again
// long before that (the cookie is not renewed: Remove on the PC is the way out).
const COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

// ---- addresses --------------------------------------------------------------
// "::ffff:192.168.1.5" is how an IPv4 client looks on a dual-stack socket.
export const normalizeIp = (ip) => String(ip || '').trim().toLowerCase().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');

const ipv4 = (ip) => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const b = m.slice(1).map(Number);
  return b.every((n) => n <= 255) ? b : null;
};

export function isLoopbackIp(raw) {
  const ip = normalizeIp(raw);
  const b = ipv4(ip);
  return b ? b[0] === 127 : ip === '::1';
}

// The local network only: 10/8, 172.16/12, 192.168/16, and IPv6 unique-local
// (fc00::/7) and link-local (fe80::/10). Anything else (the internet, carrier
// NAT 100.64/10, 169.254 auto addresses) is refused.
export function isPrivateIp(raw) {
  const ip = normalizeIp(raw);
  const b = ipv4(ip);
  if (b) return b[0] === 10 || (b[0] === 172 && b[1] >= 16 && b[1] <= 31) || (b[0] === 192 && b[1] === 168);
  if (!ip.includes(':')) return false;
  return /^f[cd][0-9a-f]{0,2}:/.test(ip) || /^fe[89ab][0-9a-f]?:/.test(ip);
}

// This PC's addresses on the local network, the likely Wi-Fi one first
// (192.168 before 10 before 172: Docker, WSL and Hyper-V use 172).
export function lanAddresses(ifaces = os.networkInterfaces()) {
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  const all = Object.values(ifaces || {}).flat()
    .filter((a) => a && !a.internal && (a.family === 'IPv4' || a.family === 4) && isPrivateIp(a.address))
    .map((a) => a.address);
  return [...new Set(all)].sort((x, y) => rank(x) - rank(y));
}

// DNS-rebinding guard for the network listener. A page on evil.example that
// re-points its name to this PC still sends "Host: evil.example", so only a
// private IP address (an address cannot be re-pointed) or one of this PC's
// own names is answered. The port is not checked: Docker may map another one.
export function hostAllowed(hostHeader, names = []) {
  const h = String(hostHeader || '').trim().toLowerCase();
  if (!h) return false;
  const v6 = /^\[([0-9a-f:.]+)\](?::\d{1,5})?$/.exec(h);
  if (v6) return isPrivateIp(v6[1]) || isLoopbackIp(v6[1]);
  const m = /^([a-z0-9.-]+)(?::\d{1,5})?$/.exec(h);
  if (!m) return false;
  const name = m[1].replace(/\.$/, '');
  if (ipv4(name)) return isPrivateIp(name) || isLoopbackIp(name);
  return names.some((n) => String(n || '').trim().toLowerCase() === name);
}

// A change (POST, PUT, DELETE...) must come from the app's own page: the
// browser names the page's origin, which must be this very address.
export function sameOrigin(origin, hostHeader) {
  if (!origin || !hostHeader) return false;
  return String(origin).toLowerCase() === `https://${String(hostHeader).toLowerCase()}`;
}

// ---- tokens and cookies -------------------------------------------------------
export const newToken = () => crypto.randomBytes(32).toString('base64url');
// The token is 256 random bits, so a plain SHA-256 is enough: only this hash is
// stored, and it cannot be turned back into a working cookie.
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export const deviceCookie = (token) =>
  `${DEVICE_COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; Secure; SameSite=Strict`;

// "iPhone - Safari", "Android - Chrome": shown in the PC's device list.
export function deviceLabel(ua) {
  const s = String(ua || '');
  const what = /iPad/.test(s) ? 'iPad' : /iPhone/.test(s) ? 'iPhone' : /Android/.test(s) ? (/Mobile/.test(s) ? 'Android phone' : 'Android tablet')
    : /Windows/.test(s) ? 'Windows PC' : /Macintosh/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : 'Device';
  const browser = /SamsungBrowser/.test(s) ? 'Samsung Internet' : /EdgA?\//.test(s) ? 'Edge' : /Firefox|FxiOS/.test(s) ? 'Firefox'
    : /Chrome|CriOS/.test(s) ? 'Chrome' : /Safari/.test(s) ? 'Safari' : '';
  return browser ? `${what} - ${browser}` : what;
}

// A name typed on the phone: plain text, one line, 60 characters.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
export const cleanDeviceName = (name, ua) => String(name || '').replace(/[\x00-\x1f\x7f<>]/g, '').trim().slice(0, 60) || deviceLabel(ua);

// ---- wrong tries --------------------------------------------------------------
// Five wrong PINs in a row -> wait 30 seconds before the next try (the PC's
// lock screen and pairing share one counter, so a phone cannot get more tries).
export function createTryLimiter({ max = 5, waitMs = 30000, now = Date.now } = {}) {
  let wrong = 0, until = 0;
  return {
    wait: () => Math.max(0, Math.ceil((until - now()) / 1000)),
    fail() {
      wrong += 1;
      if (wrong >= max) { wrong = 0; until = now() + waitMs; return 0; }
      return max - wrong;
    },
    reset() { wrong = 0; },
  };
}

// ---- one-time pairing codes -------------------------------------------------
// One code at a time: showing a new QR makes the old one useless. A code works
// once, for 10 minutes, and is thrown away after 5 wrong PINs, so a photo of an
// old QR cannot be used and PINs cannot be guessed without the PC.
export function createPairing({ ttlMs = PAIR_CODE_TTL_MS, maxWrong = 5, now = Date.now } = {}) {
  let current = null; // { hash, expiresAt, wrong }
  const digest = (code) => crypto.createHash('sha256').update(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).digest();
  return {
    issue() {
      const bytes = crypto.randomBytes(8);
      const code = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      current = { hash: digest(code), expiresAt: now() + ttlMs, wrong: 0 };
      return { code, expiresAt: current.expiresAt };
    },
    // 'ok' | 'expired' | 'invalid'
    check(code) {
      if (!current) return 'invalid';
      if (!crypto.timingSafeEqual(digest(code), current.hash)) return 'invalid';
      if (now() > current.expiresAt) { current = null; return 'expired'; }
      return 'ok';
    },
    consume() { current = null; },
    wrongPin() {
      if (current && ++current.wrong >= maxWrong) current = null;
    },
    active: () => !!current && now() <= current.expiresAt,
    clear() { current = null; },
  };
}

// ---- what a paired phone may not do ------------------------------------------
// Things that act on the PC itself (open folders, run the update / move /
// remove scripts, restart it, choose a backup folder on its disks) and turning
// phone access itself on or off: only on the PC. On a server with no screen
// (Docker, FGSB_PHONE_ACCESS=1) a paired device manages the paired devices.
export function isPcOnly(req, { headless = false } = {}) {
  // Express matches routes ignoring case and a trailing slash (and the path
  // may be %-encoded), so compare the same way: /API/Control-Panel/x/ is PC-only too.
  let p;
  try { p = decodeURIComponent(String(req.path || '')); } catch { return true; }
  p = p.toLowerCase().replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  if (p.startsWith('/api/control-panel/')) return true;
  if (p === '/api/backup-folder' && req.method !== 'GET') return true;
  if (p === '/api/phone-access' && req.method !== 'GET') return true;
  // Changing or removing the PIN locks the PC's owner out / turns phone access
  // off: on the PC (on a server with no screen, the only way is a paired device).
  if (p === '/api/lock/set') return !headless;
  if (p.startsWith('/api/phone-access')) return !headless;
  return false;
}

// Reachable without a paired device: the pairing page and its two calls.
export const PUBLIC_PATHS = new Set(['/pair', '/api/pair', '/api/pair/info']);
const SAFE_METHODS = new Set(['GET', 'HEAD']);

const refuse = (res, status, code, error) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error, code }));
};

// The first middleware of the app. Requests on the 127.0.0.1 listener (plain
// HTTP) go on unchanged; requests on the network listener (HTTPS) pass only
// with every check above. deviceFor(token) returns the paired device or null.
export function createPhoneGate({ isOn, deviceFor, names = () => [], headless = false }) {
  return function phoneGate(req, res, next) {
    const socket = req.socket || {};
    if (!socket.encrypted) {
      // The PC's own listener is bound to 127.0.0.1; anything else is a mistake.
      if (!isLoopbackIp(socket.remoteAddress)) return refuse(res, 403, 'pc-only', 'This app only answers this computer');
      req.fromPc = true;
      return next();
    }
    if (!isOn()) return refuse(res, 403, 'phone-access-off', 'Phone access is turned off on the PC');
    const ip = socket.remoteAddress;
    if (!isPrivateIp(ip) && !isLoopbackIp(ip)) return refuse(res, 403, 'not-local-network', 'Only devices on the same Wi-Fi can open the app');
    if (!hostAllowed(req.headers.host, names())) return refuse(res, 403, 'bad-host', 'Open the app with the address shown on the PC');
    if (!SAFE_METHODS.has(req.method) && !sameOrigin(req.headers.origin, req.headers.host)) {
      return refuse(res, 403, 'cross-origin', 'Cross-origin request refused');
    }
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (PUBLIC_PATHS.has(req.path)) return next();
    const device = deviceFor(readCookie(req.headers.cookie, DEVICE_COOKIE));
    if (!device) {
      if (String(req.path).startsWith('/api/') || !SAFE_METHODS.has(req.method)) {
        return refuse(res, 401, 'not-paired', 'This device is not paired. Pair it from the PC: Settings -> Privacy & Security.');
      }
      res.statusCode = 302;
      res.setHeader('Location', '/pair');
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    }
    req.device = device;
    if (isPcOnly(req, { headless })) return refuse(res, 403, 'pc-only', 'Do this on the PC itself');
    if (String(req.path).startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    return next();
  };
}

// The short form of the certificate's SHA-256 fingerprint shown on the PC and
// on the phone: the first 8 bytes, as phone browsers print them.
export const shortFingerprint = (fingerprint256) => String(fingerprint256 || '').split(':').slice(0, 8).join(' ');
