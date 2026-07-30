#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"

if [ -f .env ]; then
    set -a
    . ./.env
    set +a
fi

node scripts/races.mjs
exec hugo "$@"
