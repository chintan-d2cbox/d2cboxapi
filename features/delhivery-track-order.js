// ======================================================================
// FEATURE: Delhivery Track Order
// Order tracking page — customer enters Order ID or AWB, shows status + scan timeline from Delhivery.
// ======================================================================


// ======================================================================
// TAB:   Liquid Code
// PASTE: Paste inside the track-order section where the form should render
// ======================================================================
{% comment %}
  Delhivery Track Order — form + result
  Requires jQuery loaded in the theme.
  Worker URL comes from the section setting "Cloudflare Worker URL".
{% endcomment %}

<div class="order-tracker" data-order-tracker data-proxy-url="{{ section.settings.proxy_url }}">
  <form class="order-tracker__form form" data-tracker-form>
    <div class="input">
      <input id="order-tracker-query" type="text" class="input__field" name="query" aria-label="{{ section.settings.input_label | escape }}" placeholder="{{ section.settings.input_label }}" required>
    </div>

    <button type="submit" class="order-tracker__submit button button--primary button--full">{{ section.settings.button_label | escape }}</button>
  </form>

  <div class="order-tracker__result" data-tracker-result></div>
</div>

<script src="{{ 'delhivery-track-order.js' | asset_url }}" defer></script>

// ======================================================================
// TAB:   Section Schema
// PASTE: Add inside the section schema "settings": [ ]
// ======================================================================
{
  "type": "text",
  "id": "input_label",
  "label": "Input placeholder",
  "default": "Enter Order ID or AWB number"
},
{
  "type": "text",
  "id": "button_label",
  "label": "Button text",
  "default": "Track order"
},
{
  "type": "text",
  "id": "proxy_url",
  "label": "Cloudflare Worker URL",
  "info": "e.g. https://store-track.your-account.workers.dev/"
}

// ======================================================================
// TAB:   Theme JavaScript
// PASTE: Create assets/delhivery-track-order.js in the theme and paste this — no changes needed per store
// ======================================================================
(function ($) {
  $(function () {
    var $root = $('[data-order-tracker]');
    if (!$root.length) return;

    // 1. force scroll to top on load
    $(window).on('load', function () {
      window.scrollTo(0, 0);
    });

    var proxyUrl = $root.data('proxy-url');
    var $form = $root.find('[data-tracker-form]');
    var $submit = $form.find('[type="submit"]');
    var $result = $root.find('[data-tracker-result]');
    var submitText = $submit.text();

    function esc(s) {
      return $('<div>').text(s == null ? '' : s).html();
    }

    function fmtTime(str) {
      if (!str) return '';
      var d = new Date(str);
      return isNaN(d) ? str : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    function fmtDay(str) {
      if (!str) return '';
      var d = new Date(str);
      return isNaN(d) ? str : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    function banner(type, msg) {
      return `<div class="order-tracker__banner banner banner--${type}"><p class="banner__content">${esc(msg)}</p></div>`;
    }

    function render(data) {
        $result.removeClass('error');
        if (data && data.Success === false) {
            $result.addClass('error').html(banner('error', 'No tracking details found yet for this number. Please check and try again, or allow some time after dispatch.'));
            return;
        }

        var list = Array.isArray(data) ? data : (data && data.ShipmentData) || [];
        var shipment = (list[0] || {}).Shipment;
        if (!shipment) {
            $result.addClass('error').html(banner('error', 'No tracking found for this number.'));
            return;
        }

        var status = shipment.Status || {};
        var scans = (shipment.Scans || []).slice().reverse();

        var awb = esc(shipment.AWB);
        var dest = shipment.Destination ? esc(shipment.Destination) : '';
        var edd = shipment.ExpectedDeliveryDate ? esc(fmtDay(shipment.ExpectedDeliveryDate)) : '';

        // group scans by day, preserving order
        var groups = [];
        var byDay = {};
        scans.forEach(function (item) {
            var s = item.ScanDetail || {};
            var day = fmtDay(s.ScanDateTime);
            if (!byDay[day]) {
            byDay[day] = { day: day, scans: [] };
            groups.push(byDay[day]);
            }
            byDay[day].scans.push(s);
        });

        var timeline = groups.map(function (group) {
            var items = group.scans.map(function (s) {
            return `
                <li class="order-tracker__scan">
                <div class="order-tracker__scan--wrapper">
                <span class="order-tracker__scan-time">${esc(fmtTime(s.ScanDateTime))}</span>
                <span class="order-tracker__scan-headline">${esc(s.Scan)}</span>
                <span class="order-tracker__scan-detail">${esc(s.Instructions)}</span>
                <span class="order-tracker__scan-sub">${s.ScannedLocation ? '' + esc(s.ScannedLocation) : ''}</span>
                </div>
                </li>`;
            }).join('');

            return `
            <div class="order-tracker__day-group">
                <p class="order-tracker__day">${esc(group.day)}</p>
                <ul class="order-tracker__timeline">${items}</ul>
            </div>`;
        }).join('');

        $result.html(`
            <div class="order-tracker__summary">
            <p class="order-tracker__status-label text--small">Current status</p>
            <p class="order-tracker__status heading h5">${esc(status.Status)}</p>
            <p class="order-tracker__summary-line">${esc(status.Instructions)}</p>
            <p class="order-tracker__summary-line"><span class="order-tracker__summary-line-label">Location:</span> ${esc(status.StatusLocation)}</p>
            ${edd ? `<p class="order-tracker__edd"><span class="order-tracker__summary-line-label">Expected delivery:</span> ${edd}</p>` : ''}
            </div>
            <div class="order-tracker__timeline-wrap">${timeline}</div>`);
        }

    $form.on('submit', function (e) {
      e.preventDefault();
      var value = $.trim($form.find('input[name="query"]').val()).replace(/^#/, '');
      if (!value) return;

      var param = /^\d{5,}$/.test(value) ? 'waybill' : 'ref_ids';

      $submit.prop('disabled', true).text('Tracking…');
      $result.empty();

        $.ajax({ url: proxyUrl + '?' + param + '=' + encodeURIComponent(value), dataType: 'json' })
        .done(function (data) {
          render(data);
          // scroll only on a real result — not when render wrote an error banner
          if (!$result.find('.order-tracker__banner').length && $result.children().length) {
            $('html, body').animate({
              scrollTop: $result.offset().top - 140
            }, 400);
          }
        })
        .fail(function (xhr) {
          console.log('tracker fail', xhr.status, xhr.responseText);
          $result.addClass('error').html(banner('error', 'Could not fetch tracking. Please check the number and try again.'));
        })
        .always(function () {
          $submit.prop('disabled', false).text(submitText);
        });
    });
  });
})(jQuery);

// ======================================================================
// TAB:   Cloudflare API
// PASTE: Cloudflare → Workers → Create Worker → paste this, then add the variables listed at the top
// ======================================================================
/**
 * Delhivery Track Order proxy — Cloudflare Worker
 *
 * Cloudflare → Workers → Create → paste this → Settings → Variables and Secrets:
 *
 *   DELHIVERY_TOKEN   (Secret)  Delhivery API token
 *   ALLOWED_ORIGINS   (Text)    "https://store.com,https://www.store.com,https://store.myshopify.com"
 *   ORDER_PREFIX      (Text, optional)  store order ID prefix, e.g. "SE" → only SE1234-style IDs allowed
 *
 * Request:  GET ?waybill=1234567890   or   GET ?ref_ids=SE1234
 * Response: Delhivery packages JSON as-is ({ ShipmentData: [{ Shipment }] })
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const corsOrigin = !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0];

    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
    if (allowed.length && !allowed.includes(origin)) return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });

    const params = new URL(request.url).searchParams;
    const waybill = (params.get('waybill') || '').trim();
    const refId = (params.get('ref_ids') || '').trim();

    // Order ID: "SE1234" when ORDER_PREFIX=SE, otherwise any short alphanumeric ID
    const prefix = (env.ORDER_PREFIX || '').replace(/[^A-Za-z0-9]/g, '');
    const refPattern = prefix ? new RegExp('^' + prefix + '\\d{3,}$', 'i') : /^[A-Za-z0-9-]{3,30}$/;

    const validWaybill = /^\d{5,}$/.test(waybill);
    const validRef = refPattern.test(refId);

    if (!validWaybill && !validRef) {
      return Response.json({ error: 'Provide a valid waybill or order id' }, { status: 400, headers: cors });
    }

    const query = validWaybill
      ? `waybill=${encodeURIComponent(waybill)}`
      : `ref_ids=${encodeURIComponent(refId)}`;

    const api = `https://track.delhivery.com/api/v1/packages/json?${query}`;

    let resp;
    try {
      resp = await fetch(api, {
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${env.DELHIVERY_TOKEN}`
        }
      });
    } catch (err) {
      return Response.json({ error: 'Upstream request failed', detail: String(err) }, { status: 502, headers: cors });
    }

    return new Response(await resp.text(), {
      status: resp.status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};
