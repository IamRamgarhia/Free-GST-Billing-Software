// Unit checks for the Linux packages: the FGSB_HOME data folder (server.js)
// and the earlier-copy finder (packaging/linux/old-installs.mjs), which must
// never change an earlier copy. Plain asserts; demo data only (DiceCodes).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOldInstalls, noticeText } from '../packaging/linux/old-installs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'fgsb-linux-test-'));
const put = (p, text = '') => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
// Every file and folder under dir with its content hash and mtime.
const snapshot = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const st = statSync(p);
      out.push(`${relative(dir, p)} ${e.isDirectory() ? 'dir' : createHash('sha256').update(readFileSync(p)).digest('hex')} ${st.mtimeMs}`);
      if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return out.sort().join('\n');
};

try {
  // ---- The earlier-copy finder ----
  const home = join(tmp, 'home');
  const oneLine = join(home, '.local', 'share', 'free-gst-billing', '_system');
  put(join(oneLine, 'server.js'), '// old');
  put(join(oneLine, 'data', 'profile.json'), JSON.stringify({ name: 'DiceCodes', gstin: '29ABCDE1234F1ZW' }));
  put(join(oneLine, 'data', 'bills', 'INV-1.json'), JSON.stringify({ id: 'INV-1', client: 'DiceCodes' }));
  put(join(oneLine, 'Saved Invoices', 'DiceCodes', 'INV-1.pdf'), '%PDF-1.4 demo');
  const unzipped = join(home, 'Downloads', 'Free-GST-Billing', '_system');
  put(join(unzipped, 'server.js'), '// old, never used');
  mkdirSync(join(unzipped, 'data', 'bills'), { recursive: true }); // empty: nothing to report
  put(join(home, '.cache', 'x', '_system', 'server.js'));           // hidden: not searched
  put(join(home, '.cache', 'x', '_system', 'data', 'a.json'), '{}');
  put(join(home, 'a', 'b', 'c', 'd', '_system', 'server.js'));       // deeper than searched
  put(join(home, 'a', 'b', 'c', 'd', '_system', 'data', 'a.json'), '{}');
  const before = snapshot(home);

  const found = findOldInstalls(home);
  assert.equal(found.length, 1, 'only the copy with books is reported');
  assert.equal(found[0].system, oneLine);
  assert.equal(found[0].files, 2);
  const newHome = join(tmp, 'new-home');
  const text = noticeText(found, newHome);
  assert.match(text, /were NOT moved or changed/);
  assert.ok(text.includes(join(oneLine, 'data')), 'names the old books folder');
  assert.ok(text.includes('cp -a'), 'gives a copy command');
  assert.equal(noticeText([], newHome), '', 'no earlier copy: no notice');

  // The command the launcher runs: prints the notice and keeps it in the new home.
  const cli = execFileSync(process.execPath, [join(ROOT, 'packaging', 'linux', 'old-installs.mjs'), home, newHome], { encoding: 'utf8' });
  assert.match(cli, /books from an earlier copy/);
  assert.ok(readFileSync(join(newHome, 'OLD-BOOKS-FOUND.txt'), 'utf8').includes(oneLine));
  assert.equal(snapshot(home), before, 'the earlier copies are byte-identical, nothing added or removed');
  const empty = join(tmp, 'empty-home');
  mkdirSync(empty);
  assert.equal(execFileSync(process.execPath, [join(ROOT, 'packaging', 'linux', 'old-installs.mjs'), empty, join(tmp, 'h2')], { encoding: 'utf8' }), '');
  assert.ok(!existsSync(join(tmp, 'h2', 'OLD-BOOKS-FOUND.txt')));

  // ---- FGSB_HOME: data/, Saved Invoices/ and Trash/ move together ----
  // A relative FGSB_HOME is resolved against the working folder. The port is
  // preset in the new home (port.txt lives in data/ now), far from 47371-47373.
  const work = join(tmp, 'work');
  put(join(work, 'books', 'data', 'port.txt'), '47561');
  const nextToServer = () => ['data', 'Saved Invoices', 'Trash'].map((d) => existsSync(join(ROOT, d)));
  const repoBefore = nextToServer();
  const server = spawn(process.execPath, [join(ROOT, 'server.js')], {
    cwd: work, env: { ...process.env, FGSB_HOME: 'books', FGSB_ALLOW_UNSAFE_LAN: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  try {
    let status = null;
    for (let i = 0; i < 60 && !status; i += 1) {
      await new Promise((r) => setTimeout(r, 250));
      const port = readFileSync(join(work, 'books', 'data', 'port.txt'), 'utf8').trim();
      try { status = await (await fetch(`http://127.0.0.1:${port}/api/control-panel/status`)).json(); } catch { /* starting */ }
    }
    assert.ok(status, `server answered (log: ${log})`);
    assert.equal(status.dataFolder, join(work, 'books', 'data'));
    assert.equal(status.installKind, 'zip', 'no install-kind.txt: the ZIP updater stays');
    for (const d of [join('data', 'bills'), 'Saved Invoices', 'Trash']) assert.ok(existsSync(join(work, 'books', d)), `${d} is in FGSB_HOME`);
    assert.deepEqual(nextToServer(), repoBefore, 'no data/, Saved Invoices/ or Trash/ made next to server.js');
  } finally {
    server.kill();
  }
  console.log('linux-packaging-test: all checks passed');
} finally {
  await new Promise((r) => setTimeout(r, 500));
  rmSync(tmp, { recursive: true, force: true });
}
