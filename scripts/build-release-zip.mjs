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
import { execSync } from 'child_process';
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
if (existsSync(scriptsSrc)) {
  for (const f of readdirSync(scriptsSrc)) {
    copyFileSync(join(scriptsSrc, f), join(SYSTEM, f));
  }
}

// --- Copy application source + build into _system/ ---
console.log('  → Copying app source + build into _system/…');
const includeAtSystem = [
  'package.json',
  'package-lock.json',
  'server.js',
  'vite.config.js',
  'index.html',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  '.gitignore',
];
for (const f of includeAtSystem) {
  const src = join(REPO_ROOT, f);
  if (existsSync(src)) copyFileSync(src, join(SYSTEM, f));
}
copyDirRecursive(join(REPO_ROOT, 'src'), join(SYSTEM, 'src'));
copyDirRecursive(join(REPO_ROOT, 'dist'), join(SYSTEM, 'dist'));
copyDirRecursive(join(REPO_ROOT, 'scripts'), join(SYSTEM, 'scripts'));
copyDirRecursive(join(REPO_ROOT, 'public'), join(SYSTEM, 'public'));

// --- Create empty data folder so first-run doesn't need to mkdir ---
mkdirSync(join(SYSTEM, 'data'), { recursive: true });

// --- ZIP it up ---
const zipName = `Free-GST-Billing-v${version}.zip`;
const zipPath = join(OUT_DIR, zipName);
console.log(`  → Creating ${zipName}…`);
try {
  if (process.platform === 'win32') {
    // Use PowerShell's Compress-Archive; it ships with every Windows install.
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${STAGING}' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  } else {
    // Use system zip if available (macOS + most Linux).
    execSync(`cd "${OUT_DIR}" && zip -qr "${zipName}" "Free-GST-Billing"`, { stdio: 'inherit' });
  }
} catch (e) {
  console.error('  ❌ Zip step failed:', e.message);
  process.exit(1);
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
