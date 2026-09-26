import { findStoreByOrigin, findStoreByKey } from './stores.js';

export const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin'
});

export const json = (body, status = 200, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });

export const preflight = (request) => {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

/**
 * Resolve the calling store.
 * - Store websites: matched by Origin header.
 * - This docs site (same host): uses body.store so the "Test" panel works.
 */
export const resolveStore = (request, body) => {
  const origin = request.headers.get('Origin') || '';
  const selfOrigin = `https://${request.headers.get('host')}`;

  if (origin === selfOrigin || origin.startsWith('http://localhost')) {
    return findStoreByKey(String(body.store || ''));
  }
  return findStoreByOrigin(origin);
};
