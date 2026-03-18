import { parseBasicAuth } from "../util.js";
import { parseCookies, verifyPassword } from "../webAuth.js";

export function verifyWebLogin({ cfg, username, password }) {
  const user = resolveWebUser(cfg, username);
  if (!user) return null;
  const okPw = verifyPassword(String(user.password || ""), String(password || ""));
  if (!okPw) return null;
  return { username: user.username, role: user.role };
}

export function getAuth({ req, cfg, sessions }) {
  // 1) Basic auth (convenient for curl)
  const basic = parseBasicAuth(req.headers.authorization);
  if (basic) {
    const user = resolveWebUser(cfg, basic.username);
    if (user) {
      const okPw = verifyPassword(String(user.password || ""), String(basic.password || ""));
      if (okPw) return { ok: true, method: "basic", username: user.username, role: user.role };
    }
  }

  // 2) Cookie session
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[sessions.cookieName];
  if (!sid) return { ok: false };
  const sess = sessions.get(sid);
  if (!sess) return { ok: false, sid };
  const user = resolveWebUser(cfg, sess.username);
  if (!user) return { ok: false, sid };
  return { ok: true, method: "cookie", sid, username: user.username, role: user.role };
}

function resolveWebUser(cfg, username) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const want = String(username || "");
  if (!want) return null;

  const users = Array.isArray(c.web?.users) ? c.web.users : [];
  if (users.length > 0) {
    for (const u of users) {
      const un = String(u?.username || "");
      if (!un || un !== want) continue;
      const pw = String(u?.password || "");
      const role = String(u?.role || "admin");
      return { username: un, password: pw, role: normalizeRole(role) };
    }
    return null;
  }

  // Backward compatible single-user config
  if (want !== String(c.web?.username || "")) return null;
  return { username: want, password: String(c.web?.password || ""), role: "admin" };
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "viewer" || r === "operator" || r === "admin") return r;
  return "admin";
}
