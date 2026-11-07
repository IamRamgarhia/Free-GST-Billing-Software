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
// The Setup's Node.js version is SETUP_NODE_VERSION below (22 LTS); the ZIP's
// is still ensure-node.ps1's $PortableNodeVersion (20), so ZIP users move later.
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

// The Setup carries its own Node.js: 22 LTS ("Jod", supported until April
// 2027). Node.js 20 is past its end of life (April 2026). Only the Setup moves
// now: the ZIP keeps ensure-node.ps1's $PortableNodeVersion until its users
// are moved in a later release. A newer 22.x: change it here (the SHA-256 is
// checked against nodejs.org's SHASUMS256.txt on download).
const SETUP_NODE_VERSION = 'v22.23.4';

// The official portable node.exe, checked against nodejs.org's checksums.
async function portableNode() {
  const nodeVersion = SETUP_NODE_VERSION;
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

// 3. The app's own window, Free GST Billing.exe (installer/host): compiled with
// the C# compiler that is part of Windows (.NET Framework 4.x, no SDK), with
// Microsoft's WebView2 SDK (NuGet Microsoft.Web.WebView2 1.0.4258.31, its
// files checked against these SHA-256s; a new SDK version: new hashes here).
// WEBVIEW2_SDK=<the unpacked package> or .installer-cache/webview2-sdk/pkg (not release-build/: release:zip empties it).
{
  const sdk = resolve(process.env.WEBVIEW2_SDK || join(ROOT, '.installer-cache', 'webview2-sdk', 'pkg'));
  const pinned = {
    'lib/net462/Microsoft.Web.WebView2.Core.dll': 'd60e6e94245078cb56e44ebd5f360dc04bf18e460136be93bfc4cfca43b98505',
    'lib/net462/Microsoft.Web.WebView2.WinForms.dll': '6a9e6856f23c463783c3afb0ca5d78f56324c86657162ccb16d5227b3233b32a',
    'runtimes/win-x64/native/WebView2Loader.dll': '3426dcc55fdfb8b5e7ac623cf33b4ccf283fbf68a0c5a65bddfdb4d749a8abee',
  };
  for (const [rel, sha] of Object.entries(pinned)) {
    const src = join(sdk, rel);
    if (!existsSync(src)) fail(`${src} is missing. Unpack the NuGet package Microsoft.Web.WebView2 1.0.4258.31 there, or set WEBVIEW2_SDK=<folder>.`);
    const buf = readFileSync(src);
    if (createHash('sha256').update(buf).digest('hex') !== sha) fail(`${src} is not the checked WebView2 SDK file (SHA-256 differs). Not used.`);
    writeFileSync(join(APP, rel.split('/').pop()), buf);
  }
  const fw = join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
  const csc = join(fw, 'csc.exe');
  if (!existsSync(csc)) fail(`${csc} not found (the .NET Framework 4 C# compiler that comes with Windows).`);
  // WPF's assemblies (part of .NET Framework 4) for the taskbar jump list only.
  const wpf = ['WPF\\PresentationFramework.dll', 'WPF\\PresentationCore.dll', 'WPF\\WindowsBase.dll', 'System.Xaml.dll'].map((f) => `/r:${join(fw, f)}`);
  run(csc, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', `/win32icon:${join(APP, 'app-icon.ico')}`,
    `/out:${join(APP, 'Free GST Billing.exe')}`, `/r:${join(APP, 'Microsoft.Web.WebView2.Core.dll')}`, ...wpf,
    `/r:${join(APP, 'Microsoft.Web.WebView2.WinForms.dll')}`, '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Web.Extensions.dll',
    join(ROOT, 'installer', 'host', 'FreeGSTBilling.cs')]);
}

// Microsoft's WebView2 Runtime installer (Evergreen bootstrapper, from
// https://go.microsoft.com/fwlink/p/?LinkId=2124703), which Setup runs only on
// a PC without the runtime. Checked: this SHA-256 (a newer download needs a
// new hash here) and a valid Microsoft Corporation signature.
// WEBVIEW2_BOOTSTRAPPER=<file> or .installer-cache/webview2-bootstrapper/.
const bootstrapper = resolve(process.env.WEBVIEW2_BOOTSTRAPPER || join(ROOT, '.installer-cache', 'webview2-bootstrapper', 'MicrosoftEdgeWebview2Setup.exe'));
{
  if (!existsSync(bootstrapper)) fail(`${bootstrapper} is missing. Download it from https://go.microsoft.com/fwlink/p/?LinkId=2124703, or set WEBVIEW2_BOOTSTRAPPER=<file>.`);
  const sha = createHash('sha256').update(readFileSync(bootstrapper)).digest('hex');
  if (sha !== 'cf2f2445fef0c5c14e372045f84998771eeb8bb01d59be4afd00692fa160082e') fail(`${bootstrapper} is not the checked WebView2 installer (SHA-256 ${sha}). Not used.`);
  const sig = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$s = Get-AuthenticodeSignature -LiteralPath '${bootstrapper.replace(/'/g, "''")}'; [string]$s.Status + '|' + $s.SignerCertificate.Subject`], { encoding: 'utf8' }).trim();
  if (!/^Valid\|CN=Microsoft Corporation,/.test(sig)) fail(`${bootstrapper}: signature is not a valid Microsoft one (${sig}). Not used.`);
}

// Every program file of this version: an update removes the old version's
// leftovers in dist / node_modules / src only AFTER all of these are in place
// (setup-helper.mjs prune), so a failed update never leaves a broken app.
{
  const files = readdirSync(APP, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name).slice(APP.length + 1).split('\\').join('/'));
  writeFileSync(join(APP, 'installed-files.txt'), [...files, 'installed-files.txt'].sort().join('\n'));
}

// 4. Node.js, and compile.
const { exe: nodeExe, nodeVersion } = await portableNode();
mkdirSync(OUT_DIR, { recursive: true });
run(iscc, ['/Q', `/DAppVersion=${version}`, `/DStageDir=${APP}`, `/DNodeExe=${nodeExe}`, `/DBootstrapper=${bootstrapper}`, `/DOutputDir=${OUT_DIR}`,
  join(ROOT, 'installer', 'free-gst-billing.iss')]);
rmSync(STAGE_ROOT, { recursive: true, force: true });

const setup = join(OUT_DIR, 'Free-GST-Billing-Windows-Setup.exe');
if (!existsSync(setup)) fail(`${setup} was not made.`);
// GitHub publishes each release asset's SHA-256 (the updater checks it); this
// file is for people who check by hand.
const setupSha = createHash('sha256').update(readFileSync(setup)).digest('hex');
writeFileSync(`${setup}.sha256`, `${setupSha}  Free-GST-Billing-Windows-Setup.exe\n`);
console.log(`  SHA-256 ${setupSha}`);
console.log(`\n  OK  ${setup}`);
console.log(`      ${(statSync(setup).size / 1024 / 1024).toFixed(1)} MB, version ${version}, Node.js ${nodeVersion}, unsigned (SmartScreen: More info -> Run anyway)\n`);
