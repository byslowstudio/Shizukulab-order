(function(){
  // CMS preview must always use the editor's in-memory draft, not the public live row.
  if(new URLSearchParams(location.search).get('cms') === '1') return;
  const cfg = window.SHIZUKU_SUPABASE || {};
  if(!cfg.url || !cfg.anonKey || typeof window.SHIZUKU_APPLY_DATA !== 'function') return;
  const url = `${cfg.url}/rest/v1/website_live?id=eq.main&select=data&limit=1`;
  fetch(url, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } })
    .then(r => { if(!r.ok) throw new Error(`Website content ${r.status}`); return r.json(); })
    .then(rows => { if(rows?.[0]?.data) window.SHIZUKU_APPLY_DATA(rows[0].data); })
    .catch(err => console.warn('Using packaged website content:', err.message));
})();
