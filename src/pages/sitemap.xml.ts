import type { APIRoute } from "astro";
import { getPosts, getRaces } from "../lib/content";
import { rfc3339 } from "../lib/dates";
import { getRoutes, isHidden, type Route } from "../lib/routes";
import { SITE } from "../site";

export const GET: APIRoute = async () => {
  const posts = (await getPosts()).filter((post) => !post.entry.data.archived);
  const races = await getRaces();
  const newest = (dates: Date[]) =>
    dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : undefined;
  const lastmod = (route: Route): Date | undefined => {
    if (route.kind === "post") return route.post.lastmod;
    if (route.kind === "race") return route.race.date;
    // Sections and the home page take the newest date of their pages, like Hugo.
    if (route.page.id === "posts") return newest(posts.map((post) => post.lastmod));
    if (route.page.id === "races") return newest(races.map((race) => race.date));
    if (route.page.id === "home") return newest([...posts.map((post) => post.lastmod), ...races.map((race) => race.date)]);
    return undefined;
  };
  const urls = (await getRoutes())
    .filter((route) => !isHidden(route))
    .map((route) => {
      const date = lastmod(route);
      return `
  <url>
    <loc>${new URL(route.url, SITE.url).href}</loc>${date ? `
    <lastmod>${rfc3339(date)}</lastmod>` : ""}
  </url>`;
    });
  return new Response(
    `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}
</urlset>
`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
