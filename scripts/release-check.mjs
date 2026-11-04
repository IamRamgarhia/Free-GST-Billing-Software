// npm run release:check - the last automated check before publishing a
// release. Run it after `npm run release:zip` and `npm run docs:zip`.
// Every check here exists because the mistake it catches already happened
// once (the ERR numbers point to docs/KNOWN_ERRORS.md). The manual checks that
// a script cannot do are in docs/PRE_RELEASE_CHECKS.md.
//
//   npm run release:check              all checks (needs internet for GitHub)
//   npm run release:check -- --offline skip the GitHub checks
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSupporters } from '../src/utils/supporters.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = 'IamRamgarhia/Free-GST-Billing-Software';
const offline = process.argv.includes('--offline');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let failed = 0;
const ok = (label) => console.log(`  ✓ ${label}`);
const bad = (label, why) => { failed += 1; console.log(`  ✗ ${label}\n      ${why}`); };
const check = (label, cond, why) => (cond ? ok(label) : bad(label, why));
const cmpVer = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

// ZIP central directory: [{ name, mode }]
function zipEntries(file) {
  const b = readFileSync(file);
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const out = []; let p = b.readUInt32LE(eocd + 16);
  for (let i = 0, n = b.readUInt16LE(eocd + 10); i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) return null;
    const nl = b.readUInt16LE(p + 28); const el = b.readUInt16LE(p + 30); const cl = b.readUInt16LE(p + 32);
    out.push({ name: b.toString('utf8', p + 46, p + 46 + nl), mode: (b.readUInt32LE(p + 38) >>> 16) & 0o7777 });
    p += 46 + nl + el + cl;
  }
  return out;
}

const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
console.log(`\nRelease check for v${version}\n`);

console.log('Version and changelog');
const lock = JSON.parse(read('package-lock.json'));
check('package-lock.json has the same version', lock.version === version && lock.packages?.['']?.version === version,
  `package-lock.json says ${lock.version} / ${lock.packages?.['']?.version}. Bump both "version" fields.`);
check('docs-site/site.mjs has the same version', read('docs-site/site.mjs').includes(`version: '${version}'`),
  `Set version: '${version}' in docs-site/site.mjs (the docs show it).`);
const changelog = read('CHANGELOG.md').split('\r\n').join('\n');
const top = /^## \[([^\]]+)\] - (.+)$/m.exec(changelog);
check('CHANGELOG starts with this version', top && top[1] === version, `The first entry is ${top ? top[1] : 'missing'}; add "## [${version}] - YYYY-MM-DD" at the top.`);
check('...and it is dated (not "unreleased")', top && /^\d{4}-\d{2}-\d{2}$/.test(top[2].trim()), `Replace "${top?.[2]}" with today's date.`);
const entry = top ? changelog.slice(top.index, changelog.indexOf('\n---\n', top.index)) : '';
check('...with a "How to update" block (RELEASE_CHECKLIST)', /### How to update/.test(entry) && new RegExp(`New version:\\*\\*\\s*${version.replace(/\./g, '\\.')}`).test(entry) && /Free-GST-Billing\.zip/.test(entry),
  'Copy the How to update block from docs/RELEASE_CHECKLIST.md: current → new version, the Update button, and the manual Free-GST-Billing.zip steps.');

console.log('\nRelease ZIP');
const appZip = join(ROOT, 'release-build', `Free-GST-Billing-v${version}.zip`);
if (!existsSync(appZip)) bad('release-build ZIP exists', `Run npm run release:zip (it builds ${appZip}).`);
else {
  const e = zipEntries(appZip);
  check('ZIP is readable', !!e, 'The ZIP central directory is corrupt; rebuild it.');
  if (e) {
    check('every path uses "/" (ERR-014, ERR-061)', !e.some((x) => x.name.includes('\\')), 'Backslash paths unpack as flat files on Linux / Mac. Build with npm run release:zip, never Compress-Archive.');
    check('server.js is at Free-GST-Billing/_system/', e.some((x) => x.name === 'Free-GST-Billing/_system/server.js'), 'The layout is wrong; the launchers will not find the app.');
    for (const l of ['Free GST Billing - WINDOWS.hta', 'Free GST Billing - MAC.command', 'Free GST Billing - LINUX.sh', 'READ ME FIRST.txt']) {
      check(`${l} is in the ZIP`, e.some((x) => x.name === `Free-GST-Billing/${l}`), `${l} is missing from the ZIP.`);
    }
    const scripts = e.filter((x) => /\.(command|sh)$/.test(x.name));
    check(`all ${scripts.length} .command / .sh files are executable (ERR-062, #120)`, scripts.length > 0 && scripts.every((x) => x.mode & 0o111),
      `Not executable: ${scripts.filter((x) => !(x.mode & 0o111)).map((x) => x.name).join(', ')}. macOS: "you do not have appropriate access privileges".`);
    const ps1 = e.filter((x) => x.name.endsWith('.ps1')).map((x) => x.name.split('/').pop());
    check('ensure-node.ps1 ships with the scripts that use it (#109)', ps1.includes('ensure-node.ps1') && e.some((x) => x.name.endsWith('/check-node.sh')), 'ensure-node.ps1 / check-node.sh missing: install, update and start would fail.');
    // v1.10.83 - the packages ship inside the ZIP: no user's PC runs npm.
    check('node_modules ships inside the ZIP (no npm install on users\' PCs)', e.some((x) => x.name === 'Free-GST-Billing/_system/node_modules/express/package.json'),
      '_system/node_modules/express is missing. Build with npm run release:zip (it runs npm ci in the staging folder).');
    check('ZIP size looks right (12-60 MB; the server packages only)', statSync(appZip).size > 1.2e7 && statSync(appZip).size < 6e7, `It is ${(statSync(appZip).size / 1e6).toFixed(1)} MB.`);
  }
}
// v1.10.84 - the Windows Setup (docs/WINDOWS_SETUP.md). Reported, not
// required, until the maintainer ships it with every release.
const setupExe = join(ROOT, 'release-build', 'Free-GST-Billing-Windows-Setup.exe');
if (existsSync(setupExe)) check('Windows Setup exe looks right (20-60 MB)', statSync(setupExe).size > 2e7 && statSync(setupExe).size < 6e7, `It is ${(statSync(setupExe).size / 1e6).toFixed(1)} MB.`);
else console.log('  - Windows Setup not built (npm run release:exe after release:zip); installed copies update from it once it is on a release.');

console.log('\nDocs ZIP');
const docsZip = join(ROOT, 'release-build', `docs-v${version}.zip`);
if (!existsSync(docsZip)) bad('docs ZIP exists', 'Run npm run docs:zip, then upload it to dicecodes.com.');
else {
  const e = zipEntries(docsZip) || [];
  check('every path uses "/" (ERR-061: links 404 on the host)', e.length > 0 && !e.some((x) => x.name.includes('\\')), 'Rebuild with npm run docs:zip.');
  check('index.html and support.html are inside free-gst-software-documentation/', ['index.html', 'support.html'].every((f) => e.some((x) => x.name === `free-gst-software-documentation/${f}`)), 'The folder layout is wrong.');
}

console.log('\nScripts that users run');
const tdir = join(ROOT, 'release-templates', '_system-scripts');
const nonAscii = readdirSync(tdir).filter((f) => f.endsWith('.ps1') && /[^\x00-\x7F]/.test(readFileSync(join(tdir, f), 'latin1')));
check('every .ps1 is plain ASCII (ERR-001: Windows PowerShell misreads it)', !nonAscii.length, `Non-ASCII in ${nonAscii.join(', ')}.`);
const unixScripts = [...readdirSync(tdir).filter((f) => f.endsWith('.sh')).map((f) => join(tdir, f)), join(ROOT, 'release-templates', 'Free GST Billing - MAC.command'), join(ROOT, 'release-templates', 'Free GST Billing - LINUX.sh'), join(ROOT, 'install.sh')];
const crlf = unixScripts.filter((f) => readFileSync(f, 'latin1').includes('\r'));
check('every .sh / .command uses LF line endings (ERR-014)', !crlf.length, `CRLF in ${crlf.join(', ')}.`);
check('READ ME FIRST.txt is plain ASCII', !/[^\x00-\x7F]/.test(read('release-templates/READ ME FIRST.txt')), 'Notepad on some PCs garbles other characters.');

// Errors users reported, each with the cheapest check that would catch it
// coming back (the 30 Oct 2026 guard audit of docs/KNOWN_ERRORS.md).
console.log('\nErrors users reported stay fixed');
const hta = read('release-templates/Free GST Billing - WINDOWS.hta');
check('ERR-002 the launcher says UTF-8 and is plain ASCII', /charset=utf-8/i.test(hta) && !/[^\x00-\x7F]/.test(hta), 'Its text turns into garbage on Indian-locale Windows.');
check('ERR-017 the launcher spots being run from inside the ZIP', hta.includes("'\\\\appdata\\\\local\\\\temp\\\\'"), 'Run from the ZIP it said "_system missing" instead of "extract first".');
const csp = (/http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(read('src/index.html')) || [])[1] || '';
const cspHas = (dir, src) => new RegExp(`${dir}[^;]*\\s${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|;|$)`).test(csp);
check('ERR-004 the security policy allows the print frame, workers and blob images', ['frame-src', 'worker-src', 'img-src'].every((d) => cspHas(d, 'blob:')), 'Print, PDF or OCR is blocked by src/index.html.');
const minNode = Number((/\$MinNodeMajor\s*=\s*(\d+)/.exec(readFileSync(join(tdir, 'ensure-node.ps1'), 'utf8')) || [])[1]);
check('ERR-060 the scripts and package.json agree on the oldest Node.js', minNode === Number((/(\d+)/.exec(pkg.engines?.node || '') || [])[1]), `ensure-node.ps1 says ${minNode}, package.json engines says ${pkg.engines?.node}.`);
const psdrive = [...readdirSync(tdir).filter((f) => f.endsWith('.ps1')).map((f) => join(tdir, f)), join(ROOT, 'install.ps1')]
  .filter((f) => /Get-PSDrive/.test(readFileSync(f, 'utf8')) && !(/AvailableFreeSpace/.test(readFileSync(f, 'utf8')) && /-le 0/.test(readFileSync(f, 'utf8'))));
check('ERR-067 free-space checks treat "0 MB free" as unknown', !psdrive.length, `${psdrive.join(', ')}: Get-PSDrive alone reported 0 MB free and blocked installs.`);
const srcFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(join(dir, e.name)) : /\.(jsx?|html)$/.test(e.name) ? [join(dir, e.name)] : []));
const installPrompt = srcFiles(join(ROOT, 'src')).filter((f) => readFileSync(f, 'utf8').includes('beforeinstallprompt'));
check('ERR-072 the app does not offer the browser\'s "Install app" icon', !installPrompt.length, `${installPrompt.join(', ')}: that icon cannot start the app ("Needs a Quick Start").`);

console.log('\nLive data the app reads');
let sup = null; try { sup = parseSupporters(JSON.parse(read('supporters.json'))); } catch { /* reported below */ }
check('supporters.json is valid (the app hides the tracker otherwise)', !!sup, 'Fix supporters.json (use scripts/add-supporter.mjs).');

console.log('\nGit');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
check('on branch main', git('rev-parse', '--abbrev-ref', 'HEAD') === 'main', 'Release from main.');
const dirty = git('status', '--porcelain');
check('everything is committed', !dirty, `Uncommitted:\n      ${dirty.split('\n').slice(0, 8).join('\n      ')}`);

if (!offline) {
  console.log('\nGitHub');
  try {
    const gh = (...a) => execFileSync('gh', a, { cwd: ROOT, encoding: 'utf8' }).trim();
    const latest = gh('api', `repos/${REPO}/releases/latest`, '--jq', '.tag_name').replace(/^v/, '');
    check(`v${version} is newer than the latest release (v${latest})`, cmpVer(version, latest) > 0, 'This version is already released. Bump the version.');
    const mainVer = JSON.parse(gh('api', `repos/${REPO}/contents/package.json`, '--jq', '.content').split('\n').map((l) => Buffer.from(l, 'base64').toString()).join('')).version;
    check(`main on GitHub still says the last release (${mainVer}) until this release is pushed (ERR-057)`, mainVer === latest || mainVer === version,
      `main says ${mainVer} but the latest release is ${latest}: every user is offered an update that does not exist yet.`);
  } catch (err) {
    bad('GitHub reachable (gh)', `${err.message.split('\n')[0]} - run gh auth status, or use --offline and check by hand.`);
  }
}

console.log(failed ? `\n✗ ${failed} check(s) failed. Fix them before publishing.\n` : '\n✓ All automated checks passed. Now the manual ones in docs/PRE_RELEASE_CHECKS.md.\n');
process.exit(failed ? 1 : 0);
