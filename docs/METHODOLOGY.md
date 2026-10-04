# Methodology

## Claims, not spec sheets

The dataset is a set of claims: one field, one value, one source, one access
date, one tier. Figures and tables never contain hand-typed numbers. They
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

As of 2026-10-03:

### Scope and blanks

- Blank or em dash cells mean no qualifying source was found, not a value of
  zero. The atlas is not a ranking and not a complete OEM catalog.
- Rows are trim-specific. Most use the entry-level EPA configuration; claim
  notes record wheel, charger, or battery choices. Sister trims can differ.
- Secondary (S) claims fill some gaps where primary OEM text was unavailable.
  Compare and Figures may show an S value; it remains weaker than P.
- When sources disagree, both claims are retained with `conflicts_with`. The
  flattened table keeps the higher tier (then higher confidence) and flags the
  conflict. Compare shows the winning value only; a † marker opens the other
  recorded claim and both sources.

### Markets and test cycles

- `region` on each vehicle is the **spec market** (which market's official
  specs the row records), not brand headquarters or factory country. US-sold
  and China-market variants of the same badge are different `vehicle_id` rows.
- Compare Market filter defaults to US. EPA-only Figures omit non-US rows.
- China-market (`region: CN`) rows use CLTC fields (`efficiency.cltc_range_km`,
  `efficiency.cltc_kwh_per_100km`). Blank EPA fields on CN rows are expected.
  CLTC values are never stored in `efficiency.epa_*`, and the atlas does not
  invent a CLTC↔EPA conversion or cross-cycle ranking.
- China list prices use `identity.msrp_cny` when sourced. The atlas does not
  invent a CNY→USD FX rate into `identity.msrp_usd`.
- NHTSA recall fields are not applied to China-only rows. Blank recall cells
  there mean not queried / not applicable, not zero campaigns.

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
- Recorded conflicts include Model 3 MSRP, Model S MSRP and curb weight,
  and Model Y Premium RWD pack kWh (Car and Driver 80 kWh unstated vs
  Green Cars Compare usable 75 kWh). Model 3 body width uses Green Cars
  Compare without-mirrors 72.8 in; Tesla overall-width-with-mirrors figures
  are not used for `body.width_in`. Model S and MINI Countryman width stay
  blank when only with-mirrors figures are available. Some Tesla port and
  AC fields remain secondary-only or blank.

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
- Leaf and Bolt 0-60 were not stated on the fetchable OEM pages used here;
  secondary Car and Driver instrumented times fill those cells (Leaf
  Platinum+ for the shared 214-hp S+ powertrain; Bolt RS for the shared
  210-hp LT/RS powertrain). Equinox FWD 0-60 likewise uses a C/D FWD test.
- Peak DC densify (2026-10-02 fetch-only pass): R1T Dual Standard 200 kW and
  Prologue 155 kW from Car and Driver; BMW i4 eDrive35 180 kW from BMW USA
  press (MY2023 eDrive35 release). Kia EV6 Light/Standard Range, Toyota bZ
  FWD, and Honda Prologue FWD still lack a fetchable OEM peak-kW or FWD
  0-60 statement; Ioniq 5/6 Standard Range, Lyriq non-V, GV60 RWD, and
  Toyota bZ FWD 0-60 remain blank for the same reason.
- Brand add (2026-10-03): Subaru Solterra Premium AWD uses EPA Solterra AWD
  (non-20in, 288 mi). Jeep Wagoneer S uses EPA Falken-tire AWD (294 mi);
  live jeep.com returned HTTP 403, so buyer fields use Wayback and an
  adjacent-year Launch Edition media PDF (Falken tires). Launch Edition
  horsepower / 0-60 are recorded; Limited starting MSRP is not applied to
  this row. Lexus RZ 350e FWD uses EPA 18in (301 mi). Lexus newsroom pages
  disagree on RZ 350e horsepower (221 vs 224); both claims are retained.
  Lexus and Jeep peak DC kW remain blank where only charge-time language
  appears.
- Brand add (2026-10-03, second pass): GMC Sierra EV Elevation Standard Range
  (EPA Std Range 11 kW / 283 mi); MINI Countryman SE ALL4 18in (EPA 212 mi)
  with MY2025 press/Wayback buyer fields; Dodge Charger Daytona R/T 18in
  (EPA 263 mi). GMC pack kWh not stated on fetchable pages. Dodge R/T MSRP
  and 0-60 omitted (Scat Pack-only figures not applied); peak DC left blank
  where pages quote station kW rather than a vehicle maximum.
- Brand add (2026-10-03, third pass): Acura ZDX RWD (EPA 50023 / 327 mi);
  Ford F-150 Lightning 4WD Standard Range MY2025 (EPA 48707 / 240 mi; no
  MY2026 Lightning EPA row used); Kia EV9 Light Long Range RWD (EPA 49666 /
  305 mi); Nissan Ariya FWD 63 kWh (EPA 50226 / 216 mi). ZDX and Ariya US
  OEM sites mark those nameplates discontinued; MY2024 ZDX / MY2025 US
  Ariya Engage (66 kWh) buyer figures were not applied to the EPA rows.
  Lightning pack (98 kWh usable), CCS1 port, NACS adapter included, and
  11.2 kW onboard AC come from Ford FAQ and the 2025 order guide; MSRP and
  SR 0-60 stay blank (FAQ 0-60 is extended-range only). EV9 buyer fields
  use Kia USA specs-compare; peak DC blank where copy cites a 350 kW
  charger for charge time.
- Lineage add (2026-10-03, fourth pass): VW ID. Buzz Pro S RWD MY2025 (EPA
  48444 / 234 mi); Cadillac OPTIQ RWD 11 kW (EPA 49949 / 317 mi); Chevrolet
  Blazer EV FWD (EPA 49644 / 312 mi). Buzz 0-60 uses Pro S RWD 7.4 s, not
  marketing 4MOTION 6 s. OPTIQ EPA `evMotor` reads `210 and 255 kW ACPM`
  while OEM prose is single-motor RWD; both are recorded without resolving.
  OPTIQ-V / dual-motor figures not applied. Blazer SS 102 kWh / 190 kW and
  SS 0-60 not applied to the FWD LT/RS 85 kWh / 150 kW row.
- Lineage add (2026-10-03, fifth pass): Chevrolet Silverado EV Std Range WT
  11 kW (EPA 49642 / 286 mi); Cadillac VISTIQ 11 kW (EPA 49636 / 305 mi);
  Hyundai Ioniq 9 S RWD (EPA 49661 / 335 mi). Silverado Ext/Max and 19 kW
  charger rows not applied; newsroom WT Standard $54,895 vs live Custom
  $55,895 MSRP both retained; pack kWh and curb blank (named packs only;
  FAQ curb is a range). VISTIQ uses the 11 kW / 305 mi row, not 19 kW /
  300 mi; hp/torque/0-60 are Velocity Max figures; width withheld
  (with-mirrors only). Ioniq 9 AWD (EPA 49662) not applied; onboard AC and
  0-60 blank on Hyundai compare-specs.
- Thin-row densify (2026-10-03): Lightning SR gains order-guide 452 hp /
  775 lb-ft and dual-motor count; MSRP, SR 0-60, and peak DC stay blank
  (FAQ 0-60 is ER-only; charging FAQ cites station 150+ kW). Daytona R/T
  gains Stage 1 404 lb-ft from MY2024 Stellantis pricing release
  (`model_year` 2024); R/T MSRP, 0-60, and peak DC still blank. Sierra EV
  Std Range gains EPA 11 kW onboard AC and 2-motor count; pack kWh and
  curb still absent on fetchable OEM pages. Lexus RZ 350e peak DC 150 kW
  and claimed 7.2 s 0-60 from Car and Driver (221 vs 224 hp conflict
  retained). Blazer EV FWD gains GM newsroom 220 hp / 243 lb-ft plus C/D
  FWD LT curb, width-without-mirrors, and 11.5 kW AC; FWD 0-60 still blank
  (C/D instrumented AWD/SS only); Chevrolet previous-year $44,700 vs GM
  newsroom $46,495 MSRP both retained. OPTIQ gains width without mirrors
  75.3 in from Cadillac preceding-year FAQ; curb and RWD 0-60 still blank.
  Ariya FWD 63 kWh and ZDX RWD remain EPA/NHTSA-only (discontinued US OEM
  pages; MY2025 66 kWh / MY2024 A-Spec buyer figures not applied).
- Conflict re-fetch and closable densify (2026-10-03): every retained
  conflict URL was re-opened. Values still present for Blazer MSRP
  ($44,700 vs $46,495), Lexus RZ hp (221 vs 224), Model 3 MSRP, Model S
  MSRP/curb, Model Y pack (80 unstated vs 75 usable), Rivian R1T pack
  (95.6 rated vs 92.5 usable; basis conflicts linked), Volvo EX30 hp
  (268 vs 272), and IONIQ 6 curb (compare-specs 3,395 vs PDF 3,935; 3,395
  confidence lowered as a likely transposed typo under a mislabeled Long
  Range row). Earlier densify fills for Lightning SR, Sierra Std Range,
  Prologue, GV60, Equinox, Polestar 2, and related buyer fields remain.
- Compare-column densify (2026-10-03), field-first for
  `powertrain.torque_lbft`, `charging.onboard_ac_kw`, and `body.width_in`
  (without-mirrors only): torque now 34/39 (was 16); onboard AC 31/39
  (was 25); body width 34/39 (was 28, after removing with-mirrors-only
  Model S and MINI Countryman figures). Notable P fills include Hyundai
  IONIQ 5/6 and Kia EV6 Light RWD 258 lb-ft, Cadillac LYRIQ RWD 325 lb-ft
  (not LYRIQ-V), Ford Mach-E Select RWD 387 lb-ft, Porsche Taycan
  Performance Battery 302 lb-ft with launch control, Mercedes CLA 250+
  247 lb-ft, Audi Q4 45 e-tron 402 lb-ft / 11 kW AC / 73.4 in width,
  Rivian Dual-Motor R1T 610 lb-ft and R2 Performance 609 lb-ft, Lucid Air
  Pure 406 lb-ft (upgrades prior EV Database 550 Nm S claim; conflict
  retained), BMW i4 eDrive35 11 kW AC, and Lucid Air Pure width 76.2 in
  without mirrors. Lexus RZ 350e width upgraded S→P at 74.6 in from the
  Canada TCI product sheet (same number; torque 269 Nm with unit Nm).
  Intentionally blank: Ariya FWD 63 kWh and ZDX RWD; Tesla torque (OEM
  silent); Model Y/S and Rivian/Prologue/Jeep onboard AC where OEM did
  not state vehicle peak kW; Model S and MINI width (mirrors-only).
  Daytona R/T AC and width use C/D shared-pack figures with medium
  confidence (page defaults to Scat Pack; power figures not applied).
  OPTIQ RWD curb and 0-60 stay blank (OPTIQ-V figures not applied).
- Tesla Model Y Premium RWD pack kWh remains undisclosed on fetchable Tesla
  pages; secondary C/D vs Green Cars Compare conflict retained. Polestar 2
  Single Motor US retail was dropped for 2025; buyer fields use Polestar UK
  Long range Single motor specs. Cargo volume and towing capacity are not
  tracked fields yet.

### Model years, recalls, availability

- Corpus is mostly MY2026. Rivian R2, Chevrolet Bolt, and BMW iX3 50 xDrive
  are MY2027; VW ID. Buzz, Ford F-150 Lightning Standard Range, Hyundai
  Ioniq 6, and Polestar 2 are MY2025 (no matching MY2026 EPA row used for
  those entries). No EPA row for BMW iX3 40 was found; the atlas uses the
  entry listed iX3 50 xDrive 20-inch all-season configuration.
- Toyota bZ uses the entry FWD EPA row labeled energy capacity 200 Ah
  (236 mi), paired with Toyota newsroom 57.7 kWh / XLE FWD pricing, not the
  FWD Plus 191 Ah / 314 mi configuration.
- Subaru Solterra, Jeep Wagoneer S, Lexus RZ, GMC Sierra EV, MINI Countryman
  SE, Dodge Charger Daytona, Acura ZDX, Kia EV9, Nissan Ariya, VW ID. Buzz,
  Cadillac OPTIQ, Chevrolet Blazer EV, Chevrolet Silverado EV, Cadillac
  VISTIQ, and Hyundai Ioniq 9 were added as new makes/lineages (plus Ford
  Lightning as a second Ford lineage). NHTSA products lists some BEV suffixes
  that need careful model strings on recallsByVehicle; Lightning matched only
  as `F-150 LIGHTNING BEV` (bare `F-150` returns ICE campaigns and must not
  be used). ID. Buzz matched as `ID. BUZZ`. Blazer EV matched as `BLAZER EV`
  (bare `BLAZER` is ICE). Silverado EV matched as `SILVERADO EV` (bare
  `SILVERADO` is ICE). OPTIQ and VISTIQ matched bare model strings. Ioniq 9
  matched as `IONIQ 9` (`IONIQ9` / `IONIQ 9 BEV` returned HTTP 400). ZDX and
  Ariya MY2026 have zero flat-file campaigns (API HTTP 400 alone does not
  prove zero). MINI Countryman SE ALL4 MY2026 has zero flat-file campaigns
  (ICE S ALL4 does not count for the EV row).
- NHTSA's products endpoint sometimes lists MY2026 Model S, Mach-E, and i4
  as having recalls when no MY2026 campaign exists in the API or flat file.
  Both views are recorded as conflicts. Recall queries are not trim-specific.
- BMW iX3 MY2027 (`bmw-ix3-50-xdrive-2027`) still has no
  `recalls.campaign_count` claim after a 2026-10-03 retry. recallsByVehicle
  returned HTTP 400 / Count 0 for model strings including `IX3`, `iX3`,
  `X3`, and `I X3` (unmatched string, not a confirmed zero). The flat file
  `FLAT_RCL_POST_2010.zip` has no BMW MY2027 campaign rows and no IX3
  rows of any year. Products for BMW MY2027 lists only
  `X6 XDRIVE40I M SPORT` (no iX3). Count is left blank rather than written
  as zero until a matching NHTSA model string exists.
- Sale status confirmation (2026-10-03; `status` /
  `status_checked_date` on `data/vehicles.json`; URLs checked that day):
  - `current`: `chevrolet-bolt-2027` LT,
    https://www.chevrolet.com/electric/bolt-ev; `nissan-leaf-2026` 75 kWh,
    https://www.nissanusa.com/vehicles/electric-cars/leaf.html;
    `hyundai-ioniq5-2026` SE RWD Standard Range,
    https://www.hyundaiusa.com/us/en/vehicles/2026-ioniq-5;
    `honda-prologue-fwd-2026` Single Motor FWD,
    https://automobiles.honda.com/prologue; `ford-mustang-mach-e-2026`
    Select RWD standard-range battery,
    https://www.ford.com/suvs/mach-e/2026/models/select/;
    `kia-ev6-2026` Light RWD (atlas Standard Range RWD),
    https://www.kia.com/us/en/ev6/specs-compare;
    `chevrolet-silverado-ev-std-range-2026` Custom / Std Range,
    https://www.chevrolet.com/electric/silverado-ev;
    `hyundai-ioniq9-rwd-2026` S RWD,
    https://www.hyundaiusa.com/us/en/vehicles/ioniq-9/s.
  - `discontinued`: `nissan-ariya-fwd-63kwh-2026`,
    https://www.nissanusa.com/vehicles/discontinued/ariya.html;
    `acura-zdx-rwd-2026`, https://www.acura.com/suvs/zdx ("no longer
    available").
  - Remaining 31 stay `unverified_availability` when the live page does not
    clearly show the atlas trim/year (for example Equinox atlas MY2026
    while Chevrolet emphasizes 2027; Tesla trim naming; iX3 US retail
    readiness). Rivian R2 deliveries may be invite-gated; Lucid live buy
    flows may already be MY2027.

## Running the pipeline

```
pip install -r requirements.txt
python scripts/validate.py    # schema conformance + sourcing rules
python scripts/flatten.py     # regenerates data/flattened.csv and data/disclosure_heatmap.csv
```

Run `validate.py` before every commit that touches `claims/` or
`data/vehicles.json`.
