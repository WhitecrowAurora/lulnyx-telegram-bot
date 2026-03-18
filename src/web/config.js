import { hashPassword } from "../webAuth.js";

const SECRET_MASK = "********";

export function secretMask() {
  return SECRET_MASK;
}

export function buildSetupConfig({ body, prev }) {
  const b = body && typeof body === "object" ? body : {};
  const username = String(b.username || "").trim() || "admin";
  const password = String(b.password || "");
  if (password.length < 8) throw new Error("admin password must be at least 8 characters");

  const next = JSON.parse(JSON.stringify(prev || {}));
  next.app ??= {};
  next.app.displayName = String(b.displayName || next.app.displayName || "My Telegram Bot");
  next.app.setupCompleted = true;

  next.web ??= {};
  next.web.username = username;
  next.web.password = hashPassword(password);

  const token = String(b.telegramToken || "").trim();
  if (token) {
    next.telegram ??= {};
    next.telegram.token = token;
  }

  const p = b.provider && typeof b.provider === "object" ? b.provider : null;
  const baseUrl = String(p?.baseUrl || "").trim();
  const apiKey = String(p?.apiKey || "").trim();
  const model = String(p?.model || "").trim();
  const apiType = p?.apiType === "chat_completions" ? "chat_completions" : "responses";
  if (baseUrl && apiKey) {
    next.providers = Array.isArray(next.providers) ? next.providers : [];
    const id = apiType === "chat_completions" ? "provider-chat" : "provider-responses";
    next.providers = [
      {
        id,
        name: "Provider",
        baseUrl,
        apiKey,
        apiType,
        model: model || "gpt-4.1-mini",
        responsesStyle: "instructions+messages"
      }
    ];
    next.defaultProviderId = id;
  }

  return next;
}

export function normalizePostedConfig(config) {
  if (!config || typeof config !== "object") return null;
  // Ensure we only pass plain JSON
  try {
    return JSON.parse(JSON.stringify(config));
  } catch {
    return null;
  }
}

export function mergeSecrets({ prev, next }) {
  const merged = JSON.parse(JSON.stringify(next || {}));
  const p = prev && typeof prev === "object" ? prev : {};

  merged.telegram ??= {};
  if (isMaskedOrBlank(merged.telegram.token)) merged.telegram.token = String(p.telegram?.token || "");
  merged.telegram.delivery ??= {};
  if (isMaskedOrBlank(merged.telegram.delivery.webhookSecret)) {
    merged.telegram.delivery.webhookSecret = String(p.telegram?.delivery?.webhookSecret || "");
  }

  merged.web ??= {};
  if (isMaskedOrBlank(merged.web.password)) merged.web.password = String(p.web?.password || "");

  // Optional multi-user support: preserve masked/blank passwords by username.
  if (Array.isArray(merged.web.users) && Array.isArray(p.web?.users)) {
    const prevByUser = new Map(p.web.users.map((u) => [String(u?.username || ""), u]));
    merged.web.users = merged.web.users.map((u) => {
      const nu = u && typeof u === "object" ? u : {};
      const username = String(nu.username || "");
      if (!username) return nu;
      if (!isMaskedOrBlank(nu.password)) return nu;
      const old = prevByUser.get(username);
      if (old && !isMaskedOrBlank(old.password)) nu.password = String(old.password || "");
      return nu;
    });
  }

  merged.providers = Array.isArray(merged.providers) ? merged.providers : [];
  const prevById = new Map((Array.isArray(p.providers) ? p.providers : []).map((x) => [String(x?.id || ""), x]));
  merged.providers = merged.providers.map((prov) => {
    const pr = prov && typeof prov === "object" ? prov : {};
    const id = String(pr.id || "");
    const old = prevById.get(id);
    if (old && isMaskedOrBlank(pr.apiKey)) pr.apiKey = String(old.apiKey || "");
    return pr;
  });

  return merged;
}

export function maskConfig(cfg) {
  const clone = JSON.parse(JSON.stringify(cfg || {}));
  clone.telegram ??= {};
  if (clone.telegram.token) clone.telegram.token = SECRET_MASK;
  clone.telegram.delivery ??= {};
  if (clone.telegram.delivery.webhookSecret) clone.telegram.delivery.webhookSecret = SECRET_MASK;
  clone.web ??= {};
  if (clone.web.password) clone.web.password = SECRET_MASK;
  if (Array.isArray(clone.web.users)) {
    clone.web.users = clone.web.users.map((u) => {
      const nu = u && typeof u === "object" ? u : {};
      if (nu.password) nu.password = SECRET_MASK;
      return nu;
    });
  }
  clone.providers = Array.isArray(clone.providers) ? clone.providers : [];
  clone.providers = clone.providers.map((p) => {
    const pr = p && typeof p === "object" ? p : {};
    if (pr.apiKey) pr.apiKey = SECRET_MASK;
    return pr;
  });
  return clone;
}

export function buildConfigSummary(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const provs = Array.isArray(c.providers) ? c.providers : [];
  const apiTypes = {};
  for (const p of provs) {
    const t = String(p?.apiType || "responses");
    apiTypes[t] = (apiTypes[t] || 0) + 1;
  }

  return {
    server: {
      host: String(c.server?.host || ""),
      port: Number(c.server?.port || 0)
    },
    web: {
      username: String(c.web?.username || ""),
      cookieSecure: c.web?.cookieSecure === true
    },
    telegram: {
      allowAll: c.telegram?.allowAll === true,
      replyStyleByDefault: String(c.telegram?.replyStyleByDefault || ""),
      allowedChatIdsCount: Array.isArray(c.telegram?.allowedChatIds) ? c.telegram.allowedChatIds.length : 0,
      allowedUserIdsCount: Array.isArray(c.telegram?.allowedUserIds) ? c.telegram.allowedUserIds.length : 0,
      queue: {
        minIntervalMs: Number(c.telegram?.queue?.minIntervalMs ?? 0),
        maxConcurrentJobs: Number(c.telegram?.queue?.maxConcurrentJobs ?? 0),
        maxPendingPerChat: Number(c.telegram?.queue?.maxPendingPerChat ?? 0)
      }
    },
    providers: {
      count: provs.length,
      defaultProviderId: String(c.defaultProviderId || ""),
      apiTypes
    },
    openai: {
      timeoutMs: Number(c.openai?.timeoutMs ?? 0),
      temperature: Number(c.openai?.temperature ?? 0),
      topP: Number(c.openai?.topP ?? 0),
      presencePenalty: Number(c.openai?.presencePenalty ?? 0),
      frequencyPenalty: Number(c.openai?.frequencyPenalty ?? 0),
      maxOutputTokens: Number(c.openai?.maxOutputTokens ?? 0),
      retry: {
        enabled: c.openai?.retry?.enabled === true,
        maxRetries: Number(c.openai?.retry?.maxRetries ?? 0),
        baseDelayMs: Number(c.openai?.retry?.baseDelayMs ?? 0),
        maxDelayMs: Number(c.openai?.retry?.maxDelayMs ?? 0),
        retryOnTimeout: c.openai?.retry?.retryOnTimeout !== false,
        retryOn429: c.openai?.retry?.retryOn429 !== false,
        retryOn5xx: c.openai?.retry?.retryOn5xx !== false
      }
    },
    stateStorage: {
      type: String(c.stateStorage?.type || ""),
      jsonPath: String(c.stateStorage?.jsonPath || ""),
      sqlitePath: String(c.stateStorage?.sqlitePath || "")
    },
    search: {
      enabled: c.search?.enabled === true,
      baseUrl: String(c.search?.baseUrl || ""),
      toolCallingEnabled: c.search?.toolCallingEnabled === true
    },
    longTerm: {
      enabled: c.longTerm?.enabled === true,
      memoryEnabled: c.longTerm?.memoryEnabled === true,
      personaEnabled: c.longTerm?.personaEnabled === true,
      dailySummaryEnabled: c.longTerm?.dailySummary?.enabled === true,
      dailySummaryTime: String(c.longTerm?.dailySummary?.time || ""),
      compressionEnabled: c.longTerm?.compression?.enabled === true
    },
    quotas: {
      enabled: c.quotas?.enabled === true,
      perUserTokensPerDay: Number(c.quotas?.perUserTokensPerDay ?? 0),
      perChatTokensPerDay: Number(c.quotas?.perChatTokensPerDay ?? 0),
      perUserRepliesPerDay: Number(c.quotas?.perUserRepliesPerDay ?? 0),
      perChatRepliesPerDay: Number(c.quotas?.perChatRepliesPerDay ?? 0)
    }
  };
}

export function buildDiagnostics({ cfg, configPath, stateStore, logger, logsLines = 400 }) {
  const now = new Date().toISOString();
  const knownChats = safeCall(() => stateStore?.listKnownChats?.()) || [];
  const convKeys = safeCall(() => stateStore?.listConversationKeys?.()) || [];
  const dailyDays = safeCall(() => stateStore?.listDailyDays?.({ limit: 365 })) || [];
  const rawLogs = safeCall(() => logger?.tail?.(logsLines)) || [];
  const secrets = collectSecrets(cfg);
  const logsTail = Array.isArray(rawLogs) ? rawLogs.map((l) => redactText(l, secrets)) : [];

  return {
    generatedAt: now,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    paths: {
      configPath: String(configPath || "")
    },
    summary: buildConfigSummary(cfg),
    maskedConfig: maskConfig(cfg),
    logsTail,
    state: {
      knownChatsCount: Array.isArray(knownChats) ? knownChats.length : 0,
      conversationsCount: Array.isArray(convKeys) ? convKeys.length : 0,
      dailyDaysCount: Array.isArray(dailyDays) ? dailyDays.length : 0
    }
  };
}

export function isMaskedOrBlank(v) {
  const s = String(v ?? "");
  if (!s) return true;
  if (s === SECRET_MASK) return true;
  return false;
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function collectSecrets(cfg) {
  const c = cfg && typeof cfg === "object" ? cfg : {};
  const out = [];
  const tgToken = String(c.telegram?.token || "").trim();
  if (tgToken) out.push(tgToken);
  const whSecret = String(c.telegram?.delivery?.webhookSecret || "").trim();
  if (whSecret) out.push(whSecret);
  const providers = Array.isArray(c.providers) ? c.providers : [];
  for (const p of providers) {
    const k = String(p?.apiKey || "").trim();
    if (k) out.push(k);
  }
  return [...new Set(out)].filter((s) => s.length >= 6);
}

function redactText(text, secrets) {
  let out = String(text || "");
  for (const s of secrets || []) {
    out = out.split(String(s)).join(SECRET_MASK);
  }
  out = out.replace(/(authorization:\s*bearer\s+)[^\s]+/gi, `$1${SECRET_MASK}`);
  out = out.replace(/(bot)\d{5,12}:[A-Za-z0-9_-]{20,}/g, `$1${SECRET_MASK}`);
  return out;
}
