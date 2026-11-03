// node --test netlify/edge-functions/*.test.js
//
// Exercises the pure host map. The handler itself needs the edge runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { targetFor } from "./cores-host.js";

test("every tool subdomain rewrites to its own root", () => {
  assert.equal(targetFor("cores.haus.fund"), "/cores.html");
  assert.equal(targetFor("visa.haus.fund"), "/visa.html");
  assert.equal(targetFor("skilltree.haus.fund"), "/skilltree.html");
  assert.equal(targetFor("news.haus.fund"), "/news");
  assert.equal(targetFor("homeroom.haus.fund"), "/homeroom");
});

test("case and a www prefix do not matter", () => {
  assert.equal(targetFor("Cores.Haus.Fund"), "/cores.html");
  assert.equal(targetFor("www.visa.haus.fund"), "/visa.html");
});

test("every other host falls through to the homepage", () => {
  assert.equal(targetFor("haus.fund"), null);
  assert.equal(targetFor("www.haus.fund"), null);
  assert.equal(targetFor("haus-fund.netlify.app"), null);
  assert.equal(targetFor("deploy-preview-1--haus-fund.netlify.app"), null);
  assert.equal(targetFor("fightclub.haus.fund"), null);
  assert.equal(targetFor("lp.haus.fund"), null);
  assert.equal(targetFor(""), null);
  assert.equal(targetFor(undefined), null);
});
