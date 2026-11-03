// Serves each tool subdomain at its own root.
//
// WHY AN EDGE FUNCTION: the tool subdomains are domain aliases of the Netlify
// project that deploys this repo, so every hostname resolves to the same
// publish directory. Without this, cores.haus.fund/ would serve the marketing
// homepage. Netlify's _redirects file cannot branch on the Host header — only
// on path — so the host check has to happen here.
//
// Everything except "/" is left alone, so cores.js, visa.js, visa-data.js, the
// facility JSON, the fonts and the shared assets all resolve normally on every
// hostname.
//
// Two kinds of target:
//   - a static page (cores.html, visa.html, skilltree.html);
//   - a server-rendered app mounted at a path prefix (/news, /homeroom). Only
//     "/" is rewritten. The app renders its own links with the prefix, so the
//     second request is news.haus.fund/news/... and the function that owns
//     /news/* answers it on any hostname.
//
// NOT HERE ON PURPOSE: /lp. The LP section is behind the lp-auth edge function,
// which is declared for /lp and /lp/*. A rewrite from "/" would reach the
// files without passing through that check.
//
// Adding another tool subdomain means adding a line to HOSTS, adding the
// hostname as a domain alias in the Netlify project, and adding a CNAME in the
// haus.fund zone — see CONNECT-GIT.md, "Subdomains".

const HOSTS = {
  "cores.haus.fund": "/cores.html",
  "visa.haus.fund": "/visa.html",
  "skilltree.haus.fund": "/skilltree.html",
  "news.haus.fund": "/news",
  "homeroom.haus.fund": "/homeroom",
};

// Pure so it can be unit-tested without the edge runtime.
export function targetFor(hostname) {
  return HOSTS[String(hostname || "").toLowerCase().replace(/^www\./, "")] || null;
}

export default async (request, context) => {
  // Fail open. This function sits in front of "/" for every hostname, so the
  // homepage depends on it not throwing. Anything unexpected here should cost
  // the subdomain its rewrite, never cost haus.fund its front page.
  try {
    const url = new URL(request.url);
    const target = targetFor(url.hostname);

    // Any other host — haus.fund, a deploy preview, the .netlify.app name —
    // falls through to the normal homepage.
    if (!target || url.pathname !== "/") return await context.next();

    url.pathname = target;
    return await context.nextRequest(new Request(url, request));
  } catch (err) {
    console.error("cores-host: falling through to the default route", err);
    return await context.next();
  }
};
