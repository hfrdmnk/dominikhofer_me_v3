// Worker entry: Astro answers requests and Fedify delivers queued activities.
import { handle } from "@astrojs/cloudflare/handler";
import type { Message } from "@fedify/fedify";
import { getLogger } from "@logtape/logtape";
import { getContextData, getFederation } from "./federation";
import { getMessageQueue } from "./lib/platform";

const logger = getLogger(["dominikhofer", "federation"]);

// SocialSpec files are static and get their CORS headers from _headers. The Worker runs
// first for them (see wrangler.jsonc) to answer browser preflights.
const SOCIALSPEC_FILES = new Set(["/.well-known/about.md", "/.well-known/contact.vcf", "/.well-known/following.opml"]);
const PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const DEPLOY_WORKFLOW_DISPATCH =
  "https://api.github.com/repos/hfrdmnk/dominikhofer_me_v3/actions/workflows/deploy.yml/dispatches";

export default {
  fetch(request, env, context) {
    if (SOCIALSPEC_FILES.has(new URL(request.url).pathname)) {
      return request.method === "OPTIONS"
        ? new Response(null, { status: 204, headers: PREFLIGHT_HEADERS })
        : env.ASSETS.fetch(request);
    }
    return handle(request, env, context);
  },
  async queue(batch: MessageBatch<unknown>): Promise<void> {
    const federation = await getFederation();
    const queue = getMessageQueue();
    for (const message of batch.messages) {
      try {
        // The queue wraps each task; processMessage unwraps it.
        const task = await queue.processMessage(message.body);
        await federation.processQueuedTask(getContextData(), task.message as Message);
        message.ack();
      } catch (error) {
        logger.error("Queued task failed: {error}", { error });
        message.retry();
      }
    }
  },
  // Starts the deploy workflow on the cron in wrangler.jsonc, which rebuilds the site.
  // GitHub's own schedule trigger runs late or not at all under load.
  async scheduled(_controller, env) {
    const { GITHUB_DEPLOY_TOKEN } = env as Env & { GITHUB_DEPLOY_TOKEN?: string };
    if (!GITHUB_DEPLOY_TOKEN) throw new Error("GITHUB_DEPLOY_TOKEN is not set");
    const response = await fetch(DEPLOY_WORKFLOW_DISPATCH, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_DEPLOY_TOKEN}`,
        "User-Agent": "dominikhofer-me",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (!response.ok) {
      throw new Error(`Deploy dispatch failed: ${response.status} ${await response.text()}`);
    }
  },
} satisfies ExportedHandler<Env>;
