/**
 * Fit Builder — standout interactive feature.
 *
 * One product may be selected per "slot" (rack). Once every slot has a
 * selection, a bundle discount is shown and, on add, every chosen variant is
 * added to the cart in a single /cart/add.js request, followed by a redirect
 * through Shopify's native /discount/:code endpoint so the merchant-created
 * discount (matching `data-discount-prefix` + slot count) actually applies.
 */
(function () {
  'use strict';

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function' && window.themeConfig) {
      return window.Shopify.formatMoney(cents, window.themeConfig.moneyFormat);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function initFitBuilder(root) {
    var slots = Array.prototype.slice.call(root.querySelectorAll('[data-fit-slot]'));
    var discountPercent = parseFloat(root.dataset.discountPercent || '0');
    var discountPrefix = root.dataset.discountPrefix || 'FITBUNDLE';
    var selections = {}; // slotIndex -> { variantId, price, title, button }

    var subtotalEl = root.querySelector('[data-fit-subtotal]');
    var savingsRowEl = root.querySelector('[data-fit-savings-row]');
    var savingsEl = root.querySelector('[data-fit-savings]');
    var totalEl = root.querySelector('[data-fit-total]');
    var addBtn = root.querySelector('[data-fit-add]');
    var hintEl = root.querySelector('[data-fit-hint]');

    function recalc() {
      var slotIndexes = Object.keys(selections);
      var subtotalCents = 0;

      slotIndexes.forEach(function (key) {
        // data-price comes from Liquid's raw {{ variant.price }}, which is
        // already an integer in the shop's smallest currency unit (cents) —
        // do not multiply by 100 again here.
        subtotalCents += Math.round(parseFloat(selections[key].price));
      });

      var allSlotsFilled = slotIndexes.length === slots.length && slots.length > 0;
      var savingsCents = allSlotsFilled ? Math.round((subtotalCents * discountPercent) / 100) : 0;
      var totalCents = subtotalCents - savingsCents;

      subtotalEl.textContent = formatMoney(subtotalCents);
      totalEl.textContent = formatMoney(totalCents);

      if (allSlotsFilled && discountPercent > 0) {
        savingsRowEl.hidden = false;
        savingsEl.textContent = '-' + formatMoney(savingsCents);
      } else {
        savingsRowEl.hidden = true;
      }

      addBtn.disabled = !allSlotsFilled;
      hintEl.hidden = allSlotsFilled;
    }

    slots.forEach(function (slot) {
      var options = Array.prototype.slice.call(slot.querySelectorAll('[data-fit-option]'));
      options.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var slotIndex = slot.dataset.slotIndex;
          var isSoldOut = btn.dataset.available === 'false';
          if (isSoldOut) return;

          var alreadySelected = btn.getAttribute('aria-pressed') === 'true';

          options.forEach(function (b) {
            b.setAttribute('aria-pressed', 'false');
            b.classList.remove('is-selected');
          });

          if (alreadySelected) {
            delete selections[slotIndex];
          } else {
            btn.setAttribute('aria-pressed', 'true');
            btn.classList.add('is-selected');
            selections[slotIndex] = {
              variantId: btn.dataset.variantId,
              price: btn.dataset.price,
              title: btn.dataset.productTitle
            };
          }

          recalc();
        });
      });
    });

    addBtn.addEventListener('click', function () {
      var items = Object.keys(selections).map(function (key) {
        return { id: selections[key].variantId, quantity: 1 };
      });

      if (items.length !== slots.length) return;

      addBtn.disabled = true;
      addBtn.textContent = 'Adding…';

      fetch(window.themeConfig.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Cart add failed');
          return res.json();
        })
        .then(function () {
          var code = discountPrefix + slots.length;
          // Apply the merchant's matching bundle discount code, then land on cart.
          window.location.href = '/discount/' + encodeURIComponent(code) + '?redirect=' + encodeURIComponent('/cart');
        })
        .catch(function (err) {
          console.error('[fit-builder]', err);
          addBtn.disabled = false;
          addBtn.textContent = 'Add Fit to Bag';
          hintEl.hidden = false;
          hintEl.textContent = 'Something went wrong adding your fit. Try again.';
        });
    });

    recalc();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-fit-builder]').forEach(initFitBuilder);
  });
})();
