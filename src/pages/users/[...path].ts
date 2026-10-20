import type { APIRoute } from "astro";
import { handleFederation } from "../../federation";

export const prerender = false;

// The blog actor, its inbox and its followers. Browsers go to the home page.
export const ALL: APIRoute = ({ request, redirect }) => handleFederation(request, () => redirect("/", 303));
