import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, html, raw, toString, normalizeUrl, displayDomain, timeAgo, formatText, plural } from '../app/util.js';

test('esc neutralises HTML metacharacters', () => {
  assert.equal(esc('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(esc("it's"), 'it&#39;s');
  assert.equal(esc(null), '');
});

test('html template escapes interpolations but not raw fragments', () => {
  const evil = '<img onerror=alert(1)>';
  assert.equal(toString(html`<p>${evil}</p>`), '<p>&lt;img onerror=alert(1)&gt;</p>');
  assert.equal(toString(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
});

test('html template flattens arrays', () => {
  assert.equal(toString(html`${[1, 2, 3].map((n) => html`<i>${n}</i>`)}`), '<i>1</i><i>2</i><i>3</i>');
});

test('normalizeUrl accepts http(s) and adds a missing scheme', () => {
  assert.equal(normalizeUrl('biorxiv.org/content/1'), 'https://biorxiv.org/content/1');
  assert.equal(normalizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(normalizeUrl('  https://example.com/x#frag '), 'https://example.com/x');
});

test('normalizeUrl rejects non-http schemes and junk', () => {
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('data:text/html,<script>'), null);
  assert.equal(normalizeUrl('ftp://example.com'), null);
  assert.equal(normalizeUrl('localhost'), null);
  assert.equal(normalizeUrl(''), null);
});

test('displayDomain strips www', () => {
  assert.equal(displayDomain('https://www.nature.com/articles/x'), 'nature.com');
  assert.equal(displayDomain('https://www2.example.co.uk/a'), 'example.co.uk');
  assert.equal(displayDomain('not a url'), '');
});

test('timeAgo picks the largest sensible unit', () => {
  const now = 1_000_000;
  assert.equal(timeAgo(now - 30, now), '30 seconds ago');
  assert.equal(timeAgo(now - 60, now), '1 minute ago');
  assert.equal(timeAgo(now - 7200, now), '2 hours ago');
  assert.equal(timeAgo(now - 86400 * 3, now), '3 days ago');
  assert.equal(timeAgo(now + 500, now), '0 seconds ago');
});

test('formatText linkifies URLs and escapes everything else', () => {
  const out = toString(formatText('see https://example.com/a and <b>this</b>'));
  assert.match(out, /<a href="https:\/\/example\.com\/a"[^>]*>https:\/\/example\.com\/a<\/a>/);
  assert.match(out, /&lt;b&gt;this&lt;\/b&gt;/);
  assert.doesNotMatch(out, /<b>this<\/b>/);
});

test('formatText breaks paragraphs on blank lines', () => {
  const out = toString(formatText('one\n\ntwo\nthree'));
  assert.equal(out, '<p>one</p><p>two<br />three</p>');
});

test('formatText cannot be used to inject an attribute', () => {
  const out = toString(formatText('https://example.com/"onmouseover="alert(1)'));
  assert.doesNotMatch(out, /onmouseover="alert/);
});

test('plural agrees with its count', () => {
  assert.equal(plural(1, 'point'), '1 point');
  assert.equal(plural(0, 'point'), '0 points');
  assert.equal(plural(2, 'comment'), '2 comments');
});
