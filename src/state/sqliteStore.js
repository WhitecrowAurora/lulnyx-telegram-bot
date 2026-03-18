import fs from "node:fs";
import path from "node:path";
import { ensureDirSync, nowMs } from "../util.js";
import { resolveAppRootDir } from "../appPaths.js";
import {
  clampInt,
  conversationKey,
  defaultUserProfile,
  normalizeOptionalChatReplyStyle,
  normalizeUserDisplayNameMode,
  normalizeUserPromptSlot
} from "./common.js";
import { loadJsonState } from "./jsonStore.js";

export async function createSqliteStateStore({ logger, configStore }) {
  const cfg = configStore.get();
  const rootDir = resolveAppRootDir();
  const relPath = String(cfg.stateStorage?.sqlitePath || "data/state.sqlite");
  const dbPath = path.isAbsolute(relPath) ? relPath : path.join(rootDir, relPath);
  ensureDirSync(fs, path.dirname(dbPath));

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_settings (
      chat_id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL DEFAULT '',
      auto_reply INTEGER NOT NULL DEFAULT 0,
      reply_style TEXT NOT NULL DEFAULT 'reply_and_mention',
      chat_type TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      last_seen_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      conv_key TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL DEFAULT '',
      persona_id TEXT NOT NULL DEFAULT '',
      memory_enabled INTEGER,
      facts_json TEXT NOT NULL DEFAULT '[]',
      history_json TEXT NOT NULL DEFAULT '[]',
      summary_text TEXT NOT NULL DEFAULT '',
      summary_updated_at INTEGER NOT NULL DEFAULT 0,
      facts_count INTEGER NOT NULL DEFAULT 0,
      history_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_daily (
      day TEXT NOT NULL,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      chars_in INTEGER NOT NULL DEFAULT 0,
      chars_out INTEGER NOT NULL DEFAULT 0,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      requests INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (day, scope, scope_id)
    );
    CREATE TABLE IF NOT EXISTS daily_summaries (
      day TEXT NOT NULL,
      conv_key TEXT NOT NULL,
      memory_text TEXT NOT NULL DEFAULT '',
      persona_text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (day, conv_key)
    );
    CREATE TABLE IF NOT EXISTS bot_docs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      display_name_mode TEXT NOT NULL DEFAULT 'username',
      custom_display_name TEXT NOT NULL DEFAULT '',
      custom_prompt_1 TEXT NOT NULL DEFAULT '',
      custom_prompt_2 TEXT NOT NULL DEFAULT '',
      active_prompt_slot TEXT NOT NULL DEFAULT '',
      last_seen_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Backward-compatible migrations for existing sqlite DBs
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN auto_reply INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN reply_style TEXT NOT NULL DEFAULT 'reply_and_mention'");
  } catch {}
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN chat_type TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN title TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE chat_settings ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN summary_text TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN summary_updated_at INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE usage_daily ADD COLUMN chars_in INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE usage_daily ADD COLUMN chars_out INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN display_name_mode TEXT NOT NULL DEFAULT 'username'");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN custom_display_name TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN custom_prompt_1 TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN custom_prompt_2 TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN active_prompt_slot TEXT NOT NULL DEFAULT ''");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0");
  } catch {}

  // Optional one-time migration from JSON state file if DB is empty
  tryMigrateFromJson({ logger, configStore, db });

  const stmtGetMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
  const stmtUpsertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const stmtGetChat = db.prepare(
    "SELECT chat_id, provider_id, auto_reply, reply_style, chat_type, title, username, last_seen_at, created_at, updated_at FROM chat_settings WHERE chat_id = ?"
  );
  const stmtUpsertChat = db.prepare(`
    INSERT INTO chat_settings (chat_id, provider_id, auto_reply, reply_style, chat_type, title, username, last_seen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      provider_id=excluded.provider_id,
      auto_reply=excluded.auto_reply,
      reply_style=excluded.reply_style,
      chat_type=excluded.chat_type,
      title=excluded.title,
      username=excluded.username,
      last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at
  `);
  const stmtListChats = db.prepare(
    "SELECT chat_id, provider_id, auto_reply, reply_style, chat_type, title, username, last_seen_at, created_at, updated_at FROM chat_settings"
  );

  const stmtGetConv = db.prepare(`
    SELECT conv_key, prompt_id, persona_id, memory_enabled, facts_json, history_json, summary_text, summary_updated_at, created_at, updated_at
    FROM conversations WHERE conv_key = ?
  `);
  const stmtListConvKeys = db.prepare("SELECT conv_key FROM conversations");
  const stmtListConvs = db.prepare(`
    SELECT conv_key, prompt_id, persona_id, memory_enabled, facts_count, history_count, created_at, updated_at
    FROM conversations ORDER BY updated_at DESC
  `);
  const stmtUpsertConv = db.prepare(`
    INSERT INTO conversations (
      conv_key, prompt_id, persona_id, memory_enabled, facts_json, history_json, summary_text, summary_updated_at, facts_count, history_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(conv_key) DO UPDATE SET
      prompt_id=excluded.prompt_id,
      persona_id=excluded.persona_id,
      memory_enabled=excluded.memory_enabled,
      facts_json=excluded.facts_json,
      history_json=excluded.history_json,
      summary_text=excluded.summary_text,
      summary_updated_at=excluded.summary_updated_at,
      facts_count=excluded.facts_count,
      history_count=excluded.history_count,
      updated_at=excluded.updated_at
  `);
  const stmtDeleteConv = db.prepare("DELETE FROM conversations WHERE conv_key = ?");

  const stmtGetUsage = db.prepare(`
    SELECT chars_in, chars_out, tokens_in, tokens_out, replies, requests
    FROM usage_daily WHERE day = ? AND scope = ? AND scope_id = ?
  `);
  const stmtAddUsage = db.prepare(`
    INSERT INTO usage_daily (day, scope, scope_id, chars_in, chars_out, tokens_in, tokens_out, replies, requests, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, scope, scope_id) DO UPDATE SET
      chars_in=usage_daily.chars_in + excluded.chars_in,
      chars_out=usage_daily.chars_out + excluded.chars_out,
      tokens_in=usage_daily.tokens_in + excluded.tokens_in,
      tokens_out=usage_daily.tokens_out + excluded.tokens_out,
      replies=usage_daily.replies + excluded.replies,
      requests=usage_daily.requests + excluded.requests,
      updated_at=excluded.updated_at
  `);
  const stmtUsageByDay = db.prepare(`
    SELECT day,
      SUM(chars_in) AS chars_in,
      SUM(chars_out) AS chars_out,
      SUM(tokens_in) AS tokens_in,
      SUM(tokens_out) AS tokens_out,
      SUM(replies) AS replies,
      SUM(requests) AS requests
    FROM usage_daily
    WHERE scope = 'chat'
    GROUP BY day
    ORDER BY day DESC
    LIMIT ?
  `);
  const stmtUsageTotal = db.prepare(`
    SELECT
      SUM(chars_in) AS chars_in,
      SUM(chars_out) AS chars_out,
      SUM(tokens_in) AS tokens_in,
      SUM(tokens_out) AS tokens_out,
      SUM(replies) AS replies,
      SUM(requests) AS requests
    FROM usage_daily
    WHERE scope = 'chat'
  `);

  const stmtUpsertDailySummary = db.prepare(`
    INSERT INTO daily_summaries (day, conv_key, memory_text, persona_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, conv_key) DO UPDATE SET
      memory_text=excluded.memory_text,
      persona_text=excluded.persona_text,
      updated_at=excluded.updated_at
  `);
  const stmtListDailyDays = db.prepare("SELECT DISTINCT day FROM daily_summaries ORDER BY day DESC LIMIT ?");
  const stmtListDailyForDay = db.prepare(`
    SELECT day, conv_key, memory_text, persona_text, created_at, updated_at
    FROM daily_summaries WHERE day = ?
    ORDER BY updated_at DESC
  `);
  const stmtListDailyForConv = db.prepare(`
    SELECT day, memory_text, persona_text, created_at, updated_at
    FROM daily_summaries
    WHERE conv_key = ?
    ORDER BY day DESC
    LIMIT ?
  `);
  const stmtGetBotDoc = db.prepare("SELECT value, updated_at FROM bot_docs WHERE key = ?");
  const stmtUpsertBotDoc = db.prepare(`
    INSERT INTO bot_docs (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  const stmtGetUserProfile = db.prepare(`
    SELECT user_id, username, first_name, last_name, display_name_mode, custom_display_name,
      custom_prompt_1, custom_prompt_2, active_prompt_slot, last_seen_at, created_at, updated_at
    FROM user_profiles WHERE user_id = ?
  `);
  const stmtUpsertUserProfile = db.prepare(`
    INSERT INTO user_profiles (
      user_id, username, first_name, last_name, display_name_mode, custom_display_name,
      custom_prompt_1, custom_prompt_2, active_prompt_slot, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      display_name_mode=excluded.display_name_mode,
      custom_display_name=excluded.custom_display_name,
      custom_prompt_1=excluded.custom_prompt_1,
      custom_prompt_2=excluded.custom_prompt_2,
      active_prompt_slot=excluded.active_prompt_slot,
      last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at
  `);
  const stmtListUserProfiles = db.prepare(`
    SELECT user_id, username, first_name, last_name, display_name_mode, custom_display_name,
      custom_prompt_1, custom_prompt_2, active_prompt_slot, last_seen_at, created_at, updated_at
    FROM user_profiles
  `);

  const store = {
    getBackendInfo() {
      return { type: "sqlite", dbPath };
    },
    getRaw() {
      const chats = {};
      for (const r of stmtListChats.all()) {
        chats[String(r.chat_id)] = {
          providerId: String(r.provider_id || ""),
          autoReply: Boolean(Number(r.auto_reply || 0)),
          replyStyle: normalizeOptionalChatReplyStyle(r.reply_style),
          createdAt: Number(r.created_at || 0),
          updatedAt: Number(r.updated_at || 0)
        };
      }
      const conversations = {};
      for (const r of stmtListConvs.all()) {
        conversations[String(r.conv_key)] = {
          promptId: String(r.prompt_id || ""),
          personaId: String(r.persona_id || ""),
          memoryEnabled: r.memory_enabled === null ? null : Boolean(Number(r.memory_enabled)),
          facts: [],
          history: [],
          summaryText: "",
          summaryUpdatedAt: 0,
          createdAt: Number(r.created_at || 0),
          updatedAt: Number(r.updated_at || 0)
        };
      }
      return {
        chats,
        conversations,
        userProfiles: Object.fromEntries(
          stmtListUserProfiles.all().map((r) => [
            String(r.user_id),
            {
              username: String(r.username || ""),
              firstName: String(r.first_name || ""),
              lastName: String(r.last_name || ""),
              displayNameMode: normalizeUserDisplayNameMode(r.display_name_mode),
              customDisplayName: String(r.custom_display_name || ""),
              customPrompt1: String(r.custom_prompt_1 || ""),
              customPrompt2: String(r.custom_prompt_2 || ""),
              activePromptSlot: normalizeUserPromptSlot(r.active_prompt_slot),
              lastSeenAt: Number(r.last_seen_at || 0),
              createdAt: Number(r.created_at || 0),
              updatedAt: Number(r.updated_at || 0)
            }
          ])
        ),
        meta: {},
        usageDaily: {},
        telegram: {
          offset: store.getTelegramOffset()
        }
      };
    },
    getMeta(key) {
      const k = String(key || "");
      if (!k) return undefined;
      const row = stmtGetMeta.get(k);
      if (!row) return undefined;
      const raw = String(row.value ?? "");
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    setMeta(key, value) {
      const k = String(key || "");
      if (!k) return;
      stmtUpsertMeta.run(k, JSON.stringify(value === undefined ? null : value));
    },
    getChatSettings(chatId) {
      const key = String(chatId);
      const row = stmtGetChat.get(key);
      if (row) {
        return {
          providerId: String(row.provider_id || ""),
          autoReply: Boolean(Number(row.auto_reply || 0)),
          replyStyle: normalizeOptionalChatReplyStyle(row.reply_style),
          chatType: String(row.chat_type || ""),
          title: String(row.title || ""),
          username: String(row.username || ""),
          lastSeenAt: Number(row.last_seen_at || 0),
          createdAt: Number(row.created_at || 0),
          updatedAt: Number(row.updated_at || 0)
        };
      }
      const ts = nowMs();
      stmtUpsertChat.run(key, "", 0, "", "", "", "", 0, ts, ts);
      return {
        providerId: "",
        autoReply: false,
        replyStyle: "",
        chatType: "",
        title: "",
        username: "",
        lastSeenAt: 0,
        createdAt: ts,
        updatedAt: ts
      };
    },
    updateChatSettings(chatId, updater) {
      const key = String(chatId);
      const current = store.getChatSettings(chatId);
      updater(current);
      const ts = nowMs();
      current.updatedAt = ts;
      stmtUpsertChat.run(
        key,
        String(current.providerId || ""),
        current.autoReply ? 1 : 0,
        normalizeOptionalChatReplyStyle(current.replyStyle),
        String(current.chatType || ""),
        String(current.title || ""),
        String(current.username || ""),
        Number(current.lastSeenAt || 0),
        Number(current.createdAt || ts),
        ts
      );
      return current;
    },
    touchChat(chatId, meta) {
      const key = String(chatId);
      const current = store.getChatSettings(chatId);
      const m = meta && typeof meta === "object" ? meta : {};
      const ts = nowMs();
      current.chatType = String(m.chatType ?? current.chatType ?? "");
      current.title = String(m.title ?? current.title ?? "");
      current.username = String(m.username ?? current.username ?? "");
      current.lastSeenAt = ts;
      current.updatedAt = ts;
      stmtUpsertChat.run(
        key,
        String(current.providerId || ""),
        current.autoReply ? 1 : 0,
        normalizeOptionalChatReplyStyle(current.replyStyle),
        String(current.chatType || ""),
        String(current.title || ""),
        String(current.username || ""),
        Number(current.lastSeenAt || ts),
        Number(current.createdAt || ts),
        ts
      );
    },
    listKnownChats() {
      const rows = stmtListChats.all();
      const items = rows.map((r) => ({
        chatId: String(r.chat_id),
        chatType: String(r.chat_type || ""),
        title: String(r.title || ""),
        username: String(r.username || ""),
        lastSeenAt: Number(r.last_seen_at || 0),
        providerId: String(r.provider_id || ""),
        autoReply: Boolean(Number(r.auto_reply || 0)),
        replyStyle: normalizeOptionalChatReplyStyle(r.reply_style)
      }));
      items.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
      return items;
    },
    getUserProfile(userId) {
      const key = String(userId || "");
      if (!key) return defaultUserProfile();
      const row = stmtGetUserProfile.get(key);
      if (row) return rowToUserProfile(row);
      const ts = nowMs();
      stmtUpsertUserProfile.run(key, "", "", "", "username", "", "", "", "", 0, ts, ts);
      return {
        username: "",
        firstName: "",
        lastName: "",
        displayNameMode: "username",
        customDisplayName: "",
        customPrompt1: "",
        customPrompt2: "",
        activePromptSlot: "",
        lastSeenAt: 0,
        createdAt: ts,
        updatedAt: ts
      };
    },
    updateUserProfile(userId, updater) {
      const key = String(userId || "");
      if (!key) return defaultUserProfile();
      const current = store.getUserProfile(key);
      updater(current);
      const ts = nowMs();
      current.updatedAt = ts;
      stmtUpsertUserProfile.run(
        key,
        String(current.username || ""),
        String(current.firstName || ""),
        String(current.lastName || ""),
        normalizeUserDisplayNameMode(current.displayNameMode),
        String(current.customDisplayName || ""),
        String(current.customPrompt1 || ""),
        String(current.customPrompt2 || ""),
        normalizeUserPromptSlot(current.activePromptSlot),
        Number(current.lastSeenAt || 0),
        Number(current.createdAt || ts),
        ts
      );
      return current;
    },
    touchUser(userId, meta) {
      const key = String(userId || "");
      if (!key) return;
      const current = store.getUserProfile(key);
      const m = meta && typeof meta === "object" ? meta : {};
      const ts = nowMs();
      current.username = String(m.username ?? current.username ?? "");
      current.firstName = String(m.firstName ?? current.firstName ?? "");
      current.lastName = String(m.lastName ?? current.lastName ?? "");
      current.lastSeenAt = ts;
      current.updatedAt = ts;
      stmtUpsertUserProfile.run(
        key,
        String(current.username || ""),
        String(current.firstName || ""),
        String(current.lastName || ""),
        normalizeUserDisplayNameMode(current.displayNameMode),
        String(current.customDisplayName || ""),
        String(current.customPrompt1 || ""),
        String(current.customPrompt2 || ""),
        normalizeUserPromptSlot(current.activePromptSlot),
        Number(current.lastSeenAt || ts),
        Number(current.createdAt || ts),
        ts
      );
    },
    listUserProfiles() {
      const rows = stmtListUserProfiles.all();
      const items = rows.map((r) => ({
        userId: String(r.user_id || ""),
        username: String(r.username || ""),
        firstName: String(r.first_name || ""),
        lastName: String(r.last_name || ""),
        displayNameMode: normalizeUserDisplayNameMode(r.display_name_mode),
        customDisplayName: String(r.custom_display_name || ""),
        customPrompt1: String(r.custom_prompt_1 || ""),
        customPrompt2: String(r.custom_prompt_2 || ""),
        activePromptSlot: normalizeUserPromptSlot(r.active_prompt_slot),
        lastSeenAt: Number(r.last_seen_at || 0),
        hasPrompt1: Boolean(String(r.custom_prompt_1 || "").trim()),
        hasPrompt2: Boolean(String(r.custom_prompt_2 || "").trim())
      }));
      items.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
      return items;
    },
    listConversationKeys() {
      return stmtListConvKeys.all().map((r) => String(r.conv_key));
    },
    listConversationMetas() {
      const rows = stmtListConvs.all();
      return rows.map((r) => ({
        key: String(r.conv_key),
        updatedAt: Number(r.updated_at || 0),
        factsCount: Number(r.facts_count || 0),
        historyCount: Number(r.history_count || 0)
      }));
    },
    getConversation({ chatId, userId, chatType }) {
      const key = conversationKey({ chatId, userId, chatType });
      return store.getConversationByKey(key);
    },
    peekConversationByKey(key) {
      const k = String(key || "");
      if (!k) return null;
      const row = stmtGetConv.get(k);
      if (!row) return null;
      return rowToConversation(row);
    },
    getConversationByKey(key) {
      const k = String(key || "");
      if (!k) return null;
      const row = stmtGetConv.get(k);
      if (row) return rowToConversation(row);

      const ts = nowMs();
      stmtUpsertConv.run(k, "", "", null, "[]", "[]", "", 0, 0, 0, ts, ts);
      return {
        promptId: "",
        personaId: "",
        memoryEnabled: null,
        facts: [],
        history: [],
        summaryText: "",
        summaryUpdatedAt: 0,
        createdAt: ts,
        updatedAt: ts
      };
    },
    updateConversation({ chatId, userId, chatType }, updater) {
      const key = conversationKey({ chatId, userId, chatType });
      return store.updateConversationByKey(key, updater);
    },
    updateConversationByKey(key, updater) {
      const k = String(key || "");
      if (!k) return null;
      const conv = store.getConversationByKey(k);
      if (!conv) return null;
      updater(conv);
      const ts = nowMs();
      conv.updatedAt = ts;
      const factsJson = JSON.stringify(Array.isArray(conv.facts) ? conv.facts : []);
      const historyJson = JSON.stringify(Array.isArray(conv.history) ? conv.history : []);
      const summaryText = String(conv.summaryText || "");
      const summaryUpdatedAt = Number(conv.summaryUpdatedAt || 0);
      const factsCount = Array.isArray(conv.facts) ? conv.facts.length : 0;
      const historyCount = Array.isArray(conv.history) ? conv.history.length : 0;
      stmtUpsertConv.run(
        k,
        String(conv.promptId || ""),
        String(conv.personaId || ""),
        conv.memoryEnabled === null ? null : conv.memoryEnabled ? 1 : 0,
        factsJson,
        historyJson,
        summaryText,
        Number.isFinite(summaryUpdatedAt) ? summaryUpdatedAt : 0,
        factsCount,
        historyCount,
        Number(conv.createdAt || ts),
        ts
      );
      return conv;
    },
    deleteConversationByKey(key) {
      const k = String(key || "");
      if (!k) return false;
      const info = stmtDeleteConv.run(k);
      return Number(info?.changes || 0) > 0;
    },
    getUsageDay({ day, scope, id }) {
      const d = String(day || "");
      const s = scope === "chat" ? "chat" : "user";
      const sid = String(id || "");
      if (!d || !sid) return { tokensIn: 0, tokensOut: 0, replies: 0, requests: 0 };
      const row = stmtGetUsage.get(d, s, sid);
      return {
        charsIn: Number(row?.chars_in || 0),
        charsOut: Number(row?.chars_out || 0),
        tokensIn: Number(row?.tokens_in || 0),
        tokensOut: Number(row?.tokens_out || 0),
        replies: Number(row?.replies || 0),
        requests: Number(row?.requests || 0)
      };
    },
    addUsageDay({ day, scope, id, charsIn = 0, charsOut = 0, tokensIn = 0, tokensOut = 0, replies = 0, requests = 0 }) {
      const d = String(day || "");
      const s = scope === "chat" ? "chat" : "user";
      const sid = String(id || "");
      if (!d || !sid) return;
      stmtAddUsage.run(
        d,
        s,
        sid,
        Math.max(0, Math.trunc(Number(charsIn || 0))),
        Math.max(0, Math.trunc(Number(charsOut || 0))),
        Math.max(0, Math.trunc(Number(tokensIn || 0))),
        Math.max(0, Math.trunc(Number(tokensOut || 0))),
        Math.max(0, Math.trunc(Number(replies || 0))),
        Math.max(0, Math.trunc(Number(requests || 0))),
        nowMs()
      );
    },
    getUsageSummary({ days = 30 } = {}) {
      const lim = clampInt(days, 1, 365);
      const rows = stmtUsageByDay.all(lim);
      const byDay = rows.map((r) => ({
        day: String(r.day),
        charsIn: Number(r.chars_in || 0),
        charsOut: Number(r.chars_out || 0),
        tokensIn: Number(r.tokens_in || 0),
        tokensOut: Number(r.tokens_out || 0),
        replies: Number(r.replies || 0),
        requests: Number(r.requests || 0)
      }));
      const trow = stmtUsageTotal.get() || {};
      const total = {
        charsIn: Number(trow.chars_in || 0),
        charsOut: Number(trow.chars_out || 0),
        tokensIn: Number(trow.tokens_in || 0),
        tokensOut: Number(trow.tokens_out || 0),
        replies: Number(trow.replies || 0),
        requests: Number(trow.requests || 0)
      };
      return { total, byDay };
    },
    upsertDailySummary({ day, convKey, memoryText, personaText }) {
      const d = String(day || "");
      const k = String(convKey || "");
      if (!d || !k) return false;
      const ts = nowMs();
      stmtUpsertDailySummary.run(d, k, String(memoryText || ""), String(personaText || ""), ts, ts);
      return true;
    },
    listDailySummaryDays({ limit = 30 } = {}) {
      const lim = clampInt(limit, 1, 365);
      return stmtListDailyDays.all(lim).map((r) => String(r.day));
    },
    listDailySummaries({ day }) {
      const d = String(day || "");
      if (!d) return [];
      return stmtListDailyForDay.all(d).map((r) => ({
        day: String(r.day),
        convKey: String(r.conv_key),
        memoryText: String(r.memory_text || ""),
        personaText: String(r.persona_text || ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0)
      }));
    },
    listDailySummariesByConv({ convKey, limit = 30 } = {}) {
      const k = String(convKey || "");
      if (!k) return [];
      const lim = clampInt(limit, 1, 365);
      return stmtListDailyForConv.all(k, lim).map((r) => ({
        day: String(r.day),
        convKey: k,
        memoryText: String(r.memory_text || ""),
        personaText: String(r.persona_text || ""),
        createdAt: Number(r.created_at || 0),
        updatedAt: Number(r.updated_at || 0)
      }));
    },
    getBotDoc(key) {
      const k = String(key || "");
      if (!k) return null;
      const row = stmtGetBotDoc.get(k);
      if (!row) return null;
      return { key: k, value: String(row.value || ""), updatedAt: Number(row.updated_at || 0) };
    },
    setBotDoc(key, value) {
      const k = String(key || "");
      if (!k) return false;
      stmtUpsertBotDoc.run(k, String(value || ""), nowMs());
      return true;
    },
    getTelegramOffset() {
      const row = stmtGetMeta.get("telegram_offset");
      const n = Number(row?.value ?? 0);
      return Number.isFinite(n) ? n : 0;
    },
    setTelegramOffset(offset) {
      const next = Number(offset ?? 0);
      if (!Number.isFinite(next) || next < 0) return;
      stmtUpsertMeta.run("telegram_offset", String(next));
    },
    async flush() {
      // SQLite writes are synchronous per statement.
    }
  };

  return store;
}

function rowToConversation(row) {
  const facts = safeParseJsonArray(row.facts_json);
  const history = safeParseJsonArray(row.history_json);
  return {
    promptId: String(row.prompt_id || ""),
    personaId: String(row.persona_id || ""),
    memoryEnabled: row.memory_enabled === null ? null : Boolean(Number(row.memory_enabled)),
    facts,
    history,
    summaryText: String(row.summary_text || ""),
    summaryUpdatedAt: Number(row.summary_updated_at || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0)
  };
}

function rowToUserProfile(row) {
  return {
    username: String(row.username || ""),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    displayNameMode: normalizeUserDisplayNameMode(row.display_name_mode),
    customDisplayName: String(row.custom_display_name || ""),
    customPrompt1: String(row.custom_prompt_1 || ""),
    customPrompt2: String(row.custom_prompt_2 || ""),
    activePromptSlot: normalizeUserPromptSlot(row.active_prompt_slot),
    lastSeenAt: Number(row.last_seen_at || 0),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0)
  };
}

function safeParseJsonArray(s) {
  try {
    const v = JSON.parse(String(s || "[]"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function tryMigrateFromJson({ logger, configStore, db }) {
  const count = Number(db.prepare("SELECT COUNT(*) AS n FROM conversations").get()?.n ?? 0);
  const chatCount = Number(db.prepare("SELECT COUNT(*) AS n FROM chat_settings").get()?.n ?? 0);
  const metaCount = Number(db.prepare("SELECT COUNT(*) AS n FROM meta").get()?.n ?? 0);
  const userCount = Number(db.prepare("SELECT COUNT(*) AS n FROM user_profiles").get()?.n ?? 0);
  if (count > 0 || chatCount > 0 || metaCount > 0 || userCount > 0) return;

  const cfg = configStore.get();
  const rootDir = resolveAppRootDir();
  const relPath = String(cfg.stateStorage?.jsonPath || "data/state.json");
  const statePath = path.isAbsolute(relPath) ? relPath : path.join(rootDir, relPath);
  if (!fs.existsSync(statePath)) return;

  const jsonState = loadJsonState(statePath);
  const upMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const upChat = db.prepare(`
    INSERT INTO chat_settings (chat_id, provider_id, auto_reply, reply_style, chat_type, title, username, last_seen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      provider_id=excluded.provider_id,
      auto_reply=excluded.auto_reply,
      reply_style=excluded.reply_style,
      chat_type=excluded.chat_type,
      title=excluded.title,
      username=excluded.username,
      last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at
  `);
  const upConv = db.prepare(`
    INSERT INTO conversations (
      conv_key, prompt_id, persona_id, memory_enabled, facts_json, history_json, facts_count, history_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(conv_key) DO UPDATE SET
      prompt_id=excluded.prompt_id,
      persona_id=excluded.persona_id,
      memory_enabled=excluded.memory_enabled,
      facts_json=excluded.facts_json,
      history_json=excluded.history_json,
      facts_count=excluded.facts_count,
      history_count=excluded.history_count,
      updated_at=excluded.updated_at
  `);
  const upUser = db.prepare(`
    INSERT INTO user_profiles (
      user_id, username, first_name, last_name, display_name_mode, custom_display_name,
      custom_prompt_1, custom_prompt_2, active_prompt_slot, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      display_name_mode=excluded.display_name_mode,
      custom_display_name=excluded.custom_display_name,
      custom_prompt_1=excluded.custom_prompt_1,
      custom_prompt_2=excluded.custom_prompt_2,
      active_prompt_slot=excluded.active_prompt_slot,
      last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at
  `);

  try {
    for (const [chatId, chat] of Object.entries(jsonState.chats || {})) {
      upChat.run(
        String(chatId),
        String(chat?.providerId || ""),
        chat?.autoReply ? 1 : 0,
        normalizeOptionalChatReplyStyle(chat?.replyStyle),
        String(chat?.chatType || ""),
        String(chat?.title || ""),
        String(chat?.username || ""),
        Number(chat?.lastSeenAt || 0),
        Number(chat?.createdAt || nowMs()),
        Number(chat?.updatedAt || nowMs())
      );
    }
    for (const [key, c] of Object.entries(jsonState.conversations || {})) {
      const facts = Array.isArray(c?.facts) ? c.facts : [];
      const history = Array.isArray(c?.history) ? c.history : [];
      upConv.run(
        String(key),
        String(c?.promptId || ""),
        String(c?.personaId || ""),
        c?.memoryEnabled === null || c?.memoryEnabled === undefined ? null : c.memoryEnabled ? 1 : 0,
        JSON.stringify(facts),
        JSON.stringify(history),
        facts.length,
        history.length,
        Number(c?.createdAt || nowMs()),
        Number(c?.updatedAt || nowMs())
      );
    }
    for (const [userId, profile] of Object.entries(jsonState.userProfiles || {})) {
      upUser.run(
        String(userId),
        String(profile?.username || ""),
        String(profile?.firstName || ""),
        String(profile?.lastName || ""),
        normalizeUserDisplayNameMode(profile?.displayNameMode),
        String(profile?.customDisplayName || ""),
        String(profile?.customPrompt1 || ""),
        String(profile?.customPrompt2 || ""),
        normalizeUserPromptSlot(profile?.activePromptSlot),
        Number(profile?.lastSeenAt || 0),
        Number(profile?.createdAt || nowMs()),
        Number(profile?.updatedAt || nowMs())
      );
    }
    const off = Number(jsonState.telegram?.offset ?? 0);
    if (Number.isFinite(off) && off > 0) upMeta.run("telegram_offset", String(off));
    logger.info("migrated state from json to sqlite");
  } catch (err) {
    logger.warn("sqlite migration failed", err);
  }
}
