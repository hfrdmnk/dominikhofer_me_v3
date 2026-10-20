import type { Loader } from "astro/loaders";
import { XMLParser } from "fast-xml-parser";
import { SITE } from "../site";

/** Lists newsletter issues from Buttondown as posts that link to the archive copy. */
export function newsletterLoader(): Loader {
  return {
    name: "buttondown-newsletter",
    async load({ store, logger, parseData }) {
      store.clear();
      let items: Array<{ title: string; link: string; pubDate: string }> = [];
      try {
        const response = await fetch(SITE.newsletter.feed);
        if (!response.ok) throw new Error(`${SITE.newsletter.feed} returned ${response.status}`);
        const feed = new XMLParser().parse(await response.text());
        const channelItems = feed?.rss?.channel?.item ?? [];
        items = Array.isArray(channelItems) ? channelItems : [channelItems];
      } catch (error) {
        logger.warn(`Skipping newsletter issues: ${error}`);
        return;
      }
      for (const item of items) {
        const id = item.link.replace(/\/$/, "").split("/").pop()!;
        const data = await parseData({
          id,
          data: { title: String(item.title), date: item.pubDate, url: item.link },
        });
        store.set({ id, data });
      }
    },
  };
}
