#!/usr/bin/env node
// test-linux-packages.mjs - installs and runs the built Linux packages in
// clean containers (npm run release:linux first). Demo data only (DiceCodes).
//
//   node scripts/test-linux-packages.mjs [deb] [appimage] [docker]   (default: all)
//
// .deb (Debian 12 and Ubuntu 24.04): install, launch headless as a normal
//   user, server answers on 127.0.0.1 only, books land in FGSB_HOME, the
//   Update button says "download the new .deb", a second launch starts no
//   second server, a fake earlier ZIP copy is reported and stays
//   byte-identical (sha256 of every file before / after), and apt remove
//   leaves the books.
// AppImage: runs without FUSE (extract-and-run), FGSB_HOME used, same checks.
// Docker: the docker-compose.yml (on a test port), non-root, books in the
//   volume, hardening, time zone; without FGSB_ALLOW_UNSAFE_LAN nothing
//   outside the container reaches it.
// Never uses ports 47371-47373 on this PC: Docker tests publish 47581.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'release-build');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const DEB = `free-gst-billing_${version}_amd64.deb`;
const APPIMAGE = 'Free-GST-Billing-Linux-x86_64.AppImage';
const IMAGE = `free-gst-billing:${version}`;
const HOST_PORT = 47581;

const want = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['deb', 'appimage', 'docker']);
const results = [];
const record = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`); };
const docker = (args, opts = {}) => spawnSync('docker', args, { encoding: 'utf8', ...opts });

// Shared shell for the package tests (runs as root in the container).
const COMMON = String.raw`
set -eu
fail() { echo "FAIL: $*"; exit 1; }
id shop >/dev/null 2>&1 || useradd -m -s /bin/sh shop
H=/home/shop
as() { runuser -u shop -- env HOME=$H FGSB_NO_BROWSER=1 "$@"; }
# A fake earlier ZIP install (one-line install's folder) and an unzipped copy, with DiceCodes demo books.
as sh -c '
  for S in "$HOME/.local/share/free-gst-billing/_system" "$HOME/Free-GST-Billing/_system"; do
    mkdir -p "$S/data/bills" "$S/Saved Invoices/DiceCodes/2026-11"
    echo "// old server" > "$S/server.js"
    printf "{\"companyName\":\"DiceCodes\",\"gstin\":\"29ABCDE1234F1ZW\"}" > "$S/data/profile.json"
    printf "{\"id\":\"INV-1\",\"client\":\"DiceCodes\",\"total\":1180}" > "$S/data/bills/INV-1.json"
    printf "%%PDF-1.4 demo" > "$S/Saved Invoices/DiceCodes/2026-11/INV-1.pdf"
    echo 47371 > "$S/data/port.txt"
  done'
OLD="$H/.local/share/free-gst-billing $H/Free-GST-Billing"
snap() { find $OLD -printf '%p %M %u %s %T@\n' | sort; find $OLD -type f -exec sha256sum {} + | sort; }
snap > /tmp/old-before
echo "HASH old installs before: $(sha256sum < /tmp/old-before | cut -c1-16)"
N=/opt/free-gst-billing/node/bin/node
api() { as $N -e "fetch('http://127.0.0.1:'+(process.argv[2]||47371)+process.argv[1]).then(r=>r.text()).then(t=>{console.log(t)}).catch(e=>{console.log('ERR '+e.message);process.exit(1)})" "$@"; }
post() { as $N -e "fetch('http://127.0.0.1:47371'+process.argv[1],{method:'POST',headers:{'Content-Type':'application/json'},body:process.argv[2]}).then(r=>r.text()).then(t=>console.log(t))" "$1" "$2"; }
servers() { n=0; for p in /proc/[0-9]*; do tr '\0' ' ' < $p/cmdline 2>/dev/null | grep -qE '^[^ ]*node/bin/node [^ ]*/server\.js' && n=$((n+1)); done; echo $n; }
check_running() { # <kind>
  api /api/health | grep -q '"ok":true' || fail "health"
  S=$(api /api/control-panel/status)
  echo "$S" | grep -q "\"dataFolder\":\"$H/.local/share/free-gst-billing-data/data\"" || fail "dataFolder: $S"
  echo "$S" | grep -q "\"installKind\":\"$1\"" || fail "installKind: $S"
  echo "OK server answers on 127.0.0.1:47371, books in ~/.local/share/free-gst-billing-data, installKind=$1"
  # Listening on 127.0.0.1 only: 0100007F:B90B in /proc/net/tcp, never 00000000:B90B.
  grep -q ' 0100007F:B90B ' /proc/net/tcp || fail "not on 127.0.0.1:47371"
  if grep -q ' 00000000:B90B ' /proc/net/tcp || grep -qi ' 00000000000000000000000000000000:B90B ' /proc/net/tcp6 2>/dev/null; then fail "listens on all addresses"; fi
  echo "OK bound to 127.0.0.1 only"
  post /api/profile '{"companyName":"DiceCodes","gstin":"29ABCDE1234F1ZW"}' | grep -q success || fail "save profile"
  test -f "$H/.local/share/free-gst-billing-data/data/profile.json" || fail "profile not in FGSB_HOME"
  test -d "$H/.local/share/free-gst-billing-data/Saved Invoices" && test -d "$H/.local/share/free-gst-billing-data/Trash" || fail "Saved Invoices/Trash not in FGSB_HOME"
  [ "$(stat -c %U $H/.local/share/free-gst-billing-data/data/profile.json)" = shop ] || fail "books not owned by the user"
  echo "OK books written to FGSB_HOME as user shop"
  U=$(post /api/control-panel/launch-script '{"action":"update"}')
  echo "$U" | grep -q '"ok":false' && echo "$U" | grep -q "$2" || fail "update not redirected: $U"
  echo "OK Update says: $(echo "$U" | cut -c1-110)..."
  grep -q 'books from an earlier copy' /tmp/launch1.log || fail "no earlier-copy notice"
  grep -q "$H/.local/share/free-gst-billing/_system/data" /tmp/launch1.log || fail "notice misses the one-line copy"
  grep -q "$H/Free-GST-Billing/_system/data" /tmp/launch1.log || fail "notice misses the unzipped copy"
  test -f "$H/.local/share/free-gst-billing-data/OLD-BOOKS-FOUND.txt" || fail "no OLD-BOOKS-FOUND.txt"
  echo "OK earlier copies reported:"; sed -n '1,12p' /tmp/launch1.log | sed 's/^/     | /'
}
check_old_untouched() {
  snap > /tmp/old-after
  echo "HASH old installs after:  $(sha256sum < /tmp/old-after | cut -c1-16)"
  cmp -s /tmp/old-before /tmp/old-after || { diff /tmp/old-before /tmp/old-after; fail "earlier copy changed"; }
  echo "OK earlier ZIP copies byte-identical (every file's sha256, size, mode, owner, mtime)"
}
`;

function packageTest(image, script) {
  const r = docker(['run', '--rm', '-v', `${OUT}:/pkgs:ro`, image, 'sh', '-c', (COMMON + script).replace(/\r/g, '')], { maxBuffer: 1 << 24 }); // a CRLF checkout must not reach sh
  const out = `${r.stdout}${r.stderr}`;
  console.log(out.split('\n').filter((l) => /^(OK|HASH|FAIL|     \|)/.test(l)).map((l) => `      ${l}`).join('\n'));
  return { ok: r.status === 0 && out.includes('ALL DONE'), out };
}

const DEB_SCRIPT = String.raw`
dpkg -i /pkgs/${DEB} >/tmp/dpkg.log 2>&1 || { cat /tmp/dpkg.log; fail "dpkg -i"; }
echo "OK dpkg -i (no maintainer scripts: $(ls /var/lib/dpkg/info/free-gst-billing.* | grep -c -E 'postinst|preinst|prerm|postrm') found)"
dpkg -L free-gst-billing | grep -q '^/home' && fail "package owns files in /home"
test -x /usr/bin/free-gst-billing && test -f /usr/share/applications/com.dicecodes.free-gst-billing.desktop || fail "launcher/menu entry"
grep -q '^Name=Free GST Billing$' /usr/share/applications/com.dicecodes.free-gst-billing.desktop || fail "menu name"
[ ! -e /opt/free-gst-billing/data ] || fail "data folder inside /opt"
echo "OK /usr/bin/free-gst-billing, menu entry 'Free GST Billing', nothing in /home"
as free-gst-billing > /tmp/launch1.log 2>&1 || { cat /tmp/launch1.log; fail "launch"; }
check_running deb '\.deb'
as free-gst-billing > /tmp/launch2.log 2>&1 || fail "second launch"
[ "$(servers)" = 1 ] || fail "second launch started another server ($(servers))"
echo "OK second launch reuses the running server (1 server process)"
check_old_untouched
for p in /proc/[0-9]*; do tr '\0' ' ' < $p/cmdline 2>/dev/null | grep -qE '^[^ ]*node/bin/node [^ ]*/server\.js' && kill $(basename $p); done
sleep 2
( cd $H/.local/share/free-gst-billing-data && find . -type f ! -name last-start.log -exec sha256sum {} + | sort ) > /tmp/books-before
apt-get remove -y free-gst-billing >/tmp/remove.log 2>&1 || { cat /tmp/remove.log; fail "apt remove"; }
[ ! -e /opt/free-gst-billing ] && [ ! -e /usr/bin/free-gst-billing ] || fail "program left after remove"
( cd $H/.local/share/free-gst-billing-data && find . -type f ! -name last-start.log -exec sha256sum {} + | sort ) > /tmp/books-after
cmp -s /tmp/books-before /tmp/books-after || fail "books changed by apt remove"
echo "HASH books before/after apt remove: $(sha256sum < /tmp/books-before | cut -c1-16) / $(sha256sum < /tmp/books-after | cut -c1-16)"
echo "OK apt remove: program gone, ~/.local/share/free-gst-billing-data intact ($(wc -l < /tmp/books-after) files)"
check_old_untouched
echo ALL DONE
`;

const APPIMAGE_SCRIPT = String.raw`
cp /pkgs/${APPIMAGE} /tmp/app.AppImage && chmod 755 /tmp/app.AppImage
# No FUSE in a container: the runtime extracts to /tmp and runs from there.
N=/tmp/node-probe/node; mkdir -p /tmp/node-probe
( cd /tmp/node-probe && /tmp/app.AppImage --appimage-extract node/bin/node >/dev/null && cp squashfs-root/node/bin/node node && chmod 755 node )
as env APPIMAGE_EXTRACT_AND_RUN=1 /tmp/app.AppImage > /tmp/launch1.log 2>&1 &
i=0; until api /api/health >/dev/null 2>&1; do i=$((i+1)); [ $i -gt 90 ] && { cat /tmp/launch1.log; fail "AppImage did not answer"; }; sleep 1; done
echo "OK AppImage runs without FUSE (extract-and-run)"
check_running appimage 'AppImage'
# Control Panel > Restart: the AppImage must stay open for the new server.
post /api/control-panel/restart '{}' | grep -q '"ok":true' || fail "restart"
sleep 8
i=0; until api /api/health >/dev/null 2>&1; do i=$((i+1)); [ $i -gt 30 ] && fail "no server after Restart"; sleep 1; done
sleep 10
api /api/health | grep -q '"ok":true' || fail "restarted server lost its files"
[ "$(servers)" = 1 ] || fail "servers after restart: $(servers)"
echo "OK Control Panel > Restart: the new server keeps running from the AppImage"
check_old_untouched
echo ALL DONE
`;

async function dockerTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'fgsb-docker-test-'));
  const project = 'fgsbtest';
  const compose = join(tmp, 'docker-compose.yml');
  const ex = (c, args) => docker(['exec', c, ...args]).stdout.trim();
  const probe = (c, port = 47371) => ex(c, ['node', '-e', `fetch('http://127.0.0.1:${port}/api/health').then(r=>r.json()).then(j=>console.log(j.ok?'up':'down')).catch(()=>console.log('down'))`]);
  const waitUp = async (c) => { for (let i = 0; i < 60; i += 1) { if (probe(c) === 'up') return true; await new Promise((r) => setTimeout(r, 1000)); } return false; };
  const hostFetch = async (port) => { try { return (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; } };
  try {
    // 1. The real docker-compose.yml, only its host port changed for this PC.
    const yml = readFileSync(join(OUT, 'docker-compose.yml'), 'utf8');
    if (!yml.includes('"127.0.0.1:47371:47371"')) throw new Error('compose does not publish to 127.0.0.1 only');
    writeFileSync(compose, yml.replace('"127.0.0.1:47371:47371"', `"127.0.0.1:${HOST_PORT}:47371"`).replace('container_name: free-gst-billing', 'container_name: fgsbtest-app'));
    record('docker compose config is valid', docker(['compose', '-p', project, '-f', compose, 'config', '-q']).status === 0);
    const up = docker(['compose', '-p', project, '-f', compose, 'up', '-d']);
    if (up.status !== 0) throw new Error(up.stderr);
    const c = 'fgsbtest-app';
    record('compose: the app answers inside the container', await waitUp(c));
    record('compose: answers on the host at 127.0.0.1 (published to this machine only)', await hostFetch(HOST_PORT));
    const uid = ex(c, ['sh', '-c', "awk '/^Uid:/{print $2}' /proc/1/status /proc/[0-9]*/status 2>/dev/null | sort -u | tr '\\n' ' '"]);
    record('compose: every process runs as a non-root user', uid.trim() !== '' && !uid.split(' ').includes('0'), `uids: ${uid}`);
    const status = JSON.parse(ex(c, ['node', '-e', "fetch('http://127.0.0.1:47371/api/control-panel/status').then(r=>r.text()).then(console.log)"]));
    record('compose: books folder is /data/data, installKind docker', status.dataFolder === '/data/data' && status.installKind === 'docker');
    ex(c, ['node', '-e', "fetch('http://127.0.0.1:47371/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyName:'DiceCodes',gstin:'29ABCDE1234F1ZW'})}).then(r=>r.text()).then(console.log)"]);
    const vol = `${project}_fgsb-data`;
    const inVol = docker(['run', '--rm', '-v', `${vol}:/v:ro`, 'debian:bookworm-slim', 'sh', '-c', 'cat /v/data/profile.json; ls -d "/v/Saved Invoices" /v/Trash']).stdout;
    record('compose: books written to the volume', inVol.includes('DiceCodes') && inVol.includes('Saved Invoices') && inVol.includes('Trash'));
    const ro = ex(c, ['sh', '-c', 'touch /app/x 2>/dev/null && echo app-writable; touch /x 2>/dev/null && echo root-writable; echo checked']);
    record('compose: program files and root filesystem are read-only', ro === 'checked', ro.replace(/\n/g, ' '));
    const upd = ex(c, ['node', '-e', "fetch('http://127.0.0.1:47371/api/control-panel/launch-script',{method:'POST',headers:{'Content-Type':'application/json'},body:'{\"action\":\"update\"}'}).then(r=>r.text()).then(console.log)"]);
    record('compose: Update says how to update the Docker copy', upd.includes('"ok":false') && upd.includes('docker compose'));
    const tz = ex(c, ['node', '-e', 'console.log(new Date().getTimezoneOffset())']);
    record('compose: time zone is India (TZ=Asia/Kolkata, offset -330)', tz === '-330', `offset ${tz}`);
    const health = docker(['inspect', '--format', '{{.State.Health.Status}}', c]).stdout.trim();
    record('compose: Docker health check is defined', ['starting', 'healthy'].includes(health), health);
    docker(['compose', '-p', project, '-f', compose, 'down']);
    const kept = docker(['run', '--rm', '-v', `${vol}:/v:ro`, 'debian:bookworm-slim', 'cat', '/v/data/profile.json']).stdout;
    record('compose down keeps the books in the volume', kept.includes('DiceCodes'));
    docker(['volume', 'rm', vol]);

    // 2. Without FGSB_ALLOW_UNSAFE_LAN: nothing outside the container reaches it,
    //    even with the port published.
    const c2 = 'fgsbtest-safe';
    docker(['rm', '-f', c2]);
    const r2 = docker(['run', '-d', '--name', c2, '-p', `127.0.0.1:${HOST_PORT}:47371`, '-v', 'fgsbtest-safe:/data', IMAGE]);
    if (r2.status !== 0) throw new Error(r2.stderr);
    record('default: the app answers inside the container', await waitUp(c2));
    record('default: NOT reachable from the host, even with the port published', !(await hostFetch(HOST_PORT)));
    const ip = docker(['inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', c2]).stdout.trim();
    const fromPeer = docker(['run', '--rm', IMAGE, 'node', '-e', `fetch('http://${ip}:47371/api/health',{signal:AbortSignal.timeout(3000)}).then(()=>console.log('reached')).catch(()=>console.log('refused'))`]).stdout.trim();
    record('default: NOT reachable from another container on the network', fromPeer === 'refused', `${ip} -> ${fromPeer}`);
    docker(['rm', '-f', c2]);
    docker(['volume', 'rm', 'fgsbtest-safe']);
  } catch (e) {
    record('docker test ran to the end', false, e.message);
  } finally {
    docker(['compose', '-p', project, '-f', compose, 'down', '-v']);
    docker(['rm', '-f', 'fgsbtest-safe']);
    docker(['volume', 'rm', '-f', 'fgsbtest-safe']);
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n  Linux package tests v${version}\n`);
if (want.has('deb')) {
  if (!existsSync(join(OUT, DEB))) record(`${DEB} exists`, false, 'run npm run release:deb');
  else {
    for (const image of ['debian:bookworm-slim', 'ubuntu:24.04']) {
      console.log(`  .deb on ${image}:`);
      record(`.deb on ${image}`, packageTest(image, DEB_SCRIPT).ok);
    }
  }
}
if (want.has('appimage')) {
  if (!existsSync(join(OUT, APPIMAGE))) record(`${APPIMAGE} exists`, false, 'run npm run release:appimage');
  else {
    console.log('  AppImage on debian:bookworm-slim:');
    record('AppImage on debian:bookworm-slim', packageTest('debian:bookworm-slim', APPIMAGE_SCRIPT).ok);
  }
}
if (want.has('docker')) {
  if (docker(['image', 'inspect', IMAGE]).status !== 0) record(`image ${IMAGE} exists`, false, 'run npm run release:docker');
  else { console.log('  Docker:'); await dockerTest(); }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length} passed, ${failed.length} failed\n`);
process.exit(failed.length ? 1 : 0);
