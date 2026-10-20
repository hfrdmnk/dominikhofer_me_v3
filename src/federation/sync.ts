import type { Context } from "@fedify/fedify";
import { Create, Delete, PUBLIC_COLLECTION, Tombstone, Update } from "@fedify/vocab";
import { getLogger } from "@logtape/logtape";
import { toArticle } from "./article";
import { BLOG_IDENTIFIER } from "./constants";
import type { ContextData } from "./index";
import { getFederatedPosts, type FederatedPost } from "./posts";

const logger = getLogger(["dominikhofer", "federation"]);

/** Posts older than this are recorded without notifying followers, like Sequoia's `maxAgeDays`. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function hashPost(post: FederatedPost): Promise<string> {
  const data = new TextEncoder().encode(`${post.title}\n${post.description}\n${post.url}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface SyncResult {
  created: string[];
  updated: string[];
  deleted: string[];
  recorded: string[];
}

/**
 * Sends Create, Update and Delete activities to followers for posts that are new,
 * changed or gone since the last deploy. The first sync only records the existing posts.
 */
export async function syncPosts(ctx: Context<ContextData>): Promise<SyncResult> {
  const { store } = ctx.data;
  const posts = await getFederatedPosts();
  const stored = new Map((await store.getPosts()).map((post) => [post.slug, post]));
  const firstSync = stored.size === 0;
  const actor = ctx.getActorUri(BLOG_IDENTIFIER);
  const result: SyncResult = { created: [], updated: [], deleted: [], recorded: [] };
  const send = (activity: Create | Update | Delete) =>
    ctx.sendActivity({ identifier: BLOG_IDENTIFIER }, "followers", activity, { preferSharedInbox: true });

  for (const post of posts) {
    const article = toArticle(ctx, post);
    const contentHash = await hashPost(post);
    const previous = stored.get(post.slug);
    stored.delete(post.slug);
    if (previous?.contentHash === contentHash) continue;

    const activityId = new URL(`#${previous ? "update" : "create"}/${crypto.randomUUID()}`, article.id!);
    if (previous) {
      await send(new Update({ id: activityId, actor, to: PUBLIC_COLLECTION, cc: ctx.getFollowersUri(BLOG_IDENTIFIER), object: article }));
      result.updated.push(post.slug);
    } else if (!firstSync && Date.now() - Date.parse(post.published) < MAX_AGE_MS) {
      await send(new Create({ id: activityId, actor, to: PUBLIC_COLLECTION, cc: ctx.getFollowersUri(BLOG_IDENTIFIER), object: article }));
      result.created.push(post.slug);
    } else {
      result.recorded.push(post.slug);
    }
    await store.savePost({ slug: post.slug, objectId: article.id!.href, contentHash, publishedAt: post.published });
  }

  for (const post of stored.values()) {
    const objectId = new URL(post.objectId);
    await send(
      new Delete({
        id: new URL(`#delete/${crypto.randomUUID()}`, objectId),
        actor,
        to: PUBLIC_COLLECTION,
        cc: ctx.getFollowersUri(BLOG_IDENTIFIER),
        object: new Tombstone({ id: objectId }),
      }),
    );
    await store.deletePost(post.slug);
    result.deleted.push(post.slug);
  }

  logger.info("Synced posts: {created} created, {updated} updated, {deleted} deleted, {recorded} recorded", {
    created: result.created.length,
    updated: result.updated.length,
    deleted: result.deleted.length,
    recorded: result.recorded.length,
  });
  return result;
}
