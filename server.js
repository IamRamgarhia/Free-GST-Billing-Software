import express from 'express';
// v1.10.0 — `cors` package no longer imported. The CORS-lockdown
// middleware below is intentionally custom + strict (localhost only)
// where `cors()` echoed `*` for every origin.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// v1.10.31 — Data-F3.1: share computeInvoiceTotals with the client so
// server-generated recurring invoices honour UTGST, cess, RCM, TDS/TCS,
// discount modes (percent / unit / with-tax), tax-inclusive back-calc,
// invoice-level discount, and round-off. Previously the recurring auto-fire
// re-implemented totals inline and silently reintroduced every bug the
// v1.10.1 extraction fixed. Same source of truth now.
import { computeInvoiceTotals } from './src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

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
const PORT_FILE = path.join(__dirname, 'data', 'port.txt');

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
app.use(express.json({ limit: '5mb' }));

// Ensure data directory and sub-directories exist
const DIRS = ['bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts', 'profiles', 'purchases'];
for (const dir of DIRS) {
  const dirPath = path.join(DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
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
  const r = path.resolve(root);
  const p = path.resolve(resolved);
  return p === r || p.startsWith(r + path.sep);
}

// v1.10.0 — Generic error response helper. Never returns raw Node
// error messages to the client (they leak absolute filesystem paths,
// EACCES/EPERM strings that hint at server structure). Server-side
// logs the full detail; client sees a stable code + generic phrase.
function errRes(res, status, code, err) {
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
      try { return JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean);
  dirCache[dir] = { at: Date.now(), value: results };
  return results;
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
    return res.json({ success: true, permanent: true });
  }
  try {
    const trashDir = path.join(DATA_DIR, 'trash');
    if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
    fs.renameSync(filePath, path.join(trashDir, fname));
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
  if (!client.id) client.id = 'cli_' + Date.now();
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
  if (!tpl.id) tpl.id = 'tpl_' + Date.now();
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
  if (!product.id) product.id = 'prod_' + Date.now();
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
// EXPENSES
// ========================
app.get('/api/expenses', (req, res) => {
  const expenses = readAllFromDir('expenses');
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const expense = req.body;
  if (!expense.id) expense.id = 'exp_' + Date.now();
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
  if (!item.id) item.id = 'rec_' + Date.now();
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
  if (!receipt.id) receipt.id = 'rcp_' + Date.now();
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
  if (!purchase.id) purchase.id = 'pur_' + Date.now();
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(purchase.id) + '.json');
  writeJSON(filePath, purchase);
  res.json({ success: true, id: purchase.id });
});

app.delete('/api/purchases/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'purchases', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
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
  if (!prof.id) prof.id = 'biz_' + Date.now();
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

app.get('/api/meta/:key', (req, res) => {
  const meta = readJSON(META_PATH, {});
  res.json({ value: meta[req.params.key] ?? null });
});

app.post('/api/meta/:key', (req, res) => {
  const meta = readJSON(META_PATH, {});
  meta[req.params.key] = req.body.value;
  writeJSON(META_PATH, meta);
  res.json({ success: true });
});

// Atomic increment for invoice-number counters. Node's I/O is single-threaded
// and readJSON / writeJSON are both synchronous (fs.readFileSync /
// writeFileSync), so wrapping read+write in one handler with no awaits is
// race-free across concurrent HTTP requests. Closes the
// "two saves both reading 5, both writing 6" duplicate-invoice-number bug.
app.post('/api/meta/:key/increment', (req, res) => {
  const meta = readJSON(META_PATH, {});
  const current = Number(meta[req.params.key] || 0);
  const next = current + 1;
  meta[req.params.key] = next;
  writeJSON(META_PATH, meta);
  res.json({ value: next });
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
    meta: readJSON(META_PATH, {}),
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

  // meta.json — same gating. Previously always overwrote → counters could
  // regress below existing bill numbers → collision loop on next save.
  if (data.meta) {
    if (overwrite || !fs.existsSync(META_PATH)) {
      writeJSON(META_PATH, data.meta);
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
    }
    let metaChanged = false;
    for (const [prefix, maxNum] of Object.entries(maxByPrefix)) {
      const key = `counter_${prefix}`;
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
const INVOICES_DIR = path.join(__dirname, 'Saved Invoices');
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

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

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(filePath, req.body);
    // Don't leak absolute FS path — client only needs to know it saved
    // and where (relative). Absolute path revealed OS username +
    // install dir to any origin.
    res.json({ saved: true, relPath: path.relative(__dirname, filePath).split(path.sep).join('/') });
  } catch (err) {
    errRes(res, 500, 'server-error', err);
  }
});

// ========================
// Move saved PDF to Trash
// ========================
const TRASH_DIR = path.join(__dirname, 'Trash');

if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });

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
          if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
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
          if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
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

app.get('/api/version', (req, res) => {
  res.json({ current: pkg.version });
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

app.get('/api/check-update', async (req, res) => {
  try {
    // Two parallel fetches: package.json (definitive version source) and the
    // GitHub Releases API (for release notes). Both have a 4s timeout so a
    // flaky network can't lock the UI.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const [pkgRes, relRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/package.json', { signal: ctrl.signal }),
      fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'FreeGSTBill-update-check' },
      }).catch(() => null),
    ]);
    clearTimeout(t);

    if (!pkgRes.ok) throw new Error('GitHub fetch failed');
    const remote = await pkgRes.json();
    const cmp = compareSemver(remote.version, pkg.version);
    const updateAvailable = cmp > 0;

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

    res.json({
      current: pkg.version,
      latest: remote.version,
      updateAvailable,
      releaseNotes,
      releaseUrl,
      releasePublishedAt,
      releaseTag,
    });
  } catch {
    res.json({ current: pkg.version, latest: null, updateAvailable: false, error: 'Could not check for updates' });
  }
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
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
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

function runDailyBackup() {
  try {
    ensureDir(BACKUPS_DIR);
    const today = todayLocalIso();
    const target = path.join(BACKUPS_DIR, today);
    if (fs.existsSync(target)) return;
    ensureDir(target);
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      // v1.10.31 — Data-F7.1: `trash` is now INCLUDED in daily backups.
      // Previously excluded → users restoring last week's backup lost every
      // bill they'd trashed since, breaking the 30-day soft-delete promise.
      // We still skip `backups` (no recursion) and log files.
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt') continue;
      const src = path.join(DATA_DIR, entry.name);
      const dst = path.join(target, entry.name);
      if (entry.isDirectory()) copyDirRecursive(src, dst);
      else fs.copyFileSync(src, dst);
    }
    console.log(`[backup] Daily snapshot saved: ${target}`);
    const all = fs.readdirSync(BACKUPS_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    while (all.length > 30) {
      const oldest = all.shift();
      const oldestPath = path.join(BACKUPS_DIR, oldest);
      try { fs.rmSync(oldestPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[backup] Daily backup failed:', err.message);
  }
}

setTimeout(runDailyBackup, 5000);
setInterval(runDailyBackup, 24 * 60 * 60 * 1000);

// Backup management endpoints
app.get('/api/backups', (req, res) => {
  try {
    ensureDir(BACKUPS_DIR);
    const list = fs.readdirSync(BACKUPS_DIR)
      .filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n))
      .sort().reverse()
      .map(name => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, name));
        return { date: name, createdAt: stat.mtime.toISOString() };
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
    const backupDir = path.join(BACKUPS_DIR, date);
    if (!isPathInside(backupDir, BACKUPS_DIR)) return errRes(res, 400, 'invalid-path');
    if (!fs.existsSync(backupDir)) return errRes(res, 404, 'not-found');

    // Additional date sanity — a directory can exist with an unrealistic
    // date planted before hardening. Reject impossible calendar dates.
    const [y, m, d] = date.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
      return errRes(res, 400, 'bad-request');
    }

    // Make a snapshot of live data before touching anything.
    snapshotDir = path.join(BACKUPS_DIR, `pre-restore-${Date.now()}`);
    ensureDir(snapshotDir);
    const liveEntries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const entry of liveEntries) {
      if (entry.name === 'backups' || entry.name === 'errors.log' || entry.name === 'port.txt') continue;
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

    // Success — remove the pre-restore snapshot (or keep for a bit? we
    // remove because the backup itself is still on disk as a rollback
    // option). Failures below prevent removal.
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    res.json({ success: true, restored: date });
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
    errRes(res, 500, 'server-error', err);
  }
});

// v1.10.6 — audit L11: throttle. Prior code let any caller spam this
// endpoint and each hit walked the whole data tree + 30-day pruning.
// The `if (fs.existsSync(target)) return` inside runDailyBackup makes
// this idempotent per day, but the fs walks still happen. Now: at most
// one call per 5 seconds; excess return 429 with a hint.
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
    fs.renameSync(trashPath, billsPath);
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
// eslint-disable-next-line no-unused-vars — 4-arg signature is required by Express
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
process.on('uncaughtException', (err) => logFatal(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => logFatal(err, 'unhandledRejection'));

// Note: /api/health used to live below the SPA catch-all here, so the
// catch-all was swallowing every request to it and returning "No such
// endpoint". Moved above the catch-all in v1.10.0. See earlier in file.

// Try ports starting from STARTING_PORT (persisted preference) until one is available.
// Bound to 127.0.0.1 explicitly so the server can NEVER be reached from the LAN —
// every byte stays on the user's machine, which the privacy promise depends on.
let activeServer = null;
function startServer(port) {
  const server = app.listen(port, '127.0.0.1', () => {
    activeServer = server;
    // Persist the chosen port — the .bat launcher reads this for the browser URL.
    // Writing on EVERY successful boot means: if our preferred 47371 was busy and
    // we landed on 47372 instead, next launch tries 47372 first (cuts collision
    // scans in half on repeated reboots of whatever was holding 47371).
    try { fs.writeFileSync(PORT_FILE, String(port), 'utf-8'); } catch { /* ignore */ }
    console.log(`\n  Free GST Billing Software running at http://localhost:${port}`);
    console.log(`  Data stored in: ${DATA_DIR}\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < STARTING_PORT + MAX_PORT_SCAN) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else if (err.code === 'EADDRINUSE') {
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

// Graceful shutdown — taskkill /f from Stop FreeGSTBill.bat can interrupt a
// sync write mid-flight. SIGINT (Ctrl+C in foreground) and SIGTERM (clean
// kill) get a 3-second window to flush.
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
function advanceDate(dateStr, frequency, interval) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const n = Math.max(1, parseInt(interval, 10) || 1);
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3 * n);
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n); // default: monthly
  return d.toISOString().split('T')[0];
}

function nextInvoiceNumber(prefix, settings = {}) {
  // Mirror the frontend's getNextInvoiceNumber logic — atomic counter via
  // meta, applied to the same brandPrefix / separator / padding settings.
  const key = `counter_${prefix}`;
  const meta = readJSON(META_PATH, {});
  const cfg = { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, padDigits: 4, ...(meta.invoiceNumberSettings || {}) };
  const next = (Number(meta[key]) || 0) + 1;
  meta[key] = next;
  writeJSON(META_PATH, meta);
  if (cfg.format === 'random') {
    return `${cfg.brandPrefix || prefix}${cfg.separator}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  const sep = cfg.separator || '/';
  const pfx = cfg.brandPrefix || prefix;
  const padded = String(next).padStart(cfg.padDigits || 4, '0');
  if (cfg.showFinYear) {
    const y = new Date().getFullYear();
    return `${pfx}${sep}${y}-${String(y + 1).slice(-2)}${sep}${padded}`;
  }
  return `${pfx}${sep}${padded}`;
  // Ignored other settings flags — they'd just produce slightly different
  // formatting; matches frontend behaviour closely enough for the rare
  // server-side firing.
}

// v1.10.6 — audit L19: made async and yields between templates via
// setImmediate. Prior code was one uninterrupted sync loop over every
// recurring template with sync FS writes; N templates × K items
// blocked the event loop → HTTP handlers froze until it finished.
// Now: single-template body is unchanged, but each iteration awaits
// setImmediate() so pending fetches / API calls get a slot.
async function processDueRecurring() {
  const today = new Date().toISOString().split('T')[0];
  const templates = readAllFromDir('recurring');
  let fired = 0;
  const yieldToLoop = () => new Promise(r => setImmediate(r));
  for (const tpl of templates) {
    await yieldToLoop();
    if (!tpl || !tpl.active) continue;
    if (!tpl.nextDate || tpl.nextDate > today) continue;
    // End conditions
    if (tpl.endMode === 'onDate' && tpl.endDate && today > tpl.endDate) continue;
    if (tpl.endMode === 'afterN' && tpl.maxOccurrences && (tpl.occurrencesCreated || 0) >= tpl.maxOccurrences) continue;

    try {
      // Resolve a LIVE profile by id or businessName (mirrors v1.4.2
      // company-name-auto-update behaviour for recurring fires).
      const profiles = readAllFromDir('profiles');
      let profile = profiles.find(p => p.id && tpl.profileId && p.id === tpl.profileId)
                 || profiles.find(p => p.businessName === tpl.profileBusinessName)
                 || readJSON(PROFILE_PATH, {});

      const prefix = (tpl.invoiceType === 'proforma' ? 'EST'
                   : tpl.invoiceType === 'credit-note' ? 'CN'
                   : tpl.invoiceType === 'bill-of-supply' ? 'BOS'
                   : tpl.invoiceType === 'composition' ? 'COMP'
                   : tpl.invoiceType === 'delivery-challan' ? 'DC'
                   : 'INV');
      const invoiceNumber = nextInvoiceNumber(prefix);
      const invoiceDate = today;

      // v1.10.31 — Data-F3.1: use shared computeInvoiceTotals so every math
      // fix (UTGST, cess, RCM, TDS/TCS ₹50L threshold, discount modes,
      // tax-inclusive, invoice-level discount, round-off) applies here too.
      // Prior inline math didn't recognise ANY of those and silently produced
      // wrong tax buckets for recurring bills. All the v1.10.1 audit fixes
      // were being reintroduced here.
      const client = {
        name: tpl.clientName,
        state: tpl.clientState,
        gstin: tpl.clientGstin,
        isSEZ: !!tpl.isSEZ,
      };
      const details = { placeOfSupply: tpl.placeOfSupply };
      const invoiceOptions = tpl.invoiceOptions || {};
      const totals = computeInvoiceTotals({
        items: tpl.items || [],
        profile,
        client,
        details,
        showGST: invoiceOptions.showGST !== false,
        taxInclusive: !!tpl.taxInclusive,
        invoiceOptions,
      });
      const totalAmount = totals.total;
      const taxTotal = totals.totalTaxAmount;
      const subtotal = totals.subtotal;
      const totalDiscount = totals.totalDiscount;

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
          details: { invoiceNumber, invoiceDate, dueDate: '', placeOfSupply: '' },
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

      // Advance the template
      tpl.nextDate = advanceDate(tpl.nextDate, tpl.frequency, tpl.interval);
      tpl.lastGenerated = today;
      tpl.occurrencesCreated = (tpl.occurrencesCreated || 0) + 1;
      writeJSON(path.join(DATA_DIR, 'recurring', safeFileName(tpl.id) + '.json'), tpl);

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

startServer(STARTING_PORT);
// Fire once after a short delay so the listener is up first; then once a day
// for users whose server stays up >24h.
// v1.10.6 — audit L19: async caller. Uncaught rejections logged via
// the top-level unhandledRejection handler installed above.
setTimeout(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 3000);
setInterval(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 24 * 60 * 60 * 1000);
