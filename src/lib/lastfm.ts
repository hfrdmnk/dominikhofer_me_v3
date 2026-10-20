import { truncate } from "./text";
import { SITE } from "../site";

export interface Track {
  track: string;
  artist: string;
  url: string;
}

interface RecentTracks {
  recenttracks?: {
    track?: Array<{
      name?: string;
      url?: string;
      artist?: { "#text"?: string };
      "@attr"?: { nowplaying?: string };
    }>;
  };
}

/** The last completed track; a track that is playing right now is skipped. */
export function lastCompletedTrack(data: RecentTracks): Track | undefined {
  const tracks = data.recenttracks?.track;
  if (!Array.isArray(tracks)) return undefined;
  for (const item of tracks) {
    if (item["@attr"]?.nowplaying === "true") continue;
    const track = item.name ?? "";
    const artist = item.artist?.["#text"] ?? "";
    const url = (item.url ?? "").replace(/^http:\/\//, "https://");
    if (track && artist && url.startsWith("https://www.last.fm/")) {
      return { track, artist, url };
    }
  }
  return undefined;
}

const CACHE_MS = 60_000;
let cached: { at: number; track: Promise<Track | undefined> } | undefined;

async function fetchTrack(apiKey: string): Promise<Track | undefined> {
  const query = new URLSearchParams({
    method: "user.getrecenttracks",
    user: SITE.lastfm.user,
    limit: "2",
    api_key: apiKey,
    format: "json",
  });
  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`);
    if (!response.ok) return undefined;
    return lastCompletedTrack(await response.json());
  } catch {
    return undefined;
  }
}

/** Fetches the last track, shared by all requests of this server instance for a minute. */
export function getLastTrack(apiKey: string | undefined): Promise<Track | undefined> {
  if (!apiKey) return Promise.resolve(undefined);
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), track: fetchTrack(apiKey) };
  }
  return cached.track;
}

export const trackLabel = ({ track, artist }: Track) => truncate(`${track}, ${artist}`, 60, "…");
