# Make fields

Allowed fields for make-level claims in `claims/makes/<slug>.json`.
Every value on a make dossier identity card must first exist as a claim here
(or as an atlas fleet aggregate from vehicle winners). Do not invent fields
without expanding this list.

| field path | type / unit | typical tier | notes |
|---|---|---|---|
| org.hq_city | string | P | City of corporate / brand HQ from OEM About, corporate, or IR. Blank if not found. |
| org.hq_country | string | P | Country for `org.hq_city`. Prefer full country name (e.g. United States, China). |
| org.parent | string | P | Parent company name when the make is a brand (e.g. General Motors for Cadillac). Optional. Do not merge fleets across makes. |
| org.brand_type | enum: standalone / division / jv_brand | P/S | How the make sits in a corporate group. `standalone` = listed or independent make as its own issuer; `division` = brand under a parent OEM; `jv_brand` = joint-venture brand. Justify from the opened page; do not infer from the vehicle corpus alone unless notes say atlas-derived. |
| org.ev_focus | enum: bev_only / multi_powertrain / nev_bev_phev | P/S | EV posture as framed by the OEM. `bev_only` = battery-electric only; `multi_powertrain` = ICE and/or hybrid alongside BEV; `nev_bev_phev` = OEM frames the make as NEV covering BEV+PHEV. Do not invent finer taxonomies. Blank if unclear. |
| org.home_market | enum: US / CN / EU / KR / JP / multi | P/S | Primary home market for the make as stated or clearly implied by OEM corporate text. Use `multi` when the OEM frames global multi-region home markets without a single primary. Blank if unclear. Not the same as vehicle `region` (spec market). |
| org.founded_year | integer (year) | P/S | Optional. Incorporation or brand founding year as stated by the source. |
| org.listing_status | enum: public / private / unknown | P | Listing status of the **make's** equity issuer when the make is the listed entity. Leave blank for brand-only makes under a parent; do not copy the parent's ticker onto the brand without saying so in notes. |
| org.ticker | string | P | Optional exchange ticker when `org.listing_status` is public and the make is the listed entity (or notes clearly state parent ticker). |
| org.summary | string | P/S | Two to three short sentences of identity / background only (what the make is, parent if any, EV posture, "in EV Atlas" framing). **No digits.** Put numbers in numeric fields. Not strategy essays. |
| org.deliveries_units | integer | P/S | Optional period-stamped delivery / sales count. Omit unless confidently sourced. Requires companion claims `org.deliveries_period` and `org.deliveries_scope` in the same make file. |
| org.deliveries_period | string | P/S | Required companion when `org.deliveries_units` is present (e.g. `2025`, `2025 Q4`, `through 2025-04`). |
| org.deliveries_scope | string | P/S | Required companion when `org.deliveries_units` is present. State the scope plainly (e.g. `make worldwide BEV`, `parent group total NEV (do not label as make)`). Never display parent-group totals as the make's sales. |

## Out of scope for v3

Revenue, market cap, employees, leadership bios, history timelines, competitive
rankings, technology deep-dives, platform encyclopedias, and company-group hub
pages. Prefer leave absent over stale IR figures or reconstructed URLs.
Wikipedia is not tier P.
