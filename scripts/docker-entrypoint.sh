#!/bin/sh
set -eu

cd /app

mkdir -p /var/lib/site/hugo /var/lib/site/resources /var/lib/site/sequoia
mkdir -p /app/resources
rm -rf /app/resources/_gen
ln -s /var/lib/site/resources /app/resources/_gen

./scripts/build.sh --minify --cleanDestinationDir

exec nginx -g 'daemon off;'
