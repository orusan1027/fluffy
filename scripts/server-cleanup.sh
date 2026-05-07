#!/usr/bin/env bash
# Removes ads_*.php files and backup directories from the mu-plugins directory
# on the remote xserver.jp host.
#
# Usage:
#   bash scripts/server-cleanup.sh            # live run
#   bash scripts/server-cleanup.sh --dry-run  # preview only
#
# Env vars:
#   SSH_HOST  (default: orusanura@sv10662.xserver.jp)
#   SSH_KEY   (default: ~/.ssh/id_rsa)
#   TARGET_DIR (default: urasougokeijiban.net/public_html/wp-content/mu-plugins)

set -euo pipefail

SSH_HOST="${SSH_HOST:-orusanura@sv10662.xserver.jp}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
TARGET_DIR="${TARGET_DIR:-urasougokeijiban.net/public_html/wp-content/mu-plugins}"
DRY_RUN="${1:-}"
LOG_FILE="${LOG_FILE:-/dev/stdout}"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()       { echo "[$(timestamp)] $*" | tee -a "$LOG_FILE"; }

ssh_run() {
  ssh \
    -i "$SSH_KEY" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=15 \
    "$SSH_HOST" "$@"
}

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  log "=== DRY RUN MODE — no files will be deleted ==="
fi

log "Target host : $SSH_HOST"
log "Target dir  : $TARGET_DIR"
log ""

# ── Phase 1: ads_*.php files ──────────────────────────────────────────────────
log "Phase 1: Scanning for ads_*.php files..."

ADS_FILES=$(ssh_run "find '$TARGET_DIR' -maxdepth 1 -name 'ads_*.php' -type f 2>/dev/null || true")

if [[ -z "$ADS_FILES" ]]; then
  log "  No ads_*.php files found."
else
  log "  Files to delete:"
  while IFS= read -r f; do
    log "    $f"
  done <<< "$ADS_FILES"

  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    log "  [DRY RUN] Would delete the above files."
  else
    ssh_run "find '$TARGET_DIR' -maxdepth 1 -name 'ads_*.php' -type f -delete"
    log "  Deleted successfully."
  fi
fi

log ""

# ── Phase 2: Backup directories ───────────────────────────────────────────────
log "Phase 2: Scanning for backup directories..."

BACKUP_DIRS=$(ssh_run "find '$TARGET_DIR' -maxdepth 2 -type d \
  \( \
    -name '*_backup*' \
    -o -name '*_bak*'  \
    -o -name '*.old'   \
    -o -name '*_old*'  \
    -o -name '*.old.*' \
    -o -name '*-backup*' \
    -o -name '*-bak*'  \
    -o -name '*.bak'   \
    -o -name '*.orig'  \
    -o -name '*~'      \
  \) 2>/dev/null || true")

if [[ -z "$BACKUP_DIRS" ]]; then
  log "  No backup directories found."
else
  log "  Directories to remove:"
  while IFS= read -r d; do
    log "    $d"
  done <<< "$BACKUP_DIRS"

  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    log "  [DRY RUN] Would remove the above directories."
  else
    # Sort descending so child paths are removed before their parents
    echo "$BACKUP_DIRS" | sort -r | while IFS= read -r d; do
      ssh_run "rm -rf '$d'"
      log "  Removed: $d"
    done
  fi
fi

log ""
log "=== Cleanup complete ==="
