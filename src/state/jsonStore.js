import fs from "node:fs";
import path from "node:path";
import { ensureDirSync, nowMs } from "../util.js";
import { resolveAppRootDir } from "../appPaths.js";
import {
  clampInt,
  conversationKey,
  defaultChatSettings,
  defaultConversation,
  defaultUserProfile,
  normalizeGlobalPersonaReplyCount,
  normalizeGlobalPersonaReplyLimit,
  normalizeUserProfileState,
  normalizeBool,
  normalizeOptionalChatReplyStyle,
  normalizeUserDisplayNameMode,
  normalizeUserPromptSlot
} from "./common.js";

export function createJsonStateStore({ logger, configStore }) {
  const cfg = configStore.get();
  const rootDir = resolveAppRootDir();
  const relPath = String(cfg.stateStorage?.jsonPath || "data/state.json");
  const statePath = path.isAbsolute(relPath) ? relPath : path.join(rootDir, relPath);
  const dataDir = path.dirname(statePath);
  ensureDirSync(fs, dataDir);

  let state = loadJsonState(statePath);
  let dirty = false;
  let flushing = null;

  const store = baseStoreApi({
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    markDirty: () => {
      dirty = true;
      scheduleFlush();
    }
  });

  store.getBackendInfo = () => ({ type: "json", statePath });
  store.importRawState = (nextState) => {
    if (!nextState || typeof nextState !== "object") throw new Error("invalid state");
    state = nextState;
    dirty = true;
    scheduleFlush();
  };

  store.flush = async () => {
    if (!dirty) return;
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        await atomicWriteJson(statePath, state);
        dirty = false;
      } catch (err) {
        logger.error("failed to flush state", err);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  };

  const scheduleFlush = () => {
    if (!dirty) return;
    setTimeout(() => {
      void store.flush();
    }, 500).unref?.();
  };

  return store;
}

function baseStoreApi({ getState, setState, markDirty }) {
  return {
    getRaw() {
      return getState();
    },
    peekConversationByKey(key) {
      const state = getState();
      const k = String(key || "");
      if (!k) return null;
      const conv = state?.conversations && typeof state.conversations === "object" ? state.conversations[k] : null;
      return conv && typeof conv === "object" ? conv : null;
    },
    getMeta(key) {
      const state = getState();
      state.meta ??= {};
      const k = String(key || "");
      return k ? state.meta[k] : undefined;
    },
    setMeta(key, value) {
      const state = getState();
      state.meta ??= {};
      const k = String(key || "");
      if (!k) return;
      state.meta[k] = value === undefined ? null : value;
      setState(state);
      markDirty();
    },
    getChatSettings(chatId) {
      const state = getState();
      const key = String(chatId);
      state.chats ??= {};
      state.chats[key] ??= defaultChatSettings();
      return state.chats[key];
    },
    updateChatSettings(chatId, updater) {
      const state = getState();
      const chat = this.getChatSettings(chatId);
      updater(chat);
      chat.updatedAt = nowMs();
      setState(state);
      markDirty();
      return chat;
    },
    touchChat(chatId, meta) {
      const state = getState();
      const chat = this.getChatSettings(chatId);
      const m = meta && typeof meta === "object" ? meta : {};
      if (m.chatType !== undefined) chat.chatType = String(m.chatType || "");
      if (m.title !== undefined) chat.title = String(m.title || "");
      if (m.username !== undefined) chat.username = String(m.username || "");
      chat.lastSeenAt = nowMs();
      chat.updatedAt = nowMs();
      setState(state);
      markDirty();
    },
    listKnownChats() {
      const state = getState();
      const items = [];
      for (const [chatId, chat] of Object.entries(state.chats || {})) {
        if (!chat || typeof chat !== "object") continue;
        items.push({
          chatId: String(chatId),
          chatType: String(chat.chatType || ""),
          title: String(chat.title || ""),
          username: String(chat.username || ""),
          lastSeenAt: Number(chat.lastSeenAt || 0),
          providerId: String(chat.providerId || ""),
          autoReply: Boolean(chat.autoReply),
          replyStyle: normalizeOptionalChatReplyStyle(chat.replyStyle),
          globalPersonaEnabled: Boolean(chat.globalPersonaEnabled),
          globalPersonaUserId: String(chat.globalPersonaUserId || ""),
          globalPersonaReplyLimit: normalizeGlobalPersonaReplyLimit(chat.globalPersonaReplyLimit),
          globalPersonaReplyCount: normalizeGlobalPersonaReplyCount(chat.globalPersonaReplyCount)
        });
      }
      items.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
      return items;
    },
    getUserProfile(userId) {
      const state = getState();
      const key = String(userId || "");
      if (!key) return defaultUserProfile();
      state.userProfiles ??= {};
      state.userProfiles[key] ??= defaultUserProfile();
      normalizeUserProfileState(state.userProfiles[key]);
      return state.userProfiles[key];
    },
    updateUserProfile(userId, updater) {
      const state = getState();
      const key = String(userId || "");
      if (!key) return defaultUserProfile();
      const profile = this.getUserProfile(key);
      updater(profile);
      normalizeUserProfileState(profile);
      profile.updatedAt = nowMs();
      setState(state);
      markDirty();
      return profile;
    },
    touchUser(userId, meta) {
      const state = getState();
      const key = String(userId || "");
      if (!key) return;
      const profile = this.getUserProfile(key);
      const m = meta && typeof meta === "object" ? meta : {};
      if (m.username !== undefined) profile.username = String(m.username || "");
      if (m.firstName !== undefined) profile.firstName = String(m.firstName || "");
      if (m.lastName !== undefined) profile.lastName = String(m.lastName || "");
      profile.lastSeenAt = nowMs();
      profile.updatedAt = nowMs();
      setState(state);
      markDirty();
    },
    listUserProfiles() {
      const state = getState();
      const items = [];
      for (const [userId, profile] of Object.entries(state.userProfiles || {})) {
        if (!profile || typeof profile !== "object") continue;
        normalizeUserProfileState(profile);
        items.push({
          userId: String(userId),
          username: String(profile.username || ""),
          firstName: String(profile.firstName || ""),
          lastName: String(profile.lastName || ""),
          displayNameMode: normalizeUserDisplayNameMode(profile.displayNameMode),
          customDisplayName: String(profile.customDisplayName || ""),
          customPersona: String(profile.customPersona || ""),
          customPersonaEnabled: normalizeBool(profile.customPersonaEnabled, false),
          customPrompt1: String(profile.customPrompt1 || ""),
          customPrompt2: String(profile.customPrompt2 || ""),
          activePromptSlot: normalizeUserPromptSlot(profile.activePromptSlot),
          lastSeenAt: Number(profile.lastSeenAt || 0),
          hasPersona: Boolean(String(profile.customPersona || "").trim()),
          hasPrompt1: Boolean(String(profile.customPrompt1 || "").trim()),
          hasPrompt2: Boolean(String(profile.customPrompt2 || "").trim())
        });
      }
      items.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
      return items;
    },
    listConversationKeys() {
      const state = getState();
      state.conversations ??= {};
      return Object.keys(state.conversations);
    },
    listConversationMetas() {
      const state = getState();
      state.conversations ??= {};
      const items = [];
      for (const [key, conv] of Object.entries(state.conversations)) {
        if (!conv || typeof conv !== "object") continue;
        items.push({
          key: String(key),
          updatedAt: Number(conv.updatedAt || 0),
          factsCount: Array.isArray(conv.facts) ? conv.facts.length : 0,
          historyCount: Array.isArray(conv.history) ? conv.history.length : 0
        });
      }
      items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      return items;
    },
    getConversation({ chatId, userId, chatType }) {
      const key = conversationKey({ chatId, userId, chatType });
      return this.getConversationByKey(key);
    },
    getConversationByKey(key) {
      const state = getState();
      const k = String(key || "");
      if (!k) return null;
      state.conversations ??= {};
      state.conversations[k] ??= defaultConversation();
      return state.conversations[k];
    },
    updateConversation({ chatId, userId, chatType }, updater) {
      const key = conversationKey({ chatId, userId, chatType });
      return this.updateConversationByKey(key, updater);
    },
    updateConversationByKey(key, updater) {
      const state = getState();
      const conv = this.getConversationByKey(key);
      if (!conv) return null;
      updater(conv);
      conv.updatedAt = nowMs();
      setState(state);
      markDirty();
      return conv;
    },
    deleteConversationByKey(key) {
      const state = getState();
      const k = String(key || "");
      if (!k) return false;
      state.conversations ??= {};
      if (!state.conversations[k]) return false;
      delete state.conversations[k];
      setState(state);
      markDirty();
      return true;
    },
    getUsageDay({ day, scope, id }) {
      const state = getState();
      state.usageDaily ??= {};
      const d = String(day || "");
      const s = scope === "chat" ? "chat" : "user";
      const sid = String(id || "");
      if (!d || !sid) return { charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, replies: 0, requests: 0 };
      const row = state.usageDaily[d]?.[s]?.[sid];
      return {
        charsIn: Number(row?.charsIn || 0),
        charsOut: Number(row?.charsOut || 0),
        tokensIn: Number(row?.tokensIn || 0),
        tokensOut: Number(row?.tokensOut || 0),
        replies: Number(row?.replies || 0),
        requests: Number(row?.requests || 0)
      };
    },
    addUsageDay({ day, scope, id, charsIn = 0, charsOut = 0, tokensIn = 0, tokensOut = 0, replies = 0, requests = 0 }) {
      const state = getState();
      state.usageDaily ??= {};
      const d = String(day || "");
      const s = scope === "chat" ? "chat" : "user";
      const sid = String(id || "");
      if (!d || !sid) return;
      state.usageDaily[d] ??= { chat: {}, user: {} };
      state.usageDaily[d][s] ??= {};
      const cur =
        state.usageDaily[d][s][sid] || { charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, replies: 0, requests: 0, updatedAt: 0 };
      cur.charsIn = Number(cur.charsIn || 0) + Number(charsIn || 0);
      cur.charsOut = Number(cur.charsOut || 0) + Number(charsOut || 0);
      cur.tokensIn = Number(cur.tokensIn || 0) + Number(tokensIn || 0);
      cur.tokensOut = Number(cur.tokensOut || 0) + Number(tokensOut || 0);
      cur.replies = Number(cur.replies || 0) + Number(replies || 0);
      cur.requests = Number(cur.requests || 0) + Number(requests || 0);
      cur.updatedAt = nowMs();
      state.usageDaily[d][s][sid] = cur;

      const days = Object.keys(state.usageDaily).sort();
      if (days.length > 90) {
        for (const old of days.slice(0, days.length - 90)) delete state.usageDaily[old];
      }
      setState(state);
      markDirty();
    },
    getUsageSummary({ days = 30 } = {}) {
      const state = getState();
      state.usageDaily ??= {};
      const allDays = Object.keys(state.usageDaily).sort();
      const picked = allDays.slice(Math.max(0, allDays.length - clampInt(days, 1, 365)));
      const byDay = picked.map((d) => {
        const row = state.usageDaily[d] || {};
        const sumScope = (scopeKey) => {
          const entries = Object.values(row[scopeKey] || {});
          return entries.reduce(
            (acc, v) => {
              acc.charsIn += Number(v?.charsIn || 0);
              acc.charsOut += Number(v?.charsOut || 0);
              acc.tokensIn += Number(v?.tokensIn || 0);
              acc.tokensOut += Number(v?.tokensOut || 0);
              acc.replies += Number(v?.replies || 0);
              acc.requests += Number(v?.requests || 0);
              return acc;
            },
            { charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, replies: 0, requests: 0 }
          );
        };
        const total = sumScope("chat");
        return { day: d, ...total };
      });
      const total = byDay.reduce(
        (acc, r) => {
          acc.charsIn += r.charsIn;
          acc.charsOut += r.charsOut;
          acc.tokensIn += r.tokensIn;
          acc.tokensOut += r.tokensOut;
          acc.replies += r.replies;
          acc.requests += r.requests;
          return acc;
        },
        { charsIn: 0, charsOut: 0, tokensIn: 0, tokensOut: 0, replies: 0, requests: 0 }
      );
      return { total, byDay };
    },
    getTelegramOffset() {
      const state = getState();
      state.telegram ??= {};
      const n = Number(state.telegram.offset ?? 0);
      return Number.isFinite(n) ? n : 0;
    },
    setTelegramOffset(offset) {
      const state = getState();
      state.telegram ??= {};
      const next = Number(offset ?? 0);
      if (!Number.isFinite(next) || next < 0) return;
      state.telegram.offset = next;
      setState(state);
      markDirty();
    },
    async flush() {}
  };
}

export function loadJsonState(statePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (raw && typeof raw === "object") return normalizeJsonState(raw);
    return normalizeJsonState({ chats: {}, conversations: {}, telegram: { offset: 0 } });
  } catch {
    return normalizeJsonState({ chats: {}, conversations: {}, telegram: { offset: 0 } });
  }
}

function normalizeJsonState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  state.chats = state.chats && typeof state.chats === "object" ? state.chats : {};
  state.conversations = state.conversations && typeof state.conversations === "object" ? state.conversations : {};
  state.userProfiles = state.userProfiles && typeof state.userProfiles === "object" ? state.userProfiles : {};
  state.telegram = state.telegram && typeof state.telegram === "object" ? state.telegram : { offset: 0 };
  state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  state.usageDaily = state.usageDaily && typeof state.usageDaily === "object" ? state.usageDaily : {};

  for (const [chatId, chat] of Object.entries(state.chats)) {
    if (!chat || typeof chat !== "object") continue;
    const defaults = defaultChatSettings();
    chat.providerId = String(chat.providerId || "");
    chat.autoReply = Boolean(chat.autoReply);
    chat.replyStyle = normalizeOptionalChatReplyStyle(chat.replyStyle ?? defaults.replyStyle);
    chat.globalPersonaEnabled = normalizeBool(chat.globalPersonaEnabled, defaults.globalPersonaEnabled);
    chat.globalPersonaUserId = String(chat.globalPersonaUserId || "");
    chat.globalPersonaReplyLimit = normalizeGlobalPersonaReplyLimit(chat.globalPersonaReplyLimit ?? defaults.globalPersonaReplyLimit);
    chat.globalPersonaReplyCount = normalizeGlobalPersonaReplyCount(chat.globalPersonaReplyCount ?? defaults.globalPersonaReplyCount);
    chat.chatType = String(chat.chatType || "");
    chat.title = String(chat.title || "");
    chat.username = String(chat.username || "");
    chat.lastSeenAt = Number(chat.lastSeenAt || 0);
    chat.createdAt = Number(chat.createdAt || defaults.createdAt);
    chat.updatedAt = Number(chat.updatedAt || defaults.updatedAt);
    const hasLegacy =
      "promptId" in chat || "memoryEnabled" in chat || "facts" in chat || "history" in chat || "personaId" in chat;
    if (!hasLegacy) continue;
    const key = String(chatId);
    state.conversations[key] ??= {};
    const conv = state.conversations[key];
    conv.promptId ??= String(chat.promptId || "");
    conv.personaId ??= String(chat.personaId || "");
    conv.memoryEnabled ??= chat.memoryEnabled ?? null;
    conv.facts ??= Array.isArray(chat.facts) ? chat.facts : [];
    conv.history ??= Array.isArray(chat.history) ? chat.history : [];
    conv.createdAt ??= chat.createdAt ?? nowMs();
    conv.updatedAt ??= chat.updatedAt ?? nowMs();

    delete chat.promptId;
    delete chat.personaId;
    delete chat.memoryEnabled;
    delete chat.facts;
    delete chat.history;
  }

  for (const profile of Object.values(state.userProfiles)) {
    if (!profile || typeof profile !== "object") continue;
    normalizeUserProfileState(profile);
  }

  return state;
}

async function atomicWriteJson(filePath, obj) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}
