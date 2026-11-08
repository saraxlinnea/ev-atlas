#!/usr/bin/env python3
"""
Assemble site/ for local preview and GitHub Pages.

Copies generated chart data and Vega-Lite specs into site/, rewriting
each chart's data.url to a path that works from site/index.html.

Writes site/data/compare.json and site/data/makes.json from flattened
winners (and vehicles.json / disclosure heatmap for make dossiers), plus
make-level org claim winners from claims/makes/ (identity layer; not
flattened into vehicle CSVs).

Does not invent numbers: only copies or aggregates claim winners.

Run: python scripts/build_site.py
"""
from __future__ import annotations

import csv
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CHARTS_SRC = ROOT / "charts"
DATA_SRC = ROOT / "data"
CLAIMS_DIR = ROOT / "claims"
VEHICLES_PATH = DATA_SRC / "vehicles.json"

# Categorical winners summarized as value counts (not min–max).
MAKE_CATEGORICAL_FIELDS = frozenset(
    {
        "charging.port_type",
        "powertrain.drive_layout",
        "battery.pack_kwh_basis",
        "battery.cell_chemistry",
    }
)

# Make org fields surfaced on dossier Background cards (winners from claims/makes/).
MAKE_ORG_FIELDS = (
    "org.hq_city",
    "org.hq_country",
    "org.parent",
    "org.brand_type",
    "org.ev_focus",
    "org.home_market",
    "org.founded_year",
    "org.listing_status",
    "org.ticker",
    "org.summary",
    "org.deliveries_units",
    "org.deliveries_period",
    "org.deliveries_scope",
)

# Fleet patterns shown under "In this atlas" (vehicle winners / heatmap).
MAKE_ATLAS_PATTERN_FIELDS = (
    "battery.cell_chemistry",
    "battery.cell_supplier",
    "charging.port_type",
)

MAKE_CLAIMS_DIR = CLAIMS_DIR / "makes"

# Same ranks as flatten.py; keep winner rules in lockstep.
TIER_RANK = {"P": 3, "S": 2, "D": 1, "unverified": 0}
CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}

# Chart filename -> CSV filename relative to data/
CHART_DATA = {
    "disclosure_heatmap.vl.json": "disclosure_heatmap.csv",
    "epa_efficiency.vl.json": "flattened.csv",
    "battery_side_efficiency.vl.json": "flattened.csv",
    "range_vs_msrp.vl.json": "flattened.csv",
    "range_vs_pack.vl.json": "flattened.csv",
    "cltc_range_vs_pack.vl.json": "flattened.csv",
    "weight_vs_efficiency.vl.json": "flattened.csv",
}

COMPARE_IDENTITY = (
    "vehicle_id",
    "make",
    "model",
    "trim",
    "model_year",
    "region",
)
COMPARE_SPEC_FIELDS = (
    "identity.msrp_usd",
    "efficiency.epa_range_mi",
    "efficiency.epa_mpge_combined",
    "efficiency.epa_kwh_per_100mi",
    "efficiency.cltc_range_km",
    "efficiency.cltc_kwh_per_100km",
    "battery.pack_kwh",
    "battery.pack_kwh_basis",
    "battery.system_voltage_v",
    "powertrain.drive_layout",
    "powertrain.torque_lbft",
    "powertrain.motor_count",
    "charging.peak_dc_kw",
    "charging.port_type",
    "charging.onboard_ac_kw",
    "charging.nacs_adapter_included",
    "powertrain.accel_0_60_s",
    "powertrain.power_hp",
    "body.curb_weight_lb",
    "body.length_in",
    "body.width_in",
    "body.height_in",
    "body.wheelbase_in",
    "derived.kwh_per_100mi_battery_side",
    "recalls.campaign_count",
    "battery.cell_chemistry",
)


def _cell(row: dict[str, str], field: str) -> str:
    return (row.get(field) or "").strip()


def _json_value(raw: str):
    if not raw:
        return None
    try:
        if "." in raw:
            return float(raw)
        return int(raw)
    except ValueError:
        return raw


def _value_key(claim: dict) -> tuple[str, str]:
    return (json.dumps(claim.get("value"), sort_keys=True), claim.get("unit") or "")


def _is_better_claim(candidate: dict, current: dict) -> bool:
    tier_delta = TIER_RANK.get(candidate.get("tier"), -1) - TIER_RANK.get(
        current.get("tier"), -1
    )
    conf_delta = CONFIDENCE_RANK.get(candidate.get("confidence"), 0) - CONFIDENCE_RANK.get(
        current.get("confidence"), 0
    )
    return tier_delta > 0 or (tier_delta == 0 and conf_delta > 0)


def _pick_winner(claims: list[dict]) -> dict | None:
    """Match flatten.py: higher tier, then confidence; ties keep the earlier claim."""
    winner = None
    for claim in claims:
        if winner is None or _is_better_claim(claim, winner):
            winner = claim
    return winner


def _pick_alt(claims: list[dict], winner: dict) -> dict | None:
    """Next-best claim with a different value (same tier/confidence rules)."""
    win_key = _value_key(winner)
    alt = None
    for claim in claims:
        if _value_key(claim) == win_key:
            continue
        if alt is None or _is_better_claim(claim, alt):
            alt = claim
    return alt


def _alt_payload(claim: dict) -> dict:
    out: dict = {
        "value": claim.get("value"),
        "tier": claim.get("tier"),
    }
    if claim.get("source_url"):
        out["source_url"] = claim["source_url"]
    if claim.get("source_name"):
        out["source_name"] = claim["source_name"]
    if claim.get("notes"):
        out["notes"] = claim["notes"]
    if claim.get("unit"):
        out["unit"] = claim["unit"]
    return out


def _accel_basis(claim: dict) -> str | None:
    """Detect 0-100 km/h storage vs default 0-60 mph field; no conversion."""
    import re

    name = claim.get("source_name") or ""
    notes = claim.get("notes") or ""
    unit = claim.get("unit") or ""
    zero_100 = re.compile(r"0\s*[-–—]?\s*100(?:\s*km/?h)?", re.I)
    stored_0100 = re.compile(r"stored as stated\s*0\s*[-–—]?\s*100", re.I)
    rather_060 = re.compile(r"rather than\s*0\s*[-–—]?\s*60", re.I)
    for blob in (unit, name):
        if zero_100.search(blob):
            return "0-100_kmh"
    if stored_0100.search(notes):
        return "0-100_kmh"
    # Notes may mention OEM 0-100 while the winning value is a 0-60 claim.
    if zero_100.search(notes) and not rather_060.search(notes):
        return "0-100_kmh"
    return None


def load_compare_claim_meta() -> tuple[
    dict[str, dict[str, dict]],
    dict[str, dict[str, str]],
    dict[str, str],
]:
    """From claims/: conflict alts, winning source_names, accel cycle basis."""
    by_field: dict[tuple[str, str], list[dict]] = {}
    for path in sorted(CLAIMS_DIR.glob("*.json")):
        claims = json.loads(path.read_text(encoding="utf-8"))
        for claim in claims:
            field = claim.get("field")
            vid = claim.get("vehicle_id")
            if not vid or field not in COMPARE_SPEC_FIELDS:
                continue
            by_field.setdefault((vid, field), []).append(claim)

    conflict_alts: dict[str, dict[str, dict]] = {}
    source_names: dict[str, dict[str, str]] = {}
    accel_basis_by_vid: dict[str, str] = {}
    for (vid, field), claims in by_field.items():
        winner = _pick_winner(claims)
        if winner is None:
            continue
        name = winner.get("source_name")
        if name:
            source_names.setdefault(vid, {})[field] = name
        if field == "powertrain.accel_0_60_s":
            basis = _accel_basis(winner)
            if basis:
                accel_basis_by_vid[vid] = basis
        if len({_value_key(c) for c in claims}) < 2:
            continue
        alt = _pick_alt(claims, winner)
        if alt is None:
            continue
        conflict_alts.setdefault(vid, {})[field] = _alt_payload(alt)
    return conflict_alts, source_names, accel_basis_by_vid


def make_slug(make: str) -> str:
    """URL slug from make name; Chevrolet and Cadillac stay distinct."""
    s = re.sub(r"[^a-z0-9]+", "-", (make or "").strip().lower())
    return s.strip("-")


def load_make_org_winners() -> dict[str, dict[str, dict]]:
    """Pick winning make org claims by make name → field → payload."""
    by_key: dict[tuple[str, str], list[dict]] = {}
    if not MAKE_CLAIMS_DIR.exists():
        return {}
    for path in sorted(MAKE_CLAIMS_DIR.glob("*.json")):
        claims = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(claims, list):
            continue
        for claim in claims:
            make = (claim.get("make") or "").strip()
            field = claim.get("field")
            if not make or field not in MAKE_ORG_FIELDS:
                continue
            by_key.setdefault((make, field), []).append(claim)

    out: dict[str, dict[str, dict]] = {}
    for (make, field), claims in by_key.items():
        winner = _pick_winner(claims)
        if winner is None:
            continue
        payload: dict = {
            "value": winner.get("value"),
            "tier": winner.get("tier"),
        }
        if winner.get("source_url"):
            payload["source_url"] = winner["source_url"]
        if winner.get("source_name"):
            payload["source_name"] = winner["source_name"]
        if winner.get("notes"):
            payload["notes"] = winner["notes"]
        out.setdefault(make, {})[field] = payload
    return out


def _identity_coverage(org: dict[str, dict]) -> str:
    """blank / partial / filled for index display; not a ranking."""
    # Parent is optional (brand vs standalone make). Core identity is HQ + summary.
    core = ("org.hq_city", "org.hq_country", "org.summary")
    present = sum(1 for f in core if f in org and org[f].get("value") not in (None, ""))
    if present == 0 and not org:
        return "blank"
    if present == 0:
        # Non-core fields only (ticker, deliveries, parent alone, etc.)
        return "partial"
    if present >= len(core):
        return "filled"
    return "partial"


def _atlas_pattern_from_values(values: list[str], of: int) -> dict | None:
    summary = _categorical_summary(values, of)
    if summary:
        return summary
    if of <= 0:
        return None
    return {"values": [], "stated": 0, "of": of}


def _parse_number(raw: str):
    if not raw:
        return None
    try:
        if "." in raw:
            return float(raw)
        return int(raw)
    except ValueError:
        return None


def _numeric_summary(values: list, of: int) -> dict | None:
    nums = [v for v in values if isinstance(v, (int, float))]
    if not nums or of <= 0:
        return None
    return {
        "min": min(nums),
        "max": max(nums),
        "stated": len(nums),
        "of": of,
    }


def _categorical_summary(values: list[str], of: int) -> dict | None:
    filled = [v for v in values if v]
    if not filled or of <= 0:
        return None
    counts = Counter(filled)
    return {
        "values": [
            {"value": val, "count": counts[val]}
            for val in sorted(counts.keys(), key=lambda x: (-counts[x], x))
        ],
        "stated": len(filled),
        "of": of,
    }


def write_makes_json(
    vehicles_path: Path,
    flattened_path: Path,
    heatmap_path: Path,
    out_path: Path,
) -> int:
    """Aggregate vehicles + flattened winners + make org claims into makes.json."""
    vehicles = json.loads(vehicles_path.read_text(encoding="utf-8"))
    by_make: dict[str, list[dict]] = defaultdict(list)
    for v in vehicles:
        make = (v.get("make") or "").strip()
        if make:
            by_make[make].append(v)

    flat_by_vid: dict[str, dict[str, str]] = {}
    with flattened_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            vid = _cell(row, "vehicle_id")
            if vid:
                flat_by_vid[vid] = row

    # vehicle_id -> filled tracked-field count / possible
    heat_filled: dict[str, int] = defaultdict(int)
    heat_possible: dict[str, int] = defaultdict(int)
    heat_missing_fields: dict[str, Counter] = defaultdict(Counter)
    # Per vehicle tracked field -> tier (for supplier stated-on counts).
    heat_field_tier: dict[str, dict[str, str]] = defaultdict(dict)
    if heatmap_path.exists():
        with heatmap_path.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                vid = _cell(row, "vehicle_id")
                field = _cell(row, "field")
                tier = _cell(row, "tier")
                if not vid or not field:
                    continue
                heat_possible[vid] += 1
                heat_field_tier[vid][field] = tier
                if tier and tier != "missing":
                    heat_filled[vid] += 1
                else:
                    heat_missing_fields[vid][field] += 1

    org_by_make = load_make_org_winners()

    makes_out: list[dict] = []
    for make in sorted(by_make.keys(), key=lambda m: m.casefold()):
        vids = by_make[make]
        n = len(vids)
        regions = sorted({(v.get("region") or "US") for v in vids})
        lineages = sorted({v.get("lineage_id") for v in vids if v.get("lineage_id")})
        status_mix = Counter((v.get("status") or "unknown") for v in vids)

        filled = sum(heat_filled.get(v["vehicle_id"], 0) for v in vids)
        possible = sum(heat_possible.get(v["vehicle_id"], 0) for v in vids)
        disclosure = {
            "filled": filled,
            "possible": possible,
            "fill_rate": round(filled / possible, 4) if possible else None,
        }

        # Per-make missing-field totals for highlights (tracked fields only).
        missing_totals: Counter = Counter()
        conflict_vids: list[str] = []
        for v in vids:
            vid = v["vehicle_id"]
            missing_totals.update(heat_missing_fields.get(vid, Counter()))
            row = flat_by_vid.get(vid, {})
            if any(
                k.endswith("__conflict") and _cell(row, k) == "true" for k in row
            ):
                conflict_vids.append(vid)

        us_vids = [v for v in vids if (v.get("region") or "US") == "US"]
        cn_vids = [v for v in vids if (v.get("region") or "US") == "CN"]

        def field_values(field: str, subset: list[dict]) -> list:
            out = []
            for v in subset:
                raw = _cell(flat_by_vid.get(v["vehicle_id"], {}), field)
                if field in MAKE_CATEGORICAL_FIELDS:
                    if raw:
                        out.append(raw)
                else:
                    num = _parse_number(raw)
                    if num is not None:
                        out.append(num)
            return out

        specs: dict[str, dict] = {}
        # Range: EPA among US rows; CLTC among CN rows. Never mix cycles.
        epa_range = _numeric_summary(
            field_values("efficiency.epa_range_mi", us_vids), len(us_vids)
        )
        if epa_range:
            specs["efficiency.epa_range_mi"] = epa_range
        cltc_range = _numeric_summary(
            field_values("efficiency.cltc_range_km", cn_vids), len(cn_vids)
        )
        if cltc_range:
            specs["efficiency.cltc_range_km"] = cltc_range

        for field in (
            "efficiency.epa_kwh_per_100mi",
            "battery.pack_kwh",
            "identity.msrp_usd",
            "charging.peak_dc_kw",
            "powertrain.accel_0_60_s",
        ):
            # Efficiency EPA wall-side: US rows only. Other buyer fields: all rows.
            subset = us_vids if field.startswith("efficiency.epa_") else vids
            summary = _numeric_summary(field_values(field, subset), len(subset))
            if summary:
                specs[field] = summary

        for field in ("charging.port_type", "powertrain.drive_layout"):
            summary = _categorical_summary(field_values(field, vids), n)
            if summary:
                specs[field] = summary

        basis = _categorical_summary(
            field_values("battery.pack_kwh_basis", vids), n
        )
        if basis:
            specs["battery.pack_kwh_basis"] = basis

        highlights: list[dict] = []
        if conflict_vids:
            highlights.append(
                {
                    "kind": "conflict",
                    "text": (
                        f"{len(conflict_vids)} of {n} vehicles in EV Atlas have "
                        "at least one field where sources disagree."
                    ),
                }
            )
        # Top disclosure gaps (blank on most vehicles of this make).
        gap_items = [
            (field, count)
            for field, count in missing_totals.most_common()
            if count >= max(1, (n + 1) // 2)
        ][:3]
        for field, count in gap_items:
            highlights.append(
                {
                    "kind": "disclosure",
                    "text": (
                        f"{field} is blank on {count} of {n} vehicles in EV Atlas."
                    ),
                }
            )
        pack_spec = specs.get("battery.pack_kwh")
        if pack_spec and not basis:
            highlights.append(
                {
                    "kind": "disclosure",
                    "text": (
                        "battery.pack_kwh is stated on "
                        f"{pack_spec['stated']} of {pack_spec['of']} vehicles, "
                        "but pack kWh basis is blank for all rows in EV Atlas."
                    ),
                }
            )

        fleet = []
        for v in sorted(
            vids,
            key=lambda x: (
                x.get("model") or "",
                x.get("model_year") or 0,
                x.get("trim") or "",
            ),
        ):
            fleet.append(
                {
                    "vehicle_id": v.get("vehicle_id"),
                    "model": v.get("model"),
                    "trim": v.get("trim"),
                    "model_year": v.get("model_year"),
                    "region": v.get("region") or "US",
                    "status": v.get("status"),
                    "lineage_id": v.get("lineage_id"),
                }
            )

        org = org_by_make.get(make, {})
        # Flatten org winners to simple values for the page; keep meta separately.
        org_values: dict = {}
        org_meta: dict = {}
        for field in MAKE_ORG_FIELDS:
            payload = org.get(field)
            if not payload:
                continue
            org_values[field] = payload.get("value")
            meta = {k: v for k, v in payload.items() if k != "value"}
            if meta:
                org_meta[field] = meta

        atlas_patterns: dict[str, dict] = {}
        for field in MAKE_ATLAS_PATTERN_FIELDS:
            if field == "battery.cell_supplier":
                # Usually absent from flattened.csv; count stated cells via heatmap.
                stated_vals = []
                for v in vids:
                    tier = heat_field_tier.get(v["vehicle_id"], {}).get(field, "missing")
                    if tier and tier != "missing":
                        raw = _cell(flat_by_vid.get(v["vehicle_id"], {}), field)
                        stated_vals.append(raw if raw else "(stated)")
                pattern = _atlas_pattern_from_values(stated_vals, n)
            else:
                pattern = _atlas_pattern_from_values(field_values(field, vids), n)
            if pattern:
                atlas_patterns[field] = pattern

        makes_out.append(
            {
                "make": make,
                "slug": make_slug(make),
                "vehicle_count": n,
                "regions": regions,
                "lineage_count": len(lineages),
                "lineages": lineages,
                "status_mix": dict(sorted(status_mix.items())),
                "disclosure": disclosure,
                "conflict_vehicle_count": len(conflict_vids),
                "identity_coverage": _identity_coverage(org),
                "org": org_values,
                "org_meta": org_meta,
                "atlas_patterns": atlas_patterns,
                "vehicles": fleet,
                "specs": specs,
                "highlights": highlights,
            }
        )

    payload = {
        "makes": makes_out,
        "make_count": len(makes_out),
        "vehicle_count": len(vehicles),
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return len(makes_out)


def write_compare_json(flattened_path: Path, out_path: Path) -> None:
    """One row per vehicle from winning flattened values, plus conflict alts."""
    conflict_alts, source_names_by_vid, accel_basis_by_vid = load_compare_claim_meta()
    rows_out: list[dict] = []
    with flattened_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry: dict = {}
            for key in COMPARE_IDENTITY:
                raw = _cell(row, key)
                if key == "model_year" and raw:
                    entry[key] = int(raw)
                elif key == "region":
                    entry[key] = raw or "US"
                elif raw:
                    entry[key] = raw
                else:
                    entry[key] = None

            vid = entry.get("vehicle_id") or ""
            tiers: dict[str, str] = {}
            sources: dict[str, str] = {}
            source_names: dict[str, str] = {}
            units: dict[str, str] = {}
            conflicts: dict[str, bool] = {}
            alts: dict[str, dict] = {}
            names_for_vid = source_names_by_vid.get(vid, {})
            alts_for_vid = conflict_alts.get(vid, {})

            for field in COMPARE_SPEC_FIELDS:
                raw = _cell(row, field)
                entry[field] = _json_value(raw)
                tier = _cell(row, f"{field}__tier")
                url = _cell(row, f"{field}__source_url")
                # Blank __unit means the field default in vehicle-fields.md.
                unit = _cell(row, f"{field}__unit")
                if raw and tier:
                    tiers[field] = tier
                if raw and url:
                    sources[field] = url
                if raw and unit:
                    units[field] = unit
                if raw and names_for_vid.get(field):
                    source_names[field] = names_for_vid[field]
                # Prefer flatten's *__conflict flag; attach alt when present.
                if _cell(row, f"{field}__conflict") == "true":
                    conflicts[field] = True
                    if field in alts_for_vid:
                        alts[field] = alts_for_vid[field]
            if tiers:
                entry["tiers"] = tiers
            if sources:
                entry["sources"] = sources
            if source_names:
                entry["source_names"] = source_names
            if units:
                entry["units"] = units
            if conflicts:
                entry["conflicts"] = conflicts
            if alts:
                entry["conflict_alts"] = alts
            if accel_basis_by_vid.get(vid):
                entry["accel_basis"] = accel_basis_by_vid[vid]
            rows_out.append(entry)

    out_path.write_text(
        json.dumps(rows_out, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    for csv_name in sorted(set(CHART_DATA.values())):
        if not (DATA_SRC / csv_name).exists():
            raise SystemExit(
                f"Missing data/{csv_name}. Run: python scripts/flatten.py"
            )

    site_data = SITE / "data"
    site_charts = SITE / "charts"
    site_data.mkdir(parents=True, exist_ok=True)
    site_charts.mkdir(parents=True, exist_ok=True)

    for chart_name, csv_name in CHART_DATA.items():
        src_csv = DATA_SRC / csv_name
        if not src_csv.exists():
            raise SystemExit(f"Missing {src_csv}")
        shutil.copy2(src_csv, site_data / csv_name)

        src_chart = CHARTS_SRC / chart_name
        if not src_chart.exists():
            raise SystemExit(f"Missing {src_chart}")
        spec = json.loads(src_chart.read_text(encoding="utf-8"))
        # Relative to site/index.html so Pages and local serve both work.
        spec["data"] = {"url": f"data/{csv_name}"}
        (site_charts / chart_name).write_text(
            json.dumps(spec, indent=2) + "\n",
            encoding="utf-8",
        )

    flattened = DATA_SRC / "flattened.csv"
    write_compare_json(flattened, site_data / "compare.json")

    if not VEHICLES_PATH.exists():
        raise SystemExit(f"Missing {VEHICLES_PATH}")
    make_count = write_makes_json(
        VEHICLES_PATH,
        flattened,
        DATA_SRC / "disclosure_heatmap.csv",
        site_data / "makes.json",
    )

    index = SITE / "index.html"
    if not index.exists():
        raise SystemExit(f"Missing hand-authored {index}")

    print(
        f"Built site/ ({len(CHART_DATA)} chart(s), compare.json, "
        f"{make_count} make dossier(s)). Preview: npm run preview"
    )


if __name__ == "__main__":
    main()
