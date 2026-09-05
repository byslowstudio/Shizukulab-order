(async function () {
  const revealWelcome = () => document.body.classList.remove("welcome-loading");
  const fontStacks = {
    fraunces: "'Fraunces','Noto Serif JP',Georgia,serif",
    noto_serif_jp: "'Noto Serif JP','Fraunces',Georgia,serif",
    work_sans: "'Work Sans','Noto Sans JP',Arial,sans-serif",
    noto_sans_jp: "'Noto Sans JP','Work Sans',Arial,sans-serif",
    georgia: "Georgia,'Noto Serif JP','Times New Roman',serif",
  };
  const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(navigator.userAgent || "");
  const browserNotice = document.getElementById("inapp-browser-notice");
  const showBrowserNotice = (settings = {}) => {
    if (!browserNotice || !isInAppBrowser || settings.show_instagram_browser_notice === false) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem("shizuku-inapp-notice-dismissed") === "1"; } catch (_) {}
    if (dismissed) return;
    const noticeLogo = document.getElementById("inapp-browser-logo");
    if (settings.logo_url && noticeLogo) noticeLogo.src = settings.logo_url;
    document.getElementById("inapp-browser-copy")?.addEventListener("click", async (event) => {
      try { await navigator.clipboard.writeText(window.location.href); event.currentTarget.textContent = "Link copied ✓"; }
      catch (_) { window.prompt("Copy this store link", window.location.href); }
    });
    document.getElementById("inapp-browser-continue")?.addEventListener("click", () => {
      browserNotice.hidden = true;
      try { sessionStorage.setItem("shizuku-inapp-notice-dismissed", "1"); } catch (_) {}
    });
    browserNotice.hidden = false;
  };
  if (typeof IS_CONFIGURED === "undefined" || !IS_CONFIGURED || typeof db === "undefined") { showBrowserNotice(); revealWelcome(); return; }
  try {
    const { data, error } = await db.from("store_settings").select("*").limit(1).maybeSingle();
    if (error || !data) return;
    if (data.website_visibility === "hidden") {
      const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
      document.body.className = "";
      document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:${safe(data.theme_primary_color || "#4B5D3A")};color:${safe(data.theme_background_color || "#F3EEE3")};text-align:center;font-family:Work Sans,Arial,sans-serif"><article style="max-width:580px"><div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.75">${safe(data.store_name || "Shizuku Lab")}</div><h1 style="font:700 clamp(42px,8vw,72px)/1.05 Fraunces,Georgia,serif;margin:18px 0">${safe(data.website_hidden_title || "We’ll be back soon.")}</h1><p style="font-size:17px;line-height:1.7;opacity:.82">${safe(data.website_hidden_message || "We’re preparing our next opening. Please check back again soon.")}</p><div style="margin-top:32px;font-size:11px;letter-spacing:.08em;opacity:.6">Powered by Slow Studio</div></article></main>`;
      return;
    }
    showBrowserNotice(data);
    const app = document.getElementById("welcome-app");
    const logoFrame = app.querySelector(".welcome-logo-frame");
    const logo = app.querySelector(".welcome-logo");
    const title = app.querySelector(".welcome-title");
    const subtitle = app.querySelector(".welcome-sub");
    const copy = app.querySelector(".welcome-copy");
    const orderButton = app.querySelector(".welcome-enter");
    const trackButton = app.querySelector(".welcome-track");
    const loyaltyButton = app.querySelector(".welcome-loyalty");
    const poweredBy = app.querySelector("#welcome-powered-by");
    ["zen","korean","editorial","retro","threed","sakura","coastal","cocoa","matcha_modern","japanese_paper","strawberry_milk","midnight_studio","nordic_cafe","studio_grid"].forEach((name) => app.classList.toggle(`theme-${name}`, (data.ordering_theme || data.system_theme || "zen") === name));
    app.style.fontFamily = fontStacks[data.welcome_body_font] || fontStacks.work_sans;
    title.style.fontFamily = fontStacks[data.welcome_title_font] || fontStacks.fraunces;
    title.style.fontSize = `${Math.max(28, Math.min(64, Number(data.welcome_title_size || 39)))}px`;
    copy.style.fontSize = `${Math.max(12, Math.min(22, Number(data.theme_body_size || 14)))}px`;
    if (data.logo_url) logo.src = data.logo_url;
    const circleSize = Math.max(56, Math.min(220, Number(data.welcome_logo_circle_size || data.logo_circle_size || 100)));
    const imageScale = Math.max(0.55, Math.min(2.4, Number(data.welcome_logo_image_scale || data.logo_image_scale || 1)));
    const imageX = Math.max(-45, Math.min(45, Number(data.welcome_logo_image_x || 0)));
    const imageY = Math.max(-45, Math.min(45, Number(data.welcome_logo_image_y || 0)));
    logoFrame.style.width = `${circleSize}px`;
    logoFrame.style.height = `${circleSize}px`;
    logo.style.transform = `translate(${imageX}%, ${imageY}%) scale(${imageScale})`;
    logoFrame.dataset.position = ["left", "center", "right"].includes(data.welcome_logo_position) ? data.welcome_logo_position : "center";
    if (data.welcome_title || data.store_name) { title.textContent = data.welcome_title || data.store_name; document.title = `Welcome · ${data.welcome_title || data.store_name}`; }
    if (data.welcome_subtitle) subtitle.textContent = data.welcome_subtitle;
    if (data.welcome_copy) copy.textContent = data.welcome_copy;
    if (data.welcome_order_button_text) orderButton.textContent = data.welcome_order_button_text;
    if (data.welcome_track_button_text && trackButton) trackButton.textContent = data.welcome_track_button_text;
    if (data.welcome_loyalty_button_text && loyaltyButton) loyaltyButton.textContent = data.welcome_loyalty_button_text;
    if (poweredBy) {
      if (data.show_powered_by === false) poweredBy.hidden = true;
      else {
        const poweredText = data.powered_by_text || "Powered by Slow Studio";
        const poweredUrl = /^https?:\/\//i.test(String(data.powered_by_url || "").trim()) ? String(data.powered_by_url).trim() : "";
        poweredBy.innerHTML = "";
        const element = document.createElement(poweredUrl ? "a" : "span");
        element.textContent = poweredText;
        if (poweredUrl) { element.href = poweredUrl; element.target = "_blank"; element.rel = "noopener noreferrer"; }
        poweredBy.appendChild(element);
      }
    }
    if (data.website_url) {
      const link = document.createElement("a");
      link.className = "welcome-website";
      link.href = data.website_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = data.welcome_website_button_text || "Visit Shizuku Lab website ↗";
      app.querySelector(".welcome-actions").appendChild(link);
    }
    const announcement = document.getElementById("welcome-announcement");
    const announcementTitle = document.getElementById("welcome-announcement-title");
    const announcementMessage = document.getElementById("welcome-announcement-message");
    const announcementPromo = document.getElementById("welcome-announcement-promo");
    const announcementCode = document.getElementById("welcome-announcement-code");
    const announcementCopy = document.getElementById("welcome-announcement-copy");
    const announcementContinue = document.getElementById("welcome-announcement-continue");
    const announcementClose = document.getElementById("welcome-announcement-close");
    const noticeTitle = String(data.announcement_title || "").trim();
    const noticeMessage = String(data.announcement_message || "").trim();
    const noticeCode = String(data.announcement_promo_code || "").trim().toUpperCase();
    const today = new Date().toLocaleDateString("en-CA");
    const noticeFingerprint = `${today}|${noticeTitle}|${noticeMessage}|${noticeCode}`;
    let seenNotice = "";
    try { seenNotice = localStorage.getItem("shizuku-welcome-announcement") || ""; } catch (_) {}
    if (announcement && data.show_announcement && (noticeTitle || noticeMessage || noticeCode) && seenNotice !== noticeFingerprint) {
      announcementTitle.textContent = noticeTitle || "A little update";
      announcementMessage.textContent = noticeMessage;
      announcementMessage.hidden = !noticeMessage;
      announcementCode.textContent = noticeCode;
      announcementPromo.hidden = !noticeCode;
      // Keep the promo area completely out of the layout when no code is set.
      // The inline display state also protects mobile browsers using older cached CSS.
      announcementPromo.style.display = noticeCode ? "flex" : "none";
      announcementCopy.disabled = !noticeCode;
      announcementContinue.textContent = String(data.announcement_button_text || "Continue").trim() || "Continue";
      const dismiss = () => {
        announcement.hidden = true;
        try { localStorage.setItem("shizuku-welcome-announcement", noticeFingerprint); } catch (_) {}
      };
      announcementClose.addEventListener("click", dismiss);
      announcementContinue.addEventListener("click", dismiss);
      announcement.addEventListener("click", (event) => { if (event.target === announcement) dismiss(); });
      announcementCopy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(noticeCode); announcementCopy.textContent = "Copied"; }
        catch (_) { announcementCopy.textContent = noticeCode; }
      });
      announcement.hidden = false;
    }
  } catch (_) { /* The order button remains available even when settings are unavailable. */ }
  finally { revealWelcome(); }
})();
