#!/bin/sh
# Free GST Billing - one-line install, update and repair for macOS and Linux.
#
#   Open Terminal, paste this line, press Return:
#   curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.sh | bash
#
# v1.10.83 - a file curl fetches carries no quarantine mark, so macOS
# Gatekeeper shows no warning; and the release ZIP now carries its own
# packages, so nothing here runs npm. The same line installs, updates an
# existing install in place (its data is backed up first and never touched),
# or repairs a half-done one. Node.js 18+ from the computer is used, else the
# official build from nodejs.org is put inside the app folder (no sudo).
#
# To remove the app (it asks before deleting any data):
#   curl -fsSL https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.sh | bash -s -- --uninstall
#
# Settings (environment variables, set for the shell that runs this):
#   FREEGSTBILL_DIR   install into (or update) this folder
#   FREEGSTBILL_ZIP   use this local release ZIP instead of downloading
#   FREEGSTBILL_TEST  a folder: icons are made there instead of in Applications
#                     or the menu, backups go there, nothing is asked and the
#                     app window is not opened (for testing)
#   FREEGSTBILL_PORT  the first port a NEW install tries (default 47371)
#
# Plain POSIX sh, so `| sh` works on NAS images without bash. ASCII only.
# Everything is inside main(), so a download cut off half way runs nothing.

set -eu

ZIP_URL='https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing.zip'
# v1.10.86 - Node.js 26 LTS (supported to about April 2029). It needs macOS
# 13.5 or newer and has no 32-bit ARM build: those computers get Node.js 22
# (supported to April 2027) instead - see pick_node_version.
NODE_VERSION=v26.13.1
NODE_OLDER=v22.23.5
NEED_FREE_MB=600
TEST=${FREEGSTBILL_TEST:-}
OS=$(uname -s)
ARCH=$(uname -m)
WORK=''

step() { printf '  %s ... ' "$1"; }
ok() { printf 'OK %s\n' "${1:-}"; }
fail() {
  printf '\n\n  PROBLEM: %s\n    %s\n    Your invoices and settings were not changed.\n\n' "$1" "$2" >&2
  exit 1
}

# curl | bash: stdin is this script, so questions go to the terminal. No
# terminal (or test mode) means the default answer, No.
ask() {
  [ -z "$TEST" ] || return 1
  ( : < /dev/tty ) 2>/dev/null || return 1
  printf '        %s [y/N] ' "$1" > /dev/tty
  read -r answer < /dev/tty || return 1
  case "$answer" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

download() { # url file
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 2 --progress-bar -o "$2" "$1"
  else
    wget -q --show-progress -O "$2" "$1" 2>/dev/null || wget -O "$2" "$1"
  fi
}

online() {
  if command -v curl >/dev/null 2>&1; then curl -fsSI --max-time 20 https://github.com >/dev/null 2>&1
  else wget -q --spider -T 20 https://github.com >/dev/null 2>&1; fi
}

node_ok() { [ -x "$1" ] && "$1" -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' 2>/dev/null; }

# Node.js 18+: our own copy first, then the computer's.
find_node() {
  for n in "$SYS/node/bin/node" "$(command -v node 2>/dev/null || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -n "$n" ] && node_ok "$n"; then printf '%s\n' "$n"; return 0; fi
  done
  return 1
}

# macOS is 13.5 or newer (Node.js 26's minimum). Unknown -> no.
mac_13_5_or_newer() {
  v=$(sw_vers -productVersion 2>/dev/null || true)
  major=${v%%.*}
  case $v in *.*) rest=${v#*.}; minor=${rest%%.*} ;; *) minor=0 ;; esac
  case $major$minor in '' | *[!0-9]*) return 1 ;; esac
  [ "$major" -gt 13 ] || { [ "$major" -eq 13 ] && [ "$minor" -ge 5 ]; }
}

# Node.js 26 where it runs, else 22 (older Macs, 32-bit ARM boards).
pick_node_version() {
  if [ "$1" = linux-armv7l ]; then NODE_VERSION=$NODE_OLDER; fi
  if [ "$OS" = Darwin ] && ! mac_13_5_or_newer; then NODE_VERSION=$NODE_OLDER; fi
}

# The official build for this computer, or a clear "do this instead".
node_platform() {
  if [ "$OS" = Linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
    fail 'This system (Alpine / musl) needs Node.js from its own package manager.' 'Run: sudo apk add nodejs   - then run the install line again.'
  fi
  case "$OS-$ARCH" in
    Darwin-arm64) echo darwin-arm64 ;;
    Darwin-x86_64) echo darwin-x64 ;;
    Linux-x86_64 | Linux-amd64) echo linux-x64 ;;
    Linux-aarch64 | Linux-arm64) echo linux-arm64 ;;
    Linux-armv7l) echo linux-armv7l ;;
    *) fail "There is no ready-made Node.js for this computer ($OS $ARCH)." 'Install Node.js 18 or newer yourself (https://nodejs.org), then run the install line again.' ;;
  esac
}

# Stops this install's own server (node running server.js from its folder),
# so the new version is the one that starts. Nothing else.
stop_app() {
  pids=''
  if [ -d /proc/self ]; then
    for d in /proc/[0-9]*; do
      [ "$(readlink "$d/cwd" 2>/dev/null)" = "$SYS" ] || continue
      if tr '\0' ' ' < "$d/cmdline" 2>/dev/null | grep -q 'server\.js'; then pids="$pids ${d#/proc/}"; fi
    done
  elif command -v pgrep >/dev/null 2>&1; then
    for p in $(pgrep -f 'server\.js' 2>/dev/null); do
      if [ "$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" = "$SYS" ]; then pids="$pids $p"; fi
    done
  fi
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 2
  fi
}

backup_data() {
  [ -n "$(ls -A "$SYS/data" 2>/dev/null)" ] || return 0
  if [ -n "$TEST" ]; then home_dir="$TEST/Backups"; else home_dir="$HOME/Documents/FreeGSTBill Backups"; fi
  mkdir -p "$home_dir" || fail "Could not create $home_dir for the backup." 'Check the free space, then run the install line again.'
  BACKUP="$home_dir/pre-update-$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
  tar -czf "$BACKUP" -C "$SYS" data || fail 'The backup of your data failed, so nothing was changed.' 'Check the free space, then run the install line again.'
}

# Unpacks with Node.js itself: many systems have no unzip (Debian slim, most
# NAS images), and Node.js is needed anyway. Every file is checked.
unpack() { # zip dest
  node - "$1" "$2" <<'JS'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const [zip, dest] = process.argv.slice(2);
const b = fs.readFileSync(zip);
const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error('not a ZIP file');
const root = path.resolve(dest);
let p = b.readUInt32LE(eocd + 16);
const count = b.readUInt16LE(eocd + 10);
for (let i = 0; i < count; i += 1) {
  if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('the ZIP directory is damaged');
  const method = b.readUInt16LE(p + 10);
  const csize = b.readUInt32LE(p + 20);
  const size = b.readUInt32LE(p + 24);
  const nl = b.readUInt16LE(p + 28);
  const skip = nl + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  const mode = b.readUInt32LE(p + 38) >>> 16;
  const off = b.readUInt32LE(p + 42);
  const name = b.toString('utf8', p + 46, p + 46 + nl).split(String.fromCharCode(92)).join('/');
  p += 46 + skip;
  const out = path.resolve(root, name);
  if (out !== root && !out.startsWith(root + path.sep)) throw new Error(`unsafe path in the ZIP: ${name}`);
  if (name.endsWith('/')) { fs.mkdirSync(out, { recursive: true }); continue; }
  const start = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
  const raw = b.subarray(start, start + csize);
  const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
  if (!data || data.length !== size) throw new Error(`${name} could not be read`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data, { mode: (mode & 0o111) ? 0o755 : 0o644 });
}
JS
}

make_mac_app() {
  if [ -n "$TEST" ]; then APP="$TEST/Free GST Billing.app"; else APP="$HOME/Applications/Free GST Billing.app"; fi
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  printf '#!/bin/sh\nexec /bin/sh "%s/open-app.sh"\n' "$SYS" > "$APP/Contents/MacOS/launch"
  chmod 755 "$APP/Contents/MacOS/launch"
  icon=''
  png="$SYS/dist/icons/icon-512.png"
  if [ -f "$png" ] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
    set_dir=$(mktemp -d "${TMPDIR:-/tmp}/fgsb-icon.XXXXXX")/AppIcon.iconset
    mkdir -p "$set_dir"
    for s in 16 32 128 256 512; do
      sips -z "$s" "$s" "$png" --out "$set_dir/icon_${s}x${s}.png" >/dev/null 2>&1 || true
      sips -z "$((s * 2))" "$((s * 2))" "$png" --out "$set_dir/icon_${s}x${s}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "$set_dir" -o "$APP/Contents/Resources/AppIcon.icns" 2>/dev/null && icon='<key>CFBundleIconFile</key><string>AppIcon</string>'
    rm -rf "$(dirname "$set_dir")"
  fi
  cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Free GST Billing</string>
<key>CFBundleDisplayName</key><string>Free GST Billing</string>
<key>CFBundleIdentifier</key><string>com.dicecodes.freegstbilling</string>
<key>CFBundleExecutable</key><string>launch</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$VERSION</string>
<key>LSMinimumSystemVersion</key><string>10.15</string>
$icon
</dict></plist>
PLIST
  # No Apple developer account: an ad-hoc signature, and no quarantine mark
  # (curl sets none; this clears any a copy picked up), so it simply opens.
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
  codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
  touch "$APP"
}

autostart_file() {
  if [ "$OS" = Darwin ]; then printf '%s\n' "$HOME/Library/LaunchAgents/com.dicecodes.freegstbilling.plist"
  else printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/free-gst-billing.desktop"; fi
}
menu_file() { printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/applications/free-gst-billing.desktop"; }

write_desktop_entry() { # file
  mkdir -p "$(dirname "$1")"
  cat > "$1" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Free GST Billing
Comment=GST invoices and billing, on this computer
Exec=/bin/sh "$SYS/open-app.sh"
Icon=$SYS/dist/icons/icon-512.png
Terminal=false
Categories=Office;Finance;
DESKTOP
}

add_autostart() {
  f=$(autostart_file)
  [ -z "$TEST" ] || f="$TEST/autostart/$(basename "$f")"
  mkdir -p "$(dirname "$f")"
  if [ "$OS" = Darwin ]; then
    cat > "$f" <<AGENT
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.dicecodes.freegstbilling</string>
<key>ProgramArguments</key><array><string>/bin/sh</string><string>$SYS/open-app.sh</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>
AGENT
  else
    write_desktop_entry "$f"
  fi
}

add_to_dock() {
  defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$APP</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>" \
    && killall Dock 2>/dev/null || true
}

install_app() {
  printf '\n  Free GST Billing - install or update\n\n'

  # --- [1/4] ---------------------------------------------------------------
  step '[1/4] Checking this computer'
  case "$OS" in Darwin | Linux) ;; *) fail "This computer ($OS) is not supported by this installer." 'Use the ZIP download instead: https://dicecodes.com/free-gst-software-documentation/install.html' ;; esac
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    fail 'Neither curl nor wget is installed.' 'Install curl (Debian / Ubuntu: sudo apt install curl), then run the install line again.'
  fi
  if ! { mkdir -p "$DIR" 2>/dev/null && touch "$DIR/.write-test.$$" 2>/dev/null && rm -f "$DIR/.write-test.$$"; }; then
    fail "This folder cannot be written to: $DIR" 'To install somewhere else, put FREEGSTBILL_DIR=/another/folder just before "bash" in the install line.'
  fi
  SYS=$(CDPATH='' cd -- "$DIR" && pwd -P)/_system
  free_mb=$(df -Pk "$DIR" 2>/dev/null | awk 'NR == 2 { print int($4 / 1024) }')
  if [ -n "$free_mb" ] && [ "$free_mb" -lt "$NEED_FREE_MB" ]; then
    fail "The disk is almost full ($free_mb MB free)." "Free at least $NEED_FREE_MB MB, then run the install line again."
  fi
  NODE=$(find_node || true)
  PLATFORM=''
  [ -n "$NODE" ] || PLATFORM=$(node_platform)
  [ -z "$PLATFORM" ] || pick_node_version "$PLATFORM"
  if { [ -z "${FREEGSTBILL_ZIP:-}" ] || [ -n "$PLATFORM" ]; } && ! online; then
    fail 'This computer cannot reach github.com.' 'Check the internet connection (open any website), then run the install line again.'
  fi
  IS_UPDATE=''
  [ -f "$SYS/server.js" ] && IS_UPDATE=1
  rm -rf "$DIR"/.install-tmp.* 2>/dev/null || true   # left by an interrupted run
  ok
  [ -z "$IS_UPDATE" ] || printf '        Found Free GST Billing in %s - updating it. Your data stays as it is.\n' "$DIR"

  # --- [2/4] ---------------------------------------------------------------
  # Inside the app folder, so the files are moved into place, not copied.
  WORK=$(mktemp -d "$DIR/.install-tmp.XXXXXX")
  trap 'rm -rf "$WORK"' EXIT
  printf '  [2/4] Downloading ...\n'
  if [ -n "$PLATFORM" ]; then
    printf '        Node.js %s, the engine the app runs on (one time):\n' "$NODE_VERSION"
    download "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$PLATFORM.tar.gz" "$WORK/node.tar.gz" \
      || fail 'Node.js could not be downloaded from nodejs.org.' 'Check the internet connection, then run the install line again.'
    tar -xzf "$WORK/node.tar.gz" -C "$WORK" || fail 'The Node.js download is damaged, or the disk is full.' 'Run the install line again.'
    NODE="$WORK/node-$NODE_VERSION-$PLATFORM/bin/node"
    # v1.10.86 - Node.js 26 needs libatomic, which minimal Linux systems lack:
    # then the older Node.js (22) is used instead, and if that cannot run
    # either, the message says which library to install.
    if ! node_ok "$NODE" && "$NODE" -v 2>&1 | grep -q libatomic && [ "$NODE_VERSION" != "$NODE_OLDER" ]; then
      rm -rf "$WORK/node-$NODE_VERSION-$PLATFORM" "$WORK/node.tar.gz"
      NODE_VERSION=$NODE_OLDER
      printf '        This computer lacks libatomic: using Node.js %s instead:\n' "$NODE_VERSION"
      download "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$PLATFORM.tar.gz" "$WORK/node.tar.gz" \
        || fail 'Node.js could not be downloaded from nodejs.org.' 'Check the internet connection, then run the install line again.'
      tar -xzf "$WORK/node.tar.gz" -C "$WORK" || fail 'The Node.js download is damaged, or the disk is full.' 'Run the install line again.'
      NODE="$WORK/node-$NODE_VERSION-$PLATFORM/bin/node"
    fi
    if ! node_ok "$NODE" && "$NODE" -v 2>&1 | grep -q libatomic; then
      fail 'Node.js needs the libatomic library, which this computer does not have.' 'Install it (Debian / Ubuntu: sudo apt install libatomic1   Fedora: sudo dnf install libatomic), then run the install line again.'
    fi
    node_ok "$NODE" || fail 'The downloaded Node.js does not run on this computer.' 'Install Node.js 18 or newer yourself (https://nodejs.org), then run the install line again.'
  fi
  PATH="$(dirname "$NODE"):$PATH"; export PATH
  if [ -n "${FREEGSTBILL_ZIP:-}" ]; then
    printf '        Free GST Billing: using %s\n' "$FREEGSTBILL_ZIP"
    cp "$FREEGSTBILL_ZIP" "$WORK/app.zip" || fail "Could not read $FREEGSTBILL_ZIP" 'Check the path.'
  else
    printf '        Free GST Billing (about 25 MB):\n'
    download "$ZIP_URL" "$WORK/app.zip" || fail 'The app could not be downloaded from GitHub.' 'Check the internet connection, then run the install line again.'
  fi

  # --- [3/4] ---------------------------------------------------------------
  step '[3/4] Installing'
  unpack "$WORK/app.zip" "$WORK/unpacked" 2> "$WORK/unpack.err" \
    || fail "The download could not be unpacked ($(tail -n 1 "$WORK/unpack.err")). It may be damaged, or the disk is full." 'Run the install line again.'
  NEW_SYS=$(find "$WORK/unpacked" -maxdepth 2 -type d -name _system | head -n 1)
  if [ -z "$NEW_SYS" ] || [ ! -f "$NEW_SYS/server.js" ] || [ ! -f "$NEW_SYS/node_modules/express/package.json" ]; then
    fail 'The download is not a complete Free GST Billing package.' 'Run the install line again. If it happens again: https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues'
  fi
  BACKUP=''
  [ -z "$IS_UPDATE" ] || backup_data
  stop_app
  # Every app file is replaced, node_modules included; the books, saved PDFs,
  # the bin and Node.js stay. A half-done earlier install is repaired the same way.
  mkdir -p "$SYS"
  # A clean update: what an older version had and this one does not goes
  # (checked before the new files are moved in). Never the books, saved
  # PDFs, the bin or Node.js.
  for entry in "$SYS"/*; do
    [ -e "$entry" ] || continue
    name=$(basename "$entry")
    case "$name" in data | 'Saved Invoices' | Trash | node | node-dir.txt) continue ;; esac
    [ -e "$NEW_SYS/$name" ] || rm -rf "${SYS:?}/$name"
  done
  for f in "$DIR"/'Free GST Billing - '* "$DIR/READ ME FIRST.txt"; do
    [ -f "$f" ] || continue
    [ -e "$(dirname "$NEW_SYS")/$(basename "$f")" ] || rm -f "$f"
  done
  for entry in "$NEW_SYS"/* "$NEW_SYS"/.[!.]*; do
    [ -e "$entry" ] || continue
    name=$(basename "$entry")
    case "$name" in data | 'Saved Invoices' | Trash | node) continue ;; esac
    rm -rf "${SYS:?}/$name"
    mv "$entry" "$SYS/$name"
  done
  for f in "$(dirname "$NEW_SYS")"/*; do
    if [ -f "$f" ]; then cp -f "$f" "$DIR/"; fi
  done
  mkdir -p "$SYS/data"
  if [ -n "${FREEGSTBILL_PORT:-}" ] && [ ! -f "$SYS/data/port.txt" ]; then printf '%s\n' "$FREEGSTBILL_PORT" > "$SYS/data/port.txt"; fi
  if [ -n "$PLATFORM" ]; then
    rm -rf "$SYS/node"
    mv "$WORK/node-$NODE_VERSION-$PLATFORM" "$SYS/node"
    rm -f "$SYS/node-dir.txt"
    PATH="$SYS/node/bin:$PATH"; export PATH
  elif [ "$NODE" != "$SYS/node/bin/node" ]; then
    # Icons start with a bare PATH; open-app.sh adds this folder to it.
    dirname "$NODE" > "$SYS/node-dir.txt"
  fi
  VERSION=$(node -p "require('$SYS/package.json').version")
  ok "(version $VERSION)"
  [ -z "$BACKUP" ] || printf '        Your data was backed up first, to %s\n' "$BACKUP"

  # --- [4/4] ---------------------------------------------------------------
  step '[4/4] Adding icons'
  if [ "$OS" = Darwin ]; then
    make_mac_app
  else
    menu=$(menu_file)
    [ -z "$TEST" ] || menu="$TEST/applications/free-gst-billing.desktop"
    write_desktop_entry "$menu"
  fi
  ok
  if [ -z "$IS_UPDATE" ]; then
    if [ "$OS" = Darwin ] && ask 'Add Free GST Billing to the Dock?'; then add_to_dock; fi
    if ask 'Open Free GST Billing by itself when this computer starts?'; then
      add_autostart
      printf '        It will open by itself when this computer starts.\n'
    fi
  fi

  printf '\n  Done! Opening Free GST Billing...\n'
  sh "$SYS/open-app.sh" || true
  if [ "$OS" = Darwin ]; then
    printf '\n  Next time, click the Free GST Billing icon (in Launchpad, or in Applications in your home folder).\n\n'
  else
    printf '\n  Next time, open Free GST Billing from your applications menu.\n\n'
  fi
}

uninstall_app() {
  [ -f "$DIR/_system/server.js" ] || fail "Free GST Billing is not installed in $DIR." 'Nothing was changed.'
  SYS=$(CDPATH='' cd -- "$DIR" && pwd -P)/_system
  printf '\n  Removing Free GST Billing from %s\n' "$DIR"
  stop_app
  if [ -z "$TEST" ]; then
    rm -rf "$HOME/Applications/Free GST Billing.app" "$(menu_file)" "$(autostart_file)"
  else
    rm -rf "$TEST/Free GST Billing.app" "$TEST/applications" "$TEST/autostart"
  fi
  # The program goes; the books stay unless the user says otherwise.
  for entry in "$SYS"/* "$SYS"/.[!.]*; do
    [ -e "$entry" ] || continue
    case "$(basename "$entry")" in data | 'Saved Invoices' | Trash) continue ;; esac
    rm -rf "$entry"
  done
  # Only the app's own files beside _system: the folder may be one the user
  # chose (FREEGSTBILL_DIR, a NAS share) with their own files in it. The same
  # rule as uninstall-unix.sh.
  for entry in "$DIR"/'Free GST Billing - '* "$DIR/READ ME FIRST.txt"; do
    [ -e "$entry" ] && rm -rf "$entry"
  done
  printf '  The app and its icons are removed.\n'
  if [ "$OS" = Darwin ]; then printf '  If it is in the Dock, drag it out.\n'; fi
  printf '\n'
  printf '  Your invoices, clients and settings are still in %s\n' "$SYS"
  answer=''
  if [ -z "$TEST" ] && ( : < /dev/tty ) 2>/dev/null; then
    printf '  To delete them too, type DELETE and press Return (just Return = keep them): ' > /dev/tty
    read -r answer < /dev/tty || answer=''
  fi
  if [ "$answer" = DELETE ]; then
    BACKUP=''
    backup_data
    rm -rf "$SYS"
    rmdir "$DIR" 2>/dev/null
    printf '  Deleted.\n'
    [ -z "$BACKUP" ] || printf '  One last copy was saved to %s - delete that file too if you want nothing left.\n' "$BACKUP"
  else
    printf '  Kept. Running the install line again brings the app back with all of it.\n'
  fi
  printf '\n'
}

main() {
  if [ "$OS" = Darwin ]; then default_dir="$HOME/Applications/Free GST Billing"
  else default_dir="${XDG_DATA_HOME:-$HOME/.local/share}/free-gst-billing"; fi
  DIR=${FREEGSTBILL_DIR:-$default_dir}
  # A copy unzipped by hand, with invoices in it, is updated rather than
  # starting a second, empty one next to it (ERR-038).
  if [ -z "${FREEGSTBILL_DIR:-}" ] && [ ! -f "$DIR/_system/server.js" ]; then
    for c in "$HOME/Free-GST-Billing" "$HOME/Documents/Free-GST-Billing" "$HOME/Desktop/Free-GST-Billing" "$HOME/Downloads/Free-GST-Billing"; do
      if [ -f "$c/_system/server.js" ] && [ -n "$(ls -A "$c/_system/data" 2>/dev/null)" ]; then DIR=$c; break; fi
    done
  fi
  case "${1:-}" in
    --uninstall) uninstall_app ;;
    *) install_app ;;
  esac
}

main "$@"
