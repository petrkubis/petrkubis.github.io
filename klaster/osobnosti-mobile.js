/*
 * osobnosti-mobile.js — na telefonu složí stránku Osobnosti do čtyř rozbalovacích skupin.
 * Desktop ani tablet se nemění: skript se spustí jen do 767 px.
 */
(function () {
  "use strict";

  if (!window.matchMedia || !window.matchMedia("(max-width: 767px)").matches) return;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /* Rozbalovací šipka */
  function chevron() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("os-chevron");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M6 9l6 6 6-6");
    svg.appendChild(p);
    return svg;
  }

  /* Karusely tady nechceme — obsah má být pod sebou jako na počítači. */
  function unwrapRails(root) {
    root.querySelectorAll(".mobile-card-rail-shell").forEach(function (shell) {
      var rail = shell.querySelector(".mobile-card-rail");
      if (!rail) return;
      rail.classList.remove("mobile-card-rail");
      rail.removeAttribute("style");
      rail.classList.add("os-stack");
      Array.prototype.forEach.call(rail.children, function (c) {
        c.removeAttribute("style");
      });
      shell.parentNode.insertBefore(rail, shell);
      shell.parentNode.removeChild(shell);
    });
    // pager, který mohl vzniknout dřív
    root.querySelectorAll('[aria-hidden="true"]').forEach(function (p) {
      if (p.children.length && p.style && p.style.display === "flex" && p.previousElementSibling) {
        var kids = Array.prototype.every.call(p.children, function (c) { return c.tagName === "SPAN"; });
        if (kids) p.parentNode.removeChild(p);
      }
    });
    root.querySelectorAll(".grid").forEach(function (g) {
      g.classList.add("os-stack");
    });
  }

  function build() {
    var section = null;
    var headers = [];

    /* Nadpisy skupin poznáme podle malého zlatého popisku uvnitř vystředěného bloku. */
    document.querySelectorAll("main section").forEach(function (sec) {
      var found = Array.prototype.filter.call(sec.children[0] ? sec.children[0].children : [], function (el) {
        return el.classList && el.classList.contains("text-center")
            && el.querySelector(".font-label-caps")
            && el.querySelector("h2");
      });
      if (found.length >= 3) { section = sec; headers = found; }
    });
    if (!section || headers.length < 2) return;

    var holder = headers[0].parentNode;
    unwrapRails(section);

    var wrap = document.createElement("div");
    wrap.className = "os-accordion";
    holder.insertBefore(wrap, headers[0]);

    headers.forEach(function (head, i) {
      var kickerEl = head.querySelector(".font-label-caps");
      var titleEl = head.querySelector("h2");
      var leadEl = head.querySelector("p");

      var item = document.createElement("div");
      item.className = "os-item";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "os-head";
      btn.setAttribute("aria-expanded", "false");

      var texts = document.createElement("span");
      texts.className = "os-head-texts";
      var kicker = document.createElement("span");
      kicker.className = "os-kicker";
      kicker.textContent = kickerEl ? kickerEl.textContent.trim() : "";
      var title = document.createElement("span");
      title.className = "os-title";
      title.textContent = titleEl ? titleEl.textContent.trim() : "";
      texts.appendChild(kicker);
      texts.appendChild(title);
      btn.appendChild(texts);
      btn.appendChild(chevron());

      var body = document.createElement("div");
      body.className = "os-body";
      body.hidden = true;

      /* Perex skupiny přesuneme dovnitř, ať je hlavička krátká. */
      if (leadEl) body.appendChild(leadEl);

      /* Vše až po další nadpis patří do téhle skupiny. */
      var node = head.nextElementSibling;
      while (node && headers.indexOf(node) === -1) {
        var next = node.nextElementSibling;
        body.appendChild(node);
        node = next;
      }

      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        if (open) {
          btn.setAttribute("aria-expanded", "false");
          body.hidden = true;
          item.classList.remove("is-open");
        } else {
          btn.setAttribute("aria-expanded", "true");
          body.hidden = false;
          item.classList.add("is-open");
          /* ať je po rozbalení vidět začátek skupiny */
          setTimeout(function () {
            var top = item.getBoundingClientRect().top + window.scrollY - 78;
            window.scrollTo({ top: top, behavior: "smooth" });
          }, 60);
        }
      });

      item.appendChild(btn);
      item.appendChild(body);
      wrap.appendChild(item);

      head.parentNode.removeChild(head);
    });
  }

  /* Počkáme, až doběhne obecný mobilní skript, který jinde dělá karusely. */
  ready(function () { setTimeout(build, 220); });
})();
