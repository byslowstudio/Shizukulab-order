(function(){
  const cfg = window.SHIZUKU_SUPABASE || {};
  const configured = !!(window.supabase && cfg.url && cfg.anonKey);
  const client = configured ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  const allowedEmail = String(cfg.adminEmail || '').toLowerCase();

  async function currentUser(){
    if(!client) return null;
    const { data } = await client.auth.getUser();
    return data?.user || null;
  }
  async function signIn(email,password){
    if(!client) throw new Error('Supabase is not configured.');
    const clean = String(email||'').trim().toLowerCase();
    if(allowedEmail && clean !== allowedEmail) throw new Error('Please use the Shizuku Lab admin email.');
    const { data, error } = await client.auth.signInWithPassword({ email: clean, password });
    if(error) throw error;
    return data.user;
  }
  async function signOut(){ if(client) await client.auth.signOut(); }
  function compactForCloud(value, fallback){
    if(Array.isArray(value)) return value.map((item,i)=>compactForCloud(item,Array.isArray(fallback)?fallback[i]:undefined));
    if(value && typeof value === 'object'){
      const out={};
      Object.keys(value).forEach(key=>{out[key]=compactForCloud(value[key],fallback?.[key])});
      return out;
    }
    if(typeof value === 'string' && /^data:(image|video)\//.test(value) && typeof fallback === 'string' && !fallback.startsWith('data:')) return fallback;
    return value;
  }
  function cloudPayload(data){return compactForCloud(data,window.SHIZUKU_DATA||{});}
  async function loadDraft(){
    if(!client) return null;
    const { data, error } = await client.from('website_drafts').select('data,updated_at').eq('id','main').maybeSingle();
    if(error) throw error;
    return data || null;
  }
  async function saveDraft(data){
    if(!client) throw new Error('Supabase is not configured.');
    const user = await currentUser();
    if(!user) throw new Error('Please sign in first.');
    const payload = { id:'main', data:cloudPayload(data), updated_at:new Date().toISOString(), updated_by:user.id };
    const { error } = await client.from('website_drafts').upsert(payload,{onConflict:'id'});
    if(error) throw error;
  }
  async function publish(data){
    if(!client) throw new Error('Supabase is not configured.');
    const user = await currentUser();
    if(!user) throw new Error('Please sign in first.');
    const now = new Date().toISOString(), compact=cloudPayload(data);
    const live = await client.from('website_live').upsert({ id:'main', data:compact, updated_at:now, updated_by:user.id },{onConflict:'id'});
    if(live.error) throw live.error;
    const draft = await client.from('website_drafts').upsert({ id:'main', data:compact, updated_at:now, updated_by:user.id },{onConflict:'id'});
    if(draft.error) throw draft.error;
  }
  window.ShizukuCloud = { configured, client, allowedEmail, currentUser, signIn, signOut, loadDraft, saveDraft, publish };
})();
