#!/usr/bin/env bash
# Start condoVotes locally. Options: --seed --dev --build --no-browser
exec "$(dirname "$0")/scripts/local/start.sh" "$@"
