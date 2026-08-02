#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

hugo \
    --source "$root_dir" \
    --destination "$test_dir/public" \
    --quiet

page="$test_dir/public/30-days-of-building-morgenblau/index.html"

grep -Fq 'class="nav__home meta-link"' "$page"
grep -Fq 'class="progress meta-link"' "$page"
grep -Fq 'class="reply-by-email meta-link"' "$page"

for image in 01_login.png 02_digest.png 03_reader.png 04_source.png
do
    grep -Fq "<p><img src=\"/30-days-of-building-morgenblau/$image\"" "$page"
done

if grep -Eq '//(8locljr18ve7g6zu|jy1drcwin9eveu6g|aobh13erjffodiak|tzezlfltsyugls9o)' "$page"; then
    echo "The Morgenblau post still contains obsolete image placeholders." >&2
    exit 1
fi

echo "Morgenblau post rendering test passed."
