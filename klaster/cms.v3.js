/*
 * cms.js — jednoduchý „hydratační" loader pro obsah spravovaný přes /admin/.
 * Načte content.json a doplní/aktualizuje texty, fotky, otevírací dobu, ceník
 * a příspěvky (aktuality) v již vykreslené statické stránce.
 *
 * Pokud se content.json nepodaří načíst (výpadek, ještě nenahráno na hosting…),
 * stránka zůstane přesně taková, jaká je nyní ve statickém HTML — nic se nerozbije.
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s);
  }

  /* --------------------------------------------------------------
     Druhá obrana: i kdyby se do obsahu dostalo něco nebezpečného,
     v prohlížeči se to nespustí. Adresy se ověřují, texty se vkládají
     jen s povolenými značkami.
     -------------------------------------------------------------- */
  var BLOCKED_SCHEMES = /^(javascript|data|vbscript|file|blob|about|jar|view-source)$/i;

  function unwrapUrl(v) {
    var s = String(v == null ? "" : v);
    for (var i = 0; i < 4; i++) {
      var d = s;
      try { d = decodeURIComponent(d); } catch (e) {}
      d = d.replace(/&#x([0-9a-f]+);?/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
           .replace(/&#(\d+);?/g, function (m, n) { return String.fromCharCode(parseInt(n, 10)); })
           .replace(/&colon;/gi, ":");
      if (d === s) break;
      s = d;
    }
    return s.replace(/[\u0000-\u0020\u007F\u00A0]/g, "");
  }

  function safeUrl(v) {
    var raw = String(v == null ? "" : v).trim();
    if (!raw) return "";
    var probe = unwrapUrl(raw);
    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(probe);
    if (m) {
      var scheme = m[1].toLowerCase();
      if (BLOCKED_SCHEMES.test(scheme)) return "";
      if (["http", "https", "mailto", "tel"].indexOf(scheme) === -1) return "";
    }
    if (raw.indexOf("//") === 0) return "";
    return raw;
  }

  var ALLOWED_TAGS = { BR: [], STRONG: [], B: [], EM: [], I: [], SUP: [], SUB: [],
                       SPAN: ["class"], A: ["href", "target", "rel", "class"] };

  /* Vloží text a nechá projít jen povolené značky. Nahrazuje přímé innerHTML. */
  function setSafeHtml(el, html) {
    var tpl = document.createElement("div");
    tpl.innerHTML = String(html == null ? "" : html);
    scrub(tpl);
    el.innerHTML = "";
    while (tpl.firstChild) el.appendChild(tpl.firstChild);
  }

  function scrub(node) {
    var kids = Array.prototype.slice.call(node.childNodes);
    kids.forEach(function (child) {
      if (child.nodeType === 3) return;                       // text
      if (child.nodeType !== 1) { child.remove(); return; }   // komentáře apod.

      // nebezpečné značky pryč i s obsahem
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|SVG|MATH|TEMPLATE|NOSCRIPT|LINK|META)$/.test(child.tagName)) {
        child.remove();
        return;
      }
      var allowed = ALLOWED_TAGS[child.tagName];
      if (!allowed) {
        scrub(child);
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        child.remove();
        return;
      }
      Array.prototype.slice.call(child.attributes).forEach(function (a) {
        var name = a.name.toLowerCase();
        if (allowed.indexOf(name) === -1) { child.removeAttribute(a.name); return; }
        if (name === "href") {
          var u = safeUrl(a.value);
          if (!u) child.removeAttribute("href"); else child.setAttribute("href", u);
        } else if (name === "target") {
          if (a.value !== "_blank") child.removeAttribute("target");
          else child.setAttribute("rel", "noopener");
        }
      });
      scrub(child);
    });
  }

  function applyTexts(data) {
    if (!data.texts) return;
    document.querySelectorAll("[data-cms-text]").forEach(function (el) {
      var key = el.getAttribute("data-cms-text");
      if (Object.prototype.hasOwnProperty.call(data.texts, key)) {
        setSafeHtml(el, data.texts[key]);
      }
    });
  }

  function applyImages(data) {
    if (!data.images) return;
    document.querySelectorAll("[data-cms-img]").forEach(function (el) {
      var key = el.getAttribute("data-cms-img");
      if (Object.prototype.hasOwnProperty.call(data.images, key)) {
        var nextSrc = safeUrl(data.images[key]);
        if (!nextSrc) return;

        /* Pokud je obrázek uvnitř <picture>, prohlížeč upřednostní <source>
           před img.src. Při změně přes administraci proto původní WebP zdroj
           odstraníme; jinak by se nová fotografie sice nastavila, ale nebyla vidět. */
        var picture = el.closest("picture");
        var staticSrc = el.getAttribute("src") || "";
        var sameAsStatic = false;
        try {
          sameAsStatic = new URL(nextSrc, document.baseURI).href === new URL(staticSrc, document.baseURI).href;
        } catch (ignore) {}
        if (picture && !sameAsStatic) {
          picture.querySelectorAll("source").forEach(function (source) { source.remove(); });
        }
        el.src = nextSrc;
      }
    });
    document.querySelectorAll("[data-cms-poster]").forEach(function (el) {
      var key = el.getAttribute("data-cms-poster");
      if (Object.prototype.hasOwnProperty.call(data.images, key)) {
        var p = safeUrl(data.images[key]);
        if (p) el.poster = p;
      }
    });
    document.querySelectorAll("[data-cms-bg]").forEach(function (el) {
      var key = el.getAttribute("data-cms-bg");
      if (Object.prototype.hasOwnProperty.call(data.images, key)) {
        var url = safeUrl(data.images[key]);
        if (!url) return;
        url = url.replace(/['"\\()]/g, "");
        var current = el.style.backgroundImage || "";
        if (/url\(/.test(current)) {
          el.style.backgroundImage = current.replace(/url\([^)]*\)/, "url('" + url + "')");
        }
      }
    });
  }

  /* Volitelné části webu (podpis autora v patičce). */
  function applyOptions(data) {
    var o = data.options || {};
    var credit = document.querySelector("[data-credit]");
    if (credit) {
      var show = !("footer_credit" in o) || !!o.footer_credit;
      credit.hidden = !show;
    }
  }

  function applyLinks(data) {
    if (!data.links) return;
    document.querySelectorAll("[data-cms-href]").forEach(function (el) {
      var key = el.getAttribute("data-cms-href");
      if (!Object.prototype.hasOwnProperty.call(data.links, key)) return;
      var url = safeUrl(data.links[key]);
      if (!url) return;
      el.setAttribute("href", url);
      // odkaz mimo web otevřeme v nové záložce
      if (/^https?:\/\//i.test(url) && url.indexOf(location.host) === -1) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
    });
  }

  function applyVideos(data) {
    if (!data.videos) return;
    document.querySelectorAll("video[data-cms-video]").forEach(function (video) {
      var key = video.getAttribute("data-cms-video");
      if (!Object.prototype.hasOwnProperty.call(data.videos, key)) return;
      var nextSrc = safeUrl(data.videos[key]);
      if (!nextSrc) return;

      var source = video.querySelector("source[data-cms-source]") || video.querySelector("source");
      if (!source) {
        source = document.createElement("source");
        source.setAttribute("data-cms-source", "");
        video.insertBefore(source, video.firstChild);
      }
      source.src = nextSrc;
      source.type = /\.webm(?:$|[?#])/i.test(nextSrc) ? "video/webm" : "video/mp4";
      video.load();
      if (video.autoplay) {
        var play = video.play();
        if (play && typeof play.catch === "function") play.catch(function () {});
      }
    });
  }

  function applyHours(data) {
    var list = document.getElementById("hours-list");
    /* prázdná data nikdy nesmí smazat statický obsah stránky */
    if (!list || !Array.isArray(data.hours) || !data.hours.length) return;
    list.innerHTML = "";
    data.hours.forEach(function (row, i) {
      var div = document.createElement("div");
      div.className = "flex justify-between" + (i < data.hours.length - 1 ? " border-b border-white/10 pb-2" : "");
      var l = document.createElement("span");
      l.className = "font-body-md opacity-80";
      l.textContent = row.label;
      var t = document.createElement("span");
      t.className = "font-label-caps text-accent-gold uppercase";
      t.textContent = row.time;
      div.appendChild(l);
      div.appendChild(t);
      list.appendChild(div);
    });
  }

  function applyPrices(data) {
    var list = document.getElementById("prices-list");
    if (!list || !Array.isArray(data.prices) || !data.prices.length) return;
    list.innerHTML = "";
    data.prices.forEach(function (row, i) {
      var div = document.createElement("div");
      div.className = "flex justify-between items-center" + (i < data.prices.length - 1 ? " border-b border-black/5 pb-4" : "");
      var left = document.createElement("div");
      var title = document.createElement("div");
      title.className = "font-headline-md text-lg text-presidential-blue";
      title.textContent = row.title;
      var sub = document.createElement("p");
      sub.className = "font-body-md text-xs text-secondary/70";
      sub.textContent = row.subtitle;
      left.appendChild(title);
      left.appendChild(sub);
      var price = document.createElement("div");
      price.className = "font-display-lg text-2xl text-accent-gold";
      price.textContent = row.price;
      div.appendChild(left);
      div.appendChild(price);
      list.appendChild(div);
    });
  }

  function applyNewsPreview(data) {
    if (!Array.isArray(data.posts) || !data.posts.length) return;
    var picks = data.posts.slice(-2);
    var ids = ["news-preview-1", "news-preview-2"];
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      var post = picks[i];
      if (!el || !post) return;
      var img = el.querySelector("img");
      var badge = el.querySelector("span");
      var title = el.querySelector("h3");
      if (img) { img.src = post.image; img.alt = post.title; }
      if (badge) badge.textContent = post.badge;
      if (title) title.textContent = post.title;
    });
  }

  function buildPostCard(post) {
    var article = document.createElement("article");
    article.className = "bento-card rounded-xl overflow-hidden group cursor-pointer flex flex-col";
    article.setAttribute("data-post-id", post.id);
    article.addEventListener("click", function () {
      var url = safeUrl(post.link);
      if (!url) return;
      if (/^https?:\/\//i.test(url)) window.open(url, "noopener,noreferrer");
      else location.href = url;
    });

    var imgWrap = document.createElement("div");
    imgWrap.className = "aspect-[16/10] overflow-hidden";
    var img = document.createElement("img");
    img.alt = post.title || "";
    img.className = "w-full h-full object-cover transition-all duration-700 group-hover:scale-105";
    img.src = safeUrl(post.image) || "";
    img.onerror = function () { imgWrap.style.display = "none"; };
    imgWrap.appendChild(img);

    var body = document.createElement("div");
    body.className = "p-8 flex flex-col flex-1";

    var badge = document.createElement("span");
    badge.className = "font-label-caps text-[10px] text-accent-gold mb-3 block uppercase";
    badge.textContent = post.badge || "";

    var h2 = document.createElement("h2");
    h2.className = "font-headline-md text-2xl text-presidential-blue group-hover:text-accent-gold transition-colors mb-3";
    h2.textContent = post.title || "";

    var p = document.createElement("p");
    p.className = "font-body-md text-secondary text-sm flex-1";
    p.textContent = post.text || "";

    var arrow = document.createElement("span");
    arrow.className = "material-symbols-outlined text-presidential-blue/30 group-hover:text-accent-gold transition-colors mt-6";
    arrow.textContent = "arrow_right_alt";

    body.appendChild(badge);
    body.appendChild(h2);
    body.appendChild(p);
    body.appendChild(arrow);
    article.appendChild(imgWrap);
    article.appendChild(body);
    return article;
  }

  function applyPostsGrid(data) {
    var grid = document.getElementById("posts-grid");
    if (!grid || !Array.isArray(data.posts) || !data.posts.length) return;

    // Odeber staré dynamické karty (přidané/upravené přes admin), pinned karty nech být.
    grid.querySelectorAll("[data-post-id]").forEach(function (el) { el.remove(); });

    var lastPinned = grid.querySelector('[data-pinned="last"]');
    data.posts.forEach(function (post) {
      var card = buildPostCard(post);
      if (lastPinned) grid.insertBefore(card, lastPinned);
      else grid.appendChild(card);
    });
  }

  function applyInstagram(data) {
    var grid = document.getElementById("ig-grid");
    if (!grid || !Array.isArray(data.instagram) || !data.instagram.length) return;
    var posts = data.instagram.slice(-4);
    grid.innerHTML = "";
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-" + Math.min(posts.length, 4) + " gap-6 items-start justify-items-center";
    posts.forEach(function (p) {
      /* Jednotná bento dlaždice: pevné okno s embedem + vlastní spodní pruh v designu webu */
      var wrap = document.createElement("div");
      wrap.className = "bento-card rounded-xl overflow-hidden w-full flex flex-col";
      wrap.style.maxWidth = "400px";

      var win = document.createElement("div");
      win.style.height = "470px";
      win.style.overflow = "hidden";
      win.style.position = "relative";
      win.style.background = "#fff";

      var b = document.createElement("blockquote");
      b.className = "instagram-media";
      b.setAttribute("data-instgrm-permalink", p.url);
      b.setAttribute("data-instgrm-version", "14");
      b.style.margin = "0";
      b.style.width = "100%";
      b.style.minWidth = "0";
      b.style.border = "0";
      b.style.borderRadius = "0";
      b.style.boxShadow = "none";
      win.appendChild(b);

      var bar = document.createElement("a");
      bar.href = p.url;
      bar.target = "_blank";
      bar.rel = "noopener";
      bar.className = "bg-white border-t border-black/5 p-4 flex items-center justify-between";
      var label = document.createElement("span");
      label.className = "font-label-caps text-[10px] text-presidential-blue uppercase tracking-widest";
      label.textContent = "@kkc_ostrov";
      var icon = document.createElement("span");
      icon.className = "material-symbols-outlined text-accent-gold text-sm";
      icon.textContent = "photo_camera";
      bar.appendChild(label);
      bar.appendChild(icon);

      wrap.appendChild(win);
      wrap.appendChild(bar);
      grid.appendChild(wrap);
    });
    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    } else if (!document.getElementById("ig-embed-script")) {
      var s = document.createElement("script");
      s.id = "ig-embed-script";
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }


  /* Dá vědět stránce, že se obsah seznamu vyměnil — karusel se pak přestaví. */
  function notifyList(el) {
    try {
      document.dispatchEvent(new CustomEvent("cms:list-updated", { detail: { el: el } }));
    } catch (e) {}
  }

  function applyReviews(data) {
    var grid = document.getElementById("reviews-grid");
    if (!grid || !Array.isArray(data.reviews) || !data.reviews.length) return;
    var colors = [["bg-presidential-blue","text-white"],["bg-accent-gold","text-ink-black"],["bg-secondary","text-white"]];

    function stars(n) {
      n = Math.max(0, Math.min(5, parseInt(n, 10) || 5));
      var full = "\u2605".repeat(n), empty = "\u2606".repeat(5 - n);
      return '<span class="text-accent-gold text-sm" title="' + n + ' z 5" aria-label="Hodnocení ' + n + ' z 5">'
           + full + '<span style="opacity:.35">' + empty + '</span></span>';
    }

    /* Logo Google podle oficiálních barev; u ostatních zdrojů jen text. */
    function sourceMark(src) {
      var s = String(src || "").toLowerCase();
      if (s.indexOf("google") !== -1) {
        return '<span style="display:inline-flex;align-items:center;gap:5px">'
          + '<svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true" style="flex:0 0 auto">'
          + '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>'
          + '<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9.3h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.8z"/>'
          + '<path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6.1z"/>'
          + '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>'
          + '</svg><span>Google recenze</span></span>';
      }
      return '<span></span>';
    }

    grid.innerHTML = "";
    data.reviews.forEach(function (r, i) {
      var col = colors[i % colors.length];
      var card = document.createElement("div");
      card.className = "bento-card rounded-xl p-10 flex flex-col";

      var photoUrl = safeUrl(r.photo);
      var avatar = photoUrl
        ? '<img src="' + esc(photoUrl).replace(/"/g, "&quot;") + '" alt="" width="44" height="44" loading="lazy" decoding="async" '
          + 'class="w-11 h-11 rounded-full object-cover shrink-0">'
        : '<div class="w-11 h-11 rounded-full ' + col[0] + " " + col[1]
          + ' flex items-center justify-center font-headline-md text-base shrink-0 js-ini"></div>';

      var meta = [];
      if (r.source) meta.push(sourceMark(r.source));
      if (r.date) meta.push('<span>' + esc(r.date) + '</span>');
      var metaHtml = meta.length
        ? '<span class="font-body-md text-[11px] text-secondary/60 js-src" style="display:flex;gap:8px;align-items:center">'
          + meta.join('<span style="opacity:.4">·</span>') + '</span>'
        : "";

      var quote = '<span class="material-symbols-outlined text-accent-gold text-3xl mb-6">format_quote</span>';
      var body = '<p class="font-body-lg text-secondary leading-relaxed flex-1 js-txt"></p>';
      var foot =
        '<div class="mt-8 pt-6 border-t border-black/5 flex items-center justify-between gap-4">'
        + '<div class="flex items-center gap-3 min-w-0">' + avatar
        + '<div class="min-w-0">'
        + '<span class="font-label-caps text-[10px] text-presidential-blue uppercase tracking-widest block js-aut"></span>'
        + metaHtml
        + "</div></div>" + stars(r.rating) + "</div>";

      card.innerHTML = quote + body + foot;
      card.querySelector(".js-txt").textContent = "\u201E" + (r.text || "") + "\u201C";
      card.querySelector(".js-aut").textContent = r.author || "";
      var ini = card.querySelector(".js-ini");
      if (ini) ini.textContent = (r.initial || (r.author || "?").charAt(0)).toUpperCase();

      var revLink = safeUrl(r.link);
      if (revLink) {
        var a = document.createElement("a");
        a.href = revLink;
        a.target = "_blank";
        a.rel = "noopener nofollow";
        a.className = "font-label-caps text-[10px] text-accent-gold uppercase tracking-widest mt-4 inline-block hover:text-presidential-blue transition-colors";
        a.textContent = "Zobrazit recenzi";
        card.appendChild(a);
      }
      grid.appendChild(card);
    });
    notifyList(grid);
  }

  function init(data) {
    try { applyTexts(data); } catch (e) {}
    try { applyImages(data); } catch (e) {}
    try { applyVideos(data); } catch (e) {}
    try { applyLinks(data); } catch (e) {}
    try { applyOptions(data); } catch (e) {}
    try { applyHours(data); } catch (e) {}
    try { applyPrices(data); } catch (e) {}
    try { applyNewsPreview(data); } catch (e) {}
    try { applyPostsGrid(data); } catch (e) {}
    try { applyInstagram(data); } catch (e) {}
    try { applyReviews(data); } catch (e) {}
  }

  /* === Klouzavá zlatá linka v horním menu ===
     Linka stojí pod aktivní stránkou; při najetí myší plyne na položku pod kurzorem,
     po odjetí se vrací. Kliknutím (kotva na stejné stránce) se přesune trvale. */
  (function () {
    var nav = document.querySelector("#top-nav div.hidden");
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    if (!links.length) return;
    var active = null;
    links.forEach(function (a) {
      if (a.classList.contains("border-accent-gold")) active = a;
      a.classList.remove("border-b-2", "border-accent-gold", "pb-1");
    });
    if (getComputedStyle(nav).position === "static") nav.style.position = "relative";
    var bar = document.createElement("span");
    bar.style.cssText = "position:absolute;bottom:-8px;height:2px;background:#D4AF37;width:0;margin:0;" +
      "transition:left .35s cubic-bezier(.4,0,.2,1),width .35s cubic-bezier(.4,0,.2,1);pointer-events:none;";
    nav.appendChild(bar);
    function place(el) {
      if (!el) { bar.style.width = "0"; return; }
      /* měření přes rects – přesné vůči skutečné poloze textu (okraje, mezery, fonty) */
      var nr = nav.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      bar.style.left = (r.left - nr.left) + "px";
      bar.style.width = r.width + "px";
    }
    links.forEach(function (a) {
      a.addEventListener("click", function () { active = a; place(a); });
    });
    /* Rozšířená zóna: linka reaguje i cca 110 px POD menu – drží a klouže do stran s myší,
       dokud kurzor zónu neopustí; pak se vrátí pod aktivní stránku. */
    var EXTEND_BELOW = 110, hovering = false;
    document.addEventListener("mousemove", function (e) {
      var nr = nav.getBoundingClientRect();
      if (e.clientY >= nr.top - 10 && e.clientY <= nr.bottom + EXTEND_BELOW) {
        var first = links[0].getBoundingClientRect();
        var last = links[links.length - 1].getBoundingClientRect();
        if (e.clientX >= first.left - 40 && e.clientX <= last.right + 40) {
          /* nejbližší položka podle vodorovné vzdálenosti od kurzoru */
          var best = null, bestDist = Infinity;
          links.forEach(function (a) {
            var r = a.getBoundingClientRect();
            var cx = (r.left + r.right) / 2;
            var d = Math.abs(e.clientX - cx);
            if (d < bestDist) { bestDist = d; best = a; }
          });
          if (best) { hovering = true; place(best); return; }
        }
      }
      if (hovering) { hovering = false; place(active); }
    }, { passive: true });
    window.addEventListener("resize", function () { place(active); });
    if (document.readyState === "complete") place(active);
    else window.addEventListener("load", function () { place(active); });
    /* po donačtení webových fontů se šířky textů změní – přeměřit */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { place(active); });
    }
  })();

  fetch("content.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) init(data); })
    .catch(function () { /* ticho — statický obsah zůstává beze změny */ });
})();
