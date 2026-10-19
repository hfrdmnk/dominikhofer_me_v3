import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { rehypeHugoCompat, remarkHugoCompat } from "../src/markdown/plugins.mjs";

const processor = await createMarkdownProcessor({
  remarkPlugins: [remarkHugoCompat],
  rehypePlugins: [rehypeHugoCompat],
});
const render = async (markdown) =>
  (await processor.render(markdown, { fileURL: new URL("file:///posts/test/index.md"), frontmatter: { slug: "image-test" } })).code;
// Astro stores the options of images it resizes as JSON in an attribute.
const images = (html) =>
  [...html.matchAll(/<(source|img) (?:type="([^"]+)" )?__ASTRO_IMAGE_="([^"]+)"/g)].map(([, tag, type, json]) => ({
    tag,
    type,
    ...JSON.parse(json.replaceAll("&#x22;", '"')),
  }));

test("bundle images become pictures with AVIF and WebP sources", async () => {
  const html = await render("![Raster image](photo.png)");
  assert.match(html, /^<p><picture><source /);
  const [avif, webp, img] = images(html);
  assert.deepEqual([avif.tag, avif.type, avif.src], ["source", "image/avif", "photo.png"]);
  assert.deepEqual([webp.tag, webp.type, webp.format], ["source", "image/webp", "webp"]);
  assert.deepEqual(avif.widths, [480, 768, 1200, 1440]);
  assert.equal(avif.sizes, "(max-width: 60rem) calc(100vw - 3rem), 45rem");
  assert.deepEqual(
    [img.tag, img.alt, img.format, img.loading, img.decoding],
    ["img", "Raster image", "png", "lazy", "async"],
  );
});

test("SVGs and remote images stay plain images", async () => {
  const [svg] = images(await render("![Vector image](signature.svg)"));
  assert.deepEqual([svg.tag, svg.src, svg.format], ["img", "signature.svg", undefined]);
  assert.equal(
    await render("![Remote image](https://example.com/photo.jpg)"),
    '<p><img src="https://example.com/photo.jpg" alt="Remote image" loading="lazy" decoding="async"></p>',
  );
});

test("videos in a post bundle play from the post's URL", async () => {
  assert.equal(
    await render("![Video](clip.mp4)"),
    '<p><video src="/image-test/clip.mp4" controls playsinline preload="metadata"></video></p>',
  );
});
