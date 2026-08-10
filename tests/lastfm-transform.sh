#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fixtures="$root_dir/tests/fixtures/lastfm"
test_dir=$(mktemp -d)
theme_dir="$test_dir/themes/dominik"
homepage="$test_dir/public/index.html"

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$test_dir/data" "$test_dir/themes"
cp -R "$root_dir/themes/dominik" "$theme_dir"
printf '%s\n' \
    '{{ return partial "lastfm/track.html" hugo.Data.lastfm }}' \
    > "$theme_dir/layouts/partials/lastfm/fetch.html"

render() {
    cp "$fixtures/$1" "$test_dir/data/lastfm.json"
    HUGO_DATADIR="$test_dir/data" hugo \
        --source "$root_dir" \
        --themesDir "$test_dir/themes" \
        --destination "$test_dir/public" \
        --quiet
}

assert_rendered() {
    fixture=$1
    expected=$2

    render "$fixture"
    if ! grep -Fq "$expected" "$homepage"; then
        echo "$fixture: expected to render $expected" >&2
        exit 1
    fi
}

assert_hidden() {
    fixture=$1

    render "$fixture"
    if grep -Fq 'class="topbar__now"' "$homepage" || grep -Fq 'class="nav__now"' "$homepage"; then
        echo "$fixture: expected the Last.fm item to be hidden" >&2
        exit 1
    fi
}

assert_rendered "now-playing.json" "Completed Song, Previous Artist"
if grep -Fq "Active Song" "$homepage"; then
    echo "now-playing.json: rendered the active track" >&2
    exit 1
fi

assert_rendered "completed.json" "Autumn, Ben Böhmer"
assert_rendered "unicode.json" "L’été d’après (feat. O’Neil), Björk &amp; Sigur Rós"
assert_hidden "empty.json"
assert_hidden "error.json"
assert_hidden "malformed.json"

echo "Last.fm transform tests passed."
