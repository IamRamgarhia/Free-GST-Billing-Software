#!/usr/bin/env bash
# Free GST Billing — Linux launcher.
#
# Mark this executable once (chmod +x) and either double-click in
# most file managers (Nautilus, Dolphin, Nemo — prompt to run) or
# run from a terminal: `./Free\ GST\ Billing.sh`
#
# Same design as the .command variant for macOS: detect state,
# offer a minimal menu, hand off to _system/*.sh. All post-install
# actions live in the in-app Control Panel at
# http://localhost:47371/control-panel.

set -e

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

if [ ! -d "$SYSTEM_DIR" ]; then
  echo "  ⚠  _system folder is missing."
  echo "     Please re-extract the ZIP or re-download from GitHub."
  echo
  read -rp "  Press Enter to exit… "
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "  ⚠  Node.js is not installed."
  echo
  echo "  Install it, then re-run this launcher:"
  echo "    · Debian/Ubuntu:   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs"
  echo "    · Fedora:          sudo dnf install nodejs npm"
  echo "    · Arch:            sudo pacman -S nodejs npm"
  echo "    · nvm (any distro): https://github.com/nvm-sh/nvm"
  echo
  exit 1
fi

if [ ! -d "$SYSTEM_DIR/node_modules" ]; then
  echo "  ℹ  App dependencies not installed yet."
  echo "     This will run: npm install  (2–3 minutes, one-time)"
  echo
  read -rp "  Install now? [Y/n] " ans
  if [[ "$ans" =~ ^[Nn]$ ]]; then exit 0; fi
  bash "$SYSTEM_DIR/install-unix.sh"
fi

echo
echo "  ✅ Starting server…"
bash "$SYSTEM_DIR/start-unix.sh"
