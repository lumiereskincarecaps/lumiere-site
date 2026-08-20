/* ============================================================
   LUMIÈRE · CONFIG
   ------------------------------------------------------------
   Single source of truth for environment, API endpoints,
   third-party keys, and feature flags. In production, populate
   these via your hosting provider's environment variables.
   ============================================================ */

window.LUMIERE_CONFIG = {

  /* ---------- ENVIRONMENT ---------- */
  env: 'demo',                         // 'demo' | 'staging' | 'production'
  siteUrl: 'https://lumiereskincarecaps.com',
  apiBase: '/api',                     // your backend base URL (Node, Rails, Django, etc.)

  /* ---------- BUSINESS ---------- */
  business: {
    name: 'Lumière Capsules',
    legalName: 'Lumière Capsules, LLC',
    email: 'care@lumiereskincarecaps.com',
    pressEmail: 'press@lumiereskincarecaps.com',
    partnersEmail: 'partners@lumiereskincarecaps.com',
    phone: '+1-800-586-8738',
    address: {
      city: 'Gaithersburg',
      region: 'MD',
      postal: '20878',
      country: 'US'
    }
  },

  /* ---------- PAYMENTS · STRIPE ---------- */
  stripe: {
    publishableKey: 'pk_test_REPLACE_WITH_YOUR_KEY',
    // Webhook + secret key live server-side, never in this file.
    successUrl: '/portal.html?checkout=success',
    cancelUrl: '/shop.html?checkout=cancel',
    currency: 'usd'
  },

  /* ---------- TRANSACTIONAL EMAIL ---------- */
  // SendGrid, Resend, Postmark — server-side only.
  // This client only triggers the API; no keys exposed.
  email: {
    fromAddress: 'hello@lumiereskincarecaps.com',
    fromName: 'Lumière Capsules',
    replyTo: 'care@lumiereskincarecaps.com'
  },

  /* ---------- MARKETING EMAIL · KLAVIYO / CONVERTKIT ---------- */
  marketing: {
    provider: 'klaviyo',                          // 'klaviyo' | 'mailchimp' | 'convertkit'
    publicKey: 'KLAVIYO_PUBLIC_REPLACE',          // safe to expose
    listId: 'YourListId',
    welcomeFlow: 'welcome-3-day-trial'
  },

  /* ---------- SHIPPING / FULFILLMENT ---------- */
  shipping: {
    provider: 'shippo',                           // 'shippo' | 'easypost' | 'shipstation'
    warehouseFromAddress: {
      street1: 'Studio Address',
      city: 'Gaithersburg',
      state: 'MD',
      zip: '20878',
      country: 'US'
    },
    freeShippingThreshold: 75,
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={TRACKING_NUMBER}'
  },

  /* ---------- ANALYTICS ---------- */
  analytics: {
    ga4MeasurementId: 'G-XXXXXXXXXX',             // Google Analytics 4
    gtmId: '',                                    // optional: Google Tag Manager
    metaPixelId: '',                              // optional: Meta/Facebook Pixel
    posthogKey: '',                               // optional: PostHog
    enabled: true                                 // master toggle
  },

  /* ---------- LIVE CHAT / SUPPORT ---------- */
  support: {
    provider: 'intercom',                         // 'intercom' | 'crisp' | 'helpscout' | 'none'
    appId: 'INTERCOM_APP_ID_REPLACE',
    enabled: false                                // turn on once configured
  },

  /* ---------- AUTH ---------- */
  // For production, swap to Auth0 / Clerk / Supabase / custom JWT.
  // The localStorage demo auth is in portal.html and is for development only.
  auth: {
    provider: 'demo',                             // 'demo' | 'auth0' | 'clerk' | 'supabase' | 'custom'
    sessionTimeoutMin: 60 * 24 * 7                // 7 days
  },

  /* ---------- AI AGENTS · ANTHROPIC ---------- */
  // These are placeholder agent IDs; the real Anthropic API key
  // lives server-side and is invoked via /api/agent/{name}.
  agents: {
    aurora:  { enabled: true,  model: 'claude-opus-4-6',   role: 'order-ops' },
    sage:    { enabled: true,  model: 'claude-sonnet-4-6', role: 'customer-care' },
    mercer:  { enabled: true,  model: 'claude-sonnet-4-6', role: 'refunds' },
    vesper:  { enabled: true,  model: 'claude-opus-4-6',   role: 'seo-geo-aio' },
    roan:    { enabled: false, model: 'claude-haiku-4-5',  role: 'inventory' },
    lyra:    { enabled: true,  model: 'claude-sonnet-4-6', role: 'marketing' }
  },

  /* ---------- FEATURE FLAGS ---------- */
  features: {
    cart: true,
    checkout: true,
    subscriptions: true,
    giftCards: false,
    referralProgram: false,
    affiliateProgram: false,
    multiCurrency: false,
    international: true,
    skinQuiz: false                               // future feature
  },

  /* ---------- LEGAL ---------- */
  legal: {
    privacyPolicyUrl: '/privacy.html',
    termsUrl: '/terms.html',
    cookiePolicyUrl: '/cookies.html',
    cookieConsentRequired: true                   // GDPR / CCPA
  }
};
