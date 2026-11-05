// ERR-083 guard: the server never uses a recursive mkdir (it hangs for ever
// under Windows' Controlled folder access), and makeDir / makeDirAsync make
// nested folders, are repeatable, and fail fast on a path that cannot exist.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeDir, makeDirAsync } from '../src/utils/makeDir.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-makedir-'));
try {
  const deep = path.join(root, 'a', 'b c', 'ਪੰਜਾਬ');
  makeDir(deep);
  makeDir(deep);
  assert.ok(fs.statSync(deep).isDirectory());

  const deep2 = path.join(root, 'x', 'y');
  await makeDirAsync(deep2);
  await makeDirAsync(deep2);
  assert.ok(fs.statSync(deep2).isDirectory());

  const file = path.join(root, 'file.txt');
  fs.writeFileSync(file, '');
  const t0 = Date.now();
  assert.throws(() => makeDir(path.join(file, 'sub')));
  await assert.rejects(makeDirAsync(path.join(file, 'sub2')));
  assert.ok(Date.now() - t0 < 2000);

  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.ok(!/mkdir(Sync)?\([^)]*recursive/.test(server), 'server.js must use makeDir, not a recursive mkdir (ERR-083)');
  console.log('makedir-test: 4 passed, 0 failed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
