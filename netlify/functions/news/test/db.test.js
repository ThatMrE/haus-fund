process.env.BIOPUNK_DB = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { openTurso, encodeValue, decodeValue, httpUrl } from '../app/db/turso.js';
import { statements, SCHEMA } from '../app/db/schema.js';
import { describeTarget } from '../app/db/index.js';

/* ------------------------------------------------------ the hosted driver */

test('a libsql URL becomes the https pipeline endpoint', () => {
  assert.equal(httpUrl('libsql://feed-haus.turso.io'), 'https://feed-haus.turso.io');
  assert.equal(httpUrl('https://feed-haus.turso.io/'), 'https://feed-haus.turso.io');
  assert.equal(httpUrl('wss://feed-haus.turso.io'), 'https://feed-haus.turso.io');
});

test('values survive the round trip through the wire format', () => {
  assert.deepEqual(encodeValue(42), { type: 'integer', value: '42' });
  assert.deepEqual(encodeValue(1.5), { type: 'float', value: 1.5 });
  assert.deepEqual(encodeValue(null), { type: 'null' });
  assert.deepEqual(encodeValue(true), { type: 'integer', value: '1' });
  assert.deepEqual(encodeValue('hi'), { type: 'text', value: 'hi' });

  assert.equal(decodeValue({ type: 'integer', value: '42' }), 42);
  assert.equal(decodeValue({ type: 'null' }), null);
  assert.equal(decodeValue({ type: 'text', value: 'hi' }), 'hi');
  // Past 2^53 a Number would quietly lose digits, so the string is kept.
  assert.equal(decodeValue({ type: 'integer', value: '9007199254740993' }), '9007199254740993');
});

/** A fetch that speaks just enough of the protocol to drive the driver. */
function stubServer({ rows = [], cols = ['id'] } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body, headers: options.headers });
    return {
      ok: true,
      async json() {
        return {
          baton: 'baton-1',
          results: body.requests.map((request) =>
            request.type === 'close'
              ? { type: 'ok', response: { type: 'close' } }
              : {
                  type: 'ok',
                  response: {
                    type: 'execute',
                    result: {
                      cols: cols.map((name) => ({ name })),
                      rows,
                      affected_row_count: 1,
                      last_insert_rowid: '7',
                    },
                  },
                },
          ),
        };
      },
    };
  };
  return { fetchImpl, calls };
}

test('a query is one round trip, with the token attached', async () => {
  const { fetchImpl, calls } = stubServer({
    cols: ['id', 'title'],
    rows: [[{ type: 'integer', value: '3' }, { type: 'text', value: 'A round' }]],
  });
  const store = openTurso({ url: 'libsql://x.turso.io', token: 'secret', fetchImpl });

  const rows = await store.all('SELECT id, title FROM items WHERE id = ?', 3);
  assert.deepEqual(rows, [{ id: 3, title: 'A round' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://x.turso.io/v2/pipeline');
  assert.equal(calls[0].headers.authorization, 'Bearer secret');
  assert.deepEqual(calls[0].body.requests.at(-1), { type: 'close' }, 'the session is closed');
  assert.deepEqual(calls[0].body.requests[0].stmt.args, [{ type: 'integer', value: '3' }]);
});

test('run reports the rowid and the change count', async () => {
  const { fetchImpl } = stubServer();
  const store = openTurso({ url: 'libsql://x.turso.io', fetchImpl });
  const info = await store.run('INSERT INTO items (title) VALUES (?)', 'x');
  assert.equal(info.lastInsertRowid, 7);
  assert.equal(info.changes, 1);
});

test('a transaction holds one session open and commits on it', async () => {
  const { fetchImpl, calls } = stubServer();
  const store = openTurso({ url: 'libsql://x.turso.io', fetchImpl });

  await store.transaction(async (tx) => {
    await tx.run('INSERT INTO items (title) VALUES (?)', 'a');
    await tx.run('INSERT INTO items (title) VALUES (?)', 'b');
  });

  const sql = calls.flatMap((c) => c.body.requests.map((r) => r.stmt?.sql).filter(Boolean));
  assert.deepEqual(sql, [
    'BEGIN',
    'INSERT INTO items (title) VALUES (?)',
    'INSERT INTO items (title) VALUES (?)',
    'COMMIT',
  ]);
  // Everything after the first call carries the baton, which is what keeps the
  // statements on one connection.
  assert.ok(calls.slice(1).every((c) => c.body.baton === 'baton-1'));
});

test('a transaction rolls back when the body throws', async () => {
  const { fetchImpl, calls } = stubServer();
  const store = openTurso({ url: 'libsql://x.turso.io', fetchImpl });

  await assert.rejects(
    store.transaction(async (tx) => {
      await tx.run('INSERT INTO items (title) VALUES (?)', 'a');
      throw new Error('nope');
    }),
    /nope/,
  );

  const sql = calls.flatMap((c) => c.body.requests.map((r) => r.stmt?.sql).filter(Boolean));
  assert.ok(sql.includes('ROLLBACK'));
  assert.ok(!sql.includes('COMMIT'));
});

test('an error from the server surfaces as an error, not as empty rows', async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return { results: [{ type: 'error', error: { message: 'no such table: items', code: 'SQLITE_ERROR' } }] };
    },
  });
  const store = openTurso({ url: 'libsql://x.turso.io', fetchImpl });
  await assert.rejects(store.all('SELECT 1'), /no such table/);
});

test('an HTTP failure names the host and the status', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, async text() { return 'unauthorized'; } });
  const store = openTurso({ url: 'libsql://x.turso.io', fetchImpl });
  await assert.rejects(store.all('SELECT 1'), /401/);
});

/* ------------------------------------------------------------ the target */

test('a libsql URL in the environment selects the hosted database', () => {
  assert.deepEqual(
    describeTarget({ TURSO_DATABASE_URL: 'libsql://x.turso.io', TURSO_AUTH_TOKEN: 't' }),
    { driver: 'turso', url: 'libsql://x.turso.io', token: 't' },
  );
  assert.equal(describeTarget({ BIOPUNK_DB: '/tmp/x.db' }).driver, 'sqlite');
});

test('the schema splits into statements a driver can send one at a time', () => {
  const parsed = statements(SCHEMA);
  assert.ok(parsed.length > 20);
  assert.ok(parsed.every((s) => /^CREATE (TABLE|INDEX|UNIQUE INDEX)/.test(s)));
  // A `;` inside a comment must not cut a statement in half.
  assert.ok(parsed.every((s) => !s.includes('--')));
});
