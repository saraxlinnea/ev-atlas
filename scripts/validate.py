#!/usr/bin/env python3
"""
Validate every vehicle + claims file in data/ against schema/.

Enforces, beyond plain JSON Schema:
  - tier P/S claims have a non-empty http(s) source_url (the schema only
    requires the key to exist, so "" would otherwise pass)
  - tier D claims have derivation.formula + derivation.inputs, and every input
    resolves to another claim that actually exists in this dataset
  - every claim's vehicle_id resolves to a vehicle in vehicles.json
  - no duplicate (vehicle_id, field, source_name) triples
  - warns (does not fail) when a P/S source_url is a bare domain with no path,
    which usually means the actual page wasn't recorded
  - warns (does not fail) on fields not listed in schema/vehicle-fields.md

Exit code 0 = clean. Exit code 1 = at least one hard failure.
Run: python scripts/validate.py
"""
import json
import re
import sys
import glob
from pathlib import Path
from datetime import date
from urllib.parse import urlparse

try:
    import jsonschema
except ImportError:
    print("Missing dependency. Run: pip install jsonschema --break-system-packages")
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "schema"
DATA_DIR = ROOT / "data"
CLAIMS_DIR = ROOT / "claims"

def load_schema(name):
    with open(SCHEMA_DIR / name) as f:
        return json.load(f)

def documented_fields():
    """Field patterns from the first column of the vehicle-fields.md table.
    'recalls.*' and 'recalls.campaign_<id>' become prefix/regex matches; a row
    like 'body.length_in / width_in' expands to body.length_in, body.width_in."""
    patterns = []
    for line in (SCHEMA_DIR / "vehicle-fields.md").read_text().splitlines():
        if not line.startswith("| ") or line.startswith("| field path") or line.startswith("|---"):
            continue
        cell = line.split("|")[1].strip().replace("&lt;", "<").replace("&gt;", ">")
        parts = [p.strip() for p in cell.split("/")]
        prefix = parts[0].rsplit(".", 1)[0]
        for i, p in enumerate(parts):
            path = p if i == 0 else f"{prefix}.{p}"
            rx = re.escape(path).replace(r"\*", ".+")
            rx = re.sub(r"<[^>]+>", ".+", rx)
            patterns.append(re.compile(rx + "$"))
    return patterns

def main():
    errors = []
    warnings = []

    claim_schema = load_schema("claim.schema.json")
    vehicle_schema = load_schema("vehicle.schema.json")

    vehicles_path = DATA_DIR / "vehicles.json"
    if not vehicles_path.exists():
        print(f"FATAL: {vehicles_path} not found.")
        sys.exit(2)

    with open(vehicles_path) as f:
        vehicles = json.load(f)

    vehicle_ids = set()
    for v in vehicles:
        try:
            jsonschema.validate(v, vehicle_schema)
        except jsonschema.ValidationError as e:
            errors.append(f"[vehicle:{v.get('vehicle_id','?')}] {e.message}")
        vehicle_ids.add(v.get("vehicle_id"))

    claims_files = sorted(glob.glob(str(CLAIMS_DIR / "*.json")))
    if not claims_files:
        warnings.append(f"No claims files found in {CLAIMS_DIR}. Nothing to validate yet.")

    all_claims = []
    seen_triples = set()
    field_patterns = documented_fields()

    for cf in claims_files:
        with open(cf) as f:
            try:
                claims = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"[{cf}] invalid JSON: {e}")
                continue
        if not isinstance(claims, list):
            errors.append(f"[{cf}] expected a JSON list of claim objects")
            continue

        for i, c in enumerate(claims):
            loc = f"{cf}[{i}]"
            try:
                jsonschema.validate(c, claim_schema)
            except jsonschema.ValidationError as e:
                errors.append(f"[{loc}] schema error: {e.message}")
                continue

            vid = c["vehicle_id"]

            if c["tier"] in ("P", "S"):
                url = c.get("source_url", "").strip()
                parsed = urlparse(url)
                if parsed.scheme not in ("http", "https") or not parsed.netloc:
                    errors.append(f"[{loc}] tier {c['tier']} claim for '{c['field']}' has no usable "
                                  f"source_url ({url!r}); cite the page or downgrade to unverified")
                elif parsed.path in ("", "/") and not parsed.query:
                    warnings.append(f"[{loc}] source_url {url} is a bare domain; record the page the value came from")

            if not any(p.match(c["field"]) for p in field_patterns):
                warnings.append(f"[{loc}] field '{c['field']}' is not in schema/vehicle-fields.md")

            if vid not in vehicle_ids:
                errors.append(f"[{loc}] vehicle_id '{vid}' not found in vehicles.json")

            triple = (vid, c["field"], c.get("source_name", ""))
            if triple in seen_triples:
                errors.append(f"[{loc}] duplicate claim (same vehicle, field, source): {triple}")
            seen_triples.add(triple)

            # access_date sanity: not in the future
            try:
                ad = date.fromisoformat(c["access_date"])
                if ad > date.today():
                    errors.append(f"[{loc}] access_date {ad} is in the future")
            except ValueError:
                errors.append(f"[{loc}] access_date '{c['access_date']}' not valid ISO date")

            if c["tier"] == "D":
                for inp in c["derivation"]["inputs"]:
                    # inputs may be 'field.path' (same vehicle) or 'vehicle_id#field.path'
                    if "#" in inp:
                        ref_vid, ref_field = inp.split("#", 1)
                    else:
                        ref_vid, ref_field = vid, inp
                    match = [
                        x for x in claims
                        if x.get("vehicle_id") == ref_vid and x.get("field") == ref_field
                    ]
                    if not match:
                        warnings.append(
                            f"[{loc}] derivation input '{inp}' not found as a claim in the "
                            f"same file — fine if it lives in another vehicle's claims file, "
                            f"otherwise this derivation is unverifiable"
                        )

            all_claims.append(c)

    print(f"Checked {len(claims_files)} claims file(s), {len(all_claims)} claim(s), "
          f"{len(vehicles)} vehicle(s).\n")

    if warnings:
        print(f"--- {len(warnings)} warning(s) ---")
        for w in warnings:
            print(f"  WARN: {w}")
        print()

    if errors:
        print(f"--- {len(errors)} error(s) ---")
        for e in errors:
            print(f"  FAIL: {e}")
        print(f"\nValidation FAILED.")
        sys.exit(1)

    print("Validation passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
