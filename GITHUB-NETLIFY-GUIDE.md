# Publish Lumière: GitHub + Netlify, Step by Step

No command line needed — this whole guide works in the browser. Total time: about 20 minutes.

## Part 1 — Put the site on GitHub

1. Go to **github.com** and sign up (free) if you don't have an account. Verify your email.
2. Click the **+** in the top-right corner → **New repository**.
3. Name it `lumiere-site`. Leave it **Public** (or choose Private — Netlify works with both). Do NOT check "Add a README." Click **Create repository**.
4. On the empty-repository page, click the link **"uploading an existing file."**
5. Open the folder on your computer where Claude saved the website files. Select **all** the files (every .html file, config.js, api.js, analytics.js, images.js, sitemap.xml, robots.txt — the .md guides are optional) and drag them into the GitHub upload box.
6. Wait for every file to finish uploading, type a short message like `first upload` in the commit box, and click **Commit changes**.

Your code now lives at github.com/YOUR-USERNAME/lumiere-site.

## Part 2 — Publish on Netlify

7. Go to **app.netlify.com** and choose **Sign up with GitHub** — this links the two accounts in one step. Authorize when GitHub asks.
8. Click **Add new site → Import an existing project → Deploy with GitHub**.
9. If prompted, grant Netlify access to your repositories, then pick **lumiere-site** from the list.
10. On the settings screen, leave everything blank/default — there is no build step for this site. **Branch:** main · **Build command:** (empty) · **Publish directory:** (empty or `/`). Click **Deploy site**.
11. In under a minute you'll get a live URL like `random-name-123.netlify.app`. Click it — your site is live. (Optional: Site configuration → **Change site name** to `lumiere-site` for a nicer URL.)

## Part 3 — Connect lumiereskincarecaps.com

12. In Netlify: **Domain management → Add a domain** → enter `lumiereskincarecaps.com` → Verify.
13. Netlify shows DNS instructions. At your domain registrar (wherever you bought the domain), either:
    - **Easiest:** change the domain's **nameservers** to the four Netlify ones shown (Netlify then manages all DNS), or
    - Add an **A record** `@ → 75.2.60.5` and a **CNAME** `www → YOUR-SITE.netlify.app`.
14. Wait for DNS to propagate (minutes to a few hours). Netlify issues the **SSL certificate automatically** — no action needed. Your site is now live at https://lumiereskincarecaps.com.

## Part 4 — Every future update

15. Make changes with Claude as usual.
16. Publish either way:
    - **Web:** open your repo on github.com → **Add file → Upload files** → drag in the changed files → Commit. Netlify detects the commit and redeploys automatically in ~30 seconds.
    - **With Claude:** connect the site folder in Cowork and say "publish" — Claude commits and pushes for you (requires Git + GitHub sign-in on your computer once).

## Before you announce it — launch reminders

- **Bake in your images:** uploads made via Admin → Images live only in your browser. Ask Claude to "bake the uploaded images into the site" first, so visitors see them.
- Swap demo keys for real ones in `config.js` (Stripe, analytics) per LAUNCH-CHECKLIST.md.
- Delete or password-protect `admin.html` before going public — it's your back office.

## If something goes wrong

- Site shows but images are missing → the bake-in step above.
- "Page not found" on Netlify → make sure `index.html` is at the top level of the repo, not inside a subfolder.
- Domain not working → DNS usually just needs more time; check Netlify's Domain management page for the live status.
