# EV Atlas

EV Atlas is a sourced comparison of 23 battery-electric vehicles listed for
the U.S. market. Each displayed value originates as a claim with a source
tier, access date, and (for primary and secondary tiers) a URL. Fields
without a qualifying source are left blank. Blank means not found, not zero.

The corpus is mostly model year 2026, with exceptions where that year is
absent from EPA/NHTSA or OEM listings (Hyundai Ioniq 6 and Polestar 2,
2025; Rivian R2 and Chevrolet Bolt, 2027). Rows generally follow the
entry-level EPA configuration; claim notes record trim and wheel or charger
choices.

This is not a ranking. It is not a complete OEM catalog. Compare and Charts
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
site/              static pages (index, compare, charts, methodology + CSS);
                   site/data/ and site/charts/ are generated (gitignored)
docs/
  METHODOLOGY.md   sourcing rules and known gaps
AGENTS.md          instructions for AI coding agents
LICENSE            MIT
```

## Status (2026-10-02)

- Schema, validator, flattener, and static site build succeed on the current
  claim set (on the order of 410+ claims across 23 vehicles).
- All 23 vehicles have NHTSA recall campaign-count claims for their model
  year (API; flat-file cross-check was done for the original 20).
- All 23 have EPA range, efficiency, MPGe, and drive layout from
  fueleconomy.gov.
- Makes include Tesla, Lucid, Rivian, Hyundai, Kia, Ford, GM, VW, BMW,
  Mercedes, Nissan, Genesis, Polestar, and Honda. OEM or newsroom buyer
  fields exist for most vehicles. BMW i4 remains on the atlas trim
  eDrive35, which BMW USA no longer lists for 2026 (lineup is eDrive40 and
  above); no eDrive40 mapping was invented. Pack/MSRP gaps are closed for
  BMW i4 and VW ID.4 (secondary or adjacent-year sources where noted);
  Model Y pack kWh is still blank. Curb weight, 0-60, and peak DC remain
  sparse for LYRIQ, Equinox EV, Leaf, Bolt, Gravity, Rivian R1T peak DC,
  and several OEM silence cases.
- Secondary-tier fills appear where primary OEM text was unavailable (notably
  some Tesla pack and dimension fields). Secondary ranks below primary.
- Sale status: only the 2027 Chevrolet Bolt LT is marked `current`. The
  other 22 remain `unverified_availability`.
- Site pages: Home hosts the Compare table (group by make, year column,
  search and facets, column presets, source tier and URL where present).
  Compare is the same table standalone. Charts cover EPA efficiency,
  battery-side vs wall-side, and disclosure coverage. Methods documents
  sourcing. GitHub Pages deploys from `site/` after validate, flatten, and
  build. Chemistry is an optional column; most cells stay blank until claims
  exist.

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
