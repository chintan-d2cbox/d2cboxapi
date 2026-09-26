const SR_BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // token valid 10 days; refresh at 9
const PICKUP_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory caches per store (survive while the function instance is warm)
const tokenCache = new Map();
const pickupCache = new Map();

const credentials = (store) => {
  const prefix = `SHIPROCKET_${store.key.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing ${prefix}_EMAIL / ${prefix}_PASSWORD`);
  return { email, password };
};

async function getToken(store, forceRefresh = false) {
  const cached = tokenCache.get(store.key);
  if (!forceRefresh && cached && Date.now() < cached.expires) return cached.value;

  const res = await fetch(`${SR_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials(store))
  });
  if (!res.ok) throw new Error(`Login ${res.status}: ${await res.text()}`);

  const { token } = await res.json();
  if (!token) throw new Error('Login returned no token');

  tokenCache.set(store.key, { value: token, expires: Date.now() + TOKEN_TTL_MS });
  return token;
}

async function getPickupPin(store, token) {
  if (store.shiprocket?.pickupPin) return store.shiprocket.pickupPin;

  const cached = pickupCache.get(store.key);
  if (cached && Date.now() < cached.expires) return cached.value;

  const res = await fetch(`${SR_BASE}/settings/company/pickup`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Pickup ${res.status}: ${await res.text()}`);

  const payload = await res.json();
  const locations = payload?.data?.shipping_address || [];
  const location = locations.find(l => Number(l.is_primary_location) === 1) || locations[0];
  if (!location?.pin_code) throw new Error('No pickup location in Shiprocket');

  const pin = String(location.pin_code);
  pickupCache.set(store.key, { value: pin, expires: Date.now() + PICKUP_TTL_MS });
  return pin;
}

export async function checkServiceability(store, { pincode, weight, cod }, retried = false) {
  const token = await getToken(store, retried);
  const pickupPin = await getPickupPin(store, token);

  const url = new URL(`${SR_BASE}/courier/serviceability/`);
  url.searchParams.set('pickup_postcode', pickupPin);
  url.searchParams.set('delivery_postcode', pincode);
  url.searchParams.set('weight', weight);
  url.searchParams.set('cod', cod);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  // Token expired — log in again and retry once
  if (res.status === 401 && !retried) return checkServiceability(store, { pincode, weight, cod }, true);

  // 404 = no courier serves this pincode
  if (res.status === 404) return { serviceable: false };
  if (!res.ok) throw new Error(`Serviceability ${res.status}: ${await res.text()}`);

  const payload = await res.json();
  const couriers = payload?.data?.available_courier_companies || [];
  if (!couriers.length) return { serviceable: false };

  // Shiprocket's recommended courier, else the fastest
  const recommendedId = payload.data.recommended_courier_company_id;
  const courier =
    couriers.find(c => c.courier_company_id === recommendedId) ||
    couriers.slice().sort((a, b) => Number(a.estimated_delivery_days) - Number(b.estimated_delivery_days))[0];

  return {
    serviceable: true,
    etd: courier.etd || null,
    days: Number(courier.estimated_delivery_days) || null,
    cod: couriers.some(c => Number(c.cod) === 1),
    courier: courier.courier_name
  };
}
