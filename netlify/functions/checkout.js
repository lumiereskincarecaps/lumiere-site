/**
 * Lumière — Stripe Checkout Session
 * Netlify Function · POST /api/checkout/session
 *
 * SECURITY: prices are defined here, server-side, and the cart sent by the
 * browser is only trusted for SKU + quantity. Never trust a client price.
 */

const Stripe = require('stripe');

/* Authoritative catalogue. Must match shop.html display prices. */
const CATALOG = {
  'LUM-3DAY':  { name: '3-Day Trial Pack',        price: 24.00, meta: '3 sheets · 36 capsules' },
  'LUM-7DAY':  { name: '7-Day Pack',              price: 49.00, meta: '7 sheets · 84 capsules' },
  'LUM-DLX':   { name: 'Deluxe Set',              price: 69.00, meta: '7-Day Pack + Exfoliating Sponges' },
  'LUM-MASK':  { name: 'Hydrating Hydrogel Mask', price: 12.99, meta: '1 mask · 25g' },
  'hydrating-hydrogel-mask': { name: 'Hydrating Hydrogel Mask', price: 12.99, meta: '1 mask · 25g' }
};

const FREE_SHIPPING_THRESHOLD = 75.00;
const FLAT_SHIPPING = 5.95;
const AMBASSADOR_DISCOUNT = 0.10;   // 10%
const MAX_QTY = 20;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Allow': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return json(500, {
      error: 'Payments are not configured yet.',
      detail: 'STRIPE_SECRET_KEY is not set in the Netlify environment variables.'
    });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid request body.' }); }

  const { items, customer, ambassadorCode } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: 'Your bag is empty.' });
  }
  if (!customer || !customer.email) {
    return json(400, { error: 'An email address is required.' });
  }

  /* Rebuild every line item from the server catalogue. */
  const line_items = [];
  let subtotal = 0;

  for (const raw of items) {
    const sku = String(raw.sku || '').trim();
    const product = CATALOG[sku];
    if (!product) {
      return json(400, { error: `Unknown product: ${sku}` });
    }
    const qty = Math.min(MAX_QTY, Math.max(1, parseInt(raw.qty, 10) || 1));
    subtotal += product.price * qty;

    line_items.push({
      quantity: qty,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: product.name,
          description: product.meta || undefined,
          metadata: { sku }
        }
      }
    });
  }

  /* Shipping, calculated server-side from the server subtotal. */
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  /* Ambassador discount, applied as a Stripe coupon so Stripe shows it properly. */
  const stripe = Stripe(secret, { apiVersion: '2024-06-20' });
  let discounts;
  if (ambassadorCode && /^[A-Za-z0-9_-]{3,32}$/.test(ambassadorCode)) {
    try {
      const coupon = await stripe.coupons.create({
        percent_off: AMBASSADOR_DISCOUNT * 100,
        duration: 'once',
        name: `Ambassador ${ambassadorCode.toUpperCase()}`
      });
      discounts = [{ coupon: coupon.id }];
    } catch (e) {
      // A failed discount must never block the sale.
      console.error('Coupon creation failed:', e.message);
    }
  }

  const origin =
    event.headers.origin ||
    (event.headers.host ? `https://${event.headers.host}` : 'https://lumiereskincarecaps.com');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      discounts,
      customer_email: customer.email,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US','CA','GB','AU','DE','FR','IE','NL','NZ','SG'] },
      phone_number_collection: { enabled: false },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(shippingCost * 100), currency: 'usd' },
          display_name: shippingCost === 0 ? 'Free shipping' : 'Standard shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 7 }
          }
        }
      }],
      automatic_tax: { enabled: false },
      allow_promotion_codes: !discounts,
      success_url: `${origin}/portal.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout.html?checkout=cancel`,
      metadata: {
        ambassadorCode: ambassadorCode || '',
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.name || ''
      }
    });

    return json(200, { url: session.url, id: session.id });
  } catch (e) {
    console.error('Stripe session error:', e);
    return json(502, { error: 'Could not start checkout.', detail: e.message });
  }
};
