/**
 * Lumière — Stripe webhook
 * POST /api/stripe/webhook
 *
 * Stripe calls this the moment a payment completes, independent of the
 * customer's browser. Orders are recorded to Netlify Blobs so a closed tab
 * can never lose one.
 *
 * Setup (one time, in the Stripe dashboard):
 *   Developers → Webhooks → Add endpoint
 *   URL: https://lumiereskincarecaps.com/api/stripe/webhook
 *   Event: checkout.session.completed
 *   Then copy the signing secret (whsec_...) into Netlify as STRIPE_WEBHOOK_SECRET.
 */

const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(500, { error: 'STRIPE_SECRET_KEY not configured' });
  if (!whSecret) return json(500, { error: 'STRIPE_WEBHOOK_SECRET not configured — add it in Netlify env vars' });

  const stripe = Stripe(secret, { apiVersion: '2024-06-20' });

  /* Verify this genuinely came from Stripe. Reject everything else. */
  let stripeEvent;
  try {
    const sig = event.headers['stripe-signature'];
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return json(400, { error: 'Invalid signature' });
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const s = stripeEvent.data.object;
    try {
      const full = await stripe.checkout.sessions.retrieve(s.id, { expand: ['line_items'] });
      const order = {
        orderId: 'LUM-' + s.id.slice(-8).toUpperCase(),
        sessionId: s.id,
        paidAt: new Date((s.created || Date.now() / 1000) * 1000).toISOString(),
        email: s.customer_details && s.customer_details.email,
        name: (s.customer_details && s.customer_details.name) || (s.metadata && s.metadata.customerName) || '',
        address: s.customer_details && s.customer_details.address,
        shippingAddress: s.shipping_details && s.shipping_details.address,
        currency: s.currency,
        subtotal: (s.amount_subtotal || 0) / 100,
        tax: (s.total_details && s.total_details.amount_tax || 0) / 100,
        shipping: (s.total_details && s.total_details.amount_shipping || 0) / 100,
        discount: (s.total_details && s.total_details.amount_discount || 0) / 100,
        total: (s.amount_total || 0) / 100,
        ambassadorCode: (s.metadata && s.metadata.ambassadorCode) || '',
        livemode: !!s.livemode,
        items: (full.line_items ? full.line_items.data : []).map(li => ({
          name: li.description,
          qty: li.quantity,
          total: (li.amount_total || 0) / 100
        }))
      };
      const store = getStore('orders');
      await store.setJSON(s.id, order);
      console.log('Order recorded:', order.orderId, order.email, '$' + order.total);
    } catch (e) {
      console.error('Failed to record order:', e);
      // Return 500 so Stripe retries the delivery — nothing is lost.
      return json(500, { error: 'Failed to record order' });
    }
  }

  return json(200, { received: true });
};
