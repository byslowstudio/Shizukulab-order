/* Shizuku Lab — shop dashboard (wired to real Supabase schema) */

const ADMIN_WORKSPACE_MARKET = new URLSearchParams(window.location.search).get("market") === "MY" || /\/(workspace\/shizuku-lab-my|demo\/malaysia)(?:\/|$)/i.test(window.location.pathname) ? "MY" : "SG";
const ADMIN_CUSTOMER_SHOP_URL = window.SLOW_STUDIO_DEMO_MODE
  ? (ADMIN_WORKSPACE_MARKET === "MY" ? "/demo/malaysia/shop" : "/demo/singapore/shop")
  : (ADMIN_WORKSPACE_MARKET === "MY" ? "/shop/shizuku-lab-my" : "/shop/shizuku-lab-sg");

const astate = {
  unlocked: false,
  welcomePending: false,
  welcomeTimer: null,
  navCollapsed: (() => { try { return localStorage.getItem("shizuku-admin-nav-collapsed") === "1"; } catch (_) { return false; } })(),
  navGroups: (() => { try { return JSON.parse(localStorage.getItem("shizuku-admin-nav-groups") || '{"my_store":true,"customers":true,"website":false,"business":false}'); } catch (_) { return { my_store:true, customers:true, website:false, business:false }; } })(),
  navScrollTop: 0,
  loginEmail: "tinghuioh29@gmail.com",
  loginPassword: "",
  recoveryMode: false,
  recoveryPassword: "",
  recoveryPasswordConfirm: "",
  loginMessage: "",
  tab: "dashboard",
  orders: [],
  menu: [],
  productGroups: [],
  optionGroups: [],
  options: [],
  productOptionGroups: [],
  realtimeChannel: null,
  newOrderAlert: null,
  promos: [],
  promoRedemptions: [],
  expandedPromoCode: null,
  editingPromoId: null,
  customerNotes: {},
  loyaltySettings: null,
  loyaltyDraft: null,
  customerLoyalty: {},
  loyaltyTransactions: [],
  notificationSettings: null,
  notificationDraft: null,
  promoDraft: { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "", applicable_product_ids: [] },
  selectedCustomerKey: null,
  settings: null,
  settingsDraft: null,
  openingOverrides: [],
  faq: [],
  reviews: [],
  messages: [],
  messageDrafts: {},
  selectedAvailabilityDate: null,
  availabilityMarket: ADMIN_WORKSPACE_MARKET,
  settingsSection: "welcome",
  availabilityDraft: null,
  offlineOrderDraft: null,
  salesFrom: "",
  salesTo: "",
  analyticsPeriod: "monthly",
  calendarMonth: null,
  orderFilter: "all",
  orderSearch: "",
  expandedOrderIds: [],
  selectedOrderIds: [],
  bulkOrderMode: false,
  welcomePhase: "idle",
  welcomeError: "",
  inventory: [],
  recipes: [],
  stockPurchases: [],
  cashFlowEntries: [],
  stockPurchaseDraft: { inventory_item_id: "", quantity: "", total_cost: "", supplier: "", notes: "" },
  inventoryReady: true,
  inventoryDraft: null,
  recipeProductId: null,
  recipeDraftProductId: null,
  recipeDraft: null,
  recipeDirty: false,
  recipeZeroCost: false,
  costingMarket: ADMIN_WORKSPACE_MARKET,
  marketingSearch: "",
  marketingSelectedEmails: [],
  marketingSelectedPhones: [],
  marketingSendBusy: false,
  marketingSendProgress: "",
  marketingAttachmentUploading: false,
  marketingManualContacts: [],
  marketingContactDraft: { customer_name: "", customer_email: "", customer_phone: "", marketing_email_opt_in: true, marketing_whatsapp_opt_in: false },
  suppliers: [],
  wholesaleItems: [],
  inspirationIdeas: [],
  teamMembers: [],
  activityLog: [],
  currentUser: null,
  currentTeamMember: null,
  studioSettings: { country: "Singapore", currency: "SGD", language: "English" },
  teamDraft: null,
  editingTeamId: null,
  teamSection: "team",
  supplierDraft: null,
  wholesaleDraft: null,
  ideaDraft: null,
  quickIdea: "",
  marginGuide: { very_low_max: 20, low_max: 30, acceptable_max: 40, healthy_max: 50, strong_max: 60, direct_target_min: 50, direct_target_max: 70, wholesale_target_min: 30, wholesale_target_max: 50 },
  editingOrder: null,
  loading: true,
  loadError: null,
  dashboardRefreshing: false,
  dashboardLastUpdated: null,
  dashboardFocusTarget: null,
  whatsappError: null,
  editing: null,
  customerEmailSendingId: null,
};

function money(n) {
  const currency = ADMIN_WORKSPACE_MARKET === "MY" ? "MYR" : String(astate.settings?.store_currency || astate.studioSettings?.currency || "SGD").toUpperCase();
  const locale = currency === "MYR" ? "en-MY" : currency === "CNY" ? "zh-CN" : "en-SG";
  try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(n || 0)); }
  catch (_) { return `${currency} ${Number(n || 0).toFixed(2)}`; }
}
function marketMoney(n, market = astate.costingMarket) {
  const currency = market === "MY" ? "MYR" : "SGD";
  return new Intl.NumberFormat(market === "MY" ? "en-MY" : "en-SG", { style: "currency", currency }).format(Number(n || 0));
}
function bundleStartingPriceAdmin(bundle) {
  if (String(bundle?.bundle_pricing_mode || "fixed") !== "sum_selected") return Number(bundle?.discount_price || bundle?.price || 0);
  const allowedIds = Array.isArray(bundle?.bundle_product_ids) ? bundle.bundle_product_ids.map(String) : [];
  const choices = astate.menu.filter((product) => !product.is_bundle && (!allowedIds.length || allowedIds.includes(String(product.id))));
  const overrides = bundle?.bundle_option_prices && typeof bundle.bundle_option_prices === "object" ? bundle.bundle_option_prices : {};
  const prices = choices.map((product) => {
    const override = Number(overrides[String(product.id)]);
    return Number.isFinite(override) && override >= 0 ? override : Number(product.discount_price || product.price || 0);
  });
  return Number(bundle?.price || 0) + (prices.length ? Math.min(...prices) * 2 : 0);
}
function bundleDisplayFromPriceAdmin(bundle) {
  const saved = Number(bundle?.bundle_display_from_price);
  return Number.isFinite(saved) && saved >= 0 ? saved : bundleStartingPriceAdmin(bundle);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const PAY_LABEL = { awaiting_payment: "Awaiting payment", submitted: "Payment sent — pending confirmation", rejected: "Payment proof rejected", paid: "Paid" };
const PAY_COLOR = { awaiting_payment: "#B78A2E", submitted: "#B78A2E", rejected: "#B33333", paid: "#4B5D3A" };
const ORDER_LABEL = { pending: "Pending", awaiting_confirmation: "Awaiting confirmation", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready for collection", collected: "Collected", cancelled: "Cancelled" };
const ORDER_COLOR = { cancelled: "#B33333", preparing: "#A36D1E", ready: "#267A47" };

const DEFAULT_MARKETING_EMAIL_SUBJECT = "September Opening Dates + A Little Treat 🍵";
const DEFAULT_MARKETING_EMAIL_BODY = `Hi there ♡

Our September opening dates are here

You can find our available collection dates and timings in the calendar attached. For the latest availability or any schedule updates, please refer to our ordering page.

And a little update for this month — we’re retiring our previous promo code SHIZUKULABAUG and changing it to:
FIRSTDROP

Use FIRSTDROP to enjoy $1 OFF your order ✨
Even if you’ve used SHIZUKULABAUG before, you can still use FIRSTDROP one more time.

One-time use per customer.

Thank you for supporting our little lab ♡
See you this September!
Shizuku Lab
Crafted drop by drop.`;
const DEFAULT_MARKETING_WHATSAPP_BODY = `Hi {customer_name} ♡\n\nOur September opening dates are here 🍵\n\nPlease check our ordering page for the latest collection dates and timings. Use FIRSTDROP to enjoy $1 OFF your order ✨\n\nOne-time use per customer.\n\nThank you for supporting our little lab ♡\nShizuku Lab · Crafted drop by drop.`;

function localDateText(date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function weeklyAvailability(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  const schedule = weeklySchedule();
  const day = schedule.find((item) => Number(item.day) === date.getDay());
  const windows = Array.isArray(day?.windows) ? day.windows : [];
  return { is_open: !!day?.is_open, collection_time: windows.map((item) => item.range).filter(Boolean).join(" | "), pickup_windows: windows };
}
function availabilityForDate(dateText) {
  const override = astate.openingOverrides.find((item) => item.collection_date === dateText && String(item.market_code || "SG") === astate.availabilityMarket);
  return override ? { is_open: !!override.is_open, collection_time: override.collection_time || "", pickup_windows: Array.isArray(override.pickup_windows) ? override.pickup_windows : availabilityRanges(override.collection_time).filter(Boolean).map((range) => ({ range, capacity: null })), override: true } : { ...weeklyAvailability(dateText), override: false };
}
function setAvailabilityDraft(dateText) {
  astate.selectedAvailabilityDate = dateText;
  const value = availabilityForDate(dateText);
  astate.availabilityDraft = { collection_date: dateText, is_open: value.is_open, collection_time: value.collection_time, pickup_windows: (value.pickup_windows || []).map((item) => ({ ...item })) };
}
function selectAvailabilityDate(dateText) { setAvailabilityDraft(dateText); render(); }
function setAvailabilityMarket(market) {
  astate.availabilityMarket = market === "MY" ? "MY" : "SG";
  try { localStorage.setItem("shizuku-availability-market", astate.availabilityMarket); } catch (_) {}
  setAvailabilityDraft(astate.selectedAvailabilityDate || localDateText(new Date()));
  render();
}
function changeCalendarMonth(amount) {
  const current = new Date(`${astate.calendarMonth}T12:00:00`);
  current.setMonth(current.getMonth() + amount);
  astate.calendarMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
  render();
}
function onAvailabilityField(key, value) { astate.availabilityDraft[key] = value; }
function availabilityRanges(value) {
  const text = String(value || "");
  // Keep an empty final line while the owner is adding a second pickup window.
  // Filtering it out made the new input disappear immediately after clicking Add.
  if (!text.trim()) return [""];
  return text.split("|").map((item) => item.trim());
}
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function weeklySchedule() {
  const key = astate.availabilityMarket === "MY" ? "malaysia_weekly_pickup_schedule" : "weekly_pickup_schedule";
  const saved = astate.settingsDraft?.[key];
  if (Array.isArray(saved) && saved.length === 7) return saved;
  const saturday = astate.settingsDraft?.saturday_collection_time || "10:00 AM - 12:00 PM";
  const sunday = astate.settingsDraft?.sunday_collection_time || "10:00 AM - 1:00 PM";
  const schedule = WEEKDAYS.map((label, day) => ({ day, label, is_open: day === 0 || day === 6, windows: day === 0 ? [{ range:sunday, capacity:null }] : day === 6 ? [{ range:saturday, capacity:null }] : [] }));
  if (astate.settingsDraft) astate.settingsDraft[key] = schedule;
  return schedule;
}
function setWeeklyDayOpen(day, value) { const row=weeklySchedule().find((item)=>Number(item.day)===Number(day)); if (!row) return; row.is_open=!!value; if (row.is_open && !row.windows.length) row.windows=[{range:"10:00 AM - 12:00 PM",capacity:null}]; render(); }
function setWeeklyWindow(day,index,key,value) { const row=weeklySchedule().find((item)=>Number(item.day)===Number(day)); if (!row?.windows?.[index]) return; row.windows[index][key]=key==="capacity" ? (value===""?null:Math.max(1,Number(value||1))) : value; }
function addWeeklyWindow(day) { const row=weeklySchedule().find((item)=>Number(item.day)===Number(day)); if (!row) return; row.windows.push({range:"",capacity:null}); render(); }
function removeWeeklyWindow(day,index) { const row=weeklySchedule().find((item)=>Number(item.day)===Number(day)); if (!row) return; row.windows.splice(index,1); render(); }
function specialWindows() { const draft=astate.availabilityDraft; if (!draft) return []; if (!Array.isArray(draft.pickup_windows)) draft.pickup_windows=availabilityRanges(draft.collection_time).map((range)=>({range,capacity:null})); return draft.pickup_windows; }
function setAvailabilityRange(index, value) {
  const windows=specialWindows(); if (!windows[index]) windows[index]={range:"",capacity:null}; windows[index].range=value;
  astate.availabilityDraft.collection_time=windows.map((item)=>item.range).join(" | ");
}
function setAvailabilityCapacity(index,value) { const windows=specialWindows(); if (!windows[index]) return; windows[index].capacity=value===""?null:Math.max(1,Number(value||1)); }
function addAvailabilityRange() {
  const windows=specialWindows(); windows.push({range:"",capacity:null}); astate.availabilityDraft.collection_time=windows.map((item)=>item.range).join(" | ");
  render();
}
function removeAvailabilityRange(index) {
  const windows=specialWindows(); windows.splice(index,1); if (!windows.length) windows.push({range:"",capacity:null}); astate.availabilityDraft.collection_time=windows.map((item)=>item.range).join(" | ");
  render();
}
async function saveAvailabilityOverride() {
  const entry = astate.availabilityDraft;
  if (!entry || !entry.collection_date) return;
  const button = document.getElementById("availability-save-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const pickupWindows = specialWindows().filter((item)=>String(item.range||"").trim()).map((item)=>({range:String(item.range).trim(),capacity:item.capacity==null?null:Math.max(1,Number(item.capacity))}));
  const cleanWindows = pickupWindows.map((item)=>item.range).join(" | ");
  const payload = { market_code: astate.availabilityMarket, collection_date: entry.collection_date, is_open: !!entry.is_open, collection_time: entry.is_open ? cleanWindows : null, pickup_windows: entry.is_open ? pickupWindows : [] };
  if (window.SLOW_STUDIO_DEMO_MODE) {
    const saved={...payload,id:entry.id||`demo-day-${Date.now()}`};
    astate.openingOverrides=[...astate.openingOverrides.filter((item)=>!(item.collection_date===saved.collection_date&&String(item.market_code||"SG")===String(saved.market_code))),saved];
    setAvailabilityDraft(saved.collection_date);
    if(button){button.textContent="Save day";button.disabled=false;}
    render(); return alert("Demo availability saved in this browser only.");
  }
  const { data, error } = await db.from("store_opening_overrides").upsert(payload, { onConflict: "market_code,collection_date" }).select().single();
  if (button) { button.textContent = "Save day"; button.disabled = false; }
  if (error) { alert("Could not save this day: " + error.message); return; }
  astate.openingOverrides = [...astate.openingOverrides.filter((item) => !(item.collection_date === data.collection_date && String(item.market_code || "SG") === String(data.market_code || "SG"))), data];
  setAvailabilityDraft(data.collection_date);
  render();
}
async function clearAvailabilityOverride() {
  const dateText = astate.selectedAvailabilityDate;
  const existing = astate.openingOverrides.find((item) => item.collection_date === dateText && String(item.market_code || "SG") === astate.availabilityMarket);
  if (!existing) return;
  if (!confirm("Remove this special calendar setting and use the normal weekly hours again?")) return;
  if (window.SLOW_STUDIO_DEMO_MODE) {
    astate.openingOverrides=astate.openingOverrides.filter((item)=>item.id!==existing.id);
    setAvailabilityDraft(dateText); render(); return;
  }
  const { error } = await db.from("store_opening_overrides").delete().eq("id", existing.id);
  if (error) { alert("Could not remove this day: " + error.message); return; }
  astate.openingOverrides = astate.openingOverrides.filter((item) => item.id !== existing.id);
  setAvailabilityDraft(dateText);
  render();
}

function loadAdminDemoData() {
  const my=DASHBOARD_MARKET==="MY",cur=my?"MYR":"SGD",prefix=my?"MY":"SG";
  const saved=(()=>{try{return JSON.parse(localStorage.getItem(`slow-studio-exact-demo-products-${DASHBOARD_MARKET.toLowerCase()}`)||"null")}catch(_){return null}})();
  astate.menu=Array.isArray(saved)?saved:[
    {id:`${prefix}-P1`,name:"Matcha Cloud",description:"Ceremonial matcha with oat milk",category:"Signature",price:my?16:6.5,myr_price:16,stock:18,is_available:true,malaysia_available:true,sort_order:1,food_cost_confirmed_zero:false},
    {id:`${prefix}-P2`,name:"Houjicha Cocoa",description:"Roasted tea with a chocolatey finish",category:"Signature",price:my?17:6.9,myr_price:17,stock:12,is_available:true,malaysia_available:true,sort_order:2,food_cost_confirmed_zero:false},
    {id:`${prefix}-P3`,name:"Weekend Pair",description:"Choose two drinks",category:"Bundle",price:my?30:12,myr_price:30,stock:8,is_available:true,malaysia_available:true,is_bundle:true,bundle_pricing_mode:"fixed",sort_order:3,food_cost_confirmed_zero:false}
  ];
  astate.productGroups=[{id:"g1",name:"Signature",sort_order:1,is_visible:true},{id:"g2",name:"Bundle",sort_order:2,is_visible:true}];
  astate.optionGroups=[{id:"og1",name:"Sweetness",sort_order:1,is_visible:true}];astate.options=[{id:"o1",option_group_id:"og1",name:"Less sweet",price_adjustment:0,is_visible:true}];astate.productOptionGroups=[];
  const today=localDateText(new Date());
  astate.orders=[
    {id:`${prefix}-O1`,order_number:`DEMO-${prefix}-104`,customer_name:"Avery Demo",customer_phone:my?"+60 12-345 6789":"+65 9123 4567",customer_email:"avery@example.com",market_code:DASHBOARD_MARKET,total:my?33:13.4,payment_status:"submitted",order_status:"awaiting_confirmation",collection_date:today,collection_time:"11:30 AM",collection_point:"Demo collection point",counts_as_sale:true,created_at:new Date().toISOString(),order_items:[{id:"i1",product_id:`${prefix}-P1`,product_name:"Matcha Cloud",quantity:1,unit_price:my?16:6.5,subtotal:my?16:6.5,order_item_options:[]},{id:"i2",product_id:`${prefix}-P2`,product_name:"Houjicha Cocoa",quantity:1,unit_price:my?17:6.9,subtotal:my?17:6.9,order_item_options:[]}]},
    {id:`${prefix}-O2`,order_number:`DEMO-${prefix}-103`,customer_name:"Jamie Sample",customer_phone:my?"+60 19-876 5432":"+65 9876 5432",customer_email:"jamie@example.com",market_code:DASHBOARD_MARKET,total:my?30:12,payment_status:"paid",order_status:"ready",collection_date:today,collection_time:"2:00 PM",collection_point:"Demo collection point",counts_as_sale:true,created_at:new Date(Date.now()-86400000).toISOString(),order_items:[{id:"i3",product_id:`${prefix}-P3`,product_name:"Weekend Pair",quantity:1,unit_price:my?30:12,subtotal:my?30:12,order_item_options:[]}]}
  ];
  astate.settings={id:1,store_name:my?"Mori Bakehouse Malaysia":"Mori Bakehouse Singapore",store_currency:cur,store_tagline:"Small batches for slow mornings",website_visibility:"live",malaysia_website_visibility:"live",collection_points:["Demo collection point"],ordering_theme:"winter_sage",admin_theme:"winter_sage",theme_primary_color:"#BCCFE4",theme_background_color:"#E9E5DB",theme_card_color:"#FFFFFF",theme_text_color:"#303A42",admin_theme_primary:"#BCCFE4",admin_theme_background:"#E9E5DB",admin_theme_card:"#FFFFFF",admin_theme_text:"#303A42",marketing_opt_in_enabled:true,marketing_email_enabled:true,marketing_whatsapp_enabled:true,membership_enabled:false,membership_name:"Mori Members",loyalty_heading:"Mori Members",show_checkout_email:true,reviews_enabled:true,review_cta_label:"Share your experience",review_portal_title:"Share your experience",review_portal_intro:"Tell us about the items you collected.",reviews_heading:"CUSTOMER REVIEWS",chat_enabled:true,payment_instructions:my?"Pay by bank transfer or Touch ’n Go. Upload your payment proof for review.":"Pay by PayNow and upload your payment proof for review.",payment_method:my?"bank_transfer_tng":"paynow",customer_phone_prefix:my?"+60":"+65",tng_phone_number:my?"+60 12-345 6789":"",tng_qr_url:""};
  try { const savedSettings=JSON.parse(localStorage.getItem(`slow-studio-exact-demo-settings-${DASHBOARD_MARKET.toLowerCase()}`)||"null"); if(savedSettings&&typeof savedSettings==="object") astate.settings={...astate.settings,...savedSettings,id:1,store_currency:cur}; } catch (_) {}
  astate.settingsDraft={...astate.settings};
  astate.inventory=[{id:`00000000-0000-4000-8000-${my?"000000000001":"000000000002"}`,market_code:DASHBOARD_MARKET,name:"Tea powder",unit:"g",stock_quantity:500,low_stock_level:100,pack_size:100,pack_cost:my?48:18,supplier:"Demo supplier",cost_type:"ingredient"},{id:`00000000-0000-4000-8000-${my?"000000000003":"000000000004"}`,market_code:DASHBOARD_MARKET,name:"Cup + lid",unit:"pc",stock_quantity:60,low_stock_level:15,pack_size:50,pack_cost:my?25:9,supplier:"Demo packaging",cost_type:"packaging"}];
  astate.stockPurchases=[{id:"sp1",market_code:DASHBOARD_MARKET,inventory_item_id:astate.inventory[0].id,quantity:100,total_cost:my?48:18,supplier:"Demo supplier",purchased_at:new Date().toISOString()}];astate.cashFlowEntries=[{id:"cf1",market_code:DASHBOARD_MARKET,entry_type:"expense",category:"stock_purchase",amount:my?48:18,occurred_at:new Date().toISOString()}];
  astate.recipes=[{id:"r1",market_code:DASHBOARD_MARKET,product_id:`${prefix}-P1`,inventory_item_id:astate.inventory[0].id,quantity_used:4},{id:"r2",market_code:DASHBOARD_MARKET,product_id:`${prefix}-P1`,inventory_item_id:astate.inventory[1].id,quantity_used:1}];
  astate.inventoryReady=true;astate.marketingManualContacts=[{id:1,market_code:DASHBOARD_MARKET,customer_name:"Sample Customer",customer_email:"sample@example.com",customer_phone:my?"0112233445":"90001111",marketing_email_opt_in:true,marketing_whatsapp_opt_in:true,consent_at:new Date().toISOString()}];
  astate.promos=[{id:"promo1",code:"DEMOTREAT",discount_type:"fixed",discount_value:my?2:1,is_active:true,created_at:new Date().toISOString()}];astate.promoRedemptions=[];astate.customerNotes={};
  astate.loyaltySettings={id:1,enabled:true,reward_type:"stamps",stamps_required:10,minimum_spend:5,points_per_dollar:1,points_required:50,reward_description:"A sample reward"};astate.loyaltyDraft={...astate.loyaltySettings};astate.customerLoyalty={};astate.loyaltyTransactions=[];
  astate.notificationSettings={id:1,recipient_email:"owner@example.com",enabled:true,alert_new_order:true,alert_payment_proof:true,alert_live_chat:true,customer_email_enabled:true,customer_ready_email_enabled:true};astate.notificationDraft={...astate.notificationSettings};
  astate.faq=[{id:1,question:"How does this demo work?",answer:"Everything stays in this browser and never reaches Supabase.",sort_order:1}];astate.reviews=[{id:1,customer_name:"Demo Reviewer",rating:5,review_text:"A clearly labelled sample review.",status:"published",created_at:new Date().toISOString()}];astate.messages=[];astate.openingOverrides=[];
  astate.suppliers=[];astate.wholesaleItems=[];astate.inspirationIdeas=[];astate.teamMembers=[{id:"t1",email:"demo@slowstudio.local",display_name:"Demo Owner",role:"Owner",is_active:true,created_at:new Date().toISOString()}];astate.activityLog=[{id:1,action:"Demo workspace opened",created_at:new Date().toISOString()}];astate.studioSettings={country:my?"Malaysia":"Singapore",currency:cur,language:"English"};astate.currentTeamMember=astate.teamMembers[0];
}

async function loadAll(options = {}) {
  const silent = !!options.silent;
  let loadSucceeded = true;
  if (!silent) { astate.loading = true; astate.loadError = null; render(); }
  if (IS_CONFIGURED) {
    try {
      // try the nested query first (needs FKs orders<-order_items<-order_item_options)
      let orders;
      const nested = await db.from("orders").select("*, order_items(*, order_item_options(*))").order("created_at", { ascending: false });
      if (nested.error) {
        // fall back to flat queries and stitch client-side
        const [{ data: oRows, error: oErr }, { data: iRows }, { data: optRows }] = await Promise.all([
          db.from("orders").select("*").order("created_at", { ascending: false }),
          db.from("order_items").select("*"),
          db.from("order_item_options").select("*"),
        ]);
        if (oErr) throw oErr;
        orders = (oRows || []).map((o) => ({
          ...o,
          order_items: (iRows || []).filter((it) => String(it.order_id) === String(o.id)).map((it) => ({
            ...it,
            order_item_options: (optRows || []).filter((op) => String(op.order_item_id) === String(it.id)),
          })),
        }));
      } else {
        orders = nested.data || [];
      }
      astate.orders = orders;

      const manualMarketingResult = await db.from("marketing_contacts").select("*").order("created_at", { ascending: false });
      if (manualMarketingResult.error && !/does not exist|schema cache/i.test(manualMarketingResult.error.message || "")) console.warn("Could not load manual marketing contacts:", manualMarketingResult.error.message);
      astate.marketingManualContacts = manualMarketingResult.data || [];

      let menuResult = await db.from("products").select("*").order("sort_order").order("id");
      // Keep Admin usable until the one-time product sorting SQL is run.
      if (menuResult.error && /sort_order/i.test(menuResult.error.message || "")) {
        console.warn("products.sort_order is not installed yet; using the current product order temporarily.");
        menuResult = await db.from("products").select("*").order("category").order("id");
      }
      if (menuResult.error) astate.loadError = menuResult.error.message;
      astate.menu = menuResult.data || [];

      const { data: groups, error: groupError } = await db.from("product_groups").select("*").order("sort_order").order("name");
      if (groupError) console.warn("Could not load product groups:", groupError.message);
      astate.productGroups = groups || [];

      let optionGroupsResult = await db.from("option_groups").select("*").order("sort_order").order("id");
      // Keep Admin usable before the one-time drag-sort SQL is run.
      if (optionGroupsResult.error && /sort_order/i.test(optionGroupsResult.error.message || "")) {
        console.warn("option_groups.sort_order is not installed yet; using ID order temporarily.");
        optionGroupsResult = await db.from("option_groups").select("*").order("id");
      }
      const { data: options, error: optionsError } = await db.from("options").select("*").order("option_group_id").order("id");
      if (optionGroupsResult.error) console.warn("Could not load drink option groups:", optionGroupsResult.error.message);
      if (optionsError) console.warn("Could not load drink options:", optionsError.message);
      astate.optionGroups = optionGroupsResult.data || [];
      astate.options = options || [];
      const { data: productOptionGroups, error: productOptionGroupsError } = await db.from("product_option_groups").select("product_id, option_group_id");
      if (productOptionGroupsError) console.warn("Could not load product option mappings:", productOptionGroupsError.message);
      astate.productOptionGroups = productOptionGroups || [];

      const { data: settingsRows } = await db.from("store_settings").select("*").limit(1);
      astate.settings = (settingsRows && settingsRows[0]) || null;
      astate.settingsDraft = astate.settings ? { ...astate.settings } : null;
      const { data: faq, error: faqError } = await db.from("store_faq").select("*").order("sort_order");
      if (faqError) console.warn("Could not load FAQ:", faqError.message);
      astate.faq = faq || [];
      const [{ data: reviews, error: reviewsError }, { data: messages, error: messagesError }] = await Promise.all([
        db.from("customer_reviews").select("*").order("created_at", { ascending: false }),
        db.from("order_messages").select("*").order("created_at"),
      ]);
      if (reviewsError) console.warn("Could not load reviews:", reviewsError.message);
      if (messagesError) console.warn("Could not load messages:", messagesError.message);
      astate.reviews = reviews || [];
      astate.messages = messages || [];
      const { data: overrides, error: availabilityError } = await db.from("store_opening_overrides").select("*").order("collection_date");
      if (availabilityError) console.warn("Could not load store availability:", availabilityError.message);
      astate.openingOverrides = overrides || [];
      const [{ data: promos, error: promoError }, { data: redemptions, error: redemptionError }, { data: notes, error: notesError }, { data: loyaltySettings, error: loyaltySettingsError }, { data: loyaltyRows, error: loyaltyRowsError }, { data: notificationSettings, error: notificationError }] = await Promise.all([
        db.from("promo_codes").select("*").order("created_at", { ascending: false }),
        db.from("promo_redemptions").select("*"),
        db.from("customer_notes").select("*"),
        db.from("loyalty_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("customer_loyalty").select("*"),
        db.from("notification_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (promoError) console.warn("Could not load promo codes:", promoError.message);
      if (redemptionError) console.warn("Could not load promo redemptions:", redemptionError.message);
      if (notesError) console.warn("Could not load customer notes:", notesError.message);
      if (loyaltySettingsError) console.warn("Could not load loyalty settings:", loyaltySettingsError.message);
      if (loyaltyRowsError) console.warn("Could not load loyalty balances:", loyaltyRowsError.message);
      if (notificationError) console.warn("Could not load notification settings:", notificationError.message);
      astate.promos = promos || [];
      astate.promoRedemptions = redemptions || [];
      astate.customerNotes = Object.fromEntries((notes || []).map((note) => [note.customer_key, note.note || ""]));
      astate.loyaltySettings = loyaltySettings || { id: 1, enabled: false, reward_type: "stamps", stamps_required: 10, minimum_spend: 5, points_per_dollar: 1, points_required: 50, reward_description: "A free drink is on us." };
      astate.loyaltyDraft = { ...astate.loyaltySettings };
      astate.customerLoyalty = Object.fromEntries((loyaltyRows || []).map((row) => [row.customer_key, row]));
      const { data: loyaltyTransactions, error: loyaltyTransactionsError } = await db.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(500);
      if (loyaltyTransactionsError) console.warn("Reward history is not installed yet:", loyaltyTransactionsError.message);
      astate.loyaltyTransactions = loyaltyTransactions || [];
      astate.notificationSettings = notificationSettings || { id: 1, recipient_email: "", webhook_url: "", enabled: false, alert_new_order: true, alert_payment_proof: true, alert_live_chat: true };
      astate.notificationDraft = { ...astate.notificationSettings };
      const [inventoryResult, recipeResult, supplierResult, wholesaleResult, inspirationResult, marginGuideResult, teamResult, activityResult, studioSettingsResult] = await Promise.all([
        db.from("inventory_items").select("*").order("name"),
        db.from("product_recipes").select("*").order("product_id"),
        db.from("suppliers").select("*").order("name"),
        db.from("wholesale_products").select("*").order("created_at", { ascending: false }),
        db.from("inspiration_ideas").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
        db.from("margin_guide_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("studio_users").select("*").order("created_at"),
        db.from("activity_log").select("*").order("created_at", { ascending: false }).limit(250),
        db.from("studio_settings").select("*").eq("id", "main").maybeSingle(),
      ]);
      astate.inventoryReady = !inventoryResult.error && !recipeResult.error;
      astate.inventory = inventoryResult.data || [];
      astate.recipes = recipeResult.data || [];
      const [purchaseResult,cashResult]=await Promise.all([
        db.from("stock_purchases").select("*").order("purchased_at",{ascending:false}).limit(250),
        db.from("cash_flow_entries").select("*").order("occurred_at",{ascending:false}).limit(500)
      ]);
      astate.stockPurchases=purchaseResult.error?[]:(purchaseResult.data||[]);
      astate.cashFlowEntries=cashResult.error?[]:(cashResult.data||[]);
      astate.suppliers = supplierResult.data || [];
      astate.wholesaleItems = wholesaleResult.data || [];
      astate.inspirationIdeas = inspirationResult.data || [];
      if (marginGuideResult.data) astate.marginGuide = marginGuideResult.data;
      if (teamResult.error) console.warn("Could not load workspace team:", teamResult.error.message);
      if (activityResult.error) console.warn("Could not load activity history:", activityResult.error.message);
      if (studioSettingsResult.error) console.warn("Could not load workspace settings:", studioSettingsResult.error.message);
      astate.teamMembers = teamResult.data || [];
      astate.activityLog = activityResult.data || [];
      astate.studioSettings = {
        country: "Singapore",
        currency: "SGD",
        language: "English",
        ...(studioSettingsResult.data?.data || {}),
      };
      const currentEmail = String(astate.currentUser?.email || "").toLowerCase();
      astate.currentTeamMember = astate.teamMembers.find((member) => String(member.email || "").toLowerCase() === currentEmail) || astate.currentTeamMember;
      if (!astate.selectedAvailabilityDate) astate.selectedAvailabilityDate = localDateText(new Date());
      if (!astate.calendarMonth) astate.calendarMonth = astate.selectedAvailabilityDate.slice(0, 7) + "-01";
      setAvailabilityDraft(astate.selectedAvailabilityDate);
    } catch (e) {
      loadSucceeded = false;
      astate.loadError = (e && e.message) || String(e);
      astate.orders = []; astate.menu = [];
    }
  } else {
    if (window.SLOW_STUDIO_DEMO_MODE) {
      loadAdminDemoData();
      astate.availabilityMarket = DASHBOARD_MARKET;
      astate.selectedAvailabilityDate = astate.selectedAvailabilityDate || localDateText(new Date());
      astate.calendarMonth = astate.calendarMonth || astate.selectedAvailabilityDate.slice(0, 7) + "-01";
      setAvailabilityDraft(astate.selectedAvailabilityDate);
    }
    else { astate.orders = []; astate.menu = []; }
  }
  astate.loading = false;
  if (loadSucceeded) astate.dashboardLastUpdated = new Date();
  render();
  subscribeToOrderChanges();
}

async function refreshDashboard() {
  if (astate.dashboardRefreshing) return;
  astate.dashboardRefreshing = true;
  astate.loadError = null;
  render();
  try {
    await loadAll({ silent: true });
  } finally {
    astate.dashboardRefreshing = false;
    render();
  }
}

function focusDashboardIssue(type, id = "") {
  if (type === "food_cost") {
    astate.dashboardFocusTarget = { type, id: String(id) };
    astate.tab = "inventory";
    astate.recipeProductId = id;
    beginRecipeDraft(id);
    render();
    requestAnimationFrame(() => {
      const target = document.getElementById("food-cost-editor");
      if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.classList.add("dashboard-target-highlight"); }
      const field = document.getElementById("food-cost-add-item");
      if (field) field.focus({ preventScroll: true });
    });
    return;
  }
  if (type === "payment_review") {
    astate.orderFilter = "payment";
    astate.tab = "orders";
    render();
  }
}

async function confirmPayment(id) {
  const order = astate.orders.find((o) => String(o.id) === String(id));
  if (!order) return;
  if (!confirm(`Confirm payment received for ${order.order_number || order.id}?`)) return;

  const previousPaymentStatus = order.payment_status;
  const previousOrderStatus = order.order_status;
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status: "paid", order_status: "confirmed" } : o));
  render();

  if (IS_CONFIGURED) {
    const { error } = await db.from("orders").update({ payment_status: "paid", order_status: "confirmed" }).eq("id", id);
    if (error) {
      astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, payment_status: previousPaymentStatus, order_status: previousOrderStatus } : o));
      render();
      alert("Could not confirm payment: " + error.message);
      return;
    }
  }
}

async function rejectPayment(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  if (!order) return;
  const reason = prompt("Tell the customer why the screenshot was rejected:", "The screenshot is unclear. Please upload a clearer payment confirmation.");
  if (!reason?.trim()) return;
  const fields = { payment_status: "rejected", order_status: "pending", payment_rejection_reason: reason.trim() };
  const { error } = await db.from("orders").update(fields).eq("id", id);
  if (error) { alert("Could not reject payment: " + error.message); return; }
  astate.orders = astate.orders.map((item) => String(item.id) === String(id) ? { ...item, ...fields } : item);
  render();
}

async function openPaymentProof(path) {
  if (!path) return;
  const proofWindow = window.open("", "_blank");
  if (!proofWindow) { alert("Please allow pop-ups to open the payment screenshot."); return; }
  if (/^https?:\/\//i.test(path)) { proofWindow.location.href = path; return; }
  if (!IS_CONFIGURED) { proofWindow.close(); return; }
  const { data, error } = await db.storage.from("payment-proofs").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    proofWindow.close();
    alert("Could not open the payment screenshot.\n\n" + ((error && error.message) || "The screenshot link is missing."));
    return;
  }
  proofWindow.location.href = data.signedUrl;
}
async function updateOrderStatus(id, order_status, skipConfirmation = false) {
  const order = astate.orders.find((o) => String(o.id) === String(id));
  if (!order || order.order_status === order_status) return;
  const nextLabel = ORDER_LABEL[order_status] || order_status;
  if (!skipConfirmation && !confirm(`Change ${order.order_number || "this order"} to ${nextLabel}?`)) { render(); return; }
  const previousStatus = order.order_status;
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status } : o));
  render();
  if (IS_CONFIGURED) {
    const { error } = await db.from("orders").update({ order_status }).eq("id", id);
    if (error) {
      astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status: previousStatus } : o));
      render();
      alert("Could not update this order: " + error.message);
    } else if (order_status === "collected") {
      await refreshLoyaltyBalances();
    }
  }
}
async function refreshLoyaltyBalances() {
  if (!IS_CONFIGURED) return;
  const [{ data, error }, { data: transactions, error: transactionError }] = await Promise.all([
    db.from("customer_loyalty").select("*"),
    db.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(500)
  ]);
  if (error) { console.warn("Could not refresh reward balances:", error.message); return; }
  if (transactionError) console.warn("Could not refresh reward history:", transactionError.message);
  astate.customerLoyalty = Object.fromEntries((data || []).map((row) => [row.customer_key, row]));
  if (!transactionError) astate.loyaltyTransactions = transactions || [];
}
function nextFulfilmentStatus(order) {
  if (!order || order.payment_status !== "paid") return null;
  if (["pending", "awaiting_confirmation", "confirmed"].includes(order.order_status)) return "preparing";
  if (order.order_status === "preparing") return "ready";
  if (order.order_status === "ready") return "collected";
  return null;
}
async function advanceOrderStatus(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  const next = nextFulfilmentStatus(order);
  if (!next) return;
  await updateOrderStatus(id, next, true);
}

function toggleOrderExpanded(id) {
  const key = String(id);
  astate.expandedOrderIds = astate.expandedOrderIds.includes(key) ? astate.expandedOrderIds.filter((item) => item !== key) : [...astate.expandedOrderIds, key];
  render();
}
function openRelatedOrder(orderId, orderNumber = "") {
  const order = astate.orders.find((item) => String(item.id) === String(orderId))
    || astate.orders.find((item) => String(item.order_number) === String(orderNumber));
  if (!order) { alert("This related order could not be found."); return; }
  astate.orderFilter = "all";
  astate.orderSearch = String(order.order_number || order.id || "");
  astate.expandedOrderIds = [String(order.id)];
  setTab("orders");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const targets = [...document.querySelectorAll(`[data-order-id="${String(order.id).replace(/"/g, "\\\"")}"]`)];
    (targets.find((element) => element.offsetParent !== null) || targets[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
}
function toggleBulkOrderMode() { astate.bulkOrderMode = !astate.bulkOrderMode; if (!astate.bulkOrderMode) astate.selectedOrderIds = []; render(); }
function toggleOrderSelected(id, checked) {
  const key = String(id);
  astate.selectedOrderIds = checked ? [...new Set([...astate.selectedOrderIds, key])] : astate.selectedOrderIds.filter((item) => item !== key);
  render();
}
function bulkEligible(order, status) {
  if (order.payment_status !== "paid" || ["cancelled", "collected"].includes(order.order_status)) return false;
  if (status === "preparing") return ["confirmed", "preparing"].includes(order.order_status);
  if (status === "ready") return ["confirmed", "preparing", "ready"].includes(order.order_status);
  return status === "collected" && ["ready", "collected"].includes(order.order_status);
}
async function bulkUpdateOrderStatus(status) {
  const selected = astate.orders.filter((order) => astate.selectedOrderIds.includes(String(order.id)));
  const eligible = selected.filter((order) => bulkEligible(order, status) && order.order_status !== status);
  const skipped = selected.length - eligible.length;
  if (!eligible.length) return alert("None of the selected orders can safely move to this status.");
  if (!confirm(`Change ${eligible.length} order${eligible.length === 1 ? "" : "s"} to ${ORDER_LABEL[status]}?${skipped ? `\n\n${skipped} incompatible order(s) will be skipped.` : ""}`)) return;
  const ids = eligible.map((order) => order.id);
  const previous = new Map(eligible.map((order) => [String(order.id), order.order_status]));
  astate.orders = astate.orders.map((order) => ids.map(String).includes(String(order.id)) ? { ...order, order_status: status } : order);
  render();
  const { error } = await db.from("orders").update({ order_status: status }).in("id", ids);
  if (error) {
    astate.orders = astate.orders.map((order) => previous.has(String(order.id)) ? { ...order, order_status: previous.get(String(order.id)) } : order);
    render();
    return alert("Could not update selected orders: " + error.message);
  }
  astate.selectedOrderIds = [];
  astate.bulkOrderMode = false;
  if (status === "collected") await refreshLoyaltyBalances();
  render();
  if (skipped) alert(`${eligible.length} updated. ${skipped} incompatible order(s) were safely skipped.`);
}
async function cancelOrder(id) {
  if (!confirm("Cancel this order? This can't be undone from here.")) return;
  astate.orders = astate.orders.map((o) => (String(o.id) === String(id) ? { ...o, order_status: "cancelled" } : o));
  render();
  if (IS_CONFIGURED) {
    const { error } = await db.from("orders").update({ order_status: "cancelled" }).eq("id", id);
    if (error) alert("Could not cancel order: " + error.message);
  }
}
async function deleteCancelledOrder(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  if (!order || order.order_status !== "cancelled") return alert("Only cancelled orders can be deleted.");
  if (!confirm(`Permanently delete cancelled order ${order.order_number || order.id}?\n\nThis removes the order and its item details and cannot be undone.`)) return;
  const { data, error } = await db.from("orders").delete().eq("id", id).eq("order_status", "cancelled").select("id");
  if (error) return alert("Could not delete this cancelled order: " + error.message);
  if (!(data || []).length) return alert("The order was not deleted. Refresh and confirm it is still cancelled.");
  await Promise.all([
    db.from("promo_redemptions").delete().eq("order_id", id),
    db.from("order_messages").delete().eq("order_id", String(id)),
  ]);
  astate.orders = astate.orders.filter((item) => String(item.id) !== String(id));
  astate.promoRedemptions = astate.promoRedemptions.filter((item) => String(item.order_id) !== String(id));
  astate.messages = astate.messages.filter((item) => String(item.order_id) !== String(id));
  astate.expandedOrderIds = astate.expandedOrderIds.filter((item) => item !== String(id));
  render();
}

/* ---- menu (products) CRUD — unchanged from before ---- */
function newMenuItem() {
  const firstGroup = astate.productGroups[0];
  astate.editing = { id: null, enabled_option_group_ids: [], group_id: firstGroup?.id || null, category: firstGroup?.name || "Signature", name: "", description: "", price: 0, discount_price: null, image_url: "", is_available: true, show_price_on_menu: true, is_bundle: false, bundle_product_ids: [], bundle_pricing_mode: "fixed", bundle_selection_count: 2, bundle_option_prices: {}, bundle_show_choice_prices: false, bundle_display_from_price: null, malaysia_available: false, myr_price: null, bundle_myr_option_prices: {}, bundle_myr_display_from_price: null, stock: 0, sort_order: astate.menu.length + 1 };
  render();
}
function editMenuItem(id) {
  const item = astate.menu.find((m) => String(m.id) === String(id));
  const enabled_option_group_ids = astate.productOptionGroups.filter((row) => String(row.product_id) === String(id)).map((row) => String(row.option_group_id));
  astate.editing = { ...item, enabled_option_group_ids };
  render();
}
function cancelEdit() { astate.editing = null; render(); }
function onEditField(key, value) {
  if (key === "discount_price") astate.editing[key] = value === "" ? null : (parseFloat(value) || 0);
  else if (["bundle_display_from_price", "bundle_myr_display_from_price", "myr_price"].includes(key)) astate.editing[key] = value === "" ? null : Math.max(0, Number(value || 0));
  else if (key === "price" || key === "stock") astate.editing[key] = parseFloat(value) || 0;
  else astate.editing[key] = value;
}
function onEditGroup(value) {
  const group = astate.productGroups.find((item) => String(item.id) === String(value));
  astate.editing.group_id = group ? group.id : null;
  astate.editing.category = group ? group.name : "Other";
}
function toggleBundleProduct(productId, checked) {
  const ids = Array.isArray(astate.editing.bundle_product_ids) ? astate.editing.bundle_product_ids.map(String) : [];
  astate.editing.bundle_product_ids = checked ? [...new Set([...ids, String(productId)])] : ids.filter((id) => id !== String(productId));
  if (!checked && astate.editing.bundle_option_prices) delete astate.editing.bundle_option_prices[String(productId)];
}
function setBundleOptionPrice(productId, value) {
  const prices = astate.editing.bundle_option_prices && typeof astate.editing.bundle_option_prices === "object"
    ? { ...astate.editing.bundle_option_prices } : {};
  if (value === "") delete prices[String(productId)];
  else prices[String(productId)] = Math.max(0, Number(value || 0));
  astate.editing.bundle_option_prices = prices;
}
function setBundleMyrOptionPrice(productId, value) {
  const prices = astate.editing.bundle_myr_option_prices && typeof astate.editing.bundle_myr_option_prices === "object"
    ? { ...astate.editing.bundle_myr_option_prices } : {};
  if (value === "") delete prices[String(productId)];
  else prices[String(productId)] = Math.max(0, Number(value || 0));
  astate.editing.bundle_myr_option_prices = prices;
}

function toggleProductOptionGroup(groupId, checked) {
  const ids = Array.isArray(astate.editing.enabled_option_group_ids) ? astate.editing.enabled_option_group_ids.map(String) : [];
  astate.editing.enabled_option_group_ids = checked ? [...new Set([...ids, String(groupId)])] : ids.filter((id) => id !== String(groupId));
}
async function saveProductOptionMappings(productId, groupIds) {
  const { error: deleteError } = await db.from("product_option_groups").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;
  const rows = (groupIds || []).map((groupId) => ({ product_id: productId, option_group_id: groupId }));
  if (rows.length) {
    const { error: insertError } = await db.from("product_option_groups").insert(rows);
    if (insertError) throw insertError;
  }
  astate.productOptionGroups = [
    ...astate.productOptionGroups.filter((row) => String(row.product_id) !== String(productId)),
    ...rows,
  ];
}
async function uploadStorefrontImage(input, target) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
  if (file.size > 8 * 1024 * 1024) { alert("Please use an image smaller than 8 MB."); return; }
  if (window.SLOW_STUDIO_DEMO_MODE) {
    const reader = new FileReader();
    reader.onload = () => {
      if (target === "products") astate.editing.image_url = reader.result;
      else astate.settingsDraft[target] = reader.result;
      try { localStorage.setItem(`slow-studio-exact-demo-settings-${DASHBOARD_MARKET.toLowerCase()}`, JSON.stringify(astate.settingsDraft)); } catch (_) {}
      render();
    };
    reader.readAsDataURL(file);
    return;
  }
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
  const path = `${target}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await db.storage.from("storefront-images").upload(path, file, { upsert: false, contentType: file.type });
  if (error) { alert("Could not upload image: " + error.message); return; }
  const { data } = db.storage.from("storefront-images").getPublicUrl(path);
  if (target === "products") astate.editing.image_url = data.publicUrl;
  else { astate.settingsDraft[target] = data.publicUrl; }
  render();
}
async function uploadMarketingAttachment(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const allowed = file.type.startsWith("image/") || ["application/pdf","text/plain","text/csv","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type);
  if (!allowed) { alert("Please choose an image, PDF, Word, Excel, CSV or text file."); return; }
  if (file.size > 8 * 1024 * 1024) { alert("Please use a file smaller than 8 MB."); return; }
  astate.marketingAttachmentUploading = true; render();
  const extension = (file.name.split(".").pop() || "file").replace(/[^a-z0-9]/gi, "");
  const path = `marketing/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${extension}`;
  const { error } = await db.storage.from("storefront-images").upload(path, file, { upsert:false, contentType:file.type || "application/octet-stream" });
  if (error) { astate.marketingAttachmentUploading=false; alert("Could not upload attachment: " + error.message); render(); return; }
  const { data } = db.storage.from("storefront-images").getPublicUrl(path);
  astate.settingsDraft.marketing_attachment_url = data.publicUrl;
  astate.settingsDraft.marketing_attachment_name = file.name;
  astate.settingsDraft.marketing_attachment_type = file.type || "application/octet-stream";
  astate.marketingAttachmentUploading = false; render();
}
function removeMarketingAttachment() {
  astate.settingsDraft.marketing_attachment_url = null;
  astate.settingsDraft.marketing_attachment_name = null;
  astate.settingsDraft.marketing_attachment_type = null;
  render();
}
async function saveMenuItem() {
  const item = astate.editing;
  if (!item.name.trim()) { alert("Name is required."); return; }
  if (!IS_CONFIGURED) {
    if (window.SLOW_STUDIO_DEMO_MODE) {
      const saved={...item,id:item.id||`demo-${Date.now()}`};
      const index=astate.menu.findIndex(row=>String(row.id)===String(saved.id));
      if(index>=0) astate.menu[index]=saved; else astate.menu.push(saved);
      localStorage.setItem(`slow-studio-exact-demo-products-${DASHBOARD_MARKET.toLowerCase()}`,JSON.stringify(astate.menu));
      astate.editing=null;render();return;
    }
    alert("Demo mode: connect Supabase to persist menu changes."); astate.editing = null; render(); return;
  }
  const btn = document.getElementById("save-btn");
  if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }
  try {
    const enabledGroupIds = Array.isArray(item.enabled_option_group_ids) ? item.enabled_option_group_ids : [];
    const { enabled_option_group_ids, ...cleanItem } = item;
    let savedProductId;
    if (item.id) {
      const { id, ...fields } = cleanItem;
      const { error } = await db.from("products").update(fields).eq("id", id);
      if (error) throw error;
      savedProductId = id;
      astate.menu = astate.menu.map((m) => (String(m.id) === String(id) ? cleanItem : m));
    } else {
      const { id, ...fields } = cleanItem;
      const { data, error } = await db.from("products").insert(fields).select().single();
      if (error) throw error;
      savedProductId = data.id;
      astate.menu = [...astate.menu, data];
    }
    await saveProductOptionMappings(savedProductId, enabledGroupIds);
    astate.editing = null;
    render();
  } catch (e) {
    alert("Could not save: " + ((e && e.message) || String(e)));
    if (btn) { btn.textContent = "Save"; btn.disabled = false; }
  }
}
async function deleteMenuItem(id) {
  if (!confirm("Delete this item?")) return;
  astate.menu = astate.menu.filter((m) => String(m.id) !== String(id));
  render();
  if (IS_CONFIGURED) await db.from("products").delete().eq("id", id);
}


let adminDragState = null;
function startAdminDrag(event, scope, index) {
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const handle = event.currentTarget;
  const row = handle.closest('.admin-sortable-item');
  if (!row) return;
  const list = row.parentElement;
  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.classList.add('admin-drag-ghost');
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.appendChild(ghost);
  row.classList.add('admin-drag-source');
  adminDragState = { scope, row, list, ghost, offsetY: event.clientY - rect.top };
  handle.setPointerCapture?.(event.pointerId);
  document.body.classList.add('admin-is-dragging');
  document.addEventListener('pointermove', moveAdminDrag, { passive:false });
  document.addEventListener('pointerup', endAdminDrag, { once:true });
  document.addEventListener('pointercancel', endAdminDrag, { once:true });
}
function moveAdminDrag(event) {
  if (!adminDragState) return;
  event.preventDefault();
  const { ghost, list, row, scope } = adminDragState;
  ghost.style.top = `${event.clientY - adminDragState.offsetY}px`;
  const candidates = [...list.querySelectorAll(`.admin-sortable-item[data-sort-scope="${scope}"]`)].filter((item) => item !== row);
  const target = candidates.find((item) => {
    const r = item.getBoundingClientRect();
    return event.clientY >= r.top && event.clientY <= r.bottom;
  });
  if (!target) return;
  const r = target.getBoundingClientRect();
  if (event.clientY < r.top + r.height / 2) list.insertBefore(row, target);
  else list.insertBefore(row, target.nextSibling);
}
function endAdminDrag() {
  if (!adminDragState) return;
  const { scope, list, ghost, row } = adminDragState;
  const orderedKeys = [...list.querySelectorAll(`.admin-sortable-item[data-sort-scope="${scope}"]`)].map((el) => el.dataset.sortKey);
  if (scope === 'productGroups') {
    const map = new Map(astate.productGroups.map((item, index) => [String(item.id ?? `new-${index}`), item]));
    astate.productGroups = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.productGroups.forEach((item, index) => { item.sort_order = index + 1; });
  } else if (scope === 'optionGroups') {
    const map = new Map(astate.optionGroups.map((item, index) => [String(item.id ?? `new-${index}`), item]));
    astate.optionGroups = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.optionGroups.forEach((item, index) => { item.sort_order = index + 1; });
  } else if (scope === 'products') {
    const map = new Map(astate.menu.map((item) => [String(item.id), item]));
    astate.menu = orderedKeys.map((key) => map.get(key)).filter(Boolean);
    astate.menu.forEach((item, index) => { item.sort_order = index + 1; });
  }
  ghost.remove();
  row.classList.remove('admin-drag-source');
  document.body.classList.remove('admin-is-dragging');
  document.removeEventListener('pointermove', moveAdminDrag);
  adminDragState = null;
  render();
}
function dragHandle(scope, index) {
  return `<button type="button" class="admin-drag-handle" aria-label="Drag to reorder" title="Drag to reorder" onpointerdown="startAdminDrag(event,'${scope}',${index})"><span class="drag-dots" aria-hidden="true">⋮⋮</span></button>`;
}
function addProductGroup() { astate.productGroups = [...astate.productGroups, { id: null, name: "", sort_order: astate.productGroups.length, is_visible: true }]; render(); }
function onGroupField(index, key, value) { astate.productGroups[index][key] = key === "sort_order" ? Number(value || 0) : value; }
async function deleteProductGroup(index) {
  const group = astate.productGroups[index];
  if (!group) return;
  const groupHasProducts = astate.menu.some((product) => String(product.group_id) === String(group.id));
  if (groupHasProducts) { alert("Move or delete the products in this group before deleting the group."); return; }
  if (!confirm(`Delete the product group “${group.name || "Untitled"}”?`)) return;
  if (group.id && IS_CONFIGURED) {
    const { error } = await db.from("product_groups").delete().eq("id", group.id);
    if (error) { alert("Could not delete group: " + error.message); return; }
  }
  astate.productGroups.splice(index, 1);
  render();
}
async function saveProductGroups() {
  const rows = astate.productGroups.filter((group) => String(group.name || "").trim());
  for (let index = 0; index < rows.length; index++) {
    const group = rows[index];
    const fields = { name: String(group.name).trim(), sort_order: Number(group.sort_order ?? index), is_visible: !!group.is_visible };
    const query = group.id ? db.from("product_groups").update(fields).eq("id", group.id).select().single() : db.from("product_groups").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save group: " + error.message); return; }
    Object.assign(group, data);
  }
  astate.productGroups = rows.sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  alert("Product groups saved."); render();
}

/* ---- drink customisation: Ice, Sweetness, etc. ---- */
function drinkOptionsForGroup(groupId) {
  return astate.options.map((option, index) => ({ option, index })).filter(({ option }) => String(option.option_group_id) === String(groupId));
}
function addDrinkOptionGroup() {
  astate.optionGroups = [...astate.optionGroups, { id: null, name: "", required: true, is_visible: true, sort_order: astate.optionGroups.length + 1 }];
  render();
}
function onDrinkOptionGroupField(index, key, value) {
  astate.optionGroups[index][key] = (key === "required" || key === "is_visible") ? !!value : value;
}
async function deleteDrinkOptionGroup(index) {
  const group = astate.optionGroups[index];
  if (!group) return;
  if (group.id && drinkOptionsForGroup(group.id).length) {
    alert("Delete this group's choices first, then you can delete the group.");
    return;
  }
  if (!confirm(`Delete the drink option group “${group.name || "Untitled"}”?`)) return;
  if (group.id && IS_CONFIGURED) {
    const { error } = await db.from("option_groups").delete().eq("id", group.id);
    if (error) { alert("Could not delete option group: " + error.message); return; }
  }
  astate.optionGroups.splice(index, 1);
  render();
}
async function saveDrinkOptionGroups() {
  const rows = astate.optionGroups.filter((group) => String(group.name || "").trim());
  for (const group of rows) {
    const fields = { name: String(group.name).trim(), required: !!group.required, is_visible: group.is_visible !== false, sort_order: Number(group.sort_order || rows.indexOf(group) + 1) };
    const query = group.id ? db.from("option_groups").update(fields).eq("id", group.id).select().single() : db.from("option_groups").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save drink option group: " + error.message); return; }
    Object.assign(group, data);
  }
  astate.optionGroups = rows.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  alert("Drink option groups saved. You can now add choices below.");
  render();
}
function addDrinkOption(groupId) {
  if (!groupId) { alert("Save this new option group first, then add its choices."); return; }
  astate.options = [...astate.options, { id: null, option_group_id: groupId, name: "", price: 0, is_available: true }];
  render();
}
function onDrinkOptionField(index, key, value) {
  astate.options[index][key] = key === "price" ? Number(value || 0) : key === "is_available" ? !!value : value;
}
async function deleteDrinkOption(index) {
  const option = astate.options[index];
  if (!option || !confirm(`Delete “${option.name || "this choice"}”?`)) return;
  if (option.id && IS_CONFIGURED) {
    const { error } = await db.from("options").delete().eq("id", option.id);
    if (error) { alert("Could not delete choice: " + error.message); return; }
  }
  astate.options.splice(index, 1);
  render();
}
async function saveDrinkOptions() {
  const rows = astate.options.filter((option) => String(option.name || "").trim());
  for (const option of rows) {
    const numericPrice = Number(option.price || 0);
    const fields = { option_group_id: option.option_group_id, name: String(option.name).trim(), price: Number.isFinite(numericPrice) ? numericPrice : 0, is_available: option.is_available !== false };
    const query = option.id ? db.from("options").update(fields).eq("id", option.id).select().single() : db.from("options").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save drink choice: " + error.message); return; }
    Object.assign(option, data);
  }
  astate.options = rows;
  alert("Drink choices saved.");
  render();
}
function renderDrinkOptionsManager() {
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:20px;">
    <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Drink customisation</h2><span>Manage Ice, Sweetness and any future drink choices</span></div>
    ${astate.optionGroups.length ? astate.optionGroups.map((group, groupIndex) => {
      const choices = drinkOptionsForGroup(group.id);
      return `<div class="admin-sortable-item admin-option-group-card" data-sort-scope="optionGroups" data-sort-key="${escapeHtml(String(group.id ?? `new-${groupIndex}`))}">
        ${dragHandle("optionGroups", groupIndex)}
        <div class="admin-sortable-content">
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:9px;align-items:center;">
          <input value="${escapeHtml(group.name || "")}" placeholder="e.g. Ice" oninput="onDrinkOptionGroupField(${groupIndex},'name',this.value)">
          <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.required ? "checked" : ""} onchange="onDrinkOptionGroupField(${groupIndex},'required',this.checked)"> Required</label>
          <label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.is_visible !== false ? "checked" : ""} onchange="onDrinkOptionGroupField(${groupIndex},'is_visible',this.checked)"> Show</label>
          <button class="link-danger" style="font-size:12px;" onclick="deleteDrinkOptionGroup(${groupIndex})">Delete</button>
        </div>
        ${group.id ? `<div style="margin-top:12px;">${choices.length ? choices.map(({ option, index }) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 110px auto auto;gap:9px;align-items:center;margin:8px 0;"><input value="${escapeHtml(option.name || "")}" placeholder="e.g. Less Ice" oninput="onDrinkOptionField(${index},'name',this.value)"><input type="number" step="0.10" value="${Number(option.price || 0)}" title="Price adjustment — use -1 for $1 off" aria-label="Price adjustment" oninput="onDrinkOptionField(${index},'price',this.value)"><label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${option.is_available !== false ? "checked" : ""} onchange="onDrinkOptionField(${index},'is_available',this.checked)"> Show</label><button class="link-danger" style="font-size:12px;" onclick="deleteDrinkOption(${index})">Delete</button></div>`).join("") : `<div class="hint" style="text-align:left;margin:6px 0;">No choices yet.</div>`}<div class="hint" style="text-align:left;margin:6px 0;">Price adjustment accepts additions and reductions, for example <b>1</b> adds $1 and <b>-1</b> deducts $1.</div><button class="btn-secondary" style="margin-top:6px;" onclick="addDrinkOption('${group.id}')">+ Add choice</button></div>` : `<div class="hint" style="text-align:left;margin:10px 0 0;">Save this new group first, then add choices such as Normal Ice or Less Ice.</div>`}
      </div></div>`;
    }).join("") : `<div class="dashboard-empty">No drink option groups yet. Add Ice or Sweetness below.</div>`}
    <div class="btn-row" style="margin-top:14px;"><button class="btn-secondary" onclick="addDrinkOptionGroup()">+ Add option group</button><button class="btn-primary" onclick="saveDrinkOptionGroups()">Save groups</button><button class="btn-primary" onclick="saveDrinkOptions()">Save choices</button></div>
  </section>`;
}

/* ---- store settings ---- */
function onSettingsField(key, value) { astate.settingsDraft[key] = value; }
function settingsCollectionPoints() {
  const points = astate.settingsDraft?.collection_points;
  return Array.isArray(points) && points.length ? points : ["Blk 130A", "Near Creamier"];
}
function settingsCollectionPointDetails() {
  const saved = Array.isArray(astate.settingsDraft?.collection_point_details) ? astate.settingsDraft.collection_point_details : [];
  return settingsCollectionPoints().map((name) => {
    const match = saved.find((item) => String(item?.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()) || {};
    return { name, area: match.area || name, address: match.address || "", google_maps_url: match.google_maps_url || "" };
  });
}
function syncCollectionPointDetails(details) { astate.settingsDraft.collection_point_details = details; }
function editCollectionPoint(index, value) { const points = [...settingsCollectionPoints()]; const details = settingsCollectionPointDetails(); points[index] = value; details[index] = { ...details[index], name: value }; astate.settingsDraft.collection_points = points; syncCollectionPointDetails(details); }
function editCollectionPointDetail(index, key, value) { const details = settingsCollectionPointDetails(); details[index] = { ...details[index], [key]: value }; syncCollectionPointDetails(details); }
function addCollectionPoint() { const name = "New collection point"; astate.settingsDraft.collection_points = [...settingsCollectionPoints(), name]; syncCollectionPointDetails([...settingsCollectionPointDetails(), { name, area: name, address: "", google_maps_url: "" }]); render(); }
function deleteCollectionPoint(index) { const points = [...settingsCollectionPoints()]; const details = settingsCollectionPointDetails(); if (points.length <= 1) return alert("Keep at least one collection point."); points.splice(index, 1); details.splice(index, 1); astate.settingsDraft.collection_points = points; syncCollectionPointDetails(details); render(); }
function moveCollectionPoint(index, direction) { const points = [...settingsCollectionPoints()]; const details = settingsCollectionPointDetails(); const next = index + direction; if (next < 0 || next >= points.length) return; [points[index], points[next]] = [points[next], points[index]]; [details[index], details[next]] = [details[next], details[index]]; astate.settingsDraft.collection_points = points; syncCollectionPointDetails(details); render(); }
function updateStorefrontPreview() {
  const circle = document.getElementById("logo-live-preview");
  const logo = document.getElementById("logo-live-preview-image");
  const banner = document.getElementById("banner-live-preview");
  const circleValue = document.getElementById("logo-circle-value");
  const imageValue = document.getElementById("logo-image-value");
  const logoXValue = document.getElementById("logo-x-value");
  const logoYValue = document.getElementById("logo-y-value");
  const bannerXValue = document.getElementById("banner-x-value");
  const bannerYValue = document.getElementById("banner-y-value");
  const heightValue = document.getElementById("banner-height-value");
  if (circle && astate.settingsDraft) circle.style.width = circle.style.height = `${Number(astate.settingsDraft.logo_circle_size || 68)}px`;
  const s = astate.settingsDraft || {};
  const logoX = Number(s.logo_image_x || 0), logoY = Number(s.logo_image_y || 0);
  const bannerX = Number(s.hero_image_x ?? 50), bannerY = Number(s.hero_image_y ?? s.hero_image_position ?? 68);
  if (logo) logo.style.transform = `translate(${logoX}%, ${logoY}%) scale(${Number(s.logo_image_scale || 1)})`;
  if (banner) banner.style.objectPosition = `${bannerX}% ${bannerY}%`;
  if (circleValue) circleValue.textContent = `${Number(astate.settingsDraft.logo_circle_size || 68)} px`;
  if (imageValue) imageValue.textContent = `${Number(astate.settingsDraft.logo_image_scale || 1).toFixed(2)}×`;
  if (logoXValue) logoXValue.textContent = `${logoX > 0 ? "+" : ""}${logoX}%`;
  if (logoYValue) logoYValue.textContent = `${logoY > 0 ? "+" : ""}${logoY}%`;
  if (bannerXValue) bannerXValue.textContent = `${bannerX}%`;
  if (bannerYValue) bannerYValue.textContent = `${bannerY}%`;
  if (heightValue) heightValue.textContent = `${Number(astate.settingsDraft.hero_banner_height || 190)} px`;
}

function updateWelcomeLogoPreview() {
  const frame = document.getElementById("welcome-logo-live-preview");
  const image = document.getElementById("welcome-logo-live-preview-image");
  const circleValue = document.getElementById("welcome-logo-circle-value");
  const imageValue = document.getElementById("welcome-logo-image-value");
  const xValue = document.getElementById("welcome-logo-x-value");
  const yValue = document.getElementById("welcome-logo-y-value");
  if (!astate.settingsDraft) return;
  const s = astate.settingsDraft;
  const size = Number(s.welcome_logo_circle_size || s.logo_circle_size || 100);
  const scale = Number(s.welcome_logo_image_scale || s.logo_image_scale || 1);
  const x = Number(s.welcome_logo_image_x || 0);
  const y = Number(s.welcome_logo_image_y || 0);
  if (frame) frame.style.width = frame.style.height = `${size}px`;
  if (image) image.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
  if (circleValue) circleValue.textContent = `${size} px`;
  if (imageValue) imageValue.textContent = `${scale.toFixed(2)}×`;
  if (xValue) xValue.textContent = `${x > 0 ? "+" : ""}${x}%`;
  if (yValue) yValue.textContent = `${y > 0 ? "+" : ""}${y}%`;
}
async function saveSettings() {
  if (!astate.settings) { alert("No store_settings row found — add one in Supabase first."); return; }
  const btn = document.getElementById("settings-save-btn");
  if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }
  const { id, created_at, updated_at, ...fields } = astate.settingsDraft;
  if (window.SLOW_STUDIO_DEMO_MODE) {
    astate.settings={...astate.settingsDraft};
    try { localStorage.setItem(`slow-studio-exact-demo-settings-${DASHBOARD_MARKET.toLowerCase()}`,JSON.stringify(astate.settings)); } catch (_) {}
    if (btn) { btn.textContent="Save settings"; btn.disabled=false; }
    alert("Demo settings saved in this browser only."); render(); return;
  }
  const { error } = await db.from("store_settings").update(fields).eq("id", astate.settings.id);
  if (btn) { btn.textContent = "Save settings"; btn.disabled = false; }
  if (error) { alert("Could not save: " + error.message); return; }
  astate.settings = { ...astate.settingsDraft };
  alert("Saved.");
  render();
}

function onNotificationField(key, value) { astate.notificationDraft[key] = value; }
function fillCustomerEmailTemplate(template, values) {
  return String(template || "").replace(/\{(customer_name|order_number|date|time|collection_point|total)\}/g, (_, key) => String(values[key] ?? ""));
}
function updateCustomerConfirmationPreviews() {
  const values = { customer_name:"Shermin", order_number:"SL-SAMPLE", date:"30 Aug 2026", time:"11:30 AM", collection_point:"Near Creamier", total:"$13.80", order_items:"• 1 × Ichigo Matcha Latte\n• 1 × Strawberry Milk" };
  const reviewPreview = document.getElementById("payment-review-email-template-preview");
  const reviewSubject = document.getElementById("payment-review-email-subject-preview");
  const emailPreview = document.getElementById("customer-email-template-preview");
  const emailSubject = document.getElementById("customer-email-subject-preview");
  const readyEmailPreview = document.getElementById("customer-ready-email-template-preview");
  const readyEmailSubject = document.getElementById("customer-ready-email-subject-preview");
  const whatsappPreview = document.getElementById("notification-whatsapp-template-preview");
  if (reviewPreview) reviewPreview.textContent = `${fillCustomerEmailTemplate(astate.notificationDraft?.payment_review_email_heading_template,values)}\n\n${fillCustomerEmailTemplate(astate.notificationDraft?.payment_review_email_message_template,values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  if (reviewSubject) reviewSubject.textContent = fillCustomerEmailTemplate(astate.notificationDraft?.payment_review_email_subject_template,values);
  if (emailPreview) emailPreview.textContent = `${fillCustomerEmailTemplate(astate.notificationDraft?.customer_email_heading_template,values)}\n\n${fillCustomerEmailTemplate(astate.notificationDraft?.customer_email_message_template,values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  if (emailSubject) emailSubject.textContent = fillCustomerEmailTemplate(astate.notificationDraft?.customer_email_subject_template,values);
  if (readyEmailPreview) readyEmailPreview.textContent = `${fillCustomerEmailTemplate(astate.notificationDraft?.customer_ready_email_heading_template,values)}\n\n${fillCustomerEmailTemplate(astate.notificationDraft?.customer_ready_email_message_template,values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  if (readyEmailSubject) readyEmailSubject.textContent = fillCustomerEmailTemplate(astate.notificationDraft?.customer_ready_email_subject_template,values);
  if (whatsappPreview) whatsappPreview.textContent = fillWhatsAppConfirmationTemplate(astate.settingsDraft?.whatsapp_confirmation_template,values);
}
async function saveNotificationSettings() {
  if (!astate.notificationDraft) return;
  const draft = astate.notificationDraft;
  const email = String(draft.recipient_email || "").trim();
  if (draft.enabled && !/^\S+@\S+\.\S+$/.test(email)) {
    alert("Please enter a valid Gmail address before turning on alerts.");
    return;
  }
  const button = document.getElementById("notification-save-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const fields = {
    id: 1,
    recipient_email: email || null,
    webhook_url: String(draft.webhook_url || "").trim() || null,
    enabled: !!draft.enabled,
    alert_new_order: !!draft.alert_new_order,
    alert_payment_proof: !!draft.alert_payment_proof,
    alert_live_chat: draft.alert_live_chat !== false,
    customer_email_enabled: draft.customer_email_enabled !== false,
    customer_email_manual_only: false,
    payment_review_email_subject_template: String(draft.payment_review_email_subject_template || "We received your order · {order_number}").trim(),
    payment_review_email_heading_template: String(draft.payment_review_email_heading_template || "Hi {customer_name}, we received your order").trim(),
    payment_review_email_message_template: String(draft.payment_review_email_message_template || "Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.").trim(),
    customer_email_subject_template: String(draft.customer_email_subject_template || "Your order is confirmed · {order_number}").trim(),
    customer_email_heading_template: String(draft.customer_email_heading_template || "Your order is confirmed").trim(),
    customer_email_message_template: String(draft.customer_email_message_template || "Thank you for ordering with Shizuku Lab. We look forward to preparing your order.").trim(),
    customer_ready_email_enabled: draft.customer_ready_email_enabled !== false,
    customer_ready_email_subject_template: String(draft.customer_ready_email_subject_template || "Your order is ready for collection · {order_number}").trim(),
    customer_ready_email_heading_template: String(draft.customer_ready_email_heading_template || "Your order is ready for collection").trim(),
    customer_ready_email_message_template: String(draft.customer_ready_email_message_template || "Your order is ready for collection. We look forward to seeing you at your selected pickup time.").trim(),
  };
  // Update the existing row so the private webhook secret (configured only in
  // Supabase) is never overwritten by values coming from the browser.
  const { data, error } = await db.from("notification_settings").update(fields).eq("id", 1).select().single();
  if (error) { if (button) { button.textContent = "Save confirmation settings"; button.disabled = false; } alert("Could not save notification settings: " + error.message); return; }
  const confirmationFields = {
    whatsapp_confirmation_enabled: astate.settingsDraft?.whatsapp_confirmation_enabled !== false,
    whatsapp_confirmation_template: String(astate.settingsDraft?.whatsapp_confirmation_template || DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE).trim(),
  };
  const { data: storeData, error: storeError } = await db.from("store_settings").update(confirmationFields).eq("id", astate.settings.id).select().single();
  if (button) { button.textContent = "Save confirmation settings"; button.disabled = false; }
  if (storeError) { alert("Email settings were saved, but WhatsApp settings could not be saved: " + storeError.message); return; }
  astate.notificationSettings = data;
  astate.notificationDraft = { ...data };
  astate.settings = storeData;
  astate.settingsDraft = { ...storeData };
  alert("Email and WhatsApp confirmation settings saved.");
  render();
}

function adminEmailIsAllowed() {
  const email = String(astate.loginEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    astate.loginMessage = "Please enter the email address linked to your team account.";
    render();
    return false;
  }
  return true;
}

async function loginWithPassword() {
  if (!adminEmailIsAllowed()) return;
  if (!db) { astate.loginMessage = "Supabase is not connected yet."; render(); return; }
  if (!astate.loginPassword) { astate.loginMessage = "Please enter your password."; render(); return; }
  astate.loginMessage = "Signing in…";
  render();
  const { error } = await db.auth.signInWithPassword({
    email: String(astate.loginEmail || "").trim().toLowerCase(),
    password: astate.loginPassword,
  });
  astate.loginMessage = error
    ? "That Gmail or password is not correct. Please try again."
    : "Signed in.";
  if (!error) { astate.welcomePending = true; await checkAdminSession(); }
  render();
}

async function sendPasswordSetup() {
  if (!adminEmailIsAllowed()) return;
  if (!db) { astate.loginMessage = "Supabase is not connected yet."; render(); return; }
  astate.loginMessage = "Sending a password setup email…";
  render();
  const { error } = await db.auth.resetPasswordForEmail(String(astate.loginEmail || "").trim().toLowerCase(), {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });
  astate.loginMessage = error
    ? `We could not send the password setup email: ${error.message}`
    : "Check Gmail and set your password once. After that, you can sign in here with Gmail and password.";
  render();
}

async function saveNewPassword() {
  if (!db) return;
  if (astate.recoveryPassword.length < 10) {
    astate.loginMessage = "Please choose a password with at least 10 characters.";
    render();
    return;
  }
  if (astate.recoveryPassword !== astate.recoveryPasswordConfirm) {
    astate.loginMessage = "The two passwords do not match.";
    render();
    return;
  }
  astate.loginMessage = "Saving your password…";
  render();
  const { error } = await db.auth.updateUser({ password: astate.recoveryPassword });
  if (error) {
    astate.loginMessage = `We could not save your password: ${error.message}`;
    render();
    return;
  }
  astate.recoveryMode = false;
  astate.recoveryPassword = "";
  astate.recoveryPasswordConfirm = "";
  astate.loginMessage = "Password saved. You are now signed in.";
  astate.welcomePending = true;
  await checkAdminSession();
}

async function checkAdminSession() {
  if (!db) return;
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user) return;
  const email = String(data.user.email || "").toLowerCase();
  const { data: member, error: memberError } = await db
    .from("studio_users")
    .select("*")
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();
  const ownerFallback = email === String(ADMIN_EMAIL || "").toLowerCase();
  if ((member && !memberError) || ownerFallback) {
    astate.currentUser = data.user;
    astate.currentTeamMember = member || { auth_user_id: data.user.id, email, display_name: "Ting", role: "Owner", is_active: true };
    astate.unlocked = true;
    await loadAll();
  } else {
    astate.loginMessage = "This email does not have access to the Shizuku Lab dashboard.";
    await db.auth.signOut();
    render();
  }
}

async function logoutAdmin() {
  if (db) await db.auth.signOut();
  astate.unlocked = false;
  astate.currentUser = null;
  astate.currentTeamMember = null;
  astate.loginMessage = "You have signed out.";
  render();
}

function header(subtitle) {
  return `
  <div class="header">
    <div class="header-row">
      <div>
        <div class="display brand-title">${(astate.settings && astate.settings.store_name) || "Shizuku Lab"} — Shop</div>
        <div class="brand-sub">${subtitle}</div>
      </div>
    </div>
  </div>`;
}

function dashboardStyles() {
  return `<style>
    #app.wrap{width:100%;max-width:none!important;margin:0!important;padding:0!important}
    .shop-admin{min-height:100vh;background:#fffaf5;color:#292720;font-family:inherit;display:flex}
    .shop-admin *{box-sizing:border-box}.shop-admin .admin-side{width:248px;flex:0 0 248px;min-height:100vh;padding:28px 16px;border-right:1px solid #eadfd2;background:#fffdf9;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
    .shop-admin .admin-logo{font-family:Georgia,serif;font-size:27px;font-weight:700;line-height:1.05}.shop-admin .slow-studio-badge{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;margin:0 0 12px 8px;background:#fffdf9;border:1px solid var(--admin-line);overflow:hidden;box-shadow:0 7px 16px rgba(36,50,37,.12)}.shop-admin .slow-studio-badge img{width:100%;height:100%;object-fit:cover;transform:scale(3.15);transform-origin:50% 43%}.shop-admin .admin-caption{margin:6px 8px 32px;color:#75845d;font-size:13px;letter-spacing:.06em}
    .shop-admin .admin-nav-label{margin:0 8px 10px;color:#877d70;font-size:11px;font-weight:800;letter-spacing:.12em}.shop-admin .admin-nav{display:grid;gap:6px;flex:1;min-height:0;overflow-y:auto;align-content:start;padding:0 4px 8px 0}
    .shop-admin .admin-nav button{appearance:none;width:100%;border:0;border-radius:14px;background:transparent;padding:13px 14px;color:#504a42;font:600 15px/1.2 inherit;text-align:left;cursor:pointer}.shop-admin .admin-nav button:hover{background:#f5ede2}.shop-admin .admin-nav button.active{background:#263125;color:#fff;box-shadow:0 10px 24px rgba(47,63,36,.16)}
    .shop-admin .admin-nav-root,.shop-admin .admin-nav-group-toggle{display:flex;align-items:center;gap:4px}.shop-admin .admin-nav-group{border-radius:14px}.shop-admin .admin-nav-group-toggle{font-weight:750}.shop-admin .admin-nav-chevron{margin-left:auto;transition:transform .18s ease;color:var(--admin-muted)}.shop-admin .admin-nav-group:not(.open) .admin-nav-chevron{transform:rotate(-90deg)}.shop-admin .admin-nav-children{display:grid;gap:2px;margin:1px 0 7px 20px;padding-left:11px;border-left:1px solid var(--admin-line)}.shop-admin .admin-nav-group:not(.open) .admin-nav-children{display:none}.shop-admin .admin-nav-child{padding:9px 10px!important;border-radius:10px!important;font-size:13px!important}.shop-admin .admin-nav-child .nav-icon{width:21px!important;font-size:13px!important}.shop-admin .admin-nav-group-toggle.contains-active{color:var(--admin-primary)!important;background:var(--admin-soft)!important}.shop-admin .slow-studio-link{display:block;margin-bottom:14px;color:var(--admin-primary);font-weight:800;text-decoration:none}
    .shop-admin .admin-nav-sortable{display:grid;grid-template-columns:minmax(0,1fr) 24px;align-items:center;border-radius:14px}.shop-admin .admin-nav-sortable>button:first-child{min-width:0}.shop-admin .admin-nav-drag{appearance:none;border:0;background:transparent!important;box-shadow:none!important;color:var(--admin-muted)!important;padding:8px 2px!important;width:24px!important;cursor:grab!important;touch-action:none;font-size:17px!important;text-align:center!important}.shop-admin .admin-nav-drag:active{cursor:grabbing!important}.shop-admin .admin-nav-sortable.admin-drag-source{opacity:.45;background:var(--admin-soft)}
    .shop-admin .admin-nav .nav-icon{display:inline-block;width:27px;color:#fa7439;font-size:18px;text-align:center;margin-right:5px}.shop-admin .admin-nav button.active .nav-icon{color:#ffe4d8}
    .shop-admin .admin-collapse-toggle{position:absolute;top:18px;right:10px;z-index:3;width:32px;height:32px;border:1px solid #e5d8ca;border-radius:10px;background:#fff;color:#4b5d3a;font:700 24px/1 Georgia,serif;cursor:pointer;display:grid;place-items:center;padding:0}.shop-admin .admin-collapse-toggle:hover{background:#f5ede2}
    .shop-admin.nav-collapsed .admin-side{width:76px;flex-basis:76px;padding-left:9px;padding-right:9px}.shop-admin.nav-collapsed .admin-logo,.shop-admin.nav-collapsed .admin-caption,.shop-admin.nav-collapsed .admin-nav-label,.shop-admin.nav-collapsed .admin-side-bottom,.shop-admin.nav-collapsed .nav-text{display:none}.shop-admin.nav-collapsed .admin-collapse-toggle{position:relative;top:auto;right:auto;margin:0 auto 18px}.shop-admin.nav-collapsed .admin-nav{padding-right:0}.shop-admin.nav-collapsed .admin-nav button{padding:12px 5px;text-align:center}.shop-admin.nav-collapsed .admin-nav .nav-icon{width:auto;margin:0;font-size:19px}
    .shop-admin .admin-side-bottom{margin:16px 8px 0;border-top:1px solid #eadfd2;padding:18px 0 0;color:#6b645b;font-size:13px;flex:0 0 auto}.shop-admin .admin-side-bottom a{color:#4d633d;text-decoration:none;font-weight:700}
    .shop-admin .admin-main{width:100%;max-width:1500px;margin:0 auto;padding:42px 54px 80px}.shop-admin .admin-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid #eadfd2;padding-bottom:26px;margin-bottom:28px}.shop-admin .admin-eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#ef7138;text-transform:uppercase;margin-bottom:9px}.shop-admin .admin-title{font:700 40px/1.05 Georgia,serif;margin:0;letter-spacing:-.02em}.shop-admin .admin-subtitle{color:#6e6b63;margin:9px 0 0;font-size:16px}.shop-admin .open-shop{border:1px solid #e8d9ca;background:#fff;border-radius:13px;padding:12px 16px;color:#33492c;font:700 14px inherit;white-space:nowrap;cursor:pointer}
    .shop-admin .dashboard-top-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.shop-admin .dashboard-refresh-meta{font-size:12px;color:var(--admin-muted);white-space:nowrap}.shop-admin .dashboard-warning-list{display:grid;gap:6px;margin-top:9px}.shop-admin .dashboard-warning-link{appearance:none;border:0;padding:0;background:transparent;color:#a62d2d;font:750 12px/1.35 inherit;text-align:left;text-decoration:underline;text-underline-offset:2px;cursor:pointer}.shop-admin .dashboard-warning-link:hover{color:#7a1f1f}.shop-admin .dashboard-action{appearance:none;width:100%;background:transparent;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}.shop-admin .dashboard-action:hover{background:var(--admin-soft)}
    @keyframes dashboardTargetPulse{0%,100%{box-shadow:var(--admin-card-shadow)}35%{box-shadow:0 0 0 5px color-mix(in srgb,#d98a2b 28%,transparent),var(--admin-card-shadow)}}.shop-admin .dashboard-target-highlight{border-color:#d98a2b!important;animation:dashboardTargetPulse 1.15s ease 2}
    .shop-admin .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:22px}.shop-admin .dashboard-summary-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.shop-admin .stat{border:1px solid #eadfd2;border-radius:18px;padding:19px 20px;background:#fff;min-height:120px}.shop-admin .stat:nth-child(1){background:#f0f7e8;border-color:#d7e8c8}.shop-admin .stat:nth-child(2){background:#fff1e7;border-color:#f2d7c4}.shop-admin .stat:nth-child(3){background:#f3efff;border-color:#dfd6ff}.shop-admin .stat.profit-stat{background:#eef7f0;border-color:#cfe3d3}.shop-admin .stat-label{display:flex;gap:8px;align-items:center;color:#69675f;font-weight:700;font-size:14px}.shop-admin .stat-icon{font-size:19px}.shop-admin .stat-value{font:700 30px/1 Georgia,serif;margin-top:18px}.shop-admin .stat-help{font-size:13px;color:#756e64;margin-top:7px}
    .shop-admin .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:20px}.shop-admin .dashboard-card{border:1px solid #eadfd2;border-radius:18px;background:#fff;overflow:hidden}.shop-admin .dashboard-card-head{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid #eee3d8}.shop-admin .dashboard-card-head h2{font:700 19px/1.1 Georgia,serif;margin:0}.shop-admin .dashboard-card-head span{color:#756e64;font-size:13px}.shop-admin .queue-row{padding:16px 20px;border-bottom:1px solid #f0e7de;cursor:pointer}.shop-admin .queue-row:last-child{border-bottom:0}.shop-admin .queue-row:hover{background:#fffaf6}.shop-admin .queue-top{display:flex;justify-content:space-between;gap:14px;align-items:center}.shop-admin .queue-number{font-family:ui-monospace,monospace;font-size:14px;font-weight:800}.shop-admin .queue-name{color:#6d665d;font-size:14px;margin-top:6px}.shop-admin .queue-amount{font-weight:800}.shop-admin .queue-status{font-size:12px;font-weight:800;padding:6px 9px;border-radius:99px;background:#f5efe7;color:#756950;white-space:nowrap}.shop-admin .dashboard-empty{padding:30px 20px;color:#756e64;text-align:center}.shop-admin .action-list{padding:8px 20px 12px}.shop-admin .action{display:flex;gap:12px;padding:17px 0;border-bottom:1px solid #f0e7de}.shop-admin .action:last-child{border:0}.shop-admin .action-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff0e7;color:#ef7138}.shop-admin .action strong{font-size:14px}.shop-admin .action p{font-size:13px;color:#756e64;line-height:1.4;margin:4px 0 0}
    .shop-admin .tab-page-title{font:700 32px/1.1 Georgia,serif;margin:0 0 8px}.shop-admin .tab-page-subtitle{margin:0 0 24px;color:#6e6b63}.shop-admin .admin-content .tabs{margin-bottom:22px}.shop-admin .admin-content .screen{max-width:none}.shop-admin .admin-content .order-card{box-shadow:none}
    .shop-admin .analytics-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}.shop-admin .analytics-title{font:700 28px/1.1 Georgia,serif;margin:0 0 6px}.shop-admin .analytics-kpi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}.shop-admin .analytics-kpi{padding:20px;border:1px solid var(--admin-line);border-radius:var(--admin-radius);background:var(--admin-card);box-shadow:var(--admin-card-shadow)}.shop-admin .analytics-kpi span{display:block;color:var(--admin-muted);font-weight:750;font-size:13px}.shop-admin .analytics-kpi strong{display:block;font:750 30px/1 Georgia,serif;margin:16px 0 8px}.shop-admin .analytics-kpi small{color:var(--admin-muted)}.shop-admin .analytics-report-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,.7fr);gap:20px;margin-bottom:20px}.shop-admin .analytics-report-grid-secondary{grid-template-columns:1fr 1fr}.shop-admin .analytics-bars{height:280px;padding:26px 20px 18px;display:flex;align-items:stretch;gap:12px}.shop-admin .analytics-bar-column{flex:1;min-width:0;display:grid;grid-template-rows:24px 1fr 20px;gap:8px;text-align:center}.shop-admin .analytics-bar-value{font-size:11px;color:var(--admin-muted);white-space:nowrap}.shop-admin .analytics-bar-track{height:100%;display:flex;align-items:flex-end;justify-content:center;background:linear-gradient(to top,var(--admin-soft),transparent);border-radius:10px;overflow:hidden}.shop-admin .analytics-bar-track i{display:block;width:min(52px,66%);min-height:4px;border-radius:8px 8px 2px 2px;background:var(--admin-primary)}.shop-admin .analytics-bar-column b{font-size:12px}.shop-admin .analytics-rank-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:12px;padding:15px 20px;border-bottom:1px solid var(--admin-line)}.shop-admin .analytics-rank-row:last-child{border-bottom:0}.shop-admin .analytics-rank{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:var(--admin-soft);color:var(--admin-primary);font-weight:800}.shop-admin .analytics-rank-row small{display:block;color:var(--admin-muted);margin-top:3px}.shop-admin .analytics-breakdown{padding:8px 20px}.shop-admin .analytics-breakdown>div{display:flex;justify-content:space-between;gap:18px;padding:14px 0;border-bottom:1px solid var(--admin-line)}.shop-admin .analytics-breakdown>div:last-child{border-bottom:0}.shop-admin .analytics-breakdown span{color:var(--admin-muted)}
    .shop-admin{background:var(--admin-bg)!important;color:var(--admin-text)!important}.shop-admin .admin-main{background:var(--admin-bg)!important}.shop-admin .admin-side{background:var(--admin-card)!important;border-color:var(--admin-line)!important}.shop-admin .admin-logo,.shop-admin .admin-title,.shop-admin .tab-page-title,.shop-admin .dashboard-card-head h2{color:var(--admin-text)!important}.shop-admin .admin-caption,.shop-admin .admin-eyebrow,.shop-admin .nav-icon,.shop-admin .link-btn{color:var(--admin-primary)!important}.shop-admin .admin-nav button{color:var(--admin-text)!important}.shop-admin .admin-nav button:hover,.shop-admin .queue-row:hover{background:var(--admin-soft)!important}.shop-admin .admin-nav button.active{background:var(--admin-primary)!important;color:var(--admin-on-primary)!important;box-shadow:var(--admin-shadow)!important}.shop-admin .admin-nav button.active .nav-icon{color:var(--admin-on-primary)!important}.shop-admin .dashboard-card,.shop-admin .stat,.shop-admin .order-card,.shop-admin .summary-card,.shop-admin .slot,.shop-admin .overlay-card,.shop-admin .edit-card,.shop-admin .modal-card{background:var(--admin-card)!important;border-color:var(--admin-line)!important;border-radius:var(--admin-radius)!important;box-shadow:var(--admin-card-shadow)!important}.shop-admin input,.shop-admin textarea,.shop-admin select{background:var(--admin-card)!important;color:var(--admin-text)!important;border-color:var(--admin-line)!important;border-radius:calc(var(--admin-radius) * .65)!important}.shop-admin .btn-primary,.shop-admin .small-btn{background:var(--admin-primary)!important;color:var(--admin-on-primary)!important;border-radius:calc(var(--admin-radius) * .65)!important}.shop-admin .btn-secondary,.shop-admin .open-shop{background:var(--admin-card)!important;color:var(--admin-primary)!important;border-color:var(--admin-primary)!important;border-radius:calc(var(--admin-radius) * .65)!important}.shop-admin .admin-top,.shop-admin .dashboard-card-head,.shop-admin .queue-row,.shop-admin .action,.shop-admin .divider,.shop-admin .row{border-color:var(--admin-line)!important}.shop-admin .stat:nth-child(n){background:var(--admin-card)!important;border-color:var(--admin-line)!important}.shop-admin .admin-subtitle,.shop-admin .tab-page-subtitle,.shop-admin .dashboard-card-head span,.shop-admin .queue-name,.shop-admin .action p,.shop-admin .hint,.shop-admin .label{color:var(--admin-muted)!important}.shop-admin.theme-zen{font-family:'Noto Sans JP','Work Sans',sans-serif}.shop-admin.theme-zen .admin-logo,.shop-admin.theme-zen .admin-title,.shop-admin.theme-zen .tab-page-title,.shop-admin.theme-zen h1,.shop-admin.theme-zen h2{font-family:'Noto Serif JP',Georgia,serif!important}.shop-admin.theme-korean{font-family:'Work Sans',sans-serif}.shop-admin.theme-korean .admin-logo,.shop-admin.theme-korean .admin-title,.shop-admin.theme-korean .tab-page-title,.shop-admin.theme-korean h1,.shop-admin.theme-korean h2{font-family:'Work Sans',sans-serif!important}.shop-admin.theme-editorial{font-family:'Work Sans',sans-serif}.shop-admin.theme-editorial .admin-logo,.shop-admin.theme-editorial .admin-title,.shop-admin.theme-editorial .tab-page-title,.shop-admin.theme-editorial h1,.shop-admin.theme-editorial h2{font-family:Georgia,serif!important;text-transform:uppercase}.shop-admin.theme-retro{font-family:'Work Sans',sans-serif}.shop-admin.theme-retro .admin-logo,.shop-admin.theme-retro .admin-title,.shop-admin.theme-retro .tab-page-title,.shop-admin.theme-retro h1,.shop-admin.theme-retro h2{font-family:Georgia,serif!important}.shop-admin.theme-threed{font-family:'Work Sans',sans-serif}.shop-admin.theme-threed .admin-logo,.shop-admin.theme-threed .admin-title,.shop-admin.theme-threed .tab-page-title,.shop-admin.theme-threed h1,.shop-admin.theme-threed h2{font-family:'Work Sans',sans-serif!important}
    .shop-admin [data-theme-preview]{background:var(--preview-bg)!important;color:var(--preview-text)!important;border-color:var(--preview-primary)!important;box-shadow:var(--preview-shadow)!important}.shop-admin [data-theme-preview] .dashboard-card-head{border-color:color-mix(in srgb,var(--preview-text) 18%,transparent)!important}.shop-admin [data-theme-preview] .dashboard-card-head h2,.shop-admin [data-theme-preview] .dashboard-card-head span{color:var(--preview-text)!important}.shop-admin [data-theme-preview] .theme-preview-screen{background:var(--preview-card)!important;color:var(--preview-text)!important;border-color:color-mix(in srgb,var(--preview-text) 22%,transparent)!important}.shop-admin [data-theme-preview] .theme-preview-button,.shop-admin [data-theme-preview] .btn-primary{background:var(--preview-primary)!important;color:var(--preview-bg)!important}.shop-admin [data-theme-preview] .btn-secondary{background:var(--preview-card)!important;color:var(--preview-primary)!important;border-color:var(--preview-primary)!important}
    .costing-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}.costing-table{width:100%;border-collapse:collapse;min-width:860px}.costing-table th,.costing-table td{padding:13px 14px;text-align:left;border-bottom:1px solid var(--admin-line);font-size:13px}.costing-table th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--admin-muted)}.costing-table tbody tr:hover{background:var(--admin-soft)}.idea-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.idea-card{min-height:190px}.idea-card.idea-archived{opacity:.6}
    .workspace-role-pill{display:inline-flex;align-items:center;margin-top:12px;padding:7px 11px;border-radius:999px;background:var(--admin-soft);color:var(--admin-primary);font-size:12px;font-weight:800}.team-profile,.team-member-main,.team-member-actions{display:flex;align-items:center;gap:12px}.team-profile{padding:4px 0}.team-profile>div:nth-child(2){flex:1;min-width:0}.team-avatar{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:var(--admin-primary);color:var(--admin-on-primary);font:800 20px/1 Georgia,serif;flex:0 0 auto}.team-avatar.small{width:38px;height:38px;border-radius:12px;font-size:16px}.team-member-actions{justify-content:flex-end;flex-wrap:wrap}.workspace-preference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.activity-list .queue-row{cursor:default}
    .orders-mobile-list{display:none}.orders-bulk-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px}.orders-bulk-tools button{padding:9px 12px}.orders-table-card{overflow:hidden}.orders-table-wrap{overflow-x:auto}.orders-table{width:100%;border-collapse:collapse;min-width:940px}.orders-table th,.orders-table td{padding:12px 11px;border-bottom:1px solid var(--admin-line);text-align:left;font-size:13px;vertical-align:middle}.orders-table th{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--admin-muted)}.orders-table td small{display:block;margin-top:4px;color:var(--admin-muted)}.orders-table tbody tr:not(.orders-detail-row):hover{background:var(--admin-soft)}.orders-table .btn-secondary{padding:7px 10px}.orders-detail-row td{padding:0 18px 18px;background:var(--admin-soft)}.order-expanded-detail{padding:15px 0}.order-status-step{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-width:92px;padding:8px 13px;border:1px solid var(--admin-line);border-radius:999px;background:var(--admin-soft);color:var(--admin-text);font:750 12px/1 inherit;text-align:center;white-space:nowrap;cursor:pointer;transition:transform .12s ease,filter .12s ease}.order-status-step:hover{filter:brightness(.97);transform:translateY(-1px)}.order-status-step:active{transform:translateY(0)}.order-status-step:disabled{cursor:default;opacity:.8;transform:none}.order-status-pill{display:inline-block;border:1px solid var(--admin-line);border-radius:999px;padding:8px 12px;font-size:11px;color:var(--admin-muted);white-space:nowrap}.status-confirmed,.status-pending,.status-awaiting_confirmation{background:color-mix(in srgb,var(--admin-primary) 12%,var(--admin-card))!important;color:var(--admin-primary)!important}.status-preparing{background:#fff3d8!important;color:#9b6616!important}.status-ready{background:#e3f1ff!important;color:#27628f!important}.status-collected{background:#e4f3e5!important;color:#356b45!important}.status-cancelled{background:#f8e5e2!important;color:#b33333!important}
    @media(max-width:1100px){.shop-admin .dashboard-summary-grid,.shop-admin .analytics-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop-admin .analytics-report-grid,.shop-admin .analytics-report-grid-secondary{grid-template-columns:1fr}}
    @media(max-width:800px){
      .shop-admin{display:grid;grid-template-columns:142px minmax(0,1fr);align-items:start}
      .shop-admin .admin-side{position:sticky;top:0;width:142px;height:100vh;min-height:100vh;padding:18px 10px 14px;border-right:1px solid #eadfd2;border-bottom:0;display:flex;overflow:hidden}
      .shop-admin .admin-logo{font-size:21px;line-height:1.05;margin:0 5px 4px;overflow-wrap:anywhere}
      .shop-admin .admin-caption{font-size:9px;letter-spacing:.12em;margin:0 5px 16px}
      .shop-admin .admin-nav-label{display:none}
      .shop-admin .admin-side-bottom{display:block;margin:8px 3px 0;padding:10px 0 0;border-top:1px solid var(--admin-line);flex:0 0 auto}
      .shop-admin .admin-side-bottom .link-btn{width:100%;min-height:40px;padding:9px 7px;border:1px solid var(--admin-line);border-radius:10px;background:var(--admin-card);color:var(--admin-primary);font:700 12px/1 inherit;text-align:center;cursor:pointer}
      .shop-admin .admin-nav{grid-template-columns:1fr;overflow-x:hidden;overflow-y:auto;gap:5px;padding:0 2px 12px 0}
      .shop-admin .admin-nav button{padding:10px 9px;font-size:12px;text-align:left;white-space:normal;border-radius:11px;line-height:1.25}
      .shop-admin .admin-nav-sortable{grid-template-columns:minmax(0,1fr) 20px}.shop-admin .admin-nav-drag{width:20px!important;padding:7px 0!important;font-size:15px!important}
      .shop-admin .admin-nav .nav-icon{display:inline-block;width:18px;margin-right:3px;font-size:14px}
      .shop-admin .admin-main{min-width:0;padding:22px 12px 64px}
      .shop-admin .admin-top{display:block;margin-bottom:18px;padding-bottom:18px}
      .shop-admin .dashboard-top-actions{justify-content:flex-start;margin-top:14px}.shop-admin .dashboard-refresh-meta{width:100%}
      .shop-admin .admin-title,.shop-admin .tab-page-title{font-size:25px}
      .shop-admin .admin-subtitle,.shop-admin .tab-page-subtitle{font-size:13px;line-height:1.45}
      .shop-admin .open-shop{display:inline-block;margin-top:13px;padding:9px 10px;font-size:11px}
      .shop-admin .stat-grid,.shop-admin .dashboard-grid,.shop-admin .dashboard-summary-grid{grid-template-columns:1fr}
      .shop-admin .analytics-kpi-grid,.shop-admin .analytics-report-grid,.shop-admin .analytics-report-grid-secondary{grid-template-columns:1fr}.shop-admin .analytics-toolbar{display:block}.shop-admin .analytics-toolbar .btn-secondary{margin-top:10px}.shop-admin .analytics-bars{height:230px;padding-left:10px;padding-right:10px;gap:6px}.shop-admin .analytics-bar-value{font-size:9px}.shop-admin .analytics-kpi strong{font-size:25px}
      .shop-admin .stat-grid{gap:10px}.shop-admin .stat{min-height:95px;padding:14px}.shop-admin .stat-value{font-size:24px;margin-top:11px}
      .shop-admin .dashboard-card-head{display:block;padding:15px}.shop-admin .dashboard-card-head span{display:block;margin-top:6px}
      .shop-admin .queue-row{padding:14px}.shop-admin .queue-top{align-items:flex-start;flex-wrap:wrap}
      .shop-admin .admin-content{min-width:0;overflow:hidden}
      .shop-admin.mobile-nav-top{display:block}
      .shop-admin.mobile-nav-top .admin-side{position:sticky;top:0;z-index:40;width:100%;height:auto;min-height:0;padding:10px 12px;border-right:0;border-bottom:1px solid #eadfd2;display:block;overflow:visible}
      .shop-admin.mobile-nav-top .admin-logo{display:inline-block;font-size:18px;margin:0 8px 3px 2px}
      .shop-admin.mobile-nav-top .admin-caption{display:inline-block;margin:0;font-size:8px}
      .shop-admin.mobile-nav-top .admin-collapse-toggle{display:none}
      .shop-admin.mobile-nav-top .admin-nav{display:flex;overflow-x:auto;overflow-y:hidden;gap:5px;padding:7px 0 2px;scrollbar-width:none}
      .shop-admin.mobile-nav-top .admin-nav::-webkit-scrollbar{display:none}
      .shop-admin.mobile-nav-top .admin-nav button{flex:0 0 auto;width:auto;padding:9px 11px;white-space:nowrap}
      .shop-admin.mobile-nav-top .admin-nav-sortable{display:flex;flex:0 0 auto}.shop-admin.mobile-nav-top .admin-nav-drag{width:20px!important;padding:7px 1px!important}
      .shop-admin.mobile-nav-top .admin-side-bottom{position:absolute;right:12px;top:8px;margin:0;padding:0;border:0}
      .shop-admin.mobile-nav-top .admin-side-bottom .link-btn{width:auto;min-height:34px;padding:7px 10px;background:var(--admin-card)}
      .shop-admin.mobile-nav-top .admin-main{width:100%;padding:18px 12px 64px}
      .shop-admin.mobile-nav-left.nav-collapsed{grid-template-columns:64px minmax(0,1fr)}
      .shop-admin.mobile-nav-left.nav-collapsed .admin-side{width:64px;padding-left:7px;padding-right:7px}
      .shop-admin.mobile-nav-left.nav-collapsed .admin-side-bottom{display:block;margin:7px 0 0;padding-top:8px}
      .shop-admin.mobile-nav-left.nav-collapsed .admin-side-bottom .signout-label{display:none}
      .shop-admin.mobile-nav-left.nav-collapsed .admin-side-bottom .link-btn{font-size:18px;padding:7px 3px}
      .idea-board{grid-template-columns:1fr}.costing-table{min-width:760px}.costing-table th,.costing-table td{padding:10px;font-size:12px}.workspace-preference-grid{grid-template-columns:1fr}.team-profile,.team-member-main{align-items:flex-start}.team-member-actions{justify-content:flex-start}
      .orders-table-card{display:none}.orders-mobile-list{display:grid;gap:10px}.orders-bulk-tools{position:sticky;top:8px;z-index:20;background:var(--admin-bg);padding:8px 0}.order-compact-card{background:var(--admin-card);border:1px solid var(--admin-line);border-radius:var(--admin-radius);box-shadow:var(--admin-card-shadow);padding:14px}.order-compact-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;cursor:pointer}.order-compact-summary.has-select{grid-template-columns:auto minmax(0,1fr) auto}.order-compact-summary>input{width:auto!important;margin-top:3px}.order-compact-summary .mono{font-size:14px}.order-compact-summary>div>div{font-size:13px;margin-top:5px}.order-compact-muted{color:var(--admin-muted)}.order-compact-right{text-align:right;display:grid;gap:7px;justify-items:end;font-size:12px}.order-compact-right>b{font-size:14px}.order-compact-status{margin-top:12px}.order-compact-card .order-expanded-detail{border-top:1px solid var(--admin-line);margin-top:13px;padding-top:13px}.order-status-step{width:100%;min-width:0}
    }
  </style>`;
}

const DASHBOARD_MARKET = ADMIN_WORKSPACE_MARKET;
function ordersForMarket(market = DASHBOARD_MARKET) { return AdminMarketRules.ordersForMarket(astate.orders, market); }
function paidOrders(market = DASHBOARD_MARKET) { return ordersForMarket(market).filter((order) => order.payment_status === "paid" && order.order_status !== "cancelled"); }
function savedProductFoodCost(productId, market = DASHBOARD_MARKET) {
  return AdminMarketRules.savedProductFoodCost({
    recipes: astate.recipes,
    inventory: astate.inventory,
    productId,
    market,
    unitCost: ingredientUnitCost,
  });
}
function dashboardStats() {
  const marketOrders = ordersForMarket(DASHBOARD_MARKET);
  const paid = paidOrders(DASHBOARD_MARKET);
  const now = new Date();
  const monthly = paid.filter((order) => { const d = new Date(order.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const monthlySales = monthly.filter((order) => order.counts_as_sale !== false);
  const allSales = paid.filter((order) => order.counts_as_sale !== false);
  const customerKeys = new Set(marketOrders.map((order) => String(order.customer_phone || order.instagram || order.customer_name || "").trim()).filter(Boolean));
  const missingRecipeProducts = new Map();
  const foodCostFor = (orders) => orders.reduce((orderSum, order) => orderSum + (order.order_items || []).reduce((itemSum, item) => {
    const recipeRows = AdminMarketRules.recipesForProductMarket(astate.recipes, item.product_id, DASHBOARD_MARKET);
    const product = astate.menu.find((row) => String(row.id) === String(item.product_id))
      || astate.menu.find((row) => String(row.name) === String(item.product_name));
    if (!recipeRows.length && product?.food_cost_confirmed_zero !== true) {
      const id = product?.id || item.product_id;
      if (id) missingRecipeProducts.set(String(id), { id, name: product?.name || item.product_name || "Unknown product" });
    }
    return itemSum + savedProductFoodCost(item.product_id, DASHBOARD_MARKET) * Number(item.quantity || 0);
  }, 0), 0);
  const monthlyRevenue = monthlySales.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const totalRevenue = allSales.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const monthlyFoodCost = foodCostFor(monthlySales);
  const totalFoodCost = foodCostFor(allSales);
  const marketCash=(astate.cashFlowEntries||[]).filter(row=>String(row.market_code||"SG").toUpperCase()===DASHBOARD_MARKET&&row.entry_type==="expense");
  const monthlyStockPurchases=marketCash.filter(row=>{const d=new Date(row.occurred_at||row.created_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}).reduce((sum,row)=>sum+Number(row.amount||0),0);
  const totalStockPurchases=marketCash.reduce((sum,row)=>sum+Number(row.amount||0),0);
  const monthlyGrossProfit = monthlyRevenue - monthlyFoodCost - monthlyStockPurchases;
  const totalGrossProfit = totalRevenue - totalFoodCost - totalStockPurchases;
  const monthlyProfitMargin = monthlyRevenue > 0 ? monthlyGrossProfit / monthlyRevenue * 100 : 0;
  const totalProfitMargin = totalRevenue > 0 ? totalGrossProfit / totalRevenue * 100 : 0;
  return {
    revenue: monthlyRevenue, foodCost: monthlyFoodCost, grossProfit: monthlyGrossProfit, profitMargin: monthlyProfitMargin,
    monthlyRevenue, totalRevenue, monthlyFoodCost, totalFoodCost, monthlyStockPurchases,totalStockPurchases,monthlyGrossProfit, totalGrossProfit, monthlyProfitMargin, totalProfitMargin,
    missingRecipeProducts: [...missingRecipeProducts.values()], orders: monthlySales.length, totalOrders: allSales.length, totalPaidOrders: paid.length,
    customers: customerKeys.size, paymentReview: marketOrders.filter(AdminOrderRules.isPaymentReviewOrder).length,
  };
}
function salesPerformance() {
  const now = new Date();
  const paid = paidOrders(DASHBOARD_MARKET);
  const monthly = paid.filter((order) => {
    const date = new Date(order.created_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const products = new Map();
  monthly.forEach((order) => (order.order_items || []).forEach((item) => {
    const name = item.product_name || "Unnamed drink";
    const row = products.get(name) || { name, quantity: 0, revenue: 0 };
    row.quantity += Number(item.quantity || 0);
    row.revenue += Number(item.subtotal || 0);
    products.set(name, row);
  }));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    const total = paid.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate.getFullYear() === date.getFullYear() && orderDate.getMonth() === date.getMonth() && orderDate.getDate() === date.getDate();
    }).reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), total };
  });
  return { topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5), days };
}
function pickupTimeMinutes(value) {
  const match = String(value || "").trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3] === "PM") hours += 12;
  return (hours * 60) + Number(match[2] || 0);
}

function nextPickupProduction() {
  const active = paidOrders(DASHBOARD_MARKET).filter((order) => ["confirmed", "preparing", "ready"].includes(order.order_status));
  const dates = [...new Set(active.map((order) => order.collection_date).filter(Boolean))].sort();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const date = dates.find((value) => value >= todayKey) || dates[0] || "";
  const orders = active
    .filter((order) => order.collection_date === date)
    .sort((a, b) => (
      pickupTimeMinutes(a.collection_time) - pickupTimeMinutes(b.collection_time)
      || String(a.customer_name || "").localeCompare(String(b.customer_name || ""))
    ));
  return { date, orders };
}
function customerInsights() {
  const list = customers(ordersForMarket(DASHBOARD_MARKET));
  const top = [...list].sort((a, b) => b.spent - a.spent)[0] || null;
  const repeat = list.filter((customer) => customer.orders.length > 1);
  const now = new Date();
  const newThisMonth = list.filter((customer) => {
    const firstOrder = [...customer.orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    const date = new Date(firstOrder?.created_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  return { top, repeat, newThisMonth };
}

function showNewOrderNotice(order) {
  astate.newOrderAlert = {
    id: order.id,
    orderNumber: order.order_number || order.id,
    customer: order.customer_name || "Customer",
    total: Number(order.total || 0),
  };
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("New Shizuku Lab order", { body: `${astate.newOrderAlert.orderNumber} · ${astate.newOrderAlert.customer} · ${money(astate.newOrderAlert.total)}` });
    }
  } catch (_) {}
}
function dismissNewOrderAlert() { astate.newOrderAlert = null; render(); }
async function refreshOrdersOnly() {
  const nested = await db.from("orders").select("*, order_items(*, order_item_options(*))").order("created_at", { ascending: false });
  if (!nested.error) astate.orders = nested.data || [];
  else {
    const { data } = await db.from("orders").select("*").order("created_at", { ascending: false });
    astate.orders = data || [];
  }
  render();
}
function subscribeToOrderChanges() {
  if (!IS_CONFIGURED || astate.realtimeChannel) return;
  astate.realtimeChannel = db.channel("admin-live-orders")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
      showNewOrderNotice(payload.new || {});
      await refreshOrdersOnly();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async () => {
      await refreshOrdersOnly();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, async (payload) => {
      const message = payload.new || {};
      if (!astate.messages.some((item) => String(item.id) === String(message.id))) astate.messages = [...astate.messages, message];
      if (message.sender === "customer") {
        astate.newMessageAlert = { orderNumber: message.order_number || "Order", text: message.message_text || "New message" };
        if ("Notification" in window && Notification.permission === "granted") new Notification("New customer message", { body: `${message.order_number || "Order"} · ${message.message_text || ""}` });
      }
      render();
    })
    .subscribe();
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}
function setTab(tab) {
  const nav = document.querySelector(".admin-nav");
  if (nav) astate.navScrollTop = nav.scrollTop;
  astate.tab = tab;
  render();
  requestAnimationFrame(() => { const nextNav = document.querySelector(".admin-nav"); if (nextNav) nextNav.scrollTop = astate.navScrollTop; });
}

function toggleAdminNavGroup(key) {
  astate.navGroups[key] = astate.navGroups[key] === false;
  try { localStorage.setItem("shizuku-admin-nav-groups", JSON.stringify(astate.navGroups)); } catch (_) {}
  render();
}

function orderedAdminNav(items) {
  const saved = Array.isArray(astate.settingsDraft?.admin_sidebar_order) ? astate.settingsDraft.admin_sidebar_order.map(String) : [];
  const map = new Map(items.map((item) => [String(item[0]), item]));
  return [...saved.map((key) => map.get(key)).filter(Boolean), ...items.filter((item) => !saved.includes(String(item[0])))];
}
let sidebarDrag = null;
function startSidebarDrag(event) {
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const row = event.currentTarget.closest(".admin-nav-sortable");
  const list = row?.parentElement;
  if (!row || !list) return;
  row.classList.add("admin-drag-source");
  sidebarDrag = { row, list };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  document.body.classList.add("admin-is-dragging");
  document.addEventListener("pointermove", moveSidebarDrag, { passive:false });
  document.addEventListener("pointerup", endSidebarDrag, { once:true });
  document.addEventListener("pointercancel", endSidebarDrag, { once:true });
}
function moveSidebarDrag(event) {
  if (!sidebarDrag) return;
  event.preventDefault();
  const candidates = [...sidebarDrag.list.querySelectorAll(".admin-nav-sortable")].filter((item) => item !== sidebarDrag.row);
  const target = candidates.find((item) => { const rect=item.getBoundingClientRect(); return event.clientY>=rect.top && event.clientY<=rect.bottom; });
  if (!target) return;
  const rect=target.getBoundingClientRect();
  if (event.clientY < rect.top + rect.height/2) sidebarDrag.list.insertBefore(sidebarDrag.row,target);
  else sidebarDrag.list.insertBefore(sidebarDrag.row,target.nextSibling);
}
async function endSidebarDrag() {
  if (!sidebarDrag) return;
  const { row, list } = sidebarDrag;
  const order=[...list.querySelectorAll(".admin-nav-sortable")].map((item)=>item.dataset.navKey);
  row.classList.remove("admin-drag-source");
  document.body.classList.remove("admin-is-dragging");
  document.removeEventListener("pointermove",moveSidebarDrag);
  sidebarDrag=null;
  astate.settingsDraft.admin_sidebar_order=order;
  astate.settings.admin_sidebar_order=order;
  if (IS_CONFIGURED) {
    const { error }=await db.from("store_settings").update({admin_sidebar_order:order}).eq("id",astate.settings.id);
    if(error){alert("Could not save menu order: "+error.message);await loadAll();return;}
  }
  render();
}

function messageThreads() {
  const map = new Map();
  const marketOrderIds = new Set(ordersForMarket(DASHBOARD_MARKET).map((order) => String(order.id)));
  astate.messages.filter((message) => marketOrderIds.has(String(message.order_id))).forEach((message) => { const key = String(message.order_id); const thread = map.get(key) || { orderId: key, orderNumber: message.order_number, messages: [], latest: message.created_at }; thread.messages.push(message); thread.latest = message.created_at; map.set(key, thread); });
  return [...map.values()].sort((a,b) => new Date(b.latest) - new Date(a.latest));
}
function unreadMessageCount() { return messageThreads().reduce((sum, thread) => sum + thread.messages.filter((item) => item.sender === "customer" && !item.read_by_seller).length, 0); }
async function markThreadRead(orderId) {
  const ids = astate.messages.filter((item) => String(item.order_id) === String(orderId) && item.sender === "customer" && !item.read_by_seller).map((item) => item.id);
  if (!ids.length) return;
  const { error } = await db.from("order_messages").update({ read_by_seller: true }).in("id", ids);
  if (!error) { astate.messages = astate.messages.map((item) => ids.includes(item.id) ? { ...item, read_by_seller: true } : item); render(); }
}
async function replyToOrder(orderId) {
  const text = String(astate.messageDrafts[orderId] || "").trim(); if (!text) return;
  const thread = messageThreads().find((item) => String(item.orderId) === String(orderId)); if (!thread) return;
  const { data, error } = await db.from("order_messages").insert({ order_id: String(orderId), order_number: thread.orderNumber, sender: "seller", message_text: text, read_by_seller: true }).select().single();
  if (error) { alert("Could not send reply: " + error.message); return; }
  astate.messages = [...astate.messages, data]; astate.messageDrafts[orderId] = ""; await markThreadRead(orderId); render();
}
function renderMessagesTab() {
  const threads = messageThreads();
  if (!threads.length) return `<div class="dashboard-card"><div class="dashboard-empty">No customer messages yet.</div></div>`;
  return threads.map((thread) => { const unread = thread.messages.filter((item) => item.sender === "customer" && !item.read_by_seller).length; const order = astate.orders.find((item) => String(item.id) === thread.orderId); return `<section class="dashboard-card" style="margin-bottom:16px;" onclick="markThreadRead('${escapeHtml(thread.orderId)}')"><div class="dashboard-card-head"><h2>${escapeHtml(thread.orderNumber || "Order")}${unread ? ` <span style="display:inline-grid;place-items:center;min-width:23px;height:23px;padding:0 6px;border-radius:99px;background:#ef7138;color:#fff;font:800 12px/1 inherit;">${unread}</span>` : ""}</h2><span>${escapeHtml(order?.customer_name || "Customer")} · ${escapeHtml(order?.customer_phone || "")}</span></div><div style="padding:18px 20px;"><div style="display:flex;flex-direction:column;gap:9px;max-height:360px;overflow:auto;">${thread.messages.map((item) => `<div style="max-width:82%;align-self:${item.sender === "seller" ? "flex-end" : "flex-start"};padding:10px 12px;border-radius:13px;background:${item.sender === "seller" ? "#263125" : "#f3ece3"};color:${item.sender === "seller" ? "#fff" : "#332f2a"};"><div style="font-size:10px;font-weight:800;opacity:.7;margin-bottom:4px;">${item.sender === "seller" ? "YOU" : "CUSTOMER"}</div><div style="white-space:pre-wrap;line-height:1.45;">${escapeHtml(item.message_text)}</div></div>`).join("")}</div><div class="field" style="margin-top:16px;"><label>Reply</label><textarea rows="3" maxlength="1000" oninput="astate.messageDrafts['${escapeHtml(thread.orderId)}']=this.value">${escapeHtml(astate.messageDrafts[thread.orderId] || "")}</textarea></div><button class="btn-primary" onclick="event.stopPropagation();replyToOrder('${escapeHtml(thread.orderId)}')">Send reply</button></div></section>`; }).join("");
}

async function setReviewStatus(id, status) {
  const fields = { status, published_at: status === "published" ? new Date().toISOString() : null };
  const { data, error } = await db.from("customer_reviews").update(fields).eq("id", id).select().single();
  if (error) { alert("Could not update review: " + error.message); return; }
  astate.reviews = astate.reviews.map((item) => String(item.id) === String(id) ? data : item); render();
}
async function deleteReview(id) { if (!confirm("Delete this review permanently?")) return; const { error } = await db.from("customer_reviews").delete().eq("id", id); if (error) { alert(error.message); return; } astate.reviews = astate.reviews.filter((item) => String(item.id) !== String(id)); render(); }
function renderReviewsTab() {
  const reviews = [...astate.reviews].sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || new Date(b.created_at) - new Date(a.created_at));
  const s = astate.settingsDraft || {};
  const fonts = [["work_sans","Work Sans"],["fraunces","Fraunces"],["georgia","Georgia"],["noto_serif_jp","Noto Serif JP"],["noto_sans_jp","Noto Sans JP"]];
  const fontSelect = (key) => `<select onchange="onSettingsField('${key}',this.value);render()">${fonts.map(([v,l])=>`<option value="${v}" ${s[key]===v?"selected":""}>${l}</option>`).join("")}</select>`;
  const field = (label,key,placeholder="") => `<div class="field"><label>${label}</label><input value="${escapeHtml(s[key] || "")}" placeholder="${escapeHtml(placeholder)}" oninput="onSettingsField('${key}',this.value)"></div>`;
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Customer review page</h2><span>Edit every review word and its main typography</span></div><span>${s.reviews_enabled===false?"Off":"On"}</span></div><label class="slot"><input type="checkbox" style="width:auto" ${s.reviews_enabled===false?"":"checked"} onchange="onSettingsField('reviews_enabled',this.checked);render()"><span><b>Show review invitation</b></span></label><div class="divider"></div><h3>Home invitation</h3><div class="workspace-preference-grid">${field("Button wording","review_cta_label",window.SLOW_STUDIO_DEMO_MODE?"Share your experience":"Share your Shizuku moment")}<div class="field"><label>Font</label>${fontSelect("review_cta_font")}</div><div class="field"><label>Size (px)</label><input type="number" min="10" max="32" value="${Number(s.review_cta_size||14)}" oninput="onSettingsField('review_cta_size',Number(this.value))"></div><div class="field"><label>Colour</label><input type="color" value="${escapeHtml(s.review_cta_color||'#4B5D3A')}" oninput="onSettingsField('review_cta_color',this.value)"></div></div><h3>Review portal</h3><div class="workspace-preference-grid">${field("Page title","review_portal_title",window.SLOW_STUDIO_DEMO_MODE?"Share your experience":"Share your Shizuku experience")}<div class="field"><label>Title font</label>${fontSelect("review_portal_title_font")}</div><div class="field"><label>Title size (px)</label><input type="number" min="16" max="56" value="${Number(s.review_portal_title_size||27)}" oninput="onSettingsField('review_portal_title_size',Number(this.value))"></div><div class="field"><label>Title colour</label><input type="color" value="${escapeHtml(s.review_portal_title_color||'#2A2A22')}" oninput="onSettingsField('review_portal_title_color',this.value)"></div></div>${field("Intro","review_portal_intro")}${field("Order / phone label","review_lookup_label")}${field("Lookup placeholder","review_lookup_placeholder")}${field("Find button","review_find_button_text")}${field("Choose order wording","review_choose_order_text")}${field("Name label","review_name_label")}${field("Rating label","review_rating_label")}${field("Experience label","review_experience_label")}${field("Submit button","review_submit_button_text")}${field("Back button","review_back_button_text")}<div class="ref-note"><b style="font-family:${s.review_portal_title_font==='fraunces'?'Fraunces,serif':'inherit'};font-size:${Number(s.review_portal_title_size||27)}px;color:${escapeHtml(s.review_portal_title_color||'#2A2A22')}">${escapeHtml(s.review_portal_title||(window.SLOW_STUDIO_DEMO_MODE?'Share your experience':'Share your Shizuku experience'))}</b><br>${escapeHtml(s.review_portal_intro||'Tell us about the items you collected.')}</div><button class="btn-primary" onclick="saveSettings()">Save review settings</button></section><h2 style="margin:20px 0 12px">Review approvals</h2>${reviews.length ? reviews.map((item) => `<section class="dashboard-card" style="padding:20px;margin-bottom:14px;"><div class="queue-top"><div><b>${escapeHtml(item.customer_name || "Customer")}</b><div class="queue-name">${"★".repeat(Number(item.rating) || 0)}${"☆".repeat(5-(Number(item.rating)||0))}</div></div><div class="queue-status">${escapeHtml(item.status === "published" ? "APPROVED" : item.status === "hidden" ? "REJECTED" : "PENDING")}</div></div>${item.product_summary ? `<div class="ref-note"><b>Ordered items</b><br>${escapeHtml(item.product_summary)}</div>` : ""}<p style="line-height:1.6;white-space:pre-wrap;">${escapeHtml(item.review_text)}</p><div style="display:flex;gap:9px;flex-wrap:wrap;"><button class="btn-primary" onclick="setReviewStatus('${item.id}','published')">Approve</button><button class="btn-secondary" onclick="setReviewStatus('${item.id}','hidden')">Reject</button><button class="link-danger" onclick="deleteReview('${item.id}')">Delete</button></div></section>`).join("") : `<div class="dashboard-card"><div class="dashboard-empty">No reviews submitted yet.</div></div>`}`;
}

function marketingContacts() {
  const map = new Map();
  ordersForMarket(DASHBOARD_MARKET).forEach((o) => {
    if (!o.marketing_email_opt_in && !o.marketing_whatsapp_opt_in && !o.email_notifications_opted_out) return;
    const email = String(o.customer_email || "").trim().toLowerCase(), phone = String(o.customer_phone || "").replace(/\D/g, "");
    const key = email || phone; if (!key) return;
    const old = map.get(key); if (!old || new Date(o.marketing_consent_at || o.created_at) > new Date(old.marketing_consent_at || old.created_at)) map.set(key, { ...o, _contactSource: "checkout" });
  });
  astate.marketingManualContacts.filter((contact) => String(contact.market_code || "SG").toUpperCase() === DASHBOARD_MARKET).forEach((contact) => {
    const email = String(contact.customer_email || "").trim().toLowerCase(), phone = String(contact.customer_phone || "").replace(/\D/g, "");
    const key = email || phone; if (!key) return;
    map.set(key, { ...contact, _contactSource: "manual", marketing_consent_at: contact.consent_at || contact.updated_at || contact.created_at });
  });
  const q = astate.marketingSearch.toLowerCase();
  return [...map.values()].filter(o => !q || [o.customer_name,o.customer_email,o.customer_phone].some(v=>String(v||"").toLowerCase().includes(q)));
}
function marketingContactDraftField(key, value) { astate.marketingContactDraft[key] = key.includes("opt_in") ? !!value : value; }
function resetMarketingContactDraft() { astate.marketingContactDraft = { customer_name: "", customer_email: "", customer_phone: "", marketing_email_opt_in: true, marketing_whatsapp_opt_in: false }; render(); }
async function saveMarketingContact() {
  const draft = astate.marketingContactDraft || {};
  const email = String(draft.customer_email || "").trim().toLowerCase();
  const phone = String(draft.customer_phone || "").trim();
  if (!String(draft.customer_name || "").trim()) return alert("Enter the customer name.");
  if (!email && !phone) return alert("Enter an email address or phone number.");
  if (draft.marketing_email_opt_in && !/^\S+@\S+\.\S+$/.test(email)) return alert("Enter a valid email address for email marketing.");
  if (draft.marketing_whatsapp_opt_in && phone.replace(/\D/g, "").length < 8) return alert("Enter a valid WhatsApp number.");
  const payload = { customer_name: String(draft.customer_name).trim(), customer_email: email || null, customer_phone: phone || null, marketing_email_opt_in: !!draft.marketing_email_opt_in, marketing_whatsapp_opt_in: !!draft.marketing_whatsapp_opt_in, market_code: DASHBOARD_MARKET, consent_at: new Date().toISOString(), consent_source: "admin" };
  if (window.SLOW_STUDIO_DEMO_MODE) {
    const row = { ...payload, id:draft.id || crypto.randomUUID(), created_at:draft.created_at || new Date().toISOString() };
    astate.marketingManualContacts = draft.id ? astate.marketingManualContacts.map((item) => String(item.id) === String(draft.id) ? row : item) : [...astate.marketingManualContacts,row];
    resetMarketingContactDraft();
    return alert("Demo contact saved in this browser only. No email was sent and no Supabase data was used.");
  }
  const query = draft.id ? db.from("marketing_contacts").update(payload).eq("id", draft.id) : db.from("marketing_contacts").insert(payload);
  const { error } = await query;
  if (error) return alert("Could not save marketing contact: " + error.message);
  resetMarketingContactDraft();
  await loadAll({ silent: true });
  alert("Marketing contact saved.");
}
function editMarketingContact(id) {
  const contact = astate.marketingManualContacts.find((row) => String(row.id) === String(id));
  if (!contact) return;
  astate.marketingContactDraft = { ...contact };
  render();
}
async function deleteMarketingContact(id) {
  if (!confirm("Remove this manually added marketing contact?")) return;
  if (window.SLOW_STUDIO_DEMO_MODE) { astate.marketingManualContacts=astate.marketingManualContacts.filter((row)=>String(row.id)!==String(id)); render(); return; }
  const { error } = await db.from("marketing_contacts").delete().eq("id", id);
  if (error) return alert("Could not remove contact: " + error.message);
  astate.marketingManualContacts = astate.marketingManualContacts.filter((row) => String(row.id) !== String(id));
  render();
}
function exportMarketingContacts() { const rows=marketingContacts(); const csv=[["Name","Email","Phone","Email opt-in","WhatsApp opt-in","Consent date"],...rows.map(o=>[o.customer_name||"",o.customer_email||"",o.customer_phone||"",o.marketing_email_opt_in?"Yes":"No",o.marketing_whatsapp_opt_in?"Yes":"No",o.marketing_consent_at||o.created_at||""])].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="shizuku-marketing-contacts.csv";a.click();URL.revokeObjectURL(a.href); }
function marketingEmailContacts() { return marketingContacts().filter(o => o.marketing_email_opt_in && !o.email_notifications_opted_out && /^\S+@\S+\.\S+$/.test(String(o.customer_email||"").trim())); }
function marketingWhatsappContacts() { return marketingContacts().filter(o => o.marketing_whatsapp_opt_in && String(o.customer_phone||"").replace(/\D/g,"").length >= 8); }
function toggleMarketingEmail(email, checked) { const key=String(email||"").trim().toLowerCase(); astate.marketingSelectedEmails=checked?[...new Set([...astate.marketingSelectedEmails,key])]:astate.marketingSelectedEmails.filter(v=>v!==key); render(); }
function toggleMarketingPhone(phone, checked) { const key=String(phone||"").replace(/\D/g,""); astate.marketingSelectedPhones=checked?[...new Set([...astate.marketingSelectedPhones,key])]:astate.marketingSelectedPhones.filter(v=>v!==key); render(); }
function selectAllMarketing(channel) { if(channel==='email') astate.marketingSelectedEmails=marketingEmailContacts().map(o=>String(o.customer_email).trim().toLowerCase()); else astate.marketingSelectedPhones=marketingWhatsappContacts().map(o=>String(o.customer_phone).replace(/\D/g,"")); render(); }
async function persistMarketingSettings() {
  const { id,created_at,updated_at,...fields }=astate.settingsDraft;
  const {error}=await db.from("store_settings").update(fields).eq("id",astate.settings.id);
  if(error) throw error; astate.settings={...astate.settingsDraft};
}
async function sendSelectedMarketingEmails() {
  const selected=marketingEmailContacts().filter(o=>astate.marketingSelectedEmails.includes(String(o.customer_email).trim().toLowerCase()));
  if(!selected.length) return alert("Select at least one opted-in email contact.");
  if(!confirm(`Send to ${selected.length} selected contacts?`)) return;
  astate.marketingSendBusy=true; astate.marketingSendProgress=`Sending 0 of ${selected.length}…`; render();
  try { await persistMarketingSettings(); let sent=0, failed=[];
    for(const contact of selected) { const {error}=await db.rpc("send_marketing_campaign_email",{p_customer_email:contact.customer_email,p_market_code:DASHBOARD_MARKET}); if(error) failed.push(contact.customer_email); else sent++; astate.marketingSendProgress=`Sending ${sent+failed.length} of ${selected.length}…`; render(); }
    astate.marketingSelectedEmails=failed.map(v=>String(v).toLowerCase()); alert(failed.length?`${sent} sent. ${failed.length} failed: ${failed.join(", ")}`:`Sent to ${sent} selected contacts.`);
  } catch(e) { alert("Could not send campaign: "+(e.message||e)); } finally { astate.marketingSendBusy=false; astate.marketingSendProgress=""; render(); }
}
function openSelectedMarketingWhatsapps() {
  const selected=marketingWhatsappContacts().filter(o=>astate.marketingSelectedPhones.includes(String(o.customer_phone).replace(/\D/g,"")));
  if(!selected.length) return alert("Select at least one opted-in WhatsApp contact.");
  if(!confirm(`Open WhatsApp for ${selected.length} selected contacts?`)) return;
  const template=String(astate.settingsDraft.marketing_whatsapp_message||DEFAULT_MARKETING_WHATSAPP_BODY);
  selected.forEach((contact,index)=>setTimeout(()=>window.open(`https://wa.me/${String(contact.customer_phone).replace(/\D/g,"")}?text=${encodeURIComponent(template.replace(/\{customer_name\}/g,contact.customer_name||"there"))}`,"_blank"),index*350));
}
function renderMarketingCampaigns() {
  const s=astate.settingsDraft||{}, contacts=marketingContacts(), emails=marketingEmailContacts(), whatsapps=marketingWhatsappContacts();
  const subject=s.marketing_email_subject||DEFAULT_MARKETING_EMAIL_SUBJECT, body=s.marketing_email_body||DEFAULT_MARKETING_EMAIL_BODY, whatsapp=s.marketing_whatsapp_message||DEFAULT_MARKETING_WHATSAPP_BODY;
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Checkout marketing consent</h2><span>Customers must actively tick this; it is never pre-selected</span></div><span>${s.marketing_opt_in_enabled===false?"Off":"On"}</span></div><label class="slot"><input type="checkbox" style="width:auto" ${s.marketing_opt_in_enabled===false?"":"checked"} onchange="onSettingsField('marketing_opt_in_enabled',this.checked);render()"><span><b>Show opt-in at checkout</b></span></label><div class="field"><label>Heading</label><input value="${escapeHtml(s.marketing_checkout_heading||"")}" oninput="onSettingsField('marketing_checkout_heading',this.value)"></div><div class="field"><label>Consent wording</label><textarea rows="3" oninput="onSettingsField('marketing_opt_in_label',this.value)">${escapeHtml(s.marketing_opt_in_label||"")}</textarea></div><div class="field"><label>Help text</label><textarea rows="2" oninput="onSettingsField('marketing_opt_in_help_text',this.value)">${escapeHtml(s.marketing_opt_in_help_text||"")}</textarea></div><label class="slot"><input type="checkbox" style="width:auto" ${s.marketing_email_enabled===false?"":"checked"} onchange="onSettingsField('marketing_email_enabled',this.checked)"><span>Email updates</span></label><label class="slot"><input type="checkbox" style="width:auto" ${s.marketing_whatsapp_enabled===true?"checked":""} onchange="onSettingsField('marketing_whatsapp_enabled',this.checked)"><span>WhatsApp updates</span></label><button class="btn-primary" onclick="saveSettings()">Save marketing settings</button></section>
  <section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Marketing email template</h2><span>Edit, preview, attach and send to selected opted-in customers</span></div></div><div class="field"><label>Subject</label><input value="${escapeHtml(subject)}" oninput="onSettingsField('marketing_email_subject',this.value)"></div><div class="field"><label>Email message</label><textarea rows="14" oninput="onSettingsField('marketing_email_body',this.value)">${escapeHtml(body)}</textarea></div><div class="btn-row"><label class="btn-secondary">Take photo<input hidden type="file" accept="image/*" capture="environment" onchange="uploadMarketingAttachment(this)"></label><label class="btn-secondary">Photo library<input hidden type="file" accept="image/*" onchange="uploadMarketingAttachment(this)"></label><label class="btn-secondary">Upload file<input hidden type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onchange="uploadMarketingAttachment(this)"></label></div>${astate.marketingAttachmentUploading?`<div class="ref-note">Uploading…</div>`:s.marketing_attachment_url?`<div class="ref-note"><b>Attachment:</b> <a href="${escapeHtml(s.marketing_attachment_url)}" target="_blank">${escapeHtml(s.marketing_attachment_name||"Open file")}</a> <button class="link-danger" onclick="removeMarketingAttachment()">Remove</button></div>`:`<div class="ref-note">No attachment selected.</div>`}<div class="ref-note"><b>${escapeHtml(subject)}</b><br><br><div style="white-space:pre-wrap">${escapeHtml(body)}</div><br><small>Powered by Slow Studio</small></div><button class="btn-primary" onclick="persistMarketingSettings().then(()=>alert('Marketing template saved.')).catch(e=>alert(e.message))">Save email template</button></section>
  <section class="dashboard-card" style="padding:20px;margin-bottom:18px"><h2>WhatsApp template</h2><div class="field"><label>Message</label><textarea rows="9" oninput="onSettingsField('marketing_whatsapp_message',this.value)">${escapeHtml(whatsapp)}</textarea></div><div class="ref-note">Use <b>{customer_name}</b> to insert each customer’s name. Sending opens WhatsApp so you can review and press Send.</div><button class="btn-primary" onclick="persistMarketingSettings().then(()=>alert('WhatsApp template saved.')).catch(e=>alert(e.message))">Save WhatsApp template</button></section>
  <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Marketing contacts</h2><span>${contacts.length} contact record(s), including unsubscribed customers</span></div><button class="btn-secondary" onclick="exportMarketingContacts()">Download CSV</button></div><div style="padding:14px 20px"><input placeholder="Search name, email or phone" value="${escapeHtml(astate.marketingSearch)}" oninput="astate.marketingSearch=this.value;render()"><div class="btn-row" style="margin-top:12px"><button class="btn-secondary" onclick="selectAllMarketing('email')">Select all email</button><button class="btn-secondary" onclick="selectAllMarketing('whatsapp')">Select all WhatsApp</button><button class="btn-primary" ${astate.marketingSendBusy?'disabled':''} onclick="sendSelectedMarketingEmails()">${astate.marketingSendBusy?escapeHtml(astate.marketingSendProgress):`Send email (${astate.marketingSelectedEmails.length})`}</button><button class="btn-primary" onclick="openSelectedMarketingWhatsapps()">Open WhatsApp (${astate.marketingSelectedPhones.length})</button></div></div>${contacts.map(o=>{const email=String(o.customer_email||"").trim().toLowerCase(),phone=String(o.customer_phone||"").replace(/\D/g,"");return `<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(o.customer_name||'Customer')}</b>${o.email_notifications_opted_out?` <span class="queue-status" style="background:#f8dfdc;color:#9c2e24">UNSUBSCRIBED</span>`:""}<div class="queue-name">${escapeHtml(o.customer_email||'No email')} · ${escapeHtml(o.customer_phone||'No phone')}</div>${o.email_notifications_opted_out?`<div class="queue-name" style="color:#9c2e24"><b>Email remark:</b> Customer unsubscribed from all emails, including confirmation and Ready for Collection.</div>`:""}</div><div style="display:flex;gap:12px;align-items:center">${o.marketing_email_opt_in&&!o.email_notifications_opted_out&&/^\S+@\S+\.\S+$/.test(email)?`<label><input type="checkbox" style="width:auto" ${astate.marketingSelectedEmails.includes(email)?'checked':''} onchange="toggleMarketingEmail('${escapeHtml(email)}',this.checked)"> Email</label>`:''}${o.marketing_whatsapp_opt_in&&phone.length>=8?`<label><input type="checkbox" style="width:auto" ${astate.marketingSelectedPhones.includes(phone)?'checked':''} onchange="toggleMarketingPhone('${phone}',this.checked)"> WhatsApp</label>`:''}</div></div></div>`}).join('')||`<div class="dashboard-empty">No customers have opted in yet.</div>`}</section>`;
}
function renderMarketingContactManager() {
  const draft = astate.marketingContactDraft || {};
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>${draft.id ? "Edit marketing contact" : "Add marketing contact"}</h2><span>Add a customer who gave you permission outside checkout. This does not create an order.</span></div></div><div class="workspace-preference-grid"><div class="field"><label>Customer name</label><input value="${escapeHtml(draft.customer_name||"")}" oninput="marketingContactDraftField('customer_name',this.value)"></div><div class="field"><label>Email</label><input type="email" value="${escapeHtml(draft.customer_email||"")}" oninput="marketingContactDraftField('customer_email',this.value)"></div><div class="field"><label>Phone / WhatsApp</label><input value="${escapeHtml(draft.customer_phone||"")}" oninput="marketingContactDraftField('customer_phone',this.value)"></div><div class="field"><label>Market</label><input value="${DASHBOARD_MARKET === "MY" ? "Malaysia · MYR" : "Singapore · SGD"}" disabled></div></div><div class="btn-row"><label class="slot" style="margin:0"><input type="checkbox" style="width:auto" ${draft.marketing_email_opt_in!==false?"checked":""} onchange="marketingContactDraftField('marketing_email_opt_in',this.checked)"><span>Email permission</span></label><label class="slot" style="margin:0"><input type="checkbox" style="width:auto" ${draft.marketing_whatsapp_opt_in===true?"checked":""} onchange="marketingContactDraftField('marketing_whatsapp_opt_in',this.checked)"><span>WhatsApp permission</span></label></div><div class="btn-row" style="margin-top:14px"><button class="btn-primary" onclick="saveMarketingContact()">${draft.id ? "Save changes" : "Add customer"}</button>${draft.id?`<button class="btn-secondary" onclick="resetMarketingContactDraft()">Cancel</button>`:""}</div></section>`;
}
function renderMembershipSettings() { const s=astate.settingsDraft||{}; return `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Membership</h2><span>Keep this ready for a future member programme</span></div><span>${s.membership_enabled===true?"On":"Off"}</span></div><label class="slot"><input type="checkbox" style="width:auto" ${s.membership_enabled===true?"checked":""} onchange="onSettingsField('membership_enabled',this.checked);render()"><span><b>Enable membership</b><br><span class="hint">Turn this on only when you are ready to show membership to customers.</span></span></label><div class="field"><label>Programme name</label><input value="${escapeHtml(s.membership_name||"Shizuku Club")}" oninput="onSettingsField('membership_name',this.value)"></div><div class="field"><label>Description</label><textarea rows="4" oninput="onSettingsField('membership_description',this.value)">${escapeHtml(s.membership_description||"Rewards and member updates, crafted for returning customers.")}</textarea></div><button class="btn-primary" onclick="saveSettings()">Save membership settings</button></section>`; }
function renderMarketingTab() { return renderMembershipSettings() + renderMarketingContactManager() + renderMarketingCampaigns(); }
function renderDashboardTab() {
  const stats = dashboardStats();
  const workspaceName = astate.currentTeamMember?.display_name || "Ting";
  const workspaceRole = astate.currentTeamMember?.role || "Owner";
  const liveOrders = ordersForMarket(DASHBOARD_MARKET).filter((order) => order.order_status !== "cancelled" && order.order_status !== "collected").slice(0, 6);
  const performance = salesPerformance();
  const production = nextPickupProduction();
  const insights = customerInsights();
  const highestDailySale = Math.max(...performance.days.map((day) => day.total), 1);
  const updatedTime = astate.dashboardLastUpdated
    ? astate.dashboardLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Not refreshed yet";
  const foodCostWarnings = stats.missingRecipeProducts.map((product) => `<button class="dashboard-warning-link" onclick="focusDashboardIssue('food_cost','${escapeHtml(product.id)}')">${escapeHtml(product.name)} is missing Food Cost →</button>`).join("");
  return `
    <div class="admin-top"><div><div class="admin-eyebrow">${DASHBOARD_MARKET === "MY" ? "Malaysia · MYR" : "Singapore · SGD"} command center</div><h1 class="admin-title">Good day, ${escapeHtml(workspaceName)}</h1><div class="workspace-role-pill">${escapeHtml(workspaceRole)}</div><p class="admin-subtitle">Your orders, revenue and customers — all in one place.</p></div><div class="dashboard-top-actions">${astate.settings?.show_dashboard_refresh !== false ? `<button class="btn-secondary" onclick="refreshDashboard()" ${astate.dashboardRefreshing ? "disabled" : ""}>${astate.dashboardRefreshing ? "Refreshing…" : "↻ Refresh"}</button><span class="dashboard-refresh-meta">Last updated: ${escapeHtml(updatedTime)}</span>` : ""}<a class="open-shop" href="${ADMIN_CUSTOMER_SHOP_URL}">Open customer shop ↗</a></div></div>
    <div class="stat-grid dashboard-summary-grid">
      <div class="stat"><div class="stat-label"><span class="stat-icon">✦</span>Total sales</div><div class="stat-value">${money(stats.totalRevenue)}</div><div class="stat-help">${stats.totalOrders} ${DASHBOARD_MARKET === "MY" ? "Malaysia" : "Singapore"} paid sale${stats.totalOrders === 1 ? "" : "s"}</div></div>
      <div class="stat"><div class="stat-label"><span class="stat-icon">▣</span>Sales this month</div><div class="stat-value">${money(stats.monthlyRevenue)}</div><div class="stat-help">${stats.orders} paid order${stats.orders === 1 ? "" : "s"} this month</div></div>
      <div class="stat profit-stat"><div class="stat-label"><span class="stat-icon">%</span>Margin this month</div><div class="stat-value">${money(stats.monthlyGrossProfit)}</div><div class="stat-help">${stats.monthlyProfitMargin.toFixed(1)}% · food cost ${money(stats.monthlyFoodCost)}</div></div>
      <div class="stat profit-stat"><div class="stat-label"><span class="stat-icon">$</span>Total margin</div><div class="stat-value">${money(stats.totalGrossProfit)}</div><div class="stat-help">${stats.totalProfitMargin.toFixed(1)}% · total food cost ${money(stats.totalFoodCost)}${stats.missingRecipeProducts.length ? `<div class="dashboard-warning-list">${foodCostWarnings}</div>` : ""}</div></div>
    </div>
    <section class="dashboard-card dashboard-consolidated-strip"><span><b>${stats.customers}</b> ${DASHBOARD_MARKET === "MY" ? "Malaysia" : "Singapore"} customers</span><span><b>${stats.totalPaidOrders}</b> total paid orders</span><span>${stats.paymentReview ? `<button class="dashboard-warning-link" onclick="focusDashboardIssue('payment_review')"><b>${stats.paymentReview}</b> need payment review →</button>` : "Payment reviews are up to date"}</span></section>
    <div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Order queue</h2><button class="link-btn" onclick="setTab('orders')">View all</button></div>${liveOrders.length ? liveOrders.map((order) => `<button type="button" class="queue-row queue-row-button" onclick="openRelatedOrder('${order.id}','${escapeHtml(order.order_number || "")}')"><div class="queue-top"><div class="queue-number">${escapeHtml(order.order_number || order.id)}</div><div class="queue-status">${escapeHtml(PAY_LABEL[order.payment_status] || order.payment_status || "Pending")}</div></div><div class="queue-top"><div class="queue-name">${escapeHtml(order.customer_name || "Customer")} · ${escapeHtml(order.collection_date || "Pickup date pending")}</div><div class="queue-amount">${money(order.total)}</div></div></button>`).join("") : `<div class="dashboard-empty">You’re all caught up — no active orders right now.</div>`}</section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Next steps</h2><span>Shop checklist</span></div><div class="action-list"><button class="action dashboard-action" onclick="focusDashboardIssue('payment_review')"><span class="action-icon">✓</span><span><strong>Review payment proofs</strong><p>${stats.paymentReview ? `${stats.paymentReview} customer payment${stats.paymentReview === 1 ? "" : "s"} waiting for confirmation.` : "No payment proof waiting right now."}</p></span></button><button class="action dashboard-action" onclick="setTab('availability')"><span class="action-icon">◷</span><span><strong>Set pickup availability</strong><p>Open or close special collection days in your calendar.</p></span></button><button class="action dashboard-action" onclick="setTab('menu')"><span class="action-icon">✦</span><span><strong>Keep your menu fresh</strong><p>Edit prices, availability and products whenever you need.</p></span></button></div></section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Next pickup production</div><section class="dashboard-card"><div class="dashboard-card-head"><h2>${production.date ? escapeHtml(production.date) : "No upcoming paid orders"}</h2><span>${production.orders.length ? `${production.orders.length} drink order${production.orders.length === 1 ? "" : "s"}` : "Your paid pickup orders will appear here"}</span></div>${production.orders.length ? production.orders.map((order) => `<button type="button" class="queue-row queue-row-button" onclick="openRelatedOrder('${order.id}','${escapeHtml(order.order_number || "")}')"><div class="queue-top"><div><div class="queue-number">${escapeHtml(order.collection_time || "Time pending")} · ${escapeHtml(order.customer_name || "Customer")}</div><div class="queue-name">${(order.order_items || []).map((item) => `${escapeHtml(item.product_name)} × ${item.quantity}`).join(" · ") || "Order items loading"}</div></div><div class="queue-status">${escapeHtml(ORDER_LABEL[order.order_status] || order.order_status)}</div></div></button>`).join("") : `<div class="dashboard-empty">When you confirm payment, the order will show here for its collection day.</div>`}</section></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Sales performance</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Last 7 days</h2><span>Paid sales only</span></div><div style="height:210px;padding:24px 20px 15px;display:flex;align-items:flex-end;gap:12px">${performance.days.map((day) => `<div style="height:100%;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px"><div title="${money(day.total)}" style="width:min(44px,100%);height:${day.total ? Math.max(10, Math.round(day.total / highestDailySale * 145)) : 4}px;background:${day.total ? "#ef7138" : "#eee3d8"};border-radius:8px 8px 3px 3px"></div><div style="font-size:12px;font-weight:700;color:#756e64">${day.label}</div><div style="font-size:11px;color:#8a8177">${day.total ? money(day.total) : "—"}</div></div>`).join("")}</div></section>
    <section class="dashboard-card"><div class="dashboard-card-head"><h2>Top drinks this month</h2><span>By sales</span></div>${performance.topProducts.length ? performance.topProducts.map((product, index) => `<div class="queue-row"><div class="queue-top"><div><div class="queue-number">${index + 1}. ${escapeHtml(product.name)}</div><div class="queue-name">${product.quantity} cup${product.quantity === 1 ? "" : "s"} sold</div></div><div class="queue-amount">${money(product.revenue)}</div></div></div>`).join("") : `<div class="dashboard-empty">Your top drinks will appear here after paid orders come in.</div>`}</section></div></div>
    <div style="margin-top:28px"><div class="admin-eyebrow">Customer insights</div><div class="dashboard-grid"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Customer snapshot</h2><button class="link-btn" onclick="setTab('customers')">View customers</button></div><div style="padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><div style="padding:16px;border-radius:14px;background:#f3efff"><div style="font-size:12px;font-weight:800;color:#756e64">REPEAT CUSTOMERS</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.repeat.length}</div><div class="queue-name">Ordered more than once</div></div><div style="padding:16px;border-radius:14px;background:#f0f7e8"><div style="font-size:12px;font-weight:800;color:#756e64">NEW THIS MONTH</div><div style="font:700 30px/1 Georgia,serif;margin-top:12px">${insights.newThisMonth.length}</div><div class="queue-name">First-time customers</div></div></div></section><section class="dashboard-card"><div class="dashboard-card-head"><h2>Top customer</h2><span>All paid orders</span></div>${insights.top ? `<div style="padding:24px 20px"><div style="font:700 26px/1.1 Georgia,serif">${escapeHtml(insights.top.name)}</div><div class="queue-name" style="margin-top:8px">${insights.top.orders.length} order${insights.top.orders.length === 1 ? "" : "s"} · ${escapeHtml(insights.top.phone || (insights.top.instagram ? `@${insights.top.instagram}` : "No contact detail"))}</div><div style="font:700 31px/1 Georgia,serif;color:#4d633d;margin-top:24px">${money(insights.top.spent)}</div><div class="queue-name">Total paid spend</div></div>` : `<div class="dashboard-empty">Your highest-spending customer will appear here after paid orders come in.</div>`}</section></div></div>`;
}

function renderAnalyticsReportTab() {
  const stats = dashboardStats();
  const performance = salesPerformance();
  const insights = customerInsights();
  const highestDailySale = Math.max(...performance.days.map((day) => day.total), 1);
  const paid = paidOrders(DASHBOARD_MARKET).filter((order) => order.counts_as_sale !== false);
  const now = new Date();
  const period = ["daily","monthly","total"].includes(astate.analyticsPeriod) ? astate.analyticsPeriod : "monthly";
  const periodOrders = paid.filter((order) => { const date=new Date(order.created_at); if(period==="total") return true; if(period==="daily") return date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate(); return date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth(); });
  const periodRevenue = periodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const periodFoodCost = periodOrders.reduce((sum, order) => sum + orderFoodCost(order), 0);
  const periodCashExpenses = (astate.cashFlowEntries || []).filter((entry) => {
    if (String(entry.market_code || "SG").toUpperCase() !== DASHBOARD_MARKET || entry.entry_type !== "expense") return false;
    const date = new Date(entry.occurred_at || entry.created_at);
    if (period === "total") return true;
    if (period === "daily") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const periodProfit = periodRevenue - periodFoodCost - periodCashExpenses;
  const periodMargin = periodRevenue > 0 ? periodProfit / periodRevenue * 100 : 0;
  const averageOrder = periodOrders.length ? periodRevenue / periodOrders.length : 0;
  const repeatRate = stats.customers ? (insights.repeat.length / stats.customers) * 100 : 0;
  const periodProducts = new Map();
  periodOrders.forEach((order) => (order.order_items || []).forEach((item) => { const name=item.product_name||"Unnamed drink",row=periodProducts.get(name)||{name,quantity:0,revenue:0};row.quantity+=Number(item.quantity||0);row.revenue+=Number(item.subtotal||0);periodProducts.set(name,row); }));
  const topProducts = [...periodProducts.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,5);
  const periodLabel = period === "daily" ? "Today" : period === "monthly" ? "This month" : "All time";
  const marketLabel = DASHBOARD_MARKET === "MY" ? "Malaysia · MYR" : "Singapore · SGD";
  return `
    <div class="analytics-toolbar"><div><div class="admin-eyebrow">Analytics report · ${marketLabel}</div><h2 class="analytics-title">Sales at a glance</h2><p class="tab-page-subtitle">Paid sales only · cancelled and complimentary orders are excluded.</p><div class="btn-row" style="margin-top:14px">${[["daily","Daily"],["monthly","Monthly"],["total","Total"]].map(([value,label])=>`<button class="${period===value?"btn-primary":"btn-secondary"}" onclick="astate.analyticsPeriod='${value}';render()">${label}</button>`).join("")}</div></div><button class="btn-secondary" onclick="refreshDashboard()" ${astate.dashboardRefreshing ? "disabled" : ""}>${astate.dashboardRefreshing ? "Refreshing…" : "↻ Refresh report"}</button></div>
    <div class="analytics-kpi-grid">
      <section class="analytics-kpi"><span>${periodLabel} sales</span><strong>${money(periodRevenue)}</strong><small>${periodOrders.length} paid sale${periodOrders.length === 1 ? "" : "s"}</small></section>
      <section class="analytics-kpi"><span>${periodLabel} food cost</span><strong>${money(periodFoodCost)}</strong><small>Direct recipe cost</small></section>
      <section class="analytics-kpi"><span>${periodLabel} stock purchases</span><strong>${money(periodCashExpenses)}</strong><small>Cash paid into inventory</small></section>
      <section class="analytics-kpi"><span>${periodLabel} cash profit</span><strong>${money(periodProfit)}</strong><small>Sales minus food cost and cash expenses</small></section>
      <section class="analytics-kpi"><span>${periodLabel} cash margin</span><strong>${periodMargin.toFixed(1)}%</strong><small>${money(periodProfit)} after recorded expenses</small></section>
      <section class="analytics-kpi"><span>Average order</span><strong>${money(averageOrder)}</strong><small>Across all paid sales</small></section>
      <section class="analytics-kpi"><span>Repeat customers</span><strong>${repeatRate.toFixed(1)}%</strong><small>${insights.repeat.length} of ${stats.customers} customers</small></section>
    </div>
    <div class="analytics-report-grid">
      <section class="dashboard-card analytics-chart"><div class="dashboard-card-head"><div><h2>Sales · last 7 days</h2><span>Daily paid revenue</span></div></div><div class="analytics-bars">${performance.days.map((day) => `<div class="analytics-bar-column"><div class="analytics-bar-value">${day.total ? money(day.total) : "—"}</div><div class="analytics-bar-track"><i style="height:${day.total ? Math.max(8, Math.round(day.total / highestDailySale * 100)) : 2}%"></i></div><b>${day.label}</b></div>`).join("")}</div></section>
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Top 5 drinks</h2><span>${periodLabel} · ranked by sales</span></div></div>${topProducts.length ? topProducts.map((product, index) => `<div class="analytics-rank-row"><span class="analytics-rank">${index + 1}</span><div><b>${escapeHtml(product.name)}</b><small>${product.quantity} cup${product.quantity === 1 ? "" : "s"} sold</small></div><strong>${money(product.revenue)}</strong></div>`).join("") : `<div class="dashboard-empty">Your Top 5 drinks will appear after paid orders come in.</div>`}</section>
    </div>
    <div class="analytics-report-grid analytics-report-grid-secondary">
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Cash flow & margin</h2><span>Sales, recipe cost and recorded stock purchases</span></div></div><div class="analytics-breakdown"><div><span>${periodLabel} sales</span><b>${money(periodRevenue)}</b></div><div><span>${periodLabel} food cost</span><b>${money(periodFoodCost)}</b></div><div><span>${periodLabel} stock purchases</span><b>${money(periodCashExpenses)}</b></div><div><span>${periodLabel} cash profit</span><b>${money(periodProfit)}</b></div><div><span>${periodLabel} cash margin</span><b>${periodMargin.toFixed(1)}%</b></div></div>${stats.missingRecipeProducts.length ? `<div class="ref-note"><b>${stats.missingRecipeProducts.length} product cost warning(s)</b><br>${stats.missingRecipeProducts.map((product) => escapeHtml(product.name)).join(", ")}</div>` : ""}</section>
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Customer snapshot</h2><span>${marketLabel} orders</span></div></div><div class="analytics-breakdown"><div><span>Total customers</span><b>${stats.customers}</b></div><div><span>Repeat customers</span><b>${insights.repeat.length}</b></div><div><span>New this month</span><b>${insights.newThisMonth.length}</b></div><div><span>Top customer</span><b>${escapeHtml(insights.top?.name || "—")}</b></div></div></section>
    </div>`;
}

function renderLogin() {
  if (astate.recoveryMode) return `
  <div class="overlay" style="position:relative;background:none;align-items:flex-start;padding:60px 16px;">
    <div class="overlay-card" style="max-width:340px;margin:0 auto;">
      <div class="display overlay-title">Choose your password</div>
      <div class="overlay-sub">This is a one-time setup. Use this password to sign in to your dashboard from any device.</div>
      <input type="password" autocomplete="new-password" placeholder="New password (at least 10 characters)"
        oninput="astate.recoveryPassword=this.value; astate.loginMessage='';"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      <input type="password" autocomplete="new-password" placeholder="Confirm new password"
        oninput="astate.recoveryPasswordConfirm=this.value; astate.loginMessage='';"
        onkeydown="if(event.key==='Enter') saveNewPassword();"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      ${astate.loginMessage ? `<div class="hint" style="text-align:left;line-height:1.45;margin:0 0 10px;">${escapeHtml(astate.loginMessage)}</div>` : ""}
      <button class="btn-primary" style="width:100%;" onclick="saveNewPassword()">Save password</button>
    </div>
  </div>`;
  return `
  <div class="overlay" style="position:relative;background:none;align-items:flex-start;padding:60px 16px;">
    <div class="overlay-card" style="max-width:340px;margin:0 auto;">
      <div class="display overlay-title">Shop access</div>
      <div class="overlay-sub">Sign in with the Gmail and password linked to your Supabase account.</div>
      <input type="email" placeholder="tinghuioh29@gmail.com" value="${escapeHtml(astate.loginEmail)}"
        oninput="astate.loginEmail=this.value; astate.loginMessage='';"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      <input type="password" autocomplete="current-password" placeholder="Your password" value=""
        oninput="astate.loginPassword=this.value; astate.loginMessage='';"
        onkeydown="if(event.key==='Enter') loginWithPassword();"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid #E1D9C8;margin-bottom:10px;font-size:15px;">
      ${astate.loginMessage ? `<div class="hint" style="text-align:left;line-height:1.45;margin:0 0 10px;">${escapeHtml(astate.loginMessage)}</div>` : ""}
      <div class="btn-row">
        <a href="index.html" style="flex:1;"><button class="btn-secondary" style="width:100%;">Cancel</button></a>
        <button class="btn-primary" onclick="loginWithPassword()">Sign in</button>
      </div>
      <button class="link-btn" style="margin-top:14px;width:100%;" onclick="sendPasswordSetup()">First time here? Set or reset password</button>
    </div>
  </div>`;
}

function renderAdminWelcome() {
  const welcomeBrand = escapeHtml(astate.settings?.store_name || "Your Studio");
  const phase = astate.welcomePhase || "idle";
  const busy = phase === "loading";
  const success = phase === "success";
  const failed = phase === "error";
  return `<style>
    @keyframes shizukuWelcomeIn{0%{opacity:0;transform:translateY(18px) scale(.985)}100%{opacity:1;transform:none}}
    @keyframes lumiBreathe{0%,100%{opacity:.68;filter:saturate(.6) brightness(.88)}50%{opacity:.94;filter:saturate(.82) brightness(1)}}
    @keyframes lumiReady{0%{box-shadow:0 12px 38px rgba(38,49,37,.1)}55%{box-shadow:0 0 0 18px rgba(242,199,107,.12),0 18px 55px rgba(242,199,107,.3)}100%{box-shadow:0 14px 42px rgba(38,49,37,.12)}}
    .admin-welcome{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#f7f0e5 0%,#eef4e7 48%,#e3eddb 100%);color:#263125;text-align:center;overflow:auto}
    .admin-welcome-inner{animation:shizukuWelcomeIn .75s cubic-bezier(.2,.8,.2,1) both}
    .admin-welcome-mark{width:min(230px,58vw);aspect-ratio:1/1;margin:0 auto 16px;display:grid;place-items:center;overflow:hidden}
    .admin-welcome-icon{display:block;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.76;filter:saturate(.65) brightness(.92);transition:filter .3s ease,opacity .3s ease,drop-shadow .3s ease}
    .admin-welcome.is-loading .admin-welcome-icon{animation:lumiBreathe 1.15s ease-in-out infinite}.admin-welcome.is-ready .admin-welcome-mark{animation:lumiReady .55s ease-out}.admin-welcome.is-ready .admin-welcome-icon{opacity:1;filter:saturate(1) brightness(1.04) drop-shadow(0 0 18px rgba(242,199,107,.24))}
    .admin-welcome-kicker{font:800 11px/1.2 'Work Sans',sans-serif;letter-spacing:.18em;color:#7a8c65;text-transform:uppercase;margin-bottom:10px}
    .admin-welcome h1{font:700 clamp(38px,7vw,68px)/.98 Georgia,serif;letter-spacing:-.035em;margin:0}
    .admin-welcome p{font:500 15px/1.5 'Work Sans',sans-serif;color:#68725e;margin:14px 0 0}
    .admin-welcome-enter{margin-top:24px;border:0;border-radius:999px;padding:13px 28px;background:#263125;color:#fff;font:700 14px/1 'Work Sans',sans-serif;cursor:pointer;box-shadow:0 10px 24px rgba(38,49,37,.16)}
    .admin-welcome-enter:hover{transform:translateY(-1px);background:#354434}
    .admin-welcome-enter:disabled{opacity:.74;cursor:wait}.admin-welcome-error{color:#8e3d32}.admin-welcome-success{color:#4b5d3a;font-weight:800}
    @media(prefers-reduced-motion:reduce){.admin-welcome-inner,.admin-welcome-icon,.admin-welcome-mark{animation:none!important}}
  </style><div class="admin-welcome ${busy ? "is-loading" : success ? "is-ready" : ""}" role="status" aria-live="polite"><div class="admin-welcome-inner"><div class="admin-welcome-mark"><img class="admin-welcome-icon" src="lumi-slow-studio.png" alt="Lumi, the little light of Slow Studio"></div><div class="admin-welcome-kicker">Powered by Slow Studio</div><h1>Welcome back,<br>${welcomeBrand}.</h1><p class="${failed ? "admin-welcome-error" : success ? "admin-welcome-success" : ""}">${failed ? "Something needs attention." : success ? "Everything is ready." : "Everything is ready for today’s slow moments."}</p>${failed ? `<div class="hint" style="max-width:360px;margin:8px auto 0;">${escapeHtml(astate.welcomeError || "Please try again.")}</div>` : ""}<button class="admin-welcome-enter" ${busy || success ? "disabled" : ""} onclick="enterAdminNow()">${busy ? "Getting things ready…" : failed ? "Try again" : success ? "All ready." : "Enter Admin →"}</button></div></div>`;
}

async function enterAdminNow() {
  if (astate.welcomePhase === "loading" || astate.welcomePhase === "success") return;
  astate.welcomePhase = "loading";
  astate.welcomeError = "";
  render();
  const started = Date.now();
  try {
    if (!astate.settings || astate.loading) await loadAll();
    if (astate.loadError) throw new Error(astate.loadError);
    const remaining = Math.max(0, 550 - (Date.now() - started));
    if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
    astate.welcomePhase = "success";
    render();
    setTimeout(() => { astate.welcomePending = false; astate.welcomePhase = "idle"; render(); }, 420);
  } catch (error) {
    astate.welcomePhase = "error";
    astate.welcomeError = (error && error.message) || "Please try again.";
    render();
  }
}

function toggleAdminNav() {
  astate.navCollapsed = !astate.navCollapsed;
  try { localStorage.setItem("shizuku-admin-nav-collapsed", astate.navCollapsed ? "1" : "0"); } catch (_) {}
  render();
}

function setOrderFilter(filter) { astate.orderFilter = filter; render(); }
function setOrderSearch(value) { astate.orderSearch = value; render(); }

function offlineReasonLabel(value) {
  return ({ influencer_tasting: "Influencer tasting", complimentary: "Complimentary", replacement: "Replacement", manual_sale: "Offline paid sale", other: "Other" })[value] || "Offline order";
}
function openOfflineOrder() {
  const firstProduct = astate.menu.find((item) => item.is_available !== false) || astate.menu[0];
  astate.offlineOrderDraft = {
    customer_name: "", customer_phone: "", collection_date: localDateText(new Date()), collection_time: "",
    collection_point: (astate.settings?.collection_points || [])[0] || "", offline_reason: "influencer_tasting", counts_as_sale: false,
    notes: "", items: firstProduct ? [{ product_id: firstProduct.id, product_name: firstProduct.name, quantity: 1, unit_price: Number(firstProduct.discount_price || firstProduct.price || 0) }] : []
  };
  render();
}
function closeOfflineOrder() { astate.offlineOrderDraft = null; render(); }
function offlineOrderField(key, value) {
  if (!astate.offlineOrderDraft) return;
  astate.offlineOrderDraft[key] = key === "counts_as_sale" ? !!value : value;
  if (key === "offline_reason" && value !== "manual_sale") astate.offlineOrderDraft.counts_as_sale = false;
  if (key === "offline_reason" && value === "manual_sale") astate.offlineOrderDraft.counts_as_sale = true;
  render();
}
function addOfflineOrderItem() { const p = astate.menu.find((item) => item.is_available !== false) || astate.menu[0]; if (p) { astate.offlineOrderDraft.items.push({ product_id:p.id,product_name:p.name,quantity:1,unit_price:Number(p.discount_price||p.price||0) }); render(); } }
function chooseOfflineProduct(index, id) { const p=astate.menu.find((item)=>String(item.id)===String(id)); const row=astate.offlineOrderDraft?.items?.[index]; if(p&&row){row.product_id=p.id;row.product_name=p.name;row.unit_price=Number(p.discount_price||p.price||0);render();} }
function offlineItemField(index,key,value) { const row=astate.offlineOrderDraft?.items?.[index]; if(row){row[key]=Math.max(0,Number(value||0));render();} }
function removeOfflineItem(index) { astate.offlineOrderDraft?.items?.splice(index,1); render(); }
function offlineOrderCode() { return `SL-O${Math.random().toString(36).slice(2,7).toUpperCase()}`; }
async function saveOfflineOrder() {
  const d=astate.offlineOrderDraft; if(!d||!String(d.customer_name).trim()) return alert("Enter a customer or contact name.");
  const items=(d.items||[]).filter((row)=>Number(row.quantity)>0); if(!items.length) return alert("Add at least one product.");
  const total=d.counts_as_sale ? items.reduce((sum,row)=>sum+Number(row.quantity)*Number(row.unit_price),0) : 0;
  const payload={order_number:offlineOrderCode(),customer_name:String(d.customer_name).trim(),customer_phone:String(d.customer_phone||"").trim(),instagram:"",collection_date:d.collection_date||null,collection_time:String(d.collection_time||"").trim()||null,collection_point:String(d.collection_point||"").trim()||null,total,payment_status:"paid",order_status:"confirmed",notes:String(d.notes||"").trim()||null,payment_method:"Offline",payment_reference:null,is_offline:true,offline_reason:d.offline_reason,counts_as_sale:!!d.counts_as_sale};
  const button=document.getElementById("save-offline-order"); if(button){button.disabled=true;button.textContent="Saving…";}
  let order=null;
  try {
    const result=await db.from("orders").insert(payload).select("*").single(); if(result.error) throw result.error; order=result.data;
    const rows=items.map((row)=>({order_id:order.id,product_id:row.product_id,product_name:row.product_name,quantity:Number(row.quantity),unit_price:d.counts_as_sale?Number(row.unit_price):0,subtotal:d.counts_as_sale?Number(row.quantity)*Number(row.unit_price):0}));
    const inserted=await db.from("order_items").insert(rows); if(inserted.error) throw inserted.error;
    await db.rpc("reconcile_shizuku_order_inventory",{p_order_id:order.id});
    astate.offlineOrderDraft=null; await loadAll(); alert("Offline order created. Inventory has been updated.");
  } catch(error) { if(order?.id) await db.from("orders").delete().eq("id",order.id); alert("Could not create offline order: "+(error?.message||error)); if(button){button.disabled=false;button.textContent="Create offline order";} }
}

function salesOrders() {
  return ordersForMarket(DASHBOARD_MARKET).filter((order)=>order.payment_status==="paid"&&order.order_status!=="cancelled"&&order.counts_as_sale!==false&&(!astate.salesFrom||String(order.collection_date||"")>=astate.salesFrom)&&(!astate.salesTo||String(order.collection_date||"")<=astate.salesTo));
}
function orderFoodCost(order) { return (order.order_items || []).reduce((sum, item) => sum + savedProductFoodCost(item.product_id, DASHBOARD_MARKET) * Number(item.quantity || 0), 0); }
function salesReportRows() { return salesOrders().map((o)=>{const sales=Number(o.total||0),foodCost=orderFoodCost(o),profit=sales-foodCost,margin=sales>0?profit/sales*100:0;return [o.order_number,o.collection_date,o.collection_time,o.customer_name,o.is_offline?"Offline":"Online",o.is_offline?offlineReasonLabel(o.offline_reason):"Customer order",sales.toFixed(2),foodCost.toFixed(2),profit.toFixed(2),`${margin.toFixed(1)}%`,ORDER_LABEL[o.order_status]||o.order_status];}); }
function salesFileName(ext){return `shizuku-sales-${astate.salesFrom||"all"}-to-${astate.salesTo||"today"}.${ext}`;}
function salesReportHeadings(){const currency=DASHBOARD_MARKET==="MY"?"MYR":"SGD";return ["Order","Date","Time","Customer","Channel","Type",`Sales (${currency})`, `Food cost (${currency})`, `Gross profit (${currency})`,"Margin","Status"];}
function downloadSalesExcel(){const headings=salesReportHeadings();const orders=salesOrders(),sales=orders.reduce((sum,o)=>sum+Number(o.total||0),0),cost=orders.reduce((sum,o)=>sum+orderFoodCost(o),0),profit=sales-cost,margin=sales>0?profit/sales*100:0;const table=`<table><tr>${headings.map(x=>`<th>${x}</th>`).join("")}</tr>${salesReportRows().map(row=>`<tr>${row.map(x=>`<td>${escapeHtml(x)}</td>`).join("")}</tr>`).join("")}<tr><th colspan="6">TOTAL</th><th>${sales.toFixed(2)}</th><th>${cost.toFixed(2)}</th><th>${profit.toFixed(2)}</th><th>${margin.toFixed(1)}%</th><th></th></tr></table>`;const blob=new Blob([`<html><head><meta charset="utf-8"></head><body>${table}</body></html>`],{type:"application/vnd.ms-excel"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=salesFileName("xls");a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function printSalesReport(){const win=window.open("","_blank");if(!win)return alert("Please allow the print window in Safari.");const rows=salesReportRows(),orders=salesOrders(),sales=orders.reduce((sum,o)=>sum+Number(o.total||0),0),cost=orders.reduce((sum,o)=>sum+orderFoodCost(o),0),profit=sales-cost,margin=sales>0?profit/sales*100:0;win.document.write(`<html><head><title>Shizuku Lab Sales</title><style>body{font:13px Arial;padding:32px;color:#222}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}h1{font-family:Georgia,serif}.summary{display:flex;gap:24px;justify-content:flex-end;font-size:15px;margin-top:20px}.summary b{display:block;font-size:18px;margin-top:4px}</style></head><body><h1>Shizuku Lab Sales & Profit</h1><p>${escapeHtml(astate.salesFrom||"All dates")} — ${escapeHtml(astate.salesTo||"Today")}</p><table><tr>${salesReportHeadings().map(x=>`<th>${x}</th>`).join("")}</tr>${rows.map(row=>`<tr>${row.map(x=>`<td>${escapeHtml(x)}</td>`).join("")}</tr>`).join("")}</table><div class="summary"><span>Sales<b>${money(sales)}</b></span><span>Food cost<b>${money(cost)}</b></span><span>Gross profit<b>${money(profit)}</b></span><span>Margin<b>${margin.toFixed(1)}%</b></span></div><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close();}

/* ---- order editing ---- */
function editOrder(id) {
  const order = astate.orders.find((item) => String(item.id) === String(id));
  if (!order) return;
  astate.editingOrder = JSON.parse(JSON.stringify(order));
  const redemption = astate.promoRedemptions.find((row) => String(row.order_id) === String(order.id));
  const subtotal = (order.order_items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  astate.editingOrder._promoCode = redemption?.code || null;
  astate.editingOrder._originalPromoDiscount = redemption ? Math.max(0, subtotal - Number(order.total || 0)) : 0;
  render();
}
function closeOrderEditor() { astate.editingOrder = null; render(); }
function editOrderField(key, value) { if (astate.editingOrder) astate.editingOrder[key] = value; }
function editOrderItem(index, key, value) {
  const item = astate.editingOrder?.order_items?.[index];
  if (!item) return;
  if (key === "quantity" || key === "unit_price") item[key] = Math.max(0, Number(value || 0));
  else item[key] = value;
  item.subtotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
  recalculateEditedOrder();
}
function editedOrderDiscount(order, subtotal) { if (!order?._promoCode) return 0; const promo = astate.promos.find((item) => String(item.code).toUpperCase() === String(order._promoCode).toUpperCase()); if (!promo) return Math.min(subtotal, Number(order._originalPromoDiscount || 0)); return Math.min(subtotal, promo.discount_type === "percent" ? subtotal * Number(promo.discount_value || 0) / 100 : Number(promo.discount_value || 0)); }
function recalculateEditedOrder() { if (!astate.editingOrder) return; const subtotal = (astate.editingOrder.order_items || []).filter((row) => !row._removed).reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.unit_price || 0), 0); astate.editingOrder.total = Math.max(0, subtotal - editedOrderDiscount(astate.editingOrder, subtotal)); }
function addOrderItem() {
  const product = astate.menu.find((item) => item.is_available !== false) || astate.menu[0];
  if (!product || !astate.editingOrder) return;
  astate.editingOrder.order_items.push({ id: null, product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.discount_price || product.price || 0), subtotal: Number(product.discount_price || product.price || 0), order_item_options: [] });
  editOrderItem(astate.editingOrder.order_items.length - 1, "quantity", 1);
  render();
}
function chooseOrderItemProduct(index, productId) {
  const product = astate.menu.find((item) => String(item.id) === String(productId));
  const item = astate.editingOrder?.order_items?.[index];
  if (!product || !item) return;
  item.product_id = product.id; item.product_name = product.name; item.unit_price = Number(product.discount_price || product.price || 0); item.order_item_options = [];
  editOrderItem(index, "quantity", item.quantity || 1); render();
}
function removeOrderItem(index) { const item = astate.editingOrder?.order_items?.[index]; if (!item) return; if (item.id) item._removed = true; else astate.editingOrder.order_items.splice(index, 1); recalculateEditedOrder(); render(); }
async function saveEditedOrder() {
  const order = astate.editingOrder;
  if (!order) return;
  const activeItems = (order.order_items || []).filter((item) => !item._removed && Number(item.quantity) > 0);
  if (!activeItems.length) return alert("An order must contain at least one item.");
  const subtotal = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const total = Math.max(0, subtotal - editedOrderDiscount(order, subtotal));
  const fields = { customer_name: String(order.customer_name || "").trim(), customer_phone: String(order.customer_phone || "").trim(), customer_email: String(order.customer_email || "").trim() || null, instagram: String(order.instagram || "").trim(), collection_date: order.collection_date || null, collection_time: order.collection_time || null, collection_point: order.collection_point || null, notes: String(order.notes || "").trim() || null, total };
  const button = document.getElementById("save-edited-order"); if (button) { button.disabled = true; button.textContent = "Saving…"; }
  try {
    const { error: orderError } = await db.from("orders").update(fields).eq("id", order.id); if (orderError) throw orderError;
    for (const item of order.order_items || []) {
      if (item._removed && item.id) { const { error } = await db.from("order_items").delete().eq("id", item.id); if (error) throw error; continue; }
      if (item._removed || Number(item.quantity) <= 0) continue;
      const payload = { product_id: item.product_id, product_name: item.product_name, quantity: Number(item.quantity), unit_price: Number(item.unit_price), subtotal: Number(item.quantity) * Number(item.unit_price) };
      if (item.id) { const { error } = await db.from("order_items").update(payload).eq("id", item.id); if (error) throw error; }
      else { const { error } = await db.from("order_items").insert({ ...payload, order_id: order.id }); if (error) throw error; }
    }
    if (order.payment_status === "paid") await db.rpc("reconcile_shizuku_order_inventory", { p_order_id: order.id });
    astate.editingOrder = null; await loadAll(); alert("Order updated.");
  } catch (error) { alert("Could not update order: " + (error?.message || error)); if (button) { button.disabled = false; button.textContent = "Save order"; } }
}

/* ---- inventory and food cost ---- */
function currentCostingMarket() { return astate.costingMarket === "MY" ? "MY" : "SG"; }
function inventoryForCostingMarket() { const market=currentCostingMarket(); return astate.inventory.filter((item) => String(item.market_code || "SG").toUpperCase() === market); }
function productsForCostingMarket() { return AdminMarketRules.productsForCostingMarket(astate.menu, currentCostingMarket()); }
function productSellingPriceForMarket(product) { return currentCostingMarket() === "MY" ? Number(product?.myr_price || 0) : Number(product?.discount_price || product?.price || 0); }
function setCostingMarket(market) {
  const next = String(market || "SG").toUpperCase() === "MY" ? "MY" : "SG";
  if (next === currentCostingMarket()) return;
  if (astate.recipeDirty && !confirm("You have unsaved food-cost changes. Discard them and switch country?")) { render(); return; }
  astate.costingMarket = next;
  try { localStorage.setItem("shizuku-costing-market", next); } catch (_) {}
  astate.recipeProductId = null; astate.recipeDraftProductId = null; astate.recipeDraft = null; astate.recipeDirty = false; astate.inventoryDraft = null;
  render();
}
function newInventoryItem() { astate.inventoryDraft = { id: null, market_code: currentCostingMarket(), name: "", unit: "g", stock_quantity: 0, low_stock_level: 0, pack_size: 1, pack_cost: 0, supplier: "", cost_type: "ingredient" }; render(); }
function editInventoryItem(id) { const item = astate.inventory.find((row) => String(row.id) === String(id)); astate.inventoryDraft = item ? { ...item } : null; render(); }
function inventoryField(key, value) { if (!astate.inventoryDraft) return; astate.inventoryDraft[key] = ["stock_quantity","low_stock_level","pack_size","pack_cost"].includes(key) ? Math.max(0, Number(value || 0)) : value; }
async function saveInventoryItem() { const d = astate.inventoryDraft; if (!d || !String(d.name).trim()) return alert("Enter the ingredient name."); const payload = { market_code: String(d.market_code || currentCostingMarket()).toUpperCase(), name: String(d.name).trim(), unit: String(d.unit || "g").trim(), stock_quantity: Number(d.stock_quantity || 0), low_stock_level: Number(d.low_stock_level || 0), pack_size: Math.max(.0001, Number(d.pack_size || 1)), pack_cost: Number(d.pack_cost || 0), supplier: String(d.supplier || "").trim() || null, cost_type: d.cost_type === "packaging" ? "packaging" : "ingredient" }; if (window.SLOW_STUDIO_DEMO_MODE) { const row={...payload,id:d.id||crypto.randomUUID()}; astate.inventory=d.id?astate.inventory.map((item)=>String(item.id)===String(d.id)?row:item):[...astate.inventory,row]; astate.inventoryDraft=null; render(); return alert("Demo inventory saved in this browser only."); } const result = d.id ? await db.from("inventory_items").update(payload).eq("id", d.id).select().single() : await db.from("inventory_items").insert(payload).select().single(); if (result.error) return alert("Could not save ingredient: " + result.error.message); astate.inventoryDraft = null; await loadAll(); }
async function deleteInventoryItem(id) { if (!confirm("Delete this ingredient and its recipe links?")) return; if (window.SLOW_STUDIO_DEMO_MODE) { astate.inventory=astate.inventory.filter((item)=>String(item.id)!==String(id)); astate.recipes=astate.recipes.filter((item)=>String(item.inventory_item_id)!==String(id)); render(); return; } const { error } = await db.from("inventory_items").delete().eq("id", id); if (error) return alert(error.message); await loadAll(); }
function beginRecipeDraft(productId) {
  const product = astate.menu.find((row) => String(row.id) === String(productId));
  const market = currentCostingMarket();
  astate.recipeDraftProductId = productId;
  astate.recipeDraft = astate.recipes.filter((row) => String(row.product_id) === String(productId) && String(row.market_code || "SG").toUpperCase() === market).map((row) => ({ ...row, draft_id: String(row.id) }));
  astate.recipeZeroCost = market === "MY" ? product?.malaysia_food_cost_confirmed_zero === true : product?.food_cost_confirmed_zero === true;
  astate.recipeDirty = false;
}
function activeRecipeRows(productId) {
  if (String(astate.recipeDraftProductId) === String(productId) && Array.isArray(astate.recipeDraft)) return astate.recipeDraft;
  const market = currentCostingMarket();
  return astate.recipes.filter((row) => String(row.product_id) === String(productId) && String(row.market_code || "SG").toUpperCase() === market);
}
function setRecipeProduct(id) {
  if (astate.recipeDirty && !confirm("You have unsaved food-cost changes. Discard them and switch product?")) { render(); return; }
  astate.recipeProductId = id;
  beginRecipeDraft(id);
  render();
}
function addRecipeIngredient(inventoryId) {
  if (!astate.recipeProductId || !inventoryId) return;
  if (!Array.isArray(astate.recipeDraft)) beginRecipeDraft(astate.recipeProductId);
  if (astate.recipeDraft.some((row) => String(row.inventory_item_id) === String(inventoryId))) return;
  astate.recipeDraft.push({
    draft_id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    product_id: astate.recipeProductId,
    market_code: currentCostingMarket(),
    inventory_item_id: inventoryId,
    quantity_used: 0,
  });
  astate.recipeZeroCost = false;
  astate.recipeDirty = true;
  render();
}
function setRecipeZeroCost(checked) {
  if (checked && (astate.recipeDraft || []).length && !confirm("Marking this product as $0 cost will remove its current ingredient recipe when you save. Continue?")) { render(); return; }
  astate.recipeZeroCost = !!checked;
  if (checked) astate.recipeDraft = [];
  astate.recipeDirty = true;
  render();
}
function updateRecipeQuantity(id, value) {
  const row = (astate.recipeDraft || []).find((item) => String(item.draft_id) === String(id));
  if (!row) return;
  row.quantity_used = Math.max(0, Number(value || 0));
  astate.recipeDirty = true;
  updateRecipePreview();
}
function deleteRecipeRow(id) {
  astate.recipeDraft = (astate.recipeDraft || []).filter((row) => String(row.draft_id) !== String(id));
  astate.recipeDirty = true;
  render();
}
async function saveProductRecipe() {
  const productId = astate.recipeProductId;
  if (!productId || !Array.isArray(astate.recipeDraft)) return;
  const button = document.getElementById("save-food-cost-btn");
  if (button) { button.disabled = true; button.textContent = "Saving…"; }
  const recipe = astate.recipeDraft.map((row) => ({ inventory_item_id: row.inventory_item_id, quantity_used: Math.max(0, Number(row.quantity_used || 0)) }));
  const { error } = await db.rpc("save_shizuku_market_product_recipe", { p_product_id: String(productId), p_market_code: currentCostingMarket(), p_recipe: recipe });
  if (error) {
    if (button) { button.disabled = false; button.textContent = "Save food cost"; }
    return alert("Could not save food cost: " + error.message + "\n\nRun supabase-malaysia-independent-costing.sql once if this market costing update has not been installed.");
  }
  const zeroField = currentCostingMarket() === "MY" ? "malaysia_food_cost_confirmed_zero" : "food_cost_confirmed_zero";
  const zeroResult = await db.from("products").update({ [zeroField]: astate.recipeZeroCost === true }).eq("id", productId);
  if (zeroResult.error) {
    if (button) { button.disabled = false; button.textContent = "Save food cost"; }
    return alert("Food cost recipe was saved, but the $0 cost choice could not be saved: " + zeroResult.error.message + "\n\nRun supabase-zero-food-cost-option.sql once, then save again.");
  }
  astate.recipeDraft = null;
  astate.recipeDraftProductId = null;
  astate.recipeDirty = false;
  astate.dashboardFocusTarget = null;
  await loadAll({ silent: true });
  alert("Food cost saved.");
}
function ingredientUnitCost(item) { return Number(item?.pack_cost || 0) / Math.max(.0001, Number(item?.pack_size || 1)); }
function productFoodCost(productId) { return activeRecipeRows(productId).reduce((sum, row) => sum + Number(row.quantity_used || 0) * ingredientUnitCost(astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id))), 0); }
function productCostParts(productId) {
  const market = currentCostingMarket();
  return astate.recipes.filter((row) => String(row.product_id) === String(productId) && String(row.market_code || "SG").toUpperCase() === market).reduce((totals, row) => {
    const item = astate.inventory.find((entry) => String(entry.id) === String(row.inventory_item_id));
    const value = Number(row.quantity_used || 0) * ingredientUnitCost(item);
    if (item?.cost_type === "packaging") totals.packaging += value; else totals.food += value;
    return totals;
  }, { food: 0, packaging: 0 });
}
function grossMargin(sellingPrice, totalCost) { return Number(sellingPrice) > 0 ? (Number(sellingPrice) - Number(totalCost)) / Number(sellingPrice) * 100 : 0; }
function marginHealth(margin) {
  const g = astate.marginGuide || {};
  if (margin < Number(g.very_low_max || 20)) return { label:"Very Low", tone:"#B33333", note:"Very little room for operating expenses, wastage, discounts or unexpected costs." };
  if (margin < Number(g.low_max || 30)) return { label:"Low", tone:"#B66A26", note:"Profitable on paper, but margin is quite tight." };
  if (margin < Number(g.acceptable_max || 40)) return { label:"Acceptable", tone:"#A17A20", note:"Reasonable for some wholesale/B2B products, but should still be monitored." };
  if (margin < Number(g.healthy_max || 50)) return { label:"Healthy", tone:"#477A3B", note:"Good margin with more room to cover operating costs." };
  if (margin < Number(g.strong_max || 60)) return { label:"Strong", tone:"#356B45", note:"Strong gross margin." };
  return { label:"Very Strong", tone:"#235C3B", note:"High gross margin, provided the selling price is still reasonable for the customer." };
}
function marginBadge(margin) { const h = marginHealth(margin); return `<span style="display:inline-block;padding:5px 8px;border-radius:99px;background:color-mix(in srgb,${h.tone} 12%,white);color:${h.tone};font-size:11px;font-weight:800;white-space:nowrap;">${margin.toFixed(1)}% · ${h.label}</span>`; }
function marginGuideInfo(kind="direct") { const g=astate.marginGuide||{}; const target=kind==="wholesale"?`${g.wholesale_target_min||30}–${g.wholesale_target_max||50}%+`:`${g.direct_target_min||50}–${g.direct_target_max||70}%+`; return `<details class="ref-note" style="margin:14px 0;"><summary style="cursor:pointer;font-weight:800;">ⓘ What does margin mean?</summary><div style="margin-top:10px;line-height:1.6;">Gross margin shows how much of the selling price remains after direct product costs.<br><br><b>Gross Margin % = (Selling Price − Total Product Cost) ÷ Selling Price × 100</b><br><br>Example: $30 selling price − $18 total cost = $12 gross profit and 40% gross margin.<br><br><b>A positive gross margin does not automatically mean the business is making net profit.</b> Delivery, payment/platform fees, samples, wastage, marketing, discounts, utilities, labour/time, transport and other operating expenses are not included unless entered into costing.<br><br>This is a gross margin health guide, not guaranteed net profit.<br><b>Suggested target: around ${target} gross margin</b> (${kind==="wholesale"?"Wholesale / B2B":"direct-to-customer"} guidance only).</div></details>`; }
function updateRecipePreview() {
  const productId = astate.recipeProductId;
  const selectedProduct = astate.menu.find((item) => String(item.id) === String(productId));
  const cost = productFoodCost(productId);
  const sellingPrice = productSellingPriceForMarket(selectedProduct);
  const percentage = sellingPrice > 0 ? cost / sellingPrice * 100 : 0;
  const costValue = document.getElementById("selected-food-cost-value");
  const percentValue = document.getElementById("selected-food-cost-percent");
  const headerValue = document.getElementById("recipe-cost-header");
  if (costValue) costValue.textContent = marketMoney(cost);
  if (percentValue) percentValue.textContent = `${percentage.toFixed(1)}%`;
  if (headerValue) headerValue.textContent = `${marketMoney(cost)} per serving`;
  (astate.recipeDraft || []).forEach((row) => {
    const ingredient = astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id));
    const line = document.getElementById(`recipe-line-cost-${row.draft_id}`);
    if (line) line.textContent = marketMoney(Number(row.quantity_used || 0) * ingredientUnitCost(ingredient));
  });
}
function renderInventoryTab() {
  if (!astate.inventoryReady) return `<section class="dashboard-card"><div class="dashboard-empty"><b>Inventory setup is not installed yet.</b><br><br>Run <code>supabase-inventory-food-cost.sql</code> once in Supabase SQL Editor, then refresh this page.</div></section>`;
  const market = currentCostingMarket();
  const marketLabel = market === "MY" ? "Malaysia · MYR" : "Singapore · SGD";
  const marketInventory = inventoryForCostingMarket();
  const marketProducts = productsForCostingMarket();
  const productId = astate.recipeProductId || marketProducts[0]?.id;
  if (!astate.recipeProductId && productId) astate.recipeProductId = productId;
  if (productId && (String(astate.recipeDraftProductId) !== String(productId) || !Array.isArray(astate.recipeDraft))) beginRecipeDraft(productId);
  const selectedProduct = astate.menu.find((item) => String(item.id) === String(productId));
  const recipeRows = activeRecipeRows(productId);
  const cost = productFoodCost(productId);
  const sellingPrice = productSellingPriceForMarket(selectedProduct);
  const percentage = sellingPrice > 0 ? cost / sellingPrice * 100 : 0;
  const overviewRows = marketProducts.map((product) => {
    const parts = productCostParts(product.id), total = parts.food + parts.packaging;
    const price = productSellingPriceForMarket(product), profit = price - total, margin = grossMargin(price,total);
    return `<tr onclick="setRecipeProduct('${escapeHtml(product.id)}')" style="cursor:pointer;"><td><b>${escapeHtml(product.name)}</b></td><td>${marketMoney(price)}</td><td>${marketMoney(parts.food)}</td><td>${marketMoney(parts.packaging)}</td><td><b>${marketMoney(total)}</b></td><td>${marketMoney(profit)}</td><td>${marginBadge(margin)}</td></tr>`;
  }).join("");
  const inventoryHtml = marketInventory.length ? marketInventory.map((item) => `
    <div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(item.name)}</b>
      <div class="queue-name">${escapeHtml(item.supplier || "No supplier")} · ${marketMoney(item.pack_cost)} / ${escapeHtml(item.pack_size)} ${escapeHtml(item.unit)}</div>
    </div><div style="text-align:right"><b style="color:${Number(item.stock_quantity) <= Number(item.low_stock_level) ? "#B33333" : "inherit"}">${Number(item.stock_quantity)} ${escapeHtml(item.unit)}</b>
      <div style="margin-top:7px"><button class="link-btn" onclick="editInventoryItem('${item.id}')">Edit</button> <button class="link-danger" onclick="deleteInventoryItem('${item.id}')">Delete</button></div>
    </div></div></div>`).join("") : `<div class="dashboard-empty">Add matcha, milk, syrup, cups and other ingredients.</div>`;
  const recipeHtml = recipeRows.map((row) => {
    const ingredient = astate.inventory.find((item) => String(item.id) === String(row.inventory_item_id));
    const lineCost = Number(row.quantity_used || 0) * ingredientUnitCost(ingredient);
    return `<div style="display:grid;grid-template-columns:1fr 105px 70px;gap:8px;align-items:end;margin:10px 0">
      <div><b>${escapeHtml(ingredient?.name || "Ingredient")}</b><div id="recipe-line-cost-${escapeHtml(row.draft_id)}" class="hint" style="text-align:left;margin:3px 0 0">${marketMoney(lineCost)}</div></div>
      <div><label style="font-size:11px">Use (${escapeHtml(ingredient?.unit || "unit")})</label><input type="number" min="0" step="0.01" value="${Number(row.quantity_used || 0)}" oninput="updateRecipeQuantity('${escapeHtml(row.draft_id)}',this.value)"></div>
      <button class="link-danger" onclick="deleteRecipeRow('${escapeHtml(row.draft_id)}')">Remove</button>
    </div>`;
  }).join("");
  return `
    <section class="dashboard-card" style="padding:18px;margin-bottom:20px"><div class="dashboard-card-head" style="padding:0"><div><h2>${window.SLOW_STUDIO_DEMO_MODE ? "Store costing" : "Country costing"}</h2><span>${window.SLOW_STUDIO_DEMO_MODE ? `Inventory, recipes and costs for this ${market === "MY" ? "Malaysia" : "Singapore"} demo` : "Each country keeps its own inventory, recipe and costs"}</span></div><b>${marketLabel}</b></div>${window.SLOW_STUDIO_DEMO_MODE ? "" : `<div class="tabs" style="margin:14px 0 0"><button class="${market === "SG" ? "active" : ""}" onclick="setCostingMarket('SG')">Singapore · SGD</button><button class="${market === "MY" ? "active" : ""}" onclick="setCostingMarket('MY')">Malaysia · MYR</button></div>${market === "MY" ? `<div class="ref-note" style="margin-top:14px">Only products enabled for Malaysia appear here. Add Malaysia ingredients below and build a separate MY recipe; Singapore costing is never changed.</div>` : ""}`}</section>
    <section class="dashboard-card" style="margin-bottom:20px;"><div class="dashboard-card-head"><div><h2>${marketLabel} costing overview</h2><span>Updates automatically from this country's recipes</span></div></div><div class="costing-table-wrap"><table class="costing-table"><thead><tr><th>Product</th><th>Selling price</th><th>Food cost</th><th>Packaging</th><th>Total cost</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${overviewRows || `<tr><td colspan="7">${market === "MY" ? "Turn on Malaysia availability and add MYR prices in Products first." : "No products yet."}</td></tr>`}</tbody></table></div><div class="hint" style="text-align:left;padding:10px 20px 0;">Tap a product row to open its existing detailed ingredient breakdown.</div><div style="padding:0 20px 18px;">${marginGuideInfo("direct")}</div></section>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">${marketLabel} cost items</div><div class="stat-value">${marketInventory.length}</div><div class="stat-help">${marketInventory.filter((item) => Number(item.stock_quantity) <= Number(item.low_stock_level)).length} low-stock item(s)</div></div>
      <div class="stat"><div class="stat-label">Food + packaging cost</div><div id="selected-food-cost-value" class="stat-value">${marketMoney(cost)}</div><div class="stat-help">Ingredients and packaging per serving</div></div>
      <div class="stat"><div class="stat-label">Product-cost %</div><div id="selected-food-cost-percent" class="stat-value">${percentage.toFixed(1)}%</div><div class="stat-help">Selling price ${marketMoney(sellingPrice)}</div></div>
    </div>
    <div class="dashboard-grid">
      <section class="dashboard-card"><div class="dashboard-card-head"><div><h2>${marketLabel} inventory</h2><span>Stock is deducted only by ${market === "MY" ? "Malaysia" : "Singapore"} orders</span></div><button class="btn-primary" onclick="newInventoryItem()">+ Ingredient / packaging</button></div>${inventoryHtml}</section>
      <section id="food-cost-editor" class="dashboard-card"><div class="dashboard-card-head"><div><h2>${marketLabel} food cost recipe</h2><span id="recipe-cost-header">${marketMoney(cost)} per serving</span></div><button id="save-food-cost-btn" class="btn-primary" ${astate.recipeDirty ? "" : "disabled"} onclick="saveProductRecipe()">Save food cost</button></div>
        <div style="padding:20px"><div class="field"><label>Product</label><select onchange="setRecipeProduct(this.value)">${marketProducts.map((product) => `<option value="${product.id}" ${String(product.id) === String(productId) ? "selected" : ""}>${escapeHtml(product.name)}</option>`).join("")}</select></div>
          ${recipeHtml}
          <label class="slot" style="cursor:pointer;gap:10px;margin:16px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${astate.recipeZeroCost ? "checked" : ""} onchange="setRecipeZeroCost(this.checked)"><span><b>This product intentionally has $0 cost</b><br><span class="hint">Use this only when there is genuinely no direct food or packaging cost.</span></span></label>
          <div class="field" style="margin-top:18px"><label>Add ingredient or packaging</label><select id="food-cost-add-item" ${astate.recipeZeroCost ? "disabled" : ""} onchange="if(this.value){addRecipeIngredient(this.value)}"><option value="">Choose cost item…</option>${marketInventory.filter((item) => !recipeRows.some((row) => String(row.inventory_item_id) === String(item.id))).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></div>
          <div class="ref-note">Add both ingredients and packaging (cup, lid, straw, sticker or carrier). Edit everything first, then press Save food cost once.</div>
        </div>
      </section>
    </div>${astate.inventoryDraft ? renderInventoryEditor() : ""}`;
}

function stockPurchaseField(key,value) { astate.stockPurchaseDraft[key]=["quantity","total_cost"].includes(key)?Math.max(0,Number(value||0)):value; }
async function recordStockPurchase() {
  const draft=astate.stockPurchaseDraft||{};
  const item=astate.inventory.find((row)=>String(row.id)===String(draft.inventory_item_id));
  if(!item) return alert("Choose the inventory item that was purchased.");
  if(Number(draft.quantity)<=0) return alert("Enter the purchased quantity.");
  if(Number(draft.total_cost)<0) return alert("Enter a valid total cost.");
  if(window.SLOW_STUDIO_DEMO_MODE) {
    const id=crypto.randomUUID(),now=new Date().toISOString();
    astate.inventory=astate.inventory.map((row)=>String(row.id)===String(item.id)?{...row,stock_quantity:Number(row.stock_quantity||0)+Number(draft.quantity)}:row);
    astate.stockPurchases=[{id,market_code:currentCostingMarket(),inventory_item_id:item.id,quantity:Number(draft.quantity),total_cost:Number(draft.total_cost),supplier:String(draft.supplier||item.supplier||""),notes:String(draft.notes||""),purchased_at:now},...astate.stockPurchases];
    astate.cashFlowEntries=[{id:crypto.randomUUID(),market_code:currentCostingMarket(),entry_type:"expense",category:"stock_purchase",amount:Number(draft.total_cost),reference_type:"stock_purchase",reference_id:id,notes:String(draft.notes||""),occurred_at:now},...astate.cashFlowEntries];
    astate.stockPurchaseDraft={inventory_item_id:"",quantity:"",total_cost:"",supplier:"",notes:""};
    render(); return alert("Demo purchase recorded locally. Inventory increased and cash profit decreased; nothing was sent to Supabase.");
  }
  const {error}=await db.rpc("record_shizuku_stock_purchase",{p_inventory_item_id:item.id,p_market_code:currentCostingMarket(),p_quantity:Number(draft.quantity),p_total_cost:Number(draft.total_cost),p_supplier:String(draft.supplier||"").trim()||null,p_notes:String(draft.notes||"").trim()||null});
  if(error) return alert("Could not record stock purchase: "+error.message);
  astate.stockPurchaseDraft={inventory_item_id:"",quantity:"",total_cost:"",supplier:"",notes:""};
  await loadAll({silent:true}); alert("Stock purchase recorded. Inventory and cash-flow profit are updated.");
}
function renderStockPurchasePanel() {
  const market=currentCostingMarket(),items=inventoryForCostingMarket(),draft=astate.stockPurchaseDraft||{};
  const purchases=(astate.stockPurchases||[]).filter((row)=>String(row.market_code||"SG").toUpperCase()===market).slice(0,8);
  return `<section class="dashboard-card" style="padding:20px;margin-bottom:20px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Stock purchase</h2><span>Adds stock to ${market==="MY"?"Malaysia":"Singapore"} inventory and records a cash expense</span></div><b>${market==="MY"?"MYR · RM":"SGD · $"}</b></div><div class="workspace-preference-grid"><div class="field"><label>Inventory item</label><select onchange="stockPurchaseField('inventory_item_id',this.value)"><option value="">Choose item…</option>${items.map((item)=>`<option value="${item.id}" ${String(draft.inventory_item_id)===String(item.id)?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}</select></div><div class="field"><label>Quantity purchased</label><input type="number" min="0.01" step="0.01" value="${escapeHtml(draft.quantity||"")}" oninput="stockPurchaseField('quantity',this.value)"></div><div class="field"><label>Total paid</label><input type="number" min="0" step="0.01" value="${escapeHtml(draft.total_cost||"")}" oninput="stockPurchaseField('total_cost',this.value)"></div><div class="field"><label>Supplier</label><input value="${escapeHtml(draft.supplier||"")}" oninput="stockPurchaseField('supplier',this.value)"></div></div><div class="field"><label>Notes</label><input value="${escapeHtml(draft.notes||"")}" oninput="stockPurchaseField('notes',this.value)"></div><button class="btn-primary" onclick="recordStockPurchase()">Record purchase & add stock</button>${purchases.length?`<div class="divider"></div><h3>Recent stock purchases</h3>${purchases.map((row)=>{const item=astate.inventory.find((x)=>String(x.id)===String(row.inventory_item_id));return `<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(item?.name||"Inventory item")}</b><div class="queue-name">+${Number(row.quantity||0)} · ${escapeHtml(row.supplier||"No supplier")} · ${new Date(row.purchased_at||row.created_at).toLocaleDateString()}</div></div><b>${marketMoney(row.total_cost,market)}</b></div></div>`}).join("")}`:""}</section>`;
}
const renderInventoryTabWithoutPurchases=renderInventoryTab;
renderInventoryTab=function(){return renderStockPurchasePanel()+renderInventoryTabWithoutPurchases();};
function renderInventoryEditor() { const d = astate.inventoryDraft, currency=String(d.market_code||currentCostingMarket()).toUpperCase()==="MY"?"MYR":"SGD"; return `<div class="overlay"><div class="overlay-card" style="max-height:85vh;overflow:auto"><div class="display overlay-title" style="font-size:19px">${d.id ? "Edit ingredient" : "New ingredient"}</div><div class="ref-note"><b>${currency === "MYR" ? "Malaysia" : "Singapore"} inventory · ${currency}</b><br>This cost item is kept separate from the other country.</div><div class="field"><label>Name</label><input value="${escapeHtml(d.name)}" oninput="inventoryField('name',this.value)"></div><div class="field"><label>Cost type</label><select onchange="inventoryField('cost_type',this.value)"><option value="ingredient" ${d.cost_type!=="packaging"?"selected":""}>Ingredient / food</option><option value="packaging" ${d.cost_type==="packaging"?"selected":""}>Packaging</option></select></div><div class="field"><label>Unit</label><select onchange="inventoryField('unit',this.value)">${["g","ml","pc","pack","bottle"].map((unit) => `<option ${d.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}</select></div><div class="field"><label>Current stock</label><input type="number" min="0" step="0.01" value="${d.stock_quantity}" oninput="inventoryField('stock_quantity',this.value)"></div><div class="field"><label>Low-stock alert at</label><input type="number" min="0" step="0.01" value="${d.low_stock_level}" oninput="inventoryField('low_stock_level',this.value)"></div><div class="field"><label>Purchased pack size</label><input type="number" min="0.0001" step="0.01" value="${d.pack_size}" oninput="inventoryField('pack_size',this.value)"></div><div class="field"><label>Pack cost (${currency})</label><input type="number" min="0" step="0.01" value="${d.pack_cost}" oninput="inventoryField('pack_cost',this.value)"></div><div class="field"><label>Supplier</label><input value="${escapeHtml(d.supplier || "")}" oninput="inventoryField('supplier',this.value)"></div><div class="btn-row"><button class="btn-secondary" onclick="astate.inventoryDraft=null;render()">Cancel</button><button class="btn-primary" onclick="saveInventoryItem()">Save ingredient</button></div></div></div>`; }

/* ---- Wholesale / B2B ---- */
function newSupplier(){astate.supplierDraft={id:null,name:"",contact_person:"",phone:"",email:"",website_instagram:"",products_supplied:"",notes:""};render();}
function editSupplier(id){const row=astate.suppliers.find(x=>String(x.id)===String(id));astate.supplierDraft=row?{...row}:null;render();}
function supplierField(k,v){if(astate.supplierDraft)astate.supplierDraft[k]=v;}
async function saveSupplier(){const d=astate.supplierDraft;if(!d?.name?.trim())return alert("Enter supplier name.");const {id,...fields}=d;const q=id?db.from("suppliers").update(fields).eq("id",id):db.from("suppliers").insert(fields);const {error}=await q;if(error)return alert("Could not save supplier: "+error.message);astate.supplierDraft=null;await loadAll();}
async function deleteSupplier(id){if(!confirm("Delete this supplier? Wholesale items will keep their own product details."))return;const{error}=await db.from("suppliers").delete().eq("id",id);if(error)return alert(error.message);await loadAll();}
function newWholesale(){astate.wholesaleDraft={id:null,name:"",supplier_id:"",origin:"",purchase_pack_size:1,purchase_price:0,cost_unit:"g",wholesale_pack_size:1,wholesale_selling_price:0,notes:""};render();}
function editWholesale(id){const row=astate.wholesaleItems.find(x=>String(x.id)===String(id));astate.wholesaleDraft=row?{...row}:null;render();}
function wholesaleField(k,v,refresh=false){if(!astate.wholesaleDraft)return;astate.wholesaleDraft[k]=["purchase_pack_size","purchase_price","wholesale_pack_size","wholesale_selling_price"].includes(k)?Math.max(0,Number(v||0)):v;if(refresh)render();}
function wholesaleNumbers(d){const unitCost=Number(d.purchase_price||0)/Math.max(.0001,Number(d.purchase_pack_size||1));const cost=unitCost*Number(d.wholesale_pack_size||0);const price=Number(d.wholesale_selling_price||0);return{unitCost,cost,profit:price-cost,margin:grossMargin(price,cost)};}
async function saveWholesale(){const d=astate.wholesaleDraft;if(!d?.name?.trim())return alert("Enter product / ingredient name.");const{id,...raw}=d;const fields={...raw,supplier_id:raw.supplier_id||null};const q=id?db.from("wholesale_products").update(fields).eq("id",id):db.from("wholesale_products").insert(fields);const{error}=await q;if(error)return alert("Could not save wholesale item: "+error.message);astate.wholesaleDraft=null;await loadAll();}
async function deleteWholesale(id){if(!confirm("Delete this wholesale item?"))return;const{error}=await db.from("wholesale_products").delete().eq("id",id);if(error)return alert(error.message);await loadAll();}
function renderWholesaleTab(){const rows=astate.wholesaleItems.map(item=>{const n=wholesaleNumbers(item),supplier=astate.suppliers.find(s=>String(s.id)===String(item.supplier_id));return `<tr onclick="editWholesale('${item.id}')" style="cursor:pointer"><td><b>${escapeHtml(item.name)}</b><div class="hint" style="text-align:left;margin:3px 0">${escapeHtml(item.origin||"")}</div></td><td>${escapeHtml(supplier?.name||"—")}</td><td>${escapeHtml(item.purchase_pack_size)} ${escapeHtml(item.cost_unit||"unit")} · ${money(item.purchase_price)}</td><td>${money(n.unitCost)}</td><td>${escapeHtml(item.wholesale_pack_size)} ${escapeHtml(item.cost_unit||"unit")}</td><td>${money(item.wholesale_selling_price)}</td><td>${money(n.cost)}</td><td>${money(n.profit)}</td><td>${marginBadge(n.margin)}</td></tr>`}).join("");return `<div class="btn-row" style="justify-content:flex-end;margin-bottom:16px"><button class="btn-secondary" onclick="newSupplier()">+ Supplier</button><button class="btn-primary" onclick="newWholesale()">+ Wholesale item</button></div><section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Wholesale product list</h2><span>Separate from customer menu pricing</span></div></div><div class="costing-table-wrap"><table class="costing-table"><thead><tr><th>Product</th><th>Supplier</th><th>Purchase pack</th><th>Cost / unit</th><th>Wholesale size</th><th>Selling</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${rows||`<tr><td colspan="9">No wholesale items yet.</td></tr>`}</tbody></table></div><div style="padding:0 20px 18px">${marginGuideInfo("wholesale")}</div></section><section class="dashboard-card" style="margin-top:18px"><div class="dashboard-card-head"><h2>Supplier directory</h2><span>${astate.suppliers.length} supplier(s)</span></div>${astate.suppliers.map(s=>`<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(s.name)}</b><div class="queue-name">${escapeHtml([s.contact_person,s.phone,s.email].filter(Boolean).join(" · ")||"No contact details")}</div><div class="queue-name">${escapeHtml(s.products_supplied||"")}</div></div><div><button class="link-btn" onclick="editSupplier('${s.id}')">Edit</button> <button class="link-danger" onclick="deleteSupplier('${s.id}')">Delete</button></div></div></div>`).join("")||`<div class="dashboard-empty">Add suppliers once, then select them when creating wholesale items.</div>`}</section>${astate.supplierDraft?renderSupplierEditor():""}${astate.wholesaleDraft?renderWholesaleEditor():""}`;}
function renderSupplierEditor(){const d=astate.supplierDraft;return `<div class="overlay"><div class="overlay-card" style="max-height:88vh;overflow:auto"><div class="display overlay-title">${d.id?"Edit":"New"} supplier</div>${[["Supplier name","name"],["Contact person","contact_person"],["Phone","phone"],["Email","email"],["Website / Instagram","website_instagram"],["Products supplied","products_supplied"]].map(([l,k])=>`<div class="field"><label>${l}</label><input value="${escapeHtml(d[k]||"")}" oninput="supplierField('${k}',this.value)"></div>`).join("")}<div class="field"><label>Notes</label><textarea rows="4" oninput="supplierField('notes',this.value)">${escapeHtml(d.notes||"")}</textarea></div><div class="btn-row"><button class="btn-secondary" onclick="astate.supplierDraft=null;render()">Cancel</button><button class="btn-primary" onclick="saveSupplier()">Save supplier</button></div></div></div>`;}
function renderWholesaleEditor(){const d=astate.wholesaleDraft,n=wholesaleNumbers(d),h=marginHealth(n.margin);return `<div class="overlay"><div class="overlay-card" style="max-height:88vh;overflow:auto"><div class="display overlay-title">${d.id?"Edit":"New"} wholesale item</div><div class="field"><label>Product / ingredient name</label><input value="${escapeHtml(d.name||"")}" oninput="wholesaleField('name',this.value)"></div><div class="field"><label>Supplier</label><select onchange="wholesaleField('supplier_id',this.value)"><option value="">No supplier selected</option>${astate.suppliers.map(s=>`<option value="${s.id}" ${String(d.supplier_id)===String(s.id)?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select></div><div class="field"><label>Origin</label><input value="${escapeHtml(d.origin||"")}" oninput="wholesaleField('origin',this.value)"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Purchase pack size</label><input type="number" min="0.0001" step="0.01" value="${d.purchase_pack_size}" onchange="wholesaleField('purchase_pack_size',this.value,true)"></div><div class="field"><label>Purchase price</label><input type="number" min="0" step="0.01" value="${d.purchase_price}" onchange="wholesaleField('purchase_price',this.value,true)"></div><div class="field"><label>Cost unit</label><select onchange="wholesaleField('cost_unit',this.value,true)">${["g","ml","unit","pack","bottle"].map(x=>`<option ${d.cost_unit===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Wholesale pack size</label><input type="number" min="0" step="0.01" value="${d.wholesale_pack_size}" onchange="wholesaleField('wholesale_pack_size',this.value,true)"></div><div class="field"><label>Wholesale selling price</label><input type="number" min="0" step="0.01" value="${d.wholesale_selling_price}" onchange="wholesaleField('wholesale_selling_price',this.value,true)"></div></div><div class="stat-grid" style="margin-top:14px"><div class="stat"><div class="stat-label">Cost / ${escapeHtml(d.cost_unit||"unit")}</div><div class="stat-value">${money(n.unitCost)}</div></div><div class="stat"><div class="stat-label">Wholesale cost</div><div class="stat-value">${money(n.cost)}</div></div><div class="stat"><div class="stat-label">Profit</div><div class="stat-value">${money(n.profit)}</div><div class="stat-help">${marginBadge(n.margin)}</div></div></div><div class="ref-note" style="color:${h.tone}"><b>${h.label} gross margin.</b> ${n.margin<Number(astate.marginGuide?.wholesale_target_min||30)?"Margin is below the suggested range. Check whether your selling price covers your other business expenses.":"Healthy gross margin based on current direct costs."}</div><div class="field"><label>Notes</label><textarea rows="4" oninput="wholesaleField('notes',this.value)">${escapeHtml(d.notes||"")}</textarea></div><div class="btn-row">${d.id?`<button class="link-danger" onclick="deleteWholesale('${d.id}')">Delete</button>`:""}<button class="btn-secondary" onclick="astate.wholesaleDraft=null;render()">Cancel</button><button class="btn-primary" onclick="saveWholesale()">Save wholesale item</button></div></div></div>`;}

/* ---- Inspiration board ---- */
const IDEA_CATEGORIES=["Product","Drink","Content","Marketing","Website","B2B","Packaging","Business","Other"];
async function quickAddIdea(){const title=String(astate.quickIdea||"").trim();if(!title)return;const{error}=await db.from("inspiration_ideas").insert({title,category:"Other",status:"active",is_pinned:false});if(error)return alert("Could not save idea: "+error.message);astate.quickIdea="";await loadAll();}
function newIdea(){astate.ideaDraft={id:null,title:"",notes:"",category:"Other",status:"active",is_pinned:false};render();}
function editIdea(id){const row=astate.inspirationIdeas.find(x=>String(x.id)===String(id));astate.ideaDraft=row?{...row}:null;render();}
function ideaField(k,v){if(astate.ideaDraft)astate.ideaDraft[k]=v;}
async function saveIdea(){const d=astate.ideaDraft;if(!d?.title?.trim())return alert("Enter an idea title.");const{id,...fields}=d;const q=id?db.from("inspiration_ideas").update(fields).eq("id",id):db.from("inspiration_ideas").insert(fields);const{error}=await q;if(error)return alert("Could not save idea: "+error.message);astate.ideaDraft=null;await loadAll();}
async function updateIdea(id,fields){const{error}=await db.from("inspiration_ideas").update(fields).eq("id",id);if(error)return alert(error.message);await loadAll();}
async function deleteIdea(id){if(!confirm("Delete this idea?"))return;const{error}=await db.from("inspiration_ideas").delete().eq("id",id);if(error)return alert(error.message);await loadAll();}
function renderInspirationTab(){const ideas=[...astate.inspirationIdeas].sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned)||new Date(b.created_at)-new Date(a.created_at));return `<section class="dashboard-card" style="padding:18px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 14px"><div><h2>Quick capture</h2><span>Save an idea in a few seconds</span></div></div><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px"><input placeholder="What are you thinking about?" value="${escapeHtml(astate.quickIdea)}" oninput="astate.quickIdea=this.value" onkeydown="if(event.key==='Enter')quickAddIdea()"><button class="btn-primary" onclick="quickAddIdea()">+ New idea</button></div></section><div class="idea-board">${ideas.map(i=>`<article class="dashboard-card idea-card ${i.status==='archived'?'idea-archived':''}" style="padding:17px"><div style="display:flex;justify-content:space-between;gap:10px"><span class="queue-status">${escapeHtml(i.category||"Other")}</span><button class="link-btn" title="${i.is_pinned?"Unpin":"Pin"}" onclick="updateIdea('${i.id}',{is_pinned:${!i.is_pinned}})">${i.is_pinned?"★":"☆"}</button></div><h3 style="margin:14px 0 8px">${escapeHtml(i.title)}</h3>${i.notes?`<div style="white-space:pre-wrap;line-height:1.5;color:var(--admin-muted)">${escapeHtml(i.notes)}</div>`:""}<div class="hint" style="text-align:left;margin:14px 0 10px">${new Date(i.created_at).toLocaleDateString()} · ${i.status==='archived'?"Archived":"Active"}</div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="link-btn" onclick="editIdea('${i.id}')">Edit</button><button class="link-btn" onclick="updateIdea('${i.id}',{status:'${i.status==='archived'?"active":"archived"}'})">${i.status==='archived'?"Restore":"Done / archive"}</button><button class="link-danger" onclick="deleteIdea('${i.id}')">Delete</button></div></article>`).join("")||`<div class="dashboard-card dashboard-empty">Your newest ideas will appear here. Pinned ideas stay at the top.</div>`}</div>${astate.ideaDraft?renderIdeaEditor():""}`;}

const TEAM_ROLES = ["Owner", "Store Manager", "Operations", "Kitchen & Prep", "Marketing", "Admin", "Crew"];
function isTeamOwner() {
  return String(astate.currentTeamMember?.role || "").toLowerCase() === "owner"
    || String(astate.currentUser?.email || "").toLowerCase() === String(ADMIN_EMAIL || "").toLowerCase();
}
function setTeamSection(section) { astate.teamSection = section; render(); }
function newTeamMember() {
  if (!isTeamOwner()) return;
  astate.editingTeamId = null;
  astate.teamDraft = { display_name: "", email: "", role: "Operations", is_active: true };
  render();
}
function editTeamMember(id) {
  if (!isTeamOwner()) return;
  const member = astate.teamMembers.find((item) => String(item.id) === String(id));
  if (!member) return;
  astate.editingTeamId = member.id;
  astate.teamDraft = { ...member };
  render();
}
function teamDraftField(key, value) { if (astate.teamDraft) astate.teamDraft[key] = value; }
function closeTeamEditor() { astate.teamDraft = null; astate.editingTeamId = null; render(); }
async function refreshTeamData() {
  const [teamResult, activityResult] = await Promise.all([
    db.from("studio_users").select("*").order("created_at"),
    db.from("activity_log").select("*").order("created_at", { ascending: false }).limit(250),
  ]);
  if (!teamResult.error) astate.teamMembers = teamResult.data || [];
  if (!activityResult.error) astate.activityLog = activityResult.data || [];
  const currentEmail = String(astate.currentUser?.email || "").toLowerCase();
  astate.currentTeamMember = astate.teamMembers.find((member) => String(member.email || "").toLowerCase() === currentEmail) || astate.currentTeamMember;
}
async function sendTeamInvite(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await db.functions.invoke("invite-team-member", { body: { email, redirect_to: redirectTo } });
  if (error) return { ok: false, message: error.message || "Invite email could not be sent." };
  return { ok: !!data?.ok, message: data?.already_registered ? "Access saved. This email already has a login." : "Access saved and invitation email sent." };
}
async function saveTeamMember() {
  if (!isTeamOwner() || !astate.teamDraft) return;
  const draft = astate.teamDraft;
  const email = String(draft.email || "").trim().toLowerCase();
  const displayName = String(draft.display_name || "").trim();
  if (!displayName || !email.includes("@")) { alert("Add the team member's name and a valid email."); return; }
  const payload = { display_name: displayName, email, role: TEAM_ROLES.includes(draft.role) ? draft.role : "Operations", is_active: draft.is_active !== false, updated_at: new Date().toISOString() };
  const button = document.getElementById("save-team-member");
  if (button) { button.disabled = true; button.textContent = astate.editingTeamId ? "Saving…" : "Sending invite…"; }
  const result = astate.editingTeamId
    ? await db.from("studio_users").update(payload).eq("id", astate.editingTeamId).select().single()
    : await db.from("studio_users").insert(payload).select().single();
  if (result.error) { if (button) { button.disabled = false; button.textContent = "Save member"; } alert("Could not save this team member: " + result.error.message); return; }
  let message = "Team member saved.";
  if (!astate.editingTeamId) {
    const invite = await sendTeamInvite(email);
    message = invite.ok ? invite.message : `Access was saved, but the invitation email was not sent: ${invite.message}`;
  }
  astate.teamDraft = null;
  astate.editingTeamId = null;
  await refreshTeamData();
  alert(message);
  render();
}
async function deleteTeamMember(id) {
  if (!isTeamOwner()) return;
  const member = astate.teamMembers.find((item) => String(item.id) === String(id));
  if (!member) return;
  if (String(member.email || "").toLowerCase() === String(astate.currentUser?.email || "").toLowerCase()) { alert("You cannot remove your own owner access."); return; }
  if (!confirm(`Remove ${member.display_name} from this workspace?`)) return;
  const { error } = await db.from("studio_users").delete().eq("id", id);
  if (error) { alert("Could not remove this team member: " + error.message); return; }
  await refreshTeamData();
  render();
}
function workspacePreferenceField(key, value) {
  if (key === "business_country") astate.settingsDraft.business_country = value;
  if (key === "store_currency") astate.settingsDraft.store_currency = value;
  if (key === "store_language") astate.settingsDraft.store_language = value;
  render();
}
async function saveWorkspacePreferences() {
  if (!isTeamOwner() || !astate.settings?.id) return;
  const fields = {
    business_country: astate.settingsDraft.business_country || "Singapore",
    store_currency: astate.settingsDraft.store_currency || "SGD",
    store_language: astate.settingsDraft.store_language || "English",
  };
  const studioData = { ...(astate.studioSettings || {}), country: fields.business_country, currency: fields.store_currency, language: fields.store_language };
  const [storeResult, studioResult] = await Promise.all([
    db.from("store_settings").update(fields).eq("id", astate.settings.id).select().single(),
    db.from("studio_settings").update({ data: studioData, updated_by: astate.currentUser?.id || null, updated_at: new Date().toISOString() }).eq("id", "main").select().single(),
  ]);
  if (storeResult.error || studioResult.error) { alert("Could not save workspace preferences: " + (storeResult.error?.message || studioResult.error?.message)); return; }
  astate.settings = storeResult.data;
  astate.settingsDraft = { ...storeResult.data };
  astate.studioSettings = studioResult.data?.data || studioData;
  await refreshTeamData();
  alert("Workspace preferences saved.");
  render();
}
function activityDate(value) {
  try { return new Date(value).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (_) { return String(value || ""); }
}
function renderTeamEditor() {
  const draft = astate.teamDraft;
  if (!draft) return "";
  const editingSelf = String(draft.email || "").toLowerCase() === String(astate.currentUser?.email || "").toLowerCase();
  return `<div class="overlay"><div class="overlay-card" style="max-width:560px"><div class="display overlay-title">${astate.editingTeamId ? "Edit team member" : "Invite team member"}</div><div class="overlay-sub">Choose their workspace name and F&amp;B role. New members receive a secure login invitation by email.</div><div class="field"><label>Name shown in workspace</label><input value="${escapeHtml(draft.display_name || "")}" oninput="teamDraftField('display_name',this.value)"></div><div class="field"><label>Email</label><input type="email" value="${escapeHtml(draft.email || "")}" ${editingSelf ? "readonly" : ""} oninput="teamDraftField('email',this.value)"></div><div class="field"><label>Role / rank</label><select onchange="teamDraftField('role',this.value)">${TEAM_ROLES.map((role) => `<option value="${escapeHtml(role)}" ${draft.role === role ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}</select></div><label class="slot" style="margin:12px 0 18px"><input type="checkbox" style="width:auto" ${draft.is_active !== false ? "checked" : ""} onchange="teamDraftField('is_active',this.checked)"><span><b>Can access this workspace</b><br><span class="hint" style="margin:0">Turn this off to suspend access without deleting their history.</span></span></label><div class="btn-row"><button class="btn-secondary" onclick="closeTeamEditor()">Cancel</button><button class="btn-primary" id="save-team-member" onclick="saveTeamMember()">${astate.editingTeamId ? "Save member" : "Save & send invite"}</button></div></div></div>`;
}
function renderTeamTab() {
  const owner = isTeamOwner();
  const section = astate.teamSection || "team";
  const currentName = astate.currentTeamMember?.display_name || "Ting";
  const currentRole = astate.currentTeamMember?.role || "Owner";
  const settings = astate.settingsDraft || {};
  return `<div class="tabs"><button class="${section === "team" ? "active" : ""}" onclick="setTeamSection('team')">Team</button><button class="${section === "activity" ? "active" : ""}" onclick="setTeamSection('activity')">Activity log</button><button class="${section === "workspace" ? "active" : ""}" onclick="setTeamSection('workspace')">Country, currency & language</button></div>
  ${section === "activity" ? `<section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Activity log</h2><span>Latest workspace changes, newest first</span></div><button class="btn-secondary" onclick="refreshTeamData().then(render)">↻ Refresh</button></div><div class="activity-list">${astate.activityLog.map((entry) => `<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(entry.summary || entry.action || "Workspace update")}</b><div class="queue-name">${escapeHtml(entry.actor_name || entry.actor_email || "Team member")} · ${escapeHtml(entry.module || "Admin")}</div></div><time class="queue-name">${escapeHtml(activityDate(entry.created_at))}</time></div></div>`).join("") || `<div class="dashboard-empty">New team activity will appear here.</div>`}</div></section>` : section === "workspace" ? `<section class="dashboard-card" style="padding:20px"><div class="dashboard-card-head" style="padding:0 0 17px"><div><h2>Workspace region</h2><span>Used for money formatting and future localisation</span></div></div><div class="workspace-preference-grid"><div class="field"><label>Country</label><select ${owner ? "" : "disabled"} onchange="workspacePreferenceField('business_country',this.value)">${["Singapore","Malaysia","Other"].map((value) => `<option value="${value}" ${settings.business_country === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label>Currency</label><select ${owner ? "" : "disabled"} onchange="workspacePreferenceField('store_currency',this.value)">${[["SGD","Singapore Dollar (SGD)"],["MYR","Malaysian Ringgit (MYR)"],["USD","US Dollar (USD)"],["CNY","Chinese Yuan (CNY)"]].map(([value,label]) => `<option value="${value}" ${settings.store_currency === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label>Language preference</label><select ${owner ? "" : "disabled"} onchange="workspacePreferenceField('store_language',this.value)">${[["English","English"],["Malay","Bahasa Melayu"],["Mandarin","中文 / Mandarin"]].map(([value,label]) => `<option value="${value}" ${settings.store_language === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div><div class="hint" style="text-align:left;margin:5px 0 16px">Currency changes money display across Admin and the customer ordering page. Language is saved as the workspace preference; your editable customer wording remains unchanged.</div>${owner ? `<button class="btn-primary" onclick="saveWorkspacePreferences()">Save workspace preferences</button>` : `<div class="hint" style="text-align:left">Only the Owner can change workspace preferences.</div>`}</section>` : `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 17px"><div><h2>Your workspace profile</h2><span>This name appears in your dashboard greeting</span></div></div><div class="team-profile"><div class="team-avatar">${escapeHtml(currentName.slice(0,1).toUpperCase())}</div><div><b>${escapeHtml(currentName)}</b><div class="queue-name">${escapeHtml(currentRole)} · ${escapeHtml(astate.currentTeamMember?.email || astate.currentUser?.email || "")}</div></div>${owner && astate.currentTeamMember?.id ? `<button class="btn-secondary" onclick="editTeamMember('${astate.currentTeamMember.id}')">Edit my name</button>` : ""}</div></section><section class="dashboard-card"><div class="dashboard-card-head"><div><h2>Team</h2><span>${astate.teamMembers.filter((member) => member.is_active).length} active member(s)</span></div>${owner ? `<button class="btn-primary" onclick="newTeamMember()">+ Invite member</button>` : ""}</div><div class="team-list">${astate.teamMembers.map((member) => `<div class="queue-row"><div class="queue-top"><div class="team-member-main"><div class="team-avatar small">${escapeHtml(String(member.display_name || member.email || "T").slice(0,1).toUpperCase())}</div><div><b>${escapeHtml(member.display_name || "Team member")}</b><div class="queue-name">${escapeHtml(member.email)} · ${member.auth_user_id ? "Joined" : "Invitation pending"}</div></div></div><div class="team-member-actions"><span class="queue-status">${escapeHtml(member.role || "Crew")}</span><span class="queue-status ${member.is_active ? "" : "status-cancelled"}">${member.is_active ? "Active" : "Suspended"}</span>${owner ? `<button class="link-btn" onclick="editTeamMember('${member.id}')">Edit</button>${String(member.email || "").toLowerCase() !== String(astate.currentUser?.email || "").toLowerCase() ? `<button class="link-danger" onclick="deleteTeamMember('${member.id}')">Remove</button>` : ""}` : ""}</div></div></div>`).join("") || `<div class="dashboard-empty">Add your first team member when you are ready.</div>`}</div></section>`}
  ${renderTeamEditor()}`;
}
function setMalaysiaCollectionPoints(value) {
  astate.settingsDraft.malaysia_collection_points = String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);
}
function openMalaysiaCosting() {
  astate.costingMarket = "MY";
  try { localStorage.setItem("shizuku-costing-market", "MY"); } catch (_) {}
  setTab("inventory");
}
function openMalaysiaAvailability() {
  astate.availabilityMarket = "MY";
  try { localStorage.setItem("shizuku-availability-market", "MY"); } catch (_) {}
  setAvailabilityDraft(astate.selectedAvailabilityDate || localDateText(new Date()));
  setTab("availability");
}
function renderMalaysiaTab() {
  const s = astate.settingsDraft || {};
  const points = Array.isArray(s.malaysia_collection_points) ? s.malaysia_collection_points.join("\n") : "";
  return `<section class="dashboard-card" style="padding:22px;max-width:920px"><div class="dashboard-card-head" style="padding:0 0 17px"><div><h2>Malaysia ordering</h2><span>A separate MYR storefront option for Touch ’n Go orders</span></div><span>${s.malaysia_enabled === true ? "On" : "Off"}</span></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin:15px 0"><input type="checkbox" style="width:auto" ${s.malaysia_enabled === true ? "checked" : ""} onchange="onSettingsField('malaysia_enabled',this.checked);render()"><span><b>Turn on Malaysia ordering 🌍</b><br><span class="hint" style="margin:0">When on, customers can switch between Singapore · SGD and Malaysia · MYR. Existing Singapore prices and PayNow settings stay unchanged.</span></span></label>
    <div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px">Touch ’n Go payment</div>
    <div class="field"><label>Touch ’n Go account name</label><input value="${escapeHtml(s.touchngo_name || "")}" placeholder="Your account name" oninput="onSettingsField('touchngo_name',this.value)"></div>
    <div class="field"><label>Touch ’n Go phone number</label><input value="${escapeHtml(s.touchngo_number || "")}" placeholder="e.g. 60123456789" oninput="onSettingsField('touchngo_number',this.value)"></div>
    <div class="field"><label>Touch ’n Go QR image</label><input value="${escapeHtml(s.touchngo_qr_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('touchngo_qr_url',this.value)"><input type="file" accept="image/*" style="margin-top:8px" onchange="uploadStorefrontImage(this,'touchngo_qr_url')">${s.touchngo_qr_url ? `<img src="${escapeHtml(s.touchngo_qr_url)}" alt="Touch ’n Go QR preview" style="display:block;max-width:260px;width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border:1px solid var(--admin-line);border-radius:14px;margin-top:10px">` : ""}<div class="hint" style="text-align:left;margin-top:6px">The checkout always shows the exact locked order total in MYR. Customers cannot edit the order amount inside Shizuku Lab; verify the paid amount against the order before confirming.</div></div>
    <div class="field"><label>Malaysia collection points — one per line</label><textarea rows="5" placeholder="Johor Bahru collection point" oninput="setMalaysiaCollectionPoints(this.value)">${escapeHtml(points)}</textarea></div>
    <div class="ref-note"><b>Product prices</b><br>Open Products → Edit to choose which drinks are available in Malaysia and enter their MYR price. Singapore prices are stored separately and will not change.</div>
    <div class="ref-note"><b>Malaysia costing &amp; inventory</b><br>Ingredients, packaging, recipes, stock and profit are stored separately in MYR. They never overwrite Singapore costing.</div>
    <div class="btn-row" style="margin-top:16px"><button class="btn-secondary" onclick="openMalaysiaCosting()">Open Malaysia costing →</button><button class="btn-secondary" onclick="openMalaysiaAvailability()">Open Malaysia availability →</button><button class="btn-primary" id="save-settings-btn" onclick="saveSettings()">Save Malaysia settings</button></div>
  </section>`;
}
function renderIdeaEditor(){const d=astate.ideaDraft;return `<div class="overlay"><div class="overlay-card"><div class="display overlay-title">${d.id?"Edit":"New"} idea</div><div class="field"><label>Title</label><input value="${escapeHtml(d.title||"")}" oninput="ideaField('title',this.value)"></div><div class="field"><label>Notes</label><textarea rows="6" oninput="ideaField('notes',this.value)">${escapeHtml(d.notes||"")}</textarea></div><div class="field"><label>Category</label><select onchange="ideaField('category',this.value)">${IDEA_CATEGORIES.map(x=>`<option ${d.category===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Status</label><select onchange="ideaField('status',this.value)"><option value="active" ${d.status!=="archived"?"selected":""}>Active</option><option value="archived" ${d.status==="archived"?"selected":""}>Done / archived</option></select></div><label class="slot"><input type="checkbox" style="width:auto" ${d.is_pinned?"checked":""} onchange="ideaField('is_pinned',this.checked)"> Pin this idea</label><div class="btn-row"><button class="btn-secondary" onclick="astate.ideaDraft=null;render()">Cancel</button><button class="btn-primary" onclick="saveIdea()">Save idea</button></div></div></div>`;}
function orderMatchesFilter(order, filter) { return AdminOrderRules.orderMatchesFilter(order, filter); }
function renderPreparationTab() {
  const today = localDateText(new Date());
  const orders = ordersForMarket(DASHBOARD_MARKET).filter((order) => order.collection_date === today && order.payment_status === "paid" && !["cancelled","collected"].includes(order.order_status)).sort((a,b) => String(a.collection_time || "").localeCompare(String(b.collection_time || "")));
  const totals = new Map();
  orders.forEach((order) => (order.order_items || []).forEach((item) => totals.set(item.product_name, (totals.get(item.product_name) || 0) + Number(item.quantity || 0))));
  return `<style>@media print{.admin-side,.admin-top,.no-print{display:none!important}.admin-main{padding:0!important}.prep-print{box-shadow:none!important;border:0!important}}</style><section class="dashboard-card prep-print" style="padding:22px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Today · ${escapeHtml(today)}</h2><div><span>${orders.length} active paid order${orders.length === 1 ? "" : "s"}</span><button class="btn-secondary no-print" style="margin-left:10px;" onclick="window.print()">Print list</button></div></div><div class="display" style="font-size:20px;margin:6px 0 10px;">Total drinks to prepare</div>${totals.size ? [...totals.entries()].map(([name,qty]) => `<div class="row" style="padding:9px 0;border-bottom:1px solid #eee5da;"><b>${escapeHtml(name)}</b><b>× ${qty}</b></div>`).join("") : `<div class="dashboard-empty">No paid drinks scheduled for today.</div>`}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:10px;">Preparation order</div>${orders.map((order) => `<div style="padding:14px 0;border-bottom:1px solid #eee5da;"><div class="queue-top"><b>${escapeHtml(order.collection_time || "Time pending")} · ${escapeHtml(order.customer_name || "Customer")}</b><span class="mono">${escapeHtml(order.order_number || order.id)}</span></div><div class="queue-name" style="margin-top:7px;">${(order.order_items || []).map((item) => `${escapeHtml(item.product_name)} × ${Number(item.quantity || 0)}`).join(" · ")}</div><div class="queue-name">${escapeHtml(order.collection_point || "")}${order.notes ? ` · Note: ${escapeHtml(order.notes)}` : ""}</div></div>`).join("")}</section>`;
}
function whatsappPhoneNumber(value) { return AdminOrderRules.normalizeSingaporeWhatsAppNumber(value); }
function friendlyCollectionDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || "your selected date";
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
const DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE = "Hi {customer_name}, Shizuku Lab here! Just to let you know that your order has been confirmed. See you on {date} at {time}, at {collection_point}.\n\nYour order:\n{order_items}";
function whatsappOrderItems(order) {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  if (!items.length) return "Order details are available in your confirmation.";
  return items.map((item) => {
    const options = Array.isArray(item.options) ? item.options.map((option) => option.option_name || option.name).filter(Boolean) : [];
    return `• ${Number(item.quantity || 1)} × ${String(item.product_name || "Item")}${options.length ? ` — ${options.join(", ")}` : ""}`;
  }).join("\n");
}
function fillWhatsAppConfirmationTemplate(template, values) {
  return String(template || DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE)
    .replaceAll("{customer_name}", values.customer_name)
    .replaceAll("{date}", values.date)
    .replaceAll("{time}", values.time)
    .replaceAll("{collection_point}", values.collection_point)
    .replaceAll("{order_items}", values.order_items || "");
}
function orderWhatsAppUrl(order) {
  const phone = whatsappPhoneNumber(order?.customer_phone);
  if (!phone) return "";
  const message = fillWhatsAppConfirmationTemplate(astate.settings?.whatsapp_confirmation_template, {
    customer_name: String(order.customer_name || "there").trim(),
    date: friendlyCollectionDate(order.collection_date),
    time: String(order.collection_time || "your selected time").trim(),
    collection_point: String(order.collection_point || "your selected collection point").trim(),
    order_items: whatsappOrderItems(order),
  });
  return AdminOrderRules.buildWhatsAppUrl(phone, message);
}
function showWhatsAppNumberError(orderId) {
  astate.whatsappError = { orderId: String(orderId), message: "This customer’s phone number is missing or is not a valid Singapore number. Edit the order and save a valid number before trying again." };
  render();
}
function sendOrderWhatsApp(orderId) {
  const order = astate.orders.find((row) => String(row.id) === String(orderId));
  if (!order) { astate.whatsappError = { orderId: String(orderId), message: "Could not find this order." }; render(); return; }
  const whatsappUrl = orderWhatsAppUrl(order);
  if (!whatsappUrl) { showWhatsAppNumberError(orderId); return; }
  astate.whatsappError = null;
  // Keep navigation synchronous inside the tap event so iPhone Safari does not block it.
  window.location.href = whatsappUrl;
}
async function sendCustomerConfirmationEmail(orderId) {
  const order = astate.orders.find((row) => String(row.id) === String(orderId));
  if (!order) return alert("Could not find this order.");
  if (order.payment_status !== "paid" || order.order_status === "cancelled") return alert("Confirm the payment before sending the customer confirmation email.");
  if (!String(order.customer_email || "").trim()) return alert("This customer did not provide an email address. You can add it from Edit order first.");
  astate.customerEmailSendingId = String(orderId);
  render();
  const { data, error } = await db.rpc("send_customer_order_confirmation", { p_order_id: Number(orderId) });
  astate.customerEmailSendingId = null;
  if (error || data?.ok === false) {
    render();
    return alert("Could not send confirmation email: " + (error?.message || data?.error || "Unknown error"));
  }
  const sentAt = new Date().toISOString();
  astate.orders = astate.orders.map((row) => String(row.id) === String(orderId) ? { ...row, customer_confirmation_email_sent_at: sentAt } : row);
  render();
  alert(`Confirmation email sent to ${order.customer_email}.`);
}
function renderOrders() {
  const search = String(astate.orderSearch || "").trim().toLowerCase();
  const marketOrders = ordersForMarket(DASHBOARD_MARKET);
  const orders = marketOrders.filter((order) => {
    const searchable = [order.order_number, order.customer_name, order.customer_phone, order.instagram, order.collection_date].join(" ").toLowerCase();
    return orderMatchesFilter(order, astate.orderFilter) && (!search || searchable.includes(search));
  });
  const filters = [
    ["all", "All orders"], ["payment", "Payment review"], ["awaiting", "Awaiting payment"],
    ["paid", "Paid"], ["preparing", "Preparing"], ["ready", "Ready"], ["collected", "Collected"], ["cancelled", "Cancelled"]
  ];
  const controls = `<section class="dashboard-card" style="padding:18px 20px;margin-bottom:18px;overflow:visible;">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <input aria-label="Search orders" placeholder="Search order, customer, phone or Instagram" value="${escapeHtml(astate.orderSearch)}" oninput="setOrderSearch(this.value)" style="flex:1 1 320px;margin:0;">
      <button class="btn-primary" onclick="openOfflineOrder()">+ Offline order</button>
      <span class="hint" style="margin:0;white-space:nowrap;">${orders.length} shown</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px;">${filters.map(([key, label]) => `<button class="${astate.orderFilter === key ? "btn-primary" : "btn-secondary"}" style="padding:8px 11px;font-size:12px;" onclick="setOrderFilter('${key}')">${label}</button>`).join("")}</div>
  </section><section class="dashboard-card" style="padding:16px 20px;margin-bottom:18px;"><div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap;"><div class="field" style="margin:0"><label>Sales from</label><input type="date" value="${escapeHtml(astate.salesFrom)}" onchange="astate.salesFrom=this.value;render()"></div><div class="field" style="margin:0"><label>To</label><input type="date" value="${escapeHtml(astate.salesTo)}" onchange="astate.salesTo=this.value;render()"></div><button class="btn-secondary" onclick="downloadSalesExcel()">Download Excel</button><button class="btn-secondary" onclick="printSalesReport()">Print / Save PDF</button><span class="hint" style="margin:0 0 10px">${salesOrders().length} sales · ${money(salesOrders().reduce((sum,o)=>sum+Number(o.total||0),0))}. Free tastings are excluded.</span></div></section>`;
  const quickStatus = (o) => {
    if (o.payment_status !== "paid") return `<span class="order-status-pill">${escapeHtml(PAY_LABEL[o.payment_status] || ORDER_LABEL[o.order_status] || "Payment review")}</span>`;
    const currentLabel = o.order_status === "confirmed" ? "Paid" : o.order_status === "ready" ? "Ready for collection" : ORDER_LABEL[o.order_status] || "Paid";
    const next = nextFulfilmentStatus(o);
    const nextLabel = next === "ready" ? "Ready for collection" : ORDER_LABEL[next] || next;
    return `<button type="button" class="order-status-step status-${escapeHtml(o.order_status || "confirmed")}" ${next ? `onclick="advanceOrderStatus('${o.id}')" aria-label="Change ${escapeHtml(o.order_number || "order")} to ${escapeHtml(nextLabel)}" title="Press to mark ${escapeHtml(nextLabel)}"` : "disabled"}>${escapeHtml(currentLabel)}${o.order_status === "collected" ? " ✓" : ""}</button>`;
  };
  const details = (o) => {
    const redemption = astate.promoRedemptions.find((row) => String(row.order_id) === String(o.id));
    const subtotal = (o.order_items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const discount = redemption ? Math.max(0, subtotal - Number(o.total || 0)) : 0;
    const whatsappUrl = orderWhatsAppUrl(o);
    const whatsappConfirmationEnabled = astate.settings?.whatsapp_confirmation_enabled !== false;
    const canConfirmByWhatsApp = whatsappConfirmationEnabled && o.payment_status === "paid" && o.order_status !== "cancelled";
    const customerEmailEnabled = astate.notificationSettings?.customer_email_enabled !== false;
    const canEmailCustomer = customerEmailEnabled && o.payment_status === "paid" && o.order_status !== "cancelled" && !!String(o.customer_email || "").trim();
    const emailSending = String(astate.customerEmailSendingId || "") === String(o.id);
    return `<div class="order-expanded-detail" data-order-id="${escapeHtml(o.id)}">
      <div class="order-meta">Phone: ${escapeHtml(o.customer_phone || "—")}${o.instagram ? " · @" + escapeHtml(o.instagram) : ""}</div>
      <div class="order-meta">Collection point: <b>${escapeHtml(o.collection_point || "—")}</b></div>
      ${astate.customerNotes[customerKey(o)] ? `<div class="ref-note">Seller note: ${escapeHtml(astate.customerNotes[customerKey(o)])}</div>` : ""}
      <div style="margin-top:8px;">
        ${(o.order_items || []).map((it) => `
          <div class="row"><span>${escapeHtml(it.product_name)} × ${it.quantity}</span><span>${money(it.subtotal)}</span></div>
          ${(it.order_item_options || []).length ? `<div class="hint" style="margin:0 0 4px;text-align:left;">${it.order_item_options.map((op) => escapeHtml(op.option_name)).join(", ")}</div>` : ""}
        `).join("")}
      </div>
      ${o.notes ? `<div class="ref-note">Customer note: ${escapeHtml(o.notes)}</div>` : ""}
      ${o.payment_transaction_reference ? `<div class="ref-note">PayNow transaction reference: <b>${escapeHtml(o.payment_transaction_reference)}</b></div>` : ""}
      ${o.payment_screenshot_url ? `<div style="margin-top:8px;"><button class="small-btn" onclick='openPaymentProof(${JSON.stringify(o.payment_screenshot_url)})'>View payment screenshot</button></div>` : ""}
      ${astate.whatsappError && String(astate.whatsappError.orderId) === String(o.id) ? `<div class="ref-note" role="alert" style="border-color:#B33333;background:#FBEAEA;color:#7a1f1f;">${escapeHtml(astate.whatsappError.message)}</div>` : ""}
      <div class="divider"></div>
      ${redemption ? `<div class="row"><span class="label">Subtotal</span><span>${money(subtotal)}</span></div><div class="row" style="color:#A36D1E;"><span class="label">Promo code · <b>${escapeHtml(redemption.code)}</b></span><span>−${money(discount)}</span></div>` : ""}
      <div class="row bold"><span class="label">Total</span><span>${money(o.total)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary" onclick="editOrder('${o.id}')">Edit order</button>
        <button class="btn-secondary" onclick="setTab('messages')">Message customer</button>
        ${canConfirmByWhatsApp ? (whatsappUrl ? `<a class="btn-secondary" style="border-color:#2f8f55!important;color:#267647!important;text-decoration:none;" href="${escapeHtml(whatsappUrl)}" rel="noopener">WhatsApp customer</a>` : `<button class="btn-secondary" style="border-color:#B33333!important;color:#B33333!important;" onclick="showWhatsAppNumberError('${o.id}')">WhatsApp customer</button>`) : `<button class="btn-secondary" disabled title="${!whatsappConfirmationEnabled ? "Turn this on in Notifications" : o.order_status === "cancelled" ? "Cancelled orders cannot send confirmations" : "Confirm payment before sending"}">WhatsApp customer</button>`}
        <button class="btn-secondary" ${canEmailCustomer && !emailSending ? `onclick="sendCustomerConfirmationEmail('${o.id}')"` : "disabled"} title="${!customerEmailEnabled ? "Turn this on in Notifications" : o.order_status === "cancelled" ? "Cancelled orders cannot send confirmations" : o.payment_status !== "paid" ? "Confirm payment before sending" : !o.customer_email ? "Customer did not provide an email address" : "Send the editable confirmation email"}">${emailSending ? "Sending…" : o.customer_confirmation_email_sent_at ? "Email customer again" : "Email customer"}</button>
        ${o.customer_confirmation_email_sent_at ? `<span class="hint" style="margin:0;">Email sent ${escapeHtml(new Date(o.customer_confirmation_email_sent_at).toLocaleString([], { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }))}</span>` : ""}
        ${o.order_status !== "cancelled" && (o.payment_status === "submitted" || o.payment_status === "awaiting_payment") ? `<button class="small-btn" onclick="confirmPayment('${o.id}')">✓ Confirm payment</button>` : ""}
        ${o.order_status !== "cancelled" && o.payment_status === "submitted" ? `<button class="link-danger" onclick="rejectPayment('${o.id}')">Reject proof</button>` : ""}
        ${o.payment_status === "awaiting_payment" ? `<span class="hint" style="margin:0;">Check the Instagram DM payment screenshot before confirming.</span>` : ""}
        ${o.order_status !== "cancelled" && o.order_status !== "collected" ? `<button class="link-danger" onclick="cancelOrder('${o.id}')">Cancel order</button>` : ""}
        ${o.order_status === "cancelled" ? `<button class="link-danger delete-cancelled-order" onclick="deleteCancelledOrder('${o.id}')">Delete cancelled order</button>` : ""}
      </div>
    </div>`;
  };
  const bulkBar = `<div class="orders-bulk-tools"><button class="${astate.bulkOrderMode ? "btn-primary" : "btn-secondary"}" onclick="toggleBulkOrderMode()">${astate.bulkOrderMode ? "Exit bulk mode" : "Select multiple"}</button>${astate.bulkOrderMode ? `<span><b>${astate.selectedOrderIds.length}</b> selected</span><button class="btn-secondary" onclick="bulkUpdateOrderStatus('preparing')">Mark Preparing</button><button class="btn-secondary" onclick="bulkUpdateOrderStatus('ready')">Mark Ready</button><button class="btn-secondary" onclick="bulkUpdateOrderStatus('collected')">Mark Collected</button>` : ""}</div>`;
  if (marketOrders.length === 0) return controls + `<div class="empty">No orders yet for ${DASHBOARD_MARKET === "MY" ? "Malaysia" : "Singapore"}.</div>`;
  if (orders.length === 0) return controls + `<div class="empty">No orders match this search or filter.</div>`;
  const mobile = orders.map((o) => { const expanded = astate.expandedOrderIds.includes(String(o.id)); return `<article class="order-compact-card ${expanded ? "is-expanded" : ""}"><div class="order-compact-summary ${astate.bulkOrderMode ? "has-select" : ""}" onclick="toggleOrderExpanded('${o.id}')">${astate.bulkOrderMode ? `<input type="checkbox" aria-label="Select ${escapeHtml(o.order_number)}" ${astate.selectedOrderIds.includes(String(o.id)) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleOrderSelected('${o.id}',this.checked)">` : ""}<div><b class="mono">${escapeHtml(o.order_number || o.id)}</b><div>${escapeHtml(o.customer_name || "Customer")}</div><div class="order-compact-muted">${escapeHtml(o.collection_date || "")} · ${escapeHtml(o.collection_time || "")}</div></div><div class="order-compact-right"><b>${money(o.total)}</b><span style="color:${PAY_COLOR[o.payment_status] || "var(--admin-muted)"}">● ${escapeHtml(PAY_LABEL[o.payment_status] || o.payment_status || "—")}</span><span>${expanded ? "⌃" : "⌄"}</span></div></div><div class="order-compact-status" onclick="event.stopPropagation()">${quickStatus(o)}</div>${expanded ? details(o) : ""}</article>`; }).join("");
  const desktop = `<section class="dashboard-card orders-table-card"><div class="orders-table-wrap"><table class="orders-table"><thead><tr><th>${astate.bulkOrderMode ? "Select" : ""}</th><th>Order</th><th>Customer</th><th>Pickup</th><th>Payment</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead><tbody>${orders.map((o) => { const expanded=astate.expandedOrderIds.includes(String(o.id)); return `<tr><td>${astate.bulkOrderMode ? `<input type="checkbox" ${astate.selectedOrderIds.includes(String(o.id)) ? "checked" : ""} onchange="toggleOrderSelected('${o.id}',this.checked)">` : ""}</td><td><b class="mono">${escapeHtml(o.order_number || o.id)}</b></td><td><b>${escapeHtml(o.customer_name || "Customer")}</b><small>${escapeHtml(o.customer_phone || "")}</small></td><td>${escapeHtml(o.collection_date || "")}<small>${escapeHtml(o.collection_time || "")}</small></td><td><span style="color:${PAY_COLOR[o.payment_status] || "inherit"}">${escapeHtml(PAY_LABEL[o.payment_status] || o.payment_status || "—")}</span></td><td>${quickStatus(o)}</td><td><b>${money(o.total)}</b></td><td><button class="btn-secondary" onclick="toggleOrderExpanded('${o.id}')">${expanded ? "Close" : "View"}</button></td></tr>${expanded ? `<tr class="orders-detail-row"><td colspan="8">${details(o)}</td></tr>` : ""}`; }).join("")}</tbody></table></div></section>`;
  return controls + bulkBar + `<div class="orders-mobile-list">${mobile}</div>` + desktop;
}

async function saveProductOrder() {
  if (!IS_CONFIGURED) { alert("Connect Supabase to save the product order."); return; }
  const button = document.getElementById("save-product-order-btn");
  if (button) { button.textContent = "Saving…"; button.disabled = true; }
  try {
    for (let index = 0; index < astate.menu.length; index++) {
      const product = astate.menu[index];
      const sortOrder = index + 1;
      const { error } = await db.from("products").update({ sort_order: sortOrder }).eq("id", product.id);
      if (error) throw error;
      product.sort_order = sortOrder;
    }
    alert("Product order saved.");
  } catch (error) {
    alert("Could not save product order: " + ((error && error.message) || String(error)));
  } finally {
    if (button) { button.textContent = "Save product order"; button.disabled = false; }
    render();
  }
}

function renderMenuTab() {
  return `
    <section class="dashboard-card" style="padding:20px;margin-bottom:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Product groups</h2><span>These become the big headings on the ordering page</span></div>
      <div class="admin-sortable-list">${astate.productGroups.map((group, index) => `<div class="admin-sortable-item admin-product-group-row" data-sort-scope="productGroups" data-sort-key="${escapeHtml(String(group.id ?? `new-${index}`))}">${dragHandle("productGroups", index)}<div class="admin-sortable-content admin-product-group-fields"><input value="${escapeHtml(group.name || "")}" placeholder="e.g. Special" oninput="onGroupField(${index},'name',this.value)"><label style="font-size:12px;white-space:nowrap;"><input type="checkbox" style="width:auto;" ${group.is_visible ? "checked" : ""} onchange="onGroupField(${index},'is_visible',this.checked)"> Show</label><button class="link-danger" style="font-size:12px;" onclick="deleteProductGroup(${index})">Delete</button></div></div>`).join("")}</div>
      <div class="btn-row" style="margin-top:14px;"><button class="btn-secondary" onclick="addProductGroup()">+ Add group</button><button class="btn-primary" onclick="saveProductGroups()">Save groups</button></div>
    </section>
    ${renderDrinkOptionsManager()}
    <section class="dashboard-card" style="padding:20px;margin-bottom:20px;">
      <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Products</h2><span>Drag the six-dot handle to change the ordering-page sequence</span></div>
      <div class="admin-sortable-list">${astate.menu.map((item, index) => `
        <div class="admin-sortable-item admin-product-sort-row order-card" data-sort-scope="products" data-sort-key="${escapeHtml(String(item.id))}">
          ${dragHandle("products", index)}
          <div class="admin-sortable-content">
            <div class="order-top">
              <div>
                <div style="font-size:14px;font-weight:600;">${item.name}</div>
                <div class="order-meta">${item.category || "Other"} · ${item.is_bundle ? "Bundle · " : ""}${item.is_available ? "Visible" : "Hidden"} · ${Number(item.discount_price) > 0 && Number(item.discount_price) < Number(item.price) ? `${money(item.discount_price)} (was ${money(item.price)})` : money(item.price)}</div>
              </div>
              <div style="display:flex;gap:10px;">
                <button class="link-btn" onclick="editMenuItem('${item.id}')">Edit</button>
                <button class="link-danger" onclick="deleteMenuItem('${item.id}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `).join("")}</div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="newMenuItem()">+ Add menu item</button>
        <button class="btn-primary" id="save-product-order-btn" onclick="saveProductOrder()">Save product order</button>
      </div>
    </section>
  `;
}

/* ---- promos ---- */
function onPromoField(key, value) { astate.promoDraft[key] = key === "code" ? String(value || "").toUpperCase().replace(/\s+/g, "") : value; }
function togglePromoProduct(productId, checked) {
  const ids = Array.isArray(astate.promoDraft.applicable_product_ids) ? astate.promoDraft.applicable_product_ids.map(String) : [];
  astate.promoDraft.applicable_product_ids = checked ? [...new Set([...ids, String(productId)])] : ids.filter((id) => id !== String(productId));
}
function clearPromoDraft() {
  astate.editingPromoId = null;
  astate.promoDraft = { code: "", discount_type: "fixed", discount_value: "", minimum_spend: "", usage_limit: "", valid_until: "", applicable_product_ids: [] };
  render();
}
function editPromo(id) {
  const promo = astate.promos.find((item) => String(item.id) === String(id));
  if (!promo) return;
  astate.editingPromoId = promo.id;
  astate.promoDraft = {
    code: promo.code || "",
    discount_type: promo.discount_type === "percent" ? "percent" : "fixed",
    discount_value: promo.discount_value ?? "",
    minimum_spend: promo.minimum_spend ?? "",
    usage_limit: promo.usage_limit ?? "",
    valid_until: promo.valid_until ? String(promo.valid_until).slice(0, 10) : "",
    applicable_product_ids: Array.isArray(promo.applicable_product_ids) ? promo.applicable_product_ids.map(String) : [],
  };
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function createPromo() {
  const draft = astate.promoDraft;
  const code = String(draft.code || "").trim().toUpperCase();
  const value = Number(draft.discount_value);
  if (!code) return alert("Enter a promo code.");
  if (!Number.isFinite(value) || value <= 0) return alert("Enter a valid discount amount.");
  const button = document.getElementById("create-promo-btn"); if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const payload = { discount_type: draft.discount_type === "percent" ? "percent" : "fixed", discount_value: value, minimum_spend: Number(draft.minimum_spend || 0), usage_limit: draft.usage_limit === "" ? null : Math.max(1, Number(draft.usage_limit)), valid_until: draft.valid_until || null, applicable_product_ids: Array.isArray(draft.applicable_product_ids) ? draft.applicable_product_ids : [] };
  const editingId = astate.editingPromoId;
  const query = editingId
    ? db.from("promo_codes").update(payload).eq("id", editingId).select().single()
    : db.from("promo_codes").insert({ ...payload, code, is_active: true }).select().single();
  const { data, error } = await query;
  if (button) { button.textContent = editingId ? "Save changes" : "Create promo"; button.disabled = false; }
  if (error) return alert(`Could not ${editingId ? "update" : "create"} promo: ` + error.message);
  if (editingId) astate.promos = astate.promos.map((promo) => String(promo.id) === String(editingId) ? data : promo);
  else astate.promos = [data, ...astate.promos];
  clearPromoDraft();
  alert(editingId ? "Promo updated." : "Promo created.");
}
async function setPromoActive(id, is_active) {
  const { error } = await db.from("promo_codes").update({ is_active }).eq("id", id);
  if (error) return alert("Could not update promo: " + error.message);
  astate.promos = astate.promos.map((promo) => String(promo.id) === String(id) ? { ...promo, is_active } : promo); render();
}
async function removePromo(id) {
  if (!confirm("Delete this promo code?")) return;
  const { error } = await db.from("promo_codes").delete().eq("id", id);
  if (error) return alert("Could not delete promo: " + error.message);
  astate.promos = astate.promos.filter((promo) => String(promo.id) !== String(id)); render();
}
function togglePromoUses(code) { astate.expandedPromoCode = astate.expandedPromoCode === code ? null : code; render(); }
async function saveStorewideSale() {
  const enabled=!!astate.settingsDraft?.storewide_sale_enabled;
  const percent=Math.max(0,Math.min(100,Number(astate.settingsDraft?.storewide_sale_percent||0)));
  const scope=astate.settingsDraft?.storewide_sale_scope === "selected" ? "selected" : "all";
  const productIds=Array.isArray(astate.settingsDraft?.storewide_sale_product_ids) ? astate.settingsDraft.storewide_sale_product_ids.map(String) : [];
  if(enabled&&percent<=0) return alert("Enter a sale percentage first.");
  if(enabled&&scope==="selected"&&!productIds.length) return alert("Choose at least one affected product first.");
  const button=document.getElementById("storewide-sale-btn"); if(button){button.disabled=true;button.textContent="Saving…";}
  const {data,error}=await db.from("store_settings").update({storewide_sale_enabled:enabled,storewide_sale_percent:percent,storewide_sale_scope:scope,storewide_sale_product_ids:productIds}).eq("id",astate.settings.id).select().single();
  if(error){if(button){button.disabled=false;button.textContent="Try again";}return alert("Could not save storewide sale: "+error.message);}
  astate.settings=data;astate.settingsDraft={...data};render();
}
function toggleStorewideSale(){if(!astate.settingsDraft)return;astate.settingsDraft.storewide_sale_enabled=!astate.settingsDraft.storewide_sale_enabled;saveStorewideSale();}
function setStorewideSaleScope(value){if(!astate.settingsDraft)return;astate.settingsDraft.storewide_sale_scope=value==="selected"?"selected":"all";render();}
function toggleStorewideSaleProduct(productId,checked){if(!astate.settingsDraft)return;const ids=Array.isArray(astate.settingsDraft.storewide_sale_product_ids)?astate.settingsDraft.storewide_sale_product_ids.map(String):[];astate.settingsDraft.storewide_sale_product_ids=checked?[...new Set([...ids,String(productId)])]:ids.filter(id=>id!==String(productId));}
function renderPromosTab() {
  const d = astate.promoDraft;
  const isEditingPromo = !!astate.editingPromoId;
  const selectedProductIds = Array.isArray(d.applicable_product_ids) ? d.applicable_product_ids.map(String) : [];
  const productChoices = astate.menu.map((product) => `<label class="slot" style="cursor:pointer;gap:9px;margin:0 0 7px;padding:10px 12px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A" ${selectedProductIds.includes(String(product.id)) ? "checked" : ""} onchange="togglePromoProduct('${product.id}',this.checked)"><span>${escapeHtml(product.name)}</span></label>`).join("");
  const saleEnabled=!!astate.settingsDraft?.storewide_sale_enabled;
  const saleScope=astate.settingsDraft?.storewide_sale_scope === "selected" ? "selected" : "all";
  const saleProductIds=Array.isArray(astate.settingsDraft?.storewide_sale_product_ids)?astate.settingsDraft.storewide_sale_product_ids.map(String):[];
  const saleChoices=astate.menu.filter(product=>product.is_available!==false).map(product=>`<label class="slot" style="cursor:pointer;gap:9px;margin:0 0 7px;padding:10px 12px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A" ${saleProductIds.includes(String(product.id))?"checked":""} onchange="toggleStorewideSaleProduct('${product.id}',this.checked)"><span>${escapeHtml(product.name)}</span></label>`).join("");
  const storewide=`<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 14px"><h2>Quick sale</h2><span>${saleEnabled?"LIVE":"Off"}</span></div><div class="hint" style="text-align:left;margin:0 0 14px">Run one sale for the whole store or only the products you choose. If a product already has a lower special price, the lower price wins; discounts do not stack.</div><div class="field"><label>Sale affects</label><select onchange="setStorewideSaleScope(this.value)"><option value="all" ${saleScope==="all"?"selected":""}>All products</option><option value="selected" ${saleScope==="selected"?"selected":""}>Selected products only</option></select></div>${saleScope==="selected"?`<div class="field"><label>Affected products</label><div style="max-height:220px;overflow:auto">${saleChoices||`<div class="hint">Add products first.</div>`}</div></div>`:""}<div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div class="field" style="margin:0;flex:1"><label>Percentage off</label><input type="number" min="0" max="100" step="1" value="${Number(astate.settingsDraft?.storewide_sale_percent||0)}" oninput="astate.settingsDraft.storewide_sale_percent=this.value"></div><button class="${saleEnabled?"btn-secondary":"btn-primary"}" id="storewide-sale-btn" onclick="toggleStorewideSale()">${saleEnabled?"Stop sale":"Start sale"}</button></div></section>`;
  const form = `${storewide}<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>${isEditingPromo ? "Edit promo code" : "New promo code"}</h2></div><div class="field"><label>Code</label><input value="${escapeHtml(d.code)}" placeholder="WELCOME10" style="text-transform:uppercase" ${isEditingPromo ? "readonly" : ""} oninput="onPromoField('code',this.value);this.value=this.value.toUpperCase()">${isEditingPromo ? `<div class="hint" style="text-align:left;margin-top:5px">The code stays unchanged so its customer redemption history remains connected.</div>` : ""}</div><div class="field"><label>Discount type</label><select onchange="onPromoField('discount_type',this.value)"><option value="fixed" ${d.discount_type === "fixed" ? "selected" : ""}>Dollar off ($)</option><option value="percent" ${d.discount_type === "percent" ? "selected" : ""}>Percent off (%)</option></select></div><div class="field"><label>Discount value</label><input type="number" min="0.01" step="0.01" value="${escapeHtml(d.discount_value)}" placeholder="1.00" oninput="onPromoField('discount_value',this.value)"></div><div class="field"><label>Minimum spend (optional)</label><input type="number" min="0" step="0.01" value="${escapeHtml(d.minimum_spend)}" placeholder="0.00" oninput="onPromoField('minimum_spend',this.value)"></div><div class="field"><label>Products this promo applies to</label><div class="hint" style="text-align:left;margin:0 0 8px">Leave every product unticked to apply the code to the whole cart.</div><div style="max-height:210px;overflow:auto">${productChoices || `<div class="hint">Add products first.</div>`}</div></div><div class="field"><label>Usage limit (optional)</label><input type="number" min="1" value="${escapeHtml(d.usage_limit)}" placeholder="No limit" oninput="onPromoField('usage_limit',this.value)"></div><div class="field"><label>End date (optional)</label><input type="date" value="${escapeHtml(d.valid_until)}" oninput="onPromoField('valid_until',this.value)"></div><div class="btn-row"><button class="btn-secondary" onclick="clearPromoDraft()">${isEditingPromo ? "Cancel" : "Clear"}</button><button class="btn-primary" id="create-promo-btn" onclick="createPromo()">${isEditingPromo ? "Save changes" : "Create promo"}</button></div></section>`;
  const list = `<section class="dashboard-card"><div class="dashboard-card-head"><h2>Promo codes</h2><span>${astate.promos.length} total</span></div>${astate.promos.length ? astate.promos.map((promo) => {
    const uses = astate.promoRedemptions.filter((row) => String(row.code || "").toUpperCase() === String(promo.code || "").toUpperCase());
    const exhausted = promo.usage_limit != null && uses.length >= Number(promo.usage_limit);
    const active = promo.is_active && !exhausted;
    const expanded = astate.expandedPromoCode === promo.code;
    const applicableIds = Array.isArray(promo.applicable_product_ids) ? promo.applicable_product_ids.map(String) : [];
    const applicableNames = applicableIds.map((id) => astate.menu.find((product) => String(product.id) === id)?.name).filter(Boolean);
    const appliesTo = applicableNames.length ? applicableNames.join(", ") : "All products";
    return `<div class="queue-row" style="cursor:default"><div class="queue-top"><div><div class="queue-number">${escapeHtml(promo.code)}</div><div class="queue-name">${promo.discount_type === "percent" ? `${escapeHtml(promo.discount_value)}% off` : `${money(promo.discount_value)} off`} · min. ${money(promo.minimum_spend || 0)}</div><div class="queue-name" style="color:#4B5D3A;margin-top:3px">Applies to: ${escapeHtml(appliesTo)}</div></div><div class="queue-status" style="background:${active ? "#e6f5df" : "#f5e8e4"};color:${active ? "#28753a" : "#a33c28"};">${active ? "LIVE" : exhausted ? "USED UP" : "PAUSED"}</div></div><div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap"><button class="link-btn" onclick="togglePromoUses('${escapeHtml(promo.code)}')">${uses.length} used · ${expanded ? "Hide customers" : "View customers"}</button><span class="hint" style="margin:0">${promo.usage_limit != null ? `limit ${promo.usage_limit}` : "No total limit"}${promo.valid_until ? ` · ends ${escapeHtml(String(promo.valid_until).slice(0,10))}` : ""}</span><span style="margin-left:auto;display:flex;gap:8px"><button class="link-btn" onclick="editPromo('${promo.id}')">Edit</button><button class="link-btn" onclick="setPromoActive('${promo.id}',${!promo.is_active})">${promo.is_active ? "Pause" : "Make live"}</button><button class="link-danger" onclick="removePromo('${promo.id}')">Delete</button></span></div>${expanded ? `<div style="margin-top:14px;border-top:1px solid #eee3d8;padding-top:8px">${uses.length ? uses.map((use) => { const order = astate.orders.find((item) => String(item.id) === String(use.order_id)); return `<div class="row" style="padding:9px 0;border-bottom:1px solid #f3ebe2"><span><b>${escapeHtml(order?.customer_name || "Customer")}</b><br><span class="hint" style="margin:0">${escapeHtml(use.phone || order?.customer_phone || "—")} · ${escapeHtml(order?.order_number || "Order")}</span></span><span class="hint" style="margin:0">${use.created_at ? new Date(use.created_at).toLocaleString() : "Used"}</span></div>`; }).join("") : `<div class="hint" style="padding:10px 0">Nobody has used this code yet.</div>`}</div>` : ""}</div>`;
  }).join("") : `<div class="dashboard-empty">No promo codes yet.</div>`}</section>`;
  return `<div class="dashboard-grid" style="grid-template-columns:minmax(290px,.72fr) minmax(400px,1.28fr);align-items:start">${form}${list}</div>`;
}

/* ---- customers ---- */
function customerKey(order) {
  const digits = String(order.customer_phone || "").replace(/\D/g, "");
  const phone = digits.length === 10 && digits.startsWith("65") ? digits.slice(2) : digits;
  return String(phone || order.instagram || order.customer_name || "Unknown customer").trim();
}
function customers(orders = ordersForMarket(DASHBOARD_MARKET)) { const result = new Map(); orders.forEach((order) => { const key = customerKey(order); const customer = result.get(key) || { key, name: order.customer_name || "Customer", phone: order.customer_phone || "", instagram: order.instagram || "", orders: [], spent: 0 }; customer.orders.push(order); if (order.payment_status === "paid" && order.order_status !== "cancelled") customer.spent += Number(order.total || 0); result.set(key, customer); }); return [...result.values()].sort((a,b) => new Date(b.orders[0]?.created_at || 0) - new Date(a.orders[0]?.created_at || 0)); }
function chooseCustomer(key) { astate.selectedCustomerKey = key; render(); }
function setCustomerNote(value) { if (astate.selectedCustomerKey) astate.customerNotes[astate.selectedCustomerKey] = value; }
async function saveCustomerNote() { const key = astate.selectedCustomerKey; if (!key) return; const button = document.getElementById("save-customer-note"); if (button) { button.textContent = "Saving…"; button.disabled = true; } const { error } = await db.from("customer_notes").upsert({ customer_key: key, note: String(astate.customerNotes[key] || "").trim() }, { onConflict: "customer_key" }); if (button) { button.textContent = "Save remark"; button.disabled = false; } if (error) return alert("Could not save remark: " + error.message); alert("Remark saved."); }
function renderCustomersTab() { const list = customers(); const selected = list.find((item) => item.key === astate.selectedCustomerKey) || list[0]; if (selected && !astate.selectedCustomerKey) astate.selectedCustomerKey = selected.key; return `<div class="dashboard-grid" style="grid-template-columns:minmax(400px,1.1fr) minmax(300px,.9fr);align-items:start;"><section class="dashboard-card"><div class="dashboard-card-head"><h2>Customers</h2><span>${list.length} total</span></div>${list.length ? list.map((customer) => `<div class="queue-row" data-key="${escapeHtml(customer.key)}" onclick="chooseCustomer(this.dataset.key)" style="${customer.key === astate.selectedCustomerKey ? "background:#fffaf6;box-shadow:inset 4px 0 #ef7138;" : ""}"><div class="queue-top"><div><b>${escapeHtml(customer.name)}</b><div class="queue-name">${escapeHtml(customer.phone || (customer.instagram ? `@${customer.instagram}` : "No contact detail"))}</div></div><div style="text-align:right"><b>${money(customer.spent)}</b><div class="queue-name">${customer.orders.length} order${customer.orders.length === 1 ? "" : "s"}</div></div></div>${astate.customerNotes[customer.key] ? `<div class="queue-name" style="margin-top:7px;color:#9a5b35">📝 ${escapeHtml(astate.customerNotes[customer.key])}</div>` : ""}</div>`).join("") : `<div class="dashboard-empty">Customers appear after their first order.</div>`}</section><section class="dashboard-card">${selected ? `<div class="dashboard-card-head"><h2>${escapeHtml(selected.name)}</h2><span>${selected.orders.length} order${selected.orders.length === 1 ? "" : "s"}</span></div><div style="padding:20px"><div class="field"><label>Phone</label><input value="${escapeHtml(selected.phone)}" readonly></div>${selected.instagram ? `<div class="field"><label>Instagram</label><input value="@${escapeHtml(selected.instagram)}" readonly></div>` : ""}<div class="field"><label>Private remark</label><textarea rows="5" placeholder="e.g. Prefers less sweet…" oninput="setCustomerNote(this.value)">${escapeHtml(astate.customerNotes[selected.key] || "")}</textarea><div class="hint" style="text-align:left;margin-top:6px">Only you can see this.</div></div><button class="btn-primary" id="save-customer-note" style="width:100%" onclick="saveCustomerNote()">Save remark</button><div class="divider" style="margin:20px 0 12px"></div><b>Order history</b>${selected.orders.map((order) => `<div class="row" style="padding:10px 0;border-bottom:1px solid #f0e7de"><span>${escapeHtml(order.order_number || order.id)}<br><span class="hint" style="margin:0">${escapeHtml(order.collection_date || "")}</span></span><span>${money(order.total)}</span></div>`).join("")}</div>` : `<div class="dashboard-empty">Choose a customer.</div>`}</section></div>`; }

/* ---- rewards: choose stamps or points ---- */
function onLoyaltyField(key, value) { astate.loyaltyDraft[key] = value; }
async function saveLoyaltySettings() {
  const draft = astate.loyaltyDraft;
  const payload = { id: 1, enabled: !!draft.enabled, reward_type: draft.reward_type === "points" ? "points" : "stamps", stamps_required: Math.max(1, Number(draft.stamps_required || 10)), minimum_spend: Math.max(0, Number(draft.minimum_spend || 0)), points_per_dollar: Math.max(0.01, Number(draft.points_per_dollar || 1)), points_required: Math.max(1, Number(draft.points_required || 50)), reward_description: String(draft.reward_description || "A free drink is on us.").trim() };
  const button = document.getElementById("save-loyalty-settings"); if (button) { button.textContent = "Saving…"; button.disabled = true; }
  const { data, error } = await db.from("loyalty_settings").upsert(payload, { onConflict: "id" }).select().single();
  if (button) { button.textContent = "Save rewards"; button.disabled = false; }
  if (error) return alert("Could not save rewards: " + error.message);
  astate.loyaltySettings = data; astate.loyaltyDraft = { ...data }; alert("Rewards saved."); render();
}
async function adjustReward(customerKey, amount) {
  if (!customerKey) return;
  const current = astate.customerLoyalty[customerKey] || { customer_key: customerKey, stamps: 0, points: 0, rewards_available: 0 };
  const mode = astate.loyaltySettings?.reward_type === "points" ? "points" : "stamps";
  const field = mode === "points" ? "points" : "stamps";
  const goal = Math.max(1, Number(mode === "points" ? astate.loyaltySettings?.points_required : astate.loyaltySettings?.stamps_required));
  let value = Math.max(0, Number(current[field] || 0) + Number(amount || 0));
  let rewards = Math.max(0, Number(current.rewards_available || 0));
  if (amount > 0 && value >= goal) { rewards += Math.floor(value / goal); value %= goal; }
  const payload = { customer_key: customerKey, stamps: Number(current.stamps || 0), points: Number(current.points || 0), rewards_available: rewards, [field]: value };
  const { data, error } = await db.from("customer_loyalty").upsert(payload, { onConflict: "customer_key" }).select().single();
  if (error) return alert("Could not update reward balance: " + error.message);
  astate.customerLoyalty[customerKey] = data; render();
}
function renderRewardsTab() {
  const d = astate.loyaltyDraft || { enabled: false, reward_type: "stamps", stamps_required: 10, minimum_spend: 5, points_per_dollar: 1, points_required: 50, reward_description: "A free drink is on us." };
  const points = d.reward_type === "points";
  const goal = Math.max(1, Number(points ? d.points_required || 50 : d.stamps_required || 10));
  const customerRows = customers();
  const rewardLogo = escapeHtml(astate.settings?.logo_url || (window.SLOW_STUDIO_DEMO_MODE ? "" : "logo.png"));
  const rewardBrand = escapeHtml(astate.settings?.store_name || (window.SLOW_STUDIO_DEMO_MODE ? "YOUR STORE" : "SHIZUKU LAB"));
  const rewardName = escapeHtml(astate.settings?.loyalty_heading || astate.settings?.membership_name || (window.SLOW_STUDIO_DEMO_MODE ? "Members" : "Shizuku Club"));
  const cardDots = Array.from({ length: Math.min(goal, 10) }, () => `<div style="aspect-ratio:1;border:1px solid rgba(241,247,234,.38);border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);padding:5px;">${rewardLogo ? `<img src="${rewardLogo}" alt="Reward stamp" style="width:100%;height:100%;object-fit:contain;border-radius:50%;opacity:.45;">` : `<span style="color:#294c44;font-weight:800">✓</span>`}</div>`).join("");
  const preview = points
    ? `<div style="margin:20px 20px 4px;padding:22px;background:linear-gradient(135deg,#1e473e,#294c44 55%,#19362f);border-radius:17px;color:#f9f4e8;"><div style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#b7d2bb;">${rewardBrand.toUpperCase()} · POINTS WALLET</div><div style="font:700 24px/1.1 Georgia,serif;margin-top:9px;">${rewardName}</div><div style="font:700 48px/1 Georgia,serif;margin:22px 0 5px;">0 <span style="font:600 15px/1 inherit;color:#cce0ca;">points</span></div><div style="font-size:12px;color:#d6e4d4;">${goal} points to your next reward</div><div style="height:9px;background:rgba(255,255,255,.2);border-radius:99px;margin:18px 0 17px;overflow:hidden;"><div style="height:100%;width:0%;background:#cae4b3;border-radius:99px;"></div></div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;">REDEEM</div><div style="font-size:14px;font-weight:700;margin-top:5px;">${escapeHtml(d.reward_description || "A free item is on us.")}</div><div style="font-size:12px;color:#d6e4d4;margin-top:12px;">Earn ${escapeHtml(d.points_per_dollar || 1)} point${Number(d.points_per_dollar || 1) === 1 ? "" : "s"} for every ${DASHBOARD_MARKET === "MY" ? "RM1" : "$1"} spent</div></div>`
    : `<div style="margin:20px 20px 4px;padding:22px;background:linear-gradient(135deg,#1e473e,#294c44 55%,#19362f);border-radius:17px;color:#f9f4e8;"><div style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#b7d2bb;">${rewardBrand.toUpperCase()} · MEMBER</div><div style="font:700 24px/1.1 Georgia,serif;margin-top:9px;">${rewardName}</div><div style="margin:20px 0 16px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">${cardDots}</div><div style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#b7d2bb;">NEXT REWARD</div><div style="font-size:14px;font-weight:700;margin-top:5px;">${escapeHtml(d.reward_description || "A free item is on us.")}</div><div style="font-size:12px;color:#d6e4d4;margin-top:12px;">${goal} stamps to complete a card</div></div>`;
  const settings = `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Rewards programme</h2><span>${d.enabled ? "LIVE" : "OFF"}</span></div><label class="slot" style="cursor:pointer;gap:10px;margin:0 0 16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${d.enabled ? "checked" : ""} onchange="onLoyaltyField('enabled',this.checked)"><span><b>Enable rewards</b><br><span class="hint">Choose one simple programme for customers.</span></span></label><div class="field"><label>Reward type</label><select onchange="onLoyaltyField('reward_type',this.value);render()"><option value="stamps" ${!points ? "selected" : ""}>Stamp card</option><option value="points" ${points ? "selected" : ""}>Points</option></select></div>${points ? `<div class="field"><label>Points earned per $1 spent</label><input type="number" min="0.01" step="0.1" value="${escapeHtml(d.points_per_dollar)}" oninput="onLoyaltyField('points_per_dollar',this.value)"></div><div class="field"><label>Points needed for a reward</label><input type="number" min="1" value="${escapeHtml(d.points_required)}" oninput="onLoyaltyField('points_required',this.value)"></div>` : `<div class="field"><label>Stamps to complete a card</label><input type="number" min="1" max="30" value="${escapeHtml(d.stamps_required)}" oninput="onLoyaltyField('stamps_required',this.value)"></div><div class="field"><label>Minimum spend per stamp ($)</label><input type="number" min="0" step="0.10" value="${escapeHtml(d.minimum_spend)}" oninput="onLoyaltyField('minimum_spend',this.value)"></div>`}<div class="field"><label>Reward message</label><textarea rows="3" oninput="onLoyaltyField('reward_description',this.value)">${escapeHtml(d.reward_description)}</textarea></div><button class="btn-primary" id="save-loyalty-settings" style="width:100%" onclick="saveLoyaltySettings()">Save rewards</button></section>`;
  const members = `<section class="dashboard-card">${preview}<div class="dashboard-card-head"><h2>${points ? "Points members" : "Stamp card members"}</h2><span>${customerRows.length} customers</span></div>${customerRows.length ? customerRows.map((customer) => { const balance = astate.customerLoyalty[customer.key] || {}; const value = Number(balance[points ? "points" : "stamps"] || 0); const history = astate.loyaltyTransactions.filter((item) => String(item.customer_key) === String(customer.key)).slice(0, 8); return `<div class="queue-row"><div class="queue-top"><div><b>${escapeHtml(customer.name)}</b><div class="queue-name">Current balance: <b>${value} ${points ? "points" : "stamps"}</b> · ${Number(balance.rewards_available || 0)} reward${Number(balance.rewards_available || 0) === 1 ? "" : "s"} ready</div></div><div style="display:flex;gap:7px"><button class="btn-secondary" data-key="${escapeHtml(customer.key)}" onclick="adjustReward(this.dataset.key,-1)">−1</button><button class="btn-primary" data-key="${escapeHtml(customer.key)}" onclick="adjustReward(this.dataset.key,1)">+1</button></div></div>${history.length ? `<div style="margin-top:12px;padding-top:9px;border-top:1px solid #eee3d8;">${history.map((item) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:12px;"><span><b>+${escapeHtml(item.amount)}</b> — Order ${escapeHtml(item.order_number)}</span><span class="hint" style="margin:0;white-space:nowrap;">${new Date(item.created_at).toLocaleDateString("en-SG", { day:"numeric", month:"short" })}</span></div>`).join("")}</div>` : `<div class="hint" style="text-align:left;margin:10px 0 0;">No automatic reward activity yet.</div>`}</div>`; }).join("") : `<div class="dashboard-empty">Customers appear after their first order.</div>`}</section>`;
  return `<div class="dashboard-grid" style="grid-template-columns:minmax(300px,.88fr) minmax(360px,1.12fr);align-items:start;">${settings}${members}</div>`;
}

function enhanceRewardOrderLinks() {
  if (astate.tab !== "rewards") return;
  document.querySelectorAll(".admin-content .queue-row span").forEach((element) => {
    const match = String(element.textContent || "").match(/Order\s+(SL-[A-Z0-9]+)/i);
    const target = element.parentElement || element;
    if (!match || target.dataset.orderLinked === "true") return;
    const orderNumber = match[1].toUpperCase();
    const order = astate.orders.find((item) => String(item.order_number || "").toUpperCase() === orderNumber);
    target.dataset.orderLinked = "true";
    target.classList.add("reward-order-link");
    target.setAttribute("role", "button");
    target.setAttribute("tabindex", "0");
    target.setAttribute("title", `Open ${orderNumber}`);
    const open = () => openRelatedOrder(order?.id || "", orderNumber);
    target.addEventListener("click", open);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

function addFaq() {
  astate.faq.push({ id: null, question: "", answer: "", sort_order: astate.faq.length, is_active: true });
  render();
}
function onFaqField(index, key, value) { astate.faq[index][key] = value; }
async function saveFaq() {
  const valid = astate.faq.filter((item) => String(item.question || "").trim() && String(item.answer || "").trim());
  for (let index = 0; index < valid.length; index++) {
    const item = valid[index];
    const fields = { question: item.question.trim(), answer: item.answer.trim(), sort_order: index, is_active: true };
    const query = item.id ? db.from("store_faq").update(fields).eq("id", item.id).select().single() : db.from("store_faq").insert(fields).select().single();
    const { data, error } = await query;
    if (error) { alert("Could not save FAQ: " + error.message); return; }
    Object.assign(item, data);
  }
  astate.faq = valid;
  alert("FAQ saved.");
  render();
}
async function deleteFaq(index) {
  const item = astate.faq[index];
  if (!confirm("Delete this FAQ?")) return;
  if (item.id) {
    const { error } = await db.from("store_faq").delete().eq("id", item.id);
    if (error) { alert("Could not delete FAQ: " + error.message); return; }
  }
  astate.faq.splice(index, 1);
  render();
}

function renderSettingsTab() {
  if (!astate.settingsDraft) return `<div class="empty">No store_settings row found. Add one in Supabase, then refresh.</div>`;
  const s = astate.settingsDraft;
  const field = (label, key, placeholder = "") => `
    <div class="field"><label>${label}</label><input value="${s[key] || ""}" placeholder="${placeholder}" oninput="onSettingsField('${key}', this.value)"></div>`;
  const welcomeFonts = [
    ["fraunces", "Elegant serif · Fraunces"],
    ["noto_serif_jp", "Japanese serif · Noto Serif JP"],
    ["work_sans", "Clean sans · Work Sans"],
    ["noto_sans_jp", "Japanese sans · Noto Sans JP"],
    ["georgia", "Classic serif · Georgia"],
  ];
  const fontSelect = (label, key, fallback) => `<div class="field"><label>${label}</label><select onchange="onSettingsField('${key}',this.value)">${welcomeFonts.map(([value, name]) => `<option value="${value}" ${(s[key] || fallback) === value ? "selected" : ""}>${name}</option>`).join("")}</select></div>`;
  const visibilityKey = DASHBOARD_MARKET === "MY" ? "malaysia_website_visibility" : "website_visibility";
  const hiddenTitleKey = DASHBOARD_MARKET === "MY" ? "malaysia_website_hidden_title" : "website_hidden_title";
  const hiddenMessageKey = DASHBOARD_MARKET === "MY" ? "malaysia_website_hidden_message" : "website_hidden_message";
  const websiteVisibility = s[visibilityKey] || (DASHBOARD_MARKET === "MY" ? "hidden" : "live");
  const active = astate.settingsSection || "welcome";
  const sectionButton = (id, label) => `<button type="button" class="${active === id ? "btn-primary" : "btn-secondary"}" onclick="astate.settingsSection='${id}';render()">${label}</button>`;
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;">${sectionButton("storefront","Website status")}${sectionButton("welcome","Welcome")}${sectionButton("logo","Logo")}${sectionButton("banner","Banner picture")}${sectionButton("product_page","Product page")}${sectionButton("details","Store details")}</div>
    <section ${active === "storefront" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Customer website status</div>
    <p class="hint" style="text-align:left;margin:0 0 14px;">Hide the public welcome and ordering pages without deleting products, orders or settings. Admin remains available.</p>
    <div class="field"><label>${DASHBOARD_MARKET === "MY" ? "Malaysia" : "Singapore"} website visibility</label><select onchange="onSettingsField('${visibilityKey}',this.value);render()"><option value="live" ${websiteVisibility === "live" ? "selected" : ""}>Live · customers can order</option><option value="hidden" ${websiteVisibility === "hidden" ? "selected" : ""}>Hidden · show a temporary closed page</option></select></div>
    <div class="order-card" style="margin:14px 0;"><div class="order-top"><b>${websiteVisibility === "hidden" ? "Website hidden" : "Website live"}</b><span>${websiteVisibility === "hidden" ? "CLOSED" : "OPEN"}</span></div><p class="hint" style="text-align:left;margin:10px 0 0;">${websiteVisibility === "hidden" ? "Customers cannot enter ordering. You can still edit Admin normally." : "Customers can open the store and place orders."}</p></div>
    ${field("Hidden page title", hiddenTitleKey, DASHBOARD_MARKET === "MY" ? "Malaysia ordering is coming soon." : "We’ll be back soon.")}
    <div class="field"><label>Hidden page message</label><textarea rows="4" placeholder="Tell customers when to check again." oninput="onSettingsField('${hiddenMessageKey}',this.value)">${escapeHtml(s[hiddenMessageKey] || "")}</textarea></div>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;" onclick="saveSettings()">Save website status</button>
    </section>
    <section ${active === "product_page" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Product customisation page</div>
    <p class="hint" style="text-align:left;margin:0 0 14px;">Controls the page customers see after tapping a product.</p>
    <div class="field"><label>Product image height <span id="product-detail-height-value" style="float:right;color:#4B5D3A;">${Number(s.product_detail_image_height || 180)} px</span></label><input type="range" min="100" max="420" step="10" value="${Number(s.product_detail_image_height || 180)}" oninput="onSettingsField('product_detail_image_height',Number(this.value));document.getElementById('product-detail-height-value').textContent=this.value+' px'"></div>
    <div class="field"><label>Product image display</label><select onchange="onSettingsField('product_detail_image_fit',this.value)"><option value="cover" ${(s.product_detail_image_fit || "cover") === "cover" ? "selected" : ""}>Fill frame (crop if needed)</option><option value="contain" ${s.product_detail_image_fit === "contain" ? "selected" : ""}>Show complete image</option></select></div>
    <div class="field"><label>Option text size <span id="product-option-size-value" style="float:right;color:#4B5D3A;">${Number(s.product_option_text_size || 15)} px</span></label><input type="range" min="12" max="24" step="1" value="${Number(s.product_option_text_size || 15)}" oninput="onSettingsField('product_option_text_size',Number(this.value));document.getElementById('product-option-size-value').textContent=this.value+' px'"></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.product_option_compact !== false ? "checked" : ""} onchange="onSettingsField('product_option_compact',this.checked)"><span><b>Use compact option cards</b><br><span class="hint">Reduces the empty space between Ice, Sweetness and Milk choices on phones.</span></span></label>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;" onclick="saveSettings()">Save product page</button>
    </section>
    <section ${active === "details" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Store details</div>
    ${field("Store name", "store_name")}
    ${field("Store tagline", "store_tagline", "雫ラボ · crafted drop by drop")}
    <div class="field"><label>Admin mobile menu position</label><select onchange="onSettingsField('admin_mobile_nav_position',this.value)"><option value="left" ${(s.admin_mobile_nav_position || "left") === "left" ? "selected" : ""}>Left sidebar</option><option value="top" ${s.admin_mobile_nav_position === "top" ? "selected" : ""}>Top menu</option></select><div class="hint" style="text-align:left;margin-top:5px;">Only changes the Admin layout on phones. Desktop stays on the left.</div></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_dashboard_refresh !== false ? "checked" : ""} onchange="onSettingsField('show_dashboard_refresh',this.checked)"><span><b>Show Dashboard Refresh and Last updated</b><br><span class="hint">Untick to hide both items from the top of the Admin Dashboard.</span></span></label>
    ${field("Instagram (without @)", "instagram")}
    ${field("Shizuku Lab website link (optional)", "website_url", "https://your-brand-website.com")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Powered by footer</div>
    ${field("Footer text", "powered_by_text", "Powered by Slow Studio")}
    ${field("Slow Studio link (optional)", "powered_by_url", "https://slow-studio.com")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_powered_by !== false ? "checked" : ""} onchange="onSettingsField('show_powered_by', this.checked)"><span><b>Show Powered by Slow Studio</b><br><span class="hint">When a link is entered, customers can click the footer and it opens in a new tab.</span></span></label>
    </section>
    <section ${active === "welcome" ? "" : "hidden"}>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Instagram browser guidance</div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_instagram_browser_notice !== false ? "checked" : ""} onchange="onSettingsField('show_instagram_browser_notice',this.checked)"><span><b>Show “Open in browser” guidance</b><br><span class="hint">Only appears when a customer opens your Welcome page inside Instagram or Facebook. They can still continue if they prefer.</span></span></label>
    <div class="divider"></div>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Welcome announcement</div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_announcement ? "checked" : ""} onchange="onSettingsField('show_announcement', this.checked)"><span><b>Show announcement before Welcome page</b><br><span class="hint">The same announcement appears at most once per customer per day.</span></span></label>
    ${field("Announcement title", "announcement_title", "This week at Shizuku Lab")}
    <div class="field"><label>Announcement message</label><textarea rows="4" placeholder="Opening dates, pickup hours or an important update." oninput="onSettingsField('announcement_message', this.value)">${escapeHtml(s.announcement_message || "")}</textarea></div>
    ${field("Promo code to show (optional)", "announcement_promo_code", "WELCOME10")}
    ${field("Continue button text", "announcement_button_text", "Continue")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Welcome cover</div>
    ${field("Welcome title", "welcome_title", "Welcome to Shizuku Lab")}
    ${fontSelect("Welcome title font", "welcome_title_font", "fraunces")}
    ${field("Welcome subtitle", "welcome_subtitle", "雫ラボ · CRAFTED DROP BY DROP")}
    <div class="field"><label>Welcome introduction</label><textarea rows="3" placeholder="A short message shown before customers enter the ordering page." oninput="onSettingsField('welcome_copy', this.value)">${escapeHtml(s.welcome_copy || "")}</textarea></div>
    ${field("Order button text", "welcome_order_button_text", "Enter ordering →")}
    ${field("Track order button text", "welcome_track_button_text", "Track order")}
    ${field("Loyalty button text", "welcome_loyalty_button_text", "Check your loyalty")}
    ${field("Website button text", "welcome_website_button_text", "Visit Shizuku Lab website ↗")}
    ${fontSelect("Welcome body & button font", "welcome_body_font", "work_sans")}
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Admin Welcome screen</div>
    <p class="hint" style="text-align:left;margin:0 0 12px;">The Welcome back screen now uses your Store Logo in a large circle. Change the picture and circle size in the Logo section.</p>
    <div class="field"><label>Admin welcome duration <span id="admin-welcome-duration-value" style="float:right;font-weight:600;color:#4B5D3A;">${Math.max(2, Math.min(10, Number(s.admin_welcome_duration_seconds || 5)))} seconds</span></label><input type="range" min="2" max="10" step="1" value="${Math.max(2, Math.min(10, Number(s.admin_welcome_duration_seconds || 5)))}" oninput="onSettingsField('admin_welcome_duration_seconds',Number(this.value));document.getElementById('admin-welcome-duration-value').textContent=this.value+' seconds'"><div class="hint" style="text-align:left;margin-top:5px;">Choose how long Welcome back appears after Admin login.</div></div>
    </section>
    <section ${active === "logo" ? "" : "hidden"}>
    <div class="field"><label>Welcome logo position</label><select onchange="onSettingsField('welcome_logo_position',this.value)"><option value="left" ${s.welcome_logo_position === "left" ? "selected" : ""}>Left</option><option value="center" ${(!s.welcome_logo_position || s.welcome_logo_position === "center") ? "selected" : ""}>Centre</option><option value="right" ${s.welcome_logo_position === "right" ? "selected" : ""}>Right</option></select><div class="hint" style="text-align:left;margin-top:5px;">Choose where the logo sits on the Welcome cover.</div></div>
    ${s.logo_url ? `<div class="field"><label>Welcome logo preview</label><div id="welcome-logo-live-preview" style="width:${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}px;height:${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}px;border:5px solid #F4EEE3;border-radius:50%;overflow:hidden;background:#fff;display:grid;place-items:center;margin-top:8px;"><img id="welcome-logo-live-preview-image" src="${escapeHtml(s.logo_url)}" alt="Welcome logo preview" style="width:100%;height:100%;object-fit:contain;padding:12px;transform:translate(${Number(s.welcome_logo_image_x || 0)}%, ${Number(s.welcome_logo_image_y || 0)}%) scale(${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1)});"></div></div>` : ""}
    <div class="field"><label>Welcome logo circle size <span id="welcome-logo-circle-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)} px</span></label><input type="range" min="56" max="220" step="1" value="${Number(s.welcome_logo_circle_size || s.logo_circle_size || 100)}" oninput="onSettingsField('welcome_logo_circle_size',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Welcome logo image size <span id="welcome-logo-image-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1).toFixed(2)}×</span></label><input type="range" min="0.55" max="2.4" step="0.05" value="${Number(s.welcome_logo_image_scale || s.logo_image_scale || 1)}" oninput="onSettingsField('welcome_logo_image_scale',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Move Welcome logo left / right <span id="welcome-logo-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_x || 0) > 0 ? "+" : ""}${Number(s.welcome_logo_image_x || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.welcome_logo_image_x || 0)}" oninput="onSettingsField('welcome_logo_image_x',Number(this.value));updateWelcomeLogoPreview()"></div>
    <div class="field"><label>Move Welcome logo up / down <span id="welcome-logo-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.welcome_logo_image_y || 0) > 0 ? "+" : ""}${Number(s.welcome_logo_image_y || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.welcome_logo_image_y || 0)}" oninput="onSettingsField('welcome_logo_image_y',Number(this.value));updateWelcomeLogoPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Use these two sliders when the artwork in your uploaded logo is not centred.</div></div>
    <div class="hint" style="text-align:left;margin:-6px 0 14px;">Your Welcome cover uses the same logo you upload below. Leave the website link empty if you only want the ordering button.</div>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Storefront images</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 16px;"><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Logo frame · 1 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: square, at least 1000 × 1000 px.</span></div><div style="border:1px solid #E1D9C8;border-radius:13px;padding:12px;background:#fff;"><b style="display:block;margin-bottom:4px;">Banner frame · 2 : 1</b><span class="hint" style="margin:0;text-align:left;">Best upload: landscape, at least 1600 × 800 px.</span></div></div>
    <div class="field"><label>Logo</label><input value="${escapeHtml(s.logo_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('logo_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'logo_url')">${s.logo_url ? `<div id="logo-live-preview" style="width:${Number(s.logo_circle_size || 68)}px;height:${Number(s.logo_circle_size || 68)}px;border:1px solid #E1D9C8;border-radius:50%;overflow:hidden;margin-top:10px;background:#fff;display:grid;place-items:center;"><img id="logo-live-preview-image" src="${escapeHtml(s.logo_url)}" alt="Logo preview" style="width:100%;height:100%;object-fit:contain;transform:translate(${Number(s.logo_image_x || 0)}%,${Number(s.logo_image_y || 0)}%) scale(${Number(s.logo_image_scale || 1)});"></div>` : ""}</div>
    <div class="field"><label>Logo circle size <span id="logo-circle-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_circle_size || 68)} px</span></label><input type="range" min="56" max="150" step="1" value="${Number(s.logo_circle_size || 68)}" oninput="onSettingsField('logo_circle_size',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">The preview changes while you drag. Press Save settings to publish it to your customer page.</div></div>
    <div class="field"><label>Logo image size <span id="logo-image-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_scale || 1).toFixed(2)}×</span></label><input type="range" min="0.55" max="2" step="0.05" value="${Number(s.logo_image_scale || 1)}" oninput="onSettingsField('logo_image_scale',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Zoom the logo inside the circle without changing the circle itself.</div></div>
    <div class="field"><label>Move logo left / right <span id="logo-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_x || 0) > 0 ? "+" : ""}${Number(s.logo_image_x || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.logo_image_x || 0)}" oninput="onSettingsField('logo_image_x',Number(this.value));updateStorefrontPreview()"></div>
    <div class="field"><label>Move logo up / down <span id="logo-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.logo_image_y || 0) > 0 ? "+" : ""}${Number(s.logo_image_y || 0)}%</span></label><input type="range" min="-45" max="45" step="1" value="${Number(s.logo_image_y || 0)}" oninput="onSettingsField('logo_image_y',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Move the artwork inside the circle without moving the circle itself.</div></div>
    </section>
    <section ${active === "banner" ? "" : "hidden"}>
    <div class="field"><label>Top banner image</label><input value="${escapeHtml(s.hero_image_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('hero_image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'hero_image_url')">${s.hero_image_url ? `<img id="banner-live-preview" src="${escapeHtml(s.hero_image_url)}" alt="Banner preview" style="display:block;width:100%;aspect-ratio:2/1;object-fit:cover;object-position:${Number(s.hero_image_x ?? 50)}% ${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}%;border:1px solid #E1D9C8;border-radius:12px;margin-top:10px;">` : ""}</div>
    <div class="field"><label>Banner left / right crop <span id="banner-x-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_image_x ?? 50)}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(s.hero_image_x ?? 50)}" oninput="onSettingsField('hero_image_x',Number(this.value));updateStorefrontPreview()"></div>
    <div class="field"><label>Banner up / down crop <span id="banner-y-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(s.hero_image_y ?? s.hero_image_position ?? 68)}" oninput="onSettingsField('hero_image_y',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Adjust until the drink layers sit where you want them in the banner.</div></div>
    <div class="field"><label>Banner height <span id="banner-height-value" style="float:right;font-weight:500;color:#4B5D3A;">${Number(s.hero_banner_height || 190)} px</span></label><input type="range" min="130" max="320" step="5" value="${Number(s.hero_banner_height || 190)}" oninput="onSettingsField('hero_banner_height',Number(this.value));updateStorefrontPreview()"><div class="hint" style="text-align:left;margin-top:5px;">Make the banner taller or shorter.</div></div>
    <div class="field"><label>Store introduction</label><textarea rows="4" placeholder="A short introduction customers see below your collection address." oninput="onSettingsField('store_description', this.value)">${escapeHtml(s.store_description || "")}</textarea><div class="hint" style="text-align:left;margin-top:5px;">Shown on the customer ordering page.</div></div>
    ${field("Top rolling message", "ticker_text", "e.g. PRE-ORDER ONLY · FRESHLY WHISKED · SHIZUKU LAB")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_ticker !== false ? "checked" : ""} onchange="onSettingsField('show_ticker', this.checked)"><span><b>Show rolling message</b><br><span class="hint">Untick to hide it from the ordering page.</span></span></label>
    </section>
    <section ${active === "details" ? "" : "hidden"}>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Contact</div>
    ${field("WhatsApp number", "whatsapp_number", "+65 9XXX XXXX")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;">
      <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_whatsapp ? "checked" : ""} onchange="onSettingsField('show_whatsapp', this.checked)">
      <span><b>Show WhatsApp on website</b><br><span class="hint">Keep this unticked if you only want to save the number for later.</span></span>
    </label>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Payment & collection</div>
    <div class="field"><label>PayNow QR mode</label><select onchange="onSettingsField('payment_qr_mode',this.value);render()"><option value="dynamic" ${(s.payment_qr_mode || "dynamic") === "dynamic" ? "selected" : ""}>Dynamic QR · order amount locked</option><option value="uploaded" ${s.payment_qr_mode === "uploaded" ? "selected" : ""}>Use my uploaded QR image</option></select><div class="hint" style="text-align:left;margin-top:5px;">Dynamic QR is recommended because it inserts the exact order total. An uploaded static QR cannot prevent customers changing the amount in their banking app.</div></div>
    ${field("PayNow name", "paynow_name")}
    ${field("PayNow number", "paynow_number", "+65 9XXX XXXX")}
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_paynow_name !== false ? "checked" : ""} onchange="onSettingsField('show_paynow_name',this.checked)"><span><b>Show PayNow name to customers</b></span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_paynow_number !== false ? "checked" : ""} onchange="onSettingsField('show_paynow_number',this.checked)"><span><b>Show PayNow phone number to customers</b></span></label>
    <div class="field"><label>Uploaded PayNow QR image</label><input value="${escapeHtml(s.paynow_url || "")}" placeholder="Upload below or paste image URL" oninput="onSettingsField('paynow_url',this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'paynow_url')">${s.paynow_url ? `<img src="${escapeHtml(s.paynow_url)}" alt="PayNow QR preview" style="display:block;width:190px;height:190px;object-fit:contain;margin-top:10px;border:1px solid #E1D9C8;border-radius:14px;padding:8px;background:#fff;">` : ""}<div class="hint" style="text-align:left;margin-top:5px;">Used only when QR mode is set to “Use my uploaded QR image”.</div></div>
    ${field("Collection area shown on ordering homepage", "collection_area_label", "e.g. Near Creamier · Toa Payoh")}
    ${field("Full collection address", "collection_address")}
    ${field("Google Maps link (optional)", "google_maps_url", "https://maps.google.com/...")}
    <p class="hint" style="text-align:left;margin:-8px 0 12px;">If this is blank, the system creates a Google Maps search link from your full collection address.</p>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_collection_map_home !== false ? "checked" : ""} onchange="onSettingsField('show_collection_map_home',this.checked)"><span><b>Show collection area on ordering homepage</b><br><span class="hint">Shows the short area only, not the full pickup details.</span></span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_collection_map_payment !== false ? "checked" : ""} onchange="onSettingsField('show_collection_map_payment',this.checked)"><span><b>Show Google Map on payment page</b><br><span class="hint">Shows the selected collection point, full address and map after checkout.</span></span></label>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Collection points</div>
    <p class="hint" style="text-align:left;margin:0 0 12px;">Customers choose one of these at Checkout. The order shown here becomes the dropdown order.</p>
    ${settingsCollectionPointDetails().map((point,index) => `<div class="dashboard-card" style="padding:14px;margin-bottom:12px;"><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-bottom:10px;"><input value="${escapeHtml(point.name)}" placeholder="Collection point name" oninput="editCollectionPoint(${index},this.value)"><div style="display:flex;gap:5px;"><button type="button" class="btn-secondary" ${index === 0 ? "disabled" : ""} onclick="moveCollectionPoint(${index},-1)" aria-label="Move up">↑</button><button type="button" class="btn-secondary" ${index === settingsCollectionPoints().length-1 ? "disabled" : ""} onclick="moveCollectionPoint(${index},1)" aria-label="Move down">↓</button><button type="button" class="link-danger" onclick="deleteCollectionPoint(${index})">Delete</button></div></div><div class="field" style="margin-bottom:9px;"><label>Short area shown on homepage</label><input value="${escapeHtml(point.area)}" placeholder="e.g. Near Creamier · Toa Payoh" oninput="editCollectionPointDetail(${index},'area',this.value)"></div><div class="field" style="margin-bottom:9px;"><label>Full address</label><input value="${escapeHtml(point.address)}" placeholder="Exact pickup address" oninput="editCollectionPointDetail(${index},'address',this.value)"></div><div class="field" style="margin-bottom:0;"><label>Google Maps link (optional)</label><input value="${escapeHtml(point.google_maps_url)}" placeholder="https://maps.google.com/..." oninput="editCollectionPointDetail(${index},'google_maps_url',this.value)"></div></div>`).join("")}
    <button type="button" class="btn-secondary" style="margin-bottom:16px;" onclick="addCollectionPoint()">+ Add collection point</button>
    ${field("Saturday collection time", "saturday_collection_time", "10:00 AM - 12:00 PM")}
    ${field("Sunday collection time", "sunday_collection_time", "10:00 AM - 1:00 PM")}
    </section>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:18px;" onclick="saveSettings()">Save settings</button>
  `;
}

function renderNotificationsTab() {
  const n = astate.notificationDraft || { recipient_email: "", webhook_url: "", enabled: false, alert_new_order: true, alert_payment_proof: true, alert_live_chat: true, customer_email_enabled:true, customer_ready_email_enabled:true };
  const s = astate.settingsDraft || {};
  const values = { customer_name:"Shermin", order_number:"SL-SAMPLE", date:"30 Aug 2026", time:"11:30 AM", collection_point:"Near Creamier", total:"$13.80", order_items:"• 1 × Ichigo Matcha Latte\n• 1 × Strawberry Milk" };
  const reviewEmailSubject = fillCustomerEmailTemplate(n.payment_review_email_subject_template || "We received your order · {order_number}",values);
  const reviewEmailPreview = `${fillCustomerEmailTemplate(n.payment_review_email_heading_template || "Hi {customer_name}, we received your order",values)}\n\n${fillCustomerEmailTemplate(n.payment_review_email_message_template || "Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.",values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  const emailSubject = fillCustomerEmailTemplate(n.customer_email_subject_template || "Your order is confirmed · {order_number}",values);
  const emailPreview = `${fillCustomerEmailTemplate(n.customer_email_heading_template || "Your order is confirmed",values)}\n\n${fillCustomerEmailTemplate(n.customer_email_message_template || "Thank you for ordering with Shizuku Lab. We look forward to preparing your order.",values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  const readyEmailSubject = fillCustomerEmailTemplate(n.customer_ready_email_subject_template || "Your order is ready for collection · {order_number}",values);
  const readyEmailPreview = `${fillCustomerEmailTemplate(n.customer_ready_email_heading_template || "Your order is ready for collection",values)}\n\n${fillCustomerEmailTemplate(n.customer_ready_email_message_template || "Your order is ready for collection. We look forward to seeing you at your selected pickup time.",values)}\n\nOrder items\n${values.order_items}\n\nCollection: ${values.date} · ${values.time} · ${values.collection_point}`;
  const whatsappTemplate = s.whatsapp_confirmation_template || DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;
  const whatsappPreview = fillWhatsAppConfirmationTemplate(whatsappTemplate,values);
  return `<div style="display:grid;gap:18px;max-width:900px;"><section class="dashboard-card" style="padding:22px;">
    <div class="dashboard-card-head" style="padding:0 0 16px;"><h2>My email alerts</h2><span>${n.enabled ? "On" : "Off"}</span></div>
    <p class="hint" style="text-align:left;margin:0 0 16px;">Choose which Shizuku Lab activity should email you as the seller.</p>
    <div class="field"><label>Receive alerts at</label><input type="email" value="${escapeHtml(n.recipient_email || "")}" placeholder="tinghuioh29@gmail.com" oninput="onNotificationField('recipient_email', this.value)"></div>
    <div class="field"><label>Google Apps Script web app URL</label><input value="${escapeHtml(n.webhook_url || "")}" placeholder="Paste the web app URL after you deploy it" oninput="onNotificationField('webhook_url', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">This private link sends the alert to your Gmail. Leave alerts off until your Google setup is complete.</div></div>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.enabled ? "checked" : ""} onchange="onNotificationField('enabled', this.checked)"><span><b>Turn on email notifications</b></span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:10px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_new_order !== false ? "checked" : ""} onchange="onNotificationField('alert_new_order', this.checked)"><span>Notify me when a new order is placed</span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_payment_proof !== false ? "checked" : ""} onchange="onNotificationField('alert_payment_proof', this.checked)"><span>Notify me when payment proof is uploaded</span></label>
    <label class="slot" style="cursor:pointer;gap:10px;margin-bottom:0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.alert_live_chat !== false ? "checked" : ""} onchange="onNotificationField('alert_live_chat', this.checked)"><span>Notify me when a customer sends a live chat message</span></label>
  </section><section class="dashboard-card" style="padding:22px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer order confirmations</h2><span>Email + WhatsApp</span></div><p class="hint" style="text-align:left;margin:0 0 16px;">Manage both customer confirmation channels in one place. Each channel has its own on/off switch.</p>
    <div class="order-card" style="margin-bottom:16px;">
      <div class="order-top"><b>Automatic customer emails</b><span>${n.customer_email_enabled !== false ? "On" : "Off"}</span></div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:12px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.customer_email_enabled !== false ? "checked" : ""} onchange="onNotificationField('customer_email_enabled',this.checked)"><span><b>Send three-stage customer updates</b><br><span class="hint">Email 1 is sent after payment proof upload; Email 2 is sent when payment is confirmed; Email 3 is sent automatically when you change the order to Ready for Collection.</span></span></label>
      <div class="display" style="font-size:18px;margin:18px 0 8px;">Email 1 · Payment under review</div>
      <div class="field"><label>Subject</label><input value="${escapeHtml(n.payment_review_email_subject_template || "We received your order · {order_number}")}" oninput="onNotificationField('payment_review_email_subject_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Heading</label><input value="${escapeHtml(n.payment_review_email_heading_template || "Hi {customer_name}, we received your order")}" oninput="onNotificationField('payment_review_email_heading_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Message</label><textarea rows="3" oninput="onNotificationField('payment_review_email_message_template',this.value);updateCustomerConfirmationPreviews()">${escapeHtml(n.payment_review_email_message_template || "Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.")}</textarea></div>
      <div class="ref-note"><b>Subject</b><div id="payment-review-email-subject-preview" style="margin-top:5px;">${escapeHtml(reviewEmailSubject)}</div><div style="border-top:1px solid #dfd8ca;margin:12px 0;"></div><b>Email preview</b><div id="payment-review-email-template-preview" style="white-space:pre-wrap;line-height:1.55;margin-top:7px;">${escapeHtml(reviewEmailPreview)}</div></div>
      <div class="divider"></div>
      <div class="display" style="font-size:18px;margin:4px 0 8px;">Email 2 · Order confirmed</div>
      <div class="field"><label>Subject</label><input value="${escapeHtml(n.customer_email_subject_template || "Your order is confirmed · {order_number}")}" oninput="onNotificationField('customer_email_subject_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Heading</label><input value="${escapeHtml(n.customer_email_heading_template || "Your order is confirmed")}" oninput="onNotificationField('customer_email_heading_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Message</label><textarea rows="3" oninput="onNotificationField('customer_email_message_template',this.value);updateCustomerConfirmationPreviews()">${escapeHtml(n.customer_email_message_template || "Thank you for ordering with Shizuku Lab. We look forward to preparing your order.")}</textarea></div>
      <div class="hint" style="text-align:left;margin:-4px 0 10px;">Variables: <code>{customer_name}</code> <code>{order_number}</code> <code>{date}</code> <code>{time}</code> <code>{collection_point}</code> <code>{total}</code></div>
      <div class="ref-note"><b>Subject</b><div id="customer-email-subject-preview" style="margin-top:5px;">${escapeHtml(emailSubject)}</div><div style="border-top:1px solid #dfd8ca;margin:12px 0;"></div><b>Email preview</b><div id="customer-email-template-preview" style="white-space:pre-wrap;line-height:1.55;margin-top:7px;">${escapeHtml(emailPreview)}</div></div>
      <div class="divider"></div>
      <div class="display" style="font-size:18px;margin:4px 0 8px;">Email 3 · Ready for collection</div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:10px 0 14px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${n.customer_ready_email_enabled !== false ? "checked" : ""} onchange="onNotificationField('customer_ready_email_enabled',this.checked)"><span><b>Send Email 3 automatically when status becomes Ready for Collection</b><br><span class="hint">Turning this off keeps Email 1 and Email 2 working.</span></span></label>
      <div class="field"><label>Subject</label><input value="${escapeHtml(n.customer_ready_email_subject_template || "Your order is ready for collection · {order_number}")}" oninput="onNotificationField('customer_ready_email_subject_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Heading</label><input value="${escapeHtml(n.customer_ready_email_heading_template || "Your order is ready for collection")}" oninput="onNotificationField('customer_ready_email_heading_template',this.value);updateCustomerConfirmationPreviews()"></div>
      <div class="field"><label>Message</label><textarea rows="3" oninput="onNotificationField('customer_ready_email_message_template',this.value);updateCustomerConfirmationPreviews()">${escapeHtml(n.customer_ready_email_message_template || "Your order is ready for collection. We look forward to seeing you at your selected pickup time.")}</textarea></div>
      <div class="hint" style="text-align:left;margin:-4px 0 10px;">Variables: <code>{customer_name}</code> <code>{order_number}</code> <code>{date}</code> <code>{time}</code> <code>{collection_point}</code> <code>{total}</code></div>
      <div class="ref-note"><b>Subject</b><div id="customer-ready-email-subject-preview" style="margin-top:5px;">${escapeHtml(readyEmailSubject)}</div><div style="border-top:1px solid #dfd8ca;margin:12px 0;"></div><b>Email preview</b><div id="customer-ready-email-template-preview" style="white-space:pre-wrap;line-height:1.55;margin-top:7px;">${escapeHtml(readyEmailPreview)}</div></div>
    </div>
    <div class="order-card"><div class="order-top"><b>WhatsApp confirmation</b><span>${s.whatsapp_confirmation_enabled !== false ? "On" : "Off"}</span></div><label class="slot" style="cursor:pointer;gap:10px;margin:12px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.whatsapp_confirmation_enabled !== false ? "checked" : ""} onchange="onSettingsField('whatsapp_confirmation_enabled',this.checked)"><span><b>Show WhatsApp customer button on confirmed orders</b></span></label><div class="field"><label>WhatsApp message</label><textarea rows="6" oninput="onSettingsField('whatsapp_confirmation_template',this.value);updateCustomerConfirmationPreviews()">${escapeHtml(whatsappTemplate)}</textarea></div><div class="hint" style="text-align:left;margin:-4px 0 10px;">Variables: <code>{customer_name}</code> <code>{date}</code> <code>{time}</code> <code>{collection_point}</code> <code>{order_items}</code></div><div class="ref-note"><b>WhatsApp preview</b><div id="notification-whatsapp-template-preview" style="white-space:pre-wrap;line-height:1.55;margin-top:7px;">${escapeHtml(whatsappPreview)}</div></div></div>
    <button class="btn-primary" id="notification-save-btn" style="width:100%;margin-top:16px;" onclick="saveNotificationSettings()">Save confirmation settings</button>
  </section></div>`;
}

function cmsField(label, key, placeholder = "", rows = 0) {
  const s = astate.settingsDraft || {};
  return rows
    ? `<div class="field"><label>${label}</label><textarea rows="${rows}" placeholder="${escapeHtml(placeholder)}" oninput="onSettingsField('${key}',this.value)">${escapeHtml(s[key] || "")}</textarea></div>`
    : `<div class="field"><label>${label}</label><input value="${escapeHtml(s[key] || "")}" placeholder="${escapeHtml(placeholder)}" oninput="onSettingsField('${key}',this.value)"></div>`;
}
function cmsToggle(label, key, description = "") {
  const s = astate.settingsDraft || {};
  return `<label class="slot" style="cursor:pointer;gap:10px;margin-bottom:12px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s[key] !== false ? "checked" : ""} onchange="onSettingsField('${key}',this.checked)"><span><b>${label}</b>${description ? `<br><span class="hint">${description}</span>` : ""}</span></label>`;
}
function cmsSaveButton() { return `<button class="btn-primary" id="settings-save-btn" style="width:100%;margin-top:18px;" onclick="saveSettings()">Save settings</button>`; }

function updateDesignPreview() {
  const s = astate.settingsDraft || {};
  const shop = document.getElementById("design-shop-preview");
  const card = document.getElementById("design-loyalty-preview");
  const headingFont = ({ fraunces:"Fraunces,serif", noto_serif_jp:"'Noto Serif JP',serif", work_sans:"'Work Sans',sans-serif", noto_sans_jp:"'Noto Sans JP',sans-serif", georgia:"Georgia,serif" })[s.theme_heading_font || "fraunces"];
  const bodyFont = ({ fraunces:"Fraunces,serif", noto_serif_jp:"'Noto Serif JP',serif", work_sans:"'Work Sans',sans-serif", noto_sans_jp:"'Noto Sans JP',sans-serif", georgia:"Georgia,serif" })[s.theme_body_font || "work_sans"];
  if (shop && !document.getElementById("reset-original-colours")) {
    const button = document.createElement("button");
    button.id = "reset-original-colours";
    button.type = "button";
    button.className = "btn-secondary";
    button.style.margin = "0 0 14px";
    button.textContent = "↺ Reset to original colours";
    button.onclick = resetOriginalDesignColours;
    shop.parentElement?.before(button);
  }
  if (shop) {
    shop.style.background = s.theme_background_color || "#F3EEE3";
    shop.style.color = s.theme_text_color || "#2A2A22";
    shop.style.fontFamily = bodyFont;
    shop.querySelectorAll("[data-preview-heading]").forEach((element) => { element.style.fontFamily = headingFont; element.style.fontSize = `${Number(s.theme_heading_size || 25)}px`; });
    shop.querySelectorAll("[data-preview-card] [data-preview-heading]").forEach((element) => element.style.fontSize = `${Number(s.theme_product_name_size || 15)}px`);
    shop.querySelectorAll("[data-preview-primary]").forEach((element) => element.style.fontSize = `${Number(s.theme_button_size || 14)}px`);
    shop.querySelectorAll("[data-preview-card]").forEach((element) => element.style.background = s.theme_card_color || "#FFFFFF");
    shop.querySelectorAll("[data-preview-primary]").forEach((element) => { element.style.background = s.theme_primary_color || "#4B5D3A"; element.style.color = s.theme_background_color || "#F3EEE3"; });
  }
  if (card) {
    card.style.background = s.loyalty_card_background || "#1E473E";
    card.style.color = s.loyalty_card_text_color || "#F9F4E8";
    card.style.fontFamily = bodyFont;
    card.querySelectorAll("[data-preview-heading]").forEach((element) => element.style.fontFamily = headingFont);
    card.querySelectorAll("[data-preview-accent]").forEach((element) => element.style.background = s.loyalty_card_accent_color || "#CAE4B3");
  }
}
function resetOriginalDesignColours() {
  const originals = {
    theme_primary_color: "#4B5D3A", theme_background_color: "#F3EEE3",
    theme_card_color: "#FFFFFF", theme_text_color: "#2A2A22",
    loyalty_card_background: "#1E473E", loyalty_card_text_color: "#F9F4E8",
    loyalty_card_accent_color: "#CAE4B3"
  };
  Object.assign(astate.settingsDraft, originals);
  Object.entries(originals).forEach(([key,value]) => document.querySelectorAll(`[data-design-key="${key}"]`).forEach((input) => { input.value = value; }));
  updateDesignPreview();
}

function applyDesignPreset(name) {
  const presets = {
    elegant: { theme_heading_font:"fraunces", theme_body_font:"work_sans", theme_heading_size:25, theme_body_size:14, theme_product_name_size:15, theme_price_size:14, theme_button_size:14, welcome_title_font:"fraunces", welcome_body_font:"work_sans", welcome_title_size:39 },
    japanese: { theme_heading_font:"noto_serif_jp", theme_body_font:"noto_sans_jp", theme_heading_size:24, theme_body_size:14, theme_product_name_size:15, theme_price_size:14, theme_button_size:14, welcome_title_font:"noto_serif_jp", welcome_body_font:"noto_sans_jp", welcome_title_size:37 },
    clean: { theme_heading_font:"work_sans", theme_body_font:"work_sans", theme_heading_size:26, theme_body_size:15, theme_product_name_size:16, theme_price_size:15, theme_button_size:15, welcome_title_font:"work_sans", welcome_body_font:"work_sans", welcome_title_size:40 }
  };
  Object.assign(astate.settingsDraft, presets[name] || presets.elegant);
  render();
}

const SYSTEM_THEMES = {
  zen:{label:"Zen",note:"Quiet Japanese list",primary:"#4B5D3A",background:"#F3EEE3",card:"#FFFFFF",text:"#2A2A22",heading:"noto_serif_jp",body:"noto_sans_jp",menu:"list"},
  korean:{label:"Korean Minimal",note:"Soft banner and rounded cards",primary:"#9B8172",background:"#FAF7F2",card:"#F0EAE4",text:"#4B4742",heading:"work_sans",body:"work_sans",menu:"gallery"},
  editorial:{label:"Editorial Café",note:"Magazine-style monochrome menu",primary:"#111111",background:"#FFFFFF",card:"#FFFFFF",text:"#111111",heading:"georgia",body:"work_sans",menu:"list"},
  retro:{label:"Retro Menu Board",note:"Cream, brick red and printed edges",primary:"#9A3E2F",background:"#F4E1B8",card:"#FFF8E8",text:"#3D2B20",heading:"georgia",body:"work_sans",menu:"list"},
  threed:{label:"3D Bento",note:"Lavender tiles and raised controls",primary:"#6254A3",background:"#EEEAFB",card:"#FFFFFF",text:"#292638",heading:"work_sans",body:"work_sans",menu:"gallery"},
  sakura:{label:"Sakura Wash",note:"Dusty rose, warm paper and soft rounded cards",primary:"#A75568",background:"#F8EEF0",card:"#FFF9F7",text:"#402F34",heading:"fraunces",body:"work_sans",menu:"gallery"},
  coastal:{label:"Coastal Glass",note:"Airy blue panels with crisp navy details",primary:"#326A7C",background:"#EAF4F5",card:"#F9FFFF",text:"#20383F",heading:"work_sans",body:"work_sans",menu:"gallery"},
  cocoa:{label:"Cocoa Atelier",note:"Espresso lines, oat paper and crafted warmth",primary:"#6B4636",background:"#EFE2D2",card:"#FFF9EF",text:"#33251F",heading:"georgia",body:"work_sans",menu:"list"},
  matcha_modern:{label:"Matcha Modern",note:"Deep matcha green, warm cream and clean premium spacing",primary:"#173F32",background:"#F4F0E4",card:"#FFFCF5",text:"#17342B",heading:"fraunces",body:"work_sans",menu:"gallery"},
  japanese_paper:{label:"Japanese Paper",note:"Warm washi paper, black ink and restrained vermilion",primary:"#B94735",background:"#F3EBDD",card:"#FBF7EE",text:"#2E2A27",heading:"noto_serif_jp",body:"noto_sans_jp",menu:"list"},
  strawberry_milk:{label:"Strawberry Milk",note:"Soft blush, berry pink and extra-rounded friendly cards",primary:"#C64D68",background:"#FFF0F3",card:"#FFFBFB",text:"#552F39",heading:"fraunces",body:"work_sans",menu:"gallery"},
  midnight_studio:{label:"Midnight Studio",note:"Deep navy, champagne gold and softly illuminated panels",primary:"#E0BE74",background:"#111827",card:"#1D2738",text:"#F6EDD8",heading:"georgia",body:"work_sans",menu:"gallery"},
  nordic_cafe:{label:"Nordic Café",note:"Soft grey, sage green and calm functional simplicity",primary:"#71836A",background:"#EEF0EB",card:"#FAFAF7",text:"#343B33",heading:"work_sans",body:"work_sans",menu:"list"},
  studio_grid:{label:"Studio Grid",note:"Compact modern catalogue with clean grouped cards and focused actions",primary:"#6D5CE7",background:"#F4F5F7",card:"#FFFFFF",text:"#18181C",heading:"work_sans",body:"work_sans",menu:"list"},
  winter_sage:{label:"Winter Sage",note:"Powder blue, quiet sage and warm winter white",primary:"#BCCFE4",background:"#E9E5DB",card:"#A1A89C",text:"#303A42",heading:"work_sans",body:"work_sans",menu:"gallery"},
  deep_harbour:{label:"Deep Harbour",note:"Deep blue, winter white and soft sage",primary:"#415C7E",background:"#E9E5DB",card:"#A1A89C",text:"#243247",heading:"fraunces",body:"work_sans",menu:"gallery"},
  lavender_mist:{label:"Lavender Mist",note:"Twilight lavender, mist lilac and clear blue",primary:"#676782",background:"#B7B2CC",card:"#7EA8D2",text:"#272735",heading:"fraunces",body:"work_sans",menu:"gallery"}
};

function applyOrderingTheme(name) {
  const theme = SYSTEM_THEMES[name] || SYSTEM_THEMES.zen;
  Object.assign(astate.settingsDraft, {ordering_theme:name,theme_primary_color:theme.primary,theme_background_color:theme.background,theme_card_color:theme.card,theme_text_color:theme.text,theme_heading_font:theme.heading,theme_body_font:theme.body,default_menu_view:theme.menu});
  render();
}

function applyAdminTheme(name) {
  const theme = SYSTEM_THEMES[name] || SYSTEM_THEMES.zen;
  Object.assign(astate.settingsDraft, {admin_theme:name,admin_theme_primary:theme.primary,admin_theme_background:theme.background,admin_theme_card:theme.card,admin_theme_text:theme.text});
  render();
}

function editThemeChoice(name, target) {
  if (target === "admin") applyAdminTheme(name); else applyOrderingTheme(name);
  astate.tab = "theme_design";
  astate.designTopic = "customise";
  render();
}
async function deleteThemeChoice(name) {
  const ordering = astate.settingsDraft?.ordering_theme || "zen";
  const admin = astate.settingsDraft?.admin_theme || "zen";
  if (name === ordering || name === admin) return alert("This theme is currently in use. Apply a different theme to Ordering and Admin before deleting it from the list.");
  if (!confirm(`Remove ${SYSTEM_THEMES[name]?.label || "this theme"} from your theme choices?`)) return;
  const hidden = [...new Set([...(Array.isArray(astate.settingsDraft?.hidden_system_themes) ? astate.settingsDraft.hidden_system_themes : []), name])];
  if (window.SLOW_STUDIO_DEMO_MODE) { astate.settingsDraft.hidden_system_themes=hidden; astate.settings={...astate.settingsDraft}; render(); return; }
  const { data, error } = await db.from("store_settings").update({ hidden_system_themes: hidden }).eq("id", astate.settings.id).select().single();
  if (error) return alert("Could not remove theme: " + error.message);
  astate.settings = data; astate.settingsDraft = { ...data }; render();
}
async function restoreThemeChoices() {
  if (window.SLOW_STUDIO_DEMO_MODE) { astate.settingsDraft.hidden_system_themes=[]; astate.settings={...astate.settingsDraft}; render(); return; }
  const { data, error } = await db.from("store_settings").update({ hidden_system_themes: [] }).eq("id", astate.settings.id).select().single();
  if (error) return alert("Could not restore themes: " + error.message);
  astate.settings = data; astate.settingsDraft = { ...data }; render();
}

function themeMiniPreview(surface) {
  const heading = surface === "welcome" ? "Welcome" : surface === "order" ? "Ordering" : "Dashboard";
  const store=escapeHtml(astate.settingsDraft?.store_name||"Your HBB"),price=DASHBOARD_MARKET==="MY"?"RM 16.00":"$6.50";
  const content = surface === "welcome" ? `<div class="theme-preview-window"><div style="font-family:Georgia,serif;font-size:13px;font-weight:700;">Welcome to ${store}</div><div class="theme-preview-row"></div><span class="theme-preview-button">Enter store</span></div>` : surface === "order" ? `<div class="theme-preview-window"><b>${store}</b><div class="theme-preview-card">Matcha Cloud <span style="float:right;">${price}</span></div><span class="theme-preview-button">Add</span></div>` : `<div class="theme-preview-window" style="display:grid;grid-template-columns:34% 1fr;gap:6px;"><div style="border-right:1px solid currentColor;font-size:8px;">Dashboard<br><br>Orders<br><br>Products</div><div><b>Welcome back</b><div class="theme-preview-card">Today’s orders · 2</div></div></div>`;
  return `<div class="theme-preview-screen"><b>${heading}</b>${content}</div>`;
}

function renderThemeTab() {
  const ordering = astate.settingsDraft?.ordering_theme || astate.settingsDraft?.system_theme || "zen";
  const admin = astate.settingsDraft?.admin_theme || astate.settingsDraft?.system_theme || "zen";
  const hidden = Array.isArray(astate.settingsDraft?.hidden_system_themes) ? astate.settingsDraft.hidden_system_themes.map(String) : [];
  return `<div style="display:grid;gap:16px;"><section class="dashboard-card" style="padding:16px 20px;"><b>Ordering theme:</b> ${escapeHtml(SYSTEM_THEMES[ordering]?.label || "Zen")} &nbsp; · &nbsp; <b>Admin theme:</b> ${escapeHtml(SYSTEM_THEMES[admin]?.label || "Zen")}${hidden.length ? `<button class="link-btn" style="float:right" onclick="restoreThemeChoices()">Restore ${hidden.length} deleted theme${hidden.length===1?"":"s"}</button>` : ""}</section>${Object.entries(SYSTEM_THEMES).filter(([name]) => !hidden.includes(name)).map(([name,theme]) => {
    const previewShadow = name === "retro" ? `5px 5px 0 ${theme.text}` : name === "threed" ? `0 10px 0 color-mix(in srgb,${theme.primary} 18%,transparent)` : "none";
    return `<section data-theme-preview class="dashboard-card theme-preview-theme-${name}" style="--preview-primary:${theme.primary};--preview-bg:${theme.background};--preview-card:${theme.card};--preview-text:${theme.text};--preview-shadow:${previewShadow};padding:20px;"><div class="dashboard-card-head" style="padding:0 0 14px;"><div><h2>${theme.label}</h2><span style="opacity:.7;">${theme.note}</span></div><div style="text-align:right;font-size:11px;line-height:1.6;">${ordering === name ? `<div>Ordering selected ✓</div>` : ""}${admin === name ? `<div>Admin selected ✓</div>` : ""}</div></div><div class="theme-preview-grid">${themeMiniPreview("welcome")}${themeMiniPreview("order")}${themeMiniPreview("dashboard")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px;"><button class="btn-primary" onclick="applyOrderingTheme('${name}')">${ordering === name ? "Ordering selected" : "Apply to Ordering"}</button><button class="btn-secondary" onclick="applyAdminTheme('${name}')">${admin === name ? "Admin selected" : "Apply to Admin"}</button></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px"><button class="link-btn" onclick="editThemeChoice('${name}','ordering')">Edit Ordering colours</button><button class="link-btn" onclick="editThemeChoice('${name}','admin')">Edit Admin colours</button><button class="link-danger" onclick="deleteThemeChoice('${name}')">Delete choice</button></div></section>`;
  }).join("")}${cmsSaveButton()}</div>`;
}

function setDesignTopic(topic) {
  astate.designTopic = topic === "customise" ? "customise" : "themes";
  render();
}

function renderThemeDesignTab() {
  const topic = astate.designTopic || "themes";
  return `<div class="btn-row" style="justify-content:flex-start;margin-bottom:16px;position:sticky;top:0;z-index:5;background:var(--admin-bg);padding:8px 0;">
    <button class="${topic === "themes" ? "btn-primary" : "btn-secondary"}" onclick="setDesignTopic('themes')">Theme library</button>
    <button class="${topic === "customise" ? "btn-primary" : "btn-secondary"}" onclick="setDesignTopic('customise')">Colours, fonts & layout</button>
  </div>${topic === "themes" ? renderThemeTab() : renderDesignTab()}`;
}

function renderDesignTab() {
  const s = astate.settingsDraft || {};
  const adminColour = (label,key,fallback) => `<div class="field"><label>${label}</label><div style="display:grid;grid-template-columns:64px 1fr;gap:9px"><input type="color" value="${escapeHtml(s[key]||fallback)}" oninput="onSettingsField('${key}',this.value);this.nextElementSibling.value=this.value"><input value="${escapeHtml(s[key]||fallback)}" oninput="onSettingsField('${key}',this.value);if(/^#[0-9a-fA-F]{6}$/.test(this.value))this.previousElementSibling.value=this.value"></div></div>`;
  const adminColours = `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Admin colour editor</h2><span>Saved separately from the customer ordering page</span></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">${adminColour("Primary colour","admin_theme_primary","#4B5D3A")}${adminColour("Background colour","admin_theme_background","#F3EEE3")}${adminColour("Card colour","admin_theme_card","#FFFFFF")}${adminColour("Text colour","admin_theme_text","#2A2A22")}</div><div class="hint" style="text-align:left;margin-top:10px">Press Save settings below. Admin colours apply after refresh.</div></section>`;
  const color = (label,key,fallback) => `${key === "theme_primary_color" ? `<div style="grid-column:1/-1;"><div class="display" style="font-size:20px;margin-bottom:10px;">Menu display</div><div class="field"><label>Default customer menu view</label><select onchange="onSettingsField('default_menu_view',this.value)"><option value="list" ${(s.default_menu_view || "list") === "list" ? "selected" : ""}>List</option><option value="gallery" ${s.default_menu_view === "gallery" ? "selected" : ""}>Gallery</option></select></div><label class="slot" style="cursor:pointer;gap:10px;margin-bottom:14px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${s.show_menu_view_switch !== false ? "checked" : ""} onchange="onSettingsField('show_menu_view_switch',this.checked)"><span><b>Let customers switch between List and Gallery</b><br><span class="hint">Untick this to keep everyone on your selected default view.</span></span></label><div class="divider"></div></div>` : ""}<div class="field"><label>${label}</label><div style="display:grid;grid-template-columns:64px 1fr;gap:9px;"><input data-design-key="${key}" type="color" value="${escapeHtml(s[key] || fallback)}" oninput="onSettingsField('${key}',this.value);this.nextElementSibling.value=this.value;updateDesignPreview()"><input data-design-key="${key}" value="${escapeHtml(s[key] || fallback)}" oninput="onSettingsField('${key}',this.value);if(/^#[0-9a-fA-F]{6}$/.test(this.value)){this.previousElementSibling.value=this.value;updateDesignPreview()}"></div></div>`;
  const fonts = [["fraunces","Elegant serif · Fraunces"],["noto_serif_jp","Japanese serif · Noto Serif JP"],["work_sans","Clean sans · Work Sans"],["noto_sans_jp","Japanese sans · Noto Sans JP"],["georgia","Classic serif · Georgia"]];
  const select = (label,key,fallback) => `${key === "theme_heading_font" ? `<div style="grid-column:1/-1;"><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:10px;">Recommended font styles</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px;"><button class="btn-secondary" onclick="applyDesignPreset('elegant')">Shizuku Elegant</button><button class="btn-secondary" onclick="applyDesignPreset('japanese')">Japanese Calm</button><button class="btn-secondary" onclick="applyDesignPreset('clean')">Clean Studio</button></div></div>` : ""}<div class="field"><label>${label}</label><select onchange="onSettingsField('${key}',this.value);updateDesignPreview()">${fonts.map(([v,n]) => `<option value="${v}" ${(s[key] || fallback) === v ? "selected" : ""}>${n}</option>`).join("")}</select></div>${key === "theme_body_font" ? `<div style="grid-column:1/-1;"><div class="display" style="font-size:20px;margin:8px 0 10px;">Font sizes</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${size("Main heading","theme_heading_size",25,18,48)}${size("Body text","theme_body_size",14,12,22)}${size("Product name","theme_product_name_size",15,12,26)}${size("Price","theme_price_size",14,12,24)}${size("Buttons","theme_button_size",14,12,22)}${size("Welcome title","welcome_title_size",39,28,64)}</div></div>` : ""}`;
  const size = (label,key,fallback,min,max) => `<div class="field"><label>${label} <span style="float:right;color:#4B5D3A;">${Number(s[key] || fallback)} px</span></label><input type="range" min="${min}" max="${max}" step="1" value="${Number(s[key] || fallback)}" oninput="onSettingsField('${key}',Number(this.value));render()"></div>`;
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer shop design</h2><span>Used across the ordering pages</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">${color("Primary colour","theme_primary_color","#4B5D3A")}${color("Background colour","theme_background_color","#F3EEE3")}${color("Card colour","theme_card_color","#FFFFFF")}${color("Text colour","theme_text_color","#2A2A22")}${select("Heading font","theme_heading_font","fraunces")}${select("Body font","theme_body_font","work_sans")}</div><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Loyalty card design</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">${color("Card background","loyalty_card_background","#1E473E")}${color("Card text","loyalty_card_text_color","#F9F4E8")}${color("Card accent","loyalty_card_accent_color","#CAE4B3")}</div><div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Live preview</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch;"><div id="design-shop-preview" style="background:${escapeHtml(s.theme_background_color || "#F3EEE3")};color:${escapeHtml(s.theme_text_color || "#2A2A22")};padding:20px;border-radius:20px;border:1px solid #e1d9c8;"><div data-preview-heading style="font-size:25px;font-weight:700;">${escapeHtml(s.store_name || "Your Store")}</div><div style="font-size:12px;opacity:.7;margin:3px 0 18px;">${escapeHtml(s.store_tagline || "crafted with care")}</div><div data-preview-card style="background:${escapeHtml(s.theme_card_color || "#FFFFFF")};border-radius:15px;padding:14px;box-shadow:0 8px 22px rgba(30,30,20,.08);"><div data-preview-heading style="font-size:18px;font-weight:700;">Ichigo Matcha Latte</div><div style="font-size:12px;opacity:.72;margin:5px 0 13px;">Freshly whisked matcha with creamy oat milk.</div><div style="display:flex;justify-content:space-between;align-items:center;"><b>$6.90</b><span data-preview-primary style="background:${escapeHtml(s.theme_primary_color || "#4B5D3A")};color:${escapeHtml(s.theme_background_color || "#F3EEE3")};padding:8px 15px;border-radius:99px;">Add</span></div></div></div><div id="design-loyalty-preview" style="background:${escapeHtml(s.loyalty_card_background || "#1E473E")};color:${escapeHtml(s.loyalty_card_text_color || "#F9F4E8")};padding:22px;border-radius:20px;box-shadow:0 12px 28px rgba(20,35,25,.16);"><div style="font-size:10px;letter-spacing:.15em;opacity:.75;">MEMBER</div><div data-preview-heading style="font-size:24px;font-weight:700;margin-top:8px;">${escapeHtml(s.loyalty_heading || "Shizuku Club")}</div><div style="font-size:13px;margin-top:8px;opacity:.9;">Welcome back, Shermin</div><div style="font-size:42px;font-weight:700;margin:22px 0 7px;">8 <span style="font-size:14px;">points</span></div><div style="height:9px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;"><div data-preview-accent style="width:64%;height:100%;background:${escapeHtml(s.loyalty_card_accent_color || "#CAE4B3")};border-radius:99px;"></div></div><div style="font-size:11px;margin-top:9px;opacity:.75;">8 / 50 points</div></div></div><div class="hint" style="text-align:left;margin-top:10px;">Changes appear here instantly. Press Save settings when you are happy with the design.</div>${cmsSaveButton()}</section>`;
}

const renderDesignTabBase = renderDesignTab;
renderDesignTab = function () {
  const s = astate.settingsDraft || {};
  const field = (label,key,fallback) => `<div class="field"><label>${label}</label><div style="display:grid;grid-template-columns:64px 1fr;gap:9px"><input type="color" value="${escapeHtml(s[key]||fallback)}" oninput="onSettingsField('${key}',this.value);this.nextElementSibling.value=this.value"><input value="${escapeHtml(s[key]||fallback)}" oninput="onSettingsField('${key}',this.value);if(/^#[0-9a-fA-F]{6}$/.test(this.value))this.previousElementSibling.value=this.value"></div></div>`;
  const admin = `<section class="dashboard-card" style="padding:20px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:0 0 16px"><div><h2>Admin colour editor</h2><span>Saved separately from the customer ordering page</span></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">${field("Primary colour","admin_theme_primary","#4B5D3A")}${field("Background colour","admin_theme_background","#F3EEE3")}${field("Card colour","admin_theme_card","#FFFFFF")}${field("Text colour","admin_theme_text","#2A2A22")}</div><div class="hint" style="text-align:left;margin-top:10px">Press Save settings below. Admin colours apply after refresh.</div></section>`;
  return admin + renderDesignTabBase();
};

function renderWordingTab() {
  const demo = window.SLOW_STUDIO_DEMO_MODE;
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer wording</h2><span>Main customer-facing titles</span></div>${cmsField("Store name","store_name","Shizuku Lab")}${cmsField("Store tagline","store_tagline","雫ラボ · crafted drop by drop")}${cmsField("Menu heading","menu_heading","メニュー · DRINK MENU")}${cmsField("Reviews heading","reviews_heading","お客様の声 · REVIEWS")}${cmsField("Loyalty programme name","loyalty_heading","Shizuku Club")}${cmsField("Chat heading","chat_heading","Message us")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:6px;">Track order wording</div><div class="hint" style="text-align:left;margin-bottom:14px;">Edit every main label and every order-status message shown to customers. Email and WhatsApp confirmations are together under Notifications.</div>${cmsField("Page heading","track_order_heading","Track my order")}${cmsField("Intro sentence","track_intro_text","Enter either your order number or the phone number used at checkout.",2)}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">${cmsField("Order number label","track_order_number_label","Order number")}${cmsField("Phone number label","track_phone_label","Phone number")}${cmsField("Between fields","track_or_text","OR")}${cmsField("Track button","track_button_text","Track order")}${cmsField("Live updates label","track_live_updates_text","LIVE UPDATES")}${cmsField("Refresh button","track_refresh_text","Refresh now")}${cmsField("Order detail label","track_order_label","Order")}${cmsField("Pickup detail label","track_pickup_label","Pickup")}${cmsField("Stage 1","track_stage_payment","Payment review")}${cmsField("Stage 2","track_stage_confirmed","Confirmed")}${cmsField("Stage 3","track_stage_preparing","Preparing")}${cmsField("Stage 4","track_stage_ready","Ready")}</div><div class="divider"></div>${trackStatusFields("Awaiting payment","track_awaiting","Awaiting payment","Please complete payment and submit your payment screenshot.")}${trackStatusFields("Payment under review","track_review","Payment under review","We’ll confirm your order once your payment proof is verified.")}${trackStatusFields("Order confirmed","track_confirmed","Order confirmed","Payment verified — we’ll prepare your order closer to pickup.")}${trackStatusFields("Preparing","track_preparing","Preparing your order","We’re freshly preparing your drinks now.")}${trackStatusFields("Ready","track_ready","Ready for collection","Your order is ready — see you at your pickup time!")}${trackStatusFields("Collected","track_collected","Collected with care ✨","We hope you enjoyed every sip. Looking forward to making your next Shizuku drink.")}${trackStatusFields("Cancelled","track_cancelled","Order cancelled","This order can no longer accept payment. Please place a new order.")}${trackStatusFields("Payment rejected","track_rejected","Payment proof needs attention","Please upload a new payment screenshot.")}${cmsSaveButton()}</section>`;
}

function trackStatusFields(label, prefix, title, note) {
  return `<div class="display" style="font-size:16px;margin:14px 0 8px;">${label}</div><div style="display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px;">${cmsField("Title",`${prefix}_title`,title)}${cmsField("Sentence",`${prefix}_note`,note,2)}</div>`;
}

function renderCheckoutCommunicationTab() {
  const myDemo = window.SLOW_STUDIO_DEMO_MODE && DASHBOARD_MARKET === "MY";
  const paymentFields = myDemo ? `${cmsField("Payment instructions","payment_instructions","Pay by bank transfer or Touch ’n Go. Upload your payment proof for review.",3)}${cmsField("Phone number / Touch ’n Go account","tng_phone_number","+60 12-345 6789")}<div class="field"><label>Touch ’n Go QR</label><input type="file" accept="image/*" onchange="uploadStorefrontImage(this,'tng_qr_url')">${astate.settingsDraft?.tng_qr_url?`<img src="${escapeHtml(astate.settingsDraft.tng_qr_url)}" alt="Touch ’n Go QR preview" style="display:block;width:190px;height:190px;object-fit:contain;margin-top:10px;border:1px solid var(--admin-line);border-radius:14px;background:#fff">`:""}<div class="hint" style="text-align:left">Upload your Touch ’n Go QR or provide the phone number above. PayNow is not used in this Malaysia demo.</div></div>` : cmsField("Payment instructions","payment_instructions","Scan with your banking app, or PayNow to the account below.",3);
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Checkout fields</h2><span>Choose what customers see</span></div>${cmsToggle("Show customer email field","show_checkout_email","Customers can enter an email to receive order updates.")}${cmsToggle("Show Instagram field","show_checkout_instagram","Optional Instagram handle at Checkout.")}${cmsToggle("Show Notes field","show_checkout_notes","For allergies, ice level or special requests.")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Receipt after payment</div>${cmsToggle("Show receipt option","show_customer_receipt","After submitting payment, customers can view, print or save their receipt.")}${cmsField("Receipt button text","receipt_button_text","View receipt")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">${myDemo?"Malaysia payment":"Payment wording"}</div>${paymentFields}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Live chat</div>${cmsToggle("Enable order live chat","chat_enabled","Only customers who can verify an order can open its chat.")}${cmsField("Chat heading","chat_heading","Message us")}${cmsField("Automatic reply","chat_auto_reply","Thanks for your message. We will reply as soon as possible.",3)}${cmsField("Chat business hours","chat_business_hours","e.g. Replies daily, 10 AM – 8 PM")}<div class="divider"></div><div class="display" style="font-size:20px;margin-bottom:12px;">Customer reviews</div>${cmsToggle("Enable customer reviews","reviews_enabled","Collected and paid orders can submit a review.")}${cmsField("Reviews heading","reviews_heading",window.SLOW_STUDIO_DEMO_MODE?"CUSTOMER REVIEWS":"お客様の声 · REVIEWS")}${cmsSaveButton()}</section>`;
}

function renderPaymentPageTab() {
  const s = astate.settingsDraft || {};
  const size = Math.max(150, Math.min(300, Number(s.payment_qr_size || 220)));
  const myDemo = window.SLOW_STUDIO_DEMO_MODE && DASHBOARD_MARKET === "MY";
  return `<section class="dashboard-card" style="padding:20px;max-width:900px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Payment page layout</h2><span>${myDemo?"Bank transfer and Touch ’n Go":"Choose what customers see"}</span></div>${cmsToggle("Use compact layout","payment_compact_layout","Reduces spacing so the screenshot upload appears sooner.")}<div class="field"><label>QR size <span id="payment-qr-size-value" style="float:right;font-weight:600;color:#4B5D3A;">${size} px</span></label><input type="range" min="150" max="300" step="10" value="${size}" oninput="onSettingsField('payment_qr_size',Number(this.value));document.getElementById('payment-qr-size-value').textContent=this.value+' px'"></div>${cmsField("Payment instructions","payment_instructions",myDemo?"Pay by bank transfer or Touch ’n Go. Upload your payment proof for review.":"Scan with your banking app, or PayNow to the account below.",3)}${myDemo?`${cmsField("Phone number / Touch ’n Go account","tng_phone_number","+60 12-345 6789")}<div class="field"><label>Touch ’n Go QR image</label><input type="file" accept="image/*" onchange="uploadStorefrontImage(this,'tng_qr_url')">${s.tng_qr_url?`<img src="${escapeHtml(s.tng_qr_url)}" alt="Touch ’n Go QR preview" style="display:block;width:190px;height:190px;object-fit:contain;margin-top:10px;border:1px solid var(--admin-line);border-radius:14px;background:#fff">`:""}</div>`:""}${cmsToggle("Show order details","show_payment_order_details","Shows order number, amount and collection point.")}${cmsToggle("Show payment reference","show_payment_transaction_reference","Shows the reference instruction and optional transaction reference field.")}${cmsToggle("Show Instagram DM help","show_instagram_payment_help","Shows the upload-problem button and opens Instagram after submission.")}${cmsField("Submit button text","payment_submit_button_text","Submit payment proof")}<div class="hint" style="text-align:left;margin-top:8px;">The payment screenshot remains required for payment verification.${myDemo?" PayNow is disabled for this Malaysia demo.":""}</div>${cmsSaveButton()}</section>`;
}

function renderFaqTab() {
  return `<section class="dashboard-card" style="padding:20px;"><div class="dashboard-card-head" style="padding:0 0 16px;"><h2>Customer FAQ</h2><span>Shown at the bottom of the ordering page</span></div><div class="hint" style="text-align:left;margin-bottom:14px;">Use emoji in the question if you want the tone to feel friendly and casual.</div>${astate.faq.map((item, index) => `<div class="order-card" style="margin-bottom:12px;"><div class="field"><label>Question</label><input value="${escapeHtml(item.question || "")}" placeholder="e.g. 🍵 How do I pay?" oninput="onFaqField(${index}, 'question', this.value)"></div><div class="field"><label>Answer</label><textarea rows="4" oninput="onFaqField(${index}, 'answer', this.value)">${escapeHtml(item.answer || "")}</textarea></div><button class="link-danger" onclick="deleteFaq(${index})">Delete FAQ</button></div>`).join("")}<div class="btn-row"><button class="btn-secondary" onclick="addFaq()">+ Add FAQ</button><button class="btn-primary" onclick="saveFaq()">Save FAQ</button></div></section>`;
}

function renderAvailabilityTab() {
  if (!astate.settingsDraft || !astate.availabilityDraft) return `<div class="empty">Loading availability…</div>`;
  const s = astate.settingsDraft;
  const market = astate.availabilityMarket === "MY" ? "MY" : "SG";
  const marketLabel = market === "MY" ? "Malaysia · MYR" : "Singapore · SGD";
  const advanceKey = market === "MY" ? "malaysia_order_advance_days" : "order_advance_days";
  const noticeKey = market === "MY" ? "malaysia_minimum_order_notice_hours" : "minimum_order_notice_hours";
  const intervalKey = market === "MY" ? "malaysia_pickup_slot_interval_minutes" : "pickup_slot_interval_minutes";
  const selected = astate.availabilityDraft;
  const month = new Date(`${astate.calendarMonth}T12:00:00`);
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(`<div></div>`);
  for (let day = 1; day <= days; day++) {
    const dateText = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = availabilityForDate(dateText);
    const isSelected = dateText === astate.selectedAvailabilityDate;
    const label = status.is_open ? (status.override ? "Special open" : "Open") : (status.override ? "Closed" : "—");
    const color = status.is_open ? "#4B5D3A" : status.override ? "#B33333" : "#8A8478";
    cells.push(`<button class="slot availability-day" style="min-height:70px;padding:8px;text-align:left;display:block;border-color:${isSelected ? "#4B5D3A" : "#E1D9C8"};background:${isSelected ? "#F1F5EA" : "#fff"};" onclick="selectAvailabilityDate('${dateText}')"><b>${day}</b><br><span style="font-size:11px;color:${color};">${label}</span></button>`);
  }
  const existing = astate.openingOverrides.find((item) => item.collection_date === selected.collection_date && String(item.market_code || "SG") === market);
  const weeklyCards = weeklySchedule().map((day) => `<div class="order-card" style="margin-bottom:10px;padding:14px;"><div class="queue-top"><label style="display:flex;align-items:center;gap:9px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${day.is_open ? "checked" : ""} onchange="setWeeklyDayOpen(${day.day},this.checked)"><b>${escapeHtml(day.label)}</b></label><span class="queue-status">${day.is_open ? "OPEN" : "CLOSED"}</span></div>${day.is_open ? `<div style="margin-top:10px;">${day.windows.map((window,index)=>`<div style="display:grid;grid-template-columns:minmax(190px,1fr) 130px auto;gap:8px;align-items:end;margin:8px 0;"><div class="field" style="margin:0"><label>Pickup window</label><input value="${escapeHtml(window.range||"")}" placeholder="10:00 AM - 12:00 PM" oninput="setWeeklyWindow(${day.day},${index},'range',this.value)"></div><div class="field" style="margin:0"><label>Order limit</label><input type="number" min="1" value="${window.capacity ?? ""}" placeholder="Unlimited" oninput="setWeeklyWindow(${day.day},${index},'capacity',this.value)"></div><button class="link-danger" style="height:44px" onclick="removeWeeklyWindow(${day.day},${index})">Remove</button></div>`).join("")}<button class="link-btn" onclick="addWeeklyWindow(${day.day})">+ Add pickup window</button></div>` : ""}</div>`).join("");
  return `
    <section class="dashboard-card" style="padding:16px;margin-bottom:18px"><div class="dashboard-card-head" style="padding:${window.SLOW_STUDIO_DEMO_MODE ? "0" : "0 0 12px"}"><div><h2>${marketLabel} availability</h2><span>${window.SLOW_STUDIO_DEMO_MODE ? "Weekly hours, notice period and date exceptions for this demo store." : "Weekly hours, notice period and date exceptions are separate for each country."}</span></div></div>${window.SLOW_STUDIO_DEMO_MODE ? "" : `<div class="tabs" style="margin:0"><button class="${market === "SG" ? "active" : ""}" onclick="setAvailabilityMarket('SG')">Singapore · SGD</button><button class="${market === "MY" ? "active" : ""}" onclick="setAvailabilityMarket('MY')">Malaysia · MYR</button></div>`}</section>
    <div class="display" style="font-size:20px;margin:4px 0 8px;">Ordering window</div>
    <div class="field"><label>How many days ahead can customers order?</label><input type="number" min="0" max="60" value="${s[advanceKey] ?? 14}" oninput="onSettingsField('${advanceKey}', Number(this.value))"><div class="hint">Example: 14 lets customers order up to 2 weeks ahead.</div></div>
    <div class="field"><label>Minimum notice before pickup (hours)</label><input type="number" min="0" max="168" value="${s[noticeKey] ?? 0}" oninput="onSettingsField('${noticeKey}', Number(this.value))"><div class="hint">Example: 24 means customers must order at least 24 hours before pickup.</div></div>
    <div class="field"><label>Pickup time interval (minutes)</label><select onchange="onSettingsField('${intervalKey}', Number(this.value))"><option value="15" ${Number(s[intervalKey]) === 15 ? "selected" : ""}>Every 15 minutes</option><option value="30" ${Number(s[intervalKey] ?? 30) === 30 ? "selected" : ""}>Every 30 minutes</option><option value="60" ${Number(s[intervalKey]) === 60 ? "selected" : ""}>Every 60 minutes</option></select><div class="hint">Customers choose a date first, then see times based on this interval.</div></div>
    <button class="btn-primary" id="settings-save-btn" style="width:100%;margin:2px 0 20px;" onclick="saveSettings()">Save ordering window</button>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:16px 0 6px;">Weekly schedule</div>
    <div class="hint" style="text-align:left;margin:0 0 12px;">Set your normal Monday–Sunday opening windows. Order limit caps the total number of active orders inside that window; leave it blank for unlimited.</div>
    <style>@media(max-width:640px){.order-card [style*="grid-template-columns:minmax(190px"]{grid-template-columns:1fr!important}.order-card [style*="grid-template-columns:minmax(190px"] .link-danger{height:auto!important;justify-self:start}}</style>
    ${weeklyCards}
    <button class="btn-primary" style="width:100%;margin:4px 0 20px;" onclick="saveSettings()">Save weekly schedule</button>
    <div class="divider"></div>
    <div class="display" style="font-size:20px;margin:16px 0 8px;">Opening calendar</div>
    <div class="hint" style="text-align:left;margin:0 0 10px;">Your weekly schedule repeats automatically. Click a date to close it, open an extra day, or use different windows and limits for that date.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;"><button class="link-btn" onclick="changeCalendarMonth(-1)">←</button><b>${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button class="link-btn" onclick="changeCalendarMonth(1)">→</button></div>
    <style>.availability-week,.availability-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;width:100%;min-width:0}.availability-week{text-align:center;margin-bottom:6px;color:#777064;font-size:12px}.availability-day{width:100%;min-width:0;overflow:hidden}@media(max-width:640px){.availability-week,.availability-calendar{gap:3px}.availability-week{font-size:9px}.availability-day{min-height:54px!important;padding:5px 3px!important;font-size:11px}.availability-day span{display:block;font-size:8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}</style>
    <div class="availability-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
    <div class="availability-calendar">${cells.join("")}</div>
    <div class="order-card" style="margin-top:16px;">
      <div class="order-top"><b>${escapeHtml(selected.collection_date)}</b><span class="hint">${existing ? "Special calendar setting" : "Normal weekly schedule"}</span></div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:12px 0;">
        <input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${selected.is_open ? "checked" : ""} onchange="onAvailabilityField('is_open', this.checked)">
        <span><b>Open for pickup</b><br><span class="hint">Untick to close this date.</span></span>
      </label>
      <div class="field"><label>Pickup windows for this date</label><div class="hint" style="text-align:left;margin:0 0 8px;">These replace the weekly schedule for this date only.</div>${specialWindows().map((window, index) => `<div style="display:grid;grid-template-columns:1fr 130px auto;gap:8px;margin:8px 0;align-items:end;"><div><label style="font-size:11px;">Window</label><input value="${escapeHtml(window.range||"")}" placeholder="10:00 AM - 12:00 PM" oninput="setAvailabilityRange(${index}, this.value)"></div><div><label style="font-size:11px;">Order limit</label><input type="number" min="1" value="${window.capacity ?? ""}" placeholder="Unlimited" oninput="setAvailabilityCapacity(${index},this.value)"></div>${specialWindows().length > 1 ? `<button class="btn-secondary" style="height:44px;padding:0 12px;" onclick="removeAvailabilityRange(${index})">Remove</button>` : "<span></span>"}</div>`).join("")}<button class="link-btn" style="padding:3px 0;" onclick="addAvailabilityRange()">+ Add another pickup window</button></div>
      <div class="btn-row"><button class="btn-primary" id="availability-save-btn" onclick="saveAvailabilityOverride()">Save day</button>${existing ? `<button class="btn-secondary" onclick="clearAvailabilityOverride()">Use weekly schedule</button>` : ""}</div>
    </div>
  `;
}

function renderEditOverlay() {
  if (astate.offlineOrderDraft) return renderOfflineOrderEditor();
  if (astate.editingOrder) return renderOrderEditor();
  if (!astate.editing) return "";
  const item = astate.editing;
  return `
  <div class="overlay">
    <div class="overlay-card" style="max-height:80vh;overflow-y:auto;">
      <div class="display overlay-title" style="font-size:18px;">${astate.menu.some(m => String(m.id) === String(item.id)) ? "Edit item" : "New item"}</div>
      <div class="field"><label>Name</label><input value="${item.name}" oninput="onEditField('name', this.value)"></div>
      <div class="field"><label>Product group</label><select onchange="onEditGroup(this.value)"><option value="">Other</option>${astate.productGroups.map((group) => `<option value="${group.id}" ${String(item.group_id) === String(group.id) ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select><div class="hint" style="text-align:left;margin-top:5px;">Shown as a large group heading on the ordering page.</div></div>
      <div class="field"><label>Description</label><textarea rows="2" oninput="onEditField('description', this.value)">${item.description || ""}</textarea></div>
      <div class="field"><label>${item.is_bundle && item.bundle_pricing_mode === "sum_selected" ? `Base price / service fee (${escapeHtml(astate.settingsDraft?.store_currency || "SGD")}, optional)` : `Original price (${escapeHtml(astate.settingsDraft?.store_currency || "SGD")})`}</label><input type="number" min="0" step="0.01" value="${item.price}" oninput="onEditField('price', this.value)">${item.is_bundle && item.bundle_pricing_mode === "sum_selected" ? `<div class="hint" style="text-align:left;margin-top:5px;">The selected drink prices are added automatically. Keep this at 0 unless you want an extra base fee.</div>` : ""}</div>
      <div class="field"><label>Discount price (${escapeHtml(astate.settingsDraft?.store_currency || "SGD")}, optional)</label><input type="number" min="0" step="0.01" value="${item.discount_price ?? ""}" placeholder="Leave blank if there is no sale" oninput="onEditField('discount_price', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">Customers will see the original price crossed out and the discount price in green.</div></div>
      <div class="field"><label>Product image</label><input value="${item.image_url || ""}" placeholder="Upload below or paste image URL" oninput="onEditField('image_url', this.value)"><input type="file" accept="image/*" style="margin-top:8px;" onchange="uploadStorefrontImage(this,'products')">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="Product preview" style="display:block;width:100%;height:150px;object-fit:cover;border:1px solid #E1D9C8;border-radius:12px;margin-top:8px;">` : ""}</div>
      <div class="field"><label>Weekly starting stock</label><input type="number" min="0" value="${item.stock || 0}" oninput="onEditField('stock', this.value)"><div class="hint" style="text-align:left;margin-top:5px;">Available stock refreshes automatically every Monday. Orders from previous weeks will not reduce this week's stock.</div></div>
      <div class="field" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="bundle-check" ${item.is_bundle ? "checked" : ""} onchange="onEditField('is_bundle', this.checked);render()" style="width:auto;"><label style="margin:0;" for="bundle-check">This is a Bundle / Mix & Matcha</label></div>
      ${item.is_bundle ? `<div class="field"><label>Bundle price style</label><select onchange="onEditField('bundle_pricing_mode',this.value);render()"><option value="fixed" ${item.bundle_pricing_mode !== "sum_selected" ? "selected" : ""}>Fixed bundle price</option><option value="sum_selected" ${item.bundle_pricing_mode === "sum_selected" ? "selected" : ""}>Add selected product prices automatically</option></select><div class="hint" style="text-align:left;margin-top:5px;">Fixed keeps the bundle at one price. Automatic pricing changes the total as customers choose each item.</div></div>` : ""}
      <label class="slot" style="cursor:pointer;gap:10px;margin:7px 0 16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${item.show_price_on_menu !== false ? "checked" : ""} onchange="onEditField('show_price_on_menu',this.checked)"><span><b>Show starting price on menu card</b><br><span class="hint" style="margin:0;">For Mix &amp; Matcha this appears as “From ${money(item.is_bundle ? bundleDisplayFromPriceAdmin(item) : Number(item.price || 0))}”.</span></span></label>
      ${item.is_bundle && item.bundle_pricing_mode === "sum_selected" ? `<div class="field"><label>Menu “From” price (${escapeHtml(astate.settingsDraft?.store_currency || "SGD")})</label><input type="number" min="0" step="0.01" value="${item.bundle_display_from_price ?? ""}" placeholder="${bundleStartingPriceAdmin(item).toFixed(2)}" oninput="onEditField('bundle_display_from_price',this.value)"><div class="hint" style="text-align:left;margin-top:5px;">Display only. This does not change individual drink prices or the final calculated total.</div></div>` : ""}
      ${item.is_bundle ? `<label class="slot" style="cursor:pointer;gap:10px;margin:7px 0 16px;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${item.bundle_show_choice_prices === true ? "checked" : ""} onchange="onEditField('bundle_show_choice_prices',this.checked)"><span><b>Show individual drink prices</b><br><span class="hint" style="margin:0;">Turn this off to hide prices beside Drink 1 and Drink 2. Customers will see the final total only after completing both choices.</span></span></label>` : ""}
      ${window.SLOW_STUDIO_DEMO_MODE ? "" : `<div class="divider"></div><div class="display" style="font-size:18px;margin-bottom:10px">Malaysia · MYR</div>
      <label class="slot" style="cursor:pointer;gap:10px;margin:7px 0 14px"><input type="checkbox" style="width:auto" ${item.malaysia_available === true ? "checked" : ""} onchange="onEditField('malaysia_available',this.checked);render()"><span><b>Available in Malaysia</b><br><span class="hint" style="margin:0">This does not change Singapore availability or SGD prices.</span></span></label>
      ${item.malaysia_available === true ? `<div class="field"><label>${item.is_bundle && item.bundle_pricing_mode === "sum_selected" ? "MYR base price / service fee (optional)" : "Malaysia selling price (MYR)"}</label><input type="number" min="0" step="0.01" value="${item.myr_price ?? ""}" placeholder="0.00" oninput="onEditField('myr_price',this.value)"></div>${item.is_bundle && item.bundle_pricing_mode === "sum_selected" ? `<div class="field"><label>Malaysia menu “From” price (MYR)</label><input type="number" min="0" step="0.01" value="${item.bundle_myr_display_from_price ?? ""}" placeholder="10.00" oninput="onEditField('bundle_myr_display_from_price',this.value)"><div class="hint" style="text-align:left;margin-top:5px">Display only. The final MYR total still follows the MYR price of each selected drink.</div></div>` : ""}` : ""}`}
      <div class="field"><label>Customisation shown for this drink</label><div class="hint" style="text-align:left;margin:0 0 7px;">Tick only the options that apply. Unticked groups will not appear to customers.</div>${astate.optionGroups.filter((group) => group.is_visible !== false).map((group) => `<label class="slot" style="cursor:pointer;gap:10px;margin:7px 0;"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${(item.enabled_option_group_ids || []).map(String).includes(String(group.id)) ? "checked" : ""} onchange="toggleProductOptionGroup('${group.id}',this.checked)"><span>${escapeHtml(group.name)}</span></label>`).join("")}</div>
      ${item.is_bundle ? `<div class="field"><label>Products customers can choose</label><div class="hint" style="text-align:left;margin:0 0 7px;">Tick each eligible drink. SGD and MYR choice prices are separate; leaving an override blank follows that product’s own country price.</div>${astate.menu.filter((product) => String(product.id) !== String(item.id) && !product.is_bundle).map((product) => { const selected = Array.isArray(item.bundle_product_ids) && item.bundle_product_ids.map(String).includes(String(product.id)); const override = item.bundle_option_prices && Object.prototype.hasOwnProperty.call(item.bundle_option_prices,String(product.id)) ? item.bundle_option_prices[String(product.id)] : ""; const myrOverride = item.bundle_myr_option_prices && Object.prototype.hasOwnProperty.call(item.bundle_myr_option_prices,String(product.id)) ? item.bundle_myr_option_prices[String(product.id)] : ""; return `<div class="slot bundle-admin-choice"><input type="checkbox" style="width:auto;accent-color:#4B5D3A;" ${selected ? "checked" : ""} onchange="toggleBundleProduct('${product.id}',this.checked);render()"><span>${escapeHtml(product.name)}<br><span class="hint" style="margin:0;">SGD ${Number(product.discount_price || product.price || 0).toFixed(2)}${product.myr_price != null ? ` · MYR ${Number(product.myr_price).toFixed(2)}` : ""}</span></span>${item.bundle_pricing_mode === "sum_selected" && selected ? `<label><small>SGD</small><input type="number" min="0" step="0.01" value="${escapeHtml(override)}" placeholder="${Number(product.discount_price || product.price).toFixed(2)}" aria-label="SGD Mix and Match price for ${escapeHtml(product.name)}" oninput="setBundleOptionPrice('${product.id}',this.value)"></label><label><small>MYR</small><input type="number" min="0" step="0.01" value="${escapeHtml(myrOverride)}" placeholder="${Number(product.myr_price || 0).toFixed(2)}" aria-label="MYR Mix and Match price for ${escapeHtml(product.name)}" oninput="setBundleMyrOptionPrice('${product.id}',this.value)"></label>` : `<span></span><span></span>`}</div>`; }).join("")}</div>` : ""}
      <div class="field" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="avail-check" ${item.is_available ? "checked" : ""} onchange="onEditField('is_available', this.checked)" style="width:auto;">
        <label style="margin:0;" for="avail-check">Available on menu</label>
      </div>
      <div class="hint" style="text-align:left;margin-bottom:0;">Visible items show on the customer ordering page. Hidden items stay saved in your catalogue.</div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn-secondary" onclick="cancelEdit()">Cancel</button>
        <button class="btn-primary" id="save-btn" onclick="saveMenuItem()">Save</button>
      </div>
    </div>
  </div>`;
}

function renderOfflineOrderEditor() {
  const d=astate.offlineOrderDraft; const points=Array.isArray(astate.settings?.collection_points)?astate.settings.collection_points:[];
  const subtotal=(d.items||[]).reduce((sum,row)=>sum+Number(row.quantity||0)*Number(row.unit_price||0),0);
  return `<div class="overlay"><div class="overlay-card" style="max-width:720px;max-height:88vh;overflow-y:auto"><div class="display overlay-title" style="font-size:20px">Create offline order</div><div class="hint" style="text-align:left;margin:0 0 14px">Use for influencer tasting, complimentary drinks, replacements or a paid walk-in sale. Inventory is still deducted.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Name / contact</label><input value="${escapeHtml(d.customer_name)}" oninput="astate.offlineOrderDraft.customer_name=this.value"></div><div class="field"><label>Phone (optional)</label><input value="${escapeHtml(d.customer_phone)}" oninput="astate.offlineOrderDraft.customer_phone=this.value"></div><div class="field"><label>Date</label><input type="date" value="${escapeHtml(d.collection_date)}" oninput="astate.offlineOrderDraft.collection_date=this.value"></div><div class="field"><label>Time</label><input value="${escapeHtml(d.collection_time)}" placeholder="11:30 AM" oninput="astate.offlineOrderDraft.collection_time=this.value"></div><div class="field"><label>Collection point</label><select onchange="astate.offlineOrderDraft.collection_point=this.value"><option value="">Not specified</option>${points.map(point=>`<option ${d.collection_point===point?"selected":""}>${escapeHtml(point)}</option>`).join("")}</select></div><div class="field"><label>Reason</label><select onchange="offlineOrderField('offline_reason',this.value)">${[["influencer_tasting","Influencer tasting"],["complimentary","Complimentary"],["replacement","Replacement"],["manual_sale","Offline paid sale"],["other","Other"]].map(([v,l])=>`<option value="${v}" ${d.offline_reason===v?"selected":""}>${l}</option>`).join("")}</select></div></div><label class="slot" style="margin:4px 0 16px"><input type="checkbox" style="width:auto" ${d.counts_as_sale?"checked":""} onchange="offlineOrderField('counts_as_sale',this.checked)"><span><b>Count as sales revenue</b><br><span class="hint" style="margin:0">Leave off for free tasting, complimentary or replacement orders.</span></span></label><div class="order-top"><b>Products</b><button class="link-btn" onclick="addOfflineOrderItem()">+ Add product</button></div>${(d.items||[]).map((row,index)=>`<div style="display:grid;grid-template-columns:minmax(180px,1fr) 90px 110px auto;gap:8px;align-items:end;margin:9px 0"><div><label>Product</label><select onchange="chooseOfflineProduct(${index},this.value)">${astate.menu.map(p=>`<option value="${p.id}" ${String(p.id)===String(row.product_id)?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}</select></div><div><label>Qty</label><input type="number" min="1" value="${row.quantity}" oninput="offlineItemField(${index},'quantity',this.value)"></div><div><label>Price</label><input type="number" min="0" step=".01" value="${row.unit_price}" oninput="offlineItemField(${index},'unit_price',this.value)"></div><button class="link-danger" onclick="removeOfflineItem(${index})">Remove</button></div>`).join("")}<div class="field"><label>Internal notes</label><textarea rows="2" oninput="astate.offlineOrderDraft.notes=this.value">${escapeHtml(d.notes)}</textarea></div><div class="row bold"><span>${d.counts_as_sale?"Sales total":"Recorded as free / non-revenue"}</span><span>${money(d.counts_as_sale?subtotal:0)}</span></div><div class="btn-row" style="margin-top:15px"><button class="btn-secondary" onclick="closeOfflineOrder()">Cancel</button><button class="btn-primary" id="save-offline-order" onclick="saveOfflineOrder()">Create offline order</button></div></div></div>`;
}

function renderOrderEditor() {
  const order = astate.editingOrder;
  const items = order.order_items || [];
  const subtotal = (items || []).filter((item) => !item._removed).reduce((sum,item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),0);
  const discount = editedOrderDiscount(order, subtotal);
  const editablePoints = [...new Set([...(Array.isArray(astate.settings?.collection_points) ? astate.settings.collection_points : ["Blk 130A","Near Creamier"]), order.collection_point].filter(Boolean))];
  return `<div class="overlay"><div class="overlay-card" style="max-width:720px;max-height:88vh;overflow-y:auto"><div class="display overlay-title" style="font-size:20px">Edit ${escapeHtml(order.order_number || "order")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Customer name</label><input value="${escapeHtml(order.customer_name || "")}" oninput="editOrderField('customer_name',this.value)"></div><div class="field"><label>Phone</label><input value="${escapeHtml(order.customer_phone || "")}" oninput="editOrderField('customer_phone',this.value)"></div><div class="field"><label>Instagram</label><input value="${escapeHtml(order.instagram || "")}" oninput="editOrderField('instagram',this.value)"></div><div class="field"><label>Collection date</label><input type="date" value="${escapeHtml(order.collection_date || "")}" oninput="editOrderField('collection_date',this.value)"></div><div class="field"><label>Collection time</label><input value="${escapeHtml(order.collection_time || "")}" oninput="editOrderField('collection_time',this.value)"></div><div class="field"><label>Collection point</label><select onchange="editOrderField('collection_point',this.value)">${editablePoints.map((point) => `<option value="${escapeHtml(point)}" ${order.collection_point === point ? "selected" : ""}>${escapeHtml(point)}</option>`).join("")}</select></div></div><div class="divider"></div><div class="order-top"><b>Order items</b><button class="link-btn" onclick="addOrderItem()">+ Add item</button></div>${items.map((item,index) => item._removed ? "" : `<div style="border:1px solid #e8ded1;border-radius:13px;padding:12px;margin:10px 0"><div class="field"><label>Product</label><select onchange="chooseOrderItemProduct(${index},this.value)">${astate.menu.map((product) => `<option value="${product.id}" ${String(product.id) === String(item.product_id) ? "selected" : ""}>${escapeHtml(product.name)}</option>`).join("")}</select></div><div style="display:grid;grid-template-columns:1fr 1fr auto;gap:9px;align-items:end"><div class="field" style="margin:0"><label>Quantity</label><input type="number" min="1" value="${Number(item.quantity || 1)}" oninput="editOrderItem(${index},'quantity',this.value)"></div><div class="field" style="margin:0"><label>Unit price ($)</label><input type="number" min="0" step="0.01" value="${Number(item.unit_price || 0)}" oninput="editOrderItem(${index},'unit_price',this.value)"></div><button class="link-danger" onclick="removeOrderItem(${index})">Remove</button></div>${(item.order_item_options || []).length ? `<div class="hint" style="text-align:left;margin-top:8px">Options: ${item.order_item_options.map((option) => escapeHtml(option.option_name)).join(", ")}</div>` : ""}</div>`).join("")}<div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>${order._promoCode ? `<div class="row" style="color:#A36D1E"><span>Promo · ${escapeHtml(order._promoCode)}</span><span>−${money(discount)}</span></div>` : ""}<div class="row bold" style="margin:8px 0 14px"><span>Total</span><span>${money(Math.max(0,subtotal-discount))}</span></div><div class="field"><label>Customer notes</label><textarea rows="3" oninput="editOrderField('notes',this.value)">${escapeHtml(order.notes || "")}</textarea></div><div class="btn-row"><button class="btn-secondary" onclick="closeOrderEditor()">Cancel</button><button class="btn-primary" id="save-edited-order" onclick="saveEditedOrder()">Save order</button></div></div></div>`;
}

function decorateOrderEditorEmail() {
  if (!astate.editingOrder) return;
  const card = document.querySelector(".overlay-card");
  if (!card || card.querySelector('[data-order-email-field="true"]')) return;
  const instagramLabel = [...card.querySelectorAll("label")].find((label) => label.textContent.trim() === "Instagram");
  const instagramField = instagramLabel?.closest(".field");
  if (!instagramField) return;
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  wrapper.dataset.orderEmailField = "true";
  wrapper.innerHTML = `<label>Email</label><input type="email" value="${escapeHtml(astate.editingOrder.customer_email || "")}" placeholder="customer@email.com">`;
  wrapper.querySelector("input").addEventListener("input", (event) => editOrderField("customer_email", event.target.value));
  instagramField.after(wrapper);
}

function render() {
  const app = document.getElementById("app");
  if (!astate.unlocked) { app.innerHTML = renderLogin(); return; }
  if (astate.welcomePending) { app.innerHTML = renderAdminWelcome(); return; }
  if (astate.loading) { app.innerHTML = header("") + `<div class="loading">Loading…</div>`; return; }
  const navGroups = [
    { key:"my_store", label:"My Store", icon:"▣", tabs:[["menu","◇","Products"],["orders","▣","Orders"],["promos","✦","Promos"],["rewards","♧","Rewards"],["inventory","▤","Inventory & cost"],["preparation","☷","Today's prep"],["availability","◷","Availability"]] },
    { key:"customers", label:"Customers & service", icon:"◉", tabs:[["customers","◉","Customers"],["messages","✉",`Messages${unreadMessageCount() ? ` (${unreadMessageCount()})` : ""}`],["notifications","🔔","Notifications"]] },
    { key:"marketing", label:"Marketing", icon:"✦", tabs:[["marketing","✉","Campaigns & contacts"],["reviews","★","Reviews"]] },
    { key:"design", label:"Design", icon:"◈", tabs:[["theme_design","◈","Theme & layout"],["wording","Aa","Fonts & wording"],["checkout_comms","☏","Customer page"],["faq","?","FAQ"],["settings","⚙","Store details"]] },
    { key:"business", label:"Business tools", icon:"◇", tabs:[["wholesale","◇","Wholesale / B2B"],["inspiration","✎","Inspiration"],["team","♙","Team & activity"],...(window.SLOW_STUDIO_DEMO_MODE?[]:[["malaysia","MY","Malaysia workspace"]])] },
  ];
  const navButton = ([tab,icon,label]) => `<button class="admin-nav-child ${astate.tab === tab ? "active" : ""}" onclick="setTab('${tab}')"><span class="nav-icon">${icon}</span><span class="nav-text">${label}</span></button>`;
  const navGroupHtml = navGroups.map((group) => { const contains=group.tabs.some(([tab])=>tab===astate.tab), open=contains || astate.navGroups[group.key] !== false; return `<section class="admin-nav-group ${open ? "open" : ""}"><button class="admin-nav-group-toggle ${contains ? "contains-active" : ""}" onclick="toggleAdminNavGroup('${group.key}')"><span class="nav-icon">${group.icon}</span><span class="nav-text">${group.label}</span><span class="admin-nav-chevron">⌄</span></button><div class="admin-nav-children">${group.tabs.map(navButton).join("")}</div></section>`; }).join("");
  const tabTitle = { analytics:"Analytics report", preparation: "Today's preparation", orders: "Orders", menu: "Products", inventory: "Inventory & food cost", wholesale:"Wholesale / B2B", inspiration:"Inspiration", team:"Team & activity", malaysia:"Malaysia ordering", promos: "Promos", rewards: "Rewards", customers: "Customers", messages: "Messages", reviews: "Reviews", marketing:"Marketing", availability: "Availability", faq: "FAQ", notifications: "Notifications", theme_design: "Theme & design", wording: "Customer wording", checkout_comms: "Checkout & communication", settings: "Store settings" };
  const tabSubtitle = { preparation: "See every paid drink to prepare and print today's list.", orders: "Review payments and edit every customer order.", menu: "Keep your drinks, prices and availability up to date.", inventory: "Track stock and review every product cost in one place.", wholesale:"Manage private B2B products, pricing and suppliers.", inspiration:"Capture, pin and organise private business ideas.", team:"Manage workspace access, F&B roles, activity and regional preferences.", malaysia:"Turn MYR ordering and Touch ’n Go payment on only when you are ready.", promos: "Create discounts customers can use at checkout.", rewards: "Choose a stamp card or points programme for repeat customers.", customers: "See every customer and save private remarks.", messages: "Read and reply to order-linked customer messages.", reviews: "Edit the review experience and moderate verified reviews.", marketing:"Manage checkout consent and your opted-in contact list.", availability: "Choose your pickup window and collection calendar.", faq: "Edit the answers customers see on your ordering page.", notifications: "Choose where you receive new-order alerts.", theme_design: "Choose a theme, then customise colours, fonts and layout in one place.", wording: "Edit the main words customers see across your shop.", checkout_comms: "Control checkout fields, payment wording, chat and reviews.", settings: "Manage your store details, images, contact information and payment details." };
  const page = astate.tab === "dashboard" ? renderDashboardTab() : `
    <div class="admin-top"><div><div class="admin-eyebrow">${escapeHtml(astate.settings?.store_name || "Slow Studio workspace")} · ${DASHBOARD_MARKET === "MY" ? "Malaysia" : "Singapore"}</div><h1 class="tab-page-title">${tabTitle[astate.tab] || "Dashboard"}</h1><p class="tab-page-subtitle">${tabSubtitle[astate.tab] || ""}</p></div><a class="open-shop" href="${ADMIN_CUSTOMER_SHOP_URL}">Open customer shop ↗</a></div>
    <div class="admin-content">
      ${astate.tab === "analytics" ? renderAnalyticsReportTab() : astate.tab === "preparation" ? renderPreparationTab() : astate.tab === "orders" ? renderOrders() : astate.tab === "menu" ? renderMenuTab() : astate.tab === "inventory" ? renderInventoryTab() : astate.tab === "wholesale" ? renderWholesaleTab() : astate.tab === "inspiration" ? renderInspirationTab() : astate.tab === "team" ? renderTeamTab() : astate.tab === "malaysia" ? renderMalaysiaTab() : astate.tab === "promos" ? renderPromosTab() : astate.tab === "rewards" ? renderRewardsTab() : astate.tab === "customers" ? renderCustomersTab() : astate.tab === "messages" ? renderMessagesTab() : astate.tab === "reviews" ? renderReviewsTab() : astate.tab === "marketing" ? renderMarketingTab() : astate.tab === "availability" ? renderAvailabilityTab() : astate.tab === "faq" ? renderFaqTab() : astate.tab === "notifications" ? renderNotificationsTab() : astate.tab === "theme_design" ? renderThemeDesignTab() : astate.tab === "wording" ? renderWordingTab() : astate.tab === "checkout_comms" ? renderCheckoutCommunicationTab() : renderSettingsTab()}
    </div>`;
  app.innerHTML = `
    ${dashboardStyles()}
    <div class="shop-admin theme-${escapeHtml(astate.settingsDraft?.admin_theme || astate.settingsDraft?.system_theme || "zen")} ${(astate.settings?.admin_mobile_nav_position || "left") === "top" ? "mobile-nav-top" : "mobile-nav-left"} ${astate.navCollapsed ? "nav-collapsed" : ""}" style="--admin-primary:${escapeHtml(astate.settingsDraft?.admin_theme_primary || '#4B5D3A')};--admin-bg:${escapeHtml(astate.settingsDraft?.admin_theme_background || '#F3EEE3')};--admin-card:${escapeHtml(astate.settingsDraft?.admin_theme_card || '#FFFFFF')};--admin-text:${escapeHtml(astate.settingsDraft?.admin_theme_text || '#2A2A22')};--admin-on-primary:${escapeHtml(astate.settingsDraft?.admin_theme_background || '#F3EEE3')};--admin-soft:color-mix(in srgb,${escapeHtml(astate.settingsDraft?.admin_theme_primary || '#4B5D3A')} 10%,${escapeHtml(astate.settingsDraft?.admin_theme_card || '#FFFFFF')});--admin-line:color-mix(in srgb,${escapeHtml(astate.settingsDraft?.admin_theme_text || '#2A2A22')} 18%,transparent);--admin-muted:color-mix(in srgb,${escapeHtml(astate.settingsDraft?.admin_theme_text || '#2A2A22')} 66%,transparent);--admin-radius:${(astate.settingsDraft?.admin_theme || 'zen') === 'editorial' ? '0px' : (astate.settingsDraft?.admin_theme || 'zen') === 'retro' ? '7px' : (astate.settingsDraft?.admin_theme || 'zen') === 'threed' ? '24px' : '18px'};--admin-card-shadow:${(astate.settingsDraft?.admin_theme || 'zen') === 'retro' ? '4px 4px 0 var(--admin-text)' : (astate.settingsDraft?.admin_theme || 'zen') === 'threed' ? '0 10px 0 color-mix(in srgb,var(--admin-primary) 18%,transparent),0 17px 28px rgba(45,38,75,.11)' : '0 8px 24px rgba(42,42,34,.06)'};--admin-shadow:0 10px 24px color-mix(in srgb,var(--admin-primary) 25%,transparent);">
      <aside class="admin-side"><button class="admin-collapse-toggle" onclick="toggleAdminNav()" title="${astate.navCollapsed ? "Expand menu" : "Collapse menu"}" aria-label="${astate.navCollapsed ? "Expand menu" : "Collapse menu"}">${astate.navCollapsed ? "›" : "‹"}</button><div class="admin-logo">${(astate.settings && escapeHtml(astate.settings.store_name)) || "Your HBB"}</div><div class="admin-caption">${window.SLOW_STUDIO_DEMO_MODE ? "DEMO · SHOP ADMIN" : "SLOW STUDIO · SHOP ADMIN"}</div><div class="admin-nav-label">MAIN MENU</div><nav class="admin-nav"><button class="admin-nav-root ${astate.tab === "dashboard" ? "active" : ""}" onclick="setTab('dashboard')"><span class="nav-icon">⌂</span><span class="nav-text">Home</span></button>${navGroupHtml}<button class="admin-nav-root ${astate.tab === "analytics" ? "active" : ""}" onclick="setTab('analytics')"><span class="nav-icon">▥</span><span class="nav-text">Analytics Report</span></button></nav><div class="admin-side-bottom">${window.SLOW_STUDIO_DEMO_MODE ? "" : `<a class="slow-studio-link" href="/slow-studio">Slow Studio workspace →</a>`}<button class="link-btn" onclick="logoutAdmin()" aria-label="Sign out"><span class="signout-icon">↪</span> <span class="signout-label">Sign out</span></button></div></aside>
      <main class="admin-main">${!IS_CONFIGURED ? `<div class="setup-banner">Demo mode — connect Supabase in <code>config.js</code> to see real orders and save changes.</div>` : ""}${astate.loadError ? `<div class="setup-banner" style="border-color:#B33;background:#FBEAEA;color:#7a1f1f;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><span>Could not load data: <code>${escapeHtml(astate.loadError)}</code></span><button class="btn-secondary" onclick="refreshDashboard()">Retry</button></div>` : ""}${astate.newMessageAlert ? `<div class="new-order-alert" role="alert"><div><strong>New customer message</strong><span>${escapeHtml(astate.newMessageAlert.orderNumber)} · ${escapeHtml(astate.newMessageAlert.text)}</span></div><div style="display:flex;gap:8px;"><button class="btn-primary" onclick="astate.newMessageAlert=null;setTab('messages')">Open message</button><button class="btn-secondary" onclick="astate.newMessageAlert=null;render()">Dismiss</button></div></div>` : ""}${astate.newOrderAlert ? `<div class="new-order-alert" role="alert"><div><strong>New order received</strong><span>${escapeHtml(astate.newOrderAlert.orderNumber)} · ${escapeHtml(astate.newOrderAlert.customer)} · ${money(astate.newOrderAlert.total)}</span></div><div style="display:flex;gap:8px;"><button class="btn-primary" onclick="setTab('orders')">Open order</button><button class="btn-secondary" onclick="dismissNewOrderAlert()">Dismiss</button></div></div>` : ""}${page}</main>
    </div>
    ${renderEditOverlay()}
  `;
  const adminLogo = document.querySelector(".admin-logo");
  if (adminLogo && !document.querySelector(".slow-studio-badge")) {
    const badge = document.createElement("div");
    badge.className = "slow-studio-badge";
    badge.title = window.SLOW_STUDIO_DEMO_MODE ? "HBB demo" : "Slow Studio workspace";
    badge.setAttribute("aria-label", window.SLOW_STUDIO_DEMO_MODE ? "HBB demo" : "Slow Studio workspace");
    badge.innerHTML = `<img src="lumi-slow-studio.png" alt="">`;
    adminLogo.before(badge);
  }
  decorateOrderEditorEmail();
  if (window.SLOW_STUDIO_DEMO_MODE) {
    const banner=document.querySelector(".setup-banner");
    if(banner) banner.innerHTML=`<b>Complete HBB Demo · ${DASHBOARD_MARKET === "MY" ? "Malaysia · MYR / RM" : "Singapore · SGD"}</b> — full Admin features with sample products, orders, customers and dates stored only in this browser.`;
    const logo=document.querySelector(".admin-logo"); if(logo) logo.textContent=astate.settings?.store_name||"Demo HBB";
  }
  enhanceRewardOrderLinks();
  if (astate.tab === "theme_design" && astate.designTopic === "customise") requestAnimationFrame(updateDesignPreview);
}

if (db) {
  db.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      astate.recoveryMode = true;
      astate.unlocked = false;
      render();
    }
  });
}
render();
if (window.SLOW_STUDIO_DEMO_MODE) { astate.unlocked=true; loadAll(); }
else checkAdminSession();
