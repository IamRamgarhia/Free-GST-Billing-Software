import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

// In-memory cache for directory reads — invalidated on write/delete
const dirCache = {};
function invalidateCache(dir) { delete dirCache[dir]; }

// Helper: read all JSON files from a directory (cached)
function readAllFromDir(dir) {
  if (dirCache[dir]) return dirCache[dir];
  const dirPath = path.join(DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) return [];
  const results = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean);
  dirCache[dir] = results;
  return results;
}

// Helper: read a single JSON file
function readJSON(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  return fallback;
}

// Helper: write JSON file (with cache invalidation)
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
  writeJSON(filePath, bill);
  res.json({ success: true });
});

app.delete('/api/bills/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'bills', safeFileName(req.params.id) + '.json');
  deleteFile(filePath);
  res.json({ success: true });
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
  const data = req.body;
  let billCount = 0, clientCount = 0, templateCount = 0, productCount = 0;

  if (data.profile) {
    writeJSON(PROFILE_PATH, data.profile);
  }
  if (data.bills && Array.isArray(data.bills)) {
    for (const bill of data.bills) {
      if (bill.id) {
        writeJSON(path.join(DATA_DIR, 'bills', safeFileName(bill.id) + '.json'), bill);
        billCount++;
      }
    }
  }
  if (data.clients && Array.isArray(data.clients)) {
    for (const cli of data.clients) {
      if (cli.id) {
        writeJSON(path.join(DATA_DIR, 'clients', safeFileName(cli.id) + '.json'), cli);
        clientCount++;
      }
    }
  }
  if (data.termsTemplates && Array.isArray(data.termsTemplates)) {
    for (const tpl of data.termsTemplates) {
      if (tpl.id) {
        writeJSON(path.join(DATA_DIR, 'templates', safeFileName(tpl.id) + '.json'), tpl);
        templateCount++;
      }
    }
  }
  if (data.products && Array.isArray(data.products)) {
    for (const prod of data.products) {
      if (prod.id) {
        writeJSON(path.join(DATA_DIR, 'products', safeFileName(prod.id) + '.json'), prod);
        productCount++;
      }
    }
  }
  if (data.expenses && Array.isArray(data.expenses)) {
    for (const exp of data.expenses) {
      if (exp.id) {
        writeJSON(path.join(DATA_DIR, 'expenses', safeFileName(exp.id) + '.json'), exp);
      }
    }
  }
  if (data.recurring && Array.isArray(data.recurring)) {
    for (const rec of data.recurring) {
      if (rec.id) {
        writeJSON(path.join(DATA_DIR, 'recurring', safeFileName(rec.id) + '.json'), rec);
      }
    }
  }
  if (data.receipts && Array.isArray(data.receipts)) {
    for (const rcp of data.receipts) {
      if (rcp.id) {
        writeJSON(path.join(DATA_DIR, 'receipts', safeFileName(rcp.id) + '.json'), rcp);
      }
    }
  }
  if (data.profiles && Array.isArray(data.profiles)) {
    for (const prof of data.profiles) {
      if (prof.id) {
        writeJSON(path.join(DATA_DIR, 'profiles', safeFileName(prof.id) + '.json'), prof);
      }
    }
  }
  if (data.purchases && Array.isArray(data.purchases)) {
    for (const pur of data.purchases) {
      if (pur.id) {
        writeJSON(path.join(DATA_DIR, 'purchases', safeFileName(pur.id) + '.json'), pur);
      }
    }
  }
  if (data.meta) {
    writeJSON(META_PATH, data.meta);
  }

  res.json({ billCount, clientCount, templateCount, productCount, hasProfile: !!data.profile });
});

// ========================
// Save PDF to local folder
// ========================
const INVOICES_DIR = path.join(__dirname, 'Saved Invoices');
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

app.post('/api/save-pdf', express.raw({ type: 'application/pdf', limit: '20mb' }), (req, res) => {
  const fileName = req.query.name || `invoice-${Date.now()}.pdf`;
  const clientName = req.query.client || 'General';
  const month = req.query.month || new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const safeClient = clientName.replace(/[<>:"/\\|?*]/g, '-').trim() || 'General';
  const safeMonth = month.replace(/[<>:"/\\|?*]/g, '-').trim();
  const safeName = fileName.replace(/[<>:"/\\|?*]/g, '-');

  const folderPath = path.join(INVOICES_DIR, safeClient, safeMonth);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const filePath = path.join(folderPath, safeName);
  fs.writeFileSync(filePath, req.body);
  res.json({ saved: true, path: filePath });
});

// ========================
// Move saved PDF to Trash
// ========================
const TRASH_DIR = path.join(__dirname, 'Trash');

if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });

app.post('/api/trash-pdf', express.json(), (req, res) => {
  try {
    const { fileName, clientName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName required' });

    const safeClient = (clientName || 'General').replace(/[<>:"/\\|?*]/g, '-').trim() || 'General';
    const safeName = fileName.replace(/[<>:"/\\|?*]/g, '-');

    // Search for the PDF in Saved Invoices (check all month subfolders for this client)
    const clientDir = path.join(INVOICES_DIR, safeClient);
    let found = false;

    if (fs.existsSync(clientDir)) {
      const months = fs.readdirSync(clientDir).filter(f => {
        try { return fs.statSync(path.join(clientDir, f)).isDirectory(); } catch { return false; }
      });
      for (const month of months) {
        const filePath = path.join(clientDir, month, safeName);
        if (fs.existsSync(filePath)) {
          // Move to Trash/{Client}/{Month}/
          const trashPath = path.join(TRASH_DIR, safeClient, month);
          if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
          try {
            fs.renameSync(filePath, path.join(trashPath, safeName));
          } catch {
            // renameSync can fail across drives — fallback to copy+delete
            fs.copyFileSync(filePath, path.join(trashPath, safeName));
            fs.unlinkSync(filePath);
          }
          found = true;
          break;
        }
      }
    }

    // Also search without client subfolder (flat structure from older saves)
    if (!found) {
      const flatPath = path.join(INVOICES_DIR, safeName);
      if (fs.existsSync(flatPath)) {
        const trashPath = path.join(TRASH_DIR, safeClient);
        if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
        try {
          fs.renameSync(flatPath, path.join(trashPath, safeName));
        } catch {
          fs.copyFileSync(flatPath, path.join(trashPath, safeName));
          fs.unlinkSync(flatPath);
        }
        found = true;
      }
    }

    res.json({ trashed: found });
  } catch (err) {
    console.error('Trash PDF error:', err);
    res.status(500).json({ error: 'Failed to trash PDF' });
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
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all for SPA routing (Express 5 syntax)
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ============================================================
// Error log + graceful shutdown
// ============================================================
// When the server is launched via start-server-silent.bat (hidden window) and
// crashes, the user has no console to see what happened. Persist any startup
// or unhandled error to data/errors.log so support / users can diagnose it.
const ERRORS_LOG = path.join(DATA_DIR, 'errors.log');

function logFatal(err, source = 'fatal') {
  try {
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

// Health-check endpoint exposing recent errors so the UI can surface a banner.
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

startServer(STARTING_PORT);
