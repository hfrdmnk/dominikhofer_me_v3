// Markdown plugins that reproduce the former Hugo render hooks and shortcodes,
// so post Markdown stays unchanged (and Sequoia sees no content edits).
import path from "node:path";
import Slugger from "github-slugger";
import { visit, SKIP } from "unist-util-visit";

const SITE_HOST = "dominikhofer.me";
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
export const DEFAULT_SIZES = "(max-width: 60rem) calc(100vw - 3rem), 45rem";
export const DEFAULT_WIDTHS = [480, 768, 1200, 1440];

const escapeAttribute = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const youtubeEmbed = (id, title = "YouTube video") => `<div class="video-embed">
  <iframe
    src="https://www.youtube-nocookie.com/embed/${escapeAttribute(id)}"
    title="${escapeAttribute(title)}"
    loading="lazy"
    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>`;

export const videoTag = (src) =>
  `<video src="${escapeAttribute(src)}" controls playsinline preload="metadata"></video>`;

/** URL of a file published next to a post, the way Hugo published bundle resources. */
export const bundleFileUrl = (slug, file) => `/${slug}/${file}`;

const YOUTUBE_SHORTCODE_LINE = /^\{\{<\s*youtube\s+(?:id=)?"?([\w-]+)"?(?:\s+title="([^"]*)")?\s*>\}\}$/;
const YOUTUBE_SHORTCODE = /^\s*\{\{<\s*youtube\b[^\n]*>\}\}\s*$/m;

/** Handles the `{{< youtube >}}` shortcode and video files used as Markdown images. */
export function remarkHugoCompat() {
  return (tree, file) => {
    const slug = file.data.astro?.frontmatter?.slug;
    // A shortcode on its own line ends the paragraph it was written in.
    visit(tree, "paragraph", (node, index, parent) => {
      const blocks = [];
      let children = [];
      const flush = () => {
        const [first, last] = [children[0], children.at(-1)];
        if (first?.type === "text") first.value = first.value.replace(/^\s+/, "");
        if (last?.type === "text") last.value = last.value.replace(/\s+$/, "");
        if (children.some((child) => child.type !== "text" || child.value.trim())) {
          blocks.push({ type: "paragraph", children });
        }
        children = [];
      };
      for (const child of node.children) {
        if (child.type !== "text" || !YOUTUBE_SHORTCODE.test(child.value)) {
          children.push(child);
          continue;
        }
        let lines = [];
        const pushText = () => {
          if (lines.length) children.push({ type: "text", value: lines.join("\n") });
          lines = [];
        };
        for (const line of child.value.split("\n")) {
          const match = line.trim().match(YOUTUBE_SHORTCODE_LINE);
          if (!match) {
            lines.push(line);
            continue;
          }
          pushText();
          flush();
          blocks.push({ type: "html", value: youtubeEmbed(match[1], match[2]) });
        }
        pushText();
      }
      if (blocks.length === 0) return;
      flush();
      parent.children.splice(index, 1, ...blocks);
      return [SKIP, index + blocks.length];
    });
    // Hugo rendered `$$…$$` as display math even within a line.
    visit(tree, "paragraph", (node, index, parent) => {
      const [math] = node.children;
      const start = math?.position?.start.offset;
      if (node.children.length !== 1 || math.type !== "inlineMath" || start == null) return;
      if (!String(file.value).startsWith("$$", start)) return;
      const code = { type: "element", tagName: "code", properties: { className: ["language-math", "math-display"] } };
      parent.children[index] = {
        type: "math",
        value: math.value,
        meta: null,
        position: node.position,
        // What mdast-util-math sets on parsed math blocks, so remark-rehype renders it.
        data: { hName: "pre", hChildren: [{ ...code, children: [{ type: "text", value: math.value }] }] },
      };
    });
    visit(tree, "image", (node, index, parent) => {
      const extension = path.extname(new URL(node.url, "file:///").pathname).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(extension)) return;
      const src = URL.canParse(node.url) || node.url.startsWith("/") || !slug
        ? node.url
        : bundleFileUrl(slug, decodeURI(node.url));
      parent.children[index] = { type: "html", value: videoTag(src) };
    });
  };
}

const text = (node) =>
  node.type === "text" ? node.value : (node.children ?? []).map(text).join("");

/**
 * Reproduces Hugo's render hooks and Goldmark output:
 * links, responsive images, footnotes and the `.highlight` code wrapper.
 */
export function rehypeHugoCompat() {
  return (tree, file) => {
    const localImages = new Set(file.data.astro?.localImagePaths ?? []);
    const imageCounts = new Map();
    const slugger = new Slugger();

    visit(tree, "element", (node, index, parent) => {
      // Like Hugo, heading IDs leave out emoji variation selectors.
      if (/^h[1-6]$/.test(node.tagName) && node.properties.id == null) {
        node.properties.id = slugger.slug(text(node).replaceAll("\uFE0F", ""));
      }

      const footnoteLink = ["doc-noteref", "doc-backlink"].includes(node.properties.role);
      if (node.tagName === "a" && !footnoteLink) {
        const href = String(node.properties.href ?? "");
        const host = URL.canParse(href) ? new URL(href).host : "";
        const title = node.properties.title;
        if (title === "button-underline") {
          delete node.properties.title;
          node.properties = { className: ["button-underline"], ...node.properties };
        }
        if (host && host !== SITE_HOST) {
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        }
        parent.children.splice(index + 1, 0, { type: "text", value: "⁠" });
        return index + 2;
      }

      if (node.tagName === "img" && typeof node.properties.src === "string") {
        const src = decodeURI(node.properties.src);
        const alt = node.properties.alt ?? "";
        if (!localImages.has(src) || path.extname(src).toLowerCase() === ".svg") {
          node.properties = { src: node.properties.src, alt, loading: "lazy", decoding: "async" };
          return;
        }
        const occurrence = imageCounts.get(src) ?? 0;
        imageCounts.set(src, occurrence + 1);
        const placeholder = (props) =>
          JSON.stringify({ src, ...props, index: occurrence });
        const source = (format) => ({
          type: "element",
          tagName: "source",
          properties: {
            type: `image/${format}`,
            // `width` sets the unused `src` of the source to the smallest candidate, so no extra full-size file is encoded.
            __ASTRO_IMAGE_: placeholder({ format, width: DEFAULT_WIDTHS[0], widths: DEFAULT_WIDTHS, sizes: DEFAULT_SIZES }),
          },
          children: [],
        });
        const originalFormat = path.extname(src).slice(1).toLowerCase().replace("jpeg", "jpg");
        parent.children[index] = {
          type: "element",
          tagName: "picture",
          properties: {},
          children: [
            source("avif"),
            source("webp"),
            {
              type: "element",
              tagName: "img",
              properties: {
                __ASTRO_IMAGE_: placeholder({ alt, format: originalFormat, loading: "lazy", decoding: "async" }),
              },
              children: [],
            },
          ],
        };
        return SKIP;
      }

      if (node.tagName === "pre") {
        node.properties.tabIndex = 0;
        parent.children[index] = {
          type: "element",
          tagName: "div",
          properties: { className: ["highlight"] },
          children: [node],
        };
        return SKIP;
      }

      if (node.tagName === "sup" && node.children[0]?.properties && "dataFootnoteRef" in node.children[0].properties) {
        const link = node.children[0];
        const number = text(link);
        node.properties = { id: `fnref:${number}` };
        link.properties = { href: `#fn:${number}`, className: ["footnote-ref"], role: "doc-noteref" };
        return SKIP;
      }

      if (node.tagName === "section" && "dataFootnotes" in node.properties) {
        const list = node.children.find((child) => child.tagName === "ol");
        let number = 0;
        for (const item of list?.children ?? []) {
          if (item.type !== "element" || item.tagName !== "li") continue;
          number += 1;
          item.properties = { id: `fn:${number}` };
          visit(item, "element", (child, childIndex, childParent) => {
            if (!("dataFootnoteBackref" in child.properties)) return;
            child.properties = { href: `#fnref:${number}`, className: ["footnote-backref"], role: "doc-backlink" };
            child.children = [{ type: "text", value: "↩︎" }];
            const previous = childParent.children[childIndex - 1];
            if (previous?.type === "text") previous.value = previous.value.replace(/\s+$/, " ");
            return SKIP;
          });
        }
        // Rewritten in place so the links inside the footnotes are still visited.
        node.tagName = "div";
        node.properties = { className: ["footnotes"], role: "doc-endnotes" };
        node.children = [
          { type: "text", value: "\n" },
          { type: "element", tagName: "hr", properties: {}, children: [] },
          { type: "text", value: "\n" },
          ...(list ? [list] : []),
          { type: "text", value: "\n" },
        ];
      }
    });
  };
}
