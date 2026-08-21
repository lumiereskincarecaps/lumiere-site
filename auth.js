/* =========================================================
   LUMIÈRE · AUTH LAYER
   One interface, two backends:

   • provider 'supabase' → real server-side accounts. Passwords are
     hashed and stored by Supabase (bcrypt), sessions are JWTs with
     refresh tokens, email verification and password resets work.

   • provider 'demo'     → browser-only accounts (PBKDF2-hashed in
     localStorage). Fine for previewing; not for real customers.

   Switch by setting auth.provider + supabaseUrl + supabaseAnonKey
   in config.js. No other code needs to change.
   ========================================================= */
(function(){
  const cfg = (window.LumiereConfig && window.LumiereConfig.auth) || {};
  const useSupabase = cfg.provider === 'supabase' && cfg.supabaseUrl && cfg.supabaseAnonKey;

  let sb = null;
  async function client(){
    if(!useSupabase) return null;
    if(sb) return sb;
    if(!window.supabase){
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('Could not load Supabase'));
        document.head.appendChild(s);
      });
    }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return sb;
  }

  const Auth = {
    provider: useSupabase ? 'supabase' : 'demo',
    isServerSide: useSupabase,

    /* Create an account. Supabase sends a verification email automatically. */
    async signUp(email, password, name){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { data, error } = await c.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: location.origin + '/portal.html' }
      });
      if(error) return { ok:false, error:error.message };
      return { ok:true, user:data.user, needsVerification: !data.session };
    },

    /* Sign in. `remember` controls whether the session survives a browser restart. */
    async signIn(email, password, remember){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if(error){
        const msg = /invalid login/i.test(error.message)
          ? 'Incorrect email or password.'
          : /not confirmed/i.test(error.message)
          ? 'Please confirm your email first — check your inbox for the link.'
          : error.message;
        return { ok:false, error:msg };
      }
      if(!remember){
        // Move the session to sessionStorage so it ends when the browser closes
        try {
          Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => {
            sessionStorage.setItem(k, localStorage.getItem(k));
            localStorage.removeItem(k);
          });
        } catch(e){}
      }
      return { ok:true, user:data.user, session:data.session };
    },

    async signOut(){
      if(!useSupabase) return { ok:true, local:true };
      const c = await client();
      await c.auth.signOut();
      return { ok:true };
    },

    /* Current signed-in user, or null */
    async currentUser(){
      if(!useSupabase) return null;
      const c = await client();
      const { data } = await c.auth.getUser();
      if(!data || !data.user) return null;
      const u = data.user;
      return {
        email: u.email,
        name: (u.user_metadata && u.user_metadata.full_name) || u.email.split('@')[0],
        phone: (u.user_metadata && u.user_metadata.phone) || '',
        address: (u.user_metadata && u.user_metadata.address) || '',
        addressParts: (u.user_metadata && u.user_metadata.addressParts) || {},
        createdAt: (u.created_at || '').slice(0,10),
        verified: !!u.email_confirmed_at
      };
    },

    /* Update profile fields the customer edits themselves */
    async updateProfile(patch){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { error } = await c.auth.updateUser({ data: patch });
      return error ? { ok:false, error:error.message } : { ok:true };
    },

    async changePassword(newPassword){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { error } = await c.auth.updateUser({ password: newPassword });
      return error ? { ok:false, error:error.message } : { ok:true };
    },

    /* Real password reset — Supabase emails a secure link */
    async resetPassword(email){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { error } = await c.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + '/portal.html?reset=1'
      });
      return error ? { ok:false, error:error.message } : { ok:true };
    },

    async resendVerification(email){
      if(!useSupabase) return { ok:false, local:true };
      const c = await client();
      const { error } = await c.auth.resend({ type:'signup', email });
      return error ? { ok:false, error:error.message } : { ok:true };
    }
  };

  window.LumiereAuth = Auth;
})();
