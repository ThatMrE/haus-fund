/**
 * The standalone mount.
 *
 * Same app, same shim, different address: the feed owns this site's root rather
 * than sitting under /news. `build.mjs` copies this in as the function's
 * `index.mjs`, so the two deployments differ by this file alone.
 */
import handler, { configure } from './serve.mjs';

// The feed owns this site's root, and the rest of haus.fund is elsewhere.
configure({ basePath: '', staticBase: '/news-assets', siteOrigin: 'https://haus.fund' });

export default handler;

export const config = {
  path: ['/', '/*'],
  // The publish directory holds the stylesheet, the design tokens and the
  // fonts. Without these exclusions the catch-all swallows them and the page
  // renders unstyled.
  excludedPath: [
    '/news-assets/*',
    '/tokens/*',
    '/fonts.css',
    '/favicon.svg',
    '/robots.txt',
  ],
};
