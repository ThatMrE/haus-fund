---
name: core-facility-finder
description: Find research core facilities anywhere in the world by the technique you need — single-cell RNA-seq, cryo-EM, mass spectrometry, high-throughput screening, synchrotron beamtime — then send a properly written enquiry in one step. Use when someone needs instrument time, a service provider, or a shared research facility, or asks who can run an assay they cannot run themselves.
user-invocable: true
---

# Core Facility Finder

Founders and academics burn weeks discovering that the instrument they need is
already sitting, paid for, twenty minutes away. This skill searches a curated
directory of 240 core facilities across 43 countries and drafts the enquiry for
you.

## Commands

```bash
python3 scripts/cores.py search "single-cell RNA-seq" --state "New York" --email-only
python3 scripts/cores.py show f91c45
python3 scripts/cores.py draft f91c45 --query "single-cell RNA-seq" --contact 4
python3 scripts/cores.py export "mass spectrometry" --format csv -o cores.csv
python3 scripts/cores.py verify --all --limit 40
python3 scripts/cores.py stats
python3 scripts/cores.py techniques
```

Standard library only — no install step, no dependencies.

### search

Filters: `--state` (also `--region`; matches state, province, canton or city),
`--country`, `--continent` (also `--group`), `--access` (`open`, `academic`,
`both`, `commercial`), `--email-only`, `--limit`, `--json`.

`--continent` also accepts the cross-cutting groupings **Latin America** and
**Middle East**, because the geographic answer is the unhelpful one: Mexico is
in North America, but nobody searching Latin America means to exclude it.

Queries run through a synonym table, so `scRNA-seq`, `10x`, `single cell` and
`single-cell RNA sequencing` all land on the same canonical technique. Run
`techniques` to see the full vocabulary and how many facilities offer each.

### show

Full record for one facility: location, techniques, access model, notes, and
its numbered contact channels. The numbers are what `draft --contact N` takes.

### draft

Writes a complete enquiry — subject line and body — and prints a `mailto:` link
that opens a pre-filled message. Add `--open` to launch it. Useful flags:
`--project`, `--timeline`, `--sender`, `--org`, `--salutation`.

If the facility has no harvested address, `draft` still writes the message and
points at the contact form to paste it into.

### verify

Fetches each facility's own page and extracts the addresses published there,
into `data/contacts.json` with the date and the URL it came from. This is the
only way an address enters the dataset — see below.

Be considerate: it hits live institutional sites. `--limit` defaults to 25.

## How to use this well

1. Start broad — `search "cryo-EM"` — then narrow by geography, not the reverse.
   Facilities describe themselves inconsistently, so a wide net finds more.
2. Prefer `--access open` for expensive instrument time. National facilities
   (synchrotrons, cryo-EM centres, DOE user facilities) are usually free at the
   point of use for non-proprietary work, in exchange for a short proposal.
   That is often a better first call than a paid commercial provider.
3. Read the `notes` field before writing. It says whether a facility takes
   external work at all, which is the question that kills most enquiries.
4. Fill in `--project` properly. A one-line "do you do scRNA-seq?" gets ignored;
   sample type, count and scale gets a quote.

## What this data is and is not

`data/core-facilities.json` is hand-curated from public institutional pages. It
is a well-researched starting point, **not a verified registry**: facility
names, scopes and URLs change, and some entries will be stale. Treat every
record as a lead to confirm, and check the facility's own page before quoting
lead times or prices.

Contact addresses are deliberately **not** hand-entered. They are harvested by
`verify` from the facility's own page, stored with a `checked` date and the
source URL, and preferred generic over personal. A facility that has not been
verified shows only its web page. If an address is in this dataset, a machine
read it off that institution's site on a recorded date — nobody guessed it.

Corrections and additions go in `scripts/build_dataset.py`, then rerun
`python3 scripts/build_dataset.py`.
