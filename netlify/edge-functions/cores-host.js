// Serves each subdomain's own front page at "/".
//
// WHY AN EDGE FUNCTION: the subdomains are domain aliases of the same Netlify
// project, so every hostname resolves to the same publish directory. Without
// this, cores.haus.fund/ would serve the old marketing homepage. Netlify's
// _redirects file cannot branch on the Host header — only on path — so the host
// check has to happen here.
//
// Two kinds of entry:
//   "/cores.html"            rewrite: serve that file at "/", URL unchanged.
//   { redirect: "/news" }    redirect: send "/" to that path (302).
//
// Everything except "/" is left alone, so cores.js, visa.js, /news/*,
// /homeroom/*, the fonts and the shared assets resolve normally on every
// hostname.
//
// Adding another subdomain means adding a line to HOSTS and adding the
// hostname as a domain alias in the Netlify project — nothing more.

const HOSTS = {
  "cores.haus.fund": "/cores.html",
  "visa.haus.fund": "/visa.html",
  // /news and /homeroom moved here when haus.fund became the Lovable app.
  "news.haus.fund": { redirect: "/news" },
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

    if (typeof target === "object") {
      return new Response(null, {
        status: 302,
        headers: { Location: target.redirect, "Cache-Control": "no-store" },
      });
    }

    url.pathname = target;
    return await context.nextRequest(new Request(url, request));
  } catch (err) {
    console.error("cores-host: falling through to the default route", err);
    return await context.next();
  }
};
