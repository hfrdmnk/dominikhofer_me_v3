#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
filter="$root_dir/scripts/lastfm-transform.jq"
fixtures="$root_dir/tests/fixtures/lastfm"

assert_json() {
    fixture=$1
    expected=$2
    actual=$(jq -c -f "$filter" "$fixtures/$fixture")

    if [ "$actual" != "$expected" ]; then
        echo "$fixture: expected $expected, got ${actual:-<empty>}" >&2
        exit 1
    fi
}

assert_empty() {
    fixture=$1
    actual=$(jq -c -f "$filter" "$fixtures/$fixture")

    if [ -n "$actual" ]; then
        echo "$fixture: expected no output, got $actual" >&2
        exit 1
    fi
}

assert_invalid() {
    fixture=$1

    if jq -c -f "$filter" "$fixtures/$fixture" >/dev/null 2>&1; then
        echo "$fixture: expected parsing to fail" >&2
        exit 1
    fi
}

assert_json \
    "now-playing.json" \
    '{"track":"Completed Song","artist":"Previous Artist","url":"https://www.last.fm/music/Previous+Artist/_/Completed+Song"}'

assert_json \
    "completed.json" \
    '{"track":"Autumn","artist":"Ben Böhmer","url":"https://www.last.fm/music/Ben+B%C3%B6hmer/_/Autumn"}'

assert_json \
    "unicode.json" \
    '{"track":"L’été d’après (feat. O’Neil)","artist":"Björk & Sigur Rós","url":"https://www.last.fm/music/Bj%C3%B6rk+%26+Sigur+R%C3%B3s/_/L%27%C3%A9t%C3%A9+d%27apr%C3%A8s"}'

assert_empty "empty.json"
assert_empty "error.json"
assert_empty "malformed.json"
assert_invalid "invalid.json"

echo "Last.fm transform tests passed."
