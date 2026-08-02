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

frontmatter_is_true() {
    awk -v field="$2" '
        NR == 1 && $0 == "---" {
            in_frontmatter = 1
            next
        }
        in_frontmatter && $0 == "---" {
            exit
        }
        in_frontmatter {
            line = tolower($0)
            pattern = "^[[:space:]]*" field ":[[:space:]]*true[[:space:]]*($|#)"
            if (line ~ pattern) {
                found = 1
                exit
            }
        }
        END {
            exit found ? 0 : 1
        }
    ' "$1"
}

frontmatter_value() {
    awk -v field="$2" '
        NR == 1 && $0 == "---" {
            in_frontmatter = 1
            next
        }
        in_frontmatter && $0 == "---" {
            exit
        }
        in_frontmatter {
            line = $0
            lower = tolower(line)
            pattern = "^[[:space:]]*" field ":[[:space:]]*"
            if (lower ~ pattern) {
                sub(/^[[:space:]]*[^:]+:[[:space:]]*/, "", line)
                sub(/[[:space:]]*#[[:space:]].*$/, "", line)
                gsub(/^["'\'']|["'\'']$/, "", line)
                print line
                exit
            }
        }
    ' "$1"
}

printf '%s\n' '_index.md' > "$ignore_file"

find "$content_dir" -type f \( -name '*.md' -o -name '*.mdx' -o -name '*.qmd' \) |
while IFS= read -r file; do
    archived=false
    draft=false
    feed_only=false

    if frontmatter_is_true "$file" archived; then archived=true; fi
    if frontmatter_is_true "$file" draft; then draft=true; fi
    if frontmatter_is_true "$file" feed_only; then feed_only=true; fi

    if [ "$archived" = true ] && [ "$feed_only" = true ]; then
        echo "$file cannot set both archived and feed_only." >&2
        exit 1
    fi

    if [ "$archived" = true ]; then
        at_uri=$(frontmatter_value "$file" aturi)
        if [ -n "$at_uri" ]; then
            echo "Previously published archived post must be deleted from Standard Site first:" >&2
            echo "  File: $file" >&2
            echo "  Record: $at_uri" >&2
            echo "Delete the record from the PDS, remove atUri from frontmatter, and retry." >&2
            exit 1
        fi
    fi

    if [ "$archived" = true ] || [ "$draft" = true ]; then
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
