import { randomBytes } from "node:crypto";

export function setSecurityHeaders(res, cspNonce) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${String(
      cspNonce || ""
    )}'; base-uri 'none'; frame-ancestors 'none'`
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

