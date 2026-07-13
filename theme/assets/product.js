/**
 * Product page: variant selection (updates price/availability/URL) + AJAX
 * add-to-cart + simple thumbnail gallery swap.
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

  qsa('.product').forEach(function (section) {
    var form = qs('[data-product-form]', section);
    if (!form) return;

    var variantJsonEl = qs('[data-product-json]', form);
    var variants = [];
    try {
      variants = JSON.parse(variantJsonEl.textContent);
    } catch (e) {
      variants = [];
    }

    var variantIdInput = qs('[data-product-form-variant-id]', form);
    var priceEl = qs('[data-product-price]', section);
    var addBtn = qs('[data-add-to-cart]', section);
    var addLabel = qs('[data-add-to-cart-label]', section);

    function currentSelection() {
      var selection = {};
      qsa('input[data-option-position]:checked', form).forEach(function (input) {
        selection[input.dataset.optionPosition] = input.value;
      });
      return selection;
    }

    function findMatchingVariant() {
      var selection = currentSelection();
      return variants.find(function (variant) {
        return variant.options.every(function (value, index) {
          var position = String(index + 1);
          return !(position in selection) || selection[position] === value;
        });
      });
    }

    function updateForVariant(variant) {
      if (!variant) return;
      variantIdInput.value = variant.id;

      if (priceEl) {
        var priceHtml = '';
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          priceHtml += '<span class="product__price-compare">' + formatMoney(variant.compare_at_price) + '</span>';
        }
        priceHtml += '<span class="product__price-current">' + formatMoney(variant.price) + '</span>';
        priceEl.innerHTML = priceHtml;
      }

      if (addBtn) {
        addBtn.disabled = !variant.available;
        if (addLabel) addLabel.textContent = variant.available ? 'Add to Bag' : 'Sold Out';
      }

      var restock = qs('[data-restock-notify]');
      if (restock) {
        restock.hidden = !!variant.available;
        var variantInput = qs('[data-restock-variant-input]', restock);
        if (variantInput) variantInput.value = variant.id;
      }

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
    }

    qsa('input[data-option-position]', form).forEach(function (input) {
      input.addEventListener('change', function () {
        updateForVariant(findMatchingVariant());
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (addBtn) addBtn.disabled = true;

      fetch(window.themeConfig.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: variantIdInput.value, quantity: 1 })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (err) { throw err; });
          return res.json();
        })
        .then(function () {
          if (addBtn) addBtn.disabled = false;
          if (window.themeCart) window.themeCart.open();
        })
        .catch(function (err) {
          console.error('[product] add to cart failed', err);
          if (addBtn) addBtn.disabled = false;
          if (addLabel) addLabel.textContent = err.description || 'Could not add to bag';
        });
    });

    /* Gallery thumbnail swap */
    var mainImg = qs('[data-gallery-main]', section);
    qsa('[data-gallery-thumb]', section).forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        if (mainImg) mainImg.src = thumb.dataset.full;
      });
    });
  });
})();
