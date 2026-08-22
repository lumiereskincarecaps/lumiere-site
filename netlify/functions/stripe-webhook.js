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

      // Order-confirmation email via Resend (skips quietly if not configured —
      // a missing email must never make Stripe think the webhook failed).
      try { await sendConfirmationEmail(order); }
      catch (e) { console.error('Confirmation email failed (order still recorded):', e.message); }
    } catch (e) {
      console.error('Failed to record order:', e);
      // Return 500 so Stripe retries the delivery — nothing is lost.
      return json(500, { error: 'Failed to record order' });
    }
  }

  return json(200, { received: true });
};


/* ---------- ORDER CONFIRMATION EMAIL (Resend) ---------- */
async function sendConfirmationEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !order.email) return;

  const fromDomain = process.env.RESEND_FROM_DOMAIN || 'send.lumiereskincarecaps.com';
  const from = `Lumi\u00e8re Skincare <orders@${fromDomain}>`;

  const rows = (order.items || []).map(i =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${i.name} \u00d7 ${i.qty}</td>` +
    `<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">$${Number(i.total).toFixed(2)}</td></tr>`
  ).join('');

  const line = (label, amt) => amt
    ? `<tr><td style="padding:4px 0;color:#666">${label}</td><td style="padding:4px 0;text-align:right;color:#666">$${Number(amt).toFixed(2)}</td></tr>` : '';

  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="font-size:26px;letter-spacing:6px">LUMI\u00c8RE</div>
      <div style="font-size:11px;letter-spacing:4px;color:#b8935a">SKINCARE</div>
    </div>
    <div style="background:#faf7f2;border-radius:12px;padding:28px 32px">
      <h1 style="font-size:20px;font-weight:normal;margin:0 0 6px">Thank you${order.name ? ', ' + order.name.split(' ')[0] : ''}.</h1>
      <p style="font-size:14px;color:#555;margin:0 0 20px">Your order <strong>${order.orderId}</strong> is confirmed and being prepared in Maryland.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
        ${line('Subtotal', order.subtotal)}
        ${line('Discount', order.discount ? -order.discount : 0)}
        ${line('Shipping', order.shipping)}
        ${line('Tax', order.tax)}
        <tr><td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a">Total</td>
            <td style="padding:10px 0;font-weight:bold;border-top:2px solid #1a1a1a;text-align:right">$${Number(order.total).toFixed(2)}</td></tr>
      </table>
    </div>
    <p style="font-size:12px;color:#888;text-align:center;padding:24px 0">
      Questions? Just reply, or write to hello@lumiereskincarecaps.com<br>
      Lumi\u00e8re Skincare \u00b7 Gaithersburg, Maryland
    </p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [order.email],
      reply_to: 'hello@lumiereskincarecaps.com',
      subject: `Order confirmed \u2014 ${order.orderId}`,
      html
    })
  });
  if (!res.ok) throw new Error('Resend API ' + res.status + ': ' + await res.text());
  console.log('Confirmation email sent to', order.email);
}
