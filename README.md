# EV Atlas

EV Atlas is a sourced comparison of battery-electric vehicles by spec market.
Each displayed value originates as a claim with a source tier, access date,
and (for primary and secondary tiers) a URL. Fields without a qualifying
source are left blank. Blank means not found, not zero. Compare defaults to
the US market; China-market rows are opt-in and sparse at first.

The corpus is mostly model year 2026, with exceptions where that year is
absent from EPA/NHTSA or OEM listings (Volkswagen ID. Buzz, Ford F-150
Lightning Standard Range, Hyundai Ioniq 6, and Polestar 2, 2025; Rivian R2,
Chevrolet Bolt, and BMW iX3 50 xDrive, 2027). Rows generally follow the
entry-level EPA configuration; claim notes record trim and wheel or charger
choices.

This is not a ranking. It is not a complete OEM catalog. Compare and Figures
read generated tables only; they do not contain hand-typed specifications.

Methods, source tiers, and known limitations:
[docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## Layout

```
schema/            JSON Schemas for a claim and a vehicle, plus the field
                   dictionary (units, typical source tier per field)
data/
  vehicles.json            vehicle registry (identity only, no specs)
  flattened.csv            generated: one row per vehicle, for charts
  disclosure_heatmap.csv   generated: vehicle x field -> tier
claims/            one JSON file per vehicle; the source of truth for every number
scripts/
  validate.py      schema and sourcing-rule checks; run before every commit
  flatten.py       claims/*.json -> data/*.csv
  build_site.py    copies chart CSVs/specs into site/ for preview and Pages
charts/            Vega-Lite specs; read only from data/*.csv
site/              static pages (index, compare, figures, methodology + CSS);
                   site/data/ and site/charts/ are generated (gitignored)
docs/
  METHODOLOGY.md   sourcing rules and known gaps
AGENTS.md          instructions for AI coding agents
LICENSE            MIT
```

## Status (2026-10-03)

- Schema, validator, flattener, and static site build succeed on the current
  claim set (851 claims across 42 US-market vehicles plus a small
  China-market stub set with empty claims; 833 winning flattened claims).
  Compare has a Market filter (US / CN) that defaults to US. EPA Figures
  exclude non-US rows. CN coverage is opt-in and sparse until CLTC claims
  are sourced.
- 41 of 42 US vehicles have NHTSA recall campaign-count claims for their model
  year (API and/or flat-file). BMW iX3 MY2027 still has no recall count:
  recallsByVehicle returned HTTP 400 / Count 0 for IX3, iX3, X3, and
  related strings (unmatched model string, not a confirmed zero); the
  flat file has no BMW MY2027 rows and no IX3 rows of any year; products
  for BMW MY2027 lists only X6 XDRIVE40I M SPORT.
- All 42 US-market rows have EPA range, efficiency, MPGe, and drive layout from
  fueleconomy.gov. China-market stubs intentionally leave EPA and NHTSA blank.
- Makes include Tesla, Lucid, Rivian, Hyundai, Kia, Ford, GM (Chevrolet,
  Cadillac, GMC), VW, BMW, Mercedes, Nissan, Genesis, Polestar, Honda,
  Toyota, Audi, Subaru, Jeep, Lexus, MINI, Dodge, and Acura. Newest lineage
  rows: Chevrolet Silverado EV Std Range WT 11 kW (EPA 49642), Cadillac
  VISTIQ 11 kW (EPA 49636), Hyundai Ioniq 9 S RWD (EPA 49661), plus prior
  ID. Buzz / OPTIQ / Blazer and densify fills. Intentionally blank on the
  new trio: Silverado pack kWh and curb; VISTIQ width (mirrors-only);
  Ioniq 9 onboard AC and 0-60. Remaining blanks are in Methods.
- Secondary-tier fills appear where primary OEM text was unavailable (notably
  some Tesla pack and dimension fields). Secondary ranks below primary.
- Sale status (2026-10-03 confirmation pass): `current` for Bolt LT
  (chevrolet.com/electric/bolt-ev), Leaf 75 kWh (nissanusa.com Leaf),
  IONIQ 5 SE RWD Standard Range (hyundaiusa.com/2026-ioniq-5), Prologue
  Single Motor FWD (automobiles.honda.com/prologue), Mach-E Select RWD
  standard range (ford.com/.../mach-e/2026/models/select/), EV6 Light
  RWD / atlas Standard Range RWD (kia.com/.../ev6/specs-compare),
  Silverado EV Custom / Std Range (chevrolet.com/electric/silverado-ev),
  and Ioniq 9 S RWD (hyundaiusa.com/.../ioniq-9/s).
  `discontinued` for Ariya (nissanusa.com/.../discontinued/ariya.html) and
  ZDX (acura.com/suvs/zdx, "no longer available"). The other US rows remain
  `unverified_availability` (including Equinox MY2026 while live Chevy
  pages emphasize 2027, Tesla trims, VISTIQ preceding-year, and iX3 retail
  readiness).
- Site pages: Home hosts the Compare table (Market filter defaulting to US,
  group by make, year column, search and facets, column presets, EPA and
  CLTC columns, source tier and URL where present). Compare is the same
  table standalone. Spec headers can be dragged to reorder
  (session-persisted). Figures cover EPA efficiency, battery-side vs
  wall-side, disclosure coverage, and range vs MSRP, pack kWh, and curb
  weight (US-market / EPA only). Methods documents sourcing and CLTC vs EPA.
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
