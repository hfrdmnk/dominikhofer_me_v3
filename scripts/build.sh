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

blogroll_updated=$(git log -1 --format=%cI -- content/blogroll/feeds.opml 2>/dev/null || true)
if [ -n "$blogroll_updated" ]; then
    export HUGO_PARAMS_BLOGROLLUPDATED="$blogroll_updated"
fi

exec hugo "$@"
