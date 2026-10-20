import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export const OPML_PATH = "content/pages/blogroll/feeds.opml";

export interface Feed {
  title: string;
  htmlUrl: string;
  xmlUrl: string;
}

type Outline = Record<string, string> & { outline?: Outline | Outline[] };

const list = <T,>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const feedOf = (outline: Outline): Feed => ({
  title: outline["@_title"] || outline["@_text"],
  htmlUrl: outline["@_htmlUrl"],
  xmlUrl: outline["@_xmlUrl"],
});

/** Category folders from the OPML file; feeds without a folder go to "Other". */
export function blogrollSections(): Array<{ title: string; feeds: Feed[] }> {
  const opml = new XMLParser({ ignoreAttributes: false, htmlEntities: true }).parse(readFileSync(OPML_PATH, "utf8"));
  const outlines = list<Outline>(opml?.opml?.body?.outline);
  if (!outlines.length) throw new Error(`Blogroll ${OPML_PATH} does not contain any feeds`);

  const otherTitle = "Other";
  const slug = (title: string) => title.trim().toLowerCase();
  let uncategorized = outlines.filter((outline) => outline["@_xmlUrl"]).map(feedOf);
  const sections: Array<{ title: string; feeds: Feed[] }> = [];
  for (const folder of outlines.filter((outline) => !outline["@_xmlUrl"])) {
    const title = folder["@_title"] || folder["@_text"];
    let feeds = list(folder.outline).map(feedOf);
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

/** When the OPML file last changed: its last commit, else the file's modification time. */
export function blogrollUpdated(): Date {
  try {
    const committed = execFileSync("git", ["log", "-1", "--format=%cI", "--", OPML_PATH], {
      encoding: "utf8",
    }).trim();
    if (committed) return new Date(committed);
  } catch {
    // Not a Git checkout.
  }
  return statSync(OPML_PATH).mtime;
}
