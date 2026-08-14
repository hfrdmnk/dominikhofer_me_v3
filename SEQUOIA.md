# Sequoia publishing

Production builds call `scripts/publish-sequoia.sh` from `scripts/build.sh` when `SEQUOIA_PUBLISH=1`. Local builds leave it unset.

`sequoia.json` owns the publication, Standard Site, and Bluesky configuration. The publish wrapper owns frontmatter-based eligibility and refreshes Sequoia state from the PDS on fresh build machines.

Dokploy must provide `ATP_IDENTIFIER`, `ATP_APP_PASSWORD`, and `SEQUOIA_PUBLISH=1`. Its build command must invoke `./scripts/build.sh`; the build image must provide Hugo, Node.js with `npx`, Git, and `jq`.

Bluesky publishing uses a seven-day maximum age. The initial archive backfill therefore creates Standard Site documents without flooding Bluesky. Later builds publish newly discovered, recent posts to both services.

The Hugo templates own website, RSS, sitemap, and robots behavior. Posts marked `archived: true` or `draft: true` are excluded from Standard Site. The wrapper stops if an archived post still carries the `atUri` of a previously published Standard Site document.
