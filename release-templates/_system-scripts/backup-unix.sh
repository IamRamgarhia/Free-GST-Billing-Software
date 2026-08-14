#!/usr/bin/env bash
# Free GST Billing — Unix backup.
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="$SCRIPT_DIR/data"
BACKUPS_HOME="$HOME/Documents/FreeGSTBill Backups"

if [ ! -d "$DATA_DIR" ]; then
  echo "  No data folder found — nothing to back up."
  exit 0
fi

mkdir -p "$BACKUPS_HOME"
STAMP=$(date +'%Y-%m-%d_%H-%M-%S')
OUT="$BACKUPS_HOME/backup-$STAMP.zip"

echo ""
echo "  Backing up data folder → $OUT …"
( cd "$DATA_DIR" && zip -qr "$OUT" . )

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "  ✅ Backup created — $SIZE"
echo "     $OUT"

# Open the folder in the OS file manager.
if command -v open >/dev/null 2>&1; then open "$BACKUPS_HOME"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$BACKUPS_HOME"
fi
