import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blogrollSections } from "../src/lib/blogroll";

test("lists Standardfeed publications without a feed link and leaves out YouTube channels", () => {
  const opml = readFileSync(new URL("./fixtures/blogroll/following.opml", import.meta.url), "utf8");
  assert.deepEqual(blogrollSections(opml), [
    {
      title: "Personal",
      feeds: [
        { title: "Anil Dash", htmlUrl: "https://www.anildash.com/", xmlUrl: "https://www.anildash.com/feed.xml" },
        { title: "Thorsten Ball", htmlUrl: "https://thorstenball.com/", xmlUrl: "https://thorstenball.com/atom.xml" },
      ],
    },
    {
      title: "Publications",
      feeds: [
        { title: "Anil Dash", htmlUrl: "https://www.anildash.com/", xmlUrl: "https://www.anildash.com/feed.xml" },
        { title: "Trust the Process", htmlUrl: "https://trust.example/", xmlUrl: undefined },
      ],
    },
    { title: "Other", feeds: [{ title: "Leaflet Notes", htmlUrl: "https://notes.example/", xmlUrl: undefined }] },
  ]);
});
