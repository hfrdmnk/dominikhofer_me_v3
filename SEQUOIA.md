# Sequoia publishing

The production container calls `scripts/build.sh` before nginx starts. That script calls `scripts/publish-sequoia.sh` when `SEQUOIA_PUBLISH=1`. Local builds leave it unset.

`sequoia.json` owns the publication, Standard Site, and Bluesky configuration. The publish wrapper owns frontmatter-based eligibility. Sequoia state lives in `SEQUOIA_RUNTIME_DIR`, which must persist across container replacements. With state present, Sequoia scans first and only logs in when something needs publishing. A missing state triggers one PDS sync before scanning.

`Dockerfile` pins Node.js and Hugo, and the npm lockfile pins Sequoia. `docker-compose.yml` owns the image build, runtime variables, internal port, and persistent volume. In Dokploy, create a Docker Compose service from the repository and set its Compose Path to `./docker-compose.yml`. Configure these variables in Dokploy's Environment tab:

```text
HUGO_LASTFM_API_KEY=...
ATP_IDENTIFIER=dominik.social
ATP_APP_PASSWORD=...
PDS_URL=https://eurosky.social
SEQUOIA_PUBLISH=1
GOMAXPROCS=1
HUGO_NUMWORKERMULTIPLIER=1
```

The Compose project automatically creates `site-data` at `/var/lib/site`. It preserves Sequoia's state and Hugo's generated-resource cache across container replacements. Generated site files stay inside each container. In Dokploy's Domains tab, route `dominikhofer.me` to the `website` service on port 80. A scheduled Dokploy redeployment starts a new container, runs the complete build with current Last.fm data, and then starts nginx.

Bluesky publishing uses a seven-day maximum age. The initial archive backfill therefore creates Standard Site documents without flooding Bluesky. Later builds publish newly discovered, recent posts to both services.

The Hugo templates own website, RSS, sitemap, and robots behavior. Posts marked `archived: true` or `draft: true` are excluded from Standard Site. The wrapper stops if an archived post still carries the `atUri` of a previously published Standard Site document.
