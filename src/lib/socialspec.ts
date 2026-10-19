import { readFileSync } from "node:fs";
import { SITE } from "../site";

/** about.md for SocialSpec (socialspec.org), built from the about page. */
export function aboutMarkdown(title: string, filePath: string): string {
  const base = SITE.url;
  // <Prose> only wraps Markdown, so it can be dropped. Any other component would need its own handling.
  let body = readFileSync(filePath, "utf8")
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^<\/?Prose>[ \t]*\n?/gm, "")
    .trim();
  const component = body.match(/^<[A-Z][\w.]*/m);
  if (component) throw new Error(`SocialSpec: about page cannot include component ${component[0]}`);

  // The file is read off-site, so root-relative links need the site's origin.
  body = body
    .replace(/\]\(\/([^/])/g, `](${base}/$1`)
    .replace(/^( {0,3}\[[^\]^][^\]]*\]:[ \t]*)\/([^/])/gm, `$1${base}/$2`)
    .replace(/\b(href|src)=(["'])\/([^/])/g, `$1=$2${base}/$3`);
  const links = [
    ...[...body.matchAll(/\]\(<?([^)\s>]+)/g)].map((match) => match[1]),
    ...[...body.matchAll(/^ {0,3}\[[^\]^][^\]]*\]:[ \t]*<?([^\s>]+)/gm)].map((match) => match[1]),
    ...[...body.matchAll(/\b(?:href|src)=["']([^"']*)["']/g)].map((match) => match[1]),
  ];
  for (const link of links) {
    if (!(link.startsWith("#") || link.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link))) {
      throw new Error(`SocialSpec: about page link "${link}" is page-relative; use /path or a full URL`);
    }
  }
  return `---\nsummary: ${JSON.stringify(SITE.description)}\n---\n\n# ${title}\n\n${body}\n`;
}

/** contact.vcf for SocialSpec. vCard text values escape backslashes, commas and semicolons. */
export function contactCard(): string {
  const name = SITE.title.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;");
  return [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${name}`,
    `EMAIL;PREF=1:${SITE.replyEmail}`,
    `URL:${SITE.url}/`,
    `SOCIALPROFILE;SERVICE-TYPE=Bluesky:https://bsky.app/profile/${SITE.atproto.handle}`,
    "END:VCARD",
  ]
    .map((line) => `${line}\r\n`)
    .join("");
}
