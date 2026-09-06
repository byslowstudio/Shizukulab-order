const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname, "app.js"), "utf8");
const pricingBlock = source.slice(source.indexOf("function originalPrice"), source.indexOf("function escapeHtml"));
const bundleBlock = source.slice(source.indexOf("function isBundle"), source.indexOf("function productStock"));

test("Malaysia mobile numbers accept local and international formats without changing Singapore", () => {
  const context = { state: { market: "MY" } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function cleanPhoneInput"), source.indexOf("function normaliseTime")), context);
  for (const input of ["0121234567", "+60121234567", "60121234567", "012-123 4567"]) {
    assert.equal(context.isValidPhone(input), true);
    assert.equal(context.normalisePhone(input), "60121234567");
  }
  assert.equal(context.isValidPhone("01112345678"), true);
  assert.equal(context.isValidPhone("0123"), false);
  context.state.market = "SG";
  assert.equal(context.normalisePhone("+6591234567"), "91234567");
  assert.equal(context.isValidPhone("91234567"), true);
  assert.equal(context.isValidPhone("0121234567"), false);
});

function pricingContext(store, menu = []) {
  const context = { state: { store, menu, productGroups: [] }, console };
  vm.createContext(context);
  vm.runInContext(`${pricingBlock}\n${bundleBlock}`, context);
  return context;
}

test("selected-product sale only affects selected products", () => {
  const context = pricingContext({
    storewide_sale_enabled: true,
    storewide_sale_percent: 10,
    storewide_sale_scope: "selected",
    storewide_sale_product_ids: ["1"],
  });
  assert.equal(context.salePrice({ id: 1, price: 10 }), 9);
  assert.equal(context.salePrice({ id: 2, price: 10 }), 10);
});

test("Mix & Matcha follows option prices and updates selected total", () => {
  const drinks = [
    { id: 1, name: "Matcha", price: 5.9, is_available: true, is_bundle: false },
    { id: 2, name: "Houjicha", price: 6.9, is_available: true, is_bundle: false },
  ];
  const bundle = {
    id: 28,
    name: "Mix & Matcha",
    category: "Bundle of Two",
    price: 0,
    is_bundle: true,
    bundle_pricing_mode: "sum_selected",
    bundle_product_ids: ["1", "2"],
    bundle_option_prices: { "2": 7.5 },
  };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  assert.equal(context.bundleStartingPrice(bundle), 11.8);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 13.4);
  assert.equal(context.selectedBundlePrice(bundle, drinks[1], drinks[1]), 15);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1], { milk: { price: -1 } }), 12.4);
});

test("negative option adjustments can reduce a bundle but never below zero", () => {
  const drinks = [{ id: 1, name: "Matcha", price: 5, is_available: true, is_bundle: false }];
  const bundle = { id: 28, name: "Mix & Matcha", price: 0, is_bundle: true, bundle_pricing_mode: "sum_selected", bundle_product_ids: ["1"] };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[0], { offer: { price: -1 } }), 9);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[0], { offer: { price: -99 } }), 0);
});

test("Malaysia Mix & Match uses MYR prices without changing SGD prices", () => {
  const drinks = [
    { id: 1, name: "Matcha", price: 5.9, myr_price: 16, is_available: true, is_bundle: false },
    { id: 2, name: "Houjicha", price: 6.9, myr_price: 18, is_available: true, is_bundle: false },
  ];
  const bundle = {
    id: 28,
    name: "Mix & Matcha",
    price: 0,
    myr_price: 0,
    is_bundle: true,
    bundle_pricing_mode: "sum_selected",
    bundle_product_ids: ["1", "2"],
    bundle_option_prices: { "2": 7.5 },
    bundle_myr_option_prices: { "2": 19 },
    bundle_display_from_price: 10,
    bundle_myr_display_from_price: 30,
  };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  context.state.market = "MY";
  assert.equal(context.bundleDisplayFromPrice(bundle), 30);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 35);
  context.state.market = "SG";
  assert.equal(context.bundleDisplayFromPrice(bundle), 10);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 13.4);
});

test("Malaysia never falls back to the Singapore product price", () => {
  const context = pricingContext({ storewide_sale_enabled: false });
  context.state.market = "MY";
  assert.equal(context.originalPrice({ price: 6.9, myr_price: null }), 0);
  assert.equal(context.originalPrice({ price: 6.9, myr_price: 15 }), 15);
});

test("Malaysia collection details never fall back to Singapore", () => {
  const collectionBlock = source.slice(source.indexOf("function safeExternalUrl"), source.indexOf("function isInstagramOrFacebookBrowser"));
  const context = {
    state: { market: "MY", store: {
      collection_area_label: "Toa Payoh",
      collection_address: "Singapore address",
      google_maps_url: "https://example.com/sg",
      collection_points: ["Singapore point"],
      collection_point_details: [],
      malaysia_collection_area_label: "Pontian",
      malaysia_collection_address: "Malaysia address",
      malaysia_google_maps_url: "https://example.com/my",
      malaysia_collection_points: ["Pontian point"],
      malaysia_collection_point_details: [],
    } },
    encodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(collectionBlock, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.collectionPointInfo("Pontian point"))), {
    name: "Pontian point",
    area: "Pontian point",
    address: "Malaysia address",
    mapsUrl: "https://example.com/my",
  });
});
    price: 0,
    is_bundle: true,
    bundle_pricing_mode: "sum_selected",
    bundle_product_ids: ["1", "2"],
    bundle_option_prices: { "2": 7.5 },
  };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  assert.equal(context.bundleStartingPrice(bundle), 11.8);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 13.4);
  assert.equal(context.selectedBundlePrice(bundle, drinks[1], drinks[1]), 15);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1], { milk: { price: -1 } }), 12.4);
});

test("negative option adjustments can reduce a bundle but never below zero", () => {
  const drinks = [{ id: 1, name: "Matcha", price: 5, is_available: true, is_bundle: false }];
  const bundle = { id: 28, name: "Mix & Matcha", price: 0, is_bundle: true, bundle_pricing_mode: "sum_selected", bundle_product_ids: ["1"] };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[0], { offer: { price: -1 } }), 9);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[0], { offer: { price: -99 } }), 0);
});

test("Malaysia Mix & Match uses MYR prices without changing SGD prices", () => {
  const drinks = [
    { id: 1, name: "Matcha", price: 5.9, myr_price: 16, is_available: true, is_bundle: false },
    { id: 2, name: "Houjicha", price: 6.9, myr_price: 18, is_available: true, is_bundle: false },
  ];
  const bundle = {
    id: 28,
    name: "Mix & Matcha",
    price: 0,
    myr_price: 0,
    is_bundle: true,
    bundle_pricing_mode: "sum_selected",
    bundle_product_ids: ["1", "2"],
    bundle_option_prices: { "2": 7.5 },
    bundle_myr_option_prices: { "2": 19 },
    bundle_display_from_price: 10,
    bundle_myr_display_from_price: 30,
  };
  const context = pricingContext({ storewide_sale_enabled: false }, drinks);
  context.state.market = "MY";
  assert.equal(context.bundleDisplayFromPrice(bundle), 30);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 35);
  context.state.market = "SG";
  assert.equal(context.bundleDisplayFromPrice(bundle), 10);
  assert.equal(context.selectedBundlePrice(bundle, drinks[0], drinks[1]), 13.4);
});

test("Malaysia never falls back to the Singapore product price", () => {
  const context = pricingContext({ storewide_sale_enabled: false });
  context.state.market = "MY";
  assert.equal(context.originalPrice({ price: 6.9, myr_price: null }), 0);
  assert.equal(context.originalPrice({ price: 6.9, myr_price: 15 }), 15);
});

test("Malaysia collection details never fall back to Singapore", () => {
  const collectionBlock = source.slice(source.indexOf("function safeExternalUrl"), source.indexOf("function isInstagramOrFacebookBrowser"));
  const context = {
    state: { market: "MY", store: {
      collection_area_label: "Toa Payoh",
      collection_address: "Singapore address",
      google_maps_url: "https://example.com/sg",
      collection_points: ["Singapore point"],
      collection_point_details: [],
      malaysia_collection_area_label: "Pontian",
      malaysia_collection_address: "Malaysia address",
      malaysia_google_maps_url: "https://example.com/my",
      malaysia_collection_points: ["Pontian point"],
      malaysia_collection_point_details: [],
    } },
    encodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(collectionBlock, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.collectionPointInfo("Pontian point"))), {
    name: "Pontian point",
    area: "Pontian point",
    address: "Malaysia address",
    mapsUrl: "https://example.com/my",
  });
});
