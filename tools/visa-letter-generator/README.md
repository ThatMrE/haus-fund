# Visa Letter Generator

Self-service immigration support letters for participants in the Biopunk House
Accelerator Program. Served at **visa.haus.fund**, `noindex`, not linked from
the public nav.

Eight jurisdictions, eighteen letter types. Everything runs in the browser:
there is no server, no database and no analytics on the page, so passport
numbers and dates of birth never leave the operator's machine.

## Files

| File | What it is |
|---|---|
| `visa.html` | Page shell — layout, design-system CSS, print stylesheet |
| `visa.js` | Renderer — form, live letter, compliance panel, exports |
| `visa-data.js` | **The data layer. This is the file you edit.** |

`visa-data.js` holds the programme facts, the issuing entities, every
jurisdiction and every letter template. Adding a country or a letter type is a
data edit; `visa.js` should not need to change.

## The two rules

These are load-bearing. A change that breaks either one is a bug, however
convenient it looks.

**1. Never invent a fact.** A template may only state something the operator
typed. Anything unfilled renders as a visible `[bracketed placeholder]`, so an
incomplete letter is obviously incomplete on screen *and on paper*. These
letters make representations to a government; a template that quietly supplies
a plausible guess turns a drafting convenience into a false statement.

**2. Never promise what the route forbids.** A B-1 letter must not offer wages.
A visitor letter must not offer employment. The `checks` array on each template
enforces this, and a `stop` finding disables print, copy and download.

## The programme block is white-labelled

`PROGRAM` carries the programme name, the home city and a one-line description
— and deliberately **no cohort number and no cohort dates**:

```js
var PROGRAM = {
  name: "Biopunk House Accelerator Program",
  city: "San Francisco, California",
  summary: "a live-in accelerator for early-stage biotechnology founders, ..."
};
```

The operator supplies the dates and any cohort identifier for the participant
in front of them. That is what keeps the generator correct across cohorts
without an edit, and it is the only reliable way to stop a stale date reaching
a letter — a hardcoded cohort is wrong the moment the next one starts, and
wrong silently.

Nothing is weakened by their absence: **every compliance check reads the
operator's dates, not `PROGRAM`.** The ceilings are enforced against what is
actually on the letter.

Keep it that way. If you are tempted to put the current cohort's dates back in
as a convenience default, remember that the failure mode is a letter stating a
date the participant is not travelling on, submitted to a government.

### The 89-day cap

`MAX_COHORT_DAYS = 89` is programme policy, and it is enforced: any letter
whose dates exceed it raises a compliance warning.

89 is not arbitrary. Three separate regimes cap a stay at 90 days — US Visa
Waiver Program admission, Schengen short stays, and Japanese Temporary Visitor
status — so an 89-day cohort lets a participant complete the whole programme on
the lightest available route in all three. Raise it past 90 and all three break
at once, for every participant, silently.

> The margin is **one day**, and the arrival and departure days both count as
> days of presence. A flight moved by a day puts a participant over. That is
> what `ninetyDayMargin` warns about on every route with a 90-day ceiling, and
> it is why the Schengen check computes how much prior Schengen time a
> participant can have before the cohort no longer fits — at 89 days, one day.

Example dates in field placeholders are a fictional 6 April – 3 July 2027
window, chosen to be exactly 89 days so the placeholder models a compliant
cohort. Keep them fictional: a placeholder that matches a real cohort is a
hardcoded date by another name.

## Adding a letter type

Add an object to the `templates` array of the relevant jurisdiction:

```js
{
  id: "short-id",
  name: "What the operator sees",
  tag: "VISA CODE",
  note: "One line on who this is for.",
  fields: [
    { key: "school", label: "University", ph: "e.g. UC Berkeley", req: true },
    { key: "duties", label: "Duties (one per line)", ph: "…", multiline: true },
    { key: "paid",   label: "Paid?", type: "select", options: ["Paid", "Unpaid"] }
  ],
  build: function (f) {
    return {
      subject: "Re: line",
      addressee: ["The Consular Officer", "…"],
      blocks: [ /* see below */ ]
    };
  },
  checks: [ /* see below */ ]
}
```

**Blocks** are the letter body. Four kinds:

| Block | Renders as |
|---|---|
| `{ p: "text" }` | A paragraph. A blank line inside splits it in two. |
| `{ list: ["a", "b"] }` | A bulleted list |
| `{ h: "HEADING" }` | A section heading |
| `{ kv: [["Label", "Value"]] }` | A particulars table |

Use the shared builders rather than rewriting them: `particulars(f, extraRows)`
for the identity table, `costsBlock(f)` for the cost undertaking,
`attestation()` for the truthfulness statement, `enclosures([...])` for the
enclosure list. Wrap every operator-supplied value in `V(value, "placeholder")`
— that is rule 1 in code.

**Checks** are functions of the field object returning `null` or
`{ level, msg }`:

- `stop` — blocks export. Use it where the letter would state something the
  route does not permit, or where a ceiling is exceeded.
- `warn` — needs attention but the operator may still print a draft.
- `note` — a procedural reminder (lead times, forms to file, originals needed).

A check must never throw; the renderer catches it, but a throwing check surfaces
as a useless warning to the operator.

## Adding a jurisdiction

Write a jurisdiction object — `id`, `name`, `city`, `flag`, `node`, `blurb`,
`guidance`, `templates` — and add it to the `JURISDICTIONS` array at the bottom.
Array order is dropdown order.

The `guidance` object populates the briefing panel and is where the research
lives: `routes`, `hostDuties`, `mustInclude`, `watchOuts`, and `sources`.
Cite official sources in `sources`, not summaries of them, and re-check them
when you touch a jurisdiction — immigration rules move.

For a straightforward business-visit invitation, use the `visitorTemplate`
factory: it supplies the shared scaffolding (particulars, activities, ties,
attestation, enclosures) and takes the jurisdiction-specific paragraphs as
`clauses`. Those clauses carry the actual legal substance — they are not
boilerplate, and they are what a reviewer should read.

## Deploying

Push to `main`. Netlify builds and publishes automatically; there is no build
step for this tool.

**One-time infrastructure step:** `visa.haus.fund` must be added as a domain
alias on the Netlify project, alongside `cores.haus.fund`. Until it is, the
tool is reachable at `haus.fund/visa.html` but the subdomain will not resolve.
The rewrite itself is already wired in `netlify/edge-functions/cores-host.js`.

## Scope

This tool drafts letters. It does not give legal advice, does not choose a visa
route, and does not replace immigration counsel in the destination country.
The page says so prominently and every letter carries the same limitation in
its footer. Keep it that way.
