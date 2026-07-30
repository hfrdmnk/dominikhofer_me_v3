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
  assert.equal(art["sample-race"].pixels.length, 100);
  assert.equal(Math.max(...art["sample-race"].pixels), 0.5);
  const generated = JSON.parse(
    await readFile(join(cwd, "data", "race_courses.json"), "utf8"),
  );
  assert.deepEqual(generated, art);
});
