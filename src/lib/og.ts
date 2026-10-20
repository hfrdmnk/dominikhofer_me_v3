import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { BUILD_TIME } from "./build";
import { weekday } from "./dates";
import { truncate } from "./text";

// Resolved from the project root, since this module is bundled before it runs.
const asset = (file: string) => path.resolve("src/assets", file);

const ACCENTS: Record<string, string> = {
  monday: "#ff3333",
  tuesday: "#ff8801",
  wednesday: "#ffcc00",
  thursday: "#32cc77",
  friday: "#00ccdd",
  saturday: "#0088ff",
  sunday: "#5555ff",
};

const LINE_LENGTH = 44;

/** Wraps the title into at most three lines of 44 characters, like the Hugo template did. */
export function wrapTitle(title: string): string[] {
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  const cut = (text: string) => truncate(text, LINE_LENGTH, "…");
  for (const word of title.trim().split(" ")) {
    if (!word || truncated) continue;
    const candidate = current ? `${current} ${word}` : word;
    if ([...candidate].length <= LINE_LENGTH) {
      current = candidate;
    } else if (!current) {
      current = cut(word);
      truncated = true;
    } else if (lines.length < 2) {
      lines.push(current);
      current = word;
      if ([...current].length > LINE_LENGTH) {
        current = cut(current);
        truncated = true;
      }
    } else {
      current = cut(candidate);
      truncated = true;
    }
  }
  if (current) lines.push(current);
  return lines;
}

let fonts: Promise<{ title: Buffer; text: Buffer }> | undefined;

/** Renders the 1200×630 Open Graph image for a page. */
export async function renderOgImage({ slug, title }: { slug: string; title: string }): Promise<Buffer> {
  fonts ??= Promise.all([
    readFile(asset("fonts/Newsreader48pt-Medium.ttf")),
    readFile(asset("fonts/Go-Regular.ttf")),
  ]).then(([title, text]) => ({ title, text }));
  const { title: titleFont, text: textFont } = await fonts;
  const day = weekday(BUILD_TIME);

  const text = (value: string, style: Record<string, string | number>) => ({
    type: "div",
    props: { style: { position: "absolute", left: 64, display: "flex", whiteSpace: "pre", ...style }, children: value },
  });
  const svg = await satori(
    {
      type: "div",
      props: {
        style: { display: "flex", position: "relative", width: 1200, height: 630 },
        children: [
          text(slug, { top: 242, fontFamily: "Go", fontSize: 24, color: "#737373" }),
          {
            type: "div",
            props: {
              style: { position: "absolute", left: 64, top: 298, display: "flex", flexDirection: "column", gap: 8 },
              children: wrapTitle(title).map((line) => ({
                type: "div",
                props: {
                  style: { fontFamily: "Newsreader", fontSize: 48, lineHeight: 1, color: "#171717", whiteSpace: "pre" },
                  children: line,
                },
              })),
            },
          },
          text("dominikhofer.me", { top: 546, fontFamily: "Go", fontSize: 20, color: ACCENTS[day] }),
        ],
      },
    } as any,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Newsreader", data: titleFont, weight: 500 },
        { name: "Go", data: textFont, weight: 400 },
      ],
    },
  );

  const marker = await sharp(await readFile(asset(`images/og-marker-${day}.png`)))
    .resize(158, 24, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
  return sharp(await readFile(asset("images/og-base.png")))
    .resize(1200, 630, { fit: "fill", kernel: "lanczos3" })
    .composite([
      { input: marker, left: 59, top: 545 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}
