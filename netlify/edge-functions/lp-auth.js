// HTTP Basic Auth for the LP section.
//
// Runs at Netlify's edge BEFORE any file in /lp is served, so the protected
// pages are never sent to an unauthenticated client. This is real server-side
// protection — unlike a JavaScript password prompt, the content cannot be
// recovered by viewing source, disabling JS, or fetching the URL directly.
//
// The password lives in the LP_PASSWORD environment variable (Netlify UI →
// Site configuration → Environment variables). It is never stored in this repo.
//
// Fails CLOSED: if LP_PASSWORD is unset, the section serves 503 rather than
// falling open to the public.

const REALM = "Haus LP";

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

// Constant-time-ish comparison so the response time does not reveal how much
// of the password matched. Length is still observable; acceptable for Basic auth.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (request, context) => {
  const expectedUser = Deno.env.get("LP_USER") || "lp";
  const expectedPass = Deno.env.get("LP_PASSWORD");

  if (!expectedPass) {
    return new Response(
      "The LP section is not configured yet. Set the LP_PASSWORD environment variable in Netlify.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized();

  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const split = decoded.indexOf(":");
  if (split < 0) return unauthorized();

  const user = decoded.slice(0, split);
  const pass = decoded.slice(split + 1);

  // Evaluate both so a wrong username and a wrong password cost the same.
  const okUser = safeEqual(user, expectedUser);
  const okPass = safeEqual(pass, expectedPass);
  if (!okUser || !okPass) return unauthorized();

  const response = await context.next();
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
};
