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
} satisfies ExportedHandler<Env>;
