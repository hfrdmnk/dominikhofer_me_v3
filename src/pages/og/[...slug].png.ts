import type { APIRoute, GetStaticPaths } from "astro";
import { renderOgImage } from "../../lib/og";
import { getRoutes, ogImagePath, socialTitle } from "../../lib/routes";

export const getStaticPaths = (async () => {
  const images = (await getRoutes()).map((route) => ({
    path: ogImagePath(route.url),
    slug: route.url === "/" ? "/" : route.url.slice(0, -1),
    title: socialTitle(route),
  }));
  images.push({ path: "/og/404.png", slug: "/404.html", title: "404 Page not found" });
  return images.map(({ path, slug, title }) => ({
    params: { slug: path.slice("/og/".length, -".png".length) },
    props: { slug, title },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOgImage(props as { slug: string; title: string })), {
    headers: { "Content-Type": "image/png" },
  });
