(() => {
  const STORAGE_KEY = "slow-studio-owner-console-v1";
  const seed = {
    workspaces: [
      { id:"shizuku-website", name:"Shizuku Lab Website", market:"Brand website", type:"Slow Studio website workspace", visibility:"live", connected:true, customerUrl:"/", adminUrl:"/cms.html" },
      { id:"shizuku-sg", name:"Shizuku Lab", market:"Singapore · SGD", type:"Slow Studio workspace", visibility:"live", connected:true, customerUrl:"/shop/shizuku-lab-sg", adminUrl:"/workspace/shizuku-lab-sg" },
      { id:"shizuku-my", name:"Shizuku Lab Malaysia", market:"Malaysia · MYR", type:"Slow Studio workspace", visibility:"hidden", connected:true, customerUrl:"/shop/shizuku-lab-my", adminUrl:"/workspace/shizuku-lab-my" },
      { id:"hbb-demo-sg", name:"Singapore HBB Demo", market:"Singapore · SGD · local", type:"HBB trial workspace", visibility:"demo", connected:false, customerUrl:"/demo/singapore/shop", adminUrl:"/demo/singapore" },
      { id:"hbb-demo-my", name:"Malaysia HBB Demo", market:"Malaysia · MYR · local", type:"HBB trial workspace", visibility:"demo", connected:false, customerUrl:"/demo/malaysia/shop", adminUrl:"/demo/malaysia" },
    ],
    issues: [
      { id:"issue-demo-1", workspaceId:"hbb-demo-sg", severity:"low", title:"Demo product photo was not added", detail:"User opened Add product but left the image field empty.", page:"Products", status:"open", note:"Show an image reminder inside the demo.", createdAt:new Date(Date.now()-35*60000).toISOString() },
      { id:"issue-my-1", workspaceId:"shizuku-my", severity:"medium", title:"Malaysia storefront is hidden", detail:"The workspace is ready for setup but is not public yet.", page:"Storefront", status:"reviewing", note:"Complete MY prices, availability and Touch ’n Go before publishing.", createdAt:new Date(Date.now()-2*86400000).toISOString() },
    ],
    activity: [
      { text:"Owner console created for multiple HBB workspaces", at:new Date().toISOString() },
      { text:"Malaysia moved into its own Slow Studio workspace", at:new Date(Date.now()-15*60000).toISOString() },
      { text:"Country-specific HBB demos prepared", at:new Date(Date.now()-20*60000).toISOString() },
    ],
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved && Array.isArray(saved.workspaces) ? saved : clone(seed);
    } catch (_) { return clone(seed); }
  };
  const state = load();
  state.workspaces = state.workspaces.filter((item) => item.source !== "cloud" && item.id !== "hbb-demo");
  seed.workspaces.forEach((item) => {
    if (!state.workspaces.some((saved) => saved.id === item.id)) state.workspaces.push(clone(item));
  });

  const cfg = window.SHIZUKU_SUPABASE || {};
  const productionClient = window.supabase && cfg.url && cfg.anonKey
    ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } })
    : null;
  let productionSettingsId = null;
  let panel = "overview";
  let accountBusy = false;

  const save = () => {
    const localState = { ...state, workspaces:state.workspaces.filter((item) => item.source !== "cloud") };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
  };
  const workspace = (id) => state.workspaces.find((item) => item.id === id);
  const workspaceName = (id) => workspace(id)?.name || "Unknown workspace";
  const fmt = (date) => new Date(date).toLocaleString([], { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  const absoluteUrl = (path) => new URL(path, window.location.href).href;
  const hostedSlowStudioUrl = () => `${window.location.origin}/slow-studio`;

  function setPanel(next) { panel = next; render(); }
  function addActivity(text) {
    state.activity.unshift({ text, at:new Date().toISOString() });
    state.activity = state.activity.slice(0,30);
    save();
  }

  async function setVisibility(id,value) {
    const item = workspace(id);
    if (!item || item.type.includes("trial") || item.source === "cloud") return;
    const previous = item.visibility;
    item.visibility = value;
    render();
    if (!productionClient) {
      item.visibility = previous; render();
      return alert(`Hosted Slow Studio means the online page at ${hostedSlowStudioUrl()}. A file:// page is only a local preview and cannot update Supabase or a live website.`);
    }
    const { data:{ user } } = await productionClient.auth.getUser();
    if (!user) {
      item.visibility = previous; render();
      return alert("Sign in to Shizuku Admin first, then return here.");
    }
    if (productionSettingsId == null) await syncProductionVisibility();
    if (productionSettingsId == null) {
      item.visibility = previous; render();
      return alert("Could not find the store settings record.");
    }
    const field = id === "shizuku-my" ? "malaysia_website_visibility" : "website_visibility";
    const { error } = await productionClient.from("store_settings").update({ [field]:value }).eq("id",productionSettingsId);
    if (error) {
      item.visibility = previous; render();
      return alert("Could not change website status: " + error.message);
    }
    addActivity(`${item.name} website changed to ${value}`);
    render();
  }

  async function syncProductionVisibility() {
    if (!productionClient) return;
    const { data,error } = await productionClient.from("store_settings")
      .select("id,website_visibility,malaysia_website_visibility").limit(1).maybeSingle();
    if (error || !data) return;
    productionSettingsId = data.id;
    const sg = workspace("shizuku-sg"), my = workspace("shizuku-my");
    if (sg) sg.visibility = data.website_visibility || "live";
    if (my) my.visibility = data.malaysia_website_visibility || "hidden";
    save();
    render();
  }

  async function syncCloudWorkspaces() {
    if (!productionClient) return;
    const { data:{ user } } = await productionClient.auth.getUser();
    if (!user) return;
    await productionClient.rpc("accept_slow_studio_hbb_invitation");
    const { data,error } = await productionClient.from("slow_studio_workspaces")
      .select("id,slug,name,country_code,currency_code,status,logo_url,logo_visible,slow_studio_workspace_invites(id,email,role,status,created_at)")
      .order("created_at", { ascending:false });
    if (error) return;
    const cloud = (data || []).map((item) => {
      const invite = (item.slow_studio_workspace_invites || []).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      return {
        id:item.id, slug:item.slug, name:item.name,
        market:`${item.country_code === "MY" ? "Malaysia" : "Singapore"} · ${item.currency_code}`,
        countryCode:item.country_code, type:"HBB workspace",
        visibility:item.status === "live" ? "live" : "hidden", connected:true, source:"cloud",
        logoUrl:item.logo_url || "", logoVisible:item.logo_visible !== false,
        inviteEmail:invite?.email || "", inviteRole:invite?.role || "owner", inviteStatus:invite?.status || "accepted",
      };
    });
    state.workspaces = [...state.workspaces.filter((item) => item.source !== "cloud"), ...cloud];
    render();
  }

  function openAccountDialog() { document.getElementById("hbbAccountDialog")?.showModal(); }
  function closeAccountDialog() { document.getElementById("hbbAccountDialog")?.close(); }

  async function createHbbAccount(event) {
    event.preventDefault();
    if (accountBusy) return;
    if (!productionClient) return alert(`Hosted Slow Studio means the online page at ${hostedSlowStudioUrl()}. Open that online page before adding a real HBB account; a file:// preview cannot connect to Supabase.`);
    const { data:{ user } } = await productionClient.auth.getUser();
    if (!user) return alert("Sign in to Shizuku Admin first, then return to Slow Studio.");
    const form = event.currentTarget;
    const fields = new FormData(form);
    accountBusy = true;
    const submit = form.querySelector("button[type=submit]");
    if (submit) { submit.disabled = true; submit.textContent = "Creating…"; }
    const { error } = await productionClient.rpc("create_slow_studio_hbb_account", {
      p_name:String(fields.get("business_name") || "").trim(),
      p_country_code:String(fields.get("country_code") || "SG"),
      p_owner_email:String(fields.get("owner_email") || "").trim(),
      p_role:String(fields.get("role") || "owner"),
    });
    accountBusy = false;
    if (submit) { submit.disabled = false; submit.textContent = "Create pending account"; }
    if (error) return alert("Could not add HBB account: " + error.message);
    addActivity(`${String(fields.get("business_name"))} HBB account created · waiting for owner sign-in`);
    form.reset();
    closeAccountDialog();
    await syncCloudWorkspaces();
    alert("HBB workspace created. Status is Pending until the owner signs in with the email you entered.");
  }

  async function copyDemoLink(market) {
    const url = absoluteUrl(market === "MY" ? "/demo/malaysia" : "/demo/singapore");
    try {
      await navigator.clipboard.writeText(url);
      alert(`${market === "MY" ? "Malaysia" : "Singapore"} demo link copied. Paste it into WhatsApp or email.`);
    } catch (_) { window.prompt("Copy this demo link:", url); }
  }

  async function toggleWorkspaceLogo(id,visible) {
    const item=workspace(id); if(!item) return;
    item.logoVisible=visible; save(); render();
    if(item.source==="cloud"&&productionClient) {
      const {error}=await productionClient.from("slow_studio_workspaces").update({logo_visible:visible}).eq("id",id);
      if(error) alert("Could not update logo visibility: "+error.message);
    }
  }

  async function uploadWorkspaceLogo(input,id) {
    const file=input?.files?.[0],item=workspace(id); if(!file||!item) return;
    if(!file.type.startsWith("image/")) return alert("Choose an image file.");
    if(file.size>5*1024*1024) return alert("Logo must be 5 MB or smaller.");
    if(item.source==="cloud"&&productionClient) {
      const extension=(file.name.split(".").pop()||"png").replace(/[^a-z0-9]/gi,"").toLowerCase();
      const path=`slow-studio/${id}/logo-${Date.now()}.${extension}`;
      const {error:uploadError}=await productionClient.storage.from("storefront-images").upload(path,file,{upsert:true,contentType:file.type});
      if(uploadError) return alert("Could not upload logo: "+uploadError.message);
      const {data}=productionClient.storage.from("storefront-images").getPublicUrl(path);
      const logoUrl=data?.publicUrl||"";
      const {error}=await productionClient.from("slow_studio_workspaces").update({logo_url:logoUrl,logo_visible:true}).eq("id",id);
      if(error) return alert("Could not save logo: "+error.message);
      item.logoUrl=logoUrl; item.logoVisible=true;
    } else {
      item.logoUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=reject;reader.readAsDataURL(file);});
      item.logoVisible=true; save();
    }
    addActivity(`${item.name} logo updated`); render();
  }

  function setIssueStatus(id,value) {
    const issue = state.issues.find((item) => item.id === id);
    if (!issue) return;
    issue.status = value;
    addActivity(`${workspaceName(issue.workspaceId)} issue marked ${value}`);
    render();
  }
  function setIssueNote(id,value) {
    const issue = state.issues.find((item) => item.id === id);
    if (!issue) return;
    issue.note = value;
    save();
  }
  function resetDemo() {
    localStorage.removeItem("slow-studio-hbb-demo-v1-sg");
    localStorage.removeItem("slow-studio-hbb-demo-v1-my");
    state.issues = state.issues.filter((item) => !String(item.workspaceId).startsWith("hbb-demo-") || item.id === "issue-demo-1");
    addActivity("Singapore and Malaysia HBB demo data reset on this device");
    render();
  }

  function issueRows() {
    return state.issues.map((issue) => `<article class="ss-issue ${esc(issue.severity)}"><span class="ss-severity">${issue.severity === "high" ? "!" : issue.severity === "medium" ? "•" : "i"}</span><div><b>${esc(issue.title)}</b><p>${esc(workspaceName(issue.workspaceId))} · ${esc(issue.page)}<br>${esc(issue.detail)}</p><small>${fmt(issue.createdAt)}</small><textarea placeholder="Owner resolution note" oninput="SlowStudio.setIssueNote('${esc(issue.id)}',this.value)">${esc(issue.note || "")}</textarea></div><select class="ss-select" onchange="SlowStudio.setIssueStatus('${esc(issue.id)}',this.value)">${["open","reviewing","resolved"].map((value) => `<option ${issue.status === value ? "selected" : ""}>${value}</option>`).join("")}</select><span class="ss-pill ${issue.status === "resolved" ? "" : "hidden"}">${esc(issue.status)}</span></article>`).join("") || `<div class="ss-empty">No HBB issues reported.</div>`;
  }

  function workspaceRows() {
    return state.workspaces.map((item) => {
      const isDemo = item.type.includes("trial");
      const isCloud = item.source === "cloud";
      const badge = isCloud && item.inviteStatus === "pending" ? "Pending owner" : item.visibility === "live" ? "Live" : item.visibility === "hidden" ? "Hidden" : "Demo only";
      const badgeClass = isDemo ? "demo" : isCloud && item.inviteStatus === "pending" ? "pending" : item.visibility === "hidden" ? "hidden" : "";
      const websiteControl = isDemo
        ? `<span class="ss-pill demo">No Supabase</span>`
        : isCloud
          ? `<span class="ss-pill ${item.inviteStatus === "pending" ? "pending" : ""}">${item.inviteStatus === "pending" ? `Waiting for ${esc(item.inviteEmail)}` : `${esc(item.inviteRole)} connected`}</span>`
          : `<select class="ss-select" onchange="SlowStudio.setVisibility('${esc(item.id)}',this.value)"><option value="live" ${item.visibility === "live" ? "selected" : ""}>Website live</option><option value="hidden" ${item.visibility === "hidden" ? "selected" : ""}>Hide website</option></select>`;
      const actions = isDemo
        ? `<a class="ss-btn" href="${esc(item.adminUrl)}">Try admin</a><button class="ss-btn purple" onclick="SlowStudio.copyDemoLink('${item.id.endsWith("my") ? "MY" : "SG"}')">Copy demo link</button><a class="ss-btn" href="${esc(item.customerUrl)}" target="_blank">View demo shop ↗</a>`
        : isCloud
          ? `<button class="ss-btn" disabled>${item.inviteStatus === "pending" ? "Awaiting owner" : "Open workspace"}</button>`
          : `<a class="ss-btn" href="${esc(item.adminUrl)}">Open admin</a><a class="ss-btn" href="${esc(item.customerUrl)}" target="_blank">View shop ↗</a>`;
      const icon = item.logoVisible!==false&&item.logoUrl?`<img src="${esc(item.logoUrl)}" alt="">`:isDemo ? (item.id.endsWith("my") ? "D-MY" : "D-SG") : item.market.startsWith("Malaysia") ? "MY" : "SG";
      const logoControls=`<label class="ss-btn">Upload logo<input type="file" accept="image/*" hidden onchange="SlowStudio.uploadWorkspaceLogo(this,'${esc(item.id)}')"></label><button class="ss-btn" onclick="SlowStudio.toggleWorkspaceLogo('${esc(item.id)}',${item.logoVisible===false?"true":"false"})">${item.logoVisible===false?"Show logo":"Hide logo"}</button>`;
      return `<tr><td><div class="ss-workspace"><span class="ss-workspace-icon">${icon}</span><div><b>${esc(item.name)}</b><small>${esc(item.type)}${isCloud && item.inviteEmail ? ` · ${esc(item.inviteEmail)}` : ""}</small><div class="ss-actions" style="margin-top:8px">${logoControls}</div></div></div></td><td>${esc(item.market)}</td><td><span class="ss-pill ${badgeClass}">${item.connected ? "● " : ""}${esc(badge)}</span></td><td>${websiteControl}</td><td><div class="ss-actions">${actions}</div></td></tr>`;
    }).join("");
  }

  function render() {
    const openIssues = state.issues.filter((item) => item.status !== "resolved").length;
    const productionCount = state.workspaces.filter((item) => !item.type.includes("trial")).length;
    document.getElementById("slowStudioApp").innerHTML = `<div class="ss-shell"><aside class="ss-side"><div class="ss-brand"><span class="ss-mark">SS</span>Slow Studio</div><div class="ss-role">Owner workspace · Ting</div><div class="ss-nav-label">Workspace</div><nav class="ss-nav">${[["overview","Overview"],["workspaces","My stores"],["issues",`Issues · ${openIssues}`],["access","Access & roles"]].map(([key,label]) => `<button class="${panel === key ? "active" : ""}" onclick="SlowStudio.setPanel('${key}')">${label}</button>`).join("")}</nav><div class="ss-side-bottom">Production workspaces use Supabase with workspace access rules.<br><br>Demo data stays on each visitor's device only.</div></aside><main class="ss-main"><header class="ss-top"><div><div class="ss-eyebrow">Slow Studio · Owner console</div><h1>${panel === "overview" ? "Good day, Ting." : panel === "workspaces" ? "My stores" : panel === "issues" ? "HBB issue inbox" : "Access & roles"}</h1><p>${panel === "overview" ? "Manage your stores, future HBB clients and support issues in one place." : panel === "workspaces" ? "Create HBB accounts and share safe country demos from one screen." : panel === "issues" ? "See what happened, where it happened and your resolution note." : "Control who can view or edit each HBB workspace."}</p></div><div class="ss-owner"><span class="ss-avatar"><img src="lumi-slow-studio.png" alt="Lumi"></span><div><b>Ting</b><br><small>Slow Studio Owner</small></div></div></header>
      <section class="ss-panel ${panel === "overview" ? "active" : ""}"><div class="ss-kpis"><div class="ss-kpi"><span>Workspaces</span><strong>${state.workspaces.length}</strong><small>${productionCount} production · 2 country demos</small></div><div class="ss-kpi"><span>Live websites</span><strong>${state.workspaces.filter((item) => item.visibility === "live").length}</strong><small>Hidden sites stay editable</small></div><div class="ss-kpi"><span>Open issues</span><strong>${openIssues}</strong><small>Across every HBB</small></div><div class="ss-kpi"><span>Demo data</span><strong>Local</strong><small>Never sent to Supabase</small></div></div><section class="ss-card"><div class="ss-card-head"><div><h2>Workspace health</h2><p>One row per store · country data stays separate.</p></div><button class="ss-btn" onclick="SlowStudio.setPanel('workspaces')">Manage stores</button></div><div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Workspace</th><th>Market</th><th>Status</th><th>Website / owner</th><th>Actions</th></tr></thead><tbody>${workspaceRows()}</tbody></table></div></section><section class="ss-card"><div class="ss-card-head"><div><h2>Recent owner activity</h2><p>Clear actions instead of technical log messages.</p></div></div>${state.activity.slice(0,6).map((item) => `<div class="ss-activity"><b>${esc(item.text)}</b><span>${fmt(item.at)}</span></div>`).join("")}</section></section>
      <section class="ss-panel ${panel === "workspaces" ? "active" : ""}"><section class="ss-card"><div class="ss-card-head"><div><h2>Store workspaces</h2><p>Add an HBB owner as Pending, or share a demo that never touches Supabase.</p></div><button class="ss-btn primary" onclick="SlowStudio.openAccountDialog()">+ Add HBB account</button></div><div class="ss-invite-note" style="margin:0 20px 18px"><b>What is the hosted Slow Studio page?</b><br>It is this online Slow Studio website at <b>${esc(hostedSlowStudioUrl())}</b>. Unlike a file:// preview, it can sign in, connect to Supabase, create real HBB accounts and update live websites.</div><div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Workspace</th><th>Market</th><th>Status</th><th>Website / owner</th><th>Actions</th></tr></thead><tbody>${workspaceRows()}</tbody></table></div><div class="ss-demo-banner"><div><h3>Shareable HBB try-out links</h3><p>Send the matching country link by WhatsApp or email. Visitors can try Orders, Products, Inventory, Costing, Marketing, Membership and Design; their data stays only in their browser and never connects to Shizuku Lab or Supabase.</p></div><div class="ss-actions"><button class="ss-btn purple" onclick="SlowStudio.copyDemoLink('SG')">Copy Singapore demo</button><button class="ss-btn purple" onclick="SlowStudio.copyDemoLink('MY')">Copy Malaysia demo</button><button class="ss-btn" onclick="SlowStudio.resetDemo()">Reset my demo</button></div></div></section></section>
      <section class="ss-panel ${panel === "issues" ? "active" : ""}"><section class="ss-card"><div class="ss-card-head"><div><h2>Issues across HBB workspaces</h2><p>Page, problem, time and owner resolution are shown together.</p></div></div>${issueRows()}</section></section>
      <section class="ss-panel ${panel === "access" ? "active" : ""}"><section class="ss-card"><div class="ss-card-head"><div><h2>Permission levels</h2><p>Each production HBB is protected by workspace-level Supabase access rules.</p></div></div><div class="ss-permission-grid"><article class="ss-permission"><h3>Slow Studio Owner</h3><p>Your account.</p><ul><li>Open every HBB workspace</li><li>Create HBB accounts</li><li>Edit settings and resolve issues</li><li>Hide or publish websites</li></ul></article><article class="ss-permission"><h3>HBB Owner</h3><p>Each business owner.</p><ul><li>Only their own workspace</li><li>Products, orders and marketing</li><li>Invite their staff</li><li>Cannot access another HBB</li></ul></article><article class="ss-permission"><h3>Staff / Marketing</h3><p>Limited by role.</p><ul><li>Operations: orders and inventory</li><li>Marketing: campaigns and customers</li><li>Viewer: read only</li><li>No other workspace access</li></ul></article></div></section></section>
      <dialog id="hbbAccountDialog" class="ss-dialog"><form class="ss-dialog-card" id="hbbAccountForm" onsubmit="SlowStudio.createHbbAccount(event)"><div class="ss-dialog-title"><div><div class="ss-eyebrow">New workspace</div><h2>Add HBB account</h2><p>The account stays Pending until the owner signs in using this email.</p></div><button type="button" class="ss-close" onclick="SlowStudio.closeAccountDialog()" aria-label="Close">×</button></div><label class="ss-field"><span>Business / store name</span><input name="business_name" required minlength="2" placeholder="e.g. Lumi Bakehouse"></label><label class="ss-field"><span>Country</span><select name="country_code"><option value="SG">Singapore · SGD</option><option value="MY">Malaysia · MYR</option></select></label><label class="ss-field"><span>Owner email</span><input name="owner_email" type="email" required placeholder="owner@example.com"></label><label class="ss-field"><span>Starting permission</span><select name="role"><option value="owner">HBB Owner</option><option value="admin">Admin</option><option value="operations">Operations</option><option value="marketing">Marketing</option><option value="viewer">Viewer</option></select></label><div class="ss-invite-note"><b>What happens next?</b><br>Slow Studio creates a separate workspace and Pending invitation. When this exact email signs in, access is activated only for that HBB.</div><div class="ss-dialog-actions"><button type="button" class="ss-btn" onclick="SlowStudio.closeAccountDialog()">Cancel</button><button type="submit" class="ss-btn primary">Create pending account</button></div></form></dialog>
    </main></div>`;
    document.querySelector(".ss-mark").innerHTML = '<img src="lumi-slow-studio.png" alt="Lumi">';
  }

  window.SlowStudio = { setPanel,setVisibility,setIssueStatus,setIssueNote,resetDemo,copyDemoLink,openAccountDialog,closeAccountDialog,createHbbAccount,toggleWorkspaceLogo,uploadWorkspaceLogo };
  render();
  syncProductionVisibility();
  syncCloudWorkspaces();
})();
