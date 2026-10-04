#!/usr/bin/env python3
"""
Assemble site/ for local preview and GitHub Pages.

Copies generated chart data and Vega-Lite specs into site/, rewriting
each chart's data.url to a path that works from site/index.html.

Does not invent numbers: only copies outputs of flatten.py.

Run: python scripts/build_site.py
"""
from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CHARTS_SRC = ROOT / "charts"
DATA_SRC = ROOT / "data"
CLAIMS_DIR = ROOT / "claims"

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
    "identity.msrp_cny",
    "efficiency.epa_range_mi",
    "efficiency.epa_mpge_combined",
    "efficiency.epa_kwh_per_100mi",
    "efficiency.cltc_range_km",
    "efficiency.cltc_kwh_per_100km",
    "battery.pack_kwh",
    "battery.pack_kwh_basis",
    "battery.system_voltage_v",
    "powertrain.drive_layout",
    "charging.peak_dc_kw",
    "charging.port_type",
    "charging.onboard_ac_kw",
    "powertrain.accel_0_60_s",
    "powertrain.power_hp",
    "body.curb_weight_lb",
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


def load_compare_claim_meta() -> tuple[
    dict[str, dict[str, dict]], dict[str, dict[str, str]]
]:
    """From claims/: conflict alts and winning source_names for Compare fields."""
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
    for (vid, field), claims in by_field.items():
        winner = _pick_winner(claims)
        if winner is None:
            continue
        name = winner.get("source_name")
        if name:
            source_names.setdefault(vid, {})[field] = name
        if len({_value_key(c) for c in claims}) < 2:
            continue
        alt = _pick_alt(claims, winner)
        if alt is None:
            continue
        conflict_alts.setdefault(vid, {})[field] = _alt_payload(alt)
    return conflict_alts, source_names


def write_compare_json(flattened_path: Path, out_path: Path) -> None:
    """One row per vehicle from winning flattened values, plus conflict alts."""
    conflict_alts, source_names_by_vid = load_compare_claim_meta()
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
            conflicts: dict[str, bool] = {}
            alts: dict[str, dict] = {}
            names_for_vid = source_names_by_vid.get(vid, {})
            alts_for_vid = conflict_alts.get(vid, {})

            for field in COMPARE_SPEC_FIELDS:
                raw = _cell(row, field)
                entry[field] = _json_value(raw)
                tier = _cell(row, f"{field}__tier")
                url = _cell(row, f"{field}__source_url")
                if raw and tier:
                    tiers[field] = tier
                if raw and url:
                    sources[field] = url
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
            if conflicts:
                entry["conflicts"] = conflicts
            if alts:
                entry["conflict_alts"] = alts
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

    index = SITE / "index.html"
    if not index.exists():
        raise SystemExit(f"Missing hand-authored {index}")

    print(
        f"Built site/ ({len(CHART_DATA)} chart(s), compare.json). "
        "Preview: npm run preview"
    )


if __name__ == "__main__":
    main()
