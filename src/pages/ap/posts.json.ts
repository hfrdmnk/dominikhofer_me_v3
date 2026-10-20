import type { APIRoute } from "astro";
import { getPosts } from "../../lib/content";
import type { FederatedPost } from "../../federation/posts";
import { SITE } from "../../site";

/** Posts the fediverse actor publishes, read by the Worker at runtime. */
export const GET: APIRoute = async () => {
  const posts: FederatedPost[] = (await getPosts())
    .filter((post) => !post.entry.data.archived && !post.entry.data.feed_only && !post.entry.data.external_url)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.entry.data.description ?? "",
      url: new URL(post.url, SITE.url).href,
      published: post.date.toISOString(),
      favorite: post.entry.data.favorite,
      atUri: post.entry.data.atUri,
    }));
  return Response.json(posts);
};
