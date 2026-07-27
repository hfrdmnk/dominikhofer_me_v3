#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${LASTFM_ENV_FILE:-"$root_dir/.env"}

cd "$root_dir"

if [ -r "$env_file" ]; then
    api_key=$(sed -n 's/^LASTFM_API_KEY=//p' "$env_file" | tail -n 1 | tr -d '\r')
    LASTFM_API_KEY="$api_key" LASTFM_API_KEY_FILE=/dev/null ./scripts/fetch-lastfm.sh
else
    LASTFM_API_KEY_FILE="$env_file" ./scripts/fetch-lastfm.sh
fi

exec hugo server "$@"
