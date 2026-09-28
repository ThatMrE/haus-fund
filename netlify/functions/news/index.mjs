/**
 * haus.fund/news — the feed mounted inside the main site.
 *
 * The handler itself lives in ./serve.mjs, which the standalone deployment
 * shares. This file is the mount and nothing else.
 */
export { default } from './serve.mjs';

export const config = {
  path: ['/news', '/news/*'],
};
