export const APP_CONFIG = {
  port: Number(process.env.PORT || 3000),
  mockMode: process.env.MOCK_MODE === "true",
  taxRate: 0.125,
  lowStockThreshold: 6,
  loyaltyPointsPerTenCedis: 1,
  sessionDurationHours: 24,
  currency: "GHS",
  locale: "en-GH",
  storeProfile: {
    name: "LION's MARKET POS",
    location: "Student Innovation Lab",
    phone: "+233 20 555 0147",
  },
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
  paystackCurrency: String(process.env.PAYSTACK_CURRENCY || "GHS").toUpperCase(),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
};

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
];

export const PAYMENT_VALUES = new Set(PAYMENT_METHODS.map((method) => method.value));

export const PAYMENT_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((method) => [method.value, method.label]),
);

export const VIEW_META = {
  pos: {
    label: "POS Terminal",
    description: "Sell products, manage the cart, and finish checkout",
  },
  products: {
    label: "Products",
    description: "Maintain the live product catalog and pricing",
  },
  customers: {
    label: "Customers",
    description: "Track customer details and purchase history",
  },
  users: {
    label: "Users",
    description: "Create and manage POS staff accounts",
  },
  inventory: {
    label: "Inventory",
    description: "Restock items and monitor low-stock products",
  },
  sales: {
    label: "Sales",
    description: "Review recent transactions and open receipts",
  },
  reports: {
    label: "Reports",
    description: "See daily revenue, product performance, and staff sales",
  },
};

export const ROLE_VIEWS = {
  admin: ["pos", "products", "customers", "users", "inventory", "sales", "reports"],
  manager: ["pos", "products", "customers", "inventory", "sales", "reports"],
  cashier: ["pos", "sales"],
};
