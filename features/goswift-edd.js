// ======================================================================
// FEATURE: GoSwift EDD
// Pincode checker showing estimated delivery date via GoSwift.
// ======================================================================


// ======================================================================
// TAB:   Liquid Code
// PASTE: Paste inside the product section where the block should render
// ======================================================================
{% comment %}
  GoSwift EDD — pincode checker block
  Paste inside the product section's block loop, e.g.
  {%- when 'pincode_checker' -%}
{% endcomment %}

<div class="pincode-checker" {{ block.shopify_attributes }}>
  <div class="pincode-checker__row">
    <div class="input">
      <input
        type="text"
        id="pincode-input"
        name="pincode"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        class="input__field input__field--text"
        placeholder="Enter pin code to check delivery date"
        autocomplete="postal-code">
    </div>

    <button type="button" class="button button--primary pincode-checker__submit">
      Submit
    </button>
  </div>

  <p class="pincode-checker__result text--small">
    <span></span>
  </p>
</div>

<script src="{{ 'goswift-edd.js' | asset_url }}" defer></script>

// ======================================================================
// TAB:   Section Schema
// PASTE: Add inside the section schema "blocks": [ ]
// ======================================================================
{
  "type": "pincode_checker",
  "name": "Pincode checker",
  "limit": 1
}

// ======================================================================
// TAB:   Theme JavaScript
// PASTE: Create assets/goswift-edd.js in the theme, paste this, and set PROXY to the store's Worker URL
// ======================================================================
(function () {
  // Your deployed Worker URL — change per store
  var PROXY = 'https://YOUR-WORKER.YOUR-ACCOUNT.workers.dev/';

  async function lookup(destPin) {
    var r = await fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destPin: destPin })
    });
    if (!r.ok) throw 0;
    return r.json();
  }

  // GoSwift returns edd as day-counts: { min, max } from today
  function pickDays(d) {
    var e = (d.data && d.data.edd) || d.edd;
    if (e && typeof e === 'object') {
      var min = e.min, max = e.max;
      if (min != null || max != null) return { min: min, max: max };
    }
    return null;
  }

  function pickArea(d) {
    var data = d.data || d;
    return data.city || data.area || '';
  }

  function addDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  function ordinal(d) {
    var n = d.getDate(), s = (n % 10 == 1 && n != 11) ? 'st' : (n % 10 == 2 && n != 12) ? 'nd'
      : (n % 10 == 3 && n != 13) ? 'rd' : 'th';
    return n + s + ' ' + d.toLocaleString('en-US', { month: 'long' });
  }

  function init(root) {
    var input = root.querySelector('.input__field'),
        btn   = root.querySelector('.pincode-checker__submit'),
        res   = root.querySelector('.pincode-checker__result'),
        out   = res && res.querySelector('span');
    if (!input || !btn || !out) return;
    res.hidden = true;

    var say = function (h, err) {
      out.innerHTML = h; res.hidden = false;
      res.classList.toggle('pincode-checker__result--error', !!err);
    };

    async function go() {
      var p = (input.value || '').trim();
      if (!/^\d{6}$/.test(p)) return say('Please enter a valid 6-digit pin code.', 1);
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      say('Checking delivery date&hellip;');
      try {
        var d = await lookup(p);
        var days = pickDays(d);
        var area = pickArea(d);
        if (!days) return say('Sorry, delivery is not available for this pin code.', 1);

        var min = days.min, max = days.max;
        var dateText;
        if (max != null && min != null && max !== min) {
          dateText = ordinal(addDays(min)) + ' &ndash; ' + ordinal(addDays(max));
        } else {
          dateText = ordinal(addDays(max != null ? max : min));
        }

        say((area ? 'Area, <strong>' + area + ' &ndash; ' + p + '</strong>; ' : '') +
            'Your order will be delivered by <strong>' + dateText + '</strong>');
      } catch (e) { say('Could not check delivery date. Please try again.', 1); }
      finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    }

    btn.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
  }

  function boot() { document.querySelectorAll('.pincode-checker').forEach(init); }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

// ======================================================================
// TAB:   Cloudflare API
// PASTE: Cloudflare → Workers → Create Worker → paste this, then add the variables listed at the top
// ======================================================================
/**
 * GoSwift EDD proxy — Cloudflare Worker
 *
 * Cloudflare → Workers → Create → paste this → Settings → Variables and Secrets:
 *
 *   GOSWIFT_USER       (Secret)  GoSwift integration username
 *   GOSWIFT_PASS       (Secret)  GoSwift integration password
 *   GOSWIFT_CLIENT_ID  (Text)    GoSwift client ID, e.g. "670d378c47ed9118e34e43cc"
 *   SRC_PIN            (Text)    Warehouse / pickup pincode, e.g. "110020"
 *   ALLOWED_ORIGINS    (Text)    "https://store.com,https://www.store.com,https://store.myshopify.com"
 *
 * Request:  POST { "destPin": "400001" }
 * Response: GoSwift EDD response as-is ({ data: { edd: { min, max }, city } })
 */

const EDD_URL = 'https://app.goswift.in/data/package/edd';
const authUrl = (clientId) => `https://app.goswift.in/integrations/v2/auth/token/${clientId}`;

// In-memory cache (per Worker instance)
let tok = { v: null, exp: 0 };

async function token(env) {
  if (tok.v && Date.now() < tok.exp - 60000) return tok.v;

  const r = await fetch(authUrl(env.GOSWIFT_CLIENT_ID), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.GOSWIFT_USER, password: env.GOSWIFT_PASS })
  });
  const body = await r.text();
  if (!r.ok) throw new Error('AUTH ' + r.status + ': ' + body);

  const d = JSON.parse(body);
  if (!d.access_token) throw new Error('AUTH no token in response');

  tok = { v: d.access_token, exp: Date.now() + (d.expires_in > 0 ? d.expires_in : 300) * 1000 };
  return tok.v;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const corsOrigin = !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0];

    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const json = (b, s = 200) =>
      new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (allowed.length && !allowed.includes(origin)) return json({ error: 'Forbidden' }, 403);

    if (!env.GOSWIFT_USER || !env.GOSWIFT_PASS || !env.GOSWIFT_CLIENT_ID || !env.SRC_PIN)
      return json({ error: 'Worker variables missing' }, 500);

    try {
      const { destPin } = await req.json();
      if (!/^\d{6}$/.test(destPin || '')) return json({ error: 'Invalid pincode' }, 400);

      const t = await token(env);
      const r = await fetch(EDD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ srcPin: env.SRC_PIN, destPin })
      });
      const body = await r.text();
      if (!r.ok) return json({ error: 'EDD ' + r.status, detail: body }, 502);

      return json(JSON.parse(body));
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502);
    }
  }
};
