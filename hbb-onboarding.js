(() => {
  const arrivedFromInvite=location.hash.includes("type=invite")||location.hash.includes("type=recovery");
  const cfg=window.SHIZUKU_SUPABASE||{};
  const client=window.supabase?.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const app=document.getElementById("onboardingApp");
  const state={step:"loading",message:"",password:"",confirm:"",factorId:"",challengeId:"",qr:"",secret:"",code:"",workspaces:[]};
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(){
    if(state.step==="password") app.innerHTML=`<div class="eyebrow">Owner invitation</div><h1>Create your password</h1><p>Use at least 10 characters. Slow Studio never stores or displays the password; Supabase Auth stores only its protected hash.</p><label class="field"><span>New password</span><input type="password" autocomplete="new-password" oninput="HbbSetup.field('password',this.value)"></label><label class="field"><span>Confirm password</span><input type="password" autocomplete="new-password" oninput="HbbSetup.field('confirm',this.value)"></label>${notice()}<button class="btn" onclick="HbbSetup.savePassword()">Save password and continue</button>`;
    else if(state.step==="mfa") app.innerHTML=`<div class="eyebrow">Second security layer</div><h1>Set up Authenticator</h1><p>Scan with Google Authenticator, Microsoft Authenticator or 1Password. Every Owner and Admin must complete this step.</p>${state.qr?`<img class="qr" src="${esc(state.qr)}" alt="Authenticator setup QR">`:""}${state.secret?`<div class="notice">Manual setup code:<br><b>${esc(state.secret)}</b></div>`:""}<label class="field"><span>6-digit code</span><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" oninput="HbbSetup.field('code',this.value.replace(/[^0-9]/g,'').slice(0,6))"></label>${notice()}<button class="btn" onclick="HbbSetup.verifyMfa()">Verify and activate workspace</button>`;
    else if(state.step==="ready") app.innerHTML=`<div class="eyebrow">Account protected</div><h1>Your workspace is ready</h1><p>Your login is linked only to the HBB workspace listed below. Another HBB cannot read its orders, customers, messages, inventory or files.</p>${state.workspaces.map(w=>`<div class="notice"><b>${esc(w.name)}</b><br>${esc(w.country_code)} · ${esc(w.currency_code)}</div>`).join("")}<button class="btn secondary" onclick="HbbSetup.signOut()">Sign out</button>`;
    else app.innerHTML=`<div class="eyebrow">Secure setup</div><h1>${state.step==="error"?"Setup needs attention":"Checking invitation…"}</h1>${notice()}${state.step==="error"?`<button class="btn secondary" onclick="location.reload()">Try again</button>`:""}`;
  }
  function notice(){return state.message?`<div class="notice ${state.step==="error"?"error":""}">${esc(state.message)}</div>`:""}
  async function start(){
    if(!client){state.step="error";state.message="The secure account service is unavailable.";return render()}
    const {data}=await client.auth.getUser();
    if(!data?.user){state.step="error";state.message="Open the newest Slow Studio invitation link from your email.";return render()}
    const {data:aal}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal?.currentLevel==="aal2") return acceptInvite();
    if(arrivedFromInvite){state.step="password";state.message="";return render()}
    return prepareMfa();
  }
  function field(key,value){state[key]=value}
  async function savePassword(){
    if(state.password.length<10){state.message="Use at least 10 characters.";return render()}
    if(state.password!==state.confirm){state.message="The passwords do not match.";return render()}
    const {error}=await client.auth.updateUser({password:state.password});
    if(error){state.message=error.message;return render()}
    state.password=state.confirm=""; await prepareMfa();
  }
  async function prepareMfa(){
    const {data:factors}=await client.auth.mfa.listFactors();
    const verified=(factors?.totp||[]).find(f=>f.status==="verified");
    if(verified){const {data:challenge,error}=await client.auth.mfa.challenge({factorId:verified.id});if(error)return fail(error.message);state.factorId=verified.id;state.challengeId=challenge.id;state.step="mfa";state.message="Enter the current code from your Authenticator app.";return render()}
    const {data:enrol,error}=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Slow Studio HBB Owner"});if(error)return fail(error.message);
    const {data:challenge,error:challengeError}=await client.auth.mfa.challenge({factorId:enrol.id});if(challengeError)return fail(challengeError.message);
    Object.assign(state,{factorId:enrol.id,challengeId:challenge.id,qr:enrol.totp?.qr_code||"",secret:enrol.totp?.secret||"",step:"mfa",message:"Enter the code after scanning."});render();
  }
  async function verifyMfa(){
    if(!/^\d{6}$/.test(state.code)) {state.message="Enter the 6-digit code.";return render()}
    const {error}=await client.auth.mfa.verify({factorId:state.factorId,challengeId:state.challengeId,code:state.code});if(error){state.message="That code was not accepted. Check the time on your phone and try again.";return render()}
    await acceptInvite();
  }
  async function acceptInvite(){
    state.step="loading";state.message="Activating your private workspace…";render();
    const {error}=await client.rpc("accept_slow_studio_hbb_invitation");if(error)return fail(error.message);
    const {data,error:listError}=await client.from("slow_studio_workspaces").select("id,name,country_code,currency_code,status").order("created_at");if(listError)return fail(listError.message);
    state.workspaces=data||[];state.step="ready";state.message="";render();
  }
  function fail(message){state.step="error";state.message=message||"Could not complete setup.";render()}
  async function signOut(){await client.auth.signOut();location.href="/"}
  window.HbbSetup={field,savePassword,verifyMfa,signOut};render();start();
})();
