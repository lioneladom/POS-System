const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
];

const PAYSTACK_PENDING_SALE_KEY = "campusmart.pendingPaystackSale";
const PAYSTACK_MESSAGE_TYPE = "campusmart.paystackComplete";
const PAYSTACK_RETURN_PARAM = "paystack";
const PAYSTACK_RETURN_STATE = "resume";
const THEME_STORAGE_KEY = "lionsmarket.theme";
let currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const state = {
  session: null,
  data: {
    store: null,
    settings: {
      currency: "GHS",
      locale: "en-GH",
      taxRate: 0.125,
      lowStockThreshold: 6,
    },
    products: [],
    customers: [],
    users: [],
    inventory: [],
    recentSales: [],
    reports: null,
    latestReceipt: null,
  },
  activeView: "pos",
  productSearch: "",
  cart: {
    items: [],
    customerId: "",
    discountRate: 0,
    paymentMethod: "cash",
    amountTendered: "",
  },
  editingProductId: "",
  editingCustomerId: "",
  editingUserId: "",
  customerHistoryId: "",
  customerHistory: [],
  selectedReceiptId: "",
  selectedReceipt: null,
};

const elements = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  loginForm: document.getElementById("loginForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginStatus: document.getElementById("loginStatus"),
  navTabs: document.getElementById("navTabs"),
  storeHeading: document.getElementById("storeHeading"),
  statusLine: document.getElementById("statusLine"),
  userBadge: document.getElementById("userBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  productSearch: document.getElementById("productSearch"),
  productCatalog: document.getElementById("productCatalog"),
  saleCustomer: document.getElementById("saleCustomer"),
  discountInput: document.getElementById("discountInput"),
  paymentMethod: document.getElementById("paymentMethod"),
  checkoutMeta: document.getElementById("checkoutMeta"),
  checkoutNote: document.getElementById("checkoutNote"),
  amountTendered: document.getElementById("amountTendered"),
  amountTenderedLabel: document.getElementById("amountTenderedLabel"),
  cartList: document.getElementById("cartList"),
  cartTotals: document.getElementById("cartTotals"),
  clearCartBtn: document.getElementById("clearCartBtn"),
  checkoutBtn: document.getElementById("checkoutBtn"),
  receiptPreview: document.getElementById("receiptPreview"),
  printReceiptBtn: document.getElementById("printReceiptBtn"),
  productForm: document.getElementById("productForm"),
  productId: document.getElementById("productId"),
  productName: document.getElementById("productName"),
  productCategory: document.getElementById("productCategory"),
  productSupplier: document.getElementById("productSupplier"),
  productPrice: document.getElementById("productPrice"),
  productStock: document.getElementById("productStock"),
  productBarcode: document.getElementById("productBarcode"),
  productDescription: document.getElementById("productDescription"),
  resetProductFormBtn: document.getElementById("resetProductFormBtn"),
  productStats: document.getElementById("productStats"),
  productTable: document.getElementById("productTable"),
  customerForm: document.getElementById("customerForm"),
  customerId: document.getElementById("customerId"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerEmail: document.getElementById("customerEmail"),
  customerAddress: document.getElementById("customerAddress"),
  customerPoints: document.getElementById("customerPoints"),
  resetCustomerFormBtn: document.getElementById("resetCustomerFormBtn"),
  customerTable: document.getElementById("customerTable"),
  customerHistory: document.getElementById("customerHistory"),
  userForm: document.getElementById("userForm"),
  userId: document.getElementById("userId"),
  userName: document.getElementById("userName"),
  userUsername: document.getElementById("userUsername"),
  userRole: document.getElementById("userRole"),
  userPassword: document.getElementById("userPassword"),
  resetUserFormBtn: document.getElementById("resetUserFormBtn"),
  saveUserBtn: document.getElementById("saveUserBtn"),
  userStats: document.getElementById("userStats"),
  userTable: document.getElementById("userTable"),
  inventoryForm: document.getElementById("inventoryForm"),
  inventoryProduct: document.getElementById("inventoryProduct"),
  inventoryMode: document.getElementById("inventoryMode"),
  inventoryQuantity: document.getElementById("inventoryQuantity"),
  inventoryNote: document.getElementById("inventoryNote"),
  inventoryStats: document.getElementById("inventoryStats"),
  inventoryTable: document.getElementById("inventoryTable"),
  salesTable: document.getElementById("salesTable"),
  salesReceipt: document.getElementById("salesReceipt"),
  reportSummary: document.getElementById("reportSummary"),
  productPerformanceTable: document.getElementById("productPerformanceTable"),
  cashierPerformanceTable: document.getElementById("cashierPerformanceTable"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getCurrencyFormatter() {
  return new Intl.NumberFormat(state.data.settings.locale, {
    style: "currency",
    currency: state.data.settings.currency,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value) {
  return getCurrencyFormatter().format(Number(value ?? 0));
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function updateThemeToggle() {
  if (!elements.themeToggleBtn) {
    return;
  }

  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  const label = nextTheme === "dark" ? "Dark" : "Light";
  elements.themeToggleBtn.textContent = label;
  elements.themeToggleBtn.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  elements.themeToggleBtn.setAttribute("title", `Switch to ${nextTheme} mode`);
  elements.themeToggleBtn.setAttribute("aria-pressed", String(currentTheme === "dark"));
}

function applyTheme(theme, options = {}) {
  const { persist = true } = options;
  currentTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = currentTheme;

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {
      // Ignore storage failures and keep the in-memory theme active.
    }
  }

  updateThemeToggle();
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function createPaystackCheckoutEmail(reference) {
  const normalizedReference = String(reference || "walk-in")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return `checkout+${normalizedReference || "walk-in"}@lionsmarket-pos.example.com`;
}

function usesPaystack(paymentMethod) {
  return (paymentMethod === "card" || paymentMethod === "mobile_money") && Boolean(state.data.settings.paystack?.enabled);
}

function makePaystackReference() {
  return `PS-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`.toUpperCase();
}

function getPaystackCallbackUrl() {
  return `${window.location.origin}/paystack/callback.html`;
}

function getPaystackReturnReference() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(PAYSTACK_RETURN_PARAM) !== PAYSTACK_RETURN_STATE) {
    return "";
  }

  return params.get("reference") || params.get("trxref") || "";
}

function clearPaystackReturnState() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PAYSTACK_RETURN_PARAM);
  url.searchParams.delete("reference");
  url.searchParams.delete("trxref");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function savePendingPaystackSale(payload) {
  sessionStorage.setItem(PAYSTACK_PENDING_SALE_KEY, JSON.stringify(payload));
}

function getPendingPaystackSale() {
  const payload = sessionStorage.getItem(PAYSTACK_PENDING_SALE_KEY);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    sessionStorage.removeItem(PAYSTACK_PENDING_SALE_KEY);
    return null;
  }
}

function clearPendingPaystackSale() {
  sessionStorage.removeItem(PAYSTACK_PENDING_SALE_KEY);
}

function createCheckoutPayload(cart, extras = {}) {
  return {
    customerId: cart.customer?.id,
    discountRate: cart.discountRate,
    paymentMethod: cart.paymentMethod,
    amountTendered: usesPaystack(cart.paymentMethod) ? cart.total : state.cart.amountTendered,
    paymentReference: extras.paymentReference || null,
    paymentVerification: extras.paymentVerification || null,
    items: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
}

function makeSaleSummaryFromReceipt(receipt) {
  return {
    id: receipt.sale.id,
    saleCode: receipt.sale.saleCode,
    timestamp: receipt.sale.timestamp,
    subtotal: receipt.sale.subtotal,
    discountAmount: receipt.sale.discountAmount,
    taxAmount: receipt.sale.taxAmount,
    totalAmount: receipt.sale.totalAmount,
    paymentMethod: receipt.sale.paymentMethod,
    paymentMethodLabel: receipt.sale.paymentMethodLabel,
    customerName: receipt.customer?.name || "Walk-in Customer",
    cashierName: receipt.cashier?.name || "Unknown cashier",
  };
}

function applyLatestReceipt(receipt) {
  if (!receipt) {
    return;
  }

  state.data.latestReceipt = receipt;
  state.selectedReceipt = receipt;
  state.selectedReceiptId = receipt.sale.id;

  const currentSales = Array.isArray(state.data.recentSales) ? state.data.recentSales : [];
  const saleSummary = makeSaleSummaryFromReceipt(receipt);
  const nextSize = Math.max(currentSales.length, 1);
  state.data.recentSales = [
    saleSummary,
    ...currentSales.filter((sale) => sale.id !== saleSummary.id),
  ].slice(0, nextSize);
}

async function finalizeSale(payload) {
  const receipt = await api("/api/sales/checkout", {
    method: "POST",
    body: payload,
  });

  clearPendingPaystackSale();
  clearPaystackReturnState();
  resetCart();
  await refreshBootstrap(
    `${receipt.sale.saleCode} completed for ${formatCurrency(receipt.sale.totalAmount)}.`,
    { latestReceipt: receipt },
  );

  return receipt;
}

function createPaystackClient() {
  if (typeof window.PaystackPop === "function") {
    return new window.PaystackPop();
  }

  if (typeof window.Paystack === "function") {
    return new window.Paystack();
  }

  if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
    return window.PaystackPop;
  }

  throw new Error("Paystack checkout script is unavailable.");
}

function openPaystackInline(cart, reference) {
  const email = createPaystackCheckoutEmail(reference);
  const channel = cart.paymentMethod === "mobile_money" ? "mobile_money" : "card";
  const amount = Math.round(cart.total * 100);
  const metadata = {
    payment_method: cart.paymentMethod,
    customer_name: cart.customer?.name || "Walk-in Customer",
  };

  return new Promise((resolve, reject) => {
    const handleSuccess = (transaction) => {
      resolve(transaction?.reference || transaction?.trxref || reference);
    };

    const handleCancel = () => {
      reject(new Error("Paystack checkout was cancelled."));
    };

    const handleError = (error) => {
      reject(new Error(error?.message || "Paystack checkout failed."));
    };

    const options = {
      key: state.data.settings.paystack.publicKey,
      email,
      amount,
      currency: state.data.settings.currency,
      reference,
      channels: [channel],
      metadata,
      onLoad: () => {
        setStatus("Complete the payment in the checkout panel.", "info");
      },
      onSuccess: handleSuccess,
      onCancel: handleCancel,
      onError: handleError,
    };

    try {
      const popup = createPaystackClient();

      if (typeof popup.checkout === "function") {
        popup.checkout(options);
        return;
      }

      if (typeof popup.newTransaction === "function") {
        popup.newTransaction(options);
        return;
      }

      if (typeof popup.setup === "function") {
        const handler = popup.setup({
          key: options.key,
          email: options.email,
          amount: options.amount,
          currency: options.currency,
          ref: options.reference,
          channels: options.channels,
          metadata: options.metadata,
          callback: handleSuccess,
          onClose: handleCancel,
        });
        handler.openIframe();
        return;
      }

      reject(new Error("Paystack checkout is unavailable in this browser."));
    } catch (error) {
      reject(error);
    }
  });
}

async function completePendingPaystackSale(reference) {
  const pendingSale = getPendingPaystackSale();
  if (!pendingSale) {
    clearPaystackReturnState();
    throw new Error("No pending Paystack checkout was found.");
  }

  const expectedReference = String(
    pendingSale.paymentReference || pendingSale.reference || "",
  ).trim();
  const resolvedReference = String(reference || expectedReference).trim();

  if (!resolvedReference) {
    clearPendingPaystackSale();
    clearPaystackReturnState();
    throw new Error("Missing Paystack reference for this checkout.");
  }

  if (expectedReference && resolvedReference !== expectedReference) {
    clearPaystackReturnState();
    throw new Error("Returned Paystack reference does not match the active sale.");
  }

  const { verification } = await api(
    `/api/paystack/verify?reference=${encodeURIComponent(resolvedReference)}`,
  );

  try {
    return await finalizeSale({
      ...pendingSale,
      paymentReference: resolvedReference,
      paymentVerification: verification,
    });
  } catch (error) {
    if (String(error.message || "").includes("already been recorded in the POS")) {
      clearPendingPaystackSale();
      clearPaystackReturnState();
      await refreshBootstrap("This Paystack payment was already recorded.");
      return null;
    }

    throw error;
  }
}

async function startPaystackCheckout(cart) {
  if (!state.data.settings.paystack?.publicKey) {
    throw new Error("Paystack is not configured on this POS yet.");
  }

  const reference = makePaystackReference();
  savePendingPaystackSale(
    createCheckoutPayload(cart, {
      paymentReference: reference,
    }),
  );

  setStatus("Opening Paystack checkout...", "info");

  try {
    const returnedReference = await openPaystackInline(cart, reference);
    setStatus("Confirming your payment...", "info");
    return completePendingPaystackSale(returnedReference);
  } catch (error) {
    clearPendingPaystackSale();
    clearPaystackReturnState();
    throw error;
  }
}

async function resumePendingPaystackCheckout() {
  const reference = getPaystackReturnReference();
  if (!reference) {
    return;
  }

  setStatus("Confirming your Paystack payment...", "info");
  await completePendingPaystackSale(reference);
}

function setStatus(message, tone = "info") {
  elements.statusLine.textContent = message;
  elements.statusLine.dataset.tone = tone;
}

function setLoginStatus(message, tone = "info") {
  elements.loginStatus.textContent = message;
  elements.loginStatus.dataset.tone = tone;
}

function getDefaultCustomerId() {
  return (
    state.data.customers.find((customer) => customer.isDefault)?.id ||
    state.data.customers[0]?.id ||
    ""
  );
}

function getProductById(productId) {
  return state.data.products.find((product) => product.id === productId) || null;
}

function getCustomerById(customerId) {
  return state.data.customers.find((customer) => customer.id === customerId) || null;
}

function getRoleLabel(role) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Cashier";
}

function getUserDeleteReason(user) {
  if (!user) {
    return "User not found.";
  }

  if (user.id === state.session?.user?.id) {
    return "You cannot delete your own account while signed in.";
  }

  if (user.role === "admin" && state.data.users.filter((entry) => entry.role === "admin").length <= 1) {
    return "Keep at least one admin account on the system.";
  }

  if (user.hasActivity) {
    return "Users with sales or inventory history cannot be deleted.";
  }

  return "";
}

function getCartSummary() {
  const items = state.cart.items
    .map((entry) => {
      const product = getProductById(entry.productId);
      if (!product) {
        return null;
      }

      const quantity = Math.max(0, Math.min(entry.quantity, product.stock));
      if (!quantity) {
        return null;
      }

      return {
        productId: product.id,
        name: product.name,
        category: product.category,
        barcode: product.barcode,
        price: product.price,
        stock: product.stock,
        quantity,
        lineTotal: roundMoney(product.price * quantity),
      };
    })
    .filter(Boolean);

  const customer =
    state.data.customers.find((entry) => entry.id === state.cart.customerId) ||
    state.data.customers.find((entry) => entry.isDefault) ||
    null;
  const discountRate = Math.min(Math.max(Number(state.cart.discountRate || 0), 0), 50);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = roundMoney(subtotal * (discountRate / 100));
  const taxableAmount = roundMoney(subtotal - discountAmount);
  const taxAmount = roundMoney(taxableAmount * state.data.settings.taxRate);
  const total = roundMoney(taxableAmount + taxAmount);
  const amountTendered = roundMoney(Number(state.cart.amountTendered || 0));
  const paymentMethod = state.cart.paymentMethod || "cash";
  const changeDue = usesPaystack(paymentMethod)
    ? 0
    : roundMoney(Math.max(amountTendered - total, 0));

  return {
    items,
    customer,
    discountRate,
    discountAmount,
    subtotal,
    taxAmount,
    total,
    amountTendered,
    paymentMethod,
    changeDue,
  };
}

function syncCart() {
  if (!state.cart.customerId || !state.data.customers.some((entry) => entry.id === state.cart.customerId)) {
    state.cart.customerId = getDefaultCustomerId();
  }

  state.cart.items = getCartSummary().items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
}

async function api(path, options = {}) {
  const requestOptions = {
    method: options.method || "GET",
    headers: {},
  };

  if (options.body !== undefined) {
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, requestOptions);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401) {
      handleSignedOut(payload?.message || "Your session has expired. Please sign in again.");
    }

    throw new Error(payload?.message || "Request failed.");
  }

  return payload;
}

async function refreshProductsData(message = "") {
  const requests = [api("/api/products")];

  if (state.session.viewIds.includes("inventory")) {
    requests.push(api("/api/inventory"));
  } else {
    requests.push(Promise.resolve(null));
  }

  if (state.session.viewIds.includes("reports")) {
    requests.push(api("/api/reports"));
  } else {
    requests.push(Promise.resolve(null));
  }

  const [products, inventory, reports] = await Promise.all(requests);
  state.data.products = products;

  if (inventory) {
    state.data.inventory = inventory;
  }

  if (reports) {
    state.data.reports = reports;
  }

  syncCart();
  renderPOS();

  if (state.session.viewIds.includes("products")) {
    renderProducts();
  }

  if (inventory && state.session.viewIds.includes("inventory")) {
    renderInventory();
  }

  if (reports && state.session.viewIds.includes("reports")) {
    renderReports();
  }

  setStatus(message, "success");
}

async function refreshCustomersData(message = "") {
  state.data.customers = await api("/api/customers");

  if (
    state.editingCustomerId &&
    !state.data.customers.some((customer) => customer.id === state.editingCustomerId)
  ) {
    state.editingCustomerId = "";
  }

  if (
    state.customerHistoryId &&
    !state.data.customers.some((customer) => customer.id === state.customerHistoryId)
  ) {
    state.customerHistoryId = "";
    state.customerHistory = [];
  }

  syncCart();
  renderPOS();

  if (state.session.viewIds.includes("customers")) {
    renderCustomers();
  }

  setStatus(message, "success");
}

async function refreshUsersData(message = "") {
  state.data.users = await api("/api/users");

  if (
    state.editingUserId &&
    !state.data.users.some((user) => user.id === state.editingUserId)
  ) {
    state.editingUserId = "";
  }

  if (state.session.viewIds.includes("users")) {
    renderUsers();
  }

  renderShell();
  setStatus(message, "success");
}

async function refreshInventoryData(message = "") {
  const requests = [api("/api/products"), api("/api/inventory")];

  if (state.session.viewIds.includes("reports")) {
    requests.push(api("/api/reports"));
  } else {
    requests.push(Promise.resolve(null));
  }

  const [products, inventory, reports] = await Promise.all(requests);
  state.data.products = products;
  state.data.inventory = inventory;

  if (reports) {
    state.data.reports = reports;
  }

  syncCart();
  renderPOS();

  if (state.session.viewIds.includes("products")) {
    renderProducts();
  }

  if (state.session.viewIds.includes("inventory")) {
    renderInventory();
  }

  if (reports && state.session.viewIds.includes("reports")) {
    renderReports();
  }

  setStatus(message, "success");
}

function resetCart() {
  state.cart = {
    items: [],
    customerId: getDefaultCustomerId(),
    discountRate: 0,
    paymentMethod: "cash",
    amountTendered: "",
  };
}

function handleSignedOut(message) {
  state.session = null;
  state.data = {
    store: null,
    settings: {
      currency: "GHS",
      locale: "en-GH",
      taxRate: 0.125,
      lowStockThreshold: 6,
      paystack: {
        enabled: false,
        publicKey: "",
        currency: "GHS",
      },
    },
    products: [],
    customers: [],
    users: [],
    inventory: [],
    recentSales: [],
    reports: null,
    latestReceipt: null,
  };
  state.activeView = "pos";
  state.productSearch = "";
  state.editingProductId = "";
  state.editingCustomerId = "";
  state.editingUserId = "";
  state.customerHistoryId = "";
  state.customerHistory = [];
  state.selectedReceiptId = "";
  state.selectedReceipt = null;
  resetCart();
  render();
  setLoginStatus(message, "error");
}

async function refreshBootstrap(message = "", options = {}) {
  const bootstrap = await api("/api/bootstrap");
  state.session = bootstrap.session;
  state.data = bootstrap;
  if (!state.session.viewIds.includes(state.activeView)) {
    state.activeView = state.session.viewIds[0];
  }
  syncCart();
  if (options.latestReceipt) {
    applyLatestReceipt(options.latestReceipt);
  } else if (!state.selectedReceiptId && bootstrap.latestReceipt) {
    state.selectedReceiptId = bootstrap.latestReceipt.sale.id;
    state.selectedReceipt = bootstrap.latestReceipt;
  }
  render();
  if (message) {
    setStatus(message, "success");
  } else {
    setStatus("", "info");
  }
}

async function loadInitialState() {
  try {
    await refreshBootstrap();
    await resumePendingPaystackCheckout();
  } catch (error) {
    handleSignedOut("Sign in to access the POS.");
  }
}

function addToCart(productId) {
  const product = getProductById(productId);
  if (!product) {
    throw new Error("Product not found.");
  }

  const existing = state.cart.items.find((entry) => entry.productId === productId);
  const nextQuantity = (existing?.quantity || 0) + 1;
  if (nextQuantity > product.stock) {
    throw new Error(`Only ${product.stock} unit(s) of ${product.name} available.`);
  }

  if (existing) {
    existing.quantity = nextQuantity;
  } else {
    state.cart.items.push({ productId, quantity: 1 });
  }
}

function updateCartQuantity(productId, quantity) {
  const product = getProductById(productId);
  const entry = state.cart.items.find((item) => item.productId === productId);
  if (!product || !entry) {
    return;
  }

  if (quantity <= 0) {
    state.cart.items = state.cart.items.filter((item) => item.productId !== productId);
    return;
  }

  if (quantity > product.stock) {
    throw new Error(`Only ${product.stock} unit(s) of ${product.name} available.`);
  }

  entry.quantity = quantity;
}

function renderNav() {
  elements.navTabs.innerHTML = state.session.views
    .map(
      (view) => `
        <button
          class="nav-tab ${state.activeView === view.id ? "is-active" : ""}"
          data-view="${view.id}"
          type="button"
        >
          <strong>${escapeHtml(view.label)}</strong>
        </button>
      `,
    )
    .join("");
}

function renderShell() {
  const signedIn = Boolean(state.session);
  elements.authScreen.classList.toggle("is-hidden", signedIn);
  elements.appShell.classList.toggle("is-hidden", !signedIn);

  if (!signedIn) {
    return;
  }

  elements.userBadge.textContent = state.session.user.name;
  elements.storeHeading.textContent = state.data.store.name;
  renderNav();
}

function renderViews() {
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle(
      "is-visible",
      state.session.viewIds.includes(panel.dataset.view) &&
        panel.dataset.view === state.activeView,
    );
  });
}

function renderPOS() {
  const cart = getCartSummary();
  const paystackMethod = cart.paymentMethod === "card" || cart.paymentMethod === "mobile_money";
  const paystackEnabled = usesPaystack(cart.paymentMethod);
  const query = state.productSearch.trim().toLowerCase();
  const products = state.data.products.filter((product) => {
    if (!query) {
      return true;
    }

    return [
      product.name,
      product.category,
      product.supplier,
      product.barcode,
      product.description,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  elements.productSearch.value = state.productSearch;
  elements.saleCustomer.innerHTML = state.data.customers
    .map(
      (customer) => `
        <option value="${customer.id}" ${cart.customer?.id === customer.id ? "selected" : ""}>
          ${escapeHtml(customer.name)}
        </option>
      `,
    )
    .join("");

  elements.paymentMethod.innerHTML = PAYMENT_METHODS.map(
    (method) => `
      <option value="${method.value}" ${cart.paymentMethod === method.value ? "selected" : ""}>
        ${escapeHtml(method.label)}
      </option>
    `,
  ).join("");

  elements.discountInput.value = String(cart.discountRate);
  elements.checkoutMeta.innerHTML = `
    <article class="checkout-stat">
      <span>Items</span>
      <strong>${cart.items.length}</strong>
    </article>
    <article class="checkout-stat">
      <span>Tax</span>
      <strong>${formatCurrency(cart.taxAmount)}</strong>
    </article>
    <article class="checkout-stat">
      <span>Total</span>
      <strong>${formatCurrency(cart.total)}</strong>
    </article>
  `;
  elements.checkoutNote.innerHTML = paystackMethod
    ? paystackEnabled
      ? `
          <strong>Paystack</strong>
          <span>${cart.paymentMethod === "card" ? "Card payment" : "Mobile money payment"}</span>
        `
      : `
          <strong>Paystack</strong>
          <span>Unavailable</span>
        `
    : "";
  elements.amountTendered.disabled = paystackMethod;
  elements.amountTendered.value = paystackMethod
    ? cart.total
      ? roundMoney(cart.total).toFixed(2)
      : ""
    : state.cart.amountTendered;
  elements.amountTenderedLabel.querySelector("span").textContent =
    cart.paymentMethod === "cash"
      ? "Amount tendered"
      : paystackMethod
        ? "Amount to charge"
        : "Recorded amount";
  elements.checkoutBtn.textContent = paystackMethod
    ? `Pay ${formatCurrency(cart.total)} with Paystack`
    : "Complete Sale";
  elements.checkoutBtn.disabled = cart.items.length === 0 || (paystackMethod && !paystackEnabled);
  elements.checkoutBtn.title =
    paystackMethod && !paystackEnabled
      ? "Add Paystack keys in .env to accept online payments."
      : "";

  elements.productCatalog.innerHTML = products.length
    ? products
        .map(
          (product) => `
            <article class="product-card" data-product-id="${product.id}">
              <div class="product-info">
                <h4>${escapeHtml(product.name)}</h4>
                <div class="product-meta">
                  <span>${escapeHtml(product.category)}</span>
                  <span>${escapeHtml(product.supplier)}</span>
                </div>
              </div>
              <div class="product-price-tag">
                <span class="pill ${product.lowStock ? "pill-accent" : ""}">${product.stock} in stock</span>
                <strong>${formatCurrency(product.price)}</strong>
              </div>
              <button
                class="btn btn-secondary"
                data-product-id="${product.id}"
                type="button"
                ${product.stock <= 0 ? "disabled" : ""}
              >
                Add
              </button>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">No products.</div>`;

  elements.cartList.innerHTML = cart.items.length
    ? cart.items
        .map(
          (item) => `
            <article class="cart-item">
              <div>
                <h4>${escapeHtml(item.name)}</h4>
                <div class="product-meta">
                  <span>${formatCurrency(item.price)} each</span>
                  <span>Line total: ${formatCurrency(item.lineTotal)}</span>
                </div>
              </div>
              <div class="cart-controls">
                <button class="btn btn-ghost" data-cart-action="decrease" data-product-id="${item.productId}" type="button">-</button>
                <button class="btn btn-secondary" data-cart-action="remove" data-product-id="${item.productId}" type="button">${item.quantity}</button>
                <button class="btn btn-ghost" data-cart-action="increase" data-product-id="${item.productId}" type="button">+</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Cart is empty.</div>`;

  elements.cartTotals.innerHTML = `
    <div class="summary-row"><strong>Subtotal</strong><strong>${formatCurrency(cart.subtotal)}</strong></div>
    <div class="summary-row"><strong>Discount</strong><strong>${formatCurrency(cart.discountAmount)}</strong></div>
    <div class="summary-row"><strong>Tax</strong><strong>${formatCurrency(cart.taxAmount)}</strong></div>
    <div class="summary-row"><strong>Total</strong><strong>${formatCurrency(cart.total)}</strong></div>
    <div class="summary-row"><strong>Change</strong><strong>${formatCurrency(cart.changeDue)}</strong></div>
  `;

  elements.receiptPreview.innerHTML = state.data.latestReceipt
    ? renderReceiptCard(state.data.latestReceipt)
    : `<div class="empty-state">No receipt yet.</div>`;
}

function renderStats(container, cards) {
  container.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `,
    )
    .join("");
}

function renderProducts() {
  const inventoryValue = state.data.products.reduce(
    (sum, product) => sum + product.price * product.stock,
    0,
  );
  const editingProduct =
    state.data.products.find((product) => product.id === state.editingProductId) || null;

  elements.productId.value = editingProduct?.id || "";
  elements.productName.value = editingProduct?.name || "";
  elements.productCategory.value = editingProduct?.category || "";
  elements.productSupplier.value = editingProduct?.supplier || "";
  elements.productPrice.value = editingProduct?.price || "";
  elements.productStock.value = editingProduct?.stock || "";
  elements.productBarcode.value = editingProduct?.barcode || "";
  elements.productDescription.value = editingProduct?.description || "";

  renderStats(elements.productStats, [
    { label: "Products", value: String(state.data.products.length) },
    {
      label: "Low stock",
      value: String(state.data.products.filter((product) => product.lowStock).length),
    },
    {
      label: "Units on hand",
      value: String(
        state.data.products.reduce((sum, product) => sum + product.stock, 0),
      ),
    },
    { label: "Inventory value", value: formatCurrency(inventoryValue) },
  ]);

  elements.productTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Barcode</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.products
          .map(
            (product) => `
              <tr>
                <td data-label="Product">
                  <strong>${escapeHtml(product.name)}</strong>
                  <div class="muted">${escapeHtml(product.supplier)}</div>
                </td>
                <td data-label="Category">${escapeHtml(product.category)}</td>
                <td data-label="Price">${formatCurrency(product.price)}</td>
                <td data-label="Stock">${product.stock}</td>
                <td data-label="Barcode">${escapeHtml(product.barcode)}</td>
                <td data-label="Actions">
                  <div class="table-actions">
                    <button class="btn btn-secondary" data-product-action="edit" data-product-id="${product.id}" type="button">Edit</button>
                    <button class="btn btn-danger" data-product-action="delete" data-product-id="${product.id}" type="button">Delete</button>
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCustomers() {
  const editingCustomer =
    state.data.customers.find((customer) => customer.id === state.editingCustomerId) || null;

  elements.customerId.value = editingCustomer?.id || "";
  elements.customerName.value = editingCustomer?.name || "";
  elements.customerPhone.value = editingCustomer?.phone || "";
  elements.customerEmail.value = editingCustomer?.email || "";
  elements.customerAddress.value = editingCustomer?.address || "";
  elements.customerPoints.value = editingCustomer?.loyaltyPoints || 0;

  elements.customerTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Address</th>
          <th>Points</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.customers
          .map(
            (customer) => `
              <tr>
                <td data-label="Customer">
                  <strong>${escapeHtml(customer.name)}</strong>
                </td>
                <td data-label="Phone">${escapeHtml(customer.phone || "N/A")}</td>
                <td data-label="Email">${escapeHtml(customer.email || "N/A")}</td>
                <td data-label="Address">${escapeHtml(customer.address || "N/A")}</td>
                <td data-label="Points">${customer.loyaltyPoints}</td>
                <td data-label="Actions">
                  <div class="table-actions">
                    <button class="btn btn-secondary" data-customer-action="history" data-customer-id="${customer.id}" type="button">History</button>
                    ${
                      customer.isDefault
                        ? ""
                        : `
                          <button class="btn btn-ghost" data-customer-action="edit" data-customer-id="${customer.id}" type="button">Edit</button>
                          <button class="btn btn-danger" data-customer-action="delete" data-customer-id="${customer.id}" type="button">Delete</button>
                        `
                    }
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  const historyOwner =
    state.data.customers.find((customer) => customer.id === state.customerHistoryId) || null;
  elements.customerHistory.innerHTML = historyOwner
    ? `
        <h4>${escapeHtml(historyOwner.name)}</h4>
        ${
          state.customerHistory.length
            ? state.customerHistory
                .map(
                  (sale) => `
                    <div class="receipt-block">
                      <div class="summary-row">
                        <strong>${escapeHtml(sale.saleCode)}</strong>
                        <strong>${formatCurrency(sale.totalAmount)}</strong>
                      </div>
                      <div class="muted">${formatDateTime(sale.timestamp)}</div>
                      ${sale.items
                        .map(
                          (item) => `
                            <div class="receipt-row">
                              <span>${escapeHtml(item.productName)} × ${item.quantity}</span>
                              <strong>${formatCurrency(item.lineTotal)}</strong>
                            </div>
                          `,
                        )
                        .join("")}
                    </div>
                  `,
                )
                .join("")
            : `<div class="empty-state">No purchases yet.</div>`
        }
      `
    : `<div class="empty-state">Select a customer.</div>`;
}

function renderUsers() {
  const editingUser =
    state.data.users.find((user) => user.id === state.editingUserId) || null;

  elements.userId.value = editingUser?.id || "";
  elements.userName.value = editingUser?.name || "";
  elements.userUsername.value = editingUser?.username || "";
  elements.userRole.value = editingUser?.role || "cashier";
  elements.userPassword.value = "";
  elements.userPassword.required = !editingUser;
  elements.userPassword.placeholder = editingUser ? "Leave blank to keep current password" : "";
  elements.saveUserBtn.textContent = editingUser ? "Save User" : "Create User";

  renderStats(elements.userStats, [
    { label: "Total users", value: String(state.data.users.length) },
    {
      label: "Admins",
      value: String(state.data.users.filter((user) => user.role === "admin").length),
    },
    {
      label: "Managers",
      value: String(state.data.users.filter((user) => user.role === "manager").length),
    },
    {
      label: "Cashiers",
      value: String(state.data.users.filter((user) => user.role === "cashier").length),
    },
  ]);

  elements.userTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.users
          .map((user) => {
            const deleteReason = getUserDeleteReason(user);

            return `
              <tr>
                <td data-label="User">
                  <strong>${escapeHtml(user.name)}</strong>
                  <div class="muted">${escapeHtml(user.username)}</div>
                </td>
                <td data-label="Role"><span class="pill">${escapeHtml(getRoleLabel(user.role))}</span></td>
                <td data-label="Actions">
                  <div class="table-actions">
                    <button
                      class="btn btn-secondary"
                      data-user-action="edit"
                      data-user-id="${user.id}"
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      class="btn btn-danger"
                      data-user-action="delete"
                      data-user-id="${user.id}"
                      type="button"
                      ${deleteReason ? "disabled" : ""}
                      title="${escapeHtml(deleteReason)}"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderInventory() {
  elements.inventoryProduct.innerHTML = state.data.products
    .map(
      (product) => `
        <option value="${product.id}">${escapeHtml(product.name)}</option>
      `,
    )
    .join("");

  renderStats(elements.inventoryStats, [
    { label: "Tracked products", value: String(state.data.inventory.length) },
    {
      label: "Low stock",
      value: String(state.data.inventory.filter((item) => item.lowStock).length),
    },
    {
      label: "Units on hand",
      value: String(state.data.inventory.reduce((sum, item) => sum + item.stock, 0)),
    },
    {
      label: "Inventory value",
      value: formatCurrency(
        state.data.inventory.reduce((sum, item) => sum + item.stockValue, 0),
      ),
    },
  ]);

  elements.inventoryTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Supplier</th>
          <th>Stock</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.inventory
          .map(
            (item) => `
              <tr>
                <td data-label="Product">
                  <strong>${escapeHtml(item.name)}</strong>
                  <div class="muted">${escapeHtml(item.category)}</div>
                </td>
                <td data-label="Supplier">${escapeHtml(item.supplier)}</td>
                <td data-label="Stock">${item.stock}</td>
                <td data-label="Status" class="${item.lowStock ? "tone-warning" : "tone-success"}">
                  ${item.lowStock ? "Low" : "OK"}
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSales() {
  elements.salesTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Sale code</th>
          <th>Date</th>
          <th>Cashier</th>
          <th>Customer</th>
          <th>Payment</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${state.data.recentSales
          .map(
            (sale) => `
              <tr>
                <td data-label="Sale code">${escapeHtml(sale.saleCode)}</td>
                <td data-label="Date">${formatDateTime(sale.timestamp)}</td>
                <td data-label="Cashier">${escapeHtml(sale.cashierName)}</td>
                <td data-label="Customer">${escapeHtml(sale.customerName)}</td>
                <td data-label="Payment">${escapeHtml(sale.paymentMethodLabel)}</td>
                <td data-label="Total">${formatCurrency(sale.totalAmount)}</td>
                <td data-label="Receipt">
                  <button class="btn btn-secondary" data-sale-id="${sale.id}" type="button">View</button>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  elements.salesReceipt.innerHTML = state.selectedReceipt
    ? renderReceiptCard(state.selectedReceipt)
    : `<div class="empty-state">Select a sale.</div>`;
}

function renderReports() {
  if (!state.data.reports) {
    elements.reportSummary.innerHTML = `<div class="empty-state">No reports.</div>`;
    elements.productPerformanceTable.innerHTML = "";
    elements.cashierPerformanceTable.innerHTML = "";
    return;
  }

  renderStats(elements.reportSummary, [
    { label: "Daily revenue", value: formatCurrency(state.data.reports.dailyRevenue) },
    { label: "Weekly revenue", value: formatCurrency(state.data.reports.weeklyRevenue) },
    { label: "Transactions today", value: String(state.data.reports.transactionsToday) },
    { label: "Low stock", value: String(state.data.reports.lowStockCount) },
  ]);

  elements.productPerformanceTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Units sold</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.reports.productPerformance
          .map(
            (row) => `
              <tr>
                <td data-label="Product">${escapeHtml(row.productName)}</td>
                <td data-label="Units sold">${row.unitsSold}</td>
                <td data-label="Revenue">${formatCurrency(row.revenue)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  elements.cashierPerformanceTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Cashier</th>
          <th>Transactions</th>
          <th>Total sales</th>
        </tr>
      </thead>
      <tbody>
        ${state.data.reports.cashierPerformance
          .map(
            (row) => `
              <tr>
                <td data-label="Cashier">${escapeHtml(row.cashierName)}</td>
                <td data-label="Transactions">${row.transactions}</td>
                <td data-label="Total sales">${formatCurrency(row.totalSales)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderReceipt(receipt) {
  return `
    <div class="receipt-block">
      <h4>${escapeHtml(receipt.store.name)}</h4>
    </div>
    <div class="receipt-block">
      <div class="receipt-row"><span>Transaction ID</span><strong>${escapeHtml(receipt.sale.saleCode)}</strong></div>
      <div class="receipt-row"><span>Date &amp; time</span><strong>${formatDateTime(receipt.sale.timestamp)}</strong></div>
      <div class="receipt-row"><span>Payment</span><strong>${escapeHtml(receipt.sale.paymentMethodLabel)}</strong></div>
    </div>
    <div class="receipt-block">
      ${receipt.items
        .map(
          (item) => `
            <div class="receipt-row">
              <span>${escapeHtml(item.productName)} × ${item.quantity}</span>
              <strong>${formatCurrency(item.lineTotal)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="receipt-block">
      <div class="receipt-row"><span>Subtotal</span><strong>${formatCurrency(receipt.sale.subtotal)}</strong></div>
      <div class="receipt-row"><span>Discount</span><strong>${formatCurrency(receipt.sale.discountAmount)}</strong></div>
      <div class="receipt-row"><span>Tax</span><strong>${formatCurrency(receipt.sale.taxAmount)}</strong></div>
      <div class="receipt-row"><span>Total amount</span><strong>${formatCurrency(receipt.sale.totalAmount)}</strong></div>
    </div>
  `;
}

function renderReceiptCard(receipt) {
  return `<article class="receipt-paper">${renderReceipt(receipt)}</article>`;
}

function printReceipt() {
  if (!state.data.latestReceipt) {
    setStatus("No receipt is available to print yet.", "error");
    return;
  }

  const popup = window.open("", "_blank", "popup=yes,width=440,height=780,resizable=yes,scrollbars=yes");
  if (!popup) {
    setStatus("Allow pop-ups to open the receipt preview.", "error");
    return;
  }

  const receipt = state.data.latestReceipt;
  popup.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(receipt.sale.saleCode)} Receipt Preview</title>
        <style>
          * { box-sizing: border-box; }
          @page {
            size: 80mm auto;
            margin: 6mm;
          }
          body {
            margin: 0;
            font-family: "Inter", "Segoe UI", sans-serif;
            color: #111827;
            background: #f4f1ea;
          }
          .preview-toolbar {
            position: sticky;
            top: 0;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 16px 20px;
            border-bottom: 1px solid #e6dfd4;
            background: rgba(255, 255, 255, 0.96);
          }
          .preview-toolbar strong {
            color: #181714;
            font-size: 0.95rem;
            display: block;
          }
          .preview-toolbar span {
            color: #6f6a61;
            font-size: 0.82rem;
          }
          .preview-actions {
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .preview-actions button {
            border: 0;
            border-radius: 999px;
            padding: 10px 16px;
            font: inherit;
            cursor: pointer;
          }
          .preview-actions .primary {
            background: #1d5b51;
            color: #ffffff;
          }
          .preview-actions .ghost {
            background: #ffffff;
            color: #181714;
            border: 1px solid #e6dfd4;
          }
          .preview-stage {
            min-height: calc(100vh - 74px);
            display: grid;
            place-items: start center;
            padding: 24px 16px 40px;
          }
          .receipt-sheet {
            width: min(100%, 320px);
            background: #ffffff;
            color: #1f1b17;
            border: 1px solid #e8e0d4;
            border-radius: 16px;
            box-shadow: 0 10px 24px rgba(35, 29, 20, 0.08);
            padding: 24px 20px;
            font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
          }
          .receipt-sheet h4 {
            margin: 0 0 4px;
            font-size: 1rem;
          }
          .summary-row,
          .receipt-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 8px 0;
            border-bottom: 1px dashed #ded5c7;
            font-size: 0.92rem;
          }
          .summary-row:last-child,
          .receipt-row:last-child {
            border-bottom: 0;
          }
          .receipt-block {
            display: grid;
            gap: 6px;
          }
          .receipt-block + .receipt-block {
            margin-top: 18px;
            padding-top: 18px;
            border-top: 1px dashed #ded5c7;
          }
          .muted {
            color: #756f64;
            font-family: "Inter", "Segoe UI", sans-serif;
            font-size: 0.82rem;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .preview-toolbar {
              display: none;
            }
            .preview-stage {
              padding: 0;
            }
            .receipt-sheet {
              width: auto;
              max-width: none;
              border: 0;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="preview-toolbar">
          <div>
            <strong>LION's MARKET POS</strong>
            <span>Receipt preview for ${escapeHtml(receipt.sale.saleCode)}</span>
          </div>
          <div class="preview-actions">
            <button class="ghost" type="button" onclick="window.close()">Close</button>
            <button class="primary" type="button" onclick="window.print()">Print</button>
          </div>
        </div>
        <div class="preview-stage">
          <article class="receipt-sheet">${renderReceipt(receipt)}</article>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
}

function render() {
  renderShell();
  if (!state.session) {
    return;
  }

  renderViews();
  renderPOS();
  if (state.session.viewIds.includes("products")) {
    renderProducts();
  }
  if (state.session.viewIds.includes("customers")) {
    renderCustomers();
  }
  if (state.session.viewIds.includes("users")) {
    renderUsers();
  }
  if (state.session.viewIds.includes("inventory")) {
    renderInventory();
  }
  if (state.session.viewIds.includes("sales")) {
    renderSales();
  }
  if (state.session.viewIds.includes("reports")) {
    renderReports();
  }
}

async function runAction(action, successMessage = "") {
  try {
    await action();
    if (successMessage) {
      setStatus(successMessage, "success");
    }
  } catch (error) {
    setStatus(error.message || "Something went wrong.", "error");
  }
}

function bindEvents() {
  elements.themeToggleBtn?.addEventListener("click", () => {
    toggleTheme();
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setLoginStatus("Signing in...", "info");
      await api("/api/auth/login", {
        method: "POST",
        body: {
          username: elements.loginUsername.value,
          password: elements.loginPassword.value,
        },
      });
      elements.loginPassword.value = "";
      setLoginStatus("", "info");
      await refreshBootstrap("Signed in successfully.");
      await resumePendingPaystackCheckout();
    } catch (error) {
      setLoginStatus(error.message || "Sign-in failed.", "error");
    }
  });

  elements.logoutBtn.addEventListener("click", async () => {
    await runAction(async () => {
      await api("/api/auth/logout", { method: "POST" });
      handleSignedOut("You have been signed out.");
    });
  });

  elements.navTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) {
      return;
    }

    state.activeView = button.dataset.view;
    render();
  });

  elements.productSearch.addEventListener("input", debounce((event) => {
    state.productSearch = event.target.value;
    renderPOS();
  }, 300));

  elements.productSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const barcode = elements.productSearch.value.trim().toLowerCase();
      const product = state.data.products.find(
        (item) => String(item.barcode || "").trim().toLowerCase() === barcode,
      );

      if (!product) {
        return;
      }

      try {
        addToCart(product.id);
        state.productSearch = "";
        elements.productSearch.value = "";
        setStatus(`${product.name} added to cart.`, "success");
        renderPOS();
      } catch (error) {
        setStatus(error.message, "error");
      }
    }
  });

  elements.productCatalog.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (!button) {
      return;
    }

    try {
      addToCart(button.dataset.productId);
      setStatus("Product added to cart.", "success");
      renderPOS();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  elements.cartList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) {
      return;
    }

    const productId = button.dataset.productId;
    const entry = state.cart.items.find((item) => item.productId === productId);
    if (!entry) {
      return;
    }

    try {
      if (button.dataset.cartAction === "remove") {
        updateCartQuantity(productId, 0);
      } else if (button.dataset.cartAction === "increase") {
        updateCartQuantity(productId, entry.quantity + 1);
      } else {
        updateCartQuantity(productId, entry.quantity - 1);
      }
      renderPOS();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  elements.saleCustomer.addEventListener("change", (event) => {
    state.cart.customerId = event.target.value;
    renderPOS();
  });

  elements.discountInput.addEventListener("input", (event) => {
    state.cart.discountRate = event.target.value;
    renderPOS();
  });

  elements.paymentMethod.addEventListener("change", (event) => {
    state.cart.paymentMethod = event.target.value;
    renderPOS();
  });

  elements.amountTendered.addEventListener("input", (event) => {
    state.cart.amountTendered = event.target.value;
    renderPOS();
  });

  elements.clearCartBtn.addEventListener("click", () => {
    resetCart();
    renderPOS();
    setStatus("Active sale cleared.", "success");
  });

  elements.checkoutBtn.addEventListener("click", async () => {
    const cart = getCartSummary();
    await runAction(async () => {
      if (usesPaystack(cart.paymentMethod)) {
        await startPaystackCheckout(cart);
        return;
      }

      await finalizeSale(createCheckoutPayload(cart));
    });
  });

  elements.printReceiptBtn.addEventListener("click", printReceipt);

  elements.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: elements.productName.value,
      category: elements.productCategory.value,
      supplier: elements.productSupplier.value,
      price: elements.productPrice.value,
      stock: elements.productStock.value,
      barcode: elements.productBarcode.value,
      description: elements.productDescription.value,
    };
    const productId = elements.productId.value;

    await runAction(async () => {
      await api(productId ? `/api/products/${productId}` : "/api/products", {
        method: productId ? "PUT" : "POST",
        body: payload,
      });
      state.editingProductId = "";
      elements.productForm.reset();
      await refreshProductsData("Product saved.");
    });
  });

  elements.resetProductFormBtn.addEventListener("click", () => {
    state.editingProductId = "";
    elements.productForm.reset();
    renderProducts();
  });

  elements.productTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-product-action]");
    if (!button) {
      return;
    }

    const productId = button.dataset.productId;
    if (button.dataset.productAction === "edit") {
      state.editingProductId = productId;
      renderProducts();
      return;
    }

    if (!window.confirm("Delete this product from the catalog?")) {
      return;
    }

    await runAction(async () => {
      await api(`/api/products/${productId}`, { method: "DELETE" });
      await refreshProductsData("Product deleted.");
    });
  });

  elements.customerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: elements.customerName.value,
      phone: elements.customerPhone.value,
      email: elements.customerEmail.value,
      address: elements.customerAddress.value,
      loyaltyPoints: elements.customerPoints.value,
    };
    const customerId = elements.customerId.value;

    await runAction(async () => {
      await api(customerId ? `/api/customers/${customerId}` : "/api/customers", {
        method: customerId ? "PUT" : "POST",
        body: payload,
      });
      state.editingCustomerId = "";
      elements.customerForm.reset();
      await refreshCustomersData("Customer saved.");
    });
  });

  elements.resetCustomerFormBtn.addEventListener("click", () => {
    state.editingCustomerId = "";
    elements.customerForm.reset();
    renderCustomers();
  });

  elements.customerTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-customer-action]");
    if (!button) {
      return;
    }

    const customerId = button.dataset.customerId;
    const action = button.dataset.customerAction;

    if (action === "edit") {
      state.editingCustomerId = customerId;
      renderCustomers();
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Delete this customer?")) {
        return;
      }
      await runAction(async () => {
        await api(`/api/customers/${customerId}`, { method: "DELETE" });
        if (state.customerHistoryId === customerId) {
          state.customerHistoryId = "";
          state.customerHistory = [];
        }
        await refreshCustomersData("Customer deleted.");
      });
      return;
    }

    await runAction(async () => {
      state.customerHistory = await api(`/api/customers/${customerId}/history`);
      state.customerHistoryId = customerId;
      renderCustomers();
    });
  });

  elements.userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: elements.userName.value,
      username: elements.userUsername.value,
      role: elements.userRole.value,
      password: elements.userPassword.value,
    };
    const userId = elements.userId.value;
    const isEditingCurrentUser = userId && userId === state.session?.user?.id;
    const nextRole = payload.role;
    const currentRole = state.session?.user?.role || "";
    const roleChanged = isEditingCurrentUser && nextRole !== currentRole;

    await runAction(async () => {
      await api(userId ? `/api/users/${userId}` : "/api/users", {
        method: userId ? "PUT" : "POST",
        body: payload,
      });
      state.editingUserId = "";
      elements.userForm.reset();
      elements.userId.value = "";
      elements.userRole.value = "cashier";

      if (isEditingCurrentUser) {
        state.session.user.name = payload.name;
        state.session.user.username = payload.username;
        state.session.user.role = nextRole;
      }

      if (roleChanged) {
        await refreshBootstrap("User account updated.");
        return;
      }

      await refreshUsersData(userId ? "User account updated." : "User account created.");
    });
  });

  elements.resetUserFormBtn.addEventListener("click", () => {
    state.editingUserId = "";
    elements.userForm.reset();
    elements.userId.value = "";
    elements.userRole.value = "cashier";
    renderUsers();
  });

  elements.userTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-user-action]");
    if (!button) {
      return;
    }

    const userId = button.dataset.userId;
    const user = state.data.users.find((entry) => entry.id === userId);
    const action = button.dataset.userAction;

    if (action === "edit") {
      state.editingUserId = userId;
      renderUsers();
      return;
    }

    const deleteReason = getUserDeleteReason(user);
    if (deleteReason) {
      setStatus(deleteReason, "error");
      return;
    }

    if (!window.confirm(`Delete ${user?.name || "this user"}?`)) {
      return;
    }

    await runAction(async () => {
      await api(`/api/users/${userId}`, { method: "DELETE" });
      if (state.editingUserId === userId) {
        state.editingUserId = "";
      }
      await refreshUsersData("User account deleted.");
    });
  });

  elements.inventoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await api("/api/inventory/adjustments", {
        method: "POST",
        body: {
          productId: elements.inventoryProduct.value,
          mode: elements.inventoryMode.value,
          quantity: elements.inventoryQuantity.value,
          note: elements.inventoryNote.value,
        },
      });
      elements.inventoryForm.reset();
      await refreshInventoryData("Inventory updated.");
    });
  });

  elements.salesTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-sale-id]");
    if (!button) {
      return;
    }

    await runAction(async () => {
      const receipt = await api(`/api/receipts/${button.dataset.saleId}`);
      state.selectedReceiptId = button.dataset.saleId;
      state.selectedReceipt = receipt;
      renderSales();
    });
  });
}

applyTheme(currentTheme, { persist: false });
bindEvents();
loadInitialState();
