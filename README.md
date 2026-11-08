# EV Atlas

EV Atlas is a sourced comparison of battery-electric vehicles by spec market.
Each displayed value originates as a claim with a source tier, access date,
and (for primary and secondary tiers) a URL. Fields without a qualifying
source are left blank. Blank means not found, not zero. Compare defaults to
the US market; China-market rows are opt-in and sparse at first.

The corpus remains centered on recent US EPA years, with multi-year lineages
where sources open cleanly. Lucid Air covers Pure (2024–2025 RWD; 2023 AWD)
and Grand Touring (2022–2025). Lucid Gravity covers Touring 2026–2027 and
Grand Touring 2025 (no Touring EPA row that year). Rivian R1 Dual spans
2023–2026 (Dual Large / Dual Standard Plus / Dual Standard by year).
Chevrolet Equinox EV FWD covers 2024–2027. Prior Bolt EV covers 2017–2023
(`chevrolet-bolt-ev` lineage), distinct from the 2027 Bolt. Other one-offs
remain where that year is the only EPA/OEM listing (ID. Buzz and Lightning
SR 2025; Ioniq 6 and Polestar 2 2025; Rivian R2 and BMW iX3 2027). Rows
generally follow the entry-level EPA configuration; claim notes record trim
and wheel or charger choices.

This is not a ranking. It is not a complete OEM catalog. Compare and Figures
read generated tables only; they do not contain hand-typed specifications.

Methods, source tiers, and known limitations:
[docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Layout

```
schema/            JSON Schemas for vehicle/make claims, plus field dictionaries
data/
  vehicles.json            vehicle registry (identity only, no specs)
  flattened.csv            generated: one row per vehicle, for charts
  disclosure_heatmap.csv   generated: vehicle x field -> tier
claims/            one JSON file per vehicle; source of truth for vehicle specs
  makes/           one JSON file per make; thin org identity claims (not flattened)
scripts/
  validate.py      schema and sourcing-rule checks; run before every commit
  flatten.py       claims/*.json -> data/*.csv (vehicle claims only)
  build_site.py    copies chart CSVs/specs into site/; writes compare.json and makes.json
charts/            Vega-Lite specs; read only from data/*.csv
site/              static pages (index, compare, makes, figures, methodology + CSS/JS);
                   site/data/ and site/charts/ are generated (gitignored)
docs/
  METHODOLOGY.md   sourcing rules and known gaps
AGENTS.md          instructions for AI coding agents
LICENSE            MIT
```

## Status (2026-11-05)

- Schema, validator, flattener, and static site build succeed on the current
  claim set (1672 claims across 72 US-market and 8 China-market vehicles;
  1635 winning flattened claims). Compare has a Market filter (US / CN)
  that defaults to US. EPA Figures exclude non-US rows; a CLTC range vs
  pack figure covers CN rows only (CLTC ≠ EPA; not a ranking). CN rows are
  opt-in; see Methods for which CN fields are still blank or secondary-only.
- Make dossiers (v3): `makes.html` lists makes in EV Atlas with identity
  coverage (blank / partial / filled); `make.html?m=` shows a Background block
  with number-free summary and claim-backed org card (`claims/makes/<slug>.json`
  → `makes.json`), including brand type, EV focus, and home market when sourced,
  plus fleet table, filled-field min–max / stated-on-N-of-M, chemistry /
  cell-supplier / port atlas patterns, and conflict or disclosure-gap highlights.
  Keyed by make (Chevrolet ≠ Cadillac). Not company encyclopedias, rankings, or
  full OEM catalogs. Background seeded for a majority of corpus makes from opened
  OEM/IR pages; Acura, Dodge, Ford, Hyundai, Jeep, Lexus, and Mercedes-Benz stay
  identity-blank where sources did not open cleanly in this pass. Waymo and Zoox
  have thin make identity for the new sparse robotaxi stubs.
- Fleet powertrain transparency (2026-11-05 densify + Lucid lineage pass):
  motor count 57/62 (Compare shows Single/Dual/Tri/Quad from the count);
  Tesla Model Y / 3 / S motor_count filled (Edmunds S for Y/3; Tesla Dual
  Motor P for non-Plaid S). Still blank: Waymo/Zoox and Lucid Air Pure AWD
  2023 / Grand Touring 2022–2023 pending opened OEM motor language.
  Silverado Std Range pack 119 kWh remains secondary (Edmunds). NCMA remains
  distinct from NMC. Lucid chemistry still blank. Waymo/Zoox chemistry blank.
- Lucid Air multi-year (2026-11-05): Pure RWD 2024–2025, Pure AWD 2023, and
  Grand Touring 2022–2025 (EPA + NHTSA; OEM tech PDFs for Pure 2024–2025 and
  GT 2024–2025).
- Lineage expansion (2026-11-05, same session): Lucid Gravity Touring 2027 +
  GT 2025; Rivian R1 Dual Standard 2025, Dual Standard Plus 2024, Dual Large
  2023 (R1T and R1S); Equinox EV FWD 2024/2025/2027 with 2024 newsroom buyer
  fields; Bolt EV 2017–2023 (OEM densify on 2022–2023 newsroom specs).
  Easiest repeatable sources remain Lucid PDFs/IR, EPA bulk/XML, Chevrolet
  newsroom tables, Rivian Dual-Motor support pages, and NHTSA
  recallsByVehicle.
- New US rows (2026-10-05): Rivian R1S Dual Standard (EPA 49717), Rivian R1T
  Dual Large (EPA 49708), Lucid Air Grand Touring (EPA 49966 / 512 mi 19in),
  plus sparse Waymo Ojai and Zoox Robotaxi fleet/AV stubs (not retail EPA or
  MSRP peers; see Methods).
- 44 of 47 US vehicles have NHTSA recall campaign-count claims for their model
  year (API and/or flat-file). BMW iX3 MY2027 still has no recall count
  after a second 2026-10-03 retry: recallsByVehicle returned HTTP 400 /
  Count 0 for IX3, iX3, X3, I X3, IX 3, I-X3, and iX 3 (unmatched model
  string, not a confirmed zero); the flat file has no BMW MY2027 rows and
  no IX3 rows of any year; products for BMW MY2027 lists only
  X6 XDRIVE40I M SPORT. Waymo and Zoox leave NHTSA blank (not standard
  retail make/model queries in this pass).
- All retail US-market EPA rows have range, efficiency, MPGe, and drive layout
  from fueleconomy.gov. Waymo/Zoox intentionally leave EPA blank. China-market
  rows intentionally leave EPA and NHTSA blank.
- China-market densification (2026-10-03) plus CN add (2026-10-04): Compare
  uses `identity.msrp_usd` only (`msrp_cny` kept as FX input). CN list
  prices convert via Federal Reserve H.10 / FRED DEXCHUS 2026 YTD mean
  through 2026-09-25 (6.8228 CNY/USD; FRED re-accessed 2026-10-04, same
  mean reused); not a full-year average; not a US MSRP. Prior five CN
  rows keep buyer charging/accel fills. New CN rows: BYD Han EV 506KM
  尊贵型, Zeekr 7X 后驱智驾版 75 kWh, NIO New ES6 75 kWh (each with CLTC
  range, pack, drive, and FX-converted USD MSRP). BYD Seal primary upgrade
  still failed (byd.com / MIIT non-extractable); remains aggregator S.
  No CN `GB_T` port claims (no opened page named GB/T or 国标充电口).
- Makes include Tesla, Lucid, Rivian, Hyundai, Kia, Ford, GM (Chevrolet,
  Cadillac, GMC), VW, BMW, Mercedes, Nissan, Genesis, Polestar, Honda,
  Toyota, Audi, Subaru, Jeep, Lexus, MINI, Dodge, Acura, Waymo, Zoox, plus
  CN BYD, Zeekr, NIO, Xiaomi, and XPeng. Newest US lineage rows: Rivian R1S
  Dual Standard, Rivian R1T Dual Large, Lucid Air Grand Touring, Waymo Ojai,
  Zoox Robotaxi, plus prior Silverado / VISTIQ / Ioniq 9 and densify fills.
  Buyer blank fill notes from 2026-10-04 remain in Methods.
  Compare Accel is Accel (s) with subtitle `cycle in cell` and per-cell
  `(0–100 km/h)` when claim basis is 0-100. Remaining blanks are in Methods.
- Secondary-tier fills appear where primary OEM text was unavailable (notably
  some Tesla pack and dimension fields, Zoox pack/voltage). Secondary ranks
  below primary.
- Sale status (2026-10-03; two confirmation passes): `current` for Bolt LT,
  Leaf 75 kWh, IONIQ 5 SE RWD SR, Prologue Single Motor FWD, Mach-E Select
  RWD SR, EV6 Light RWD, Silverado EV Custom / Std Range, Ioniq 9 S RWD,
  plus second-pass IONIQ 6 SE Standard Range (hyundaiusa.com/.../ioniq-6),
  ID.4 Pro RWD (vw.com/.../id-4.html), EV9 Light Long Range RWD
  (kia.com/.../ev9/specs-compare), RZ 350e FWD (lexus.com/models/RZ),
  ID. Buzz Pro S (vw.com/.../id-buzz.html), and Solterra Premium AWD
  (subaru.com/.../solterra/2026/specs-trim.html).
  `discontinued` for Ariya, ZDX, BMW i4 eDrive35 (bmwusa.com i4 Gran Coupe
  FAQ: eDrive40 / xDrive40 / M60 only), and Polestar 2 Single Motor (US
  specifications list Dual motor only). Remaining rows stay
  `unverified_availability` (including new Rivian/Lucid/Waymo/Zoox rows;
  Equinox / OPTIQ / Blazer / bZ MY2026 vs 2027 OEM pages, Genesis GV60
  2027-titled retail page, Tesla/Lucid/R2/iX3/CLA quirks; URLs in Methods).
- Site pages: Home hosts the Compare table (Market filter defaulting to US,
  group by make, year column, search and facets, a-la-carte Spec columns
  with Buyer/Efficiency/Charging/Chemistry presets as shortcuts, EPA and
  CLTC columns, source tier and URL where present). Buyer defaults are
  narrower; Pack (kWh) folds pack basis into the cell. Compare is the same
  table standalone. Spec headers can be dragged to reorder
  (session-persisted). Figures cover EPA efficiency, battery-side vs
  wall-side, disclosure coverage, US range vs MSRP / pack / curb weight,
  and CLTC range vs pack for China-market rows. Methods documents sourcing
  and CLTC vs EPA.
  GitHub Pages deploys from `site/` after validate, flatten, and build.
  Chemistry and voltage stay sparse until claims exist.

## Running it

```
pip install -r requirements.txt
python scripts/validate.py
python scripts/flatten.py
```

## Preview the page

```
npm run build:site
npm run preview
```

That regenerates the CSVs, copies them into `site/`, and serves
`http://localhost:4173`. Or without npm:

```
python scripts/flatten.py
python scripts/build_site.py
python3 -m http.server 4173 --directory site
```
