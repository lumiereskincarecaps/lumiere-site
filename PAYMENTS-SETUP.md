# Turning on real payments

Your site now has the code to take card payments through Stripe. Three steps are
left, and two of them are on your side because they involve secret keys that I
must never see or handle.

Until step 3 is done the site stays in demo mode and charges nobody.

---

## Step 1 · Get your Stripe secret key

1. Sign in at <https://dashboard.stripe.com>
2. Top right, make sure the **Test mode** toggle is ON while you're testing
3. Go to **Developers → API keys**
4. Under *Secret key*, click **Reveal test key**
5. Copy it — it starts with `sk_test_`

Never paste this key into a file in this project, into chat, or into anything
that gets committed to GitHub. It lets anyone move money in your account.

---

## Step 2 · Add the key to Netlify

1. Netlify → your site → **Site configuration**
2. **Environment variables** → **Add a variable** → **Add a single variable**
3. Key: `STRIPE_SECRET_KEY`
4. Value: paste the `sk_test_...` key
5. Scopes: leave as all, then **Create variable**
6. Go to **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

The redeploy matters. Environment variables are only picked up by a new build.

---

## Step 3 · Switch the site out of demo mode

In `config.js`, line 12:

```js
env: 'demo',          // change to:
env: 'production',
```

Commit that change (or ask me to — just say "turn on payments"). Once it deploys,
**Place Order** sends customers to Stripe's hosted checkout.

---

## Testing before you go live

While Netlify holds the `sk_test_` key, use Stripe's test cards. No real money moves.

| Card number | What it does |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 9995` | Declined — insufficient funds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

Use any future expiry date, any 3-digit CVC, and any postcode.

**What a successful test should do:**

1. Redirect you to `checkout.stripe.com`
2. Take the test card and return you to `portal.html`
3. Show a green *Payment received* bar with an order number
4. Empty your bag
5. Show the payment in Stripe → **Payments**

---

## Going live for real

1. Stripe dashboard → complete **business verification** (bank details, tax info).
   Stripe will not release funds until this is finished.
2. Flip **Test mode** OFF and copy the **live** secret key (`sk_live_...`)
3. In Netlify, update `STRIPE_SECRET_KEY` to the live key
4. **Clear cache and deploy site** again
5. Make one small real purchase yourself and then refund it, to confirm the whole
   loop works end to end

---

## How the money math works

Prices live in **two** places and both must agree:

- What customers see: `shop.html`, in the `data-price` attributes
- What customers are charged: `netlify/functions/checkout.js`, in `CATALOG`

The function deliberately ignores the price the browser sends and recalculates
from `CATALOG`. Without that, anyone could edit the price in their browser and
buy the Deluxe Set for one cent.

**So if you change a price, change it in both files.** Current values:

| SKU | Product | Price |
|---|---|---|
| `LUM-3DAY` | 3-Day Trial Pack | $24.00 |
| `LUM-7DAY` | 7-Day Pack | $49.00 |
| `LUM-DLX` | Deluxe Set | $69.00 |
| `LUM-MASK` | Hydrating Hydrogel Mask | $12.99 |

Shipping is $5.95, free over $75. Ambassador codes take 10% off. All three are
enforced server-side.

---

## Still not wired up

These are real gaps, not oversights you can ignore forever:

- **Sales tax** — `automatic_tax` is off. Maryland requires sales tax collection,
  and economic-nexus rules may apply in other states once you pass their
  thresholds. Turning on Stripe Tax is a dashboard setting plus a one-line change.
- **Order emails** — Stripe sends a payment receipt, but nothing sends your own
  confirmation or shipping notice yet.
- **Webhooks** — orders are recorded when the customer lands back on the site. If
  they close the tab at the wrong moment, the payment succeeds but no local order
  is written. A Stripe webhook is the durable fix.
- **Subscriptions** — the "Subscribe & save 10%" option still runs through the
  old demo path. Stripe subscriptions need a separate mode.
- **Inventory** — nothing decrements stock or prevents overselling.

Ask me for any of these when you're ready.
