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

# Chart filename -> CSV filename relative to data/
CHART_DATA = {
    "disclosure_heatmap.vl.json": "disclosure_heatmap.csv",
    "epa_efficiency.vl.json": "flattened.csv",
    "battery_side_efficiency.vl.json": "flattened.csv",
}

COMPARE_IDENTITY = (
    "vehicle_id",
    "make",
    "model",
    "trim",
    "model_year",
)
COMPARE_SPEC_FIELDS = (
    "identity.msrp_usd",
    "efficiency.epa_range_mi",
    "efficiency.epa_mpge_combined",
    "efficiency.epa_kwh_per_100mi",
    "powertrain.drive_layout",
    "charging.peak_dc_kw",
    "charging.port_type",
    "battery.pack_kwh",
    "battery.cell_chemistry",
    "powertrain.accel_0_60_s",
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


def write_compare_json(flattened_path: Path, out_path: Path) -> None:
    """One row per vehicle from winning flattened values only."""
    rows_out: list[dict] = []
    with flattened_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry: dict = {}
            for key in COMPARE_IDENTITY:
                raw = _cell(row, key)
                if key == "model_year" and raw:
                    entry[key] = int(raw)
                elif raw:
                    entry[key] = raw
                else:
                    entry[key] = None

            tiers: dict[str, str] = {}
            sources: dict[str, str] = {}
            for field in COMPARE_SPEC_FIELDS:
                raw = _cell(row, field)
                entry[field] = _json_value(raw)
                tier = _cell(row, f"{field}__tier")
                url = _cell(row, f"{field}__source_url")
                if raw and tier:
                    tiers[field] = tier
                if raw and url:
                    sources[field] = url
            if tiers:
                entry["tiers"] = tiers
            if sources:
                entry["sources"] = sources
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
