import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { SITE } from "../site";

export const MORGENBLAU_OPML_URL = `https://app.morgen.blue/user/${SITE.atproto.did}/following.opml`;
/** Hand-exported copy that the build uses when Morgenblau is unreachable or the list is not public. */
export const FALLBACK_OPML_PATH = "content/pages/blogroll/feeds.opml";

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

const isYouTube = (feed: Feed) => feed.xmlUrl?.startsWith("https://www.youtube.com/feeds/") ?? false;

let blogrollPromise: Promise<{ opml: string; updated: Date }> | undefined;

/**
 * The list of sources I follow, fetched from Morgenblau once per build. Falls back to the
 * committed export, so that a Morgenblau outage does not block deploys.
 */
export function loadBlogroll(): Promise<{ opml: string; updated: Date }> {
  blogrollPromise ??= (async () => {
    try {
      const response = await fetch(MORGENBLAU_OPML_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const opml = await response.text();
      if (!parseOutlines(opml).length) throw new Error("no sources");
      return { opml, updated: new Date() };
    } catch (error) {
      console.warn(`blogroll: fetching ${MORGENBLAU_OPML_URL} failed (${error}), using ${FALLBACK_OPML_PATH}`);
      return { opml: readFileSync(FALLBACK_OPML_PATH, "utf8"), updated: fallbackUpdated() };
    }
  })();
  return blogrollPromise;
}

/**
 * Folders (Morgenblau tags) as sections; sources without a folder go to "Other".
 * YouTube channels are left out because the page lists blogs.
 */
export function blogrollSections(opml: string): Array<{ title: string; feeds: Feed[] }> {
  const outlines = parseOutlines(opml);
  const isFolder = (outline: Outline) => outline.outline != null;
  const feedsOf = (outlines: Outline[]) => outlines.map(feedOf).filter((feed) => !isYouTube(feed));

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

/** When the committed export last changed: its last commit, else the file's modification time. */
function fallbackUpdated(): Date {
  try {
    const committed = execFileSync("git", ["log", "-1", "--format=%cI", "--", FALLBACK_OPML_PATH], {
      encoding: "utf8",
    }).trim();
    if (committed) return new Date(committed);
  } catch {
    // Not a Git checkout.
  }
  return statSync(FALLBACK_OPML_PATH).mtime;
}
