#!/usr/bin/env bash
# Stop condoVotes on this computer (macOS / Linux): the app, then Supabase.
# Data is kept.
#
#   ./scripts/local/stop.sh             stop the app and Supabase
#   ./scripts/local/stop.sh --app-only  stop only the app
set -uo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
app_only=0 quiet=0
for arg in "$@"; do
  case "$arg" in
    --app-only) app_only=1 ;;
    --quiet) quiet=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
say() { [ "$quiet" = 1 ] || echo "$1"; }

pid_file="$root/.next/local-server.pid"
if [ -f "$pid_file" ]; then
  pkill -P "$(cat "$pid_file")" 2>/dev/null || true
  kill "$(cat "$pid_file")" 2>/dev/null || true
  rm -f "$pid_file"
fi
# Anything still listening on port 3000.
if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:3000 -sTCP:LISTEN | xargs kill 2>/dev/null || true
fi
say "App stopped."

[ "$app_only" = 1 ] && exit 0

cd "$root"
if docker info >/dev/null 2>&1; then
  npx supabase stop >/dev/null 2>&1 || true
  say "Supabase stopped (data kept in Docker volumes)."
else
  say "Docker is not running; Supabase is already stopped."
fi
