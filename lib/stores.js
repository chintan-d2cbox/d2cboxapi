/**
 * One entry per Shopify store.
 *
 * key      → used in env var names: SHIPROCKET_<KEY>_EMAIL, SHIPROCKET_<KEY>_PASSWORD
 * origins  → every domain the store runs on (custom domain, www, myshopify, preview)
 *
 * The API finds the store from the request's Origin header,
 * so the same JS snippet works on every store without changes.
 */
export const STORES = {
  blep: {
    name: 'BLEP',
    origins: [
      'https://blepworld.com',
      'https://www.blepworld.com'
      // 'https://blepworld.myshopify.com'  ← add the store's myshopify domain for theme preview
    ],
    shiprocket: {
      pickupPin: '',       // leave empty to auto-detect primary pickup location
      defaultWeight: 0.5   // kg
    }
  }

  // exampleStore: {
  //   name: 'Example',
  //   origins: ['https://example.com', 'https://www.example.com', 'https://example.myshopify.com'],
  //   shiprocket: { pickupPin: '', defaultWeight: 0.5 }
  // }
};

export const findStoreByOrigin = (origin) => {
  const entry = Object.entries(STORES).find(([, s]) => s.origins.includes(origin));
  return entry ? { key: entry[0], ...entry[1] } : null;
};

export const findStoreByKey = (key) =>
  STORES[key] ? { key, ...STORES[key] } : null;
