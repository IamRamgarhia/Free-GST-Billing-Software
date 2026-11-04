#!/usr/bin/env node
// build-installer.mjs - builds the Windows Setup (v1.10.84):
//   release-build/Free-GST-Billing-Windows-Setup.exe
//
//   npm run release:exe                        build dist, stage, compile
//   node scripts/build-installer.mjs --skip-build          dist/ is already built
//   node scripts/build-installer.mjs --version=1.10.99     stamp another version
//                                                          (testing an update)
//   node scripts/build-installer.mjs --outDir=<folder>     put the .exe elsewhere
//
// Needs Inno Setup 6 (ISCC.exe; found in the usual folders, or set ISCC=<path>).
// The app is staged by build-release-zip.mjs itself (--no-zip), so the Setup
// carries exactly what the ZIP carries: dist, server.js, the server's
// production packages. Then the ZIP-only files are taken out and the official
// portable node.exe is added - downloaded once from nodejs.org into
// .installer-cache/ and checked against nodejs.org's SHASUMS256.txt.
// The Node.js version is ensure-node.ps1's $PortableNodeVersion: one place.
//
// docs/WINDOWS_SETUP.md explains the Setup for maintainers.

import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync, execSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const OUT_DIR = resolve(ROOT, arg('outDir') || 'release-build');
const STAGE_ROOT = join(ROOT, 'release-build', 'installer-stage');
const APP = join(STAGE_ROOT, 'Free-GST-Billing', '_system');
const CACHE = join(ROOT, '.installer-cache');

const fail = (msg) => { console.error(`\n  x ${msg}\n`); process.exit(1); };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });

if (process.platform !== 'win32') fail('The Windows Setup is built on Windows (Inno Setup).');
const version = arg('version') || JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Version "${version}" is not like 1.10.84.`);

function findIscc() {
  const places = [process.env.ISCC,
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
    join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe')];
  return places.find((p) => p && existsSync(p)) || null;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) fail(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// The official portable node.exe, checked against nodejs.org's checksums.
async function portableNode() {
  const ps = readFileSync(join(ROOT, 'release-templates', '_system-scripts', 'ensure-node.ps1'), 'utf8');
  const nodeVersion = (/\$PortableNodeVersion = '(v\d+\.\d+\.\d+)'/.exec(ps) || [])[1];
  if (!nodeVersion) fail('$PortableNodeVersion not found in ensure-node.ps1.');
  const name = `node-${nodeVersion}-win-x64`;
  const exe = join(CACHE, name, 'node.exe');
  if (existsSync(exe)) return { exe, nodeVersion };
  mkdirSync(CACHE, { recursive: true });
  console.log(`  -> Downloading Node.js ${nodeVersion} (portable, win-x64) from nodejs.org...`);
  const sums = (await download(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`)).toString('utf8');
  const want = (new RegExp(`^([0-9a-f]{64})\\s+${name}\\.zip$`, 'm').exec(sums) || [])[1];
  if (!want) fail(`${name}.zip is not in SHASUMS256.txt.`);
  const zip = await download(`https://nodejs.org/dist/${nodeVersion}/${name}.zip`);
  const got = createHash('sha256').update(zip).digest('hex');
  if (got !== want) fail(`${name}.zip does not match nodejs.org's SHA-256 (got ${got}, expected ${want}). Not used.`);
  console.log(`  -> SHA-256 matches nodejs.org: ${got}`);
  const zipPath = join(CACHE, `${name}.zip`);
  writeFileSync(zipPath, zip);
  const tar = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  run(tar, ['-x', '-f', zipPath, '-C', CACHE, `${name}/node.exe`]);
  rmSync(zipPath);
  if (!existsSync(exe)) fail(`node.exe was not in ${name}.zip.`);
  return { exe, nodeVersion };
}

console.log(`\n  Free GST Billing - Windows Setup builder (v${version})\n`);
const iscc = findIscc();
if (!iscc) fail('Inno Setup 6 is not installed (ISCC.exe not found). Install it from https://jrsoftware.org/isdl.php, or set ISCC=<path to ISCC.exe>.');

// 1. The app, built and staged exactly as for the ZIP.
if (!process.argv.includes('--skip-build')) execSync('npm run build', { stdio: 'inherit', cwd: ROOT });
run(process.execPath, [join(ROOT, 'scripts', 'build-release-zip.mjs'), `--outDir=${STAGE_ROOT}`, '--no-zip']);

// 2. Out: what only the ZIP uses. The Setup updates and removes the app
// itself, and the books are never in the program folder.
const zipOnly = ['install-windows.ps1', 'update-windows.ps1', 'move-windows.ps1', 'uninstall-windows.ps1'];
for (const f of readdirSync(APP)) {
  if (zipOnly.includes(f) || /\.(sh|command)$/.test(f) || f === 'data') rmSync(join(APP, f), { recursive: true, force: true });
}
if (arg('version')) {
  const p = join(APP, 'package.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), version }, null, 2));
}

// 3. Node.js, and compile.
const { exe: nodeExe, nodeVersion } = await portableNode();
mkdirSync(OUT_DIR, { recursive: true });
run(iscc, ['/Q', `/DAppVersion=${version}`, `/DStageDir=${APP}`, `/DNodeExe=${nodeExe}`, `/DOutputDir=${OUT_DIR}`,
  join(ROOT, 'installer', 'free-gst-billing.iss')]);
rmSync(STAGE_ROOT, { recursive: true, force: true });

const setup = join(OUT_DIR, 'Free-GST-Billing-Windows-Setup.exe');
if (!existsSync(setup)) fail(`${setup} was not made.`);
console.log(`\n  OK  ${setup}`);
console.log(`      ${(statSync(setup).size / 1024 / 1024).toFixed(1)} MB, version ${version}, Node.js ${nodeVersion}, unsigned (SmartScreen: More info -> Run anyway)\n`);
