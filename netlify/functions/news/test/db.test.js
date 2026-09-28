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

/* ------------------------------------------------------ the Postgres driver */

import { openNeon, toNumberedPlaceholders, withReturningId, decodeCell } from '../app/db/neon.js';

test('placeholders are numbered, and a question mark inside a literal is left alone', () => {
  assert.equal(
    toNumberedPlaceholders("SELECT * FROM t WHERE a = ? AND b = 'why?' AND c = ?"),
    "SELECT * FROM t WHERE a = $1 AND b = 'why?' AND c = $2",
  );
  assert.equal(
    toNumberedPlaceholders("SELECT 'it''s ?' AS x WHERE y = ?"),
    "SELECT 'it''s ?' AS x WHERE y = $1",
  );
});

test('only an insert into a table with an id asks for one back', () => {
  assert.match(withReturningId('INSERT INTO items (a) VALUES (?)'), /RETURNING id$/);
  assert.match(withReturningId('INSERT INTO points_ledger (a) VALUES (?)'), /RETURNING id$/);
  // votes, flags, favorites and sessions are keyed by their own columns.
  assert.equal(withReturningId('INSERT INTO votes (a) VALUES (?)'), 'INSERT INTO votes (a) VALUES (?)');
  assert.equal(withReturningId('UPDATE items SET a = ?'), 'UPDATE items SET a = ?');
  assert.match(withReturningId('INSERT INTO items (a) VALUES (?) RETURNING id'), /RETURNING id$/);
});

test('Postgres text becomes the type the app expects', () => {
  assert.equal(decodeCell('42', 23), 42);
  assert.equal(decodeCell('t', 16), 1, 'booleans are stored as 0/1 here');
  assert.equal(decodeCell('f', 16), 0);
  assert.equal(decodeCell('1.5', 701), 1.5);
  assert.equal(decodeCell(null, 23), null);
  assert.equal(decodeCell('9007199254740993', 20), '9007199254740993', 'past 2^53 the digits are kept');
});

function neonStub({ rows = [], fields = [], rowCount = 0 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const result = { fields, rows, rowCount };
    const isBatch = Array.isArray(JSON.parse(options.body).queries);
    return {
      ok: true,
      async json() {
        return isBatch ? { results: [result, result, result] } : result;
      },
    };
  };
  return { fetchImpl, calls };
}

test('the endpoint is derived from the connection string, which travels in a header', async () => {
  const { fetchImpl, calls } = neonStub({
    fields: [{ name: 'id', dataTypeID: 23 }],
    rows: [['7']],
    rowCount: 1,
  });
  const url = 'postgresql://user:secret@ep-cool-name-123.us-east-2.aws.neon.tech/neondb';
  const store = openNeon({ connectionString: url, fetchImpl });

  assert.deepEqual(await store.all('SELECT id FROM items WHERE id = ?', 7), [{ id: 7 }]);
  assert.equal(calls[0].url, 'https://ep-cool-name-123.us-east-2.aws.neon.tech/sql');
  assert.equal(calls[0].options.headers['neon-connection-string'], url);
  assert.equal(calls[0].body.queries, undefined, 'a single statement is not sent as a batch');
  assert.equal(calls[0].body.query, 'SELECT id FROM items WHERE id = $1');
  assert.deepEqual(calls[0].body.params, [7]);
});

test('a batch goes as one request, so it is one transaction', async () => {
  const { fetchImpl, calls } = neonStub({ fields: [{ name: 'id', dataTypeID: 23 }], rows: [['3']], rowCount: 1 });
  const store = openNeon({ connectionString: 'postgres://u@h.neon.tech/db', fetchImpl });

  const results = await store.batch([
    { sql: 'INSERT INTO items (title) VALUES (?)', params: ['a'] },
    { sql: 'UPDATE items SET story_id = {{LAST_ID}} WHERE id = {{LAST_ID}}' },
    { sql: 'INSERT INTO votes (user_id, item_id) VALUES (?, {{LAST_ID}})', params: ['ada'] },
  ]);

  assert.equal(calls.length, 1, 'one request, not three');
  const sent = calls[0].body.queries;
  assert.equal(sent.length, 3);
  assert.match(sent[0].query, /RETURNING id$/);
  assert.match(sent[1].query, /story_id = lastval\(\) WHERE id = lastval\(\)/, 'the id carries forward');
  assert.equal(results.length, 3);
  assert.equal(results[0].lastInsertRowid, 3);
});

test('an error from Postgres surfaces as an error, not as empty rows', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    async text() {
      return JSON.stringify({ message: 'relation "items" does not exist', code: '42P01' });
    },
  });
  const store = openNeon({ connectionString: 'postgres://u@h.neon.tech/db', fetchImpl });
  await assert.rejects(store.all('SELECT 1'), /does not exist/);
});
