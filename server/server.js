import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clearSessionCookie, getSessionToken, setSessionCookie } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import * as paystack from "./paystack.js";
const service = await import(APP_CONFIG.mockMode ? "./mockService.js" : "./posService.js");

const {
  adjustInventory,
  checkoutSale,
  cleanupExpiredSessions,
  createUser,
  createSession,
  deleteCustomer,
  deleteProduct,
  deleteSession,
  deleteUser,
  fetchBootstrapData,
  findUserBySession,
  getCustomerHistory,
  getReceiptBySaleId,
  getReports,
  listCustomers,
  listInventory,
  listProducts,
  listRecentSales,
  listUsers,
  loginUser,
  updateUser,
  upsertCustomer,
  upsertProduct,
} = service;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const app = express();

app.use(express.json());
app.use((request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.use(async (request, response, next) => {
  try {
    const token = getSessionToken(request);
    if (!token) {
      request.session = null;
      return next();
    }

    const session = await findUserBySession(token);
    if (!session) {
      clearSessionCookie(response);
      request.session = null;
      return next();
    }

    request.session = {
      id: session.sessionId,
      user: {
        id: session.id,
        name: session.name,
        username: session.username,
        role: session.role,
      },
    };
    return next();
  } catch (error) {
    return next(error);
  }
});

function requireAuth(request, response, next) {
  if (!request.session?.user) {
    return response.status(401).json({ message: "Please sign in to continue." });
  }

  return next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.session?.user) {
      return response.status(401).json({ message: "Please sign in to continue." });
    }

    if (!roles.includes(request.session.user.role)) {
      return response.status(403).json({ message: "You do not have access to this action." });
    }

    return next();
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/session", (request, response) => {
  if (!request.session?.user) {
    return response.json({ authenticated: false });
  }

  return response.json({
    authenticated: true,
    session: request.session.user,
  });
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const user = await loginUser(request.body.username, request.body.password);
    const session = await createSession(user.id);
    setSessionCookie(response, session.id, session.expiresAt);
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (request, response, next) => {
  try {
    const token = getSessionToken(request);
    await deleteSession(token);
    clearSessionCookie(response);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", requireAuth, async (request, response, next) => {
  try {
    const data = await fetchBootstrapData(request.session.user);
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", requireAuth, async (request, response, next) => {
  try {
    response.json(await listProducts(request.query.search));
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await upsertProduct(request.body, request.session.user);
    response.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:productId", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await upsertProduct(
      {
        ...request.body,
        id: request.params.productId,
      },
      request.session.user,
    );
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:productId", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await deleteProduct(request.params.productId);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/customers", requireAuth, async (_request, response, next) => {
  try {
    response.json(await listCustomers());
  } catch (error) {
    next(error);
  }
});

app.get("/api/customers/:customerId/history", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    response.json(await getCustomerHistory(request.params.customerId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/customers", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await upsertCustomer(request.body);
    response.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/customers/:customerId", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await upsertCustomer({
      ...request.body,
      id: request.params.customerId,
    });
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/customers/:customerId", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await deleteCustomer(request.params.customerId);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", requireRole("admin"), async (_request, response, next) => {
  try {
    response.json(await listUsers());
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", requireRole("admin"), async (request, response, next) => {
  try {
    await createUser(request.body, request.session.user);
    response.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/users/:userId", requireRole("admin"), async (request, response, next) => {
  try {
    await updateUser(
      {
        ...request.body,
        id: request.params.userId,
      },
      request.session.user,
    );
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:userId", requireRole("admin"), async (request, response, next) => {
  try {
    await deleteUser(request.params.userId, request.session.user);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/inventory", requireRole("admin", "manager"), async (_request, response, next) => {
  try {
    response.json(await listInventory());
  } catch (error) {
    next(error);
  }
});

app.post("/api/inventory/adjustments", requireRole("admin", "manager"), async (request, response, next) => {
  try {
    await adjustInventory(request.body, request.session.user);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sales", requireAuth, async (request, response, next) => {
  try {
    response.json(await listRecentSales(request.session.user, 16));
  } catch (error) {
    next(error);
  }
});

app.get("/api/receipts/:saleId", requireAuth, async (request, response, next) => {
  try {
    response.json(await getReceiptBySaleId(request.params.saleId, request.session.user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/sales/checkout", requireRole("admin", "manager", "cashier"), async (request, response, next) => {
  try {
    response.status(201).json(
      await checkoutSale(request.body, request.session.user),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports", requireRole("admin", "manager"), async (_request, response, next) => {
  try {
    response.json(await getReports());
  } catch (error) {
    next(error);
  }
});

app.post("/api/paystack/initialize", requireRole("admin", "manager", "cashier"), async (request, response, next) => {
  try {
    const transaction = await paystack.createPaystackTransaction({
      amount: request.body.amount,
      currency: request.body.currency,
      email: request.body.email,
      reference: request.body.reference,
      paymentMethod: request.body.paymentMethod,
      callbackUrl: request.body.callbackUrl,
    });
    response.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

app.get("/api/paystack/verify", requireAuth, async (request, response, next) => {
  try {
    const verification = await paystack.verifyPaystackTransaction(request.query.reference);
    response.json({ verification });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(publicDir));

app.get(/^(?!\/api).*/, (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode || 500;
  const message =
    statusCode >= 500
      ? "Something went wrong on the server."
      : error.message;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({ message });
});

async function startServer() {
  try {
    await cleanupExpiredSessions();

    app.listen(APP_CONFIG.port, () => {
      console.log(
        `LION's MARKET POS running on http://localhost:${APP_CONFIG.port}${APP_CONFIG.mockMode ? " (mock mode)" : ""}`,
      );
    });
  } catch (error) {
    if (error?.code === "ECONNREFUSED" || error?.code === "ENETUNREACH") {
      console.error(
        "Database connection failed. For Supabase, use the pooler connection string from the dashboard and make sure the URI is reachable from this machine.",
      );
      if (/supabase\.co/i.test(process.env.DATABASE_URL || "")) {
        console.error(
          "Tip: the direct db.<project-ref>.supabase.co host may resolve to IPv6 first. Prefer the Supabase pooler URI and copy it exactly from the dashboard.",
        );
      }
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  }
}

await startServer();
