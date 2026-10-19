import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { aboutMarkdown } from "../../lib/socialspec";

export const GET: APIRoute = async () => {
  const about = (await getEntry("pages", "about"))!;
  return new Response(aboutMarkdown(about.data.title, about.filePath!), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
