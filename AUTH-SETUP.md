# Turning on Real Customer Accounts

Right now the portal uses browser-only accounts. Passwords are properly hashed (PBKDF2), but they live in each visitor's browser — so an account created on a phone won't exist on a laptop, and you can't send password reset emails.

This switches the portal to **Supabase Auth**: real accounts on a server, bcrypt-hashed passwords, email verification, and working password resets. Free tier covers 50,000 monthly active users. About 10 minutes.

---

## Step 1 — Create the project

1. Go to **supabase.com** → Start your project → sign in with GitHub.
2. **New project.** Name it `lumiere`, choose a strong database password (save it somewhere safe), pick the region closest to your customers (US East for Maryland).
3. Wait ~2 minutes for it to provision.

## Step 2 — Copy your two keys

In the project: **Settings → API**. Copy:

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`
- **anon public** key — a long string starting `eyJ...`

Both are safe to put in your website code. (Never use the `service_role` key in the browser — that one is server-only.)

## Step 3 — Turn it on

Open `config.js` and edit the `auth` block:

```js
auth: {
  provider: 'supabase',
  sessionTimeoutMin: 60 * 24 * 7,
  supabaseUrl: 'https://abcdefghijkl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...your anon key...'
},
```

Publish, and the portal switches over automatically. Nothing else needs to change.

## Step 4 — Point emails at your domain

In Supabase: **Authentication → URL Configuration**

- **Site URL:** `https://lumiereskincarecaps.com`
- **Redirect URLs:** add `https://lumiereskincarecaps.com/portal.html` and `https://lumiereskincarecaps.com/portal.html?reset=1`

Then **Authentication → Providers → Email**: leave "Confirm email" ON so new customers verify their address.

## Step 5 — Send email from your own domain (recommended)

Supabase's built-in email is rate-limited and lands in spam more often. In **Authentication → Emails → SMTP Settings**, connect Resend (already on your integrations list):

- Host: `smtp.resend.com` · Port: `465` · User: `resend` · Password: your Resend API key
- Sender: `care@lumiereskincarecaps.com`

## Step 6 — Test it

1. Open your live portal, create an account with a real email.
2. Confirm you receive the verification email and the link works.
3. Sign out, sign back in with **Keep me signed in** ticked.
4. Try **Forgot password** and confirm the reset email arrives.
5. Sign in from your phone with the same account — it should work, which is the whole point.

---

## What changes for customers

| | Before | After |
|---|---|---|
| Where the account lives | That one browser | Your Supabase project |
| Works across devices | No | Yes |
| Password storage | PBKDF2 in browser | bcrypt on a server |
| Email verification | None | Built in |
| Password reset | Message only | Real reset email |
| You can see customers | No | Supabase → Authentication → Users |

## Notes

- **Existing browser accounts don't transfer.** Anyone who signed up in demo mode creates their account again. Not an issue before launch.
- **You can switch back** anytime by setting `provider: 'demo'`.
- **Orders are separate.** This covers sign-in only; connect Stripe for real payments.
- The same Supabase project can later hold orders, inventory, and the shared Packing gallery.
