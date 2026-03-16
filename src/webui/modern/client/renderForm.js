export function renderClientRenderForm() {
  return `
function renderForm(cfg) {
  const c = cfg || {};
  $("fDisplayName").value = c.app && c.app.displayName ? c.app.displayName : "";
  $("fServerHost").value = c.server && c.server.host ? c.server.host : "127.0.0.1";
  $("fServerPort").value = c.server && c.server.port != null ? c.server.port : 3210;
  $("fAdminUser").value = c.web && c.web.username ? c.web.username : "admin";
  $("fAdminPass").value = "";
  $("fCookieSecure").value = c.web && c.web.cookieSecure === true ? "true" : "false";
  $("fTgToken").value = "";
  $("fTgAllowAll").value = c.telegram && c.telegram.allowAll === true ? "true" : "false";
  $("fAllowedChats").value = Array.isArray(c.telegram && c.telegram.allowedChatIds) ? c.telegram.allowedChatIds.join("\\n") : "";
  $("fAllowedUsers").value = Array.isArray(c.telegram && c.telegram.allowedUserIds) ? c.telegram.allowedUserIds.join("\\n") : "";
  $("fTgMinInterval").value =
    c.telegram && c.telegram.queue && c.telegram.queue.minIntervalMs != null ? c.telegram.queue.minIntervalMs : 0;
  $("fTgMaxConcurrent").value =
    c.telegram && c.telegram.queue && c.telegram.queue.maxConcurrentJobs != null ? c.telegram.queue.maxConcurrentJobs : 0;
  $("fTgMaxPendingPerChat").value =
    c.telegram && c.telegram.queue && c.telegram.queue.maxPendingPerChat != null ? c.telegram.queue.maxPendingPerChat : 0;

  $("fTimeoutMs").value = c.openai && c.openai.timeoutMs != null ? c.openai.timeoutMs : 60000;
  $("fTemp").value = c.openai && c.openai.temperature != null ? c.openai.temperature : 0.7;
  $("fTopP").value = c.openai && c.openai.topP != null ? c.openai.topP : 1;
  $("fPresence").value = c.openai && c.openai.presencePenalty != null ? c.openai.presencePenalty : 0;
  $("fFrequency").value = c.openai && c.openai.frequencyPenalty != null ? c.openai.frequencyPenalty : 0;
  $("fMaxOut").value = c.openai && c.openai.maxOutputTokens != null ? c.openai.maxOutputTokens : 1024;
  $("fRetryEnabled").value = c.openai && c.openai.retry && c.openai.retry.enabled === true ? "true" : "false";
  $("fRetryMaxRetries").value = c.openai && c.openai.retry && c.openai.retry.maxRetries != null ? c.openai.retry.maxRetries : 0;
  $("fRetryBaseDelay").value =
    c.openai && c.openai.retry && c.openai.retry.baseDelayMs != null ? c.openai.retry.baseDelayMs : 300;
  $("fRetryMaxDelay").value = c.openai && c.openai.retry && c.openai.retry.maxDelayMs != null ? c.openai.retry.maxDelayMs : 3000;
  $("fRetryOnTimeout").value = c.openai && c.openai.retry && c.openai.retry.retryOnTimeout === false ? "false" : "true";
  $("fRetryOn429").value = c.openai && c.openai.retry && c.openai.retry.retryOn429 === false ? "false" : "true";
  $("fRetryOn5xx").value = c.openai && c.openai.retry && c.openai.retry.retryOn5xx === false ? "false" : "true";

  $("fMemDefault").value = c.memory && c.memory.enabledByDefault === false ? "false" : "true";
  $("fMemMax").value = c.memory && c.memory.maxMessages != null ? c.memory.maxMessages : 20;
  $("fMemMaxChars").value = c.memory && c.memory.maxCharsPerMessage != null ? c.memory.maxCharsPerMessage : 4000;
  $("fMaxFacts").value = c.facts && c.facts.maxFacts != null ? c.facts.maxFacts : 30;

  $("fRules").value = Array.isArray(c.rules) ? c.rules.join("\\n") : "";
  $("fStateType").value = c.stateStorage && c.stateStorage.type === "sqlite" ? "sqlite" : "json";
  $("fStateJson").value = c.stateStorage && c.stateStorage.jsonPath ? c.stateStorage.jsonPath : "data/state.json";
  $("fStateSqlite").value = c.stateStorage && c.stateStorage.sqlitePath ? c.stateStorage.sqlitePath : "data/state.sqlite";

  $("fSearchEnabled").value = c.search && c.search.enabled === true ? "true" : "false";
  $("fSearchBase").value = c.search && c.search.baseUrl ? c.search.baseUrl : "";
  $("fSearchTimeout").value = c.search && c.search.timeoutMs != null ? c.search.timeoutMs : 10000;
  $("fSearchMax").value = c.search && c.search.maxResults != null ? c.search.maxResults : 5;
  $("fSearchLang").value = c.search && c.search.language ? c.search.language : "en";
  $("fSearchSafe").value = c.search && c.search.safeSearch != null ? c.search.safeSearch : 1;
  $("fSearchCategories").value = c.search && c.search.categories ? c.search.categories : "";
  $("fToolCalling").value = c.search && c.search.toolCallingEnabled === true ? "true" : "false";
  $("fToolTurns").value = c.search && c.search.toolCallingMaxTurns != null ? c.search.toolCallingMaxTurns : 2;

  $("fLtEnabled").value = c.longTerm && c.longTerm.enabled === true ? "true" : "false";
  $("fLtMem").value = c.longTerm && c.longTerm.memoryEnabled === true ? "true" : "false";
  $("fLtPersona").value = c.longTerm && c.longTerm.personaEnabled === true ? "true" : "false";
  $("fLtDays").value = c.longTerm && c.longTerm.daysToInclude != null ? c.longTerm.daysToInclude : 7;
  const provIds = Array.isArray(c.providers) ? c.providers.map((p) => String((p && p.id) || "")).filter(Boolean) : [];
  renderSelectOptions($("fLtProvider"), [""].concat(provIds), String((c.longTerm && c.longTerm.summaryProviderId) || ""));
  $("fLtDailyEnabled").value =
    c.longTerm && c.longTerm.dailySummary && c.longTerm.dailySummary.enabled === true ? "true" : "false";
  $("fLtDailyTime").value =
    c.longTerm && c.longTerm.dailySummary && c.longTerm.dailySummary.time ? String(c.longTerm.dailySummary.time) : "03:00";
  $("fLtCompressEnabled").value =
    c.longTerm && c.longTerm.compression && c.longTerm.compression.enabled === true ? "true" : "false";
  $("fLtCompressTokens").value =
    c.longTerm && c.longTerm.compression && c.longTerm.compression.triggerTokens != null ? c.longTerm.compression.triggerTokens : 200000;
  $("fLtCompressChunk").value =
    c.longTerm && c.longTerm.compression && c.longTerm.compression.chunkMessages != null ? c.longTerm.compression.chunkMessages : 40;

  $("fQuotaEnabled").value = c.quotas && c.quotas.enabled === true ? "true" : "false";
  $("fQuotaUserTokens").value = c.quotas && c.quotas.perUserTokensPerDay != null ? c.quotas.perUserTokensPerDay : 0;
  $("fQuotaChatTokens").value = c.quotas && c.quotas.perChatTokensPerDay != null ? c.quotas.perChatTokensPerDay : 0;
  $("fQuotaUserReplies").value = c.quotas && c.quotas.perUserRepliesPerDay != null ? c.quotas.perUserRepliesPerDay : 0;
  $("fQuotaChatReplies").value = c.quotas && c.quotas.perChatRepliesPerDay != null ? c.quotas.perChatRepliesPerDay : 0;

  renderProviders(Array.isArray(c.providers) ? c.providers : [], String(c.defaultProviderId || ""));
  renderPrompts(Array.isArray(c.prompts) ? c.prompts : [], String(c.defaultPromptId || ""));
  renderPersonas(Array.isArray(c.personas) ? c.personas : [], String(c.defaultPersonaId || ""));
}
`;
}
