# Biopunk Accelerator Skill Tree

The Biopunk Founder Manual drawn as a navigable graph. **47 nodes across seven tiers ·
161 curated resource links · 33 nodes with a located video · 27 named deliverables ·
one coherent dependency graph** that takes a founder from a risk map on day one to a
company a stranger can diligence in week twelve.

**▶ Live: [haus.fund/homeroom/library/tree](https://haus.fund/homeroom/library/tree)** — inside
Homeroom, behind the roster gate, as a third tab of the Library. The same page is served standalone
at [haus.fund/skilltree](https://haus.fund/skilltree) (`noindex`, not in the site nav), which is what
Homeroom embeds.

It is a companion to [ThatMrE/biotech-skill-tree](https://github.com/ThatMrE/biotech-skill-tree),
which does the same thing for the bench. That tree teaches you to run a Gibson assembly;
this one teaches you to decide whether the assembly is worth running, who would pay for
the result, and what you have to file before you sell it.

## Where the content comes from

Nothing here is invented curriculum. The tracks, modules, summaries, outcomes, the work
and the deliverables are the **Founder Manual** in
`netlify/functions/homeroom/app/data/curriculum.js` — the taxonomy from *"Biopunk · Haus
Fund — Fall 2026 Program Design"* (v2, 1 September 2026), which itself converged seven
drafts and absorbed YC Startup School, Antler, HAX, IndieBio, Third Derivative, New Energy
Nexus and 5050/50Y, plus operating experience from HQ, DRF and Biopunk.

`build_tree.mjs` **imports that file rather than copying it**, so a wording change in the
manual reaches the tree on the next build and the two cannot drift. `validate.mjs` fails
the build if they ever do.

What the graph layer adds on top is in `scripts/graph.mjs`: dependencies, layout, the
spine, the videos, the reading, and eight nodes the manual does not carry.

## The eight added nodes

The manual is the menu live sessions are picked from — "nothing here is delivered in full
in any single cohort". A tree has to be complete even where a cohort's calendar is not, so
eight nodes were added, each traceable to something specific:

| Node | Why it exists |
| --- | --- |
| **Orientation** | A root. How to read the tree, and the instruction to pick three nodes rather than open forty-seven. |
| **Primary market research** | The TAM / persona / end-user machinery between "pick a beachhead" and "go interview people". MIT's *Disciplined Entrepreneurship* steps 1–6; the front half of the I-Corps canvas. |
| **Target product profile** | The one document a regulatory strategy is derived from, and the artefact both FDA and payers read backwards from. Absent from the manual entirely. |
| **Preclinical, IND and the clinical path** | The manual's regulatory module leans device and diagnostic. Therapeutics teams need IND-enabling work, the pre-IND meeting and the phase gates as their own node. |
| **Reimbursement, payers and market access** | Named explicitly in the I-Corps@NIH curriculum as *the* life-science addition to Lean, and the most common reason a technically superior product still fails. |
| **The AI founder stack** | Workshop 8 of the delivered S26 calendar, which the library taxonomy never absorbed. Restored. |
| **Immigration and the O-1** | The S26 flex session, and the reason this network runs a [Visa Desk](https://haus.fund/visa) at all. |
| **The showcase** | A terminal node. The programme ends in an artefact, so the tree should too. |

## The spine

The highlighted **main path** is the 90-day calendar in the order it is actually delivered:

`orientation → risk-mapping → beachhead-market-memo → company-formation →
raising-on-an-idea → customer-discovery → ip-and-spinouts → grants-and-nondilutive →
manufacturing-scaleup → regulatory-strategy → prioritization-map → fundraising-narrative →
diligence-room → scientific-communication → hiring-and-governance → demo-day →
showcase-capstone`

Everything else hangs off it: a **customers** strand (primary market research → customer
discovery → design partners → founder-led sales), a **capital** strand (raising on an idea
→ venture math → grants → diligence), the **Orrick** series through formation, IP, SAFEs
and governance, a **regulatory** strand that forks at the target product profile into
device and therapeutics routes, **team and operations** from the first hire to the pilot
plant, and **brand, network and founder life** ending at demo day.

## Nothing locks you out — explore in any order

This is a **trajectory map, not a gated game**:

- No node is ever `locked`. The data carries no gating either — `defaultStatus:
  "inProgress"` and `isUnlocked: true` on every node — and `validate.mjs` fails the build
  if one ever appears.
- Dependencies stay **guidance**. They draw the graph and populate each node's *builds on*
  / *leads to* lists so you can see where a skill sits, without blocking anything. The
  drawer says so in as many words.
- A node is **done**, **next up** (a soft suggestion once its prerequisites happen to be
  finished) or **open**. You can start at CRISPR-adjacent regulatory strategy, or the
  capstone, on day one.

## The interactive viewer

`skilltree.html` + `skilltree.js` + `skilltree-data.js`, at the repo root because
`netlify.toml` publishes `.` — no build step, no framework, no database, consistent with
every other page on this site. Three views, all filtered by the same search and chips:

- **Map** — the real dependency graph laid out from each node's `initialPosition`. A dark
  green spine, pale builds-on edges, drag to pan, scroll or pinch to zoom, and
  `+ − ⤢ ⟲` controls. Clicking a node lights its own edges brass.
- **Tracks** — the six tracks plus the spine as cards, each with its own progress bar and
  a tappable list of its nodes. The default reading order.
- **90 days** — weeks 1 to 12 with the workshops that land in each, an async pool for
  everything you work whenever, and weeks 5 and 8 shown as deliberately quiet (the retreat
  and the hackathon are the programming that week).

Clicking any node anywhere opens a drawer with the summary, the video, *after this you
should be able to*, *the work* as a numbered protocol, the deliverable, clickable
**builds on** / **leads to** pills, and the reading. Deep links work: `/skilltree#customer-discovery`.

**Progress**, served standalone, is per-node in `localStorage` under
`haus.skilltree.progress`: it survives a reload and never leaves the browser. It is a
convenience, not the record — the record is the deliverable you log against the module in
Homeroom, and every node links straight to its form. Inside Homeroom the tree shows that
record directly instead; see the table below.

**Videos are lazy.** Thirty-three YouTube embeds would mean thirty-three third-party
connections on a page most people read two nodes of, so each video is a poster button that
swaps itself for a `youtube-nocookie` iframe on click.

**`?embed=1`** is the contract with Homeroom: it hides the page's own nav, hero and footer,
retargets site links to `_top`, and switches progress to Homeroom's — see below.

## How resources were chosen

161 links, 3–5 per node, on one rule: **the canonical primary source first** — the
regulator, the office, the standard-setter — then the best practitioner treatment, then one
thing specific to biology. No SEO pages and no summaries of summaries.

In practice that means USPTO for provisional filings, IRS for the 83(b), FDA for the
Q-Submission programme, IND and TPP guidance, CMS and AMA for coverage and coding,
CDC/NIH's BMBL and the NIH Guidelines for biosafety, NIH SEED, SBIR.gov, SAM.gov and eRA
Commons for non-dilutive capital, USCIS for the O-1A, Orrick Tech Studio and Cooley GO for
the forms (Orrick delivers the programme's legal series), Y Combinator's SAFE and Startup
Library, MIT's *Disciplined Entrepreneurship*, Strategyzer's canvases, NREL and DOE for
techno-economic method, and LifeSciVC, *Nature Biotechnology*, a16z Bio + Health and
Nucleate for the biotech-specific reading.

Where a node also has a site-relative link — `/cores`, `/visa`, `/mentors`, `/homeroom` —
it is because this network already runs the tool that node tells you to use.

## Videos

33 of 47 nodes carry a video. Sources include Y Combinator Startup School (Michael Seibel,
Gustaf Alströmer, Kirsty Nathoo, Kevin Hale, Pete Koomen), Stanford eCorner (Noam
Wasserman on *The Founder's Dilemmas*), Steve Blank on lean and customer development, Bill
Aulet on *Disciplined Entrepreneurship*, NIH SEED on SBIR, an FDA pre-submission panel,
a16z Bio + Health on what bio investors screen for, Nucleate (George Church), SOSV/IndieBio
demo day, Alan Alda on communicating science, Strategyzer on the Business Model Canvas, and
April Dunford on positioning.

The remaining 14 nodes carry **no** video on purpose. Where there is no specific video from
a source worth citing — technoeconomics, biosafety, tech transfer to a CDMO, press — the
field stays empty and the node leans on its reading, rather than linking something
unvetted. `validate.mjs` enforces the URL shape and rejects a video reused across two
nodes.

## Regenerating

Pure Node, no dependencies, no install:

```bash
node tools/biopunk-skill-tree/scripts/build_tree.mjs   # rewrite every generated file
node tools/biopunk-skill-tree/scripts/validate.mjs     # integrity checks
```

Edit the **manual** (`netlify/functions/homeroom/app/data/curriculum.js`) to change what a
module says, or **`scripts/graph.mjs`** to change the graph, the layout, the videos or the
reading. Then re-run both. The generated files are committed because the site is static —
what is in the repo is what is served.

`validate.mjs` fails on: an unresolved dependency, a dependency cycle, any locked node, a
main-path entry that is not a node, a malformed or duplicated video URL, a node with no
resources or a resource with no usable URL, an empty track, and — the important one —
generated output that disagrees with the manual.

## Files

```
skilltree.html                              the page (embedded CSS, like every page here)
skilltree.js                                the renderer: map, tracks, calendar, drawer
skilltree-data.js                           GENERATED — the browser data layer

tools/biopunk-skill-tree/
├── README.md                               this file
├── scripts/graph.mjs                       THE FILE YOU EDIT — graph, videos, reading
├── scripts/build_tree.mjs                  generator
├── scripts/validate.mjs                    integrity checks
└── data/
    ├── tree.json                           GENERATED — the node graph
    └── skill_nodes/<id>.json               GENERATED — one rich file per node
```

`data/` mirrors the shape used by
[ThatMrE/biotech-skill-tree](https://github.com/ThatMrE/biotech-skill-tree)
(`treeId, id, title{name,level}, overview{...}, steps{...}, submission, video,
resources[]`, plus a `TreeDescriptor` with `initialPosition` and `dependencies`), so a node
from either tree can be read by the same code.

## Where it lives, and the two modes

Its home is Homeroom: `/homeroom/library/tree`, a third tab of the Library next to the
manual and your deliverables, behind the same roster gate as the curriculum it draws.
Homeroom does not reimplement it — it embeds `/skilltree.html?embed=1` in an iframe, the
same way `/homeroom/labs/cores` embeds the Core Facility Finder.

That gives the page two modes, and the difference is progress:

| | Standalone `/skilltree` | Embedded `/homeroom/library/tree` |
| --- | --- | --- |
| Chrome | Its own nav, hero and footer | Homeroom's, and it hides its own |
| Progress | `localStorage`, per browser | The member's real progress, from `/homeroom/api/library` |
| Marking done | A button, kept locally | **Not possible** — a node is done when the deliverable is logged against its module, and there is one form for that |
| Site links | Normal | `target="_top"`, so they break out of the iframe |

Embedded mode is the one that matters. A tree that kept its own idea of "done" next to
Homeroom's would be a second, weaker truth about the same thing; instead it shows
Homeroom's answer and sends you to the module's form to change it. If that call fails —
signed out, offline, a 401 — it falls back to `localStorage` and says nothing.

The standalone page stays `noindex` and off the public nav, like `/cores` and `/visa`:
a real URL you can send to a resident, not something we ask search engines to index.
Opening it up is the `robots` meta tag in `skilltree.html` plus an entry in `sitemap.xml`.
