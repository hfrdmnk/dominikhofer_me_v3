// @ts-check
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import { defineConfig, envField } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { rehypeHugoCompat, remarkHugoCompat } from "./src/markdown/plugins.mjs";
import postFiles from "./src/integrations/post-files.mjs";

export default defineConfig({
  site: "https://dominikhofer.me",
  publicDir: "./static",
  adapter: cloudflare({
    imageService: "compile",
    prerenderEnvironment: "node",
  }),
  integrations: [mdx(), postFiles()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkHugoCompat, remarkMath],
      rehypePlugins: [[rehypeKatex, { output: "htmlAndMathml" }], rehypeHugoCompat],
    }),
    shikiConfig: {
      themes: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
      defaultColor: false,
    },
  },
  image: {
    // The PDS that hosts Bookhive cover blobs, resized at build time.
    remotePatterns: [{ protocol: "https", hostname: "eurosky.social" }],
  },
  env: {
    schema: {
      LASTFM_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Authorizes the deploy workflow's POST /ap/sync.
      FEDIFY_SYNC_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  devToolbar: { enabled: false },
});
