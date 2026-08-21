/**
 * Lumière — order list for the admin dashboard
 * GET /api/orders/list
 *
 * Reads the durable orders recorded by the Stripe webhook. Protected by a
 * bearer check against ORDERS_API_KEY (set any strong random string in
 * Netlify). Without that variable set, the endpoint stays sealed.
 */
const { getStore } = require('@netlify/blobs');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.ORDERS_API_KEY;
  if (!apiKey) return json(503, { error: 'Order API not enabled. Set ORDERS_API_KEY in Netlify to turn it on.' });

  const auth = event.headers['authorization'] || '';
  if (auth !== 'Bearer ' + apiKey) return json(401, { error: 'Unauthorized' });

  try {
    const store = getStore('orders');
    const { blobs } = await store.list();
    const orders = [];
    for (const b of blobs.slice(0, 200)) {
      const o = await store.get(b.key, { type: 'json' });
      if (o) orders.push(o);
    }
    orders.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
    return json(200, { count: orders.length, orders });
  } catch (e) {
    console.error('Order list failed:', e);
    return json(500, { error: 'Could not read orders' });
  }
};
