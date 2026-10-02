# Field dictionary

Dot-path, unit, and the tier a field is usually found at. "Typical tier" is
an expectation, not a rule; each claim declares its own tier. A field that
rarely reaches tier P is worth reporting in the heatmap. It isn't a reason to
accept weaker sources for it.

| field path | unit | typical tier | notes |
|---|---|---|---|
| identity.msrp_usd | USD | P | base trim as configured; confirm trim exactly |
| powertrain.motor_count | count | P | |
| powertrain.motor_type | enum: PM_synchronous / induction / synchronous_reluctance / unknown | S | rarely stated per-motor by OEM |
| powertrain.drive_layout | enum: RWD / AWD / FWD | P | |
| powertrain.power_hp | hp | P | |
| powertrain.torque_lbft | lb-ft | P | |
| powertrain.accel_0_60_s | s | P | OEM claim, not independently tested unless noted |
| powertrain.epa_motor_description | string | P | EPA `evMotor` text, verbatim (e.g. "178 and 433 kW ACPM"); not parsed into motor_count/motor_type |
| powertrain.inverter_semiconductor | enum: Si_IGBT / SiC_MOSFET / unknown | S/unverified | almost never OEM-disclosed |
| battery.pack_kwh | kWh | S | flag gross_or_usable |
| battery.pack_kwh_basis | enum: gross / usable / unstated | — | required whenever pack_kwh is set |
| battery.system_voltage_v | V | S | OEM sometimes gives a range e.g. "800V+" |
| battery.cell_format | enum: cylindrical_2170 / cylindrical_4680 / cylindrical_18650 / prismatic / pouch / unknown | S | usually teardown-sourced |
| battery.cell_chemistry | enum: NMC / NCA / LFP / unknown | S/unverified | supplier contracts rarely public |
| battery.cell_supplier | string | unverified | treat as rumor unless OEM/supplier press release |
| battery.module_count | count | S | |
| battery.structural_pack | boolean | S | |
| charging.port_type | enum: NACS / CCS1 / CCS2 / CHAdeMO | P | |
| charging.peak_dc_kw | kW | P/S | OEM often omits; third-party instrumented tests common |
| charging.onboard_ac_kw | kW | P | |
| charging.range_added_mi | mi | P | pair with .range_added_time_min; put the OEM's test conditions in notes |
| charging.range_added_time_min | min | P | time for range_added_mi |
| charging.nacs_adapter_included | boolean | P | for CCS1-port cars: whether a NACS adapter comes with the car |
| efficiency.epa_range_mi | mi | P | fueleconomy.gov |
| efficiency.epa_kwh_per_100mi | kWh/100mi | P | includes charging losses (label basis) |
| efficiency.epa_mpge_combined | MPGe | P | |
| body.curb_weight_lb | lb | P | |
| body.drag_coefficient | Cd | P/S | OEM sometimes omits |
| body.length_in / width_in / height_in / wheelbase_in | in | P | |
| chassis.front_suspension | string | S | |
| chassis.rear_suspension | string | S | |
| adas.sensor_suite | string | S | camera-only vs camera+radar vs +lidar |
| adas.system_name | string | P | e.g. "DreamDrive Premium", "Autopilot" |
| recalls.campaign_count | count | P | distinct NHTSA campaigns for the vehicle's model year; make/model/year query, not trim-specific |
| recalls.campaign_&lt;id&gt; | string | P | one per NHTSA campaign (id without the trailing 000); value is component + defect |
| recalls.listed_as_having_recalls | boolean | P | NHTSA products endpoint; recorded only where it contradicts the campaign count |
| recalls.* | — | P | NHTSA recalls API or NHTSA recall flat file only; never inferred |
| derived.miles_per_min_dc | mi/min | D | range_added_mi / range_added_time_min |
| derived.wh_per_lb | Wh/lb | D | pack_kwh*1000 / curb_weight_lb (requires pack_kwh_basis noted) |
| derived.kwh_per_100mi_battery_side | kWh/100mi | D | pack_kwh / epa_range_mi * 100; not the same as efficiency.epa_kwh_per_100mi, which is wall-side |

## Cross-field traps

- `efficiency.epa_kwh_per_100mi` is wall-side (includes charging losses);
  `derived.kwh_per_100mi_battery_side` is battery-side. Label which one when
  plotting them together.
- If `battery.pack_kwh_basis` is unset, display `pack_kwh` but don't compute
  anything from it.
- EPA label range for an EV is a 5-cycle value. Under 40 CFR
  600.210-12(d)(3) the manufacturer either runs 5-cycle testing, multiplies
  2-cycle results by 0.7, or uses an EPA-approved factor based on in-use data.
  So 0.7 is the default shortcut, not a floor, and the bulk EPA data doesn't
  say which method a vehicle used.
