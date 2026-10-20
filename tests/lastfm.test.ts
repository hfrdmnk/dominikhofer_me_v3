import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { lastCompletedTrack } from "../src/lib/lastfm";

test("shows the last completed track, not the one playing right now", () => {
  const data = JSON.parse(readFileSync(new URL("./fixtures/lastfm/now-playing.json", import.meta.url), "utf8"));
  assert.deepEqual(lastCompletedTrack(data), {
    track: "Completed Song",
    artist: "Previous Artist",
    url: "https://www.last.fm/music/Previous+Artist/_/Completed+Song",
  });
});
