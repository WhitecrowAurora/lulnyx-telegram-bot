import fs from "node:fs";
import path from "node:path";
import { ensureDirSync, normalizeBaseUrl } from "./util.js";
import { resolveAppRootDir } from "./appPaths.js";

const CONFIG_FILENAME = "config.json";
const EXAMPLE_FILENAME = "config.example.json";

export async function createConfigStore({ logger }) {
  const rootDir = resolveAppRootDir();
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  const examplePath = path.join(rootDir, EXAMPLE_FILENAME);

  const store = {
    _configPath: configPath,
    _config: loadAndNormalize({ configPath, examplePath, logger }),
    _subs: new Set(),
    get() {
      return store._config;
    },
    hasConfigFile() {
      return fs.existsSync(configPath);
    },
    getConfigPath() {
      return configPath;
    },
    async set(nextConfig) {
      const normalized = normalizeConfig(nextConfig);
      await atomicWriteJson(configPath, normalized);
      store._config = normalized;
      for (const fn of store._subs) {
        try {
          fn(normalized);
        } catch {}
      }
      return normalized;
    },
    reload() {
      store._config = loadAndNormalize({ configPath, examplePath, logger });
      for (const fn of store._subs) {
        try {
          fn(store._config);
        } catch {}
      }
      return store._config;
    },
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      store._subs.add(fn);
      return () => store._subs.delete(fn);
    }
  };

  return store;
}

function loadAndNormalize({ configPath, examplePath, logger }) {
  let raw = {};
  if (fs.existsSync(configPath)) {
    try {
      raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      raw = {};
    }
    // Backward compatibility: older config.json may not have app.setupCompleted
    raw.app ??= {};
    if (raw.app.setupCompleted === undefined) raw.app.setupCompleted = true;
    return normalizeConfig(raw);
  }
  // Setup mode: fall back to example defaults (but do not write config.json automatically)
  if (fs.existsSync(examplePath)) {
    try {
      raw = JSON.parse(fs.readFileSync(examplePath, "utf8"));
      // Ensure setup isn't auto-completed if the user hasn't created config.json yet.
      raw.app ??= {};
      raw.app.setupCompleted = false;
      raw.telegram ??= {};
      raw.telegram.token = "";
      raw.providers = [];
      raw.defaultProviderId = "";
      return normalizeConfig(raw);
    } catch (err) {
      logger?.warn?.("failed to read config.example.json", err);
    }
  }
  return normalizeConfig({});
}

function normalizeConfig(cfg) {
  const config = typeof cfg === "object" && cfg ? cfg : {};

  config.app ??= {};
  config.app.displayName = String(config.app.displayName || "Bot Settings");
  config.app.setupCompleted = config.app.setupCompleted === true;

  config.telegram ??= {};
  config.telegram.token = String(config.telegram.token || "");
  // Access control:
  // - allowAll=true: old behavior (allow everywhere unless allowlists restrict).
  // - allowAll=false: deny by default; allow only if chatId/userId is allowlisted.
  config.telegram.allowAll = config.telegram.allowAll === true;
  config.telegram.allowedChatIds ??= [];
  config.telegram.allowedUserIds ??= [];
  config.telegram.queue ??= {};
  config.telegram.queue.minIntervalMs = Number.isFinite(config.telegram.queue.minIntervalMs)
    ? config.telegram.queue.minIntervalMs
    : 0;
  config.telegram.queue.maxConcurrentJobs = Number.isFinite(config.telegram.queue.maxConcurrentJobs)
    ? config.telegram.queue.maxConcurrentJobs
    : 0; // 0 => unlimited
  config.telegram.queue.maxPendingPerChat = Number.isFinite(config.telegram.queue.maxPendingPerChat)
    ? config.telegram.queue.maxPendingPerChat
    : 0; // 0 => unlimited
  config.telegram.autoReplyByDefault = config.telegram.autoReplyByDefault === true;

  config.server ??= {};
  config.server.host = String(config.server.host || "127.0.0.1");
  config.server.port = Number.isFinite(config.server.port) ? config.server.port : 3210;

  config.web ??= {};
  config.web.username = String(config.web.username || "admin");
  config.web.password = String(config.web.password || "change_me");
  config.web.cookieSecure = config.web.cookieSecure === true;

  config.stateStorage ??= {};
  config.stateStorage.type = config.stateStorage.type === "sqlite" ? "sqlite" : "json";
  config.stateStorage.jsonPath = String(config.stateStorage.jsonPath || "data/state.json");
  config.stateStorage.sqlitePath = String(config.stateStorage.sqlitePath || "data/state.sqlite");

  config.search ??= {};
  config.search.enabled = config.search.enabled === true;
  config.search.type = String(config.search.type || "searxng");
  config.search.baseUrl = String(config.search.baseUrl || "http://127.0.0.1:8080");
  config.search.timeoutMs = Number.isFinite(config.search.timeoutMs) ? config.search.timeoutMs : 10000;
  config.search.maxResults = Number.isFinite(config.search.maxResults) ? config.search.maxResults : 5;
  config.search.language = String(config.search.language || "en");
  config.search.safeSearch = Number.isFinite(config.search.safeSearch) ? config.search.safeSearch : 1;
  config.search.toolCallingEnabled = config.search.toolCallingEnabled === true;
  config.search.toolCallingMaxTurns = Number.isFinite(config.search.toolCallingMaxTurns) ? config.search.toolCallingMaxTurns : 2;

  config.providers = Array.isArray(config.providers) ? config.providers : [];
  config.providers = config.providers.map((p) => normalizeProvider(p)).filter((p) => p.id);

  config.defaultProviderId = String(config.defaultProviderId || (config.providers[0]?.id ?? ""));

  config.prompts = Array.isArray(config.prompts) ? config.prompts : [];
  config.prompts = config.prompts
    .map((p) => ({
      id: String(p?.id || ""),
      name: String(p?.name || p?.id || ""),
      system: String(p?.system || "")
    }))
    .filter((p) => p.id);
  config.defaultPromptId = String(config.defaultPromptId || (config.prompts[0]?.id ?? ""));

  config.personas = Array.isArray(config.personas) ? config.personas : [];
  config.personas = config.personas
    .map((p) => ({
      id: String(p?.id || ""),
      name: String(p?.name || p?.id || ""),
      system: String(p?.system || "")
    }))
    .filter((p) => p.id);
  config.defaultPersonaId = String(config.defaultPersonaId || (config.personas[0]?.id ?? ""));

  config.rules = Array.isArray(config.rules) ? config.rules.map((r) => String(r)).filter(Boolean) : [];

  config.memory ??= {};
  config.memory.enabledByDefault = config.memory.enabledByDefault !== false;
  config.memory.maxMessages = Number.isFinite(config.memory.maxMessages) ? config.memory.maxMessages : 20;
  config.memory.maxCharsPerMessage = Number.isFinite(config.memory.maxCharsPerMessage)
    ? config.memory.maxCharsPerMessage
    : 4000;

  config.facts ??= {};
  config.facts.maxFacts = Number.isFinite(config.facts.maxFacts) ? config.facts.maxFacts : 30;

  config.longTerm ??= {};
  config.longTerm.enabled = config.longTerm.enabled === true;
  config.longTerm.memoryEnabled = config.longTerm.memoryEnabled === true;
  config.longTerm.personaEnabled = config.longTerm.personaEnabled === true;
  config.longTerm.daysToInclude = Number.isFinite(config.longTerm.daysToInclude) ? config.longTerm.daysToInclude : 7;
  config.longTerm.daysToInclude = Math.max(1, Math.min(30, Math.trunc(config.longTerm.daysToInclude)));
  config.longTerm.summaryProviderId = String(config.longTerm.summaryProviderId || "");
  config.longTerm.dailySummary ??= {};
  config.longTerm.dailySummary.enabled = config.longTerm.dailySummary.enabled === true;
  config.longTerm.dailySummary.time = String(config.longTerm.dailySummary.time || "03:00");
  config.longTerm.compression ??= {};
  config.longTerm.compression.enabled = config.longTerm.compression.enabled === true;
  config.longTerm.compression.triggerTokens = Number.isFinite(config.longTerm.compression.triggerTokens)
    ? config.longTerm.compression.triggerTokens
    : 200000;
  config.longTerm.compression.triggerTokens = Math.max(10_000, Math.min(500_000, Math.trunc(config.longTerm.compression.triggerTokens)));
  config.longTerm.compression.chunkMessages = Number.isFinite(config.longTerm.compression.chunkMessages)
    ? config.longTerm.compression.chunkMessages
    : 40;
  config.longTerm.compression.chunkMessages = Math.max(10, Math.min(200, Math.trunc(config.longTerm.compression.chunkMessages)));

  config.quotas ??= {};
  config.quotas.enabled = config.quotas.enabled === true;
  config.quotas.perUserTokensPerDay = Number.isFinite(config.quotas.perUserTokensPerDay) ? config.quotas.perUserTokensPerDay : 0;
  config.quotas.perChatTokensPerDay = Number.isFinite(config.quotas.perChatTokensPerDay) ? config.quotas.perChatTokensPerDay : 0;
  config.quotas.perUserRepliesPerDay = Number.isFinite(config.quotas.perUserRepliesPerDay) ? config.quotas.perUserRepliesPerDay : 0;
  config.quotas.perChatRepliesPerDay = Number.isFinite(config.quotas.perChatRepliesPerDay) ? config.quotas.perChatRepliesPerDay : 0;

  config.openai ??= {};
  config.openai.timeoutMs = Number.isFinite(config.openai.timeoutMs) ? config.openai.timeoutMs : 60000;
  config.openai.temperature = Number.isFinite(config.openai.temperature) ? config.openai.temperature : 0.7;
  config.openai.maxOutputTokens = Number.isFinite(config.openai.maxOutputTokens) ? config.openai.maxOutputTokens : 1024;
  config.openai.topP = Number.isFinite(config.openai.topP) ? config.openai.topP : 1;
  config.openai.presencePenalty = Number.isFinite(config.openai.presencePenalty) ? config.openai.presencePenalty : 0;
  config.openai.frequencyPenalty = Number.isFinite(config.openai.frequencyPenalty) ? config.openai.frequencyPenalty : 0;
  config.openai.retry ??= {};
  config.openai.retry.enabled = config.openai.retry.enabled === true;
  config.openai.retry.maxRetries = Number.isFinite(config.openai.retry.maxRetries) ? config.openai.retry.maxRetries : 0;
  config.openai.retry.maxRetries = Math.max(0, Math.min(10, Math.trunc(config.openai.retry.maxRetries)));
  config.openai.retry.baseDelayMs = Number.isFinite(config.openai.retry.baseDelayMs) ? config.openai.retry.baseDelayMs : 300;
  config.openai.retry.baseDelayMs = Math.max(0, Math.min(30_000, Math.trunc(config.openai.retry.baseDelayMs)));
  config.openai.retry.maxDelayMs = Number.isFinite(config.openai.retry.maxDelayMs) ? config.openai.retry.maxDelayMs : 3000;
  config.openai.retry.maxDelayMs = Math.max(0, Math.min(60_000, Math.trunc(config.openai.retry.maxDelayMs)));
  config.openai.retry.retryOnTimeout = config.openai.retry.retryOnTimeout !== false;
  config.openai.retry.retryOn429 = config.openai.retry.retryOn429 !== false;
  config.openai.retry.retryOn5xx = config.openai.retry.retryOn5xx !== false;

  return config;
}

function normalizeProvider(p) {
  const provider = typeof p === "object" && p ? { ...p } : {};
  provider.id = String(provider.id || "");
  provider.name = String(provider.name || provider.id || "");
  provider.baseUrl = normalizeBaseUrl(provider.baseUrl || "");
  provider.apiKey = String(provider.apiKey || "");
  provider.apiType = provider.apiType === "chat_completions" ? "chat_completions" : "responses";
  provider.model = String(provider.model || "");
  provider.responsesStyle = String(provider.responsesStyle || "instructions+messages");
  provider.responsesContentFormat = String(provider.responsesContentFormat || "text");
  provider.extraHeaders = typeof provider.extraHeaders === "object" && provider.extraHeaders ? provider.extraHeaders : {};
  return provider;
}

async function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  ensureDirSync(fs, dir);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}
