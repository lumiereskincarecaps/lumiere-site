/**
 * Lumière — backend service status
 * Netlify Function · GET /api/services/status
 *
 * Reports which services are configured by reading the server's own
 * environment variables. Returns ONLY names, booleans and short masked
 * prefixes — never a secret value. Safe to call from the admin UI.
 *
 * This exists so the admin panel reflects the real server state on every
 * device, instead of whatever happens to be in one browser's localStorage.
 */

const SERVICES = {
  stripe: {
    name: 'Stripe',
    vars: [
      { env: 'STRIPE_PUBLISHABLE_KEY', scope: 'public', required: false, expect: /^pk_(test|live)_/ },
      { env: 'STRIPE_SECRET_KEY',      scope: 'secret', required: true,  expect: /^sk_(test|live)_/ },
      { env: 'STRIPE_WEBHOOK_SECRET',  scope: 'secret', required: false, expect: /^whsec_/ }
    ]
  },
  supabase: {
    name: 'Supabase',
    vars: [
      { env: 'SUPABASE_URL',         scope: 'public', required: true,  expect: /^https:\/\/.+\.supabase\.co/ },
      { env: 'SUPABASE_ANON_KEY',    scope: 'public', required: true },
      { env: 'SUPABASE_SERVICE_KEY', scope: 'secret', required: false }
    ]
  },
  resend: {
    name: 'Resend',
    vars: [
      { env: 'RESEND_API_KEY',     scope: 'secret', required: true, expect: /^re_/ },
      { env: 'RESEND_FROM_DOMAIN', scope: 'public', required: false }
    ]
  },
  klaviyo: {
    name: 'Klaviyo',
    vars: [
      { env: 'KLAVIYO_API_KEY', scope: 'secret', required: true },
      { env: 'KLAVIYO_SITE_ID', scope: 'public', required: false }
    ]
  },
  shippo:   { name: 'Shippo',   vars: [{ env: 'SHIPPO_API_TOKEN', scope: 'secret', required: true }] },
  easyship: {
    name: 'Easyship',
    vars: [
      { env: 'EASYSHIP_API_TOKEN', scope: 'secret', required: true },
      { env: 'EASYSHIP_ORIGIN_ID', scope: 'public', required: false }
    ]
  },
  anthropic: { name: 'Anthropic', vars: [{ env: 'ANTHROPIC_API_KEY', scope: 'secret', required: true, expect: /^sk-ant-/ }] },
  clerk: {
    name: 'Clerk',
    vars: [
      { env: 'CLERK_PUBLISHABLE_KEY', scope: 'public', required: true, expect: /^pk_/ },
      { env: 'CLERK_SECRET_KEY',      scope: 'secret', required: true, expect: /^sk_/ }
    ]
  },
  ga4: { name: 'Google Analytics', vars: [{ env: 'GA4_MEASUREMENT_ID', scope: 'public', required: true, expect: /^G-/ }] }
};

/* Public-scope values are safe to return in full — they ship to browsers anyway.
   Secret-scope values are never returned, only a short prefix for sanity checks. */
function describe(v) {
  const raw = process.env[v.env] || '';
  const present = raw.length > 0;
  return {
    env: v.env,
    scope: v.scope,
    required: !!v.required,
    present,
    valid: present && (v.expect ? v.expect.test(raw) : true),
    hint: present && v.expect && !v.expect.test(raw)
      ? 'Value does not look like the expected format for this field'
      : null,
    preview: present
      ? (v.scope === 'public' ? raw.slice(0, 48) : raw.slice(0, 7) + '…' + String(raw.length) + ' chars')
      : null
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const services = {};
  for (const [key, def] of Object.entries(SERVICES)) {
    const vars = def.vars.map(describe);
    const requiredVars = vars.filter(v => v.required);
    services[key] = {
      name: def.name,
      connected: requiredVars.length > 0 && requiredVars.every(v => v.present && v.valid),
      partial: vars.some(v => v.present) && !requiredVars.every(v => v.present),
      missing: requiredVars.filter(v => !v.present).map(v => v.env),
      invalid: vars.filter(v => v.present && !v.valid).map(v => v.env),
      vars
    };
  }

  const connectedCount = Object.values(services).filter(s => s.connected).length;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      source: 'server',
      siteName: process.env.SITE_NAME || null,
      connectedCount,
      totalServices: Object.keys(SERVICES).length,
      services,
      checkedAt: new Date().toISOString()
    })
  };
};
