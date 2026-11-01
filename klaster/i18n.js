/* i18n.js — vícejazyčnost webu (CZ výchozí, EN, DE).
   - Jazyk: uložená volba (localStorage) → jazyk prohlížeče → EN pro cizince, jinak CZ.
   - Překládá textové uzly a vybrané atributy podle slovníku window.I18N_DICT.
   - Ruční přepínač: prvky s atributem data-lang="cs|en|de".
   - Dynamický obsah (hydratace z content.json) se dopřekládá přes MutationObserver.
   Zdrojové HTML je česky; při přepnutí na jiný jazyk se stránka znovu načte a přeloží. */
(function () {
  'use strict';

  var DICT = window.I18N_DICT || {};
  var ATTR_KEYS = ['placeholder', 'aria-label', 'title', 'alt'];
  var STORE = 'site_lang';

  function detect() {
    try {
      var saved = localStorage.getItem(STORE);
      if (saved === 'cs' || saved === 'en' || saved === 'de') return saved;
    } catch (e) {}
    var langs = navigator.languages || [navigator.language || navigator.userLanguage || 'cs'];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || '').toLowerCase();
      if (l.indexOf('cs') === 0 || l.indexOf('sk') === 0) return 'cs';
      if (l.indexOf('de') === 0) return 'de';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'en'; /* cizojazyčný návštěvník bez shody → angličtina */
  }

  var LANG = detect();

  function tr(cs) {
    var e = DICT[cs];
    if (!e) return null;
    var v = e[LANG];
    return (v === undefined || v === null || v === '') ? null : v;
  }

  function translateTextNode(node) {
    var raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    var key = raw.trim();
    var t = tr(key);
    if (t !== null) {
      var lead = raw.match(/^\s*/)[0];
      var trail = raw.match(/\s*$/)[0];
      node.nodeValue = lead + t + trail;
    }
  }

  function walkText(root) {
    if (!root || !root.ownerDocument && root.nodeType !== 9 && root.nodeType !== 1) return;
    var doc = root.ownerDocument || document;
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName ? p.nodeName.toLowerCase() : '';
        if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains('material-symbols-outlined')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(translateTextNode);
  }

  function walkAttrs(root) {
    if (!root.querySelectorAll) return;
    ATTR_KEYS.forEach(function (attr) {
      var els = root.querySelectorAll('[' + attr + ']');
      Array.prototype.forEach.call(els, function (el) {
        if (el.classList && el.classList.contains('material-symbols-outlined')) return;
        var val = el.getAttribute(attr);
        if (!val) return;
        var t = tr(val.trim());
        if (t !== null) el.setAttribute(attr, t);
      });
    });
    /* meta description */
    Array.prototype.forEach.call(root.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[property="og:title"]'), function (m) {
      var c = m.getAttribute('content'); if (!c) return;
      var t = tr(c.trim()); if (t !== null) m.setAttribute('content', t);
    });
  }

  function apply(root) {
    if (LANG === 'cs') return;
    walkText(root);
    if (root.nodeType === 1) walkAttrs(root);
  }

  function setLang(l) {
    if (l !== 'cs' && l !== 'en' && l !== 'de') return;
    try { localStorage.setItem(STORE, l); } catch (e) {}
    if (l === LANG) return;
    try { sessionStorage.setItem('lang_scroll_top', '1'); } catch (e) {}
    location.reload();
  }
  window.setSiteLang = setLang;
  window.getSiteLang = function () { return LANG; };

  function injectStyles() {
    if (document.getElementById('i18n-style')) return;
    var s = document.createElement('style');
    s.id = 'i18n-style';
    s.textContent =
      '.lang-switch{display:inline-flex;align-items:center;gap:.4rem}' +
      '.lang-switch .lang-btn{background:none;border:0;cursor:pointer;padding:0 .1rem;' +
      'font:inherit;letter-spacing:.15em;color:currentColor;opacity:.6;transition:opacity .2s,color .2s}' +
      '.lang-switch .lang-btn:hover{opacity:1;color:#D4AF37}' +
      '.lang-switch .lang-btn.lang-active{opacity:1;color:#D4AF37}' +
      '.lang-switch .lang-sep{opacity:.35}' +
      /* rozbalovací přepínač (vlastní styl, nezávislý na Tailwindu) */
      '.lang-dd{position:relative;display:none}' +
      '@media(min-width:768px){.lang-dd{display:block}}' +
      ".lang-dd-toggle{display:inline-flex;align-items:center;gap:.25rem;background:none;border:0;cursor:pointer;color:#fff;font-family:'Public Sans',sans-serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;transition:color .2s}" +
      '.lang-dd-toggle:hover{color:#D4AF37}' +
      '.lang-dd-menu{position:absolute;right:0;margin-top:.6rem;z-index:60;text-align:right;background:transparent}' +
      '.lang-dd-menu.hidden{display:none}' +
      ".lang-dd-menu button{display:block;width:100%;text-align:right;padding:.28rem 0;background:none;border:0;cursor:pointer;color:#fff;font-family:'Public Sans',sans-serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;opacity:.85;transition:color .15s,opacity .15s}" +
      '.lang-dd-menu button:hover{color:#D4AF37;opacity:1}' +
      '.lang-dd-menu button.lang-active{color:#D4AF37;opacity:1}';
    document.head.appendChild(s);
  }

  function langLabel(l) { return l === 'cs' ? 'CZ' : (l === 'de' ? 'DE' : 'EN'); }

  function initSwitchers() {
    injectStyles();
    /* aktuální jazyk ve štítku rozbalovacího přepínače */
    Array.prototype.forEach.call(document.querySelectorAll('.lang-current'), function (el) {
      el.textContent = langLabel(LANG);
    });
    /* rozbalení / sbalení menu */
    Array.prototype.forEach.call(document.querySelectorAll('.lang-dd-toggle'), function (btn) {
      var menu = btn.parentNode.querySelector('.lang-dd-menu');
      if (!menu) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var willOpen = menu.classList.contains('hidden');
        Array.prototype.forEach.call(document.querySelectorAll('.lang-dd-menu'), function (m) { m.classList.add('hidden'); });
        if (willOpen) menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
    document.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.lang-dd-menu'), function (m) { m.classList.add('hidden'); });
    });
    /* volba jazyka (funguje pro rozbalovací i jednoduchý přepínač) */
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (btn) {
      var l = btn.getAttribute('data-lang');
      if (l === LANG) btn.classList.add('lang-active');
      btn.addEventListener('click', function (e) { e.preventDefault(); setLang(l); });
    });
  }

  function run() {
    document.documentElement.setAttribute('lang', LANG);
    /* po přepnutí jazyka skoč na začátek stránky (hero) */
    try {
      if (sessionStorage.getItem('lang_scroll_top')) {
        sessionStorage.removeItem('lang_scroll_top');
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
        var toTop = function () { window.scrollTo(0, 0); };
        toTop();
        window.addEventListener('load', function () { setTimeout(toTop, 0); });
      }
    } catch (e) {}
    if (LANG !== 'cs') {
      var t = tr(document.title.trim());
      if (t !== null) document.title = t;
      apply(document.body);
      if (window.MutationObserver) {
        var mo = new MutationObserver(function (muts) {
          muts.forEach(function (m) {
            Array.prototype.forEach.call(m.addedNodes, function (nd) {
              if (nd.nodeType === 1) apply(nd);
              else if (nd.nodeType === 3) translateTextNode(nd);
            });
          });
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    }
    initSwitchers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}());
