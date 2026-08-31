#!/usr/bin/env python3
"""Bundle this skill into ../../core-facility-finder.skill (a plain zip).

Timestamps are pinned so the archive only changes when its contents do -- an
identical build produces a byte-identical file and no git churn.
"""
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "core-facility-finder.skill"
# The merged core-facilities.json is all the CLI needs at runtime. The
# marketplace CSV and its intermediate JSON are deliberately left out: together
# they are ~1 MB and everything they produce is already in the merged file.
# Refreshing the import needs the repo, not the bundle.
MEMBERS = ["SKILL.md", "README.md", "scripts/cores.py", "scripts/build_dataset.py",
           "scripts/import_marketplace.py", "scripts/package.py",
           "data/core-facilities.json"]
FIXED_DATE = (2026, 1, 1, 0, 0, 0)


def main():
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for name in MEMBERS:
            src = ROOT / name
            if not src.exists():
                raise SystemExit(f"missing {name} -- run build_dataset.py first")
            info = zipfile.ZipInfo(name, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if name.endswith(".py") else 0o644) << 16
            z.writestr(info, src.read_bytes())
    print(f"wrote {OUT.name}  ({OUT.stat().st_size // 1024} KB, {len(MEMBERS)} files)")


if __name__ == "__main__":
    main()
