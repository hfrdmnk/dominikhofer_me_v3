import type { Loader } from "astro/loaders";
import { SITE } from "../site";
import { getRecord, listRecords } from "./atproto";

interface Publication {
  url: string;
}

interface Document {
  site: string;
  title: string;
  path: string;
  publishedAt: string;
}

/** Lists newsletter issues from their Standard Site records as posts that link to the Buttondown archive copy. */
export function newsletterLoader(): Loader {
  return {
    name: "standard-site-newsletter",
    async load({ store, logger, parseData }) {
      const rkey = SITE.newsletter.publication.split("/").pop()!;
      const [publication, documents] = await Promise.all([
        getRecord<Publication>("site.standard.publication", rkey),
        listRecords<Document>("site.standard.document"),
      ]);
      if (!publication || !documents.ok) {
        logger.warn("Skipping newsletter issues: their Standard Site records could not be fetched");
        return;
      }
      store.clear();
      for (const { value } of documents.records) {
        if (value.site !== SITE.newsletter.publication) continue;
        const id = value.path.split("/").pop()!;
        const data = await parseData({
          id,
          data: { title: value.title, date: value.publishedAt, url: publication.value.url.replace(/\/$/, "") + value.path },
        });
        store.set({ id, data });
      }
    },
  };
}
