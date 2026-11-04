#!/usr/bin/env node
// build-linux.mjs - the Linux packages and the NAS Docker image.
//
//   node scripts/build-linux.mjs deb appimage docker     (or: all)
//
// Writes to release-build/ (none of these is a .zip: the Windows updater
// takes the first .zip on a release):
//   free-gst-billing_<version>_amd64.deb
//   Free-GST-Billing-Linux-x86_64.AppImage
//   docker-compose.yml                 (+ the local image free-gst-billing:<version>)
//
// The app is staged by build-release-zip.mjs itself (into a temp folder), so
// the packages carry exactly the server files and packages the ZIP carries.
// Everything Linux-side runs inside Docker containers. Downloads (cached in
// .cache/linux-build/, each checked against its published SHA256):
//   Node.js linux-x64 from nodejs.org, appimagetool and its runtime from the
//   AppImage project's GitHub releases.
// Prerequisites: `npm run build` (dist/) and Docker with Linux containers.
// Run it AFTER `npm run release:zip`: that one empties release-build/.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'release-build');
const CACHE = join(ROOT, '.cache', 'linux-build');
const WORK = join(CACHE, 'work');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const NODE_VERSION = 'v20.19.0'; // same as release-templates/_system-scripts/ensure-node.ps1
const NODE_BASE = `https://nodejs.org/dist/${NODE_VERSION}`;
const NODE_FILE = `node-${NODE_VERSION}-linux-x64.tar.gz`;
// Pinned releases; the SHA256 values are the digests GitHub publishes for them.
const APPIMAGETOOL = {
  url: 'https://github.com/AppImage/appimagetool/releases/download/1.9.1/appimagetool-x86_64.AppImage',
  sha256: 'ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0',
};
const RUNTIME = {
  url: 'https://github.com/AppImage/type2-runtime/releases/download/20251108/runtime-x86_64',
  sha256: '2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d',
};
const BASE_IMAGE = 'debian:bookworm-slim';

const args = process.argv.slice(2);
const targets = new Set(args.includes('all') ? ['deb', 'appimage', 'docker'] : args);
if (!targets.size || [...targets].some((t) => !['deb', 'appimage', 'docker'].includes(t))) {
  console.error('usage: node scripts/build-linux.mjs deb|appimage|docker|all');
  process.exit(2);
}
const fail = (msg) => { console.error(`\n  x ${msg}\n`); process.exit(1); };
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts });
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (!existsSync(join(ROOT, 'dist', 'index.html'))) fail('dist/ not found. Run `npm run build` first.');
try { execFileSync('docker', ['info', '--format', '{{.OSType}}'], { stdio: 'pipe' }); } catch { fail('Docker is not running (Linux containers are needed).'); }

async function download(url, file, expected) {
  if (existsSync(file) && sha256(file) === expected) return;
  console.log(`  -> Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) fail(`Download failed (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const got = sha256(file);
  if (got !== expected) { rmSync(file); fail(`Checksum mismatch for ${url}\n    expected ${expected}\n    got      ${got}`); }
}

// --- 1. Stage the app exactly as the ZIP does ---
console.log(`\n  Free GST Billing - Linux packages v${version}\n`);
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });
const zipStage = join(WORK, 'zip-stage');
run(process.execPath, [join(ROOT, 'scripts', 'build-release-zip.mjs'), `--outDir=${zipStage}`]);
const system = join(zipStage, 'Free-GST-Billing', '_system');
const app = join(WORK, 'app');
// Not in a package install: the Windows scripts, the ZIP's own installer /
// starter / remover (the package manager does that), and an empty data folder
// (books never live in the program folder). update-unix.sh stays because the
// server finds the Control Panel scripts by it; install-kind.txt stops it.
const LEAVE_OUT = /\.(ps1|ico|hta)$|^(install|uninstall|start)-unix\.sh$|^(check-node|open-app)\.sh$|^data$/;
mkdirSync(app);
for (const name of readdirSync(system)) {
  if (!LEAVE_OUT.test(name)) cpSync(join(system, name), join(app, name), { recursive: true });
}
// Production packages are plain JavaScript, so the copy npm made on this PC
// runs on Linux. A package with a compiled part would not: stop here, and
// install that one inside a Linux container instead.
const native = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.node$|^binding\.gyp$/.test(e.name)) native.push(p);
  }
};
walk(join(app, 'node_modules'));
if (native.length) fail(`Packages with compiled (native) parts need a Linux build:\n    ${native.join('\n    ')}`);
console.log('  -> No native packages in the server\'s node_modules: the same files run on Linux');

// --- 2. .deb and AppImage, built in a container ---
const pkgTargets = ['deb', 'appimage'].filter((t) => targets.has(t));
if (pkgTargets.length) {
  mkdirSync(CACHE, { recursive: true });
  const sums = await (await fetch(`${NODE_BASE}/SHASUMS256.txt`)).text();
  const nodeSum = sums.split('\n').find((l) => l.endsWith(`  ${NODE_FILE}`))?.split(' ')[0];
  if (!nodeSum) fail(`${NODE_FILE} is not in ${NODE_BASE}/SHASUMS256.txt`);
  await download(`${NODE_BASE}/${NODE_FILE}`, join(CACHE, NODE_FILE), nodeSum);
  cpSync(join(CACHE, NODE_FILE), join(WORK, 'node.tar.gz'));
  if (targets.has('appimage')) {
    await download(APPIMAGETOOL.url, join(CACHE, 'appimagetool-x86_64.AppImage'), APPIMAGETOOL.sha256);
    await download(RUNTIME.url, join(CACHE, 'runtime-x86_64'), RUNTIME.sha256);
    cpSync(join(CACHE, 'appimagetool-x86_64.AppImage'), join(WORK, 'appimagetool'));
    cpSync(join(CACHE, 'runtime-x86_64'), join(WORK, 'runtime-x86_64'));
  }
  cpSync(join(ROOT, 'packaging'), join(WORK, 'packaging'), { recursive: true });
  for (const f of ['free-gst-billing', 'build-in-container.sh', 'old-installs.mjs', 'free-gst-billing.desktop']) {
    if (readFileSync(join(WORK, 'packaging', 'linux', f), 'latin1').includes('\r')) fail(`packaging/linux/${f} has Windows (CRLF) line endings.`);
  }
  run('docker', ['run', '--rm', '-v', `${WORK}:/work`, '-e', `VERSION=${version}`, BASE_IMAGE,
    'sh', '/work/packaging/linux/build-in-container.sh', ...pkgTargets]);
  for (const f of readdirSync(join(WORK, 'out'))) cpSync(join(WORK, 'out', f), join(OUT, f));
}

// --- 3. Docker image (local only, never pushed) ---
if (targets.has('docker')) {
  const ctx = join(WORK, 'docker');
  mkdirSync(ctx);
  cpSync(app, join(ctx, 'app'), { recursive: true });
  run('docker', ['build', '--pull=false', '-t', `free-gst-billing:${version}`, '-f', join(ROOT, 'packaging', 'docker', 'Dockerfile'), ctx]);
  writeFileSync(join(OUT, 'docker-compose.yml'),
    readFileSync(join(ROOT, 'packaging', 'docker', 'docker-compose.yml'), 'utf8').replace(/\r/g, '').replace('__VERSION__', version));
}

console.log('\n  Built:');
const outputs = [`free-gst-billing_${version}_amd64.deb`, 'Free-GST-Billing-Linux-x86_64.AppImage', 'docker-compose.yml'];
for (const f of outputs.filter((n) => existsSync(join(OUT, n)))) {
  console.log(`    ${join(OUT, f)}  ${(statSync(join(OUT, f)).size / 1024 / 1024).toFixed(1)} MB`);
}
if (targets.has('docker')) console.log(`    docker image free-gst-billing:${version} (local)`);
console.log('');
