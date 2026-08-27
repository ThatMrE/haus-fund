#!/usr/bin/env python3
"""cores -- find research core facilities worldwide and contact them in one step.

    cores.py search "single-cell RNA-seq" --state "New York" --email-only
    cores.py show f91c45
    cores.py draft f91c45 --query "single-cell RNA-seq" --contact 4
    cores.py export "mass spectrometry" --format csv -o cores.csv
    cores.py verify --all --limit 40

Standard library only. Facility metadata lives in data/core-facilities.json;
contact channels harvested by `verify` live in data/contacts.json.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import os
import pathlib
import re
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "core-facilities.json"
CONTACTS = ROOT / "data" / "contacts.json"

# ── terminal helpers ──────────────────────────────────────────────────────
_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


bold = lambda s: c(s, "1")
dim = lambda s: c(s, "2")
green = lambda s: c(s, "32")
amber = lambda s: c(s, "33")


def die(msg: str) -> "NoReturn":  # noqa: F821
    print(f"cores: {msg}", file=sys.stderr)
    raise SystemExit(1)


# ── data loading ──────────────────────────────────────────────────────────
def load_data() -> dict:
    if not DATA.exists():
        die(f"{DATA} missing -- run: python3 scripts/build_dataset.py")
    return json.loads(DATA.read_text(encoding="utf-8"))


def load_contacts() -> dict:
    if not CONTACTS.exists():
        return {"schema": 1, "contacts": {}}
    return json.loads(CONTACTS.read_text(encoding="utf-8"))


def save_contacts(payload: dict) -> None:
    CONTACTS.parent.mkdir(parents=True, exist_ok=True)
    CONTACTS.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n",
                        encoding="utf-8")


def channels_for(fac: dict, contacts: dict) -> list[dict]:
    """Ordered contact channels for a facility.

    Harvested email addresses come first (they are what makes contact one
    click), then the facility's own page as the always-available fallback.
    """
    entry = contacts.get("contacts", {}).get(fac["id"], {})
    out = list(entry.get("channels", []))
    if not any(ch["kind"] == "page" and ch["value"] == fac["url"] for ch in out):
        out.append({"kind": "page", "label": "facility page", "value": fac["url"]})
    return out


def emails_of(fac: dict, contacts: dict) -> list[str]:
    return [ch["value"] for ch in channels_for(fac, contacts) if ch["kind"] == "email"]


# ── search ────────────────────────────────────────────────────────────────
def normalise(term: str, synonyms: dict) -> str:
    t = term.strip().lower()
    return synonyms.get(t, term.strip())


def expand_query(query: str, synonyms: dict) -> list[str]:
    """Query -> canonical terms. The whole string is tried first so a phrase
    like "single cell rna sequencing" maps cleanly, then each token."""
    terms, q = [], query.strip().lower()
    if not q:
        return terms
    if q in synonyms:
        terms.append(synonyms[q])
    terms.append(query.strip())
    for tok in re.split(r"[,;/]+|\s{2,}", q):
        tok = tok.strip()
        if tok and tok != q:
            terms.append(normalise(tok, synonyms))
    seen, out = set(), []
    for t in terms:
        k = t.lower()
        if k not in seen:
            seen.add(k)
            out.append(t)
    return out


def score(fac: dict, terms: list[str], has_email: bool) -> int:
    if not terms:
        return 1
    techs = [t.lower() for t in fac["techniques"]]
    haystack_name = f"{fac['facility']} {fac['institution']}".lower()
    haystack_all = f"{haystack_name} {fac['notes']} {' '.join(techs)}".lower()
    total = 0
    for term in terms:
        t = term.lower()
        if t in techs:
            total += 10
        elif any(t in tech or tech in t for tech in techs):
            total += 6
        elif t in haystack_name:
            total += 4
        elif t in haystack_all:
            total += 2
    if total and has_email:
        total += 2          # a facility you can actually email ranks higher
    return total


def region_match(fac: dict, want: str) -> bool:
    w = want.strip().lower()
    return w in (fac["region"] or "").lower() or w == (fac["city"] or "").lower()


def run_search(args, data, contacts) -> list[tuple[int, dict]]:
    terms = expand_query(args.query or "", data["synonyms"])
    hits = []
    for fac in data["facilities"]:
        if args.country and args.country.strip().lower() not in fac["country"].lower():
            continue
        if args.state and not region_match(fac, args.state):
            continue
        if args.continent and args.continent.strip().lower() not in fac["continent"].lower():
            continue
        if args.access and fac["access"] != args.access:
            continue
        mails = emails_of(fac, contacts)
        if args.email_only and not mails:
            continue
        s = score(fac, terms, bool(mails))
        if s:
            hits.append((s, fac))
    hits.sort(key=lambda p: (-p[0], p[1]["institution"], p[1]["facility"]))
    return hits


def fmt_row(rank: int, s: int, fac: dict, contacts: dict) -> str:
    mails = emails_of(fac, contacts)
    flag = green("email") if mails else dim("page only")
    loc = ", ".join(x for x in [fac["city"], fac["region"], fac["country"]] if x)
    return (f"{dim(f'{rank:>3}.')} {bold(fac['id'])}  {fac['facility']}\n"
            f"     {dim(fac['institution'])} - {loc}\n"
            f"     {dim('·')} {', '.join(fac['techniques'][:6])}\n"
            f"     {flag} {dim('·')} access: {fac['access']} {dim('·')} score {s}")


def cmd_search(args):
    data, contacts = load_data(), load_contacts()
    hits = run_search(args, data, contacts)
    if args.json:
        print(json.dumps([{"score": s, **f} for s, f in hits[: args.limit]], indent=1))
        return
    if not hits:
        if args.email_only:
            args.email_only = False
            n = len(run_search(args, data, contacts))
            if n:
                print(f"{n} facilities match, but none has a harvested address yet.\n"
                      f"Run `cores.py verify --all --limit 40` to pull addresses from "
                      f"their own pages, then try again.")
                return
        print("No facilities matched. Try `cores.py techniques` for the vocabulary.")
        return
    print(f"\n{bold(str(len(hits)))} facilities match "
          f"{bold(repr(args.query))}"
          + (f" in {args.state}" if args.state else "")
          + (f" ({args.country})" if args.country else "")
          + (" with a harvested email" if args.email_only else "") + "\n")
    for i, (s, fac) in enumerate(hits[: args.limit], 1):
        print(fmt_row(i, s, fac, contacts))
        print()
    if len(hits) > args.limit:
        print(dim(f"... {len(hits) - args.limit} more. Raise --limit to see them.\n"))
    print(dim("Next: cores.py show <id>  ·  cores.py draft <id> --query "
              f"{args.query!r}\n"))


# ── show ──────────────────────────────────────────────────────────────────
def find(data, fid: str) -> dict:
    fid = fid.strip().lower()
    exact = [f for f in data["facilities"] if f["id"] == fid]
    if exact:
        return exact[0]
    partial = [f for f in data["facilities"] if f["id"].startswith(fid)]
    if len(partial) == 1:
        return partial[0]
    if len(partial) > 1:
        die(f"id {fid!r} is ambiguous: {', '.join(f['id'] for f in partial)}")
    die(f"no facility with id {fid!r}")


def cmd_show(args):
    data, contacts = load_data(), load_contacts()
    fac = find(data, args.id)
    entry = contacts.get("contacts", {}).get(fac["id"], {})
    w = textwrap.TextWrapper(width=76, initial_indent="    ", subsequent_indent="    ")
    print()
    print(bold(fac["facility"]))
    print(dim(f"{fac['id']}  ·  {fac['institution']}"))
    print()
    print(f"  Location   {fac['city']}, {fac['region'] or '-'} ({fac['region_label']}), "
          f"{fac['country']} · {fac['continent']}")
    print(f"  Access     {fac['access']}")
    print(f"  Page       {fac['url']}")
    print()
    print("  Techniques")
    for t in fac["techniques"]:
        print(f"    - {t}")
    print()
    print("  Notes")
    print(w.fill(fac["notes"]))
    print()
    print("  Contact channels")
    for i, ch in enumerate(channels_for(fac, contacts), 1):
        label = ch.get("label") or ch["kind"]
        print(f"    [{i}] {ch['kind']:<6} {ch['value']}  {dim(label)}")
    if entry.get("checked"):
        print(dim(f"\n  Channels harvested {entry['checked']} from {entry.get('source', fac['url'])}"))
    else:
        print(amber("\n  Not yet verified — only the facility page is known. "
                    "Run: cores.py verify " + fac["id"]))
    print(dim(f"\n  Draft an enquiry: cores.py draft {fac['id']} --query \"<technique>\"\n"))


# ── draft ─────────────────────────────────────────────────────────────────
TEMPLATE = """\
Dear {salutation},

I am looking for {query} capacity and found the {facility} at {institution}.

Brief summary of the work:
{project}

What I would like to know:
  1. Do you take external {access_phrase}, and what is the current lead time?
  2. What sample input and format do you need, and at what scale?
  3. What does a project of this size typically cost, and how is it invoiced?
  4. Is any of the analysis included, or is that a separate arrangement?

{timeline_line}Happy to send a fuller protocol or jump on a call, whichever is easier.

Thank you,
{sender}{org_line}
"""


def build_draft(fac: dict, args) -> tuple[str, str]:
    access_phrase = {
        "open": "proposals from groups outside your institution",
        "academic": "academic users from other institutions",
        "both": "academic and commercial projects",
        "commercial": "new commercial clients",
    }[fac["access"]]
    subject = f"{args.query or 'Core facility'} enquiry — external project"
    body = TEMPLATE.format(
        salutation=args.salutation or f"{fac['facility']} team",
        query=args.query or "core facility",
        facility=fac["facility"],
        institution=fac["institution"],
        project=textwrap.fill(args.project, 74) if args.project
                else "  [one or two sentences on the samples, the question and the scale]",
        access_phrase=access_phrase,
        timeline_line=(f"Timeline: {args.timeline}\n\n" if args.timeline else ""),
        sender=args.sender or "[your name]",
        org_line=f"\n{args.org}" if args.org else "",
    )
    return subject, body


def mailto(to: str, subject: str, body: str) -> str:
    q = urllib.parse.urlencode({"subject": subject, "body": body},
                               quote_via=urllib.parse.quote)
    return f"mailto:{to}?{q}"


def cmd_draft(args):
    data, contacts = load_data(), load_contacts()
    fac = find(data, args.id)
    chans = channels_for(fac, contacts)
    if args.contact < 1 or args.contact > len(chans):
        print(f"cores: --contact {args.contact} is out of range; "
              f"{fac['id']} has {len(chans)} channel(s):", file=sys.stderr)
        for i, ch in enumerate(chans, 1):
            print(f"  [{i}] {ch['kind']:<6} {ch['value']}", file=sys.stderr)
        if not any(ch["kind"] == "email" for ch in chans):
            print("\nRun `cores.py verify " + fac["id"] + "` to harvest addresses "
                  "from the facility page first.", file=sys.stderr)
        raise SystemExit(1)
    chan = chans[args.contact - 1]
    subject, body = build_draft(fac, args)

    print()
    print(bold(f"{fac['facility']} — {fac['institution']}"))
    print(dim(f"channel [{args.contact}] {chan['kind']}: {chan['value']}"))
    print()
    print(f"{bold('Subject:')} {subject}")
    print()
    print(body)
    if chan["kind"] == "email":
        link = mailto(chan["value"], subject, body)
        print(dim("One-click:"))
        print(link)
        if args.open:
            import webbrowser
            webbrowser.open(link)
    else:
        print(amber("No verified address for this facility — the draft above is "
                    "ready to paste into their contact form:"))
        print(chan["value"])
        if args.open:
            import webbrowser
            webbrowser.open(chan["value"])
    print()


# ── export ────────────────────────────────────────────────────────────────
def cmd_export(args):
    data, contacts = load_data(), load_contacts()
    hits = run_search(args, data, contacts)
    rows = []
    for s, fac in hits[: args.limit]:
        mails = emails_of(fac, contacts)
        rows.append({
            "id": fac["id"], "facility": fac["facility"],
            "institution": fac["institution"], "city": fac["city"],
            "region": fac["region"], "country": fac["country"],
            "continent": fac["continent"], "access": fac["access"],
            "techniques": "; ".join(fac["techniques"]),
            "email": mails[0] if mails else "",
            "all_emails": "; ".join(mails), "url": fac["url"],
            "notes": fac["notes"], "score": s,
        })

    if args.format == "json":
        text = json.dumps(rows, indent=1, ensure_ascii=False) + "\n"
    elif args.format == "md":
        cols = ["id", "facility", "institution", "city", "country", "email", "url"]
        lines = ["| " + " | ".join(cols) + " |",
                 "|" + "|".join("---" for _ in cols) + "|"]
        for r in rows:
            lines.append("| " + " | ".join(str(r[k]).replace("|", "\\|") for k in cols) + " |")
        text = "\n".join(lines) + "\n"
    else:
        import io
        buf = io.StringIO()
        wcsv = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["id"])
        wcsv.writeheader()
        wcsv.writerows(rows)
        text = buf.getvalue()

    if args.output:
        pathlib.Path(args.output).write_text(text, encoding="utf-8")
        print(f"wrote {args.output}: {len(rows)} facilities ({args.format})")
    else:
        sys.stdout.write(text)


# ── verify ────────────────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Addresses that are never the facility's own contact route.
EMAIL_REJECT = re.compile(
    r"(webmaster|postmaster|noreply|no-reply|donotreply|privacy|cookie|abuse|"
    r"@example\.|@sentry\.|@\d|\.png$|\.jpg$|\.gif$|\.svg$|\.webp$|\.css$|\.js$)", re.I)


def harvest(url: str, timeout: float) -> tuple[int | None, list[str], str | None]:
    """Fetch a page and pull published email addresses out of it.

    Deliberately conservative: mailto: hrefs are trusted, bare text addresses
    are accepted only when their domain matches the page's own domain, so a
    third-party address in a footer is not attributed to the facility.
    """
    req = urllib.request.Request(url, headers={
        "User-Agent": "core-facility-finder/1.0 (+contact-discovery; respects robots)",
        "Accept": "text/html,application/xhtml+xml",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read(1_500_000)
            charset = resp.headers.get_content_charset() or "utf-8"
            page = raw.decode(charset, errors="replace")
            final_url = resp.geturl()
    except urllib.error.HTTPError as e:
        return e.code, [], None
    except Exception:
        return None, [], None

    host = urllib.parse.urlparse(final_url).netloc.lower().removeprefix("www.")
    base_domain = ".".join(host.split(".")[-3:]) if host.count(".") > 1 else host

    found, seen = [], set()
    for m in re.finditer(r'mailto:([^"\'>?\s]+)', page, re.I):
        addr = html.unescape(m.group(1)).strip().rstrip(".,;")
        if EMAIL_RE.fullmatch(addr) and not EMAIL_REJECT.search(addr):
            if addr.lower() not in seen:
                seen.add(addr.lower())
                found.append(addr)
    for m in EMAIL_RE.finditer(re.sub(r"<[^>]+>", " ", page)):
        addr = m.group(0).strip().rstrip(".,;")
        if EMAIL_REJECT.search(addr):
            continue
        if not addr.lower().endswith(base_domain):
            continue                      # not this institution's own address
        if addr.lower() not in seen:
            seen.add(addr.lower())
            found.append(addr)
    return status, found[:8], final_url


def rank_emails(emails: list[str]) -> list[str]:
    """Generic inboxes before named individuals -- a shared address is the
    right first contact and does not put a person's name in a shared file."""
    generic = ("info", "contact", "core", "facility", "genomics", "sequencing",
               "proteomics", "imaging", "cryoem", "cryo-em", "enquiries",
               "enquiry", "inquiries", "service", "services", "admin", "help",
               "support", "office", "bookings", "scheduling")
    return sorted(emails, key=lambda e: (not e.split("@")[0].lower().startswith(generic), e))


def cmd_verify(args):
    data = load_data()
    store = load_contacts()
    store.setdefault("contacts", {})
    if args.ids:
        targets = [find(data, i) for i in args.ids]
    elif args.all:
        targets = data["facilities"]
        if not args.refresh:
            # Retry anything that has no address yet, including earlier failures.
            targets = [f for f in targets
                       if not any(ch["kind"] == "email" for ch in
                                  store["contacts"].get(f["id"], {}).get("channels", []))]
    else:
        die("give one or more ids, or --all")
    targets = targets[: args.limit]
    if not targets:
        print("Nothing to verify. Use --refresh to re-check already-verified entries.")
        return

    today = dt.date.today().isoformat()
    ok = 0
    print(f"Verifying {len(targets)} facility page(s). This hits live sites — be "
          f"considerate with --limit.\n")
    for fac in targets:
        status, emails, final = harvest(fac["url"], args.timeout)
        emails = rank_emails(emails)
        channels = [{"kind": "email", "label": "published on facility page", "value": e}
                    for e in emails]
        channels.append({"kind": "page", "label": "facility page", "value": fac["url"]})
        store["contacts"][fac["id"]] = {
            "checked": today,
            "url_status": status,
            "source": final or fac["url"],
            "channels": channels,
        }
        mark = green("ok ") if emails else (amber("---") if status == 200 else c("!!!", "31"))
        print(f"  {mark} {fac['id']}  {fac['facility'][:44]:<44} "
              f"{str(status or 'error'):>5}  {len(emails)} address(es)")
        if emails:
            ok += 1
    save_contacts(store)
    print(f"\n{ok}/{len(targets)} facilities now have at least one address. "
          f"Written to {CONTACTS.relative_to(ROOT)}")


# ── misc ──────────────────────────────────────────────────────────────────
def cmd_stats(args):
    data, contacts = load_data(), load_contacts()
    facs = data["facilities"]
    verified = sum(1 for f in facs if emails_of(f, contacts))
    by_continent: dict[str, int] = {}
    for f in facs:
        by_continent[f["continent"]] = by_continent.get(f["continent"], 0) + 1
    print()
    print(f"  {bold(str(len(facs)))} facilities · {len(data['countries'])} countries "
          f"· {len(data['techniques'])} techniques")
    print(f"  {bold(str(verified))} with a harvested contact address "
          f"({verified * 100 // max(len(facs), 1)}%)")
    print()
    for cont, n in sorted(by_continent.items(), key=lambda p: -p[1]):
        print(f"    {cont:<16} {n:>4}  {'#' * (n * 40 // len(facs))}")
    print()


def cmd_techniques(args):
    data = load_data()
    for t in data["techniques"]:
        n = sum(1 for f in data["facilities"] if t in f["techniques"])
        print(f"  {n:>4}  {t}")


def cmd_open(args):
    import webbrowser
    fac = find(load_data(), args.id)
    print(fac["url"])
    webbrowser.open(fac["url"])


# ── cli ───────────────────────────────────────────────────────────────────
def add_filters(p):
    p.add_argument("--state", "--region", dest="state", metavar="NAME",
                   help="state, province, canton or city (whatever the country uses)")
    p.add_argument("--country", metavar="NAME")
    p.add_argument("--continent", metavar="NAME")
    p.add_argument("--access", choices=["open", "academic", "both", "commercial"],
                   help="who can buy time: open proposal, academic, both, commercial")
    p.add_argument("--email-only", action="store_true",
                   help="only facilities with a harvested contact address")


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="cores.py", description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="find facilities by technique")
    s.add_argument("query")
    add_filters(s)
    s.add_argument("--limit", type=int, default=20)
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_search)

    s = sub.add_parser("show", help="full record for one facility")
    s.add_argument("id")
    s.set_defaults(func=cmd_show)

    s = sub.add_parser("draft", help="write a ready-to-send enquiry")
    s.add_argument("id")
    s.add_argument("--query", help="what you need, e.g. 'single-cell RNA-seq'")
    s.add_argument("--contact", type=int, default=1,
                   help="which contact channel to address (see `show`); default 1")
    s.add_argument("--project", help="one or two sentences about the work")
    s.add_argument("--timeline", help="e.g. 'samples ready in October'")
    s.add_argument("--sender", help="your name")
    s.add_argument("--org", help="your institution or company")
    s.add_argument("--salutation", help="override 'Dear ...'")
    s.add_argument("--open", action="store_true",
                   help="open the mailto (or contact page) in your browser")
    s.set_defaults(func=cmd_draft)

    s = sub.add_parser("export", help="write matches to csv, json or markdown")
    s.add_argument("query")
    add_filters(s)
    s.add_argument("--format", choices=["csv", "json", "md"], default="csv")
    s.add_argument("-o", "--output", metavar="FILE")
    s.add_argument("--limit", type=int, default=1000)
    s.set_defaults(func=cmd_export)

    s = sub.add_parser("verify", help="harvest contact addresses from facility pages")
    s.add_argument("ids", nargs="*")
    s.add_argument("--all", action="store_true")
    s.add_argument("--refresh", action="store_true", help="re-check verified entries too")
    s.add_argument("--limit", type=int, default=25)
    s.add_argument("--timeout", type=float, default=15.0)
    s.set_defaults(func=cmd_verify)

    s = sub.add_parser("stats", help="dataset coverage")
    s.set_defaults(func=cmd_stats)
    s = sub.add_parser("techniques", help="the technique vocabulary")
    s.set_defaults(func=cmd_techniques)
    s = sub.add_parser("open", help="open a facility page in your browser")
    s.add_argument("id")
    s.set_defaults(func=cmd_open)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except KeyboardInterrupt:
        sys.exit(130)
