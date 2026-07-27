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

The publish wrapper is the pre-deploy entry point. It generates Sequoia's ignore list from post frontmatter on every run. Files with `archived: true` or `draft: true` are excluded. Commit the generated `atUri` frontmatter changes before the normal deployment.
