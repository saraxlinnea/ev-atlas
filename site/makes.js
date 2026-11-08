/**
 * Make index + dossier pages. Reads site/data/makes.json from build_site.py.
 * Numbers are flattened winners only; blank means not found.
 */
(function (global) {
  "use strict";

  var MISSING = "\u2014";

  var SPEC_LABELS = {
    "efficiency.epa_range_mi": "EPA range (mi)",
    "efficiency.cltc_range_km": "CLTC range (km)",
    "efficiency.epa_kwh_per_100mi": "EPA kWh/100 mi (wall)",
    "battery.pack_kwh": "Pack (kWh)",
    "battery.pack_kwh_basis": "Pack kWh basis",
    "identity.msrp_usd": "MSRP (USD)",
    "charging.peak_dc_kw": "Peak DC (kW)",
    "charging.port_type": "Port",
    "powertrain.drive_layout": "Drive",
    "powertrain.accel_0_60_s": "Accel (s)"
  };

  var SPEC_ORDER = [
    "efficiency.epa_range_mi",
    "efficiency.cltc_range_km",
    "efficiency.epa_kwh_per_100mi",
    "battery.pack_kwh",
    "battery.pack_kwh_basis",
    "identity.msrp_usd",
    "charging.peak_dc_kw",
    "charging.port_type",
    "powertrain.drive_layout",
    "powertrain.accel_0_60_s"
  ];

  var ORG_LABELS = {
    "org.hq_city": "HQ city",
    "org.hq_country": "HQ country",
    "org.parent": "Parent",
    "org.brand_type": "Brand type",
    "org.ev_focus": "EV focus",
    "org.home_market": "Home market",
    "org.founded_year": "Founded",
    "org.listing_status": "Listing",
    "org.ticker": "Ticker",
    "org.deliveries_units": "Deliveries",
    "org.deliveries_period": "Deliveries period",
    "org.deliveries_scope": "Deliveries scope"
  };

  var ORG_ORDER = [
    "org.hq_city",
    "org.hq_country",
    "org.parent",
    "org.brand_type",
    "org.ev_focus",
    "org.home_market",
    "org.founded_year",
    "org.listing_status",
    "org.ticker",
    "org.deliveries_units",
    "org.deliveries_period",
    "org.deliveries_scope"
  ];

  var BRAND_TYPE_LABELS = {
    standalone: "Standalone",
    division: "Division",
    jv_brand: "JV brand"
  };

  var EV_FOCUS_LABELS = {
    bev_only: "BEV only",
    multi_powertrain: "Multi-powertrain",
    nev_bev_phev: "NEV (BEV+PHEV)"
  };

  var PATTERN_LABELS = {
    "battery.cell_chemistry": "Cell chemistry",
    "battery.cell_supplier": "Cell supplier",
    "charging.port_type": "Charge port"
  };

  var PATTERN_ORDER = [
    "battery.cell_chemistry",
    "battery.cell_supplier",
    "charging.port_type"
  ];

  function makeSlug(make) {
    return String(make || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatNum(n) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      return MISSING;
    }
    if (Number.isInteger(n)) {
      return String(n);
    }
    var fixed = n.toFixed(2).replace(/\.?0+$/, "");
    return fixed;
  }

  function formatFillRate(disclosure) {
    if (!disclosure || disclosure.fill_rate == null || !disclosure.possible) {
      return MISSING;
    }
    var pct = Math.round(disclosure.fill_rate * 1000) / 10;
    return pct + "%";
  }

  function statusMixText(mix) {
    if (!mix || typeof mix !== "object") {
      return MISSING;
    }
    return Object.keys(mix)
      .sort()
      .map(function (k) {
        return mix[k] + " " + k;
      })
      .join(" · ");
  }

  function formatNumericSummary(spec) {
    if (!spec) {
      return MISSING;
    }
    if (spec.min === spec.max) {
      return formatNum(spec.min);
    }
    return formatNum(spec.min) + "–" + formatNum(spec.max);
  }

  function formatCategoricalSummary(spec) {
    if (!spec || !spec.values || !spec.values.length) {
      return MISSING;
    }
    return spec.values
      .map(function (item) {
        return item.value + " (" + item.count + ")";
      })
      .join(", ");
  }

  function coverageText(spec) {
    if (!spec || spec.of == null) {
      return MISSING;
    }
    return "stated on " + spec.stated + " of " + spec.of;
  }

  function identityCoverageLabel(coverage) {
    if (coverage === "filled") {
      return "filled";
    }
    if (coverage === "partial") {
      return "partial";
    }
    return "blank";
  }

  function orgValue(entry, field) {
    if (!entry || !entry.org) {
      return null;
    }
    var v = entry.org[field];
    if (v == null || v === "") {
      return null;
    }
    return v;
  }

  function formatDeliveries(entry) {
    var units = orgValue(entry, "org.deliveries_units");
    if (units == null) {
      return null;
    }
    var period = orgValue(entry, "org.deliveries_period");
    var scope = orgValue(entry, "org.deliveries_scope");
    var text = String(units);
    if (period != null) {
      text += " (" + period + ")";
    }
    if (scope != null) {
      text += "; " + scope;
    }
    return text;
  }

  function formatOrgField(field, value) {
    if (value == null || value === "") {
      return null;
    }
    if (field === "org.brand_type") {
      return BRAND_TYPE_LABELS[value] || String(value);
    }
    if (field === "org.ev_focus") {
      return EV_FOCUS_LABELS[value] || String(value);
    }
    return String(value);
  }

  function indexSecondary(entry) {
    var parent = orgValue(entry, "org.parent");
    if (parent) {
      return parent;
    }
    var home = orgValue(entry, "org.home_market");
    if (home) {
      return String(home);
    }
    return null;
  }

  function templatedSummary(entry) {
    var parts = [];
    var parent = orgValue(entry, "org.parent");
    var city = orgValue(entry, "org.hq_city");
    var country = orgValue(entry, "org.hq_country");
    var brandType = formatOrgField(
      "org.brand_type",
      orgValue(entry, "org.brand_type")
    );
    var evFocus = formatOrgField("org.ev_focus", orgValue(entry, "org.ev_focus"));
    if (parent) {
      parts.push(entry.make + " is recorded under parent " + parent + ".");
    }
    if (brandType || evFocus) {
      parts.push(
        [
          brandType ? "Brand type " + brandType : null,
          evFocus ? "EV focus " + evFocus : null
        ]
          .filter(Boolean)
          .join("; ") + "."
      );
    }
    if (city || country) {
      parts.push(
        "HQ in EV Atlas sources: " +
          [city, country].filter(Boolean).join(", ") +
          "."
      );
    }
    parts.push(
      entry.vehicle_count +
        " vehicles in EV Atlas" +
        (entry.regions && entry.regions.length
          ? " · markets " + entry.regions.join(", ")
          : "") +
        "."
    );
    return parts.join(" ");
  }

  function dossierHref(slug) {
    return "make.html?m=" + encodeURIComponent(slug);
  }

  function compareHref(make) {
    return "compare.html?make=" + encodeURIComponent(make);
  }

  function loadMakes(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return res.json();
    });
  }

  function mountIndex(root) {
    var body = root.querySelector("[data-makes-body]");
    var table = root.querySelector("[data-makes-table]");
    var countEl = root.querySelector("[data-makes-count]");
    var errorEl = root.querySelector("[data-makes-error]");
    var dataUrl = root.getAttribute("data-src") || "data/makes.json";

    loadMakes(dataUrl)
      .then(function (payload) {
        var makes = (payload && payload.makes) || [];
        if (countEl) {
          countEl.textContent =
            makes.length +
            " makes · " +
            (payload.vehicle_count != null ? payload.vehicle_count : "") +
            " vehicles in EV Atlas";
        }
        if (!body) {
          return;
        }
        body.innerHTML = "";
        makes.forEach(function (entry) {
          var tr = document.createElement("tr");

          var tdMake = document.createElement("td");
          var a = document.createElement("a");
          a.href = dossierHref(entry.slug);
          a.textContent = entry.make;
          tdMake.appendChild(a);
          var secondary = indexSecondary(entry);
          if (secondary) {
            var sub = document.createElement("div");
            sub.className = "make-index-secondary";
            sub.textContent = secondary;
            tdMake.appendChild(sub);
          }
          tr.appendChild(tdMake);

          var tdN = document.createElement("td");
          tdN.className = "num";
          tdN.textContent = String(entry.vehicle_count);
          tr.appendChild(tdN);

          var tdReg = document.createElement("td");
          tdReg.textContent = (entry.regions || []).join(", ") || MISSING;
          tr.appendChild(tdReg);

          var tdId = document.createElement("td");
          tdId.textContent = identityCoverageLabel(entry.identity_coverage);
          tr.appendChild(tdId);

          var tdFill = document.createElement("td");
          tdFill.className = "num";
          tdFill.textContent = formatFillRate(entry.disclosure);
          if (entry.disclosure && entry.disclosure.possible) {
            tdFill.title =
              entry.disclosure.filled +
              " of " +
              entry.disclosure.possible +
              " tracked field cells";
          }
          tr.appendChild(tdFill);

          body.appendChild(tr);
        });
        if (table) {
          table.hidden = false;
        }
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent =
            "Could not load makes.json. Run npm run build:site, then refresh. (" +
            err.message +
            ")";
        }
      });
  }

  function querySlug() {
    try {
      var params = new URLSearchParams(window.location.search);
      return (params.get("m") || params.get("make") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function mountDetail(root) {
    var errorEl = root.querySelector("[data-make-error]");
    var dataUrl = root.getAttribute("data-src") || "data/makes.json";
    var slug = querySlug();

    if (!slug) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent =
          "No make selected. Open a make from the Makes index.";
      }
      return;
    }

    loadMakes(dataUrl)
      .then(function (payload) {
        var makes = (payload && payload.makes) || [];
        var entry = null;
        for (var i = 0; i < makes.length; i++) {
          if (makes[i].slug === slug || makeSlug(makes[i].make) === slug) {
            entry = makes[i];
            break;
          }
        }
        if (!entry) {
          throw new Error("Make not in EV Atlas: " + slug);
        }
        renderDetail(entry);
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent =
            err.message.indexOf("Make not") === 0
              ? err.message
              : "Could not load makes.json. Run npm run build:site, then refresh. (" +
                err.message +
                ")";
        }
      });
  }

  function renderDetail(entry) {
    document.title = entry.make + " | EV Atlas";
    var title = document.querySelector("[data-make-title]");
    if (title) {
      title.textContent = entry.make;
    }
    var lede = document.querySelector("[data-make-lede]");
    if (lede) {
      lede.textContent =
        entry.vehicle_count +
        " vehicles in EV Atlas" +
        (entry.regions && entry.regions.length
          ? " · markets " + entry.regions.join(", ")
          : "") +
        " · keyed by make, not company group.";
    }

    var compareLink = document.querySelector("[data-make-compare-link]");
    if (compareLink) {
      compareLink.href = compareHref(entry.make);
    }

    var summaryEl = document.querySelector("[data-make-summary]");
    if (summaryEl) {
      var claimedSummary = orgValue(entry, "org.summary");
      if (claimedSummary) {
        summaryEl.textContent = claimedSummary;
        summaryEl.hidden = false;
      } else if (
        orgValue(entry, "org.parent") ||
        orgValue(entry, "org.hq_city") ||
        orgValue(entry, "org.hq_country") ||
        orgValue(entry, "org.brand_type") ||
        orgValue(entry, "org.ev_focus") ||
        orgValue(entry, "org.home_market")
      ) {
        summaryEl.textContent = templatedSummary(entry);
        summaryEl.hidden = false;
      } else {
        summaryEl.textContent = "";
        summaryEl.hidden = true;
      }
    }

    var meta = document.querySelector("[data-make-meta]");
    if (meta) {
      meta.innerHTML = "";
      var rows = [
        ["Make", entry.make],
        ["Markets", (entry.regions || []).join(", ") || MISSING],
        ["Vehicles", String(entry.vehicle_count)],
        ["Lineages", String(entry.lineage_count)],
        ["Status mix", statusMixText(entry.status_mix)],
        [
          "Disclosure fill",
          formatFillRate(entry.disclosure) +
            (entry.disclosure && entry.disclosure.possible
              ? " (" +
                entry.disclosure.filled +
                " of " +
                entry.disclosure.possible +
                " tracked cells)"
              : "")
        ],
        ["Identity", identityCoverageLabel(entry.identity_coverage)]
      ];
      ORG_ORDER.forEach(function (field) {
        if (field === "org.deliveries_units") {
          var deliv = formatDeliveries(entry);
          rows.push([ORG_LABELS[field], deliv != null ? deliv : MISSING]);
          return;
        }
        if (
          field === "org.deliveries_period" ||
          field === "org.deliveries_scope"
        ) {
          // Folded into Deliveries row when units exist; show alone if orphaned.
          if (orgValue(entry, "org.deliveries_units") != null) {
            return;
          }
        }
        var val = orgValue(entry, field);
        var formatted = formatOrgField(field, val);
        rows.push([
          ORG_LABELS[field] || field,
          formatted != null ? formatted : MISSING
        ]);
      });
      rows.forEach(function (pair) {
        var dt = document.createElement("dt");
        dt.textContent = pair[0];
        var dd = document.createElement("dd");
        dd.textContent = pair[1];
        meta.appendChild(dt);
        meta.appendChild(dd);
      });
    }

    var fleetBody = document.querySelector("[data-make-fleet-body]");
    var fleetTable = document.querySelector("[data-make-fleet-table]");
    if (fleetBody) {
      fleetBody.innerHTML = "";
      (entry.vehicles || []).forEach(function (v) {
        var tr = document.createElement("tr");
        [
          v.model || MISSING,
          v.trim || MISSING,
          v.model_year != null ? String(v.model_year) : MISSING,
          v.region || MISSING,
          v.status || MISSING
        ].forEach(function (text, idx) {
          var td = document.createElement("td");
          if (idx === 2) {
            td.className = "num";
          }
          if (idx === 0) {
            var a = document.createElement("a");
            a.href = compareHref(entry.make);
            a.textContent = text;
            td.appendChild(a);
          } else {
            td.textContent = text;
          }
          tr.appendChild(td);
        });
        fleetBody.appendChild(tr);
      });
      if (fleetTable) {
        fleetTable.hidden = false;
      }
    }

    var specsBody = document.querySelector("[data-make-specs-body]");
    var specsTable = document.querySelector("[data-make-specs-table]");
    var specsEmpty = document.querySelector("[data-make-specs-empty]");
    var specs = entry.specs || {};
    var shown = 0;
    if (specsBody) {
      specsBody.innerHTML = "";
      SPEC_ORDER.forEach(function (key) {
        var spec = specs[key];
        if (!spec) {
          return;
        }
        shown += 1;
        var tr = document.createElement("tr");
        var tdField = document.createElement("td");
        tdField.textContent = SPEC_LABELS[key] || key;
        var tdSum = document.createElement("td");
        if (spec.values) {
          tdSum.textContent = formatCategoricalSummary(spec);
        } else {
          tdSum.textContent = formatNumericSummary(spec);
        }
        var tdCov = document.createElement("td");
        tdCov.textContent = coverageText(spec);
        tr.appendChild(tdField);
        tr.appendChild(tdSum);
        tr.appendChild(tdCov);
        specsBody.appendChild(tr);
      });
      if (specsTable) {
        specsTable.hidden = shown === 0;
      }
      if (specsEmpty) {
        specsEmpty.hidden = shown !== 0;
      }
    }

    var highlightsEl = document.querySelector("[data-make-highlights]");
    var highlightsEmpty = document.querySelector("[data-make-highlights-empty]");
    var highlights = entry.highlights || [];
    if (highlightsEl) {
      highlightsEl.innerHTML = "";
      highlights.forEach(function (h) {
        var li = document.createElement("li");
        li.textContent = h.text || "";
        highlightsEl.appendChild(li);
      });
      highlightsEl.hidden = highlights.length === 0;
    }
    if (highlightsEmpty) {
      highlightsEmpty.hidden = highlights.length !== 0;
    }

    var patternsEl = document.querySelector("[data-make-patterns]");
    var patternsEmpty = document.querySelector("[data-make-patterns-empty]");
    var patterns = entry.atlas_patterns || {};
    var patternShown = 0;
    if (patternsEl) {
      patternsEl.innerHTML = "";
      PATTERN_ORDER.forEach(function (field) {
        var spec = patterns[field];
        if (!spec) {
          return;
        }
        patternShown += 1;
        var li = document.createElement("li");
        var label = PATTERN_LABELS[field] || field;
        var valuesText =
          spec.stated > 0 && spec.values && spec.values.length
            ? formatCategoricalSummary(spec) + "; "
            : "";
        li.textContent =
          label +
          ": " +
          valuesText +
          coverageText(spec) +
          " vehicles in EV Atlas.";
        patternsEl.appendChild(li);
      });
      patternsEl.hidden = patternShown === 0;
    }
    if (patternsEmpty) {
      patternsEmpty.hidden = patternShown !== 0;
    }
  }

  function autoMount() {
    var indexRoot = document.querySelector("[data-makes-index]");
    if (indexRoot) {
      mountIndex(indexRoot);
    }
    var detailRoot = document.querySelector("[data-make-page]");
    if (detailRoot) {
      mountDetail(detailRoot);
    }
  }

  global.EVAtlasMakes = { mountIndex: mountIndex, mountDetail: mountDetail, makeSlug: makeSlug };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})(typeof window !== "undefined" ? window : globalThis);
