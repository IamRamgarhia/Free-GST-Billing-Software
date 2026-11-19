import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installPriceUpdates, planPriceUpdate } from '../src/utils/productUpdates.js';
import { buildPricePlan, exportPrices } from '../src/utils/productUpdateCsv.js';
const products = [
  {
    id: 'p1',
    name: 'Paint, White',
    sellingPrice: 118,
    rate: 118,
    purchasePrice: 80,
    stock: 17,
    taxPercent: 18,
  },
  { id: 'p2', name: 'Brush', rate: 20, stock: 9 },
];
test('export/edit/reimport matches IDs; selling mirror and unchanged values', () => {
  const text = exportPrices(products).replace('"118"', '"120"');
  const p = buildPricePlan(text, products);
  assert.equal(p.errors.length, 0);
  assert.equal(p.changes.length, 1);
  assert.equal(p.unchanged, 1);
  assert.deepEqual(p.changes[0].prices, { sellingPrice: 120 });
});
test('blank leaves price, zero is explicit, stock and GST columns ignored', () => {
  const p = buildPricePlan(
    'Name,Purchase Price,Selling Price,Stock,GST %\r\n"Paint, White",,0,999,0',
    products,
  );
  assert.deepEqual(p.changes[0].prices, { sellingPrice: 0 });
  assert.deepEqual(p.ignored, ['GST %', 'Stock (stock updates not enabled)']);
});
test('rupee symbol and quoted thousands prices are parsed without changing the tax basis', () => {
  const p = buildPricePlan('Name,Selling Price\nBrush,"₹ 1,180.00"', products);
  assert.equal(p.errors.length, 0);
  assert.equal(p.changes[0].prices.sellingPrice, 1180);
});
test('unknown IDs never fall back to names; ambiguous and duplicate matches block apply', () => {
  assert.equal(buildPricePlan('Product ID,Name,Selling Price\nmissing,Brush,30', products).errors.length, 1);
  assert.equal(
    buildPricePlan('Name,Selling Price\nBrush,30', [...products, { id: 'p3', name: 'BRUSH' }]).errors.length,
    1,
  );
  assert.equal(buildPricePlan('Name,Selling Price\nBrush,30\nbrush,40', products).errors.length, 1);
});
test('invalid prices, malformed CSV and duplicate headings rejected', () => {
  for (const n of ['-1', 'abc', 'Infinity', '1.00001'])
    assert.equal(buildPricePlan('Name,Selling Price\nBrush,' + n, products).errors.length, 1);
  assert.throws(() => buildPricePlan('Name,Selling Price\n"Brush,30', products));
  assert.throws(() => buildPricePlan('Name,Rate,Selling Price\nBrush,30,40', products));
  assert.throws(() => buildPricePlan('Name,Selling Price\nBrush,30,extra', products));
});
function fixture(t, writeHook = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'price-update-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'products'));
  for (const p of products) fs.writeFileSync(path.join(root, 'products', p.id + '.json'), JSON.stringify(p));
  let handler, gate;
  const app = {
    use: (fn) => {
      gate = fn;
    },
    post: (route, fn) => {
      assert.equal(route, '/api/products/price-update');
      handler = fn;
    },
  };
  const dependencies = {
    DATA_DIR: root,
    writeJSON: (file, data) => {
      writeHook(file, data);
      fs.writeFileSync(file, JSON.stringify(data));
    },
    invalidateCache: () => {},
  };
  installPriceUpdates(app, dependencies);
  const request = (changes, extra = {}) => {
    let status = 200,
      body;
    handler(
      { body: { changes, ...extra } },
      {
        status: (n) => {
          status = n;
          return {
            json: (v) => {
              body = v;
            },
          };
        },
        json: (v) => {
          body = v;
        },
      },
    );
    return { status, body };
  };
  const allowed = () => {
    let status = 200,
      passed = false;
    gate(
      { method: 'POST' },
      {
        status: (n) => {
          status = n;
          return { json: () => {} };
        },
      },
      () => {
        passed = true;
      },
    );
    return { status, passed };
  };
  return {
    root,
    request,
    app,
    dependencies,
    allowed,
    read: (id) => JSON.parse(fs.readFileSync(path.join(root, 'products', id + '.json'), 'utf8')),
  };
}
const change = (id = 'p1', price = 120, expected = 118) => ({
  id,
  prices: { sellingPrice: price },
  expected: { sellingPrice: expected },
});
test('one request updates only approved prices, writes backup and preserves stock/tax/IDs', (t) => {
  const f = fixture(t);
  const r = f.request([change()]);
  assert.equal(r.status, 200);
  assert.deepEqual(f.read('p1'), { ...products[0], sellingPrice: 120, rate: 120 });
  const journal = JSON.parse(
    fs.readFileSync(path.join(f.root, 'backups', fs.readdirSync(path.join(f.root, 'backups'))[0]), 'utf8'),
  );
  assert.equal(journal.state, 'completed');
  assert.deepEqual(journal.products, [products[0]]);
});
test('concurrent price conflict validates whole batch before any writes', (t) => {
  const f = fixture(t);
  const r = f.request([change(), change('p2', 30, 999)]);
  assert.equal(r.status, 409);
  assert.deepEqual(f.read('p1'), products[0]);
  assert(!fs.existsSync(path.join(f.root, 'backups')));
});
test('stock changes after preview are preserved', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'products/p1.json'), JSON.stringify({ ...products[0], stock: 11 }));
  assert.equal(f.request([change()]).status, 200);
  assert.equal(f.read('p1').stock, 11);
});
test('non-price fields and invalid values cannot be sent directly to server', () => {
  const map = new Map(products.map((p) => [p.id, { product: p }]));
  assert.throws(() => planPriceUpdate([{ id: 'p1', prices: { stock: 99 }, expected: { stock: 17 } }], map));
  assert.throws(() => planPriceUpdate([change(), change()], map));
  assert.throws(() => planPriceUpdate([change('p1', -1)], map));
});
test('write failure rolls back earlier price changes', (t) => {
  let failed = false;
  const f = fixture(t, (file, data) => {
    if (file.endsWith('p2.json') && data.rate === 30 && !failed) {
      failed = true;
      throw Error('Simulated write failure');
    }
  });
  assert.equal(f.request([change(), change('p2', 30, 20)]).status, 500);
  assert.deepEqual(f.read('p1'), products[0]);
  assert.deepEqual(f.read('p2'), products[1]);
});
test('pending journal after interrupted process recovers prices without changing stock', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'backups'));
  fs.writeFileSync(
    path.join(f.root, 'backups/price-update-abcd.json'),
    JSON.stringify({ state: 'pending', products: [products[0]] }),
  );
  fs.writeFileSync(
    path.join(f.root, 'products/p1.json'),
    JSON.stringify({ ...products[0], sellingPrice: 120, rate: 120, stock: 3 }),
  );
  installPriceUpdates(f.app, f.dependencies);
  assert.deepEqual(f.read('p1'), { ...products[0], stock: 3 });
});
test('more than 2000 price changes are accepted in one batch', () => {
  const ps = Array.from({ length: 2565 }, (_, i) => ({
    id: 'p' + i,
    name: 'Product ' + i,
    rate: 100,
    stock: i,
    taxPercent: 18,
  }));
  const csv = 'Product ID,Selling Price\n' + ps.map((p) => p.id + ',110').join('\n');
  const p = buildPricePlan(csv, ps);
  assert.equal(p.changes.length, 2565);
  assert.equal(p.errors.length, 0);
  const plans = planPriceUpdate(
    p.changes.map(({ name, ...c }) => c),
    new Map(ps.map((product) => [product.id, { product }])),
  );
  assert.equal(plans.length, 2565);
  assert.equal(plans[2500].next.stock, 2500);
});
test('HSN text and prices update together, preserving leading zeros', (t) => {
  const f = fixture(t),
    p = buildPricePlan('Product ID,HSN/SAC,Selling Price\np1,001234,120', products);
  assert.equal(p.errors.length, 0);
  assert.equal(f.request(p.changes.map(({ name, ...c }) => c)).status, 200);
  assert.equal(f.read('p1').hsn, '001234');
  assert.equal(f.read('p1').stock, 17);
  assert.equal(f.read('p1').taxPercent, 18);
});
test('stock update is opt-in, final quantity, and uses the base unit', () => {
  const csv = 'Product ID,Stock\np1,5';
  assert.equal(buildPricePlan(csv, products).changes.length, 0);
  const p = buildPricePlan(csv, products, { allowStock: true });
  assert.deepEqual(p.changes[0].prices, { stock: 5 });
  assert.deepEqual(p.changes[0].expected, { stock: 17 });
  const records = new Map(products.map((product) => [product.id, { product }])),
    changes = p.changes.map(({ name, ...c }) => c);
  assert.throws(() => planPriceUpdate(changes, records));
  assert.equal(planPriceUpdate(changes, records, { allowStock: true })[0].next.stock, 5);
  for (const n of ['-1', '1.00001', 'NaN'])
    assert.equal(
      buildPricePlan('Product ID,Stock\np1,' + n, products, { allowStock: true }).errors.length,
      1,
    );
  const fractional = buildPricePlan('Product ID,Stock\np1,1.5', products, { allowStock: true });
  assert.equal(
    planPriceUpdate(
      fractional.changes.map(({ name, ...c }) => c),
      records,
      { allowStock: true },
    )[0].next.stock,
    1.5,
  );
});
test('stock changed by a sale after preview blocks all updates', () => {
  const records = new Map([['p1', { product: { ...products[0], stock: 16 } }]]);
  assert.throws(
    () =>
      planPriceUpdate(
        [{ id: 'p1', prices: { sellingPrice: 120, stock: 5 }, expected: { sellingPrice: 118, stock: 17 } }],
        records,
        { allowStock: true },
      ),
    { status: 409 },
  );
});
test('service stock rejected; blank stock unchanged and zero explicit', () => {
  const service = { ...products[0], kind: 'service' };
  assert.equal(buildPricePlan('Product ID,Stock\np1,3', [service], { allowStock: true }).errors.length, 1);
  assert.equal(buildPricePlan('Product ID,Stock\np1,', products, { allowStock: true }).changes.length, 0);
  assert.equal(
    buildPricePlan('Product ID,Stock\np1,0', products, { allowStock: true }).changes[0].prices.stock,
    0,
  );
});
test('HSN and stock conflict detection and server permission cannot be bypassed', () => {
  const records = new Map(products.map((product) => [product.id, { product }]));
  assert.throws(() => planPriceUpdate([{ id: 'p1', prices: { hsn: 1234 }, expected: { hsn: '' } }], records));
  assert.throws(
    () => planPriceUpdate([{ id: 'p1', prices: { hsn: '1234' }, expected: { hsn: '9999' } }], records),
    { status: 409 },
  );
  assert.throws(() =>
    planPriceUpdate([{ id: 'p1', prices: { stock: 5 }, expected: { stock: 17 } }], records, {
      allowStock: 'true',
    }),
  );
});
test('interrupted stock/HSN import restores only affected fields', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'backups'));
  const changes = [{ id: 'p1', prices: { stock: 5, hsn: '1234' }, expected: { stock: 17, hsn: '' } }];
  fs.writeFileSync(
    path.join(f.root, 'backups/price-update-abcd.json'),
    JSON.stringify({ state: 'pending', products: [products[0]], changes }),
  );
  fs.writeFileSync(
    path.join(f.root, 'products/p1.json'),
    JSON.stringify({ ...products[0], stock: 5, hsn: '1234', description: 'Preserve this' }),
  );
  installPriceUpdates(f.app, f.dependencies);
  assert.deepEqual(f.read('p1'), { ...products[0], description: 'Preserve this' });
});
test('unexpected external stock change prevents silent recovery overwrite', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'backups'));
  fs.writeFileSync(
    path.join(f.root, 'backups/price-update-abcd.json'),
    JSON.stringify({
      state: 'pending',
      products: [products[0]],
      changes: [{ id: 'p1', prices: { stock: 5 }, expected: { stock: 17 } }],
    }),
  );
  fs.writeFileSync(path.join(f.root, 'products/p1.json'), JSON.stringify({ ...products[0], stock: 7 }));
  // v1.10.86 (review) - not overwritten, and the app still starts (no throw).
  assert.doesNotThrow(() => installPriceUpdates(f.app, f.dependencies));
  assert.equal(f.read('p1').stock, 7);
  assert.equal(f.request([change()]).status, 409);
});
test('combined HSN/stock/price request requires boolean stock approval and saves exactly approved fields', (t) => {
  const f = fixture(t),
    changes = [
      {
        id: 'p1',
        prices: { stock: 5, hsn: '001234', sellingPrice: 120 },
        expected: { stock: 17, hsn: '', sellingPrice: 118 },
      },
    ];
  assert.equal(f.request(changes).status, 400);
  assert.equal(f.request(changes, { allowStock: 'true' }).status, 400);
  assert.deepEqual(f.read('p1'), products[0]);
  assert.equal(f.request(changes, { allowStock: true }).status, 200);
  assert.deepEqual(f.read('p1'), { ...products[0], stock: 5, hsn: '001234', sellingPrice: 120, rate: 120 });
});

test('malformed trailing text after quoted cells is rejected', () => {
  assert.throws(() => buildPricePlan('Name,Selling Price\n"Brush"junk,30', products));
  assert.equal(buildPricePlan('Name,Selling Price\n"Brush"  ,30', products).errors.length, 0);
});

test('failed backup does not change any product', (t) => {
  const f = fixture(t, (file) => {
    if (file.includes('backups')) throw Error('Disk full');
  });
  assert.equal(f.request([change()]).status, 500);
  assert.deepEqual(f.read('p1'), products[0]);
});

test('an incomplete initial journal blocks later saves and recovers before reuse', (t) => {
  const f = fixture(t, (file, data) => {
    if (file.includes('backups')) {
      fs.writeFileSync(file, JSON.stringify(data));
      throw Error('Storage stopped after writing the journal');
    }
  });
  assert.equal(f.request([change()]).status, 500);
  assert.deepEqual(f.read('p1'), products[0]);
  assert.equal(f.allowed().status, 503);
});

test('products saved with a UTF-8 byte-order mark can be updated', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'products/p1.json'), '\uFEFF' + JSON.stringify(products[0]));
  assert.equal(f.request([change()]).status, 200);
  assert.equal(f.read('p1').sellingPrice, 120);
});

test('failed rollback blocks later saves until restart and successful recovery', (t) => {
  let failRollback = false;
  const f = fixture(t, (file) => {
    if (file.endsWith('p2.json')) {
      failRollback = true;
      throw Error('Disk disconnected');
    }
    if (failRollback && file.endsWith('p1.json')) throw Error('Disk disconnected');
  });
  assert.equal(f.request([change(), change('p2', 30, 20)]).status, 500);
  assert.deepEqual(f.allowed(), { status: 503, passed: false });
  installPriceUpdates(f.app, {
    ...f.dependencies,
    writeJSON: (file, data) => fs.writeFileSync(file, JSON.stringify(data)),
  });
  assert.deepEqual(f.allowed(), { status: 200, passed: true });
  assert.deepEqual(f.read('p1'), products[0]);
});

test('recovery validates all stock before restoring any record', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'backups'));
  fs.writeFileSync(
    path.join(f.root, 'backups/price-update-abcd.json'),
    JSON.stringify({
      state: 'pending',
      products,
      changes: [change(), { id: 'p2', prices: { stock: 5 }, expected: { stock: 9 } }],
    }),
  );
  fs.writeFileSync(
    path.join(f.root, 'products/p1.json'),
    JSON.stringify({ ...products[0], sellingPrice: 120, rate: 120 }),
  );
  fs.writeFileSync(path.join(f.root, 'products/p2.json'), JSON.stringify({ ...products[1], stock: 7 }));
  // v1.10.86 (review) - the app still starts: nothing is restored, the journal
  // stays for review, and only this import is refused (409, says which file).
  assert.doesNotThrow(() => installPriceUpdates(f.app, f.dependencies));
  assert.equal(f.read('p1').sellingPrice, 120);
  assert.equal(f.read('p2').stock, 7);
  const r = f.request([change()]);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /could not be undone.*price-update-abcd\.json/s);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'backups/price-update-abcd.json'), 'utf8')).state, 'pending');
});

test('a drive that refuses chmod does not block the update or later saves', (t) => {
  const f = fixture(t);
  const realChmod = fs.chmodSync;
  fs.chmodSync = () => { throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' }); };
  t.after(() => { fs.chmodSync = realChmod; });
  assert.equal(f.request([change()]).status, 200);
  fs.chmodSync = realChmod;
  assert.equal(f.request([change('p2', 30, 20)]).status, 200);
});
