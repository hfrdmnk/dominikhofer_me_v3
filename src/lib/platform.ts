// Cloudflare bindings used by the on-demand parts of the site.
// To self-host on Node.js, reimplement these functions (for example with
// `node:sqlite` for the database, which also holds the key–value store).
import { env } from "cloudflare:workers";
import { WorkersMessageQueue } from "@fedify/cfworkers";
import type { MessageQueue } from "@fedify/fedify";
import { SqlKvStore } from "../federation/kv";
import type { Sql } from "../federation/sql";

interface Bindings {
  DB: Sql;
  FEDIFY_QUEUE: ConstructorParameters<typeof WorkersMessageQueue>[0];
  ASSETS: { fetch(request: Request | string): Promise<Response> };
}

const bindings = env as unknown as Bindings;

export const getDatabase = (): Sql => bindings.DB;
export const getKvStore = (): SqlKvStore => new SqlKvStore(bindings.DB);
export const getMessageQueue = (): MessageQueue & Pick<WorkersMessageQueue, "processMessage"> =>
  new WorkersMessageQueue(bindings.FEDIFY_QUEUE);

/** Reads a file of the built site. */
export const getAsset = (path: string): Promise<Response> =>
  bindings.ASSETS.fetch(new Request(new URL(path, "https://assets.invalid")));
