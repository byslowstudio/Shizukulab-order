(function (root, factory) {
  const rules = factory();
  if (typeof window !== "undefined") root.AdminOrderRules = rules;
  else if (typeof module === "object" && module.exports) module.exports = rules;
  else root.AdminOrderRules = rules;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  const PAYMENT_REVIEW_STATUSES = new Set(["submitted", "pending_confirmation"]);

  function isCancelledOrder(order) {
    return String(order?.order_status || order?.status || "").toLowerCase() === "cancelled";
  }

  function isPaymentReviewOrder(order) {
    return PAYMENT_REVIEW_STATUSES.has(String(order?.payment_status || "").toLowerCase())
      && !isCancelledOrder(order);
  }

  function orderMatchesFilter(order, filter) {
    if (filter === "all") return true;
    if (filter === "cancelled") return isCancelledOrder(order);
    // A cancelled order remains auditable under All/Cancelled only.
    if (isCancelledOrder(order)) return false;
    if (filter === "payment") return isPaymentReviewOrder(order);
    if (filter === "awaiting") return order.payment_status === "awaiting_payment";
    if (filter === "paid") return order.payment_status === "paid" && order.order_status === "confirmed";
    if (filter === "preparing") return order.order_status === "preparing";
    if (filter === "ready") return order.order_status === "ready";
    if (filter === "collected") return order.order_status === "collected";
    return false;
  }

  function normalizeSingaporeWhatsAppNumber(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 8) digits = `65${digits}`;
    if (!/^65[689]\d{7}$/.test(digits)) return "";
    return digits;
  }

  function buildWhatsAppUrl(phoneValue, message) {
    const phone = normalizeSingaporeWhatsAppNumber(phoneValue);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(String(message || ""))}` : "";
  }

  return { isCancelledOrder, isPaymentReviewOrder, orderMatchesFilter, normalizeSingaporeWhatsAppNumber, buildWhatsAppUrl };
});
