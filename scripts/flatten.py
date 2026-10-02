#!/usr/bin/env python3
"""
Flatten claims/*.json into data/flattened.csv: one row per vehicle,
one column per field, plus parallel *__unit and *__tier columns for every field
so charts can filter or color by source tier without re-reading JSON.

When a field has more than one claim for the same vehicle, the
highest-tier claim wins for the flattened value (P > S > D > unverified).
The *__conflict column is true only when the claims disagree on value;
a better source confirming the same value doesn't count. Losing claims
stay in claims/; this file is disposable and regenerated, and claims/
is the source of truth.

Also writes data/disclosure_heatmap.csv: vehicle x field -> tier (or
"missing"), for the disclosure heatmap chart.

Run: python scripts/flatten.py
"""
import json
import csv
import glob
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CLAIMS_DIR = ROOT / "claims"

TIER_RANK = {"P": 3, "S": 2, "D": 1, "unverified": 0}

# Fields we expect to track for the disclosure heatmap. Kept in sync
# by hand with schema/vehicle-fields.md; not auto-derived, so update
# both when adding a field.
TRACKED_FIELDS = [
    "identity.msrp_usd",
    "powertrain.motor_count", "powertrain.drive_layout", "powertrain.power_hp",
    "powertrain.torque_lbft", "powertrain.accel_0_60_s", "powertrain.motor_type",
    "powertrain.inverter_semiconductor",
    "battery.pack_kwh", "battery.pack_kwh_basis", "battery.system_voltage_v",
    "battery.cell_format", "battery.cell_chemistry", "battery.cell_supplier",
    "battery.module_count", "battery.structural_pack",
    "charging.port_type", "charging.peak_dc_kw", "charging.onboard_ac_kw",
    "charging.range_added_mi", "charging.range_added_time_min",
    "efficiency.epa_range_mi", "efficiency.epa_kwh_per_100mi", "efficiency.epa_mpge_combined",
    "body.curb_weight_lb", "body.drag_coefficient", "body.length_in",
    "body.width_in", "body.height_in", "body.wheelbase_in",
    "chassis.front_suspension", "chassis.rear_suspension",
    "adas.sensor_suite", "adas.system_name",
]

def main():
    vehicles = json.load(open(DATA_DIR / "vehicles.json"))

    # vid -> field -> winning claim
    winners = defaultdict(dict)
    conflicts = defaultdict(set)
    # vid -> field -> every distinct (value, unit) claimed; >1 means a real disagreement.
    # A higher-tier source confirming the same value is not a conflict.
    seen_values = defaultdict(lambda: defaultdict(set))

    for cf in sorted(glob.glob(str(CLAIMS_DIR / "*.json"))):
        claims = json.load(open(cf))
        for c in claims:
            vid, field = c["vehicle_id"], c["field"]
            seen_values[vid][field].add((json.dumps(c.get("value"), sort_keys=True), c.get("unit", "")))
            if len(seen_values[vid][field]) > 1:
                conflicts[vid].add(field)
            cur = winners[vid].get(field)
            if cur is None or TIER_RANK[c["tier"]] > TIER_RANK[cur["tier"]]:
                winners[vid][field] = c

    # --- flattened.csv ---
    all_fields = sorted({f for v in winners.values() for f in v.keys()})
    header = ["vehicle_id", "make", "model", "trim", "model_year", "lineage_id"]
    for f in all_fields:
        header += [f, f + "__unit", f + "__tier", f + "__conflict", f + "__source_url", f + "__access_date"]

    with open(DATA_DIR / "flattened.csv", "w", newline="") as out:
        w = csv.writer(out)
        w.writerow(header)
        for v in vehicles:
            vid = v["vehicle_id"]
            row = [vid, v["make"], v["model"], v["trim"], v["model_year"],
                   v.get("lineage_id", "")]
            for f in all_fields:
                c = winners.get(vid, {}).get(f)
                if c is None:
                    row += ["", "", "", "", "", ""]
                else:
                    row += [
                        c.get("value", ""),
                        c.get("unit", ""),  # blank = the field's default unit in vehicle-fields.md
                        c.get("tier", ""),
                        "true" if f in conflicts.get(vid, set()) else "false",
                        c.get("source_url", ""),
                        c.get("access_date", ""),
                    ]
            w.writerow(row)

    # --- disclosure_heatmap.csv ---
    with open(DATA_DIR / "disclosure_heatmap.csv", "w", newline="") as out:
        w = csv.writer(out)
        w.writerow(["vehicle_id", "field", "tier"])
        for v in vehicles:
            vid = v["vehicle_id"]
            for f in TRACKED_FIELDS:
                c = winners.get(vid, {}).get(f)
                tier = c["tier"] if c and c.get("value") not in (None, "") else "missing"
                w.writerow([vid, f, tier])

    n_claims = sum(len(v) for v in winners.values())
    print(f"Wrote data/flattened.csv ({len(vehicles)} vehicles x {len(all_fields)} fields, "
          f"{n_claims} winning claims) and data/disclosure_heatmap.csv "
          f"({len(vehicles)} x {len(TRACKED_FIELDS)} tracked fields).")
    if any(conflicts.values()):
        print(f"NOTE: {sum(len(s) for s in conflicts.values())} field(s) had conflicting claims — "
              f"see *__conflict columns in flattened.csv.")

if __name__ == "__main__":
    main()
