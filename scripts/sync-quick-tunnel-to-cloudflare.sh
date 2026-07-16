#!/bin/sh
set -eu

ENV_FILE="${TRACE_CLOUDFLARE_ENV:-$HOME/.config/trace-logo-editor/cloudflare.env}"
LOG_FILE="${TRACE_CLOUDFLARED_LOG:-$HOME/trace-logo-cloudflared.log}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

: "${PAGES_SYNC_TOKEN:?PAGES_SYNC_TOKEN is required}"
PAGES_SYNC_URL="${PAGES_SYNC_URL:-https://trace-logo-editor.pages.dev/tunnel-admin/update}"

attempt=0
tunnel_url=""
while [ "$attempt" -lt 30 ]; do
  tunnel_url=$(grep -hEo 'https://[-a-zA-Z0-9.]+\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | tail -1 || true)
  if [ -n "$tunnel_url" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ -z "$tunnel_url" ]; then
  echo "No Quick Tunnel URL found in $LOG_FILE" >&2
  exit 1
fi

response=$(curl -fsS -X POST "$PAGES_SYNC_URL" \
  -H "Authorization: Bearer $PAGES_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "{\"tunnelUrl\":\"$tunnel_url\"}")

case "$response" in
  *'"success":true'*) ;;
  *)
    echo "Cloudflare Pages origin update failed: $response" >&2
    exit 1
    ;;
esac

echo "Trace Logo Editor Pages origin updated: $tunnel_url"
