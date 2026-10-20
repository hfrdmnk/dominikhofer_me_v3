import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { newsletterLoader } from "./lib/newsletter";

const timestamp = z.union([z.date(), z.string()]).optional();

const posts = defineCollection({
  loader: glob({
    pattern: "*/index.md",
    base: "./content/posts",
    generateId: ({ data }) => String(data.slug),
  }),
  schema: z
    .object({
      title: z.string().default(""),
      slug: z.string(),
      date: timestamp,
      lastmod: timestamp,
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
      cover: z.string().optional(),
      media: z.array(z.string()).default([]),
      archived: z.boolean().default(false),
      draft: z.boolean().default(false),
      favorite: z.boolean().default(false),
      feed_only: z.boolean().default(false),
      external_url: z.string().optional(),
      atUri: z.string().optional(),
    })
    .refine((post) => !(post.archived && post.feed_only), {
      message: "A post cannot set both archived and feed_only.",
    }),
});

const races = defineCollection({
  loader: glob({
    pattern: "*/index.md",
    base: "./content/races",
    generateId: ({ data }) => String(data.slug),
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: timestamp,
    location: z.string().optional(),
    distance: z.coerce.number(),
    time: z.string(),
    pace: z.string(),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({
    pattern: ["*.mdx", "*/index.{md,mdx}"],
    base: "./content/pages",
    generateId: ({ entry }) => entry.replace(/(?:\/index)?\.mdx?$/, ""),
  }),
  schema: z.object({
    title: z.string(),
    kicker: z.string().optional(),
    description: z.string().optional(),
    updated: timestamp,
    updatedResource: z.string().optional(),
    updatedLabel: z.string().optional(),
    cover: z.string().optional(),
    noindex: z.boolean().default(false),
    photo_pair: z
      .object({
        photos: z.array(
          z.object({
            image: z.string(),
            alt: z.string(),
            tooltip: z.string().optional(),
            tooltipId: z.string().optional(),
          }),
        ),
      })
      .optional(),
  }),
});

const newsletter = defineCollection({
  loader: newsletterLoader(),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    url: z.url(),
  }),
});

export const collections = { posts, races, pages, newsletter };
