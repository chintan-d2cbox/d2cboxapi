# D2CBox API

Shared APIs for all D2CBox Shopify stores, hosted on Vercel.
Docs + copy-paste snippets: https://d2cboxapi.vercel.app

## Structure

```
api/shiprocket/edd.js      → POST /api/shiprocket/edd
lib/stores.js              → list of stores + their domains
lib/shiprocket.js          → Shiprocket login, pickup, serviceability
lib/http.js                → CORS + store lookup (shared by all APIs)
public/                    → docs website (tabs)
public/snippets/<api-id>/  → copy-paste files shown on the website
```

## Add a new store
1. `lib/stores.js` → add key + domains
2. Vercel env vars → `SHIPROCKET_<KEY>_EMAIL`, `SHIPROCKET_<KEY>_PASSWORD`
3. Push to GitHub (auto-deploys; env var changes need Redeploy)

## Add a new API
1. `api/<provider>/<name>.js` → export `OPTIONS` and `POST`
2. `lib/<provider>.js` → provider logic
3. `public/snippets/<api-id>/` → theme files
4. `public/app.js` → add one object to `APIS` (becomes a new tab)
