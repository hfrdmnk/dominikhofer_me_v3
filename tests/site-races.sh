#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)
content_dir="$test_dir/content"
data_dir="$test_dir/data"
public_dir="$test_dir/public"

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$content_dir/races/sample-race" "$data_dir"

cat > "$content_dir/races/_index.md" <<'EOF'
---
title: "Races"
---
EOF

cat > "$content_dir/races/sample-race/index.md" <<'EOF'
---
title: "Sample Race"
date: 2026-07-26
distance: 10
time: "43:58"
pace: "4:23"
location: "Lausanne, CH"
---
EOF

cat > "$data_dir/race_courses.json" <<'EOF'
{
  "sample-race": "M24 210 L320 24 L616 210"
}
EOF

HUGO_DATADIR="$data_dir" hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

races_page="$public_dir/races/index.html"

test "$(grep -o 'class="race-card"' "$races_page" | wc -l | tr -d ' ')" = 1
grep -Fq '<svg class="race-card__route"' "$races_page"
grep -Fq 'data-location-seed="Lausanne, CH"' "$races_page"
grep -Fq '<script src="/js/race-cards.js" defer></script>' "$races_page"
if grep -Eiq 'strava|heart|bpm|running-heatmap' "$races_page"; then
    echo "The races page contains removed activity-integration content." >&2
    exit 1
fi

echo "Race page rendering test passed."
