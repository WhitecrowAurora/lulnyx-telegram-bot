import crypto from "node:crypto";

const DEFAULT_SCRYPT = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32
};

export function hashPassword(password, opts = {}) {
  const pw = String(password || "");
  if (!pw) throw new Error("password is required");
  const N = Number.isFinite(opts.N) ? opts.N : DEFAULT_SCRYPT.N;
  const r = Number.isFinite(opts.r) ? opts.r : DEFAULT_SCRYPT.r;
  const p = Number.isFinite(opts.p) ? opts.p : DEFAULT_SCRYPT.p;
  const keyLen = Number.isFinite(opts.keyLen) ? opts.keyLen : DEFAULT_SCRYPT.keyLen;
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pw, salt, keyLen, { N, r, p, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(stored, password) {
  const pw = String(password || "");
  const s = String(stored || "");
  if (!s) return false;

  if (s.startsWith("scrypt$")) {
    const parts = s.split("$");
    // scrypt$N$r$p$saltB64$hashB64
    if (parts.length !== 6) return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const saltB64 = parts[4];
    const hashB64 = parts[5];
    const salt = safeB64ToBuf(saltB64);
    const want = safeB64ToBuf(hashB64);
    if (!salt.length || !want.length) return false;
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const got = crypto.scryptSync(pw, salt, want.length, { N, r, p, maxmem: 128 * 1024 * 1024 });
    return timingSafeEqualBuf(got, want);
  }

  // Backward compatibility: plain-text passwords in config
  return timingSafeEqualStr(s, pw);
}

export function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  return timingSafeEqualBuf(aa, bb);
}

export function timingSafeEqualBuf(a, b) {
  const aa = Buffer.isBuffer(a) ? a : Buffer.from(a || "");
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(b || "");
  if (aa.length !== bb.length) {
    // Do a dummy compare to keep timing more consistent.
    const min = Math.min(aa.length, bb.length);
    crypto.timingSafeEqual(aa.subarray(0, min), bb.subarray(0, min));
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

export function parseCookies(headerValue) {
  const h = String(headerValue || "");
  const out = {};
  for (const part of h.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function makeSetCookie({ name, value, maxAgeSeconds, httpOnly = true, sameSite = "Strict", path = "/", secure = false }) {
  const parts = [`${name}=${encodeURIComponent(String(value || ""))}`];
  parts.push(`Path=${path}`);
  if (Number.isFinite(maxAgeSeconds)) parts.push(`Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}

export function createSessionManager({ cookieName = "dc_session", ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const sessions = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [sid, s] of sessions.entries()) {
      if (!s || typeof s !== "object") {
        sessions.delete(sid);
        continue;
      }
      if (now - Number(s.lastSeenAt || 0) > ttlMs) sessions.delete(sid);
    }
  };
  setInterval(cleanup, 10 * 60 * 1000).unref?.();

  return {
    cookieName,
    create(username, role = "admin") {
      const sid = crypto.randomBytes(18).toString("base64url");
      const now = Date.now();
      sessions.set(sid, { sid, username: String(username || ""), role: String(role || "admin"), createdAt: now, lastSeenAt: now });
      return sid;
    },
    get(sid) {
      const key = String(sid || "");
      const s = sessions.get(key);
      if (!s) return null;
      s.lastSeenAt = Date.now();
      return s;
    },
    delete(sid) {
      sessions.delete(String(sid || ""));
    }
  };
}

function safeB64ToBuf(s) {
  try {
    return Buffer.from(String(s || ""), "base64");
  } catch {
    return Buffer.alloc(0);
  }
}
