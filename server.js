import express from 'express';
// v1.10.0 — `cors` package no longer imported. The CORS-lockdown
// middleware below is intentionally custom + strict (localhost only)
// where `cors()` echoed `*` for every origin.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
// v1.10.31 — Data-F3.1: share computeInvoiceTotals with the client so
// server-generated recurring invoices honour UTGST, cess, RCM, TDS/TCS,
// discount modes (percent / unit / with-tax), tax-inclusive back-calc,
// invoice-level discount, and round-off. Previously the recurring auto-fire
// re-implemented totals inline and silently reintroduced every bug the
// v1.10.1 extraction fixed. Same source of truth now.
// v1.10.83 - same redaction as the browser's Problem log, for errors.log lines.
import { redact } from './src/utils/errorReport.js';
import { validateCashEntry, cleanCashEntry } from './src/utils/cashBook.js';
import { validatePurchasePayments } from './src/utils/purchasePayments.js';
import { templateTotals, clientYearToDate, nextCounterValue, startFor, numberSeriesFor, counterKeyFor, formatDocNumber, businessKeyOf, getFinancialYearLabel, INVOICE_TYPES } from './src/utils.js';
import { resolveAppHome } from './src/utils/appHome.js';
import { makeDir, makeDirAsync } from './src/utils/makeDir.js';
import { LOCK_NAME, acquireLock, writeLock, releaseLock, portIdentity } from './src/utils/serverLock.js';
import { SETUP_NAME, allowedDownloadUrl, checkSetupBytes, setupAssetFrom } from './src/utils/setupDownload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// v1.10.84 - data/, Saved Invoices/ and Trash/ live in APP_HOME: the folder
// the Windows Setup wrote into home.txt, else this folder (the ZIP layout).
let APP_HOME;
try {
  APP_HOME = resolveAppHome(__dirname);
} catch (err) {
  console.error(`\n  ${err.message}\n`);
  process.exit(1);
}
const DATA_DIR = path.join(APP_HOME, 'data');
// v1.10.84 - a copy installed by the Windows Setup (installer/free-gst-billing.iss
// writes this file) updates with the new Setup, never with update-windows.ps1.
// In the Setup's test mode the file also names the test folder.
const INSTALLED_FILE = path.join(__dirname, 'installed.txt');
const INSTALLED = fs.existsSync(INSTALLED_FILE);
const INSTALL_TEST_ROOT = INSTALLED
  ? ((/^testroot=(.+)$/m.exec(fs.readFileSync(INSTALLED_FILE, 'utf8').replace(/^\uFEFF/, '')) || [])[1] || '').trim()
  : '';

// v1.10.83 - started by Control Panel -> Restart: wait (up to 15 s) for the
// old copy to exit so this one gets its port (and, v1.10.84, its lock).
const afterPid = Number(process.argv[process.argv.indexOf('--after-pid') + 1]) || 0;
if (process.argv.includes('--after-pid') && afterPid) {
  for (let i = 0; i < 60; i++) {
    try { process.kill(afterPid, 0); } catch { break; }
    await new Promise(r => setTimeout(r, 250));
  }
}

// v1.10.84 - one server per books folder (see src/utils/serverLock.js). Taken
// before anything else runs, so a second server never writes a single file.
const LOCK_FILE = path.join(DATA_DIR, LOCK_NAME);
// Random per run: /api/version answers with it, so a lock is "running" only
// when THIS server answers on its port, not anything else that happens to.
const LOCK_ID = crypto.randomUUID();
const LOCK_HOST = os.hostname();
try { makeDir(DATA_DIR); } catch { /* reported below */ }
{
  const lock = await acquireLock(LOCK_FILE, { pid: process.pid, host: LOCK_HOST, id: LOCK_ID, identify: portIdentity });
  if (!lock.ok) {
    if (lock.reason === 'other-host') {
      console.log(`\n  These books are open in Free GST Billing on another computer (${lock.held.host}).`);
      console.log(`  Close the app there first. If it is not running there, delete ${LOCK_FILE} and open the app again.\n`);
      process.exit(1);
    }
    console.log(`\n  Free GST Billing is already running for these books${lock.held?.port ? ` at http://localhost:${lock.held.port}` : ''} (process ${lock.held?.pid}).`);
    console.log('  Not starting a second copy: two copies would overwrite each other\'s changes.\n');
    process.exit(0);
  }
  process.on('exit', () => releaseLock(LOCK_FILE, LOCK_ID));
}

// Port choice — we deliberately default to a high, unusual number rather than
// the conventional 3001. The 3000-range is heavily used by every other Node /
// Vite / React / Express app, dev servers, Grafana, etc., which means every
// other install would land on 3002 / 3003 / etc. and the user would be left
// guessing which URL is "theirs". 47371 is in IANA's unassigned range
// (between registered 1024-49151 and dynamic 49152-65535) and isn't claimed
// by any common software we could find. The persisted `data/port.txt` always
// wins over this default — so a single user who genuinely needs 47371 for
// something else can edit that file and we'll respect it forever.
const DEFAULT_PORT = 47371;
const PORT_FILE = path.join(DATA_DIR, 'port.txt');

// Read the persisted port (if any) — written once on first successful start
// and every time we get bumped off our preferred port by EADDRINUSE.
const persistedPort = (() => {
  try {
    if (!fs.existsSync(PORT_FILE)) return null;
    const n = parseInt(fs.readFileSync(PORT_FILE, 'utf-8').trim(), 10);
    return (isFinite(n) && n >= 1024 && n <= 65535) ? n : null;
  } catch { return null; }
})();
const STARTING_PORT = persistedPort || DEFAULT_PORT;
const MAX_PORT_SCAN = 50; // 47371 → 47420 is enough headroom for any conceivable collision

const app = express();

// v1.10.0 — CORS lockdown. Previously `app.use(cors())` echoed
// Access-Control-Allow-Origin: *, which meant any site the user visited
// could `fetch('http://localhost:47371/api/bills')` and read/wipe all
// data. This is a local desktop-style app: legitimate callers either
// have no Origin header (same-page fetch from our own served HTML,
// browsers' XHR to localhost from about:blank tools, curl) or an
// Origin pointing at http://localhost:<port>. Everything else is
// rejected. The Vite dev server proxies /api → us so its origin is
// also localhost.
// v1.10.84 (security review) - DNS rebinding guard. A web page can re-point
// its own domain to 127.0.0.1; the browser then sends its requests here as
// "same origin" with no Origin header, so the check below lets them through.
// They still carry Host: evil.example, so only the app's own names are
// answered. (Phone access, when it comes, checks its own listener's Host.)
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
app.use((req, res, next) => {
  if (LOCAL_HOST_RE.test(String(req.headers.host || ''))) return next();
  return res.status(403).json({ error: 'This app only answers http://localhost' });
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow =
    !origin ||
    /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
    /^https?:\/\/\[::1\](:\d+)?$/i.test(origin);
  if (!allow) {
    return res.status(403).json({ error: 'Cross-origin request refused' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// v1.10.0 — Body size lowered from 50mb → 5mb. Legit invoice payloads
// are single-digit kilobytes; a full import archive with 5000 bills fits
// comfortably in 2-3mb. 50mb + wildcard CORS previously meant any site
// could OOM the Node process with a nested-JSON payload.
// v1.10.77 - except /api/local-prefs, which parses its own body (below).
const LOCAL_PREFS_ROUTE = '/api/local-prefs';
// A full backup is bigger: every invoice keeps a copy of the business
// profile, logo and signature images included, so a few hundred invoices
// with a logo passed 5mb and Restore failed with "Request body too large".
const IMPORT_ROUTE = '/api/import';
const jsonBody = express.json({ limit: '5mb' });
const importBody = express.json({ limit: '500mb' });
app.use((req, res, next) => {
  if (req.path === LOCAL_PREFS_ROUTE) return next();
  return (req.path === IMPORT_ROUTE ? importBody : jsonBody)(req, res, next);
});

// Ensure data directory and sub-directories exist
const DIRS = ['bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts', 'profiles', 'purchases', 'productions', 'purchase-orders', 'cash-book'];
// v1.10.83 - a data folder the app may not write to (inside Program Files, a
// read-only drive, antivirus "controlled folder access") or a full disk used
// to crash here with a raw stack trace the launcher never showed. Say it in
// words, then stop: nothing can be saved, so starting would only lose work.
try {
  for (const dir of DIRS) {
    const dirPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(dirPath)) makeDir(dirPath);
  }
} catch (err) {
  const why = err.code === 'ENOSPC' ? 'The disk is full. Free some space and open the app again.'
    : (err.code === 'EACCES' || err.code === 'EPERM') ? 'The app is not allowed to write to its data folder. Move the app folder to Documents (not Program Files), or allow it in your antivirus.'
      : `The data folder could not be created (${err.code || err.message}).`;
  console.error(`\n  Free GST Billing cannot start: ${why}\n  Data folder: ${DATA_DIR}\n  Help: https://dicecodes.com/free-gst-software-documentation/troubleshooting.html#${err.code === 'ENOSPC' ? 'disk-full' : 'no-permission'}\n`);
  try { fs.appendFileSync(path.join(DATA_DIR, 'errors.log'), `[${new Date().toISOString()}] [startup] ${why} ${err.code || ''}\n`, 'utf-8'); } catch { /* the folder is the problem */ }
  process.exit(1);
}

// Helper: safe filename from ID (replace slashes, etc.)
function safeFileName(id) {
  return String(id).replace(/[/\\:*?"<>|]/g, '_');
}

// v1.10.0 — Path-traversal-safe user-string → single path segment.
// Strips path separators, drive letters, and every `..` occurrence
// (including URL-encoded variants after decode). Used for the
// save-pdf / trash-pdf endpoints that construct paths from query
// params. Never returns an empty string; falls back to a sentinel so
// callers can trust the return value for `path.join`.
function safePathSegment(input, fallback = 'Untitled') {
  if (input === undefined || input === null) return fallback;
  let s;
  try { s = decodeURIComponent(String(input)); } catch { s = String(input); }
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');    // reserved/control chars
  s = s.replace(/\.{2,}/g, '-');                    // squash .. and ...
  s = s.replace(/^[.\s]+|[.\s]+$/g, '');            // trim leading/trailing . and space (Windows reserves)
  s = s.slice(0, 120);                              // cap length
  return s || fallback;
}

// v1.10.0 — Enforce that `resolved` lives strictly inside `root`.
// Returns true if inside, false otherwise. Callers should reject on
// false and log server-side.
function isPathInside(resolved, root) {
  // Windows paths are case-insensitive: C:\...\DATA is the data folder too.
  const fold = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  const r = fold(path.resolve(root));
  const p = fold(path.resolve(resolved));
  return p === r || p.startsWith(r + path.sep);
}

// v1.10.0 — Generic error response helper. Never returns raw Node
// error messages to the client (they leak absolute filesystem paths,
// EACCES/EPERM strings that hint at server structure). Server-side
// logs the full detail; client sees a stable code + generic phrase.
function errRes(res, status, code, err) {
  // v1.10.83 - a full disk or a refused write is something the user can fix,
  // so it gets its own wording (the Problem log links it to the fix).
  if (code === 'server-error' && err) {
    if (err.code === 'ENOSPC') code = 'disk-full';
    else if (err.code === 'EACCES' || err.code === 'EPERM') code = 'no-permission';
  }
  if (err) {
    try {
      const ts = new Date().toISOString();
      const msg = err && err.stack ? err.stack : String(err);
      fs.appendFileSync(ERRORS_LOG, `[${ts}] [api:${code}] ${msg}\n`, 'utf-8');
    } catch { /* ignore log failures */ }
  }
  const MESSAGES = {
    'bad-request': 'Invalid request',
    'not-found': 'Not found',
    'conflict': 'Conflict with existing resource',
    'server-error': 'Internal server error',
    'forbidden': 'Refused',
    'invalid-path': 'Invalid path',
    'payload-too-large': 'Request body too large',
    'disk-full': 'The disk is full: free some space and try again',
    'no-permission': 'The app is not allowed to write to its data folder',
  };
  return res.status(status).json({ error: MESSAGES[code] || code, code });
}

// v1.10.0 — Atomic file write. Writes to `<file>.tmp` then renames
// over the target so a mid-write crash / power loss cannot leave a
// truncated file on disk. Critical for META_PATH which stores the
// invoice counter — a truncated meta.json read back as `{}` reissues
// invoice numbers from zero.
function writeFileAtomic(filePath, contents) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// Errors log path — declared here so errRes() can find it. The actual
// file is created lazily; ERRORS_LOG constant below still points here.
const ERRORS_LOG = path.join(DATA_DIR, 'errors.log');

// In-memory cache for directory reads — invalidated on write/delete.
// v1.10.6 — audit L12: added a 5s TTL. Users are documented as being
// able to hand-edit JSON files in data/*; prior code never noticed
// external edits until a POST/DELETE happened to invalidate. Now: any
// cached entry older than 5 seconds is treated as stale and re-read.
const dirCache = {};
const DIR_CACHE_TTL_MS = 5000;
function invalidateCache(dir) { delete dirCache[dir]; }

// Helper: read all JSON files from a directory (cached, 5s TTL)
function readAllFromDir(dir) {
  const entry = dirCache[dir];
  if (entry && (Date.now() - entry.at) < DIR_CACHE_TTL_MS) return entry.value;
  const dirPath = path.join(DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) return [];
  const results = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        // A file saved by Notepad / PowerShell 5.1 starts with a byte-order
        // mark, which JSON.parse refuses: it is not damage, so read past it.
        const v = JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf-8').replace(/^\uFEFF/, ''));
        // v1.10.83 - "null", a number or a list is as damaged as a broken file:
        // the screens expect an object and crashed on anything else.
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      } catch { /* reported below */ }
      reportDamagedFile(dir, f);
      return null;
    })
    .filter(Boolean);
  dirCache[dir] = { at: Date.now(), value: results };
  return results;
}

// v1.10.83 - one damaged file (power cut mid-save, a disk error, a hand
// edit) is skipped so everything else still loads - it always was - but now
// it is named once in errors.log, which the in-app Problem log shows with the
// fix "restore it from a backup". Once per file per run, not every 5s read.
const reportedDamaged = new Set();
function reportDamagedFile(dir, file) {
  const key = `${dir}/${file}`;
  if (reportedDamaged.has(key)) return;
  reportedDamaged.add(key);
  const msg = `Skipped damaged file data/${key} (not valid JSON) - restore it from a backup`;
  console.warn(`  ${msg}`);
  logFatal(msg, 'data');
}

// Helper: read a single JSON file
function readJSON(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  return fallback;
}

// Helper: write JSON file (with cache invalidation). v1.10.0 — writes
// atomically via temp+rename so a crash mid-write can't leave a
// truncated meta.json that resets the invoice counter.
function writeJSON(filePath, data) {
  writeFileAtomic(filePath, JSON.stringify(data, null, 2));
  // Invalidate cache for the parent directory
  const parentDir = path.basename(path.dirname(filePath));
  if (DIRS.includes(parentDir)) invalidateCache(parentDir);
}

// Helper: delete file (with cache invalidation)
function deleteFile(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const parentDir = path.basename(path.dirname(filePath));
  if (DIRS.includes(parentDir)) invalidateCache(parentDir);
}

// ========================
// BILLS
// ========================
app.get('/api/bills', (req, res) => {
  const bills = readAllFromDir('bills');
  bills.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  res.json(bills);
});

app.post('/api/bills', (req, res) => {
  const bill = req.body;
  if (!bill || !bill.id) return res.status(400).json({ error: 'Bill must have an id' });
  const filePath = path.join(DATA_DIR, 'bills', safeFileName(bill.id) + '.json');

  // Dupe-check: the invoice-number field is free-text on the client, so a
  // typo (INV/2026/0007 typed again for a fresh bill) would silently
  // overwrite the previous saved bill. That's data loss. Require the
  // client to pass ?overwrite=1 to allow it — used for edits + auto-fire
  // re-processing. Otherwise refuse with 409 so the UI can prompt the user.
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  if (!overwrite && fs.existsSync(filePath)) {
    return res.status(409).json({
      error: 'A bill with this invoice number already exists',
      invoiceNumber: bill.id,
    });
  }
  writeJSON(filePath, bill);
  res.json({ success: true });
});

// v1.10.31 — Data-F9.1: block deletion of a bill that's a client-credit
// SOURCE for another live bill. Deleting it would leave the target bill
// showing "paid" via credit-applied without a real source, breaking the
// dual-entry integrity guaranteed by v1.10.24. Client can force-delete
// by passing `?force=1` (they accept the ledger inconsistency).
function findCreditDependents(billId) {
  try {
    const billsDir = path.join(DATA_DIR, 'bills');
    const dependents = [];
    for (const f of fs.readdirSync(billsDir).filter(n => n.endsWith('.json'))) {
      let other;
      try { other = readJSON(path.join(billsDir, f), null); } catch { continue; }
      if (!other || other.id === billId) continue;
      const payments = other.payments || other.data?.payments || [];
      for (const p of payments) {
        if (p?.mode !== 'credit-applied') continue;
        const sources = p?.creditSourceBillIds || [];
        if (sources.includes(billId)) {
          dependents.push({ id: other.id, invoiceNumber: other.invoiceNumber, amount: p.amount });
          break;
        }
      }
    }
    return dependents;
  } catch {
    return [];
  }
}

app.delete('/api/bills/:id', (req, res) => {
  // v1.9.5 — soft delete: move to data/trash/ instead of unlinking so
  // users can restore within 30 days. Query ?permanent=1 skips trash and
  // deletes forever (used by the Trash bin UI's "Delete forever" action).
  const fname = safeFileName(req.params.id) + '.json';
  const filePath = path.join(DATA_DIR, 'bills', fname);
  if (!fs.existsSync(filePath)) return res.json({ success: true });

  // v1.10.31 — Data-F9.1: client-credit dependency check. Blocks silent
  // deletion of a credit source that would leave a paid-via-credit target
  // bill dangling. Force override via ?force=1.
  const force = req.query.force === '1' || req.query.force === 'true';
  if (!force) {
    const dependents = findCreditDependents(req.params.id);
    if (dependents.length > 0) {
      return res.status(409).json({
        error: 'client-credit-dependency',
        message: 'This bill was used as a client-credit source on another invoice. Deleting it would leave that invoice paid via credit that no longer has a real source.',
        dependents,
      });
    }
  }
  if (req.query.permanent === '1') {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    invalidateCache('bills');
    return res.json({ success: true, permanent: true });
  }
  try {
    const trashDir = path.join(DATA_DIR, 'trash');
    if (!fs.existsSync(trashDir)) makeDir(trashDir);
    fs.renameSync(filePath, path.join(trashDir, fname));
    // ERR-084: a move keeps the file's old date, and the Trash is emptied by
    // date (30 days, purgeOldTrash) - an invoice last changed 40 days ago was
    // gone at the next start. Its time in the Trash starts now.
    try { const now = new Date(); fs.utimesSync(path.join(trashDir, fname), now, now); } catch { /* the date only */ }
    // The list must not serve the moved bill from cache for 5 more seconds.
    invalidateCache('bills');
    res.json({ success: true, trashed: true });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// PROFILE
// ========================
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const DEFAULT_PROFILE = {
  businessName: '', address: '', state: '', gstin: '', pan: '',
  email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
  logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
};

app.get('/api/profile', (req, res) => {
  res.json(readJSON(PROFILE_PATH, DEFAULT_PROFILE));
});

app.post('/api/profile', (req, res) => {
  writeJSON(PROFILE_PATH, req.body);
  res.json({ success: true });
});

// ========================
// CLIENTS
// ========================
app.get('/api/clients', (req, res) => {
  const clients = readAllFromDir('clients');
  clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const client = req.body;
  if (!client.id) client.id = 'cli_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'clients', safeFileName(client.id) + '.json');
  writeJSON(filePath, client);
  res.json({ success: true, id: client.id });
});

app.delete('/api/clients/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'clients', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// TERMS TEMPLATES
// ========================
app.get('/api/templates', (req, res) => {
  let templates = readAllFromDir('templates');
  if (templates.length === 0) {
    // Seed default template
    const defaultTpl = {
      id: 'default',
      name: 'Standard Terms',
      content: '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.'
    };
    writeJSON(path.join(DATA_DIR, 'templates', 'default.json'), defaultTpl);
    templates = [defaultTpl];
  }
  templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(templates);
});

app.post('/api/templates', (req, res) => {
  const tpl = req.body;
  if (!tpl.id) tpl.id = 'tpl_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'templates', safeFileName(tpl.id) + '.json');
  writeJSON(filePath, tpl);
  res.json({ success: true, id: tpl.id });
});

app.delete('/api/templates/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'templates', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// PRODUCTS / INVENTORY
// ========================
app.get('/api/products', (req, res) => {
  const products = readAllFromDir('products');
  products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const product = req.body;
  if (!product.id) product.id = 'prod_' + Date.now() + crypto.randomBytes(3).toString('hex');
  // v1.10.83 (#121) - a service has no stock, whoever saves it (a purchase
  // bill adds quantities to every product on it).
  if (product.kind === 'service') delete product.stock;
  const filePath = path.join(DATA_DIR, 'products', safeFileName(product.id) + '.json');
  writeJSON(filePath, product);
  res.json({ success: true, id: product.id });
});

app.delete('/api/products/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'products', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// PRODUCTION (manufacturing, v1.10.83 #115)
// ========================
// A production entry and the stock it moves are saved by ONE request: the
// app works out entry.stockApplied ({ productId: change }, the same kind of
// record an invoice keeps), and this applies it with the same arithmetic as
// applyStockChanges in store.js. Doing it here, synchronously, means no other
// request can run in between, and if any file write fails every file already
// written is put back - a production is never half saved.
const PRODUCTIONS_DIR = path.join(DATA_DIR, 'productions');
const productFileFor = (id) => path.join(DATA_DIR, 'products', safeFileName(id) + '.json');

// Validates and works out the new products. Throws { status, code } when bad.
// skipMissing: on delete, a product removed from the catalog since is skipped
// (there is no stock left to put back on it).
function stockMoves(changes, skipMissing) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw { status: 400, code: 'bad-request' };
  const out = [];
  for (const [id, change] of Object.entries(changes)) {
    const file = productFileFor(id);
    if (!isPathInside(file, path.join(DATA_DIR, 'products'))) throw { status: 400, code: 'invalid-path' };
    if (typeof change !== 'number' || !Number.isFinite(change)) throw { status: 400, code: 'bad-request' };
    const product = readJSON(file, null);
    if (!product) { if (skipMissing) continue; throw { status: 400, code: 'Product not found. Reload the page and try again.' }; }
    if (product.kind === 'service') continue; // #121 - no stock to move
    out.push({ file, before: product, after: { ...product, stock: Math.round(((Number(product.stock) || 0) + change) * 1000) / 1000 } });
  }
  return out;
}

// Writes the products, then runs `finish` (save or delete the entry). On any
// failure the products already written are restored.
function commitStock(moves, finish) {
  const done = [];
  try {
    for (const m of moves) { writeJSON(m.file, m.after); done.push(m); }
    finish();
  } catch (err) {
    for (const m of done) { try { writeJSON(m.file, m.before); } catch { /* logged below */ } }
    throw err;
  }
}

app.get('/api/productions', (req, res) => {
  const rows = readAllFromDir('productions');
  rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json(rows);
});

app.post('/api/productions', (req, res) => {
  const entry = req.body;
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) return errRes(res, 400, 'bad-request');
  const file = path.join(PRODUCTIONS_DIR, safeFileName(entry.id) + '.json');
  if (!isPathInside(file, PRODUCTIONS_DIR)) return errRes(res, 400, 'invalid-path');
  // Never saved twice: a second save would move the stock a second time.
  // Editing is delete + enter again.
  if (fs.existsSync(file)) return errRes(res, 409, 'conflict');
  try {
    commitStock(stockMoves(entry.stockApplied, false), () => writeJSON(file, entry));
    invalidateCache('products');
    res.json({ success: true, id: entry.id });
  } catch (err) {
    if (err?.status) return errRes(res, err.status, err.code);
    errRes(res, 500, 'server-error', err);
  }
});

app.delete('/api/productions/:id', (req, res) => {
  const file = path.join(PRODUCTIONS_DIR, safeFileName(req.params.id) + '.json');
  if (!isPathInside(file, PRODUCTIONS_DIR)) return errRes(res, 400, 'invalid-path');
  const entry = readJSON(file, null);
  if (!entry) return errRes(res, 404, 'not-found');
  // Exactly the reverse of what this entry recorded it did.
  const back = {};
  for (const [id, change] of Object.entries(entry.stockApplied || {})) back[id] = -(Number(change) || 0);
  try {
    commitStock(stockMoves(back, true), () => deleteFile(file));
    invalidateCache('products');
    res.json({ success: true });
  } catch (err) {
    if (err?.status) return errRes(res, err.status, err.code);
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// EXPENSES
// ========================
app.get('/api/expenses', (req, res) => {
  const expenses = readAllFromDir('expenses');
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const expense = req.body;
  if (!expense.id) expense.id = 'exp_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'expenses', safeFileName(expense.id) + '.json');
  writeJSON(filePath, expense);
  res.json({ success: true, id: expense.id });
});

app.delete('/api/expenses/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'expenses', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// RECURRING INVOICES
// ========================
app.get('/api/recurring', (req, res) => {
  const items = readAllFromDir('recurring');
  items.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
  res.json(items);
});

app.post('/api/recurring', (req, res) => {
  const item = req.body;
  if (!item.id) item.id = 'rec_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'recurring', safeFileName(item.id) + '.json');
  writeJSON(filePath, item);
  res.json({ success: true, id: item.id });
});

app.delete('/api/recurring/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'recurring', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// RECEIPTS / PAYMENT VOUCHERS
// ========================
app.get('/api/receipts', (req, res) => {
  const receipts = readAllFromDir('receipts');
  receipts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(receipts);
});

app.post('/api/receipts', (req, res) => {
  const receipt = req.body;
  if (!receipt.id) receipt.id = 'rcp_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'receipts', safeFileName(receipt.id) + '.json');
  writeJSON(filePath, receipt);
  res.json({ success: true, id: receipt.id });
});

app.delete('/api/receipts/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'receipts', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// PURCHASES (Purchase Bills for ITC)
// ========================
app.get('/api/purchases', (req, res) => {
  const purchases = readAllFromDir('purchases');
  purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(purchases);
});

app.post('/api/purchases', (req, res) => {
  const purchase = req.body;
  // v1.10.83 (#123) - payments to the supplier: each more than 0 with a date,
  // and together not more than the bill (less TDS) by more than a rupee.
  if (!purchase || typeof purchase !== 'object' || Array.isArray(purchase)) return errRes(res, 400, 'bad-request');
  const problem = validatePurchasePayments(purchase);
  if (problem) return res.status(400).json({ error: problem, code: 'bad-request' });
  if (!purchase.id) purchase.id = 'pur_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(purchase.id) + '.json');
  writeJSON(filePath, purchase);
  res.json({ success: true, id: purchase.id });
});

app.delete('/api/purchases/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// v1.10.83 (#112) - purchase orders, a folder of their own: GST returns and
// reports read data/purchases, and an order is not a bill. Never deleted:
// a PO is cancelled instead, so its number stays accounted for.
app.get('/api/purchase-orders', (req, res) => {
  const orders = readAllFromDir('purchase-orders');
  orders.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.poNumber || '').localeCompare(String(a.poNumber || '')));
  res.json(orders);
});

app.post('/api/purchase-orders', (req, res) => {
  const order = req.body;
  if (!order || typeof order !== 'object' || Array.isArray(order)) return errRes(res, 400, 'bad-request');
  if (order.id !== undefined && (typeof order.id !== 'string' || !order.id.trim())) return errRes(res, 400, 'bad-request');
  if (!order.id) order.id = 'po_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const dir = path.join(DATA_DIR, 'purchase-orders');
  const filePath = path.join(dir, safeFileName(order.id) + '.json');
  if (!isPathInside(filePath, dir)) return errRes(res, 400, 'invalid-path');
  writeJSON(filePath, order);
  res.json({ success: true, id: order.id });
});

// v1.10.83 - the cash book's own entries (cash recorded on invoices, receipts
// and expenses is read from those, never copied here). Checked with the same
// rules as the form, and only known fields are stored.
app.get('/api/cash-book', (req, res) => {
  const entries = readAllFromDir('cash-book');
  entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json(entries);
});

app.post('/api/cash-book', (req, res) => {
  const problem = validateCashEntry(req.body);
  if (problem) return res.status(400).json({ error: problem, code: 'bad-request' });
  const entry = cleanCashEntry(req.body);
  if (!entry.id) entry.id = 'cash_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  else entry.updatedAt = new Date().toISOString();
  const dir = path.join(DATA_DIR, 'cash-book');
  const filePath = path.join(dir, safeFileName(entry.id) + '.json');
  if (!isPathInside(filePath, dir)) return errRes(res, 400, 'invalid-path');
  try {
    writeJSON(filePath, entry);
    res.json({ success: true, id: entry.id, entry });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

app.delete('/api/cash-book/:id', (req, res) => {
  const dir = path.join(DATA_DIR, 'cash-book');
  const filePath = path.join(dir, safeFileName(req.params.id) + '.json');
  if (!isPathInside(filePath, dir)) return errRes(res, 400, 'invalid-path');
  try {
    deleteFile(filePath);
    res.json({ success: true });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// BUSINESS PROFILES (multi-business)
// ========================
app.get('/api/profiles', (req, res) => {
  const profiles = readAllFromDir('profiles');
  profiles.sort((a, b) => (a.businessName || '').localeCompare(b.businessName || ''));
  res.json(profiles);
});

app.post('/api/profiles', (req, res) => {
  const prof = req.body;
  if (!prof.id) prof.id = 'biz_' + Date.now() + crypto.randomBytes(3).toString('hex');
  const filePath = path.join(DATA_DIR, 'profiles', safeFileName(prof.id) + '.json');
  writeJSON(filePath, prof);
  res.json({ success: true, id: prof.id });
});

app.delete('/api/profiles/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'profiles', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
});

// ========================
// META (counters, etc.)
// ========================
const META_PATH = path.join(DATA_DIR, 'meta.json');

// v1.10.77 (#84) - the PIN lock lives in meta.json too, but only the
// /api/lock routes below may read or change it.
const LOCK_KEY = 'appLock';
const withoutLock = (meta) => { const { [LOCK_KEY]: _lock, ...rest } = meta || {}; return rest; };
const withLock = (meta, lock) => (lock ? { ...withoutLock(meta), [LOCK_KEY]: lock } : withoutLock(meta));

app.get('/api/meta/:key', (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  const meta = readJSON(META_PATH, {});
  res.json({ value: meta[req.params.key] ?? null });
});

app.post('/api/meta/:key', (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  if (!req.body || !('value' in req.body)) return errRes(res, 400, 'bad-request');
  const meta = readJSON(META_PATH, {});
  meta[req.params.key] = req.body.value;
  writeJSON(META_PATH, meta);
  res.json({ success: true });
});

// v1.10.84 (#145) - a hand-typed invoice number ahead of the counter moves
// the counter up to it (never down), in one synchronous read + write.
app.post('/api/meta/:key/raise', (req, res) => {
  // Only number counters: any other meta value (settings) must not become a number.
  if (!/^counter_/.test(req.params.key)) return errRes(res, 400, 'bad-request');
  const value = Math.floor(Number(req.body?.value));
  if (!Number.isFinite(value) || value < 1 || value > 999999999) return errRes(res, 400, 'bad-request');
  const meta = readJSON(META_PATH, {});
  const current = Math.max(0, Math.floor(Number(meta[req.params.key]) || 0));
  if (value > current) { meta[req.params.key] = value; writeJSON(META_PATH, meta); }
  res.json({ value: Math.max(value, current) });
});

// Atomic increment for invoice-number counters. Node's I/O is single-threaded
// and readJSON / writeJSON are both synchronous (fs.readFileSync /
// writeFileSync), so wrapping read+write in one handler with no awaits is
// race-free across concurrent HTTP requests. Closes the
// "two saves both reading 5, both writing 6" duplicate-invoice-number bug.
app.post('/api/meta/:key/increment', (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  const meta = readJSON(META_PATH, {});
  // v1.10.78 (#93) - a tax invoice sends its start ("Start numbering from");
  // see nextCounterValue. Nothing else jumps.
  const next = nextCounterValue(meta[req.params.key], req.body?.start);
  meta[req.params.key] = next;
  writeJSON(META_PATH, meta);
  res.json({ value: next });
});

// ========================
// BROWSER SETTINGS COPY (v1.10.77, #84)
// ========================
// Settings the browser keeps (Print & PDF, Region, Features...) are mirrored
// here so a browser that loses its storage gets them back (src/utils/
// prefsMirror.js). Own file, not meta.json: Print settings can carry a
// letterhead and signature image, and meta.json is rewritten on every new
// invoice number. 25mb for those images; the server answers this PC only.
const LOCAL_PREFS_PATH = path.join(DATA_DIR, 'local-prefs.json');
app.get(LOCAL_PREFS_ROUTE, (req, res) => {
  res.json({ value: readJSON(LOCAL_PREFS_PATH, {}) });
});
// { set: { key: string }, remove: [key] } - merged, never replaced wholesale.
app.post(LOCAL_PREFS_ROUTE, express.json({ limit: '25mb' }), (req, res) => {
  const { set = {}, remove = [] } = req.body || {};
  if (!set || typeof set !== 'object' || Array.isArray(set) || !Array.isArray(remove)) return errRes(res, 400, 'bad-request');
  const prefs = readJSON(LOCAL_PREFS_PATH, {});
  for (const [k, v] of Object.entries(set)) if (typeof v === 'string') prefs[k] = v;
  for (const k of remove) delete prefs[String(k)];
  writeJSON(LOCAL_PREFS_PATH, prefs);
  return res.json({ success: true });
});

// ========================
// PIN LOCK (v1.10.77, #84)
// ========================
// Optional 6 or 8 digit PIN asked when the app opens. It is a screen lock for
// a shared PC, not encryption: the data files stay as they are, and the
// server still answers this PC only (127.0.0.1). Only a salted scrypt hash is
// stored. Forgotten PIN: put a file named RESET-PIN (or RESET-PIN.txt) in the
// app folder; the next check removes the PIN and the file.
const PIN_RE = /^(\d{6}|\d{8})$/;
// v1.10.84 - also the books folder (FGSB_HOME): an installed copy keeps its program
// files where the user may not write (/opt, Program Files).
const RESET_PIN_FILES = [...new Set([path.join(__dirname, '..'), __dirname, APP_HOME])]
  .flatMap((dir) => ['RESET-PIN', 'RESET-PIN.txt'].map((n) => path.join(dir, n)));
const pinHash = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const pinMatches = (lock, pin) => {
  if (!lock?.salt || !lock?.hash || !PIN_RE.test(String(pin ?? ''))) return false;
  const a = Buffer.from(pinHash(pin, lock.salt), 'hex');
  const b = Buffer.from(lock.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// Five wrong PINs in a row -> wait 30 seconds before the next try.
const pinTries = { wrong: 0, until: 0 };
const currentLock = () => {
  const meta = readJSON(META_PATH, {});
  const reset = RESET_PIN_FILES.filter((f) => fs.existsSync(f));
  if (reset.length) {
    if (meta[LOCK_KEY]) { delete meta[LOCK_KEY]; writeJSON(META_PATH, meta); }
    for (const f of reset) { try { fs.unlinkSync(f); } catch { /* removed already */ } }
    console.log('[lock] RESET-PIN file found: PIN lock removed');
    return null;
  }
  return meta[LOCK_KEY] || null;
};
// Checks a PIN; answers the response itself (and returns false) when it is
// wrong or the user must wait.
const checkPin = (res, lock, pin) => {
  const wait = Math.ceil((pinTries.until - Date.now()) / 1000);
  if (wait > 0) { res.status(429).json({ ok: false, wait }); return false; }
  if (pinMatches(lock, pin)) { pinTries.wrong = 0; return true; }
  pinTries.wrong += 1;
  if (pinTries.wrong >= 5) { pinTries.wrong = 0; pinTries.until = Date.now() + 30000; }
  res.status(401).json({ ok: false, error: 'wrong-pin' });
  return false;
};

app.get('/api/lock', (req, res) => {
  const lock = currentLock();
  res.json({ enabled: !!lock, length: lock?.length || 0 });
});

app.post('/api/lock/verify', (req, res) => {
  const lock = currentLock();
  if (!lock) return res.json({ ok: true });
  if (checkPin(res, lock, req.body?.pin)) res.json({ ok: true });
});

// Turn on, change ({ pin }) or turn off ({ pin: null }). When a PIN is
// already set, the current one must come with it.
app.post('/api/lock/set', (req, res) => {
  const { pin, currentPin } = req.body || {};
  if (pin !== null && !PIN_RE.test(String(pin ?? ''))) return errRes(res, 400, 'bad-request');
  const lock = currentLock();
  if (lock && !checkPin(res, lock, currentPin)) return undefined;
  const meta = readJSON(META_PATH, {});
  if (pin === null) delete meta[LOCK_KEY];
  else {
    const salt = crypto.randomBytes(16).toString('hex');
    meta[LOCK_KEY] = { salt, hash: pinHash(pin, salt), length: String(pin).length };
  }
  writeJSON(META_PATH, meta);
  return res.json({ ok: true, enabled: pin !== null });
});

// ========================
// EXPORT / IMPORT
// ========================
app.get('/api/export', (req, res) => {
  const data = {
    bills: readAllFromDir('bills'),
    profile: readJSON(PROFILE_PATH, DEFAULT_PROFILE),
    clients: readAllFromDir('clients'),
    termsTemplates: readAllFromDir('templates'),
    products: readAllFromDir('products'),
    expenses: readAllFromDir('expenses'),
    recurring: readAllFromDir('recurring'),
    receipts: readAllFromDir('receipts'),
    profiles: readAllFromDir('profiles'),
    purchases: readAllFromDir('purchases'),
    productions: readAllFromDir('productions'), // v1.10.83 (#115)
    purchaseOrders: readAllFromDir('purchase-orders'),
    cashBook: readAllFromDir('cash-book'),
    // v1.10.77 - never the PIN hash: a backup file can travel (email, Drive).
    meta: withoutLock(readJSON(META_PATH, {})),
    exportedAt: new Date().toISOString(),
  };
  res.json(data);
});

app.post('/api/import', (req, res) => {
  // v1.10.0 — Match POST /api/bills' overwrite semantics for bills.
  // v1.10.31 — Data-F5.1 fix: overwrite gating now applies to EVERY
  // collection, not just bills. Previously clients / templates / products
  // / expenses / recurring / receipts / profiles / purchases / meta were
  // ALWAYS overwritten regardless of the `?overwrite` flag. A user
  // restoring an old backup expecting a bill-only merge lost every new
  // client / product / template they'd added since the backup — plus the
  // meta counter reset caused invoice-number 409 loops on next save.
  // Also v1.10.31 — Data-F12.2: after any import, scan the imported bills
  // and reconcile the meta counter with each prefix's max existing suffix
  // so the next reservation doesn't collide.
  const data = req.body;
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  const counts = {
    billCount: 0, billSkipped: 0,
    clientCount: 0, clientSkipped: 0,
    templateCount: 0, templateSkipped: 0,
    productCount: 0, productSkipped: 0,
    expenseCount: 0, expenseSkipped: 0,
    recurringCount: 0, recurringSkipped: 0,
    receiptCount: 0, receiptSkipped: 0,
    profileCount: 0, profileSkipped: 0,
    purchaseCount: 0, purchaseSkipped: 0,
    productionCount: 0, productionSkipped: 0,
    purchaseOrderCount: 0, purchaseOrderSkipped: 0,
    cashBookCount: 0, cashBookSkipped: 0,
  };

  // Helper: upsert one entity to a directory, honouring the overwrite flag.
  const upsertOne = (dirName, entity, countKey, skipKey) => {
    if (!entity?.id) return;
    const p = path.join(DATA_DIR, dirName, safeFileName(entity.id) + '.json');
    if (!overwrite && fs.existsSync(p)) { counts[skipKey]++; return; }
    writeJSON(p, entity);
    counts[countKey]++;
  };

  // Profile is a singleton (single file); overwrite-gated same way.
  if (data.profile) {
    if (overwrite || !fs.existsSync(PROFILE_PATH)) {
      writeJSON(PROFILE_PATH, data.profile);
    }
  }
  (data.bills || []).forEach(b => upsertOne('bills', b, 'billCount', 'billSkipped'));
  (data.clients || []).forEach(c => upsertOne('clients', c, 'clientCount', 'clientSkipped'));
  (data.termsTemplates || []).forEach(t => upsertOne('templates', t, 'templateCount', 'templateSkipped'));
  (data.products || []).forEach(p => upsertOne('products', p, 'productCount', 'productSkipped'));
  (data.expenses || []).forEach(e => upsertOne('expenses', e, 'expenseCount', 'expenseSkipped'));
  (data.recurring || []).forEach(r => upsertOne('recurring', r, 'recurringCount', 'recurringSkipped'));
  (data.receipts || []).forEach(r => upsertOne('receipts', r, 'receiptCount', 'receiptSkipped'));
  (data.profiles || []).forEach(p => upsertOne('profiles', p, 'profileCount', 'profileSkipped'));
  (data.purchases || []).forEach(p => upsertOne('purchases', p, 'purchaseCount', 'purchaseSkipped'));
  // v1.10.83 (#115) - saved as they are: the products in the same backup
  // already hold the stock these entries moved, so nothing is applied again.
  (data.productions || []).forEach(p => upsertOne('productions', p, 'productionCount', 'productionSkipped'));
  (data.purchaseOrders || []).forEach(p => upsertOne('purchase-orders', p, 'purchaseOrderCount', 'purchaseOrderSkipped'));
  // v1.10.83 - a cash entry that fails the form's checks is skipped, not saved.
  (data.cashBook || []).forEach(c => { if (validateCashEntry(c)) counts.cashBookSkipped++; else upsertOne('cash-book', cleanCashEntry(c), 'cashBookCount', 'cashBookSkipped'); });

  // meta.json — same gating. Previously always overwrote → counters could
  // regress below existing bill numbers → collision loop on next save.
  if (data.meta) {
    if (overwrite || !fs.existsSync(META_PATH)) {
      // The PIN on this PC stays as it is: a backup never sets, removes or
      // brings back an old PIN.
      writeJSON(META_PATH, withLock(withoutLock(data.meta), readJSON(META_PATH, {})[LOCK_KEY]));
    } else {
      // v1.10.79 (#95) - a merge keeps what is here and adds the backup's own
      // number series and the higher of each counter, so no number is reused.
      const meta = readJSON(META_PATH, {});
      const series = { ...(data.meta.invoiceNumberSeries || {}), ...(meta.invoiceNumberSeries || {}) };
      if (Object.keys(series).length) meta.invoiceNumberSeries = series;
      // v1.10.83 (#112) - and the backup's cost centres this PC does not have,
      // so the documents it brings in keep their cost centre.
      if (Array.isArray(data.meta.costCentres)) {
        const have = new Set((meta.costCentres || []).map((c) => c?.id));
        const added = data.meta.costCentres.filter((c) => c?.id && !have.has(c.id));
        if (added.length) meta.costCentres = [...(meta.costCentres || []), ...added];
      }
      for (const [k, v] of Object.entries(data.meta)) {
        if (k.startsWith('counter_') && Number(v) > (Number(meta[k]) || 0)) meta[k] = Number(v);
      }
      writeJSON(META_PATH, meta);
    }
  }

  // v1.10.31 — Data-F12.2: reconcile meta counter with imported bill nums.
  // For every bill just imported (or already on disk), extract the numeric
  // suffix from its invoice number. Bump each `counter_<PREFIX>` in meta
  // to at least max(existing) so the next reservation doesn't collide.
  try {
    const meta = readJSON(META_PATH, {});
    const billFiles = fs.readdirSync(path.join(DATA_DIR, 'bills')).filter(f => f.endsWith('.json'));
    const maxByPrefix = {};
    const maxByKey = {};
    for (const f of billFiles) {
      let bill;
      try { bill = readJSON(path.join(DATA_DIR, 'bills', f), null); } catch { continue; }
      const num = String(bill?.invoiceNumber || bill?.id || '');
      // Extract prefix + last numeric suffix (e.g. INV/2026-27/0007 → prefix INV, suffix 7)
      const m = num.match(/^([A-Z]+)[\W_].*?(\d+)\s*$/i);
      if (!m) continue;
      const prefix = m[1].toUpperCase();
      const suffix = parseInt(m[2], 10);
      if (!Number.isFinite(suffix)) continue;
      if (!maxByPrefix[prefix] || suffix > maxByPrefix[prefix]) maxByPrefix[prefix] = suffix;
      // v1.10.79 (#95) - the counter this bill's series really uses: its own
      // business series (counter_INV@<GSTIN>) or the shared one, by type.
      // The leading-token bump above stays for per-type prefixes from Print
      // Settings, whose counter is named after the prefix itself.
      const typePrefix = INVOICE_TYPES[bill.invoiceType || bill.data?.invoiceType || 'tax-invoice']?.prefix;
      if (typePrefix) {
        const biz = businessKeyOf(bill.data?.profile || { gstin: bill.ownerGstin, businessName: bill.ownerName });
        const series = numberSeriesFor(meta.invoiceNumberSettings, meta.invoiceNumberSeries, biz);
        const head = formatDocNumber({ settings: { ...series, format: 'sequential', showFinYear: false }, typePrefix, next: 0 })
          .replace(/0+$/, '');
        if (num.toUpperCase().startsWith(head.toUpperCase())) {
          const key = counterKeyFor(typePrefix, series, biz);
          if (!maxByKey[key] || suffix > maxByKey[key]) maxByKey[key] = suffix;
        }
      }
    }
    let metaChanged = false;
    const wanted = { ...Object.fromEntries(Object.entries(maxByPrefix).map(([pfx, n]) => [`counter_${pfx}`, n])), ...maxByKey };
    for (const [key, maxNum] of Object.entries(wanted)) {
      const existing = Number(meta[key]) || 0;
      if (maxNum > existing) {
        meta[key] = maxNum;
        metaChanged = true;
      }
    }
    if (metaChanged) writeJSON(META_PATH, meta);
  } catch (err) {
    console.error('Post-import counter reconciliation failed:', err);
  }

  res.json({ ...counts, hasProfile: !!data.profile });
});

// ========================
// Save PDF to local folder
// ========================
const INVOICES_DIR = path.join(APP_HOME, 'Saved Invoices');
if (!fs.existsSync(INVOICES_DIR)) makeDir(INVOICES_DIR);

app.post('/api/save-pdf', express.raw({ type: 'application/pdf', limit: '20mb' }), (req, res) => {
  try {
    // v1.10.0 — Path traversal fix. Previous filter stripped
    // `<>:"/\|?*` but NOT `..`, so `?client=..&month=..&name=x.bat`
    // resolved to `INVOICES_DIR/../../x.bat` and wrote attacker bytes
    // above the app root. safePathSegment collapses `..` and control
    // chars; the resolved-path guard below rejects anything that still
    // escapes INVOICES_DIR.
    const rawName = req.query.name || `invoice-${Date.now()}.pdf`;
    const safeClient = safePathSegment(req.query.client, 'General');
    const safeMonth = safePathSegment(req.query.month, new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
    let safeName = safePathSegment(rawName, `invoice-${Date.now()}.pdf`);
    if (!safeName.toLowerCase().endsWith('.pdf')) safeName += '.pdf';

    const folderPath = path.join(INVOICES_DIR, safeClient, safeMonth);
    const filePath = path.join(folderPath, safeName);
    if (!isPathInside(filePath, INVOICES_DIR)) return errRes(res, 400, 'invalid-path');

    if (!fs.existsSync(folderPath)) makeDir(folderPath);
    fs.writeFileSync(filePath, req.body);
    // v1.10.79 (#94) - a PDF saved now replaces any original kept for Undo of
    // a CANCELLED stamp, so an old copy can never come back over a new one.
    const keptOriginal = path.join(DATA_DIR, 'cancelled-pdf-originals', path.relative(INVOICES_DIR, filePath));
    if (isPathInside(keptOriginal, path.join(DATA_DIR, 'cancelled-pdf-originals')) && fs.existsSync(keptOriginal)) {
      try { fs.unlinkSync(keptOriginal); } catch { /* leave it */ }
    }
    // Don't leak absolute FS path — client only needs to know it saved
    // and where (relative). Absolute path revealed OS username +
    // install dir to any origin.
    res.json({ saved: true, relPath: path.relative(APP_HOME, filePath).split(path.sep).join('/') });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Number series follow a renamed business (v1.10.79, #95)
// ========================
// An own series is filed under the business's GSTIN, or its name when it has
// none. When Settings saves the business under a new GSTIN or name, its series
// and counters move with it, so it keeps numbering where it was.
app.post('/api/number-series/rename', (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string' || from === to) return errRes(res, 400, 'bad-request');
  const meta = readJSON(META_PATH, {});
  const series = meta.invoiceNumberSeries || {};
  if (!series[from] || series[to]) return res.json({ moved: false });
  series[to] = series[from];
  delete series[from];
  meta.invoiceNumberSeries = series;
  for (const key of Object.keys(meta)) {
    if (key.startsWith('counter_') && key.endsWith(`@${from}`)) {
      const target = key.slice(0, -from.length) + to;
      meta[target] = Math.max(Number(meta[target]) || 0, Number(meta[key]) || 0);
      delete meta[key];
    }
  }
  writeJSON(META_PATH, meta);
  return res.json({ moved: true });
});

// ========================
// CANCELLED on saved PDFs (v1.10.79, #94)
// ========================
// Cancelling an invoice stamps "CANCELLED" across every page of its PDF in
// Saved Invoices; Undo puts the original back, byte for byte. The original is
// kept under data/ (so backups carry it), never in the folder people browse.
const PDF_ORIGINALS_DIR = path.join(DATA_DIR, 'cancelled-pdf-originals');

// The copies of one invoice's PDF in Saved Invoices: <client>/<month>/<name>,
// or loose in the folder. Same lookup as Move saved PDF to Trash below.
function findSavedPdfs(fileName, clientName) {
  const safeClient = safePathSegment(clientName, 'General');
  const safeName = safePathSegment(fileName, 'Untitled.pdf');
  const out = [];
  const clientDir = path.join(INVOICES_DIR, safeClient);
  if (isPathInside(clientDir, INVOICES_DIR) && fs.existsSync(clientDir)) {
    for (const month of fs.readdirSync(clientDir)) {
      const file = path.join(clientDir, month, safeName);
      if (isPathInside(file, INVOICES_DIR) && fs.existsSync(file)) out.push(file);
    }
  }
  const flat = path.join(INVOICES_DIR, safeName);
  if (isPathInside(flat, INVOICES_DIR) && fs.existsSync(flat)) out.push(flat);
  return out;
}

async function stampCancelled(bytes) {
  // Loaded here, not at start-up: if pdf-lib were ever missing (a failed
  // update), only this stamp would fail, never the whole app.
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = 'CANCELLED';
  const angle = 30;
  const rad = (angle * Math.PI) / 180;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 6.5;
    const w = font.widthOfTextAtSize(text, size);
    // Start point that puts the middle of the rotated word at the page centre.
    const x = width / 2 - (w / 2) * Math.cos(rad) + (size / 3) * Math.sin(rad);
    const y = height / 2 - (w / 2) * Math.sin(rad) - (size / 3) * Math.cos(rad);
    page.drawText(text, { x, y, size, font, color: rgb(0.86, 0.15, 0.15), opacity: 0.28, rotate: degrees(angle) });
  }
  return doc.save();
}

// { fileName, clientName, cancelled } -> { updated: n }
app.post('/api/saved-pdf/cancel-mark', express.json(), async (req, res) => {
  try {
    const { fileName, clientName, cancelled } = req.body || {};
    if (!fileName || typeof cancelled !== 'boolean') return errRes(res, 400, 'bad-request');
    let updated = 0;
    let failed = 0;
    for (const file of findSavedPdfs(fileName, clientName)) {
      const original = path.join(PDF_ORIGINALS_DIR, path.relative(INVOICES_DIR, file));
      if (!isPathInside(original, PDF_ORIGINALS_DIR)) continue;
      // One copy that cannot be written (open in a PDF reader) never stops the rest.
      try {
        if (cancelled) {
          // Always stamp from the original, so cancelling twice never stamps twice.
          if (!fs.existsSync(original)) { ensureDir(path.dirname(original)); fs.copyFileSync(file, original); }
          fs.writeFileSync(file, await stampCancelled(fs.readFileSync(original)));
          updated++;
        } else if (fs.existsSync(original)) {
          fs.copyFileSync(original, file);
          fs.unlinkSync(original);
          updated++;
        }
      } catch (err) {
        failed++;
        console.warn('[pdf] CANCELLED stamp/undo failed:', err.message);
      }
    }
    return res.json({ updated, failed });
  } catch (err) {
    return errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Move saved PDF to Trash
// ========================
const TRASH_DIR = path.join(APP_HOME, 'Trash');

if (!fs.existsSync(TRASH_DIR)) makeDir(TRASH_DIR);

app.post('/api/trash-pdf', express.json(), (req, res) => {
  try {
    const { fileName, clientName } = req.body;
    if (!fileName) return errRes(res, 400, 'bad-request');

    // v1.10.0 — Path traversal fix (see save-pdf comment). Prior code
    // didn't strip `..` so `fileName: '../../../etc/passwd'` moved
    // arbitrary local files into the Trash.
    const safeClient = safePathSegment(clientName, 'General');
    const safeName = safePathSegment(fileName, 'Untitled.pdf');

    const clientDir = path.join(INVOICES_DIR, safeClient);
    // Extra guard — reject if the constructed client dir somehow escaped.
    if (!isPathInside(clientDir, INVOICES_DIR)) return errRes(res, 400, 'invalid-path');
    let found = false;

    if (fs.existsSync(clientDir)) {
      const months = fs.readdirSync(clientDir).filter(f => {
        try { return fs.statSync(path.join(clientDir, f)).isDirectory(); } catch { return false; }
      });
      for (const month of months) {
        const filePath = path.join(clientDir, month, safeName);
        if (!isPathInside(filePath, INVOICES_DIR)) continue;
        if (fs.existsSync(filePath)) {
          const trashPath = path.join(TRASH_DIR, safeClient, month);
          const trashFile = path.join(trashPath, safeName);
          if (!isPathInside(trashFile, TRASH_DIR)) return errRes(res, 400, 'invalid-path');
          if (!fs.existsSync(trashPath)) makeDir(trashPath);
          try {
            fs.renameSync(filePath, trashFile);
          } catch {
            fs.copyFileSync(filePath, trashFile);
            fs.unlinkSync(filePath);
          }
          found = true;
          break;
        }
      }
    }

    if (!found) {
      const flatPath = path.join(INVOICES_DIR, safeName);
      if (isPathInside(flatPath, INVOICES_DIR) && fs.existsSync(flatPath)) {
        const trashPath = path.join(TRASH_DIR, safeClient);
        const trashFile = path.join(trashPath, safeName);
        if (isPathInside(trashFile, TRASH_DIR)) {
          if (!fs.existsSync(trashPath)) makeDir(trashPath);
          try {
            fs.renameSync(flatPath, trashFile);
          } catch {
            fs.copyFileSync(flatPath, trashFile);
            fs.unlinkSync(flatPath);
          }
          found = true;
        }
      }
    }

    res.json({ trashed: found });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Version check
// ========================
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

// The Linux packages and the Docker image carry install-kind.txt ("deb",
// "appimage" or "docker"). They are updated by installing the new package, so
// the ZIP updater never runs there and the app says what to do instead.
const INSTALL_KIND = (() => {
  try { return fs.readFileSync(path.join(__dirname, 'install-kind.txt'), 'utf-8').trim(); } catch { return ''; }
})();
const updateHint = (latest) => ({
  deb: `This copy was installed from the .deb package. To update, download free-gst-billing_${latest || '<version>'}_amd64.deb from the release page and open it (or run: sudo apt install ./free-gst-billing_${latest || '<version>'}_amd64.deb). Your invoices are kept.`,
  appimage: 'This copy is the AppImage. To update, download the new Free-GST-Billing-Linux-x86_64.AppImage from the release page and use it instead of the old file. Your invoices are kept.',
  docker: 'This copy runs in Docker. To update, put the new version in the image: line of docker-compose.yml and run: docker compose up -d. Your invoices stay in the /data volume.',
}[INSTALL_KIND] || null);

// v1.10.84 - also who is answering: the process and lock id (a second server
// checks "is the lock's server really the one on that port?") and the books
// folder (the Windows launcher opens a running server only if it serves ITS
// books, not an old copy's on the same port).
app.get('/api/version', (req, res) => {
  res.json({ current: pkg.version, pid: process.pid, lockId: LOCK_ID, books: APP_HOME });
});

// v1.10.83 - the browser's Problem log copies each entry here, so errors.log
// holds both sides of a failure. Redacted again (never trust the sender), one
// line per entry, capped fields, and at most 30 a minute so a looping screen
// cannot fill the disk (rotateErrorsIfLarge caps the file as well).
const clientErrorTimes = [];
app.post('/api/client-errors', (req, res) => {
  const now = Date.now();
  while (clientErrorTimes.length && now - clientErrorTimes[0] > 60_000) clientErrorTimes.shift();
  if (clientErrorTimes.length >= 30) return res.status(429).json({ error: 'Too many reports', code: 'rate-limited' });
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return errRes(res, 400, 'bad-request');
  const field = (v, n) => ((typeof v === 'string' || typeof v === 'number') ? redact(String(v)).replace(/\s*[\r\n]+\s*/g, ' | ').slice(0, n) : '');
  const message = field(b.message, 500);
  if (!message) return errRes(res, 400, 'bad-request');
  clientErrorTimes.push(now);
  const api = b.api && typeof b.api === 'object'
    ? `${field(b.api.method, 10)} ${field(String(b.api.path || '').split('?')[0], 120)} -> ${Number(b.api.status) || 0} ` : '';
  const stack = field(b.stack, 1500);
  const line = `[${new Date().toISOString()}] [client:${field(b.kind, 20) || 'error'}] v${field(b.version, 20)} screen=${field(b.view, 30)} ${api}${message}${stack ? ` | ${stack}` : ''} | ${field(b.browser, 80)}`;
  try {
    rotateErrorsIfLarge();
    fs.appendFileSync(ERRORS_LOG, line + '\n', 'utf-8');
  } catch { /* disk full or read-only: the browser keeps its copy */ }
  res.json({ ok: true });
});

// v1.10.83 - read-only tail of errors.log for the Problem log page: last 100
// lines, each redacted and cut to 500 characters. Reads only the last 64 KB.
app.get('/api/errors-log', (req, res) => {
  try {
    if (!fs.existsSync(ERRORS_LOG)) return res.json({ lines: [] });
    const size = fs.statSync(ERRORS_LOG).size;
    const len = Math.min(size, 64 * 1024);
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(ERRORS_LOG, 'r');
    try { fs.readSync(fd, buf, 0, len, size - len); } finally { fs.closeSync(fd); }
    let lines = buf.toString('utf-8').split(/\r?\n/);
    if (len < size) lines = lines.slice(1); // first line is cut in half
    res.json({ lines: lines.filter((l) => l.trim()).slice(-100).map((l) => redact(l).slice(0, 500)) });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// Naive semver compare — returns +1 if a > b, -1 if a < b, 0 if equal.
// "1.4.10" > "1.4.2" correctly (numeric parts), unlike a string compare.
function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// v1.10.81 - "What's new" on the Support & About page: the CHANGELOG.md that
// ships in every ZIP next to this file, so it works offline. The page parses
// it (src/utils/changelog.js) and shows it as text, never as HTML.
app.get('/api/changelog', (req, res) => {
  fs.readFile(path.join(__dirname, 'CHANGELOG.md'), 'utf8', (err, text) => {
    if (err) return res.json({ text: '' });
    res.json({ text: text.slice(0, 400000) });
  });
});

app.get('/api/check-update', async (req, res) => {
  // v1.10.83 - Offline mode (Settings → Privacy & internet): no automatic
  // check. ?now=1 is the Check for Updates button, which the user clicked.
  if (readJSON(LOCAL_PREFS_PATH, {}).gst_offlineMode === '1' && req.query.now !== '1') {
    res.json({ current: pkg.version, updateAvailable: false, offlineMode: true });
    return;
  }
  try {
    // Two parallel fetches: package.json (definitive version source) and the
    // GitHub Releases API (for release notes). Both have a 4s timeout so a
    // flaky network can't lock the UI.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const [pkgRes, relRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/package.json', { signal: ctrl.signal }).catch(() => null),
      fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'FreeGSTBill-update-check' },
      }).catch(() => null),
    ]);
    clearTimeout(t);

    let releaseNotes = null;
    let releaseUrl = null;
    let releasePublishedAt = null;
    let releaseTag = null;
    if (relRes && relRes.ok) {
      const rel = await relRes.json();
      releaseNotes = rel.body || null;
      releaseUrl = rel.html_url || null;
      releasePublishedAt = rel.published_at || null;
      releaseTag = rel.tag_name || null;
    }

    // #105: the updater installs the latest RELEASE, so its tag is the version
    // on offer. main's package.json can be ahead of it (merged, not released
    // yet) and then offered an update that re-installed the same version.
    // package.json is only the fallback when the Releases API can't be read.
    let latest = /^v?\d+\.\d+\.\d+$/.test(releaseTag || '') ? releaseTag.replace(/^v/, '') : null;
    if (!latest) {
      if (!pkgRes?.ok) throw new Error('GitHub fetch failed');
      latest = (await pkgRes.json()).version;
    }
    const updateAvailable = compareSemver(latest, pkg.version) > 0;

    res.json({
      current: pkg.version,
      latest,
      updateAvailable,
      releaseNotes,
      releaseUrl,
      releasePublishedAt,
      releaseTag,
      updateHint: updateHint(latest),
    });
  } catch {
    res.json({ current: pkg.version, latest: null, updateAvailable: false, error: 'Could not check for updates' });
  }
});

// ============================================================
// v1.10.44 — In-app Control Panel API
// Powers /control-panel in the app. Each endpoint shells out to
// a platform-appropriate script under `_system-scripts/` — the copy inside
// `_system/` in a release install, or `release-templates/_system-scripts/`
// when running from the source repo.
// ============================================================
import { spawn } from 'child_process';
import os from 'os';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Where the launcher scripts live. In a release-ZIP install the app
// is under `_system/` so `..` gets us to the launcher's script dir;
// in dev the same relative path lands us at `release-templates/_system-scripts/`
// which also holds them. If neither exists we degrade gracefully —
// the Control Panel just shows the buttons as disabled.
// v1.10.72 (#73) — the release ZIP has always FLATTENED the scripts into
// _system/, right next to this file (build-release-zip.mjs copies
// _system-scripts/* into _system/). None of the old candidates existed in a
// ZIP install, so every user since v1.10.44 got "Launcher scripts not
// detected", and Update / Backup / Restore / Move / Stop failed with
// "Script not found". A folder now only counts if it really holds the update
// script, so an unrelated folder with the right name can't be picked either.
const SCRIPT_SUFFIX = isWindows ? '-windows.ps1' : '-unix.sh';
const CONTROL_SCRIPT_CANDIDATES = [
  __dirname,                                                     // release ZIP: _system/
  path.join(__dirname, 'release-templates', '_system-scripts'), // source repo
  path.join(__dirname, '_system-scripts'),                       // older layouts
  path.join(__dirname, '..', '_system-scripts'),
];
// v1.10.84 - found by the backup script, which every layout ships: a copy
// installed by the Windows Setup has no update / move / uninstall scripts (it
// updates with the new Setup, and Windows' Apps list removes it).
const controlScriptDir = CONTROL_SCRIPT_CANDIDATES.find(
  p => fs.existsSync(path.join(p, `backup${SCRIPT_SUFFIX}`)),
) || null;

function pickScript(name) {
  if (!controlScriptDir) return null;
  const p = path.join(controlScriptDir, name + SCRIPT_SUFFIX);
  return fs.existsSync(p) ? p : null;
}

// Which Control Panel actions have a script on this platform. Linux / macOS
// ship update + backup only, so Restore / Move / Stop are shown as not
// available there instead of failing when clicked.
const CONTROL_ACTIONS = ['update', 'backup', 'restore', 'move', 'stop'];
// v1.10.83 - Stop works everywhere: on macOS / Linux there is no stop script,
// so the server stops itself (see launch-script below). The Mac and Linux
// guides tell people to use it.
const controlActions = () => Object.fromEntries(CONTROL_ACTIONS.map(a => [a, (a === 'stop' && !isWindows) || (a === 'update' && INSTALLED) ? true : !!pickScript(a)]));

function runControlScript(scriptPath) {
  return new Promise((resolve) => {
    if (!scriptPath) { resolve({ ok: false, error: 'Not available here: the script for this action is not in the app folder. Download the latest ZIP to get it.' }); return; }
    // v1.10.66 (#59) — update-unix.sh is plain POSIX sh, so it runs under `sh`
    // and therefore also where bash does not exist (Alpine / BusyBox NAS
    // images). The other Unix scripts use bash features and keep running under
    // bash, found on PATH as before — /usr/local/bin/bash on TrueNAS CORE,
    // /run/current-system/sw/bin/bash on NixOS.
    const unixShell = path.basename(scriptPath) === 'update-unix.sh' ? 'sh' : 'bash';
    const [cmd, args] = isWindows
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]]
      : [unixShell, [scriptPath]];
    let out = '', err = '';
    try {
      const child = spawn(cmd, args, { detached: false, windowsHide: false });
      child.stdout?.on('data', d => { out += d.toString(); });
      child.stderr?.on('data', d => { err += d.toString(); });
      child.on('error', e => resolve({ ok: false, error: e.message }));
      child.on('exit', code => resolve({ ok: code === 0, exitCode: code, stdout: out.slice(-4000), stderr: err.slice(-2000) }));
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

app.get('/api/control-panel/status', (req, res) => {
  const dataSize = (() => {
    try {
      let total = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else { try { total += fs.statSync(p).size; } catch { /* ignore */ } }
        }
      };
      if (fs.existsSync(DATA_DIR)) walk(DATA_DIR);
      return total;
    } catch { return 0; }
  })();
  // Port is bound in startServer() below; read it back from the socket
  // address at request time rather than relying on a module-level const
  // that doesn't exist. Falls back to the persisted preference for the
  // edge case where the request arrives before activeServer is set.
  let activePort = STARTING_PORT;
  try {
    const addr = activeServer && activeServer.address();
    if (addr && typeof addr === 'object' && addr.port) activePort = addr.port;
  } catch { /* keep fallback */ }
  res.json({
    platform: process.platform,
    node: process.version,
    controlScriptsAvailable: !!controlScriptDir,
    actions: controlActions(),
    dataFolder: DATA_DIR,
    dataSizeBytes: dataSize,
    port: activePort,
    launcherType: controlScriptDir ? (isWindows ? 'hta' : (isMac ? 'command' : 'sh')) : 'none',
    canRemove: path.basename(__dirname) === '_system' && !!pickScript('uninstall'),
    appFolder: path.dirname(__dirname),
    installKind: INSTALL_KIND || 'zip',
    // v1.10.84 - installed by the Windows Setup: removed from Windows' Apps list.
    installed: INSTALLED,
    booksFolder: APP_HOME,
  });
});

app.post('/api/control-panel/backup', async (req, res) => {
  const script = pickScript('backup');
  const result = await runControlScript(script);
  res.json(result);
});

// v1.10.84 - a Windows Setup copy is removed like other programs: this opens
// Windows' Settings -> Apps -> Installed apps (the Control Panel's Remove card).
app.post('/api/control-panel/open-apps-settings', (req, res) => {
  if (!isWindows) return res.json({ ok: false, error: 'Only on Windows.' });
  try {
    spawn('explorer.exe', ['ms-settings:appsfeatures'], { detached: true }).unref();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/open-data-folder', (req, res) => {
  try {
    if (isWindows) spawn('explorer.exe', [DATA_DIR], { detached: true }).unref();
    else if (isMac) spawn('open', [DATA_DIR], { detached: true }).unref();
    else spawn('xdg-open', [DATA_DIR], { detached: true }).unref();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/open-backups-folder', (req, res) => {
  const backupsHome = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'FreeGSTBill Backups');
  try {
    if (!fs.existsSync(backupsHome)) makeDir(backupsHome);
    if (isWindows) spawn('explorer.exe', [backupsHome], { detached: true }).unref();
    else if (isMac) spawn('open', [backupsHome], { detached: true }).unref();
    else spawn('xdg-open', [backupsHome], { detached: true }).unref();
    res.json({ ok: true, path: backupsHome });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// v1.10.84 - a copy installed by the Windows Setup updates like other
// programs: the new Setup is downloaded from the GitHub release and run
// silently. It stops this server, replaces the program files (home.txt and
// the books are not among them) and starts the app again; the page waits for
// the new version and reloads (runUpdateNow in src/store.js). If the Setup
// fails, it starts the version that was there again and the page says so,
// with the Setup's log. The ZIP's
// update-windows.ps1 is never used for an installed copy (it is not even
// installed), and this is never used for a ZIP copy (no installed.txt).
// Follows redirects by hand so that every hop is https and on GitHub's
// release hosts (src/utils/setupDownload.js), never anywhere else.
async function fetchFromGitHub(url, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 6; hop += 1) {
    if (!allowedDownloadUrl(url)) throw new Error('The download was sent to a site that is not GitHub. Nothing was run.');
    const res = await fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'FreeGSTBill-updater' } });
    if (res.status < 300 || res.status >= 400) return res;
    url = new URL(res.headers.get('location') || '', url).href;
  }
  throw new Error('Too many redirects.');
}

async function updateWithSetup() {
  // The Setup of the last update cannot delete itself: tidy those up first.
  for (const old of fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('fgsb-update-'))) {
    try { fs.rmSync(path.join(os.tmpdir(), old), { recursive: true, force: true }); } catch { /* in use */ }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-update-'));
  const exe = path.join(dir, SETUP_NAME);
  let checked = 'test mode (a local file)';
  if (INSTALL_TEST_ROOT) {
    // The Setup's test mode: the new Setup is a file in the test folder, so the
    // whole update can be tried without publishing a release.
    fs.copyFileSync(path.join(INSTALL_TEST_ROOT, SETUP_NAME), exe);
  } else {
    let asset;
    try {
      const rel = await fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
        signal: AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FreeGSTBill-updater' },
      });
      asset = rel.ok ? setupAssetFrom(await rel.json()) : null;
    } catch {
      throw new Error('GitHub could not be reached. Check the internet connection and try again.');
    }
    if (!asset) throw new Error(`The new version's Setup is not on GitHub yet. Try again later, or download ${SETUP_NAME} from the Releases page.`);
    let res;
    try { res = await fetchFromGitHub(asset.url, 15 * 60 * 1000); } catch (e) {
      throw new Error(e.message.startsWith('The download') ? e.message : 'The new version could not be downloaded. Check the internet connection and try again.');
    }
    if (!res.ok) throw new Error(`The download failed (${res.status}). Try again later.`);
    const buf = Buffer.from(await res.arrayBuffer());
    const check = checkSetupBytes(buf, asset);
    if (!check.ok) throw new Error(`${check.problem} Nothing was run; try again later.`);
    checked = check.checked;
    fs.writeFileSync(exe, buf);
  }
  const log = path.join(dir, 'setup.log');
  fs.writeFileSync(path.join(dir, 'checked.txt'), `Checked before running: ${checked}\r\n`);
  const args = ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/LOG=${log}`];
  if (INSTALL_TEST_ROOT) args.push(`/TESTROOT=${INSTALL_TEST_ROOT}`);
  // Detached: the Setup stops this server and must carry on without it.
  spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return { log, checked };
}

app.post('/api/control-panel/launch-script', async (req, res) => {
  // Whitelisted script actions the Control Panel exposes.
  const allowed = new Set(['update', 'restore', 'move', 'stop']);
  const action = String(req.body?.action || '');
  if (!allowed.has(action)) { res.status(400).json({ ok: false, error: 'Unknown action' }); return; }
  if (action === 'stop' && !isWindows) {
    // Answer first, then exit, so the page can say it stopped.
    res.json({ ok: true, stdout: 'Stopped. Open the app again from its icon or launcher.' });
    setTimeout(() => process.exit(0), 400);
    return;
  }
  if (action === 'update' && INSTALLED) {
    try {
      const { log, checked } = await updateWithSetup();
      res.json({ ok: true, installer: true, version: pkg.version, log, checked, stdout: 'The new version is installing. The app restarts by itself in about a minute.' });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
    return;
  }
  if (action === 'update' && updateHint()) { res.json({ ok: false, error: updateHint() }); return; }
  const script = pickScript(action);
  const result = await runControlScript(script);
  res.json(result);
});

// v1.10.83 - Restart from the Control Panel ("if something is not working").
// A new copy is started with --after-pid and waits for this one to exit, so
// it gets the same port back. On Windows it is started through WMI, so it is
// not inside this process's job and survives this process exiting.
app.post('/api/control-panel/restart', (req, res) => {
  const serverJs = path.join(__dirname, 'server.js');
  try {
    if (isWindows) {
      const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
      const cmd = `"${process.execPath}" "${serverJs}" --after-pid ${process.pid}`;
      const ps = `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; `
        + `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${q(cmd)}; CurrentDirectory = ${q(__dirname)}; ProcessStartupInformation = $si }; `
        + `exit $r.ReturnValue`;
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
      child.on('error', e => { if (!res.headersSent) res.json({ ok: false, error: e.message }); });
      child.on('exit', code => {
        if (res.headersSent) return;
        if (code !== 0) { res.json({ ok: false, error: `Could not start a new copy (code ${code}). Close the app and open it again from its icon.` }); return; }
        res.json({ ok: true });
        setTimeout(() => process.exit(0), 400);
      });
    } else {
      spawn(process.execPath, [serverJs, '--after-pid', String(process.pid)], { cwd: __dirname, detached: true, stdio: 'ignore' }).unref();
      res.json({ ok: true });
      setTimeout(() => process.exit(0), 400);
    }
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// v1.10.83 - Remove the app, with the user choosing what goes. The program
// and its icons always go; data, saved PDFs and the backups folder only when
// ticked. The script runs from a temp copy, waits for this server to exit
// (node.exe locks its own folder on Windows), then deletes. Only an installed
// copy (_system/) can be removed: in the source repo this would delete the repo.
app.post('/api/control-panel/uninstall', async (req, res) => {
  const { data, pdfs, backups, confirm } = req.body || {};
  if (confirm !== 'REMOVE') { res.status(400).json({ ok: false, error: 'Not confirmed' }); return; }
  const script = pickScript('uninstall');
  if (path.basename(__dirname) !== '_system' || !script) {
    res.json({ ok: false, error: 'Remove works only in the installed app (the folder with _system in it).' });
    return;
  }
  try {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-remove-')), path.basename(script));
    fs.copyFileSync(script, tmp);
    const [cmd, args] = isWindows
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', tmp,
        '-Sys', __dirname, '-ServerPid', String(process.pid),
        ...(data ? ['-Data'] : []), ...(pdfs ? ['-Pdfs'] : []), ...(backups ? ['-Backups'] : [])]]
      : ['sh', [tmp, __dirname, String(process.pid), data ? 'data' : '', pdfs ? 'pdfs' : '', backups ? 'backups' : '']];
    // Windows: the script hands itself to WMI and exits, so wait for that and
    // stay running if it failed. Unix: a detached child outlives the server.
    const child = spawn(cmd, args, { detached: !isWindows, stdio: 'ignore', windowsHide: true });
    if (isWindows) {
      const code = await new Promise(resolve => { child.on('exit', resolve); child.on('error', () => resolve(-1)); });
      if (code !== 0) { res.json({ ok: false, error: `Could not start the remove step (code ${code}). Nothing was removed.` }); return; }
    } else child.unref();
  } catch (e) {
    res.json({ ok: false, error: e.message });
    return;
  }
  res.json({ ok: true, kept: !data || !pdfs ? __dirname : null });
  setTimeout(() => process.exit(0), 400);
});

// ========================
// Serve production build
// ========================
// We register BOTH the static middleware and the SPA catch-all unconditionally.
// The static middleware silently no-ops when dist/ doesn't exist; the catch-all
// then checks per-request and serves either index.html (build ready) or the
// friendly "still building" page (build not ready). This means the server can
// start before `vite build` finishes — common in StackBlitz, Codespaces, or
// when a user accidentally runs `node server.js` directly — and seamlessly
// flips to serving the app the moment dist/ appears.
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath, { fallthrough: true })); // fallthrough = ok if dist doesn't exist

// ============================================================
// v1.9.5 — Automatic daily backup + retention (keep last 30 days).
// MUST be registered BEFORE the SPA catch-all below, otherwise
// GET /api/backups and GET /api/trash get swallowed by the catch-all
// and return 404. Bug discovered by smoke test after v1.9.5 shipped.
// ============================================================
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const BILL_TRASH_DIR = path.join(DATA_DIR, 'trash');
function ensureDir(p) { if (!fs.existsSync(p)) makeDir(p); }

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(dst)) makeDir(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

// v1.10.0 — Local-timezone date, not UTC. Previous code used
// `new Date().toISOString().split('T')[0]` which flips at midnight UTC
// (05:30 IST) — an IST reboot at 05:29 vs 05:31 IST computed different
// "today" values → duplicate backup dirs or a skipped calendar day.
// Uses the sv-SE locale hack for guaranteed YYYY-MM-DD output.
function todayLocalIso() {
  return new Date().toLocaleDateString('sv-SE');
}

// v1.10.80 (#99) - a second copy of every daily backup in a folder the user
// picks (another drive, a USB disk, a synced folder), so a failed C: drive does
// not take the backups with it. Stored in meta.json as `backupFolder`; the
// copies go in "<folder>/FreeGSTBill Backups/<date>", 30 days kept, and are
// listed and restorable like the ones in data/backups.
const BACKUP_FOLDER_KEY = 'backupFolder';
const EXTRA_BACKUP_SUBDIR = 'FreeGSTBill Backups';
const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;
const extraBackupsDir = () => {
  const folder = readJSON(META_PATH, {})[BACKUP_FOLDER_KEY];
  return typeof folder === 'string' && folder.trim() && path.isAbsolute(folder.trim())
    ? path.join(folder.trim(), EXTRA_BACKUP_SUBDIR) : null;
};
let lastExtraBackupError = '';
// v1.10.81 - which install made each copy: "<date>.from" next to it holds this
// install's id (beside, not inside: a restore copies everything inside a
// dated folder into data/). Two PCs pointed at one synced folder used to skip
// each other's dates silently, so one PC was never backed up and a restore
// could bring back the other PC's books. Now that is reported instead.
const installId = () => {
  const meta = readJSON(META_PATH, {});
  if (typeof meta.installId === 'string' && meta.installId) return meta.installId;
  const id = crypto.randomUUID();
  writeJSON(META_PATH, { ...meta, installId: id });
  return id;
};
const exists = (p) => fs.promises.access(p).then(() => true, () => false);
async function copyDirAsync(src, dst) {
  await makeDirAsync(dst);
  for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDirAsync(s, d);
    else await fs.promises.copyFile(s, d);
  }
}
// Async on purpose: the folder can be a network or USB drive, and a
// disconnected one made the synchronous calls hang the whole server.
let extraCopyRunning = false;
async function copyBackupToExtraFolder(date) {
  const dir = extraBackupsDir();
  if (!dir || extraCopyRunning) return;
  extraCopyRunning = true;
  try {
    const src = path.join(BACKUPS_DIR, date);
    const dst = path.join(dir, date);
    const fromFile = path.join(dir, `${date}.from`);
    if (!(await exists(src))) return;
    const me = installId();
    if (await exists(dst)) {
      const owner = (await fs.promises.readFile(fromFile, 'utf8').catch(() => '')).trim();
      // No owner: a copy from v1.10.80, made by this install.
      lastExtraBackupError = !owner || owner === me ? ''
        : 'This folder also gets backups from another computer. Give each computer its own backup folder, or their backups mix.';
      return;
    }
    await makeDirAsync(dir);
    // Copied under a temporary name and renamed, so a half-copied folder (disk
    // removed mid-copy) never looks like a complete backup.
    const tmp = `${dst}.partial`;
    await fs.promises.rm(tmp, { recursive: true, force: true });
    await copyDirAsync(src, tmp);
    await fs.promises.rename(tmp, dst);
    await fs.promises.writeFile(fromFile, me);
    const all = (await fs.promises.readdir(dir)).filter(n => DATE_DIR.test(n)).sort();
    while (all.length > 30) {
      const old = all.shift();
      await fs.promises.rm(path.join(dir, old), { recursive: true, force: true });
      await fs.promises.rm(path.join(dir, `${old}.from`), { force: true });
    }
    lastExtraBackupError = '';
    console.log(`[backup] Copy saved: ${dst}`);
  } catch (err) {
    // Shown as is in Settings, so a whole sentence.
    lastExtraBackupError = `The last copy to the backup folder failed (${err.code || err.message}). Is the drive connected and not full?`;
    console.warn('[backup] Copy to the backup folder failed:', err.message || err);
  } finally {
    extraCopyRunning = false;
  }
}
// Where a dated backup is: data/backups, else the extra folder (e.g. after a
// reinstall, when only the copy on D: is left).
function backupSourceDir(date) {
  const local = path.join(BACKUPS_DIR, date);
  if (fs.existsSync(local)) return local;
  const dir = extraBackupsDir();
  const extra = dir ? path.join(dir, date) : null;
  return extra && fs.existsSync(extra) ? extra : local;
}

function runDailyBackup() {
  try {
    ensureDir(BACKUPS_DIR);
    const today = todayLocalIso();
    const target = path.join(BACKUPS_DIR, today);
    // Returns the copy's promise, so POST /api/backup-folder can report it.
    if (fs.existsSync(target)) return copyBackupToExtraFolder(today);
    ensureDir(target);
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      // v1.10.31 — Data-F7.1: `trash` is now INCLUDED in daily backups.
      // Previously excluded → users restoring last week's backup lost every
      // bill they'd trashed since, breaking the 30-day soft-delete promise.
      // We still skip `backups` (no recursion) and log files.
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt' || entry.name === LOCK_NAME) continue;
      const src = path.join(DATA_DIR, entry.name);
      const dst = path.join(target, entry.name);
      if (entry.isDirectory()) copyDirRecursive(src, dst);
      else fs.copyFileSync(src, dst);
    }
    console.log(`[backup] Daily snapshot saved: ${target}`);
    const copied = copyBackupToExtraFolder(today);
    const all = fs.readdirSync(BACKUPS_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    while (all.length > 30) {
      const oldest = all.shift();
      const oldestPath = path.join(BACKUPS_DIR, oldest);
      try { fs.rmSync(oldestPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    return copied;
  } catch (err) {
    console.warn('[backup] Daily backup failed:', err.message);
  }
}

setTimeout(runDailyBackup, 5000);
// Checked every hour (it does nothing once today's backup exists), so a PC
// left on overnight gets the new day's backup soon after midnight rather
// than up to 24 hours later.
setInterval(runDailyBackup, 60 * 60 * 1000);

// Backup management endpoints
app.get('/api/backups', (req, res) => {
  try {
    ensureDir(BACKUPS_DIR);
    const dates = new Set(fs.readdirSync(BACKUPS_DIR).filter(n => DATE_DIR.test(n)));
    // Backups that exist only in the extra folder are listed too (marked).
    const extra = extraBackupsDir();
    const extraDates = new Set();
    try { if (extra && fs.existsSync(extra)) for (const n of fs.readdirSync(extra)) if (DATE_DIR.test(n)) extraDates.add(n); } catch { /* folder offline */ }
    const list = [...new Set([...dates, ...extraDates])]
      .sort().reverse()
      .map(name => {
        const stat = fs.statSync(backupSourceDir(name));
        return { date: name, createdAt: stat.mtime.toISOString(), inBackupFolder: extraDates.has(name), onlyInBackupFolder: !dates.has(name) };
      });
    res.json(list);
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

// v1.10.22 — Manual delete of a specific dated backup. Reported: "add
// here delete option i know u added 30 days auto delete but manual delete
// also u add". Guarded by the same path-inside + calendar-date checks the
// restore endpoint uses so a crafted `:date` cannot escape BACKUPS_DIR.
app.delete('/api/backups/:date', (req, res) => {
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errRes(res, 400, 'bad-request');
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
      return errRes(res, 400, 'bad-request');
    }
    const backupDir = path.join(BACKUPS_DIR, date);
    if (!isPathInside(backupDir, BACKUPS_DIR)) return errRes(res, 400, 'invalid-path');
    if (!fs.existsSync(backupDir)) return errRes(res, 404, 'not-found');
    fs.rmSync(backupDir, { recursive: true, force: true });
    res.json({ success: true, date });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.post('/api/backups/:date/restore', (req, res) => {
  // v1.10.0 — Transactional restore. Prior implementation
  // `fs.rmSync(dst)` -> `copyDirRecursive(src, dst)`. If copy threw
  // partway (ENOSPC, EACCES, half-corrupted backup), the user's live
  // data was already gone and only a partial restore existed. Now: we
  // rename the current directories to a "pre-restore-<timestamp>"
  // snapshot inside BACKUPS_DIR, do the copy, and only rmSync the
  // snapshot on success. If anything throws, we rename the snapshot
  // back — user is back where they started.
  let snapshotDir = null;
  const restoredDirs = [];
  try {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errRes(res, 400, 'bad-request');
    const backupDir = backupSourceDir(date);
    if (!isPathInside(path.join(BACKUPS_DIR, date), BACKUPS_DIR)) return errRes(res, 400, 'invalid-path');
    if (!fs.existsSync(backupDir)) return errRes(res, 404, 'not-found');

    // Additional date sanity — a directory can exist with an unrealistic
    // date planted before hardening. Reject impossible calendar dates.
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
      return errRes(res, 400, 'bad-request');
    }

    // The PIN on this PC survives the restore (see withLock), and so does the
    // backup folder setting (the backup may be older than it).
    const lockBefore = readJSON(META_PATH, {})[LOCK_KEY];
    const backupFolderBefore = readJSON(META_PATH, {})[BACKUP_FOLDER_KEY];

    // Make a snapshot of live data before touching anything.
    snapshotDir = path.join(BACKUPS_DIR, `pre-restore-${Date.now()}`);
    ensureDir(snapshotDir);
    const liveEntries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of liveEntries) {
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt' || entry.name === LOCK_NAME) continue;
      const src = path.join(DATA_DIR, entry.name);
      const dst = path.join(snapshotDir, entry.name);
      if (entry.isDirectory()) copyDirRecursive(src, dst);
      else fs.copyFileSync(src, dst);
    }

    // Now do the restore. Track what we replaced so rollback knows
    // which dirs to nuke first.
    const backupEntries = fs.readdirSync(backupDir, { withFileTypes: true });
    for (const entry of backupEntries) {
      const src = path.join(backupDir, entry.name);
      const dst = path.join(DATA_DIR, entry.name);
      if (!isPathInside(dst, DATA_DIR)) continue;
      if (entry.isDirectory()) {
        if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
        copyDirRecursive(src, dst);
      } else {
        fs.copyFileSync(src, dst);
      }
      restoredDirs.push(entry.name);
    }
    {
      const restoredMeta = withLock(readJSON(META_PATH, {}), lockBefore);
      if (backupFolderBefore) restoredMeta[BACKUP_FOLDER_KEY] = backupFolderBefore;
      else delete restoredMeta[BACKUP_FOLDER_KEY];
      writeJSON(META_PATH, restoredMeta);
    }
    for (const dir of DIRS) invalidateCache(dir);

    // Success. The pre-restore snapshot is KEPT: it is the only copy of the
    // data as it was a moment ago (today's daily backup was taken at
    // start-up, before today's work), and the app promises it can be rolled
    // back. Only the 5 newest snapshots are kept.
    try {
      const snaps = fs.readdirSync(BACKUPS_DIR).filter(n => /^pre-restore-\d+$/.test(n)).sort((x, y) => Number(x.slice(12)) - Number(y.slice(12)));
      while (snaps.length > 5) fs.rmSync(path.join(BACKUPS_DIR, snaps.shift()), { recursive: true, force: true });
    } catch { /* pruning is best-effort */ }
    res.json({ success: true, restored: date, snapshot: path.basename(snapshotDir) });
  } catch (err) {
    // Rollback: put the snapshot back over whatever the restore
    // half-did. This preserves user data at the cost of losing the
    // partial restore (which was probably corrupt anyway).
    if (snapshotDir && fs.existsSync(snapshotDir)) {
      try {
        for (const name of restoredDirs) {
          const dst = path.join(DATA_DIR, name);
          if (!isPathInside(dst, DATA_DIR)) continue;
          if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
          const snap = path.join(snapshotDir, name);
          if (fs.existsSync(snap)) {
            if (fs.statSync(snap).isDirectory()) copyDirRecursive(snap, dst);
            else fs.copyFileSync(snap, dst);
          }
        }
      } catch { /* if rollback fails, snapshot stays on disk for manual recovery */ }
    }
    for (const dir of DIRS) invalidateCache(dir);
    errRes(res, 500, 'server-error', err);
  }
});

// v1.10.6 — audit L11: throttle. Prior code let any caller spam this
// endpoint and each hit walked the whole data tree + 30-day pruning.
// The `if (fs.existsSync(target)) return` inside runDailyBackup makes
// this idempotent per day, but the fs walks still happen. Now: at most
// one call per 5 seconds; excess return 429 with a hint.
// v1.10.80 (#99) - the extra backup folder. GET says where it is and whether
// the last copy worked; POST { path } sets it ('' turns it off). The folder
// is created and test-written before it is accepted.
app.get('/api/backup-folder', (req, res) => {
  const folder = readJSON(META_PATH, {})[BACKUP_FOLDER_KEY] || '';
  res.json({ path: folder, copiesIn: extraBackupsDir(), error: lastExtraBackupError });
});
app.post('/api/backup-folder', async (req, res) => {
  const raw = String(req.body?.path ?? '').trim();
  const meta = readJSON(META_PATH, {});
  if (!raw) {
    delete meta[BACKUP_FOLDER_KEY];
    writeJSON(META_PATH, meta);
    lastExtraBackupError = '';
    return res.json({ ok: true, path: '' });
  }
  if (!path.isAbsolute(raw)) return res.status(400).json({ ok: false, error: 'Give the full folder path, for example D:\\Backups' });
  const dir = path.join(raw, EXTRA_BACKUP_SUBDIR);
  if (isPathInside(dir, DATA_DIR)) return res.status(400).json({ ok: false, error: 'Choose a folder outside the app\'s data folder.' });
  try {
    ensureDir(dir);
    const probe = path.join(dir, `.write-test-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (err) {
    return res.status(400).json({ ok: false, error: `Cannot write to that folder: ${err.code || err.message}` });
  }
  meta[BACKUP_FOLDER_KEY] = raw;
  writeJSON(META_PATH, meta);
  await runDailyBackup(); // copies today's backup there now
  return res.json({ ok: !lastExtraBackupError, path: raw, copiesIn: dir, error: lastExtraBackupError });
});

let __lastBackupNowMs = 0;
app.post('/api/backups/now', (req, res) => {
  const now = Date.now();
  if (now - __lastBackupNowMs < 5000) {
    return errRes(res, 429, 'server-error');
  }
  __lastBackupNowMs = now;
  runDailyBackup();
  res.json({ success: true });
});

// ---- Trash bin (soft delete for invoices) ---------------------------------
ensureDir(BILL_TRASH_DIR);

app.get('/api/trash', (req, res) => {
  try {
    ensureDir(BILL_TRASH_DIR);
    const files = fs.readdirSync(BILL_TRASH_DIR)
      .filter(n => n.endsWith('.json'))
      .map(name => {
        try {
          const p = path.join(BILL_TRASH_DIR, name);
          const bill = readJSON(p, null);
          const stat = fs.statSync(p);
          return bill ? { ...bill, _trashedAt: stat.mtime.toISOString() } : null;
        } catch { return null; }
      })
      .filter(Boolean);
    res.json(files);
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.post('/api/trash/:id/restore', (req, res) => {
  try {
    const fname = safeFileName(req.params.id) + '.json';
    const trashPath = path.join(BILL_TRASH_DIR, fname);
    const billsPath = path.join(DATA_DIR, 'bills', fname);
    if (!fs.existsSync(trashPath)) return res.status(404).json({ error: 'Not in trash' });
    // A new bill may have taken this number since: never replace it.
    if (fs.existsSync(billsPath)) return res.status(409).json({ error: 'An invoice with this number exists again. Rename or delete it first.' });
    fs.renameSync(trashPath, billsPath);
    invalidateCache('bills');
    res.json({ success: true });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

app.delete('/api/trash/:id', (req, res) => {
  try {
    const fname = safeFileName(req.params.id) + '.json';
    const trashPath = path.join(BILL_TRASH_DIR, fname);
    if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
    res.json({ success: true });
  } catch (err) { errRes(res, 500, 'server-error', err); }
});

function purgeOldTrash() {
  try {
    ensureDir(BILL_TRASH_DIR);
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(BILL_TRASH_DIR)) {
      const p = path.join(BILL_TRASH_DIR, name);
      const stat = fs.statSync(p);
      if (now - stat.mtime.getTime() > thirtyDays) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}
// Also once at start-up: the server usually runs only while the PC is on, so
// a 24-hour timer alone never fired and the trash was never emptied.
setTimeout(purgeOldTrash, 10000);
setInterval(purgeOldTrash, 24 * 60 * 60 * 1000);

// v1.10.0 — Health-check endpoint moved here (was registered AFTER the
// SPA catch-all → every GET /api/health returned "No such endpoint" →
// the UI's health-banner was permanently broken). Now registered
// before the catch-all so it actually serves.
app.get('/api/health', (req, res) => {
  let errorsTail = '';
  try {
    if (fs.existsSync(ERRORS_LOG)) {
      const stat = fs.statSync(ERRORS_LOG);
      // Read the last 4KB only so a runaway log file can't OOM the response.
      const fd = fs.openSync(ERRORS_LOG, 'r');
      const len = Math.min(stat.size, 4096);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, Math.max(0, stat.size - len));
      fs.closeSync(fd);
      errorsTail = buf.toString('utf-8');
    }
  } catch { /* ignore */ }
  res.json({
    ok: true,
    version: process.env.npm_package_version || 'unknown',
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    hasRecentErrors: !!errorsTail.trim(),
    errorsTail,
  });
});

app.get('{*path}', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
  // v1.10.83 - a code or style file that is not here (an old version's, still
  // asked for by a page from before an update) is a 404, not the app's page:
  // the page sent as "JavaScript" broke the app with a blank screen, and the
  // offline cache could keep that page under the code file's name.
  if (req.path.startsWith('/assets/') || /\.(m?js|css|map|wasm|json|png|svg|ico|woff2?)$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Build not ready yet — serve friendly waiting page (auto-refreshes every 3s).
  return servePlaceholder(req, res);
});

function servePlaceholder(req, res) {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
    res.status(503).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Free GST Billing Software — building…</title>
<meta http-equiv="refresh" content="3">
<style>
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; max-width: 560px;
         margin: 6rem auto; padding: 2rem; color: #1e293b; line-height: 1.55; }
  h1 { color: #1e40af; margin: 0 0 0.5rem; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #cbd5e1;
             border-top-color: #1e40af; border-radius: 50%; animation: spin 1s linear infinite;
             vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .muted { color: #64748b; font-size: 0.9em; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: 8px; margin-top: 1rem; }
</style></head>
<body>
  <h1>Free GST Billing Software</h1>
  <p><span class="spinner"></span> The app is still building. This page refreshes every 3 seconds.</p>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>Local install?</strong></p>
    <p style="margin:0">If you started the server but never built the frontend, run:</p>
    <p style="margin:0.5rem 0 0"><code>npm run build</code></p>
    <p class="muted" style="margin:0.5rem 0 0">…then reload this page.</p>
  </div>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>StackBlitz / Codespaces?</strong></p>
    <p style="margin:0">First-time build takes ~30 seconds inside browser sandboxes. Sit tight.</p>
  </div>
  <p class="muted" style="margin-top:1.5rem">Server is running on port ${req.socket.localPort} · API health: <a href="/api/version">/api/version</a></p>
</body></html>`);
}

// v1.10.0 — Global error handler. Registered LAST so all preceding
// route handlers can forward errors to it. Express 5 auto-catches
// synchronous throws and async rejections from route handlers, so we
// no longer need try/catch around every writeJSON call. Server-side
// logs full detail; client sees a generic JSON error with a stable
// code — no leaked stack traces or absolute filesystem paths.
// Preserves upstream status codes from body-parser (413 payload too
// large, 400 malformed JSON) so clients can differentiate.
// 4-arg signature is required by Express
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number(err && (err.status || err.statusCode)) || 500;
  let code = 'server-error';
  if (status === 413) code = 'payload-too-large';
  else if (status === 400) code = 'bad-request';
  else if (status === 404) code = 'not-found';
  errRes(res, status, code, err);
});

// ============================================================
// Error log + graceful shutdown
// ============================================================
// ERRORS_LOG was declared once at the top of this file (v1.10.0)
// where errRes() needs it. See line ~145.

// v1.10.0 — log rotation. Previously `data/errors.log` grew unbounded;
// a tight failure loop (e.g. daily backup hitting a corrupted template)
// would fill the disk. Now we keep only the last ~200KB. Called
// opportunistically from logFatal — no separate timer.
const ERRORS_LOG_MAX = 200 * 1024;
function rotateErrorsIfLarge() {
  try {
    if (!fs.existsSync(ERRORS_LOG)) return;
    const stat = fs.statSync(ERRORS_LOG);
    if (stat.size <= ERRORS_LOG_MAX) return;
    // Read the tail we want to keep, then rewrite atomically.
    const fd = fs.openSync(ERRORS_LOG, 'r');
    const keep = Buffer.alloc(ERRORS_LOG_MAX);
    fs.readSync(fd, keep, 0, ERRORS_LOG_MAX, stat.size - ERRORS_LOG_MAX);
    fs.closeSync(fd);
    // Trim to next newline so we don't leave a half-line at the top.
    const s = keep.toString('utf-8');
    const nl = s.indexOf('\n');
    writeFileAtomic(ERRORS_LOG, (nl >= 0 ? s.slice(nl + 1) : s));
  } catch { /* ignore */ }
}

function logFatal(err, source = 'fatal') {
  try {
    rotateErrorsIfLarge();
    const ts = new Date().toISOString();
    const msg = err && err.stack ? err.stack : String(err);
    fs.appendFileSync(ERRORS_LOG, `[${ts}] [${source}] ${msg}\n`, 'utf-8');
  } catch { /* nothing we can do if even appending fails */ }
}

// Last-resort handlers — log the error but do NOT call process.exit so the
// running server keeps serving healthy requests. Per Node best-practice,
// uncaughtException leaves the process in an unknown state, so we write the
// log and let the OS / a wrapper script decide whether to restart.
// v1.10.83 - and say so in the console window, not only in the file.
process.on('uncaughtException', (err) => { console.error(`  Unexpected error (the app keeps running): ${err?.message || err}`); logFatal(err, 'uncaughtException'); });
process.on('unhandledRejection', (err) => { console.error(`  Unexpected error (the app keeps running): ${err?.message || err}`); logFatal(err, 'unhandledRejection'); });

// Note: /api/health used to live below the SPA catch-all here, so the
// catch-all was swallowing every request to it and returning "No such
// endpoint". Moved above the catch-all in v1.10.0. See earlier in file.

// Try ports starting from STARTING_PORT (persisted preference) until one is available.
// Bound to 127.0.0.1 explicitly so the server can NEVER be reached from the LAN —
// every byte stays on the user's machine, which the privacy promise depends on.
// FGSB_ALLOW_UNSAFE_LAN=1 is for the Docker image only: a container's
// 127.0.0.1 cannot be reached through a port mapping, so it listens on every
// address INSIDE the container, and docker-compose.yml publishes the port to
// the NAS's own 127.0.0.1. There is no login yet, so never set it elsewhere.
const LISTEN_HOST = process.env.FGSB_ALLOW_UNSAFE_LAN === '1' ? '0.0.0.0' : '127.0.0.1';
let activeServer = null;
function startServer(port) {
  // v1.10.84 - Express 5 calls this callback with the error too (a busy
  // port): then it is not listening, and the 'error' handler below moves on
  // to the next port. Before, the busy port was written to port.txt first.
  const server = app.listen(port, LISTEN_HOST, (listenErr) => {
    if (listenErr) return;
    activeServer = server;
    // Persist the chosen port — the .bat launcher reads this for the browser URL.
    // Writing on EVERY successful boot means: if our preferred 47371 was busy and
    // we landed on 47372 instead, next launch tries 47372 first (cuts collision
    // scans in half on repeated reboots of whatever was holding 47371).
    try { fs.writeFileSync(PORT_FILE, String(port), 'utf-8'); } catch { /* ignore */ }
    // v1.10.84 - the lock now says where this server answers.
    writeLock(LOCK_FILE, { pid: process.pid, port: server.address().port, at: Date.now(), host: LOCK_HOST, id: LOCK_ID });
    console.log(`\n  Free GST Billing Software running at http://localhost:${port}`);
    console.log(`  Data stored in: ${DATA_DIR}\n`);
  });
  server.on('error', (err) => {
    // v1.10.83 - EACCES too: Windows reserves port ranges for Hyper-V / WSL
    // and refuses them with "access denied" rather than "in use".
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && port !== 0 && port < STARTING_PORT + MAX_PORT_SCAN) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && port !== 0) {
      // We've exhausted the scan range. Tell the OS to pick anything free — at
      // this point the user has 50+ apps fighting for the 47371-47421 range,
      // which we treat as "do whatever works" rather than failing to start.
      console.warn(`  Scanned ${MAX_PORT_SCAN} ports from ${STARTING_PORT} — letting OS assign a free one.`);
      startServer(0);
    } else {
      console.error(`  Failed to start server: ${err.message}`);
      // Persist the failure so the user has a breadcrumb when the silent
      // launcher exits without any visible window.
      logFatal(err, 'startup');
      process.exit(1);
    }
  });
}

// Graceful shutdown — the launcher's Stop Server runs taskkill /f, which can
// interrupt a sync write mid-flight. SIGINT (Ctrl+C in foreground) and SIGTERM
// (clean kill) get a 3-second window to flush.
function gracefulShutdown(signal) {
  console.log(`\n  Received ${signal}, closing connections...`);
  if (!activeServer) { process.exit(0); return; }
  const force = setTimeout(() => {
    console.warn('  Force-exiting after 3s grace period');
    process.exit(1);
  }, 3000);
  force.unref();
  activeServer.close(() => {
    clearTimeout(force);
    console.log('  Server closed cleanly.');
    process.exit(0);
  });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =====================================================
// Recurring invoices — auto-fire on boot + daily interval
// =====================================================
// For every recurring template with `nextDate <= today` and `active === true`,
// generate a new invoice (with a fresh sequential number for the matching
// type prefix and today's date) and advance the template's `nextDate` by its
// frequency. Honours `endMode` so weekly-for-12-weeks contracts stop themselves.
//
// Why server-side (and not in the React app): if the user opens the app on
// the 5th but the template was due on the 1st, the missed-cycle invoice still
// fires here. The frontend would only see it if the user happened to open the
// app between firings — fragile.
//
// Why no Windows scheduled task (yet): the server starts on every Windows
// login via the Startup-folder shortcut, so booting your PC = a check.
// Long-uptime users get a daily `setInterval` below as a backstop.
// Calendar arithmetic on YYYY-MM-DD, done in UTC so the machine's time zone
// can never move the date. (It used to parse the date as UTC, step it in
// local time and print it as UTC again: a day off west of Greenwich.)
const isoDay = (d) => d.toISOString().split('T')[0];
function parseIsoDay(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}
function addDays(dateStr, days) {
  const d = parseIsoDay(dateStr);
  if (!d) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}
// Monthly / quarterly / yearly steps keep the day of month the schedule
// started on (`anchorDay`), clamped to short months: 31 Jan -> 28 Feb ->
// 31 Mar. setMonth() overflowed instead (31 Jan + 1 month = 3 Mar, so
// February was skipped and every later date drifted).
function advanceDate(dateStr, frequency, interval, anchorDay) {
  const d = parseIsoDay(dateStr);
  if (!d) return dateStr;
  const n = Math.max(1, parseInt(interval, 10) || 1);
  if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * n);
    return isoDay(d);
  }
  const months = frequency === 'quarterly' ? 3 * n : frequency === 'yearly' ? 12 * n : n; // default: monthly
  const day = Math.min(31, Math.max(1, parseInt(anchorDay, 10) || d.getUTCDate()));
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDay(target);
}

function nextInvoiceNumber(prefix, invoiceType = 'tax-invoice', businessKey = '') {
  // The same rules as the app's getNextInvoiceNumber (src/utils.js): the
  // business's own series when it has one (v1.10.79, #95), else the shared
  // one; atomic counter in meta; brand-TYPE prefixes; India's FY label.
  const meta = readJSON(META_PATH, {});
  const series = numberSeriesFor(meta.invoiceNumberSettings, meta.invoiceNumberSeries, businessKey);
  const key = counterKeyFor(prefix, series, businessKey);
  const next = nextCounterValue(meta[key], startFor(invoiceType, series));
  meta[key] = next;
  writeJSON(META_PATH, meta);
  return formatDocNumber({ settings: series, typePrefix: prefix, next, fyLabel: getFinancialYearLabel() });
}

// v1.10.6 — audit L19: made async and yields between templates via
// setImmediate. Prior code was one uninterrupted sync loop over every
// recurring template with sync FS writes; N templates × K items
// blocked the event loop → HTTP handlers froze until it finished.
// Now: single-template body is unchanged, but each iteration awaits
// setImmediate() so pending fetches / API calls get a slot.
// Today as YYYY-MM-DD in the computer's own time zone. toISOString() is UTC,
// which in India is still "yesterday" until 05:30.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A template made on the Recurring screen before it stored `active` has no
// flag at all; the screen shows those as Active, so treat them as active.
const templateIsActive = (tpl) => tpl.active !== false;
const templateHasEnded = (tpl, today) =>
  (tpl.endMode === 'onDate' && tpl.endDate && today > tpl.endDate)
  || (tpl.endMode === 'afterN' && tpl.maxOccurrences && (tpl.occurrencesCreated || 0) >= tpl.maxOccurrences);

// Makes ONE invoice from a template and moves the template on. Used by the
// daily auto-fire and by the app's "Generate Now", so both produce the same
// invoice (Generate Now used to do its own simplified maths in the browser:
// no CGST/SGST/IGST split, no end conditions, interval ignored).
function generateFromTemplate(tpl, today) {
      // The business this template bills for: the one it was assigned to
      // (ownerGstin), else its saved profile id / name, else the active one.
      const profiles = readAllFromDir('profiles');
      let profile = profiles.find(p => p.gstin && tpl.ownerGstin && p.gstin === tpl.ownerGstin)
                 || profiles.find(p => p.id && tpl.profileId && p.id === tpl.profileId)
                 || profiles.find(p => p.businessName && p.businessName === (tpl.profileBusinessName || tpl.ownerName))
                 || readJSON(PROFILE_PATH, {});

      const prefix = (tpl.invoiceType === 'proforma' ? 'EST'
                   : tpl.invoiceType === 'quotation' ? 'QUO'
                   : tpl.invoiceType === 'credit-note' ? 'CN'
                   : tpl.invoiceType === 'bill-of-supply' ? 'BOS'
                   : tpl.invoiceType === 'composition' ? 'COMP'
                   : tpl.invoiceType === 'delivery-challan' ? 'DC'
                   : 'INV');
      // Never overwrite an existing invoice: if the counter lags behind the
      // bills on disk (restored backup, hand-typed numbers), take the next one.
      const bizKey = businessKeyOf(profile);
      let invoiceNumber = nextInvoiceNumber(prefix, tpl.invoiceType, bizKey);
      for (let i = 0; i < 50 && fs.existsSync(path.join(DATA_DIR, 'bills', safeFileName(invoiceNumber) + '.json')); i++) {
        invoiceNumber = nextInvoiceNumber(prefix, tpl.invoiceType, bizKey);
      }
      const invoiceDate = today;

      // v1.10.31 — Data-F3.1: use shared computeInvoiceTotals so every math
      // fix (UTGST, cess, RCM, TDS/TCS ₹50L threshold, discount modes,
      // tax-inclusive, invoice-level discount, round-off) applies here too.
      // Prior inline math didn't recognise ANY of those and silently produced
      // wrong tax buckets for recurring bills. All the v1.10.1 audit fixes
      // were being reintroduced here.
      // v1.10.66 (#61) — the client's country decides whether the supply is
      // an export (IGST); place of supply and SEZ decide the split as on the
      // invoice screen. templateTotals (src/utils.js) is shared with the
      // Recurring screen, so the amount it shows is the amount billed.
      // The client's sales so far this year, for the ₹50L TCS/TDS threshold.
      const ytd = clientYearToDate(readAllFromDir('bills'), tpl.clientName, today);
      const totals = templateTotals(tpl, profile, { tcsCumulativeThisYear: ytd, tdsCumulativeThisYear: ytd });
      const totalAmount = totals.total;
      const taxTotal = totals.totalTaxAmount;
      // Due date: the same number of days after the invoice date as on the
      // invoice the template was made from (none when it had no due date).
      const dueDays = Number(tpl.dueDays);
      const dueDate = Number.isFinite(dueDays) && dueDays >= 0 && tpl.dueDays !== '' && tpl.dueDays !== null
        ? addDays(invoiceDate, dueDays) : '';

      const bill = {
        id: invoiceNumber,
        clientName: tpl.clientName,
        invoiceNumber,
        invoiceDate,
        invoiceType: tpl.invoiceType || 'tax-invoice',
        currency: (tpl.invoiceOptions && tpl.invoiceOptions.currency) || 'INR',
        totalAmount,
        totalTaxAmount: taxTotal,
        status: 'unpaid',
        paidAmount: 0,
        payments: [],
        generatedFrom: tpl.id,
        autoGenerated: true,
        autoGeneratedAt: new Date().toISOString(),
        data: {
          profile,
          client: {
            name: tpl.clientName, state: tpl.clientState, gstin: tpl.clientGstin,
            address: tpl.clientAddress, country: tpl.clientCountry, city: tpl.clientCity,
            pin: tpl.clientPin, email: tpl.clientEmail, phone: tpl.clientPhone,
            isSEZ: tpl.isSEZ,
          },
          // The place of supply the totals were worked out with: left blank,
          // GSTR-1 and the printed invoice fell back to the client's state.
          details: { invoiceNumber, invoiceDate, dueDate, placeOfSupply: tpl.placeOfSupply || '' },
          // Normalize item.name from legacy description field (v1.6.7-and-earlier
          // templates used `description` — auto-fired bills rendered blank rows).
          items: (tpl.items || []).map(i => ({
            ...i,
            name: i.name || i.description || '',
          })),
          totals,
          invoiceType: tpl.invoiceType || 'tax-invoice',
          customTerms: tpl.customTerms || '',
          customNotes: tpl.customNotes || '',
          extraSections: tpl.extraSections || [],
          invoiceOptions: tpl.invoiceOptions || {},
          taxInclusive: !!tpl.taxInclusive,
        },
      };

      writeJSON(path.join(DATA_DIR, 'bills', safeFileName(invoiceNumber) + '.json'), bill);

      // Advance the template. The day of month it started on is remembered,
      // so a schedule on the 31st comes back to the 31st after February.
      const from = tpl.nextDate || today;
      if (!tpl.anchorDay && tpl.frequency !== 'weekly') tpl.anchorDay = Number(from.slice(8, 10)) || undefined;
      tpl.nextDate = advanceDate(from, tpl.frequency, tpl.interval, tpl.anchorDay);
      tpl.lastGenerated = today;
      tpl.occurrencesCreated = (tpl.occurrencesCreated || 0) + 1;
      writeJSON(path.join(DATA_DIR, 'recurring', safeFileName(tpl.id) + '.json'), tpl);
      return invoiceNumber;
}

async function processDueRecurring() {
  const today = localToday();
  const templates = readAllFromDir('recurring');
  let fired = 0;
  const yieldToLoop = () => new Promise(r => setImmediate(r));
  for (const tpl of templates) {
    await yieldToLoop();
    if (!tpl || !templateIsActive(tpl)) continue;
    if (!tpl.nextDate || tpl.nextDate > today) continue;
    if (templateHasEnded(tpl, today)) continue;
    try {
      generateFromTemplate(tpl, today);
      fired += 1;
    } catch (err) {
      logFatal(err, 'recurring');
    }
  }
  if (fired > 0) {
    console.log(`  Auto-generated ${fired} recurring invoice${fired !== 1 ? 's' : ''}.`);
    // Surface the count so the frontend notification centre can pick it up.
    const meta = readJSON(META_PATH, {});
    meta.lastRecurringAutoFire = { date: today, count: fired, at: new Date().toISOString() };
    writeJSON(META_PATH, meta);
  }
}

// "Generate Now" on the Recurring screen: one invoice from one template, now,
// even if it is paused or not yet due (the user asked for it), but not after
// the template has ended.
app.post('/api/recurring/:id/generate', (req, res) => {
  try {
    const tpl = readAllFromDir('recurring').find(t => t && t.id === req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Recurring template not found' });
    const today = localToday();
    if (templateHasEnded(tpl, today)) {
      return res.status(409).json({ error: 'This template has reached its end date or number of invoices' });
    }
    const invoiceNumber = generateFromTemplate(tpl, today);
    res.json({ success: true, invoiceNumber });
  } catch (err) {
    logFatal(err, 'recurring-generate');
    res.status(500).json({ error: err.message || 'Could not generate the invoice' });
  }
});

// (--after-pid, the wait for the old copy on Restart, is at the top: before the lock.)
startServer(STARTING_PORT);
// Fire once after a short delay so the listener is up first; then once a day
// for users whose server stays up >24h.
// v1.10.6 — audit L19: async caller. Uncaught rejections logged via
// the top-level unhandledRejection handler installed above.
setTimeout(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 3000);
// Hourly: a template only fires once its nextDate has come, so checking more
// often never makes extra invoices - it just stops a template due today from
// waiting until the same time tomorrow on a PC that stays on.
setInterval(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 60 * 60 * 1000);
