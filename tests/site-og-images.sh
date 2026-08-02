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

mkdir -p \
    "$content_dir/posts/short-title" \
    "$content_dir/posts/titleless" \
    "$content_dir/posts/long-title" \
    "$data_dir"

cat > "$content_dir/_index.md" <<'EOF'
---
title: "Test home"
---
EOF

cat > "$content_dir/posts/_index.md" <<'EOF'
---
title: "Posts"
---
EOF

cat > "$content_dir/posts/short-title/index.md" <<'EOF'
---
title: "A short title"
slug: "short-title"
date: 2026-01-01
---
EOF

cat > "$content_dir/posts/titleless/index.md" <<'EOF'
---
title: ""
slug: "titleless"
date: 2026-01-02
---
EOF

cat > "$content_dir/posts/long-title/index.md" <<'EOF'
---
title: "A deliberately long title that needs several carefully wrapped lines without escaping the available image area"
slug: "long-title"
date: 2026-01-03
---
EOF

HUGO_DATADIR="$data_dir" hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

home_page="$public_dir/index.html"
section_page="$public_dir/posts/index.html"
short_page="$public_dir/short-title/index.html"
titleless_page="$public_dir/titleless/index.html"
long_page="$public_dir/long-title/index.html"

assert_social_metadata() {
    page=$1
    expected_title=$2
    expected_type=$3

    grep -Fq "<meta property=\"og:title\" content=\"$expected_title\">" "$page"
    grep -Eq '<meta property="og:description" content="[^\"]+">' "$page"
    grep -Fq "<meta property=\"og:type\" content=\"$expected_type\">" "$page"
    grep -Eq '<meta property="og:url" content="https://dominikhofer.me/[^\"]*">' "$page"
    grep -Fq '<meta property="og:site_name" content="Dominik Hofer">' "$page"
    grep -Eq '<meta property="og:image" content="https://dominikhofer.me/[^\"]+\.png">' "$page"
    grep -Fq '<meta property="og:image:type" content="image/png">' "$page"
    grep -Fq '<meta property="og:image:width" content="1200">' "$page"
    grep -Fq '<meta property="og:image:height" content="630">' "$page"
    grep -Fq '<meta name="twitter:card" content="summary_large_image">' "$page"
    grep -Fq "<meta name=\"twitter:title\" content=\"$expected_title\">" "$page"
    grep -Eq '<meta name="twitter:description" content="[^\"]+">' "$page"
    grep -Eq '<meta name="twitter:image" content="https://dominikhofer.me/[^\"]+\.png">' "$page"
}

assert_social_metadata "$home_page" "Test home" "website"
assert_social_metadata "$section_page" "Posts" "website"
assert_social_metadata "$short_page" "A short title" "article"
assert_social_metadata "$titleless_page" "January 2, 2026" "article"
assert_social_metadata "$long_page" "A deliberately long title that needs several carefully wrapped lines without escaping the available image area" "article"

image_path() {
    sed -n 's|.*<meta property="og:image" content="https://dominikhofer.me/\([^\"]*\.png\)">.*|\1|p' "$1"
}

twitter_image_path() {
    sed -n 's|.*<meta name="twitter:image" content="https://dominikhofer.me/\([^\"]*\.png\)">.*|\1|p' "$1"
}

home_image=$(image_path "$home_page")
section_image=$(image_path "$section_page")
short_image=$(image_path "$short_page")
titleless_image=$(image_path "$titleless_page")
long_image=$(image_path "$long_page")

test -n "$home_image"
test -n "$section_image"
test -n "$short_image"
test -n "$titleless_image"
test -n "$long_image"

test "$home_image" != "$section_image"
test "$section_image" != "$short_image"
test "$short_image" != "$titleless_image"
test "$titleless_image" != "$long_image"

for image in "$home_image" "$section_image" "$short_image" "$titleless_image" "$long_image"
do
    file "$public_dir/$image" | grep -Fq 'PNG image data, 1200 x 630'
done

for page in "$home_page" "$section_page" "$short_page" "$titleless_page" "$long_page"
do
    test "$(image_path "$page")" = "$(twitter_image_path "$page")"
done

echo "Open Graph image tests passed."
