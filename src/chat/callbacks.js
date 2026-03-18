import { bt } from "../botI18n.js";
import { clearConversationHistory } from "./commands.js";
import { menuMarkup, menuText, parseCallbackData } from "./menu.js";
import { normalizeUserDisplayNameMode, normalizeUserPromptSlot } from "../state/common.js";

export async function handleCallbackQueryInternal({ logger, configStore, stateStore, chatId, userId, chatType, messageId, data, lang }) {
  const t = (key, vars) => bt(lang, key, vars);
  const parsed = parseCallbackData(data);
  if (!parsed) return { text: t("err.invalid_action"), mode: "send" };

  if (parsed.type === "menu") {
    const screen = parsed.value;
    return {
      text: menuText({ configStore, stateStore, chatId, userId, chatType, screen, lang }),
      mode: "edit",
      replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen, lang })
    };
  }

  if (parsed.type === "set") {
    const { key, value } = parsed;
    const cfg = configStore.get();
    const conv = stateStore.getConversation({ chatId, userId, chatType });
    if (!conv) return { text: t("err.no_conversation"), mode: "send" };

    if (key === "api") {
      const exists = cfg.providers.some((p) => p.id === value);
      if (exists) stateStore.updateChatSettings(chatId, (c) => (c.providerId = value));
      return {
        text: exists ? t("cb.provider_set", { id: value }) : t("cb.unknown_provider", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "prompt") {
      const exists = cfg.prompts.some((p) => p.id === value);
      if (exists) stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.promptId = value));
      return {
        text: exists ? t("cb.prompt_set", { id: value }) : t("cb.unknown_prompt", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "persona") {
      const exists = cfg.personas.some((p) => p.id === value);
      if (exists) stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.personaId = value));
      return {
        text: exists ? t("cb.persona_set", { id: value }) : t("cb.unknown_persona", { id: value }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "memory") {
      const mode = value === "on" ? "on" : value === "off" ? "off" : "";
      if (!mode) return { text: t("cb.memory_invalid"), mode: "send" };
      stateStore.updateConversation({ chatId, userId, chatType }, (c) => (c.memoryEnabled = mode === "on"));
      return {
        text: t("cb.memory", { mode: mode === "on" ? t("memory.on") : t("memory.off") }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "userprompt") {
      const next = normalizeUserPromptSlot(value);
      const profile = stateStore.getUserProfile?.(userId);
      if (!profile) return { text: t("profile.slot_invalid"), mode: "send" };
      if (next === "slot1" && !String(profile.customPrompt1 || "").trim()) {
        return {
          text: t("cb.user_prompt_empty", { slot: t("profile.user_prompt_slot1") }),
          mode: "edit",
          replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "userprompt", lang })
        };
      }
      if (next === "slot2" && !String(profile.customPrompt2 || "").trim()) {
        return {
          text: t("cb.user_prompt_empty", { slot: t("profile.user_prompt_slot2") }),
          mode: "edit",
          replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "userprompt", lang })
        };
      }
      stateStore.updateUserProfile?.(userId, (p) => {
        p.activePromptSlot = next;
      });
      return {
        text: next ? t("profile.prompt_active", { slot: t(`profile.user_prompt_${next}`) }) : t("profile.prompt_active_off"),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }

    if (key === "namemode") {
      const next = normalizeUserDisplayNameMode(value);
      const profile = stateStore.getUserProfile?.(userId);
      if (!profile) return { text: t("err.unknown_action"), mode: "send" };
      if (next === "custom" && !String(profile.customDisplayName || "").trim()) {
        return {
          text: t("cb.name_mode_custom_missing"),
          mode: "edit",
          replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "name", lang })
        };
      }
      stateStore.updateUserProfile?.(userId, (p) => {
        p.displayNameMode = next;
      });
      return {
        text: t("profile.name_mode_set", { mode: t(`profile.name_mode_${next}`) }),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }
  }

  if (parsed.type === "do") {
    if (parsed.value === "reset") {
      clearConversationHistory({ stateStore, chatId, userId, chatType });
      return {
        text: t("cb.cleared"),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "root", lang })
      };
    }
    if (parsed.value === "namehelp") {
      return {
        text: t("cb.name_help"),
        mode: "edit",
        replyMarkup: menuMarkup({ configStore, stateStore, chatId, userId, chatType, screen: "name", lang })
      };
    }
  }

  return { text: t("err.unknown_action"), mode: "send" };
}
