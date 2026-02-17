#!/bin/bash
# Cleanup script for stale processes on Aibō ports

echo "🧹 Cleaning up stale processes..."

# Kill Electron app first (if running)
ELECTRON_PIDS=$(pgrep -f "electron.*Aibō|electron.*aibo" 2>/dev/null)
if [ -n "$ELECTRON_PIDS" ]; then
    echo "  Closing Electron app: $ELECTRON_PIDS"
    echo "$ELECTRON_PIDS" | xargs kill 2>/dev/null
    sleep 1
fi

PORTS=(3001 4000 5173 18789)

for PORT in "${PORTS[@]}"; do
    # Try lsof first (more precise)
    PIDS=$(lsof -t -i :$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "  Killing process(es) on port $PORT: $PIDS"
        echo "$PIDS" | xargs kill -9 2>/dev/null
    fi
done

# Fallback: Kill by process name (catches orphans)
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "backend-team" 2>/dev/null || true
pkill -9 -f "ts-node.*server/index" 2>/dev/null || true

# Wait for OS to release ports
sleep 0.5

echo "✅ Cleanup complete"
