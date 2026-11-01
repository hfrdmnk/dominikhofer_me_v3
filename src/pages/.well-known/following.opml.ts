import type { APIRoute } from "astro";
import { loadBlogroll } from "../../lib/blogroll";

export const GET: APIRoute = async () =>
  new Response((await loadBlogroll()).opml, { headers: { "Content-Type": "text/x-opml; charset=utf-8" } });
