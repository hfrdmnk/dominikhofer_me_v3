#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

mkdir -p \
    "$test_dir/content/active" \
    "$test_dir/content/archived" \
    "$test_dir/content/draft" \
    "$test_dir/content/feed-only" \
    "$test_dir/bin" \
    "$test_dir/runtime"

cp "$root_dir/sequoia.example.json" "$test_dir/sequoia.json"

for state in active archived draft feed-only
do
    {
        printf '%s\n' '---'
        printf 'title: "%s"\n' "$state"
        printf '%s\n' 'date: 2026-07-27'
        printf 'slug: "%s"\n' "$state"
        if [ "$state" = active ]; then
            printf '%s\n' 'cover: "cover.jpg"'
        fi
        if [ "$state" = feed-only ]; then
            printf '%s\n' 'feed_only: true'
        elif [ "$state" != active ]; then
            printf '%s\n' "$state: true"
        fi
        printf '%s\n' '---' "$state"
    } > "$test_dir/content/$state/index.md"
done
printf '%s\n' 'image' > "$test_dir/content/active/cover.jpg"

config=$(
    SEQUOIA_SOURCE_CONFIG="$test_dir/sequoia.json" \
    SEQUOIA_CONTENT_DIR="$test_dir/content" \
    SEQUOIA_RUNTIME_DIR="$test_dir/runtime" \
    "$root_dir/scripts/publish-sequoia.sh" --print-config
)

printf '%s' "$config" | jq -e '
    .frontmatter.draft == "draft"
    and .bluesky.enabled == false
    and (.ignore | index("archived/index.md"))
    and (.ignore | index("draft/index.md"))
    and ((.ignore | index("active/index.md")) == null)
    and ((.ignore | index("feed-only/index.md")) == null)
' >/dev/null

cat > "$test_dir/bin/npx" <<'EOF'
#!/bin/sh
set -eu

case "$*" in
    *" publish"*)
        staged_content=$(jq -r '.contentDir' sequoia.json)
        grep -Fq "cover: \"$EXPECTED_COVER\"" "$staged_content/active/index.md"
        grep -Fq 'feed_only: true' "$staged_content/feed-only/index.md"
        printf '%s\n' publish >> "$SEQUOIA_CALLS"
        ;;
    *" sync --update-frontmatter"*)
        test "$(jq -r '.contentDir' sequoia.json)" = "$EXPECTED_CONTENT"
        printf '%s\n' sync >> "$SEQUOIA_CALLS"
        ;;
    *)
        echo "Unexpected npx invocation: $*" >&2
        exit 1
        ;;
esac
EOF
chmod +x "$test_dir/bin/npx"

PATH="$test_dir/bin:$PATH" \
EXPECTED_COVER="$test_dir/content/active/cover.jpg" \
EXPECTED_CONTENT="$test_dir/content" \
SEQUOIA_CALLS="$test_dir/calls" \
SEQUOIA_SOURCE_CONFIG="$test_dir/sequoia.json" \
SEQUOIA_CONTENT_DIR="$test_dir/content" \
SEQUOIA_RUNTIME_DIR="$test_dir/runtime" \
    "$root_dir/scripts/publish-sequoia.sh"

test "$(sed -n '1p' "$test_dir/calls")" = publish
test "$(sed -n '2p' "$test_dir/calls")" = sync
test ! -e "$test_dir/runtime/content"

mkdir -p "$test_dir/blocked-content/archived" "$test_dir/blocked-runtime"
cat > "$test_dir/blocked-content/archived/index.md" <<'EOF'
---
title: "Previously published archive"
date: 2026-07-27
slug: "previously-published-archive"
archived: true
atUri: "at://did:plc:test/site.standard.document/archived"
---
EOF

if SEQUOIA_SOURCE_CONFIG="$test_dir/sequoia.json" \
    SEQUOIA_CONTENT_DIR="$test_dir/blocked-content" \
    SEQUOIA_RUNTIME_DIR="$test_dir/blocked-runtime" \
    "$root_dir/scripts/publish-sequoia.sh" --print-config \
    > /dev/null 2> "$test_dir/blocked-error"
then
    echo "Sequoia accepted an archived post with an atUri." >&2
    exit 1
fi
grep -Fq 'Previously published archived post must be deleted from Standard Site first' "$test_dir/blocked-error"
grep -Fq 'at://did:plc:test/site.standard.document/archived' "$test_dir/blocked-error"
grep -Fq 'blocked-content/archived/index.md' "$test_dir/blocked-error"

mkdir -p "$test_dir/invalid-content/invalid" "$test_dir/invalid-runtime"
cat > "$test_dir/invalid-content/invalid/index.md" <<'EOF'
---
title: "Invalid state"
date: 2026-07-27
slug: "invalid-state"
archived: true
feed_only: true
---
EOF

if SEQUOIA_SOURCE_CONFIG="$test_dir/sequoia.json" \
    SEQUOIA_CONTENT_DIR="$test_dir/invalid-content" \
    SEQUOIA_RUNTIME_DIR="$test_dir/invalid-runtime" \
    "$root_dir/scripts/publish-sequoia.sh" --print-config \
    > /dev/null 2> "$test_dir/invalid-error"
then
    echo "Sequoia accepted a post marked archived and feed_only." >&2
    exit 1
fi
grep -Fq 'cannot set both archived and feed_only' "$test_dir/invalid-error"

echo "Sequoia publication state filters passed."
