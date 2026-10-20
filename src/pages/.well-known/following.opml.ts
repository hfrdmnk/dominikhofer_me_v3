import { readFileSync } from "node:fs";
import type { APIRoute } from "astro";
import { OPML_PATH } from "../../lib/blogroll";

export const GET: APIRoute = () =>
  new Response(readFileSync(OPML_PATH), { headers: { "Content-Type": "text/x-opml; charset=utf-8" } });
