# Methodology

## Claims, not spec sheets

The dataset is a set of claims: one field, one value, one source, one access
date, one tier. Charts and tables never contain hand-typed numbers. They
read `data/flattened.csv`, which `scripts/flatten.py` generates from
`claims/*.json`. To fix a wrong number, correct or add a claim and
regenerate. Don't edit the CSV.

## Source tiers

- **P (primary):** the OEM's own spec sheet or press kit, EPA/fueleconomy.gov,
  NHTSA, DOE/Argonne, USPTO, or another government filing.
- **S (secondary):** a credible outlet, an independent teardown, or a
  third-party spec aggregator. Ranked below P even when the number looks
  authoritative, because the underlying source usually can't be checked.
- **D (derived):** computed here from other claims. Always has
  `derivation.formula` and `derivation.inputs`, and usually a list of
  assumptions.
- **unverified:** plausible but unconfirmed. Finding the same number in
  several places doesn't promote it; sites copy each other.

## Why claims instead of a spec table

A spec table makes it easy to fill a gap with a plausible number and hard
to tell a manufacturer's figure from one found on a forum. With claims, both
problems show up in the data. A field nobody discloses appears as "missing"
in the disclosure heatmap. A guessed number can't be entered at all,
because P and S need a real URL and D needs a formula.

## Data sources

- **EPA:** per-vehicle records from the fueleconomy.gov web service
  (`https://www.fueleconomy.gov/ws/rest/vehicle/<id>`), checked against the
  bulk file at https://www.fueleconomy.gov/feg/download.shtml. The EPA id is
  in each claim's notes.
- **NHTSA recalls:** `https://api.nhtsa.gov/recalls/recallsByVehicle?make=...&model=...&modelYear=...`
  (no key needed). The API returns HTTP 400 with `Count: 0` when it doesn't
  recognize a model string, so a 400 doesn't mean zero recalls. Zero-recall
  claims are confirmed against NHTSA's flat file
  (`https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip`) instead.
  Recall queries are by make, model, and year, not trim.

## Known limitations

As of 2026-10-02:

- Lucid Air Pure, Tesla Model Y Premium RWD, Tesla Model 3 Standard RWD,
  and Tesla Model S (non-Plaid) have OEM-sourced claims. Model 3/S OEM
  figures come from Wayback Machine snapshots of tesla.com (live tesla.com
  returns HTTP 403 to scripted fetch). Model 3 MSRP conflicts: Tesla
  Wayback ($38,630 including destination/order fees) vs EPA/Edmunds
  ($36,990). Model 3 width conflicts: Tesla extended-mirrors vs Green Cars
  Compare without-mirrors. Model S MSRP conflicts: EPA/Edmunds ($94,990)
  vs KBB ($96,630). Model S curb weight conflicts by 1 lb (Tesla 4,561 vs
  KBB 4,560). Pack kWh, port type, onboard AC, Model 3 wheelbase/power,
  and Model S exterior dimensions remain secondary-only or missing.
- Phase C OEM core (non-Tesla, 2026-10-02): Hyundai Ioniq 5/6, Kia EV6,
  Equinox EV, Lyriq, Mach-E, ID.4, EX30, R1T, R2, and Lucid Gravity Touring
  gained OEM claims from fetchable OEM/press pages only. Ioniq 6 curb
  weight conflicts (compare-specs 3,395 vs Hyundai News PDF 3,935). EX30
  power conflicts (specs 268 hp vs product page 272 hp). R1T pack conflicts
  (rated 95.6 kWh vs usable 92.5 kWh). BMW i4 atlas trim remains eDrive35,
  which BMW USA no longer lists for 2026 (site shows eDrive40/xDrive40/M60),
  so no OEM core was added for that trim.
- Phase C cleanup (2026-10-02): Porsche Taycan (MY26 tech-specs PDF + NACS
  adapter newsroom), Mercedes CLA 250+ (MBUSA pages now labeled 2027;
  claims carry model_year 2027), Nissan Leaf S+ (US specs + press kit), and
  Chevrolet Bolt LT (newsroom final specs) gained OEM buyer fields.
  Leaf 0-60 and Bolt 0-60 remain missing on fetchable OEM pages. Live
  Porsche configurator is MY2027 with Performance Battery Plus standard;
  MY2026 Performance Battery figures come from the dated tech-specs PDF.

- Lucid's site now shows Model Year 2027. MY2026 Lucid claims come from its
  July 2025 press release and a Wayback Machine snapshot of its MY2026 Air
  Pure page. Weight, dimensions, module count, and charging rates are only
  available from the MY2027 page and carry `model_year: 2027`.
- Orphan `unverified` Lucid and Tesla claims (pack kWh, suspension geometry,
  Tesla motor count/power/port/onboard charger/sensor suite, and similar)
  were removed when the OEM page did not state the value and no re-findable
  P/S URL existed. Gaps remain in the disclosure heatmap. Lucid pack voltage
  still has only an EV Database (EU) secondary claim.
- Most trims were set to the entry-level EPA configuration; each EPA claim's
  notes explain the pick. The base-wheel/charger choices for the R1T, R2,
  Leaf, and Lyriq are assumptions. (Tesla's page confirms its "Premium RWD"
  is EPA's "Long Range RWD".)
- The atlas is mostly MY2026, but three vehicles use the model year that
  actually exists: Rivian R2 and Chevrolet Bolt are MY2027 (per EPA and
  NHTSA), and Hyundai Ioniq 6 is MY2025 (no MY2026 in EPA or NHTSA data, and
  Hyundai's US site sells the 2025). The Bolt trim is LT (Chevrolet entry
  trim; EPA id 50372 has a single undifferentiated BOLT row).
- NHTSA's products endpoint lists MY2026 Model S, Mach-E, and i4 as having
  recalls, but no MY2026 campaign exists for them in the API or the flat
  file. Both claims are recorded as a conflict.
- EPA data doesn't say whether a vehicle's range came from 5-cycle testing,
  the 0.7 multiplier, or an approved factor (40 CFR 600.210-12(d)(3)), so
  range comparisons carry that unknown.
- Sale-status hygiene (checked 2026-10-02): only `chevrolet-bolt-2027` is
  `current`, from Chevrolet's US product page and a 2026-04-22 Chevrolet
  newsroom post saying the 2027 Bolt is available at dealers nationwide.
  The other 19 stay `unverified_availability`. Lucid's live Air Pure buy
  flow is MY2027, so MY2026 Pure was not marked current. Tesla.com blocks
  scripted fetches, so Model Y Premium RWD was not re-confirmed in this
  pass. Rivian R2 deliveries exist but remain invite-gated, so that entry
  was left unverified.

## Running the pipeline

```
pip install -r requirements.txt
python scripts/validate.py    # schema conformance + sourcing rules
python scripts/flatten.py     # regenerates data/flattened.csv and data/disclosure_heatmap.csv
```

Run `validate.py` before every commit that touches `claims/` or
`data/vehicles.json`.
