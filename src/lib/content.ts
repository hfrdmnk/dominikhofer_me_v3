import { readFileSync } from "node:fs";
import { getCollection, type CollectionEntry } from "astro:content";
import { siteDate } from "./dates";
import { truncate } from "./text";

export type PostEntry = CollectionEntry<"posts">;
export type RaceEntry = CollectionEntry<"races">;
export type PageEntry = CollectionEntry<"pages">;

/** Reads a frontmatter value as written, since YAML turns timestamps into UTC dates. */
function rawFrontmatter(filePath: string | undefined, key: string): string | undefined {
  if (!filePath) return undefined;
  const frontmatter = readFileSync(filePath, "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  return frontmatter
    .match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"))?.[1]
    .replace(/^["']|["']$/g, "");
}

export function entryDate(
  entry: { filePath?: string; data: Record<string, unknown> },
  key: string,
): Date | undefined {
  const value = entry.data[key];
  if (value == null || value === "") return undefined;
  return siteDate(rawFrontmatter(entry.filePath, key) ?? (value as string | Date));
}

export interface Post {
  entry: PostEntry;
  slug: string;
  title: string;
  date: Date;
  lastmod: Date;
  url: string;
}

export interface ListItem {
  title: string;
  date: Date;
  url: string;
  external: boolean;
  favorite: boolean;
  tags: string[];
}

const now = new Date();

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/[\s⁠]+/g, " ")
    .trim();
}

/** Hugo's `.Summary | plainify | truncate 70`. */
export function summary(entry: PostEntry): string {
  return truncate(plainText(entry.rendered?.html ?? ""), 70, " …");
}

function toPost(entry: PostEntry): Post {
  const date = entryDate(entry, "date") ?? new Date(0);
  return {
    entry,
    slug: entry.id,
    title: entry.data.title,
    date,
    lastmod: entryDate(entry, "lastmod") ?? date,
    url: `/${entry.id}/`,
  };
}

const byDateDescending = <T extends { date: Date }>(a: T, b: T) =>
  b.date.getTime() - a.date.getTime();

let postsPromise: Promise<Post[]> | undefined;

/** Every post Hugo would build: no drafts and nothing dated in the future, except in the dev server. */
export function getPosts(): Promise<Post[]> {
  postsPromise ??= getCollection("posts").then((entries) =>
    entries
      .map(toPost)
      .filter((post) => import.meta.env.DEV || (!post.entry.data.draft && post.date <= now))
      .sort(byDateDescending),
  );
  return postsPromise;
}

/** Posts that appear in feeds: everything except archived posts. */
export async function getFeedPosts(): Promise<Post[]> {
  return (await getPosts()).filter((post) => !post.entry.data.archived);
}

/** Entries of the post archive, including newsletter issues that link to Buttondown. */
export async function getArchiveItems(): Promise<ListItem[]> {
  const posts = (await getPosts())
    .filter((post) => !post.entry.data.archived && !post.entry.data.feed_only)
    .map((post) => ({
      title: post.title || summary(post.entry),
      date: post.date,
      url: post.entry.data.external_url ?? post.url,
      external: Boolean(post.entry.data.external_url),
      favorite: post.entry.data.favorite,
      tags: post.entry.data.tags,
    }));
  const issues = (await getCollection("newsletter")).map((issue) => ({
    title: issue.data.title,
    date: issue.data.date,
    url: issue.data.url,
    external: true,
    favorite: false,
    tags: [],
  }));
  return [...posts, ...issues].sort(byDateDescending);
}

export interface Race {
  entry: RaceEntry;
  slug: string;
  bundle: string;
  title: string;
  date: Date;
  url: string;
}

export async function getRaces(): Promise<Race[]> {
  return (await getCollection("races"))
    .map((entry) => ({
      entry,
      slug: entry.id,
      bundle: entry.filePath!.split("/").at(-2)!,
      title: entry.data.title,
      date: entryDate(entry, "date") ?? new Date(0),
      url: `/${entry.id}/`,
    }))
    .filter((race) => import.meta.env.DEV || (!race.entry.data.draft && race.date <= now))
    .sort(byDateDescending);
}

/** URL of a slash page. `home` is the site root. */
export function pageUrl(page: PageEntry): string {
  return page.id === "home" ? "/" : `/${page.id}/`;
}
