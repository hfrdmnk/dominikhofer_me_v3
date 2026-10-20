import type { APIRoute } from "astro";
import { handleFederation } from "../federation";

export const prerender = false;

// The shared inbox.
export const POST: APIRoute = ({ request }) =>
  handleFederation(request, () => new Response("Not found", { status: 404 }));
