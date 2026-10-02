/**
 * Shared Compare table: filters, group-by-make, column picker, provenance.
 * Reads only site/data/compare.json (generated). Missing values render as —.
 */
(function (global) {
  "use strict";

  var MISSING = "\u2014";
  var STORAGE_KEY = "ev-atlas-compare-cols";

  var IDENTITY_COLS = [
    { key: "make", label: "Make", sticky: 0 },
    { key: "model", label: "Model", sticky: 1 },
    { key: "trim", label: "Trim", sticky: 2 },
    { key: "model_year", label: "Year", sticky: 3, num: true }
  ];

  var SPEC_COLS = [
    {
      key: "identity.msrp_usd",
      label: "MSRP ($)",
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
      key: "efficiency.epa_kwh_per_100mi",
      label: "kWh/100 mi",
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
      key: "battery.pack_kwh",
      label: "Pack (kWh)",
      num: true,
      presets: ["buyer", "efficiency", "charging"]
    },
    {
      key: "powertrain.accel_0_60_s",
      label: "0–60 (s)",
      num: true,
      presets: ["buyer"]
    },
    {
      key: "battery.cell_chemistry",
      label: "Chemistry",
      presets: ["chemistry"]
    }
  ];

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
    if (key === "identity.msrp_usd" && typeof value === "number") {
      return { text: value.toLocaleString("en-US"), missing: false };
    }
    if (typeof value === "number") {
      var text = Number.isInteger(value) ? String(value) : String(value);
      return { text: text, missing: false };
    }
    return { text: String(value), missing: false };
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

  function visibleSpecCols(presets) {
    return SPEC_COLS.filter(function (col) {
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

  function fillSelect(select, values, allLabel) {
    select.innerHTML = "";
    var optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = allLabel;
    select.appendChild(optAll);
    values.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function mount(root) {
    if (!root) {
      return;
    }

    var dataUrl = root.getAttribute("data-src") || "data/compare.json";
    var searchInput = root.querySelector("[data-compare-search]");
    var makeSelect = root.querySelector("[data-compare-filter-make]");
    var yearSelect = root.querySelector("[data-compare-filter-year]");
    var driveSelect = root.querySelector("[data-compare-filter-drive]");
    var portSelect = root.querySelector("[data-compare-filter-port]");
    var groupToggle = root.querySelector("[data-compare-group]");
    var countEl = root.querySelector("[data-compare-count]");
    var presetBox = root.querySelector("[data-compare-presets]");
    var table = root.querySelector("[data-compare-table]");
    var theadRow = root.querySelector("[data-compare-thead-row]");
    var tbody = root.querySelector("[data-compare-body]");
    var errorEl = root.querySelector("[data-compare-error]");

    var allRows = [];
    var presets = loadPresets();
    var sortState = { key: "make", dir: 1 };
    var groupByMake = !groupToggle || groupToggle.checked;

    function activeSpecCols() {
      return visibleSpecCols(presets);
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
        th.className = "sortable" + (col.num ? " num" : "");
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
        } else if (col.key === "trim") {
          td.className += " trim-cell";
          td.textContent = cell.text;
        } else {
          td.textContent = cell.text;
        }
        tr.appendChild(td);
      });
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
          td.className = col.num ? "num" : "";
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
            td.textContent = cell.text;
          }
          if (tipParts.length) {
            td.title = tipParts.join(" \u00b7 ");
          }
        }
        tr.appendChild(td);
      });
    }

    function filteredRows() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : "";
      var make = makeSelect ? makeSelect.value : "";
      var year = yearSelect ? yearSelect.value : "";
      var drive = driveSelect ? driveSelect.value : "";
      var port = portSelect ? portSelect.value : "";

      return allRows.filter(function (row) {
        if (make && row.make !== make) {
          return false;
        }
        if (year && String(row.model_year) !== year) {
          return false;
        }
        if (drive) {
          if (isMissing(row["powertrain.drive_layout"])) {
            return false;
          }
          if (String(row["powertrain.drive_layout"]) !== drive) {
            return false;
          }
        }
        if (port) {
          if (isMissing(row["charging.port_type"])) {
            return false;
          }
          if (String(row["charging.port_type"]) !== port) {
            return false;
          }
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
          var tr = document.createElement("tr");
          appendIdentityCells(tr, row);
          appendSpecCells(tr, row);
          tbody.appendChild(tr);
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
        var tr = document.createElement("tr");
        appendIdentityCells(tr, row);
        appendSpecCells(tr, row);
        tbody.appendChild(tr);
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

    function onFilterChange() {
      render();
    }

    function initFacets() {
      fillSelect(makeSelect, uniqueSorted(allRows.map(function (r) { return r.make; })), "All makes");
      fillSelect(
        yearSelect,
        uniqueSorted(
          allRows.map(function (r) {
            return isMissing(r.model_year) ? null : String(r.model_year);
          })
        ),
        "All years"
      );
      fillSelect(
        driveSelect,
        uniqueSorted(
          allRows.map(function (r) {
            return r["powertrain.drive_layout"];
          })
        ),
        "All drive layouts"
      );
      fillSelect(
        portSelect,
        uniqueSorted(
          allRows.map(function (r) {
            return r["charging.port_type"];
          })
        ),
        "All ports"
      );
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

    if (searchInput) {
      searchInput.addEventListener("input", onFilterChange);
    }
    [makeSelect, yearSelect, driveSelect, portSelect].forEach(function (el) {
      if (el) {
        el.addEventListener("change", onFilterChange);
      }
    });
    if (groupToggle) {
      groupToggle.addEventListener("change", function () {
        groupByMake = groupToggle.checked;
        render();
      });
    }

    syncPresetUI();

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
