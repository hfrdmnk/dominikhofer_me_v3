import { createHash, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { FEDIFY_SYNC_TOKEN } from "astro:env/server";
import { getContextData, getFederation } from "../../federation";
import { syncPosts } from "../../federation/sync";

export const prerender = false;

const digest = (text: string) => createHash("sha256").update(text).digest();

/** Called by the deploy workflow after a deploy to announce new and changed posts. */
export const POST: APIRoute = async ({ request }) => {
  const given = request.headers.get("Authorization") ?? "";
  if (
    !FEDIFY_SYNC_TOKEN ||
    !timingSafeEqual(digest(given), digest(`Bearer ${FEDIFY_SYNC_TOKEN}`))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const federation = await getFederation();
  const result = await syncPosts(federation.createContext(request, getContextData()));
  return Response.json(result);
};
