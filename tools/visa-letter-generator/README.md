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

## Updating for a new cohort

Edit `PROGRAM` at the top of `visa-data.js`:

```js
var PROGRAM = {
  name: "Biopunk House Accelerator Program",
  cohort: "Cohort 3",
  start: "September 15, 2026",
  end:   "December 12, 2026",
  ...
};
```

`PROGRAM.days` is **derived** from those dates a few lines below — do not
hand-write it. Every day-count ceiling (the 90-day visa-waiver cap, the 90-day
Schengen cap, the 90-day Japanese Temporary Visitor cap, the 180-day Mexican
visitor cap) and every piece of guidance prose reads from it, so changing the
cohort dates updates all of them at once.

### The 89-day cap

`MAX_COHORT_DAYS = 89` is programme policy, and it is enforced: change
`PROGRAM` so a cohort runs longer and the tool logs an error to the console,
and any letter whose dates exceed it raises a compliance warning.

89 is not arbitrary. Three separate regimes cap a stay at 90 days — US Visa
Waiver Program admission, Schengen short stays, and Japanese Temporary Visitor
status — so an 89-day cohort lets a participant complete the whole programme on
the lightest available route in all three. Raise it past 90 and all three break
at once, for every participant, silently.

> The margin is **one day**, and the arrival and departure days both count as
> days of presence. A flight moved by a day puts a participant over. That is
> what `ninetyDayMargin` warns about on every route with a 90-day ceiling, and
> it is why the Schengen check now computes how much prior Schengen time a
> participant can have before the cohort no longer fits — at 89 days, the
> answer is one day.

Cohort dates are also published on `index.html`, `sponsors.html` and
`femhaus.html`. Keep them in step: a letter whose dates contradict the public
programme page is a discrepancy an adjudicator can find.

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
