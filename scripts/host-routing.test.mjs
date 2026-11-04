// Unit tests for netlify/edge-functions/cores-host.js. Run: node --test scripts/
// Lives outside netlify/edge-functions/ because Netlify deploys every file there
// as an edge function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { targetFor } from '../netlify/edge-functions/cores-host.js';

const ctx = (log) => ({
  next: async () => { log.push('next'); return new Response('home'); },
  nextRequest: async (req) => { log.push(`rewrite ${new URL(req.url).pathname}`); return new Response('tool'); },
});

test('targetFor maps known hosts and ignores case and www', () => {
  assert.equal(targetFor('cores.haus.fund'), '/cores.html');
  assert.equal(targetFor('WWW.Visa.Haus.Fund'), '/visa.html');
  assert.deepEqual(targetFor('news.haus.fund'), { redirect: '/news' });
  assert.equal(targetFor('haus.fund'), null);
  assert.equal(targetFor(undefined), null);
});

test('news.haus.fund/ redirects to /news', async () => {
  const log = [];
  const res = await handler(new Request('https://news.haus.fund/'), ctx(log));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/news');
  assert.deepEqual(log, []);
});

test('news.haus.fund/homeroom passes through', async () => {
  const log = [];
  await handler(new Request('https://news.haus.fund/homeroom'), ctx(log));
  assert.deepEqual(log, ['next']);
});

test('cores.haus.fund/ rewrites to the tool page', async () => {
  const log = [];
  await handler(new Request('https://cores.haus.fund/'), ctx(log));
  assert.deepEqual(log, ['rewrite /cores.html']);
});

test('any other host falls through to the homepage', async () => {
  const log = [];
  await handler(new Request('https://haus-news.netlify.app/'), ctx(log));
  assert.deepEqual(log, ['next']);
});
