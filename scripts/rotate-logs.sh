#!/bin/bash
#
# Log rotation for Trading AI
# Keeps last 3 rotations, compresses old logs
# Run weekly via cron: 0 0 * * 0
#

LOG_DIR="/Users/muftau/Documents/programming/trading-ai/logs"
MAX_ROTATIONS=3
TIMESTAMP=$(date +%Y%m%d)

rotate_log() {
    local logfile="$1"
    local path="$LOG_DIR/$logfile"

    if [ ! -f "$path" ]; then
        return
    fi

    local lines=$(wc -l < "$path" | tr -d ' ')
    if [ "$lines" -lt 10 ]; then
        return
    fi

    # Rotate: current -> .YYYYMMDD.gz
    gzip -c "$path" > "$path.$TIMESTAMP.gz"
    truncate -s 0 "$path"
    echo "[$(date)] Rotated $logfile ($lines lines)" >> "$LOG_DIR/rotation.log"

    # Remove old rotations beyond MAX_ROTATIONS
    ls -t "$path".*.gz 2>/dev/null | tail -n +$((MAX_ROTATIONS + 1)) | xargs rm -f 2>/dev/null
}

echo "[$(date)] Starting log rotation"
rotate_log "scanner.log"
rotate_log "resolver.log"
rotate_log "fastapi.log"
rotate_log "fastapi.error.log"
rotate_log "weekly-review.log"
echo "[$(date)] Log rotation complete"
