/* =========================================================
   LUMIÈRE · SMART FIELD MEMORY
   Remembers what you typed in text fields and offers it back
   next time — like a browser autofill that also works for the
   admin panel's custom inputs.

   Never remembers: passwords, card numbers, CVCs, or any field
   marked data-no-remember. Everything stays in this browser.
   ========================================================= */
(function(){
  const KEY = 'lumiere_field_memory';
  const MAX_PER_FIELD = 6;      // how many past values to keep
  const MIN_LENGTH = 2;

  const SENSITIVE = /pass|pwd|card|cvc|cvv|secur|token|secret|key$|api|ssn|routing|account.?number/i;

  function isSensitive(el){
    if(el.type === 'password') return true;
    if(el.dataset.noRemember !== undefined) return true;
    const hay = [el.id, el.name, el.getAttribute('autocomplete')||'', el.placeholder||''].join(' ');
    return SENSITIVE.test(hay);
  }
  function fieldKey(el){
    const page = location.pathname.split('/').pop() || 'index.html';
    const id = el.id || el.name || (el.placeholder||'').slice(0,24) || el.type;
    return page + '::' + id;
  }
  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  function save(m){ try { localStorage.setItem(KEY, JSON.stringify(m)); } catch(e){} }

  function remember(el){
    if(isSensitive(el)) return;
    const v = (el.value||'').trim();
    if(v.length < MIN_LENGTH) return;
    const mem = load();
    const k = fieldKey(el);
    const list = (mem[k] || []).filter(x => x !== v);
    list.unshift(v);
    mem[k] = list.slice(0, MAX_PER_FIELD);
    save(mem);
  }

  /* Native datalist gives us a proper dropdown of past entries,
     styled by the browser and keyboard-accessible. */
  function attachSuggestions(el){
    if(isSensitive(el)) return;
    const mem = load()[fieldKey(el)];
    if(!mem || !mem.length) return;
    let listId = el.dataset.memList;
    if(!listId){
      listId = 'mem-' + Math.random().toString(36).slice(2,9);
      el.dataset.memList = listId;
      const dl = document.createElement('datalist');
      dl.id = listId;
      el.parentNode.insertBefore(dl, el.nextSibling);
      el.setAttribute('list', listId);
    }
    const dl = document.getElementById(listId);
    if(dl) dl.innerHTML = mem.map(v => `<option value="${v.replace(/"/g,'&quot;')}"></option>`).join('');
  }

  /* Fill the single most recent value into empty fields, so common
     things (name, email, address) are just there next time. */
  const AUTOFILL_FIELDS = /name|email|phone|address|city|state|zip|postal|country|company|handle|domain|url|owner|repo|user/i;
  function prefill(el){
    if(isSensitive(el) || el.value) return;
    const hay = [el.id, el.name, el.getAttribute('autocomplete')||''].join(' ');
    if(!AUTOFILL_FIELDS.test(hay)) return;
    const mem = load()[fieldKey(el)];
    if(mem && mem[0]){
      el.value = mem[0];
      el.dataset.autofilled = '1';
      el.addEventListener('focus', function once(){
        if(el.dataset.autofilled){ el.select(); delete el.dataset.autofilled; }
        el.removeEventListener('focus', once);
      });
    }
  }

  const SELECTOR = 'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], input:not([type]), textarea';

  function wire(root){
    (root.querySelectorAll ? root.querySelectorAll(SELECTOR) : []).forEach(el => {
      if(el.dataset.memWired) return;
      el.dataset.memWired = '1';
      attachSuggestions(el);
      prefill(el);
      el.addEventListener('change', () => remember(el));
      el.addEventListener('blur',   () => remember(el));
    });
  }

  function init(){
    wire(document);
    // Save everything on submit, including fields that never blurred
    document.addEventListener('submit', e => {
      const f = e.target;
      if(f && f.querySelectorAll) f.querySelectorAll(SELECTOR).forEach(remember);
    }, true);
    // Catch fields added later by JS (admin panels, modals, cart)
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => { if(n.nodeType === 1) wire(n); }));
    }).observe(document.body, { childList:true, subtree:true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Public helper so you can clear saved entries */
  window.LumiereFieldMemory = {
    clear(){ try { localStorage.removeItem(KEY); } catch(e){} },
    all(){ return load(); },
    forget(pageAndField){ const m = load(); delete m[pageAndField]; save(m); }
  };
})();
