import { randomBytes } from "node:crypto";
import { APP_CONFIG } from "./config.js";

const PAYSTACK_API_BASE = "https://api.paystack.co";

function cleanText(value) {
  return String(value ?? "").trim();
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeCurrency(value) {
  return cleanText(value).toUpperCase() || APP_CONFIG.paystackCurrency;
}

function createFallbackCustomerEmail(reference) {
  const normalizedReference = cleanText(reference)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return `checkout+${normalizedReference || "walk-in"}@lionsmarket-pos.example.com`;
}

function normalizeCallbackUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(text);
  } catch {
    throw createHttpError("Use a valid Paystack callback URL.", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw createHttpError("Paystack callback URL must start with http or https.", 400);
  }

  return parsedUrl.toString();
}

async function paystackRequest(path, options = {}) {
  const url = `${PAYSTACK_API_BASE}${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${APP_CONFIG.paystackSecretKey}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const message = payload?.message || `Paystack request failed with status ${response.status}.`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  if (!payload.status) {
    const message = payload?.message || "Paystack API returned an error.";
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  return payload.data || payload;
}

export function isPaystackEnabled() {
  return Boolean(APP_CONFIG.paystackPublicKey && APP_CONFIG.paystackSecretKey);
}

export function usesPaystack(paymentMethod) {
  return paymentMethod === "card" || paymentMethod === "mobile_money";
}

export function createPaystackReference() {
  return `PS-${Date.now()}-${randomBytes(3).toString("hex")}`.toUpperCase();
}

export function getPublicPaystackConfig() {
  return {
    enabled: isPaystackEnabled(),
    publicKey: APP_CONFIG.paystackPublicKey,
    currency: APP_CONFIG.paystackCurrency,
  };
}

export async function createPaystackTransaction({ amount, currency, email, reference, paymentMethod, callbackUrl }) {
  if (!isPaystackEnabled()) {
    throw createHttpError("Paystack is not configured on this server.", 503);
  }

  const normalizedReference = cleanText(reference || createPaystackReference());
  const normalizedAmount = Math.round(Number(amount) * 100);
  const normalizedEmail = cleanText(email) || createFallbackCustomerEmail(normalizedReference);
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);

  if (!normalizedReference) {
    throw createHttpError("A Paystack reference is required.", 400);
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createHttpError("Enter a valid checkout amount before starting Paystack.", 400);
  }

  const payload = {
    email: normalizedEmail,
    amount: normalizedAmount,
    currency: normalizeCurrency(currency),
    reference: normalizedReference,
    metadata: {
      payment_method: paymentMethod,
      checkout_email_source: cleanText(email) ? "customer" : "generated",
    },
  };

  if (normalizedCallbackUrl) {
    payload.callback_url = normalizedCallbackUrl;
  }

  const response = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: payload,
  });

  return {
    reference: normalizedReference,
    email: normalizedEmail,
    authorizationUrl: response.authorization_url,
    accessCode: response.access_code,
    response,
  };
}

export async function verifyPaystackTransaction(reference) {
  const normalizedReference = cleanText(reference);
  if (!normalizedReference) {
    const error = new Error("Payment reference is required.");
    error.statusCode = 400;
    throw error;
  }

  return paystackRequest(`/transaction/verify/${encodeURIComponent(normalizedReference)}`, {
    method: "GET",
  });
}
