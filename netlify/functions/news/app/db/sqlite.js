import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * The node:sqlite driver — local development, the tests, and any deployment
 * that runs the app as one process against a real disk.
 *
 * node:sqlite is synchronous. The methods still return promises so that callers
 * are written against one interface and the hosted driver, which can only be
 * asynchronous, is a drop-in.
 */
export function openSqlite(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return wrapSqlite(db);
}

/** Wrap an already-open DatabaseSync (the tests hand in an in-memory one). */
export function wrapSqlite(db) {
  const store = {
    kind: 'sqlite',
    handle: db,

    async all(sql, ...params) {
      return db.prepare(sql).all(...params);
    },

    async get(sql, ...params) {
      return db.prepare(sql).get(...params) ?? null;
    },

    async run(sql, ...params) {
      const info = db.prepare(sql).run(...params);
      return {
        changes: Number(info.changes),
        lastInsertRowid: Number(info.lastInsertRowid),
      };
    },

    async exec(sql) {
      db.exec(sql);
    },

    /**
     * Run `fn` against a transactional view of the store. SQLite gives us a
     * real BEGIN/COMMIT on the single connection.
     */
    async transaction(fn) {
      db.exec('BEGIN');
      try {
        const result = await fn(store);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          /* the original error is the interesting one */
        }
        throw err;
      }
    },

    async close() {
      db.close();
    },
  };
  return store;
}
