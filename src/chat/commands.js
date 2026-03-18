import { clamp } from "../util.js";
import { searxngImageSearch, searxngSearch } from "../search.js";
import { bt } from "../botI18n.js";
import { menuMarkup, menuText } from "./menu.js";
import { clampText, getActiveUserPrompt, getEffectiveChatReplyStyle, normalizeUserDisplayNameMode, normalizeUserPromptSlot } from "../state/common.js";

export async function handleCommand({ logger, configStore, stateStore, chatId, userId, chatType, lang, command, args }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const userProfile = stateStore.getUserProfile?.(userId) || null;
  const effectiveReplyStyle = getEffectiveChatReplyStyle({ cfg, chatSettings });
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
    const activePrompt = getActiveUserPrompt(userProfile);
    return [
      t("status.title"),
      `${t("status.provider")}: ${providerId}`,
      `${t("status.prompt")}: ${promptId}`,
      `${t("status.persona")}: ${personaId}`,
      `${t("status.memory")}: ${memEnabled ? t("memory.on") : t("memory.off")}`,
      `${t("status.reply_style")}: ${t(`replystyle.${effectiveReplyStyle}`)}`,
      `${t("status.name_mode")}: ${t(`profile.name_mode_${normalizeUserDisplayNameMode(userProfile?.displayNameMode)}`)}`,
      `${t("status.custom_name")}: ${String(userProfile?.customDisplayName || "").trim() || t("profile.custom_name_empty")}`,
      `${t("status.user_prompt")}: ${activePrompt.slot ? t(`profile.user_prompt_${activePrompt.slot}`) : t("profile.user_prompt_off")}`,
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
        timeoutMs: cfg.search.timeoutMs,
        security: cfg.security,
        allowPrivateNetwork: cfg.search.allowPrivateNetwork,
        logger
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
        timeoutMs: cfg.search.timeoutMs,
        security: cfg.security,
        allowPrivateNetwork: cfg.search.allowPrivateNetwork,
        logger
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

  if (command === "replystyle") {
    const mode = args.trim().toLowerCase();
    if (!mode) return t("usage.replystyle");
    const styleMap = {
      default: "",
      inherit: "",
      reply: "reply_only",
      reply_only: "reply_only",
      mention: "mention_only",
      mention_only: "mention_only",
      reply_mention: "reply_and_mention",
      reply_and_mention: "reply_and_mention"
    };
    const next = styleMap[mode];
    if (!next) return t("usage.replystyle");
    stateStore.updateChatSettings(chatId, (c) => (c.replyStyle = next));
    return next ? t("replystyle.set", { mode: t(`replystyle.${next}`) }) : t("replystyle.set_default");
  }

  if (command === "myprofile") {
    return describeUserProfile({ t, profile: userProfile });
  }

  if (command === "name") {
    const value = clampText(args, 64);
    if (!value) return t("usage.name");
    stateStore.updateUserProfile?.(userId, (p) => {
      p.customDisplayName = value;
      p.displayNameMode = "custom";
    });
    return t("profile.name_saved", { name: value });
  }

  if (command === "nameoff") {
    stateStore.updateUserProfile?.(userId, (p) => {
      p.displayNameMode = "username";
    });
    return t("profile.name_reset");
  }

  if (command === "namemode") {
    const raw = String(args || "").trim().toLowerCase();
    if (!raw) return t("usage.namemode");
    if (raw !== "username" && raw !== "custom") return t("usage.namemode");
    const next = normalizeUserDisplayNameMode(raw);
    stateStore.updateUserProfile?.(userId, (p) => {
      p.displayNameMode = next;
    });
    return t("profile.name_mode_set", { mode: t(`profile.name_mode_${next}`) });
  }

  if (command === "myprompt1" || command === "myprompt2") {
    const slot = command === "myprompt1" ? "slot1" : "slot2";
    const raw = String(args || "").trim();
    if (!raw) return t(`usage.${command}`);
    const isClear = raw.toLowerCase() === "clear" || raw === "-";
    const value = isClear ? "" : clampText(raw, 12000);
    stateStore.updateUserProfile?.(userId, (p) => {
      if (slot === "slot1") p.customPrompt1 = value;
      else p.customPrompt2 = value;
      if (isClear && normalizeUserPromptSlot(p.activePromptSlot) === slot) p.activePromptSlot = "";
    });
    return isClear ? t("profile.prompt_cleared", { slot: t(`profile.user_prompt_${slot}`) }) : t("profile.prompt_saved", { slot: t(`profile.user_prompt_${slot}`) });
  }

  if (command === "usemyprompt") {
    const raw = String(args || "").trim().toLowerCase();
    if (!raw) return t("usage.usemyprompt");
    const allowed = new Set(["off", "1", "2", "slot1", "slot2"]);
    if (!allowed.has(raw)) return t("usage.usemyprompt");
    const slot = normalizeUserPromptSlot(raw);
    stateStore.updateUserProfile?.(userId, (p) => {
      p.activePromptSlot = slot;
    });
    return slot ? t("profile.prompt_active", { slot: t(`profile.user_prompt_${slot}`) }) : t("profile.prompt_active_off");
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
    t("help.replystyle"),
    t("help.myprofile"),
    t("help.name"),
    t("help.nameoff"),
    t("help.namemode"),
    t("help.myprompt1"),
    t("help.myprompt2"),
    t("help.usemyprompt"),
    t("help.memory"),
    t("help.remember"),
    t("help.forget"),
    t("help.forget_all"),
    t("help.wipe"),
    t("help.menu"),
    t("help.reload")
  ].join("\n");
}

function describeUserProfile({ t, profile }) {
  const slot = getActiveUserPrompt(profile).slot;
  return [
    t("profile.title"),
    `${t("profile.name_mode")}: ${t(`profile.name_mode_${normalizeUserDisplayNameMode(profile?.displayNameMode)}`)}`,
    `${t("profile.custom_name")}: ${String(profile?.customDisplayName || "").trim() || t("profile.custom_name_empty")}`,
    `${t("profile.active_prompt")}: ${slot ? t(`profile.user_prompt_${slot}`) : t("profile.user_prompt_off")}`
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
