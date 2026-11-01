/**
 * Přehrávání videí z Cloudflare Stream se záchrannou sítí.
 *
 * Pravidlo: PŘEDNOST MÁ VŽDY CLOUDFLARE. Na soubor z hostingu se sáhne
 * jedině tehdy, když Cloudflare skutečně selže — ne když je jen pomalý.
 *
 * Postup:
 *   1. Video se nezačne stahovat, dokud není jasné odkud. Do té doby je
 *      vidět poster, tedy první snímek — ne prázdná barevná plocha.
 *   2. Souběžně se dělají dvě věci: server se dotáže na krátkodobý token
 *      a (mimo Safari) se přitom už stahuje přehrávač HLS. Tím odpadá
 *      jedno čekání navíc.
 *   3. Jakmile token dorazí, video se pustí z Cloudflare.
 *   4. Na hosting se přepne jen při skutečné chybě: server odpoví chybou,
 *      spadne spojení, Cloudflare vrátí neplatný manifest, nebo se do
 *      LIMIT_MS neozve vůbec nic.
 *
 * Značení ve stránce:
 *   <video data-stream="hero" data-fallback="17.mp4" poster="…">
 */
(function () {
  'use strict';

  var LIMIT_MS = 9000;   // až tak dlouho čekáme na Cloudflare, než sáhneme na hosting
  /* O kolik dřív se video začne chystat — zhruba o obrazovku a půl,
     tedy zatímco je návštěvník ještě o sekci výš. */
  var PREDSTIH_PX = Math.round((window.innerHeight || 800) * 1.5);
  var HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
  var hlsSlib = null;                     // příslib načtení knihovny (jen jednou)

  function jeSafariHls(v) {
    /* Safari (a iOS) umí HLS samo, knihovna není potřeba. */
    return !!(v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl'));
  }

  function nactiHlsJs() {
    if (hlsSlib) return hlsSlib;
    /* Hlavička stránky ho nejspíš už stahuje — vyzvedneme si rozdělanou práci
       místo toho, abychom začínali znovu. */
    if (window.__hlsPredem) {
      hlsSlib = window.__hlsPredem.catch(function () { return zacniStahovat(); });
      return hlsSlib;
    }
    hlsSlib = zacniStahovat();
    return hlsSlib;
  }

  function zacniStahovat() {
    return new Promise(function (splneno, zamitnuto) {
      if (window.Hls) return splneno(window.Hls);
      var s = document.createElement('script');
      s.src = HLS_JS;
      s.async = true;
      s.onload = function () { window.Hls ? splneno(window.Hls) : zamitnuto(); };
      s.onerror = zamitnuto;
      document.head.appendChild(s);
    });
  }

  /** Poslední záchrana — soubor z našeho hostingu. */
  function mistni(v) {
    if (v.dataset.zdroj === 'mistni' || v.dataset.zdroj === 'stream') return;
    var f = v.getAttribute('data-fallback');
    if (!f) return;
    v.dataset.zdroj = 'mistni';
    var s = v.querySelector('source');
    if (!s) { s = document.createElement('source'); s.type = 'video/mp4'; v.appendChild(s); }
    s.setAttribute('src', f);
    try { v.load(); } catch (e) {}
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function pustStream(v, url) {
    if (jeSafariHls(v)) {
      v.dataset.zdroj = 'stream';
      v.setAttribute('src', url);
      try { v.load(); } catch (e) {}
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
      /* Kdyby manifest z Cloudflare selhal až při přehrávání. */
      v.addEventListener('error', function () { v.dataset.zdroj = ''; mistni(v); }, { once: true });
      return Promise.resolve();
    }
    return nactiHlsJs().then(function (Hls) {
      if (!Hls.isSupported()) throw new Error('hls nepodporovan');
      /* Proč startLevel 0: Cloudflare posílá video v několika kvalitách a
         přehrávač si standardně první úsek vybírá sám — a na dobrém připojení
         sáhne rovnou po 1080p. Jeden takový úsek má několik megabajtů a než
         se stáhne, kouká návštěvník na nehybný obrázek klidně deset sekund.
         Začneme proto nejnižší kvalitou: první snímek naskočí skoro hned a
         kvalita se dorovná během prvních vteřin přehrávání. U videa, které
         běží pod textem jako pozadí, to není poznat.
         maxBufferLength drží dopředu jen pár vteřin — tři videa na stránce
         by se jinak přetahovala o připojení. */
      var h = new Hls({
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 10,
        backBufferLength: 10,
        startFragPrefetch: true,
        abrEwmaDefaultEstimate: 1000000
      });
      h.on(Hls.Events.ERROR, function (_e, data) {
        if (data && data.fatal) { try { h.destroy(); } catch (e) {} v.dataset.zdroj = ''; mistni(v); }
      });
      h.loadSource(url);
      h.attachMedia(v);
      v.dataset.zdroj = 'stream';
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  function zaridVideo(v) {
    var klic = v.getAttribute('data-stream');
    if (!klic) return;

    /* Přehrávač HLS potřebují všechny prohlížeče kromě Safari. Stahujeme ho
       hned teď, souběžně s dotazem na token — než token dorazí, bude hotový. */
    if (!jeSafariHls(v)) { nactiHlsJs().catch(function () {}); }

    /* Poslední pojistka: kdyby se server neozval vůbec. Není to netrpělivost,
       jen ochrana proti tomu, aby návštěvník koukal na nehybný obrázek. */
    var pojistka = setTimeout(function () { mistni(v); }, LIMIT_MS);

    /* Pro úvodní video už dotaz nejspíš běží — poslala ho hlavička stránky,
       aby se nečekalo na dostavění dokumentu. Vyzvedneme si hotový výsledek. */
    var dotaz;
    if (klic === 'hero' && window.__tokenPredem) {
      dotaz = window.__tokenPredem.then(function (d) {
        if (d && d.token) return d;
        /* Předběžný dotaz nedopadl — zeptáme se ještě jednou normálně. */
        return fetch('video-token.php?v=' + encodeURIComponent(klic), {
          credentials: 'same-origin', cache: 'no-store'
        }).then(function (r) { if (!r.ok) throw new Error('token ' + r.status); return r.json(); });
      });
    } else {
      dotaz = fetch('video-token.php?v=' + encodeURIComponent(klic), {
        credentials: 'same-origin',
        cache: 'no-store'
      }).then(function (r) { if (!r.ok) throw new Error('token ' + r.status); return r.json(); });
    }

    dotaz
      .then(function (d) {
        if (!d || !d.token || !d.zaklad) throw new Error('neuplna odpoved');
        if (v.dataset.zdroj === 'mistni') throw new Error('uz hraje mistni');
        /* Token dorazil — od téhle chvíle už čekáme na Cloudflare, ne na hodiny.
           Pojistku rušíme, aby nám video nepřepnula na hosting uprostřed
           načítání jen proto, že vypršel čas. */
        clearTimeout(pojistka);
        return pustStream(v, d.zaklad + '/' + d.token + '/manifest/video.m3u8');
      })
      .catch(function () {
        clearTimeout(pojistka);
        mistni(v);
      });
  }

  /* Kdykoli video přijde do záběru, spustí se od prvního snímku.
     Návštěvník tak vždy uvidí začátek, ne půlku smyčky. */
  function hlidejRestart(v) {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (zaznamy) {
      if (!zaznamy[0].isIntersecting) { try { v.pause(); } catch (e) {} return; }
      try { if (v.currentTime > 0.15) v.currentTime = 0; } catch (e) {}
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
    }, { threshold: 0.25 }).observe(v);
  }

  function start() {
    var videa = document.querySelectorAll('video[data-stream][data-fallback]');

    /* Každé video se rozjede teprve, až se k němu návštěvník blíží.
       Dřív se spouštěla všechna tři naráz hned při načtení stránky a
       přetahovala se o připojení — úvodní video se tím zdrželo a to
       poslední se často nerozjelo vůbec. */
    Array.prototype.forEach.call(videa, function (v) {
      var r = v.getBoundingClientRect();
      var uzVidet = r.top < (window.innerHeight || 800) && r.bottom > 0;

      hlidejRestart(v);

      if (uzVidet || !('IntersectionObserver' in window)) {
        zaridVideo(v);
        return;
      }

      var pozorovatel = new IntersectionObserver(function (zaznamy) {
        if (!zaznamy[0].isIntersecting) return;
        pozorovatel.disconnect();
        zaridVideo(v);
      }, { rootMargin: PREDSTIH_PX + 'px 0px' });
      pozorovatel.observe(v);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
