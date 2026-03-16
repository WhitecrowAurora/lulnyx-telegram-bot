import { sleep } from "./util.js";
import { createTelegramApi } from "./telegramApi.js";
import { handleIncomingText, handleCallbackQuery } from "./chat.js";
import { bt, getTelegramCommands } from "./botI18n.js";

const TELEGRAM_MAX_MESSAGE = 4096;
const KNOWN_COMMANDS = new Set([...getTelegramCommands("en").map((c) => c.command), "start"]);

export async function startTelegramPolling({ logger, configStore, stateStore }) {
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
      logger.warn("getMe failed", e);
      return null;
    });
    if (me?.id) identity.botId = Number(me.id);
    if (me?.username) identity.botUsername = String(me.username);
    return identity;
  };
  await refreshIdentity({ force: true });

  const commandsZh = getTelegramCommands("zh");
  const commandsEn = getTelegramCommands("en");

  // Some clients only show slash-command suggestions depending on scope.
  // Set for both private and group scopes to improve discoverability.
  const scopes = [{ type: "default" }, { type: "all_private_chats" }, { type: "all_group_chats" }];

  for (const scope of scopes) {
    // Default language: Chinese (so users without a matching language_code still see something sensible).
    await api.setMyCommands({ scope, commands: commandsZh });
    // English override for English clients.
    await api.setMyCommands({ scope, language_code: "en", commands: commandsEn });
  }

  let offset = 0;
  try {
    offset = stateStore.getTelegramOffset();
  } catch {}
  let backoffMs = 250;
  const queues = new Map(); // chatId -> Promise chain
  const lastWorkAt = new Map(); // chatId -> ms
  const lastNotAllowedNoticeAt = new Map(); // chatId -> ms
  const pendingByChat = new Map(); // chatId -> number
  const globalSem = createDynamicSemaphore({
    getMax: () => Number(configStore.get()?.telegram?.queue?.maxConcurrentJobs ?? 0)
  });

  logger.info("telegram polling started");
  while (true) {
    try {
      const updates = await api.getUpdates({
        offset,
        timeout: 25,
        allowed_updates: ["message", "channel_post", "callback_query"]
      });
      backoffMs = 250;
      for (const u of updates) {
        offset = Math.max(offset, (u.update_id ?? 0) + 1);
        stateStore.setTelegramOffset(offset);
        const msg = u.message || u.channel_post;
        if (!msg) continue;
        void enqueueChatWork({
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
        }).catch((e) => logger.error("handleMessage failed", e));
        continue;
      }
      for (const u of updates) {
        if (!u.callback_query) continue;
        const chatId = u.callback_query.message?.chat?.id;
        void enqueueChatWork({
          logger,
          queues,
          lastWorkAt,
          pendingByChat,
          globalSem,
          cfgProvider: () => configStore.get(),
          chatId,
          work: () => handleCb({ logger, api, configStore, stateStore, callbackQuery: u.callback_query, lastNotAllowedNoticeAt })
        }).catch((e) => logger.error("handleCallback failed", e));
      }
    } catch (err) {
      logger.warn("polling error", err);
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 5000);
    }
  }
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

  const cfg = configStore.get();
  const trimmed = text.trim();
  if (!trimmed) return;

  const chatSettings = stateStore.getChatSettings(chatId);

  // If we failed to fetch getMe at startup (network hiccup), mentions won't work in groups.
  // Refresh identity opportunistically when a group message could require it.
  if (
    (!identity?.botUsername || !identity?.botId) &&
    (chatType === "group" || chatType === "supergroup") &&
    (trimmed.startsWith("/") || trimmed.includes("@") || Boolean(message.reply_to_message))
  ) {
    await refreshIdentity?.().catch(() => {});
  }

  const explicit = shouldRespondInChat({ message: { ...message, text }, botId: identity?.botId, botUsername: identity?.botUsername });

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

  if (typeof reply === "object" && reply) {
    if (Array.isArray(reply.photos) && reply.photos.length > 0) {
      for (const p of reply.photos.slice(0, 10)) {
        const url = String(p?.url || "").trim();
        if (!url) continue;
        const caption = p?.caption ? String(p.caption) : undefined;
        const ok = await api
          .sendPhoto({
            chat_id: chatId,
            photo: url,
            caption,
            message_thread_id: messageThreadId
          })
          .then(() => true)
          .catch(() => false);
        if (!ok) {
          await api
            .sendMessage({ chat_id: chatId, text: caption ? `${caption}\n${url}` : url, message_thread_id: messageThreadId })
            .catch(() => {});
        }
      }
      return;
    }
  }

  const outText = typeof reply === "string" ? reply : String(reply.text || "");
  if (!outText) return;
  const replyMarkup = typeof reply === "object" && reply ? reply.replyMarkup : null;

  let first = true;
  for (const chunk of chunkText(outText, TELEGRAM_MAX_MESSAGE)) {
    await api.sendMessage({
      chat_id: chatId,
      text: chunk,
      message_thread_id: messageThreadId,
      reply_markup: first && replyMarkup ? replyMarkup : undefined
    });
    first = false;
  }
}

function shouldRespondInChat({ message, botId, botUsername }) {
  const type = message.chat?.type;
  const text = String(message.text || message.caption || "");
  if (type !== "group" && type !== "supergroup") return true; // private/channel

  // In groups, respond to:
  // - commands
  // - explicit @botUsername mention
  // - replies to the bot
  const trimmed = text.trim();
  if (trimmed.startsWith("/")) {
    const head = trimmed.slice(1).split(/\s+/, 1)[0] || "";
    const at = head.indexOf("@");
    const cmd = (at >= 0 ? head.slice(0, at) : head).toLowerCase();
    const target = at >= 0 ? head.slice(at + 1).toLowerCase() : "";

    // Ignore commands explicitly targeting another bot.
    if (target) {
      const me = String(botUsername || "").toLowerCase();
      if (!me || target !== me) return false;
      return true;
    }

    // Without an explicit target, only respond to known commands to avoid group spam.
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

    // `text_mention` has an inline user object (often used when mentioning users without usernames).
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

function hasUrlEntity(message) {
  const ents = Array.isArray(message?.entities) ? message.entities : Array.isArray(message?.caption_entities) ? message.caption_entities : [];
  for (const e of ents) {
    const t = String(e?.type || "");
    if (t === "url" || t === "text_link") return true;
  }
  return false;
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

  // Deny-by-default: allow if either chatId or userId is allowlisted.
  return chatOk || userOk;
}

async function maybeNotifyNotAllowed({
  api,
  cfg,
  chatId,
  userId,
  languageCode,
  lastNotAllowedNoticeAt,
  callbackQueryId
}) {
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
    await api
      .answerCallbackQuery({ callback_query_id: callbackQueryId, text: msg, show_alert: true })
      .catch(() => {});
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
