/**
 * Shared Compare table: filters, group-by-make, column picker, drag reorder,
 * provenance. Reads only site/data/compare.json (generated). Missing = —.
 */
(function (global) {
  "use strict";

  var MISSING = "\u2014";
  var CONFLICT_MARK = "\u2020"; /* † quiet footnote marker */
  var STORAGE_KEY = "ev-atlas-compare-cols";
  var ORDER_STORAGE_KEY = "ev-atlas-compare-col-order";
  var HEIGHT_STORAGE_KEY = "ev-atlas-compare-height";
  var FILTER_STORAGE_KEY = "ev-atlas-compare-filters";
  var HIDDEN_COLS_STORAGE_KEY = "ev-atlas-compare-hidden-cols";
  var FILTER_KEYS = ["market", "make", "year", "drive", "port"];
  var MARKET_OPTIONS = ["US", "CN"];
  /* Market defaults to US (not All) so EPA-focused views stay honest. */
  var DEFAULT_FILTERS = {
    market: ["US"],
    make: null,
    year: null,
    drive: null,
    port: null
  };

  var IDENTITY_COLS = [
    { key: "make", label: "Make", sticky: 0 },
    { key: "model", label: "Model", sticky: 1 },
    { key: "model_year", label: "Year", sticky: 2, num: true }
  ];

  /* Default visual order (efficiency cluster together). */
  var SPEC_COLS = [
    {
      key: "identity.msrp_usd",
      label: "MSRP ($)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "identity.msrp_cny",
      label: "MSRP (CNY)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "efficiency.epa_range_mi",
      label: "EPA range (mi)",
      num: true,
      presets: ["buyer", "efficiency"]
    },
    {
      key: "efficiency.epa_mpge_combined",
      label: "MPGe",
      num: true,
      presets: ["buyer", "efficiency"]
    },
    {
      key: "efficiency.epa_kwh_per_100mi",
      label: "kWh/100 mi (wall)",
      num: true,
      presets: ["buyer", "efficiency"]
    },
    {
      key: "efficiency.cltc_range_km",
      label: "CLTC range (km)",
      num: true,
      presets: ["buyer", "efficiency"]
    },
    {
      key: "efficiency.cltc_kwh_per_100km",
      label: "CLTC kWh/100 km",
      num: true,
      presets: ["buyer", "efficiency"]
    },
    {
      key: "battery.pack_kwh",
      label: "Pack (kWh)",
      num: true,
      presets: ["buyer", "efficiency", "charging"]
    },
    {
      key: "battery.pack_kwh_basis",
      label: "Pack basis",
      presets: ["buyer", "efficiency"]
    },
    {
      key: "battery.system_voltage_v",
      label: "Voltage (V)",
      presets: ["efficiency"]
    },
    {
      key: "powertrain.drive_layout",
      label: "Drive",
      presets: ["buyer"]
    },
    {
      key: "charging.peak_dc_kw",
      label: "Peak DC (kW)",
      num: true,
      presets: ["buyer", "charging"]
    },
    {
      key: "charging.port_type",
      label: "Port",
      presets: ["buyer", "charging"]
    },
    {
      key: "charging.onboard_ac_kw",
      label: "Onboard AC (kW)",
      num: true,
      presets: ["charging"]
    },
    {
      key: "powertrain.accel_0_60_s",
      label: "0–60 (s)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "powertrain.power_hp",
      label: "Power (hp)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "body.curb_weight_lb",
      label: "Curb weight (lb)",
      num: true,
      presets: ["efficiency"]
    },
    {
      key: "derived.kwh_per_100mi_battery_side",
      label: "Battery-side kWh/100 mi",
      num: true,
      presets: ["efficiency"]
    },
    {
      key: "recalls.campaign_count",
      label: "Recalls (count)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "battery.cell_chemistry",
      label: "Chemistry",
      presets: ["chemistry"]
    }
  ];

  var DEFAULT_ORDER = SPEC_COLS.map(function (col) {
    return col.key;
  });

  var COL_BY_KEY = {};
  SPEC_COLS.forEach(function (col) {
    COL_BY_KEY[col.key] = col;
  });

  var DEFAULT_PRESETS = {
    buyer: true,
    efficiency: false,
    charging: false,
    chemistry: false
  };

  function isMissing(value) {
    return value === null || value === undefined || value === "";
  }

  function formatCell(key, value) {
    if (isMissing(value)) {
      return { text: MISSING, missing: true };
    }
    if (
      (key === "identity.msrp_usd" || key === "identity.msrp_cny") &&
      typeof value === "number"
    ) {
      return { text: value.toLocaleString("en-US"), missing: false };
    }
    if (typeof value === "number") {
      var text = Number.isInteger(value) ? String(value) : String(value);
      return { text: text, missing: false };
    }
    return { text: String(value), missing: false };
  }

  function shortSource(name, url) {
    if (name && String(name).trim()) {
      var n = String(name).trim();
      return n.length > 52 ? n.slice(0, 49) + "\u2026" : n;
    }
    if (url) {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch (e) {
        return String(url);
      }
    }
    return "source not recorded";
  }

  function conflictReason(alt) {
    if (!alt || !alt.notes) {
      return null;
    }
    var t = String(alt.notes).trim();
    if (!t) {
      return null;
    }
    var m = t.match(/^(.+?[.!?])(\s|$)/);
    var sentence = m ? m[1] : t;
    if (sentence.length > 180) {
      return sentence.slice(0, 177) + "\u2026";
    }
    return sentence;
  }

  function hasConflict(row, key) {
    return !!(row.conflicts && row.conflicts[key]);
  }

  function conflictOpenKey(vid, field) {
    return vid + "\0" + field;
  }

  function sortKey(row, key) {
    var v = row[key];
    if (isMissing(v)) {
      return null;
    }
    if (typeof v === "number") {
      return v;
    }
    return String(v).toLowerCase();
  }

  function compareValues(av, bv, dir) {
    if (av === null && bv === null) {
      return 0;
    }
    if (av === null) {
      return 1;
    }
    if (bv === null) {
      return -1;
    }
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }
    return String(av).localeCompare(String(bv)) * dir;
  }

  function loadPresets() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return Object.assign({}, DEFAULT_PRESETS);
      }
      var parsed = JSON.parse(raw);
      var out = Object.assign({}, DEFAULT_PRESETS);
      Object.keys(DEFAULT_PRESETS).forEach(function (k) {
        if (typeof parsed[k] === "boolean") {
          out[k] = parsed[k];
        }
      });
      if (!out.buyer && !out.efficiency && !out.charging && !out.chemistry) {
        out.buyer = true;
      }
      return out;
    } catch (e) {
      return Object.assign({}, DEFAULT_PRESETS);
    }
  }

  function savePresets(presets) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function normalizeOrder(keys) {
    var seen = {};
    var out = [];
    if (Array.isArray(keys)) {
      keys.forEach(function (key) {
        if (COL_BY_KEY[key] && !seen[key]) {
          seen[key] = true;
          out.push(key);
        }
      });
    }
    DEFAULT_ORDER.forEach(function (key) {
      if (!seen[key]) {
        out.push(key);
      }
    });
    return out;
  }

  function loadOrder() {
    try {
      var raw = sessionStorage.getItem(ORDER_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_ORDER.slice();
      }
      return normalizeOrder(JSON.parse(raw));
    } catch (e) {
      return DEFAULT_ORDER.slice();
    }
  }

  function saveOrder(order) {
    try {
      sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function orderedSpecCols(order) {
    return normalizeOrder(order).map(function (key) {
      return COL_BY_KEY[key];
    });
  }

  function visibleSpecCols(presets, order, hiddenCols) {
    hiddenCols = hiddenCols || {};
    return orderedSpecCols(order).filter(function (col) {
      if (hiddenCols[col.key]) {
        return false;
      }
      return col.presets.some(function (p) {
        return presets[p];
      });
    });
  }

  function uniqueSorted(values) {
    var seen = {};
    var out = [];
    values.forEach(function (v) {
      if (isMissing(v)) {
        return;
      }
      var s = String(v);
      if (!seen[s]) {
        seen[s] = true;
        out.push(s);
      }
    });
    out.sort(function (a, b) {
      var an = Number(a);
      var bn = Number(b);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && String(an) === a && String(bn) === b) {
        return an - bn;
      }
      return a.localeCompare(b);
    });
    return out;
  }

  function loadFilters() {
    try {
      var raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) {
        return {
          market: DEFAULT_FILTERS.market.slice(),
          make: null,
          year: null,
          drive: null,
          port: null
        };
      }
      var parsed = JSON.parse(raw);
      var out = {};
      FILTER_KEYS.forEach(function (k) {
        if (k === "market" && !Object.prototype.hasOwnProperty.call(parsed, "market")) {
          /* Pre-market sessions: keep US default, not All. */
          out[k] = DEFAULT_FILTERS.market.slice();
        } else if (parsed[k] === null || parsed[k] === undefined) {
          out[k] = null;
        } else if (Array.isArray(parsed[k])) {
          out[k] = parsed[k].map(String);
        } else {
          out[k] = k === "market" ? DEFAULT_FILTERS.market.slice() : null;
        }
      });
      return out;
    } catch (e) {
      return {
        market: DEFAULT_FILTERS.market.slice(),
        make: null,
        year: null,
        drive: null,
        port: null
      };
    }
  }

  function saveFilters(filters) {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      /* ignore */
    }
  }

  function loadHiddenCols() {
    try {
      var raw = sessionStorage.getItem(HIDDEN_COLS_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      var parsed = JSON.parse(raw);
      var out = {};
      Object.keys(parsed || {}).forEach(function (k) {
        if (COL_BY_KEY[k] && parsed[k]) {
          out[k] = true;
        }
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function saveHiddenCols(hiddenCols) {
    try {
      sessionStorage.setItem(HIDDEN_COLS_STORAGE_KEY, JSON.stringify(hiddenCols));
    } catch (e) {
      /* ignore */
    }
  }

  function loadHeight() {
    try {
      var raw = sessionStorage.getItem(HEIGHT_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  function saveHeight(px) {
    try {
      sessionStorage.setItem(HEIGHT_STORAGE_KEY, String(px));
    } catch (e) {
      /* ignore */
    }
  }

  function filterAllows(filterVal, rowVal) {
    if (filterVal === null) {
      return true;
    }
    if (!filterVal.length) {
      return false;
    }
    if (isMissing(rowVal)) {
      return false;
    }
    return filterVal.indexOf(String(rowVal)) !== -1;
  }

  function filterSummaryText(filterVal) {
    if (filterVal === null) {
      return "All";
    }
    if (!filterVal.length) {
      return "0 selected";
    }
    return filterVal.length + " selected";
  }

  function mount(root) {
    if (!root) {
      return;
    }

    var dataUrl = root.getAttribute("data-src") || "data/compare.json";
    var searchInput = root.querySelector("[data-compare-search]");
    var groupToggle = root.querySelector("[data-compare-group]");
    var countEl = root.querySelector("[data-compare-count]");
    var presetBox = root.querySelector("[data-compare-presets]");
    var resetOrderBtn = root.querySelector("[data-compare-reset-order]");
    var table = root.querySelector("[data-compare-table]");
    var theadRow = root.querySelector("[data-compare-thead-row]");
    var tbody = root.querySelector("[data-compare-body]");
    var errorEl = root.querySelector("[data-compare-error]");
    var wrapEl = root.querySelector("[data-compare-wrap]");
    var resizeEl = root.querySelector("[data-compare-resize]");
    var colPicker = root.querySelector("[data-compare-col-picker]");
    var colSummary = root.querySelector("[data-col-summary]");
    var colDetail = root.querySelector("[data-compare-col-detail]");

    var filterRoots = {
      market: root.querySelector('[data-compare-filter="market"]'),
      make: root.querySelector('[data-compare-filter="make"]'),
      year: root.querySelector('[data-compare-filter="year"]'),
      drive: root.querySelector('[data-compare-filter="drive"]'),
      port: root.querySelector('[data-compare-filter="port"]')
    };
    var filterOptionBoxes = {
      market: root.querySelector("[data-compare-filter-market]"),
      make: root.querySelector("[data-compare-filter-make]"),
      year: root.querySelector("[data-compare-filter-year]"),
      drive: root.querySelector("[data-compare-filter-drive]"),
      port: root.querySelector("[data-compare-filter-port]")
    };

    var allRows = [];
    var presets = loadPresets();
    var colOrder = loadOrder();
    var filters = loadFilters();
    var hiddenCols = loadHiddenCols();
    var sortState = { key: "make", dir: 1 };
    var groupByMake = !groupToggle || groupToggle.checked;
    var openConflict = null; /* { vid, field } or null */
    var dragState = {
      key: null,
      overKey: null,
      place: null,
      moved: false,
      suppressClick: false
    };

    function activeSpecCols() {
      return visibleSpecCols(presets, colOrder, hiddenCols);
    }

    function colCount() {
      return IDENTITY_COLS.length + activeSpecCols().length;
    }

    function syncPresetUI() {
      if (!presetBox) {
        return;
      }
      presetBox.querySelectorAll("[data-preset]").forEach(function (input) {
        var key = input.getAttribute("data-preset");
        input.checked = !!presets[key];
      });
    }

    function clearDropCue() {
      if (!theadRow) {
        return;
      }
      theadRow.querySelectorAll("th.drop-before, th.drop-after").forEach(function (th) {
        th.classList.remove("drop-before", "drop-after");
      });
    }

    function setDropCue(overKey, place) {
      clearDropCue();
      if (!overKey || !place || !theadRow) {
        return;
      }
      var th = theadRow.querySelector('th[data-key="' + overKey + '"]');
      if (th) {
        th.classList.add(place === "before" ? "drop-before" : "drop-after");
      }
    }

    function reorderSpec(fromKey, toKey, place) {
      if (!fromKey || !toKey || fromKey === toKey) {
        return false;
      }
      var order = normalizeOrder(colOrder);
      var fromIdx = order.indexOf(fromKey);
      var toIdx = order.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) {
        return false;
      }
      order.splice(fromIdx, 1);
      toIdx = order.indexOf(toKey);
      if (toIdx === -1) {
        return false;
      }
      var insertAt = place === "after" ? toIdx + 1 : toIdx;
      order.splice(insertAt, 0, fromKey);
      colOrder = order;
      saveOrder(colOrder);
      return true;
    }

    function bindSpecHeaderDrag(th, col) {
      th.classList.add("draggable-col");
      th.setAttribute("draggable", "true");

      var handle = document.createElement("span");
      handle.className = "col-drag-handle";
      handle.setAttribute("aria-hidden", "true");

      var label = document.createElement("span");
      label.className = "col-label";
      label.textContent = col.label;

      th.textContent = "";
      th.appendChild(handle);
      th.appendChild(label);
      th.setAttribute(
        "aria-label",
        col.label + ". Click to sort. Drag to reorder columns."
      );

      th.addEventListener("dragstart", function (ev) {
        dragState.key = col.key;
        dragState.overKey = null;
        dragState.place = null;
        dragState.moved = false;
        th.classList.add("dragging");
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", col.key);
        }
      });

      th.addEventListener("dragend", function () {
        th.classList.remove("dragging");
        clearDropCue();
        var fromKey = dragState.key;
        var overKey = dragState.overKey;
        var place = dragState.place;
        var moved = dragState.moved;
        dragState.key = null;
        dragState.overKey = null;
        dragState.place = null;
        dragState.moved = false;
        if (moved) {
          dragState.suppressClick = true;
          if (fromKey && overKey && place && reorderSpec(fromKey, overKey, place)) {
            render();
          }
        }
      });

      th.addEventListener("dragover", function (ev) {
        if (!dragState.key || dragState.key === col.key) {
          return;
        }
        ev.preventDefault();
        dragState.moved = true;
        var rect = th.getBoundingClientRect();
        var place = ev.clientX < rect.left + rect.width / 2 ? "before" : "after";
        dragState.overKey = col.key;
        dragState.place = place;
        setDropCue(col.key, place);
        if (ev.dataTransfer) {
          ev.dataTransfer.dropEffect = "move";
        }
      });

      th.addEventListener("dragleave", function (ev) {
        var related = ev.relatedTarget;
        if (related && th.contains(related)) {
          return;
        }
        if (dragState.overKey === col.key) {
          dragState.overKey = null;
          dragState.place = null;
          clearDropCue();
        }
      });

      th.addEventListener("drop", function (ev) {
        if (!dragState.key || dragState.key === col.key) {
          return;
        }
        ev.preventDefault();
        dragState.moved = true;
        var rect = th.getBoundingClientRect();
        dragState.overKey = col.key;
        dragState.place = ev.clientX < rect.left + rect.width / 2 ? "before" : "after";
      });
    }

    function renderHead() {
      if (!theadRow) {
        return;
      }
      theadRow.innerHTML = "";
      IDENTITY_COLS.forEach(function (col) {
        var th = document.createElement("th");
        th.scope = "col";
        th.className = "sortable sticky sticky-" + col.sticky;
        if (col.num) {
          th.className += " num";
        }
        th.setAttribute("data-key", col.key);
        th.textContent = col.label;
        if (sortState.key === col.key) {
          th.setAttribute("aria-sort", sortState.dir === 1 ? "ascending" : "descending");
        }
        th.addEventListener("click", function () {
          onSort(col.key);
        });
        theadRow.appendChild(th);
      });
      activeSpecCols().forEach(function (col) {
        var th = document.createElement("th");
        th.scope = "col";
        th.className = "sortable draggable-col" + (col.num ? " num" : "");
        th.setAttribute("data-key", col.key);
        if (sortState.key === col.key) {
          th.setAttribute("aria-sort", sortState.dir === 1 ? "ascending" : "descending");
        }
        bindSpecHeaderDrag(th, col);
        th.addEventListener("click", function () {
          if (dragState.suppressClick) {
            dragState.suppressClick = false;
            return;
          }
          onSort(col.key);
        });
        theadRow.appendChild(th);
      });
    }

    function appendIdentityCells(tr, row) {
      IDENTITY_COLS.forEach(function (col) {
        var td = document.createElement("td");
        td.className = "sticky sticky-" + col.sticky;
        var cell = formatCell(col.key, row[col.key]);
        if (cell.missing) {
          td.className += " missing";
          td.textContent = cell.text;
        } else if (col.key === "model") {
          td.innerHTML = '<span class="vehicle-label"></span>';
          td.querySelector(".vehicle-label").textContent = cell.text;
        } else if (col.num) {
          td.className += " num";
          td.textContent = cell.text;
        } else {
          td.textContent = cell.text;
        }
        tr.appendChild(td);
      });
    }

    function isConflictOpen(row, key) {
      return (
        openConflict &&
        openConflict.vid === row.vehicle_id &&
        openConflict.field === key
      );
    }

    function setConflictOpen(row, key) {
      if (isConflictOpen(row, key)) {
        openConflict = null;
      } else {
        openConflict = { vid: row.vehicle_id, field: key };
      }
      render();
      if (openConflict) {
        var panel = tbody.querySelector(
          '[data-conflict-panel="' +
            conflictOpenKey(openConflict.vid, openConflict.field) +
            '"]'
        );
        if (panel) {
          panel.focus();
        }
      }
    }

    function appendSpecCells(tr, row) {
      activeSpecCols().forEach(function (col) {
        var key = col.key;
        var td = document.createElement("td");
        var cell = formatCell(key, row[key]);
        if (cell.missing) {
          td.className = "missing";
          td.textContent = cell.text;
        } else {
          var conflicted = hasConflict(row, key);
          td.className = (col.num ? "num" : "") + (conflicted ? " compare-conflict" : "");
          var tiers = row.tiers || {};
          var sources = row.sources || {};
          var tipParts = [];
          if (tiers[key]) {
            tipParts.push("Tier " + tiers[key]);
          }
          if (sources[key]) {
            tipParts.push(sources[key]);
            var a = document.createElement("a");
            a.href = sources[key];
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = cell.text;
            a.className = "compare-source-link";
            td.appendChild(a);
          } else {
            var valSpan = document.createElement("span");
            valSpan.className = "compare-cell-value";
            valSpan.textContent = cell.text;
            td.appendChild(valSpan);
          }
          if (conflicted) {
            tipParts.push("Sources disagree; activate marker for detail");
            var mark = document.createElement("button");
            mark.type = "button";
            mark.className = "compare-conflict-mark";
            mark.textContent = CONFLICT_MARK;
            mark.setAttribute(
              "aria-label",
              "Sources disagree on " +
                col.label +
                ". Show other recorded value."
            );
            mark.setAttribute("aria-expanded", isConflictOpen(row, key) ? "true" : "false");
            mark.setAttribute(
              "aria-controls",
              "conflict-" + row.vehicle_id + "-" + key.replace(/\./g, "-")
            );
            mark.addEventListener("click", function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              setConflictOpen(row, key);
            });
            td.appendChild(document.createTextNode(" "));
            td.appendChild(mark);
            td.addEventListener("click", function (ev) {
              var t = ev.target;
              if (t && (t.closest("a") || t.closest("button"))) {
                return;
              }
              setConflictOpen(row, key);
            });
          }
          if (tipParts.length) {
            td.title = tipParts.join(" \u00b7 ");
          }
        }
        tr.appendChild(td);
      });
    }

    function appendConflictDetail(row, field) {
      var col = COL_BY_KEY[field];
      if (!col) {
        return;
      }
      var alt = (row.conflict_alts || {})[field];
      var tiers = row.tiers || {};
      var sources = row.sources || {};
      var names = row.source_names || {};
      var shown = formatCell(field, row[field]);
      var shownTier = tiers[field] || "unverified";
      var shownSrc = shortSource(names[field], sources[field]);
      var detail = document.createElement("tr");
      detail.className = "compare-conflict-detail";
      var td = document.createElement("td");
      td.colSpan = colCount();
      var panelId =
        "conflict-" + row.vehicle_id + "-" + field.replace(/\./g, "-");
      var panel = document.createElement("div");
      panel.className = "compare-conflict-panel";
      panel.id = panelId;
      panel.setAttribute(
        "data-conflict-panel",
        conflictOpenKey(row.vehicle_id, field)
      );
      panel.setAttribute("role", "region");
      panel.setAttribute("tabindex", "-1");
      panel.setAttribute(
        "aria-label",
        "Conflict detail for " +
          (row.make || "") +
          " " +
          (row.model || "") +
          ", " +
          col.label
      );

      var lineShown = document.createElement("p");
      lineShown.className = "compare-conflict-line";
      lineShown.appendChild(document.createTextNode("Shown: "));
      if (sources[field]) {
        var shownLink = document.createElement("a");
        shownLink.href = sources[field];
        shownLink.target = "_blank";
        shownLink.rel = "noopener noreferrer";
        shownLink.textContent = shown.text;
        lineShown.appendChild(shownLink);
      } else {
        lineShown.appendChild(document.createTextNode(shown.text));
      }
      lineShown.appendChild(
        document.createTextNode(
          " \u00b7 Tier " + shownTier + " \u00b7 " + shownSrc
        )
      );
      panel.appendChild(lineShown);

      var lineAlso = document.createElement("p");
      lineAlso.className = "compare-conflict-line";
      if (alt && !isMissing(alt.value)) {
        var alsoCell = formatCell(field, alt.value);
        lineAlso.appendChild(document.createTextNode("Also recorded: "));
        if (alt.source_url) {
          var alsoLink = document.createElement("a");
          alsoLink.href = alt.source_url;
          alsoLink.target = "_blank";
          alsoLink.rel = "noopener noreferrer";
          alsoLink.textContent = alsoCell.text;
          lineAlso.appendChild(alsoLink);
        } else {
          lineAlso.appendChild(document.createTextNode(alsoCell.text));
        }
        lineAlso.appendChild(
          document.createTextNode(
            " \u00b7 Tier " +
              (alt.tier || "unverified") +
              " \u00b7 " +
              shortSource(alt.source_name, alt.source_url)
          )
        );
      } else {
        lineAlso.textContent =
          "Also recorded: other claim retained in claims/; detail not loaded.";
      }
      panel.appendChild(lineAlso);

      var reason = conflictReason(alt);
      if (reason) {
        var reasonEl = document.createElement("p");
        reasonEl.className = "compare-conflict-reason";
        reasonEl.textContent = reason;
        panel.appendChild(reasonEl);
      }

      var links = document.createElement("p");
      links.className = "compare-conflict-links";
      var linkParts = [];
      if (sources[field]) {
        var a1 = document.createElement("a");
        a1.href = sources[field];
        a1.target = "_blank";
        a1.rel = "noopener noreferrer";
        a1.textContent = "Shown source";
        links.appendChild(a1);
        linkParts.push(a1);
      }
      if (alt && alt.source_url) {
        if (linkParts.length) {
          links.appendChild(document.createTextNode(" \u00b7 "));
        }
        var a2 = document.createElement("a");
        a2.href = alt.source_url;
        a2.target = "_blank";
        a2.rel = "noopener noreferrer";
        a2.textContent = "Also recorded source";
        links.appendChild(a2);
        linkParts.push(a2);
      }
      if (linkParts.length) {
        panel.appendChild(links);
      }

      var closeHint = document.createElement("p");
      closeHint.className = "compare-conflict-close";
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "Close";
      closeBtn.addEventListener("click", function () {
        openConflict = null;
        render();
      });
      closeHint.appendChild(closeBtn);
      panel.appendChild(closeHint);

      td.appendChild(panel);
      detail.appendChild(td);
      tbody.appendChild(detail);
    }

    function appendVehicleRow(row) {
      var tr = document.createElement("tr");
      appendIdentityCells(tr, row);
      appendSpecCells(tr, row);
      tbody.appendChild(tr);
      if (
        openConflict &&
        openConflict.vid === row.vehicle_id &&
        hasConflict(row, openConflict.field)
      ) {
        var stillVisible = activeSpecCols().some(function (c) {
          return c.key === openConflict.field;
        });
        if (stillVisible) {
          appendConflictDetail(row, openConflict.field);
        }
      }
    }

    function filteredRows() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : "";

      return allRows.filter(function (row) {
        var region = isMissing(row.region) ? "US" : String(row.region);
        if (!filterAllows(filters.market, region)) {
          return false;
        }
        if (!filterAllows(filters.make, row.make)) {
          return false;
        }
        if (
          !filterAllows(
            filters.year,
            isMissing(row.model_year) ? null : String(row.model_year)
          )
        ) {
          return false;
        }
        if (!filterAllows(filters.drive, row["powertrain.drive_layout"])) {
          return false;
        }
        if (!filterAllows(filters.port, row["charging.port_type"])) {
          return false;
        }
        if (q) {
          var hay = [row.make, row.model, row.trim]
            .filter(function (p) {
              return !isMissing(p);
            })
            .join(" ")
            .toLowerCase();
          if (hay.indexOf(q) === -1) {
            return false;
          }
        }
        return true;
      });
    }

    function sortRows(rows) {
      var key = sortState.key;
      var dir = sortState.dir;
      rows.sort(function (a, b) {
        if (groupByMake && key !== "make") {
          var makeCmp = compareValues(
            sortKey(a, "make"),
            sortKey(b, "make"),
            1
          );
          if (makeCmp !== 0) {
            return makeCmp;
          }
        }
        return compareValues(sortKey(a, key), sortKey(b, key), dir);
      });
      return rows;
    }

    function updateCount(n) {
      if (!countEl) {
        return;
      }
      countEl.textContent =
        n + " of " + allRows.length + " vehicle" + (allRows.length === 1 ? "" : "s");
    }

    function render() {
      var rows = sortRows(filteredRows());
      updateCount(rows.length);
      renderHead();
      tbody.innerHTML = "";

      if (!rows.length) {
        var empty = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = colCount();
        td.className = "compare-empty";
        td.textContent = "No vehicles match the current filters.";
        empty.appendChild(td);
        tbody.appendChild(empty);
        return;
      }

      if (!groupByMake) {
        rows.forEach(function (row) {
          appendVehicleRow(row);
        });
        return;
      }

      var currentMake = null;
      rows.forEach(function (row) {
        var make = isMissing(row.make) ? MISSING : String(row.make);
        if (make !== currentMake) {
          currentMake = make;
          var hdr = document.createElement("tr");
          hdr.className = "compare-group";
          var htd = document.createElement("td");
          htd.colSpan = colCount();
          htd.textContent = make;
          hdr.appendChild(htd);
          tbody.appendChild(hdr);
        }
        appendVehicleRow(row);
      });
    }

    function onSort(key) {
      if (sortState.key === key) {
        sortState.dir = -sortState.dir;
      } else {
        sortState.key = key;
        sortState.dir = 1;
      }
      render();
    }

    function syncFilterSummary(key) {
      var details = filterRoots[key];
      if (!details) {
        return;
      }
      var summary = details.querySelector("[data-filter-summary]");
      if (summary) {
        summary.textContent = filterSummaryText(filters[key]);
      }
    }

    function syncAllFilterSummaries() {
      FILTER_KEYS.forEach(syncFilterSummary);
    }

    function readCheckedValues(box) {
      if (!box) {
        return [];
      }
      var values = [];
      box.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
        if (input.checked) {
          values.push(input.value);
        }
      });
      return values;
    }

    function setFilterFromUI(key) {
      var box = filterOptionBoxes[key];
      var values = readCheckedValues(box);
      var total = box
        ? box.querySelectorAll('input[type="checkbox"]').length
        : 0;
      if (total > 0 && values.length === total) {
        filters[key] = null;
      } else if (!values.length) {
        /* Distinguish untouched All (null) only via All/None buttons;
           checkbox path with zero checked means None. */
        filters[key] = [];
      } else {
        filters[key] = values;
      }
      saveFilters(filters);
      syncFilterSummary(key);
      render();
    }

    function applyFilterMode(key, mode) {
      var box = filterOptionBoxes[key];
      if (!box) {
        return;
      }
      var inputs = box.querySelectorAll('input[type="checkbox"]');
      if (mode === "all") {
        filters[key] = null;
        inputs.forEach(function (input) {
          input.checked = true;
        });
      } else {
        filters[key] = [];
        inputs.forEach(function (input) {
          input.checked = false;
        });
      }
      saveFilters(filters);
      syncFilterSummary(key);
      render();
    }

    function fillFilterOptions(key, values) {
      var box = filterOptionBoxes[key];
      if (!box) {
        return;
      }
      box.innerHTML = "";
      var selected = filters[key];
      values.forEach(function (v) {
        var label = document.createElement("label");
        label.className = "compare-check";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.value = v;
        if (selected === null) {
          input.checked = true;
        } else {
          input.checked = selected.indexOf(v) !== -1;
        }
        input.addEventListener("change", function () {
          setFilterFromUI(key);
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + v));
        box.appendChild(label);
      });
      syncFilterSummary(key);
    }

    function bindFilterChrome(key) {
      var details = filterRoots[key];
      if (!details) {
        return;
      }
      var allBtn = details.querySelector("[data-filter-all]");
      var noneBtn = details.querySelector("[data-filter-none]");
      if (allBtn) {
        allBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          applyFilterMode(key, "all");
        });
      }
      if (noneBtn) {
        noneBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          applyFilterMode(key, "none");
        });
      }
    }

    function syncColPickerUI() {
      if (!colPicker) {
        return;
      }
      colPicker.innerHTML = "";
      var visibleCount = 0;
      orderedSpecCols(colOrder).forEach(function (col) {
        var label = document.createElement("label");
        label.className = "compare-check";
        var input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("data-col-key", col.key);
        input.checked = !hiddenCols[col.key];
        if (input.checked) {
          visibleCount += 1;
        }
        input.addEventListener("change", function () {
          if (input.checked) {
            delete hiddenCols[col.key];
          } else {
            hiddenCols[col.key] = true;
          }
          saveHiddenCols(hiddenCols);
          syncColSummary();
          render();
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + col.label));
        colPicker.appendChild(label);
      });
      if (colSummary) {
        if (visibleCount === SPEC_COLS.length) {
          colSummary.textContent = "All";
        } else {
          colSummary.textContent = visibleCount + " shown";
        }
      }
    }

    function syncColSummary() {
      if (!colSummary) {
        return;
      }
      var shown = SPEC_COLS.filter(function (col) {
        return !hiddenCols[col.key];
      }).length;
      colSummary.textContent =
        shown === SPEC_COLS.length ? "All" : shown + " shown";
    }

    function initFacets() {
      fillFilterOptions("market", MARKET_OPTIONS.slice());
      fillFilterOptions(
        "make",
        uniqueSorted(
          allRows.map(function (r) {
            return r.make;
          })
        )
      );
      fillFilterOptions(
        "year",
        uniqueSorted(
          allRows.map(function (r) {
            return isMissing(r.model_year) ? null : String(r.model_year);
          })
        )
      );
      fillFilterOptions(
        "drive",
        uniqueSorted(
          allRows.map(function (r) {
            return r["powertrain.drive_layout"];
          })
        )
      );
      fillFilterOptions(
        "port",
        uniqueSorted(
          allRows.map(function (r) {
            return r["charging.port_type"];
          })
        )
      );
      syncColPickerUI();
    }

    function bindResize() {
      if (!wrapEl || !resizeEl) {
        return;
      }
      var saved = loadHeight();
      if (saved !== null) {
        var max = Math.round(window.innerHeight * 0.95);
        var clamped = Math.max(320, Math.min(max, saved));
        wrapEl.style.height = clamped + "px";
      }

      var dragging = false;
      var startY = 0;
      var startH = 0;

      function clampHeight(h) {
        var max = Math.round(window.innerHeight * 0.95);
        return Math.max(320, Math.min(max, Math.round(h)));
      }

      resizeEl.addEventListener("pointerdown", function (ev) {
        dragging = true;
        startY = ev.clientY;
        startH = wrapEl.getBoundingClientRect().height;
        resizeEl.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      });
      resizeEl.addEventListener("pointermove", function (ev) {
        if (!dragging) {
          return;
        }
        wrapEl.style.height = clampHeight(startH + (ev.clientY - startY)) + "px";
      });
      function endDrag() {
        if (!dragging) {
          return;
        }
        dragging = false;
        saveHeight(clampHeight(wrapEl.getBoundingClientRect().height));
      }
      resizeEl.addEventListener("pointerup", endDrag);
      resizeEl.addEventListener("pointercancel", endDrag);
      resizeEl.addEventListener("keydown", function (ev) {
        var delta = 0;
        if (ev.key === "ArrowUp") {
          delta = -24;
        } else if (ev.key === "ArrowDown") {
          delta = 24;
        } else {
          return;
        }
        ev.preventDefault();
        var next = clampHeight(wrapEl.getBoundingClientRect().height + delta);
        wrapEl.style.height = next + "px";
        saveHeight(next);
      });
    }

    FILTER_KEYS.forEach(bindFilterChrome);

    if (colDetail) {
      var colAllBtn = colDetail.querySelector("[data-col-all]");
      var colNoneBtn = colDetail.querySelector("[data-col-none]");
      if (colAllBtn) {
        colAllBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          hiddenCols = {};
          saveHiddenCols(hiddenCols);
          syncColPickerUI();
          render();
        });
      }
      if (colNoneBtn) {
        colNoneBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          hiddenCols = {};
          SPEC_COLS.forEach(function (col) {
            hiddenCols[col.key] = true;
          });
          saveHiddenCols(hiddenCols);
          syncColPickerUI();
          render();
        });
      }
    }

    if (presetBox) {
      presetBox.addEventListener("change", function (ev) {
        var t = ev.target;
        if (!t || !t.getAttribute("data-preset")) {
          return;
        }
        var key = t.getAttribute("data-preset");
        presets[key] = !!t.checked;
        if (!presets.buyer && !presets.efficiency && !presets.charging && !presets.chemistry) {
          presets.buyer = true;
          syncPresetUI();
        }
        savePresets(presets);
        render();
      });
    }

    if (resetOrderBtn) {
      resetOrderBtn.addEventListener("click", function () {
        colOrder = DEFAULT_ORDER.slice();
        saveOrder(colOrder);
        syncColPickerUI();
        render();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        render();
      });
    }
    if (groupToggle) {
      groupToggle.addEventListener("change", function () {
        groupByMake = groupToggle.checked;
        render();
      });
    }

    syncPresetUI();
    syncAllFilterSummaries();
    bindResize();

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && openConflict) {
        openConflict = null;
        render();
      }
    });

    fetch(dataUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        allRows = Array.isArray(data) ? data : [];
        initFacets();
        render();
        if (table) {
          table.hidden = false;
        }
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent =
            "Could not load compare.json. Run npm run build:site, then refresh. (" +
            err.message +
            ")";
        }
      });
  }

  function autoMount() {
    var roots = document.querySelectorAll("[data-compare-root]");
    roots.forEach(function (root) {
      mount(root);
    });
  }

  global.EVAtlasCompare = { mount: mount };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})(typeof window !== "undefined" ? window : this);
