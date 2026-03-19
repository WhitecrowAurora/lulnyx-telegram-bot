import { sleep } from "./util.js";
import { createTelegramApi } from "./telegramApi.js";
import { handleIncomingText, handleCallbackQuery } from "./chat.js";
import { bt, getTelegramCommands } from "./botI18n.js";
import { getEffectiveChatReplyStyle, normalizeChatReplyStyle } from "./state/common.js";
import { getMiniAppPublicUrl } from "./web/miniApp.js";

const TELEGRAM_MAX_MESSAGE = 4096;
const KNOWN_COMMANDS = new Set([...getTelegramCommands("en").map((c) => c.command), "start"]);

export async function createTelegramRuntime({ logger, configStore, stateStore }) {
  const cfg = configStore.get();
  const token = cfg.telegram?.token;
  if (!token) throw new Error("config.telegram.token is required");

  const api = createTelegramApi({ token, logger });
  const identity = { botId: null, botUsername: "" };
  let lastIdentityTryAt = 0;
  const refreshIdentity = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastIdentityTryAt < 60 * 1000) return identity;
    lastIdentityTryAt = now;
    const me = await api.getMe().catch((e) => {
      logger?.warn?.("getMe failed", e);
      return null;
    });
    if (me?.id) identity.botId = Number(me.id);
    if (me?.username) identity.botUsername = String(me.username);
    return identity;
  };

  await refreshIdentity({ force: true }).catch(() => {});

  const commandsZh = getTelegramCommands("zh");
  const commandsEn = getTelegramCommands("en");
  const scopes = [{ type: "default" }, { type: "all_private_chats" }, { type: "all_group_chats" }];
  for (const scope of scopes) {
    await api.setMyCommands({ scope, commands: commandsZh });
    await api.setMyCommands({ scope, language_code: "en", commands: commandsEn });
  }

  const miniAppUrl = getMiniAppPublicUrl(cfg);
  if (cfg.web?.miniApp?.enabled === true && miniAppUrl) {
    await api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: String(cfg.web?.miniApp?.buttonText || "Panel"),
        web_app: { url: miniAppUrl }
      }
    });
  } else {
    await api.setChatMenuButton({ menu_button: { type: "default" } });
  }

  const queues = new Map(); // chatId -> Promise chain
  const lastWorkAt = new Map(); // chatId -> ms
  const lastNotAllowedNoticeAt = new Map(); // chatId -> ms
  const pendingByChat = new Map(); // chatId -> number
  const globalSem = createDynamicSemaphore({
    getMax: () => Number(configStore.get()?.telegram?.queue?.maxConcurrentJobs ?? 0)
  });

  const status = {
    createdAt: Date.now(),
    lastUpdateAt: 0,
    lastPollingOkAt: 0,
    lastWebhookAt: 0,
    lastErrorAt: 0,
    lastError: ""
  };

  let stopped = false;

  const handleUpdate = async (u, { source = "unknown" } = {}) => {
    if (!u || typeof u !== "object") return;
    status.lastUpdateAt = Date.now();
    if (source === "webhook") status.lastWebhookAt = status.lastUpdateAt;

    const msg = u.message || u.channel_post;
    if (msg) {
      await enqueueChatWork({
        logger,
        queues,
        lastWorkAt,
        pendingByChat,
        globalSem,
        cfgProvider: () => configStore.get(),
        chatId: msg.chat?.id,
        work: () =>
          handleMessage({
            logger,
            api,
            configStore,
            stateStore,
            message: msg,
            identity,
            refreshIdentity,
            lastNotAllowedNoticeAt
          })
      });
    }

    if (u.callback_query) {
      const chatId = u.callback_query.message?.chat?.id;
      await enqueueChatWork({
        logger,
        queues,
        lastWorkAt,
        pendingByChat,
        globalSem,
        cfgProvider: () => configStore.get(),
        chatId,
        work: () =>
          handleCb({
            logger,
            api,
            configStore,
            stateStore,
            callbackQuery: u.callback_query,
            lastNotAllowedNoticeAt
          })
      });
    }
  };

  const startPolling = async () => {
    logger?.info?.("telegram polling started");

    // When polling, ensure webhook is deleted (Telegram blocks getUpdates otherwise).
    await api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});

    let offset = 0;
    try {
      offset = stateStore.getTelegramOffset();
    } catch {}
    let backoffMs = 250;

    while (!stopped) {
      try {
        const updates = await api.getUpdates({
          offset,
          timeout: 25,
          allowed_updates: ["message", "channel_post", "callback_query"]
        });
        status.lastPollingOkAt = Date.now();
        backoffMs = 250;
        for (const u of updates) {
          offset = Math.max(offset, (u.update_id ?? 0) + 1);
          stateStore.setTelegramOffset(offset);
          await handleUpdate(u, { source: "polling" });
        }
      } catch (err) {
        status.lastErrorAt = Date.now();
        status.lastError = String(err?.message || err || "");
        logger?.warn?.("polling error", err);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 5000);
      }
    }
  };

  const stop = () => {
    stopped = true;
  };

  const deleteWebhook = async ({ dropPendingUpdates = false } = {}) => {
    await api.deleteWebhook({ drop_pending_updates: dropPendingUpdates === true }).catch(() => {});
  };

  const ensureWebhook = async () => {
    const cfgNow = configStore.get();
    const pub = String(cfgNow.telegram?.delivery?.publicBaseUrl || "").trim().replace(/\/+$/, "");
    const secret = String(cfgNow.telegram?.delivery?.webhookSecret || "").trim();
    if (!pub || !secret) throw new Error("telegram webhook requires telegram.delivery.publicBaseUrl and telegram.delivery.webhookSecret");
    if (!pub.toLowerCase().startsWith("https://")) throw new Error("telegram webhook requires https publicBaseUrl");
    const url = `${pub}/telegram/webhook/${encodeURIComponent(secret)}`;
    const drop = cfgNow.telegram?.delivery?.dropPendingUpdates === true;
    await api.setWebhook({ url, drop_pending_updates: drop }).catch((e) => {
      throw e;
    });
    return { url };
  };

  return { api, identity, refreshIdentity, handleUpdate, startPolling, stop, ensureWebhook, deleteWebhook, status };
}

async function handleMessage({ logger, api, configStore, stateStore, message, identity, refreshIdentity, lastNotAllowedNoticeAt }) {
  const chatId = message.chat?.id;
  const userId = message.from?.id ?? message.sender_chat?.id ?? null;
  const text = typeof message.text === "string" ? message.text : typeof message.caption === "string" ? message.caption : null;
  const chatType = message.chat?.type;
  if (!chatId || !userId || typeof text !== "string") return;
  if (message.from?.is_bot) return;
  const messageThreadId = message.message_thread_id;

  stateStore.touchChat(chatId, {
    chatType: chatType || "",
    title: message.chat?.title || "",
    username: message.chat?.username || ""
  });
  stateStore.touchUser?.(userId, {
    username: message.from?.username ?? message.sender_chat?.username,
    firstName: message.from?.first_name ?? message.sender_chat?.title,
    lastName: message.from?.last_name
  });

  const cfg = configStore.get();
  const trimmed = text.trim();
  if (!trimmed) return;

  const chatSettings = stateStore.getChatSettings(chatId);

  if (
    (!identity?.botUsername || !identity?.botId) &&
    (chatType === "group" || chatType === "supergroup") &&
    (trimmed.startsWith("/") || trimmed.includes("@") || Boolean(message.reply_to_message))
  ) {
    await refreshIdentity?.().catch(() => {});
  }

  const explicit = shouldRespondInChat({
    message: { ...message, text },
    botId: identity?.botId,
    botUsername: identity?.botUsername
  });

  if (!isAllowed(cfg, chatId, userId)) {
    const isGroup = chatType === "group" || chatType === "supergroup";
    if (!isGroup || explicit) {
      await maybeNotifyNotAllowed({
        api,
        cfg,
        chatId,
        userId,
        languageCode: message.from?.language_code,
        lastNotAllowedNoticeAt
      });
    }
    return;
  }

  if (!explicit) {
    const isGroup = chatType === "group" || chatType === "supergroup";
    const autoReply = Boolean(chatSettings?.autoReply) || Boolean(cfg.telegram?.autoReplyByDefault);
    if (!isGroup || !autoReply) return;
    if (hasMedia(message)) return;
    if (hasUrlEntity(message)) return;
  }

  await api.sendChatAction({ chat_id: chatId, action: "typing", message_thread_id: messageThreadId }).catch(() => {});

  const reply = await handleIncomingText({
    logger,
    configStore,
    stateStore,
    chatId,
    userId,
    chatType,
    languageCode: message.from?.language_code,
    sender: {
      username: message.from?.username ?? message.sender_chat?.username,
      firstName: message.from?.first_name ?? message.sender_chat?.title,
      lastName: message.from?.last_name
    },
    text: trimmed
  });

  if (!reply) return;
  const replyBinding = buildReplyBinding({
    chatType,
    message,
    userId,
    replyStyle: getEffectiveChatReplyStyle({ cfg, chatSettings })
  });

  if (typeof reply === "object" && reply) {
    if (Array.isArray(reply.photos) && reply.photos.length > 0) {
      let firstPhoto = true;
      for (const p of reply.photos.slice(0, 10)) {
        const url = String(p?.url || "").trim();
        if (!url) continue;
        const captionBase = p?.caption ? String(p.caption) : "";
        const captionPayload = firstPhoto
          ? formatBoundOutgoingText({ text: captionBase, binding: replyBinding, maxLen: 1024 })
          : { text: captionBase || undefined };
        const ok = await api
          .sendPhoto({
            chat_id: chatId,
            photo: url,
            caption: captionPayload.text,
            message_thread_id: messageThreadId,
            reply_to_message_id: firstPhoto ? replyBinding.replyToMessageId : undefined,
            allow_sending_without_reply: firstPhoto && replyBinding.replyToMessageId ? true : undefined,
            parse_mode: captionPayload.parseMode
          })
          .then(() => true)
          .catch(() => false);
        if (!ok) {
          const fallbackText = firstPhoto
            ? formatBoundOutgoingText({ text: captionBase ? `${captionBase}\n${url}` : url, binding: replyBinding, maxLen: TELEGRAM_MAX_MESSAGE })
            : { text: captionBase ? `${captionBase}\n${url}` : url };
          await api
            .sendMessage({
              chat_id: chatId,
              text: fallbackText.text,
              message_thread_id: messageThreadId,
              reply_to_message_id: firstPhoto ? replyBinding.replyToMessageId : undefined,
              allow_sending_without_reply: firstPhoto && replyBinding.replyToMessageId ? true : undefined,
              parse_mode: fallbackText.parseMode
            })
            .catch(() => {});
        }
        firstPhoto = false;
      }
      return;
    }
  }

  const outTextBase = typeof reply === "string" ? reply : String(reply.text || "");
  if (!outTextBase) return;
  const replyMarkup = typeof reply === "object" && reply ? reply.replyMarkup : null;

  let first = true;
  for (const chunk of chunkText(outTextBase, TELEGRAM_MAX_MESSAGE)) {
    const payload = first
      ? formatBoundOutgoingText({ text: chunk, binding: replyBinding, maxLen: TELEGRAM_MAX_MESSAGE })
      : { text: chunk };
    await api.sendMessage({
      chat_id: chatId,
      text: payload.text,
      message_thread_id: messageThreadId,
      reply_to_message_id: first ? replyBinding.replyToMessageId : undefined,
      allow_sending_without_reply: first && replyBinding.replyToMessageId ? true : undefined,
      parse_mode: payload.parseMode,
      reply_markup: first && replyMarkup ? replyMarkup : undefined
    });
    first = false;
  }
}

async function handleCb({ logger, api, configStore, stateStore, callbackQuery, lastNotAllowedNoticeAt }) {
  const id = callbackQuery.id;
  const data = callbackQuery.data;
  const fromId = callbackQuery.from?.id;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const chatType = callbackQuery.message?.chat?.type;
  const messageThreadId = callbackQuery.message?.message_thread_id;
  if (!id || typeof data !== "string" || !fromId || !chatId || !messageId) return;

  const cfg = configStore.get();
  if (!isAllowed(cfg, chatId, fromId)) {
    await maybeNotifyNotAllowed({
      api,
      cfg,
      chatId,
      userId: fromId,
      languageCode: callbackQuery.from?.language_code,
      lastNotAllowedNoticeAt,
      callbackQueryId: id
    });
    return;
  }

  stateStore.touchChat(chatId, {
    chatType: chatType || "",
    title: callbackQuery.message?.chat?.title || "",
    username: callbackQuery.message?.chat?.username || ""
  });
  stateStore.touchUser?.(fromId, {
    username: callbackQuery.from?.username,
    firstName: callbackQuery.from?.first_name,
    lastName: callbackQuery.from?.last_name
  });

  const out = await handleCallbackQuery({
    logger,
    configStore,
    stateStore,
    chatId,
    userId: fromId,
    chatType,
    messageId,
    data,
    languageCode: callbackQuery.from?.language_code
  });

  await api.answerCallbackQuery({ callback_query_id: id }).catch(() => {});
  if (!out?.text) return;

  if (out.mode === "edit") {
    const ok = await api
      .editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: out.text,
        reply_markup: out.replyMarkup ? out.replyMarkup : undefined
      })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }

  for (const chunk of chunkText(out.text, TELEGRAM_MAX_MESSAGE)) {
    await api.sendMessage({
      chat_id: chatId,
      text: chunk,
      message_thread_id: messageThreadId,
      reply_markup: out.replyMarkup ? out.replyMarkup : undefined
    });
  }
}

function isAllowed(cfg, chatId, userId) {
  const allowedChats = Array.isArray(cfg.telegram?.allowedChatIds) ? cfg.telegram.allowedChatIds : [];
  const allowedUsers = Array.isArray(cfg.telegram?.allowedUserIds) ? cfg.telegram.allowedUserIds : [];
  const allowAll = cfg.telegram?.allowAll === true;
  const chatOk = allowedChats.map(String).includes(String(chatId));
  const userOk = allowedUsers.map(String).includes(String(userId));

  if (allowAll) {
    if (allowedChats.length > 0 && !chatOk) return false;
    if (allowedUsers.length > 0 && !userOk) return false;
    return true;
  }

  return chatOk || userOk;
}

async function maybeNotifyNotAllowed({ api, cfg, chatId, userId, languageCode, lastNotAllowedNoticeAt, callbackQueryId }) {
  const key = String(chatId);
  const now = Date.now();
  const cooldownMs = 10 * 60 * 1000;
  const last = Number(lastNotAllowedNoticeAt?.get(key) ?? 0);
  if (now - last < cooldownMs) {
    if (callbackQueryId) await api.answerCallbackQuery({ callback_query_id: callbackQueryId }).catch(() => {});
    return;
  }
  lastNotAllowedNoticeAt?.set(key, now);

  const msg = bt(languageCode, "auth.not_allowed", { chatId: String(chatId), userId: String(userId) });
  if (callbackQueryId) {
    await api.answerCallbackQuery({ callback_query_id: callbackQueryId, text: msg, show_alert: true }).catch(() => {});
    return;
  }
  await api.sendMessage({ chat_id: chatId, text: msg }).catch(() => {});
}

async function enqueueChatWork({ logger, queues, lastWorkAt, pendingByChat, globalSem, cfgProvider, chatId, work }) {
  const key = String(chatId ?? "unknown");
  const cfgNow = cfgProvider();
  const maxPendingPerChat = Number(cfgNow?.telegram?.queue?.maxPendingPerChat ?? 0);
  const curPending = Number(pendingByChat.get(key) ?? 0);
  if (Number.isFinite(maxPendingPerChat) && maxPendingPerChat > 0 && curPending >= maxPendingPerChat) {
    logger?.warn?.("telegram queue full, dropping update", { chatId: key, pending: curPending, maxPendingPerChat });
    return;
  }
  pendingByChat.set(key, curPending + 1);

  const prev = queues.get(key) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      let release = null;
      try {
        release = globalSem ? await globalSem.acquire() : null;
        const cfg = cfgProvider();
        const minIntervalMs = Number(cfg.telegram?.queue?.minIntervalMs ?? 0);
        const last = Number(lastWorkAt.get(key) ?? 0);
        const now = Date.now();
        if (Number.isFinite(minIntervalMs) && minIntervalMs > 0 && now - last < minIntervalMs) {
          await sleep(minIntervalMs - (now - last));
        }
        await work();
        lastWorkAt.set(key, Date.now());
      } finally {
        try {
          release?.();
        } catch {}
        const left = Math.max(0, Number(pendingByChat.get(key) ?? 1) - 1);
        if (left > 0) pendingByChat.set(key, left);
        else pendingByChat.delete(key);
      }
    });
  queues.set(key, next);
  return next;
}

function createDynamicSemaphore({ getMax }) {
  let inFlight = 0;
  const waiters = [];

  const maxNow = () => {
    const v = Number(getMax?.() ?? 0);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.max(1, Math.trunc(v));
  };

  const pump = () => {
    const max = maxNow();
    if (max === 0) {
      while (waiters.length > 0) {
        inFlight += 1;
        const w = waiters.shift();
        try {
          w?.();
        } catch {}
      }
      return;
    }
    while (waiters.length > 0 && inFlight < max) {
      inFlight += 1;
      const w = waiters.shift();
      try {
        w?.();
      } catch {}
    }
  };

  const acquire = async () => {
    const max = maxNow();
    if (max === 0) {
      pump();
      inFlight += 1;
      return () => {
        inFlight = Math.max(0, inFlight - 1);
      };
    }

    if (inFlight < max) {
      inFlight += 1;
      return () => {
        inFlight = Math.max(0, inFlight - 1);
        pump();
      };
    }

    await new Promise((resolve) => waiters.push(resolve));
    return () => {
      inFlight = Math.max(0, inFlight - 1);
      pump();
    };
  };

  return { acquire };
}

function shouldRespondInChat({ message, botId, botUsername }) {
  const type = message.chat?.type;
  const text = String(message.text || message.caption || "");
  if (type !== "group" && type !== "supergroup") return true; // private/channel

  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    const head = trimmed.slice(1).split(/\s+/, 1)[0] || "";
    const at = head.indexOf("@");
    const cmd = (at >= 0 ? head.slice(0, at) : head).toLowerCase();
    const target = at >= 0 ? head.slice(at + 1).toLowerCase() : "";

    if (target) {
      const me = String(botUsername || "").toLowerCase();
      if (!me || target !== me) return false;
      return true;
    }

    return KNOWN_COMMANDS.has(cmd);
  }

  if (mentionsBot({ message, botUsername, botId })) return true;
  const replyFromId = message.reply_to_message?.from?.id;
  if (botId && replyFromId && Number(replyFromId) === Number(botId)) return true;
  return false;
}

function mentionsBot({ message, botUsername, botId }) {
  const u = String(botUsername || "").trim();
  const usernameLower = u ? u.toLowerCase() : "";

  const text = typeof message?.text === "string" ? message.text : typeof message?.caption === "string" ? message.caption : "";
  const textLower = String(text || "").toLowerCase();
  if (usernameLower && textLower.includes(`@${usernameLower}`)) return true;

  const ents = Array.isArray(message?.entities)
    ? message.entities
    : Array.isArray(message?.caption_entities)
      ? message.caption_entities
      : [];
  for (const e of ents) {
    if (!e || typeof e !== "object") continue;
    const type = String(e.type || "");

    if (type === "text_mention") {
      const uid = e.user?.id;
      if (botId && uid && Number(uid) === Number(botId)) return true;
      const uname = String(e.user?.username || "").toLowerCase();
      if (usernameLower && uname && uname === usernameLower) return true;
      continue;
    }

    if (type !== "mention") continue;
    if (!usernameLower) continue;
    const off = Number(e.offset ?? -1);
    const len = Number(e.length ?? -1);
    if (!Number.isFinite(off) || !Number.isFinite(len) || off < 0 || len <= 0) continue;
    const seg = String(text).slice(off, off + len).toLowerCase();
    if (seg === `@${usernameLower}`) return true;
  }
  return false;
}

function hasMedia(message) {
  if (!message || typeof message !== "object") return false;
  return Boolean(
    message.photo ||
      message.video ||
      message.document ||
      message.sticker ||
      message.animation ||
      message.audio ||
      message.voice ||
      message.video_note
  );
}

function buildReplyBinding({ chatType, message, userId, replyStyle }) {
  if (!isGroupChat(chatType)) return { replyToMessageId: undefined, prefix: "", htmlPrefix: "" };
  const style = normalizeChatReplyStyle(replyStyle);
  const replyToMessageId = style === "mention_only" ? undefined : Number(message?.message_id || 0) || undefined;
  if (style === "reply_only") return { replyToMessageId, prefix: "", htmlPrefix: "" };
  const username = String(message?.from?.username ?? message?.sender_chat?.username ?? "").trim();
  if (username) return { replyToMessageId, prefix: `@${username} `, htmlPrefix: "" };

  const firstName = String(message?.from?.first_name ?? message?.sender_chat?.title ?? "").trim();
  const lastName = String(message?.from?.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    const numericUserId = Number(userId || 0);
    if (Number.isFinite(numericUserId) && numericUserId > 0 && message?.from && !message?.sender_chat) {
      return {
        replyToMessageId,
        prefix: `${fullName}: `,
        htmlPrefix: `<a href="tg://user?id=${numericUserId}">${escapeTelegramHtml(fullName)}</a>: `
      };
    }
    return { replyToMessageId, prefix: `${fullName}: `, htmlPrefix: "" };
  }

  return { replyToMessageId, prefix: "", htmlPrefix: "" };
}

function formatBoundOutgoingText({ text, binding, maxLen }) {
  const raw = String(text || "");
  const prefix = String(binding?.prefix || "");
  const htmlPrefix = String(binding?.htmlPrefix || "");
  if (htmlPrefix) {
    const htmlText = `${htmlPrefix}${escapeTelegramHtml(raw)}`.trim();
    return { text: trimTelegramText(htmlText, maxLen), parseMode: "HTML" };
  }
  if (!prefix) return { text: raw };
  if (!raw) return { text: prefix.trim() };
  if (raw.startsWith(prefix)) return { text: trimTelegramText(raw, maxLen) };
  return { text: trimTelegramText(`${prefix}${raw}`, maxLen) };
}

function isGroupChat(chatType) {
  return chatType === "group" || chatType === "supergroup";
}

function escapeTelegramHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function trimTelegramText(text, maxLen) {
  const raw = String(text || "");
  const limit = Number(maxLen || 0);
  if (!Number.isFinite(limit) || limit <= 0 || raw.length <= limit) return raw;
  return raw.slice(0, limit);
}

function hasUrlEntity(message) {
  const ents = Array.isArray(message?.entities) ? message.entities : Array.isArray(message?.caption_entities) ? message.caption_entities : [];
  for (const e of ents) {
    const t = String(e?.type || "");
    if (t === "url" || t === "text_link") return true;
  }
  return false;
}

function* chunkText(text, maxLen) {
  const s = String(text);
  if (s.length <= maxLen) {
    yield s;
    return;
  }
  let i = 0;
  while (i < s.length) {
    yield s.slice(i, i + maxLen);
    i += maxLen;
  }
}
