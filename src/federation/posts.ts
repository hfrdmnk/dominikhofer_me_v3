import { getAsset } from "../lib/platform";

export interface FederatedPost {
  slug: string;
  title: string;
  description: string;
  /** The HTML page of the post. */
  url: string;
  published: string;
  /** The Standard Site document, when Sequoia published the post. */
  atUri?: string;
}

/** Reads the post list that the build wrote to /ap/posts.json. */
export async function getFederatedPosts(): Promise<FederatedPost[]> {
  const response = await getAsset("/ap/posts.json");
  if (!response.ok) throw new Error(`Cannot read /ap/posts.json: ${response.status}`);
  return response.json();
}

export async function getFederatedPost(slug: string): Promise<FederatedPost | undefined> {
  return (await getFederatedPosts()).find((post) => post.slug === slug);
}
