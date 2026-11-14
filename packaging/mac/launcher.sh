#!/bin/bash
# Free GST Billing - the Mac app's launcher (Contents/Resources/launcher.sh).
# Contents/MacOS/FreeGSTBilling (a tiny program, see scripts/build-mac-app.sh)
# runs this with bash when the app is opened.
#
# The books live in ~/Library/Application Support/Free GST Billing, never in
# the app: a signed .app must not change, and macOS may run it from a
# read-only copy (App Translocation). Opening the app again while it runs
# just opens the browser at it.
#
# FGSB_NO_BROWSER=1 (CI): no browser and no dialog; exit 0 once it answers.
set -u

CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$CONTENTS/Resources/app"
NODE="$CONTENTS/MacOS/node"
export FGSB_HOME="$HOME/Library/Application Support/Free GST Billing"
LOG_DIR="$HOME/Library/Logs/Free GST Billing"
LOG="$LOG_DIR/server.log"
PORT_FILE="$FGSB_HOME/data/port.txt"
mkdir -p "$FGSB_HOME" "$LOG_DIR"

port() {
  local p
  p=$(tr -dc '0-9' < "$PORT_FILE" 2>/dev/null)
  echo "${p:-47371}"
}

# True when the server for THESE books answers on port $1 (not another copy
# of the app that happens to use that port).
ours() {
  curl -fsS --max-time 2 "http://127.0.0.1:$1/api/version" 2>/dev/null | grep -qF "\"books\":\"$FGSB_HOME\""
}

open_app() {
  echo "Free GST Billing is running at http://localhost:$1/"
  [ "${FGSB_NO_BROWSER:-}" = 1 ] || open "http://localhost:$1/"
  exit 0
}

if [ -f "$PORT_FILE" ] && ours "$(port)"; then open_app "$(port)"; fi

cd "$APP_DIR" || exit 1
nohup "$NODE" server.js > "$LOG" 2>&1 < /dev/null &
pid=$!

# Up to ~40 s; port.txt is written once the server listens.
for _ in $(seq 1 100); do
  sleep 0.4
  if ours "$(port)"; then open_app "$(port)"; fi
  kill -0 "$pid" 2>/dev/null || break
done
# It exited: another copy may have the books open already.
if ours "$(port)"; then open_app "$(port)"; fi

echo "Free GST Billing did not start. The details are in $LOG" >&2
if [ "${FGSB_NO_BROWSER:-}" != 1 ]; then
  osascript -e 'on run argv' \
    -e 'display dialog "Free GST Billing did not start." & return & return & "The details are in:" & return & (item 1 of argv) buttons {"OK"} default button 1 with icon stop with title "Free GST Billing"' \
    -e 'end run' "$LOG" > /dev/null 2>&1
fi
exit 1
