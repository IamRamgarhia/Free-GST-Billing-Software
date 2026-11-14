#!/bin/bash
# Builds "Free GST Billing.app" and Free-GST-Billing-Mac.dmg (drag to
# Applications). Runs on macOS (GitHub's free macos-15 runner:
# .github/workflows/mac-app.yml). No Apple Developer account: the app is
# ad-hoc signed as the very last step, so users click Open Anyway once.
#
#   scripts/build-mac-app.sh [out-dir]        (default: release-build/mac)
#
# Settings (environment variables):
#   SYSTEM_DIR    an already built _system folder (else it is built here:
#                 npm run build + build-release-zip.mjs --no-zip)
#   NODE_VERSION  e.g. v22.21.1 (default: the newest Node 22)
#
# The app:
#   Contents/MacOS/FreeGSTBilling     tiny universal program: runs launcher.sh
#   Contents/MacOS/node               universal Node 22 (arm64 + x86_64, lipo)
#   Contents/Resources/launcher.sh    packaging/mac/launcher.sh
#   Contents/Resources/app/           the release's _system (server, dist, packages)
#   Contents/Resources/AppIcon.icns
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/release-build/mac}"
DMG_NAME='Free-GST-Billing-Mac.dmg'
APP_NAME='Free GST Billing'
NODE_MAJOR=22

[ "$(uname -s)" = Darwin ] || { echo "Run this on macOS (it needs lipo, codesign and hdiutil)." >&2; exit 1; }
VERSION="$(node -p "require('$ROOT/package.json').version")"
echo "Building $APP_NAME $VERSION for Mac"

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
WORK="$OUT/work"
rm -rf "$WORK" "$OUT/dmg" "$OUT/$DMG_NAME"
mkdir -p "$WORK"

# ---- the app's files (the same _system folder the release ZIP ships) ----
SYSTEM="${SYSTEM_DIR:-}"
if [ -z "$SYSTEM" ]; then
  [ -d "$ROOT/node_modules" ] || (cd "$ROOT" && npm ci --no-audit --no-fund)
  (cd "$ROOT" && npm run build && node scripts/build-release-zip.mjs --no-zip "--outDir=$WORK/stage")
  SYSTEM="$WORK/stage/Free-GST-Billing/_system"
fi
[ -f "$SYSTEM/server.js" ] || { echo "No server.js in $SYSTEM" >&2; exit 1; }

APP="$OUT/dmg/$APP_NAME.app"
APP_RES="$APP/Contents/Resources"
mkdir -p "$APP/Contents/MacOS" "$APP_RES"
cp -R "$SYSTEM" "$APP_RES/app"
# The books live in Application Support (launcher.sh), never in the app.
rm -rf "$APP_RES/app/data"
# Updates come as a new DMG; the ZIP updater must never change a signed app.
echo macapp > "$APP_RES/app/install-kind.txt"
cp "$ROOT/packaging/mac/launcher.sh" "$APP_RES/launcher.sh"
chmod 755 "$APP_RES/launcher.sh"

# ---- universal Node 22 from nodejs.org, checked against SHASUMS256.txt ----
if [ -z "${NODE_VERSION:-}" ]; then
  curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt" -o "$WORK/latest.txt"
  NODE_VERSION="$(grep -m1 -o "node-v$NODE_MAJOR\.[0-9]*\.[0-9]*-darwin-arm64\.tar\.gz" "$WORK/latest.txt" | sed 's/^node-\(v[0-9.]*\)-.*/\1/')"
fi
[ -n "$NODE_VERSION" ] || { echo "Could not find the newest Node $NODE_MAJOR" >&2; exit 1; }
echo "Node $NODE_VERSION"
NODE_DIST="https://nodejs.org/dist/$NODE_VERSION"
curl -fsSL "$NODE_DIST/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
for arch in arm64 x64; do
  f="node-$NODE_VERSION-darwin-$arch.tar.gz"
  curl -fsSL --retry 3 "$NODE_DIST/$f" -o "$WORK/$f"
  (cd "$WORK" && grep "  $f\$" SHASUMS256.txt | shasum -a 256 -c -)
  tar -xzf "$WORK/$f" -C "$WORK" "node-$NODE_VERSION-darwin-$arch/bin/node"
done
lipo -create -output "$APP/Contents/MacOS/node" \
  "$WORK/node-$NODE_VERSION-darwin-arm64/bin/node" "$WORK/node-$NODE_VERSION-darwin-x64/bin/node"
lipo "$APP/Contents/MacOS/node" -verify_arch arm64 x86_64

# ---- the app's program: runs launcher.sh with bash (Mach-O, so the signature
# lives inside it rather than in extended attributes a copy could drop) ----
cat > "$WORK/main.c" <<'EOF'
#include <limits.h>
#include <libgen.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
  char exe[PATH_MAX], real[PATH_MAX], script[PATH_MAX];
  uint32_t size = sizeof exe;
  if (_NSGetExecutablePath(exe, &size) != 0 || !realpath(exe, real)) return 1;
  snprintf(script, sizeof script, "%s/../Resources/launcher.sh", dirname(real));
  execl("/bin/bash", "bash", script, (char *)NULL);
  perror("bash");
  return 1;
}
EOF
clang -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -O2 -o "$APP/Contents/MacOS/FreeGSTBilling" "$WORK/main.c"

# ---- icon, from the app's own PNG ----
ICONSET="$WORK/AppIcon.iconset"
mkdir -p "$ICONSET"
SRC_ICON="$ROOT/public/icons/icon-512.png"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$SRC_ICON" --out "$ICONSET/icon_${s}x${s}.png" > /dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$SRC_ICON" --out "$ICONSET/icon_${s}x${s}@2x.png" > /dev/null
done
iconutil -c icns "$ICONSET" -o "$APP_RES/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleExecutable</key><string>FreeGSTBilling</string>
  <key>CFBundleIdentifier</key><string>com.dicecodes.freegstbilling</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.business</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>DiceCodes. MIT License.</string>
</dict>
</plist>
EOF
plutil -lint "$APP/Contents/Info.plist"

# ---- ad-hoc sign: LAST, once every file is in place. Inside out: node, then
# the whole bundle. A file changed after this breaks the seal ("damaged"). ----
xattr -cr "$APP"
codesign --force --sign - "$APP/Contents/MacOS/node"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# ---- the DMG: the app and a link to Applications ----
ln -s /Applications "$OUT/dmg/Applications"
for try in 1 2 3; do
  # hdiutil on CI sometimes fails with "Resource busy"; a retry does it.
  if hdiutil create -volname "$APP_NAME" -srcfolder "$OUT/dmg" -ov -format UDZO "$OUT/$DMG_NAME"; then break; fi
  [ "$try" = 3 ] && exit 1
  sleep 5
done
hdiutil verify "$OUT/$DMG_NAME"
rm -rf "$WORK"
echo "Built: $OUT/$DMG_NAME ($(du -h "$OUT/$DMG_NAME" | cut -f1))"
echo "  App: $APP"
