import type { Context } from "@fedify/fedify";
import { Article, PUBLIC_COLLECTION } from "@fedify/vocab";
import { Temporal } from "temporal-polyfill";
import { BLOG_IDENTIFIER } from "./constants";
import type { FederatedPost } from "./posts";

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The post as an ActivityPub Article: title, description and a link to the full text. */
export function toArticle(ctx: Context<unknown>, post: FederatedPost): Article {
  const url = escapeHtml(post.url);
  const description = post.description ? `<p>${escapeHtml(post.description)}</p>` : "";
  return new Article({
    id: ctx.getObjectUri(Article, { slug: post.slug }),
    attribution: ctx.getActorUri(BLOG_IDENTIFIER),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(BLOG_IDENTIFIER),
    name: post.title,
    summary: post.description || null,
    content: `${description}<p><a href="${url}">${url}</a></p>`,
    url: new URL(post.url),
    published: Temporal.Instant.from(post.published),
  });
}
