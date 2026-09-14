#!/usr/bin/env node
// build-release-zip.mjs — assembles the user-friendly release ZIP.
//
// Repo tree (developer-friendly): package.json / server.js / src /
// scripts / … all at root, plus release-templates/ holding the
// launcher files. This script combines them into a distributable
// with the "one visible file" flat layout the user asked for:
//
//   Free-GST-Billing/
//   ├── 🚀 Free GST Billing.hta
//   ├── 🚀 Free GST Billing.command
//   ├── 🚀 Free GST Billing.sh
//   └── _system/
//       ├── package.json
//       ├── server.js
//       ├── src/           (source, for parity with the dev repo)
//       ├── dist/          (pre-built app so the user doesn't need `npm run build`)
//       ├── scripts/
//       ├── public/
//       ├── README.md
//       ├── LICENSE
//       └── (all install/start/update/backup scripts flattened in)
//
// Usage:
//   node scripts/build-release-zip.mjs
//   node scripts/build-release-zip.mjs --outDir=./release-build
//
// Prerequisite: `npm run build` should have populated ./dist first.
// This script will refuse to proceed if dist/ is missing so users
// don't get a broken release.

import { readdirSync, statSync, existsSync, mkdirSync, rmSync, copyFileSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..');
const outArg = process.argv.find(a => a.startsWith('--outDir='));
const OUT_DIR = resolve(REPO_ROOT, outArg ? outArg.split('=')[1] : 'release-build');
const STAGING = join(OUT_DIR, 'Free-GST-Billing');
const SYSTEM = join(STAGING, '_system');

console.log('\n  Free GST Billing — Release ZIP Builder\n');

// --- Sanity checks ---
const distPath = join(REPO_ROOT, 'dist');
if (!existsSync(distPath)) {
  console.error('  ❌ dist/ not found. Run `npm run build` first.');
  process.exit(1);
}
const templates = join(REPO_ROOT, 'release-templates');
if (!existsSync(templates)) {
  console.error('  ❌ release-templates/ not found. Repo is missing files.');
  process.exit(1);
}
const pkgJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
const version = pkgJson.version;

// --- Clean staging area ---
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(SYSTEM, { recursive: true });

// --- Copy launcher files to root of staging ---
console.log('  → Copying launcher files…');
for (const f of readdirSync(templates)) {
  const src = join(templates, f);
  if (statSync(src).isFile()) copyFileSync(src, join(STAGING, f));
}

// --- Copy _system-scripts contents INTO _system/ (flattened, no subfolder) ---
console.log('  → Copying platform scripts into _system/…');
const scriptsSrc = join(templates, '_system-scripts');

// Windows PowerShell 5.1 reads a BOM-less .ps1 using the machine's ANSI
// codepage, not UTF-8. A UTF-8 arrow or em dash then decodes into a curly
// quote, and PowerShell treats curly quotes as real string delimiters -- so
// the string terminates mid-line and the whole script dies with "The string
// is missing the terminator". That shipped in v1.10.46 and broke Update,
// Backup, Move and Start for every user. Keep these scripts pure ASCII; it
// is the only encoding every codepage agrees on.
function assertAsciiOnly(dir, files) {
  const offenders = [];
  for (const f of files) {
    if (!/\.(ps1|bat|cmd)$/i.test(f)) continue;
    readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const hit = line.match(/[^\x00-\x7F]/g);
        if (hit) offenders.push(`    ${f}:${i + 1}  ${[...new Set(hit)].join(' ')}`);
      });
  }
  if (offenders.length) {
    console.error('\n  x Non-ASCII characters found in Windows scripts:');
    console.error(offenders.join('\n'));
    console.error('\n    These break PowerShell 5.1 parsing. Use ASCII instead:');
    console.error('    "-" for em dash, "..." for ellipsis, "->" for arrow.\n');
    process.exit(1);
  }
}

if (existsSync(scriptsSrc)) {
  const scriptFiles = readdirSync(scriptsSrc);
  assertAsciiOnly(scriptsSrc, scriptFiles);
  for (const f of scriptFiles) {
    copyFileSync(join(scriptsSrc, f), join(SYSTEM, f));
  }
}
assertAsciiOnly(REPO_ROOT, readdirSync(REPO_ROOT));

// --- Copy application build + runtime deps into _system/ ---
// v1.10.44.1 — Ship only what the RUNTIME needs. Previously we
// also copied `public/` (Vite source assets, ~15 MB of Tesseract
// WASM) and `src/` (React source), doubling the ZIP size because
// `dist/` already contains everything from `public/` (Vite copies
// it during build). Users don't need the source — they have
// dist/ (built app) + server.js + package.json. Postinstall
// regenerates public/tesseract/ from node_modules on first
// install if anything else needs it.
console.log('  → Copying app build + runtime files into _system/…');
const includeAtSystem = [
  'package.json',
  'package-lock.json',
  'server.js',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
];
for (const f of includeAtSystem) {
  const src = join(REPO_ROOT, f);
  if (existsSync(src)) copyFileSync(src, join(SYSTEM, f));
}

// v1.10.63 — reported (#54, @ANIM35H): the shipped server could not start.
//
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '_system/src/utils.js'
//     imported from '_system/server.js'
//
// server.js has imported `./src/utils.js` for computeInvoiceTotals since
// v1.10.31. The ZIP-slimming commit then dropped `src/` to halve the
// download, without noticing the SERVER had grown a runtime dependency on
// one file inside it. Every release since shipped a server that exits
// before binding, which the launcher reported only as "Server did not
// respond in 15s" — no mention of the real cause.
//
// src/utils.js is standalone (it imports nothing), so shipping that single
// file is the whole fix. The rest of src/ stays out.
mkdirSync(join(SYSTEM, 'src'), { recursive: true });
copyFileSync(join(REPO_ROOT, 'src', 'utils.js'), join(SYSTEM, 'src', 'utils.js'));

copyDirRecursive(join(REPO_ROOT, 'dist'), join(SYSTEM, 'dist'));
// Only ship the scripts that postinstall / release-time need — not the
// dev-only helpers (tax-test, discount-modes-test, generate-icons,
// build-release-zip). Keeps ZIP lean and reduces attack surface.
const runtimeScripts = ['bundle-tesseract-assets.mjs'];
mkdirSync(join(SYSTEM, 'scripts'), { recursive: true });
for (const s of runtimeScripts) {
  const src = join(REPO_ROOT, 'scripts', s);
  if (existsSync(src)) copyFileSync(src, join(SYSTEM, 'scripts', s));
}

// --- Create empty data folder so first-run doesn't need to mkdir ---
mkdirSync(join(SYSTEM, 'data'), { recursive: true });

// v1.10.63 (#54) — Refuse to ship a server that cannot start.
//
// The bug above was not that someone wrote bad code; it was that NOTHING
// checked the packaged output. The dev tree always has src/, so every test
// passed while the artefact users downloaded was dead on arrival for
// fifteen releases.
//
// This walks every relative import reachable from server.js INSIDE the
// staging folder and fails the build if any file is missing. It is a
// static check, so it needs no node_modules and no running server — bare
// specifiers like 'express' are resolved by npm at install time and are
// deliberately not our concern here.
function assertServerImportsResolve() {
  const missing = [];
  const seen = new Set();
  const visit = (fileAbs, fromLabel) => {
    if (seen.has(fileAbs)) return;
    seen.add(fileAbs);
    if (!existsSync(fileAbs)) {
      missing.push(`    ${fileAbs.replace(SYSTEM, '_system')}  (imported from ${fromLabel})`);
      return;
    }
    const text = readFileSync(fileAbs, 'utf8');
    // Relative import/export specifiers only.
    const specs = [...text.matchAll(/(?:^|\s)(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]/g)]
      .map((m) => m[1]);
    for (const spec of specs) {
      const target = resolve(fileAbs, '..', spec);
      visit(target, fileAbs.replace(SYSTEM, '_system'));
    }
  };
  visit(join(SYSTEM, 'server.js'), '(entry point)');

  if (missing.length) {
    console.error('\n  x The packaged server has imports that do not exist in the ZIP:');
    console.error(missing.join('\n'));
    console.error('\n    Users would see only "Server did not respond in 15s".');
    console.error('    Add the missing file(s) to the copy step above.\n');
    process.exit(1);
  }
  console.log(`  → Verified ${seen.size} server file(s) resolve inside _system/`);
}
assertServerImportsResolve();

// --- ZIP it up ---
const zipName = `Free-GST-Billing-v${version}.zip`;
const zipPath = join(OUT_DIR, zipName);
console.log(`  → Creating ${zipName}…`);
assertUnixLineEndings([STAGING, SYSTEM]);
try {
  if (process.platform === 'win32') {
    // v1.10.66 — Windows' built-in tar.exe (bsdtar, present since Windows 10
    // 1803) instead of Compress-Archive. Windows PowerShell 5.1's
    // Compress-Archive stores entry names with BACKSLASHES, which the ZIP
    // specification forbids. Windows tolerates that; unzip on Linux and macOS
    // warns, and BusyBox or Archive Utility create single files literally
    // named "Free-GST-Billing\_system\server.js". Every Linux / NAS install,
    // and the new update-unix.sh, had to fight the package itself (#59).
    const tarExe = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (!existsSync(tarExe)) {
      console.error(`  x ${tarExe} was not found. It ships with Windows 10 (1803) and later.`);
      process.exit(1);
    }
    // Argument arrays, no shell: nothing in a path is ever interpreted.
    execFileSync(tarExe, ['-a', '-c', '-f', zipPath, '-C', OUT_DIR, 'Free-GST-Billing'], { stdio: 'inherit' });
  } else {
    // Use system zip if available (macOS + most Linux).
    execFileSync('zip', ['-qr', zipName, 'Free-GST-Billing'], { cwd: OUT_DIR, stdio: 'inherit' });
  }
} catch (e) {
  console.error('  ❌ Zip step failed:', e.message);
  process.exit(1);
}
assertPortableZip(zipPath);

/**
 * v1.10.66 — a Unix script with Windows (CRLF) line endings dies in sh on its
 * first line ("set: illegal option -"). .gitattributes pins *.sh to LF, but
 * this is checked on the files actually being packaged, not the repo's promise.
 */
function assertUnixLineEndings(dirs) {
  const offenders = [];
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      if (!/\.(sh|command)$/i.test(f)) continue;
      if (readFileSync(join(dir, f), 'latin1').includes('\r')) offenders.push(`    ${join(dir, f)}`);
    }
  }
  if (offenders.length) {
    console.error('\n  x Unix scripts with Windows (CRLF) line endings:');
    console.error(offenders.join('\n'));
    console.error('\n    sh on Linux and macOS stops at the first line. Convert them to LF.\n');
    process.exit(1);
  }
}

/**
 * v1.10.66 — read the finished archive back and refuse one that only Windows
 * opens cleanly: every entry name must use "/" (the ZIP specification's only
 * separator) and the server must be where the launchers look for it.
 */
function assertPortableZip(file) {
  const buf = readFileSync(file);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) {
    console.error('\n  x The ZIP has no central directory - it is not a valid archive.\n');
    process.exit(1);
  }
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      console.error('\n  x The ZIP central directory is corrupt.\n');
      process.exit(1);
    }
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  const backslashed = names.filter((n) => n.includes('\\'));
  if (backslashed.length) {
    console.error(`\n  x ${backslashed.length} ZIP entries use "\\" as a path separator, e.g.:`);
    console.error(backslashed.slice(0, 5).map((n) => `    ${n}`).join('\n'));
    console.error('\n    Linux, macOS and NAS unzip tools cannot unpack that into folders.\n');
    process.exit(1);
  }
  if (!names.includes('Free-GST-Billing/_system/server.js')) {
    console.error('\n  x Free-GST-Billing/_system/server.js is not in the ZIP - the layout is wrong.\n');
    process.exit(1);
  }
  console.log(`  → Verified ${names.length} ZIP entries use portable "/" paths`);
}

const sizeMB = (statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`\n  ✅ Release built — ${sizeMB} MB`);
console.log(`     ${zipPath}\n`);
console.log('  Next steps:');
console.log('   1. Test locally: extract the ZIP, double-click the launcher for your OS.');
console.log('   2. Upload to GitHub Releases: gh release create v' + version + ' "' + zipPath + '"');
console.log('   3. README download link already points at latest release — no code change needed.\n');

function copyDirRecursive(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.name === 'node_modules') continue;   // never bundle
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else copyFileSync(s, d);
  }
}
