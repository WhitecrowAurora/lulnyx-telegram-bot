import crypto from "node:crypto";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowMs() {
  return Date.now();
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function trimToMaxChars(text, maxChars) {
  if (typeof text !== "string") return "";
  if (!Number.isFinite(maxChars) || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return "";
  return String(baseUrl).replace(/\/+$/, "");
}

export function ensureDirSync(fs, dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

export function parseBasicAuth(headerValue) {
  if (!headerValue) return null;
  const match = /^Basic\s+(.+)$/i.exec(headerValue);
  if (!match) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}

export function localDayString(ts = Date.now()) {
  const d = new Date(Number(ts) || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
