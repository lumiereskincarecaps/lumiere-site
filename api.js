/* ============================================================
   LUMIÈRE · API LAYER
   ------------------------------------------------------------
   Every backend call funnels through this file. Each function:
     1. In demo/dev mode: reads/writes localStorage so the site
        is fully usable without a backend.
     2. In production: makes real fetch() calls to your API.
   To go live, flip CONFIG.env to 'production' and ensure your
   backend implements the endpoints documented below.
   ============================================================ */

(function(){
  const CFG = window.LUMIERE_CONFIG;
  if(!CFG){ console.error('LUMIERE: config.js must load before api.js'); return; }

  const isDemo = () => CFG.env === 'demo';

  /* ---------- localStorage helpers ---------- */
  const LS = {
    get(k, fallback){ try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  const KEYS = {
    cart:        'lumiere_cart',
    orders:      'lumiere_orders',
    inquiries:   'lumiere_inquiries',
    refunds:     'lumiere_refunds',
    newsletter:  'lumiere_newsletter',
    subs:        'lumiere_subscriptions'
  };

  /* ---------- HTTP helper for production ---------- */
  async function http(path, opts = {}){
    const res = await fetch(CFG.apiBase + path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if(!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
  }

  /* ============================================================
     CART  ·  /api/cart
     ============================================================ */
  const Cart = {
    get(){ return LS.get(KEYS.cart, []); },
    add(item){
      const cart = this.get();
      const existing = cart.find(i => i.sku === item.sku);
      if(existing) existing.qty += (item.qty || 1);
      else cart.push({ ...item, qty: item.qty || 1 });
      LS.set(KEYS.cart, cart);
      window.dispatchEvent(new CustomEvent('cart:change'));
      Lumiere.Analytics.track('add_to_cart', { sku: item.sku, price: item.price });
      return cart;
    },
    remove(sku){
      const cart = this.get().filter(i => i.sku !== sku);
      LS.set(KEYS.cart, cart);
      window.dispatchEvent(new CustomEvent('cart:change'));
      return cart;
    },
    setQty(sku, qty){
      const cart = this.get();
      const item = cart.find(i => i.sku === sku);
      if(!item) return cart;
      item.qty = Math.max(1, qty);
      LS.set(KEYS.cart, cart);
      window.dispatchEvent(new CustomEvent('cart:change'));
      return cart;
    },
    clear(){ LS.set(KEYS.cart, []); window.dispatchEvent(new CustomEvent('cart:change')); },
    count(){ return this.get().reduce((s,i) => s + i.qty, 0); },
    subtotal(){ return this.get().reduce((s,i) => s + i.price * i.qty, 0); }
  };

  /* ============================================================
     CHECKOUT  ·  /api/checkout/session
     PROD: POSTs to Stripe Checkout via your server, returns URL.
     ============================================================ */
  async function startCheckout(items, customer){
    Lumiere.Analytics.track('begin_checkout', { item_count: items.length, value: items.reduce((s,i)=>s+i.price*i.qty,0) });
    if(isDemo()){
      // Demo: create a local order, clear cart, send to portal.
      const order = await Orders.create({ items, customer });
      Cart.clear();
      return { url: 'portal.html?checkout=success&order=' + order.id, demo: true };
    }
    const r = await http('/checkout/session', { method:'POST', body: { items, customer, success_url: CFG.stripe.successUrl, cancel_url: CFG.stripe.cancelUrl } });
    return { url: r.url };
  }

  /* ============================================================
     ORDERS  ·  /api/orders
     ============================================================ */
  const Orders = {
    async list(filter = {}){
      if(isDemo()) return LS.get(KEYS.orders, []).filter(o => !filter.email || o.email === filter.email);
      return http('/orders?' + new URLSearchParams(filter));
    },
    async get(id){
      if(isDemo()) return LS.get(KEYS.orders, []).find(o => o.id === id);
      return http('/orders/' + id);
    },
    async create({ items, customer }){
      const order = {
        id: 'LUM-' + (3000 + LS.get(KEYS.orders, []).length),
        date: new Date().toISOString().slice(0,10),
        status: 'pending',
        items, customer,
        email: customer.email, name: customer.name, address: customer.address,
        subtotal: items.reduce((s,i)=>s+i.price*i.qty,0),
        shipping: 0, tax: 0, tracking: null,
        shipDate: null, deliveredDate: null
      };
      order.tax = +(order.subtotal * 0.08).toFixed(2);
      order.total = order.subtotal + order.shipping + order.tax;

      if(isDemo()){
        const all = LS.get(KEYS.orders, []);
        all.unshift(order);
        LS.set(KEYS.orders, all);
        Lumiere.Analytics.track('purchase', { transaction_id: order.id, value: order.total });
        return order;
      }
      return http('/orders', { method:'POST', body: order });
    },
    async updateStatus(id, status){
      if(isDemo()){
        const all = LS.get(KEYS.orders, []);
        const o = all.find(x => x.id === id);
        if(o){
          o.status = status;
          if(status === 'shipped' && !o.shipDate) o.shipDate = new Date().toISOString().slice(0,10);
          if(status === 'delivered' && !o.deliveredDate) o.deliveredDate = new Date().toISOString().slice(0,10);
          LS.set(KEYS.orders, all);
        }
        return o;
      }
      return http(`/orders/${id}/status`, { method:'PATCH', body:{ status } });
    }
  };

  /* ============================================================
     INQUIRIES  ·  /api/inquiries  (contact form, support email)
     PROD: this also fires Sage agent for AI-drafted reply.
     ============================================================ */
  const Inquiries = {
    async list(){
      if(isDemo()) return LS.get(KEYS.inquiries, []);
      return http('/inquiries');
    },
    async create(data){
      const inquiry = {
        id: 'INQ-' + Date.now().toString(36).toUpperCase(),
        ...data,
        time: new Date().toISOString(),
        status: 'new',
        topic: data.topic || 'General',
        urgency: 'normal'
      };
      if(isDemo()){
        const all = LS.get(KEYS.inquiries, []);
        all.unshift(inquiry);
        LS.set(KEYS.inquiries, all);
        Lumiere.Analytics.track('inquiry_submitted', { topic: inquiry.topic });
        // In production, this also triggers Sage to draft a reply.
        return inquiry;
      }
      return http('/inquiries', { method:'POST', body: inquiry });
    }
  };

  /* ============================================================
     REFUNDS  ·  /api/refunds
     PROD: triggers Mercer agent for risk scoring + recommendation.
     ============================================================ */
  const Refunds = {
    async list(){ if(isDemo()) return LS.get(KEYS.refunds, []); return http('/refunds'); },
    async create({ orderId, reason, customer, amount }){
      const refund = {
        id: 'REF-' + Date.now().toString(36).toUpperCase(),
        orderId, reason, customer, amount,
        time: new Date().toISOString(),
        aiScore: 0.15, aiRecommendation: 'review'  // overwritten by Mercer in prod
      };
      if(isDemo()){
        const all = LS.get(KEYS.refunds, []);
        all.unshift(refund);
        LS.set(KEYS.refunds, all);
        Lumiere.Analytics.track('refund_requested', { order_id: orderId, amount });
        return refund;
      }
      return http('/refunds', { method:'POST', body: refund });
    }
  };

  /* ============================================================
     NEWSLETTER  ·  /api/newsletter/subscribe
     PROD: POSTs to Klaviyo / ConvertKit / Mailchimp.
     ============================================================ */
  const Newsletter = {
    async subscribe(email, source = 'footer'){
      if(isDemo()){
        const list = LS.get(KEYS.newsletter, []);
        if(!list.find(s => s.email === email)){
          list.push({ email, source, time: new Date().toISOString() });
          LS.set(KEYS.newsletter, list);
        }
        Lumiere.Analytics.track('newsletter_signup', { source });
        return { ok:true };
      }
      // Production example with Klaviyo:
      // return http('/newsletter/subscribe', { method:'POST', body:{ email, source, listId: CFG.marketing.listId }});
      return http('/newsletter/subscribe', { method:'POST', body:{ email, source }});
    }
  };

  /* ============================================================
     SUBSCRIPTIONS  ·  /api/subscriptions  (Stripe Subscriptions)
     Full CRUD for monthly recurring orders, with seeded demo data.
     ============================================================ */
  function seedSubs(){
    let all = LS.get(KEYS.subs, null);
    if(all !== null) return all;
    all = {
      'seoprrocket@gmail.com': [
        { id:'SUB-1001', email:'seoprrocket@gmail.com', customerName:'Mady Patel', plan:'7-Day Pack', planSku:'LUM-7DAY',
          cadenceDays:7, cadenceLabel:'Every 7 days', basePrice:49, discountPct:10, price:44.10,
          status:'active', next:'2026-06-02', startedAt:'2026-02-14',
          totalOrders:6, totalSpent:480.60, paymentMethod:'Visa •••• 4242',
          shipTo:'Gaithersburg, MD 20878', autoRenew:true },
        { id:'SUB-1002', email:'seoprrocket@gmail.com', customerName:'Mady Patel', plan:'Sponge Refill', planSku:'LUM-SPONGE',
          cadenceDays:90, cadenceLabel:'Every 3 months', basePrice:25, discountPct:10, price:22.50,
          status:'active', next:'2026-07-18', startedAt:'2026-01-18',
          totalOrders:2, totalSpent:45.00, paymentMethod:'Visa •••• 4242',
          shipTo:'Gaithersburg, MD 20878', autoRenew:true }
      ],
      'lea.m@maisonsavante.fr': [
        { id:'SUB-1003', email:'lea.m@maisonsavante.fr', customerName:'Léa Marchand', plan:'7-Day Pack', planSku:'LUM-7DAY',
          cadenceDays:7, cadenceLabel:'Every 7 days', basePrice:49, discountPct:10, price:44.10,
          status:'active', next:'2026-05-14', startedAt:'2026-03-07',
          totalOrders:9, totalSpent:396.90, paymentMethod:'Mastercard •••• 9821',
          shipTo:'12 Rue de Sévigné, 75003 Paris, France', autoRenew:true }
      ],
      'james.h@northstar.co': [
        { id:'SUB-1004', email:'james.h@northstar.co', customerName:'James Holloway', plan:'7-Day Pack', planSku:'LUM-7DAY',
          cadenceDays:7, cadenceLabel:'Every 7 days', basePrice:49, discountPct:10, price:44.10,
          status:'paused', next:'2026-06-08', startedAt:'2026-03-24',
          totalOrders:3, totalSpent:240.30, paymentMethod:'Amex •••• 1004',
          shipTo:'1620 Montgomery St, San Francisco, CA 94133', autoRenew:false }
      ],
      'olivia@brennanco.com': [
        { id:'SUB-1005', email:'olivia@brennanco.com', customerName:'Olivia Brennan', plan:'7-Day Pack', planSku:'LUM-7DAY',
          cadenceDays:7, cadenceLabel:'Every 7 days', basePrice:49, discountPct:10, price:44.10,
          status:'active', next:'2026-05-12', startedAt:'2026-04-05',
          totalOrders:5, totalSpent:220.50, paymentMethod:'Visa •••• 2204',
          shipTo:'4501 Wisconsin Ave NW, Washington, DC 20016', autoRenew:true }
      ]
    };
    LS.set(KEYS.subs, all);
    return all;
  }

  const Subscriptions = {
    async list(email){
      const all = seedSubs();
      if(isDemo()) return email ? (all[email] || []) : Object.values(all).flat();
      return http('/subscriptions' + (email ? '?email=' + email : ''));
    },
    async get(id){
      const all = seedSubs();
      const flat = Object.values(all).flat();
      if(isDemo()) return flat.find(s => s.id === id);
      return http(`/subscriptions/${id}`);
    },
    async create(payload){
      const all = seedSubs();
      const sub = {
        id: 'SUB-' + (1000 + Object.values(all).flat().length + 1),
        startedAt: new Date().toISOString().slice(0,10),
        totalOrders:0, totalSpent:0,
        autoRenew:true,
        status:'active',
        ...payload
      };
      // Compute next ship date if not provided
      if(!sub.next){
        const d = new Date(); d.setDate(d.getDate() + (sub.cadenceDays || 30));
        sub.next = d.toISOString().slice(0,10);
      }
      sub.price = +(sub.basePrice * (1 - (sub.discountPct||10)/100)).toFixed(2);
      if(isDemo()){
        all[sub.email] = all[sub.email] || [];
        all[sub.email].push(sub);
        LS.set(KEYS.subs, all);
        window.dispatchEvent(new CustomEvent('subs:change'));
        Lumiere.Analytics.track('subscription_created', { plan: sub.plan, price: sub.price });
        return sub;
      }
      return http('/subscriptions', { method:'POST', body:sub });
    },
    async update(id, patch){
      const all = seedSubs();
      for(const email in all){
        const s = all[email].find(x => x.id === id);
        if(s){ Object.assign(s, patch); LS.set(KEYS.subs, all); window.dispatchEvent(new CustomEvent('subs:change')); return s; }
      }
      if(!isDemo()) return http(`/subscriptions/${id}`, { method:'PATCH', body:patch });
    },
    async pause(id){ return this.update(id, { status:'paused' }); },
    async resume(id){ return this.update(id, { status:'active' }); },
    async cancel(id){ return this.update(id, { status:'canceled' }); },
    async skipNext(id){
      const sub = await this.get(id);
      if(!sub) return;
      const d = new Date(sub.next); d.setDate(d.getDate() + sub.cadenceDays);
      return this.update(id, { next: d.toISOString().slice(0,10) });
    },
    async changeCadence(id, cadenceDays, cadenceLabel){ return this.update(id, { cadenceDays, cadenceLabel }); },
    // MRR + analytics helpers
    async stats(){
      const all = await this.list();
      const active = all.filter(s => s.status === 'active');
      const monthly = active.reduce((sum,s) => sum + (s.price * (30 / s.cadenceDays)), 0);
      return {
        total: all.length,
        active: active.length,
        paused: all.filter(s => s.status === 'paused').length,
        canceled: all.filter(s => s.status === 'canceled').length,
        mrr: +monthly.toFixed(2),
        arr: +(monthly * 12).toFixed(2),
        thisMonthFulfillment: active.filter(s => {
          const next = new Date(s.next);
          const now = new Date();
          return next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear();
        }).length
      };
    }
  };

  /* ============================================================
     AGENTS  ·  /api/agent/{name}/run
     PROD: each call hits the Anthropic API server-side with the
     agent's system prompt + tool definitions.
     ============================================================ */
  const Agents = {
    async run(name, payload){
      if(isDemo()){
        // Stubbed: return a predictable mock so the UI works.
        return { agent:name, action:'queued', payload, time:Date.now() };
      }
      return http(`/agent/${name}/run`, { method:'POST', body: payload });
    },
    async draftReply(inquiryId){
      // Sage drafts a reply. In demo, returns canned text.
      if(isDemo()){
        return { draft: 'Thank you for reaching out — our team will follow up shortly.\n\nWith care,\nLumière' };
      }
      return http('/agent/sage/draft', { method:'POST', body:{ inquiryId } });
    },
    async scoreRefund(refundId){
      if(isDemo()) return { score: 0.18, recommendation: 'approve', rationale: 'Within Skin-Try window.' };
      return http('/agent/mercer/score', { method:'POST', body:{ refundId } });
    }
  };

  /* ============================================================
     SHIPPING / TRACKING  ·  /api/shipping/track
     ============================================================ */
  const Shipping = {
    async track(trackingNumber){
      if(isDemo()){
        return { status:'In Transit', updates:[{ time:new Date().toISOString(), event:'Departed facility' }] };
      }
      return http('/shipping/track?tn=' + encodeURIComponent(trackingNumber));
    },
    rateForCart(country){
      if(country === 'US') return Cart.subtotal() >= CFG.shipping.freeShippingThreshold ? 0 : 8;
      const intl = { CA:12, GB:18, FR:22, DE:22, AU:28, JP:25 };
      return intl[country] || 32;
    }
  };

  /* ============================================================
     AMBASSADORS  ·  /api/ambassadors
     Affiliate/Brand-Ambassador program: per-channel trackable
     codes (Instagram / TikTok / Facebook), attributed sales,
     payment methods (PayPal / Zelle / ACH), monthly payouts.
     ============================================================ */
  const AMB_KEY = 'lumiere_ambassadors';

  function seedAmbassadors(){
    let all = LS.get(AMB_KEY, null);
    if(all !== null) return all;
    all = {
      'maya@travelmaya.com': {
        email:'maya@travelmaya.com', name:'Maya Chen', password: btoa(unescape(encodeURIComponent('lum:lumiere'))),
        status:'active', tier:'gold', commissionPct:20, joinedAt:'2025-06-12',
        channels:{
          instagram:{ handle:'@travelmaya', code:'MAYA-IG', clicks:4211, orders:214, sales:18922.00 },
          tiktok:{ handle:'@travelmaya', code:'MAYA-TT', clicks:9860, orders:312, sales:26410.00 },
          facebook:{ handle:'Maya Chen Travels', code:'MAYA-FB', clicks:820, orders:31, sales:2688.00 }
        },
        payment:{ method:'paypal', paypalEmail:'maya@travelmaya.com', zellePhone:'', achRouting:'', achAccount:'', achName:'' },
        payouts:[
          { id:'PAY-0612', month:'April 2026', amount:1848.40, status:'paid', date:'2026-05-01', method:'PayPal' },
          { id:'PAY-0537', month:'March 2026', amount:1621.10, status:'paid', date:'2026-04-01', method:'PayPal' },
          { id:'PAY-0461', month:'February 2026', amount:1390.75, status:'paid', date:'2026-03-01', method:'PayPal' }
        ],
        pendingEarnings: 942.66
      },
      'jess@jessontheroad.co': {
        email:'jess@jessontheroad.co', name:'Jess Torres', password: btoa(unescape(encodeURIComponent('lum:lumiere'))),
        status:'active', tier:'silver', commissionPct:18, joinedAt:'2025-11-02',
        channels:{
          instagram:{ handle:'@jessontheroad', code:'JESS-IG', clicks:1830, orders:84, sales:7214.00 },
          tiktok:{ handle:'@jessontheroad', code:'JESS-TT', clicks:3111, orders:96, sales:8102.00 },
          facebook:{ handle:'', code:'JESS-FB', clicks:0, orders:0, sales:0 }
        },
        payment:{ method:'zelle', paypalEmail:'', zellePhone:'+1 (415) 555-0182', achRouting:'', achAccount:'', achName:'' },
        payouts:[
          { id:'PAY-0613', month:'April 2026', amount:588.20, status:'paid', date:'2026-05-01', method:'Zelle' }
        ],
        pendingEarnings: 412.19
      }
    };
    LS.set(AMB_KEY, all);
    return all;
  }

  const Ambassadors = {
    _all(){ return seedAmbassadors(); },
    _save(all){ LS.set(AMB_KEY, all); window.dispatchEvent(new CustomEvent('ambassadors:change')); },
    hash(p){ return btoa(unescape(encodeURIComponent('lum:' + p))); },

    async list(){ return Object.values(this._all()); },
    async get(email){ return this._all()[email.toLowerCase()] || null; },

    async register({ name, email, password, channels }){
      const all = this._all();
      email = email.toLowerCase();
      if(all[email]) throw new Error('An ambassador account already exists with this email.');
      const slug = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g,'').slice(0,8) || 'AMB';
      const uniq = Object.keys(all).length + 1;
      const mk = (suffix) => `${slug}${uniq}-${suffix}`;
      all[email] = {
        email, name, password: this.hash(password),
        status:'pending',            // admin approves → active
        tier:'bronze', commissionPct:15, joinedAt: new Date().toISOString().slice(0,10),
        channels:{
          instagram:{ handle: channels?.instagram || '', code: mk('IG'), clicks:0, orders:0, sales:0 },
          tiktok:{    handle: channels?.tiktok    || '', code: mk('TT'), clicks:0, orders:0, sales:0 },
          facebook:{  handle: channels?.facebook  || '', code: mk('FB'), clicks:0, orders:0, sales:0 }
        },
        payment:{ method:'', paypalEmail:'', zellePhone:'', achRouting:'', achAccount:'', achName:'' },
        payouts:[], pendingEarnings:0
      };
      this._save(all);
      Lumiere.Analytics.track('ambassador_signup', { channels: Object.keys(channels||{}) });
      return all[email];
    },

    async login(email, password){
      const amb = await this.get(email);
      if(!amb) throw new Error('No ambassador account found with that email.');
      if(amb.password !== this.hash(password)) throw new Error('Incorrect password.');
      if(amb.status === 'pending') throw new Error('Your application is still under review. You\'ll get an email when approved.');
      if(amb.status === 'suspended') throw new Error('This account is suspended. Contact partners@lumiereskincarecaps.com.');
      sessionStorage.setItem('lumiere_amb_session', email.toLowerCase());
      return amb;
    },
    session(){ return sessionStorage.getItem('lumiere_amb_session'); },
    logout(){ sessionStorage.removeItem('lumiere_amb_session'); },

    async updatePayment(email, payment){
      const all = this._all();
      const amb = all[email.toLowerCase()];
      if(!amb) throw new Error('Not found');
      amb.payment = { ...amb.payment, ...payment };
      this._save(all);
      return amb;
    },

    async updateChannelHandle(email, channel, handle){
      const all = this._all();
      const amb = all[email.toLowerCase()];
      if(amb && amb.channels[channel]){ amb.channels[channel].handle = handle; this._save(all); }
      return amb;
    },

    async setStatus(email, status){
      const all = this._all();
      const amb = all[email.toLowerCase()];
      if(amb){ amb.status = status; this._save(all); }
      return amb;
    },

    /* Attribution: called at checkout when a code is applied */
    async attributeOrder(code, orderTotal){
      const all = this._all();
      for(const email in all){
        const amb = all[email];
        for(const ch of ['instagram','tiktok','facebook']){
          if(amb.channels[ch].code.toLowerCase() === code.toLowerCase()){
            amb.channels[ch].orders += 1;
            amb.channels[ch].sales += orderTotal;
            amb.pendingEarnings = +(amb.pendingEarnings + orderTotal * amb.commissionPct/100).toFixed(2);
            this._save(all);
            Lumiere.Analytics.track('ambassador_attributed_sale', { code, channel: ch, value: orderTotal });
            return { ambassador: amb.name, channel: ch, discountPct: 10 };
          }
        }
      }
      return null;
    },

    async lookupCode(code){
      const all = this._all();
      for(const email in all){
        for(const ch of ['instagram','tiktok','facebook']){
          if(all[email].channels[ch].code.toLowerCase() === (code||'').toLowerCase()){
            return { ambassador: all[email].name, email, channel: ch, status: all[email].status };
          }
        }
      }
      return null;
    },

    /* Monthly payout run (admin triggers; production = cron on 1st of month) */
    async runMonthlyPayouts(){
      const all = this._all();
      const month = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
      const results = [];
      for(const email in all){
        const amb = all[email];
        if(amb.status !== 'active' || amb.pendingEarnings < 25) continue; // $25 minimum
        const methodLabel = amb.payment.method === 'paypal' ? 'PayPal' : amb.payment.method === 'zelle' ? 'Zelle' : amb.payment.method === 'ach' ? 'ACH' : null;
        if(!methodLabel) continue; // no payment method on file
        const payout = {
          id: 'PAY-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.floor(Math.random()*90+10),
          month, amount: amb.pendingEarnings, status:'paid',
          date: new Date().toISOString().slice(0,10), method: methodLabel
        };
        amb.payouts.unshift(payout);
        amb.pendingEarnings = 0;
        results.push({ name: amb.name, ...payout });
      }
      this._save(all);
      return results;
    },

    async stats(){
      const list = await this.list();
      const active = list.filter(a => a.status === 'active');
      const totals = { clicks:0, orders:0, sales:0, pendingPayouts:0 };
      const byChannel = { instagram:{orders:0,sales:0}, tiktok:{orders:0,sales:0}, facebook:{orders:0,sales:0} };
      active.forEach(a => {
        totals.pendingPayouts += a.pendingEarnings;
        for(const ch of ['instagram','tiktok','facebook']){
          totals.clicks += a.channels[ch].clicks;
          totals.orders += a.channels[ch].orders;
          totals.sales  += a.channels[ch].sales;
          byChannel[ch].orders += a.channels[ch].orders;
          byChannel[ch].sales  += a.channels[ch].sales;
        }
      });
      return { total:list.length, active:active.length, pending:list.filter(a=>a.status==='pending').length, totals, byChannel };
    }
  };

  /* ============================================================
     EXPORT
     ============================================================ */
  window.Lumiere = window.Lumiere || {};
  Object.assign(window.Lumiere, {
    Cart, startCheckout, Orders, Inquiries, Refunds, Newsletter, Subscriptions, Agents, Shipping, Ambassadors,
    isDemo
  });
})();
