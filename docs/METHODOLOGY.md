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

### Scope and blanks

- Blank or em dash cells mean no qualifying source was found, not a value of
  zero. The atlas is not a ranking and not a complete OEM catalog.
- Rows are trim-specific. Most use the entry-level EPA configuration; claim
  notes record wheel, charger, or battery choices. Sister trims can differ.
- Secondary (S) claims fill some gaps where primary OEM text was unavailable.
  Compare and Charts may show an S value; it remains weaker than P.
- When sources disagree, both claims are retained with `conflicts_with`. The
  flattened table keeps the higher tier and flags the conflict.

### Efficiency, pack, and performance figures

- `efficiency.epa_kwh_per_100mi` is wall-side (includes charging losses).
  Derived battery-side kWh/100mi uses pack energy and EPA range and is not
  interchangeable with the EPA label figure.
- Derived metrics that use pack energy require `battery.pack_kwh_basis` set
  to gross or usable, not unstated.
- EPA range labels do not state whether range used 5-cycle testing, the 0.7
  multiplier, or an approved factor (40 CFR 600.210-12(d)(3)).
- OEM peak DC kW is often a marketing maximum under unstated conditions, not
  a sustained rate. OEM 0-60 times are manufacturer claims, not independent
  instrumented tests, unless notes say otherwise.
- MSRP is the base figure as stated for the configured trim in the claim;
  destination, tax, and options vary.

### Tesla and Lucid

- Live tesla.com often blocks scripted fetch (HTTP 403). Model 3 and Model S
  OEM figures commonly use Wayback Machine snapshots of Tesla pages; archived
  pages can lag the live showroom.
- Lucid's live site advances to the next model year early. MY2026 Lucid
  claims draw on press releases, technical PDFs, and Wayback snapshots; some
  weight, dimension, and charging figures carry `model_year: 2027`.
- Recorded conflicts include Model 3 MSRP and width, and Model S MSRP and
  curb weight. Some Tesla pack, port, and dimension fields remain
  secondary-only or missing.

### OEM coverage and trims

- Most non-Tesla vehicles have at least partial OEM or newsroom buyer fields
  (MSRP, pack, charging, dimensions, or performance) from fetchable pages.
- BMW i4 in this atlas is eDrive35. BMW USA no longer lists eDrive35 for
  2026 (lineup is eDrive40 / xDrive40 / M60). No eDrive40 mapping was
  invented. MSRP uses the EPA side-by-side page value attributed to
  Edmunds. Pack and curb weight use a BMW Group press technical-data
  attachment for the refreshed eDrive35 (adjacent model year), not a live
  BMW USA 2026 configurator.
- Genesis GV60 MY2026 MSRP uses the Genesis USA offers page. Pack and NACS
  port claims cite the live product page, which later shows 2027 labeling
  while still stating 84 kWh and up to 306 miles EPA range; those claims
  carry `model_year: 2027` where needed.
- Mercedes CLA Electric claims may cite pages labeled 2027 while the atlas
  vehicle id remains 2026; those claims carry `model_year` when needed.
- Honda Prologue Supercharger access is described via a NACS-CCS adapter;
  the atlas records the vehicle port as CCS.
- Leaf and Bolt 0-60 were not stated on the fetchable OEM pages used here.
- Tesla Model Y Premium RWD pack kWh remains undisclosed on fetchable Tesla
  pages; MSRP uses a Chevrolet competitive comparison listing when the live
  Tesla page did not expose Premium RWD pricing. Polestar 2 Single Motor
  US retail was dropped for 2025; weight, 0-60, and peak DC use Polestar UK
  Long range Single motor specs. Cargo volume and towing capacity are not
  tracked fields yet.

### Model years, recalls, availability

- Corpus is mostly MY2026. Rivian R2 and Chevrolet Bolt are MY2027; Hyundai
  Ioniq 6 and Polestar 2 are MY2025 (no matching MY2026 EPA row used for
  those entries).
- NHTSA's products endpoint sometimes lists MY2026 Model S, Mach-E, and i4
  as having recalls when no MY2026 campaign exists in the API or flat file.
  Both views are recorded as conflicts. Recall queries are not trim-specific.
- Only `chevrolet-bolt-2027` is marked `current` (Chevrolet product page and
  newsroom). The other vehicles remain `unverified_availability`. Rivian R2
  deliveries may be invite-gated; Lucid live buy flows may already be MY2027.

## Running the pipeline

```
pip install -r requirements.txt
python scripts/validate.py    # schema conformance + sourcing rules
python scripts/flatten.py     # regenerates data/flattened.csv and data/disclosure_heatmap.csv
```

Run `validate.py` before every commit that touches `claims/` or
`data/vehicles.json`.
