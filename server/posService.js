import { randomBytes, randomUUID } from "node:crypto";
import { APP_CONFIG, PAYMENT_LABELS, PAYMENT_VALUES, ROLE_VIEWS, VIEW_META } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { createSessionRecord, hashPassword, verifyPassword } from "./auth.js";
import {
  getPublicPaystackConfig,
  isPaystackEnabled,
  usesPaystack,
  verifyPaystackTransaction,
} from "./paystack.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanOptionalText(value) {
  return cleanText(value);
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizeUsername(value) {
  return cleanText(value).toLowerCase();
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

function makeSaleCode() {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `SALE-${stamp}-${suffix}`;
}

function assert(condition, message, statusCode = 400) {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  }
}

function mapViewPermissions(user) {
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

function mapProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    supplier: row.supplier,
    price: roundMoney(row.price),
    stock: row.stock,
    barcode: row.barcode,
    description: row.description,
    lowStock: row.stock <= APP_CONFIG.lowStockThreshold,
  };
}

function mapRecentSaleRow(row) {
  return {
    id: row.id,
    saleCode: row.saleCode,
    timestamp: row.timestamp,
    subtotal: roundMoney(row.subtotal),
    discountAmount: roundMoney(row.discountAmount),
    taxAmount: roundMoney(row.taxAmount),
    totalAmount: roundMoney(row.totalAmount),
    paymentMethod: row.paymentMethod,
    paymentMethodLabel: PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod,
    customerName: row.customerName || "Walk-in Customer",
    cashierName: row.cashierName,
  };
}

function mapReceiptSaleRow(row) {
  return {
    id: row.id,
    saleCode: row.saleCode,
    timestamp: row.timestamp,
    subtotal: roundMoney(row.subtotal),
    discountRate: roundMoney(row.discountRate),
    discountAmount: roundMoney(row.discountAmount),
    taxRate: Number(row.taxRate),
    taxAmount: roundMoney(row.taxAmount),
    totalAmount: roundMoney(row.totalAmount),
    paymentMethod: row.paymentMethod,
    paymentMethodLabel: PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod,
    amountTendered: roundMoney(row.amountTendered),
    changeDue: roundMoney(row.changeDue),
    paymentProvider: row.paymentProvider,
    paymentReference: row.paymentReference,
    paymentChannel: row.paymentChannel,
    paymentPaidAt: row.paymentPaidAt,
  };
}

function mapUserRow(row) {
  const salesCount = Number(row.salesCount || 0);
  const inventoryActions = Number(row.inventoryActions || 0);

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt,
    salesCount,
    inventoryActions,
    hasActivity: salesCount > 0 || inventoryActions > 0,
  };
}

async function getDefaultCustomer(client = pool) {
  const { rows } = await client.query(
    `select id, name, phone, email, address, loyalty_points as "loyaltyPoints", is_default as "isDefault"
     from customers
     where is_default = true
     limit 1`,
  );

  return rows[0] ?? null;
}

export async function loginUser(username, password) {
  const normalizedUsername = cleanText(username).toLowerCase();
  assert(normalizedUsername, "Username is required.");
  assert(cleanText(password), "Password is required.");

  const { rows } = await pool.query(
    `select id, name, username, role, password_hash as "passwordHash"
     from users
     where lower(username) = $1
     limit 1`,
    [normalizedUsername],
  );

  const user = rows[0];
  assert(user, "User account not found.", 401);

  if (user.passwordHash === "supabase_auth_managed") {
    // If it's a Supabase-managed account, verify via Supabase Auth API
    if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) {
      throw new Error("Supabase Auth API keys are missing in .env. Please add SUPABASE_URL and SUPABASE_ANON_KEY.");
    }

    const response = await fetch(`${APP_CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": APP_CONFIG.supabaseAnonKey,
      },
      body: JSON.stringify({
        email: normalizedUsername,
        password: password,
      }),
    });

    if (!response.ok) {
      throw new Error("Invalid Supabase account credentials.", 401);
    }
  } else {
    // Otherwise, verify via local hashing
    assert(verifyPassword(password, user.passwordHash), "Incorrect password.", 401);
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export async function createSession(userId) {
  const session = createSessionRecord();
  await pool.query(
    `insert into user_sessions (id, user_id, expires_at)
     values ($1, $2, $3)`,
    [session.id, userId, session.expiresAt.toISOString()],
  );

  return session;
}

export async function deleteSession(sessionId) {
  if (!sessionId) {
    return;
  }

  await pool.query(`delete from user_sessions where id = $1`, [sessionId]);
}

export async function cleanupExpiredSessions() {
  await pool.query(`delete from user_sessions where expires_at <= now()`);
}

export async function findUserBySession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const { rows } = await pool.query(
    `select u.id, u.name, u.username, u.role, s.id as "sessionId", s.expires_at as "expiresAt"
     from user_sessions s
     join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()
     limit 1`,
    [sessionId],
  );

  return rows[0] ?? null;
}

export async function listProducts(searchTerm = "") {
  const search = cleanText(searchTerm);
  const values = [];
  let whereClause = "";

  if (search) {
    values.push(`%${search}%`);
    whereClause = `
      where concat_ws(' ', name, category, supplier, barcode, description) ilike $1
    `;
  }

  const { rows } = await pool.query(
    `select
       p.id,
       p.name,
       p.category,
       p.supplier,
       p.price,
       coalesce(i.quantity, 0) as stock,
       p.barcode,
       p.description
     from products p
     left join inventory i on i.product_id = p.id
     ${whereClause}
     order by p.name asc`,
    values,
  );

  return rows.map(mapProductRow);
}

export async function listCustomers() {
  const { rows } = await pool.query(
    `select
       c.id,
       c.name,
       c.phone,
       c.email,
       c.address,
       c.loyalty_points as "loyaltyPoints",
       c.is_default as "isDefault",
       coalesce(count(s.id), 0)::int as visits,
       coalesce(sum(s.total_amount), 0) as "totalSpent",
       max(s.created_at) as "lastPurchase"
     from customers c
     left join sales s on s.customer_id = c.id
     group by c.id
     order by c.is_default desc, c.name asc`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    loyaltyPoints: row.loyaltyPoints,
    isDefault: row.isDefault,
    visits: row.visits,
    totalSpent: roundMoney(row.totalSpent),
    lastPurchase: row.lastPurchase,
  }));
}

export async function listUsers() {
  const { rows } = await pool.query(
    `select
       u.id,
       u.name,
       u.username,
       u.role,
       u.created_at as "createdAt",
       coalesce(s.sales_count, 0)::int as "salesCount",
       coalesce(i.inventory_actions, 0)::int as "inventoryActions"
     from users u
     left join (
       select cashier_id, count(*)::int as sales_count
       from sales
       group by cashier_id
     ) s on s.cashier_id = u.id
     left join (
       select user_id, count(*)::int as inventory_actions
       from inventory_logs
       group by user_id
     ) i on i.user_id = u.id
     order by
       case u.role
         when 'admin' then 0
         when 'manager' then 1
         else 2
       end,
       u.name asc`,
  );

  return rows.map(mapUserRow);
}

export async function listInventory() {
  const { rows } = await pool.query(
    `select
       p.id,
       p.name,
       p.category,
       p.supplier,
       p.price,
       coalesce(i.quantity, 0) as stock,
       p.barcode,
       coalesce(sum(si.quantity), 0)::int as "unitsSold"
     from products p
     left join inventory i on i.product_id = p.id
     left join sale_items si on si.product_id = p.id
     group by p.id, i.quantity
     order by coalesce(i.quantity, 0) asc, p.name asc`,
  );

  return rows.map((row) => ({
    ...mapProductRow({
      ...row,
      description: "",
    }),
    unitsSold: row.unitsSold,
    stockValue: roundMoney(row.stock * row.price),
  }));
}

export async function listRecentSales(user, limit = 12) {
  const values = [limit];
  let whereClause = "";

  if (user.role === "cashier") {
    values.unshift(user.id);
    whereClause = "where s.cashier_id = $1";
  }

  const limitPlaceholder = user.role === "cashier" ? "$2" : "$1";
  const { rows } = await pool.query(
    `select
       s.id,
       s.sale_code as "saleCode",
       s.created_at as timestamp,
       s.subtotal,
       s.discount_amount as "discountAmount",
       s.tax_amount as "taxAmount",
       s.total_amount as "totalAmount",
       s.payment_method as "paymentMethod",
       c.name as "customerName",
       u.name as "cashierName"
     from sales s
     left join customers c on c.id = s.customer_id
     join users u on u.id = s.cashier_id
     ${whereClause}
     order by s.created_at desc
     limit ${limitPlaceholder}`,
    values,
  );

  return rows.map(mapRecentSaleRow);
}

export async function getCustomerHistory(customerId) {
  const { rows: sales } = await pool.query(
    `select
       s.id,
       s.sale_code as "saleCode",
       s.created_at as timestamp,
       s.total_amount as "totalAmount",
       s.payment_method as "paymentMethod",
       u.name as "cashierName"
     from sales s
     join users u on u.id = s.cashier_id
     where s.customer_id = $1
     order by s.created_at desc`,
    [customerId],
  );

  const saleIds = sales.map((sale) => sale.id);
  if (!saleIds.length) {
    return [];
  }

  const { rows: items } = await pool.query(
    `select
       id,
       sale_id as "saleId",
       product_name as "productName",
       quantity,
       line_total as "lineTotal"
     from sale_items
     where sale_id = any($1::uuid[])
     order by sale_id asc, product_name asc`,
    [saleIds],
  );

  const itemsBySaleId = items.reduce((map, item) => {
    const bucket = map.get(item.saleId) ?? [];
    bucket.push({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      lineTotal: roundMoney(item.lineTotal),
    });
    map.set(item.saleId, bucket);
    return map;
  }, new Map());

  return sales.map((sale) => ({
    ...mapRecentSaleRow({
      ...sale,
      subtotal: sale.totalAmount,
      discountAmount: 0,
      taxAmount: 0,
      customerName: "",
    }),
    items: itemsBySaleId.get(sale.id) ?? [],
  }));
}

async function buildReceipt(client, saleId) {
  const { rows: saleRows } = await client.query(
    `select
       s.id,
       s.sale_code as "saleCode",
       s.created_at as timestamp,
       s.subtotal,
       s.discount_rate as "discountRate",
       s.discount_amount as "discountAmount",
       s.tax_rate as "taxRate",
       s.tax_amount as "taxAmount",
       s.total_amount as "totalAmount",
       s.payment_method as "paymentMethod",
       s.amount_tendered as "amountTendered",
       s.change_due as "changeDue",
       c.id as "customerId",
       c.name as "customerName",
       c.phone as "customerPhone",
       u.id as "cashierId",
       u.name as "cashierName",
       p.provider as "paymentProvider",
       p.provider_reference as "paymentReference",
       p.provider_channel as "paymentChannel",
       p.provider_paid_at as "paymentPaidAt"
     from sales s
     left join customers c on c.id = s.customer_id
     join users u on u.id = s.cashier_id
     left join payments p on p.sale_id = s.id
     where s.id = $1
     limit 1`,
    [saleId],
  );

  const saleRow = saleRows[0];
  assert(saleRow, "Receipt not found.", 404);

  const { rows: itemRows } = await client.query(
    `select
       id,
       product_name as "productName",
       barcode,
       quantity,
       unit_price as "unitPrice",
       line_total as "lineTotal"
     from sale_items
     where sale_id = $1
     order by product_name asc`,
    [saleId],
  );

  return {
    store: APP_CONFIG.storeProfile,
    settings: {
      currency: APP_CONFIG.currency,
      locale: APP_CONFIG.locale,
      taxRate: APP_CONFIG.taxRate,
      lowStockThreshold: APP_CONFIG.lowStockThreshold,
      paystack: getPublicPaystackConfig(),
    },
    sale: mapReceiptSaleRow(saleRow),
    customer: saleRow.customerId
      ? {
          id: saleRow.customerId,
          name: saleRow.customerName,
          phone: saleRow.customerPhone,
        }
      : null,
    cashier: {
      id: saleRow.cashierId,
      name: saleRow.cashierName,
    },
    items: itemRows.map((row) => ({
      id: row.id,
      productName: row.productName,
      barcode: row.barcode,
      quantity: row.quantity,
      unitPrice: roundMoney(row.unitPrice),
      lineTotal: roundMoney(row.lineTotal),
    })),
  };
}

export async function getReceiptBySaleId(saleId, user) {
  const { rows } = await pool.query(
    `select cashier_id as "cashierId" from sales where id = $1 limit 1`,
    [saleId],
  );

  assert(rows[0], "Receipt not found.", 404);
  if (user.role === "cashier") {
    assert(rows[0].cashierId === user.id, "You can only view your own receipts.", 403);
  }

  return buildReceipt(pool, saleId);
}

export async function getReports() {
  const [
    daily,
    weekly,
    todayCount,
    averageBasket,
    lowStock,
    inventoryValue,
    productPerformance,
    cashierPerformance,
  ] = await Promise.all([
    pool.query(`select coalesce(sum(total_amount), 0) as total from sales where created_at >= date_trunc('day', now())`),
    pool.query(`select coalesce(sum(total_amount), 0) as total from sales where created_at >= now() - interval '7 day'`),
    pool.query(`select count(*)::int as count from sales where created_at >= date_trunc('day', now())`),
    pool.query(`select coalesce(avg(total_amount), 0) as average from sales where created_at >= now() - interval '7 day'`),
    pool.query(
      `select count(*)::int as count
       from inventory
       where quantity <= low_stock_threshold`,
    ),
    pool.query(
      `select coalesce(sum(p.price * i.quantity), 0) as total
       from inventory i
       join products p on p.id = i.product_id`,
    ),
    pool.query(
      `select
         coalesce(si.product_id::text, md5(si.product_name)) as "productKey",
         si.product_name as "productName",
         sum(si.quantity)::int as "unitsSold",
         coalesce(sum(si.line_total), 0) as revenue
       from sale_items si
       group by coalesce(si.product_id::text, md5(si.product_name)), si.product_name
       order by revenue desc
       limit 8`,
    ),
    pool.query(
      `select
         u.id as "cashierId",
         u.name as "cashierName",
         count(s.id)::int as transactions,
         coalesce(sum(s.total_amount), 0) as "totalSales"
       from sales s
       join users u on u.id = s.cashier_id
       group by u.id
       order by "totalSales" desc`,
    ),
  ]);

  return {
    dailyRevenue: roundMoney(daily.rows[0].total),
    weeklyRevenue: roundMoney(weekly.rows[0].total),
    transactionsToday: todayCount.rows[0].count,
    averageBasket: roundMoney(averageBasket.rows[0].average),
    lowStockCount: lowStock.rows[0].count,
    inventoryValue: roundMoney(inventoryValue.rows[0].total),
    productPerformance: productPerformance.rows.map((row) => ({
      productId: row.productKey,
      productName: row.productName,
      unitsSold: row.unitsSold,
      revenue: roundMoney(row.revenue),
    })),
    cashierPerformance: cashierPerformance.rows.map((row) => ({
      cashierId: row.cashierId,
      cashierName: row.cashierName,
      transactions: row.transactions,
      totalSales: roundMoney(row.totalSales),
    })),
  };
}

export async function fetchBootstrapData(user) {
  const [products, customers, recentSales] = await Promise.all([
    listProducts(),
    listCustomers(),
    listRecentSales(user),
  ]);

  const response = {
    session: mapViewPermissions(user),
    store: APP_CONFIG.storeProfile,
    settings: {
      currency: APP_CONFIG.currency,
      locale: APP_CONFIG.locale,
      taxRate: APP_CONFIG.taxRate,
      lowStockThreshold: APP_CONFIG.lowStockThreshold,
      paystack: getPublicPaystackConfig(),
    },
    products,
    customers,
    users: [],
    recentSales,
    inventory: [],
    reports: null,
    latestReceipt: null,
  };

  if (user.role !== "cashier") {
    const [inventory, reports] = await Promise.all([listInventory(), getReports()]);
    response.inventory = inventory;
    response.reports = reports;
  }

  if (user.role === "admin") {
    response.users = await listUsers();
  }

  if (recentSales[0]) {
    response.latestReceipt = await getReceiptBySaleId(recentSales[0].id, user);
  }

  return response;
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
    description: cleanOptionalText(payload.description),
  };

  assert(input.name && input.category && input.supplier && input.barcode, "Complete all product fields before saving.");
  assert(Number.isFinite(input.price) && input.price > 0, "Product price must be greater than zero.");
  assert(Number.isFinite(input.stock), "Stock quantity must be a valid number.");

  return withTransaction(async (client) => {
    const { rows: barcodeRows } = await client.query(
      `select id from products where barcode = $1 and ($2::uuid is null or id <> $2::uuid) limit 1`,
      [input.barcode, input.id || null],
    );
    assert(!barcodeRows[0], "Barcode already belongs to another product.");

    if (input.id) {
      const { rows: existingRows } = await client.query(
        `select
           p.id,
           coalesce(i.quantity, 0) as stock
         from products p
         left join inventory i on i.product_id = p.id
         where p.id = $1
         limit 1`,
        [input.id],
      );
      const existing = existingRows[0];
      assert(existing, "Product not found.", 404);

      await client.query(
        `update products
         set name = $2,
             category = $3,
             supplier = $4,
             price = $5,
             barcode = $6,
             description = $7
         where id = $1`,
        [
          input.id,
          input.name,
          input.category,
          input.supplier,
          input.price,
          input.barcode,
          input.description,
        ],
      );

      await client.query(
        `insert into inventory (product_id, quantity, low_stock_threshold, updated_at)
         values ($1, $2, $3, now())
         on conflict (product_id)
         do update
           set quantity = excluded.quantity,
               updated_at = now()`,
        [input.id, input.stock, APP_CONFIG.lowStockThreshold],
      );

      if (existing.stock !== input.stock) {
        await client.query(
          `insert into inventory_logs (id, product_id, user_id, action_type, quantity_change, note)
           values ($1, $2, $3, 'adjustment', $4, $5)`,
          [
            randomUUID(),
            input.id,
            user.id,
            input.stock - existing.stock,
            "Product stock edited from catalog form",
          ],
        );
      }
    } else {
      const productId = randomUUID();
      await client.query(
        `insert into products (id, name, category, supplier, price, barcode, description)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          productId,
          input.name,
          input.category,
          input.supplier,
          input.price,
          input.barcode,
          input.description,
        ],
      );

      await client.query(
        `insert into inventory (product_id, quantity, low_stock_threshold)
         values ($1, $2, $3)`,
        [productId, input.stock, APP_CONFIG.lowStockThreshold],
      );

      await client.query(
        `insert into inventory_logs (id, product_id, user_id, action_type, quantity_change, note)
         values ($1, $2, $3, 'create', $4, $5)`,
        [randomUUID(), productId, user.id, input.stock, "Product created"],
      );
    }
  });
}

export async function deleteProduct(productId) {
  return withTransaction(async (client) => {
    const { rows: usedRows } = await client.query(
      `select 1 from sale_items where product_id = $1 limit 1`,
      [productId],
    );
    assert(!usedRows[0], "Products with sales history cannot be deleted.");

    const result = await client.query(`delete from products where id = $1`, [productId]);
    assert(result.rowCount > 0, "Product not found.", 404);
  });
}

export async function upsertCustomer(payload) {
  const input = {
    id: cleanText(payload.id),
    name: cleanText(payload.name),
    phone: cleanOptionalText(payload.phone),
    email: cleanOptionalText(payload.email),
    address: cleanOptionalText(payload.address),
    loyaltyPoints: Math.max(0, toInteger(payload.loyaltyPoints, 0)),
  };

  assert(input.name, "Customer name is required.");

  if (input.id) {
    const { rows } = await pool.query(
      `select is_default as "isDefault" from customers where id = $1 limit 1`,
      [input.id],
    );
    const customer = rows[0];
    assert(customer, "Customer not found.", 404);
    assert(!customer.isDefault, "The walk-in customer cannot be edited here.");

    await pool.query(
      `update customers
       set name = $2, phone = $3, email = $4, address = $5, loyalty_points = $6
       where id = $1`,
      [
        input.id,
        input.name,
        input.phone,
        input.email,
        input.address,
        input.loyaltyPoints,
      ],
    );
  } else {
    await pool.query(
      `insert into customers (id, name, phone, email, address, loyalty_points)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        input.name,
        input.phone,
        input.email,
        input.address,
        input.loyaltyPoints,
      ],
    );
  }
}

export async function deleteCustomer(customerId) {
  const { rows } = await pool.query(
    `select is_default as "isDefault" from customers where id = $1 limit 1`,
    [customerId],
  );
  const customer = rows[0];
  assert(customer, "Customer not found.", 404);
  assert(!customer.isDefault, "The walk-in customer cannot be deleted.");

  const { rows: salesRows } = await pool.query(
    `select 1 from sales where customer_id = $1 limit 1`,
    [customerId],
  );
  assert(!salesRows[0], "Customers with transaction history cannot be deleted.");

  await pool.query(`delete from customers where id = $1`, [customerId]);
}

export async function createUser(payload, actor) {
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

  const { rows: existingRows } = await pool.query(
    `select 1 from users where lower(username) = $1 limit 1`,
    [input.username],
  );
  assert(!existingRows[0], "Username already belongs to another user.");

  await pool.query(
    `insert into users (id, name, username, role, password_hash)
     values ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      input.name,
      input.username,
      input.role,
      hashPassword(input.password),
    ],
  );
}

export async function updateUser(payload, actor) {
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

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `select id, role, password_hash as "passwordHash"
       from users
       where id = $1
       limit 1`,
      [input.id],
    );
    const existing = rows[0];
    assert(existing, "User account not found.", 404);

    const { rows: usernameRows } = await client.query(
      `select 1 from users where lower(username) = $1 and id <> $2 limit 1`,
      [input.username, input.id],
    );
    assert(!usernameRows[0], "Username already belongs to another user.");

    if (existing.role === "admin" && input.role !== "admin") {
      const { rows: adminRows } = await client.query(
        `select count(*)::int as count from users where role = 'admin'`,
      );
      assert(adminRows[0].count > 1, "Keep at least one admin account on the system.");
    }

    if (existing.passwordHash === "supabase_auth_managed" && input.password) {
      assert(
        false,
        "Passwords for Supabase-managed accounts must be changed in Supabase Auth.",
      );
    }

    const passwordHash = input.password
      ? hashPassword(input.password)
      : existing.passwordHash;

    await client.query(
      `update users
       set name = $2,
           username = $3,
           role = $4,
           password_hash = $5
       where id = $1`,
      [input.id, input.name, input.username, input.role, passwordHash],
    );
  });
}

export async function deleteUser(userId, actor) {
  const normalizedUserId = cleanText(userId);
  assert(normalizedUserId, "User account not found.", 404);

  const { rows } = await pool.query(
    `select id, name, role from users where id = $1 limit 1`,
    [normalizedUserId],
  );
  const user = rows[0];
  assert(user, "User account not found.", 404);
  assert(user.id !== actor.id, "You cannot delete your own account while signed in.");

  if (user.role === "admin") {
    const { rows: adminRows } = await pool.query(
      `select count(*)::int as count from users where role = 'admin'`,
    );
    assert(adminRows[0].count > 1, "Keep at least one admin account on the system.");
  }

  const [{ rows: salesRows }, { rows: inventoryRows }] = await Promise.all([
    pool.query(`select 1 from sales where cashier_id = $1 limit 1`, [normalizedUserId]),
    pool.query(`select 1 from inventory_logs where user_id = $1 limit 1`, [normalizedUserId]),
  ]);

  assert(
    !salesRows[0] && !inventoryRows[0],
    "Users with sales or inventory history cannot be deleted.",
  );

  await pool.query(`delete from users where id = $1`, [normalizedUserId]);
}

export async function adjustInventory(payload, user) {
  const productId = cleanText(payload.productId);
  const mode = cleanText(payload.mode) === "set" ? "set" : "restock";
  const quantity = Math.max(0, toInteger(payload.quantity, NaN));
  const note = cleanOptionalText(payload.note) || "Manual inventory update";

  assert(productId, "Choose a product before updating inventory.");
  assert(Number.isFinite(quantity), "Enter a valid inventory quantity.");

  return withTransaction(async (client) => {
    const { rows: productRows } = await client.query(
      `select id from products where id = $1 limit 1`,
      [productId],
    );
    const product = productRows[0];
    assert(product, "Selected product was not found.", 404);

    await client.query(
      `insert into inventory (product_id, quantity, low_stock_threshold)
       values ($1, 0, $2)
       on conflict (product_id) do nothing`,
      [productId, APP_CONFIG.lowStockThreshold],
    );

    const { rows } = await client.query(
      `select product_id as id, quantity as stock
       from inventory
       where product_id = $1
       for update`,
      [productId],
    );
    const inventoryRow = rows[0];
    assert(inventoryRow, "Selected product inventory was not found.", 404);

    const previousStock = inventoryRow.stock;
    let nextStock = previousStock;

    if (mode === "restock") {
      assert(quantity > 0, "Restock quantity must be greater than zero.");
      nextStock += quantity;
    } else {
      nextStock = quantity;
    }

    await client.query(`update inventory set quantity = $2, updated_at = now() where product_id = $1`, [
      productId,
      nextStock,
    ]);

    await client.query(
      `insert into inventory_logs (id, product_id, user_id, action_type, quantity_change, note)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        productId,
        user.id,
        mode === "restock" ? "restock" : "adjustment",
        nextStock - previousStock,
        note,
      ],
    );
  });
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

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const discountRate = clamp(roundMoney(toNumber(payload.discountRate, 0)), 0, 50);
  const paymentMethod = PAYMENT_VALUES.has(payload.paymentMethod)
    ? payload.paymentMethod
    : "cash";
  const rawAmountTendered = roundMoney(toNumber(payload.amountTendered, 0));

  return withTransaction(async (client) => {
    await client.query(
      `insert into inventory (product_id, quantity, low_stock_threshold)
       select p.id, 0, $2
       from products p
       where p.id = any($1::uuid[])
       on conflict (product_id) do nothing`,
      [uniqueProductIds, APP_CONFIG.lowStockThreshold],
    );

    const { rows: productRows } = await client.query(
      `select
         p.id,
         p.name,
         p.barcode,
         p.price,
         i.quantity as stock
       from products p
       join inventory i on i.product_id = p.id
       where p.id = any($1::uuid[])
       for update of p, i`,
      [uniqueProductIds],
    );

    assert(
      productRows.length === uniqueProductIds.length,
      "One or more products could not be found.",
    );

    const productMap = new Map(productRows.map((row) => [row.id, row]));
    const lineItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      assert(product, "Product not found.");
      assert(
        product.stock >= item.quantity,
        `Only ${product.stock} unit(s) of ${product.name} available.`,
      );

      return {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: item.quantity,
        unitPrice: roundMoney(product.price),
        lineTotal: roundMoney(product.price * item.quantity),
      };
    });

    const subtotal = roundMoney(
      lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
    );
    const discountAmount = roundMoney(subtotal * (discountRate / 100));
    const taxableAmount = roundMoney(subtotal - discountAmount);
    const taxAmount = roundMoney(taxableAmount * APP_CONFIG.taxRate);
    const totalAmount = roundMoney(taxableAmount + taxAmount);
    let amountTendered = paymentMethod === "cash" ? rawAmountTendered : totalAmount;
    let changeDue = roundMoney(Math.max(amountTendered - totalAmount, 0));
    let paymentProvider = null;
    let paymentProviderReference = null;
    let paymentProviderStatus = null;
    let paymentProviderChannel = null;
    let paymentProviderPaidAt = null;
    let paymentProviderPayload = null;

    assert(
      paymentMethod !== "cash" || amountTendered >= totalAmount,
      "Amount tendered cannot be less than the total amount.",
    );

    const defaultCustomer = await getDefaultCustomer(client);
    const targetCustomerId = cleanText(payload.customerId) || defaultCustomer?.id;
    const { rows: customerRows } = await client.query(
      `select id, is_default as "isDefault" from customers where id = $1 limit 1`,
      [targetCustomerId],
    );
    const customer = customerRows[0] ?? defaultCustomer;
    assert(customer, "A default walk-in customer must exist in the database.");

    if (usesPaystack(paymentMethod)) {
      const requestedReference = cleanText(payload.paymentReference);
      assert(isPaystackEnabled(), "Paystack is not configured on this server.", 503);
      assert(requestedReference, "Complete the Paystack payment before finishing checkout.");

      const verification = payload.paymentVerification || await verifyPaystackTransaction(requestedReference);
      const verifiedStatus = cleanText(verification.status || "");
      const verifiedReference = cleanText(verification.reference || verification.transaction_reference);

      assert(verifiedStatus === "success", "The Paystack payment is not marked as successful.");
      assert(
        verifiedReference === requestedReference,
        "Verified Paystack reference does not match this checkout.",
      );
      assert(
        Number(verification.amount) === Math.round(totalAmount * 100) || Number(verification.amount) === totalAmount,
        "Verified payment amount does not match the sale total.",
      );
      assert(
        cleanText(verification.currency).toUpperCase() === APP_CONFIG.paystackCurrency,
        "Verified payment currency does not match this POS currency.",
      );

      amountTendered = totalAmount;
      changeDue = 0;
      paymentProvider = "paystack";
      paymentProviderReference = verifiedReference;
      paymentProviderStatus = verifiedStatus;
      paymentProviderChannel = cleanText(verification.channel || paymentMethod || "");
      paymentProviderPaidAt = verification.paid_at || verification.paidAt || null;
      paymentProviderPayload = verification;

      const { rows: existingPaymentRows } = await client.query(
        `select sale_id as "saleId"
         from payments
         where provider_reference = $1
         limit 1`,
        [paymentProviderReference],
      );
      assert(
        !existingPaymentRows[0],
        "This Paystack transaction has already been recorded in the POS.",
      );
    }

    const saleId = randomUUID();
    const saleCode = makeSaleCode();

    await client.query(
      `insert into sales (
         id, sale_code, cashier_id, customer_id, subtotal, discount_rate, discount_amount,
         tax_rate, tax_amount, total_amount, payment_method, amount_tendered, change_due
       )
       values (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13
       )`,
      [
        saleId,
        saleCode,
        user.id,
        customer.id,
        subtotal,
        discountRate,
        discountAmount,
        APP_CONFIG.taxRate,
        taxAmount,
        totalAmount,
        paymentMethod,
        amountTendered,
        changeDue,
      ],
    );

    for (const item of lineItems) {
      await client.query(
        `insert into sale_items (
           id, sale_id, product_id, product_name, barcode, quantity, unit_price, line_total
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          saleId,
          item.productId,
          item.productName,
          item.barcode,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );

      await client.query(
        `update inventory
         set quantity = quantity - $2,
             updated_at = now()
         where product_id = $1`,
        [item.productId, item.quantity],
      );

      await client.query(
        `insert into inventory_logs (id, product_id, user_id, action_type, quantity_change, note)
         values ($1, $2, $3, 'sale', $4, $5)`,
        [
          randomUUID(),
          item.productId,
          user.id,
          item.quantity * -1,
          `Sold in ${saleCode}`,
        ],
      );
    }

    await client.query(
      `insert into payments (
         id, sale_id, method, amount, amount_tendered, change_due,
         provider, provider_reference, provider_status, provider_channel, provider_paid_at, provider_payload
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        randomUUID(),
        saleId,
        paymentMethod,
        totalAmount,
        amountTendered,
        changeDue,
        paymentProvider,
        paymentProviderReference,
        paymentProviderStatus,
        paymentProviderChannel,
        paymentProviderPaidAt,
        paymentProviderPayload ? JSON.stringify(paymentProviderPayload) : null,
      ],
    );

    if (!customer.isDefault) {
      const pointsEarned =
        Math.floor(totalAmount / 10) * APP_CONFIG.loyaltyPointsPerTenCedis;
      await client.query(
        `update customers
         set loyalty_points = loyalty_points + $2
         where id = $1`,
        [customer.id, pointsEarned],
      );
    }

    return buildReceipt(client, saleId);
  });
}
