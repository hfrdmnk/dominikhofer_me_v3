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
grep -Fq 'name="tag" value="Personal Updates"' "$homepage"
grep -Fq 'class="button-primary follow-card__submit"' "$homepage"
grep -Fq 'data-state="idle"' "$homepage"
grep -Fq 'd="M5 13L9 17L19 7"' "$homepage"
grep -Fq 'd="M6.75827 17.2426L12.0009 12' "$homepage"

if grep -Fq 'data-button-state="loading"' "$homepage"; then
    echo "The follow card still renders a loading icon." >&2
    exit 1
fi

if grep -Fq 'follow-card__status' "$homepage"; then
    echo "The follow card still renders a separate submission status." >&2
    exit 1
fi

grep -Fq 'successDisplayTime = 5000' "$test_dir/public/js/site.js"
grep -Fq 'submit.dataset.state = "success"' "$test_dir/public/js/site.js"
grep -Fq 'submit.dataset.state = "danger"' "$test_dir/public/js/site.js"
grep -Fq 'submit.disabled = true' "$test_dir/public/js/site.js"

if grep -Fq 'minimumLoading' "$test_dir/public/js/site.js"; then
    echo "The follow card still applies an artificial loading delay." >&2
    exit 1
fi

css_file=$(find "$test_dir/public/css" -name 'main.*.css' | head -n 1)
grep -Fq '@media(prefers-reduced-motion:no-preference)' "$css_file"
grep -Fq 'background-color:oklch(79.2% .209 151.711)' "$css_file"
grep -Fq 'background-color:oklch(64.5% .246 16.439)' "$css_file"
grep -Fq '&:disabled[data-state=idle]{opacity:.6}' "$css_file"
grep -Fq 'inline-size:1.125rem' "$css_file"
grep -Fq 'class="follow-card__alternatives"' "$homepage"
grep -Fq 'class="button-underline follow-card__link"' "$homepage"
grep -Fq 'href="/rss.xml" target="_blank"' "$homepage"
grep -Fq 'rel="noopener noreferrer">RSS feed</a>' "$homepage"
grep -Fq 'rel="alternate" type="application/rss+xml" href="/rss.xml"' "$homepage"
grep -Fq 'href="/uses">/uses</a>' "$homepage"
test "$(grep -o 'href="/library"' "$homepage" | wc -l | tr -d ' ')" = 1
grep -Fq 'class="iconoir"' "$homepage"
grep -Fq 'd="M6 15L12 9L18 15"' "$homepage"
grep -Fq 'd="M15 6L9 12L15 18"' "$test_dir/public/about/index.html"

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
