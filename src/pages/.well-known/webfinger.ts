import type { APIRoute } from "astro";
import { handleFederation } from "../../federation";

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  handleFederation(request, () => new Response("Not found", { status: 404 }));
