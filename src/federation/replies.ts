import { getLogger } from "@logtape/logtape";
import type { Reply } from "../lib/bluesky";
import { getContextData } from "./index";

const logger = getLogger(["dominikhofer", "federation"]);

/** Replies to a post from fediverse accounts, oldest first. */
export async function getFediverseReplies(slug: string): Promise<Reply[]> {
  try {
    const comments = await getContextData().store.getComments(slug);
    return comments.map((comment) => ({
      id: comment.id,
      source: "fediverse",
      authorName: comment.authorName,
      authorHandle: comment.authorHandle,
      authorUrl: comment.authorUrl,
      html: comment.content,
      url: comment.url ?? comment.id,
      published: new Date(comment.publishedAt),
      replies: [],
    }));
  } catch (error) {
    logger.warn("Loading replies to {slug} failed: {error}", { slug, error });
    return [];
  }
}
