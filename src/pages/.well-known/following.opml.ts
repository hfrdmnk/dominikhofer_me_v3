import type { APIRoute } from "astro";
import { MORGENBLAU_FLAT_OPML_URL, loadBlogroll } from "../../lib/blogroll";

export const GET: APIRoute = async () =>
  new Response((await loadBlogroll(MORGENBLAU_FLAT_OPML_URL)).opml, {
    headers: { "Content-Type": "text/x-opml; charset=utf-8" },
  });
