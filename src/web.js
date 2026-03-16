import http from "node:http";
import { searxngSearch } from "./search.js";
import { createSessionManager, hashPassword, makeSetCookie, verifyPassword } from "./webAuth.js";
import { renderAppPage, renderLoginPage, renderSetupPage } from "./webUiModern.js";
import { getUiPrefs } from "./web/uiPrefs.js";
import { getAuth } from "./web/auth.js";
import { buildConfigSummary, buildDiagnostics, buildSetupConfig, isMaskedOrBlank, maskConfig, mergeSecrets, normalizePostedConfig, secretMask } from "./web/config.js";
import { readJson, redirect, sendHtml, sendJson, sendText } from "./web/http.js";
import { clientIp, isHttpsRequest, isLocalRequest } from "./web/net.js";
import { createRateLimiter } from "./web/rateLimiter.js";
import { makeCspNonce, setSecurityHeaders } from "./web/security.js";

const SECRET_MASK = secretMask();

export function createWebServer({ logger, configStore, stateStore }) {
  const sessions = createSessionManager();
  const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

  const server = http.createServer(async (req, res) => {
    try {
      await handle({ req, res, logger, configStore, stateStore, sessions, loginLimiter });
    } catch (err) {
      logger?.error?.("web request failed", err);
      sendJson(res, 500, { error: "internal_error" });
    }
  });

  return server;
}

async function handle({ req, res, logger, configStore, stateStore, sessions, loginLimiter }) {
  const cspNonce = makeCspNonce();
  setSecurityHeaders(res, cspNonce);

  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/health") return sendText(res, 200, "ok\n");

  if (method === "POST" && pathname === "/api/ui-prefs") {
    let body = {};
    try {
      body = await readJson(req, 16 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const lang = body?.lang === "zh" ? "zh" : body?.lang === "en" ? "en" : "";
    const theme = body?.theme === "light" ? "light" : body?.theme === "dark" ? "dark" : "";
    const cookies = [];
    const maxAgeSeconds = 365 * 24 * 60 * 60;
    const secure = isHttpsRequest(req);
    if (lang)
      cookies.push(makeSetCookie({ name: "ui_lang", value: lang, maxAgeSeconds, httpOnly: false, sameSite: "Strict", secure }));
    if (theme)
      cookies.push(makeSetCookie({ name: "ui_theme", value: theme, maxAgeSeconds, httpOnly: false, sameSite: "Strict", secure }));
    if (cookies.length > 0) res.setHeader("Set-Cookie", cookies);
    return sendJson(res, 200, { ok: true });
  }

  const ui = getUiPrefs(req);
  const cfg = configStore.get();
  const setupCompleted = cfg.app?.setupCompleted === true;

  if (!setupCompleted) {
    if (method === "GET" && (pathname === "/" || pathname === "/setup")) {
      return sendHtml(
        res,
        200,
        renderSetupPage({ appName: cfg.app?.displayName, configPath: configStore.getConfigPath(), ui, nonce: cspNonce })
      );
    }
    if (method === "POST" && pathname === "/api/setup") {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: "local_setup_only" });
      let body = {};
      try {
        body = await readJson(req, 1024 * 1024);
      } catch (err) {
        return sendJson(res, 413, { error: "body_too_large" });
      }
      try {
        const next = buildSetupConfig({ body, prev: cfg });
        const saved = await configStore.set(next);
        logger?.info?.("setup completed via web");
        return sendJson(res, 200, { ok: true, config: maskConfig(saved) });
      } catch (err) {
        return sendJson(res, 400, { error: String(err?.message || "invalid_setup") });
      }
    }
    return sendJson(res, 403, { error: "setup_required" });
  }

  const auth = getAuth({ req, cfg, sessions });

  if (method === "GET" && pathname === "/login") {
    if (auth.ok) return redirect(res, "/");
    return sendHtml(
      res,
      200,
      renderLoginPage({
        appName: cfg.app?.displayName,
        configPath: configStore.getConfigPath(),
        message: url.searchParams.get("m") || "",
        ui,
        nonce: cspNonce
      })
    );
  }

  if (method === "POST" && pathname === "/api/login") {
    const ip = clientIp(req);
    if (!loginLimiter.allow(ip)) return sendJson(res, 429, { error: "rate_limited" });
    let body = {};
    try {
      body = await readJson(req, 64 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const username = String(body?.username || "");
    const password = String(body?.password || "");
    const ok = username === String(cfg.web?.username || "") && verifyPassword(String(cfg.web?.password || ""), password);
    if (!ok) return sendJson(res, 401, { error: "invalid_credentials" });
    const sid = sessions.create(username);
    const secure = isHttpsRequest(req) || cfg.web?.cookieSecure === true;
    res.setHeader(
      "Set-Cookie",
      makeSetCookie({
        name: sessions.cookieName,
        value: sid,
        maxAgeSeconds: 24 * 60 * 60,
        httpOnly: true,
        sameSite: "Strict",
        secure
      })
    );
    return sendJson(res, 200, { ok: true });
  }

  if (method === "POST" && pathname === "/api/logout") {
    if (auth.sid) sessions.delete(auth.sid);
    res.setHeader("Set-Cookie", makeSetCookie({ name: sessions.cookieName, value: "", maxAgeSeconds: 0, secure: isHttpsRequest(req) }));
    return sendJson(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/") {
    if (!auth.ok) return redirect(res, "/login");
    return sendHtml(
      res,
      200,
      renderAppPage({
        appName: cfg.app?.displayName,
        configPath: configStore.getConfigPath(),
        hasConfigFile: configStore.hasConfigFile(),
        ui,
        nonce: cspNonce
      })
    );
  }

  // API (auth required)
  if (pathname.startsWith("/api/")) {
    if (!auth.ok) return sendJson(res, 401, { error: "unauthorized" });
  }

  if (method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, { config: maskConfig(cfg) });
  }

  if (method === "GET" && pathname === "/api/config-summary") {
    return sendJson(res, 200, { ok: true, summary: buildConfigSummary(cfg) });
  }

  if (method === "GET" && pathname === "/api/diagnostics") {
    const diagnostics = buildDiagnostics({ cfg, configPath: configStore.getConfigPath(), stateStore });
    const download = url.searchParams.get("download") === "1";
    if (download) res.setHeader("Content-Disposition", `attachment; filename="diagnostics.json"`);
    return sendJson(res, 200, { ok: true, diagnostics });
  }

  if (method === "POST" && pathname === "/api/config") {
    let body = {};
    try {
      body = await readJson(req, 2 * 1024 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const next = normalizePostedConfig(body?.config);
    if (!next) return sendJson(res, 400, { error: "invalid_config" });

    const merged = mergeSecrets({ prev: cfg, next });
    // If password changed, hash it before saving.
    if (merged.web?.password && merged.web.password !== SECRET_MASK && !String(merged.web.password).startsWith("scrypt$")) {
      merged.web.password = hashPassword(String(merged.web.password));
    }
    const saved = await configStore.set(merged);
    return sendJson(res, 200, { ok: true, config: maskConfig(saved) });
  }

  if (method === "POST" && pathname === "/api/reload") {
    const reloaded = configStore.reload();
    return sendJson(res, 200, { ok: true, config: maskConfig(reloaded) });
  }

  if (method === "GET" && pathname === "/api/known-chats") {
    const items = stateStore.listKnownChats();
    return sendJson(res, 200, { items });
  }

  if (method === "GET" && pathname === "/api/chat-settings") {
    const chatId = String(url.searchParams.get("chatId") || "");
    if (!chatId) return sendJson(res, 400, { error: "chatId_required" });
    const settings = stateStore.getChatSettings(chatId);
    return sendJson(res, 200, { chatId, settings });
  }

  if (method === "POST" && pathname === "/api/chat-settings") {
    let body = {};
    try {
      body = await readJson(req, 64 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const chatId = String(body?.chatId || "");
    if (!chatId) return sendJson(res, 400, { error: "chatId_required" });
    const patch = body?.patch && typeof body.patch === "object" ? body.patch : {};
    const saved = stateStore.updateChatSettings(chatId, (c) => {
      if (patch.autoReply !== undefined) c.autoReply = Boolean(patch.autoReply);
    });
    await stateStore.flush?.();
    return sendJson(res, 200, { ok: true, chatId, settings: saved });
  }

  if (method === "GET" && pathname === "/api/conversations") {
    const keys = stateStore.listConversationKeys();
    keys.sort();
    return sendJson(res, 200, { keys });
  }

  if (method === "GET" && pathname === "/api/conversation") {
    const key = String(url.searchParams.get("key") || "");
    if (!key) return sendJson(res, 400, { error: "key_required" });
    const conversation = stateStore.getConversationByKey(key);
    if (!conversation) return sendJson(res, 404, { error: "not_found" });
    return sendJson(res, 200, { key, conversation });
  }

  if (method === "POST" && pathname === "/api/conversation") {
    let body = {};
    try {
      body = await readJson(req, 2 * 1024 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const key = String(body?.key || "");
    if (!key) return sendJson(res, 400, { error: "key_required" });
    const incoming = body?.conversation;
    if (!incoming || typeof incoming !== "object") return sendJson(res, 400, { error: "conversation_required" });
    const saved = stateStore.updateConversationByKey(key, (conv) => {
      conv.promptId = String(incoming.promptId || "");
      conv.personaId = String(incoming.personaId || "");
      conv.memoryEnabled = incoming.memoryEnabled === null ? null : incoming.memoryEnabled === undefined ? null : Boolean(incoming.memoryEnabled);
      conv.facts = Array.isArray(incoming.facts) ? incoming.facts.map((x) => String(x)).filter(Boolean) : [];
      conv.history = Array.isArray(incoming.history)
        ? incoming.history
            .map((m) => (m && typeof m === "object" ? { role: String(m.role || ""), content: String(m.content || "") } : null))
            .filter((m) => m && m.role && m.content)
        : [];
    });
    if (!saved) return sendJson(res, 404, { error: "not_found" });
    await stateStore.flush?.();
    return sendJson(res, 200, { ok: true });
  }

  if (method === "DELETE" && pathname === "/api/conversation") {
    let body = {};
    try {
      body = await readJson(req, 64 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const key = String(body?.key || "");
    if (!key) return sendJson(res, 400, { error: "key_required" });
    const ok = stateStore.deleteConversationByKey(key);
    await stateStore.flush?.();
    return sendJson(res, 200, { ok });
  }

  if (method === "POST" && pathname === "/api/search-test") {
    let body = {};
    try {
      body = await readJson(req, 64 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const q = String(body?.q || "").trim();
    if (!q) return sendJson(res, 400, { error: "q_required" });
    if (!cfg.search?.enabled) return sendJson(res, 400, { error: "search_disabled" });
    try {
      const results = await searxngSearch({
        baseUrl: cfg.search.baseUrl,
        query: q,
        language: cfg.search.language,
        safeSearch: cfg.search.safeSearch,
        maxResults: cfg.search.maxResults,
        timeoutMs: cfg.search.timeoutMs
      });
      return sendJson(res, 200, { results });
    } catch (err) {
      logger?.warn?.("search test failed", err);
      return sendJson(res, 502, { error: "search_failed" });
    }
  }

  if (method === "GET" && pathname === "/api/stats") {
    const days = Number(url.searchParams.get("days") ?? 30);
    const out = stateStore.getUsageSummary ? stateStore.getUsageSummary({ days }) : { total: {}, byDay: [] };
    return sendJson(res, 200, out);
  }

  if (method === "GET" && pathname === "/api/daily-days") {
    const limit = Number(url.searchParams.get("limit") ?? 30);
    const days = stateStore.listDailySummaryDays ? stateStore.listDailySummaryDays({ limit }) : [];
    return sendJson(res, 200, { days });
  }

  if (method === "GET" && pathname === "/api/daily-summaries") {
    const day = String(url.searchParams.get("day") || "");
    if (!day) return sendJson(res, 400, { error: "day_required" });
    const items = stateStore.listDailySummaries ? stateStore.listDailySummaries({ day }) : [];
    return sendJson(res, 200, { day, items });
  }

  if (method === "GET" && pathname === "/api/bot-doc") {
    const key = String(url.searchParams.get("key") || "");
    if (!key) return sendJson(res, 400, { error: "key_required" });
    const doc = stateStore.getBotDoc ? stateStore.getBotDoc(key) : null;
    return sendJson(res, 200, { doc });
  }

  if (method === "POST" && pathname === "/api/bot-doc") {
    let body = {};
    try {
      body = await readJson(req, 256 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const key = String(body?.key || "");
    if (!key) return sendJson(res, 400, { error: "key_required" });
    const value = String(body?.value || "");
    const ok = stateStore.setBotDoc ? stateStore.setBotDoc(key, value) : false;
    await stateStore.flush?.();
    return sendJson(res, 200, { ok });
  }

  return sendJson(res, 404, { error: "not_found" });
}
