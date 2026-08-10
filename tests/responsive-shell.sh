#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$test_dir/data" "$test_dir/themes"
cp "$root_dir/tests/fixtures/lastfm/completed.json" "$test_dir/data/lastfm.json"
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
posts="$test_dir/public/posts/index.html"

grep -Fq 'aria-controls="primary-navigation"' "$homepage"
grep -Fq 'data-menu-panel' "$homepage"
grep -Fq 'class="page page--has-header-media"' "$homepage"
grep -Fq 'class="content__home meta-link"' "$posts"
grep -Fq '<a href="/" aria-current="page">/</a>' "$homepage"
grep -Fq '<a href="/">/</a>' "$posts"
grep -Fq 'class="nav__home meta-link"' "$posts"
grep -Fq 'class="progress meta-link"' "$homepage"

if grep -Fq 'class="nav__brand"' "$homepage"; then
    echo "Homepage still renders the mobile logo." >&2
    exit 1
fi

if grep -Fq 'page--has-header-media' "$posts"; then
    echo "Posts archive uses full image headroom without header media." >&2
    exit 1
fi

if grep -Fq 'class="nav__home meta-link"' "$homepage"; then
    echo "Homepage renders a redundant Back home link." >&2
    exit 1
fi

if grep -Fq 'class="topbar__path"' "$homepage"; then
    echo "Homepage still renders the path slug." >&2
    exit 1
fi

topbar_track_line=$(grep -n -m 1 'class="topbar__track"' "$homepage" | cut -d: -f1)
topbar_particle_line=$(grep -n -m 1 'class="now-playing__particle"' "$homepage" | cut -d: -f1)
nav_track_line=$(grep -n -m 1 'class="nav__track"' "$homepage" | cut -d: -f1)
nav_particle_line=$(grep -n 'class="now-playing__particle"' "$homepage" | tail -n 1 | cut -d: -f1)
test "$topbar_track_line" -lt "$topbar_particle_line"
test "$nav_track_line" -lt "$nav_particle_line"

title_line=$(grep -n -m 1 'class="post-list__title"' "$posts" | cut -d: -f1)
date_line=$(grep -n -m 1 'class="post-list__date"' "$posts" | cut -d: -f1)
test "$title_line" -lt "$date_line"

echo "Responsive shell rendering test passed."
