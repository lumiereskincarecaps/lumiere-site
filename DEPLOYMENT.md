# Lumière · Deployment Guide

## Quick Deploy (Static Frontend Only) — 5 Minutes

The fastest way to get the marketing site + portal live (without payments).

### Vercel
```bash
npx vercel
# Follow prompts, choose "static site"
```

### Netlify
```bash
npx netlify-cli deploy --prod
```

### Cloudflare Pages
1. Push files to a Git repo
2. Connect at [pages.cloudflare.com](https://pages.cloudflare.com)
3. Set framework to "None" — it's static HTML

The site works in **demo mode** out of the box. Cart, orders, inquiries, and refunds all use localStorage.

---

## Full Production Deploy

### Step 1 · Environment Variables (server-side)

Create these in your hosting provider's dashboard. **Never commit them to Git.**

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email — Transactional (Resend example)
RESEND_API_KEY=re_...
EMAIL_FROM=hello@lumiereskincarecaps.com

# Email — Marketing (Klaviyo)
KLAVIYO_PRIVATE_KEY=pk_...
KLAVIYO_LIST_ID=YourListId

# Database (Supabase example)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Shipping
SHIPPO_API_KEY=shippo_live_...

# Anthropic (AI agents)
ANTHROPIC_API_KEY=sk-ant-...

# Auth (if using Clerk/Auth0)
CLERK_SECRET_KEY=sk_live_...

# Admin gate (server-validated)
ADMIN_EMAILS=seoprrocket@gmail.com,team@lumiereskincarecaps.com

# Site URL
NEXT_PUBLIC_SITE_URL=https://lumiereskincarecaps.com
```

### Step 2 · Update `config.js`

Edit these public values (safe to commit):

```js
env: 'production',
siteUrl: 'https://lumiereskincarecaps.com',
apiBase: 'https://api.lumiereskincarecaps.com', // or '/api' if same domain
stripe: {
  publishableKey: 'pk_live_REPLACE',  // ← put your real public key
  ...
},
analytics: {
  ga4MeasurementId: 'G-REAL-ID',
  enabled: true
}
```

### Step 3 · Build Backend (Node + Express example)

Minimal `server.js`:

```js
import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

// CHECKOUT
app.post('/api/checkout/session', async (req, res) => {
  const { items, customer, success_url, cancel_url } = req.body;
  const session = await stripe.checkout.sessions.create({
    line_items: items.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: i.name, description: i.meta },
        unit_amount: Math.round(i.price * 100)
      },
      quantity: i.qty
    })),
    mode: 'payment',
    success_url,
    cancel_url,
    customer_email: customer.email,
    shipping_address_collection: { allowed_countries: ['US','CA','GB','FR','DE','AU','JP'] }
  });
  res.json({ url: session.url });
});

// STRIPE WEBHOOK — order created on payment success
app.post('/api/stripe/webhook', express.raw({type:'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  if(event.type === 'checkout.session.completed'){
    const s = event.data.object;
    const order = await supabase.from('orders').insert({
      stripe_session_id: s.id,
      email: s.customer_email,
      total: s.amount_total / 100,
      status: 'pending',
      address: s.shipping_details.address
    }).select().single();

    // Send order confirmation email
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: s.customer_email,
      subject: `Your Lumière order ${order.data.id}`,
      html: '<p>Thank you for ordering — we will ship within 1 business day.</p>'
    });
  }
  res.json({ received: true });
});

// ORDERS
app.get('/api/orders', async (req, res) => {
  const { email } = req.query;
  const { data } = await supabase.from('orders').select().eq('email', email).order('created_at', { ascending: false });
  res.json(data);
});

// INQUIRIES
app.post('/api/inquiries', async (req, res) => {
  const inquiry = req.body;
  const { data } = await supabase.from('inquiries').insert(inquiry).select().single();

  // Trigger Sage agent to draft a reply
  await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You are Sage, the Lumière customer care agent. Draft warm, brand-aligned replies.',
      messages: [{ role:'user', content: `Customer wrote: "${inquiry.body}". Draft a reply.` }]
    })
  }).then(r => r.json()).then(async (msg) => {
    await supabase.from('inquiries').update({ ai_draft: msg.content[0].text }).eq('id', data.id);
  });

  res.json(data);
});

// AGENTS
app.post('/api/agent/:name/run', async (req, res) => {
  const agent = req.params.name;
  // Route to the right system prompt + tool definitions
  // Implementation depends on your agent design — see Anthropic Tool Use docs
  res.json({ queued: true, agent });
});

app.listen(3000);
```

Deploy this to **Railway**, **Render**, **Fly.io**, or **Vercel Functions**.

### Step 4 · Database Schema (Supabase / Postgres)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  customer_name TEXT,
  address JSONB,
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2),
  shipping NUMERIC(10,2),
  tax NUMERIC(10,2),
  total NUMERIC(10,2),
  status TEXT DEFAULT 'pending', -- pending | processing | shipped | delivered | canceled
  tracking TEXT,
  ship_date DATE,
  delivered_date DATE,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body TEXT,
  topic TEXT,
  urgency TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'new',
  ai_draft TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  customer TEXT,
  amount NUMERIC(10,2),
  reason TEXT,
  ai_score NUMERIC(3,2),
  ai_recommendation TEXT,
  ai_rationale TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT,
  cadence_days INT,
  next_delivery DATE,
  price NUMERIC(10,2),
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE newsletter (
  email TEXT PRIMARY KEY,
  source TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers see own orders" ON orders
  FOR SELECT USING (email = auth.jwt()->>'email');
CREATE POLICY "Admins see all" ON orders
  FOR ALL USING ((auth.jwt()->>'is_admin')::boolean = true);
```

### Step 5 · Test Production Locally

```bash
# Run a local Stripe webhook listener
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Test the cart flow
open http://localhost:3000
# → Add item to cart → Checkout → Use test card 4242 4242 4242 4242
```

### Step 6 · DNS & SSL

Point your domain at your host:
```
A     @          76.76.21.21         (Vercel)
CNAME www        cname.vercel-dns.com
```

Hosting provider handles SSL automatically.

### Step 7 · Submit to Search Engines

```
1. Verify ownership at https://search.google.com/search-console
2. Submit sitemap: https://lumiereskincarecaps.com/sitemap.xml
3. Same at Bing Webmaster Tools
```

### Step 8 · Monitor

- **Errors:** Sentry (free tier)
- **Uptime:** UptimeRobot (free)
- **Performance:** Vercel Analytics or PostHog
- **Logs:** Your hosting provider's logs + Logflare

---

## Going Live Checklist

- [ ] All env vars set in production
- [ ] `config.js` env set to `'production'`
- [ ] Stripe in **live mode**
- [ ] DNS pointed correctly
- [ ] HTTPS working
- [ ] `robots.txt` allows crawling
- [ ] Sitemap submitted to GSC
- [ ] Test purchase completed end-to-end
- [ ] Confirmation email received
- [ ] Order visible in admin dashboard
- [ ] AI agents responding (check `/api/agent/sage/draft`)

You're live.
