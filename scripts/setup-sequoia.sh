#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
config="$root_dir/sequoia.json"
example="$root_dir/sequoia.example.json"
temporary_config=$(mktemp)

cleanup() {
    rm -f "$temporary_config"
}

trap cleanup EXIT HUP INT TERM

cd "$root_dir"

if [ ! -f "$config" ]; then
    npx --yes sequoia-cli@0.5.7 login
    npx --yes sequoia-cli@0.5.7 init
fi

publication_uri=$(jq -er '.publicationUri | select(startswith("at://"))' "$config")

jq \
    --arg publication_uri "$publication_uri" \
    --slurpfile generated "$config" \
    '.publicationUri = $publication_uri
    | if ($generated[0].pdsUrl // "") != "" then .pdsUrl = $generated[0].pdsUrl else . end' \
    "$example" > "$temporary_config"

mv "$temporary_config" "$config"
mkdir -p "$root_dir/static/.well-known"
printf '%s\n' "$publication_uri" > "$root_dir/static/.well-known/site.standard.publication"

echo "Sequoia is configured for $publication_uri."
echo "Run ./scripts/publish-sequoia.sh --dry-run before the first publish."
