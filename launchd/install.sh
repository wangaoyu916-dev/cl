#!/bin/bash
set -euo pipefail

# ─── OpenClaw Scheduler — launchd install script ─────────────────────────────
#
# Usage:
#   ./launchd/install.sh [--install-path /path/to/openclaw]
#
# Defaults:
#   --install-path   $(pwd)   (run from repo root)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PATH="${1:-$(cd "$SCRIPT_DIR/.." && pwd)}"
PLIST_NAME="com.openclaw.scheduler"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$INSTALL_PATH/logs"

echo "=== OpenClaw Scheduler Install ==="
echo "Install path : $INSTALL_PATH"
echo "Plist dest   : $PLIST_DST"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
echo "[1/4] Building TypeScript..."
cd "$INSTALL_PATH"
npm install --silent
npm run build

# ── Prepare log directory ─────────────────────────────────────────────────────
echo "[2/4] Preparing log directory..."
mkdir -p "$LOG_DIR/reports"

# ── Install plist ─────────────────────────────────────────────────────────────
echo "[3/4] Installing plist..."
mkdir -p "$HOME/Library/LaunchAgents"

# Substitute OPENCLAW_INSTALL_PATH placeholder with actual path
# Also detect node binary location
NODE_BIN="$(command -v node 2>/dev/null || echo '/usr/local/bin/node')"

sed \
  -e "s|OPENCLAW_INSTALL_PATH|$INSTALL_PATH|g" \
  -e "s|/usr/local/bin/node|$NODE_BIN|g" \
  "$PLIST_SRC" > "$PLIST_DST"

echo "    Written: $PLIST_DST"

# ── Load ──────────────────────────────────────────────────────────────────────
echo "[4/4] Loading with launchctl..."
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo ""
echo "✓ OpenClaw Scheduler installed and running."
echo ""
echo "Useful commands:"
echo "  Status  : launchctl list | grep openclaw"
echo "  Logs    : tail -f $LOG_DIR/scheduler.log"
echo "  Stop    : launchctl unload $PLIST_DST"
echo "  Restart : launchctl unload $PLIST_DST && launchctl load $PLIST_DST"
