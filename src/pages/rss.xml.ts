import type { APIRoute } from "astro";
import { render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getFeedPosts, summary } from "../lib/content";
import { rfc822 } from "../lib/dates";
import { bundleImage } from "../lib/images";
import { replyEmailHref } from "../lib/text";
import { SITE } from "../site";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&#34;").replaceAll("'", "&#39;");

export const GET: APIRoute = async () => {
  const container = await AstroContainer.create();
  const posts = await getFeedPosts();
  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post.entry);
      const content = await container.renderToString(Content);
      const permalink = new URL(post.url, SITE.url).href;
      const coverImage = post.entry.data.cover
        ? await bundleImage(post.entry.filePath, post.entry.data.cover)
        : undefined;
      const cover = coverImage ? `<p><img src="${new URL(coverImage.src, SITE.url).href}" alt=""></p>` : "";
      const reply = replyEmailHref(SITE.replyEmail, post.title);
      const footer = `<hr>\n<p>Thanks for using RSS! ${post.entry.data.feed_only ? "" : `<a href="${permalink}">View this post on my site</a> or `}<a href="${reply}">reply via email</a>.</p>`;
      return `
    <item>
      <title>${escape(post.title || summary(post.entry))}</title>
      <link>${permalink}</link>
      <pubDate>${rfc822(post.date)}</pubDate>
      <guid isPermaLink="true">${permalink.replace(/\/$/, "")}</guid>
      <description>${escape(`${cover}${content}${footer}`)}</description>
    </item>`;
    }),
  );
  const body = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <script xmlns="http://www.w3.org/1999/xhtml" src="/styles/rss.js" defer=""/>
    <title>${escape(SITE.title)}</title>
    <link>${SITE.url}/</link>
    <description>${escape(SITE.description)}</description>
    <generator>Astro</generator>
    <language>${SITE.locale}</language>${posts[0] ? `
    <lastBuildDate>${rfc822(posts[0].lastmod)}</lastBuildDate>` : ""}
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />${items.join("")}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
