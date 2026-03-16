import { clamp } from "../util.js";
import { searxngImageSearch, searxngSearch } from "../search.js";
import { bt } from "../botI18n.js";
import { menuMarkup, menuText } from "./menu.js";

export async function handleCommand({ logger, configStore, stateStore, chatId, userId, chatType, lang, command, args }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const conv = stateStore.getConversation({ chatId, userId, chatType });
  if (!conv) return t("err.conversation_na");

  if (command === "start" || command === "help") return helpText(lang);

  if (command === "reload") {
    configStore.reload();
    return t("ok.reloaded");
  }

  if (command === "status") {
    const providerId = chatSettings.providerId || cfg.defaultProviderId || "";
    const promptId = conv.promptId || cfg.defaultPromptId || "";
    const personaId = conv.personaId || cfg.defaultPersonaId || "";
    const memEnabled = conv.memoryEnabled ?? cfg.memory.enabledByDefault;
    const factsCount = Array.isArray(conv.facts) ? conv.facts.length : 0;
    const historyCount = Array.isArray(conv.history) ? conv.history.length : 0;
    return [
      t("status.title"),
      `${t("status.provider")}: ${providerId}`,
      `${t("status.prompt")}: ${promptId}`,
      `${t("status.persona")}: ${personaId}`,
      `${t("status.memory")}: ${memEnabled ? t("memory.on") : t("memory.off")}`,
      `${t("status.facts")}: ${factsCount}`,
      `${t("status.history")}: ${historyCount}`
    ].join("\n");
  }

  if (command === "chatid") {
    const type = String(chatType || "");
    return `chat_id: ${chatId}\nuser_id: ${userId}${type ? `\nchat_type: ${type}` : ""}`;
  }

  if (command === "search") {
    const q = args.trim();
    if (!cfg.search?.enabled) return t("search.disabled");
    if (!q) return t("usage.search");
    if (String(cfg.search.type || "searxng") !== "searxng") return t("search.unsupported");
    try {
      const results = await searxngSearch({
        baseUrl: cfg.search.baseUrl,
        query: q,
        language: cfg.search.language,
        safeSearch: cfg.search.safeSearch,
        categories: cfg.search.categories || "",
        maxResults: cfg.search.maxResults,
        timeoutMs: cfg.search.timeoutMs
      });
      if (results.length === 0) return t("search.no_results");
      const lines = [t("search.results")];
      for (const r of results) {
        const title = r.title || r.url || "(no title)";
        lines.push(`- ${title}\n  ${r.url}`);
      }
      return lines.join("\n");
    } catch (err) {
      logger?.warn?.("search failed", err);
      return t("search.error", { message: err?.message || "unknown" });
    }
  }

  if (command === "img") {
    const q = args.trim();
    if (!cfg.search?.enabled) return t("search.disabled");
    if (!q) return t("usage.img");
    if (String(cfg.search.type || "searxng") !== "searxng") return t("search.unsupported");
    try {
      const results = await searxngImageSearch({
        baseUrl: cfg.search.baseUrl,
        query: q,
        language: cfg.search.language,
        safeSearch: cfg.search.safeSearch,
        maxResults: cfg.search.maxResults,
        timeoutMs: cfg.search.timeoutMs
      });
      const https = results.filter((r) => String(r.imageUrl).startsWith("https://"));
      const picked = (https.length > 0 ? https : results).slice(0, 3);
      if (picked.length === 0) return t("img.no_results");
      return {
        photos: picked.map((r) => ({
          url: r.imageUrl,
          caption: r.title ? `${r.title}\n${r.pageUrl}` : r.pageUrl
        }))
      };
    } catch (err) {
      logger?.warn?.("img search failed", err);
      return t("img.error", { message: err?.message || "unknown" });
    }
  }

  if (command === "rules") {
    const rulesList = Array.isArray(cfg.rules) ? cfg.rules.map((r) => String(r || "").trim()).filter(Boolean) : [];
    if (rulesList.length === 0) return t("rules.none");
    return [t("rules.title"), ...rulesList.map((r) => `- ${r}`)].join("\n");
  }

  if (command === "api") {
    const targetId = args.trim();
    if (!targetId) return listProviders(cfg, chatSettings, cfg.defaultProviderId, lang);
    const exists = cfg.providers.some((p) => p.id === targetId);
    if (!exists)
      return `${t("providers.unknown", { id: targetId })}\n\n${listProviders(cfg, chatSettings, cfg.defaultProviderId, lang)}`;
    stateStore.updateChatSettings(chatId, (c) => (c.providerId = targetId));
    return t("providers.set", { id: targetId });
  }

  if (command === "prompt") {
    const targetId = args.trim();
    if (!targetId) return listPrompts(cfg, conv, cfg.defaultPromptId, lang);
    const exists = cfg.prompts.some((p) => p.id === targetId);
    if (!exists) return `${t("prompts.unknown", { id: targetId })}\n\n${listPrompts(cfg, conv, cfg.defaultPromptId, lang)}`;
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.promptId = targetId));
    return t("prompts.set", { id: targetId });
  }

  if (command === "persona") {
    const targetId = args.trim();
    if (!targetId) return listPersonas(cfg, conv, cfg.defaultPersonaId, lang);
    const exists = cfg.personas.some((p) => p.id === targetId);
    if (!exists)
      return `${t("personas.unknown", { id: targetId })}\n\n${listPersonas(cfg, conv, cfg.defaultPersonaId, lang)}`;
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.personaId = targetId));
    return t("personas.set", { id: targetId });
  }

  if (command === "reset") {
    clearConversationHistory({ stateStore, chatId, userId, chatType });
    return t("ok.conversation_cleared");
  }

  if (command === "autoreply") {
    const mode = args.trim().toLowerCase();
    if (mode !== "on" && mode !== "off") return t("usage.autoreply");
    stateStore.updateChatSettings(chatId, (c) => (c.autoReply = mode === "on"));
    return mode === "on" ? t("autoreply.on") : t("autoreply.off");
  }

  if (command === "memory") {
    const mode = args.trim().toLowerCase();
    if (mode !== "on" && mode !== "off") return t("usage.memory");
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.memoryEnabled = mode === "on"));
    return `${t("status.memory")}: ${mode === "on" ? t("memory.on") : t("memory.off")}`;
  }

  if (command === "remember") {
    const fact = args.trim();
    if (!fact) return t("usage.remember");
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => {
      c.facts ??= [];
      c.facts.push(fact);
      const maxFacts = clamp(Number(cfg.facts?.maxFacts ?? 30), 0, 500);
      if (maxFacts > 0 && c.facts.length > maxFacts) c.facts = c.facts.slice(c.facts.length - maxFacts);
    });
    return t("ok.saved");
  }

  if (command === "forget") {
    const mode = args.trim().toLowerCase();
    if (mode === "all" || mode === "history") {
      clearConversationAll({ stateStore, chatId, userId, chatType, keepIds: true });
      return t("ok.cleared_facts_history");
    }
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.facts = []));
    return t("ok.cleared_facts");
  }

  if (command === "wipe") {
    clearConversationAll({ stateStore, chatId, userId, chatType, keepIds: true });
    return t("ok.cleared_facts_history");
  }

  if (command === "menu") {
    return {
      text: menuText({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang }),
      replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
    };
  }

  return `${t("err.unknown_command", { command })}\n\n${helpText(lang)}`;
}

export function parseCommand(text) {
  if (typeof text !== "string") return null;
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const firstSpace = t.indexOf(" ");
  const head = (firstSpace >= 0 ? t.slice(1, firstSpace) : t.slice(1)).trim();
  const args = firstSpace >= 0 ? t.slice(firstSpace + 1) : "";
  if (!head) return null;
  const cmd = head.split("@")[0].toLowerCase();
  return { command: cmd, args };
}

function helpText(lang) {
  const t = (key, vars) => bt(lang, key, vars);
  return [
    t("help.title"),
    `/help - ${t("cmd.help.desc")}`,
    t("help.api_list"),
    t("help.api_set"),
    t("help.prompt_list"),
    t("help.prompt_set"),
    t("help.persona_list"),
    t("help.persona_set"),
    t("help.rules"),
    t("help.status"),
    t("help.chatid"),
    t("help.search"),
    t("help.img"),
    t("help.reset"),
    t("help.autoreply"),
    t("help.memory"),
    t("help.remember"),
    t("help.forget"),
    t("help.forget_all"),
    t("help.wipe"),
    t("help.menu"),
    t("help.reload")
  ].join("\n");
}

function listProviders(cfg, chatSettings, defaultProviderId, lang) {
  const t = (key, vars) => bt(lang, key, vars);
  const current = (chatSettings?.providerId || defaultProviderId || "").trim();
  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  if (providers.length === 0) return t("providers.none");
  const lines = [t("providers.title")];
  for (const p of providers) {
    const mark = p.id === current ? "*" : " ";
    lines.push(`${mark} ${p.id} - ${p.name || p.id} (${p.apiType}, ${p.model})`);
  }
  lines.push(`\n${t("providers.use")}`);
  return lines.join("\n");
}

function listPrompts(cfg, chat, defaultPromptId, lang) {
  const t = (key, vars) => bt(lang, key, vars);
  const current = (chat?.promptId || defaultPromptId || "").trim();
  const prompts = Array.isArray(cfg.prompts) ? cfg.prompts : [];
  if (prompts.length === 0) return t("prompts.none");
  const lines = [t("prompts.title")];
  for (const p of prompts) {
    const mark = p.id === current ? "*" : " ";
    lines.push(`${mark} ${p.id} - ${p.name}`);
  }
  lines.push(`\n${t("prompts.use")}`);
  return lines.join("\n");
}

function listPersonas(cfg, conv, defaultPersonaId, lang) {
  const t = (key, vars) => bt(lang, key, vars);
  const current = (conv?.personaId || defaultPersonaId || "").trim();
  const personas = Array.isArray(cfg.personas) ? cfg.personas : [];
  if (personas.length === 0) return t("personas.none");
  const lines = [t("personas.title")];
  for (const p of personas) {
    const mark = p.id === current ? "*" : " ";
    lines.push(`${mark} ${p.id} - ${p.name}`);
  }
  lines.push(`\n${t("personas.use")}`);
  return lines.join("\n");
}

function legacyGroupConversationKey({ chatId, chatType }) {
  const type = String(chatType || "");
  if (type === "group" || type === "supergroup") return String(chatId);
  return "";
}

export function clearConversationHistory({ stateStore, chatId, userId, chatType }) {
  stateStore.updateConversation({ chatId, userId, chatType }, (c) => {
    c.history = [];
    c.summaryText = "";
    c.summaryUpdatedAt = 0;
  });

  const legacyKey = legacyGroupConversationKey({ chatId, chatType });
  if (legacyKey && stateStore.peekConversationByKey?.(legacyKey)) {
    stateStore.updateConversationByKey(legacyKey, (c) => {
      c.history = [];
      c.summaryText = "";
      c.summaryUpdatedAt = 0;
    });
  }
}

export function clearConversationAll({ stateStore, chatId, userId, chatType, keepIds }) {
  stateStore.updateConversation({ chatId, userId, chatType }, (c) => {
    if (!keepIds) {
      c.promptId = "";
      c.personaId = "";
      c.memoryEnabled = null;
    }
    c.facts = [];
    c.history = [];
    c.summaryText = "";
    c.summaryUpdatedAt = 0;
  });

  const legacyKey = legacyGroupConversationKey({ chatId, chatType });
  if (legacyKey && stateStore.peekConversationByKey?.(legacyKey)) {
    stateStore.updateConversationByKey(legacyKey, (c) => {
      if (!keepIds) {
        c.promptId = "";
        c.personaId = "";
        c.memoryEnabled = null;
      }
      c.facts = [];
      c.history = [];
      c.summaryText = "";
      c.summaryUpdatedAt = 0;
    });
  }
}

