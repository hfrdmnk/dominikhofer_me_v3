# Sequoia publishing

Sequoia publishing runs locally before deployment. Docker builds do not publish to Standard Site.

Run the one-time setup:

```sh
./scripts/setup-sequoia.sh
```

The setup uses Sequoia CLI 0.5.7, authenticates `dominik.social`, creates the publication, and writes `sequoia.json` plus `static/.well-known/site.standard.publication`. Choose a discoverable publication when prompted. Review and commit both files.

Preview the initial migration:

```sh
./scripts/publish-sequoia.sh --dry-run
```

Then publish:

```sh
./scripts/publish-sequoia.sh
```

The publish wrapper is the pre-deploy entry point. It generates Sequoia's ignore list from post frontmatter on every run. Commit the generated `atUri` frontmatter changes before the normal deployment.

Post publication states:

| Front matter | Website | RSS | Standard Site | Search indexing |
| --- | --- | --- | --- | --- |
| Default | Full post and listings | Included | Included | Included |
| `feed_only: true` | Title, date, and distribution notice | Included | Included | Excluded |
| `archived: true` | Full post at its direct URL | Excluded | Excluded | Excluded |
| `draft: true` | Excluded | Excluded | Excluded | Excluded |

`archived` and `feed_only` are mutually exclusive. A draft may carry either flag while it is being written. The Hugo templates own website, RSS, sitemap, and robots behavior. `scripts/publish-sequoia.sh` owns Standard Site eligibility and keeps Bluesky publishing disabled.

Sequoia 0.5.7 cannot delete a document that it published earlier. Before changing a published post to `archived: true`:

1. Delete the record named by the post's `atUri` from the PDS.
2. Remove `atUri` from the post front matter.
3. Run the publish wrapper again.

The wrapper stops before publishing if an archived post still has an `atUri` and prints both the file path and record URI.
