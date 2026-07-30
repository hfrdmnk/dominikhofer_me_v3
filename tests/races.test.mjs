import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import * as races from "../scripts/races.mjs";

test("buildRoutePath fits the route into the race card view box", () => {
  const path = races.buildRoutePath([
    [46, 7],
    [46.5, 7.4],
    [47, 8],
  ]);

  assert.match(path, /^M/);
  assert.match(path, / L/);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("buildHeartRatePixels maps 100 chronological buckets from transparent to 50%", () => {
  const records = Array.from({ length: 200 }, (_, index) => ({
    heartRate: 100 + index,
  }));

  const pixels = races.buildHeartRatePixels(records);

  assert.equal(pixels.length, 100);
  assert.equal(pixels[0], 0);
  assert.equal(pixels.at(-1), 0.5);
  assert.ok(pixels[50] > pixels[49]);
});

test("buildHeartRatePixels keeps one low outlier from flattening the race", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    heartRate: index === 0 ? 80 : 170 + (index % 10),
  }));

  const pixels = races.buildHeartRatePixels(records);
  const mean = pixels.reduce((sum, opacity) => sum + opacity, 0) / pixels.length;

  assert.equal(pixels[0], 0);
  assert.ok(Math.abs(mean - 0.25) < 0.001);
  assert.ok(pixels.filter((opacity) => opacity < 0.3).length >= 50);
});

test("buildHeartRatePixels renders a steady effort at middle opacity", () => {
  const pixels = races.buildHeartRatePixels(
    Array.from({ length: 100 }, () => ({ heartRate: 170 })),
  );

  assert.deepEqual(new Set(pixels), new Set([0.25]));
});

test("buildRacePhaseRows keeps 100 square pixels across 10 elevation-shaped rows", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    heartRate: index + 100,
    distance: index * 100,
    enhancedAltitude: index < 50 ? index : 100 - index,
  }));
  const rows = races.buildRacePhaseRows(records);
  const pixels = rows.flat();

  assert.equal(rows.length, 10);
  assert.equal(pixels.length, 100);
  assert.ok(new Set(rows.map(({ length }) => length)).size > 1);
  assert.ok(rows.every(({ length }) => length >= 7 && length <= 13));
  assert.equal(pixels[0], 0);
  assert.equal(pixels.at(-1), 0.5);
});

test("generateRaceArt writes FIT-derived routes and pixels keyed by bundle", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "race-art-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bundle = join(cwd, "content", "races", "sample-race");
  await mkdir(bundle, { recursive: true });
  await copyFile(
    join(
      import.meta.dirname,
      "..",
      "content",
      "races",
      "20260509_altstadt-gp-bern-2026",
      "race.fit",
    ),
    join(bundle, "race.fit"),
  );

  const art = await races.generateRaceArt({ cwd, log: () => {} });

  assert.match(art["sample-race"].route, /^M/);
  assert.equal(art["sample-race"].pixelRows.length, 10);
  assert.equal(art["sample-race"].pixelRows.flat().length, 100);
  assert.equal(Math.max(...art["sample-race"].pixelRows.flat()), 0.5);
  const generated = JSON.parse(
    await readFile(join(cwd, "data", "race_courses.json"), "utf8"),
  );
  assert.deepEqual(generated, art);
});
