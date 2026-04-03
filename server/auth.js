import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { APP_CONFIG } from "./config.js";

const COOKIE_NAME = "pos_session";

function makeCookie(name, value, expiresAt) {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    "Max-Age=86400",
  ].join("; ");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = String(storedHash).split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const providedHash = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (providedHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedHash, expectedBuffer);
}

export function createSessionRecord() {
  const expiresAt = new Date(
    Date.now() + APP_CONFIG.sessionDurationHours * 60 * 60 * 1000,
  );

  return {
    id: randomUUID(),
    expiresAt,
  };
}

export function setSessionCookie(response, sessionId, expiresAt) {
  response.setHeader("Set-Cookie", makeCookie(COOKIE_NAME, sessionId, expiresAt));
}

export function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "Max-Age=0",
    ].join("; "),
  );
}

export function getSessionToken(request) {
  const header = request.headers.cookie;
  if (!header) {
    return null;
  }

  const cookies = Object.fromEntries(
    header
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex < 0) {
          return [entry, ""];
        }

        return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
      }),
  );

  return cookies[COOKIE_NAME] || null;
}
