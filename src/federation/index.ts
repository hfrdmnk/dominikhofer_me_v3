import { AsyncLocalStorage } from "node:async_hooks";
import { createFederationBuilder, generateCryptoKeyPair, type Federation } from "@fedify/fedify";
import {
  Accept,
  Article,
  Create,
  Delete,
  Endpoints,
  Follow,
  Image,
  Note,
  Person,
  PUBLIC_COLLECTION,
  Undo,
  Update,
} from "@fedify/vocab";
import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";
import { getDatabase, getKvStore, getMessageQueue } from "../lib/platform";
import { SITE } from "../site";
import { toArticle } from "./article";
import { getFederatedPost, getFederatedPosts } from "./posts";
import { sanitizeComment } from "./sanitize";
import { BLOG_IDENTIFIER } from "./constants";
import { Store } from "./store";

export interface ContextData {
  store: Store;
}

export { BLOG_IDENTIFIER };
const logger = getLogger(["dominikhofer", "federation"]);

const builder = createFederationBuilder<ContextData>();

builder
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    if (identifier !== BLOG_IDENTIFIER) return null;
    const keyPairs = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: SITE.title,
      summary:
        `<p>Striving for Simplicity in a complex World.</p>` +
        `<p>Posts from my personal website.</p>` +
        `<p><a href="${SITE.url}/">dominikhofer.me</a></p>`,
      url: new URL("/", SITE.url),
      icon: new Image({ url: new URL("/apple-touch-icon.png", SITE.url), mediaType: "image/png" }),
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      followers: ctx.getFollowersUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      featured: ctx.getFeaturedUri(identifier),
      manuallyApprovesFollowers: false,
      discoverable: true,
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((keyPair) => keyPair.multikey),
    });
  })
  .mapHandle((_ctx, username) => (username === BLOG_IDENTIFIER ? BLOG_IDENTIFIER : null))
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    if (identifier !== BLOG_IDENTIFIER) return [];
    const stored = await ctx.data.store.getKeyPairs(identifier);
    if (stored) return stored;
    const keyPairs = await Promise.all([
      generateCryptoKeyPair("RSASSA-PKCS1-v1_5"),
      generateCryptoKeyPair("Ed25519"),
    ]);
    await ctx.data.store.saveKeyPairs(identifier, keyPairs);
    // Another request may have saved its keys first; those are the ones to use.
    return (await ctx.data.store.getKeyPairs(identifier)) ?? keyPairs;
  });

builder
  .setFollowersDispatcher("/users/{identifier}/followers", async (ctx, identifier) => {
    if (identifier !== BLOG_IDENTIFIER) return null;
    const followers = await ctx.data.store.getFollowers();
    return {
      items: followers.map((follower) => ({
        id: new URL(follower.actorId),
        inboxId: new URL(follower.inboxUrl),
        endpoints: follower.sharedInboxUrl ? { sharedInbox: new URL(follower.sharedInboxUrl) } : null,
      })),
    };
  })
  .setCounter(async (ctx, identifier) =>
    identifier === BLOG_IDENTIFIER ? ctx.data.store.countFollowers() : null,
  );

const OUTBOX_PAGE_SIZE = 20;

// Every published post as a Create, newest first. Followers only get new posts pushed
// (see sync.ts); this lets servers show the post count and fetch older posts.
builder
  .setOutboxDispatcher("/users/{identifier}/outbox", async (ctx, identifier, cursor) => {
    if (identifier !== BLOG_IDENTIFIER || cursor == null) return null;
    const offset = Number.parseInt(cursor, 10) || 0;
    const posts = await getFederatedPosts();
    const items = posts.slice(offset, offset + OUTBOX_PAGE_SIZE).map((post) => {
      const article = toArticle(ctx, post);
      return new Create({
        id: new URL("#create", article.id!),
        actor: ctx.getActorUri(BLOG_IDENTIFIER),
        to: PUBLIC_COLLECTION,
        cc: ctx.getFollowersUri(BLOG_IDENTIFIER),
        published: article.published,
        object: article,
      });
    });
    const next = offset + OUTBOX_PAGE_SIZE;
    return { items, nextCursor: next < posts.length ? String(next) : null };
  })
  .setFirstCursor((_ctx, identifier) => (identifier === BLOG_IDENTIFIER ? "0" : null))
  .setCounter(async (_ctx, identifier) =>
    identifier === BLOG_IDENTIFIER ? (await getFederatedPosts()).length : null,
  );

const PINNED_POSTS = 5;

// Pinned posts on the profile: the latest favorites. Mastodon fetches these when it
// looks up the account, so the profile is not empty before new posts arrive.
// Mastodon skips embedded objects other than Notes, so the items are the post URIs;
// Fedify writes URLs as is, although the type asks for objects.
builder.setFeaturedDispatcher("/users/{identifier}/featured", async (ctx, identifier) => {
  if (identifier !== BLOG_IDENTIFIER) return null;
  const favorites = (await getFederatedPosts()).filter((post) => post.favorite);
  const uris = favorites.slice(0, PINNED_POSTS).map((post) => ctx.getObjectUri(Article, { slug: post.slug }));
  return { items: uris as unknown as Article[] };
});

builder.setObjectDispatcher(Article, "/ap/posts/{slug}", async (ctx, { slug }) => {
  const post = await getFederatedPost(slug);
  return post ? toArticle(ctx, post) : null;
});

builder
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.objectId == null) return;
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor" || parsed.identifier !== BLOG_IDENTIFIER) return;
    const follower = await follow.getActor(ctx);
    if (follower?.id == null || follower.inboxId == null) return;
    await ctx.data.store.addFollower({
      actorId: follower.id.href,
      inboxUrl: follower.inboxId.href,
      sharedInboxUrl: follower.endpoints?.sharedInbox?.href ?? null,
    });
    logger.info("New follower: {follower}", { follower: follower.id.href });
    await ctx.sendActivity(
      { identifier: BLOG_IDENTIFIER },
      follower,
      new Accept({
        id: new URL(`#accepts/${encodeURIComponent(follow.id.href)}`, ctx.getActorUri(BLOG_IDENTIFIER)),
        actor: ctx.getActorUri(BLOG_IDENTIFIER),
        object: follow,
      }),
    );
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject(ctx);
    if (!(object instanceof Follow) || undo.actorId == null) return;
    if (object.objectId?.href !== ctx.getActorUri(BLOG_IDENTIFIER).href) return;
    await ctx.data.store.removeFollower(undo.actorId.href);
    logger.info("Unfollowed by {actor}", { actor: undo.actorId.href });
  })
  .on(Create, async (ctx, create) => {
    const note = await create.getObject(ctx);
    if (!(note instanceof Note) || note.id == null || note.replyTargetId == null) return;
    const parsed = ctx.parseUri(note.replyTargetId);
    if (parsed?.type !== "object" || parsed.class !== Article) return;
    const slug = parsed.values.slug;
    if (!(await getFederatedPost(slug))) return;
    const author = await create.getActor(ctx);
    if (author?.id == null || author.id.href !== create.actorId?.href) return;
    const icon = await author.getIcon(ctx);
    await ctx.data.store.saveComment({
      id: note.id.href,
      postSlug: slug,
      authorId: author.id.href,
      authorName: author.name?.toString() || author.preferredUsername?.toString() || author.id.host,
      authorUrl: (author.url instanceof URL ? author.url : author.id).href,
      authorHandle: author.preferredUsername ? `@${author.preferredUsername}@${author.id.host}` : null,
      authorAvatar: icon?.url instanceof URL ? icon.url.href : null,
      content: sanitizeComment(note.content?.toString() ?? ""),
      url: note.url instanceof URL ? note.url.href : note.id.href,
      publishedAt: note.published?.toString() ?? new Date().toISOString(),
    });
    logger.info("New reply to {slug} by {author}", { slug, author: author.id.href });
  })
  .on(Update, async (ctx, update) => {
    const note = await update.getObject(ctx);
    if (!(note instanceof Note) || note.id == null || update.actorId == null) return;
    const existing = await ctx.data.store.getComment(note.id.href);
    // Only the author can edit a reply.
    if (existing?.authorId !== update.actorId.href) return;
    const author = await update.getActor(ctx);
    const icon = await author?.getIcon(ctx);
    await ctx.data.store.saveComment({
      ...existing,
      authorName: author?.name?.toString() || author?.preferredUsername?.toString() || existing.authorName,
      authorAvatar: icon?.url instanceof URL ? icon.url.href : existing.authorAvatar,
      content: sanitizeComment(note.content?.toString() ?? ""),
    });
  })
  .on(Delete, async (ctx, deletion) => {
    const objectId = deletion.objectId;
    if (deletion.actorId == null || objectId == null) return;
    if (objectId.href === deletion.actorId.href) {
      // The account itself was deleted.
      await ctx.data.store.removeFollower(objectId.href);
      return;
    }
    const comment = await ctx.data.store.getComment(objectId.href);
    if (comment?.authorId === deletion.actorId.href) await ctx.data.store.deleteComment(objectId.href);
  });

let federation: Promise<Federation<ContextData>> | undefined;

export function getFederation(): Promise<Federation<ContextData>> {
  federation ??= builder.build({
    kv: getKvStore(),
    queue: getMessageQueue(),
    // Object IDs always use the canonical domain, also on preview URLs.
    origin: import.meta.env.PROD ? SITE.url : undefined,
  });
  return federation;
}

export const getContextData = (): ContextData => ({ store: new Store(getDatabase()) });

/**
 * Answers ActivityPub requests. Requests that want HTML or that Fedify does not
 * handle get `fallback`, for example a redirect to the matching page.
 */
export async function handleFederation(request: Request, fallback: () => Response): Promise<Response> {
  const federation = await getFederation();
  return federation.fetch(request, {
    contextData: getContextData(),
    onNotFound: fallback,
    onNotAcceptable: fallback,
  });
}

configureSync({
  sinks: { console: getConsoleSink() },
  contextLocalStorage: new AsyncLocalStorage(),
  loggers: [
    { category: "fedify", lowestLevel: "warning", sinks: ["console"] },
    // Workers KV cannot compare-and-swap, which Fedify warns about once per isolate.
    { category: ["fedify", "federation", "circuit"], lowestLevel: "error", sinks: ["console"], parentSinks: "override" },
    { category: "dominikhofer", lowestLevel: "info", sinks: ["console"] },
    { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
  ],
});
