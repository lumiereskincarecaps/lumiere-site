/* ============================================================
   LUMIÈRE · IMAGE MANAGER
   ------------------------------------------------------------
   Manages product/marketing images across the site. Images are
   uploaded by admins via /admin.html → Images tab. Each page
   declares "image slots" (named placeholders) that this script
   auto-fills with uploaded images at page load.

   Storage: IndexedDB (effectively unlimited per origin, ~few hundred MB).
   The logo is additionally cached to localStorage so it renders
   instantly (no flash of text) on every page load.

   To prevent the text-logo flash, pages can optionally include
   this inline in the <head>, BEFORE any body markup:

     <script>
       try {
         var l = localStorage.getItem('lumiere_logo_cache');
         if(l){
           var s = document.createElement('style');
           s.id = 'lumiere-logo-styles';
           s.textContent = 'a.logo[data-slot="site-logo"]{font-size:0!important;letter-spacing:0!important;background:url("'+l+'") no-repeat left center / contain;display:inline-block;width:280px;height:80px}a.logo[data-slot="site-logo"]>*{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}nav{padding-top:0.65rem!important;padding-bottom:0.65rem!important}@media(max-width:900px){a.logo[data-slot="site-logo"]{width:220px;height:64px}}@media(max-width:480px){a.logo[data-slot="site-logo"]{width:180px;height:52px}}';
           document.head.appendChild(s);
         }
       } catch(e){}
     </script>

   ============================================================ */

(function(){
  const DB_NAME = 'lumiere_images';
  const STORE = 'images';

  /* ---------- SLOT REGISTRY ----------
     Every image position on the site is registered here.
     When you add a future page, just add its slots to this list.
     Use the slot ID as <div data-slot="..."> or <img data-slot="...">
     ------------------------------------ */
  const SLOT_REGISTRY = {
    'Homepage': [
      { id:'home-hero-product',  label:'Hero Product Image',           desc:'The main capsule visual on the homepage hero (right side).', rec:'1200×1200, transparent PNG'},
      { id:'home-marquee-bg',    label:'Marquee Background',           desc:'Optional pattern/texture for the ingredient marquee.',       rec:'1920×120'},
      { id:'home-ritual-bg',     label:'Ritual Section Background',    desc:'Soft background for the 6-step ritual section.',             rec:'1920×800'},
      { id:'home-ingredients',   label:'Ingredients Wheel / Benefits Infographic',    desc:'Replaces the "12 Hero Ingredients" placeholder circle in the Ingredients section. Best with a square ingredient-wheel or benefits infographic (e.g. the LUMIÈRE SKIN CAP graphic).',  rec:'1200×1200 PNG or JPG'},
    ],
    'Shop': [
      { id:'pack-3day',          label:'3-Day Trial Pack',             desc:'Product image for the 3-Day pack card.', rec:'600×600' },
      { id:'pack-7day',          label:'7-Day Pack',                   desc:'Product image for the 7-Day pack card.', rec:'600×600' },
      { id:'pack-deluxe',        label:'Deluxe Set',                   desc:'Deluxe set with exfoliating sponges + 7-day pack.', rec:'600×600' },
      { id:'sponge-standalone',  label:'Exfoliating Sponges — Deluxe Spotlight',  desc:'Hero image in the Deluxe Spotlight section.', rec:'1000×1000' },
      { id:'pack-mask',          label:'Hydrating Hydrogel Mask',      desc:'Product image for the Hydrogel Mask card (front of pouch).', rec:'600×600' },
      { id:'shop-hero',          label:'Shop Page Hero',               desc:'Optional banner above product grid.', rec:'1920×400' },
    ],
    'About': [
      { id:'about-story',        label:'Our Story Image',              desc:'Image used in the "Born in a hotel bathroom" story section.', rec:'800×800' },
      { id:'about-founder',      label:'Founder Portrait',             desc:'Photo of Mady — founder section.', rec:'700×900' },
      { id:'about-studio',       label:'Maryland Studio',              desc:'Behind-the-scenes shot of the Gaithersburg studio.', rec:'1200×800' },
    ],
    'Contact / Support': [
      { id:'contact-hero',       label:'Contact Page Hero',            desc:'Optional hero image on the contact page.', rec:'1920×600' },
      { id:'contact-card',       label:'Contact Card / QR',            desc:'Shareable card with QR code — Contact page, "Keep us in your pocket".', rec:'1536×1024' },
      { id:'shipping-hero',      label:'Shipping Page Hero',           desc:'Optional hero image on shipping page.', rec:'1920×600' },
      { id:'returns-hero',       label:'Returns Page Hero',            desc:'Optional hero image on returns page.', rec:'1920×600' },
    ],
    'Affiliate': [
      { id:'affiliate-hero',     label:'Affiliate Hero Image',         desc:'Hero image on the affiliate landing page.', rec:'1200×800' },
      { id:'affiliate-creator',  label:'Creator Testimonial Photo',    desc:'Photo of testimonial creator.', rec:'500×500, round' },
    ],
    'Instructions (How to Use)': [
      { id:'howto-day-box',   label:'Daytime Product Box',   desc:'Photo of the Day box/sheet — shown beside the 6-step morning routine on instructions.html.', rec:'900×1050 (portrait)' },
      { id:'howto-night-box', label:'Nighttime Product Box', desc:'Photo of the Night box/sheet — shown beside the 7-step evening routine on instructions.html.', rec:'900×1050 (portrait)' },
    ],
    'Before & After': [
      { id:'ba-1-before',  label:'Customer 1 · Before',  desc:'Sophia · 32, dry skin · Day 1 photo.', rec:'800×800, square crop' },
      { id:'ba-1-after',   label:'Customer 1 · After',   desc:'Sophia · 32, dry skin · Week 12 photo (after 12 weeks of Lumière).', rec:'800×800, square crop' },
      { id:'ba-2-before',  label:'Customer 2 · Before',  desc:'Mike · 28, hyperpigmentation · Day 1 photo.', rec:'800×800, square crop' },
      { id:'ba-2-after',   label:'Customer 2 · After',   desc:'Mike · 28, hyperpigmentation · Day 14 photo.', rec:'800×800, square crop' },
      { id:'ba-3-before',  label:'Customer 3 · Before',  desc:'Mary · 25, fine lines · Day 1 photo.', rec:'800×800, square crop' },
      { id:'ba-3-after',   label:'Customer 3 · After',   desc:'Mary · 25, fine lines · Day 14 photo.', rec:'800×800, square crop' },
    ],
    'Travel Hacks': [
      { id:'travel-hero-before',     label:'Hero: Bag Full of Bottles (Before)',  desc:'Photo of a stuffed toiletry bag — used in the hero split visual.', rec:'800×800' },
      { id:'travel-hero-after',      label:'Hero: Lumière Sheet (After)',          desc:'Clean shot of a Lumière sheet — paired with the "Before" photo.', rec:'800×800' },
      { id:'compare-bottles-spread', label:'Comparison: Bottles Spread',           desc:'Photo of a bunch of skincare bottles laid out (the "14 bottles" row).', rec:'1200×800' },
      { id:'compare-lumiere-light',  label:'Comparison: Lumière Light Pack',       desc:'Single Lumière sheet on travel surface — opposing visual.', rec:'1200×800' },
      { id:'travel-tsa-visual',      label:'TSA Confiscation Visual',              desc:'Optional image for the TSA reality section.', rec:'800×800' },
      { id:'travel-infographic-1',   label:'Infographic: Travel Hacks Overview',   desc:'Full "Travel Hacks — Skincare, Simplified" infographic with pain points, benefits and socials.', rec:'1440×1080 or larger' },
      { id:'travel-infographic-2',   label:'Infographic: Transform Your Skin',     desc:'Before/after + capsule sheet how-to infographic.', rec:'1536×1024 or larger' },
    ],
    'Social / Sharing': [
      { id:'og-default',         label:'Default Open Graph Image',     desc:'Used for social sharing when a page doesn\'t define its own.', rec:'1200×630' },
      { id:'og-shop',            label:'Shop OG Image',                desc:'When shop.html is shared on social.', rec:'1200×630' },
      { id:'og-affiliate',       label:'Affiliate OG Image',           desc:'When affiliate.html is shared on social.', rec:'1200×630' },
      { id:'site-logo',          label:'Site Logo (PNG)',              desc:'Used in schema.org and OG tags.', rec:'512×512' },
      { id:'favicon',            label:'Favicon (ICO/PNG)',            desc:'Browser tab icon.', rec:'32×32 PNG' },
    ]
  };

  /* ---------- INDEXED DB ---------- */
  let dbPromise = null;
  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath:'id' });
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
    return dbPromise;
  }

  async function setImage(id, data){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, ...data });
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  }
  async function getImage(id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = e => reject(e.target.error);
    });
  }
  async function deleteImage(id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = e => reject(e.target.error);
    });
  }
  async function listImages(){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = e => reject(e.target.error);
    });
  }

  /* ---------- FILE → BASE64 ---------- */
  function fileToDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------- LOGO STYLE INJECTION ----------
     Renders the uploaded logo via background-image so it appears
     INSTANTLY from a localStorage cache — no flash of text logo. */
  const LOGO_CACHE_KEY = 'lumiere_logo_cache';

  function injectLogoStyles(dataUrl){
    let style = document.getElementById('lumiere-logo-styles');
    if(!style){
      style = document.createElement('style');
      style.id = 'lumiere-logo-styles';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = `
      /* Render uploaded logo as background-image — tall + readable, but width scaled down so it stops crowding the menu */
      a.logo[data-slot="site-logo"]{
        font-size:0 !important;
        letter-spacing:0 !important;
        line-height:0 !important;
        background-image:url("${dataUrl}");
        background-repeat:no-repeat;
        background-position:left center;
        background-size:contain;
        display:block;
        width:200px;
        height:78px;
        flex-shrink:0;
      }
      @media(max-width:1280px){a.logo[data-slot="site-logo"]{width:180px;height:70px}}
      @media(max-width:1100px){a.logo[data-slot="site-logo"]{width:162px;height:63px}}
      @media(max-width:900px){a.logo[data-slot="site-logo"]{width:155px;height:60px}}
      @media(max-width:600px){a.logo[data-slot="site-logo"]{width:145px;height:56px}}
      /* Trim nav vertical padding so the bigger logo doesn't make the bar too tall */
      nav{padding-top:0.4rem !important;padding-bottom:0.4rem !important}
      /* Keep nav items centered next to the bigger logo, and give them less gap on medium screens so they fit */
      .nav-inner{align-items:center !important;gap:1rem}
      @media(max-width:1280px){
        .nav-links{gap:1.5rem !important}
      }
      @media(max-width:1100px){
        .nav-links{gap:1.1rem !important}
        .nav-links a{font-size:0.72rem !important;letter-spacing:0.1em !important}
      }
      /* Earlier mobile-menu collapse so links stop crowding when there isn't room */
      @media(max-width:960px){.nav-links{display:none !important}}
      /* Visually hide text content but keep it accessible for screen readers */
      a.logo[data-slot="site-logo"] > *{
        position:absolute !important;width:1px !important;height:1px !important;
        padding:0 !important;margin:-1px !important;overflow:hidden !important;
        clip:rect(0,0,0,0) !important;white-space:nowrap !important;border:0 !important;
      }
    `;
  }

  function clearLogoStyles(){
    document.getElementById('lumiere-logo-styles')?.remove();
  }

  /* SYNC BOOT — runs the moment this script is parsed.
     If a logo is cached in localStorage, inject styles BEFORE the browser
     paints the body. This eliminates the flash of text logo. */
  (function bootLogoFromCache(){
    let cached;
    try { cached = localStorage.getItem(LOGO_CACHE_KEY); } catch(e){}
    if(cached) injectLogoStyles(cached);
  })();

  /* ---------- GLOBAL STYLES for non-logo slot rendering ---------- */
  function injectGlobalStyles(){
    if(document.getElementById('lumiere-images-global')) return;
    const s = document.createElement('style');
    s.id = 'lumiere-images-global';
    s.textContent = `
      /* General has-image overlay cleanup */
      [data-slot].has-image > svg{display:none}
    `;
    document.head.appendChild(s);
  }

  /* ---------- PUBLISHED IMAGE MANIFEST ----------
     img/manifest.json maps slot IDs to real files committed to the site.
     These work for every visitor on every device. Browser uploads are only
     a preview until they're published. */
  let MANIFEST = null;
  async function loadManifest(){
    if(MANIFEST !== null) return MANIFEST;
    try {
      // Cache-bust hard: a stale manifest lets old browser-only uploads win,
      // which makes one device disagree with every other device.
      const r = await fetch('img/manifest.json?v=' + Date.now(), { cache:'reload' });
      MANIFEST = r.ok ? await r.json() : {};
    } catch(e){
      try { const r2 = await fetch('img/manifest.json', { cache:'no-cache' }); MANIFEST = r2.ok ? await r2.json() : {}; }
      catch(e2){ MANIFEST = {}; }
    }
    return MANIFEST;
  }

  /* Once a slot is published as a real file, drop the browser-only copy.
     Keeps this device showing exactly what everyone else sees. */
  async function purgeSuperseded(man){
    if(!man || !Object.keys(man).length) return;
    try {
      const local = await listImages();
      for(const img of local){
        if(man[img.id]){ try { await deleteImage(img.id); } catch(e){} }
      }
    } catch(e){}
  }

  /* ---------- IMAGE SEO METADATA ---------- */
  const IMG_SEO_KEY = 'lumiere_image_seo';
  function getSeo(slotId){
    try { return (JSON.parse(localStorage.getItem(IMG_SEO_KEY)) || {})[slotId] || null; }
    catch(e){ return null; }
  }

  /* ---------- AUTO-APPLY TO PAGE ---------- */
  async function applyToPage(){
    injectGlobalStyles();
    const slots = document.querySelectorAll('[data-slot]');
    if(!slots.length) return;
    const all = await listImages();
    const map = {};
    all.forEach(img => map[img.id] = img.dataUrl);
    // Published files take priority so every visitor sees them
    const man = await loadManifest();
    Object.keys(man || {}).forEach(id => { map[id] = man[id]; });
    purgeSuperseded(man);   // fire-and-forget; published files are the source of truth
    slots.forEach(el => {
      const id = el.dataset.slot;
      const url = map[id];
      if(!url){
        // Clean up has-image class if upload was deleted
        el.classList.remove('has-image');
        return;
      }
      // Decide how to apply
      if(el.tagName === 'IMG'){
        el.src = url;
        const seo = getSeo(id);
        if(seo && seo.alt) el.alt = seo.alt;
        if(seo && seo.title) el.title = seo.title;
        el.loading = 'lazy';
        el.classList.add('has-image');
      } else if(el.dataset.slotMode === 'bg'){
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-image');
      } else if(el.classList.contains('logo')){
        // Logos render via CSS background-image (injected globally) — no DOM mutation needed.
        // Just sync the localStorage cache so future page loads are instant.
        try {
          if(localStorage.getItem(LOGO_CACHE_KEY) !== url) localStorage.setItem(LOGO_CACHE_KEY, url);
        } catch(e){ /* quota — fine, IDB still has it */ }
        injectLogoStyles(url);
        el.classList.add('has-image');
      } else {
        // Default: replace inner contents with an img preserving alt text
        const seo = getSeo(id);
        const alt = (seo && seo.alt) || el.dataset.slotAlt || el.dataset.slot;
        const titleAttr = seo && seo.title ? ` title="${seo.title.replace(/"/g,'&quot;')}"` : '';
        const fit = el.dataset.slotFit || 'cover';
        const caption = seo && seo.caption
          ? `<figcaption style="font-size:0.8rem;color:#3a3a38;font-style:italic;text-align:center;margin-top:0.6rem">${seo.caption}</figcaption>` : '';
        el.innerHTML = `<img src="${url}" alt="${alt.replace(/"/g,'&quot;')}"${titleAttr} loading="lazy" style="width:100%;height:100%;object-fit:${fit};display:block;border-radius:inherit">${caption}`;
        el.classList.add('has-image');
      }
    });
    // Update favicon if present
    if(map.favicon){
      let link = document.querySelector('link[rel="icon"]');
      if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = map.favicon;
    }
    // Update OG image
    if(map['og-default']){
      let og = document.querySelector('meta[property="og:image"]');
      if(!og){ og = document.createElement('meta'); og.setAttribute('property','og:image'); document.head.appendChild(og); }
      og.content = map['og-default'];
    }
  }

  /* ---------- EXPORT ---------- */
  // Cross-tab sync via BroadcastChannel — upload in admin, see live changes everywhere
  let channel = null;
  try { channel = new BroadcastChannel('lumiere_images'); } catch(e){ /* unsupported */ }

  function broadcast(slotId){
    try { channel?.postMessage({ slotId, time: Date.now() }); } catch(e){}
  }

  if(channel){
    channel.onmessage = () => applyToPage();
  }

  window.Lumiere = window.Lumiere || {};
  window.Lumiere.Images = {
    SLOT_REGISTRY,
    async upload(slotId, file){
      const dataUrl = await fileToDataURL(file);
      await setImage(slotId, {
        dataUrl,
        filename: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      });
      // For logos: cache to localStorage so it renders instantly across all pages (no flash)
      if(slotId === 'site-logo'){
        try { localStorage.setItem(LOGO_CACHE_KEY, dataUrl); } catch(e){
          console.warn('Logo too large for localStorage cache — IndexedDB still has it but there may be a slight flash on page load.');
        }
        injectLogoStyles(dataUrl);
      }
      window.dispatchEvent(new CustomEvent('images:change', { detail:{slotId} }));
      broadcast(slotId);
      return true;
    },
    async get(slotId){ return getImage(slotId); },
    async list(){ return listImages(); },
    async delete(slotId){
      await deleteImage(slotId);
      // Clean up has-image class so SVG/text fallbacks come back
      document.querySelectorAll(`[data-slot="${slotId}"]`).forEach(el => el.classList.remove('has-image'));
      // For logos: clear the localStorage cache and remove the injected CSS
      if(slotId === 'site-logo'){
        try { localStorage.removeItem(LOGO_CACHE_KEY); } catch(e){}
        clearLogoStyles();
      }
      window.dispatchEvent(new CustomEvent('images:change', { detail:{slotId} }));
      broadcast(slotId);
      return true;
    },
    applyToPage,
    manifest: loadManifest,
    async published(){ return loadManifest(); }
  };

  // Auto-apply on page load
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyToPage);
  } else {
    applyToPage();
  }
  window.addEventListener('images:change', applyToPage);
  // Also re-apply when page becomes visible again (e.g., user switches back to tab after uploading)
  document.addEventListener('visibilitychange', () => { if(!document.hidden) applyToPage(); });
})();
