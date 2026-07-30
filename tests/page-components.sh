#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)
content_dir="$test_dir/content"
public_dir="$test_dir/public"

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$content_dir/posts" "$content_dir/races"

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

    mkdir -p "$content_dir/posts/$slug"
    cat > "$content_dir/posts/$slug/index.md" <<EOF
---
title: "$slug"
slug: "$slug"
date: $date
favorite: $favorite
---

Post body.
EOF
}

create_post "favorite-one" "2026-01-01" true
create_post "favorite-two" "2026-01-02" true
create_post "favorite-three" "2026-01-03" true
create_post "recent-one" "2026-02-01" false
create_post "recent-two" "2026-02-02" false
create_post "recent-three" "2026-02-03" false

for slug in race-one race-two
do
    mkdir -p "$content_dir/races/$slug"
    cat > "$content_dir/races/$slug/index.md" <<EOF
---
title: "$slug"
slug: "$slug"
date: 2026-03-01
---

Race report.
EOF
done

hugo \
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

favorite_archive=$(sed -n '/data-filter="favorite"/,/<\/div>/p' "$homepage")
test "$(printf '%s' "$favorite_archive" | grep -o 'href="/favorite-[^"]*"' | wc -l | tr -d ' ')" = 2
if printf '%s' "$favorite_archive" | grep -Fq 'recent-'; then
    echo "The favorites archive contains an unfiltered post." >&2
    exit 1
fi

grep -Fq 'recent-three' "$homepage"
grep -Fq 'recent-two' "$homepage"
grep -Fq 'recent-one' "$homepage"

test "$(grep -o 'class="archive archive--full"' "$posts_page" | wc -l | tr -d ' ')" = 1
test "$(grep -o 'class="post-list__item"' "$posts_page" | wc -l | tr -d ' ')" = 6
test "$(grep -o 'class="archive archive--full"' "$races_page" | wc -l | tr -d ' ')" = 1
test "$(grep -o 'class="post-list__item"' "$races_page" | wc -l | tr -d ' ')" = 2

echo "Page component tests passed."
