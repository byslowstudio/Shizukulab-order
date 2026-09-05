// Fill these in from Supabase → Project Settings → API
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" / "publishable" key
// (NOT the service_role key)
const SUPABASE_URL = "https://ohgfmmvsxckayamlzdlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6l6Jp0etNJyGUgFc1UUg4w_FfJnLZd1";
// The only email address allowed to open the real shop dashboard.
// This Gmail is the only account allowed to use the admin dashboard.
// sitting in the public website code.
const ADMIN_EMAIL = "tinghuioh29@gmail.com";
// Store name, address, hours and PayNow information now live in Supabase
// (store_settings table), so you can edit them from the Settings tab
// in admin.html without touching this file.
// FAQ shown at the bottom of the ordering page.
// Edit freely — question, then answer.
const STORE_FAQ = [
  {
    q: "How did Shizuku Lab begin?",
    a: `Shizuku started with a little love for matcha shared between me and my family. What began as making matcha at home soon became something I wanted to share with more people — good matcha that feels affordable, approachable, and genuinely enjoyable.
Today, Shizuku is still a small home-based matcha studio, where every cup is freshly whisked with the hope of making a good cup of matcha a little easier to enjoy — crafted one cup at a time.`
  },
  {
    q: "How does ordering work?",
    a: "Browse the menu, choose your drink, pick a pickup slot at checkout, then pay via PayNow. Once we confirm your payment, your order is set."
  },
  {
    q: "Where do I collect my order?",
    a: "Self-collection is at Toa Payoh Lorong 1, Singapore. Our exact collection address will be shared after your order has been confirmed."
  },
  {
    q: "When can I place an order?",
    a: "Shizuku Lab is available by pre-order only. New slots will open every Sunday at 6pm, and orders close on Friday at 4pm."
  },
  {
    q: "How do I pay?",
    a: "PayNow is available during checkout. The amount and payment reference are shown for you."
  },
  {
    q: "What happens if I'm late for pickup?",
    a: "Do message us on Instagram if you're late — we'll do our best to hold your order, but freshly whisked matcha is best collected on time."
  },
  {
    q: "Can I cancel or amend my order?",
    a: `As each drink is prepared in limited quantities and made specifically for your order, cancellations, refunds and exchanges are not available once payment has been made.
If you need to change your collection time, please contact us at least 24 hours in advance. We'll do our best to accommodate your request.`
  },
  {
    q: "Can I customise the sweetness?",
    a: "Yes, you may choose from the available options before your drink is added to your cart."
  },
  {
    q: "Do your drinks contain dairy?",
    a: "No, our lattes are made with oat milk by default."
  }
];
const IS_CONFIGURED =
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const db = IS_CONFIGURED
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
