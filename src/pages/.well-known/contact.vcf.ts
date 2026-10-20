import type { APIRoute } from "astro";
import { contactCard } from "../../lib/socialspec";

export const GET: APIRoute = () =>
  new Response(contactCard(), { headers: { "Content-Type": "text/vcard; charset=utf-8" } });
