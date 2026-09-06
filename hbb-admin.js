(() => {
  'use strict';
  const cfg=window.SHIZUKU_SUPABASE||{};
  const client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const app=document.getElementById('app'), message=document.getElementById('message');
  const workspaceId=new URLSearchParams(location.search).get('workspace');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let workspace, settings, section='settings', busy=false;
  const notice=text=>{message.textContent=text;};
  const field=(name,label,value='',type='text')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}></label>`;
  const config=()=>settings.settings||{};
  async function start(){
    const {data,error}=await client.auth.getUser();
    if(error||!data.user)return login();
    document.getElementById('account').innerHTML=`${esc(data.user.email)} <button id="logout">Sign out</button>`;
    document.getElementById('logout').onclick=async()=>{await client.auth.signOut();location.reload();};
    const accepted=await client.rpc('accept_slow_studio_hbb_invitation');
    if(accepted.error) {login();return notice('Please sign in again with your email and password to verify this session.');}
    // RLS, not the URL, decides which workspace the current user can access.
    if(!workspaceId){
      const result=await client.from('slow_studio_workspaces').select('id,name,country_code').order('name');
      if(result.error)return notice(result.error.message);
      app.innerHTML=`<section><h2>Your workspaces</h2>${(result.data||[]).map(w=>`<p><a href="/hbb-admin.html?workspace=${encodeURIComponent(w.id)}">${esc(w.name)} · ${esc(w.country_code)}</a></p>`).join('')||'<p>No active workspace invitation. Contact Slow Studio.</p>'}</section>`;
      return;
    }
    const result=await client.from('slow_studio_workspaces').select('id,name,country_code,currency_code,status,owner_notification_email').eq('id',workspaceId).maybeSingle();
    if(result.error||!result.data){app.textContent='Workspace not available for this login.';return;}
    workspace=result.data;
    const store=await client.from('slow_studio_store_settings').select('*').eq('workspace_id',workspaceId).single();
    if(store.error)return notice(store.error.message);
    settings=store.data;
    await render();
  }
  function login(){
    app.innerHTML=`<section class="login"><h2>HBB sign in</h2><p>Use your invited email and your own password.</p><form id="login">${field('email','Email','','email')}${field('password','Password','','password')}<button>Sign in</button></form></section>`;
    app.querySelector('[name=email]').autocomplete='username';app.querySelector('[name=password]').autocomplete='current-password';
    document.getElementById('login').onsubmit=async e=>{
      e.preventDefault();if(busy)return;busy=true;
      const button=e.target.querySelector('button');button.disabled=true;
      const email=e.target.elements.email.value, password=e.target.elements.password.value;
      const {error}=await client.auth.signInWithPassword({email,password});
      e.target.elements.password.value='';busy=false;button.disabled=false;
      if(error)return notice('Sign-in failed. Check your email and password.');
      notice('');await start();
    };
  }
  async function render(){
    app.innerHTML=`<h2>${esc(workspace.name)} · ${esc(workspace.currency_code)}</h2><p class="notice">Setup mode. This workspace is not yet ready to accept live customer orders. Products, inventory and collection settings below are saved to this workspace only. Full storefront and notification delivery are still being connected.</p><nav>${['settings','products','inventory','orders'].map(key=>`<button data-section="${key}">${key[0].toUpperCase()+key.slice(1)}</button>`).join('')}</nav><section id="content"></section>`;
    app.querySelectorAll('[data-section]').forEach(button=>button.onclick=()=>{section=button.dataset.section;notice('');render();});
    const content=document.getElementById('content');
    if(section==='settings'){
      const s=config(),my=workspace.country_code==='MY';
      content.innerHTML=`<h2>Collection & payment setup</h2><p class="muted">${my?'+60 · Touch ’n Go / bank transfer':'+65 · PayNow'}. Fill in your own details; no Shizuku payment details have been copied.</p><form id="settingsForm">${field('store_name','Store name',settings.store_name)}<label>Collection address<textarea name="collection_address">${esc(s.collection_address)}</textarea></label>${field('collection_hours','Collection dates / timings',s.collection_hours)}${field('payment_name','Show recipient name to customers',s.payment_name)}${field('payment_phone',my?'Touch ’n Go phone number':'PayNow phone number',s.payment_phone)}${my?field('bank_name','Bank name',s.bank_name)+field('bank_account','Bank account number',s.bank_account):''}<p>Owner notification recipient: ${esc(workspace.owner_notification_email)}</p><p>Customer emails: ${s.customer_email_enabled===false?'Off':'Not verified'}. Sending is not activated by saving this form.</p><button>Save settings</button></form>`;
      document.getElementById('settingsForm').onsubmit=async e=>{
        e.preventDefault();const fields=new FormData(e.target);
        const next={...s};for(const key of ['collection_address','collection_hours','payment_name','payment_phone','bank_name','bank_account'])if(fields.has(key))next[key]=String(fields.get(key)).trim();
        await save(e.target,()=>client.from('slow_studio_store_settings').update({store_name:String(fields.get('store_name')).trim(),settings:next,updated_at:new Date().toISOString()}).eq('workspace_id',workspaceId).select('workspace_id'),async()=>{settings.settings=next;settings.store_name=String(fields.get('store_name')).trim();});
      };
      return;
    }
    const table={products:'slow_studio_products',inventory:'slow_studio_inventory',orders:'slow_studio_orders'}[section];
    const fields=section==='orders'?'id,order_number,customer_name,status,payment_status,total':section==='products'?'id,name,price,stock':'id,name,quantity,unit,unit_cost';
    const result=await client.from(table).select(fields).eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(100);
    if(result.error){content.textContent='This section is unavailable for your role.';return notice(result.error.message);}
    const rows=result.data||[];
    if(section==='orders'){
      content.innerHTML=`<h2>Orders</h2><p>Read-only order inspection during setup.</p><div class="table"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total (${esc(workspace.currency_code)})</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.order_number)}</td><td>${esc(row.customer_name)}</td><td>${esc(row.status)} / ${esc(row.payment_status)}</td><td>${esc(row.total)}</td></tr>`).join('')||'<tr><td colspan="4">No orders yet.</td></tr>'}</tbody></table></div>`;return;
    }
    const product=section==='products';
    content.innerHTML=`<h2>${product?'Products':'Inventory'}</h2><form id="itemForm"><input type="hidden" name="id"><div class="grid">${field('name','Name')}${product?field('price',`Price (${workspace.currency_code})`,0,'number')+field('stock','Stock',0,'number'):field('quantity','Quantity',0,'number')+field('unit','Unit (e.g. ml, g, pcs)')+field('unit_cost',`Cost per unit (${workspace.currency_code})`,0,'number')}</div><button>Save item</button> <button type="reset">New item</button></form><div class="table"><table><tbody>${rows.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(product?row.price:row.unit_cost)} ${esc(workspace.currency_code)}</td><td>${esc(product?row.stock:row.quantity)} ${product?'':esc(row.unit)}</td><td><button data-edit="${esc(row.id)}">Edit</button></td></tr>`).join('')||'<tr><td>No items yet.</td></tr>'}</tbody></table></div>`;
    const form=document.getElementById('itemForm');form.elements.name.required=true;
    content.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{const row=rows.find(r=>r.id===button.dataset.edit);for(const [key,value]of Object.entries(row))if(form.elements[key])form.elements[key].value=value??'';form.scrollIntoView({behavior:'smooth'});});
    form.onsubmit=async e=>{
      e.preventDefault();const fields=new FormData(form),id=String(fields.get('id')||'');
      const record={name:String(fields.get('name')).trim(),updated_at:new Date().toISOString()};
      for(const key of (product?['price','stock']:['quantity','unit_cost'])){const n=Number(fields.get(key));if(!Number.isFinite(n)||n<0)return notice('Enter a valid non-negative number.');record[key]=n;}
      if(!product)record.unit=String(fields.get('unit')).trim();
      await save(form,()=>id?client.from(table).update(record).eq('workspace_id',workspaceId).eq('id',id).select('id'):client.from(table).insert({...record,workspace_id:workspaceId}).select('id'),render);
    };
  }
  async function save(form,operation,after){
    if(busy)return;busy=true;const button=form.querySelector('button');button.disabled=true;
    try{const {error,data}=await operation();if(error)throw error;if(!data?.length)throw new Error('No record saved. Check workspace permissions.');await after();notice('Saved.');}
    catch(error){notice(error.message||'Could not save.');}finally{busy=false;button.disabled=false;}
  }
  start().catch(()=>{app.textContent='Unable to open this workspace. Please reload.';});
})();
