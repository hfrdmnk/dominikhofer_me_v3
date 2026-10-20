import { SITE } from "../site";
import { getRecord } from "./atproto";

export interface Reply {
  id: string;
  source: "fediverse" | "bluesky";
  authorName: string;
  authorHandle: string | null;
  authorUrl: string;
  /** Sanitized or self-built HTML. */
  html: string;
  url: string;
  published: Date;
  replies: Reply[];
}

const APPVIEW = "https://public.api.bsky.app/xrpc";
// The public AppView refuses anonymous searches, api.bsky.app allows them.
const SEARCH = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts";

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

// The post that announced an article never changes once found.
const postUris = new Map<string, string>();

/**
 * Finds the first Bluesky post of the site's account that linked the page: the one
 * Sequoia recorded on the Standard Site document, else the oldest search result.
 */
async function findPost(pageUrl: string, atUri?: string): Promise<string | undefined> {
  const cached = postUris.get(pageUrl);
  if (cached) return cached;
  let uri: string | undefined;
  if (atUri) {
    const [, collection, rkey] = atUri.replace(/^at:\/\//, "").split("/");
    const document = collection && rkey ? await getRecord(collection, rkey) : undefined;
    uri = document?.value?.bskyPostRef?.uri;
  }
  if (!uri) {
    const query = new URLSearchParams({ q: pageUrl, url: pageUrl, author: SITE.atproto.did, limit: "100" });
    const { posts = [] } = await getJson(`${SEARCH}?${query}`);
    uri = posts
      .toSorted((a: any, b: any) => Date.parse(a.record.createdAt) - Date.parse(b.record.createdAt))
      .at(0)?.uri;
  }
  if (uri) postUris.set(pageUrl, uri);
  return uri;
}

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const link = (href: string, text: string) =>
  `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer ugc" target="_blank">${text}</a>`;

/** Turns post text and its facets (links, mentions, hashtags) into HTML paragraphs. */
export function richText(text: string, facets: any[] = []): string {
  const bytes = new TextEncoder().encode(text);
  const decode = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  let html = "";
  let position = 0;
  const sorted = facets
    .filter((facet) => facet?.index?.byteStart >= 0 && facet.index.byteEnd <= bytes.length)
    .toSorted((a, b) => a.index.byteStart - b.index.byteStart);
  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < position) continue;
    html += escapeHtml(decode(position, byteStart));
    const label = escapeHtml(decode(byteStart, byteEnd));
    const feature = facet.features?.[0];
    if (feature?.$type === "app.bsky.richtext.facet#link" && /^https?:\/\//.test(feature.uri)) {
      html += link(feature.uri, label);
    } else if (feature?.$type === "app.bsky.richtext.facet#mention") {
      html += link(`https://bsky.app/profile/${feature.did}`, label);
    } else if (feature?.$type === "app.bsky.richtext.facet#tag") {
      html += link(`https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}`, label);
    } else {
      html += label;
    }
    position = byteEnd;
  }
  html += escapeHtml(decode(position, bytes.length));
  return html
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

const postUrl = (uri: string, handle: string) => `https://bsky.app/profile/${handle}/post/${uri.split("/").pop()}`;

function toReplies(thread: any, hidden: Set<string>): Reply[] {
  return (thread.replies ?? [])
    .filter(
      (reply: any) =>
        reply.$type === "app.bsky.feed.defs#threadViewPost" &&
        !hidden.has(reply.post.uri) &&
        // People can ask apps not to show their posts to logged-out visitors.
        !reply.post.author.labels?.some((label: any) => label.val === "!no-unauthenticated"),
    )
    .map((reply: any): Reply => {
      const { post } = reply;
      return {
        id: post.uri,
        source: "bluesky",
        authorName: post.author.displayName || post.author.handle,
        authorHandle: `@${post.author.handle}`,
        authorUrl: `https://bsky.app/profile/${post.author.handle}`,
        html: richText(post.record.text ?? "", post.record.facets),
        url: postUrl(post.uri, post.author.handle),
        published: new Date(post.record.createdAt ?? post.indexedAt),
        replies: toReplies(reply, hidden),
      };
    })
    .toSorted((a: Reply, b: Reply) => a.published.getTime() - b.published.getTime());
}

/** Replies to the Bluesky post that linked the page, and where to write one. */
export async function getBlueskyReplies(
  pageUrl: string,
  atUri?: string,
): Promise<{ postUrl?: string; replies: Reply[] }> {
  try {
    const uri = await findPost(pageUrl, atUri);
    if (!uri) return { replies: [] };
    const query = new URLSearchParams({ uri, depth: "6", parentHeight: "0" });
    const { thread } = await getJson(`${APPVIEW}/app.bsky.feed.getPostThread?${query}`);
    if (thread?.$type !== "app.bsky.feed.defs#threadViewPost") return { replies: [] };
    const hidden = new Set<string>(thread.threadgate?.record?.hiddenReplies ?? []);
    return { postUrl: postUrl(uri, thread.post.author.handle), replies: toReplies(thread, hidden) };
  } catch (error) {
    console.warn(`bluesky: loading replies for ${pageUrl} failed: ${error}`);
    return { replies: [] };
  }
}

