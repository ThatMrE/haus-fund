// Server-side proxy for the Airtable Mentors table.
//
// WHY A PROXY: Airtable personal access tokens are scoped to a whole BASE, not
// a table. This base also holds LPs, Investments, Capital Flows, IC Reviews,
// Applications and Interview Scorecards. A token shipped to the browser would
// expose all of it. The token stays here, server-side, and this function
// returns only the mentor fields listed in PUBLIC_SHAPE below.
//
// Set AIRTABLE_TOKEN in Netlify → Site configuration → Environment variables.
// Fails closed: with no token, returns an empty list rather than an error page.

const BASE_ID = "appisCTsCCcBCMSk0";
const TABLE_ID = "tblwHSlwNLXIfXFX9";

// Only these leave the server. Add a field here to publish it — nothing else
// from the record is ever forwarded.
function PUBLIC_SHAPE(rec) {
  const f = rec.fields || {};
  const shot = Array.isArray(f["Headshot"]) ? f["Headshot"][0] : null;
  return {
    name: f["Name"] || "",
    area: f["Area of Expertise"] || "",
    bio: f["Bio"] || "",
    linkedin: f["LinkedIn"] || "",
    tags: Array.isArray(f["Tags"]) ? f["Tags"] : [],
    photo: shot ? (shot.thumbnails?.large?.url || shot.url || "") : "",
  };
}

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Short cache: mentors change rarely, but a new one should appear quickly.
      "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=600`,
    },
  });
}

export default async (request) => {
  const token = Deno.env.get("AIRTABLE_TOKEN");
  if (!token) {
    return json({ mentors: [], configured: false }, 200, 30);
  }

  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
  url.searchParams.set("pageSize", "100");
  // Only ask Airtable for the fields we publish.
  ["Name", "Area of Expertise", "Bio", "LinkedIn", "Headshot", "Tags"].forEach((f) =>
    url.searchParams.append("fields[]", f),
  );
  url.searchParams.append("sort[0][field]", "Name");
  url.searchParams.append("sort[0][direction]", "asc");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return json({ mentors: [], configured: true, error: `airtable ${res.status}` }, 200, 30);
    }
    const data = await res.json();
    const mentors = (data.records || [])
      .map(PUBLIC_SHAPE)
      .filter((m) => m.name);
    return json({ mentors, configured: true, count: mentors.length });
  } catch (_e) {
    return json({ mentors: [], configured: true, error: "fetch failed" }, 200, 30);
  }
};
