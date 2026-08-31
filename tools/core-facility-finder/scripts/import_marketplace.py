#!/usr/bin/env python3
"""Map data/core-marketplace.csv onto the core-facilities schema.

Source: the "Core Marketplace" tab of the Labs workbook — 1,871 facilities
carrying RRIDs from the SciCrunch registry. Only rows with an RRID, a website
and a populated Services field are kept (832 of 1,871); the rest are real
facilities but too thinly described to search usefully. Re-export the tab and
drop it at data/core-marketplace.csv to refresh.

The Primary Contact column is deliberately absent from the committed CSV: it
is the only personal-data field, and publish = "." would serve it at haus.fund.
Contacts come from `cores.py verify` instead.

Run:  python3 scripts/import_marketplace.py
"""
import csv
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "core-marketplace.csv"
OUT = ROOT / "data" / "imported-facilities.json"

US_VARIANTS = {"united states of america", "united states", "usa", "us",
               "u.s.a.", "u.s.", "united  states"}

# Country spellings in the sheet that differ from ours.
COUNTRY_ALIASES = {
    "czech republic": "Czechia",
    "the netherlands": "Netherlands",
    "republic of korea": "South Korea",
    "korea": "South Korea",
    "uk": "United Kingdom",
    "great britain": "United Kingdom",
}

# Used two ways: to fill a blank Country, and to correct a row whose website is
# plainly national but whose Country cell says United States. Twenty rows in the
# source have a non-US ccTLD against a US country -- DKFZ in Germany, McGill in
# Canada, Macquarie in Australia. The domain is the more reliable signal.
TLD_COUNTRY = {
    "ca": "Canada", "uk": "United Kingdom", "de": "Germany", "au": "Australia",
    "mx": "Mexico", "br": "Brazil", "fr": "France", "lu": "Luxembourg",
    "pl": "Poland", "za": "South Africa", "in": "India", "cz": "Czechia",
    "se": "Sweden", "no": "Norway", "hr": "Croatia", "ch": "Switzerland",
    "nl": "Netherlands", "dk": "Denmark", "es": "Spain", "it": "Italy",
    "jp": "Japan", "cn": "China", "sg": "Singapore", "kr": "South Korea",
    "il": "Israel", "at": "Austria", "be": "Belgium", "fi": "Finland",
    "ie": "Ireland", "pt": "Portugal", "nz": "New Zealand", "gr": "Greece",
    # Administratively US-restricted, so this is registry fact rather than a
    # guess. (A handful of pre-2001 .edu registrations sit outside the US; the
    # sheet contains none of them.)
    "edu": "United States", "gov": "United States",
}

# The sheet's Services field is free text: 992 distinct strings across the 832
# rows, averaging 11 per facility. These patterns pull the ones that actually
# discriminate between facilities onto our canonical vocabulary. Generic
# entries -- "data analysis", "consultation", "training", "sample preparation"
# -- are deliberately unmapped: nearly every facility lists them, so they would
# make the technique filter useless. The raw list is kept on the record for
# free-text search regardless.
SERVICE_RULES = [
    (r"single[- ]cell|scrna|10x genomics", "single-cell RNA-seq"),
    (r"spatial (transcriptom|genomic)|visium|merfish", "spatial transcriptomics"),
    (r"\brna[- ]?seq|transcriptom|rna analysis|rna sequencing", "bulk RNA-seq"),
    (r"whole[- ]genome sequencing|\bwgs\b", "whole-genome sequencing"),
    (r"exome", "exome sequencing"),
    (r"long read|nanopore|pacbio", "long-read sequencing"),
    (r"atac", "ATAC-seq"),
    (r"chip[- ]seq|methylat|bisulfite|epigenom|cut&run|cut&tag", "epigenomics"),
    (r"metagenom|microbiom", "metagenomics"),
    (r"genotyp", "genotyping"),
    (r"genome assembl", "genome assembly"),
    (r"sequencing|\bngs\b|genomics", "sequencing"),
    (r"cryo[- ]?em|cryo[- ]electron microscop", "cryo-EM"),
    (r"cryo[- ]?et|electron tomograph", "cryo-ET"),
    (r"electron microscop|\btem\b|\bsem\b|ultramicrotom", "electron microscopy"),
    (r"super[- ]resolution|storm|palm|\bsted\b", "super-resolution microscopy"),
    (r"light[- ]sheet|lightsheet", "light-sheet microscopy"),
    (r"confocal|light microscop|optical imaging|cell imaging|fluorescence microscop|"
     r"live cell imaging|\bmicroscopy\b", "light microscopy"),
    (r"correlative", "correlative microscopy"),
    (r"histolog|histopatholog|tissue section|immunohistochem", "histology"),
    (r"cell sorting|\bfacs\b|sorter", "cell sorting"),
    (r"mass cytometry|cytof", "mass cytometry"),
    (r"flow cytometr", "flow cytometry"),
    (r"mass spectrometry|\bms/ms\b|maldi|lc-ms", "mass spectrometry"),
    (r"proteom", "proteomics"),
    (r"metabolom", "metabolomics"),
    (r"lipidom", "lipidomics"),
    (r"glycom|glycan", "glycomics"),
    (r"crystallograph", "X-ray crystallography"),
    (r"\bnmr\b|nuclear magnetic resonance", "NMR"),
    (r"\bsaxs\b|small[- ]angle", "SAXS"),
    (r"synchrotron|beamline", "synchrotron"),
    (r"micro[- ]?ct|computed tomograph|x-ray tomograph", "X-ray tomography"),
    (r"high[- ]throughput screen|\bhts\b|compound screen|drug screen", "high-throughput screening"),
    (r"crispr", "CRISPR screening"),
    (r"genome editing|gene editing", "genome editing"),
    (r"medicinal chemistry|chemical synthesis", "medicinal chemistry"),
    (r"\bdmpk\b|\badme\b|pharmacokinet", "DMPK"),
    (r"protein (expression|production|purification)|recombinant protein", "protein production"),
    (r"surface plasmon|\bspr\b", "SPR"),
    (r"biophysic|\bitc\b|thermophoresis|biolayer", "biophysics"),
    (r"bioinformatic|computational biolog", "bioinformatics"),
    (r"high[- ]performance computing|\bhpc\b", "high-performance computing"),
    (r"transgenic|knockout mouse|mouse model", "transgenic mouse models"),
    (r"animal model|vivarium|preclinical", "animal models"),
    (r"organoid", "organoids"),
    (r"\bipsc\b|induced pluripotent|stem cell", "iPSC"),
    (r"\bgmp\b|cell manufactur", "GMP cell manufacturing"),
    (r"biobank|biorepositor|specimen bank", "biobanking"),
    (r"nanofabricat|cleanroom|microfabricat", "nanofabrication"),
    (r"microfluidic", "microfluidics"),
    (r"viral vector|lentivir|\baav\b|virus production", "virus production"),
    (r"peptide synthesis", "peptide synthesis"),
    (r"oligo(nucleotide)? synthesis", "oligo synthesis"),
    (r"electrophysiolog|patch clamp", "electrophysiology"),
    (r"antibody (discovery|production|generation)|hybridoma", "antibody discovery"),
    (r"cell line (engineering|development|authentication)", "cell line engineering"),
    (r"magnetic resonance imaging|\bmri\b|\bmrs\b", "magnetic resonance imaging"),
    (r"in[- ]?vivo imaging|small animal imaging|preclinical imaging|"
     r"functional brain imaging|bioluminescence imaging", "preclinical imaging"),
    (r"\bpet\b|positron emission|\bspect\b", "PET imaging"),
    (r"radiochemistr|radioisotope|cyclotron|radiolabel", "radiochemistry"),
    (r"ultrasound|sonograph|echocardiograph", "ultrasound"),
    (r"phenotyping|behavioral (testing|analysis)|metabolic cage", "phenotyping"),
    (r"animal husbandry|vivarium|surgical service|germ[- ]free|gnotobiotic", "animal models"),
    (r"clinical trial|clinical research|clinical study", "clinical trial support"),
    (r"clinical chemistr|hematolog|clinical assessment", "clinical assays"),
    (r"3d printing|fabrication shop|machine shop|instrument (design|fabrication)",
     "fabrication"),
]
COMPILED = [(re.compile(p, re.I), t) for p, t in SERVICE_RULES]


def split_services(raw: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"[;,]", raw or "")]
    return [p for p in parts if p and len(p) > 1]


def map_techniques(services: list[str]) -> list[str]:
    out = []
    for s in services:
        for rx, tech in COMPILED:
            if rx.search(s) and tech not in out:
                out.append(tech)
    return out


def tld_of(url: str) -> str | None:
    m = re.match(r"(?:https?://)?(?:www\.)?([^/]+)", (url or "").strip(), re.I)
    if not m:
        return None
    host = m.group(1).lower().rstrip(".")
    bits = host.split(".")
    return bits[-1] if len(bits) > 1 else None


def resolve_country(stated: str, url: str) -> tuple[str, str]:
    """Returns (country, how) where how is 'sheet', 'tld' or 'unknown'."""
    v = (stated or "").strip()
    low = v.lower()
    if low == "country":          # a stray header row inside the data
        v, low = "", ""
    tld = tld_of(url)
    guess = TLD_COUNTRY.get(tld or "")
    if low in US_VARIANTS:
        # A non-US national domain outranks a US country cell.
        return (guess, "tld") if guess else ("United States", "sheet")
    if not low:
        return (guess, "tld") if guess else ("", "unknown")
    return COUNTRY_ALIASES.get(low, v), "sheet"


def clean_url(u: str) -> str:
    u = (u or "").strip()
    if u and not u.lower().startswith(("http://", "https://")):
        u = "https://" + u
    return u


def build():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC} — export the Core Marketplace tab to it")
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    records, stats = [], {"tld_country": 0, "tld_corrected": 0,
                          "no_country": 0, "no_techniques": 0}

    for r in rows:
        name = (r.get("Facility Name") or "").strip()
        inst = (r.get("Institution Name") or "").strip() or name
        url = clean_url(r.get("Website"))
        if not name or not url:
            continue
        stated = (r.get("Country") or "").strip()
        country, how = resolve_country(stated, url)
        # Count only where the domain genuinely changed the country. Comparing
        # against the raw cell would score "United States of America" ->
        # "United States" as an override, when it is only a spelling fix.
        canon_stated = ("United States" if stated.lower() in US_VARIANTS
                        else COUNTRY_ALIASES.get(stated.lower(), stated))
        if how == "tld" and country and country != canon_stated:
            stats["tld_country"] += 1
            if canon_stated:
                stats["tld_corrected"] += 1
        if not country:
            stats["no_country"] += 1
        services = split_services(r.get("Services"))
        techs = map_techniques(services)
        if not techs:
            stats["no_techniques"] += 1
        desc = " ".join((r.get("Description") or "").split())
        if len(desc) > 320:
            desc = desc[:317].rsplit(" ", 1)[0] + "..."
        records.append({
            "facility": name,
            "institution": inst,
            "city": (r.get("City") or "").strip(),
            "region": (r.get("State") or "").strip(),
            "country": country,
            "url": url,
            "rrid": (r.get("Facility RRID") or "").strip(),
            "techniques": techs,
            "services_raw": services[:14],
            "notes": desc,
        })

    OUT.write_text(json.dumps(
        {"schema": 1,
         "generated_by": "scripts/import_marketplace.py",
         "source": "Core Marketplace tab, Labs workbook (RRIDs from SciCrunch)",
         "source_rows": len(rows),
         "count": len(records),
         "facilities": records}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(records)} facilities from {len(rows)} rows")
    print(f"  country filled in from the domain: {stats['tld_country']}"
          f" (of which {stats['tld_corrected']} overrode a wrong value)")
    print(f"  still no country:                  {stats['no_country']}")
    print(f"  no technique matched:              {stats['no_techniques']}")


if __name__ == "__main__":
    build()
