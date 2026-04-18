#!/usr/bin/env bash
#
# run_pipeline.sh — Run the full data pipeline for one or all topics.
#
# Usage:
#   ./scripts/run_pipeline.sh --all                  # All topics, full pipeline
#   ./scripts/run_pipeline.sh --topic immigration     # Single topic
#   ./scripts/run_pipeline.sh --all --free-only       # Skip X (no API cost)
#   ./scripts/run_pipeline.sh --all --x-only          # X ingestion + recompute only
#   ./scripts/run_pipeline.sh --all --recompute-only  # cluster + metrics + feeds only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

# Load .env if present
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Activate virtualenv if present
if [[ -f "$PROJECT_DIR/.venv/bin/activate" ]]; then
    source "$PROJECT_DIR/.venv/bin/activate"
fi

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Clean up logs older than 30 days
find "$LOG_DIR" -name "pipeline_*.log" -mtime +30 -delete 2>/dev/null || true

# Defaults
TOPIC=""
ALL=false
FREE_ONLY=false
X_ONLY=false
RECOMPUTE_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --topic)    TOPIC="$2"; shift 2 ;;
        --all)      ALL=true; shift ;;
        --free-only) FREE_ONLY=true; shift ;;
        --x-only)   X_ONLY=true; shift ;;
        --recompute-only) RECOMPUTE_ONLY=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--all | --topic <id>] [--free-only | --x-only | --recompute-only]"
            echo ""
            echo "Options:"
            echo "  --all              Run for all topics in topic_keywords.json"
            echo "  --topic <id>       Run for a single topic"
            echo "  --free-only        Skip X ingestion (Bluesky, RSS, NewsAPI, YouTube only)"
            echo "  --x-only           X ingestion + recompute metrics/feeds only"
            echo "  --recompute-only   Cluster + metrics + feeds only (no ingestion)"
            exit 0
            ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

# Resolve topic list
if $ALL; then
    TOPICS=$(python3 -c "import json; print(' '.join(json.load(open('$SCRIPT_DIR/topic_keywords.json')).keys()))")
elif [[ -n "$TOPIC" ]]; then
    TOPICS="$TOPIC"
else
    echo "Error: specify --all or --topic <id>"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="$LOG_DIR/pipeline_${TIMESTAMP}.log"

log() {
    echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOGFILE"
}

run_step() {
    local step_name="$1"
    shift
    log "  [$step_name] $*"
    if "$@" >> "$LOGFILE" 2>&1; then
        log "  [$step_name] OK"
        return 0
    else
        log "  [$step_name] FAILED (exit $?)"
        return 1
    fi
}

log "Pipeline started: $(echo $TOPICS | wc -w | tr -d ' ') topics"
log "Mode: $(if $FREE_ONLY; then echo 'free-only'; elif $X_ONLY; then echo 'x-only'; elif $RECOMPUTE_ONLY; then echo 'recompute-only'; else echo 'full'; fi)"
log "Log: $LOGFILE"
echo ""

FAILED_TOPICS=""

for tid in $TOPICS; do
    log "=== $tid ==="

    if $RECOMPUTE_ONLY; then
        # Skip all ingestion, just recompute
        run_step "cluster" python3 "$SCRIPT_DIR/cluster.py" --topic "$tid" || true
        run_step "metrics" python3 "$SCRIPT_DIR/compute_metrics.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "feeds"   python3 "$SCRIPT_DIR/generate_real_feeds.py" --topic "$tid" || true
    elif $X_ONLY; then
        # X ingestion + recompute
        run_step "ingest-x" python3 "$SCRIPT_DIR/ingest_all.py" --topic "$tid" --source x || true
        run_step "extract"  python3 "$SCRIPT_DIR/extract.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "embed"    python3 "$SCRIPT_DIR/embed.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "cluster"  python3 "$SCRIPT_DIR/cluster.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "metrics"  python3 "$SCRIPT_DIR/compute_metrics.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "feeds"    python3 "$SCRIPT_DIR/generate_real_feeds.py" --topic "$tid" || true
    elif $FREE_ONLY; then
        # Free sources: Bluesky, RSS, NewsAPI, YouTube (skip X)
        run_step "ingest-bsky" python3 "$SCRIPT_DIR/ingest_all.py" --topic "$tid" --source bluesky || true
        run_step "ingest-rss"  python3 "$SCRIPT_DIR/ingest_all.py" --topic "$tid" --source rss || true
        run_step "ingest-news" python3 "$SCRIPT_DIR/ingest_all.py" --topic "$tid" --source newsapi || true
        run_step "youtube"     python3 "$SCRIPT_DIR/youtube_discover.py" --topic "$tid" || true
        run_step "extract"     python3 "$SCRIPT_DIR/extract.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "embed"       python3 "$SCRIPT_DIR/embed.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "cluster"     python3 "$SCRIPT_DIR/cluster.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "metrics"     python3 "$SCRIPT_DIR/compute_metrics.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "feeds"       python3 "$SCRIPT_DIR/generate_real_feeds.py" --topic "$tid" || true
    else
        # Full pipeline
        run_step "ingest"  python3 "$SCRIPT_DIR/ingest_all.py" --topic "$tid" || true
        run_step "youtube" python3 "$SCRIPT_DIR/youtube_discover.py" --topic "$tid" || true
        run_step "extract" python3 "$SCRIPT_DIR/extract.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "embed"   python3 "$SCRIPT_DIR/embed.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "cluster" python3 "$SCRIPT_DIR/cluster.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "metrics" python3 "$SCRIPT_DIR/compute_metrics.py" --topic "$tid" || { FAILED_TOPICS="$FAILED_TOPICS $tid"; continue; }
        run_step "feeds"   python3 "$SCRIPT_DIR/generate_real_feeds.py" --topic "$tid" || true
    fi

    log "=== $tid complete ==="
    echo ""
done

log "Pipeline finished."
if [[ -n "$FAILED_TOPICS" ]]; then
    log "FAILED topics:$FAILED_TOPICS"
    exit 1
fi
