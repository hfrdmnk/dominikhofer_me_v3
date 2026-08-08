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
    --destination "$test_dir/production" \
    --environment production \
    --quiet

hugo \
    --source "$root_dir" \
    --destination "$test_dir/development" \
    --environment development \
    --quiet

production_page="$test_dir/production/index.html"
development_page="$test_dir/development/index.html"
production_css=$(find "$test_dir/production/css" -name 'main.*.css' | head -n 1)
development_css=$(find "$test_dir/development/css" -name 'main.*.css' | head -n 1)

if grep -Fq 'data-dev-theme-picker' "$production_page" || \
    grep -Fq 'dev-theme-picker.js' "$production_page" || \
    grep -Fq 'dev-theme-day' "$production_page" || \
    grep -Fq '.dev-theme-picker' "$production_css"; then
    echo "Development theme picker code rendered in production." >&2
    exit 1
fi

grep -Fq 'data-dev-theme-picker' "$development_page"
grep -Fq 'data-theme-reset' "$development_page"
grep -Fq 'dev-theme-picker.js' "$development_page"
grep -Fq 'dev-theme-day' "$development_page"
grep -Fq '.dev-theme-picker' "$development_css"
test "$(grep -o 'data-theme-day=' "$development_page" | wc -l | tr -d ' ')" = 7

echo "Development theme picker rendering test passed."
