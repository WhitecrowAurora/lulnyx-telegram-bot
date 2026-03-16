import { nowMs } from "../util.js";

export function defaultChatSettings() {
  return {
    providerId: "",
    autoReply: false,
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

