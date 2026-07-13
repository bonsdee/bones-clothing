/**
 * Cart page: AJAX quantity updates and line item removal without a full
 * page reload, using the Shopify AJAX Cart API.
 */
(function () {
  'use strict';

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function' && window.themeConfig) {
      return window.Shopify.formatMoney(cents, window.themeConfig.moneyFormat);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  var form = qs('[data-cart-form]');
  if (!form) return;

  function changeLine(key, quantity) {
    return fetch(window.themeConfig.routes.cartChange + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: quantity })
    }).then(function (res) { return res.json(); });
  }

  function updateRow(row, cart) {
    var key = row.dataset.key;
    var item = cart.items.find(function (i) { return i.key === key; });

    if (!item) {
      row.remove();
    } else {
      var lineTotalEl = qs('[data-cart-item-line-total]', row);
      if (lineTotalEl) lineTotalEl.textContent = formatMoney(item.final_line_price);
    }

    var subtotalEl = qs('[data-cart-subtotal]');
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

    qsa('[data-cart-count]').forEach(function (el) { el.textContent = cart.item_count; });

    if (cart.item_count === 0) {
      window.location.reload();
    }
  }

  qsa('[data-cart-qty-input]').forEach(function (input) {
    var debounceTimer;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var row = input.closest('[data-cart-item]');
        var qty = Math.max(0, parseInt(input.value, 10) || 0);
        changeLine(input.dataset.key, qty).then(function (cart) { updateRow(row, cart); });
      }, 400);
    });
  });

  qsa('[data-cart-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('[data-cart-item]');
      changeLine(btn.dataset.key, 0).then(function (cart) { updateRow(row, cart); });
    });
  });
})();
