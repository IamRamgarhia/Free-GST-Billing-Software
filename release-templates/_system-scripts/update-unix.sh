#!/bin/sh
# Free GST Billing - Linux / macOS / NAS updater.
#
# The Unix counterpart of update-windows.ps1, run by the Control Panel's
# "Update Now" button. Before v1.10.66 there was no Unix updater at all, so on
# Linux and NAS installs that button always failed with "Script not found for
# this platform" (#59).
#
# In order:
#   1. downloads the latest release ZIP from GitHub
#   2. extracts it and checks every file arrived complete
#   3. stops here if that version is not newer than the installed one
#   4. backs up data/ to a .tar.gz (tar exists everywhere; zip does not)
#   5. replaces the app files in _system/ - never data/, never node_modules/
#   6. reinstalls production dependencies
# If step 5 or 6 fails, the previous app files are put back.
#
# Plain POSIX sh on purpose, not bash: Alpine / BusyBox based NAS images ship
# without bash. The download uses Node, which the app already needs, so curl
# and wget are not required either. Opening the ZIP needs `unzip` or python3.
#
# Keep this file ASCII-only - see docs/KNOWN_ERRORS.md, ERR-001.
#
# Testing hook: FGSB_UPDATE_ZIP=/path/to/release.zip skips the download.

set -eu

# Never stop half way because the terminal closed or the app that launched the
# update went away. An update that dies between swapping the files and
# installing dependencies is worse than one that finishes or rolls back.
trap '' HUP PIPE

REPO_API='https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest'

say()  { printf '  %s\n' "$*" 2>/dev/null || true; }
fail() { printf '\n  ERROR: %s\n\n' "$*" >&2 2>/dev/null || true; exit 1; }
version_of() {
  node -e 'try { console.log(require(process.argv[1]).version) } catch (e) { console.log("unknown") }' "$1/package.json"
}
# Succeeds when version $1 is newer than version $2 (x.y.z).
is_newer() {
  node -e 'const p = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0); const a = p(process.argv[1]); const b = p(process.argv[2]); for (let i = 0; i < 3; i += 1) { if ((a[i] || 0) !== (b[i] || 0)) process.exit((a[i] || 0) > (b[i] || 0) ? 0 : 1); } process.exit(1);' "$1" "$2"
}

SYSTEM_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
ROLLBACK="$SYSTEM_DIR/.update-previous"
WORK=''
STATE=checking
FROM=unknown

say ''
say '============================================================'
say ' Free GST Billing Software - Update'
say '============================================================'
say ''

# Put back whatever step 5 replaced. Entries the new version added are removed
# again; entries it replaced are moved back from ROLLBACK.
put_back_previous() {
  say 'The update did not finish - putting the previous version back...'
  if [ -f "$WORK/added" ]; then
    while IFS= read -r name; do
      [ -n "$name" ] && rm -rf "$SYSTEM_DIR/$name"
    done < "$WORK/added"
  fi
  for entry in "$ROLLBACK"/* "$ROLLBACK"/.[!.]*; do
    [ -e "$entry" ] || continue
    name=$(basename "$entry")
    rm -rf "$SYSTEM_DIR/$name"
    mv "$entry" "$SYSTEM_DIR/$name"
  done
  if [ "$STATE" = installing ]; then
    say 'Reinstalling the previous dependencies...'
    (cd "$SYSTEM_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error) \
      || say 'That failed too - run "npm install --omit=dev" in this folder once you are online.'
  fi
  say "Version v$FROM is back in place. Your data was never touched."
}

on_exit() {
  code=$?
  trap - EXIT
  if [ "$code" -ne 0 ] && { [ "$STATE" = applying ] || [ "$STATE" = installing ]; }; then
    put_back_previous
  fi
  # Only a rollback copy this run made is removed - never one it did not create.
  if [ "$STATE" != checking ]; then rm -rf "$ROLLBACK"; fi
  if [ -n "$WORK" ]; then rm -rf "$WORK"; fi
  exit "$code"
}
trap on_exit EXIT
trap 'exit 130' INT TERM

# --- Step 0: is this a release install we can update? ----------------------
if [ ! -f "$SYSTEM_DIR/server.js" ] || [ ! -f "$SYSTEM_DIR/package.json" ]; then
  if [ -d "$SYSTEM_DIR/../../.git" ]; then
    fail 'This copy runs from a git checkout, not the release ZIP. Update it with:
    git pull && npm install && npm run build'
  fi
  fail "The app was not found next to this script ($SYSTEM_DIR). Download the release ZIP again."
fi
command -v node >/dev/null 2>&1 || fail 'Node.js is not on PATH.'
command -v npm  >/dev/null 2>&1 || fail 'npm is not on PATH.'

if command -v unzip >/dev/null 2>&1; then
  EXTRACTOR=unzip
elif command -v python3 >/dev/null 2>&1; then
  EXTRACTOR=python3
else
  fail 'Updating needs "unzip" (or python3) to open the release ZIP. Install it, then click Update again:
    Debian / Ubuntu:  sudo apt install unzip
    Alpine:           apk add unzip
  Nothing was changed.'
fi

FROM=$(version_of "$SYSTEM_DIR")
WORK=$(mktemp -d "${TMPDIR:-/tmp}/fgsb-update.XXXXXX") || fail 'Could not create a temporary folder.'

# --- Step 1: get the release ZIP --------------------------------------------
ZIP="$WORK/update.zip"
if [ -n "${FGSB_UPDATE_ZIP:-}" ]; then
  say "Using the local package $FGSB_UPDATE_ZIP"
  cp "$FGSB_UPDATE_ZIP" "$ZIP" || fail "Could not read $FGSB_UPDATE_ZIP"
else
  say 'Checking the latest release on GitHub...'
  node - "$REPO_API" "$ZIP" <<'NODE' || fail 'Could not download the update. Check the internet connection and try again. Nothing was changed.'
const [api, out] = process.argv.slice(2);
const fs = require('fs');
const agent = { 'User-Agent': 'FreeGSTBill-Updater' };
(async () => {
  if (typeof fetch !== 'function') throw new Error('Node.js 18 or newer is needed to download updates.');
  const rel = await fetch(api, { headers: { ...agent, Accept: 'application/vnd.github+json' } });
  if (!rel.ok) throw new Error(`GitHub answered ${rel.status}.`);
  const info = await rel.json();
  const assets = info.assets || [];
  const asset = assets.find((a) => /^Free-GST-Billing-v.+\.zip$/i.test(a.name)) || assets.find((a) => /\.zip$/i.test(a.name));
  if (!asset) throw new Error(`Release ${info.tag_name} has no ZIP attached yet. Try again later.`);
  console.log(`  Latest release: ${info.tag_name}`);
  const res = await fetch(asset.browser_download_url, { headers: agent });
  if (!res.ok) throw new Error(`The download failed with ${res.status}.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (asset.size && buf.length !== asset.size) throw new Error(`The download is incomplete (${buf.length} of ${asset.size} bytes).`);
  fs.writeFileSync(out, buf);
  console.log(`  Downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
})().catch((e) => { console.error(`  ${e.message}`); process.exit(1); });
NODE
fi

# --- Step 2: open it, and prove every file arrived --------------------------
say 'Extracting...'
mkdir -p "$WORK/new"
if [ "$EXTRACTOR" = unzip ]; then
  # Any non-zero status fails. BusyBox unzip reports real errors - a full disk,
  # a damaged file - with the same status Info-ZIP uses for mere warnings.
  unzip -q -o "$ZIP" -d "$WORK/new" || fail 'The downloaded file could not be extracted (damaged download, or the disk is full). Nothing was changed.'
else
  python3 - "$ZIP" "$WORK/new" <<'PY' || fail 'The downloaded file could not be extracted (damaged download, or the disk is full). Nothing was changed.'
import os, sys, zipfile
src, dest = sys.argv[1], os.path.abspath(sys.argv[2])
with zipfile.ZipFile(src) as z:
    for info in z.infolist():
        name = info.filename.replace('\\', '/')
        target = os.path.abspath(os.path.join(dest, name))
        if not target.startswith(dest + os.sep):
            raise SystemExit('unsafe path in archive: ' + name)
        if name.endswith('/'):
            os.makedirs(target, exist_ok=True)
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(info) as fin, open(target, 'wb') as fout:
            fout.write(fin.read())
PY
fi

# Compare what is on disk with the ZIP's own directory: every file present,
# every size exact. A truncated extraction must never reach the app folder.
node - "$ZIP" "$WORK/new" <<'NODE' || fail 'The update did not extract completely (the disk may be full). Nothing was changed.'
const fs = require('fs');
const path = require('path');
const [zip, dest] = process.argv.slice(2);
const buf = fs.readFileSync(zip);
const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) { console.error('  The file is not a ZIP.'); process.exit(1); }
const count = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);
const missing = [];
for (let i = 0; i < count; i += 1) {
  if (buf.readUInt32LE(p) !== 0x02014b50) { console.error('  The ZIP directory is damaged.'); process.exit(1); }
  const size = buf.readUInt32LE(p + 24);
  const nameLen = buf.readUInt16LE(p + 28);
  const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  const name = buf.toString('utf8', p + 46, p + 46 + nameLen).split(String.fromCharCode(92)).join('/');
  p += 46 + skip;
  if (name.endsWith('/')) continue;
  let st = null;
  try { st = fs.statSync(path.join(dest, name)); } catch (e) { st = null; }
  if (!st || st.size !== size) missing.push(name);
}
if (missing.length) {
  console.error(`  ${missing.length} file(s) missing or incomplete, for example: ${missing.slice(0, 3).join(', ')}`);
  process.exit(1);
}
console.log(`  All ${count} entries extracted completely.`);
NODE

NEW_SYSTEM=$(find "$WORK/new" -type d -name _system | head -n 1)
if [ -z "$NEW_SYSTEM" ] || [ ! -f "$NEW_SYSTEM/server.js" ]; then
  fail 'The package has no _system/server.js, so it is not a release ZIP. Nothing was changed.'
fi
[ -f "$NEW_SYSTEM/dist/index.html" ] || fail 'The package has no built app (dist/). Nothing was changed.'

# --- Step 3: only ever move forward -----------------------------------------
TO=$(version_of "$NEW_SYSTEM")
say "Installed: v$FROM    Available: v$TO"
if [ "$TO" = "$FROM" ]; then
  say "[OK] v$FROM is already the latest version. Nothing to do."
  exit 0
fi
if is_newer "$FROM" "$TO"; then
  say "[OK] The installed v$FROM is newer than the latest release (v$TO). Nothing to do."
  exit 0
fi

# --- Step 4: back up data/ before touching anything -------------------------
if [ -d "$SYSTEM_DIR/data" ]; then
  BACKUPS_HOME="${HOME:-$SYSTEM_DIR/..}/Documents/FreeGSTBill Backups"
  mkdir -p "$BACKUPS_HOME" || fail "Could not create $BACKUPS_HOME for the backup. Nothing was changed."
  BACKUP="$BACKUPS_HOME/pre-update-$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
  say "Backing up your data to $BACKUP ..."
  tar -czf "$BACKUP" -C "$SYSTEM_DIR" data || fail 'The data backup failed, so nothing was changed.'
fi

# --- Step 5: swap the app files, keeping the old ones for a rollback -------
say 'Applying the update (your data folder is not touched)...'
rm -rf "$ROLLBACK"
mkdir -p "$ROLLBACK"
: > "$WORK/added"
STATE=applying
for entry in "$NEW_SYSTEM"/* "$NEW_SYSTEM"/.[!.]*; do
  [ -e "$entry" ] || continue
  name=$(basename "$entry")
  case "$name" in data|node_modules) continue ;; esac
  if [ -e "$SYSTEM_DIR/$name" ]; then
    # A rename inside the same folder: instant, and safe even for this
    # script, which the shell keeps reading through its open file handle.
    mv "$SYSTEM_DIR/$name" "$ROLLBACK/$name"
  else
    printf '%s\n' "$name" >> "$WORK/added"
  fi
  cp -R "$entry" "$SYSTEM_DIR/$name"
done

# --- Step 6: dependencies ----------------------------------------------------
say 'Reinstalling dependencies (this can take a few minutes)...'
STATE=installing
(cd "$SYSTEM_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error) \
  || fail 'npm install failed.'
STATE=done

# Refresh the launchers beside _system/ only now that nothing can roll back.
ROOT_DIR=$(dirname "$SYSTEM_DIR")
NEW_ROOT=$(dirname "$NEW_SYSTEM")
for launcher in "$NEW_ROOT"/*.sh "$NEW_ROOT"/*.command "$NEW_ROOT"/*.hta; do
  [ -f "$launcher" ] || continue
  cp "$launcher" "$ROOT_DIR/" 2>/dev/null || true
done

say ''
say "[OK] Update complete: v$FROM -> v$TO"
say 'Restart the app to run the new version.'
say 'If it runs in Docker or as a service, restart that container or service.'
say ''
