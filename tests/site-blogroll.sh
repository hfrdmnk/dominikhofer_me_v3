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

mkdir -p "$content_dir/blogroll"

cat > "$content_dir/blogroll/index.md" <<'EOF'
---
title: "Blogroll"
updatedResource: "feeds.opml"
build:
  publishResources: false
---
EOF

cat > "$content_dir/blogroll/feeds.opml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.1">
  <head>
    <title>feeds.opml</title>
  </head>
  <body>
    <outline text="Personal" title="Personal">
      <outline text="First Blog" title="First Blog" type="rss" htmlUrl="https://first.example/" xmlUrl="https://first.example/feed.xml"/>
      <outline text="A Very Long Blog Title That Needs To Wrap Without Separating Its Feed Link" title="A Very Long Blog Title That Needs To Wrap Without Separating Its Feed Link" type="rss" htmlUrl="https://long.example/" xmlUrl="https://long.example/rss.xml"/>
    </outline>
    <outline text="Publications" title="Publications">
      <outline text="Three &amp; Three" title="Three &amp; Three" type="rss" htmlUrl="https://three.example/" xmlUrl="https://three.example/feed"/>
    </outline>
  </body>
</opml>
EOF

HUGO_PARAMS_BLOGROLLUPDATED="2026-07-14T10:30:00+02:00" hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

page="$public_dir/blogroll/index.html"

grep -Fq '<h1 class="intro__title">Blogroll</h1>' "$page"
grep -Fq '<time datetime="2026-07-14">July 14, 2026</time>' "$page"
grep -Fq '<h2 id="personal">Personal</h2>' "$page"
grep -Fq '<h2 id="publications">Publications</h2>' "$page"
grep -Fq 'href="https://first.example/" target="_blank" rel="noopener noreferrer">First Blog</a>' "$page"
grep -Fq 'href="https://first.example/feed.xml" target="_blank" rel="noopener noreferrer" aria-label="RSS feed for First Blog"' "$page"
grep -Fq 'aria-label="RSS feed for Three &amp; Three"' "$page"
grep -Fq 'd="M12 19C12 14.8 9.2 12 5 12"' "$page"
grep -Fq 'd="M19 19C19 10.6 13.4 5 5 5"' "$page"
grep -Fq 'stroke="currentColor"' "$page"

first_line=$(grep -n '>First Blog</a>' "$page" | cut -d: -f1)
long_line=$(grep -n '>A Very Long Blog Title' "$page" | cut -d: -f1)
publication_line=$(grep -n '>Three &amp; Three</a>' "$page" | cut -d: -f1)
test "$first_line" -lt "$long_line"
test "$long_line" -lt "$publication_line"

if grep -Fq 'href="/blogroll"' "$page"; then
    echo "The blogroll appears in primary navigation." >&2
    exit 1
fi

if [ -e "$public_dir/blogroll/feeds.opml" ]; then
    echo "The source OPML file was published." >&2
    exit 1
fi

css_file=$(find "$public_dir/css" -name 'main.*.css' | head -n 1)
grep -Fq '.prose .blogroll__feed{' "$css_file"
grep -Fq 'text-decoration-line:none' "$css_file"

rm "$content_dir/blogroll/feeds.opml"
if hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$test_dir/missing-public" \
    >"$test_dir/missing-error" 2>&1
then
    echo "A blogroll without feeds.opml built successfully." >&2
    exit 1
fi
if ! grep -Fq 'Unable to get blogroll resource "feeds.opml"' "$test_dir/missing-error"; then
    cat "$test_dir/missing-error" >&2
    exit 1
fi

cat > "$content_dir/blogroll/feeds.opml" <<'EOF'
<opml><body><outline title="Broken"></body></opml>
EOF
if hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$test_dir/malformed-public" \
    >"$test_dir/malformed-error" 2>&1
then
    echo "A blogroll with malformed OPML built successfully." >&2
    exit 1
fi
if ! grep -Fq 'error calling Unmarshal' "$test_dir/malformed-error"; then
    cat "$test_dir/malformed-error" >&2
    exit 1
fi

echo "Blogroll page rendering test passed."
