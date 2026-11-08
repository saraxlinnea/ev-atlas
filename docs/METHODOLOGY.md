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

As of 2026-11-05:

### Scope and blanks

- Blank or em dash cells mean no qualifying source was found, not a value of
  zero. The atlas is not a ranking and not a complete OEM catalog.
- Make dossiers (`makes.html` / `make.html`) summarize only vehicles already
  in the corpus, keyed by `make` (no brand-group rollups). Spec summaries use
  flattened winners: min–max or value counts among stated cells, never averages
  over blanks. EPA and CLTC stay market-separated; NHTSA remains US-only.
  Highlights are conflict counts and disclosure gaps only, not strategy copy.
- Make identity (v3) is a separate claim layer in `claims/makes/<slug>.json`
  (`schema/make-fields.md`, `schema/make-claim.schema.json`). Allowed org
  fields: HQ city/country, optional parent, `org.brand_type` (standalone /
  division / jv_brand), `org.ev_focus` (bev_only / multi_powertrain /
  nev_bev_phev), `org.home_market` (US / CN / EU / KR / JP / multi), optional
  founded year, listing status/ticker when the make is the listed issuer, a
  number-free `org.summary` (two to three short sentences), and optional
  period-stamped deliveries with required scope. `build_site.py` merges winning
  make claims into `site/data/makes.json`; `flatten.py` stays vehicle-only.
  Wikipedia is not tier P. Parent may repeat across brands; fleets are never
  merged. Deliveries scoped to a parent group must say so and must not be
  labeled as the make's sales. Identity coverage still keys on HQ city/country
  plus summary; denser background fields are optional. Partial coverage is
  expected; blank means not found. No revenue, market-cap, employee series,
  leadership bios, or company-group hub pages in this pass.
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
- Compare Market filter defaults to US. EPA Figures omit non-US rows. A
  separate CLTC range vs pack figure includes China-market (`region: CN`)
  rows only. Spec columns are a-la-carte; Buyer/Efficiency/Charging/Chemistry
  presets replace the checklist rather than gating which columns appear.
  Pack (kWh) displays pack basis inline when known; MPGe is Efficiency-preset
  only. Buyer default keeps wall-side kWh/100 mi. When Market is CN-only,
  Buyer and Efficiency also default-on CLTC range and CLTC kWh/100 km (EPA
  columns stay visible; blanks on CN rows are expected).
- China-market (`region: CN`) rows use CLTC fields (`efficiency.cltc_range_km`,
  `efficiency.cltc_kwh_per_100km`). Blank EPA fields on CN rows are expected.
  CLTC values are never stored in `efficiency.epa_*`, and the atlas does not
  invent a CLTC↔EPA conversion or cross-cycle ranking. CLTC and EPA figures
  are never mixed in one encoding; neither plot is a ranking.
- China list prices are sourced in CNY (`identity.msrp_cny`), then Compare
  shows `identity.msrp_usd` as a tier D conversion. Shared FX for the
  2026-10-03 CN pass (reused 2026-10-04; FRED DEXCHUS re-accessed that day
  still shows latest observation 2026-09-25; no new mean invented): Federal
  Reserve H.10 noon buying rates as published on FRED series DEXCHUS
  (Chinese yuan per U.S. dollar), simple mean of 185 daily observations
  from 2026-01-02 through 2026-09-25. Mean rate **6.8228 CNY per USD**.
  This is a 2026 YTD average through that last published day, not a
  full-year 2026 average. Series URL:
  https://fred.stlouisfed.org/series/DEXCHUS (Board of Governors H.10).
  USD = CNY / 6.8228, rounded to nearest dollar. Notes on each derived
  claim state original CNY, rate, series, window, and that the figure is a
  China list price converted to USD, not a US MSRP. US OEM USD MSRP and
  FX-converted China list price are not the same kind of price. Default
  USD MSRP charts stay US-only.
- NHTSA recall fields are not applied to China-only rows. Blank recall cells
  there mean not queried / not applicable, not zero campaigns.
- China-market densification pass (2026-10-03), same five vehicles. Compare
  shows one MSRP column (`identity.msrp_usd`); `identity.msrp_cny` stays in
  claims as the FX input only.
  - XPeng G6 `625长续航 Max 科技版`: tier P config table (CLTC 625 km,
    12.5 kWh/100km, MSRP 176,800 CNY, RWD, 218 kW / 450 Nm, 0-100 km/h
    6.4 s; LFP, 800V, SiC rear inverter, CIB, single PM). Pack 68.5 kWh
    (unstated) from XPENG Goodwood / Europe press (medium confidence).
    Peak DC 451 kW from outlet report of official preheat table (tier S;
    OEM table states 10%-80% ≥12 min on S5, not a kW figure). Port and
    onboard AC still blank on opened pages.
  - NIO New ET5 75 kWh: CLTC 585 km and 75 kWh from mileage calculator;
    MSRP 298,000 CNY from launch news; AWD / 480 PS / 700 Nm from Wayback
    nio.cn/et5 (medium). Manual voltages 386 V / 367 V for 75 kWh variants;
    chemistry enum still blank for hybrid 三元铁锂. Buyer fill: 0-100 km/h
    4 s (ZOL / BitAuto, tier S), peak DC 180 kW (qcwp, tier S), CLTC
    14 kWh/100km (BitAuto, tier S). Port and onboard AC still blank
    (manual describes AC adapter / DC charge, no GB/T label, no AC kW).
  - Xiaomi SU7 (standard): OEM PDF gives CLTC 700 km, 73.6 kWh unstated,
    RWD, 299 PS / 400 Nm, 0-100 km/h 5.28 s, LFP, CTB, Cd 0.195. List
    price 215,900 CNY from WeChat launch. Buyer fill: onboard AC 7 kW
    from republished Xiaomi FAQ (tier S); CLTC 12.3 kWh/100km from
    Dongchedi (tier S). Peak DC and port still blank (PDF gives 10%-80%
    time only; no GB/T vehicle-port label on opened pages).
  - Zeekr 001 `WE 95 kWh RWD`: MSRP 259,000 CNY (Xinhua) vs 269,000 CNY
    (earlier Zeekr press). Pack 95 kWh, RWD, CLTC 722 km / 15.2 kWh/100km
    from aggregators (tier S); flatten still prefers tier P CLTC 675 km
    Shenxing launch where tiers conflict. Buyer fill: 310 kW, 0-100 km/h
    6.3 s (ZOL/PCauto, tier S), peak DC 420 kW (outlet on 2025 MY 5C,
    tier S), LFP from launch coverage naming 磷酸铁锂神行 (tier S).
    800V / SiC from Zeekr press. Port and onboard AC still blank.
  - BYD Seal `510智航版`: 2026-10-04 primary upgrade. MIIT attachment
    《减免车辆购置税的新能源汽车车型目录（第四批）》.doc (工信部公告2024年
    第5号; URL opened) lists BYD7006BEVA6 比亚迪海豹 at CLTC 510 km and
    动力蓄电池组总能量 61.44 kWh (tier P; pack basis unstated; mapped to
    510智航版 by matching CLTC/pack/curb 1950). Still qcwp / BitAuto /
    ZOL tier S for other buyer fields (CLTC 13 kWh/100km, MSRP 175800 CNY,
    peak DC 180 kW, onboard AC 7 kW, 0-100 km/h 6.5 s, LFP / 刀片, RWD,
    170 kW / 380 Nm as stated). Port still blank. byd.com Ocean 海豹智驾版
    re-opened and still marketing chrome/JSON only (no trim CLTC/price
    table; 3.8 s / 800V language not applied to this entry trim). Product
    batch 381 DOC lists family code BYD7006 without a BEVA6 power row.
  - `charging.port_type` documents `GB_T` for China GB/T ports. After this
    pass, all five CN rows still leave port blank: no opened OEM, MIIT, or
    secondary page stated GB/T or 国标充电口 for the vehicle inlet
    (region=CN alone is never enough). Derived EPA-linked fields stay
    blank on CN rows.
- China-market add (2026-10-04), three entry CN rows (`unverified_availability`
  until sale status confirmed). Same FX 6.8228. No EPA/NHTSA fields. Port
  blank on all three (no GB/T / 国标充电口 label on opened pages).
  - BYD Han `EV 智驾版 506KM尊贵型`: CLTC 506 km, 13.2 kWh/100km, 60.48 kWh
    unstated, FWD, MSRP 179,800 CNY, peak DC 110 kW, 0-100 km/h 7.9 s,
    LFP, 204 PS from ZOL/CNMO (tier S). byd.com Han EV 智驾版 opened but
    non-extractable; no MIIT HTML opened.
  - Zeekr 7X `后驱智驾版 75 kWh`: CLTC 605 km, 75 kWh unstated, LFP, MSRP
    229,900 CNY, 800V / SiC from Zeekr global press (tier P). RWD, 310 kW,
    0-100 km/h 5.8 s from PCauto (tier S). Press 3.8 s / 645 hp is dual-motor
    performance and was not applied. Peak DC and onboard AC blank.
  - NIO New ES6 75 kWh: MSRP 338,000 CNY (nio.com launch news, tier P);
    pack 75 kWh and AWD dual-motor from nio.com/es6 (tier P). CLTC 510 km,
    16 kWh/100km, 0-100 km/h 4.5 s, 360 kW from BitAuto (tier S). nio.cn
    calculator / news blocked to scripted fetch. Chemistry blank (hybrid
    三元锂+磷酸铁锂 not storable). Peak DC, onboard AC, and port blank.

### Fleet powertrain transparency (2026-10-03; chemistry/voltage densify 2026-10-05; motor/buyer densify 2026-11-05)

Engineer-facing battery and powertrain fields were filled only where an opened
OEM, government, or credible secondary page states them. Remaining blanks are
undisclosed on checked sources, not forgotten.

Heatmap fill among 55 vehicles after the 2026-11-05 densify (prior
2026-10-05 chemistry/voltage pass left chemistry 24/55 and voltage 24/55;
motor_count was 34/55):

| field | filled |
|---|---|
| `battery.cell_chemistry` | 24/55 |
| `battery.system_voltage_v` | 27/55 |
| `powertrain.inverter_semiconductor` | 8/55 |
| `battery.cell_format` | 5/55 |
| `battery.structural_pack` | 6/55 |
| `powertrain.motor_count` | 50/55 |
| `powertrain.motor_type` | 19/55 |
| `body.drag_coefficient` | 15/55 |

Chemistry enum is `NMC` / `NCMA` / `NCA` / `LFP` / `unknown`. **NCMA is
distinct from NMC**; claims do not collapse them. NCMA Ultium fills (OEM or
reprint of OEM tables only; not inferred from "Ultium"): Chevrolet Equinox EV
(P), Cadillac OPTIQ (P, MY2025 launch sheet), Cadillac VISTIQ (P), Cadillac
LYRIQ (P, MY2023 debut sheet), Chevrolet Blazer EV FWD (S, GM Authority 2024
table NCMA on the 85 kWh column; medium confidence for FWD mapping). Left
blank where checked pages do not say NCMA: Silverado EV Std Range, Sierra EV
Std Range, Honda Prologue, Acura ZDX. NIO-style hybrid packs (三元铁锂) remain
unstorable; no `NMC_LFP_hybrid` / `LMFP` enum values added.

Other chemistry winners: Rivian R1 Dual Standard LFP (R1T and R1S; Rivian
Support battery specifications page re-opened 2026-10-05), Rivian R1T Dual
Large NCA (same page; not inferred from Dual Standard), Volvo EX30 Single
Motor Extended Range NMC (Volvo EX30 launch news), Dodge Charger Daytona NCA,
Chevrolet Bolt 2027 LFP, Jeep Wagoneer S NMC (older Launch Edition sheet,
medium confidence), BYD Seal LFP (S), BYD Han LFP (S), Xiaomi SU7 LFP, XPeng
G6 LFP, Zeekr 7X LFP (P). Hyundai Ioniq 5 / 6 / 9 NMC from Hyundai Korea buyer
battery-cell PDF (NCM row matched to atlas pack kWh and pack V; Ioniq 6
Standard 53.0 kWh / 480 V filled 2026-10-05). Mercedes CLA 250+ NMC, Ford
F-150 Lightning SR NMC, Kia EV6 NMC remain. BMW i4 eDrive35 chemistry stays
blank in flatten (prior Methods note of a 2019 Gen5 NMC-811 press fill was
not present in claims). NIO ES6 hybrid packs remain unstorable. Left blank
after check where sources are silent or ambiguous: Tesla showroom chemistry;
Mustang Mach-E Standard Range (Ford Support: LFP or NCM by VIN digit);
Porsche Taycan Performance Battery (NMC stated only for Performance Battery
Plus); Kia EV9; Genesis GV60; Lucid Air / Gravity (900V architecture is not
chemistry); Rivian R2; Waymo Ojai; Zoox (Panasonic states 2170 cells, not
cathode chemistry); VW ID.4 / ID. Buzz; Toyota bZ / Lexus RZ; Nissan Leaf /
Ariya; Polestar 2; MINI Countryman; BMW Neue Klasse iX3.

Voltage includes numeric pack voltages where OEM tables state them (Ioniq 5
SE SR 523 V, Ioniq 6 SE SR 480 V, Ioniq 9 610 V, Kia EV6 Light 523 V, EV9
Light Long Range 552 V, Subaru Solterra 391 V, Rivian Dual Standard minimum
pack 315 V, Rivian Dual Large minimum pack 282.5 V, Porsche Taycan 800, Dodge
Daytona 400, Jeep Wagoneer S 400, Audi Q4 e-tron MEB nominal 352 V from Audi
MediaCenter lexicon, Zoox 400 V system from TechCrunch 2022 reporting,
Volkswagen ID.4 Pro RWD Maximum Voltage 400 V from 2026 tech specs, Polestar 2
Long range Single motor 400 V from the global configure table, Genesis GV60
RWD pack Voltage 697 V from the 2026 US spec sheet) and OEM architecture
phrases elsewhere (BMW i4 eDrive35 400V architecture from a 2023 Canada
press note with medium confidence for MY2026; BMW iX3 800V, Mercedes CLA
800V, Lucid Air Pure / Grand Touring 900V+, Lucid Gravity 900V, GMC Sierra
Elevation available 800V, Zeekr 001 800V, Zeekr 7X 800V, XPeng G6 800V).
Genesis retains a conflicting 800V ultra-fast-charger architecture claim;
flatten keeps the higher-confidence 697 V pack figure. Rivian minimum pack V
claims are not architecture marketing figures. Left blank after check for
pack V on many Ultium crossovers (LYRIQ, OPTIQ, VISTIQ, Equinox EV, Blazer
EV, Bolt 2027), Silverado EV Std Range (no OEM pack V; Edmunds pack kWh only),
Ford Mach-E / Lightning, Tesla, VW ID. Buzz, Volvo EX30, Waymo Ojai, and
others where opened pages do not state pack V or architecture.

2026-11-05 motor/buyer densify (opened OEM pages only; no EPA motor-string
parsing into `motor_count`): motor_count filled for LYRIQ RWD, Prologue FWD,
EX30 Single Motor Extended Range, Ioniq 6 SE SR RWD, Mach-E Select RWD,
Toyota bZ FWD, GV60 RWD, BMW i4 eDrive35, ZDX RWD, Ariya Engage FWD,
Polestar 2 Single Motor, Rivian R1T Dual Standard, ID.4 Pro RWD, Audi Q4 45
e-tron, base Taycan RWD, and ID. Buzz RWD. Still blank: Tesla Model Y / 3 /
S (showroom pages not opened this pass / scripted 403 risk) and Waymo /
Zoox. Companion fills include Toyota bZ SiC eAxle inverter language, ID.4 /
ID. Buzz motor type and ID. Buzz prismatic cells, ID.4 gross/net pack pair
with conflicts_with (flatten keeps net 77 usable over gross 82), ID.4 peak
DC 175 vs pricing-sheet 170 conflict, Silverado Std Range 119 kWh (S,
Edmunds; OEM newsroom still names Standard without kWh), ZDX / Ariya
power and torque from MY2024/MY2025 OEM sheets already used for pack
mapping, and Ioniq 6 Cd 0.22. Chemistry unchanged at 24/55.

### Robotaxi / AV stubs (2026-10-05)

Waymo Ojai (`waymo-ojai-2026`) and Zoox Robotaxi (`zoox-robotaxi-2026`) are
sparse opt-in US rows for fleet / autonomous platforms, not consumer MSRP or
EPA Compare peers. Status is `unverified_availability`. Do not treat blanks as
zeros: EPA range, wall-side kWh/100 mi, MPGe, NHTSA campaign counts, and MSRP
are intentionally absent unless a matching government or OEM retail record is
opened. Waymo claims are limited to opened Waymo pages (6th-generation Waymo
Driver on the Ojai); pack, chemistry, and voltage stay blank because Waymo
pages do not state them for Ojai, and secondary LFP vs generic Li-ion reports
were not promoted without an opened primary. Zoox has secondary pack (133 kWh
total), 400 V system, and 100 kW DC peak from TechCrunch 2022 reporting, plus
Panasonic Energy 2170 cell format / supplier for 2026 fleet supply; cathode
chemistry remains blank.

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
- Peak DC station-kW audit (2026-10-04): `charging.peak_dc_kw` stores a
  vehicle maximum only. Charger-class or charge-time station ratings are
  left blank (same rule already used for Daytona R/T and EV9 Light LR).
  Removed prior fills that stored station output: Ioniq 5 SE SR (compare-specs
  CCS Adapter 350 kW / NACS 150 kW / >250 kW time rows), Ioniq 6 SE SR
  (Ultra-fast charger up to 800V / 350 kW; Rapid Charging >350 kW), Ioniq 9
  S RWD (Ultra-fast charger / CCS Adapter 350 kW), Genesis GV60 (350 kW/800V
  Ultra-Fast Charger for 10-80% time), Volvo EX30 (153 kW DC fast charging
  station footnote), and Porsche Taycan Performance Battery (Charge Time @
  150 / 270 / 320 kW rows only). No replacement vehicle-peak figure was
  found on those opened pages. Claims that state a vehicle maximum or
  acceptance rate (for example Audi Q4 up to 175 kW DC fast-charging speeds,
  BMW iX3 maximum charging rate 400 kW, Mercedes CLA DC charging speed
  320 kW) were retained. CN aggregator 最大快充功率 fills kept as vehicle
  peak language; still tier S.
- MSRP is the base figure as stated for the configured trim in the claim;
  destination, tax, and options vary.

### Tesla, Lucid, and Rivian

- Live tesla.com often blocks scripted fetch (HTTP 403). Model 3 and Model S
  OEM figures commonly use Wayback Machine snapshots of Tesla pages; archived
  pages can lag the live showroom.
- Lucid's live site advances to the next model year early. MY2026 Lucid
  claims draw on press releases, technical PDFs, and Wayback snapshots; some
  weight, dimension, and charging figures carry `model_year: 2027`.
- Lucid Air Pure `battery.system_voltage_v` records a tier P OEM `900V+`
  claim from lucidmotors.com charging docs; an older tier S EV-Database
  `800V architecture` claim is retained with `conflicts_with` (P wins on
  flatten). The MY2025 Pure technical specs PDF instead states platform
  architecture `650V+` for that year row. Lucid Air Grand Touring (EPA 49966
  / 512 mi on 19in; OEM Grand Touring mapping) uses the 2025 Grand Touring
  technical specs PDF for 117 kWh / 900V+ / dual-motor figures with
  `model_year: 2025` where needed; chemistry stays blank. Lucid IR HTML may
  block scripted fetch; the 2026 lineup press MSRP for Grand Touring was
  opened via Wayback.
- Lucid Air multi-year US rows (2026-11-05): Pure RWD 2024–2025 and Grand
  Touring 2024–2025 use opened Lucid technical-spec PDFs plus EPA/NHTSA;
  Pure AWD 2023 and Grand Touring 2022–2023 are EPA + NHTSA only so far
  (motor_count still blank there). Lucid tech PDFs remain among the easiest
  OEM sources for motor count, pack kWh, and dimensions.
- Lucid Gravity multi-year (2026-11-05): Touring EPA rows for MY2026–2027;
  MY2025 entry is Grand Touring 20F21R 2-row (EPA has no Touring that year).
  Dual-motor count for new Gravity rows uses the live Gravity AWD product
  page with medium confidence where the sheet is not year-matched.
- Rivian R1 Dual multi-year (2026-11-05): Dual Standard 20in for MY2025
  (R1T/R1S), Dual Standard Plus 21in for MY2024, Dual Large 21in for MY2023.
  Motor count from Rivian Dual-Motor drive-systems page. Dual Standard pack
  chemistry/voltage/kWh from Rivian battery support apply only to Dual
  Standard rows, not Standard Plus or Dual Large.
- Chevrolet Equinox EV FWD multi-year (2026-11-05): EPA FWD rows for
  MY2024–2027. Buyer fields (single motor, NCMA, 213 hp, charging, exterior)
  from the 2024-05-14 Chevrolet newsroom specs table; MY2025/2027 inherit
  that sheet with `model_year: 2024` and medium confidence. Pack kWh still
  absent on that newsroom page.
- Chevrolet Bolt EV lineage `chevrolet-bolt-ev` (2026-11-05): EPA rows for
  MY2017–2023, separate from the 2027 Bolt (`chevrolet-bolt`). 2022 newsroom
  specs densify MY2022–2023 (single motor, 65 kWh unstated, dimensions);
  MY2017–2021 stay EPA + NHTSA only for now.
- Rivian Support battery specifications (re-opened 2026-10-05) still state
  Dual Standard LFP and minimum pack 315 V, and Dual Large NCA with minimum
  pack 282.5 V. Those fills apply only to the named pack; R2 chemistry and
  voltage remain blank. New US rows: R1S Dual Standard (EPA 49717) and R1T
  Dual Large (EPA 49708).
- Recorded conflicts include Model 3 MSRP, Model S MSRP and curb weight,
  and Model Y Premium RWD pack kWh (Car and Driver 80 kWh unstated vs
  Green Cars Compare usable 75 kWh). Model 3 body width uses Green Cars
  Compare without-mirrors 72.8 in; Tesla overall-width-with-mirrors figures
  are not used for `body.width_in`. Model S and MINI Countryman width stay
  blank when only with-mirrors figures are available. Some Tesla port and
  AC fields remain secondary-only or blank. Tesla chemistry, cell format,
  and structural-pack fields stay blank for current atlas trims: showroom
  pages do not state LFP/NMC/NCMA/NCA for these US rows, and structural-pack
  service docs are configuration-specific.

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
  Ariya FWD 63 kWh and ZDX RWD remain EPA/NHTSA-only in that pass
  (later filled in the 2026-10-04 US buyer densify).
- US critical buyer densify (2026-10-04), existing US rows only: Ariya FWD
  63 kWh gains MY2025 Nissan News pack (63 kWh usable / 66 total), Engage
  FWD MSRP $39,770, CCS1, 130 kW peak DC, and 7.2 kW onboard AC
  (`model_year` 2025; US discontinued after MY2025). Ariya 0-60 stays blank
  (brochure 7.1 s footnote restricts the calculation to long-range Dual Motor
  e-4ORCE AWD). ZDX RWD gains MY2024 Acura News 102 kWh (unstated), A-Spec
  RWD MSRP $64,500, CCS1, and 190 kW peak DC (`model_year` 2024; EPA MY2026
  range 327 mi vs MY2024 313 mi noted). ZDX onboard AC and 0-60 stay blank.
  Wagoneer S Launch Edition MSRP $71,995 including destination (Stellantis
  Media 2024-05-30); Limited $66,995 not applied. Wagoneer peak DC / onboard
  AC / port stay blank (20-80% in 23 minutes only). Port CCS1 also filled for
  BMW i4, MINI Countryman SE ALL4, IONIQ 6, and Sierra EV Std Range from
  opened OEM NACS-adapter / CCS pages. Still blank after this pass: Polestar 2
  Single Motor MSRP (US 2025 retail dropped single-motor; media.polestar.com
  and lease URLs did not yield a fetchable MSRP page), Daytona R/T MSRP /
  0-60 / peak DC (2026 OEM pages quote Daytona Scat Pack or station kW only),
  Lightning SR MSRP / peak DC / SR 0-60 (live Ford pages show employee pricing
  or ER-only 0-60; charging FAQ cites station 150+ kW), Silverado Std Range
  pack kWh (named packs only on newsroom), and Audi Q4 port (no CCS/NACS
  naming on the opened US model page). Compare accel column label is now
  Accel (s); cells whose winning `source_name` includes 0-100 show
  `(0–100 km/h)` so CN rows are not labeled as 0-60 mph.
- US buyer densify + accel display honesty (2026-10-04), existing US rows
  only (no new vehicles). Before → after blank counts among 42 US rows for
  the priority fields:
  - `identity.msrp_usd`: 3 → 3 (Daytona R/T, Lightning SR, Polestar 2 Single
    Motor still no fetchable trim MSRP)
  - `charging.port_type`: 3 → 2 (Polestar 2 CCS1 from US 2025 manual; Audi
    Q4 and Wagoneer S still unnamed on opened pages). Honda Prologue port
    corrected `CCS` → `CCS1`
  - `charging.peak_dc_kw`: 6 → 6 in that pass (Daytona, Lightning SR, Wagoneer,
    EV6 Light, EV9 Light LR, bZ FWD). Later 2026-10-04 station-kW audit also
    blanked Ioniq 5/6/9, GV60, EX30, and Taycan (see Efficiency section).
  - `charging.onboard_ac_kw`: 8 → 3 (filled R1T 11.5 kW Rivian Support; R2
    11 kW Rivian home-charging guide; Ioniq 9 S 11 kW Hyundai News PDF;
    Prologue 11.5 kW Honda EV Charger Guide; ZDX 11.5 kW Acura EV Port
    Guide). Still blank: Wagoneer S, Model S, Model Y (Tesla support pages
    not fetchable in this pass)
  - `battery.pack_kwh` / `pack_kwh_basis`: 1 → 1 (Silverado Std Range still
    named packs only on newsroom)
  - `powertrain.accel_0_60_s`: 26 filled / 16 blank → unchanged (no new true
    OEM 0-60 mph claims for blank RWD/FWD entry rows; AWD-only or
    instrumented-only figures left out). Compare Accel column subtitle is
    now `cycle in cell`; cells use claim `accel_basis` from unit / notes /
    source_name (0-100 km/h labeled; no mph conversion)
- Targeted US buyer blank fill (2026-10-04, after peak-DC station-kW audit):
  - `charging.peak_dc_kw`: EV6 Light 180 kW from Kia Media "Maximum Charging
    Input Power (DC Fast Charge)"; EV9 Light Long Range 210 kW from Kia Media
    "Peak Power (kW)". Light non-LR 235 kW and Long Range 240 kW columns were
    not applied off-trim. Still blank: Daytona R/T, Lightning SR, Wagoneer S,
    Toyota bZ FWD (charge-time or `150kW+` / 350 kW station language only),
    plus Ioniq 5/6/9, GV60, EX30, and Taycan from the station-kW audit.
  - `charging.port_type`: Wagoneer S CCS1 from Stellantis Free2move NACS-CCS1
    adapter press (lists Wagoneer S MY2024–2025; MY2026 not on the Supercharger
    access list; medium confidence). Polestar 2 CCS1 already filled. Audi Q4
    still blank (opened audiusa.com model page and related parts copy do not
    name CCS/NACS for the vehicle port; NACS-adapter incompatibility alone was
    not treated as a positive CCS1 statement).
  - `identity.msrp_usd`: Daytona R/T $59,595 from Stellantis Media 2024-08-07
    R/T pricing (`model_year` 2024; Scat Pack not applied). Still blank:
    Lightning SR (order guide / FAQ / live Ford pages redirect to Build & Price
    or show employee pricing only) and Polestar 2 Single Motor (US 2025 retail
    dropped single-motor; no invent of US MSRP from UK pages).
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
  Intentionally blank in that pass (later partly filled 2026-10-04): Ariya
  FWD 63 kWh and ZDX RWD. Still blank where OEM silent: Tesla torque;
  Model Y/S and Rivian/Prologue/Jeep onboard AC where OEM did not state
  vehicle peak kW; Model S and MINI width (mirrors-only).
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
- NHTSA's products endpoint sometimes lists MY2026 Model S and i4 as having
  recalls when no MY2026 campaign exists in the API or flat file. Both views
  are recorded as conflicts. Mustang Mach-E MY2026 previously had that same
  products-vs-flat-file conflict; a 2026-10-04 re-check found two campaigns
  in recallsByVehicle (`MUSTANG MACH E`) and the flat file (`25V863000`,
  `25V885000`), so the contradiction claim was closed and
  `recalls.campaign_count` is 2. Recall queries are not trim-specific.
- BMW iX3 MY2027 (`bmw-ix3-50-xdrive-2027`) still has no
  `recalls.campaign_count` claim after a second 2026-10-03 retry.
  recallsByVehicle returned HTTP 400 / Count 0 for model strings including
  `IX3`, `iX3`, `X3`, `I X3`, `IX 3`, `I-X3`, and `iX 3` (unmatched string,
  not a confirmed zero). The flat file `FLAT_RCL_POST_2010.zip` still has
  no BMW MY2027 campaign rows and no IX3 rows of any year. Products for
  BMW MY2027 lists only `X6 XDRIVE40I M SPORT` (no iX3). Count is left
  blank rather than written as zero until a matching NHTSA model string
  exists.
- Sale status confirmation (2026-10-03; `status` /
  `status_checked_date` on `data/vehicles.json`; URLs checked that day):
  - `current` (first pass): `chevrolet-bolt-2027` LT,
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
  - `current` (second pass, same day): `hyundai-ioniq6-2025` SE Standard
    Range RWD, https://www.hyundaiusa.com/us/en/vehicles/ioniq-6;
    `vw-id4-2026` Pro (RWD; 291 mi EPA vs separate AWD listing),
    https://www.vw.com/en/models/id-4.html;
    `kia-ev9-long-range-rwd-2026` Light Long Range RWD,
    https://www.kia.com/us/en/ev9/specs-compare;
    `lexus-rz-350e-fwd-2026` RZ 350e FWD,
    https://www.lexus.com/models/RZ;
    `vw-id-buzz-2025` Pro S (listed without 4MOTION; 4MOTION is a
    separate trim label), https://www.vw.com/en/models/id-buzz.html;
    `subaru-solterra-awd-2026` Premium (AWD standard on Solterra),
    https://www.subaru.com/vehicles/solterra/2026/specs-trim.html.
  - `discontinued` (first pass): `nissan-ariya-fwd-63kwh-2026`,
    https://www.nissanusa.com/vehicles/discontinued/ariya.html;
    `acura-zdx-rwd-2026`, https://www.acura.com/suvs/zdx ("no longer
    available").
  - `discontinued` (second pass): `bmw-i4-2026` eDrive35 (BMW USA FAQ
    lists only eDrive40, xDrive40, and M60 for 2026),
    https://www.bmwusa.com/vehicles/bmw-i-series/i4/bmw-i4-gran-coupe.html;
    `polestar-2-single-motor-2025` (US specifications list Long range
    Dual motor / Performance only; Single motor absent),
    https://www.polestar.com/us/polestar-2/specifications/.
  - Remaining 27 stay `unverified_availability` when the live page does
    not clearly show the atlas trim/year (Equinox / OPTIQ / Blazer /
    Toyota bZ atlas MY2026 while OEM pages emphasize 2027; Genesis GV60
    retail page titled 2027 while atlas is MY2026; Tesla trim naming /
    scripted 403; Lucid year-advance; Rivian R2 invite-gated; iX3 US
    retail readiness; Mercedes CLA pages labeled 2027 while atlas id is
    2026; Wagoneer S page titled 2025 vs atlas MY2026).

## Running the pipeline

```
pip install -r requirements.txt
python scripts/validate.py    # schema conformance + sourcing rules
python scripts/flatten.py     # regenerates data/flattened.csv and data/disclosure_heatmap.csv
```

Run `validate.py` before every commit that touches `claims/` or
`data/vehicles.json`.
