/* ============================================================
   LUMIÈRE · ANALYTICS
   ------------------------------------------------------------
   Wraps GA4, Meta Pixel, PostHog, etc. Page views fire on load,
   custom events fire from anywhere via Lumiere.Analytics.track().
   ============================================================ */

(function(){
  const CFG = window.LUMIERE_CONFIG;
  if(!CFG){ return; }
  const A = CFG.analytics;
  const events = []; // local audit trail

  function loadGA4(){
    if(!A.ga4MeasurementId || A.ga4MeasurementId.startsWith('G-XXXX')) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${A.ga4MeasurementId}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', A.ga4MeasurementId, { send_page_view: true });
  }

  function loadGTM(){
    if(!A.gtmId) return;
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
      j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',A.gtmId);
  }

  function loadMetaPixel(){
    if(!A.metaPixelId) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', A.metaPixelId);
    fbq('track', 'PageView');
  }

  function track(eventName, params = {}){
    events.push({ eventName, params, time: Date.now() });
    if(window.gtag) gtag('event', eventName, params);
    if(window.fbq) fbq('trackCustom', eventName, params);
    if(CFG.env === 'demo') console.log('[Analytics]', eventName, params);
  }

  function pageView(){
    if(window.gtag) gtag('event', 'page_view', { page_path: location.pathname });
    if(window.fbq) fbq('track', 'PageView');
  }

  // INIT
  if(A.enabled){
    loadGA4(); loadGTM(); loadMetaPixel();
  }

  window.Lumiere = window.Lumiere || {};
  window.Lumiere.Analytics = { track, pageView, history: () => events.slice() };

  // Auto fire page view after DOMContentLoaded
  if(document.readyState !== 'loading') pageView();
  else document.addEventListener('DOMContentLoaded', pageView);
})();
