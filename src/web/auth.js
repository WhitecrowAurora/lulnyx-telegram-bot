import { parseBasicAuth } from "../util.js";
import { parseCookies, verifyPassword } from "../webAuth.js";

export function getAuth({ req, cfg, sessions }) {
  // 1) Basic auth (convenient for curl)
  const basic = parseBasicAuth(req.headers.authorization);
  if (basic) {
    const okUser = String(basic.username || "") === String(cfg.web?.username || "");
    const okPw = verifyPassword(String(cfg.web?.password || ""), String(basic.password || ""));
    if (okUser && okPw) return { ok: true, method: "basic" };
  }

  // 2) Cookie session
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[sessions.cookieName];
  if (!sid) return { ok: false };
  const sess = sessions.get(sid);
  if (!sess) return { ok: false, sid };
  if (String(sess.username || "") !== String(cfg.web?.username || "")) return { ok: false, sid };
  return { ok: true, method: "cookie", sid, username: sess.username };
}

