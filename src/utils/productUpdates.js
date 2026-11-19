import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const PRICE_FIELDS = ['purchasePrice', 'sellingPrice', 'hsn', 'stock'];
const snapshotFields = ['purchasePrice', 'sellingPrice', 'rate'];
const value = (p, f) =>
  Number(f === 'sellingPrice' ? (p.sellingPrice ?? p.rate ?? 0) : (p.purchasePrice ?? 0));
const fieldValue = (p, f) =>
  f === 'hsn'
    ? String(p.hsn ?? '')
    : f === 'stock'
      ? p.stock === undefined || p.stock === null
        ? null
        : Number(p.stock)
      : value(p, f);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);
// Product master updates only: invoices keep the prices saved on their lines.
export function planPriceUpdate(changes, records, { allowStock = false } = {}) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 10000)
    fail('Supply 1 to 10,000 price changes.');
  const seen = new Set(),
    plans = [];
  for (const c of changes) {
    if (
      !plain(c) ||
      Object.keys(c).some((k) => !['id', 'prices', 'expected'].includes(k)) ||
      typeof c.id !== 'string' ||
      !plain(c.prices) ||
      !plain(c.expected)
    )
      fail('Invalid price update.');
    if (seen.has(c.id)) fail('A product occurs more than once.');
    seen.add(c.id);
    const record = records.get(c.id);
    if (!record) fail('A product was removed. Preview the CSV again.', 409);
    const fields = Object.keys(c.prices);
    if (
      !fields.length ||
      fields.some((f) => !PRICE_FIELDS.includes(f)) ||
      Object.keys(c.expected).length !== fields.length ||
      Object.keys(c.expected).some((f) => !fields.includes(f))
    )
      fail('Only prices, HSN/SAC and approved stock quantities may be updated.');
    const next = { ...record.product };
    for (const f of fields) {
      const n = c.prices[f];
      if (f === 'hsn') {
        if (typeof n !== 'string' || !/^\d{1,8}$/.test(n) || typeof c.expected[f] !== 'string')
          fail('Invalid HSN/SAC code.');
      } else if (f === 'stock') {
        if (allowStock !== true) fail('Stock updates require explicit approval.');
        if (record.product.kind === 'service') fail('Services cannot have stock.');
        if (
          !Number.isFinite(n) ||
          n < 0 ||
          n > 1e9 ||
          Math.abs(n * 10000 - Math.round(n * 10000)) > 0.01 ||
          (c.expected[f] !== null && (typeof c.expected[f] !== 'number' || !Number.isFinite(c.expected[f])))
        )
          fail('Stock must be a non-negative quantity with up to 4 decimal places.');
      } else if (
        typeof n !== 'number' ||
        !Number.isFinite(n) ||
        n < 0 ||
        n > 1e12 ||
        Math.abs(n * 10000 - Math.round(n * 10000)) > 0.01 ||
        typeof c.expected[f] !== 'number' ||
        !Number.isFinite(c.expected[f])
      )
        fail('Invalid price.');
      if (fieldValue(record.product, f) !== c.expected[f])
        fail('A product value changed after preview. Upload the CSV again to review current values.', 409);
      next[f] = n;
      if (f === 'sellingPrice') next.rate = n;
    }
    plans.push({ ...record, next });
  }
  return plans;
}
export function installPriceUpdates(app, { DATA_DIR, writeJSON, invalidateCache }) {
  const productDir = path.join(DATA_DIR, 'products'),
    backupDir = path.join(DATA_DIR, 'backups');
  let recoveryRequired = false;
  // If even rollback fails (for example, a disconnected disk), no later save
  // may build on a partially applied batch. Restart after fixing the storage;
  // the pending journal is recovered before requests are accepted.
  app.use?.((req, res, next) => {
    if (recoveryRequired && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res
        .status(503)
        .json({
          error:
            'A product update needs recovery. Fix the storage problem and restart the app before saving more changes.',
        });
    }
    return next();
  });
  const records = () => {
    const map = new Map();
    for (const filename of fs.readdirSync(productDir)) {
      if (!filename.endsWith('.json')) continue;
      const file = path.join(productDir, filename);
      if (fs.lstatSync(file).isSymbolicLink()) throw Error('Unexpected product storage.');
      const product = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      if (map.has(String(product.id))) throw Error('Duplicate product IDs need review.');
      map.set(String(product.id), { file, product });
    }
    return map;
  };
  const restore = (journal) => {
    const current = records();
    const changes = new Map((journal.changes || []).map((c) => [c.id, c]));
    const restored = [];
    for (const old of journal.products) {
      const record = current.get(String(old.id));
      if (!record) throw Error('Product recovery requires review.');
      const p = { ...record.product };
      const change = changes.get(String(old.id));
      const restoreFields = change
        ? [
            ...new Set([
              ...Object.keys(change.prices),
              ...(Object.hasOwn(change.prices, 'sellingPrice') ? ['rate'] : []),
            ]),
          ]
        : snapshotFields;
      for (const f of restoreFields) {
        if (
          f === 'stock' &&
          fieldValue(p, f) !== fieldValue(old, f) &&
          fieldValue(p, f) !== change.prices.stock
        )
          throw Error('Stock changed outside the interrupted update; recovery needs review.');
        if (Object.hasOwn(old, f)) p[f] = old[f];
        else delete p[f];
      }
      restored.push({ file: record.file, product: p });
    }
    for (const record of restored) writeJSON(record.file, record.product);
    invalidateCache('products');
  };
  // A pending journal means the process stopped in the middle of a batch.
  // Recover only the affected fields before accepting requests.
  if (fs.existsSync(backupDir))
    for (const name of fs.readdirSync(backupDir)) {
      if (!/^price-update-[a-f0-9-]+\.json$/.test(name)) continue;
      const file = path.join(backupDir, name),
        journal = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (journal.state === 'pending') {
        restore(journal);
        journal.state = 'recovered';
        writeJSON(file, journal);
      }
    }
  app.post('/api/products/price-update', (req, res) => {
    let journal, file;
    try {
      if (
        !plain(req.body) ||
        Object.keys(req.body).some((k) => !['changes', 'allowStock'].includes(k)) ||
        !Object.hasOwn(req.body, 'changes') ||
        (Object.hasOwn(req.body, 'allowStock') && typeof req.body.allowStock !== 'boolean')
      )
        fail('Invalid product update request.');
      const plans = planPriceUpdate(req.body.changes, records(), {
        allowStock: req.body.allowStock === true,
      });
      const id = crypto.randomUUID();
      file = path.join(backupDir, 'price-update-' + id + '.json');
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
      journal = {
        id,
        createdAt: new Date().toISOString(),
        state: 'pending',
        products: plans.map((p) => p.product),
        changes: req.body.changes,
      };
      writeJSON(file, journal);
      fs.chmodSync(file, 0o600);
      try {
        for (const p of plans) writeJSON(p.file, p.next);
        journal.state = 'completed';
        journal.completedAt = new Date().toISOString();
        writeJSON(file, journal);
      } catch (error) {
        try {
          restore(journal);
          journal.state = 'rolled-back';
          writeJSON(file, journal);
        } catch (rollbackError) {
          recoveryRequired = true;
          throw rollbackError;
        }
        throw error;
      } finally {
        invalidateCache('products');
      }
      res.json({ updated: plans.length, backupId: id });
    } catch (error) {
      // A journal whose initial save or permission check failed must never
      // later roll back an unrelated successful batch. Recover it first.
      if (journal?.state === 'pending') recoveryRequired = true;
      res
        .status(error.status || 500)
        .json({
          error: error.status
            ? error.message
            : 'The price update could not complete. Reload products and preview the CSV again before retrying.',
        });
    }
  });
}
