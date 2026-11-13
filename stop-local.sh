#!/usr/bin/env bash
# Stop condoVotes locally. Options: --app-only
exec "$(dirname "$0")/scripts/local/stop.sh" "$@"
