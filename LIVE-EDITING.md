# Editing the Live Site with Claude

How to keep using Claude to upload, edit, or change anything on lumiereskincarecaps.com after it goes live — with zero downtime.

## How it works

The site is static files (HTML/JS). "Editing while live" means: Claude edits the files in this folder, then the updated files are pushed to your host. Visitors never see an outage — the new version simply replaces the old one on their next page load (usually live within 30–60 seconds).

## Recommended setup (one-time, ~15 minutes)

**GitHub + Netlify** (or Vercel / Cloudflare Pages — all work the same way):

1. Create a free GitHub account and a repository (e.g. `lumiere-site`).
2. Push this folder's files to the repository.
3. Sign up at netlify.com → "Import from GitHub" → select the repo. No build settings needed (it's plain HTML).
4. Point your domain lumiereskincarecaps.com to Netlify (they walk you through the DNS records at your registrar).

After that, **every change pushed to GitHub goes live automatically**.

## Your everyday workflow with Claude

1. Open Cowork and connect this site folder (Claude needs the folder connected to edit the real files).
2. Ask for any change — "raise the mask price to $14.99", "add a new FAQ", "swap the hero photo with this one" (attach images; Claude saves them into the site as real files).
3. Say "publish" — Claude commits and pushes, and the site updates live within a minute.

Claude can do everything it's been doing in this project — new pages, new products, price changes, copy edits, image swaps, layout fixes — at any time, while the site stays up.

## Important: images on the live site

The Admin → Images upload center currently stores images in **your browser only** (IndexedDB, demo mode). That's perfect for previewing, but visitors to the live site won't see those uploads.

Before/at launch, ask Claude to **"bake the uploaded images into the site"** — Claude will save each image as a real file (e.g. `/img/pack-7day.jpg`) and wire the pages to them, so every visitor sees them. Do the same whenever you change product photos later. (Alternatively, connect a real backend/CDN later — see DEPLOYMENT.md.)

The same applies to the Packing page's customer gallery: entries added in a browser stay in that browser. For a shared public gallery, a small backend is needed — Claude can set that up when you pick a host.

## Deploying to WPMU DEV Hosting

WPMU DEV hosting is WordPress-oriented, but it works fine for this static site via SFTP. One-time setup:

1. **Create SFTP credentials.** In The Hub → your site → **Hosting → Tools → SFTP/SSH Users** → Add User. WPMU DEV shows you the server hostname, port (22), username, and lets you set a password. Copy all four.
2. **Enter them in the site's admin panel.** Open admin.html → Deploy tab → Choose Your Host → **⚙ Custom** → fill in:
   - Host Name/Provider: `WPMU DEV`
   - Deploy Method: `SFTP`
   - Server: the hostname shown in The Hub
   - Port: `22`
   - Username / Password: the SFTP user you created
   - Remote Path: `/public_html` (WPMU DEV's web root; use a subfolder like `/public_html/site` if you're keeping WordPress alongside)
3. **Upload the files.** Use any SFTP client (FileZilla, Cyberduck) — connect with those credentials and upload every file in this folder to the remote path. Claude can also generate an upload script for you once the credentials exist.
4. **Static-site note.** If the site replaces WordPress entirely on that domain, upload to `/public_html` and make sure an `index.html` is at the root — it will be served ahead of WordPress's index.php on most configs, but the cleanest setup is asking WPMU DEV support to disable WordPress or pointing the domain at a fresh site slot used only for these files.
5. **Domain & SSL.** In The Hub → Hosting → **Domains**, add lumiereskincarecaps.com and follow their DNS instructions; SSL is issued automatically.

Every future edit: change files with Claude → re-upload the changed files via SFTP (or re-run the upload script). Site stays live the whole time.

## Alternatives

- **Netlify Drop (simplest, no GitHub):** drag this folder onto app.netlify.com/drop after each round of edits. Live in seconds; no accounts to wire together, but manual each time.
- **Your own hosting (cPanel/FTP):** Claude edits files; you re-upload the changed files via your host's file manager or FTP.

## Guardrails

- Everything is versioned in Git — any change can be rolled back with one command ("Claude, revert the last change").
- Test locally first: open the HTML files in your browser before saying "publish".
- Keep LAUNCH-CHECKLIST.md handy for the production settings (Stripe keys, analytics IDs, real email addresses) in config.js.
