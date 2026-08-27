// Serves the Core Facility Finder at the root of cores.haus.fund.
//
// WHY AN EDGE FUNCTION: cores.haus.fund is a domain alias of the same Netlify
// project as haus.fund, so both hostnames resolve to the same publish
// directory. Without this, cores.haus.fund/ would serve the marketing
// homepage. Netlify's _redirects file cannot branch on the Host header — only
// on path — so the host check has to happen here.
//
// Everything except "/" is left alone, so cores.js, the facility JSON, the
// fonts and the shared assets all resolve normally on both hostnames.
//
// Adding a second tool subdomain later means adding a line to HOSTS, nothing
// more.

const HOSTS = {
  "cores.haus.fund": "/cores.html",
};

// Pure so it can be unit-tested without the edge runtime.
export function targetFor(hostname) {
  return HOSTS[String(hostname || "").toLowerCase().replace(/^www\./, "")] || null;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const target = targetFor(url.hostname);

  // Any other host — haus.fund, a deploy preview, the .netlify.app name —
  // falls through to the normal homepage.
  if (!target || url.pathname !== "/") return context.next();

  url.pathname = target;
  return context.nextRequest(new Request(url, request));
};
