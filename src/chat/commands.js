import { clamp } from "../util.js";
import { searxngImageSearch, searxngSearch } from "../search.js";
import { bt } from "../botI18n.js";
import { menuMarkup, menuText } from "./menu.js";
import {
  getGroupPersonaOptOut,
  getGroupPersonaQueueEntries,
  getUserProfileDisplayName,
  isGroupChatType,
  removeGroupPersonaQueueMember,
  resetGroupPersonaUsageState,
  resolveGroupPersonaSelection,
  setGroupPersonaOptOut,
  upsertGroupPersonaQueueMember
} from "../groupPersona.js";
import {
  clampText,
  getActiveUserPersona,
  getActiveUserPrompt,
  getEffectiveChatReplyStyle,
  normalizeUserDisplayNameMode,
  normalizeUserPromptSlot
} from "../state/common.js";

function maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType }) {
  if (!changed) return false;
  clearConversationHistory({ stateStore, chatId, userId, chatType });
  return true;
}

function withHistoryResetNotice(text, didReset, t) {
  return didReset ? `${text}\n${t("notice.history_reset")}` : text;
}

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
    const activePersona = getActiveUserPersona(userProfile);
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
      `${t("status.user_persona")}: ${describePersonaState({ t, profile: userProfile, activePersona })}`,
      ...(isGroupChatType(chatType)
        ? [`${t("status.global_persona")}: ${describeGlobalPersonaStatus({ t, stateStore, chatId, userId, chatType, chatSettings })}`]
        : []),
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
    const changed = (conv.promptId || cfg.defaultPromptId || "") !== targetId;
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.promptId = targetId));
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    return withHistoryResetNotice(t("prompts.set", { id: targetId }), didReset, t);
  }

  if (command === "persona") {
    const targetId = args.trim();
    if (!targetId) return listPersonas(cfg, conv, cfg.defaultPersonaId, lang);
    const exists = cfg.personas.some((p) => p.id === targetId);
    if (!exists)
      return `${t("personas.unknown", { id: targetId })}\n\n${listPersonas(cfg, conv, cfg.defaultPersonaId, lang)}`;
    const changed = (conv.personaId || cfg.defaultPersonaId || "") !== targetId;
    stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.personaId = targetId));
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    return withHistoryResetNotice(t("personas.set", { id: targetId }), didReset, t);
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

  if (command === "globalpersona") {
    if (!isGroupChatType(chatType)) return t("globalpersona.group_only");
    const raw = String(args || "").trim();
    if (!raw || raw.toLowerCase() === "status")
      return describeGlobalPersonaDetail({ t, stateStore, chatId, userId, chatType, chatSettings });
    const parts = raw.split(/\s+/).filter(Boolean);
    const sub = String(parts[0] || "").toLowerCase();

    if (sub === "on") {
      const personaText = clampText(userProfile?.customPersona, 12000);
      if (!personaText) return t("globalpersona.no_persona");
      const nextLimit = parts[1] === undefined ? chatSettings?.globalPersonaReplyLimit : Number(parts[1]);
      if (parts[1] !== undefined && (!Number.isFinite(nextLimit) || nextLimit < 0)) return t("usage.globalpersona");
      const normalizedLimit = clamp(Math.trunc(Number(nextLimit ?? 100) || 0), 0, 1000000);
      const prevEnabled = chatSettings?.globalPersonaEnabled === true;
      const prevOwnerUserId = String(chatSettings?.globalPersonaUserId || "").trim();
      const prevMode = String(chatSettings?.globalPersonaMode || "single").trim().toLowerCase();
      const changed = !prevEnabled || prevMode !== "single" || prevOwnerUserId !== String(userId);
      stateStore.updateChatSettings(chatId, (c) => {
        c.globalPersonaEnabled = true;
        c.globalPersonaMode = "single";
        c.globalPersonaUserId = String(userId);
        c.globalPersonaReplyLimit = normalizedLimit;
        if (changed) resetGroupPersonaUsageState(c);
      });
      if (changed) clearConversationHistoryForChat({ stateStore, chatId, chatType });
      return withHistoryResetNotice(
        `${t("globalpersona.enabled", {
          userId: getUserProfileDisplayName(userProfile, String(userId)) || String(userId),
          limit: formatLimitValue(t, normalizedLimit)
        })}\n${t("globalpersona.note_autoreply")}`,
        changed,
        t
      );
    }

    if (sub === "off") {
      const changed = chatSettings?.globalPersonaEnabled === true;
      stateStore.updateChatSettings(chatId, (c) => {
        c.globalPersonaEnabled = false;
      });
      if (changed) clearConversationHistoryForChat({ stateStore, chatId, chatType });
      return withHistoryResetNotice(t("globalpersona.disabled"), changed, t);
    }

    if (sub === "mode") {
      const nextMode = String(parts[1] || "").trim().toLowerCase();
      if (nextMode !== "single" && nextMode !== "sequential" && nextMode !== "random") return t("usage.globalpersona");
      const prevEnabled = chatSettings?.globalPersonaEnabled === true;
      const prevMode = String(chatSettings?.globalPersonaMode || "single").trim().toLowerCase();
      const callerPersonaText = clampText(userProfile?.customPersona, 12000);
      const changed = !prevEnabled || prevMode !== nextMode;
      stateStore.updateChatSettings(chatId, (c) => {
        c.globalPersonaEnabled = true;
        c.globalPersonaMode = nextMode;
        if (nextMode === "single" && !String(c.globalPersonaUserId || "").trim() && callerPersonaText) c.globalPersonaUserId = String(userId);
        if (changed) resetGroupPersonaUsageState(c);
      });
      if (changed) clearConversationHistoryForChat({ stateStore, chatId, chatType });
      return withHistoryResetNotice(t("globalpersona.mode_set", { mode: t(`globalpersona.mode_${nextMode}`) }), changed, t);
    }

    if (sub === "join") {
      const personaText = clampText(userProfile?.customPersona, 12000);
      if (!personaText) return t("globalpersona.no_persona");
      const queueEntries = getGroupPersonaQueueEntries({ chatSettings, stateStore });
      const currentEntry = queueEntries.find((entry) => entry.userId === String(userId));
      const nextLimit = parts[1] === undefined ? currentEntry?.replyLimit ?? chatSettings?.globalPersonaReplyLimit : Number(parts[1]);
      if (parts[1] !== undefined && (!Number.isFinite(nextLimit) || nextLimit < 0)) return t("usage.globalpersona");
      const normalizedLimit = clamp(Math.trunc(Number(nextLimit ?? 100) || 0), 0, 1000000);
      const prevEnabled = chatSettings?.globalPersonaEnabled === true;
      const prevMode = String(chatSettings?.globalPersonaMode || "single").trim().toLowerCase();
      const changed = !prevEnabled || prevMode === "single" || !currentEntry;
      stateStore.updateChatSettings(chatId, (c) => {
        upsertGroupPersonaQueueMember(c, { userId, replyLimit: normalizedLimit });
        c.globalPersonaEnabled = true;
        if (String(c.globalPersonaMode || "single").trim().toLowerCase() === "single") c.globalPersonaMode = "sequential";
        if (changed) resetGroupPersonaUsageState(c);
      });
      if (changed) clearConversationHistoryForChat({ stateStore, chatId, chatType });
      return withHistoryResetNotice(
        currentEntry
          ? t("globalpersona.join_updated", { limit: formatLimitValue(t, normalizedLimit) })
          : t("globalpersona.joined", { limit: formatLimitValue(t, normalizedLimit) }),
        changed,
        t
      );
    }

    if (sub === "leave") {
      const queueEntries = getGroupPersonaQueueEntries({ chatSettings, stateStore });
      const currentEntry = queueEntries.find((entry) => entry.userId === String(userId));
      if (!currentEntry) return t("globalpersona.not_in_queue");
      stateStore.updateChatSettings(chatId, (c) => {
        removeGroupPersonaQueueMember(c, userId);
        resetGroupPersonaUsageState(c);
      });
      clearConversationHistoryForChat({ stateStore, chatId, chatType });
      return withHistoryResetNotice(t("globalpersona.left"), true, t);
    }

    if (sub === "limit") {
      const nextLimit = Number(parts[1]);
      if (!Number.isFinite(nextLimit) || nextLimit < 0) return t("usage.globalpersona");
      const normalizedLimit = clamp(Math.trunc(nextLimit), 0, 1000000);
      const mode = String(chatSettings?.globalPersonaMode || "single").trim().toLowerCase();
      if (mode === "single") {
        stateStore.updateChatSettings(chatId, (c) => {
          c.globalPersonaReplyLimit = normalizedLimit;
        });
        return t("globalpersona.limit_set", { limit: formatLimitValue(t, normalizedLimit) });
      }
      const queueEntries = getGroupPersonaQueueEntries({ chatSettings, stateStore });
      const currentEntry = queueEntries.find((entry) => entry.userId === String(userId));
      if (!currentEntry) return t("globalpersona.not_in_queue");
      stateStore.updateChatSettings(chatId, (c) => {
        upsertGroupPersonaQueueMember(c, { userId, replyLimit: normalizedLimit });
      });
      return t("globalpersona.limit_member_set", { limit: formatLimitValue(t, normalizedLimit) });
    }

    if (sub === "reset") {
      stateStore.updateChatSettings(chatId, (c) => {
        resetGroupPersonaUsageState(c);
      });
      return t("globalpersona.count_reset");
    }

    if (sub === "optout") {
      const next = String(parts[1] || "").trim().toLowerCase();
      const current = getGroupPersonaOptOut({ stateStore, chatId, userId });
      if (!next || next === "status") return current ? t("globalpersona.optout_on") : t("globalpersona.optout_off");
      if (next !== "on" && next !== "off") return t("usage.globalpersona");
      const enabled = next === "on";
      setGroupPersonaOptOut({ stateStore, chatId, userId, enabled });
      const didReset = maybeClearConversationHistory({
        changed: current !== enabled,
        stateStore,
        chatId,
        userId,
        chatType
      });
      return withHistoryResetNotice(enabled ? t("globalpersona.optout_on") : t("globalpersona.optout_off"), didReset, t);
    }

    return t("usage.globalpersona");
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
    const prevActiveSlot = normalizeUserPromptSlot(userProfile?.activePromptSlot);
    const prevValue = slot === "slot1" ? String(userProfile?.customPrompt1 || "") : String(userProfile?.customPrompt2 || "");
    stateStore.updateUserProfile?.(userId, (p) => {
      if (slot === "slot1") p.customPrompt1 = value;
      else p.customPrompt2 = value;
      if (isClear && normalizeUserPromptSlot(p.activePromptSlot) === slot) p.activePromptSlot = "";
    });
    const changed = prevActiveSlot === slot && prevValue !== value;
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    const message = isClear ? t("profile.prompt_cleared", { slot: t(`profile.user_prompt_${slot}`) }) : t("profile.prompt_saved", { slot: t(`profile.user_prompt_${slot}`) });
    return withHistoryResetNotice(message, didReset, t);
  }

  if (command === "usemyprompt") {
    const raw = String(args || "").trim().toLowerCase();
    if (!raw) return t("usage.usemyprompt");
    const allowed = new Set(["off", "1", "2", "slot1", "slot2"]);
    if (!allowed.has(raw)) return t("usage.usemyprompt");
    const slot = normalizeUserPromptSlot(raw);
    const changed = normalizeUserPromptSlot(userProfile?.activePromptSlot) !== slot;
    stateStore.updateUserProfile?.(userId, (p) => {
      p.activePromptSlot = slot;
    });
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    const message = slot ? t("profile.prompt_active", { slot: t(`profile.user_prompt_${slot}`) }) : t("profile.prompt_active_off");
    return withHistoryResetNotice(message, didReset, t);
  }

  if (command === "mypersona") {
    const raw = String(args || "").trim();
    if (!raw) return describeUserPersona({ t, profile: userProfile, includeUsage: true });
    const isClear = raw.toLowerCase() === "clear" || raw === "-";
    const value = isClear ? "" : clampText(raw, 12000);
    const prevActivePersona = getActiveUserPersona(userProfile);
    const nextEnabled = !isClear && Boolean(value);
    stateStore.updateUserProfile?.(userId, (p) => {
      p.customPersona = value;
      p.customPersonaEnabled = nextEnabled;
    });
    const changed = prevActivePersona.enabled !== nextEnabled || (nextEnabled && prevActivePersona.text !== value);
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    const nextProfile = stateStore.getUserProfile?.(userId) || userProfile;
    return [
      withHistoryResetNotice(isClear ? t("profile.persona_cleared") : t("profile.persona_saved"), didReset, t),
      "",
      describeUserPersona({ t, profile: nextProfile, includeUsage: true })
    ].join("\n");
  }

  if (command === "usemypersona") {
    const raw = String(args || "").trim().toLowerCase();
    if (!raw) return describeUserPersona({ t, profile: userProfile, includeUsage: true });
    if (raw !== "on" && raw !== "off") return t("usage.usemypersona");
    if (raw === "on" && !String(userProfile?.customPersona || "").trim()) return t("profile.persona_missing");
    const nextEnabled = raw === "on";
    const changed = getActiveUserPersona(userProfile).enabled !== nextEnabled;
    stateStore.updateUserProfile?.(userId, (p) => {
      p.customPersonaEnabled = nextEnabled;
    });
    const didReset = maybeClearConversationHistory({ changed, stateStore, chatId, userId, chatType });
    const nextProfile = stateStore.getUserProfile?.(userId) || userProfile;
    return [
      withHistoryResetNotice(raw === "on" ? t("profile.persona_enabled") : t("profile.persona_disabled"), didReset, t),
      "",
      describeUserPersona({ t, profile: nextProfile, includeUsage: true })
    ].join("\n");
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
    t("help.globalpersona"),
    t("help.myprofile"),
    t("help.name"),
    t("help.nameoff"),
    t("help.namemode"),
    t("help.myprompt1"),
    t("help.myprompt2"),
    t("help.usemyprompt"),
    t("help.mypersona"),
    t("help.usemypersona"),
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
  const activePersona = getActiveUserPersona(profile);
  return [
    t("profile.title"),
    `${t("profile.name_mode")}: ${t(`profile.name_mode_${normalizeUserDisplayNameMode(profile?.displayNameMode)}`)}`,
    `${t("profile.custom_name")}: ${String(profile?.customDisplayName || "").trim() || t("profile.custom_name_empty")}`,
    `${t("profile.active_prompt")}: ${slot ? t(`profile.user_prompt_${slot}`) : t("profile.user_prompt_off")}`,
    `${t("status.user_persona")}: ${describePersonaState({ t, profile, activePersona })}`,
    `${t("profile.custom_persona")}: ${previewText(profile?.customPersona, 100) || t("profile.custom_persona_empty")}`
  ].join("\n");
}

function describeUserPersona({ t, profile, includeUsage = false }) {
  const activePersona = getActiveUserPersona(profile);
  const lines = [
    t("profile.persona_title"),
    `${t("status.user_persona")}: ${describePersonaState({ t, profile, activePersona })}`,
    `${t("profile.persona_length")}: ${t("profile.persona_chars", { count: String(String(profile?.customPersona || "").trim().length) })}`,
    `${t("profile.custom_persona")}: ${previewText(profile?.customPersona, 180) || t("profile.custom_persona_empty")}`
  ];
  if (includeUsage) {
    lines.push("", t("profile.persona_usage_hint"), t("profile.persona_toggle_hint"));
  }
  return lines.join("\n");
}

function describePersonaState({ t, profile, activePersona }) {
  const hasPersona = Boolean(String(profile?.customPersona || "").trim());
  if (activePersona?.enabled) return `${t("profile.persona_state_on")} · ${t("profile.persona_chars", { count: String(activePersona.text.length) })}`;
  if (hasPersona) return `${t("profile.persona_state_saved")} · ${t("profile.persona_chars", { count: String(String(profile?.customPersona || "").trim().length) })}`;
  return t("profile.persona_state_off");
}

function getStoredPersonaText(profile) {
  return clampText(profile?.customPersona, 12000);
}

function formatLimitValue(t, value) {
  const limit = clamp(Math.trunc(Number(value) || 0), 0, 1000000);
  return limit > 0 ? String(limit) : t("globalpersona.unlimited");
}

function describeGlobalPersonaStatus({ t, stateStore, chatId, userId, chatType, chatSettings }) {
  const resolved = resolveGroupPersonaSelection({ stateStore, chatId, userId, chatType, chatSettings });
  if (!resolved.globalEnabled) return t("globalpersona.status_off_short");
  if (resolved.mode === "single") {
    const ownerProfile = resolved.ownerUserId ? stateStore.getUserProfile?.(resolved.ownerUserId) : null;
    const ownerText = getUserProfileDisplayName(ownerProfile, resolved.ownerUserId) || t("globalpersona.owner_missing_short");
    const suffix = resolved.reason === "missing_persona" ? ` · ${t("globalpersona.owner_persona_missing_short")}` : "";
    return (
      t("globalpersona.status_on_short", {
        mode: t("globalpersona.mode_single"),
        owner: ownerText,
        count: String(resolved.replyCount),
        limit: formatLimitValue(t, resolved.replyLimit)
      }) + suffix
    );
  }
  const nextText = resolved.enabled ? resolved.selectedDisplayName : t(`globalpersona.reason_${resolved.reason}`);
  return t("globalpersona.status_queue_short", {
    mode: t(`globalpersona.mode_${resolved.mode}`),
    members: String(resolved.queueEntries.length),
    next: nextText
  });
}

function describeGlobalPersonaDetail({ t, stateStore, chatId, userId, chatType, chatSettings }) {
  const resolved = resolveGroupPersonaSelection({ stateStore, chatId, userId, chatType, chatSettings });
  const lines = [
    resolved.globalEnabled ? t("globalpersona.status_on") : t("globalpersona.status_off"),
    `${t("globalpersona.mode")}: ${t(`globalpersona.mode_${resolved.mode}`)}`,
    `${t("globalpersona.optout")}: ${resolved.targetOptOut ? t("memory.on") : t("memory.off")}`
  ];

  if (resolved.mode === "single") {
    const ownerProfile = resolved.ownerUserId ? stateStore.getUserProfile?.(resolved.ownerUserId) : null;
    const ownerLabel = getUserProfileDisplayName(ownerProfile, resolved.ownerUserId) || t("globalpersona.owner_missing_short");
    const personaText = getStoredPersonaText(ownerProfile);
    lines.push(`${t("globalpersona.owner")}: ${ownerLabel}`);
    lines.push(`${t("globalpersona.replies")}: ${resolved.replyCount}/${formatLimitValue(t, resolved.replyLimit)}`);
    lines.push(`${t("globalpersona.persona_ready")}: ${personaText ? t("globalpersona.ready_yes") : t("globalpersona.ready_no")}`);
    if (resolved.enabled) lines.push(`${t("globalpersona.current_selection")}: ${resolved.selectedDisplayName}`);
    else if (resolved.globalEnabled) lines.push(`${t("globalpersona.current_selection")}: ${t(`globalpersona.reason_${resolved.reason}`)}`);
    lines.push(t("globalpersona.note_autoreply"));
    return lines.join("\n");
  }

  lines.push(`${t("globalpersona.replies")}: ${resolved.replyCount}`);
  lines.push(`${t("globalpersona.queue_members")}: ${resolved.queueEntries.length}`);
  lines.push(
    `${t("globalpersona.current_selection")}: ${
      resolved.enabled ? resolved.selectedDisplayName : t(`globalpersona.reason_${resolved.reason}`)
    }`
  );
  lines.push(t("globalpersona.queue_title"));
  const queueLines = buildGlobalPersonaQueueLines({ t, resolved });
  if (queueLines.length === 0) lines.push(`- ${t("globalpersona.queue_empty")}`);
  else lines.push(...queueLines);
  lines.push(t("globalpersona.note_autoreply"));
  return lines.join("\n");
}

function buildGlobalPersonaQueueLines({ t, resolved }) {
  const queueEntries = Array.isArray(resolved?.queueEntries) ? resolved.queueEntries : [];
  if (queueEntries.length === 0) return [];
  const lines = [];
  const cursor = queueEntries.length > 0 ? clamp(Math.trunc(Number(resolved?.cursor || 0) || 0), 0, 1000000) % queueEntries.length : 0;
  const mode = String(resolved?.mode || "sequential");
  for (const entry of queueEntries) {
    const label =
      mode === "random"
        ? t("globalpersona.queue_random_item")
        : t("globalpersona.queue_position", { pos: String(((entry.index - cursor + queueEntries.length) % queueEntries.length) + 1) });
    const state = entry.personaReady
      ? entry.exhausted
        ? t("globalpersona.entry_state_exhausted")
        : t("globalpersona.entry_state_ready")
      : t("globalpersona.entry_state_missing_persona");
    const quota = `${entry.replyCount}/${formatLimitValue(t, entry.replyLimit)}`;
    const remaining = entry.remaining === null ? t("globalpersona.remaining_unlimited") : t("globalpersona.remaining_count", { count: String(entry.remaining) });
    const nextMark = resolved.enabled && entry.userId === resolved.selectedUserId ? ` · ${t("globalpersona.queue_next")}` : "";
    lines.push(`- ${label} ${entry.displayName} (${entry.userId}) · ${quota} · ${remaining} · ${state}${nextMark}`);
  }
  return lines;
}

function previewText(value, maxLen) {
  const text = String(value || "").trim();
  const limit = Math.max(8, Math.trunc(Number(maxLen) || 0));
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
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

export function clearConversationHistoryForChat({ stateStore, chatId, chatType }) {
  const target = String(chatId || "");
  if (!target) return;
  const keys = Array.isArray(stateStore.listConversationKeys?.()) ? stateStore.listConversationKeys() : [];
  for (const key of keys) {
    const convKey = String(key || "");
    if (!convKey) continue;
    if (convKey !== target && !convKey.startsWith(`${target}:`)) continue;
    stateStore.updateConversationByKey?.(convKey, (c) => {
      c.history = [];
      c.summaryText = "";
      c.summaryUpdatedAt = 0;
    });
  }

  const legacyKey = legacyGroupConversationKey({ chatId, chatType });
  if (legacyKey && stateStore.peekConversationByKey?.(legacyKey)) {
    stateStore.updateConversationByKey?.(legacyKey, (c) => {
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
