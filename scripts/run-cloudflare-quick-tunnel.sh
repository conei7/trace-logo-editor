#!/bin/sh
set -eu

LOG_FILE="${TRACE_CLOUDFLARED_LOG:-$HOME/trace-logo-cloudflared.log}"
WEB_PORT="${TRACE_WEB_PORT:-8787}"

: > "$LOG_FILE"
cloudflared tunnel --url "http://127.0.0.1:$WEB_PORT" >> "$LOG_FILE" 2>&1 &
cloudflared_pid=$!

cleanup() {
  kill "$cloudflared_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

while ! "$(dirname "$0")/sync-quick-tunnel-to-cloudflare.sh"; do
  if ! kill -0 "$cloudflared_pid" 2>/dev/null; then
    wait "$cloudflared_pid"
    exit $?
  fi
  echo "Tunnel URL sync failed; retrying in 30 seconds" >&2
  sleep 30
done

wait "$cloudflared_pid"
