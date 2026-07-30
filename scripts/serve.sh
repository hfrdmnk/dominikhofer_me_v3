#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$root_dir"

if [ ! -f .env ]; then
    echo "Missing .env. Copy .env.example and add HUGO_LASTFM_API_KEY." >&2
    exit 1
fi

set -a
. ./.env
set +a

node scripts/races.mjs
exec hugo server "$@"
