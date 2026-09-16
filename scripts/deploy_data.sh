#!/usr/bin/env bash
#
# deploy_data.sh — Commit updated pipeline data and push to Vercel.
#
# Run after the pipeline to make infomonitor.app show fresh data.
# Vercel auto-builds on every push to synthetic-demo.
#
# Usage:
#   ./scripts/deploy_data.sh
#   ./scripts/deploy_data.sh "Custom commit message"
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

cd "$PROJECT_DIR"

TIMESTAMP=$(date +%Y-%m-%d)
MSG="${1:-"Update pipeline data — $TIMESTAMP"}"

log() {
    echo "[$(date +%H:%M:%S)] $*"
}

log "Staging data files..."
git add \
    .gitignore \
    data/claims/ \
    data/metrics/ \
    data/topics.json \
    data/signals/ \
    data/geo/ \
    data/discourse/ \
    data/youtube/live/ \
    data/raw/ \
    2>/dev/null || true

# Check if there's anything to commit
if git diff --cached --quiet; then
    log "No changes to commit — data is already up to date."
    exit 0
fi

CHANGED=$(git diff --cached --stat | tail -1)
log "Committing: $CHANGED"

git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

log "Pushing to synthetic-demo → Vercel will auto-redeploy..."
git push origin synthetic-demo

log "Done. infomonitor.app will update in ~2-3 minutes."
