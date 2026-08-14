#!/usr/bin/env bash
# Free GST Billing — Unix start-server + open-browser.
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SYSTEM_DIR="$SCRIPT_DIR"

# Resolve port from persisted file if present.
PORT=47371
if [ -f "$SYSTEM_DIR/data/port.txt" ]; then
  P=$(tr -d '[:space:]' < "$SYSTEM_DIR/data/port.txt")
  [[ "$P" =~ ^[0-9]+$ ]] && PORT="$P"
fi

# Is our server already up?
if curl -fsS --max-time 1 "http://localhost:$PORT/api/profile" >/dev/null 2>&1; then
  echo "  Server already running on port $PORT — opening browser…"
else
  echo "  Starting server on port $PORT…"
  # Detach so the script can exit while node keeps running.
  cd "$SYSTEM_DIR"
  nohup node server.js >/dev/null 2>&1 &
  # Poll for readiness up to 15s.
  deadline=$(($(date +%s) + 15))
  while [ $(date +%s) -lt $deadline ]; do
    sleep 0.4
    if curl -fsS --max-time 1 "http://localhost:$PORT/api/profile" >/dev/null 2>&1; then
      break
    fi
  done
fi

# Open browser — macOS uses `open`, Linux uses `xdg-open`.
if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT/"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT/"
else echo "  Open http://localhost:$PORT/ in your browser."
fi

echo "  ✅ Server running. This window can be closed."
