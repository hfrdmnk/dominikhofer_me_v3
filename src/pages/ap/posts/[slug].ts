import type { APIRoute } from "astro";
import { handleFederation } from "../../../federation";
import { getFederatedPost } from "../../../federation/posts";

export const prerender = false;

// A post as an ActivityPub Article. Browsers go to the post itself.
export const GET: APIRoute = async ({ request, params, redirect }) => {
  const post = await getFederatedPost(params.slug!);
  return handleFederation(request, () =>
    post ? redirect(post.url, 303) : new Response("Not found", { status: 404 }),
  );
};
