(() => {
  const arrivedFromInvite=location.hash.includes("type=invite")||location.hash.includes("type=recovery");
  const cfg=window.SHIZUKU_SUPABASE||{};
  const client=window.supabase?.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const app=document.getElementById("onboardingApp");
  const state={step:"loading",message:"",password:"",confirm:"",email:"",code:"",workspaces:[]};
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(){
    if(state.step==="password") app.innerHTML=`<div class="eyebrow">Owner invitation</div><h1>Create your password</h1><p>Use at least 10 characters. Slow Studio never stores or displays the password; Supabase Auth stores only its protected hash.</p><label class="field"><span>New password</span><input type="password" autocomplete="new-password" oninput="HbbSetup.field('password',this.value)"></label><label class="field"><span>Confirm password</span><input type="password" autocomplete="new-password" oninput="HbbSetup.field('confirm',this.value)"></label>${notice()}<button class="btn" onclick="HbbSetup.savePassword()">Save password and email my code</button>`;
    else if(state.step==="email_code") app.innerHTML=`<div class="eyebrow">Secure email verification</div><h1>Enter your 6-digit code</h1><p>We sent a one-time login code to <b>${esc(state.email)}</b>. Return to this page and enter it below.</p><label class="field"><span>Email code</span><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(state.code)}" oninput="HbbSetup.field('code',this.value.replace(/[^0-9]/g,'').slice(0,6))"></label>${notice()}<button class="btn" onclick="HbbSetup.verifyEmailCode()">Verify and activate workspace</button><button class="btn secondary" style="margin-top:10px" onclick="HbbSetup.sendEmailCode()">Send a new code</button>`;
    else if(state.step==="ready") app.innerHTML=`<div class="eyebrow">Account protected</div><h1>Your workspace is ready</h1><p>Your login is linked only to the HBB workspace listed below. Another HBB cannot read its orders, customers, messages, inventory or files.</p>${state.workspaces.map(w=>`<div class="notice"><b>${esc(w.name)}</b><br>${esc(w.country_code)} · ${esc(w.currency_code)}</div>`).join("")}<button class="btn secondary" onclick="HbbSetup.signOut()">Sign out</button>`;
    else app.innerHTML=`<div class="eyebrow">Secure setup</div><h1>${state.step==="error"?"Setup needs attention":"Checking invitation…"}</h1>${notice()}${state.step==="error"?`<button class="btn secondary" onclick="location.reload()">Try again</button>`:""}`;
  }
  function notice(){return state.message?`<div class="notice ${state.step==="error"?"error":""}">${esc(state.message)}</div>`:""}
  function jwtUsesEmailOtp(session){
    try { const encoded=(session?.access_token?.split(".")[1]||"").replace(/-/g,"+").replace(/_/g,"/"); const claims=JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,"="))); return claims.aal==="aal2"||(Array.isArray(claims.amr)&&claims.amr.some(item=>item?.method==="otp")); } catch(_){ return false; }
  }
  async function start(){
    if(!client){state.step="error";state.message="The secure account service is unavailable.";return render()}
    const {data}=await client.auth.getUser();
    if(!data?.user){state.step="error";state.message="Open the newest Slow Studio invitation link from your email.";return render()}
    state.email=String(data.user.email||"").toLowerCase();
    const {data:sessionData}=await client.auth.getSession();
    if(jwtUsesEmailOtp(sessionData?.session)) return acceptInvite();
    if(arrivedFromInvite){state.step="password";state.message="";return render()}
    return sendEmailCode();
  }
  function field(key,value){state[key]=value}
  async function savePassword(){
    if(state.password.length<10){state.message="Use at least 10 characters.";return render()}
    if(state.password!==state.confirm){state.message="The passwords do not match.";return render()}
    const {error}=await client.auth.updateUser({password:state.password});
    if(error){state.message=error.message;return render()}
    state.password=state.confirm=""; await sendEmailCode();
  }
  async function sendEmailCode(){
    if(!state.email){const {data}=await client.auth.getUser();state.email=String(data?.user?.email||"").toLowerCase()}
    if(!state.email)return fail("The invitation email could not be read. Open the newest invitation link again.");
    state.step="email_code";state.code="";state.message="Sending your code…";render();
    const {error}=await client.auth.signInWithOtp({email:state.email,options:{shouldCreateUser:false}});
    state.message=error?`We could not send the code: ${error.message}`:"Code sent. Check Inbox and Spam.";render();
  }
  async function verifyEmailCode(){
    const token=String(state.code||"").replace(/\D/g,"").slice(0,6);
    if(!/^\d{6}$/.test(token)){state.message="Enter the complete 6-digit code.";return render()}
    state.message="Checking your code…";render();
    const {error}=await client.auth.verifyOtp({email:state.email,token,type:"email"});
    if(error){state.message="That code is incorrect or has expired. Send a new code and try again.";return render()}
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
  window.HbbSetup={field,savePassword,sendEmailCode,verifyEmailCode,signOut};render();start();
})();
