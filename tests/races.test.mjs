import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildRoutePath,
  generateRaceCourses,
  parseGpxPoints,
} from "../scripts/races.mjs";

const gpx = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="46.0" lon="7.0"/>
      <trkpt lat="46.5" lon="7.4"/>
      <trkpt lat="47.0" lon="8.0"/>
    </trkseg>
  </trk>
</gpx>`;

test("parseGpxPoints reads route coordinates without requiring sensor data", () => {
  assert.deepEqual(parseGpxPoints(gpx), [
    [46, 7],
    [46.5, 7.4],
    [47, 8],
  ]);
});

test("buildRoutePath fits the route into the race card view box", () => {
  const path = buildRoutePath(parseGpxPoints(gpx));

  assert.match(path, /^M/);
  assert.match(path, / L/);
  assert.doesNotMatch(path, /NaN|Infinity/);
});

test("generateRaceCourses writes paths keyed by race bundle name", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "race-courses-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bundle = join(cwd, "content", "races", "sample-race");
  await mkdir(bundle, { recursive: true });
  await writeFile(join(bundle, "course.gpx"), gpx);

  const courses = await generateRaceCourses({ cwd, log: () => {} });

  assert.match(courses["sample-race"], /^M/);
  const generated = JSON.parse(
    await readFile(join(cwd, "data", "race_courses.json"), "utf8"),
  );
  assert.equal(generated["sample-race"], courses["sample-race"]);
});
