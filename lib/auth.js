import crypto from "crypto";

const COOKIE_NAME = "teacher_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 giờ

function getSecret() {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret";
}

function hmac(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionCookieValue() {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function isValidSessionValue(value) {
  if (!value || typeof value !== "string") return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  if (hmac(payload) !== sig) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = { name: COOKIE_NAME, maxAge: MAX_AGE_SECONDS };

// Use inside a Server Component page under /teacher to redirect
// unauthenticated visitors to the login screen.
export function requireTeacherOrRedirect() {
  // Deferred imports keep this file safe to import from API routes too,
  // where next/navigation's redirect() isn't meaningful.
  const { cookies } = require("next/headers");
  const { redirect } = require("next/navigation");
  const value = cookies().get(COOKIE_NAME)?.value;
  if (!isValidSessionValue(value)) redirect("/teacher/login");
}
