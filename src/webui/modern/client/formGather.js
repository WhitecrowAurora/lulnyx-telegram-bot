export function renderClientFormGather() {
  return `
function gatherFormConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse($("cfg").value || "{}");
  } catch {
    cfg = {};
  }

  cfg.app = cfg.app || {};
  cfg.app.displayName = String($("fDisplayName").value || "").trim() || cfg.app.displayName || I.placeholderDisplayName;
  cfg.app.setupCompleted = true;

  cfg.server = cfg.server || {};
  cfg.server.host = String($("fServerHost").value || "").trim() || "127.0.0.1";
  cfg.server.port = Number($("fServerPort").value || 3210) || 3210;

  cfg.web = cfg.web || {};
  cfg.web.username = String($("fAdminUser").value || "").trim() || "admin";
  cfg.web.password = String($("fAdminPass").value || ""); // blank => keep (server preserves)
  cfg.web.cookieSecure = $("fCookieSecure").value === "true";

  cfg.telegram = cfg.telegram || {};
  cfg.telegram.token = String($("fTgToken").value || ""); // blank => keep (server preserves)
  cfg.telegram.allowAll = $("fTgAllowAll").value === "true";
  cfg.telegram.delivery = cfg.telegram.delivery || {};
  cfg.telegram.delivery.mode = $("fTgDeliveryMode").value === "webhook" ? "webhook" : "polling";
  cfg.telegram.delivery.publicBaseUrl = String($("fTgPublicBaseUrl").value || "").trim();
  cfg.telegram.delivery.webhookSecret = String($("fTgWebhookSecret").value || ""); // blank => keep (server preserves)
  cfg.telegram.delivery.dropPendingUpdates = $("fTgDropPending").value === "true";
  cfg.telegram.replyStyleByDefault = String($("fTgReplyStyleDefault").value || "reply_and_mention");
  cfg.telegram.allowedChatIds = linesToArr($("fAllowedChats").value);
  cfg.telegram.allowedUserIds = linesToArr($("fAllowedUsers").value);
  cfg.telegram.queue = cfg.telegram.queue || {};
  cfg.telegram.queue.minIntervalMs = Number($("fTgMinInterval").value || 0);
  cfg.telegram.queue.maxConcurrentJobs = Number($("fTgMaxConcurrent").value || 0);
  cfg.telegram.queue.maxPendingPerChat = Number($("fTgMaxPendingPerChat").value || 0);

  cfg.openai = cfg.openai || {};
  cfg.openai.timeoutMs = Number($("fTimeoutMs").value || 60000);
  cfg.openai.temperature = Number($("fTemp").value || 0.7);
  cfg.openai.topP = Number($("fTopP").value || 1);
  cfg.openai.presencePenalty = Number($("fPresence").value || 0);
  cfg.openai.frequencyPenalty = Number($("fFrequency").value || 0);
  cfg.openai.maxOutputTokens = Number($("fMaxOut").value || 1024);
  cfg.openai.retry = cfg.openai.retry || {};
  cfg.openai.retry.enabled = $("fRetryEnabled").value === "true";
  cfg.openai.retry.maxRetries = Number($("fRetryMaxRetries").value || 0);
  cfg.openai.retry.baseDelayMs = Number($("fRetryBaseDelay").value || 300);
  cfg.openai.retry.maxDelayMs = Number($("fRetryMaxDelay").value || 3000);
  cfg.openai.retry.retryOnTimeout = $("fRetryOnTimeout").value !== "false";
  cfg.openai.retry.retryOn429 = $("fRetryOn429").value !== "false";
  cfg.openai.retry.retryOn5xx = $("fRetryOn5xx").value !== "false";

  cfg.memory = cfg.memory || {};
  cfg.memory.enabledByDefault = $("fMemDefault").value === "true";
  cfg.memory.maxMessages = Number($("fMemMax").value || 20);
  cfg.memory.maxCharsPerMessage = Number($("fMemMaxChars").value || 4000);
  cfg.facts = cfg.facts || {};
  cfg.facts.maxFacts = Number($("fMaxFacts").value || 30);

  cfg.rules = linesToArr($("fRules").value);

  cfg.stateStorage = cfg.stateStorage || {};
  cfg.stateStorage.type = $("fStateType").value === "sqlite" ? "sqlite" : "json";
  cfg.stateStorage.jsonPath = String($("fStateJson").value || "data/state.json").trim() || "data/state.json";
  cfg.stateStorage.sqlitePath = String($("fStateSqlite").value || "data/state.sqlite").trim() || "data/state.sqlite";

  cfg.security = cfg.security || {};
  cfg.security.outbound = cfg.security.outbound || {};
  cfg.security.outbound.blockPrivateNetworks = $("fSecBlockPrivate").value !== "false";
  cfg.security.outbound.dnsResolve = $("fSecDnsResolve").value !== "false";
  cfg.security.outbound.dnsTimeoutMs = Number($("fSecDnsTimeout").value || 800);
  cfg.security.outbound.denyOnResolveFailure = $("fSecDenyOnResolveFail").value === "true";
  cfg.security.outbound.allowedHostSuffixes = linesToArr($("fSecAllowedSuffixes").value);

  cfg.search = cfg.search || {};
  cfg.search.enabled = $("fSearchEnabled").value === "true";
  cfg.search.type = "searxng";
  cfg.search.baseUrl = String($("fSearchBase").value || "").trim();
  cfg.search.allowPrivateNetwork = $("fSearchAllowPrivate").value === "true";
  cfg.search.timeoutMs = Number($("fSearchTimeout").value || 10000);
  cfg.search.maxResults = Number($("fSearchMax").value || 5);
  cfg.search.language = String($("fSearchLang").value || "en").trim() || "en";
  cfg.search.safeSearch = Number($("fSearchSafe").value || 1);
  cfg.search.categories = String($("fSearchCategories").value || "").trim();
  cfg.search.toolCallingEnabled = $("fToolCalling").value === "true";
  cfg.search.toolCallingMaxTurns = Number($("fToolTurns").value || 2);

  cfg.longTerm = cfg.longTerm || {};
  cfg.longTerm.enabled = $("fLtEnabled").value === "true";
  cfg.longTerm.memoryEnabled = $("fLtMem").value === "true";
  cfg.longTerm.personaEnabled = $("fLtPersona").value === "true";
  cfg.longTerm.daysToInclude = Number($("fLtDays").value || 7);
  cfg.longTerm.summaryProviderId = String($("fLtProvider").value || "").trim();
  cfg.longTerm.dailySummary = cfg.longTerm.dailySummary || {};
  cfg.longTerm.dailySummary.enabled = $("fLtDailyEnabled").value === "true";
  cfg.longTerm.dailySummary.time = String($("fLtDailyTime").value || "03:00").trim() || "03:00";
  cfg.longTerm.compression = cfg.longTerm.compression || {};
  cfg.longTerm.compression.enabled = $("fLtCompressEnabled").value === "true";
  cfg.longTerm.compression.triggerTokens = Number($("fLtCompressTokens").value || 200000);
  cfg.longTerm.compression.chunkMessages = Number($("fLtCompressChunk").value || 40);

  cfg.quotas = cfg.quotas || {};
  cfg.quotas.enabled = $("fQuotaEnabled").value === "true";
  cfg.quotas.perUserTokensPerDay = Number($("fQuotaUserTokens").value || 0);
  cfg.quotas.perChatTokensPerDay = Number($("fQuotaChatTokens").value || 0);
  cfg.quotas.perUserRepliesPerDay = Number($("fQuotaUserReplies").value || 0);
  cfg.quotas.perChatRepliesPerDay = Number($("fQuotaChatReplies").value || 0);

  // Providers
  const provItems = [...document.querySelectorAll(".provider-item")];
  const providers = [];
  for (const it of provItems) {
    const get = (field) => it.querySelector('[data-field="' + field + '"]');
    const id = String(get("id")?.value || "").trim();
    if (!id) continue;
    const extraHeadersRaw = String(get("extraHeaders")?.value || "").trim();
    let extraHeaders = {};
    if (extraHeadersRaw) {
      try {
        const obj = JSON.parse(extraHeadersRaw);
        if (obj && typeof obj === "object") extraHeaders = obj;
      } catch {
        throw new Error("Provider " + id + ": extraHeaders JSON invalid");
      }
    }
    providers.push({
      id,
      name: String(get("name")?.value || "").trim() || id,
      baseUrl: String(get("baseUrl")?.value || "").trim(),
      apiKey: String(get("apiKey")?.value || ""),
      apiType: String(get("apiType")?.value || "responses") === "chat_completions" ? "chat_completions" : "responses",
      model: String(get("model")?.value || "").trim(),
      responsesStyle: String(get("responsesStyle")?.value || "instructions+messages"),
      responsesContentFormat: String(get("responsesContentFormat")?.value || "text"),
      extraHeaders,
      allowPrivateNetwork: String(get("allowPrivateNetwork")?.value || "false") === "true"
    });
  }
  cfg.providers = providers;
  cfg.defaultProviderId = String($("fDefaultProvider").value || "").trim() || (providers[0] ? providers[0].id : "");

  // Prompts
  const promptItems = [...document.querySelectorAll(".prompt-item")];
  const prompts = [];
  for (const it of promptItems) {
    const id = String(it.querySelector('[data-field="id"]')?.value || "").trim();
    if (!id) continue;
    prompts.push({
      id,
      name: String(it.querySelector('[data-field="name"]')?.value || "").trim() || id,
      system: String(it.querySelector('[data-field="system"]')?.value || "")
    });
  }
  cfg.prompts = prompts;
  cfg.defaultPromptId = String($("fDefaultPrompt").value || "").trim() || (prompts[0] ? prompts[0].id : "");

  // Personas
  const personaItems = [...document.querySelectorAll(".persona-item")];
  const personas = [];
  for (const it of personaItems) {
    const id = String(it.querySelector('[data-field="id"]')?.value || "").trim();
    if (!id) continue;
    personas.push({
      id,
      name: String(it.querySelector('[data-field="name"]')?.value || "").trim() || id,
      system: String(it.querySelector('[data-field="system"]')?.value || "")
    });
  }
  cfg.personas = personas;
  cfg.defaultPersonaId = String($("fDefaultPersona").value || "").trim() || (personas[0] ? personas[0].id : "");

  return cfg;
}
`;
}
