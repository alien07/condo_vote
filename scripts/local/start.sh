#!/usr/bin/env bash
# Start condoVotes on this computer (macOS / Linux): Docker -> Supabase -> app.
#
#   ./start-local.sh              start (production build, demo sign-in buttons on)
#   ./start-local.sh --seed       also wipe the local database and load demo data
#   ./start-local.sh --dev        use `next dev` instead of the production build
#   ./start-local.sh --build      rebuild even if the code did not change
#   ./start-local.sh --no-browser do not open the browser
#
# The app log is .next/local-server.log. Stop with ./stop-local.sh.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
app_url="http://localhost:3000"
seed=0 dev=0 build=0 browser=1
for arg in "$@"; do
  case "$arg" in
    --seed) seed=1 ;;
    --dev) dev=1 ;;
    --build) build=1 ;;
    --no-browser) browser=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$1"; }
fail() { printf '\n[x] %s\n' "$1" >&2; exit 1; }
wait_http() { # any HTTP answer means the server is up
  for _ in $(seq 1 "$(($2 / 2))"); do
    curl -s -o /dev/null --max-time 5 "$1" && return 0
    sleep 2
  done
  return 1
}

step "Docker"
if ! docker info >/dev/null 2>&1; then
  if [ "$(uname)" = "Darwin" ]; then
    echo "Starting Docker Desktop ..."
    open -a Docker || fail "Docker Desktop not found. Start Docker yourself, then run this again."
  else
    fail "Docker is not running. Start it, then run this again."
  fi
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 3; done
  docker info >/dev/null 2>&1 || fail "Docker did not start within 3 minutes."
fi
echo "Docker is running."

step "Supabase"
if ! out="$(npx supabase start 2>&1)"; then
  echo "$out"
  echo "$out" | grep -q "already running" || fail "supabase start failed (see above)."
fi
wait_http "http://127.0.0.1:54321/rest/v1/" 90 || fail "Supabase API (port 54321) did not answer."
echo "Supabase is running. Studio: http://localhost:54323  Mail: http://localhost:54324"

if [ "$seed" = 1 ]; then
  step "Demo data (wipes the local database)"
  node scripts/seed-demo.mjs --reset --consent
fi

step "App"
"$root/scripts/local/stop.sh" --app-only --quiet
log="$root/.next/local-server.log"
mkdir -p "$root/.next"

if [ "$dev" = 1 ]; then
  nohup npm run dev >"$log" 2>&1 &
else
  head="$(git rev-parse HEAD 2>/dev/null || true)"
  marker="$root/.next/local-build-head"
  built="$(cat "$marker" 2>/dev/null || true)"
  dirty="$(git status --porcelain --untracked-files=no 2>/dev/null | grep -v next-env.d.ts || true)"
  if [ "$build" = 1 ] || [ ! -f "$root/.next/BUILD_ID" ] || [ "$built" != "$head" ] || [ -n "$dirty" ]; then
    echo "Building (about a minute) ..."
    # Route types left by `next dev` on another branch break the type check.
    rm -rf "$root/.next/dev/types"
    npm run build
    echo "$head" >"$marker"
  else
    echo "Code unchanged since the last build; skipping build (use --build to force)."
  fi
  # Demo sign-in buttons need this flag in a production build (local only).
  ENABLE_LOCAL_AUTH_BYPASS=1 nohup npx next start -p 3000 >"$log" 2>&1 &
fi
echo $! >"$root/.next/local-server.pid"

wait_http "$app_url/login" 180 || fail "The app did not answer at $app_url. See $log"

step "Ready"
echo "App:   $app_url"
echo "Help:  $app_url/help"
echo "Log:   $log"
echo "Stop:  ./stop-local.sh"
if [ "$browser" = 1 ] && command -v open >/dev/null 2>&1; then open "$app_url"; fi
