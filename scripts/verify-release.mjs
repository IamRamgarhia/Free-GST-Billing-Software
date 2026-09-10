#!/usr/bin/env node
/**
 * verify-release.mjs — prove the ZIP a user downloads actually works.
 *
 * WHY THIS EXISTS
 * ---------------
 * v1.10.44.1 removed `src/` from the release ZIP to halve the download.
 * `server.js` had imported one file from it since v1.10.31, so the packaged
 * server exited before binding and the launcher could only report
 * "Server did not respond in 15s". That shipped for NINETEEN releases
 * (#54, @ANIM35H).
 *
 * Nothing caught it because every check — the smoke suite, the linter,
 * all manual testing — ran against the DEVELOPMENT TREE, where `src/` is
 * always present. The artefact people actually download had never been
 * started once.
 *
 * So this script refuses to take the repo's word for anything. It:
 *   1. extracts the built ZIP the way a user would,
 *   2. installs only production dependencies, as the installer does,
 *   3. starts the packaged server and waits for it to bind,
 *   4. exercises the real HTTP surface,
 *   5. runs the full smoke suite against THAT server,
 *   6. deletes the ZIP if any of it fails, so a broken build cannot ship.
 *
 * Run automatically as the last step of `npm run release:zip`.
 * Standalone: `npm run verify:release`
 */
import { existsSync, readdirSync, rmSync, mkdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(REPO_ROOT, 'release-build');

const log = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg, detail = '') => {
  log(`\n  x RELEASE VERIFICATION FAILED\n    ${msg}`);
  if (detail) log(`\n${detail}`);
  log('\n    The ZIP has been deleted. Fix the cause and rebuild.\n');
  throw new Error(msg);
};

/** Locate the ZIP just built. */
function findZip() {
  if (!existsSync(OUT_DIR)) fail('release-build/ does not exist — run `npm run release:zip` first.');
  const zips = readdirSync(OUT_DIR).filter((f) => f.endsWith('.zip'));
  if (zips.length === 0) fail('No ZIP found in release-build/.');
  // Newest wins, so repeated builds verify the current one.
  return zips
    .map((f) => ({ f, t: statSync(join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0].f;
}

/**
 * Extract with the same tooling the platform's users have. This matters:
 * PowerShell's Compress-Archive writes BACKSLASH path separators, which
 * some extractors mishandle — so we exercise the real round trip rather
 * than reading the staging folder we happen to still have on disk.
 */
function extract(zipPath, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  // Argument arrays, never an interpolated shell string: no shell is spawned,
  // so nothing in a path is interpreted. It also just works for paths with
  // spaces — and this project installs to folders like "Free GST Billing".
  const run = process.platform === 'win32'
    ? spawnSync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command',
        // Read both paths from the environment so they are never parsed as code.
        'Expand-Archive -LiteralPath $env:FGSB_ZIP -DestinationPath $env:FGSB_DEST -Force',
      ], { stdio: 'pipe', encoding: 'utf8', env: { ...process.env, FGSB_ZIP: zipPath, FGSB_DEST: dest } })
    : spawnSync('unzip', ['-q', zipPath, '-d', dest], { stdio: 'pipe', encoding: 'utf8' });

  if (run.status !== 0) {
    fail('Could not extract the ZIP.', run.stderr || run.stdout || '');
  }
}

/** Find _system/ wherever the archive put it. */
function findSystemDir(root) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (entry.name === '_system') return full;
      stack.push(full);
    }
  }
  return null;
}

/** Start the packaged server and resolve with its URL once it binds. */
function startServer(systemDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(process.execPath, ['server.js'], { cwd: systemDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      rejectPromise(new Error(`server never bound within 30s.\n\n${stderr.trim()}`));
    }, 30_000);

    proc.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/localhost:(\d+)/);
      if (m) { clearTimeout(timer); resolvePromise({ proc, url: m[0] }); }
    });
    // The whole point of #54: the failure was on stderr and nobody looked.
    proc.stderr.on('data', (d) => { stderr += String(d); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      rejectPromise(new Error(`server exited with code ${code} before binding.\n\n${stderr.trim()}`));
    });
    proc.on('error', (err) => { clearTimeout(timer); rejectPromise(err); });
  });
}

const zipName = findZip();
const zipPath = join(OUT_DIR, zipName);
const work = join(tmpdir(), `fgsb-verify-${Date.now()}`);
let server = null;

log(`\n  Verifying the packaged release — ${zipName}\n`);

try {
  log('  1/5  extracting the ZIP as a user would…');
  extract(zipPath, work);
  const systemDir = findSystemDir(work);
  if (!systemDir) fail('No _system/ folder inside the ZIP — the layout is wrong.');

  // Cheap structural checks first, so an obvious omission fails in seconds
  // rather than after a dependency install.
  for (const required of ['server.js', 'package.json', 'dist']) {
    if (!existsSync(join(systemDir, required))) {
      fail(`_system/${required} is missing from the ZIP.`);
    }
  }
  if (!existsSync(join(systemDir, 'dist', 'index.html'))) {
    fail('_system/dist/index.html is missing — the built app was not packaged.');
  }

  log('  2/5  installing production dependencies (as the installer does)…');
  const install = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: systemDir, stdio: 'pipe', shell: true, encoding: 'utf8',
  });
  if (install.status !== 0) {
    fail('npm install --omit=dev failed inside the package.', install.stderr || install.stdout);
  }

  log('  3/5  starting the packaged server…');
  server = await startServer(systemDir);
  log(`       bound at ${server.url}`);

  log('  4/5  exercising the HTTP surface…');
  const endpoints = ['/', '/api/bills', '/api/clients', '/api/products', '/api/profile'];
  for (const ep of endpoints) {
    const res = await fetch(`${server.url}${ep}`).catch((e) => {
      fail(`GET ${ep} threw: ${e.message}`);
    });
    if (!res.ok) fail(`GET ${ep} returned ${res.status} from the packaged server.`);
  }
  // The SPA must actually be served, not just a 200 from a fallback.
  const html = await (await fetch(server.url)).text();
  if (!/<div id="root">|<script/.test(html)) {
    fail('The server responded but did not serve the built app HTML.');
  }

  log('  5/5  running the smoke suite against the packaged server…');
  const smoke = spawnSync(process.execPath, [join(REPO_ROOT, 'tests', 'smoke.mjs')], {
    env: { ...process.env, APP_URL: server.url },
    stdio: 'inherit',
  });
  if (smoke.status !== 0) fail('The smoke suite failed against the packaged build.');

  log(`\n  OK — ${zipName} extracts, installs, boots and passes the suite.\n`);
} catch (err) {
  try { rmSync(zipPath, { force: true }); } catch { /* already gone */ }
  if (!/RELEASE VERIFICATION FAILED/.test(err.message)) {
    log(`\n  x RELEASE VERIFICATION FAILED\n    ${err.message}`);
    log('\n    The ZIP has been deleted. Fix the cause and rebuild.\n');
  }
  process.exitCode = 1;
} finally {
  if (server?.proc && !server.proc.killed) server.proc.kill();
  try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort */ }
}
