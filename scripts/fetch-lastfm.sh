#!/bin/sh
set -eu

output=${1:-data/lastfm.json}
api_key_file=${LASTFM_API_KEY_FILE:-/run/secrets/LASTFM_API_KEY}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
response_file=$(mktemp)
track_file=$(mktemp)

cleanup() {
    rm -f "$response_file" "$track_file"
}

trap cleanup EXIT HUP INT TERM

mkdir -p "$(dirname -- "$output")"
printf '{}\n' > "$output"

if [ -n "${LASTFM_API_KEY:-}" ]; then
    api_key=$LASTFM_API_KEY
    unset LASTFM_API_KEY
elif [ -r "$api_key_file" ]; then
    api_key=$(cat "$api_key_file")
else
    echo "Last.fm data unavailable: API key is not configured." >&2
    exit 0
fi

if [ -z "$api_key" ]; then
    echo "Last.fm data unavailable: API key is empty." >&2
    exit 0
fi

if curl \
    --silent \
    --show-error \
    --fail \
    --get \
    --header "User-Agent: dominikhofer.me/3.0 (+https://dominikhofer.me/)" \
    --data-urlencode "method=user.getrecenttracks" \
    --data-urlencode "user=dmnkhfr" \
    --data-urlencode "limit=2" \
    --data-urlencode "api_key=$api_key" \
    --data-urlencode "format=json" \
    --output "$response_file" \
    "https://ws.audioscrobbler.com/2.0/" \
    && jq -e -f "$script_dir/lastfm-transform.jq" "$response_file" > "$track_file"
then
    mv "$track_file" "$output"
else
    echo "Last.fm data unavailable: keeping the music item hidden." >&2
fi
