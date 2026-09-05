(() => {
  const status=document.getElementById("unsubscribeStatus"),button=document.getElementById("unsubscribeButton");
  const token=new URLSearchParams(location.search).get("token")||"";
  if(!/^[0-9a-f-]{36}$/i.test(token)){button.disabled=true;status.textContent="This unsubscribe link is invalid or incomplete.";return;}
  const cfg=window.SHIZUKU_SUPABASE||{};
  if(!window.supabase||!cfg.url||!cfg.anonKey){button.disabled=true;status.textContent="Email preferences are temporarily unavailable.";return;}
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  button.addEventListener("click",async()=>{button.disabled=true;button.textContent="Updating…";const{data,error}=await db.rpc("unsubscribe_shizuku_email",{p_token:token});if(error||!data?.ok){status.textContent="We could not update this preference. Please contact Shizuku Lab.";button.disabled=false;button.textContent="Try again";return;}button.textContent="Unsubscribed";status.innerHTML="Your email is now marked <b>Unsubscribed</b>. Shizuku Lab has been notified.";});
})();
