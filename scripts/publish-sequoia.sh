#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_config=${SEQUOIA_SOURCE_CONFIG:-"$root_dir/sequoia.json"}
content_dir=${SEQUOIA_CONTENT_DIR:-"$root_dir/content/posts"}
runtime_dir=${SEQUOIA_RUNTIME_DIR:-"$root_dir/.sequoia-runtime"}
runtime_config="$runtime_dir/sequoia.json"
ignore_file=$(mktemp)
eligible_file=$(mktemp)
stage_dir=""
content_link="$runtime_dir/content"

cleanup() {
    rm -f "$ignore_file" "$eligible_file" "$runtime_config"
    if [ -n "$stage_dir" ]; then
        rm -f "$content_link"
        rm -rf "$stage_dir"
    fi
}

trap cleanup EXIT HUP INT TERM

if [ ! -f "$source_config" ]; then
    echo "Missing $source_config. Run ./scripts/setup-sequoia.sh first." >&2
    exit 1
fi

is_excluded() {
    awk '
        NR == 1 && $0 == "---" {
            in_frontmatter = 1
            next
        }
        in_frontmatter && $0 == "---" {
            exit
        }
        in_frontmatter {
            line = tolower($0)
            if (line ~ /^[[:space:]]*(archived|draft):[[:space:]]*true[[:space:]]*($|#)/) {
                excluded = 1
                exit
            }
        }
        END {
            exit excluded ? 0 : 1
        }
    ' "$1"
}

printf '%s\n' '_index.md' > "$ignore_file"

find "$content_dir" -type f \( -name '*.md' -o -name '*.mdx' -o -name '*.qmd' \) |
while IFS= read -r file; do
    if is_excluded "$file"; then
        printf '%s\n' "${file#"$content_dir"/}"
    else
        printf '%s\n' "$file" >> "$eligible_file"
    fi
done >> "$ignore_file"

ignore_json=$(jq -Rsc 'split("\n") | map(select(length > 0))' "$ignore_file")

mkdir -p "$runtime_dir"
if [ -e "$content_link" ] || [ -L "$content_link" ]; then
    echo "Unexpected existing Sequoia staging path: $content_link" >&2
    exit 1
fi

stage_dir=$(mktemp -d "$runtime_dir/stage.XXXXXX")
ln -s "$stage_dir" "$content_link"

while IFS= read -r file; do
    relative_path=${file#"$content_dir"/}
    destination="$stage_dir/$relative_path"
    source_directory=$(dirname "$file")
    destination_directory=$(dirname "$destination")

    mkdir -p "$destination_directory"

    if [ "$(basename "$file")" = "index.md" ]; then
        cp -R "$source_directory/." "$destination_directory/"
    else
        cp "$file" "$destination"
    fi

    cover=$(
        awk '
            NR == 1 && $0 == "---" {
                in_frontmatter = 1
                next
            }
            in_frontmatter && $0 == "---" {
                exit
            }
            in_frontmatter && /^[[:space:]]*cover:[[:space:]]*/ {
                sub(/^[[:space:]]*cover:[[:space:]]*/, "")
                gsub(/^["'\'']|["'\'']$/, "")
                print
                exit
            }
        ' "$file"
    )

    case "$cover" in
        ""|http://*|https://*) continue ;;
    esac

    cover_path="$source_directory/$cover"
    if [ -f "$cover_path" ]; then
        rewritten=$(mktemp)
        awk -v cover_path="$cover_path" '
            NR == 1 && $0 == "---" {
                in_frontmatter = 1
            }
            in_frontmatter && NR > 1 && $0 == "---" {
                in_frontmatter = 0
            }
            in_frontmatter && /^[[:space:]]*cover:[[:space:]]*/ {
                print "cover: \"" cover_path "\""
                next
            }
            {
                print
            }
        ' "$destination" > "$rewritten"
        mv "$rewritten" "$destination"
    fi
done < "$eligible_file"

jq \
    --arg content_dir "$content_link" \
    --arg public_dir "$root_dir/static" \
    --arg output_dir "$root_dir/public" \
    --argjson ignore "$ignore_json" \
    '.contentDir = $content_dir
    | .publicDir = $public_dir
    | .outputDir = $output_dir
    | .ignore = $ignore
    | .frontmatter.draft = "draft"
    | .bluesky.enabled = false' \
    "$source_config" > "$runtime_config"

if [ "${1:-}" = "--print-config" ]; then
    cat "$runtime_config"
    exit
fi

cd "$runtime_dir"
npx --yes sequoia-cli@0.5.7 publish "$@"

for argument in "$@"; do
    if [ "$argument" = "--dry-run" ] || [ "$argument" = "-n" ]; then
        exit
    fi
done

jq --arg content_dir "$content_dir" '.contentDir = $content_dir' \
    "$runtime_config" > "$ignore_file"
mv "$ignore_file" "$runtime_config"
npx --yes sequoia-cli@0.5.7 sync --update-frontmatter
