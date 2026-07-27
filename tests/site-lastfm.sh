#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$test_dir/data" "$test_dir/themes"
cp "$root_dir/tests/fixtures/lastfm/now-playing.json" "$test_dir/data/lastfm.json"
cp -R "$root_dir/themes/dominik" "$test_dir/themes/"
printf '%s\n' \
    '{{ return partial "lastfm/track.html" hugo.Data.lastfm }}' \
    > "$test_dir/themes/dominik/layouts/partials/lastfm/fetch.html"

HUGO_DATADIR="$test_dir/data" \
hugo \
    --source "$root_dir" \
    --themesDir "$test_dir/themes" \
    --destination "$test_dir/public" \
    --quiet

homepage="$test_dir/public/index.html"

grep -Fq "Completed Song, Previous Artist" "$homepage"
grep -Fq \
    'href="https://www.last.fm/music/Previous&#43;Artist/_/Completed&#43;Song"' \
    "$homepage"

if grep -Fq "Active Song" "$homepage"; then
    echo "Rendered the active track instead of the last completed track." >&2
    exit 1
fi

echo "Last.fm site rendering test passed."
