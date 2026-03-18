import { nowMs } from "../util.js";

export const CHAT_REPLY_STYLES = new Set(["reply_only", "reply_and_mention", "mention_only"]);
export const USER_DISPLAY_NAME_MODES = new Set(["username", "custom"]);
export const USER_PROMPT_SLOTS = new Set(["", "slot1", "slot2"]);

export function defaultChatSettings() {
  return {
    providerId: "",
    autoReply: false,
    replyStyle: "",
    chatType: "",
    title: "",
    username: "",
    lastSeenAt: 0,
    createdAt: nowMs(),
    updatedAt: nowMs()
  };
}

export function defaultConversation() {
  return {
    promptId: "",
    personaId: "",
    memoryEnabled: null,
    facts: [],
    history: [],
    summaryText: "",
    summaryUpdatedAt: 0,
    createdAt: nowMs(),
    updatedAt: nowMs()
  };
}

export function defaultUserProfile() {
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
    createdAt: nowMs(),
    updatedAt: nowMs()
  };
}

export function conversationKey({ chatId, userId, chatType }) {
  const c = String(chatId);
  const u = String(userId);
  const type = String(chatType || "");
  if (type === "group" || type === "supergroup") return `${c}:${u}`;
  return c;
}

export function clampInt(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

export function normalizeChatReplyStyle(value) {
  const style = String(value || "").trim().toLowerCase();
  return CHAT_REPLY_STYLES.has(style) ? style : "reply_and_mention";
}

export function normalizeOptionalChatReplyStyle(value) {
  const style = String(value || "").trim().toLowerCase();
  if (!style || style === "default" || style === "inherit") return "";
  return CHAT_REPLY_STYLES.has(style) ? style : "";
}

export function getEffectiveChatReplyStyle({ cfg, chatSettings }) {
  const explicit = normalizeOptionalChatReplyStyle(chatSettings?.replyStyle);
  if (explicit) return explicit;
  return normalizeChatReplyStyle(cfg?.telegram?.replyStyleByDefault);
}

export function normalizeUserDisplayNameMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return USER_DISPLAY_NAME_MODES.has(mode) ? mode : "username";
}

export function normalizeUserPromptSlot(value) {
  const slot = String(value || "").trim().toLowerCase();
  if (slot === "1") return "slot1";
  if (slot === "2") return "slot2";
  if (slot === "off" || slot === "none" || slot === "disable") return "";
  return USER_PROMPT_SLOTS.has(slot) ? slot : "";
}

export function clampText(value, maxLen) {
  const raw = String(value || "").trim();
  const lim = clampInt(maxLen, 1, 200000);
  return raw.length > lim ? raw.slice(0, lim) : raw;
}

export function getActiveUserPrompt(profile) {
  const slot = normalizeUserPromptSlot(profile?.activePromptSlot);
  if (slot === "slot1") return { slot, text: clampText(profile?.customPrompt1, 12000) };
  if (slot === "slot2") return { slot, text: clampText(profile?.customPrompt2, 12000) };
  return { slot: "", text: "" };
}
