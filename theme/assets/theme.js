/**
 * Global theme behaviors: mobile menu, cart drawer open/close + AJAX refresh,
 * and the homepage drop countdown.
 */
(function () {
  'use strict';

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* Mobile menu */
  var menuToggle = qs('[data-mobile-menu-toggle]');
  var mobileMenu = qs('[data-mobile-menu]');
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      var isOpen = !mobileMenu.hidden;
      mobileMenu.hidden = isOpen;
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  /* Cart drawer */
  var drawer = qs('[data-cart-drawer]');
  var drawerBody = qs('[data-cart-drawer-body]');

  function renderDrawer(cart) {
    if (!drawerBody) return;
    if (!cart.items || cart.items.length === 0) {
      drawerBody.innerHTML = '<p class="cart-drawer__empty">Your bag is empty.</p>';
      return;
    }
    var rows = cart.items
      .map(function (item) {
        // Products with no real variants report variant_title as null (or the
        // synthetic "Default Title"); in that case show just the quantity
        // rather than a meaningless "null · Qty" line.
        var hasVariant = item.variant_title && item.variant_title !== 'Default Title';
        var meta = hasVariant
          ? item.variant_title + ' &middot; Qty ' + item.quantity
          : 'Qty ' + item.quantity;
        return (
          '<div class="cart-drawer__item">' +
          '<img src="' + (item.image || '') + '&width=120" alt="" width="60">' +
          '<div class="cart-drawer__item-info">' +
          '<p>' + item.product_title + '</p>' +
          '<p class="cart-drawer__item-meta">' + meta + '</p>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    drawerBody.innerHTML = rows + '<a class="btn btn--accent" href="' + window.themeConfig.routes.cart + '" style="margin-top:16px;display:block;text-align:center;">View Bag</a>';
  }

  function refreshCart() {
    fetch(window.themeConfig.routes.cart + '.js', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        qsa('[data-cart-count]').forEach(function (el) { el.textContent = cart.item_count; });
        renderDrawer(cart);
      })
      .catch(function (err) { console.error('[theme] cart refresh failed', err); });
  }

  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    refreshCart();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true;
  }

  qsa('[data-cart-drawer-open]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openDrawer();
    });
  });
  qsa('[data-cart-drawer-close]').forEach(function (el) {
    el.addEventListener('click', closeDrawer);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  /* Expose for other scripts (product add-to-cart) to trigger a drawer refresh */
  window.themeCart = { open: openDrawer, close: closeDrawer, refresh: refreshCart };

  /* Drop countdown */
  qsa('[data-countdown]').forEach(function (el) {
    var target = new Date(el.dataset.target).getTime();
    if (isNaN(target)) return;

    function tick() {
      var now = Date.now();
      var diff = Math.max(0, target - now);

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var minutes = Math.floor((diff % 3600000) / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);

      var dEl = qs('[data-countdown-days]', el);
      var hEl = qs('[data-countdown-hours]', el);
      var mEl = qs('[data-countdown-minutes]', el);
      var sEl = qs('[data-countdown-seconds]', el);

      if (dEl) dEl.textContent = String(days).padStart(2, '0');
      if (hEl) hEl.textContent = String(hours).padStart(2, '0');
      if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
      if (sEl) sEl.textContent = String(seconds).padStart(2, '0');

      if (diff <= 0) clearInterval(intervalId);
    }

    tick();
    var intervalId = setInterval(tick, 1000);
  });

  /* Restock notify form (product page + PDP section) */
  qsa('[data-restock-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var wrapper = form.closest('[data-restock-notify]');
      var message = wrapper ? qs('[data-restock-message]', wrapper) : null;
      var formData = new FormData(form);
      var payload = Object.fromEntries(formData.entries());

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Waitlist submit failed');
          return res.json();
        })
        .then(function () {
          if (message) {
            message.hidden = false;
            message.textContent = window.themeStrings && window.themeStrings.notifySuccess
              ? window.themeStrings.notifySuccess
              : "You're on the list. We'll email you the second it's back.";
          }
          form.reset();
        })
        .catch(function () {
          if (message) {
            message.hidden = false;
            message.textContent = "Something went wrong. Try again in a bit.";
          }
        });
    });
  });
})();
