# Lumière Capsules · Website

A complete, launch-ready DTC skincare site with admin dashboard, AI agents, customer portal, and full e-commerce flow.

## Quick Start

```bash
# Static preview (any HTTP server works)
npx serve .
# → opens at http://localhost:3000
```

The site runs in **demo mode** out of the box. Cart, orders, inquiries, refunds, and customer auth all work via localStorage — no backend required for development.

## What's Inside

### Marketing Pages
- `index.html` — homepage
- `shop.html` — 4-pack catalog with comparison table
- `about.html` — story, sustainability, press
- `contact.html` — contact form (saves to admin inbox)
- `shipping.html` — shipping policy
- `returns.html` — returns policy + Skin-Try Guarantee

### Commerce
- `checkout.html` — full checkout flow with Stripe placeholder

### Customer Area
- `portal.html` — login, signup, order history, subscriptions, account

### Admin
- `admin.html` — command center with 6 AI agents, inquiries inbox, refund queue, SEO agent (Vesper), and live site audit

### Backend Layer
- `config.js` — all API endpoints, keys, feature flags (single source of truth)
- `api.js` — wrapper for cart, orders, inquiries, refunds, agents (demo + production)
- `analytics.js` — GA4, GTM, Meta Pixel loader

### SEO / GEO Assets
- `sitemap.xml` — Google + Bing
- `robots.txt` — explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
- Schema.org JSON-LD on key pages (Organization, Product, FAQPage, ItemList)

### Documentation
- `LAUNCH-CHECKLIST.md` — step-by-step launch readiness
- `DEPLOYMENT.md` — backend setup with full code examples

## Demo Accounts

Sign in at `/portal.html`:

| Email | Password | Role |
|---|---|---|
| `seoprrocket@gmail.com` | `lumiere` | Admin (sees Fulfillment + Admin) |
| `james.h@northstar.co` | `lumiere` | Customer |
| `lea.m@maisonsavante.fr` | `lumiere` | Customer with subscription |

## To Go Live

See `LAUNCH-CHECKLIST.md` and `DEPLOYMENT.md`. Short version:

1. Choose a host (Vercel / Netlify / Cloudflare Pages)
2. Choose a backend (Supabase recommended for speed)
3. Wire Stripe, Resend (email), Klaviyo (marketing)
4. Set env vars
5. Flip `config.js` → `env: 'production'`
6. Submit sitemap to Google Search Console
7. Ship

## Architecture

```
┌─────────────────────────────────────────────┐
│  STATIC FRONTEND (Vercel/Netlify)          │
│  HTML + config.js + api.js + analytics.js  │
└──────────────────┬──────────────────────────┘
                   │ fetch(/api/*)
                   ▼
┌─────────────────────────────────────────────┐
│  BACKEND API (Node/Express on Railway)      │
│  - Stripe checkout + webhooks               │
│  - Order management                         │
│  - Auth (Clerk/Supabase)                    │
│  - Routes to AI agents                      │
└────────────┬───────────────┬────────────────┘
             │               │
   ┌─────────▼──┐   ┌────────▼──────────┐
   │ Postgres   │   │ Anthropic API     │
   │ (Supabase) │   │ (6 AI agents)     │
   └────────────┘   └───────────────────┘
```

## License

Proprietary — © 2026 Lumière Capsules.
