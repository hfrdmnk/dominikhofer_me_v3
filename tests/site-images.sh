#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p \
    "$test_dir/content/image-test" \
    "$test_dir/layouts/_default/_markup" \
    "$test_dir/layouts/_default" \
    "$test_dir/layouts/partials"

cp \
    "$root_dir/themes/dominik/layouts/_default/_markup/render-image.html" \
    "$test_dir/layouts/_default/_markup/render-image.html"
if [ -f "$root_dir/themes/dominik/layouts/partials/responsive-image.html" ]; then
    cp \
        "$root_dir/themes/dominik/layouts/partials/responsive-image.html" \
        "$test_dir/layouts/partials/responsive-image.html"
fi

cp "$root_dir/assets/images/og-base.png" "$test_dir/content/image-test/photo.png"
cp "$root_dir/assets/images/signature.svg" "$test_dir/content/image-test/signature.svg"
printf '%s\n' 'video' > "$test_dir/content/image-test/clip.mp4"

cat > "$test_dir/hugo.toml" <<'EOF'
baseURL = 'https://example.com/'
disableKinds = ['home', 'section', 'taxonomy', 'term', 'rss', 'sitemap', 'robotsTXT', '404']
EOF

cat > "$test_dir/layouts/_default/single.html" <<'EOF'
{{ .Content }}
{{ with .Resources.Get "photo.png" }}
  {{ partial "responsive-image.html" (dict
    "image" .
    "alt" "Component image"
    "class" "component__image"
    "pictureClass" "component__picture"
    "sizes" "128px"
    "widths" (slice 128 256)
  ) }}
{{ end }}
EOF

cat > "$test_dir/content/image-test/index.md" <<'EOF'
---
title: Image test
---

![Raster image](photo.png)

![Vector image](signature.svg)

![Remote image](https://example.com/photo.jpg)

![Video](clip.mp4)
EOF

hugo --source "$test_dir" --destination "$test_dir/public" --quiet

page="$test_dir/public/image-test/index.html"

grep -Fq '<picture>' "$page"
grep -Fq 'type="image/avif"' "$page"
grep -Fq 'type="image/webp"' "$page"
grep -Fq 'sizes="(max-width: 60rem) calc(100vw - 3rem), 45rem"' "$page"
grep -Eq 'srcset="[^"]+\.avif [0-9]+w(, [^"]+\.avif [0-9]+w)+"' "$page"
grep -Eq 'srcset="[^"]+\.webp [0-9]+w(, [^"]+\.webp [0-9]+w)+"' "$page"
grep -Fq 'alt="Raster image"' "$page"
grep -Fq 'width="2400" height="1260"' "$page"
grep -Fq 'loading="lazy" decoding="async"' "$page"
grep -Fq '<img src="/image-test/signature.svg" alt="Vector image"' "$page"
grep -Fq '<img src="https://example.com/photo.jpg" alt="Remote image"' "$page"
grep -Fq '<video src="/image-test/clip.mp4" controls playsinline preload="metadata"></video>' "$page"
grep -Fq '<picture class="component__picture">' "$page"
grep -Fq 'sizes="128px"' "$page"
grep -Fq 'class="component__image"' "$page"

test "$(find "$test_dir/public" -type f -name '*.avif' | wc -l | tr -d ' ')" -ge 2
test "$(find "$test_dir/public" -type f -name '*.webp' | wc -l | tr -d ' ')" -ge 2

echo "Responsive image rendering test passed."
