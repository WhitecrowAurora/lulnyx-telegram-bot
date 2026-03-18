import http from "node:http";
import fs from "node:fs";
import { searxngSearch } from "./search.js";
import { createSessionManager, hashPassword, makeSetCookie } from "./webAuth.js";
import { renderAppPage, renderLoginPage, renderSetupPage } from "./webUiModern.js";
import { getUiPrefs } from "./web/uiPrefs.js";
import { getAuth, verifyWebLogin } from "./web/auth.js";
import { buildConfigSummary, buildDiagnostics, buildSetupConfig, isMaskedOrBlank, maskConfig, mergeSecrets, normalizePostedConfig, secretMask } from "./web/config.js";
import {
  clampText,
  getEffectiveChatReplyStyle,
  normalizeOptionalChatReplyStyle,
  normalizeUserDisplayNameMode,
  normalizeUserPromptSlot
} from "./state/common.js";
import { readJson, redirect, sendHtml, sendJson, sendText } from "./web/http.js";
import { clientIp, isHttpsRequest, isLocalRequest } from "./web/net.js";
import { createRateLimiter } from "./web/rateLimiter.js";
import { makeCspNonce, setSecurityHeaders } from "./web/security.js";

const SECRET_MASK = secretMask();

function getEffectiveChatProvider(cfg, chatSettings) {
  const providers = Array.isArray(cfg?.providers) ? cfg.providers : [];
  const explicitId = String(chatSettings?.providerId || "").trim();
  const fallbackId = String(cfg?.defaultProviderId || providers[0]?.id || "").trim();
  const providerId = explicitId || fallbackId;
  const provider = providers.find((item) => String(item?.id || "").trim() === providerId) || null;
  return {
    providerId,
    providerName: String(provider?.name || provider?.id || providerId || "").trim(),
    inherited: !explicitId
  };
}

export function createWebServer({ logger, configStore, stateStore, telegram }) {
  const sessions = createSessionManager();
  const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

  const server = http.createServer(async (req, res) => {
    try {
      await handle({ req, res, logger, configStore, stateStore, telegram, sessions, loginLimiter });
    } catch (err) {
      logger?.error?.("web request failed", err);
      sendJson(res, 500, { error: "internal_error" });
    }
  });

  return server;
}

async function handle({ req, res, logger, configStore, stateStore, telegram, sessions, loginLimiter }) {
  const cspNonce = makeCspNonce();
  setSecurityHeaders(res, cspNonce);

  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (method === "GET" && (pathname === "/health" || pathname === "/healthz")) return sendText(res, 200, "ok\n");

  // Telegram webhook (no admin auth; protected by secret in path)
  if (method === "POST" && pathname.startsWith("/telegram/webhook/")) {
    const secret = pathname.slice("/telegram/webhook/".length);
    if (!secret) return sendText(res, 404, "not_found\n");
    let body = null;
    try {
      body = await readJson(req, 1024 * 1024);
    } catch {
      return sendText(res, 413, "too_large\n");
    }
    const reqIp = clientIp(req);
    if (!telegram?.handleWebhookUpdate) return sendText(res, 503, "telegram_unavailable\n");
    const out = await telegram.handleWebhookUpdate({ secret, update: body, reqIp });
    if (!out?.ok) {
      // Return 404 to avoid leaking secret validity.
      return sendText(res, 404, "not_found\n");
    }
    return sendText(res, 200, "ok\n");
  }

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

  if (method === "GET" && pathname === "/readyz") {
    const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
    const providerConfigured = providers.some((p) => String(p?.baseUrl || "").trim() && String(p?.apiKey || "").trim());
    const telegramConfigured = Boolean(String(cfg.telegram?.token || "").trim());
    const problems = [];
    if (!setupCompleted) problems.push("setup_required");
    if (!telegramConfigured) problems.push("telegram_not_configured");
    if (!providerConfigured) problems.push("provider_not_configured");

    const ok = problems.length === 0;
    return sendJson(res, ok ? 200 : 503, {
      ok,
      problems,
      setupCompleted,
      telegram: { configured: telegramConfigured, mode: String(cfg.telegram?.delivery?.mode || "polling") },
      providers: { count: providers.length, configured: providerConfigured }
    });
  }

  if (method === "GET" && pathname === "/metrics") {
    if (!isLocalRequest(req)) return sendText(res, 403, "forbidden\n");
    const mem = process.memoryUsage();
    const tg = telegram?.getStatus ? telegram.getStatus() : null;
    const lines = [];
    lines.push(`# HELP bot_uptime_seconds Process uptime in seconds`);
    lines.push(`# TYPE bot_uptime_seconds gauge`);
    lines.push(`bot_uptime_seconds ${process.uptime()}`);
    lines.push(`# HELP process_resident_memory_bytes Resident memory size in bytes`);
    lines.push(`# TYPE process_resident_memory_bytes gauge`);
    lines.push(`process_resident_memory_bytes ${Number(mem.rss || 0)}`);
    lines.push(`# HELP process_heap_used_bytes Heap used in bytes`);
    lines.push(`# TYPE process_heap_used_bytes gauge`);
    lines.push(`process_heap_used_bytes ${Number(mem.heapUsed || 0)}`);
    if (tg) {
      lines.push(`# HELP telegram_polling_running Whether polling loop is running (1/0)`);
      lines.push(`# TYPE telegram_polling_running gauge`);
      lines.push(`telegram_polling_running ${tg?.polling?.running ? 1 : 0}`);
    }
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return sendText(res, 200, lines.join("\n") + "\n");
  }

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
  const role = String(auth?.role || "admin");
  const roleLevel = role === "viewer" ? 0 : role === "operator" ? 1 : 2;
  const requireRole = (minLevel) => {
    if (!auth.ok) return false;
    const min = Number(minLevel ?? 2);
    if (roleLevel >= min) return true;
    sendJson(res, 403, { error: "forbidden" });
    return false;
  };

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
    const login = verifyWebLogin({ cfg, username, password });
    if (!login) return sendJson(res, 401, { error: "invalid_credentials" });
    const sid = sessions.create(login.username, login.role);
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

  if (method === "GET" && pathname === "/api/telegram/status") {
    if (!telegram?.getStatus) return sendJson(res, 200, { ok: true, status: null });
    return sendJson(res, 200, { ok: true, status: telegram.getStatus() });
  }

  if (method === "GET" && pathname === "/api/diagnostics") {
    const logs = url.searchParams.get("logs");
    const logsLines = Number(url.searchParams.get("logsLines") ?? 400);
    const diagnostics = buildDiagnostics({
      cfg,
      configPath: configStore.getConfigPath(),
      stateStore,
      logger,
      logsLines: logs === "0" ? 0 : logsLines
    });
    const download = url.searchParams.get("download") === "1";
    if (download) res.setHeader("Content-Disposition", `attachment; filename="diagnostics.json"`);
    return sendJson(res, 200, { ok: true, diagnostics });
  }

  if (method === "GET" && pathname === "/api/backup") {
    const includeSecrets = url.searchParams.get("secrets") === "1";
    const includeState = url.searchParams.get("state") !== "0";
    const download = url.searchParams.get("download") === "1";

    const backup = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      runtime: { node: process.version, platform: process.platform, arch: process.arch },
      config: includeSecrets ? cfg : stripSecrets(cfg),
      maskedConfig: maskConfig(cfg),
      summary: buildConfigSummary(cfg),
      state: null
    };

    if (includeState) {
      const info = stateStore.getBackendInfo ? stateStore.getBackendInfo() : null;
      if (info?.type === "json" && info?.statePath) {
        const text = fs.existsSync(info.statePath) ? fs.readFileSync(info.statePath, "utf8") : "{}";
        backup.state = { type: "json", jsonBase64: Buffer.from(String(text || "{}"), "utf8").toString("base64") };
      } else if (info?.type === "sqlite" && info?.dbPath) {
        const db = fs.existsSync(info.dbPath) ? fs.readFileSync(info.dbPath) : Buffer.alloc(0);
        const walPath = `${info.dbPath}-wal`;
        const shmPath = `${info.dbPath}-shm`;
        const wal = fs.existsSync(walPath) ? fs.readFileSync(walPath) : Buffer.alloc(0);
        const shm = fs.existsSync(shmPath) ? fs.readFileSync(shmPath) : Buffer.alloc(0);
        backup.state = {
          type: "sqlite",
          dbBase64: db.length ? db.toString("base64") : "",
          walBase64: wal.length ? wal.toString("base64") : "",
          shmBase64: shm.length ? shm.toString("base64") : ""
        };
      }
    }

    if (download) res.setHeader("Content-Disposition", `attachment; filename="backup.json"`);
    return sendJson(res, 200, { ok: true, backup });
  }

  if (method === "POST" && pathname === "/api/restore") {
    if (!requireRole(2)) return;
    let body = {};
    try {
      body = await readJson(req, 10 * 1024 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    if (String(body?.confirm || "") !== "RESTORE") return sendJson(res, 400, { error: "confirm_required" });

    const restoreConfig = body?.restoreConfig === true;
    const restoreState = body?.restoreState === true;
    const backup = body?.backup && typeof body.backup === "object" ? body.backup : null;
    if (!backup) return sendJson(res, 400, { error: "backup_required" });

    const out = { ok: true, restoreConfig: false, restoreState: false, restartRequired: false };

    if (restoreConfig) {
      const nextCfg = backup.config && typeof backup.config === "object" ? backup.config : null;
      if (!nextCfg) return sendJson(res, 400, { error: "backup_config_missing" });
      await configStore.set(nextCfg);
      out.restoreConfig = true;
    }

    if (restoreState) {
      const info = stateStore.getBackendInfo ? stateStore.getBackendInfo() : null;
      if (info?.type === "json") {
        const b = backup.state && typeof backup.state === "object" ? backup.state : null;
        if (b?.type !== "json" || !b.jsonBase64) return sendJson(res, 400, { error: "backup_state_missing" });
        const text = Buffer.from(String(b.jsonBase64 || ""), "base64").toString("utf8");
        const obj = JSON.parse(text || "{}");
        if (!stateStore.importRawState) return sendJson(res, 400, { error: "state_import_unsupported" });
        stateStore.importRawState(obj);
        await stateStore.flush?.();
        out.restoreState = true;
      } else if (info?.type === "sqlite") {
        // File replacement requires closing the DB. We keep this as a manual operation to avoid corrupting a live DB.
        out.restartRequired = true;
        return sendJson(res, 400, { error: "sqlite_restore_requires_manual_replace", details: out });
      }
    }

    return sendJson(res, 200, out);
  }

  if (method === "POST" && pathname === "/api/config") {
    if (!requireRole(2)) return;
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
    if (!requireRole(2)) return;
    const reloaded = configStore.reload();
    return sendJson(res, 200, { ok: true, config: maskConfig(reloaded) });
  }

  if (method === "GET" && pathname === "/api/known-chats") {
    const items = stateStore.listKnownChats().map((item) => {
      const provider = getEffectiveChatProvider(cfg, item);
      return {
        ...item,
        replyStyleEffective: getEffectiveChatReplyStyle({ cfg, chatSettings: item }),
        providerEffective: provider.providerId,
        providerNameEffective: provider.providerName,
        providerInherited: provider.inherited
      };
    });
    return sendJson(res, 200, { items });
  }

  if (method === "GET" && pathname === "/api/user-profiles") {
    const items = (stateStore.listUserProfiles?.() || []).map((item) => ({
      ...item,
      fullName: [String(item?.firstName || "").trim(), String(item?.lastName || "").trim()].filter(Boolean).join(" ").trim()
    }));
    return sendJson(res, 200, { items });
  }

  if (method === "GET" && pathname === "/api/user-profile") {
    const userId = String(url.searchParams.get("userId") || "").trim();
    if (!userId) return sendJson(res, 400, { error: "userId_required" });
    const profile = stateStore.getUserProfile?.(userId);
    if (!profile) return sendJson(res, 404, { error: "not_found" });
    return sendJson(res, 200, {
      userId,
      profile: {
        ...profile,
        displayNameMode: normalizeUserDisplayNameMode(profile.displayNameMode),
        activePromptSlot: normalizeUserPromptSlot(profile.activePromptSlot)
      }
    });
  }

  if (method === "POST" && pathname === "/api/user-profile") {
    if (!requireRole(1)) return;
    let body = {};
    try {
      body = await readJson(req, 256 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const userId = String(body?.userId || "").trim();
    if (!userId) return sendJson(res, 400, { error: "userId_required" });
    const patch = body?.patch && typeof body.patch === "object" ? body.patch : {};
    const saved = stateStore.updateUserProfile?.(userId, (p) => {
      if (patch.displayNameMode !== undefined) p.displayNameMode = normalizeUserDisplayNameMode(patch.displayNameMode);
      if (patch.customDisplayName !== undefined) p.customDisplayName = clampText(patch.customDisplayName, 64);
      if (patch.customPrompt1 !== undefined) p.customPrompt1 = clampText(patch.customPrompt1, 12000);
      if (patch.customPrompt2 !== undefined) p.customPrompt2 = clampText(patch.customPrompt2, 12000);
      if (patch.activePromptSlot !== undefined) p.activePromptSlot = normalizeUserPromptSlot(patch.activePromptSlot);
    });
    await stateStore.flush?.();
    return sendJson(res, 200, {
      ok: true,
      userId,
      profile: {
        ...saved,
        displayNameMode: normalizeUserDisplayNameMode(saved?.displayNameMode),
        activePromptSlot: normalizeUserPromptSlot(saved?.activePromptSlot)
      }
    });
  }

  if (method === "GET" && pathname === "/api/plugins") {
    const pm = configStore.pluginManager;
    if (!pm) return sendJson(res, 200, { items: [] });
    await pm.scan({ force: true }).catch(() => {});
    return sendJson(res, 200, { items: pm.getDiscovered ? pm.getDiscovered() : [] });
  }

  if (method === "POST" && pathname === "/api/plugins/toggle") {
    if (!requireRole(2)) return;
    let body = {};
    try {
      body = await readJson(req, 32 * 1024);
    } catch {
      return sendJson(res, 413, { error: "body_too_large" });
    }
    const id = String(body?.id || "").trim();
    const enabled = body?.enabled === true;
    if (!id) return sendJson(res, 400, { error: "id_required" });

    const cur = configStore.get();
    const next = JSON.parse(JSON.stringify(cur));
    next.plugins ??= {};
    const ids = new Set(Array.isArray(next.plugins.enabledIds) ? next.plugins.enabledIds.map((x) => String(x || "").trim()).filter(Boolean) : []);
    if (enabled) ids.add(id);
    else ids.delete(id);
    next.plugins.enabledIds = Array.from(ids.values());

    const saved = await configStore.set(next);
    const pm = configStore.pluginManager;
    await pm?.scan?.({ force: true }).catch(() => {});
    return sendJson(res, 200, { ok: true, config: maskConfig(saved), items: pm?.getDiscovered?.() || [] });
  }

  if (method === "GET" && pathname === "/api/chat-settings") {
    const chatId = String(url.searchParams.get("chatId") || "");
    if (!chatId) return sendJson(res, 400, { error: "chatId_required" });
    const settings = stateStore.getChatSettings(chatId);
    return sendJson(res, 200, {
      chatId,
      settings: {
        ...settings,
        replyStyleEffective: getEffectiveChatReplyStyle({ cfg, chatSettings: settings })
      }
    });
  }

  if (method === "POST" && pathname === "/api/chat-settings") {
    if (!requireRole(1)) return;
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
      if (patch.replyStyle !== undefined) c.replyStyle = normalizeOptionalChatReplyStyle(patch.replyStyle);
    });
    await stateStore.flush?.();
    return sendJson(res, 200, {
      ok: true,
      chatId,
      settings: {
        ...saved,
        replyStyleEffective: getEffectiveChatReplyStyle({ cfg, chatSettings: saved })
      }
    });
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
    if (!requireRole(1)) return;
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
    if (!requireRole(1)) return;
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
    if (!requireRole(1)) return;
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
        timeoutMs: cfg.search.timeoutMs,
        security: cfg.security,
        allowPrivateNetwork: cfg.search.allowPrivateNetwork,
        logger
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
    if (!requireRole(1)) return;
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

function stripSecrets(cfg) {
  const c = JSON.parse(JSON.stringify(cfg || {}));
  c.telegram ??= {};
  c.telegram.token = "";
  c.telegram.delivery ??= {};
  c.telegram.delivery.webhookSecret = "";
  c.web ??= {};
  c.web.password = "";
  if (Array.isArray(c.web.users)) {
    c.web.users = c.web.users.map((u) => {
      const nu = u && typeof u === "object" ? u : {};
      nu.password = "";
      return nu;
    });
  }
  c.providers = Array.isArray(c.providers) ? c.providers : [];
  c.providers = c.providers.map((p) => {
    const pr = p && typeof p === "object" ? p : {};
    pr.apiKey = "";
    return pr;
  });
  return c;
}
