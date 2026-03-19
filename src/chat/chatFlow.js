import { generateAssistantReply } from "../openai.js";
import { bt } from "../botI18n.js";
import { conversationKey, getActiveUserPersona, getActiveUserPrompt } from "../state/common.js";
import { applyGroupPersonaReplyUsage, resolveGroupPersonaSelection } from "../groupPersona.js";
import { clamp, localDayString, trimToMaxChars } from "../util.js";
import { maybeCompressHistory, pickSummaryProvider } from "./flow/compression.js";
import { buildLongTermAdditions } from "./flow/longTerm.js";
import { buildChatInfo, buildSystemPrompt } from "./flow/systemPrompt.js";
import { generateWithTools } from "./flow/toolCalling.js";
import { countCharsForRequest, estimateTokensForRequest } from "./flow/usage.js";
import { resolveModelFacingUserLabel } from "./userProfile.js";

export async function handleChat({ logger, configStore, stateStore, chatId, userId, chatType, lang, sender, text }) {
  const t = (key, vars) => bt(lang, key, vars);
  const cfg = configStore.get();
  const chatSettings = stateStore.getChatSettings(chatId);
  const userProfile = stateStore.getUserProfile?.(userId) || null;
  let conv = stateStore.getConversation({ chatId, userId, chatType });
  if (!conv) return t("err.conversation_na");

  const providerId = chatSettings.providerId || cfg.defaultProviderId;
  const provider = cfg.providers.find((p) => p.id === providerId) || cfg.providers[0];
  if (!provider) return t("err.no_providers");

  const promptId = conv.promptId || cfg.defaultPromptId;
  const prompt = cfg.prompts.find((p) => p.id === promptId) || cfg.prompts[0];
  if (!prompt) return t("err.no_prompts");

  const personaId = conv.personaId || cfg.defaultPersonaId;
  const persona = cfg.personas.find((p) => p.id === personaId) || cfg.personas[0] || null;

  const memoryEnabled = conv.memoryEnabled ?? cfg.memory.enabledByDefault;
  const maxMessages = clamp(Number(cfg.memory.maxMessages ?? 20), 0, 200);
  const maxCharsPerMessage = clamp(Number(cfg.memory.maxCharsPerMessage ?? 4000), 200, 20000);

  // Optional rolling compression (disabled by default).
  const compressionEnabled =
    cfg.longTerm?.enabled && cfg.longTerm?.compression?.enabled === true && String(cfg.stateStorage?.type || "") === "sqlite";
  if (compressionEnabled && memoryEnabled) {
    const summaryProvider = pickSummaryProvider({ cfg, fallback: provider });
    const did = await maybeCompressHistory({
      logger,
      cfg,
      stateStore,
      chatId,
      userId,
      chatType,
      provider: summaryProvider,
      conv,
      maxCharsPerMessage
    });
    if (did) conv = stateStore.getConversation({ chatId, userId, chatType }) || conv;
  }

  const history = Array.isArray(conv.history) ? conv.history : [];
  const context = memoryEnabled && maxMessages > 0 ? history.slice(Math.max(0, history.length - maxMessages)) : [];

  const messages = [
    ...context.map((m) => ({
      role: m.role,
      content: String(m.content || "")
    })),
    { role: "user", content: trimToMaxChars(text, maxCharsPerMessage) }
  ];

  const convKey = conversationKey({ chatId, userId, chatType });
  const longTerm = await buildLongTermAdditions({ cfg, stateStore, convKey });
  const chatInfo = buildChatInfo({
    chatId,
    userId,
    chatType,
    chatSettings,
    sender: {
      preferredName: resolveModelFacingUserLabel({ profile: userProfile })
    }
  });
  const activeUserPrompt = getActiveUserPrompt(userProfile);
  const activeUserPersona = getActiveUserPersona(userProfile);
  const modelFacingName = resolveModelFacingUserLabel({ profile: userProfile });
  const sharedGroupPersona = resolveGroupPersonaSelection({ chatId, userId, chatType, chatSettings, stateStore });
  const effectivePromptSystem = activeUserPrompt.text || prompt.system || "";
  const effectivePersonaSystem = sharedGroupPersona.enabled
    ? sharedGroupPersona.text
    : activeUserPersona.enabled
      ? activeUserPersona.text
      : persona?.system || "";

  let systemPrompt = buildSystemPrompt({
    promptSystem: effectivePromptSystem,
    personaSystem: effectivePersonaSystem,
    userPersona: "",
    userPrompt: "",
    preferredAddressingName: modelFacingName,
    chatInfo,
    rules: cfg.rules,
    facts: conv.facts,
    summaryText: conv.summaryText,
    longTermMemory: longTerm.longTermMemory,
    longTermPersona: longTerm.longTermPersona
  });

  const pluginManager = configStore.pluginManager;
  if (pluginManager?.scan) {
    await pluginManager.scan().catch(() => {});
    const out = await pluginManager
      .applyBeforeModel({
        systemPrompt,
        messages,
        ctx: { chatId, userId, chatType, lang, text, providerId, promptId, personaId }
      })
      .catch(() => null);
    if (out?.systemPrompt) systemPrompt = out.systemPrompt;
    if (out?.messages) {
      // replace message array if plugin provided one
      messages.length = 0;
      for (const m of out.messages) messages.push(m);
    }
  }

  // Quotas (per day, per chat/user) - applied only to model calls.
  const day = localDayString();
  if (cfg.quotas?.enabled) {
    const perUserReplies = Number(cfg.quotas.perUserRepliesPerDay || 0);
    const perChatReplies = Number(cfg.quotas.perChatRepliesPerDay || 0);
    const perUserTokens = Number(cfg.quotas.perUserTokensPerDay || 0);
    const perChatTokens = Number(cfg.quotas.perChatTokensPerDay || 0);

    const chatUsage = stateStore.getUsageDay?.({ day, scope: "chat", id: String(chatId) }) ?? {
      tokensIn: 0,
      tokensOut: 0,
      replies: 0,
      requests: 0
    };
    const userUsage = stateStore.getUsageDay?.({ day, scope: "user", id: String(userId) }) ?? {
      tokensIn: 0,
      tokensOut: 0,
      replies: 0,
      requests: 0
    };

    if (perChatReplies > 0 && Number(chatUsage.replies || 0) >= perChatReplies) return t("quota.chat_replies");
    if (perUserReplies > 0 && Number(userUsage.replies || 0) >= perUserReplies) return t("quota.user_replies");

    const estIn = estimateTokensForRequest({ systemPrompt, messages, maxCharsPerMessage });
    const estOut = Math.max(0, Math.trunc(Number(cfg.openai?.maxOutputTokens ?? 0) || 0));
    const chatUsed = Number(chatUsage.tokensIn || 0) + Number(chatUsage.tokensOut || 0);
    const userUsed = Number(userUsage.tokensIn || 0) + Number(userUsage.tokensOut || 0);
    if (perChatTokens > 0 && chatUsed + estIn + estOut > perChatTokens) return t("quota.chat_tokens");
    if (perUserTokens > 0 && userUsed + estIn + estOut > perUserTokens) return t("quota.user_tokens");
  }

  try {
    const toolCallingEnabled = cfg.search?.enabled && cfg.search?.toolCallingEnabled === true;
    const toolCallingOut = toolCallingEnabled
      ? await generateWithTools({
          logger,
          cfg,
          provider,
          systemPrompt,
          messages,
          maxCharsPerMessage
        })
      : await generateAssistantReply({
          logger,
          provider,
          security: cfg.security,
          systemPrompt,
          messages,
          temperature: cfg.openai.temperature,
          topP: cfg.openai.topP,
          presencePenalty: cfg.openai.presencePenalty,
          frequencyPenalty: cfg.openai.frequencyPenalty,
          maxOutputTokens: cfg.openai.maxOutputTokens,
          timeoutMs: cfg.openai.timeoutMs,
          retry: cfg.openai.retry,
          maxCharsPerMessage
        });
    let replyText = toolCallingOut.text;
    if (pluginManager?.applyAfterModel) {
      await pluginManager.scan().catch(() => {});
      replyText = await pluginManager
        .applyAfterModel({ replyText, ctx: { chatId, userId, chatType, lang, text, providerId, promptId, personaId } })
        .catch(() => replyText);
    }
    const usage = toolCallingOut.usage;
    const requests = toolCallingEnabled ? toolCallingOut.requests : 1;

    if (memoryEnabled) {
      stateStore.updateConversation({ chatId, userId, chatType }, (c) => {
        c.history ??= [];
        c.history.push({ role: "user", content: messages[messages.length - 1].content, ts: Date.now() });
        c.history.push({ role: "assistant", content: replyText, ts: Date.now() });
        const maxKeep = maxMessages * 2;
        if (maxKeep > 0 && c.history.length > maxKeep) c.history = c.history.slice(c.history.length - maxKeep);
      });
    }

    // Usage accounting (for quotas/analytics). Count once per user-visible reply, but requests may include tool-calling turns.
    const u = usage || null;
    const estIn = estimateTokensForRequest({ systemPrompt, messages, maxCharsPerMessage });
    const estOut = Math.max(1, Math.ceil(String(replyText || "").length / 4));
    const charsIn = countCharsForRequest({ systemPrompt, messages, maxCharsPerMessage });
    const charsOut = String(replyText || "").length;
    const tokensIn = Number(u?.inputTokens ?? estIn) || estIn;
    const tokensOut = Number(u?.outputTokens ?? estOut) || estOut;
    stateStore.addUsageDay?.({ day, scope: "chat", id: String(chatId), charsIn, charsOut, tokensIn, tokensOut, replies: 1, requests });
    stateStore.addUsageDay?.({ day, scope: "user", id: String(userId), charsIn, charsOut, tokensIn, tokensOut, replies: 1, requests });
    if (sharedGroupPersona.enabled) applyGroupPersonaReplyUsage({ stateStore, chatId, selection: sharedGroupPersona });

    return replyText;
  } catch (err) {
    logger?.warn?.("chat failed", err);
    const details =
      err?.body && typeof err.body === "object"
        ? JSON.stringify(err.body)
        : typeof err?.body === "string"
          ? err.body
          : "";
    return `API error: ${err?.message || "unknown"}${details ? `\n\n${details}` : ""}`;
  }
}
