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
    "$test_dir/bin" \
    "$test_dir/runtime"

cp "$root_dir/sequoia.example.json" "$test_dir/sequoia.json"

for state in active archived draft
do
    {
        printf '%s\n' '---'
        printf 'title: "%s"\n' "$state"
        printf '%s\n' 'date: 2026-07-27'
        printf 'slug: "%s"\n' "$state"
        if [ "$state" = active ]; then
            printf '%s\n' 'cover: "cover.jpg"'
        fi
        if [ "$state" != active ]; then
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
' >/dev/null

cat > "$test_dir/bin/npx" <<'EOF'
#!/bin/sh
set -eu

case "$*" in
    *" publish"*)
        staged_content=$(jq -r '.contentDir' sequoia.json)
        grep -Fq "cover: \"$EXPECTED_COVER\"" "$staged_content/active/index.md"
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

echo "Sequoia archive and draft filters passed."
