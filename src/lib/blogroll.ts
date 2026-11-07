import { XMLParser } from "fast-xml-parser";
import { SITE } from "../site";

/** YouTube channels are left out because the blogroll lists blogs. */
export const MORGENBLAU_OPML_URL = `https://app.morgen.blue/user/${SITE.atproto.did}/following.opml?excludeKind=youtube`;
/** Without folders, because FollowSpec readers such as FollowDraw only read top-level outlines. */
export const MORGENBLAU_FLAT_OPML_URL = `${MORGENBLAU_OPML_URL}&folders=none`;

export interface Feed {
  title: string;
  htmlUrl: string;
  /** Missing for Standardfeed publications, which have no RSS feed. */
  xmlUrl?: string;
}

type Outline = Record<string, string> & { outline?: Outline | Outline[] };

const list = <T,>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const parseOutlines = (opml: string): Outline[] =>
  list<Outline>(new XMLParser({ ignoreAttributes: false, htmlEntities: true }).parse(opml)?.opml?.body?.outline);

const feedOf = (outline: Outline): Feed => ({
  title: outline["@_title"] || outline["@_text"],
  htmlUrl: outline["@_htmlUrl"] || outline["@_url"],
  xmlUrl: outline["@_xmlUrl"],
});

/** The list of sources I follow, fetched from Morgenblau. */
export async function loadBlogroll(url = MORGENBLAU_OPML_URL): Promise<{ opml: string; updated: Date }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`blogroll: fetching ${url} failed: HTTP ${response.status}`);
  const opml = await response.text();
  if (!parseOutlines(opml).length) throw new Error(`blogroll: ${url} lists no sources`);
  return { opml, updated: new Date() };
}

/** Folders (Morgenblau tags) as sections; sources without a folder go to "Other". */
export function blogrollSections(opml: string): Array<{ title: string; feeds: Feed[] }> {
  const outlines = parseOutlines(opml);
  const isFolder = (outline: Outline) => outline.outline != null;
  const feedsOf = (outlines: Outline[]) => outlines.map(feedOf);

  const otherTitle = "Other";
  const slug = (title: string) => title.trim().toLowerCase();
  let uncategorized = feedsOf(outlines.filter((outline) => !isFolder(outline)));
  const sections: Array<{ title: string; feeds: Feed[] }> = [];
  for (const folder of outlines.filter(isFolder)) {
    const title = folder["@_title"] || folder["@_text"];
    let feeds = feedsOf(list(folder.outline));
    // A folder already named Other takes the feeds without a folder.
    if (uncategorized.length && slug(title) === slug(otherTitle)) {
      feeds = [...feeds, ...uncategorized];
      uncategorized = [];
    }
    if (feeds.length) sections.push({ title, feeds });
  }
  if (uncategorized.length) sections.push({ title: otherTitle, feeds: uncategorized });
  return sections.map((section) => ({
    ...section,
    feeds: section.feeds.toSorted((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1)),
  }));
}
