import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "etb_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  return process.env["ADMIN_SESSION_SECRET"] || "eastern-trust-bank-admin-session-secret-2026";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createAdminToken(username: string) {
  const payload = `${Buffer.from(username).toString("base64url")}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts as [string, string, string];
  if (!safeEqual(sig, sign(`${user}.${exp}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return Buffer.from(user, "base64url").toString();
}

export function readCookie(header: string | undefined | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(token: string) {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
export const clearCookie = `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
