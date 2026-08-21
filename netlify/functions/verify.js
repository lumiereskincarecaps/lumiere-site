/**
 * Lumière — confirm a completed Stripe Checkout Session
 * Netlify Function · GET /api/checkout/verify?session_id=cs_...
 *
 * The browser cannot be trusted to say "the payment succeeded", so the
 * confirmation page asks Stripe directly before showing an order.
 */
const Stripe = require('stripe');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json(500, { error: 'Payments are not configured.' });

  const sessionId = (event.queryStringParameters || {}).session_id;
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return json(400, { error: 'Missing or malformed session_id.' });
  }

  try {
    const stripe = Stripe(secret, { apiVersion: '2024-06-20' });
    const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });

    if (s.payment_status !== 'paid') {
      return json(402, { paid: false, status: s.payment_status });
    }

    return json(200, {
      paid: true,
      orderId: 'LUM-' + sessionId.slice(-8).toUpperCase(),
      email: s.customer_details && s.customer_details.email,
      name: (s.customer_details && s.customer_details.name) || s.metadata.customerName || '',
      address: s.customer_details && s.customer_details.address,
      currency: s.currency,
      subtotal: (s.amount_subtotal || 0) / 100,
      shipping: (s.total_details && s.total_details.amount_shipping || 0) / 100,
      discount: (s.total_details && s.total_details.amount_discount || 0) / 100,
      total: (s.amount_total || 0) / 100,
      ambassadorCode: s.metadata.ambassadorCode || '',
      items: (s.line_items ? s.line_items.data : []).map(li => ({
        name: li.description,
        qty: li.quantity,
        price: (li.amount_total || 0) / 100 / (li.quantity || 1)
      }))
    });
  } catch (e) {
    console.error('Verify failed:', e);
    return json(502, { error: 'Could not verify payment.', detail: e.message });
  }
};
