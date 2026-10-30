#!/usr/bin/env bash
set -e

SERVICE="$1"
shift
CMD="$@"

if [ -z "$SERVICE" ] || [ -z "$CMD" ]; then
   echo "Usage: $0 <service-name> <command>"
   exit 1
fi

CHILD_PID=""

cleanup() {
   trap - SIGTERM SIGINT EXIT
   if [ -n "$CHILD_PID" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
      echo "[$SERVICE] Stopping application process (PID $CHILD_PID)..."
      kill -TERM "$CHILD_PID" 2>/dev/null || true
      wait "$CHILD_PID" 2>/dev/null || true
      echo "[$SERVICE] Application process stopped cleanly..."
   fi
   echo "[$SERVICE] Stopping docker container (profile: $SERVICE)..."
   docker compose --profile "$SERVICE" stop || true
   echo "[$SERVICE] Done cleanup..."
}

trap cleanup SIGTERM SIGINT EXIT

# Execute command in background
eval "$CMD" &
CHILD_PID=$!

# Wait for child process
wait "$CHILD_PID" || true
