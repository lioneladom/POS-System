import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../server/auth.js";
import { APP_CONFIG } from "../server/config.js";
import { pool, withTransaction } from "../server/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, "../db/schema.sql");
const shouldReset = process.argv.includes("--reset");

const seed = {
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
      createdAt: "2026-03-30T10:30:00.000Z",
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
      createdAt: "2026-04-01T09:10:00.000Z",
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
      createdAt: "2026-04-01T13:45:00.000Z",
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
      createdAt: "2026-03-30T10:30:00.000Z",
    },
    {
      id: "50000000-0000-0000-0000-000000000002",
      saleId: "30000000-0000-0000-0000-000000000002",
      method: "card",
      amount: 58.51,
      amountTendered: 58.51,
      changeDue: 0,
      createdAt: "2026-04-01T09:10:00.000Z",
    },
    {
      id: "50000000-0000-0000-0000-000000000003",
      saleId: "30000000-0000-0000-0000-000000000003",
      method: "cash",
      amount: 106.31,
      amountTendered: 120,
      changeDue: 13.69,
      createdAt: "2026-04-01T13:45:00.000Z",
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
      createdAt: "2026-03-30T10:30:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000002",
      productId: "20000000-0000-0000-0000-000000000003",
      userId: "00000000-0000-0000-0000-000000000003",
      actionType: "sale",
      quantityChange: -1,
      note: "Sold in SALE-20260330-9A2F",
      createdAt: "2026-03-30T10:30:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000003",
      productId: "20000000-0000-0000-0000-000000000007",
      userId: "00000000-0000-0000-0000-000000000002",
      actionType: "sale",
      quantityChange: -1,
      note: "Sold in SALE-20260401-4B18",
      createdAt: "2026-04-01T09:10:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000004",
      productId: "20000000-0000-0000-0000-000000000006",
      userId: "00000000-0000-0000-0000-000000000002",
      actionType: "sale",
      quantityChange: -3,
      note: "Sold in SALE-20260401-4B18",
      createdAt: "2026-04-01T09:10:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000005",
      productId: "20000000-0000-0000-0000-000000000009",
      userId: "00000000-0000-0000-0000-000000000003",
      actionType: "sale",
      quantityChange: -2,
      note: "Sold in SALE-20260401-7C4D",
      createdAt: "2026-04-01T13:45:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000006",
      productId: "20000000-0000-0000-0000-000000000002",
      userId: "00000000-0000-0000-0000-000000000003",
      actionType: "sale",
      quantityChange: -1,
      note: "Sold in SALE-20260401-7C4D",
      createdAt: "2026-04-01T13:45:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000007",
      productId: "20000000-0000-0000-0000-000000000008",
      userId: "00000000-0000-0000-0000-000000000003",
      actionType: "sale",
      quantityChange: -1,
      note: "Sold in SALE-20260401-7C4D",
      createdAt: "2026-04-01T13:45:00.000Z",
    },
    {
      id: "60000000-0000-0000-0000-000000000008",
      productId: "20000000-0000-0000-0000-000000000010",
      userId: "00000000-0000-0000-0000-000000000002",
      actionType: "restock",
      quantityChange: 6,
      note: "Morning supplier delivery",
      createdAt: "2026-03-31T11:20:00.000Z",
    },
  ],
};

async function seedDatabase() {
  await withTransaction(async (client) => {
    if (shouldReset) {
      await client.query(
        `truncate table
           user_sessions,
           inventory_logs,
           inventory,
           payments,
           sale_items,
           sales,
           products,
           customers,
           users
         restart identity cascade`,
      );
    }

    const { rows } = await client.query(`select count(*)::int as count from users`);
    if (rows[0].count > 0) {
      console.log("Database already has seed data. Skipping inserts.");
      return;
    }

    for (const user of seed.users) {
      await client.query(
        `insert into users (id, name, username, role, password_hash)
         values ($1, $2, $3, $4, $5)`,
        [
          user.id,
          user.name,
          user.username,
          user.role,
          hashPassword(user.password),
        ],
      );
    }

    for (const customer of seed.customers) {
      await client.query(
        `insert into customers (id, name, phone, email, address, loyalty_points, is_default)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customer.id,
          customer.name,
          customer.phone,
          customer.email,
          customer.address,
          customer.loyaltyPoints,
          customer.isDefault,
        ],
      );
    }

    for (const product of seed.products) {
      await client.query(
        `insert into products (id, name, category, supplier, price, barcode, description)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          product.id,
          product.name,
          product.category,
          product.supplier,
          product.price,
          product.barcode,
          product.description,
        ],
      );

      await client.query(
        `insert into inventory (product_id, quantity, low_stock_threshold)
         values ($1, $2, $3)`,
        [product.id, product.stock, APP_CONFIG.lowStockThreshold],
      );
    }

    for (const sale of seed.sales) {
      await client.query(
        `insert into sales (
           id, sale_code, cashier_id, customer_id, subtotal, discount_rate, discount_amount,
           tax_rate, tax_amount, total_amount, payment_method, amount_tendered, change_due, created_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13, $14
         )`,
        [
          sale.id,
          sale.saleCode,
          sale.cashierId,
          sale.customerId,
          sale.subtotal,
          sale.discountRate,
          sale.discountAmount,
          sale.taxRate,
          sale.taxAmount,
          sale.totalAmount,
          sale.paymentMethod,
          sale.amountTendered,
          sale.changeDue,
          sale.createdAt,
        ],
      );
    }

    for (const item of seed.saleItems) {
      await client.query(
        `insert into sale_items (id, sale_id, product_id, product_name, barcode, quantity, unit_price, line_total)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.id,
          item.saleId,
          item.productId,
          item.productName,
          item.barcode,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      );
    }

    for (const payment of seed.payments) {
      await client.query(
        `insert into payments (id, sale_id, method, amount, amount_tendered, change_due, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payment.id,
          payment.saleId,
          payment.method,
          payment.amount,
          payment.amountTendered,
          payment.changeDue,
          payment.createdAt,
        ],
      );
    }

    for (const log of seed.inventoryLogs) {
      await client.query(
        `insert into inventory_logs (id, product_id, user_id, action_type, quantity_change, note, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          log.id,
          log.productId,
          log.userId,
          log.actionType,
          log.quantityChange,
          log.note,
          log.createdAt,
        ],
      );
    }
    console.log("Database schema created and seed data inserted.");
  });
}

async function main() {
  const schema = await fs.readFile(schemaPath, "utf8");
  await pool.query(schema);
  await seedDatabase();
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
