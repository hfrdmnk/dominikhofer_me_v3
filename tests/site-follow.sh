#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d)

cleanup() {
    rm -rf "$test_dir"
}

trap cleanup EXIT HUP INT TERM

hugo \
    --source "$root_dir" \
    --destination "$test_dir/public" \
    --quiet

assert_card_count() {
    page=$1
    expected=$2
    actual=$(grep -c 'class="follow-card breakout"' "$page" || true)

    if [ "$actual" -ne "$expected" ]; then
        echo "$page: expected $expected follow card(s), got $actual" >&2
        exit 1
    fi
}

for page in \
    "$test_dir/public/index.html" \
    "$test_dir/public/about/index.html" \
    "$test_dir/public/now/index.html" \
    "$test_dir/public/posts/index.html" \
    "$test_dir/public/hello/index.html"
do
    assert_card_count "$page" 1
done

assert_card_count "$test_dir/public/a-new-commitment/index.html" 0
assert_card_count "$test_dir/public/altstadt-gp-bern-2026/index.html" 0

homepage="$test_dir/public/index.html"

grep -Fq 'action="https://buttondown.com/api/emails/embed-subscribe/dominikhofer"' "$homepage"
grep -Fq 'method="post"' "$homepage"
grep -Fq 'type="email"' "$homepage"
grep -Fq 'name="email"' "$homepage"
grep -Fq 'autocomplete="email"' "$homepage"
grep -Fq 'required' "$homepage"
grep -Fq 'name="embed" value="1"' "$homepage"
grep -Fq 'href="/rss.xml"' "$homepage"
grep -Fq 'rel="alternate" type="application/rss+xml" href="/rss.xml"' "$homepage"

feed="$test_dir/public/rss.xml"
test -f "$feed"
grep -Fq '<?xml-stylesheet href="/styles/rss.xsl" type="text/xsl"?>' "$feed"
grep -Fq '<link>https://dominikhofer.me/a-new-commitment/</link>' "$feed"

if grep -Fq '<link>https://dominikhofer.me/about/</link>' "$feed"; then
    echo "The posts feed contains the About page." >&2
    exit 1
fi

if grep -Fq '<link>https://dominikhofer.me/altstadt-gp-bern-2026/</link>' "$feed"; then
    echo "The posts feed contains a race." >&2
    exit 1
fi

test -f "$test_dir/public/styles/rss.xsl"

if [ -f "$root_dir/sequoia.json" ]; then
    test -f "$test_dir/public/.well-known/site.standard.publication"
fi

echo "Follow card and publishing output tests passed."
