(function () {
  "use strict";

  var STORAGE_KEY = "ev-atlas-sheet-width";
  var DEFAULT_MAX = 1100;
  var MIN_WIDTH = 720;

  function mountPadPx() {
    var raw = getComputedStyle(document.body).paddingLeft;
    var n = parseFloat(raw);
    return Number.isFinite(n) ? n : 12;
  }

  function maxAllowed() {
    return Math.max(MIN_WIDTH, window.innerWidth - mountPadPx() * 2);
  }

  function clampWidth(px) {
    return Math.round(Math.min(maxAllowed(), Math.max(MIN_WIDTH, px)));
  }

  function loadWidth() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var n = parseFloat(raw);
      return Number.isFinite(n) ? clampWidth(n) : null;
    } catch (err) {
      return null;
    }
  }

  function saveWidth(px) {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(px));
    } catch (err) {
      /* ignore quota / private mode */
    }
  }

  function clearWidth() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function applyWidth(sheet, px) {
    if (px == null) {
      sheet.style.removeProperty("--sheet-width");
      return;
    }
    sheet.style.setProperty("--sheet-width", clampWidth(px) + "px");
  }

  function currentWidth(sheet) {
    return Math.round(sheet.getBoundingClientRect().width);
  }

  function bindHandle(sheet, handle, edge) {
    handle.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      var startX = ev.clientX;
      var startW = currentWidth(sheet);
      handle.setPointerCapture(ev.pointerId);
      sheet.classList.add("is-sheet-resizing");
      document.body.classList.add("is-sheet-resizing");

      function onMove(moveEv) {
        var dx = moveEv.clientX - startX;
        /* Centered sheet: each edge contributes half; drag out widens. */
        var signed = edge === "end" ? dx : -dx;
        var next = clampWidth(startW + signed * 2);
        applyWidth(sheet, next);
      }

      function onUp(upEv) {
        handle.releasePointerCapture(upEv.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        sheet.classList.remove("is-sheet-resizing");
        document.body.classList.remove("is-sheet-resizing");
        saveWidth(currentWidth(sheet));
      }

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });

    handle.addEventListener("dblclick", function () {
      clearWidth();
      applyWidth(sheet, null);
    });

    handle.addEventListener("keydown", function (ev) {
      var step = ev.shiftKey ? 48 : 16;
      var w = currentWidth(sheet);
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        var wider = clampWidth(w + step);
        applyWidth(sheet, wider);
        saveWidth(wider);
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        var narrower = clampWidth(w - step);
        applyWidth(sheet, narrower);
        saveWidth(narrower);
      } else if (ev.key === "Home" || ev.key === "Escape") {
        ev.preventDefault();
        clearWidth();
        applyWidth(sheet, null);
      }
    });
  }

  function enhance(sheet) {
    if (sheet.hasAttribute("data-sheet-ready")) {
      return;
    }
    sheet.setAttribute("data-sheet-ready", "");
    sheet.classList.add("sheet-resizable");

    var left = document.createElement("button");
    left.type = "button";
    left.className = "sheet-resize sheet-resize-start";
    left.setAttribute("aria-label", "Widen or narrow page from left edge");
    left.setAttribute("title", "Drag to widen. Double-click to reset.");
    left.tabIndex = 0;

    var right = document.createElement("button");
    right.type = "button";
    right.className = "sheet-resize sheet-resize-end";
    right.setAttribute("aria-label", "Widen or narrow page from right edge");
    right.setAttribute("title", "Drag to widen. Double-click to reset.");
    right.tabIndex = 0;

    sheet.appendChild(left);
    sheet.appendChild(right);
    bindHandle(sheet, left, "start");
    bindHandle(sheet, right, "end");

    var stored = loadWidth();
    if (stored != null && stored !== DEFAULT_MAX) {
      applyWidth(sheet, stored);
    }
  }

  function init() {
    document.querySelectorAll(".page.page-wide").forEach(enhance);
  }

  window.addEventListener("resize", function () {
    document.querySelectorAll(".page.page-wide").forEach(function (sheet) {
      var raw = sheet.style.getPropertyValue("--sheet-width");
      if (!raw) {
        return;
      }
      var n = parseFloat(raw);
      if (!Number.isFinite(n)) {
        return;
      }
      var next = clampWidth(n);
      if (next !== Math.round(n)) {
        applyWidth(sheet, next);
        saveWidth(next);
      }
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
