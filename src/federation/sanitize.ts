import sanitizeHtml from "sanitize-html";

/** Reduces a reply's HTML to text formatting and links. */
export function sanitizeComment(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "a", "span", "strong", "b", "em", "i", "del", "s", "code", "pre", "blockquote", "ul", "ol", "li"],
    allowedAttributes: { a: ["href", "rel", "target"], span: ["class"] },
    // Mastodon shortens long links with these classes.
    allowedClasses: { span: ["invisible", "ellipsis"] },
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { href: attribs.href ?? "", rel: "nofollow noopener noreferrer ugc", target: "_blank" },
      }),
    },
    allowedSchemesAppliedToAttributes: ["href"],
  });
}
