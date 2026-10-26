// Renders upcoming events into /events and the homepage events strip.
//
// WHERE THE DATA COMES FROM: Airtable Fund OS is the source of truth. An event
// reaches the site only when its Publish box is ticked; the airtable-sync
// Supabase function copies the public fields (name, date, times, blurb, Luma
// link, cover image, confirmed sponsors) into Supabase, and the
// web_upcoming_events view returns them. Venue, budgets, owners and notes never
// leave Airtable.
//
// WHY AN EDGE FUNCTION: rendering on the server means search engines and link
// previews see the events, and the page works without JavaScript. The HTML
// files keep a fallback between the markers, so if Supabase is slow or down the
// page still renders (fail open, like cores-host).
//
// Markers it fills:
//   <!--EVENTS:LIST-->…<!--/EVENTS:LIST-->        every upcoming event (events.html)
//   <!--EVENTS:STRIP-->…<!--/EVENTS:STRIP-->      the next 3 (index.html)
//   <!--EVENTS:SECTION-->…<!--/EVENTS:SECTION-->  removed entirely when there are no events
//
// Needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, which Homeroom already uses.

const TIMEOUT_MS = 2500;

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Only allow http(s) links into href/src.
export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

// "2027-01-16" -> { day: "16", mon: "JAN", full: "Sat 16 Jan 2027" }. Dates are calendar dates, so format in UTC.
export function fmtDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { day: "", mon: "", full: esc(iso) };
  const opt = (o) => d.toLocaleDateString("en-US", { timeZone: "UTC", ...o });
  return {
    day: opt({ day: "numeric" }),
    mon: opt({ month: "short" }).toUpperCase(),
    full: `${opt({ weekday: "short" })} ${opt({ day: "numeric" })} ${opt({ month: "short" })} ${opt({ year: "numeric" })}`,
  };
}

export function timeLine(ev) {
  const t = [ev.start_time, ev.end_time].filter(Boolean).join(" – ");
  return [t, t && ev.time_zone ? ev.time_zone : ""].filter(Boolean).join(" ");
}

export function card(ev) {
  const d = fmtDate(ev.date);
  const luma = safeUrl(ev.luma_url);
  const img = safeUrl(ev.cover_image_url);
  const sponsors = Array.isArray(ev.sponsors) ? ev.sponsors : [];
  const spon = sponsors.length
    ? `<div class="ev-spon"><span class="mono xs">WITH</span>${sponsors
        .map((s) => {
          const logo = safeUrl(s.logo_url);
          const site = safeUrl(s.website);
          const inner = logo ? `<img src="${esc(logo)}" alt="${esc(s.name)}" loading="lazy">` : `<span>${esc(s.name)}</span>`;
          return site ? `<a href="${esc(site)}" rel="noopener" target="_blank">${inner}</a>` : inner;
        })
        .join("")}</div>`
    : "";
  const when = timeLine(ev);
  return `<article class="ev-card">
  ${img ? `<div class="ev-img"><img src="${esc(img)}" alt="" loading="lazy"></div>` : ""}
  <div class="ev-body">
    <div class="ev-date"><span class="ev-day">${esc(d.day)}</span><span class="ev-mon mono">${esc(d.mon)}</span></div>
    <div class="ev-main">
      <div class="ev-when mono xs">${esc(d.full)}${when ? ` &#183; ${esc(when)}` : ""}</div>
      <h3 class="ev-name">${esc(ev.name)}</h3>
      ${ev.blurb ? `<p class="ev-blurb">${esc(ev.blurb)}</p>` : ""}
      ${spon}
      ${luma ? `<a class="ev-rsvp" href="${esc(luma)}" rel="noopener" target="_blank">RSVP on Luma &#8594;</a>` : ""}
    </div>
  </div>
</article>`;
}

export function renderInto(html, events) {
  const has = (name) => html.includes(`<!--${name}-->`);
  const swap = (h, name, inner) =>
    h.replace(new RegExp(`<!--${name}-->[\\s\\S]*?<!--/${name}-->`), `<!--${name}-->${inner}<!--/${name}-->`);
  let out = html;
  if (!events.length) {
    out = out.replace(/<!--EVENTS:SECTION-->[\s\S]*?<!--\/EVENTS:SECTION-->/g, "");
    if (has("EVENTS:LIST")) {
      out = swap(out, "EVENTS:LIST", `<p class="ev-empty">No public events are scheduled right now. Follow <a href="https://luma.com/biopunk" rel="noopener">luma.com/biopunk</a> for new dates.</p>`);
    }
    return out;
  }
  if (has("EVENTS:LIST")) out = swap(out, "EVENTS:LIST", events.map(card).join("\n"));
  if (has("EVENTS:STRIP")) out = swap(out, "EVENTS:STRIP", events.slice(0, 3).map(card).join("\n"));
  return out;
}

async function fetchEvents() {
  const base = String(Netlify.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!base || !key) throw new Error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY not set");
  const res = await fetch(`${base}/rest/v1/web_upcoming_events?select=*&order=date.asc&limit=50`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return await res.json();
}

export default async (request, context) => {
  const res = await context.next();
  let html = null;
  try {
    if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
    html = await res.text();
    if (!html.includes("<!--EVENTS:")) return new Response(html, res);
    let events;
    try {
      events = await fetchEvents();
    } catch (err) {
      console.error("events-render: keeping fallback content", err);
      return new Response(html, res);
    }
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(renderInto(html, events), { status: res.status, headers });
  } catch (err) {
    console.error("events-render: passing the page through unchanged", err);
    return html === null ? res : new Response(html, res);
  }
};
