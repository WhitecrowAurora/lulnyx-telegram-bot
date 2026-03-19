import { randomBytes } from "node:crypto";

export function setSecurityHeaders(res, cspNonce, options = {}) {
  const allowTelegramWebApp = options?.allowTelegramWebApp === true;
  const scriptSrc = ["'self'", `'nonce-${String(cspNonce || "")}'`];
  if (allowTelegramWebApp) scriptSrc.push("https://telegram.org");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!allowTelegramWebApp) res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc.join(
      " "
    )}; base-uri 'none'; frame-ancestors ${allowTelegramWebApp ? "https://web.telegram.org https://*.telegram.org" : "'none'"}`
  );
  res.setHeader("Cache-Control", "no-store");
}

export function makeCspNonce() {
  // Base64url; safe for headers + HTML attributes.
  return randomBytes(16)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
