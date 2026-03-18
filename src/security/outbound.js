import dns from "node:dns";
import net from "node:net";

export function normalizeOutboundSecurity(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  c.outbound ??= {};
  c.outbound.blockPrivateNetworks = c.outbound.blockPrivateNetworks !== false;
  c.outbound.dnsResolve = c.outbound.dnsResolve !== false;
  c.outbound.dnsTimeoutMs = clampInt(c.outbound.dnsTimeoutMs, 200, 5000, 800);
  c.outbound.denyOnResolveFailure = c.outbound.denyOnResolveFailure === true;
  c.outbound.allowedHostSuffixes = Array.isArray(c.outbound.allowedHostSuffixes)
    ? c.outbound.allowedHostSuffixes.map((s) => String(s || "").trim().toLowerCase()).filter(Boolean)
    : [];
  return c;
}

export async function assertOutboundUrlAllowed({
  url,
  security,
  allowPrivateNetwork = false,
  kind = "outbound",
  logger
}) {
  const sec = security && typeof security === "object" ? security : {};
  const ob = sec.outbound && typeof sec.outbound === "object" ? sec.outbound : {};
  const blockPrivateNetworks = ob.blockPrivateNetworks !== false;
  if (!blockPrivateNetworks) return;
  if (allowPrivateNetwork === true) return;

  const u = parseUrl(url);
  if (!u) throw new Error(`${kind}: invalid url`);
  const proto = String(u.protocol || "").toLowerCase();
  if (proto !== "http:" && proto !== "https:") throw new Error(`${kind}: blocked protocol ${proto || "(none)"}`);

  const host = String(u.hostname || "").trim();
  if (!host) throw new Error(`${kind}: missing host`);
  if (isHostAllowedBySuffix(host, ob.allowedHostSuffixes)) return;

  if (isDefinitelyLocalHostname(host)) throw new Error(`${kind}: blocked host ${host}`);

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error(`${kind}: blocked private ip ${host}`);
    return;
  }

  const dnsResolve = ob.dnsResolve !== false;
  if (!dnsResolve) return;

  const timeoutMs = clampInt(ob.dnsTimeoutMs, 200, 5000, 800);
  const denyOnResolveFailure = ob.denyOnResolveFailure === true;

  const addrs = await lookupAllWithTimeout(host, timeoutMs).catch((err) => {
    if (denyOnResolveFailure) throw new Error(`${kind}: dns lookup failed for ${host}`);
    logger?.warn?.("outbound dns lookup failed (allowing)", { host, kind, message: err?.message });
    return null;
  });
  if (!addrs) return;

  for (const a of addrs) {
    const ip = String(a?.address || "");
    if (!ip) continue;
    if (isPrivateIp(ip)) throw new Error(`${kind}: blocked private ip ${ip} (${host})`);
  }
}

function parseUrl(url) {
  try {
    const u = url instanceof URL ? url : new URL(String(url || ""));
    return u;
  } catch {
    return null;
  }
}

function isDefinitelyLocalHostname(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h) return false;
  if (h === "localhost") return true;
  if (h === "localhost.localdomain") return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;
  return false;
}

function isHostAllowedBySuffix(host, suffixes) {
  const h = String(host || "").trim().toLowerCase();
  const list = Array.isArray(suffixes) ? suffixes : [];
  if (!h || list.length === 0) return false;
  for (const s of list) {
    const suf = String(s || "").trim().toLowerCase();
    if (!suf) continue;
    if (h === suf) return true;
    if (suf.startsWith(".")) {
      if (h.endsWith(suf)) return true;
      continue;
    }
    if (h.endsWith(`.${suf}`)) return true;
  }
  return false;
}

function isPrivateIp(ip) {
  const s = String(ip || "").trim().toLowerCase();
  if (!s) return false;
  if (s === "::1") return true;
  if (s === "::") return true;
  if (s.startsWith("fe80:")) return true; // IPv6 link-local
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // IPv6 ULA (fc00::/7)
  if (s.startsWith("::ffff:")) return isPrivateIp(s.slice("::ffff:".length));

  // IPv4
  const parts = s.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 0) return true; // "this host" / invalid
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

async function lookupAllWithTimeout(host, timeoutMs) {
  const p = dns.promises.lookup(host, { all: true, verbatim: true });
  const t = new Promise((_, reject) => setTimeout(() => reject(new Error("dns_timeout")), timeoutMs));
  return await Promise.race([p, t]);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

