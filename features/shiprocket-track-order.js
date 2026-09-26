// ======================================================================
// FEATURE: Shiprocket Track Order
// Order tracking page — customer enters Order ID or AWB, shows status + scan timeline from Shiprocket.
// ======================================================================


// ======================================================================
// TAB:   Liquid Code
// PASTE: Paste inside the track-order section where the form should render
// ======================================================================
{% comment %}
  Shiprocket Track Order — form + result
  Requires jQuery loaded in the theme.
{% endcomment %}

<div class="track-order-content-iner" data-track-order>
  <form class="track-order-input-wrap" data-track-form novalidate>
    <input id="track-order-input" placeholder="Enter Order ID or Tracking ID" type="text" class="input__field" name="order_id" required autocomplete="off">
    <button type="submit" class="button button--primary track-order-submit-button">{{ section.settings.button_text }}</button>
  </form>
  <div class="order-tracker__result" data-track-result></div>
</div>

<script src="{{ 'track-order.js' | asset_url }}" defer></script>

// ======================================================================
// TAB:   Section Schema
// PASTE: Add inside the section schema "settings": [ ]
// ======================================================================
{
  "type": "text",
  "id": "button_text",
  "label": "Button text",
  "default": "Track order"
}

// ======================================================================
// TAB:   Theme JavaScript
// PASTE: Create assets/track-order.js in the theme, paste this, and set ENDPOINT to the store's Worker URL
// ======================================================================
(function ($) {
  'use strict';

  const NS = '.trackOrder';
  const ENDPOINT = 'https://YOUR-WORKER.YOUR-ACCOUNT.workers.dev'; // ← change per store (Cloudflare Worker URL)

  const esc = s => $('<div>').text(s == null ? '' : s).html();

  // "2026-08-11 16:50:44" -> Date (the "T" makes it parse in Safari too)
  const toDate = str => (str ? new Date(String(str).replace(' ', 'T')) : null);

  const fmtTime = str => {
    const d = toDate(str);
    return d && !isNaN(d) ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (str || '');
  };

  const fmtDay = str => {
    const d = toDate(str);
    return d && !isNaN(d)
      ? d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : (str || '');
  };

  // "Delivered - Delivered to consignee - Code Verified delivery"
  // -> headline: "Delivered", detail: "Delivered to consignee - Code Verified delivery"
  const splitStatus = str => {
    const [headline, ...rest] = String(str || '').split(' - ');
    return { headline, detail: rest.join(' - ') };
  };

  const banner = (type, msg) =>
    `<div class="order-tracker__banner banner banner--${type}"><p class="banner__content">${esc(msg)}</p></div>`;

  function render(data) {
    const activities = data.activities || [];
    const latest = activities[0] || {};
    const isDelivered = String(data.status || '').toLowerCase() === 'delivered';

    // Group scans by day (API already returns newest first)
    const groups = [];
    const byDay = {};
    activities.forEach(a => {
      const day = fmtDay(a.date);
      if (!byDay[day]) {
        byDay[day] = { day, items: [] };
        groups.push(byDay[day]);
      }
      byDay[day].items.push(a);
    });

    const timeline = groups.map(group => {
      const items = group.items.map(a => {
        const { headline, detail } = splitStatus(a.status);
        return `
          <li class="order-tracker__scan">
            <div class="order-tracker__scan--wrapper">
              <span class="order-tracker__scan-time">${esc(fmtTime(a.date))}</span>
              <span class="order-tracker__scan-headline">${esc(headline)}</span>
              ${detail ? `<span class="order-tracker__scan-detail">${esc(detail)}</span>` : ''}
              ${a.location ? `<span class="order-tracker__scan-sub">${esc(a.location)}</span>` : ''}
            </div>
          </li>`;
      }).join('');

      return `
        <div class="order-tracker__day-group">
          <p class="order-tracker__day">${esc(group.day)}</p>
          <ul class="order-tracker__timeline">${items}</ul>
        </div>`;
    }).join('');

    const emptyNote = data.awb
      ? 'Tracking updates will appear once the courier scans your package.'
      : 'Your order is being prepared for dispatch.';

    return `
      <div class="order-tracker__summary">
        <p class="order-tracker__status-label text--small">Order ${esc(data.order_id)} · Current status</p>
        <p class="order-tracker__status heading h5">${esc(data.status)}</p>
        ${latest.status ? `<p class="order-tracker__summary-line">${esc(splitStatus(latest.status).detail || latest.status)}</p>` : ''}
        ${latest.location ? `<p class="order-tracker__summary-line"><span class="order-tracker__summary-line-label">Location:</span> ${esc(latest.location)}</p>` : ''}
        ${data.courier ? `<p class="order-tracker__summary-line"><span class="order-tracker__summary-line-label">Courier:</span> ${esc(data.courier)}${data.awb ? ` · AWB ${esc(data.awb)}` : ''}</p>` : ''}
        ${isDelivered && latest.date
          ? `<p class="order-tracker__edd"><span class="order-tracker__summary-line-label">Delivered on:</span> ${esc(fmtDay(latest.date))}</p>`
          : data.etd ? `<p class="order-tracker__edd"><span class="order-tracker__summary-line-label">Expected delivery:</span> ${esc(fmtDay(data.etd))}</p>` : ''}
        ${!activities.length ? `<p class="order-tracker__summary-line">${esc(emptyNote)}</p>` : ''}
      </div>
      ${timeline ? `<div class="order-tracker__timeline-wrap">${timeline}</div>` : ''}`;
  }

  $(document)
    .off(NS)
    .on('submit' + NS, '[data-track-form]', function (e) {
      e.preventDefault();

      const $form = $(this);
      const $root = $form.closest('[data-track-order]');
      const $result = $root.find('[data-track-result]');
      const $submit = $form.find('[type="submit"]');
      const submitText = $submit.data('text') || $submit.text();
      const orderId = $.trim($form.find('[name="order_id"]').val()).replace(/^#/, '');

      $submit.data('text', submitText);
      $result.removeClass('error').empty();

      if (!orderId) {
        $result.addClass('error').html(banner('error', 'Please enter your order number.'));
        return;
      }

      $submit.prop('disabled', true).text('Tracking…');

      $.ajax({
        url: ENDPOINT,
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ order_id: orderId })
      })
        .done(function (data) {
          $result.html(render(data));
          $('html, body').animate({ scrollTop: $result.offset().top - 90 }, 400);
        })
        .fail(function (xhr) {
          const msg = (xhr.responseJSON && xhr.responseJSON.error) ||
            'Could not fetch tracking. Please check the number and try again.';
          $result.addClass('error').html(banner('error', msg));
          console.error('[Track order] failed', xhr.status, xhr.responseJSON || xhr.responseText);
        })
        .always(function () {
          $submit.prop('disabled', false).text(submitText);
        });
    });
})(jQuery);

// ======================================================================
// TAB:   Cloudflare API
// PASTE: Cloudflare → Workers → Create Worker → paste this, then add the variables listed at the top
// ======================================================================
/**
 * Shiprocket Track Order proxy — Cloudflare Worker
 *
 * Cloudflare → Workers → Create → paste this → Settings → Variables and Secrets:
 *
 *   SR_EMAIL          (Secret)  Shiprocket API user email
 *   SR_PASSWORD       (Secret)  Shiprocket API user password
 *   ALLOWED_ORIGINS   (Text)    "https://store.com,https://www.store.com,https://store.myshopify.com"
 *   CHANNEL_ID        (Text, optional)  Shiprocket channel ID, if order IDs clash across channels
 *
 * Request:  POST { "order_id": "J1056" }        (store order ID or courier AWB)
 * Response: { order_id, status, courier, awb, etd, track_url, activities: [{ date, status, location }] }
 */

const SR_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // token valid 10 days; refresh at 9

// In-memory cache (per Worker instance)
let tokenCache = { value: null, expires: 0 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const corsOrigin = !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0];

    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (allowed.length && !allowed.includes(origin)) return json({ error: 'Forbidden' }, 403);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    const id = String(body.order_id || '').trim().replace(/^#/, '');
    if (!id || id.length > 40) return json({ error: 'Please enter a valid order number.' }, 400);

    try {
      const result = await track(env, id);
      if (!result) return json({ error: 'We could not find this order. Please check the number and try again.' }, 404);
      return json(result);
    } catch (err) {
      return json({ error: 'Unable to fetch tracking right now. Please try again.', detail: err.message }, 502);
    }
  }
};

async function track(env, id) {
  const channel = env.CHANNEL_ID ? `&channel_id=${encodeURIComponent(env.CHANNEL_ID)}` : '';

  // 1. Store order ID (e.g. J1056)
  let tracking = findTracking(await srGet(env, `/courier/track?order_id=${encodeURIComponent(id)}${channel}`));

  // 2. Courier AWB
  if (!hasShipment(tracking) && /^[A-Za-z0-9]{8,}$/.test(id)) {
    const byAwb = findTracking(await srGet(env, `/courier/track/awb/${encodeURIComponent(id)}`).catch(() => null));
    if (hasShipment(byAwb)) tracking = byAwb;
  }

  if (hasShipment(tracking)) return format(id, tracking);

  // 3. Order exists but not shipped yet
  const orders = await srGet(env, `/orders?search=${encodeURIComponent(id)}`);
  const order = (orders?.data || []).find(o => String(o.channel_order_id) === id || String(o.id) === id);
  if (!order) return null;

  return {
    order_id: order.channel_order_id || id,
    status: order.status || 'Processing',
    courier: null,
    awb: null,
    etd: null,
    track_url: null,
    activities: []
  };
}

// Shiprocket nests tracking_data differently per endpoint — find it wherever it is
function findTracking(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.tracking_data) return node.tracking_data;
  for (const value of Object.values(node)) {
    const found = findTracking(value);
    if (found) return found;
  }
  return null;
}

const hasShipment = (t) => Array.isArray(t?.shipment_track) && t.shipment_track.some(s => s.awb_code);

const validDate = (d) => (d && !String(d).startsWith('0000') ? d : null);

function format(id, t) {
  const shipment = t.shipment_track.find(s => s.awb_code) || {};

  const activities = (t.shipment_track_activities || [])
    .map(a => ({
      date: a.date,
      status: a.activity || a['sr-status-label'] || a.status || '',
      location: a.location || ''
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))); // newest first

  return {
    order_id: id,
    status: shipment.current_status || 'In Transit',
    courier: shipment.courier_name || null,
    awb: shipment.awb_code || null,
    etd: validDate(t.etd) || validDate(shipment.edd),
    track_url: t.track_url || null,
    activities
  };
}

async function srGet(env, path, retried = false) {
  const token = await getToken(env, retried);
  const res = await fetch(`${SR_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  // Token expired — log in again and retry once
  if (res.status === 401 && !retried) return srGet(env, path, true);

  // Not found
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);

  return res.json();
}

async function getToken(env, forceRefresh = false) {
  if (!forceRefresh && tokenCache.value && Date.now() < tokenCache.expires) return tokenCache.value;

  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SR_EMAIL, password: env.SR_PASSWORD })
  });
  if (!res.ok) throw new Error(`Login ${res.status}: ${await res.text()}`);

  const { token } = await res.json();
  if (!token) throw new Error('Login returned no token');

  tokenCache = { value: token, expires: Date.now() + TOKEN_TTL_MS };
  return token;
}
