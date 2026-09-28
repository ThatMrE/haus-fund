/**
 * A transport for the Neon driver that talks to a local Postgres through psql.
 *
 * The point is to exercise the real driver — placeholder numbering, RETURNING,
 * row decoding, batch transactions — against a real Postgres, rather than
 * proving only that it can talk to a stub of itself. The HTTP shape is
 * reproduced, not the HTTP.
 *
 * Test-only, and it takes two liberties the real transport does not: it inlines
 * parameters as literals instead of binding them, and it appends `RETURNING 1`
 * to statements that return nothing so the affected-row count survives the
 * round trip.
 */
import { execFileSync } from 'node:child_process';

export function psqlAvailable({ host = '/tmp', port = 55432, db = 'feedtest' } = {}) {
  try {
    execFileSync('psql', ['-h', host, '-p', String(port), '-U', 'postgres', '-d', db, '-tAc', 'select 1'], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** $1, $2 … back to literals, stepping over quoted strings. */
function inlineParams(sql, params) {
  let out = '';
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      out += char;
      if (char === quote) {
        if (sql[i + 1] === quote) out += sql[++i];
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === '$' && /[0-9]/.test(sql[i + 1] ?? '')) {
      let digits = '';
      while (/[0-9]/.test(sql[i + 1] ?? '')) digits += sql[++i];
      out += literal(params[Number(digits) - 1]);
      continue;
    }
    out += char;
  }
  return out;
}

const RETURNS_ROWS = /^\s*(SELECT|WITH)\b/i;
/** Schema statements cannot sit inside a CTE, and return nothing anyway. */
const DDL = /^\s*(CREATE|ALTER|DROP|TRUNCATE|COMMENT|SET|BEGIN|COMMIT|ROLLBACK)\b/i;

function wrap(sql) {
  const body = sql.replace(/;\s*$/, '');
  // Keep one output line per statement either way, so results line up with the
  // queries that produced them.
  if (DDL.test(body)) return `${body};\nSELECT '[]'::text;`;
  const statement = RETURNS_ROWS.test(body) || /\bRETURNING\b/i.test(body)
    ? body
    : `${body} RETURNING 1 AS __affected`;
  return `WITH q AS (${statement}) SELECT coalesce(json_agg(row_to_json(q)), '[]')::text FROM q;`;
}

/** JSON objects -> the { fields, rows, rowCount } shape the driver reads. */
function shape(objects) {
  const names = objects.length ? Object.keys(objects[0]) : [];
  return {
    fields: names.map((name) => ({ name, dataTypeID: typeOf(objects, name) })),
    rows: objects.map((row) => names.map((name) => stringify(row[name]))),
    rowCount: objects.length,
  };
}

function typeOf(objects, name) {
  const sample = objects.map((row) => row[name]).find((v) => v !== null && v !== undefined);
  if (typeof sample === 'number') return Number.isInteger(sample) ? 23 : 701;
  if (typeof sample === 'boolean') return 16;
  return 25;
}

function stringify(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 't' : 'f';
  return String(value);
}

export function psqlTransport({ host = '/tmp', port = 55432, db = 'feedtest' } = {}) {
  return async function send(queries, { transaction = false } = {}) {
    const statements = queries.map((q) => wrap(inlineParams(q.query ?? q.sql, q.params ?? [])));
    const script = transaction
      ? ['BEGIN;', ...statements, 'COMMIT;'].join('\n')
      : statements.join('\n');

    let stdout;
    try {
      stdout = execFileSync(
        'psql',
        ['-h', host, '-p', String(port), '-U', 'postgres', '-d', db, '-tAq', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
        { input: script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch (err) {
      const detail = err.stderr?.toString().trim() || err.message;
      throw new Error(detail);
    }

    const lines = stdout.split('\n').filter((line) => line.trim() !== '');
    return lines.map((line) => shape(JSON.parse(line)));
  };
}
