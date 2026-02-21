#!/bin/bash
#
# Trading AI Services Manager
# Usage: ./scripts/services.sh [start|stop|status|restart|logs]
#

PROJECT_DIR="/Users/muftau/Documents/programming/trading-ai"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.trading-ai.fastapi.plist"
LOG_DIR="$PROJECT_DIR/logs"
CRON_MARKER="# Trading AI"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    local label="$1" status="$2"
    if [ "$status" = "running" ]; then
        printf "  %-20s ${GREEN}%-10s${NC}\n" "$label" "RUNNING"
    elif [ "$status" = "stopped" ]; then
        printf "  %-20s ${RED}%-10s${NC}\n" "$label" "STOPPED"
    else
        printf "  %-20s ${YELLOW}%-10s${NC}\n" "$label" "$status"
    fi
}

check_fastapi() {
    curl -s --max-time 2 http://localhost:8000/health >/dev/null 2>&1
}

check_cron() {
    crontab -l 2>/dev/null | grep -q "$CRON_MARKER"
}

cmd_status() {
    echo ""
    echo "Trading AI Services"
    echo "==================="

    if check_fastapi; then
        local health=$(curl -s --max-time 2 http://localhost:8000/health)
        local version=$(echo "$health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('model_version','?'))" 2>/dev/null)
        local models=$(echo "$health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('models_loaded','?'))" 2>/dev/null)
        print_status "FastAPI Server" "running"
        echo "                      Models: $models loaded, version $version"
    else
        print_status "FastAPI Server" "stopped"
    fi

    if check_cron; then
        print_status "Scanner (cron)" "running"
        print_status "Resolver (cron)" "running"
        echo ""
        echo "  Cron schedule:"
        crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | grep -v "^PATH" | while read -r line; do
            echo "    $line"
        done
    else
        print_status "Scanner (cron)" "stopped"
        print_status "Resolver (cron)" "stopped"
    fi

    echo ""
    echo "  Log files:"
    for logfile in fastapi.log fastapi.error.log scanner.log resolver.log; do
        local path="$LOG_DIR/$logfile"
        if [ -f "$path" ]; then
            local size=$(du -h "$path" | cut -f1)
            local lines=$(wc -l < "$path" | tr -d ' ')
            printf "    %-25s %s (%s lines)\n" "$logfile" "$size" "$lines"
        else
            printf "    %-25s ${YELLOW}not found${NC}\n" "$logfile"
        fi
    done
    echo ""
}

cmd_start() {
    echo "Starting Trading AI services..."
    mkdir -p "$LOG_DIR"

    # FastAPI
    if check_fastapi; then
        echo "  FastAPI: already running"
    else
        if [ -f "$LAUNCHD_PLIST" ]; then
            launchctl load "$LAUNCHD_PLIST" 2>/dev/null
            echo -n "  FastAPI: starting"
            for i in $(seq 1 10); do
                sleep 1
                if check_fastapi; then
                    echo " ...started"
                    break
                fi
                echo -n "."
            done
            if ! check_fastapi; then
                echo " ...FAILED (check logs/fastapi.error.log)"
            fi
        else
            echo "  FastAPI: launchd plist not found at $LAUNCHD_PLIST"
        fi
    fi

    # Cron
    if check_cron; then
        echo "  Cron jobs: already installed"
    else
        local tmpfile=$(mktemp)
        crontab -l 2>/dev/null > "$tmpfile"
        cat >> "$tmpfile" <<CRON
PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

$CRON_MARKER Scanner — runs every 15 minutes
*/15 * * * * cd $PROJECT_DIR && /opt/homebrew/bin/npx tsx scripts/scan.ts >> logs/scanner.log 2>&1

$CRON_MARKER Resolver — runs every 15 minutes, staggered +7 min
7,22,37,52 * * * * cd $PROJECT_DIR && /opt/homebrew/bin/npx tsx scripts/resolve.ts >> logs/resolver.log 2>&1

$CRON_MARKER Log rotation — weekly on Sunday at 00:00
0 0 * * 0 cd $PROJECT_DIR && /bin/bash scripts/rotate-logs.sh >> logs/rotation.log 2>&1

$CRON_MARKER Weekly review — Sunday at 08:00 UTC
0 8 * * 0 cd $PROJECT_DIR && /opt/homebrew/bin/npx tsx scripts/weekly-review.ts >> logs/weekly-review.log 2>&1
CRON
        crontab "$tmpfile"
        rm "$tmpfile"
        echo "  Cron jobs: installed"
    fi

    echo ""
    cmd_status
}

cmd_stop() {
    echo "Stopping Trading AI services..."

    # FastAPI
    if check_fastapi; then
        launchctl unload "$LAUNCHD_PLIST" 2>/dev/null
        sleep 1
        if ! check_fastapi; then
            echo "  FastAPI: stopped"
        else
            lsof -ti:8000 | xargs kill 2>/dev/null
            echo "  FastAPI: force killed"
        fi
    else
        echo "  FastAPI: not running"
    fi

    # Cron — remove trading-ai lines
    if check_cron; then
        local tmpfile=$(mktemp)
        crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | grep -v "scan.ts" | grep -v "resolve.ts" | grep -v "rotate-logs.sh" | grep -v "weekly-review.ts" | sed '/^$/N;/^\n$/d' > "$tmpfile"
        crontab "$tmpfile"
        rm "$tmpfile"
        echo "  Cron jobs: removed"
    else
        echo "  Cron jobs: not installed"
    fi

    echo ""
}

cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

cmd_logs() {
    local service="${1:-all}"
    case "$service" in
        fastapi)
            tail -50 "$LOG_DIR/fastapi.log" "$LOG_DIR/fastapi.error.log"
            ;;
        scanner)
            tail -50 "$LOG_DIR/scanner.log"
            ;;
        resolver)
            tail -50 "$LOG_DIR/resolver.log"
            ;;
        all)
            echo "=== FastAPI (last 20 lines) ==="
            tail -20 "$LOG_DIR/fastapi.log" 2>/dev/null
            echo ""
            echo "=== FastAPI Errors (last 10 lines) ==="
            tail -10 "$LOG_DIR/fastapi.error.log" 2>/dev/null
            echo ""
            echo "=== Scanner (last 20 lines) ==="
            tail -20 "$LOG_DIR/scanner.log" 2>/dev/null
            echo ""
            echo "=== Resolver (last 20 lines) ==="
            tail -20 "$LOG_DIR/resolver.log" 2>/dev/null
            ;;
        *)
            echo "Usage: $0 logs [fastapi|scanner|resolver|all]"
            ;;
    esac
}

case "${1:-status}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    restart) cmd_restart ;;
    logs)    cmd_logs "$2" ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|logs [service]}"
        echo ""
        echo "  start    Start FastAPI + install cron jobs"
        echo "  stop     Stop FastAPI + remove cron jobs"
        echo "  status   Show status of all services"
        echo "  restart  Stop then start all services"
        echo "  logs     Show recent logs (fastapi|scanner|resolver|all)"
        ;;
esac
