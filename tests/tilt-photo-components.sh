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

homepage="$test_dir/public/index.html"
about_page="$test_dir/public/about/index.html"
now_page="$test_dir/public/now/index.html"

assert_count() {
    expected=$1
    pattern=$2
    file=$3
    actual=$(grep -o "$pattern" "$file" | wc -l | tr -d ' ')

    if [ "$actual" != "$expected" ]; then
        echo "$file: expected $expected matches for $pattern, got $actual." >&2
        exit 1
    fi
}

assert_count 2 'class="tilt-photo"' "$homepage"
assert_count 2 'class="tilt-photo"' "$about_page"
assert_count 0 'class="tilt-photo-pair"' "$now_page"

grep -Fq 'data-tilt' "$homepage"
grep -Fq 'aria-describedby="home-photo-dominik-tooltip"' "$homepage"
grep -Fq 'id="home-photo-dominik-tooltip" role="tooltip">That&#39;s me, hi :)</span>' "$homepage"
grep -Fq 'id="home-photo-naida-tooltip" role="tooltip">My dog Naida</span>' "$homepage"

grep -Fq 'aria-describedby="about-photo-marathon-tooltip"' "$about_page"
grep -Fq 'id="about-photo-marathon-tooltip" role="tooltip">Finishing my first Marathon</span>' "$about_page"
grep -Fq 'id="about-photo-childhood-tooltip" role="tooltip">Where it all began</span>' "$about_page"
grep -Fq 'src="/images/about-1.avif"' "$about_page"
grep -Fq 'src="/images/about-2.avif"' "$about_page"

if grep -Fq 'home-portraits' "$homepage"; then
    echo "Homepage still renders the legacy home-portraits component." >&2
    exit 1
fi

echo "Tilt photo component rendering test passed."
