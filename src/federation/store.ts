import { exportJwk, importJwk } from "@fedify/fedify";
import type { Sql } from "./sql";

export interface Follower {
  actorId: string;
  inboxUrl: string;
  sharedInboxUrl: string | null;
}

export interface Comment {
  id: string;
  postSlug: string;
  authorId: string;
  authorName: string;
  authorUrl: string;
  authorHandle: string | null;
  authorAvatar: string | null;
  content: string;
  url: string | null;
  publishedAt: string;
}

export interface StoredPost {
  slug: string;
  objectId: string;
  contentHash: string;
  publishedAt: string;
}

/** Followers, keys, announced posts and replies of the blog actor. */
export class Store {
  constructor(private readonly sql: Sql) {}

  async getKeyPairs(identifier: string): Promise<CryptoKeyPair[] | undefined> {
    const { results } = await this.sql
      .prepare("SELECT algorithm, private_key, public_key FROM key_pairs WHERE identifier = ? ORDER BY algorithm DESC")
      .bind(identifier)
      .all<{ algorithm: string; private_key: string; public_key: string }>();
    if (!results.length) return undefined;
    // RSA first (for older software), then Ed25519.
    return Promise.all(
      results.map(async (row) => ({
        privateKey: await importJwk(JSON.parse(row.private_key), "private"),
        publicKey: await importJwk(JSON.parse(row.public_key), "public"),
      })),
    );
  }

  async saveKeyPairs(identifier: string, keyPairs: CryptoKeyPair[]): Promise<void> {
    const statements = await Promise.all(
      keyPairs.map(async ({ privateKey, publicKey }) =>
        this.sql
          .prepare("INSERT OR IGNORE INTO key_pairs (identifier, algorithm, private_key, public_key) VALUES (?, ?, ?, ?)")
          .bind(
            identifier,
            privateKey.algorithm.name,
            JSON.stringify(await exportJwk(privateKey)),
            JSON.stringify(await exportJwk(publicKey)),
          ),
      ),
    );
    await this.sql.batch(statements);
  }

  async addFollower(follower: Follower): Promise<void> {
    await this.sql
      .prepare(
        `INSERT INTO followers (actor_id, inbox_url, shared_inbox_url) VALUES (?, ?, ?)
         ON CONFLICT (actor_id) DO UPDATE SET inbox_url = excluded.inbox_url, shared_inbox_url = excluded.shared_inbox_url`,
      )
      .bind(follower.actorId, follower.inboxUrl, follower.sharedInboxUrl)
      .run();
  }

  async removeFollower(actorId: string): Promise<void> {
    await this.sql.prepare("DELETE FROM followers WHERE actor_id = ?").bind(actorId).run();
  }

  async getFollowers(): Promise<Follower[]> {
    const { results } = await this.sql
      .prepare("SELECT actor_id, inbox_url, shared_inbox_url FROM followers ORDER BY created_at")
      .all<{ actor_id: string; inbox_url: string; shared_inbox_url: string | null }>();
    return results.map((row) => ({
      actorId: row.actor_id,
      inboxUrl: row.inbox_url,
      sharedInboxUrl: row.shared_inbox_url,
    }));
  }

  async countFollowers(): Promise<number> {
    const row = await this.sql.prepare("SELECT COUNT(*) AS count FROM followers").first<{ count: number }>();
    return row?.count ?? 0;
  }

  async getPosts(): Promise<StoredPost[]> {
    const { results } = await this.sql
      .prepare("SELECT slug, object_id, content_hash, published_at FROM posts")
      .all<{ slug: string; object_id: string; content_hash: string; published_at: string }>();
    return results.map((row) => ({
      slug: row.slug,
      objectId: row.object_id,
      contentHash: row.content_hash,
      publishedAt: row.published_at,
    }));
  }

  async savePost(post: StoredPost): Promise<void> {
    await this.sql
      .prepare(
        `INSERT INTO posts (slug, object_id, content_hash, published_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (slug) DO UPDATE SET object_id = excluded.object_id,
           content_hash = excluded.content_hash, published_at = excluded.published_at`,
      )
      .bind(post.slug, post.objectId, post.contentHash, post.publishedAt)
      .run();
  }

  async deletePost(slug: string): Promise<void> {
    await this.sql.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
  }

  async saveComment(comment: Comment): Promise<void> {
    await this.sql
      .prepare(
        `INSERT INTO comments (id, post_slug, author_id, author_name, author_url, author_handle, author_avatar, content, url, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET author_name = excluded.author_name, author_url = excluded.author_url,
           author_handle = excluded.author_handle, author_avatar = excluded.author_avatar,
           content = excluded.content, url = excluded.url`,
      )
      .bind(
        comment.id,
        comment.postSlug,
        comment.authorId,
        comment.authorName,
        comment.authorUrl,
        comment.authorHandle,
        comment.authorAvatar,
        comment.content,
        comment.url,
        comment.publishedAt,
      )
      .run();
  }

  async getComment(id: string): Promise<Comment | undefined> {
    const row = await this.sql.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first<CommentRow>();
    return row ? toComment(row) : undefined;
  }

  async deleteComment(id: string): Promise<void> {
    await this.sql.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
  }

  async getComments(postSlug: string): Promise<Comment[]> {
    const { results } = await this.sql
      .prepare("SELECT * FROM comments WHERE post_slug = ? ORDER BY published_at")
      .bind(postSlug)
      .all<CommentRow>();
    return results.map(toComment);
  }
}

type CommentRow = Record<string, string | null>;

const toComment = (row: CommentRow): Comment => ({
  id: row.id!,
  postSlug: row.post_slug!,
  authorId: row.author_id!,
  authorName: row.author_name!,
  authorUrl: row.author_url!,
  authorHandle: row.author_handle,
  authorAvatar: row.author_avatar,
  content: row.content!,
  url: row.url,
  publishedAt: row.published_at!,
});
