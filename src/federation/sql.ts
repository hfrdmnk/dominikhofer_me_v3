/**
 * The SQL subset the federation store needs. Cloudflare D1 implements it as is;
 * on Node.js, a few lines around `node:sqlite` or better-sqlite3 do the same.
 */
export interface Sql {
  prepare(query: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown>;
}

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
