import { randomUUID } from "node:crypto";
import { APP_CONFIG, PAYMENT_LABELS, PAYMENT_VALUES, ROLE_VIEWS, VIEW_META } from "./config.js";
import { getPublicPaystackConfig } from "./paystack.js";

function assert(condition, message, statusCode = 400) {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value, fallback = 0) {
  return Math.round(toNumber(value, fallback));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeUsername(value) {
  return cleanText(value).toLowerCase();
}

function makeSaleCode() {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  return `SALE-${stamp}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

function createSeedState() {
  return {
    users: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Afi Mensah",
        username: "admin",
        role: "admin",
        password: "admin123",
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Kojo Owusu",
        username: "manager",
        role: "manager",
        password: "manager123",
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        name: "Lydia Asante",
        username: "cashier",
        role: "cashier",
        password: "cashier123",
      },
    ],
    customers: [
      {
        id: "10000000-0000-0000-0000-000000000001",
        name: "Walk-in Customer",
        phone: "",
        email: "",
        address: "",
        loyaltyPoints: 0,
        isDefault: true,
      },
      {
        id: "10000000-0000-0000-0000-000000000002",
        name: "Ama Owusu",
        phone: "+233 24 555 1010",
        email: "ama.owusu@example.com",
        address: "Madina Estate, Accra",
        loyaltyPoints: 8,
        isDefault: false,
      },
      {
        id: "10000000-0000-0000-0000-000000000003",
        name: "Kwame Mensah",
        phone: "+233 20 555 2020",
        email: "kwame.mensah@example.com",
        address: "KNUST Hall 4, Kumasi",
        loyaltyPoints: 14,
        isDefault: false,
      },
      {
        id: "10000000-0000-0000-0000-000000000004",
        name: "Lydia Boateng",
        phone: "+233 54 555 3030",
        email: "lydia.boateng@example.com",
        address: "Cape Coast Central",
        loyaltyPoints: 4,
        isDefault: false,
      },
    ],
    products: [
      {
        id: "20000000-0000-0000-0000-000000000001",
        name: "Coke 500ml",
        category: "Beverages",
        supplier: "Accra Beverages",
        price: 7.5,
        stock: 22,
        barcode: "100100100101",
        description: "Chilled soft drink bottle",
      },
      {
        id: "20000000-0000-0000-0000-000000000002",
        name: "Bottled Water",
        category: "Beverages",
        supplier: "Blue Springs Ltd",
        price: 4,
        stock: 38,
        barcode: "100100100102",
        description: "500ml drinking water",
      },
      {
        id: "20000000-0000-0000-0000-000000000003",
        name: "Biscuit Pack",
        category: "Snacks",
        supplier: "Golden Grain Foods",
        price: 12,
        stock: 16,
        barcode: "100100100103",
        description: "Family-size biscuit pack",
      },
      {
        id: "20000000-0000-0000-0000-000000000004",
        name: "Rice 5kg",
        category: "Groceries",
        supplier: "Fresh Fields Depot",
        price: 72.5,
        stock: 9,
        barcode: "100100100104",
        description: "Premium long grain rice",
      },
      {
        id: "20000000-0000-0000-0000-000000000005",
        name: "Exercise Book",
        category: "Stationery",
        supplier: "School Supply Hub",
        price: 6.5,
        stock: 44,
        barcode: "100100100105",
        description: "80-page notebook",
      },
      {
        id: "20000000-0000-0000-0000-000000000006",
        name: "Ball Pen",
        category: "Stationery",
        supplier: "School Supply Hub",
        price: 3.25,
        stock: 63,
        barcode: "100100100106",
        description: "Blue ink pen",
      },
      {
        id: "20000000-0000-0000-0000-000000000007",
        name: "USB Flash Drive 16GB",
        category: "Electronics",
        supplier: "Digital Market",
        price: 45,
        stock: 11,
        barcode: "100100100107",
        description: "Portable storage device",
      },
      {
        id: "20000000-0000-0000-0000-000000000008",
        name: "Phone Charger",
        category: "Electronics",
        supplier: "Digital Market",
        price: 65,
        stock: 5,
        barcode: "100100100108",
        description: "Fast charging adapter",
      },
      {
        id: "20000000-0000-0000-0000-000000000009",
        name: "Bread Loaf",
        category: "Bakery",
        supplier: "Sunrise Bakers",
        price: 18,
        stock: 8,
        barcode: "100100100109",
        description: "Freshly baked bread",
      },
      {
        id: "20000000-0000-0000-0000-000000000010",
        name: "Eggs Tray",
        category: "Groceries",
        supplier: "Farm Basket",
        price: 22,
        stock: 4,
        barcode: "100100100110",
        description: "Tray of 12 eggs",
      },
    ],
    sales: [
      {
        id: "30000000-0000-0000-0000-000000000001",
        saleCode: "SALE-20260330-9A2F",
        cashierId: "00000000-0000-0000-0000-000000000003",
        customerId: "10000000-0000-0000-0000-000000000002",
        subtotal: 20,
        discountRate: 0,
        discountAmount: 0,
        taxRate: 0.125,
        taxAmount: 2.5,
        totalAmount: 22.5,
        paymentMethod: "mobile_money",
        amountTendered: 22.5,
        changeDue: 0,
        timestamp: "2026-03-30T10:30:00.000Z",
      },
      {
        id: "30000000-0000-0000-0000-000000000002",
        saleCode: "SALE-20260401-4B18",
        cashierId: "00000000-0000-0000-0000-000000000002",
        customerId: "10000000-0000-0000-0000-000000000003",
        subtotal: 54.75,
        discountRate: 5,
        discountAmount: 2.74,
        taxRate: 0.125,
        taxAmount: 6.5,
        totalAmount: 58.51,
        paymentMethod: "card",
        amountTendered: 58.51,
        changeDue: 0,
        timestamp: "2026-04-01T09:10:00.000Z",
      },
      {
        id: "30000000-0000-0000-0000-000000000003",
        saleCode: "SALE-20260401-7C4D",
        cashierId: "00000000-0000-0000-0000-000000000003",
        customerId: "10000000-0000-0000-0000-000000000004",
        subtotal: 105,
        discountRate: 10,
        discountAmount: 10.5,
        taxRate: 0.125,
        taxAmount: 11.81,
        totalAmount: 106.31,
        paymentMethod: "cash",
        amountTendered: 120,
        changeDue: 13.69,
        timestamp: "2026-04-01T13:45:00.000Z",
      },
    ],
    saleItems: [
      {
        id: "40000000-0000-0000-0000-000000000001",
        saleId: "30000000-0000-0000-0000-000000000001",
        productId: "20000000-0000-0000-0000-000000000002",
        productName: "Bottled Water",
        barcode: "100100100102",
        quantity: 2,
        unitPrice: 4,
        lineTotal: 8,
      },
      {
        id: "40000000-0000-0000-0000-000000000002",
        saleId: "30000000-0000-0000-0000-000000000001",
        productId: "20000000-0000-0000-0000-000000000003",
        productName: "Biscuit Pack",
        barcode: "100100100103",
        quantity: 1,
        unitPrice: 12,
        lineTotal: 12,
      },
      {
        id: "40000000-0000-0000-0000-000000000003",
        saleId: "30000000-0000-0000-0000-000000000002",
        productId: "20000000-0000-0000-0000-000000000007",
        productName: "USB Flash Drive 16GB",
        barcode: "100100100107",
        quantity: 1,
        unitPrice: 45,
        lineTotal: 45,
      },
      {
        id: "40000000-0000-0000-0000-000000000004",
        saleId: "30000000-0000-0000-0000-000000000002",
        productId: "20000000-0000-0000-0000-000000000006",
        productName: "Ball Pen",
        barcode: "100100100106",
        quantity: 3,
        unitPrice: 3.25,
        lineTotal: 9.75,
      },
      {
        id: "40000000-0000-0000-0000-000000000005",
        saleId: "30000000-0000-0000-0000-000000000003",
        productId: "20000000-0000-0000-0000-000000000009",
        productName: "Bread Loaf",
        barcode: "100100100109",
        quantity: 2,
        unitPrice: 18,
        lineTotal: 36,
      },
      {
        id: "40000000-0000-0000-0000-000000000006",
        saleId: "30000000-0000-0000-0000-000000000003",
        productId: "20000000-0000-0000-0000-000000000002",
        productName: "Bottled Water",
        barcode: "100100100102",
        quantity: 1,
        unitPrice: 4,
        lineTotal: 4,
      },
      {
        id: "40000000-0000-0000-0000-000000000007",
        saleId: "30000000-0000-0000-0000-000000000003",
        productId: "20000000-0000-0000-0000-000000000008",
        productName: "Phone Charger",
        barcode: "100100100108",
        quantity: 1,
        unitPrice: 65,
        lineTotal: 65,
      },
    ],
    payments: [
      {
        id: "50000000-0000-0000-0000-000000000001",
        saleId: "30000000-0000-0000-0000-000000000001",
        method: "mobile_money",
        amount: 22.5,
        amountTendered: 22.5,
        changeDue: 0,
        timestamp: "2026-03-30T10:30:00.000Z",
      },
      {
        id: "50000000-0000-0000-0000-000000000002",
        saleId: "30000000-0000-0000-0000-000000000002",
        method: "card",
        amount: 58.51,
        amountTendered: 58.51,
        changeDue: 0,
        timestamp: "2026-04-01T09:10:00.000Z",
      },
      {
        id: "50000000-0000-0000-0000-000000000003",
        saleId: "30000000-0000-0000-0000-000000000003",
        method: "cash",
        amount: 106.31,
        amountTendered: 120,
        changeDue: 13.69,
        timestamp: "2026-04-01T13:45:00.000Z",
      },
    ],
    inventoryLogs: [
      {
        id: "60000000-0000-0000-0000-000000000001",
        productId: "20000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000003",
        actionType: "sale",
        quantityChange: -2,
        note: "Sold in SALE-20260330-9A2F",
        timestamp: "2026-03-30T10:30:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000002",
        productId: "20000000-0000-0000-0000-000000000003",
        userId: "00000000-0000-0000-0000-000000000003",
        actionType: "sale",
        quantityChange: -1,
        note: "Sold in SALE-20260330-9A2F",
        timestamp: "2026-03-30T10:30:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000003",
        productId: "20000000-0000-0000-0000-000000000007",
        userId: "00000000-0000-0000-0000-000000000002",
        actionType: "sale",
        quantityChange: -1,
        note: "Sold in SALE-20260401-4B18",
        timestamp: "2026-04-01T09:10:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000004",
        productId: "20000000-0000-0000-0000-000000000006",
        userId: "00000000-0000-0000-0000-000000000002",
        actionType: "sale",
        quantityChange: -3,
        note: "Sold in SALE-20260401-4B18",
        timestamp: "2026-04-01T09:10:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000005",
        productId: "20000000-0000-0000-0000-000000000009",
        userId: "00000000-0000-0000-0000-000000000003",
        actionType: "sale",
        quantityChange: -2,
        note: "Sold in SALE-20260401-7C4D",
        timestamp: "2026-04-01T13:45:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000006",
        productId: "20000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000003",
        actionType: "sale",
        quantityChange: -1,
        note: "Sold in SALE-20260401-7C4D",
        timestamp: "2026-04-01T13:45:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000007",
        productId: "20000000-0000-0000-0000-000000000008",
        userId: "00000000-0000-0000-0000-000000000003",
        actionType: "sale",
        quantityChange: -1,
        note: "Sold in SALE-20260401-7C4D",
        timestamp: "2026-04-01T13:45:00.000Z",
      },
      {
        id: "60000000-0000-0000-0000-000000000008",
        productId: "20000000-0000-0000-0000-000000000010",
        userId: "00000000-0000-0000-0000-000000000002",
        actionType: "restock",
        quantityChange: 6,
        note: "Morning supplier delivery",
        timestamp: "2026-03-31T11:20:00.000Z",
      },
    ],
  };
}

const state = createSeedState();
const sessions = new Map();

function getUserById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getDefaultCustomer() {
  return state.customers.find((customer) => customer.isDefault) || state.customers[0] || null;
}

function mapUser(user) {
  const salesCount = state.sales.filter((sale) => sale.cashierId === user.id).length;
  const inventoryActions = state.inventoryLogs.filter((entry) => entry.userId === user.id).length;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt || null,
    salesCount,
    inventoryActions,
    hasActivity: salesCount > 0 || inventoryActions > 0,
  };
}

function viewSession(user) {
  const viewIds = ROLE_VIEWS[user.role] ?? ROLE_VIEWS.cashier;
  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
    viewIds,
    views: viewIds.map((id) => ({ id, ...VIEW_META[id] })),
  };
}

function mapProduct(product) {
  return {
    ...clone(product),
    lowStock: product.stock <= APP_CONFIG.lowStockThreshold,
  };
}

function mapSaleSummary(sale) {
  const customer = state.customers.find((entry) => entry.id === sale.customerId);
  const cashier = getUserById(sale.cashierId);
  return {
    id: sale.id,
    saleCode: sale.saleCode,
    timestamp: sale.timestamp,
    subtotal: roundMoney(sale.subtotal),
    discountAmount: roundMoney(sale.discountAmount),
    taxAmount: roundMoney(sale.taxAmount),
    totalAmount: roundMoney(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    paymentMethodLabel: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
    customerName: customer?.name || "Walk-in Customer",
    cashierName: cashier?.name || "Unknown user",
  };
}

function buildReceipt(saleId) {
  const sale = state.sales.find((entry) => entry.id === saleId);
  assert(sale, "Receipt not found.", 404);
  const customer = state.customers.find((entry) => entry.id === sale.customerId) || null;
  const cashier = getUserById(sale.cashierId);
  const payment = state.payments.find((entry) => entry.saleId === sale.id) || null;
  return {
    store: APP_CONFIG.storeProfile,
    settings: {
      currency: APP_CONFIG.currency,
      locale: APP_CONFIG.locale,
      taxRate: APP_CONFIG.taxRate,
      lowStockThreshold: APP_CONFIG.lowStockThreshold,
      paystack: getPublicPaystackConfig(),
    },
    sale: {
      id: sale.id,
      saleCode: sale.saleCode,
      timestamp: sale.timestamp,
      subtotal: roundMoney(sale.subtotal),
      discountRate: roundMoney(sale.discountRate),
      discountAmount: roundMoney(sale.discountAmount),
      taxRate: sale.taxRate,
      taxAmount: roundMoney(sale.taxAmount),
      totalAmount: roundMoney(sale.totalAmount),
      paymentMethod: sale.paymentMethod,
      paymentMethodLabel: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      amountTendered: roundMoney(sale.amountTendered),
      changeDue: roundMoney(sale.changeDue),
      paymentProvider: payment?.provider || null,
      paymentReference: payment?.providerReference || null,
      paymentChannel: payment?.providerChannel || null,
      paymentPaidAt: payment?.providerPaidAt || null,
    },
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        }
      : null,
    cashier: cashier
      ? {
          id: cashier.id,
          name: cashier.name,
        }
      : null,
    items: state.saleItems
      .filter((item) => item.saleId === sale.id)
      .map((item) => ({
        id: item.id,
        productName: item.productName,
        barcode: item.barcode,
        quantity: item.quantity,
        unitPrice: roundMoney(item.unitPrice),
        lineTotal: roundMoney(item.lineTotal),
      })),
  };
}

export async function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (new Date(session.expiresAt).getTime() <= now) {
      sessions.delete(sessionId);
    }
  }
}

export async function loginUser(username, password) {
  const normalizedUsername = cleanText(username).toLowerCase();
  const user = state.users.find(
    (entry) => entry.username.toLowerCase() === normalizedUsername,
  );
  assert(user, "User account not found.", 401);
  assert(user.password === cleanText(password), "Incorrect password.", 401);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export async function createSession(userId) {
  const expiresAt = new Date(
    Date.now() + APP_CONFIG.sessionDurationHours * 60 * 60 * 1000,
  );
  const session = {
    id: randomUUID(),
    userId,
    expiresAt: expiresAt.toISOString(),
  };
  sessions.set(session.id, session);
  return {
    id: session.id,
    expiresAt,
  };
}

export async function deleteSession(sessionId) {
  if (sessionId) {
    sessions.delete(sessionId);
  }
}

export async function findUserBySession(sessionId) {
  await cleanupExpiredSessions();
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  const user = getUserById(session.userId);
  if (!user) {
    sessions.delete(sessionId);
    return null;
  }
  return {
    sessionId,
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export async function listProducts(searchTerm = "") {
  const query = cleanText(searchTerm).toLowerCase();
  return state.products
    .filter((product) => {
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
    })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(mapProduct);
}

export async function listCustomers() {
  return state.customers
    .map((customer) => {
      const sales = state.sales.filter((sale) => sale.customerId === customer.id);
      return {
        ...clone(customer),
        visits: sales.length,
        totalSpent: roundMoney(sales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
        lastPurchase: sales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp || null,
      };
    })
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

export async function listUsers() {
  return state.users
    .map(mapUser)
    .sort((left, right) => {
      const roleOrder = { admin: 0, manager: 1, cashier: 2 };
      const roleDelta = (roleOrder[left.role] ?? 9) - (roleOrder[right.role] ?? 9);
      if (roleDelta !== 0) {
        return roleDelta;
      }

      return left.name.localeCompare(right.name);
    });
}

export async function listInventory() {
  const unitsSold = new Map();
  for (const item of state.saleItems) {
    unitsSold.set(item.productId, (unitsSold.get(item.productId) || 0) + item.quantity);
  }
  return state.products
    .map((product) => ({
      ...mapProduct(product),
      unitsSold: unitsSold.get(product.id) || 0,
      stockValue: roundMoney(product.stock * product.price),
    }))
    .sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name));
}

export async function listRecentSales(user, limit = 12) {
  return state.sales
    .filter((sale) => user.role !== "cashier" || sale.cashierId === user.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
    .map(mapSaleSummary);
}

export async function getCustomerHistory(customerId) {
  return state.sales
    .filter((sale) => sale.customerId === customerId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((sale) => ({
      ...mapSaleSummary(sale),
      items: state.saleItems
        .filter((item) => item.saleId === sale.id)
        .map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          lineTotal: roundMoney(item.lineTotal),
        })),
    }));
}

export async function fetchBootstrapData(user) {
  const recentSales = await listRecentSales(user, 16);
  return {
    session: viewSession(user),
    store: APP_CONFIG.storeProfile,
    settings: {
      currency: APP_CONFIG.currency,
      locale: APP_CONFIG.locale,
      taxRate: APP_CONFIG.taxRate,
      lowStockThreshold: APP_CONFIG.lowStockThreshold,
      paystack: getPublicPaystackConfig(),
    },
    products: await listProducts(),
    customers: await listCustomers(),
    users: user.role === "admin" ? await listUsers() : [],
    recentSales,
    inventory: user.role === "cashier" ? [] : await listInventory(),
    reports: user.role === "cashier" ? null : await getReports(),
    latestReceipt: recentSales[0] ? await getReceiptBySaleId(recentSales[0].id, user) : null,
  };
}

export async function upsertProduct(payload, user) {
  const input = {
    id: cleanText(payload.id),
    name: cleanText(payload.name),
    category: cleanText(payload.category),
    supplier: cleanText(payload.supplier),
    price: roundMoney(toNumber(payload.price, NaN)),
    stock: Math.max(0, toInteger(payload.stock, NaN)),
    barcode: cleanText(payload.barcode),
    description: cleanText(payload.description),
  };
  assert(input.name && input.category && input.supplier && input.barcode, "Complete all product fields before saving.");
  assert(Number.isFinite(input.price) && input.price > 0, "Product price must be greater than zero.");
  assert(Number.isFinite(input.stock), "Stock quantity must be a valid number.");
  assert(
    !state.products.some((product) => product.barcode === input.barcode && product.id !== input.id),
    "Barcode already belongs to another product.",
  );

  const existing = state.products.find((product) => product.id === input.id);
  if (existing) {
    const previousStock = existing.stock;
    Object.assign(existing, input, { id: existing.id });
    if (previousStock !== input.stock) {
      state.inventoryLogs.push({
        id: randomUUID(),
        productId: existing.id,
        userId: user.id,
        actionType: "adjustment",
        quantityChange: input.stock - previousStock,
        note: "Product stock edited from catalog form",
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  const productId = randomUUID();
  state.products.push({
    ...input,
    id: productId,
  });
  state.inventoryLogs.push({
    id: randomUUID(),
    productId,
    userId: user.id,
    actionType: "create",
    quantityChange: input.stock,
    note: "Product created",
    timestamp: new Date().toISOString(),
  });
}

export async function deleteProduct(productId) {
  assert(!state.saleItems.some((item) => item.productId === productId), "Products with sales history cannot be deleted.");
  const index = state.products.findIndex((product) => product.id === productId);
  assert(index >= 0, "Product not found.", 404);
  state.products.splice(index, 1);
}

export async function upsertCustomer(payload) {
  const input = {
    id: cleanText(payload.id),
    name: cleanText(payload.name),
    phone: cleanText(payload.phone),
    email: cleanText(payload.email),
    address: cleanText(payload.address),
    loyaltyPoints: Math.max(0, toInteger(payload.loyaltyPoints, 0)),
  };
  assert(input.name, "Customer name is required.");

  const existing = state.customers.find((customer) => customer.id === input.id);
  if (existing) {
    assert(!existing.isDefault, "The walk-in customer cannot be edited here.");
    Object.assign(existing, input, { id: existing.id, isDefault: false });
    return;
  }

  state.customers.push({
    ...input,
    id: randomUUID(),
    isDefault: false,
  });
}

export async function deleteCustomer(customerId) {
  const customer = state.customers.find((entry) => entry.id === customerId);
  assert(customer, "Customer not found.", 404);
  assert(!customer.isDefault, "The walk-in customer cannot be deleted.");
  assert(!state.sales.some((sale) => sale.customerId === customerId), "Customers with transaction history cannot be deleted.");
  state.customers = state.customers.filter((entry) => entry.id !== customerId);
}

export async function createUser(payload) {
  const input = {
    name: cleanText(payload.name),
    username: normalizeUsername(payload.username),
    role: cleanText(payload.role).toLowerCase(),
    password: cleanText(payload.password),
  };

  assert(input.name, "Full name is required.");
  assert(input.username, "Username is required.");
  assert(!/\s/.test(input.username), "Username cannot contain spaces.");
  assert(["admin", "manager", "cashier"].includes(input.role), "Choose a valid user role.");
  assert(input.password.length >= 6, "Password must be at least 6 characters long.");
  assert(
    !state.users.some((user) => user.username.toLowerCase() === input.username),
    "Username already belongs to another user.",
  );

  state.users.push({
    id: randomUUID(),
    name: input.name,
    username: input.username,
    role: input.role,
    password: input.password,
    createdAt: new Date().toISOString(),
  });
}

export async function updateUser(payload) {
  const input = {
    id: cleanText(payload.id),
    name: cleanText(payload.name),
    username: normalizeUsername(payload.username),
    role: cleanText(payload.role).toLowerCase(),
    password: cleanText(payload.password),
  };

  assert(input.id, "User account not found.", 404);
  assert(input.name, "Full name is required.");
  assert(input.username, "Username is required.");
  assert(!/\s/.test(input.username), "Username cannot contain spaces.");
  assert(["admin", "manager", "cashier"].includes(input.role), "Choose a valid user role.");
  assert(!input.password || input.password.length >= 6, "Password must be at least 6 characters long.");

  const user = state.users.find((entry) => entry.id === input.id);
  assert(user, "User account not found.", 404);

  assert(
    !state.users.some((entry) => entry.id !== input.id && entry.username.toLowerCase() === input.username),
    "Username already belongs to another user.",
  );

  if (user.role === "admin" && input.role !== "admin") {
    assert(
      state.users.filter((entry) => entry.role === "admin").length > 1,
      "Keep at least one admin account on the system.",
    );
  }

  user.name = input.name;
  user.username = input.username;
  user.role = input.role;
  if (input.password) {
    user.password = input.password;
  }
}

export async function deleteUser(userId, actor) {
  const user = state.users.find((entry) => entry.id === userId);
  assert(user, "User account not found.", 404);
  assert(user.id !== actor.id, "You cannot delete your own account while signed in.");

  if (user.role === "admin") {
    assert(
      state.users.filter((entry) => entry.role === "admin").length > 1,
      "Keep at least one admin account on the system.",
    );
  }

  assert(
    !state.sales.some((sale) => sale.cashierId === userId) &&
      !state.inventoryLogs.some((entry) => entry.userId === userId),
    "Users with sales or inventory history cannot be deleted.",
  );

  state.users = state.users.filter((entry) => entry.id !== userId);

  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(sessionId);
    }
  }
}

export async function adjustInventory(payload, user) {
  const product = state.products.find((entry) => entry.id === cleanText(payload.productId));
  assert(product, "Selected product was not found.", 404);
  const mode = cleanText(payload.mode) === "set" ? "set" : "restock";
  const quantity = Math.max(0, toInteger(payload.quantity, NaN));
  assert(Number.isFinite(quantity), "Enter a valid inventory quantity.");
  assert(mode !== "restock" || quantity > 0, "Restock quantity must be greater than zero.");

  const previousStock = product.stock;
  product.stock = mode === "restock" ? product.stock + quantity : quantity;
  state.inventoryLogs.push({
    id: randomUUID(),
    productId: product.id,
    userId: user.id,
    actionType: mode === "restock" ? "restock" : "adjustment",
    quantityChange: product.stock - previousStock,
    note: cleanText(payload.note) || "Manual inventory update",
    timestamp: new Date().toISOString(),
  });
}

export async function getReceiptBySaleId(saleId, user) {
  const sale = state.sales.find((entry) => entry.id === saleId);
  assert(sale, "Receipt not found.", 404);
  if (user.role === "cashier") {
    assert(sale.cashierId === user.id, "You can only view your own receipts.", 403);
  }
  return buildReceipt(saleId);
}

export async function checkoutSale(payload, user) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const normalizedItems = items
    .map((item) => ({
      productId: cleanText(item.productId),
      quantity: Math.max(0, toInteger(item.quantity, 0)),
    }))
    .filter((item) => item.productId && item.quantity > 0);

  assert(normalizedItems.length > 0, "Add at least one product before checkout.");
  const discountRate = clamp(roundMoney(toNumber(payload.discountRate, 0)), 0, 50);
  const paymentMethod = PAYMENT_VALUES.has(payload.paymentMethod)
    ? payload.paymentMethod
    : "cash";

  const lineItems = normalizedItems.map((item) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    assert(product, "One or more products could not be found.");
    assert(product.stock >= item.quantity, `Only ${product.stock} unit(s) of ${product.name} available.`);
    return {
      product,
      quantity: item.quantity,
      lineTotal: roundMoney(product.price * item.quantity),
    };
  });

  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = roundMoney(subtotal * (discountRate / 100));
  const taxableAmount = roundMoney(subtotal - discountAmount);
  const taxAmount = roundMoney(taxableAmount * APP_CONFIG.taxRate);
  const totalAmount = roundMoney(taxableAmount + taxAmount);
  const amountTendered = paymentMethod === "cash"
    ? roundMoney(toNumber(payload.amountTendered, 0))
    : totalAmount;

  assert(paymentMethod !== "cash" || amountTendered >= totalAmount, "Amount tendered cannot be less than the total amount.");

  const customer =
    state.customers.find((entry) => entry.id === cleanText(payload.customerId)) || getDefaultCustomer();
  const timestamp = new Date().toISOString();
  const saleId = randomUUID();
  const saleCode = makeSaleCode();
  const changeDue = roundMoney(Math.max(amountTendered - totalAmount, 0));
  const providerReference = cleanText(
    payload.paymentReference ||
      payload.paymentVerification?.reference ||
      payload.paymentVerification?.transaction_reference,
  );
  const providerChannel = cleanText(payload.paymentVerification?.channel || "");
  const providerPaidAt = payload.paymentVerification?.paid_at || payload.paymentVerification?.paidAt || null;
  const paymentProvider = providerReference ? "paystack" : null;

  state.sales.push({
    id: saleId,
    saleCode,
    cashierId: user.id,
    customerId: customer?.id || null,
    subtotal,
    discountRate,
    discountAmount,
    taxRate: APP_CONFIG.taxRate,
    taxAmount,
    totalAmount,
    paymentMethod,
    amountTendered,
    changeDue,
    timestamp,
  });

  for (const item of lineItems) {
    item.product.stock -= item.quantity;
    state.saleItems.push({
      id: randomUUID(),
      saleId,
      productId: item.product.id,
      productName: item.product.name,
      barcode: item.product.barcode,
      quantity: item.quantity,
      unitPrice: item.product.price,
      lineTotal: item.lineTotal,
    });
    state.inventoryLogs.push({
      id: randomUUID(),
      productId: item.product.id,
      userId: user.id,
      actionType: "sale",
      quantityChange: item.quantity * -1,
      note: `Sold in ${saleCode}`,
      timestamp,
    });
  }

  state.payments.push({
    id: randomUUID(),
    saleId,
    method: paymentMethod,
    amount: totalAmount,
    amountTendered,
    changeDue,
    provider: paymentProvider,
    providerReference,
    providerChannel,
    providerPaidAt,
    timestamp,
  });

  if (customer && !customer.isDefault) {
    customer.loyaltyPoints += Math.floor(totalAmount / 10) * APP_CONFIG.loyaltyPointsPerTenCedis;
  }

  return buildReceipt(saleId);
}

export async function getReports() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeklySales = state.sales.filter((sale) => new Date(sale.timestamp) >= sevenDaysAgo);
  const dailySales = state.sales.filter((sale) => new Date(sale.timestamp) >= startOfToday);
  const productPerformance = new Map();
  const cashierPerformance = new Map();

  for (const item of state.saleItems) {
    const current = productPerformance.get(item.productId) || {
      productId: item.productId,
      productName: item.productName,
      unitsSold: 0,
      revenue: 0,
    };
    current.unitsSold += item.quantity;
    current.revenue = roundMoney(current.revenue + item.lineTotal);
    productPerformance.set(item.productId, current);
  }

  for (const sale of state.sales) {
    const cashier = getUserById(sale.cashierId);
    const current = cashierPerformance.get(sale.cashierId) || {
      cashierId: sale.cashierId,
      cashierName: cashier?.name || "Unknown user",
      transactions: 0,
      totalSales: 0,
    };
    current.transactions += 1;
    current.totalSales = roundMoney(current.totalSales + sale.totalAmount);
    cashierPerformance.set(sale.cashierId, current);
  }

  return {
    dailyRevenue: roundMoney(dailySales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    weeklyRevenue: roundMoney(weeklySales.reduce((sum, sale) => sum + sale.totalAmount, 0)),
    transactionsToday: dailySales.length,
    averageBasket: weeklySales.length
      ? roundMoney(weeklySales.reduce((sum, sale) => sum + sale.totalAmount, 0) / weeklySales.length)
      : 0,
    lowStockCount: state.products.filter((product) => product.stock <= APP_CONFIG.lowStockThreshold).length,
    inventoryValue: roundMoney(state.products.reduce((sum, product) => sum + product.stock * product.price, 0)),
    productPerformance: [...productPerformance.values()].sort((left, right) => right.revenue - left.revenue).slice(0, 8),
    cashierPerformance: [...cashierPerformance.values()].sort((left, right) => right.totalSales - left.totalSales),
  };
}
