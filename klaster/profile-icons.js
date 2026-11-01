/* profile-icons.js — podstránky osobností: označí sekce podle obsahu (robustně,
   nezávisle na pořadí) a vloží decentní Material Symbol piktogramy.
   - pf-detail  = sekce s „Klíčová fakta" (obsahuje <dl>)
   - pf-links   = sekce „Souvislosti"
   - pf-gallery = sekce „Galerie"
   Na hlavních stránkách nic nedělá (chybí tato struktura). */
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var FACTS = {
    'narození': 'cake',
    'úmrtí': 'church',
    'role': 'badge',
    'dílo': 'auto_stories',
    'rod': 'family_history',
    'titul': 'workspace_premium',
    'obor': 'science',
    'působení': 'location_on',
    'přínos': 'lightbulb',
    'odkaz': 'volunteer_activism',
    'vazba na areál': 'account_balance',
    'zakládací listina': 'history_edu',
    'vysvěcení kostela': 'church',
    'píseň': 'music_note',
    'album': 'album',
    'téma': 'lyrics',
    'karel kryl': 'person'
  };

  var LINKS = {
    'vazba na ostrov': 'account_balance',
    'čeho dosáhl': 'military_tech',
    'čeho dosáhla': 'military_tech',
    'archivní stopa': 'inventory_2',
    'co říkal o ostrově': 'format_quote',
    'dochovaný hlas': 'format_quote',
    'dobový nápis': 'format_quote',
    'vzpomínka na školu': 'school',
    'text písně anděl': 'lyrics'
  };

  function norm(t) {
    return (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function makeIcon(name) {
    var s = document.createElement('span');
    s.className = 'material-symbols-outlined';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = name;
    return s;
  }

  onReady(function () {
    var sections = document.querySelectorAll('main > section');
    if (!sections.length) return;

    /* 1) Označit sekce podle obsahu */
    Array.prototype.forEach.call(sections, function (sec) {
      if (sec.querySelector('dl')) sec.classList.add('pf-detail');
      var lab = sec.querySelector('.font-label-caps');
      var t = lab ? norm(lab.textContent) : '';
      if (t === 'souvislosti') sec.classList.add('pf-links');
      else if (t === 'galerie') sec.classList.add('pf-gallery');
    });

    /* 2) Ikony ke klíčovým faktům */
    Array.prototype.forEach.call(document.querySelectorAll('.pf-detail dl dt'), function (dt) {
      if (dt.parentElement && dt.parentElement.querySelector('.fact-ico-sm')) return;
      var name = FACTS[norm(dt.textContent)] || 'chevron_right';
      var wrap = document.createElement('span');
      wrap.className = 'fact-ico-sm';
      wrap.appendChild(makeIcon(name));
      var row = dt.parentElement;
      if (row) row.insertBefore(wrap, row.firstChild);
    });

    /* 3) Piktogramy do karet Souvislosti */
    Array.prototype.forEach.call(document.querySelectorAll('.pf-links article'), function (art) {
      if (art.querySelector('.fact-ico')) return;
      var label = art.querySelector('span');
      var name = label ? (LINKS[norm(label.textContent)] || 'auto_awesome') : 'auto_awesome';
      var ic = document.createElement('div');
      ic.className = 'fact-ico';
      ic.appendChild(makeIcon(name));
      art.insertBefore(ic, art.firstChild);
    });
  });
}());
