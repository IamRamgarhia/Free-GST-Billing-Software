#!/usr/bin/env bash
# Free GST Billing — Unix (macOS + Linux) installer.
#
# Assumes Node.js is already installed (parent launcher checks and
# instructs the user if not — installing Node on Unix is too
# distro-specific to automate safely from a script).
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SYSTEM_DIR="$SCRIPT_DIR"

echo ""
echo "  Installing app dependencies (npm install)…"
cd "$SYSTEM_DIR"
npm install --omit=dev --no-audit --no-fund --loglevel=error

echo ""
echo "  ✅ Install complete."
echo "     The launcher will now start the server and open your browser."
