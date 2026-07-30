#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)
content_dir="$test_dir/content"
public_dir="$test_dir/public"
data_dir="$test_dir/data"

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$content_dir/posts" "$content_dir/races" "$data_dir"

cat > "$content_dir/_index.md" <<'EOF'
---
title: "Test home"
kicker: "Test kicker"
---

{{< prose >}}
Introductory copy with an [external link](https://example.com/), and an [internal link](/posts).
{{< /prose >}}

{{< archive count="2" filter="favorite" >}}

{{< archive count="3" >}}

{{< follow-card >}}
EOF

cat > "$content_dir/posts/_index.md" <<'EOF'
---
title: "Posts"
kicker: "Archive"
---

{{< archive >}}
EOF

cat > "$content_dir/races/_index.md" <<'EOF'
---
title: "Races"
kicker: "Race archive"
---
EOF

create_post() {
    slug=$1
    date=$2
    favorite=$3
    tags=$4
    archived=${5:-false}

    mkdir -p "$content_dir/posts/$slug"
    cat > "$content_dir/posts/$slug/index.md" <<EOF
---
title: "$slug"
slug: "$slug"
date: $date
favorite: $favorite
tags: [$tags]
archived: $archived
---

Post body.
EOF
}

create_post "favorite-one" "2026-01-01" true '"writing"'
create_post "favorite-two" "2026-01-02" true '"design"'
create_post "favorite-three" "2026-01-03" true '"writing", "indieweb carnival"'
create_post "recent-one" "2026-02-01" false '"writing"'
create_post "recent-two" "2026-02-02" false '"design"'
create_post "recent-three" "2026-02-03" false '"personal"'
create_post "archived-favorite" "2026-03-01" true '"writing"' true

for slug in race-one race-two
do
    mkdir -p "$content_dir/races/$slug"
    cat > "$content_dir/races/$slug/index.md" <<EOF
---
title: "$slug"
slug: "$slug"
date: 2026-03-01
distance: 10
time: "42:00"
pace: "4:12"
location: "Bern, CH"
---

Race report.
EOF
done

HUGO_DATADIR="$data_dir" hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

homepage="$public_dir/index.html"
posts_page="$public_dir/posts/index.html"
races_page="$public_dir/races/index.html"

grep -Fq '<header class="intro">' "$homepage"
grep -Fq '<div class="prose">' "$homepage"
grep -Fq 'class="follow-card breakout"' "$homepage"
grep -Fq 'href="https://example.com/" target="_blank" rel="noopener noreferrer"' "$homepage"
grep -Fq 'href="/posts"' "$homepage"
word_joiner=$(printf '\342\201\240')
grep -Fq "</a>$word_joiner," "$homepage"
internal_link=$(grep -o '<a href="/posts"[^>]*>' "$homepage")
if printf '%s' "$internal_link" | grep -Fq 'target="_blank"'; then
    echo "An internal link opens in a new tab." >&2
    exit 1
fi

test "$(grep -o 'class="archive archive--excerpt"' "$homepage" | wc -l | tr -d ' ')" = 2
test "$(grep -o 'class="post-list__item"' "$homepage" | wc -l | tr -d ' ')" = 5
test "$(grep -o 'class="archive__more button-underline"' "$homepage" | wc -l | tr -d ' ')" = 2
grep -Fq 'href="/posts/?favorite=true">View all favorites</a>' "$homepage"
grep -Fq 'href="/posts/">View all posts</a>' "$homepage"

favorite_archive=$(sed -n '/data-filter="favorite"/,/<\/div>/p' "$homepage")
test "$(printf '%s' "$favorite_archive" | grep -o 'href="/favorite-[^"]*"' | wc -l | tr -d ' ')" = 2
favorite_dates=$(printf '%s' "$favorite_archive" | grep -o 'datetime="[0-9-]*"' | cut -d'"' -f2)
test "$favorite_dates" = "$(printf '%s\n' "$favorite_dates" | sort -r)"
if printf '%s' "$favorite_archive" | grep -Fq 'recent-'; then
    echo "The favorites archive contains an unfiltered post." >&2
    exit 1
fi
if printf '%s' "$favorite_archive" | grep -Fq '<mark>'; then
    echo "The favorites archive marks titles redundantly." >&2
    exit 1
fi
if grep -Fq 'archived-favorite' "$homepage"; then
    echo "An archived post appears in a homepage archive." >&2
    exit 1
fi

grep -Fq 'recent-three' "$homepage"
grep -Fq 'recent-two' "$homepage"
grep -Fq 'recent-one' "$homepage"

test "$(grep -o 'class="archive archive--full"' "$posts_page" | wc -l | tr -d ' ')" = 1
test "$(grep -o 'class="post-list__item"' "$posts_page" | wc -l | tr -d ' ')" = 6
test "$(grep -o 'post-list__title"><mark>' "$posts_page" | wc -l | tr -d ' ')" = 3
grep -Fq 'data-query-filter' "$posts_page"
grep -Fq 'data-favorite="true"' "$posts_page"
grep -Fq 'data-tags=' "$posts_page"
if grep -Fq 'archived-favorite' "$posts_page"; then
    echo "An archived post appears on the posts page." >&2
    exit 1
fi
test "$(grep -o 'class="race-card"' "$races_page" | wc -l | tr -d ' ')" = 2
test "$(grep -o '<dt>Distance</dt>' "$races_page" | wc -l | tr -d ' ')" = 2
test "$(grep -o 'class="race-card" data-tilt' "$races_page" | wc -l | tr -d ' ')" = 2
if grep -Fq 'class="race-card__art"' "$races_page"; then
    echo "An untracked race rendered background artwork." >&2
    exit 1
fi
if grep -Fq 'class="post-list__item"' "$races_page"; then
    echo "The races page rendered the generic post archive." >&2
    exit 1
fi

echo "Page component tests passed."
