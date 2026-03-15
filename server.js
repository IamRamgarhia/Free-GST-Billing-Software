import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DEFAULT_PORT = 3001;
const PORT_FILE = path.join(__dirname, 'data', 'port.txt');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure data directory and sub-directories exist
const DIRS = ['bills', 'clients', 'templates', 'products', 'expenses', 'recurring', 'receipts', 'profiles'];
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
  logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'FreeGSTBill Invoices',
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

app.post('/api/trash-pdf', express.json(), (req, res) => {
  const { fileName, clientName, invoiceDate } = req.body;
  if (!fileName) return res.status(400).json({ error: 'fileName required' });

  const safeClient = (clientName || 'General').replace(/[<>:"/\\|?*]/g, '-').trim() || 'General';
  const safeName = fileName.replace(/[<>:"/\\|?*]/g, '-');

  // Search for the PDF in Saved Invoices (check all month subfolders for this client)
  const clientDir = path.join(INVOICES_DIR, safeClient);
  let found = false;

  if (fs.existsSync(clientDir)) {
    const months = fs.readdirSync(clientDir).filter(f => fs.statSync(path.join(clientDir, f)).isDirectory());
    for (const month of months) {
      const filePath = path.join(clientDir, month, safeName);
      if (fs.existsSync(filePath)) {
        // Move to Trash/{Client}/{Month}/
        const trashPath = path.join(TRASH_DIR, safeClient, month);
        if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, { recursive: true });
        fs.renameSync(filePath, path.join(trashPath, safeName));
        found = true;
        break;
      }
    }
  }

  res.json({ trashed: found });
});

// ========================
// Version check
// ========================
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

app.get('/api/version', (req, res) => {
  res.json({ current: pkg.version });
});

app.get('/api/check-update', async (req, res) => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/IamRamgarhia/freegstbill/main/package.json');
    if (!response.ok) throw new Error('GitHub fetch failed');
    const remote = await response.json();
    res.json({ current: pkg.version, latest: remote.version, updateAvailable: remote.version !== pkg.version });
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

// Try ports starting from DEFAULT_PORT until one is available
function startServer(port) {
  const server = app.listen(port, () => {
    // Save the active port so VBS launcher and other tools can read it
    fs.writeFileSync(PORT_FILE, String(port), 'utf-8');
    console.log(`\n  FreeGSTBill server running at http://localhost:${port}`);
    console.log(`  Data stored in: ${DATA_DIR}\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(`  Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });
}

startServer(DEFAULT_PORT);
