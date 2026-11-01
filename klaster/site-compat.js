(function () {
  'use strict';

  function labelNavigation() {
    var open = document.getElementById('mobile-menu-btn');
    var close = document.getElementById('mobile-menu-close');
    var menu = document.getElementById('mobile-menu');
    if (!open || !close || !menu) return;

    menu.setAttribute('aria-label', 'Mobilní navigace');
    menu.setAttribute('aria-hidden', menu.classList.contains('translate-x-full') ? 'true' : 'false');
    open.setAttribute('type', 'button');
    open.setAttribute('aria-label', 'Otevřít hlavní menu');
    open.setAttribute('aria-controls', 'mobile-menu');
    open.setAttribute('aria-expanded', 'false');
    close.setAttribute('type', 'button');
    close.setAttribute('aria-label', 'Zavřít hlavní menu');
    var menuItems = menu.querySelectorAll('a, button');

    function sync(isOpen) {
      open.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      menu.inert = !isOpen;
      menu.toggleAttribute('inert', !isOpen);
      menuItems.forEach(function (item) {
        if (isOpen) item.removeAttribute('tabindex');
        else item.setAttribute('tabindex', '-1');
      });
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (isOpen) window.setTimeout(function () { close.focus(); }, 320);
    }

    open.addEventListener('click', function () { sync(true); });
    close.addEventListener('click', function () { sync(false); open.focus(); });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) sync(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open.getAttribute('aria-expanded') === 'true') {
        menu.classList.add('translate-x-full');
        sync(false);
        open.focus();
      }
    });
    sync(!menu.classList.contains('translate-x-full'));
  }

  function addSkipLink() {
    var main = document.querySelector('main');
    if (!main) return;
    if (!main.id) main.id = 'hlavni-obsah';
    var link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + main.id;
    link.textContent = 'Přejít na hlavní obsah';
    document.body.insertBefore(link, document.body.firstChild);
  }

  function makeClickCardsAccessible() {
    document.querySelectorAll('div[onclick*="location.href"], article[onclick*="location.href"]').forEach(function (element) {
      element.setAttribute('role', 'link');
      if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
      element.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          element.click();
        }
      });
    });
    document.querySelectorAll('button').forEach(function (button) {
      if (button.getAttribute('aria-label') || button.textContent.trim()) return;
      button.setAttribute('aria-label', button.title || 'Ovládací prvek');
    });
  }

  function railLabel(grid, number) {
    var section = grid.closest('section');
    var heading = section && section.querySelector('h2, h3');
    return heading ? heading.textContent.trim() : 'Posuvná kolekce ' + number;
  }

  function enhanceRail(grid, number, extraClass) {
    if (!grid || grid.dataset.mobileRail === 'true') return;
    grid.dataset.mobileRail = 'true';
    grid.classList.add('mobile-card-rail');
    if (extraClass) grid.classList.add(extraClass);
    grid.setAttribute('role', 'region');
    grid.setAttribute('aria-label', railLabel(grid, number) + ' – posouvejte vodorovně');
    grid.tabIndex = 0;

    var shell = document.createElement('div');
    shell.className = 'mobile-card-rail-shell';
    if (extraClass === 'overview-people-rail') shell.classList.add('overview-rail-shell');
    var section = grid.closest('section');
    if (section && (section.classList.contains('bg-presidential-blue') || section.classList.contains('pattern-dark') || section.id === 'personalities')) {
      shell.classList.add('on-dark');
    }
    grid.parentNode.insertBefore(shell, grid);
    shell.appendChild(grid);
  }

  function findCardGrids() {
    var number = 0;
    document.querySelectorAll('main .grid').forEach(function (grid) {
      if (grid.closest('.mobile-card-rail')) return;
      var children = Array.prototype.filter.call(grid.children, function (child) {
        return child.nodeType === 1;
      });
      if (children.length < 2) return;
      var cardCount = children.filter(function (child) {
        return child.matches('.bento-card, article, a');
      }).length;
      if (cardCount !== children.length) return;
      number += 1;
      enhanceRail(grid, number, grid.closest('#personalities') ? 'personality-home-rail' : '');
    });
  }

  function wrapPeopleRun(nodes, number) {
    if (!nodes || nodes.length < 2) return;
    var first = nodes[0];
    var rail = document.createElement('div');
    first.parentNode.insertBefore(rail, first);
    nodes.forEach(function (node) { rail.appendChild(node); });
    enhanceRail(rail, number, 'overview-people-rail');
  }

  function groupOverviewPeople() {
    if (!/\bosobnosti(?:\.html)?\/?$/.test(location.pathname)) return;
    var container = document.querySelector('main .space-y-10');
    if (!container) return;
    var children = Array.prototype.slice.call(container.children);
    var linked = children.filter(function (item) {
      return item.matches('.bento-card[onclick]');
    });
    var creators = children.filter(function (item) {
      return item.matches('article.bento-card');
    });
    wrapPeopleRun(linked.slice(0, 4), 20);
    wrapPeopleRun(creators, 21);
    wrapPeopleRun(linked.slice(4, 7), 22);
  }

  function improveImages() {
    document.querySelectorAll('img').forEach(function (image, index) {
      image.decoding = 'async';
      if (index > 1 && !image.hasAttribute('loading')) image.loading = 'lazy';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    addSkipLink();
    labelNavigation();
    makeClickCardsAccessible();
    groupOverviewPeople();
    findCardGrids();
    improveImages();
  });
}());
