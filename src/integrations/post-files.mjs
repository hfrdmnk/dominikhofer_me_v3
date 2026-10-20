// Publishes videos from post bundles at /<slug>/<file>, where Hugo published
// bundle resources. Images go through Astro's image pipeline instead.
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = /\.(?:mp4|webm|mov)$/i;
const TYPES = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };

async function videoFiles(root) {
  const postsDir = path.join(root, "content/posts");
  const files = new Map();
  for (const bundle of await readdir(postsDir, { withFileTypes: true })) {
    if (!bundle.isDirectory()) continue;
    const dir = path.join(postsDir, bundle.name);
    const videos = (await readdir(dir)).filter((name) => VIDEO.test(name));
    if (!videos.length) continue;
    const frontmatter = (await readFile(path.join(dir, "index.md"), "utf8")).match(/^slug:\s*"?([^"\n]+)"?/m);
    if (!frontmatter) continue;
    for (const name of videos) files.set(`/${frontmatter[1]}/${name}`, path.join(dir, name));
  }
  return files;
}

export default function postFiles() {
  let root;
  return {
    name: "post-files",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
      },
      "astro:server:setup": async ({ server }) => {
        const files = await videoFiles(root);
        server.middlewares.use((request, response, next) => {
          const file = files.get(decodeURI(request.url?.split("?")[0] ?? ""));
          if (!file) return next();
          response.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()]);
          createReadStream(file).pipe(response);
        });
      },
      "astro:build:done": async ({ dir, logger }) => {
        const files = await videoFiles(root);
        const outDir = fileURLToPath(dir);
        for (const [url, file] of files) {
          const destination = path.join(outDir, url);
          await mkdir(path.dirname(destination), { recursive: true });
          await copyFile(file, destination);
        }
        logger.info(`Copied ${files.size} post videos.`);
      },
    },
  };
}
