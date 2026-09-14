#!/usr/bin/env node
/**
 * test-update-unix.mjs — run the Linux / NAS updater for real, in Docker.
 *
 * update-unix.sh cannot run on the Windows machine releases are built on, and
 * "the script looks right" is exactly how ERR-001 and ERR-009 shipped. So this
 * starts genuine Linux containers and runs the script the way the Control
 * Panel does (`sh update-unix.sh`), against an install made from the ZIP.
 *
 *   Alpine — BusyBox sh and BusyBox unzip, no bash (the NAS case)
 *     1. an older install updates: files replaced, data untouched, data backed
 *        up first, dependencies installed, and the updated server boots
 *     2. running it again changes nothing and makes no backup
 *     3. a package whose npm install fails is rolled back to what was there
 *     4. a truncated download is refused before anything is touched
 *     5. an install NEWER than the package is never downgraded
 *     6. a git checkout is refused with instructions instead of being "updated"
 *   Debian slim — dash as /bin/sh
 *     7. with no unzip and no python it fails up front, saying what to install
 *     8. once unzip is installed, the full update works under dash
 *
 * Needs Docker and a built ZIP in release-build/ (`npm run release:zip`).
 * Run: npm run test:update-unix
 */
import { existsSync, readdirSync, statSync, mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const OUT_DIR = join(REPO_ROOT, 'release-build');
const IMAGES = { alpine: 'node:20-alpine', slim: 'node:20-bookworm-slim' };

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

const tarExe = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const extractZip = (zip, dest) => {
  mkdirSync(dest, { recursive: true });
  const r = process.platform === 'win32'
    ? run(tarExe, ['-x', '-f', zip, '-C', dest])
    : run('unzip', ['-q', zip, '-d', dest]);
  if (r.status !== 0) throw new Error(`could not extract ${zip}: ${r.stderr || r.stdout}`);
};
const makeZip = (parent, out) => {
  const r = process.platform === 'win32'
    ? run(tarExe, ['-a', '-c', '-f', out, '-C', parent, 'Free-GST-Billing'])
    : run('zip', ['-qr', out, 'Free-GST-Billing'], { cwd: parent });
  if (r.status !== 0) throw new Error(`could not create ${out}: ${r.stderr || r.stdout}`);
};

// ---------------------------------------------------------------------------
// Scripts that run INSIDE the containers. Every check is one line that appends
// PASS|FAIL <tab> name <tab> detail to a results file, so the number of checks
// can be counted from the script itself and a container that dies early can
// never read as a pass.
// ---------------------------------------------------------------------------
const PRELUDE = [
  '#!/bin/sh',
  'R="$1"',
  ': > "$R"',
  'pass() { printf "PASS\\t%s\\t%s\\n" "$1" "${2:-}" >> "$R"; }',
  'fail() { printf "FAIL\\t%s\\t%s\\n" "$1" "${2:-}" >> "$R"; }',
  'version_of() { node -p "require(\'$1/package.json\').version"; }',
  'set_version() { node -e \'const f=process.argv[1];const p=require(f);p.version=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(p,null,2))\' "$1/package.json" "$2"; }',
  'backups() { ls "$HOME/Documents/FreeGSTBill Backups" 2>/dev/null | wc -l | tr -d " "; }',
  'export HOME=/tmp/home',
];
const KEEP = '\'{"id":"keep-me"}\'';

const ALPINE = [...PRELUDE,
  'if command -v bash >/dev/null 2>&1; then fail "image has no bash (the NAS case)" "bash exists"; else pass "image has no bash (the NAS case)"; fi',
  'T=/tmp/fgsb; rm -rf "$T"; mkdir -p "$T"; cd "$T"',
  'if unzip -q /work/pkg.zip -d old > unzip.out 2>&1; then pass "release ZIP opens with BusyBox unzip"; else fail "release ZIP opens with BusyBox unzip" "$(head -c 300 unzip.out)"; fi',
  'S="$T/old/Free-GST-Billing/_system"',
  'if [ -f "$S/server.js" ]; then pass "ZIP unpacks into real folders (portable / paths)"; else fail "ZIP unpacks into real folders (portable / paths)" "$(ls old | head -n 3 | tr "\\n" " ")"; fi',
  'if [ -f "$S/update-unix.sh" ]; then pass "update-unix.sh ships inside _system/"; else fail "update-unix.sh ships inside _system/"; exit 0; fi',
  'NEWVER=$(version_of "$S")',
  '# Turn the fresh copy into an OLDER install that has data of its own.',
  'set_version "$S" 1.10.0',
  'echo OLD > "$S/dist/index.html"',
  `mkdir -p "$S/data/bills" && echo ${KEEP} > "$S/data/bills/keep-me.json"`,
  '',
  '# 1 --- a normal update',
  'FGSB_UPDATE_ZIP=/work/pkg.zip sh "$S/update-unix.sh" > /work/alpine-1.log 2>&1; code=$?',
  'if [ "$code" = 0 ]; then pass "1 update exits 0"; else fail "1 update exits 0" "exit $code - see alpine-1.log"; fi',
  'V=$(version_of "$S"); if [ "$V" = "$NEWVER" ]; then pass "1 installed version is now v$NEWVER"; else fail "1 installed version is now v$NEWVER" "got v$V"; fi',
  'if grep -q OLD "$S/dist/index.html"; then fail "1 app files were replaced" "dist/index.html is still the old one"; else pass "1 app files were replaced"; fi',
  `if [ "$(cat "$S/data/bills/keep-me.json")" = ${KEEP} ]; then pass "1 data/ is untouched"; else fail "1 data/ is untouched"; fi`,
  'B=$(ls "$HOME/Documents/FreeGSTBill Backups/"pre-update-*.tar.gz 2>/dev/null | head -n 1)',
  'if [ -n "$B" ] && tar -tzf "$B" | grep -q "data/bills/keep-me.json"; then pass "1 data was backed up before the update"; else fail "1 data was backed up before the update" "no backup holding the data"; fi',
  'if grep -q "All [0-9]* entries extracted completely" /work/alpine-1.log; then pass "1 every file was checked against the ZIP"; else fail "1 every file was checked against the ZIP"; fi',
  'if [ ! -e "$S/.update-previous" ]; then pass "1 rollback copy removed afterwards"; else fail "1 rollback copy removed afterwards"; fi',
  'if [ -d "$S/node_modules/express" ]; then pass "1 dependencies installed"; else fail "1 dependencies installed"; fi',
  '(cd "$S" && node server.js > /tmp/server.log 2>&1 &)',
  'up=""; i=0',
  'while [ $i -lt 30 ]; do',
  '  PORT=$(grep -o "localhost:[0-9]*" /tmp/server.log 2>/dev/null | head -n 1 | cut -d: -f2)',
  '  if [ -n "$PORT" ] && node -e "fetch(\'http://127.0.0.1:$PORT/api/profile\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then up="$PORT"; break; fi',
  '  sleep 1; i=$((i+1))',
  'done',
  'if [ -n "$up" ]; then pass "1 the updated server boots and answers" "port $up"; else fail "1 the updated server boots and answers" "$(tail -c 300 /tmp/server.log)"; fi',
  'pkill -f "node server.js" 2>/dev/null; sleep 1',
  '',
  '# 2 --- running it again',
  'FGSB_UPDATE_ZIP=/work/pkg.zip sh "$S/update-unix.sh" > /work/alpine-2.log 2>&1; code=$?',
  'if [ "$code" = 0 ] && grep -q "already the latest" /work/alpine-2.log; then pass "2 a second run reports already up to date"; else fail "2 a second run reports already up to date" "exit $code"; fi',
  'if [ "$(backups)" = 1 ]; then pass "2 a run with nothing to update makes no backup"; else fail "2 a run with nothing to update makes no backup" "$(backups) backups"; fi',
  '',
  '# 3 --- npm install fails half way: everything must be put back',
  'BEFORE=$(md5sum "$S/dist/index.html" | cut -d" " -f1)',
  'FGSB_UPDATE_ZIP=/work/broken.zip sh "$S/update-unix.sh" > /work/alpine-3.log 2>&1; code=$?',
  'if [ "$code" != 0 ]; then pass "3 a failed install exits non-zero" "exit $code"; else fail "3 a failed install exits non-zero"; fi',
  'V=$(version_of "$S"); if [ "$V" = "$NEWVER" ]; then pass "3 the previous version is restored" "v$V"; else fail "3 the previous version is restored" "got v$V"; fi',
  '# broken.zip ships a DIFFERENT dist/index.html, so this only passes if the swap was undone.',
  'if [ "$BEFORE" = "$(md5sum "$S/dist/index.html" | cut -d" " -f1)" ]; then pass "3 the previous app files are restored"; else fail "3 the previous app files are restored"; fi',
  'if grep -q "back in place" /work/alpine-3.log; then pass "3 the user is told the old version is back"; else fail "3 the user is told the old version is back"; fi',
  'if [ ! -e "$S/.update-previous" ]; then pass "3 rollback copy removed afterwards"; else fail "3 rollback copy removed afterwards"; fi',
  `if [ "$(cat "$S/data/bills/keep-me.json")" = ${KEEP} ]; then pass "3 data/ is untouched"; else fail "3 data/ is untouched"; fi`,
  'if node -e "require(\'$S/node_modules/express\')" 2>/dev/null; then pass "3 dependencies still load"; else fail "3 dependencies still load"; fi',
  '',
  '# 4 --- a truncated download',
  'N=$(backups)',
  'FGSB_UPDATE_ZIP=/work/truncated.zip sh "$S/update-unix.sh" > /work/alpine-4.log 2>&1; code=$?',
  'if [ "$code" != 0 ] && grep -q "Nothing was changed" /work/alpine-4.log; then pass "4 a truncated download is refused"; else fail "4 a truncated download is refused" "exit $code"; fi',
  'V=$(version_of "$S"); if [ "$V" = "$NEWVER" ] && [ "$(backups)" = "$N" ] && [ ! -e "$S/.update-previous" ]; then pass "4 nothing was changed or backed up"; else fail "4 nothing was changed or backed up" "v$V, backups $N -> $(backups)"; fi',
  '',
  '# 5 --- never downgrade',
  'cp -R "$T/old" "$T/newer"; SN="$T/newer/Free-GST-Billing/_system"; set_version "$SN" 99.0.0',
  'N=$(backups)',
  'FGSB_UPDATE_ZIP=/work/pkg.zip sh "$SN/update-unix.sh" > /work/alpine-5.log 2>&1; code=$?',
  'if [ "$code" = 0 ] && grep -q "is newer than the latest release" /work/alpine-5.log; then pass "5 a newer install is left alone"; else fail "5 a newer install is left alone" "exit $code"; fi',
  'if [ "$(version_of "$SN")" = 99.0.0 ] && [ "$(backups)" = "$N" ]; then pass "5 no downgrade and no backup"; else fail "5 no downgrade and no backup" "v$(version_of "$SN")"; fi',
  '',
  '# 6 --- a git checkout must not be "updated" with a release ZIP',
  'G=/tmp/gitcase; mkdir -p "$G/.git" "$G/release-templates/_system-scripts"',
  'cp "$S/update-unix.sh" "$G/release-templates/_system-scripts/"',
  'sh "$G/release-templates/_system-scripts/update-unix.sh" > /work/alpine-6.log 2>&1; code=$?',
  'if [ "$code" != 0 ] && grep -q "git pull" /work/alpine-6.log; then pass "6 a git checkout is refused with instructions"; else fail "6 a git checkout is refused with instructions" "exit $code"; fi',
];

const SLIM = [...PRELUDE,
  'if [ "$(readlink -f /bin/sh)" = /usr/bin/dash ] || [ "$(readlink -f /bin/sh)" = /bin/dash ]; then pass "7 /bin/sh is dash"; else fail "7 /bin/sh is dash" "$(readlink -f /bin/sh)"; fi',
  'if command -v unzip >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then fail "7 image has neither unzip nor python3"; else pass "7 image has neither unzip nor python3"; fi',
  'T=/tmp/fgsb; mkdir -p "$T"; cp -R /work/src/Free-GST-Billing "$T/old"',
  'S="$T/old/_system"; NEWVER=$(version_of "$S"); set_version "$S" 1.10.0',
  `mkdir -p "$S/data/bills" && echo ${KEEP} > "$S/data/bills/keep-me.json"`,
  'FGSB_UPDATE_ZIP=/work/pkg.zip sh "$S/update-unix.sh" > /work/slim-7.log 2>&1; code=$?',
  'if [ "$code" != 0 ] && grep -q "apt install unzip" /work/slim-7.log; then pass "7 missing unzip is explained, with the command to fix it"; else fail "7 missing unzip is explained, with the command to fix it" "exit $code"; fi',
  'if [ "$(version_of "$S")" = 1.10.0 ] && [ "$(backups)" = 0 ]; then pass "7 nothing was changed or started"; else fail "7 nothing was changed or started"; fi',
  '',
  '# 8 --- the full update under dash',
  'if apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq --no-install-recommends unzip >/dev/null 2>&1; then pass "8 unzip installed for the dash run"; else fail "8 unzip installed for the dash run" "apt-get failed - offline?"; fi',
  'FGSB_UPDATE_ZIP=/work/pkg.zip sh "$S/update-unix.sh" > /work/slim-8.log 2>&1; code=$?',
  'if [ "$code" = 0 ]; then pass "8 update exits 0 under dash"; else fail "8 update exits 0 under dash" "exit $code - see slim-8.log"; fi',
  'if [ "$(version_of "$S")" = "$NEWVER" ]; then pass "8 installed version is now v$NEWVER"; else fail "8 installed version is now v$NEWVER" "got v$(version_of "$S")"; fi',
  `if [ "$(cat "$S/data/bills/keep-me.json")" = ${KEEP} ] && [ "$(backups)" = 1 ]; then pass "8 data untouched and backed up"; else fail "8 data untouched and backed up"; fi`,
];

// ---------------------------------------------------------------------------
const results = [];
const record = (pass, name, detail = '') => {
  results.push({ pass, name });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const checksIn = (lines) => lines.filter((l) => l.includes('pass "')).length;

if (run('docker', ['version']).status !== 0) {
  console.error('\n  Docker is not running. Start Docker Desktop and try again.\n');
  process.exit(1);
}
const zipName = existsSync(OUT_DIR) && readdirSync(OUT_DIR)
  .filter((f) => f.endsWith('.zip'))
  .map((f) => ({ f, t: statSync(join(OUT_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0]?.f;
if (!zipName) {
  console.error('\n  No ZIP in release-build/. Run `npm run release:zip` first.\n');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'fgsb-update-test-'));
console.log(`\n  Testing update-unix.sh with ${zipName}\n`);
try {
  const pkgZip = join(work, 'pkg.zip');
  copyFileSync(join(OUT_DIR, zipName), pkgZip);
  extractZip(pkgZip, join(work, 'src'));

  // A package that cannot install: newer, with a dependency that does not
  // exist, and a visibly different dist/index.html so a rollback is provable.
  extractZip(pkgZip, join(work, 'broken-src'));
  const brokenSystem = join(work, 'broken-src', 'Free-GST-Billing', '_system');
  const pkg = JSON.parse(readFileSync(join(brokenSystem, 'package.json'), 'utf8'));
  pkg.version = '9.9.9';
  pkg.dependencies = { ...pkg.dependencies, 'fgsb-this-package-does-not-exist': '0.0.1' };
  writeFileSync(join(brokenSystem, 'package.json'), JSON.stringify(pkg, null, 2));
  writeFileSync(join(brokenSystem, 'dist', 'index.html'), '<!-- BROKEN PACKAGE -->');
  makeZip(join(work, 'broken-src'), join(work, 'broken.zip'));

  // A download cut off part way.
  const bytes = readFileSync(pkgZip);
  writeFileSync(join(work, 'truncated.zip'), bytes.subarray(0, Math.floor(bytes.length * 0.6)));

  const scripts = { alpine: ALPINE, slim: SLIM };
  for (const [name, lines] of Object.entries(scripts)) {
    writeFileSync(join(work, `${name}.sh`), `${lines.join('\n')}\n`);
  }

  for (const [name, image] of Object.entries(IMAGES)) {
    console.log(`  --- ${image}`);
    const r = run('docker', ['run', '--rm', '-v', `${work}:/work`, image, 'sh', `/work/${name}.sh`, `/work/results-${name}.txt`],
      { stdio: 'inherit', timeout: 25 * 60 * 1000 });
    if (r.error) record(false, `${image} container ran`, r.error.message);
    const file = join(work, `results-${name}.txt`);
    const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
    for (const line of lines) {
      const [status, check, detail] = line.split('\t');
      record(status === 'PASS', check, detail);
    }
    const expected = checksIn(scripts[name]);
    if (lines.length !== expected) {
      record(false, `${image}: all ${expected} checks ran`, `${lines.length} did`);
    }
  }
} catch (err) {
  record(false, 'test harness completed', err.message);
} finally {
  if (results.some((r) => !r.pass)) {
    for (const log of readdirSync(work).filter((f) => f.endsWith('.log'))) {
      console.log(`\n  ----- ${log}\n${readFileSync(join(work, log), 'utf8').slice(-2000)}`);
    }
  }
  try { rmSync(work, { recursive: true, force: true }); } catch { /* files made by root in a container */ }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
if (failed.length) process.exit(1);
