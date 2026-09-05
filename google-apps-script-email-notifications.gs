/**
 * Shizuku Lab email notifications
 * Deploy as a Google Apps Script web app: Execute as Me · Access Anyone.
 */
const RECIPIENT_EMAIL = "tinghuioh29@gmail.com";
const SHARED_SECRET = "REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const suppliedSecret = payload.secret || (e && e.parameter && e.parameter.key) || "";
    if (suppliedSecret !== SHARED_SECRET) return jsonResponse({ ok: false, error: "Unauthorized" });

    if (payload.event === "marketing_campaign") return sendMarketingCampaign(payload);

    const incomingEventName = payload.event || "payment_proof";
    const eventName = incomingEventName === "order_ready"
      ? "order_ready_for_collection"
      : incomingEventName;
    const order = payload.order || payload || {};
    const orderNumber = text(order.order_number || order.id || payload.order_number || "Unknown order");
    const customerName = text(order.customer_name || payload.customer_name);
    const customerPhone = text(order.customer_phone || payload.customer_phone);
    const total = Number(order.total || 0);
    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemLines = items.length ? items.map(function (item) {
      const options = Array.isArray(item.options) && item.options.length
        ? " (" + item.options.map(function (option) { return text(option.option_name); }).join(", ") + ")" : "";
      return "• " + Number(item.quantity || 1) + " × " + text(item.product_name || "Item") + options;
    }).join("\n") : "• View order items in Admin";

    let title, intro, subject, accent, rows, action;
    if (eventName === "email_unsubscribed") {
      title = "Customer unsubscribed from email";
      subject = "Email unsubscribed · " + text(payload.customer_email);
      intro = "A customer used the unsubscribe link. Admin has already marked this email as unsubscribed.";
      accent = "#B33333";
      rows = [["Customer", customerName || "Customer"], ["Email", text(payload.customer_email)], ["Market", text(payload.market_code || "SG")]];
      action = "They will no longer receive marketing, confirmation or ready-for-collection emails unless they opt in again.";
    } else if (eventName === "customer_message") {
      title = "New customer message";
      subject = "New customer message · " + orderNumber;
      intro = "A customer wrote to Shizuku Lab from their verified order page.";
      accent = "#ef7138";
      rows = [
        ["Order", orderNumber], ["Customer", customerName], ["Phone", customerPhone],
        ["Message", text(payload.message_text)]
      ];
      action = "Open Admin → Messages to read the conversation and reply.";
    } else if (eventName === "new_order") {
      title = "New order placed";
      subject = "New order · " + orderNumber + " · $" + total.toFixed(2);
      intro = "A new Shizuku Lab order has been placed.";
      accent = "#a36d1e";
      rows = orderRows(order, orderNumber, customerName, customerPhone, total);
      action = "Open Shizuku Lab Admin to review the new order.";
    } else if (eventName === "payment_rejected") {
      title = "Payment proof rejected";
      subject = "Payment proof needs attention · " + orderNumber;
      intro = "The payment screenshot was rejected and the customer has been asked to upload a new one.";
      accent = "#B33333";
      rows = orderRows(order, orderNumber, customerName, customerPhone, total);
      rows.push(["Reason", text(order.payment_rejection_reason || payload.payment_rejection_reason)]);
      action = "The customer can upload a new screenshot from Track Order.";
    } else if (eventName === "order_confirmed") {
      title = "Order confirmed";
      subject = "Order confirmed · " + orderNumber;
      intro = "Payment has been verified and the order is confirmed.";
      accent = "#4B5D3A";
      rows = orderRows(order, orderNumber, customerName, customerPhone, total);
      action = "Prepare this order for its scheduled collection time.";
    } else if (eventName === "order_ready_for_collection") {
      title = "Order ready for collection";
      subject = "Order ready for collection · " + orderNumber;
      intro = "The customer has been notified that this order is ready for collection.";
      accent = "#4B5D3A";
      rows = orderRows(order, orderNumber, customerName, customerPhone, total);
      action = "The order is ready at the selected collection point.";
    } else {
      title = "Payment proof received";
      subject = "Payment proof received · " + orderNumber;
      intro = "A customer uploaded a PayNow payment screenshot for review.";
      accent = "#4B5D3A";
      rows = orderRows(order, orderNumber, customerName, customerPhone, total);
      rows.push(["Payment", text(order.payment_status || "submitted")]);
      action = "Open Shizuku Lab Admin to verify the payment and confirm the order.";
    }

    const plainRows = rows.map(function (row) { return row[0] + ": " + row[1]; }).join("\n");
    const body = [title, "", intro, "", plainRows, items.length ? "\nItems\n" + itemLines : "", "", action].filter(Boolean).join("\n");
    const htmlBody = emailCard(title, intro, orderNumber, rows, items, action, accent);

    if (payload.send_owner !== false) {
      GmailApp.sendEmail(RECIPIENT_EMAIL, subject, body, {
        name: "Shizuku Lab Orders",
        htmlBody: htmlBody
      });
    }
    sendCustomerUpdate(eventName, payload, order, orderNumber, customerName, total, items);
    return jsonResponse({ ok: true, event: eventName });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function sendCustomerUpdate(eventName, payload, order, orderNumber, customerName, total, items) {
  if (payload.send_customer === false) return;
  // Placing an order alone never sends a customer email. The first customer
  // email is sent only after payment proof has been submitted.
  if (eventName === "new_order") return;
  const customerEmail = String(order.customer_email || payload.customer_email || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return;
  let title, intro, subject, action, accent = "#4B5D3A";
  const templateValues = {
    customer_name: customerName,
    order_number: orderNumber,
    date: text(order.collection_date),
    time: text(order.collection_time),
    collection_point: text(order.collection_point),
    total: "$" + total.toFixed(2)
  };
  if (eventName === "payment_proof") {
    title = fillTemplate(payload.payment_review_email_heading_template || "Hi {customer_name}, we received your order", templateValues);
    subject = fillTemplate(payload.payment_review_email_subject_template || "We received your order · {order_number}", templateValues);
    intro = fillTemplate(payload.payment_review_email_message_template || "Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed.", templateValues);
    action = "We’ll email you again after your payment has been reviewed and your order is confirmed.";
  } else if (eventName === "order_confirmed") {
    title = fillTemplate(payload.customer_email_heading_template || "Your order is confirmed", templateValues);
    subject = fillTemplate(payload.customer_email_subject_template || "Your order is confirmed · {order_number}", templateValues);
    intro = fillTemplate(payload.customer_email_message_template || "Thank you for ordering with Shizuku Lab. We look forward to preparing your order.", templateValues);
    action = "Collection: " + text(order.collection_date) + " · " + text(order.collection_time) + " · " + text(order.collection_point);
  } else if (eventName === "payment_rejected") {
    title = "Please upload a new payment screenshot"; subject = "Payment update needed · " + orderNumber;
    intro = text(order.payment_rejection_reason || payload.payment_rejection_reason || "The screenshot was unclear.");
    action = "Open Track Order with your order number and phone, then choose Upload a new screenshot.";
    accent = "#B33333";
  } else if (eventName === "order_ready_for_collection") {
    if (payload.customer_ready_email_enabled === false) return;
    title = fillTemplate(payload.customer_ready_email_heading_template || "Your order is ready for collection", templateValues);
    subject = fillTemplate(payload.customer_ready_email_subject_template || "Your order is ready for collection · {order_number}", templateValues);
    intro = fillTemplate(payload.customer_ready_email_message_template || "Your order is ready for collection. We look forward to seeing you at your selected pickup time.", templateValues);
    action = "Collection: " + text(order.collection_date) + " · " + text(order.collection_time) + " · " + text(order.collection_point);
  } else return;
  const rows = [["Order",orderNumber],["Customer",customerName],["Amount","$" + total.toFixed(2)],["Pickup",text(order.collection_date) + " · " + text(order.collection_time)],["Collection point",text(order.collection_point)]];
  const unsubscribeUrl = String(payload.unsubscribe_url || "").trim();
  const preferenceText = unsubscribeUrl ? "\n\nEmail preferences: Unsubscribing also stops order confirmation and ready-for-collection email notifications. " + unsubscribeUrl : "";
  const preferenceHtml = unsubscribeUrl ? '<div style="max-width:620px;margin:0 auto;padding:14px 28px 24px;color:#8a8278;font:12px/1.5 Arial,sans-serif">Email preferences: <a href="' + html(unsubscribeUrl) + '" style="color:#6b6258">Unsubscribe</a>. Unsubscribing also stops order confirmation and ready-for-collection email notifications.</div>' : "";
  const body = [title,"",intro,"","Order: " + orderNumber,"Amount: $" + total.toFixed(2),"",action].join("\n") + preferenceText;
  GmailApp.sendEmail(customerEmail, subject, body, { name:"Shizuku Lab Orders", htmlBody:emailCard(title,intro,orderNumber,rows,items,action,accent) + preferenceHtml });
}

function fillTemplate(template, values) {
  return String(template || "").replace(/\{(customer_name|order_number|date|time|collection_point|total)\}/g, function (_, key) {
    return String(values[key] == null ? "" : values[key]);
  });
}

function sendMarketingCampaign(payload) {
  const customerEmail = String(payload.customer_email || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return jsonResponse({ ok:false, error:"Invalid customer email" });
  const customerName = text(payload.customer_name || "there");
  const subject = String(payload.marketing_email_subject || "Shizuku Lab update").replace(/\{customer_name\}/g, customerName);
  const message = String(payload.marketing_email_body || "Thank you for supporting Shizuku Lab ♡").replace(/\{customer_name\}/g, customerName);
  const attachments = [];
  const attachmentUrl = String(payload.attachment_url || "").trim();
  if (attachmentUrl) {
    const response = UrlFetchApp.fetch(attachmentUrl, { muteHttpExceptions:true, followRedirects:true });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      let blob = response.getBlob();
      if (payload.attachment_name) blob = blob.setName(String(payload.attachment_name));
      attachments.push(blob);
    }
  }
  const paragraphs = message.split(/\n{2,}/).map(function (part) {
    return '<p style="font-size:15px;line-height:1.65;color:#4f4a43;margin:0 0 18px">' + html(part).replace(/\n/g,"<br>") + '</p>';
  }).join("");
  const unsubscribeUrl = String(payload.unsubscribe_url || "").trim();
  const preferenceHtml = unsubscribeUrl ? '<div style="padding:14px 28px;border-top:1px solid #eee5da;color:#8a8278;font-size:11px"><a href="' + html(unsubscribeUrl) + '" style="color:#6b6258">Unsubscribe from all emails</a><br>This also stops order confirmation and ready-for-collection email notifications.</div>' : "";
  const htmlBody = '<div style="margin:0;padding:28px 12px;background:#f5efe6;font-family:Arial,sans-serif;color:#28261f"><div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #e5d9ca;border-radius:20px;overflow:hidden"><div style="height:7px;background:#4B5D3A"></div><div style="padding:30px 28px"><div style="font-size:11px;font-weight:800;letter-spacing:.16em;color:#4B5D3A">SHIZUKU LAB</div><h1 style="font-family:Georgia,serif;font-size:27px;line-height:1.15;margin:12px 0 24px">' + html(subject) + '</h1>' + paragraphs + '</div>' + preferenceHtml + '<div style="padding:14px 28px;border-top:1px solid #eee5da;color:#8a8278;font-size:11px">Shizuku Lab · Crafted drop by drop<br>Powered by Slow Studio</div></div></div>';
  const options = { name:"Shizuku Lab", htmlBody:htmlBody };
  if (attachments.length) options.attachments = attachments;
  GmailApp.sendEmail(customerEmail, subject, message + (unsubscribeUrl ? "\n\nUnsubscribe from all emails (including order notifications): " + unsubscribeUrl : "") + "\n\nPowered by Slow Studio", options);
  return jsonResponse({ ok:true, event:"marketing_campaign" });
}

function orderRows(order, orderNumber, customerName, customerPhone, total) {
  return [
    ["Order", orderNumber], ["Customer", customerName], ["Phone", customerPhone],
    ["Amount", "$" + total.toFixed(2)],
    ["Pickup", text(order.collection_date) + " · " + text(order.collection_time)],
    ["Collection point", text(order.collection_point)], ["Notes", text(order.notes)]
  ];
}

function customerSampleOrder() {
  return {
    order_number: "SL-SAMPLE",
    customer_name: "Shermin",
    customer_phone: "8686 4403",
    customer_email: RECIPIENT_EMAIL,
    collection_date: "2026-08-30",
    collection_time: "11:30 AM",
    collection_point: "Sample collection point",
    total: 13.80
  };
}

function customerSampleItems() {
  return [
    { product_name: "Ichigo Matcha Latte", quantity: 1 },
    { product_name: "Strawberry Milk", quantity: 1 }
  ];
}

/** Run manually to preview the first customer email (payment under review). */
function sendPaymentReviewSampleEmail() {
  const order = customerSampleOrder();
  sendCustomerUpdate("payment_proof", {
    customer_email: order.customer_email,
    payment_review_email_subject_template: "We received your order · {order_number}",
    payment_review_email_heading_template: "Hi {customer_name}, we received your order",
    payment_review_email_message_template: "Your payment screenshot has been submitted for review. We’ll email you again once your order is confirmed."
  }, order, order.order_number, order.customer_name, order.total, customerSampleItems());
}

/** Run manually to preview the second customer email (order confirmed). */
function sendConfirmationSampleEmail() {
  const order = customerSampleOrder();
  sendCustomerUpdate("order_confirmed", {
    customer_email: order.customer_email,
    customer_email_subject_template: "Your order is confirmed · {order_number}",
    customer_email_heading_template: "Your order is confirmed",
    customer_email_message_template: "Thank you for ordering with Shizuku Lab. We look forward to preparing your order."
  }, order, order.order_number, order.customer_name, order.total, customerSampleItems());
}

/** Run manually to preview the third customer email (ready for collection). */
function sendReadyForCollectionSampleEmail() {
  const order = customerSampleOrder();
  sendCustomerUpdate("order_ready_for_collection", {
    customer_email: order.customer_email,
    customer_ready_email_enabled: true,
    customer_ready_email_subject_template: "Your order is ready for collection · {order_number}",
    customer_ready_email_heading_template: "Your order is ready for collection",
    customer_ready_email_message_template: "Your order is ready for collection. We look forward to seeing you at your selected pickup time."
  }, order, order.order_number, order.customer_name, order.total, customerSampleItems());
}

/** Backwards-compatible customer sample: sends all three customer stages. */
function sendCustomerSampleEmail() {
  sendPaymentReviewSampleEmail();
  sendConfirmationSampleEmail();
  sendReadyForCollectionSampleEmail();
}

/** Legacy sample kept for older Apps Script dropdowns. */
function sendLegacyCustomerSampleEmail() {
  const order = {
    order_number: "SL-SAMPLE",
    customer_name: "Shermin",
    customer_phone: "8686 4403",
    customer_email: "tinghuioh29@gmail.com",
    collection_date: "2026-08-30",
    collection_time: "11:30 AM",
    collection_point: "Sample collection point",
    total: 13.80
  };
  const items = [
    { product_name: "Ichigo Matcha Latte", quantity: 1 },
    { product_name: "Strawberry Milk", quantity: 1 }
  ];
  sendCustomerUpdate("order_confirmed", {
    customer_email: order.customer_email,
    customer_email_subject_template: "Order received · {order_number}",
    customer_email_heading_template: "Hi {customer_name}, we’ve received your order",
    customer_email_message_template: "Thank you for ordering with Shizuku Lab. Here is a copy of your order."
  }, order, order.order_number, order.customer_name, order.total, items);
}

/** Run manually when you want to preview the owner's new-order notification. */
function sendOwnerSampleEmail() {
  const order = {
    order_number: "SL-SAMPLE",
    customer_name: "Sample Customer",
    customer_phone: "9000 0000",
    collection_date: "2026-08-30",
    collection_time: "11:30 AM",
    collection_point: "Sample collection point",
    notes: "Less ice, please.",
    total: 13.80
  };
  const items = [
    { product_name: "Ichigo Matcha Latte", quantity: 1 },
    { product_name: "Strawberry Milk", quantity: 1 }
  ];
  const title = "New order placed";
  const intro = "A new Shizuku Lab order has been placed.";
  const subject = "New order · " + order.order_number + " · $" + order.total.toFixed(2);
  const rows = orderRows(order, order.order_number, order.customer_name, order.customer_phone, order.total);
  const itemLines = items.map(function (item) {
    return "• " + Number(item.quantity || 1) + " × " + text(item.product_name || "Item");
  }).join("\n");
  const action = "Open Shizuku Lab Admin to review the new order.";
  const plainRows = rows.map(function (row) { return row[0] + ": " + row[1]; }).join("\n");
  const body = [title, "", intro, "", plainRows, "\nItems\n" + itemLines, "", action].join("\n");
  GmailApp.sendEmail(RECIPIENT_EMAIL, subject, body, {
    name: "Shizuku Lab Orders",
    htmlBody: emailCard(title, intro, order.order_number, rows, items, action, "#a36d1e")
  });
}

/** Run manually when you want both previews delivered to the owner inbox. */
function sendBothSampleEmails() {
  sendOwnerSampleEmail();
  sendCustomerSampleEmail();
}

/** Backwards-compatible shortcut: sends both sample formats. */
function sendSampleEmail() {
  sendBothSampleEmails();
}

function emailCard(title, intro, orderNumber, rows, items, action, accent) {
  const rowHtml = rows.map(function (row) {
    return '<tr><td style="padding:9px 0;color:#777066;font-size:13px;width:34%;vertical-align:top">' + html(row[0]) + '</td><td style="padding:9px 0;color:#28261f;font-size:14px;font-weight:600;vertical-align:top">' + html(row[1]) + '</td></tr>';
  }).join("");
  const itemsHtml = items.length ? '<div style="margin-top:20px;padding-top:18px;border-top:1px solid #e7ded2"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#777066;margin-bottom:10px">ORDER ITEMS</div>' + items.map(function (item) { return '<div style="padding:6px 0;color:#28261f;font-size:14px">' + Number(item.quantity || 1) + ' × ' + html(text(item.product_name || "Item")) + '</div>'; }).join("") + '</div>' : '';
  return '<div style="margin:0;padding:28px 12px;background:#f5efe6;font-family:Arial,sans-serif;color:#28261f"><div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #e5d9ca;border-radius:20px;overflow:hidden"><div style="height:7px;background:' + accent + '"></div><div style="padding:28px 26px 12px"><div style="font-size:11px;font-weight:800;letter-spacing:.16em;color:' + accent + ';text-transform:uppercase">SHIZUKU LAB</div><h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.1;margin:12px 0 8px;color:#28261f">' + html(title) + '</h1><p style="font-size:14px;line-height:1.55;color:#6f685f;margin:0">' + html(intro) + '</p><div style="display:inline-block;margin-top:16px;padding:7px 11px;border-radius:99px;background:#f2ece2;font-family:monospace;font-size:13px;font-weight:700">' + html(orderNumber) + '</div></div><div style="padding:8px 26px 26px"><table role="presentation" style="width:100%;border-collapse:collapse">' + rowHtml + '</table>' + itemsHtml + '<div style="margin-top:22px;padding:16px 18px;border-radius:13px;background:#eef3e8;color:#3f5135;font-size:14px;font-weight:700;line-height:1.45">' + html(action) + '</div></div><div style="padding:14px 26px;border-top:1px solid #eee5da;color:#8a8278;font-size:11px">Shizuku Lab · Crafted drop by drop<br>Powered by Slow Studio</div></div></div>';
}

function text(value) { return String(value == null || value === "" ? "—" : value).replace(/[\r\n]+/g, " ").trim(); }
function html(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function jsonResponse(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
