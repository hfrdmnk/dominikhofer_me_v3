# Publishing and deployment

`.github/workflows/deploy.yml` owns production publishing and deployment. It runs for pushes to `main`, manual dispatches, and once every two hours. The workflow runs the tests, publishes with Sequoia, builds the site with Astro, deploys it to Cloudflare Workers, applies database migrations, and announces new posts to fediverse followers.

The workflow serializes every production run. Sequoia state is restored from the latest GitHub Actions cache and saved immediately after publication. On the first run or after cache loss, Sequoia's `autoSync` rebuilds state from the Standard Site records in the PDS before scanning. Existing documents are therefore recognized instead of being published again. `sequoia.json` keeps Bluesky limited to new posts from the last seven days.

`scripts/publish-sequoia.sh` owns frontmatter eligibility and state injection. Posts marked `archived: true` or `draft: true` are excluded from Standard Site. The wrapper stops if an archived post still carries the `atUri` of a previously published Standard Site document. It writes each post's `atUri` into the checkout before the build, so pages link their Standard Site document.

## What runs where

Every page is prebuilt into `dist/client` and served as a static asset. The Worker (`src/worker.ts`) only runs for:

- the Last.fm track in the top bar and navigation, a server island cached for 60 seconds,
- replies below posts, a server island that merges fediverse replies from D1 with live Bluesky replies,
- the fediverse endpoints: `/.well-known/webfinger`, `/users/blog`, `/inbox`, `/ap/posts/{slug}` and `/ap/sync`.

Bookhive, Semble, the newsletter archive and the race art are fetched at build time. The two-hourly rebuild keeps them current.

## Fediverse

The blog is the fediverse account `@blog@dominikhofer.me`. Following it delivers each new post as an Article with title, description and link. Replies to those posts appear below the post right away, sanitized to text formatting and links. Archived, feed-only and external posts are not published.

After each deploy, the workflow calls `POST /ap/sync`. It compares `/ap/posts.json` with the posts already announced and sends `Create`, `Update` or `Delete` to followers. The first sync records the existing posts without sending anything, and so do later syncs for posts older than seven days.

Fedify keeps its state in Cloudflare: D1 (`DB`) for followers, keys, announced posts and replies, KV (`FEDIFY_KV`) for its cache, and a queue (`FEDIFY_QUEUE`) for outgoing deliveries, which the Worker's `queue()` handler sends.

## Bluesky replies

Replies come from the first Bluesky post of `@dominikhofer.me` that linked the article: the post Sequoia recorded as `bskyPostRef` on the Standard Site document, or else the oldest post that a Bluesky search finds for the URL. Hidden replies and accounts that opt out of logged-out visibility are left out.

## Setup

1. Create a Cloudflare API token with the *Edit Cloudflare Workers* template, plus *D1: Edit* and *Queues: Edit*.
2. Add these repository Actions secrets:

   ```text
   ATP_APP_PASSWORD
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ACCOUNT_ID
   FEDIFY_SYNC_TOKEN      # any long random string, e.g. `openssl rand -hex 32`
   ```

3. Add the Worker's secrets once:

   ```sh
   pnpm exec wrangler secret put LASTFM_API_KEY
   pnpm exec wrangler secret put FEDIFY_SYNC_TOKEN   # the same value as the GitHub secret
   ```

4. Run the workflow. The first deploy creates the D1 database, the KV namespace and the queue, and serves the site on `dominikhofer-me.<account>.workers.dev`. Attach `dominikhofer.me` as a custom domain in the Worker's settings (*Domains & Routes*); the domain must not have other DNS records for the same name. Publishing to Sequoia and the fediverse only runs on `main`.

Cloudflare's Bot Fight Mode and managed challenges can block fediverse servers, which cannot solve challenges. If they are on, add a WAF skip rule for requests whose `Accept` or `Content-Type` header contains `application/activity+json` or `application/ld+json`.

The Workers free plan allows 10 ms of CPU time per request. Signing deliveries and verifying incoming signatures can exceed that; if the Worker logs show CPU limit errors, the Workers Paid plan ($5/month) raises the limit.

## Local development

```sh
pnpm dev             # Astro dev server, with local D1, KV and queue
pnpm test            # Markdown and Last.fm tests
pnpm check           # type check
pnpm build && pnpm preview   # the built Worker in workerd
```

Put `LASTFM_API_KEY` and `FEDIFY_SYNC_TOKEN` in `.env` to use them locally. Apply the database schema locally with `pnpm exec wrangler d1 migrations apply DB --local`.

## Self-hosting

The site is not tied to Cloudflare beyond `src/lib/platform.ts`, which hands out the database, key–value store, queue and built files, and `src/worker.ts`. To run it on Node.js:

1. Replace `@astrojs/cloudflare` with `@astrojs/node` in `astro.config.mjs` (`adapter: node({ mode: "standalone" })`).
2. Reimplement `src/lib/platform.ts`: wrap `node:sqlite` in the small `Sql` interface from `src/federation/sql.ts`, use `@fedify/sqlite` for the key–value store and message queue, and read `/ap/posts.json` from `dist/client`.
3. Apply `migrations/*.sql` to the SQLite database and start the server with `node dist/server/entry.mjs`. Start Fedify's queue with `federation.startQueue()`.
4. Serve the redirects in `static/_redirects` and the headers in `static/_headers` from the reverse proxy.
