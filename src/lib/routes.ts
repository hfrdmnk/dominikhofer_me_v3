import { getCollection } from "astro:content";
import { formatDate } from "./dates";
import { getPosts, getRaces, pageUrl, type PageEntry, type Post, type Race } from "./content";
import { SITE } from "../site";

export type Route =
  | { kind: "post"; url: string; post: Post }
  | { kind: "race"; url: string; race: Race }
  | { kind: "page"; url: string; page: PageEntry };

/** Every HTML page of the site. */
export async function getRoutes(): Promise<Route[]> {
  const pages = await getCollection("pages");
  return [
    ...pages.map((page) => ({ kind: "page" as const, url: pageUrl(page), page })),
    ...(await getPosts()).map((post) => ({ kind: "post" as const, url: post.url, post })),
    ...(await getRaces()).map((race) => ({ kind: "race" as const, url: race.url, race })),
  ];
}

export function routeTitle(route: Route): string {
  if (route.kind === "page") return route.page.data.title;
  return route.kind === "post" ? route.post.title : route.race.title;
}

export function routeDate(route: Route): Date | undefined {
  if (route.kind === "page") return undefined;
  return route.kind === "post" ? route.post.date : route.race.date;
}

/** Title used for Open Graph: the page title, else its date, else the site title. */
export function socialTitle(route: Route): string {
  const date = routeDate(route);
  return routeTitle(route) || (date ? formatDate(date) : SITE.title);
}

/** Path of the generated Open Graph image, e.g. `/og/about.png`. */
export function ogImagePath(url: string): string {
  return `/og/${url === "/" ? "index" : url.slice(1, -1)}.png`;
}

/** Excluded from search engines and the sitemap. */
export function isHidden(route: Route): boolean {
  if (route.kind === "page") return route.page.data.noindex;
  if (route.kind === "post") return route.post.entry.data.archived || route.post.entry.data.feed_only;
  return false;
}
