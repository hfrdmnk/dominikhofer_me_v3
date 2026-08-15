# Publishing and deployment

`.github/workflows/deploy.yml` owns production publishing and deployment. It runs for pushes to `main`, manual dispatches, and once every two hours. The workflow publishes with Sequoia, builds with Hugo, pushes the finished static nginx image to GHCR, and then calls the Dokploy Application deployment webhook.

The workflow serializes every production run. Sequoia state is restored from the latest GitHub Actions cache and saved immediately after publication. On the first run or after cache loss, Sequoia's `autoSync` rebuilds state from the Standard Site records in the PDS before scanning. Existing documents are therefore recognized instead of being published again. `sequoia.json` keeps Bluesky limited to new posts from the last seven days.

Configure these repository Actions secrets:

```text
ATP_APP_PASSWORD
HUGO_LASTFM_API_KEY
DOKPLOY_WEBHOOK_URL
```

`DOKPLOY_WEBHOOK_URL` is the complete tokenized Application deployment URL exposed through Tailscale Funnel. Configure Funnel for only that path instead of exposing the Dokploy root. Keep the URL in GitHub Secrets because possession of it authorizes a deployment. No credential is passed to the Docker build, and `.dockerignore` limits the image context to the generated `public/` directory and nginx configuration.

The first workflow run creates `ghcr.io/hfrdmnk/dominikhofer_me_v3`. New GHCR packages are private, so that bootstrap run stops after pushing the image and before calling Dokploy. Make the package public in its GitHub package settings, then rerun the workflow. Later runs verify anonymous pull access before every Dokploy call. The image contains only nginx and the generated site.

In Dokploy, configure an Application with the Docker provider:

1. Set the image to `ghcr.io/hfrdmnk/dominikhofer_me_v3:latest` and the registry URL to `ghcr.io`. Leave username and password empty after making the package public.
2. Keep Auto Deploy enabled for the Application webhook, but do not install a GitHub repository webhook or a Dokploy schedule. GitHub Actions is the only caller of the deployment webhook.
3. Remove the former Hugo, Sequoia, Last.fm, and ATProto environment variables from the Application.
4. Route `dominikhofer.me` to the Application on port 80.

The Docker provider pulls and starts the finished GHCR image. Dokploy does not use the repository, `Dockerfile`, or any build type.

`scripts/publish-sequoia.sh` owns frontmatter eligibility and state injection. Posts marked `archived: true` or `draft: true` are excluded from Standard Site. The wrapper stops if an archived post still carries the `atUri` of a previously published Standard Site document.
