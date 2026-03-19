import {
  clampInt,
  clampText,
  normalizeBool,
  normalizeGlobalPersonaMode,
  normalizeGlobalPersonaQueue,
  normalizeGlobalPersonaReplyCount,
  normalizeGlobalPersonaReplyLimit
} from "./state/common.js";

const OPT_OUT_META_PREFIX = "group_persona_opt_out";

export function isGroupChatType(chatType) {
  const type = String(chatType || "").trim();
  return type === "group" || type === "supergroup";
}

export function getUserProfileDisplayName(profile, fallback = "") {
  const custom = String(profile?.customDisplayName || "").trim();
  if (custom) return custom;
  const username = String(profile?.username || "").trim();
  if (username) return username;
  const first = String(profile?.firstName || "").trim();
  const last = String(profile?.lastName || "").trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return String(fallback || "").trim();
}

export function getGroupPersonaOptOutKey({ chatId, userId }) {
  const cid = String(chatId || "").trim();
  const uid = String(userId || "").trim();
  return cid && uid ? `${OPT_OUT_META_PREFIX}:${cid}:${uid}` : "";
}

export function getGroupPersonaOptOut({ stateStore, chatId, userId }) {
  const key = getGroupPersonaOptOutKey({ chatId, userId });
  if (!key) return false;
  return normalizeBool(stateStore?.getMeta?.(key), false);
}

export function setGroupPersonaOptOut({ stateStore, chatId, userId, enabled }) {
  const key = getGroupPersonaOptOutKey({ chatId, userId });
  if (!key) return false;
  const next = enabled === true;
  stateStore?.setMeta?.(key, next);
  return next;
}

export function getNormalizedGroupPersonaState(chatSettings) {
  return {
    enabled: chatSettings?.globalPersonaEnabled === true,
    mode: normalizeGlobalPersonaMode(chatSettings?.globalPersonaMode),
    ownerUserId: String(chatSettings?.globalPersonaUserId || "").trim(),
    replyLimit: normalizeGlobalPersonaReplyLimit(chatSettings?.globalPersonaReplyLimit),
    replyCount: normalizeGlobalPersonaReplyCount(chatSettings?.globalPersonaReplyCount),
    queue: normalizeGlobalPersonaQueue(chatSettings?.globalPersonaQueue ?? chatSettings?.queue),
    cursor: clampInt(chatSettings?.globalPersonaCursor ?? chatSettings?.cursor, 0, 1000000)
  };
}

export function getGroupPersonaQueueEntries({ chatSettings, stateStore }) {
  const state = getNormalizedGroupPersonaState(chatSettings);
  return state.queue.map((entry, index) => {
    const profile = stateStore?.getUserProfile?.(entry.userId) || null;
    const personaText = clampText(profile?.customPersona, 12000);
    const replyLimit = normalizeGlobalPersonaReplyLimit(entry.replyLimit);
    const replyCount = normalizeGlobalPersonaReplyCount(entry.replyCount);
    const exhausted = replyLimit > 0 && replyCount >= replyLimit;
    return {
      index,
      userId: entry.userId,
      replyLimit,
      replyCount,
      remaining: replyLimit > 0 ? Math.max(0, replyLimit - replyCount) : null,
      joinedAt: clampInt(entry.joinedAt, 0, Number.MAX_SAFE_INTEGER),
      personaReady: Boolean(personaText),
      exhausted,
      available: Boolean(personaText) && !exhausted,
      personaText,
      profile,
      displayName: getUserProfileDisplayName(profile, entry.userId)
    };
  });
}

export function resolveGroupPersonaSelection({ chatId, userId, chatType, chatSettings, stateStore }) {
  const state = getNormalizedGroupPersonaState(chatSettings);
  const queueEntries = getGroupPersonaQueueEntries({ chatSettings: state, stateStore });
  const base = {
    enabled: false,
    globalEnabled: state.enabled,
    mode: state.mode,
    ownerUserId: state.ownerUserId,
    replyLimit: state.replyLimit,
    replyCount: state.replyCount,
    cursor: state.cursor,
    queueEntries,
    targetOptOut: false,
    reason: "disabled"
  };

  if (!isGroupChatType(chatType || chatSettings?.chatType)) return { ...base, reason: "not_group" };

  const targetOptOut = getGroupPersonaOptOut({ stateStore, chatId, userId });
  if (!state.enabled) return { ...base, targetOptOut, reason: "disabled" };
  if (targetOptOut) return { ...base, targetOptOut, reason: "target_opt_out" };

  if (state.mode === "single") {
    if (!state.ownerUserId) return { ...base, targetOptOut, reason: "missing_owner" };
    if (state.replyLimit > 0 && state.replyCount >= state.replyLimit) {
      return { ...base, targetOptOut, reason: "limit" };
    }
    const ownerProfile = stateStore?.getUserProfile?.(state.ownerUserId) || null;
    const text = clampText(ownerProfile?.customPersona, 12000);
    if (!text) return { ...base, targetOptOut, reason: "missing_persona" };
    return {
      ...base,
      enabled: true,
      targetOptOut,
      reason: "ok",
      selectedIndex: -1,
      selectedUserId: state.ownerUserId,
      selectedDisplayName: getUserProfileDisplayName(ownerProfile, state.ownerUserId),
      selectedProfile: ownerProfile,
      text
    };
  }

  if (queueEntries.length === 0) return { ...base, targetOptOut, reason: "queue_empty" };
  const available = queueEntries.filter((entry) => entry.available);
  if (available.length === 0) return { ...base, targetOptOut, reason: "queue_unavailable" };

  let selected = null;
  if (state.mode === "random") {
    selected = available[Math.floor(Math.random() * available.length)] || available[0];
  } else {
    const start = queueEntries.length > 0 ? state.cursor % queueEntries.length : 0;
    for (let offset = 0; offset < queueEntries.length; offset += 1) {
      const entry = queueEntries[(start + offset) % queueEntries.length];
      if (entry?.available) {
        selected = entry;
        break;
      }
    }
  }

  if (!selected) return { ...base, targetOptOut, reason: "queue_unavailable" };
  return {
    ...base,
    enabled: true,
    targetOptOut,
    reason: "ok",
    selectedIndex: selected.index,
    selectedUserId: selected.userId,
    selectedDisplayName: selected.displayName,
    selectedProfile: selected.profile,
    text: selected.personaText
  };
}

export function applyGroupPersonaReplyUsage({ stateStore, chatId, selection }) {
  if (!selection?.enabled) return null;
  return stateStore?.updateChatSettings?.(chatId, (chat) => {
    chat.globalPersonaReplyCount = normalizeGlobalPersonaReplyCount(Number(chat.globalPersonaReplyCount || 0) + 1);
    chat.globalPersonaMode = normalizeGlobalPersonaMode(chat.globalPersonaMode || selection.mode);

    if (selection.mode === "single") {
      if (selection.selectedUserId) chat.globalPersonaUserId = String(selection.selectedUserId);
      return;
    }

    const queue = normalizeGlobalPersonaQueue(chat.globalPersonaQueue);
    const index = queue.findIndex((entry) => String(entry?.userId || "") === String(selection.selectedUserId || ""));
    if (index < 0) return;
    const current = queue[index];
    queue[index] = {
      ...current,
      replyCount: normalizeGlobalPersonaReplyCount(Number(current.replyCount || 0) + 1)
    };
    chat.globalPersonaQueue = queue;
    if (selection.mode === "sequential" && queue.length > 0) chat.globalPersonaCursor = (index + 1) % queue.length;
  });
}

export function resetGroupPersonaUsageState(chatSettings) {
  chatSettings.globalPersonaReplyCount = 0;
  const queue = normalizeGlobalPersonaQueue(chatSettings.globalPersonaQueue);
  chatSettings.globalPersonaQueue = queue.map((entry) => ({
    ...entry,
    replyCount: 0
  }));
  chatSettings.globalPersonaCursor = 0;
}

export function upsertGroupPersonaQueueMember(chatSettings, { userId, replyLimit }) {
  const uid = String(userId || "").trim();
  if (!uid) return { changed: false, queue: normalizeGlobalPersonaQueue(chatSettings.globalPersonaQueue), index: -1 };
  const queue = normalizeGlobalPersonaQueue(chatSettings.globalPersonaQueue);
  const nextLimit = normalizeGlobalPersonaReplyLimit(replyLimit);
  const index = queue.findIndex((entry) => entry.userId === uid);
  if (index >= 0) {
    const current = queue[index];
    const changed = current.replyLimit !== nextLimit;
    if (changed) queue[index] = { ...current, replyLimit: nextLimit };
    chatSettings.globalPersonaQueue = queue;
    if (queue.length === 0) chatSettings.globalPersonaCursor = 0;
    else if (clampInt(chatSettings.globalPersonaCursor, 0, 1000000) >= queue.length) chatSettings.globalPersonaCursor = 0;
    return { changed, queue, index };
  }
  queue.push({
    userId: uid,
    replyLimit: nextLimit,
    replyCount: 0,
    joinedAt: Date.now()
  });
  chatSettings.globalPersonaQueue = queue;
  if (queue.length === 1) chatSettings.globalPersonaCursor = 0;
  return { changed: true, queue, index: queue.length - 1 };
}

export function removeGroupPersonaQueueMember(chatSettings, userId) {
  const uid = String(userId || "").trim();
  const queue = normalizeGlobalPersonaQueue(chatSettings.globalPersonaQueue);
  const index = queue.findIndex((entry) => entry.userId === uid);
  if (index < 0) return { changed: false, queue, removed: null };
  const [removed] = queue.splice(index, 1);
  const cursor = clampInt(chatSettings.globalPersonaCursor, 0, 1000000);
  if (queue.length === 0) chatSettings.globalPersonaCursor = 0;
  else if (index < cursor) chatSettings.globalPersonaCursor = cursor - 1;
  else if (cursor >= queue.length) chatSettings.globalPersonaCursor = 0;
  chatSettings.globalPersonaQueue = queue;
  return { changed: true, queue, removed };
}
