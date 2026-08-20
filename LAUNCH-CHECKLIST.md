# Lumière · Launch Readiness Checklist

A pragmatic, ordered checklist to take Lumière from prototype to live.

---

## 0 · Domain & Hosting

- [ ] Register `lumiereskincarecaps.com` (Namecheap / Google Domains / Porkbun)
- [ ] Pick a host: **Vercel** or **Netlify** (recommended for static + serverless), or **Cloudflare Pages**
- [ ] Point DNS A/CNAME records to your host
- [ ] Enable HTTPS (free via Let's Encrypt; auto-handled by Vercel/Netlify)
- [ ] Force HTTPS redirect + `www → apex` redirect
- [ ] Set up subdomain `app.lumiereskincarecaps.com` for the portal/admin (optional)

## 1 · Backend (Pick Your Stack)

You need an API that implements the endpoints documented in `api.js`. Recommended:

**Easiest** → **Supabase** (Postgres + Auth + Storage + Edge Functions, all-in-one)

**Most flexible** → **Node.js / Express on Railway or Render**, with **Postgres** (Neon / Supabase / RDS)

**Endpoints to build:**
| Path | Method | Purpose |
|---|---|---|
| `/api/checkout/session` | POST | Create Stripe Checkout session |
| `/api/orders` | GET, POST | List / create orders |
| `/api/orders/:id` | GET | Single order |
| `/api/orders/:id/status` | PATCH | Update status (admin) |
| `/api/inquiries` | GET, POST | Contact form submissions |
| `/api/refunds` | GET, POST | Refund requests |
| `/api/newsletter/subscribe` | POST | Newsletter signup |
| `/api/subscriptions` | GET, POST, DELETE | Recurring orders |
| `/api/agent/:name/run` | POST | Trigger an AI agent (Anthropic API) |
| `/api/shipping/track` | GET | Carrier tracking proxy |

**Webhooks to handle (server-side):**
- Stripe: `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `customer.subscription.updated`
- Shipping carrier: tracking status updates (Shippo/EasyPost/ShipStation)

## 2 · Payments — Stripe

- [ ] Create Stripe account; verify business
- [ ] Add bank account for payouts
- [ ] Create products in Stripe Dashboard matching shop.html SKUs:
  - LUM-3DAY ($24)
  - LUM-7DAY ($49) — recurring $44.10/14d for subscription
  - LUM-DLX ($130)
- [ ] Enable Apple Pay, Google Pay, Klarna, Afterpay
- [ ] Configure webhook endpoint at `https://lumiereskincarecaps.com/api/stripe/webhook`
- [ ] Set publishable key in `config.js` (line: `stripe.publishableKey`)
- [ ] Set secret key as **server-side env var** (`STRIPE_SECRET_KEY`)
- [ ] Test in test mode → switch to live mode

## 3 · Email Infrastructure

**Transactional (order confirmations, shipping, refund notices):**
- [ ] Choose: **Resend** (cleanest API), **Postmark** (reliable), or **SendGrid**
- [ ] Verify sending domain (SPF, DKIM, DMARC records)
- [ ] Build templates: order confirmation, shipping update, delivery, refund issued, password reset
- [ ] Set sending address in `config.js` (line: `email.fromAddress`)

**Marketing (The Letter, abandoned cart, post-purchase):**
- [ ] Choose: **Klaviyo** (commerce-native), **ConvertKit**, or **Mailchimp**
- [ ] Build flows: Welcome, abandoned cart, post-purchase day 7/14/30, re-engagement
- [ ] Set list ID in `config.js` (line: `marketing.listId`)

## 4 · Shipping & Fulfillment

- [ ] Choose carrier integration: **Shippo** (best UX), **EasyPost**, or **ShipStation**
- [ ] Get API key, set as server env var
- [ ] Configure warehouse origin address (Gaithersburg, MD 20878)
- [ ] Set up rate shopping for international orders
- [ ] Configure tracking webhook → updates order status automatically

## 5 · Authentication

The localStorage demo auth in `portal.html` is for development only. Pick a real provider:

- **Easiest** → **Supabase Auth** (free tier generous, integrates with Supabase DB)
- **Powerful** → **Clerk** or **Auth0** (paid, beautiful UX)
- **Custom** → JWT in HTTP-only cookies + bcrypt password hashing

**Critical:**
- [ ] Move `ADMIN_EMAILS` check **server-side** (never trust client-side admin gates)
- [ ] Implement password reset flow
- [ ] Add email verification
- [ ] Add 2FA option for admins

## 6 · AI Agents (Anthropic API)

Each agent (Aurora, Sage, Mercer, Vesper, Roan, Lyra) needs a server-side endpoint that calls the Anthropic API with the agent's system prompt + tool definitions.

- [ ] Create Anthropic API account, get API key
- [ ] Set as server env var: `ANTHROPIC_API_KEY`
- [ ] Build agent endpoints (one per agent in `config.agents`)
- [ ] Define tool schemas:
  - **Aurora** — Stripe (read orders, capture/refund), Shippo (create labels), DB (update orders)
  - **Sage** — Email send (Resend), CRM (HubSpot/Intercom), Notion (knowledge base lookup)
  - **Mercer** — Stripe (refund), DB (order history), policy doc lookup
  - **Vesper** — Search Console API, Ahrefs/SEMrush API (optional), CMS write access
  - **Roan** — Inventory DB, supplier API, sales DB read
  - **Lyra** — Klaviyo (campaign create), social post APIs, A/B test tooling
- [ ] Set up logging: every agent decision should be auditable
- [ ] Set spend caps + rate limits per agent

## 7 · Analytics & Tracking

- [ ] Create GA4 property → put Measurement ID in `config.js` (line: `analytics.ga4MeasurementId`)
- [ ] (Optional) Create GTM container
- [ ] (Optional) Add Meta Pixel for ad retargeting
- [ ] Verify all `Lumiere.Analytics.track()` events are firing in GA4 Realtime
- [ ] Set up conversion goals: `purchase`, `add_to_cart`, `begin_checkout`, `inquiry_submitted`, `newsletter_signup`

## 8 · SEO / GEO / AIO

Already in place:
- ✓ `sitemap.xml` (submit to Google Search Console + Bing Webmaster)
- ✓ `robots.txt` (allows AI crawlers explicitly for GEO/AIO)
- ✓ JSON-LD Schema.org on homepage (Organization, Product, FAQPage)
- ✓ JSON-LD ItemList on shop page
- ✓ Canonical URLs

**To do:**
- [ ] Add Schema.org to `contact.html` (LocalBusiness)
- [ ] Add FAQ Schema to `shipping.html` and `returns.html`
- [ ] Set up Google Search Console; verify ownership
- [ ] Submit sitemap to GSC + Bing Webmaster Tools
- [ ] Generate Open Graph images (1200×630) for each page
- [ ] Create Twitter Card images (1200×600)
- [ ] Add `<meta property="og:image">` tags to each page

## 9 · Compliance & Legal

- [ ] Have a lawyer review or use **Termly** / **iubenda** for:
  - Privacy Policy (`privacy.html`)
  - Terms of Service (`terms.html`)
  - Cookie Policy (`cookies.html`)
  - Refund Policy (already in `returns.html`)
- [ ] GDPR cookie consent banner (CookieYes / OneTrust / custom)
- [ ] CCPA "Do Not Sell My Info" footer link
- [ ] FDA cosmetic compliance (ingredients listed, no medical claims)

## 10 · Performance & Polish

- [ ] Optimize images: convert to WebP/AVIF
- [ ] Add `<img loading="lazy">` to all below-the-fold images
- [ ] Run Lighthouse audit → target 95+ on all four metrics
- [ ] Set up CDN (Cloudflare in front of Vercel)
- [ ] Add `404.html` and `500.html`
- [ ] Add favicons (use realfavicongenerator.net)
- [ ] Test on real iPhone, Android, iPad

## 11 · Customer Support Tools

- [ ] Set up **Intercom**, **Crisp**, or **HelpScout** for live chat
- [ ] Connect Sage agent to draft chat replies for human approval
- [ ] Configure auto-reply on `care@lumiereskincarecaps.com`

## 12 · Pre-Launch Soft Test

- [ ] Run a full test purchase end-to-end (test card, real address)
- [ ] Confirm order appears in admin dashboard
- [ ] Confirm email arrives
- [ ] Confirm tracking link works
- [ ] Test return flow
- [ ] Test refund flow
- [ ] Have 5 friends place orders + give feedback
- [ ] Fix bugs

## 13 · Launch Day

- [ ] Switch `config.js` → `env: 'production'`
- [ ] Switch Stripe → live mode
- [ ] Verify `robots.txt` is NOT blocking the site
- [ ] Submit sitemap to GSC
- [ ] Announce on Instagram, TikTok, LinkedIn
- [ ] Send launch email to your list
- [ ] Be available for support all day

---

## File Map

| File | Purpose |
|---|---|
| `index.html` | Marketing homepage |
| `shop.html` | Product catalog |
| `about.html` | Story, sustainability, press |
| `contact.html` | Contact form |
| `shipping.html` | Shipping policy |
| `returns.html` | Returns policy |
| `checkout.html` | Cart + checkout |
| `portal.html` | Customer login + order history |
| `admin.html` | Admin command center + AI agents |
| `config.js` | All API keys, endpoints, feature flags |
| `api.js` | Backend wrapper (demo mode + production) |
| `analytics.js` | GA4, GTM, Meta Pixel loader |
| `sitemap.xml` | For Google / Bing |
| `robots.txt` | Crawler rules |
| `LAUNCH-CHECKLIST.md` | This file |
| `DEPLOYMENT.md` | Hosting + env var setup |

---

**Last updated:** Built ready for launch. Set the env vars, wire the backend, ship it.
