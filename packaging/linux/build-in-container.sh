#!/bin/sh
# Free GST Billing - builds the .deb and the AppImage. Runs INSIDE a
# debian:bookworm-slim container started by scripts/build-linux.mjs:
#   /work/app             the staged app (server.js, dist, node_modules ...)
#   /work/node.tar.gz     Node.js linux-x64 (SHA256 checked by build-linux.mjs)
#   /work/appimagetool    appimagetool + /work/runtime-x86_64 (checked too)
#   /work/packaging       the packaging/ folder
# Writes /work/out/. Arguments: deb and/or appimage. Env: VERSION.
set -eu
V=${VERSION:?}
P=/work/packaging/linux
A=/build/app
rm -rf /build && mkdir -p /build /work/out

# --- The program tree: what goes to /opt/free-gst-billing ---
cp -r /work/app "$A"
tar -xzf /work/node.tar.gz -C /build
mkdir -p "$A/node/bin" "$A/linux"
cp /build/node-v*-linux-x64/bin/node "$A/node/bin/node"
cp /build/node-v*-linux-x64/LICENSE "$A/node/LICENSE"
cp "$P/free-gst-billing" "$A/free-gst-billing"
cp "$P/old-installs.mjs" "$A/linux/old-installs.mjs"
# Files from Windows carry no Unix modes: set them all.
find "$A" -type d -exec chmod 755 {} +
find "$A" -type f -exec chmod 644 {} +
chmod 755 "$A/node/bin/node" "$A/free-gst-billing" "$A"/*.sh
"$A/node/bin/node" -e 'process.exit(process.versions.node.startsWith("20.") ? 0 : 1)'
# A program file with Windows line endings fails on Linux.
if grep -rlI "$(printf '\r')" "$A/free-gst-billing" "$A/linux" "$A"/*.sh; then echo 'CRLF line endings found' >&2; exit 1; fi

build_deb() {
  R=/build/deb
  O=/work/out/free-gst-billing_${V}_amd64.deb
  rm -rf "$R"
  mkdir -p "$R/DEBIAN" "$R/opt" "$R/usr/bin" "$R/usr/share/applications" "$R/usr/share/doc/free-gst-billing" \
    "$R/usr/share/icons/hicolor/512x512/apps" "$R/usr/share/icons/hicolor/192x192/apps"
  cp -a "$A" "$R/opt/free-gst-billing"
  echo deb > "$R/opt/free-gst-billing/install-kind.txt"
  ln -s /opt/free-gst-billing/free-gst-billing "$R/usr/bin/free-gst-billing"
  install -m 644 "$P/free-gst-billing.desktop" "$R/usr/share/applications/com.dicecodes.free-gst-billing.desktop"
  install -m 644 "$A/dist/icons/icon-512.png" "$R/usr/share/icons/hicolor/512x512/apps/free-gst-billing.png"
  install -m 644 "$A/dist/icons/icon-192.png" "$R/usr/share/icons/hicolor/192x192/apps/free-gst-billing.png"
  install -m 644 "$A/LICENSE" "$R/usr/share/doc/free-gst-billing/copyright"
  # No maintainer scripts: installing and removing touch no one's home
  # folder, start nothing and ask nothing. dpkg's own triggers refresh the menu.
  cat > "$R/DEBIAN/control" <<EOF
Package: free-gst-billing
Version: $V
Architecture: amd64
Maintainer: DiceCodes <Contact@dicecodes.com>
Installed-Size: $(du -sk "$R/opt" "$R/usr" | awk '{s += $1} END {print s}')
Section: misc
Priority: optional
Recommends: xdg-utils, zip
Homepage: https://github.com/IamRamgarhia/Free-GST-Billing-Software
Description: Free GST billing and invoicing software for India
 GST tax invoices, credit notes, delivery challans, GSTR-1 / GSTR-3B
 exports, e-Way Bill and reports. Runs on this computer only (127.0.0.1)
 and keeps each user's books in ~/.local/share/free-gst-billing-data.
 Removing the package never deletes the books.
EOF
  dpkg-deb --root-owner-group -Zxz --build "$R" "$O"
  dpkg-deb --info "$O" > /dev/null
  echo "built $O"
}

build_appimage() {
  D=/build/AppDir
  O=/work/out/Free-GST-Billing-Linux-x86_64.AppImage
  rm -rf "$D"
  cp -a "$A" "$D"
  echo appimage > "$D/install-kind.txt"
  ln -s free-gst-billing "$D/AppRun"
  install -m 644 "$P/free-gst-billing.desktop" "$D/free-gst-billing.desktop"
  install -m 644 "$A/dist/icons/icon-512.png" "$D/free-gst-billing.png"
  ln -s free-gst-billing.png "$D/.DirIcon"
  install -m 755 /work/appimagetool /build/appimagetool
  # appimagetool refuses to start without the `file` command, which the slim
  # image lacks; ARCH is given, so it only needs one that answers.
  # ponytail: shim instead of apt-get install file (no extra download); use a
  # base image with `file` if appimagetool ever reads its output.
  if ! command -v file >/dev/null 2>&1; then
    mkdir -p /build/bin
    printf '#!/bin/sh\nfor f; do echo "$f: ELF 64-bit LSB executable, x86-64"; done\n' > /build/bin/file
    chmod 755 /build/bin/file
    PATH=/build/bin:$PATH
  fi
  (cd /build && ARCH=x86_64 ./appimagetool --appimage-extract-and-run --no-appstream \
    --runtime-file /work/runtime-x86_64 "$D" "$O")
  chmod 755 "$O"
  echo "built $O"
}

for t in "$@"; do
  case $t in
    deb) build_deb ;;
    appimage) build_appimage ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
done
