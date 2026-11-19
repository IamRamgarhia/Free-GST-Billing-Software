// Exercise the normal server, not the installed app: both code and books live
// in a temporary folder, following the other *-server-test checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('product update route uses the real server guards and preserves invoices', async (t) => {
  const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-product-update-'));
  const app = path.join(temp, 'app'), books = path.join(temp, 'books');
  fs.mkdirSync(app);
  fs.mkdirSync(path.join(books, 'data', 'products'), { recursive: true });
  fs.mkdirSync(path.join(books, 'data', 'bills'));
  for (const file of ['server.js', 'package.json', 'src/utils.js',
    ...fs.readdirSync(path.join(root, 'src/utils')).filter(n => n.endsWith('.js')).map(n => 'src/utils/' + n)]) {
    fs.mkdirSync(path.dirname(path.join(app, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(app, file));
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(app, 'node_modules'), 'junction');
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  fs.writeFileSync(path.join(books, 'data/port.txt'), String(port));
  const product = { id: 'paint', name: 'Paint', sellingPrice: 118, rate: 118, stock: 10, unit: 'Pcs', taxPercent: 18 };
  const productFile = path.join(books, 'data/products/paint.json');
  fs.writeFileSync(productFile, JSON.stringify(product));
  const invoiceFile = path.join(books, 'data/bills/old.json');
  const invoice = JSON.stringify({ id: 'old', invoiceDate: '2026-01-01', items: [{ name: 'Paint', rate: 118 }] });
  fs.writeFileSync(invoiceFile, invoice);
  const child = spawn(process.execPath, [path.join(app, 'server.js')], {
    cwd: app, env: { ...process.env, FGSB_HOME: books, FGSB_PHONE_ACCESS: '', FGSB_PIN: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(base + '/api/products')).ok) { ready = true; break; } } catch { /* starting */ }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  const changes = [{ id: 'paint', prices: { sellingPrice: 120, hsn: '001234' }, expected: { sellingPrice: 118, hsn: '' } }];
  const update = headers => fetch(base + '/api/products/price-update', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ changes, allowStock: false }),
  });
  assert.equal((await update({ Origin: 'https://evil.example' })).status, 403);
  assert.equal(fs.readFileSync(productFile, 'utf8'), JSON.stringify(product));
  assert.equal((await update({ Origin: base })).status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(productFile, 'utf8')), { ...product, sellingPrice: 120, rate: 120, hsn: '001234' });
  assert.equal(fs.readFileSync(invoiceFile, 'utf8'), invoice);
  assert.equal((await update({ Origin: base })).status, 409);
  const backups = fs.readdirSync(path.join(books, 'data/backups')).filter(n => n.startsWith('price-update-'));
  assert.equal(backups.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(books, 'data/backups', backups[0]))).state, 'completed');
});
