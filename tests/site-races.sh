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

mkdir -p "$content_dir/races/sample-race" "$content_dir/races/untracked-race" "$data_dir"

cat > "$content_dir/races/_index.md" <<'EOF'
---
title: "Races"
cascade:
  - build:
      publishResources: false
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

cat > "$content_dir/races/sample-race/race.fit" <<'EOF'
private sensor data
EOF

cat > "$content_dir/races/untracked-race/index.md" <<'EOF'
---
title: "Untracked Race"
date: 2025-05-10
distance: 10
time: "45:00"
pace: "4:30"
location: "Bern, CH"
---
EOF

cat > "$data_dir/race_courses.json" <<'EOF'
{
  "sample-race": {
    "route": "M24 210 L320 24 L616 210",
    "pixels": [0, 0.5]
  }
}
EOF

HUGO_DATADIR="$data_dir" hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

races_page="$public_dir/races/index.html"

test "$(grep -o 'class="race-card"' "$races_page" | wc -l | tr -d ' ')" = 2
grep -Fq 'class="race-card" data-tilt' "$races_page"
grep -Fq 'class="race-card__surface"' "$races_page"
grep -Fq '<svg class="race-card__route"' "$races_page"
test "$(grep -o 'class="race-card__art"' "$races_page" | wc -l | tr -d ' ')" = 1
test "$(grep -o 'style="--pixel-opacity:' "$races_page" | wc -l | tr -d ' ')" = 2
if grep -Fq '<script src="/js/race-cards.js" defer></script>' "$races_page"; then
    echo "The races page loads the removed random pixel generator." >&2
    exit 1
fi
if find "$public_dir" -name 'race.fit' -print -quit | grep -q .; then
    echo "The published site contains a raw FIT file." >&2
    exit 1
fi
if grep -Fq '<a href="/sample-race/">' "$races_page"; then
    echo "The race card links to a detail page." >&2
    exit 1
fi
if grep -Eiq 'strava|heart|bpm|running-heatmap' "$races_page"; then
    echo "The races page contains removed activity-integration content." >&2
    exit 1
fi

echo "Race page rendering test passed."
