#!/bin/bash
set -euo pipefail

PLIST_NAME="com.openclaw.scheduler"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
BACKUP_DIR="$HOME/openclaw/backup/plists/$(date +%Y%m%d)"

echo "=== OpenClaw Scheduler Uninstall ==="

if [ -f "$PLIST_DST" ]; then
    echo "Stopping scheduler..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true

    echo "Backing up plist to $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    mv "$PLIST_DST" "$BACKUP_DIR/$PLIST_NAME.plist"

    echo "✓ Uninstalled. Backup saved to $BACKUP_DIR"
else
    echo "No plist found at $PLIST_DST, nothing to uninstall."
fi
