#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

content_dir="$test_dir/content"
public_dir="$test_dir/public"

mkdir -p \
    "$content_dir/posts/normal" \
    "$content_dir/posts/feed-only" \
    "$content_dir/posts/archived" \
    "$content_dir/posts/draft"

cat > "$content_dir/posts/_index.md" <<'EOF'
---
title: Posts
---

{{< archive >}}
EOF

cat > "$content_dir/posts/normal/index.md" <<'EOF'
---
title: Normal post
slug: normal-post
date: 2026-08-02T10:00:00+02:00
tags: [publication-state]
draft: false
---

NORMAL_BODY_MARKER

Normal post with a footnote.[^1]

[^1]: NORMAL_FOOTNOTE_MARKER
EOF

cat > "$content_dir/posts/feed-only/index.md" <<'EOF'
---
title: Feed-only post
slug: feed-only-post
date: 2026-08-02T09:00:00+02:00
tags: [publication-state]
description: FEED_ONLY_DESCRIPTION_MARKER
cover: cover.txt
media: [media.txt]
feed_only: true
atUri: at://did:plc:test/site.standard.document/feed-only
draft: false
---

FEED_ONLY_BODY_MARKER
EOF

printf '%s\n' FEED_ONLY_COVER_MARKER > "$content_dir/posts/feed-only/cover.txt"
printf '%s\n' FEED_ONLY_MEDIA_MARKER > "$content_dir/posts/feed-only/media.txt"

cat > "$content_dir/posts/archived/index.md" <<'EOF'
---
title: Archived post
slug: archived-post
date: 2026-08-02T08:00:00+02:00
tags: [publication-state]
archived: true
draft: false
---

ARCHIVED_BODY_MARKER
EOF

cat > "$content_dir/posts/draft/index.md" <<'EOF'
---
title: Draft post
slug: draft-post
date: 2026-08-02T07:00:00+02:00
tags: [publication-state]
draft: true
---

DRAFT_BODY_MARKER
EOF

hugo \
    --source "$root_dir" \
    --contentDir "$content_dir" \
    --destination "$public_dir" \
    --quiet

normal_page="$public_dir/normal-post/index.html"
feed_only_page="$public_dir/feed-only-post/index.html"
archived_page="$public_dir/archived-post/index.html"
posts_page="$public_dir/posts/index.html"
tag_page="$public_dir/tags/publication-state/index.html"
sitemap="$public_dir/sitemap.xml"
posts_feed="$public_dir/rss.xml"
everything_feed="$public_dir/index.xml"
section_feed="$public_dir/posts/index.xml"
tag_feed="$public_dir/tags/publication-state/index.xml"

grep -Fq 'NORMAL_BODY_MARKER' "$normal_page"
grep -Fq 'class="reply-by-email meta-link"' "$normal_page"
grep -Fq '<span>Reply by email</span>' "$normal_page"
grep -Fq 'subject=Re%3A%20Normal%20post' "$normal_page"
awk '
    /<div class="footnotes" role="doc-endnotes">/ { in_footnotes = 1 }
    in_footnotes && /<ol>/ { list = NR }
    in_footnotes && /<\/div>/ { footnotes_end = NR; in_footnotes = 0 }
    /class="post-reply__separator"/ { separator = NR }
    /class="reply-by-email meta-link"/ { reply = NR }
    END { exit !(list < footnotes_end && footnotes_end < separator && separator < reply) }
' "$normal_page"
if grep -Fq 'name="robots" content="noindex, nofollow"' "$normal_page"; then
    echo "Normal post unexpectedly has noindex metadata." >&2
    exit 1
fi

grep -Fq '<h1 class="intro__title">Feed-only post</h1>' "$feed_only_page"
grep -Fq 'August 2, 2026' "$feed_only_page"
grep -Fq 'This post was published through RSS and standard.site.' "$feed_only_page"
grep -Fq 'class="post-reply__separator"' "$feed_only_page"
grep -Fq 'class="reply-by-email meta-link"' "$feed_only_page"
grep -Fq 'subject=Re%3A%20Feed-only%20post' "$feed_only_page"
grep -Fq 'name="robots" content="noindex, nofollow"' "$feed_only_page"
grep -Fq 'rel="site.standard.document" href="at://did:plc:test/site.standard.document/feed-only"' "$feed_only_page"
if grep -Fq 'FEED_ONLY_BODY_MARKER' "$feed_only_page" || \
    grep -Fq 'FEED_ONLY_DESCRIPTION_MARKER' "$feed_only_page" || \
    grep -Fq 'FEED_ONLY_COVER_MARKER' "$feed_only_page" || \
    grep -Fq 'FEED_ONLY_MEDIA_MARKER' "$feed_only_page"; then
    echo "Feed-only landing page leaked article content or metadata." >&2
    exit 1
fi

grep -Fq 'ARCHIVED_BODY_MARKER' "$archived_page"
grep -Fq 'name="robots" content="noindex, nofollow"' "$archived_page"

test ! -e "$public_dir/draft-post/index.html"

grep -Fq '/normal-post/' "$posts_page"
grep -Fq '/normal-post/' "$tag_page"
for hidden_slug in feed-only-post archived-post draft-post
do
    if grep -Fq "/$hidden_slug/" "$posts_page" || grep -Fq "/$hidden_slug/" "$tag_page"; then
        echo "$hidden_slug unexpectedly appears in a site listing." >&2
        exit 1
    fi
done

grep -Fq '/normal-post/' "$sitemap"
for hidden_slug in feed-only-post archived-post draft-post
do
    if grep -Fq "/$hidden_slug/" "$sitemap"; then
        echo "$hidden_slug unexpectedly appears in the sitemap." >&2
        exit 1
    fi
done

for feed in "$posts_feed" "$everything_feed" "$section_feed" "$tag_feed"
do
    grep -Fq '/normal-post/' "$feed"
    grep -Fq '/feed-only-post/' "$feed"
    grep -Fq 'FEED_ONLY_BODY_MARKER' "$feed"
    grep -Fq 'Thanks for using RSS!' "$feed"
    grep -Fq 'View this post on my site' "$feed"
    grep -Fq 'reply via email' "$feed"
    grep -Fq 'subject=Re%3A%20Normal%20post' "$feed"
    grep -Fq 'subject=Re%3A%20Feed-only%20post' "$feed"
    if grep -Fq 'mailto:' "$feed"; then
        echo "The reply address is exposed in $feed." >&2
        exit 1
    fi
    if grep -Fq '/archived-post/' "$feed" || grep -Fq '/draft-post/' "$feed"; then
        echo "Archived or draft content unexpectedly appears in $feed." >&2
        exit 1
    fi
done

if grep -Fq 'mailto:' "$normal_page" || grep -Fq 'mailto:' "$feed_only_page"; then
    echo "The reply address is exposed in a post page." >&2
    exit 1
fi

feed_only_item=$(sed -n '/<title>Feed-only post<\/title>/,/<\/item>/p' "$posts_feed")
if printf '%s' "$feed_only_item" | grep -Fq 'View this post on my site'; then
    echo "The feed-only RSS note links to its site landing page." >&2
    exit 1
fi

invalid_content_dir="$test_dir/invalid-content"
mkdir -p "$invalid_content_dir/posts/invalid"
cat > "$invalid_content_dir/posts/invalid/index.md" <<'EOF'
---
title: Invalid post
slug: invalid-post
date: 2026-08-02T06:00:00+02:00
archived: true
feed_only: true
draft: false
---

INVALID_BODY_MARKER
EOF

if hugo \
    --source "$root_dir" \
    --contentDir "$invalid_content_dir" \
    --destination "$test_dir/invalid-public" 2> "$test_dir/invalid-error"
then
    echo "Hugo accepted a post marked archived and feed_only." >&2
    exit 1
fi
grep -Fq 'cannot set both archived and feed_only' "$test_dir/invalid-error"

echo "Post publication state tests passed."
