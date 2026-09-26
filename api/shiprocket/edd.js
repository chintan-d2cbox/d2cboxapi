/**
 * POST /api/shiprocket/edd
 * Body:     { "pincode": "400001", "weight"?: 0.5, "cod"?: false }
 * Response: { serviceable, etd, days, cod, courier }
 */
import { json, preflight, resolveStore } from '../../lib/http.js';
import { checkServiceability } from '../../lib/shiprocket.js';

export const OPTIONS = preflight;

export async function POST(request) {
  const origin = request.headers.get('Origin') || '';

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }

  const store = resolveStore(request, body);
  if (!store) return json({ error: 'Forbidden: origin not registered' }, 403, origin);

  const pincode = String(body.pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return json({ error: 'Invalid pincode' }, 400, origin);

  const weight = Number(body.weight) > 0 ? Number(body.weight) : Number(store.shiprocket?.defaultWeight || 0.5);
  const cod = body.cod ? 1 : 0;

  try {
    return json(await checkServiceability(store, { pincode, weight, cod }), 200, origin);
  } catch (err) {
    console.error(`[shiprocket-edd:${store.key}]`, err.message);
    return json({ error: 'Unable to check delivery right now', detail: err.message }, 502, origin);
  }
}
