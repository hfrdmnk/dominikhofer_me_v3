import type { KvKey, KvStore, KvStoreListEntry, KvStoreSetOptions } from "@fedify/fedify";
import type { Sql } from "./sql";

/**
 * Fedify's cache and idempotence store in SQL. Workers KV's free tier allows only
 * 1,000 writes a day, which inbox traffic alone exceeds; D1 allows 100,000.
 * Like Fedify's WorkersKvStore, it does not support compare-and-swap.
 */
export class SqlKvStore implements KvStore {
  constructor(private readonly sql: Sql) {}

  async get<T = unknown>(key: KvKey): Promise<T | undefined> {
    const row = await this.sql
      .prepare("SELECT value FROM fedify_kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)")
      .bind(JSON.stringify(key), Date.now())
      .first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  async set(key: KvKey, value: unknown, options?: KvStoreSetOptions): Promise<void> {
    const expiresAt = options?.ttl == null ? null : Date.now() + options.ttl.total("milliseconds");
    await this.sql
      .prepare(
        `INSERT INTO fedify_kv (key, value, expires_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      )
      .bind(JSON.stringify(key), JSON.stringify(value), expiresAt)
      .run();
  }

  async delete(key: KvKey): Promise<void> {
    await this.sql.prepare("DELETE FROM fedify_kv WHERE key = ?").bind(JSON.stringify(key)).run();
  }

  async *list(prefix?: KvKey): AsyncIterable<KvStoreListEntry> {
    // Keys are JSON arrays, so ["a"] matches itself and every key starting with `["a",`.
    const exact = prefix?.length ? JSON.stringify(prefix) : null;
    const start = exact ? `${exact.slice(0, -1)},` : "[";
    const { results } = await this.sql
      .prepare(
        `SELECT key, value FROM fedify_kv
         WHERE (key = ? OR substr(key, 1, length(?2)) = ?2) AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .bind(exact, start, Date.now())
      .all<{ key: string; value: string }>();
    for (const row of results) yield { key: JSON.parse(row.key) as KvKey, value: JSON.parse(row.value) };
  }

  /** Removes expired entries, which reads already skip. */
  async deleteExpired(): Promise<void> {
    await this.sql.prepare("DELETE FROM fedify_kv WHERE expires_at <= ?").bind(Date.now()).run();
  }
}
