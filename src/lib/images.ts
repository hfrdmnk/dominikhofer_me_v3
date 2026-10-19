import type { ImageMetadata } from "astro";

const contentImages = import.meta.glob<ImageMetadata>(
  "/content/**/*.{jpg,jpeg,png,webp,avif,gif}",
  { import: "default" },
);
const assetImages = import.meta.glob<ImageMetadata>("/src/assets/images/*.{jpg,jpeg,png,webp,avif}", {
  import: "default",
});

/** Resolves an image next to a content entry, like Hugo's `.Resources.Get`. */
export async function bundleImage(
  filePath: string | undefined,
  name: string,
): Promise<ImageMetadata | undefined> {
  if (!filePath) return undefined;
  const dir = filePath.replace(/^\.?\/?/, "/").replace(/\/[^/]+$/, "");
  return contentImages[`${dir}/${name}`]?.();
}

/** Resolves a site image such as `images/home-1.avif`, like Hugo's `resources.Get`. */
export async function assetImage(name: string): Promise<ImageMetadata> {
  const image = await assetImages[`/src/assets/${name}`]?.();
  if (!image) throw new Error(`Image not found: ${name}`);
  return image;
}
