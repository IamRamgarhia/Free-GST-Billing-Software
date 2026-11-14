#!/bin/bash
# Smoke test of the built Mac DMG (runs on macOS; .github/workflows/mac-app.yml).
# Opens the DMG, copies the app out as a user would, checks its signature,
# then opens it with an empty home folder (FGSB_NO_BROWSER=1): API calls with
# a demo DiceCodes client, open-again while running, Control Panel -> Stop,
# open again (the books are kept), and the signature is still intact.
#
#   scripts/test-mac-app.sh release-build/mac/Free-GST-Billing-Mac.dmg
set -euo pipefail

DMG="$(cd "$(dirname "${1:?usage: test-mac-app.sh <path to Free-GST-Billing-Mac.dmg>}")" && pwd)/$(basename "$1")"
T="$(mktemp -d)"
MNT="$T/mnt"
APP="$T/Free GST Billing.app"
NODE_BIN="$APP/Contents/MacOS/node"
export HOME="$T/home"
export FGSB_NO_BROWSER=1
BOOKS="$HOME/Library/Application Support/Free GST Billing"
LOG="$HOME/Library/Logs/Free GST Billing/server.log"
mkdir -p "$HOME"

cleanup() {
  hdiutil detach "$MNT" -quiet > /dev/null 2>&1 || true
  pkill -f "$NODE_BIN" > /dev/null 2>&1 || true
}
trap cleanup EXIT
fail() { echo "FAILED: $1" >&2; [ -f "$LOG" ] && { echo "--- server.log ---" >&2; cat "$LOG" >&2; }; exit 1; }
step() { echo "== $1"; }

step "The DMG holds the app and a link to Applications"
hdiutil attach -nobrowse -readonly -mountpoint "$MNT" "$DMG" > /dev/null
[ -L "$MNT/Applications" ] || fail "no Applications link in the DMG"
ditto "$MNT/Free GST Billing.app" "$APP"
hdiutil detach "$MNT" -quiet

step "Signed (ad-hoc), universal"
codesign --verify --deep --strict --verbose=2 "$APP"
lipo -verify_arch "$NODE_BIN" arm64 x86_64
lipo -verify_arch "$APP/Contents/MacOS/FreeGSTBilling" arm64 x86_64
"$NODE_BIN" --version
VERSION="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Contents/Info.plist")"
[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Contents/Info.plist")" = com.dicecodes.freegstbilling ] || fail "bundle id"

open_app() { "$APP/Contents/MacOS/FreeGSTBilling" || fail "the app did not start"; }
servers() { pgrep -f "$NODE_BIN" | wc -l | tr -d ' '; }
api() { local p="$1"; shift; curl -fsS --max-time 10 "http://127.0.0.1:$PORT$p" "$@"; }
post() { api "$1" -X POST -H 'Content-Type: application/json' -d "$2"; }
wait_stopped() {
  for _ in $(seq 1 50); do [ "$(servers)" = 0 ] && return 0; sleep 0.2; done
  fail "the server did not stop"
}

step "First open: starts the server with the books in Application Support"
open_app
PORT="$(cat "$BOOKS/data/port.txt")"
api /api/version | grep -qF "\"current\":\"$VERSION\"" || fail "/api/version is not $VERSION"
[ "$(api /api/bills)" = "[]" ] || fail "GET /api/bills is not []"
post /api/clients '{"id":"cli_dicecodes_demo","name":"DiceCodes","state":"Punjab","email":"contact@dicecodes.com"}' | grep -qF '"success":true' || fail "POST /api/clients"
api /api/clients | grep -qF '"name":"DiceCodes"' || fail "GET /api/clients has no DiceCodes"
[ -f "$BOOKS/data/clients/cli_dicecodes_demo.json" ] || fail "the client is not in Application Support"
api /api/control-panel/status | grep -qF '"installKind":"macapp"' || fail "installKind is not macapp"

step "Update never runs the ZIP updater: it names the new DMG"
post /api/control-panel/launch-script '{"action":"update"}' | grep -qF 'releases/latest/download/Free-GST-Billing-Mac.dmg' || fail "update did not point at the DMG"

step "Opening it again while it runs starts no second server"
open_app
[ "$(servers)" = 1 ] || fail "$(servers) servers running"

step "Control Panel -> Stop, then open again: the books are kept"
post /api/control-panel/launch-script '{"action":"stop"}' > /dev/null
wait_stopped
open_app
PORT="$(cat "$BOOKS/data/port.txt")"
api /api/clients | grep -qF '"name":"DiceCodes"' || fail "the client is gone after a restart"
post /api/control-panel/launch-script '{"action":"stop"}' > /dev/null
wait_stopped

step "Nothing was written inside the app"
[ ! -e "$APP/Contents/Resources/app/data" ] || fail "a data folder was made inside the app"
codesign --verify --deep --strict "$APP"

echo "test-mac-app: all checks passed ($VERSION)"
