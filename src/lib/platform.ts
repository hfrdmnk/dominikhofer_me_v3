// Cloudflare bindings used by the on-demand parts of the site.
// To self-host on Node.js, reimplement these functions (for example with
// `node:sqlite` for the database and `@fedify/sqlite` for the key–value store).
import { env } from "cloudflare:workers";
import { WorkersKvStore, WorkersMessageQueue } from "@fedify/cfworkers";
import type { KvStore, MessageQueue } from "@fedify/fedify";
import type { Sql } from "../federation/sql";

interface Bindings {
  DB: Sql;
  FEDIFY_KV: ConstructorParameters<typeof WorkersKvStore>[0];
  FEDIFY_QUEUE: ConstructorParameters<typeof WorkersMessageQueue>[0];
  ASSETS: { fetch(request: Request | string): Promise<Response> };
}

const bindings = env as unknown as Bindings;

export const getDatabase = (): Sql => bindings.DB;
export const getKvStore = (): KvStore => new WorkersKvStore(bindings.FEDIFY_KV);
export const getMessageQueue = (): MessageQueue => new WorkersMessageQueue(bindings.FEDIFY_QUEUE);

/** Reads a file of the built site. */
export const getAsset = (path: string): Promise<Response> =>
  bindings.ASSETS.fetch(new Request(new URL(path, "https://assets.invalid")));
