import crypto from "node:crypto";
import { parseCookies } from "../webAuth.js";
import { normalizeBaseUrl } from "../util.js";

const MINI_APP_COOKIE = "dc_tgapp";

export function normalizeMiniAppConfig(rawMiniApp, telegramPublicBaseUrl = "") {
  const miniApp = rawMiniApp && typeof rawMiniApp === "object" ? { ...rawMiniApp } : {};
  miniApp.enabled = miniApp.enabled === true;
  miniApp.publicBaseUrl = normalizeBaseUrl(String(miniApp.publicBaseUrl || telegramPublicBaseUrl || ""));
  miniApp.buttonText = String(miniApp.buttonText || "Panel").trim() || "Panel";
  miniApp.title = String(miniApp.title || "Telegram Panel").trim() || "Telegram Panel";
  miniApp.authMaxAgeSeconds = clampInt(miniApp.authMaxAgeSeconds, 30, 86400, 3600);
  miniApp.sessionTtlSeconds = clampInt(miniApp.sessionTtlSeconds, 300, 7 * 86400, 6 * 3600);
  miniApp.users = Array.isArray(miniApp.users)
    ? miniApp.users
        .map((item) => normalizeMiniAppUser(item))
        .filter((item) => item && item.userId)
    : [];
  return miniApp;
}

export function normalizeMiniAppUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = String(raw.userId || "").trim();
  if (!userId) return null;
  return {
    userId,
    label: String(raw.label || "").trim(),
    username: String(raw.username || "").trim(),
    role: normalizeRole(raw.role)
  };
}

export function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "viewer" || value === "operator" || value === "admin") return value;
  return "viewer";
}

export function getMiniAppPublicUrl(cfg) {
  const miniApp = cfg?.web?.miniApp;
  const baseUrl = normalizeBaseUrl(String(miniApp?.publicBaseUrl || ""));
  if (!baseUrl || !baseUrl.toLowerCase().startsWith("https://")) return "";
  return `${baseUrl}/tgapp`;
}

export function resolveMiniAppUser(cfg, userId, username = "") {
  const wantUserId = String(userId || "").trim();
  if (!wantUserId) return null;
  const list = Array.isArray(cfg?.web?.miniApp?.users) ? cfg.web.miniApp.users : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    if (String(item.userId || "").trim() !== wantUserId) continue;
    return {
      userId: wantUserId,
      username: String(username || item.username || "").trim(),
      label: String(item.label || item.username || username || wantUserId).trim() || wantUserId,
      role: normalizeRole(item.role)
    };
  }
  return null;
}

export function verifyMiniAppInitData({ initData, botToken, maxAgeSeconds }) {
  const raw = String(initData || "").trim();
  const token = String(botToken || "").trim();
  if (!raw) throw new Error("init_data_required");
  if (!token) throw new Error("telegram_token_required");

  const params = new URLSearchParams(raw);
  const hash = String(params.get("hash") || "").trim();
  if (!hash) throw new Error("hash_required");
  params.delete("hash");

  const authDate = Number(params.get("auth_date") || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  const limit = clampInt(maxAgeSeconds, 30, 86400, 3600);
  if (!Number.isFinite(authDate) || authDate <= 0) throw new Error("auth_date_invalid");
  if (nowSec - authDate > limit) throw new Error("auth_date_expired");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const computed = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!timingSafeEqualHex(computed, hash)) throw new Error("hash_mismatch");

  let user = null;
  try {
    user = JSON.parse(String(params.get("user") || "{}"));
  } catch {
    user = null;
  }
  if (!user || typeof user !== "object" || !user.id) throw new Error("user_missing");

  return {
    authDate,
    queryId: String(params.get("query_id") || "").trim(),
    user: {
      id: String(user.id),
      username: String(user.username || "").trim(),
      firstName: String(user.first_name || "").trim(),
      lastName: String(user.last_name || "").trim(),
      languageCode: String(user.language_code || "").trim()
    }
  };
}

export function getMiniAppAuth({ req, cfg, miniSessions }) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[MINI_APP_COOKIE];
  if (!sid) return { ok: false };
  const sess = miniSessions.get(sid);
  if (!sess) return { ok: false, sid };

  const encodedUserId = String(sess.username || "");
  const userId = encodedUserId.startsWith("tg:") ? encodedUserId.slice(3) : encodedUserId;
  if (!userId) return { ok: false, sid };

  const currentUser = resolveMiniAppUser(cfg, userId);
  if (!currentUser) return { ok: false, sid };

  const ttlSeconds = clampInt(cfg?.web?.miniApp?.sessionTtlSeconds, 300, 7 * 86400, 6 * 3600);
  const ageMs = Date.now() - Number(sess.createdAt || 0);
  if (ageMs > ttlSeconds * 1000) {
    miniSessions.delete(sid);
    return { ok: false, sid };
  }

  return {
    ok: true,
    sid,
    userId,
    username: currentUser.username,
    label: currentUser.label,
    role: currentUser.role,
    roleLevel: roleToLevel(currentUser.role)
  };
}

export function roleToLevel(role) {
  const value = normalizeRole(role);
  return value === "viewer" ? 0 : value === "operator" ? 1 : 2;
}

export function miniAppCookieName() {
  return MINI_APP_COOKIE;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
