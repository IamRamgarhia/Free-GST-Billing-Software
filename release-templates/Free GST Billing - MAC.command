#!/usr/bin/env bash
# Free GST Billing — macOS launcher.
#
# Double-click in Finder → macOS opens this in Terminal.app. We
# detect state (Node? installed?) and offer a minimal menu, then
# hand off to the underlying script. All the "fancy UI" (Update /
# Backup / Restore / Move / Uninstall buttons) lives INSIDE the
# app at http://localhost:47371/control-panel once the server is
# running — this launcher is just the front door.
#
# Design decisions:
#   * Uses pure bash + curl — no jq, no python, nothing to install
#   * Same script works on Linux (see .sh variant) with different
#     Node install instructions
#   * Never destructive — user always confirms before install runs

set -e

# Resolve the folder this launcher lives in, cd there.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
SYSTEM_DIR="$SCRIPT_DIR/_system"

clear
echo
echo "  ┌────────────────────────────────────────────────┐"
echo "  │   Free GST Billing Software                    │"
echo "  │   Open-source · Offline-first · No signup      │"
echo "  └────────────────────────────────────────────────┘"
echo

# --- Sanity checks ---
if [ ! -d "$SYSTEM_DIR" ]; then
  echo "  ⚠  _system folder is missing."
  echo "     Please re-extract the ZIP or re-download from GitHub."
  echo
  read -p "  Press Enter to exit… "
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠  Node.js is not installed."
  echo
  echo "  Install it one of these ways, then re-run this launcher:"
  echo "    · Homebrew:      brew install node@20"
  echo "    · Official pkg:  https://nodejs.org/en/download"
  echo
  read -p "  Open the Node.js download page now? [y/N] " ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then open "https://nodejs.org/en/download"; fi
  exit 1
fi

# --- Install if node_modules missing ---
if [ ! -d "$SYSTEM_DIR/node_modules" ]; then
  echo "  ℹ  App dependencies not installed yet."
  echo "     This will run: npm install  (2–3 minutes, one-time)"
  echo
  read -p "  Install now? [Y/n] " ans
  if [[ "$ans" =~ ^[Nn]$ ]]; then exit 0; fi
  bash "$SYSTEM_DIR/install-unix.sh"
fi

# --- Start server + open browser ---
echo
echo "  ✅ Starting server…"
bash "$SYSTEM_DIR/start-unix.sh"
