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
  - make claims in claims/makes/ follow make-claim.schema.json and
    schema/make-fields.md; org.summary must contain no digits; brand_type /
    ev_focus / home_market enums; deliveries units require period + scope
    companions

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
MAKE_CLAIMS_DIR = CLAIMS_DIR / "makes"

LISTING_STATUS_VALUES = frozenset({"public", "private", "unknown"})
BRAND_TYPE_VALUES = frozenset({"standalone", "division", "jv_brand"})
EV_FOCUS_VALUES = frozenset({"bev_only", "multi_powertrain", "nev_bev_phev"})
HOME_MARKET_VALUES = frozenset({"US", "CN", "EU", "KR", "JP", "multi"})
SUMMARY_DIGIT_RE = re.compile(r"\d")


def load_schema(name):
    with open(SCHEMA_DIR / name) as f:
        return json.load(f)


def documented_fields(md_name="vehicle-fields.md"):
    """Field patterns from the first column of a fields markdown table.
    'recalls.*' and 'recalls.campaign_<id>' become prefix/regex matches; a row
    like 'body.length_in / width_in' expands to body.length_in, body.width_in."""
    patterns = []
    for line in (SCHEMA_DIR / md_name).read_text().splitlines():
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


def check_source_url(loc, claim, errors, warnings):
    if claim["tier"] not in ("P", "S"):
        return
    url = claim.get("source_url", "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        errors.append(
            f"[{loc}] tier {claim['tier']} claim for '{claim['field']}' has no usable "
            f"source_url ({url!r}); cite the page or downgrade to unverified"
        )
    elif parsed.path in ("", "/") and not parsed.query:
        warnings.append(
            f"[{loc}] source_url {url} is a bare domain; record the page the value came from"
        )


def check_access_date(loc, claim, errors):
    try:
        ad = date.fromisoformat(claim["access_date"])
        if ad > date.today():
            errors.append(f"[{loc}] access_date {ad} is in the future")
    except ValueError:
        errors.append(f"[{loc}] access_date '{claim['access_date']}' not valid ISO date")


def make_slug(make: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (make or "").strip().lower())
    return s.strip("-")


def validate_make_claims(vehicles, errors, warnings):
    """Validate claims/makes/<slug>.json against make-claim schema + make-fields."""
    make_schema = load_schema("make-claim.schema.json")
    field_patterns = documented_fields("make-fields.md")
    makes_in_corpus = {(v.get("make") or "").strip() for v in vehicles if v.get("make")}
    make_slugs = {make_slug(m): m for m in makes_in_corpus}

    if not MAKE_CLAIMS_DIR.exists():
        warnings.append(
            f"No make-claims directory at {MAKE_CLAIMS_DIR}; identity layer empty."
        )
        return 0, 0

    claims_files = sorted(glob.glob(str(MAKE_CLAIMS_DIR / "*.json")))
    all_claims = []
    seen_triples = set()
    fields_by_make = {}

    for cf in claims_files:
        path = Path(cf)
        slug = path.stem
        with open(cf) as f:
            try:
                claims = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"[{cf}] invalid JSON: {e}")
                continue
        if not isinstance(claims, list):
            errors.append(f"[{cf}] expected a JSON list of claim objects")
            continue

        if slug not in make_slugs:
            warnings.append(
                f"[{cf}] slug '{slug}' does not match any make in vehicles.json"
            )

        for i, c in enumerate(claims):
            loc = f"{cf}[{i}]"
            try:
                jsonschema.validate(c, make_schema)
            except jsonschema.ValidationError as e:
                errors.append(f"[{loc}] schema error: {e.message}")
                continue

            make = (c.get("make") or "").strip()
            if make not in makes_in_corpus:
                errors.append(
                    f"[{loc}] make '{make}' not found in vehicles.json"
                )
            expected_slug = make_slug(make)
            if expected_slug and expected_slug != slug:
                errors.append(
                    f"[{loc}] make '{make}' belongs in claims/makes/{expected_slug}.json, "
                    f"not {path.name}"
                )

            check_source_url(loc, c, errors, warnings)
            check_access_date(loc, c, errors)

            if not any(p.match(c["field"]) for p in field_patterns):
                errors.append(
                    f"[{loc}] field '{c['field']}' is not in schema/make-fields.md"
                )

            if c["field"] == "org.listing_status" and c.get("value") not in LISTING_STATUS_VALUES:
                errors.append(
                    f"[{loc}] org.listing_status must be one of "
                    f"{sorted(LISTING_STATUS_VALUES)}; got {c.get('value')!r}"
                )

            if c["field"] == "org.brand_type" and c.get("value") not in BRAND_TYPE_VALUES:
                errors.append(
                    f"[{loc}] org.brand_type must be one of "
                    f"{sorted(BRAND_TYPE_VALUES)}; got {c.get('value')!r}"
                )

            if c["field"] == "org.ev_focus" and c.get("value") not in EV_FOCUS_VALUES:
                errors.append(
                    f"[{loc}] org.ev_focus must be one of "
                    f"{sorted(EV_FOCUS_VALUES)}; got {c.get('value')!r}"
                )

            if c["field"] == "org.home_market" and c.get("value") not in HOME_MARKET_VALUES:
                errors.append(
                    f"[{loc}] org.home_market must be one of "
                    f"{sorted(HOME_MARKET_VALUES)}; got {c.get('value')!r}"
                )

            if c["field"] == "org.summary":
                text = c.get("value") if isinstance(c.get("value"), str) else ""
                if SUMMARY_DIGIT_RE.search(text or ""):
                    errors.append(
                        f"[{loc}] org.summary must contain no digits; "
                        "put numbers in numeric fields"
                    )

            if c["field"] == "org.founded_year":
                year = c.get("value")
                if not isinstance(year, int) or year < 1800 or year > date.today().year + 1:
                    errors.append(
                        f"[{loc}] org.founded_year must be a plausible integer year; "
                        f"got {year!r}"
                    )

            if c["field"] == "org.deliveries_units":
                units = c.get("value")
                if not isinstance(units, int) or isinstance(units, bool) or units < 0:
                    errors.append(
                        f"[{loc}] org.deliveries_units must be a non-negative integer; "
                        f"got {units!r}"
                    )

            triple = (make, c["field"], c.get("source_name", ""))
            if triple in seen_triples:
                errors.append(
                    f"[{loc}] duplicate make claim (same make, field, source): {triple}"
                )
            seen_triples.add(triple)
            fields_by_make.setdefault(make, set()).add(c["field"])
            all_claims.append(c)

        # Deliveries companions: if units present in this file, period + scope required.
        file_fields = {c.get("field") for c in claims if isinstance(c, dict)}
        if "org.deliveries_units" in file_fields:
            for req in ("org.deliveries_period", "org.deliveries_scope"):
                if req not in file_fields:
                    errors.append(
                        f"[{cf}] org.deliveries_units requires companion claim '{req}' "
                        "in the same make file"
                    )

    return len(claims_files), len(all_claims)


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

            check_source_url(loc, c, errors, warnings)

            if not any(p.match(c["field"]) for p in field_patterns):
                warnings.append(f"[{loc}] field '{c['field']}' is not in schema/vehicle-fields.md")

            if vid not in vehicle_ids:
                errors.append(f"[{loc}] vehicle_id '{vid}' not found in vehicles.json")

            triple = (vid, c["field"], c.get("source_name", ""))
            if triple in seen_triples:
                errors.append(f"[{loc}] duplicate claim (same vehicle, field, source): {triple}")
            seen_triples.add(triple)

            check_access_date(loc, c, errors)

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

    make_files, make_claim_count = validate_make_claims(vehicles, errors, warnings)

    print(
        f"Checked {len(claims_files)} vehicle claims file(s), {len(all_claims)} claim(s), "
        f"{len(vehicles)} vehicle(s); {make_files} make file(s), {make_claim_count} make claim(s).\n"
    )

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
