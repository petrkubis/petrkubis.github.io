/* mobile-extra.js — interaktivní mobilní prvky (jen telefon do 767px).
   1) Recenze: psací (typewriter) efekt jedné citace, fade out, další, dokola.
   2) „Coverflow": ve vodorovných swipe kolekcích je středová karta větší,
      krajní menší a jemně ztlumené (mléčné). Aplikuje se na všechny railů
      kromě vstupného (svislé) a recenzí (nahrazeny psacím efektem).
   Nemění desktop. */
(function () {
  'use strict';
  if (!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    buildTypewriter();
    setTimeout(setupRailFocus, 450);
  });

  /* ---------- 1) Psací recenze ---------- */
  function buildTypewriter() {
    var section = document.getElementById('reference');
    if (!section) return;
    var header = section.querySelector('.text-center');
    var box = document.createElement('div');
    box.className = 'tw-reviews';
    box.setAttribute('style', 'max-width:100%;text-align:center;padding:8px 10px 4px;min-height:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;');
    box.innerHTML =
      '<span class="material-symbols-outlined" style="color:#D4AF37;font-size:1.7rem;margin-bottom:14px;display:block">format_quote</span>' +
      '<p class="tw-quote" style="font-family:\'Hanken Grotesk\',sans-serif;font-size:16px;line-height:1.6;color:#615e57;margin:0;min-height:6.4em;transition:opacity .5s ease"></p>' +
      '<div class="tw-meta" style="margin-top:16px;opacity:0;transition:opacity .4s ease">' +
        '<span class="tw-author" style="font-family:\'Public Sans\',sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#1a2a44;display:block"></span>' +
        '<span class="tw-stars" style="display:block;color:#D4AF37;margin-top:6px;font-size:13px">★★★★★</span>' +
      '</div>';
    if (header && header.parentNode) header.parentNode.insertBefore(box, header.nextSibling);
    else return;

    fetch('content.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var list = (d && d.reviews && d.reviews.length) ? d.reviews : readFromDom(section);
        activate(section, box, list);
      })
      .catch(function () { activate(section, box, readFromDom(section)); });
  }

  function readFromDom(section) {
    var out = [];
    var ps = section.querySelectorAll('#reviews-grid p');
    Array.prototype.forEach.call(ps, function (p) {
      var card = p.closest('.bento-card');
      var au = card ? card.querySelector('.js-aut, .font-label-caps') : null;
      out.push({ text: p.textContent.replace(/[„“"„“]/g, '').trim(), author: au ? au.textContent.trim() : '', source: '' });
    });
    return out;
  }

  function activate(section, box, list) {
    if (!list || !list.length) { box.style.display = 'none'; return; }
    section.classList.add('tw-active');
    runTypewriter(box, list);
  }

  function runTypewriter(box, list) {
    var q = box.querySelector('.tw-quote'), meta = box.querySelector('.tw-meta'), au = box.querySelector('.tw-author');
    var i = 0;
    function show() {
      var r = list[i];
      var text = '„' + (r.text || '') + '“';
      var pos = 0;
      q.style.opacity = '1'; meta.style.opacity = '0'; q.textContent = '';
      au.textContent = (r.author || '') + (r.source ? (' · ' + r.source) : '');
      var typer = setInterval(function () {
        pos++;
        q.textContent = text.slice(0, pos);
        if (pos >= text.length) {
          clearInterval(typer);
          meta.style.opacity = '1';
          setTimeout(fadeOut, 2800);
        }
      }, 30);
      function fadeOut() {
        q.style.opacity = '0'; meta.style.opacity = '0';
        setTimeout(function () { i = (i + 1) % list.length; show(); }, 560);
      }
    }
    show();
  }

  /* ---------- 2) Coverflow (středová karta větší) ---------- */
  function setupRailFocus() {
    var rails = document.querySelectorAll('.mobile-card-rail');
    Array.prototype.forEach.call(rails, function (rail) {
      if (rail.closest('#tickets')) return;      /* vstupné je svislé */
      if (rail.closest('#reference')) return;    /* recenze = psací efekt */
      if (rail.closest('#personalities')) return; /* osobnosti: čistý swipe bez blednutí okrajů */
      var items = rail.children;
      var raf = 0;
      function update() {
        var rc = rail.getBoundingClientRect();
        var center = rc.left + rc.width / 2;
        for (var k = 0; k < items.length; k++) {
          var el = items[k];
          var b = el.getBoundingClientRect();
          var c = b.left + b.width / 2;
          var dist = Math.min(1, Math.abs(center - c) / (rc.width * 0.6));
          var scale = (1 - dist * 0.16).toFixed(3);
          var op = (1 - dist * 0.5).toFixed(2);
          el.style.transition = 'transform .25s ease, opacity .25s ease';
          el.style.transformOrigin = 'center center';
          el.style.transform = 'scale(' + scale + ')';
          el.style.opacity = op;
        }
      }
      rail.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; update(); });
      }, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  }
}());
